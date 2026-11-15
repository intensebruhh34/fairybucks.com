begin;

create table private.fairybucks_privacy_release (
 singleton boolean primary key default true check(singleton),
 notice_version integer not null check(notice_version>0),
 notice_hash text not null check(notice_hash ~ '^[0-9a-f]{64}$'),
 notice_ready boolean not null default false
);
insert into private.fairybucks_privacy_release(singleton,notice_version,notice_hash,notice_ready)
 values(true,1,'242c2e941aa87237abacf56ee550d192f48def4d9c5988762ea744b1148a9db2',false);
create table private.fairybucks_parent_consents (
 parent_id uuid not null references auth.users(id) on delete cascade,
 notice_version integer not null,
 notice_hash text not null,
 status text not null check(status in ('requested','verified','withdrawn')),
 requested_at timestamptz not null,
 verified_at timestamptz,
 withdrawn_at timestamptz,
 method text,
 evidence_ref text,
 reviewer text,
 primary key(parent_id,notice_version)
);
create table private.fairybucks_consent_events (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null references auth.users(id) on delete cascade,
 notice_version integer not null,
 notice_hash text not null,
 event text not null check(event in ('requested','verified','withdrawn')),
 occurred_at timestamptz not null default clock_timestamp(),
 evidence_ref text,
 reviewer text
);
alter table private.fairybucks_privacy_release enable row level security;
alter table private.fairybucks_parent_consents enable row level security;
alter table private.fairybucks_consent_events enable row level security;
revoke all on private.fairybucks_privacy_release,private.fairybucks_parent_consents,private.fairybucks_consent_events from public,anon,authenticated;

create function private.fairybucks_child_permission(p_parent uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare release private.fairybucks_privacy_release%rowtype;
begin
 select * into release from private.fairybucks_privacy_release where singleton for share;
 if not found or not release.notice_ready then return false;end if;
 perform 1 from private.fairybucks_parent_consents where parent_id=p_parent
  and notice_version=release.notice_version and notice_hash=release.notice_hash and status='verified' for share;
 return found;
end $$;
revoke all on function private.fairybucks_child_permission(uuid) from public,anon,authenticated;

create function public.fairybucks_parent_consent(
 p_action text default 'status',p_version integer default null,p_notice_hash text default null,p_guardian boolean default false
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 parent uuid:=auth.uid();
 auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 release private.fairybucks_privacy_release%rowtype;
 consent private.fairybucks_parent_consents%rowtype;
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='An active parent sign-in is required';end if;
 if p_action not in ('status','request','withdraw') or p_action is null then
  raise invalid_parameter_value using message='Unknown permission action';end if;
 -- Serialize same-account requests/withdrawals with operator review and account deletion.
 perform 1 from auth.users where id=parent for update;
 select * into release from private.fairybucks_privacy_release where singleton for share;
 if p_action='withdraw' then
  with changed as (
   update private.fairybucks_parent_consents set status='withdrawn',withdrawn_at=clock_timestamp()
    where parent_id=parent and status<>'withdrawn' returning notice_version,notice_hash
  ) insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event)
   select parent,notice_version,notice_hash,'withdrawn' from changed;
  delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
   where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 elsif p_action='request' then
  if not release.notice_ready then return jsonb_build_object('status','setup_pending','version',release.notice_version,'notice_hash',release.notice_hash);end if;
  if p_version is distinct from release.notice_version or p_notice_hash is distinct from release.notice_hash then
   return jsonb_build_object('status','notice_changed','version',release.notice_version,'notice_hash',release.notice_hash);end if;
  if p_guardian is not true then return jsonb_build_object('status','guardian_required');end if;
  if not exists(select 1 from auth.users where id=parent and email_confirmed_at is not null) then
   return jsonb_build_object('status','email_required');end if;
  select * into consent from private.fairybucks_parent_consents where parent_id=parent and notice_version=release.notice_version for update;
  if not found or consent.status='withdrawn' or consent.notice_hash<>release.notice_hash then
   insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at)
    values(parent,release.notice_version,release.notice_hash,'requested',clock_timestamp())
    on conflict(parent_id,notice_version) do update set notice_hash=excluded.notice_hash,status='requested',requested_at=excluded.requested_at,
     verified_at=null,withdrawn_at=null,method=null,evidence_ref=null,reviewer=null;
   insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event)
    values(parent,release.notice_version,release.notice_hash,'requested');
  end if;
 end if;
 select * into consent from private.fairybucks_parent_consents where parent_id=parent and notice_version=release.notice_version;
 return jsonb_build_object('status',case when not release.notice_ready then 'setup_pending'
  when consent.notice_hash is distinct from release.notice_hash then 'needed' else coalesce(consent.status,'needed') end,
  'version',release.notice_version,'notice_hash',release.notice_hash,'requested_at',consent.requested_at,
  'verified_at',consent.verified_at,'parent_id',parent);
