-- Staged onboarding candidate. Public activation still requires the method/provider review.
begin;
do $$begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'Coordinate the notice upgrade before applying to an enforced release';end if;
end $$;
update private.fairybucks_privacy_release set notice_version=3,notice_hash='62c89e144ad460600666ec007f4979145d8bfd5b795e3e87b5fe938efa55b1b4',
 notice_ready=false,email_method_reviewed=false;
create or replace function private.fairybucks_child_permission(p_parent uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare release private.fairybucks_privacy_release%rowtype;c private.fairybucks_parent_consents%rowtype;
begin
 select * into release from private.fairybucks_effective_permission_release(p_parent);
 if found and not release.enforcement_enabled then return true;end if;
 if release.singleton is null or not release.notice_ready then return false;end if;
 select * into c from private.fairybucks_parent_consents where parent_id=p_parent
  and notice_version=release.notice_version and notice_hash=release.notice_hash and status='verified' for share;
 if not found then return false;end if;
 if c.reviewer='permission-email-rehearsal' and not exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent and expires_at>clock_timestamp()) then return false;end if;
 if c.method is distinct from 'email_plus' and exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent) then return false;end if;
 if c.method='email_plus' then
  return release.email_method_reviewed and exists(
   select 1 from private.fairybucks_email_permission_requests r join auth.users u on u.id=r.parent_id
   where r.parent_id=p_parent and r.state in ('approved','verified') and r.parent_email=u.email and u.email_confirmed_at is not null
    and r.notice_version=release.notice_version and r.notice_hash=release.notice_hash and r.notice_sent_at is not null and r.approved_at is not null
    and (r.confirmation_sent_at is not null or (r.expires_at>clock_timestamp() and exists(select 1 from private.fairybucks_permission_mail m where m.request_id=r.id and m.kind='confirmation'))));
 end if;
 return true;
end $$;
revoke all on function private.fairybucks_child_permission(uuid) from public,anon,authenticated,service_role;

create function public.fairybucks_parent_setup(
 p_action text default 'status',p_expected_parent uuid default null,p_child_id uuid default null,
 p_nickname text default null,p_age integer default null,p_gender text default 'rather-not-say',
 p_reward integer default null,p_unlock_token text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.fairybucks_parent_setup(text,uuid,uuid,text,integer,text,integer,text) from public,anon,authenticated,service_role;
grant execute on function public.fairybucks_parent_setup(text,uuid,uuid,text,integer,text,integer,text) to authenticated;
notify pgrst,'reload schema';
commit;
