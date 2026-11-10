begin;

create extension if not exists pgcrypto with schema extensions;

-- Resolve these now so a schema mismatch stops the deployment before any RPCs change.
do $$
begin
  perform pin_hash, failed_attempts, locked_until, updated_at
    from private.parent_pin_security limit 0;
  perform child_id, balance, updated_at from public.fairy_wallets limit 0;
  perform id, child_id, amount, description, created_at from public.fairy_transactions limit 0;
  perform id, child_id, lost_on, created_at from public.lost_teeth limit 0;
  if to_regprocedure('extensions.crypt(text,text)') is null then
    raise exception 'Expected pgcrypto in the extensions schema';
  end if;
end;
$$;

create table private.fairybucks_parent_unlocks (
  parent_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null references auth.sessions(id) on delete cascade,
  token_hash bytea not null,
  expires_at timestamptz not null
);
alter table private.fairybucks_parent_unlocks enable row level security;
revoke all on private.fairybucks_parent_unlocks from public, anon, authenticated;

create function public.fairybucks_parent_pin(p_pin text default null, p_setup boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  pin_state private.parent_pin_security%rowtype;
  attempt_count integer;
  unlock_token text;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) or not exists (
    select 1 from public.families where owner_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent with a Family Vault is required';
  end if;

  if p_pin is null then
    select * into pin_state from private.parent_pin_security where parent_id = parent;
    return jsonb_build_object('status', case
      when not found then 'setup_required'
      when pin_state.locked_until > clock_timestamp() then 'locked'
      else 'pin_required'
    end);
  end if;

  if p_pin !~ '^[0-9]{6}$' then
    return jsonb_build_object('status', 'invalid_pin');
  end if;

  if p_setup then
    insert into private.parent_pin_security (parent_id, pin_hash)
      values (parent, extensions.crypt(p_pin, extensions.gen_salt('bf', 12)))
      on conflict (parent_id) do nothing;
    if not found then
      return jsonb_build_object('status', 'pin_required');
    end if;
  else
    select * into pin_state from private.parent_pin_security
      where parent_id = parent for update;
    if not found then
      return jsonb_build_object('status', 'setup_required');
    end if;
    if pin_state.locked_until > clock_timestamp() then
      return jsonb_build_object('status', 'locked');
    end if;
    if extensions.crypt(p_pin, pin_state.pin_hash) is distinct from pin_state.pin_hash then
      attempt_count := case when pin_state.locked_until is null
        then pin_state.failed_attempts + 1 else 1 end;
      update private.parent_pin_security set
        failed_attempts = attempt_count,
        locked_until = case when attempt_count >= 5 then clock_timestamp() + interval '15 minutes' end,
        updated_at = clock_timestamp()
        where parent_id = parent;
      if attempt_count >= 5 then
        delete from private.fairybucks_parent_unlocks where parent_id = parent;
      end if;
      -- A normal response commits the failed-attempt counter.
      return jsonb_build_object('status', case when attempt_count >= 5 then 'locked' else 'incorrect_pin' end);
    end if;
    update private.parent_pin_security set failed_attempts = 0, locked_until = null,
      updated_at = clock_timestamp() where parent_id = parent;
  end if;

  unlock_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into private.fairybucks_parent_unlocks (parent_id, session_id, token_hash, expires_at)
    values (parent, auth_session, extensions.digest(unlock_token, 'sha256'), clock_timestamp() + interval '5 minutes')
    on conflict (parent_id) do update set session_id = excluded.session_id,
      token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  return jsonb_build_object('status', 'unlocked', 'token', unlock_token);
end;
$$;

create function public.fairybucks_record_tooth(
  p_child_id uuid, p_request_id uuid, p_lost_on date, p_unlock_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  reward constant integer := 5;
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

  insert into public.lost_teeth (id, child_id, lost_on)
    values (p_request_id, p_child_id, p_lost_on)
    on conflict (id) do nothing;
  if not found then
    if exists (
      select 1 from public.lost_teeth t join public.fairy_transactions tx on tx.id = t.id
      where t.id = p_request_id and t.child_id = p_child_id and tx.child_id = p_child_id
        and tx.amount = reward and tx.description = 'Lost tooth reward'
    ) then
      return 'saved';
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
$$;

create function public.fairybucks_explorer_summary(p_child_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'balance', coalesce((select w.balance from public.fairy_wallets w where w.child_id = c.id), 0),
    'tooth_count', (select count(*) from public.lost_teeth t where t.child_id = c.id),
    'teeth', coalesce((
      select jsonb_agg(t.lost_on order by t.lost_on desc)
      from (select lost_on from public.lost_teeth where child_id = c.id
        order by lost_on desc, created_at desc, id desc limit 20) t
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(to_jsonb(tx) order by tx.created_at desc, tx.id desc)
      from (select id, amount, description, created_at from public.fairy_transactions where child_id = c.id
        order by created_at desc, id desc limit 20) tx
    ), '[]'::jsonb)
  )
  from public.child_profiles c
  join public.families f on f.id = c.family_id
  where c.id = p_child_id and f.owner_id = auth.uid();
$$;

revoke all on function public.fairybucks_explorer_summary(uuid) from public, anon, authenticated;
revoke all on function public.fairybucks_parent_pin(text, boolean) from public, anon, authenticated;
revoke all on function public.fairybucks_record_tooth(uuid, uuid, date, text) from public, anon, authenticated;
grant execute on function public.fairybucks_parent_pin(text, boolean) to authenticated;
grant execute on function public.fairybucks_explorer_summary(uuid) to authenticated;
grant execute on function public.fairybucks_record_tooth(uuid, uuid, date, text) to authenticated;
notify pgrst, 'reload schema';

commit;