end $$;
revoke all on function public.fairybucks_parent_consent(text,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.fairybucks_parent_consent(text,integer,text,boolean) to authenticated;

-- Operator-only: never exposed to browser/API roles. Call only AFTER reviewing a returned signed form.
create function private.fairybucks_verify_signed_consent(p_parent uuid,p_version integer,p_hash text,p_evidence_ref text,p_reviewer text)
returns void language plpgsql security definer set search_path='' as $$
declare release private.fairybucks_privacy_release%rowtype;
begin
 if length(btrim(coalesce(p_evidence_ref,''))) not between 3 and 120 or length(btrim(coalesce(p_reviewer,''))) not between 2 and 120 then
  raise invalid_parameter_value using message='An internal evidence reference and reviewer are required';end if;
 perform 1 from auth.users where id=p_parent and email_confirmed_at is not null for update;
 if not found then raise invalid_parameter_value using message='Parent email must be confirmed';end if;
 select * into release from private.fairybucks_privacy_release where singleton for share;
 if not release.notice_ready or p_version is distinct from release.notice_version or p_hash is distinct from release.notice_hash then
  raise invalid_parameter_value using message='The current notice must be ready and match the returned form';end if;
 perform 1 from private.fairybucks_parent_consents where parent_id=p_parent and notice_version=p_version
  and notice_hash=p_hash and status='requested' for update;
 if not found then raise invalid_parameter_value using message='A current pending request is required';end if;
 update private.fairybucks_parent_consents set status='verified',verified_at=clock_timestamp(),method='signed_form',
  evidence_ref=btrim(p_evidence_ref),reviewer=btrim(p_reviewer) where parent_id=p_parent and notice_version=p_version;
 insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event,evidence_ref,reviewer)
  values(p_parent,p_version,p_hash,'verified',btrim(p_evidence_ref),btrim(p_reviewer));
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
  where s.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
end $$;
revoke all on function private.fairybucks_verify_signed_consent(uuid,integer,text,text,text) from public,anon,authenticated;

create function private.fairybucks_require_profile_permission()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent uuid;
begin
 -- Privileged operator maintenance/rollback fixtures remain possible; API roles cannot bypass this.
 if current_setting('role',true) in ('authenticated','anon') then
  select owner_id into parent from public.families where id=new.family_id;
  if parent is distinct from auth.uid() or not private.fairybucks_child_permission(parent) then
   raise insufficient_privilege using message='Verified parent permission is required before adding an explorer';end if;
 end if;
 return new;
end $$;
revoke all on function private.fairybucks_require_profile_permission() from public,anon,authenticated;
create trigger fairybucks_profile_permission before insert on public.child_profiles
 for each row execute function private.fairybucks_require_profile_permission();

alter function public.fairybucks_start_child_session(uuid,text) set schema private;
alter function private.fairybucks_start_child_session(uuid,text) rename to fairybucks_start_child_session_core;
revoke all on function private.fairybucks_start_child_session_core(uuid,text) from public,anon,authenticated;
create function public.fairybucks_start_child_session(p_child_id uuid,p_unlock_token text)
returns text language plpgsql security definer set search_path='' as $$
begin
 if not private.fairybucks_child_permission(auth.uid()) then
  raise insufficient_privilege using message='Verified parent permission is required before child mode';end if;
 return private.fairybucks_start_child_session_core(p_child_id,p_unlock_token);
end $$;
revoke all on function public.fairybucks_start_child_session(uuid,text) from public,anon,authenticated;
grant execute on function public.fairybucks_start_child_session(uuid,text) to authenticated;

alter function public.fairybucks_child_action(text,text,uuid,integer,integer) set schema private;
alter function private.fairybucks_child_action(text,text,uuid,integer,integer) rename to fairybucks_child_action_core;
revoke all on function private.fairybucks_child_action_core(text,text,uuid,integer,integer) from public,anon,authenticated;
create function public.fairybucks_child_action(p_token text,p_action text default 'view',p_request_id uuid default null,p_shop_key integer default null,p_expected_price integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare parent uuid;
begin
 if p_action<>'end' and p_token ~ '^[0-9a-f]{64}$' then
  select f.owner_id into parent from private.fairybucks_child_sessions s
   join public.child_profiles c on c.id=s.child_id join public.families f on f.id=c.family_id
   where s.token_hash=extensions.digest(p_token,'sha256') and s.expires_at>clock_timestamp();
  if found and not private.fairybucks_child_permission(parent) then
   return jsonb_build_object('status','permission_required');end if;
 end if;
 return private.fairybucks_child_action_core(p_token,p_action,p_request_id,p_shop_key,p_expected_price);
end $$;
revoke all on function public.fairybucks_child_action(text,text,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.fairybucks_child_action(text,text,uuid,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
commit;
