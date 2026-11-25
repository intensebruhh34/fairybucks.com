-- Read-only snapshot of installed Fairybucks privileged RPC definitions, 2026-11-23.
-- Regression fixture only. NOT a migration. No credentials or family rows.

-- fairybucks_decide_treasure
CREATE OR REPLACE FUNCTION public.fairybucks_decide_treasure(p_child_id uuid, p_request_id uuid, p_decision text, p_unlock_token text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  request public.treasure_requests%rowtype;
  item_name text;
  item_active boolean;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent account is required';
  end if;
  if p_decision is null or p_decision not in ('approved', 'declined', 'cancelled') then
    raise invalid_parameter_value using message = 'Invalid treasure request decision';
  end if;
  if p_decision <> 'cancelled' then
    if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
      return 'unlock_required';
    end if;
    perform 1 from private.fairybucks_parent_unlocks
      where parent_id = parent and session_id = auth_session
        and token_hash = extensions.digest(p_unlock_token, 'sha256')
        and expires_at > clock_timestamp()
      for share;
    if not found then return 'unlock_required'; end if;
  end if;

  select r.* into request from public.treasure_requests r
    join public.child_profiles c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.id = p_request_id and r.child_id = p_child_id and f.owner_id = parent
    for update of r;
  if not found then
    raise insufficient_privilege using message = 'Treasure request is unavailable';
  end if;
  if request.status = p_decision then return p_decision; end if;
  if request.status <> 'pending' then return 'already_decided'; end if;

  if p_decision = 'approved' then
    select name, is_active into item_name, item_active
      from public.treasures where id = request.treasure_id for share;
    if item_active is not true then return 'unavailable'; end if;
    update public.fairy_wallets
      set balance = balance - request.price_at_request, updated_at = clock_timestamp()
      where child_id = p_child_id and balance >= request.price_at_request;
    if not found then return 'insufficient_balance'; end if;
    insert into public.fairy_transactions (child_id, amount, description)
      values (p_child_id, -request.price_at_request, 'Treasure approved: ' || item_name);
  end if;
  update public.treasure_requests set status = p_decision where id = request.id;
  return p_decision;
end;
$function$;

-- fairybucks_delete_account
CREATE OR REPLACE FUNCTION public.fairybucks_delete_account(p_confirmation text DEFAULT NULL::text, p_unlock_token text DEFAULT NULL::text, p_expected_parent uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 parent uuid := auth.uid();
 claims jsonb := auth.jwt();
 auth_session uuid := nullif(claims->>'session_id','')::uuid;
 verified_at bigint;
 needs_pin boolean;
 children jsonb;
begin
 if parent is null or (p_expected_parent is not null and p_expected_parent<>parent)
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent)
 or not exists(select 1 from auth.users where id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 select max((entry->>'timestamp')::bigint) into verified_at
 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) entry
 where entry->>'method' in ('password','otp','magiclink') and entry->>'timestamp' ~ '^[0-9]{1,12}$';
 select exists(select 1 from private.parent_pin_security where parent_id=parent) into needs_pin;
 select coalesce(jsonb_agg(c.id),'[]'::jsonb) into children from public.child_profiles c
 join public.families f on f.id=c.family_id where f.owner_id=parent;
 if verified_at is null or verified_at < extract(epoch from clock_timestamp())-600
 or verified_at > extract(epoch from clock_timestamp())+30 then
  return jsonb_build_object('status','reauth_required','requires_pin',needs_pin,'child_ids',children);
 end if;
 if p_confirmation is null then
  return jsonb_build_object('status','ready','requires_pin',needs_pin,'child_ids',children);
 end if;
 if p_confirmation<>'DELETE' then return jsonb_build_object('status','confirmation_required'); end if;
 -- Lock account and family rows before removing dependent data, also covering concurrent profile additions.
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Account is unavailable'; end if;
 perform 1 from public.families where owner_id=parent for update;
 perform 1 from private.parent_pin_security where parent_id=parent for update;
 -- Recheck after locking in case PIN setup/reset raced the review screen.
 if found then
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('status','unlock_required');
  end if;
  perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
   and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('status','unlock_required'); end if;
 end if;
 -- A session revoked while waiting on a lock cannot authorize deletion.
 if not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='Sign in again before deleting your account';
 end if;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
  where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.treasure_requests r using public.child_profiles c,public.families f
  where r.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.fairy_transactions t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.lost_teeth t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.fairy_wallets w using public.child_profiles c,public.families f
  where w.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.child_profiles c using public.families f where c.family_id=f.id and f.owner_id=parent;
 delete from public.families where owner_id=parent;
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
 delete from private.parent_pin_security where parent_id=parent;
 delete from private.fairybucks_tooth_rewards where parent_id=parent;
 delete from private.fairybucks_parent_guides where parent_id=parent;
 delete from private.fairybucks_pin_recoveries where parent_id=parent;
 delete from auth.sessions where user_id=parent;
 -- Auth identities and refresh tokens use Supabase's own cascades. Storage ownership or an
 -- unexpected external dependency makes the entire transaction fail; never use CASCADE here.
 delete from auth.users where id=parent;
 if not found then raise exception 'Account deletion could not be confirmed'; end if;
 return jsonb_build_object('status','deleted');
end;
$function$;

-- fairybucks_delete_explorer
CREATE OR REPLACE FUNCTION public.fairybucks_delete_explorer(p_child_id uuid, p_expected_parent uuid, p_expected_nickname text DEFAULT NULL::text, p_confirmation text DEFAULT NULL::text, p_pin text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare parent uuid:=auth.uid();auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 profile public.child_profiles%rowtype;pin_result jsonb;
begin
 if parent is null or p_expected_parent is distinct from parent
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 -- Match account deletion's lock order; protect the selected family/profile from concurrent writes.
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Parent account is unavailable';end if;
 perform 1 from public.families where owner_id=parent for update;
 select c.* into profile from public.child_profiles c join public.families f on f.id=c.family_id
 where c.id=p_child_id and f.owner_id=parent for update of c;
 if not found then return jsonb_build_object('status','unavailable');end if;
 perform 1 from auth.sessions where id=auth_session and user_id=parent for share;
 if not found then raise insufficient_privilege using message='Sign in again before deleting an explorer';end if;
 if p_confirmation is null then
  return jsonb_build_object('status',case when exists(select 1 from private.parent_pin_security where parent_id=parent)
   then 'ready' else 'setup_required' end,'profile',jsonb_build_object('id',profile.id,'nickname',profile.nickname));end if;
 if p_confirmation<>'DELETE' then return jsonb_build_object('status','confirmation_required');end if;
 if p_expected_nickname is distinct from profile.nickname then
  return jsonb_build_object('status','changed','profile',jsonb_build_object('id',profile.id,'nickname',profile.nickname));end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('status','invalid_pin');end if;
 pin_result:=public.fairybucks_parent_pin(p_pin,false);
 -- Return normally on failure so PIN throttling is committed, not rolled back by an exception.
 if pin_result->>'status' is distinct from 'unlocked' then
  return jsonb_build_object('status',pin_result->>'status');end if;
 delete from private.fairybucks_child_sessions where child_id=profile.id;
 delete from public.treasure_requests where child_id=profile.id;
 delete from public.fairy_transactions where child_id=profile.id;
 delete from public.lost_teeth where child_id=profile.id;
 delete from public.fairy_wallets where child_id=profile.id;
 -- The existing hosted schema includes wishlists; older test/development schemas may not.
 if to_regclass('public.wishlists') is not null then
  execute 'delete from public.wishlists where child_id=$1' using profile.id;
 end if;
 delete from public.child_profiles where id=profile.id;
 if not found then raise exception 'Explorer deletion could not be confirmed';end if;
 -- Clear parent unlocks: any stale protected screen must ask for the PIN again.
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
 return jsonb_build_object('status','deleted','child_id',profile.id);
end $function$;

-- fairybucks_edit_explorer
CREATE OR REPLACE FUNCTION public.fairybucks_edit_explorer(p_child_id uuid, p_nickname text, p_age integer, p_gender text, p_expected_parent uuid, p_original jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare parent uuid:=auth.uid();auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;profile public.child_profiles%rowtype;details jsonb;
begin
 if parent is null or p_expected_parent is distinct from parent
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Parent account is unavailable';end if;
 if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 35
 or (p_age is not null and p_age not between 2 and 18)
 or p_gender is null or p_gender not in ('boy','girl','rather-not-say') then
  raise invalid_parameter_value using message='Check the nickname and optional explorer details';end if;
 select c.* into profile from public.child_profiles c join public.families f on f.id=c.family_id
 where c.id=p_child_id and f.owner_id=parent for update of c;
 if not found then return jsonb_build_object('status','unavailable');end if;
 details:=jsonb_build_object('nickname',profile.nickname,'age',profile.age,'gender',coalesce(profile.gender,'rather-not-say'));
 if p_original is distinct from details then
  return jsonb_build_object('status','changed','profile',details||jsonb_build_object('id',profile.id));end if;
 -- Metadata only: stable explorer/family IDs keep all balances, teeth and requests attached.
 update public.child_profiles set nickname=btrim(p_nickname),age=p_age,gender=p_gender where id=profile.id;
 return jsonb_build_object('status','saved','profile',jsonb_build_object('id',profile.id,'nickname',btrim(p_nickname),'age',p_age,'gender',p_gender));
end $function$;

-- fairybucks_parent_purchase
CREATE OR REPLACE FUNCTION public.fairybucks_parent_purchase(p_child_id uuid, p_request_id uuid, p_unlock_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  result jsonb;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'unlock_required');
  end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp() for share;
  if not found then return jsonb_build_object('status', 'unlock_required'); end if;

  select jsonb_build_object('status', 'available', 'version', o.product_version,
    'price_cents', o.observed_price_cents, 'checked_on', o.price_checked_on,
    'url', o.purchase_url)
  into result
  from public.treasure_requests r
  join public.child_profiles c on c.id = r.child_id
  join public.families f on f.id = c.family_id
  join private.fairybucks_purchase_options o on o.treasure_id = r.treasure_id
  where r.id = p_request_id and r.child_id = p_child_id and f.owner_id = parent
    and r.status in ('pending', 'approved', 'fulfilled');
  return coalesce(result, jsonb_build_object('status', 'unavailable'));
end $function$;

-- fairybucks_parent_setup
CREATE OR REPLACE FUNCTION public.fairybucks_parent_setup(p_action text DEFAULT 'status'::text, p_expected_parent uuid DEFAULT NULL::uuid, p_child_id uuid DEFAULT NULL::uuid, p_nickname text DEFAULT NULL::text, p_age integer DEFAULT NULL::integer, p_gender text DEFAULT 'rather-not-say'::text, p_reward integer DEFAULT NULL::integer, p_unlock_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare parent uuid:=auth.uid();sid uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 fam uuid;profile uuid;cnt integer;reward integer;completed boolean;
begin
 if parent is null or p_expected_parent is distinct from parent or not exists(
  select 1 from auth.sessions where id=sid and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 perform 1 from auth.users where id=parent and email_confirmed_at is not null for update;
 if not found then raise insufficient_privilege using message='Verify the parent email first';end if;
 if p_action not in ('status','save','finish') then raise invalid_parameter_value;end if;
 select id into fam from public.families where owner_id=parent order by id limit 1;
 select count(*),min(id::text)::uuid into cnt,profile from public.child_profiles where family_id=fam;
 if p_action='save' then
  if not private.fairybucks_child_permission(parent) then return jsonb_build_object('status','permission_required');end if;
  -- First explorer creation + family reward is one transaction. A retry cannot create a sibling.
  if p_child_id is null or length(trim(coalesce(p_nickname,''))) not between 1 and 35
   or p_reward is null or p_reward not between 1 and 100
   or (p_age is not null and p_age not between 2 and 18)
   or p_gender is null or p_gender not in ('boy','girl','rather-not-say') then
   return jsonb_build_object('status','invalid_details');end if;
  if fam is null then return jsonb_build_object('status','pin_required');end if;
  if p_unlock_token is null or not exists(select 1 from private.fairybucks_parent_unlocks
   where parent_id=parent and session_id=sid and token_hash=extensions.digest(p_unlock_token,'sha256')
    and expires_at>clock_timestamp()) then return jsonb_build_object('status','unlock_required');end if;
  if cnt=0 then
   insert into public.child_profiles(id,family_id,nickname,age,gender)
    values(p_child_id,fam,trim(p_nickname),p_age,p_gender);
   insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent,p_reward)
    on conflict(parent_id) do update set amount=excluded.amount;
   profile:=p_child_id;cnt:=1;
  elsif not exists(select 1 from public.child_profiles where id=p_child_id and family_id=fam) then
   return jsonb_build_object('status','already_started');
  end if;
 elsif p_action='finish' then
  if cnt=0 or not exists(select 1 from private.parent_pin_security where parent_id=parent)
   or not private.fairybucks_child_permission(parent) then return jsonb_build_object('status','setup_required');end if;
  perform public.fairybucks_parent_guide(true);
 end if;
 select amount into reward from private.fairybucks_tooth_rewards where parent_id=parent;
 select exists(select 1 from private.fairybucks_parent_guides where parent_id=parent) into completed;
 return jsonb_build_object('status','ready','parent_id',parent,'has_pin',exists(select 1 from private.parent_pin_security where parent_id=parent),
  'explorers',cnt,'first_explorer',profile,'reward',coalesce(reward,5),'completed',completed);
end $function$;

-- fairybucks_record_tooth
CREATE OR REPLACE FUNCTION public.fairybucks_record_tooth(p_child_id uuid, p_request_id uuid, p_lost_on date, p_unlock_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  reward integer;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
    return 'unlock_required';
  end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp()
    for share;
  if not found then
    return 'unlock_required';
  end if;
  if not exists (
    select 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = parent
  ) then
    raise insufficient_privilege using message = 'Explorer is unavailable';
  end if;
  if p_request_id is null or p_lost_on is null
    or p_lost_on not between date '1900-01-01' and current_date + 1 then
    raise invalid_parameter_value using message = 'A request ID and valid tooth date are required';
  end if;

  -- Serialize the amount with a concurrent settings save. Ledger rows retain the award.
  insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent,5)
    on conflict(parent_id) do nothing;
  select amount into reward from private.fairybucks_tooth_rewards where parent_id=parent for share;

  insert into public.lost_teeth (id, child_id, lost_on)
    values (p_request_id, p_child_id, p_lost_on)
    on conflict (id) do nothing;
  if not found then
    if exists (
      select 1 from public.lost_teeth t join public.fairy_transactions tx on tx.id = t.id
      where t.id = p_request_id and t.child_id = p_child_id and tx.child_id = p_child_id
        and tx.amount > 0 and tx.description = 'Lost tooth reward'
    ) then
      return case when exists (select 1 from public.lost_teeth
        where id = p_request_id and corrected_at is not null) then 'corrected' else 'saved' end;
    end if;
    raise unique_violation using message = 'Request ID is already in use';
  end if;

  insert into public.fairy_wallets as w (child_id, balance)
    values (p_child_id, reward)
    on conflict (child_id) do update set balance = w.balance + excluded.balance,
      updated_at = clock_timestamp();
  insert into public.fairy_transactions (id, child_id, amount, description)
    values (p_request_id, p_child_id, reward, 'Lost tooth reward');
  return 'saved';
end;
$function$;

-- fairybucks_tooth_reward
CREATE OR REPLACE FUNCTION public.fairybucks_tooth_reward(p_child_id uuid, p_unlock_token text, p_amount integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 parent uuid := auth.uid();
 auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
 reward integer;
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','unlock_required'); end if;
 perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
 and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for share;
 if not found then return jsonb_build_object('status','unlock_required'); end if;
 if not exists(select 1 from public.child_profiles c join public.families f on f.id=c.family_id where c.id=p_child_id and f.owner_id=parent) then
  raise insufficient_privilege using message='Explorer is unavailable';
 end if;
 if p_amount is not null then
  if p_amount not between 1 and 100 then return jsonb_build_object('status','invalid_amount'); end if;
  insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent,p_amount)
   on conflict(parent_id) do update set amount=excluded.amount;
 end if;
 select amount into reward from private.fairybucks_tooth_rewards where parent_id=parent;
 return jsonb_build_object('status','saved','amount',coalesce(reward,5));
end $function$;

-- fairybucks_undo_tooth
CREATE OR REPLACE FUNCTION public.fairybucks_undo_tooth(p_child_id uuid, p_tooth_id uuid, p_unlock_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  correction_time timestamptz;
  reward integer;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
    return 'unlock_required';
  end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp()
    for share;
  if not found then
    return 'unlock_required';
  end if;
  if not exists (
    select 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = parent
  ) then
    raise insufficient_privilege using message = 'Explorer is unavailable';
  end if;

  select t.corrected_at, tx.amount into correction_time, reward
    from public.lost_teeth t join public.fairy_transactions tx
      on tx.id = t.id and tx.child_id = t.child_id
      and tx.description = 'Lost tooth reward' and tx.amount > 0
    where t.id = p_tooth_id and t.child_id = p_child_id
    for update of t;
  if not found then
    return 'tooth_unavailable';
  end if;
  if correction_time is not null then
    return 'undone';
  end if;

  update public.fairy_wallets
    set balance = balance - reward, updated_at = clock_timestamp()
    where child_id = p_child_id and balance >= reward;
  if not found then
    return 'insufficient_balance';
  end if;

  update public.lost_teeth set corrected_at = clock_timestamp() where id = p_tooth_id;
  insert into public.fairy_transactions (child_id, amount, description)
    values (p_child_id, -reward, 'Lost tooth correction');
  return 'undone';
end;
$function$;

-- fairybucks_update_delivery
CREATE OR REPLACE FUNCTION public.fairybucks_update_delivery(p_child_id uuid, p_request_id uuid, p_stage text, p_expected_stage text, p_unlock_token text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 parent uuid := auth.uid();
 auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
 request public.treasure_requests%rowtype;
 current_stage text;
 stages text[] := array['workshop','packaging','flying','arriving','landed'];
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then return 'unlock_required'; end if;
 perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
  and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for share;
 if not found then return 'unlock_required'; end if;
 select r.* into request from public.treasure_requests r
 join public.child_profiles c on c.id=r.child_id join public.families f on f.id=c.family_id
 where r.id=p_request_id and r.child_id=p_child_id and f.owner_id=parent for update of r;
 if not found then raise insufficient_privilege using message='Treasure request is unavailable'; end if;
 current_stage := coalesce(request.delivery_stage,'workshop');
 if request.status='cancelled' and current_stage='refunded' and p_stage='refunded' then return 'refunded'; end if;
 if request.status='fulfilled' then return 'already_completed'; end if;
 if request.status <> 'approved' then return 'not_approved'; end if;
 if current_stage = p_stage then return 'saved'; end if;
 if p_expected_stage is distinct from current_stage then return 'stage_changed'; end if;
 if p_stage='refunded' then
  -- The row lock makes this credit and cancellation atomic and safe to retry.
  insert into public.fairy_wallets as w(child_id,balance) values(p_child_id,request.price_at_request)
   on conflict(child_id) do update set balance=w.balance+excluded.balance,updated_at=clock_timestamp();
  insert into public.fairy_transactions(child_id,amount,description)
   values(p_child_id,request.price_at_request,'Treasure cancelled: Fairy Bucks returned');
  update public.treasure_requests set status='cancelled',delivery_stage='refunded' where id=request.id;
  return 'refunded';
 end if;
 if p_stage is null or array_position(stages,p_stage) is distinct from array_position(stages,current_stage)+1 then
  return 'invalid_stage';
 end if;
 update public.treasure_requests set delivery_stage=p_stage,
  status=case when p_stage='landed' then 'fulfilled' else 'approved' end where id=request.id;
 return 'saved';
end $function$;

