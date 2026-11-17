-- Email-plus implementation only. Applying this migration does NOT activate permission gates or sending.
begin;
do $$begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'Coordinate the notice upgrade before applying to an enforced release';
 end if;
end $$;
alter table private.fairybucks_privacy_release
 add column email_method_reviewed boolean not null default false;
update private.fairybucks_privacy_release set notice_version=2,
 notice_hash='8fa04272d6a167c5e4e3bc46b8a2f6aac033e85204a3d9f63b186776c9580de2',notice_ready=false,email_method_reviewed=false;

create table private.fairybucks_email_permission_requests (
 id uuid primary key default gen_random_uuid(),
 parent_id uuid not null unique references auth.users(id) on delete cascade,
 parent_email text not null,
 notice_version integer not null,
 notice_hash text not null,
 token_hash text check(token_hash ~ '^[0-9a-f]{64}$'),
 state text not null default 'requested' check(state in ('requested','approved','verified','withdrawn')),
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '7 days',
 notice_sent_at timestamptz,
 approved_at timestamptz,
 confirmation_sent_at timestamptz
);
create table private.fairybucks_permission_mail (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references private.fairybucks_email_permission_requests(id) on delete cascade,
 kind text not null check(kind in ('notice','confirmation')),
 created_at timestamptz not null default clock_timestamp(),
 lease uuid,
 lease_until timestamptz,
 message_id text,
 accepted_at timestamptz
);
create unique index fairybucks_one_permission_confirmation on private.fairybucks_permission_mail(request_id)
 where kind='confirmation';
create index fairybucks_permission_mail_request on private.fairybucks_permission_mail(request_id,kind,created_at);
alter table private.fairybucks_email_permission_requests enable row level security;
alter table private.fairybucks_permission_mail enable row level security;
revoke all on private.fairybucks_email_permission_requests,private.fairybucks_permission_mail from public,anon,authenticated,service_role;

create table private.fairybucks_permission_mail_limits (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null default clock_timestamp(),
 attempts integer not null default 0,
 last_attempt timestamptz
);
alter table private.fairybucks_permission_mail_limits enable row level security;
revoke all on private.fairybucks_permission_mail_limits from public,anon,authenticated,service_role;

-- Also cover withdrawal through the older public RPC: no in-flight email can regrant it.
create function private.fairybucks_withdraw_email_permission()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='withdrawn' then
  update private.fairybucks_email_permission_requests set state='withdrawn',token_hash=null
   where parent_id=new.parent_id and notice_version=new.notice_version;
 end if;
 return new;
end $$;
revoke all on function private.fairybucks_withdraw_email_permission() from public,anon,authenticated,service_role;
create trigger fairybucks_withdraw_email_permission after update of status
 on private.fairybucks_parent_consents for each row execute function private.fairybucks_withdraw_email_permission();

-- Only the authenticated Edge Function may call this RPC with a verified parent/session.
-- The browser never receives service_role credentials, stored hashes, leases or mail jobs.
create function public.fairybucks_email_permission(
 p_action text,p_parent uuid,p_session uuid,p_version integer,p_notice_hash text,
 p_request uuid default null,p_token_hash text default null,p_guardian boolean default false,
 p_job uuid default null,p_lease uuid default null,p_message_id text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 release private.fairybucks_privacy_release%rowtype;
 r private.fairybucks_email_permission_requests%rowtype;
 j private.fairybucks_permission_mail%rowtype;
 email text;result_status text;v_kind text;
 lim private.fairybucks_permission_mail_limits%rowtype;
begin
 if p_action is null or p_action not in ('status','start','inspect','approve','withdraw','claim_notice','claim_confirmation','accepted') then
  raise invalid_parameter_value using message='Unknown permission action';end if;
 -- The same lock order as legacy consent/account deletion serializes all transitions.
 select u.email into email from auth.users u where u.id=p_parent and u.email_confirmed_at is not null for update;
 if not found or not exists(select 1 from auth.sessions where id=p_session and user_id=p_parent) then
  raise insufficient_privilege using message='An active confirmed parent sign-in is required';end if;
 select * into release from private.fairybucks_privacy_release where singleton for share;
 if p_action='withdraw' then
  with changed as (
   update private.fairybucks_parent_consents set status='withdrawn',withdrawn_at=clock_timestamp()
    where parent_id=p_parent and status<>'withdrawn' returning notice_version,notice_hash
  ) insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event)
    select p_parent,notice_version,notice_hash,'withdrawn' from changed;
  update private.fairybucks_email_permission_requests set state='withdrawn',token_hash=null where parent_id=p_parent;
  delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
   where s.child_id=c.id and c.family_id=f.id and f.owner_id=p_parent;
  return jsonb_build_object('status','withdrawn','parent_id',p_parent,'version',release.notice_version,'notice_hash',release.notice_hash);
 end if;
 if release.singleton is null or not release.notice_ready or not release.email_method_reviewed
  or p_version is distinct from release.notice_version or p_notice_hash is distinct from release.notice_hash then
  return jsonb_build_object('status','setup_pending','parent_id',p_parent);end if;
 select * into r from private.fairybucks_email_permission_requests where parent_id=p_parent for update;
 if p_action='start' then
  if p_guardian is not true then return jsonb_build_object('status','guardian_required','parent_id',p_parent);end if;
  if r.id is null or r.state='withdrawn' or (r.expires_at<=clock_timestamp() and r.state<>'verified')
    or r.notice_version<>release.notice_version or r.notice_hash<>release.notice_hash or r.parent_email<>email then
   delete from private.fairybucks_email_permission_requests where parent_id=p_parent;
   insert into private.fairybucks_email_permission_requests(parent_id,parent_email,notice_version,notice_hash)
    values(p_parent,email,release.notice_version,release.notice_hash) returning * into r;
   insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at)
    values(p_parent,release.notice_version,release.notice_hash,'requested',r.created_at)
    on conflict(parent_id,notice_version) do update set notice_hash=excluded.notice_hash,status='requested',
     requested_at=excluded.requested_at,verified_at=null,withdrawn_at=null,method=null,evidence_ref=null,reviewer=null;
   insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event)
    values(p_parent,r.notice_version,r.notice_hash,'requested');
  end if;
  if r.state='requested' and not exists(select 1 from private.fairybucks_permission_mail
    where request_id=r.id and kind='notice' and accepted_at is null) then
   if r.notice_sent_at>clock_timestamp()-interval '5 minutes' then
    return jsonb_build_object('status','rate_limited','parent_id',p_parent,'version',r.notice_version,'notice_hash',r.notice_hash);
   end if;
   if (select count(*) from private.fairybucks_permission_mail where request_id=r.id and kind='notice'
     and created_at>clock_timestamp()-interval '1 day')>=6 then
    return jsonb_build_object('status','rate_limited','parent_id',p_parent,'version',r.notice_version,'notice_hash',r.notice_hash);
   end if;
   insert into private.fairybucks_permission_mail_limits(parent_id) values(p_parent) on conflict do nothing;
   select * into lim from private.fairybucks_permission_mail_limits where parent_id=p_parent for update;
   if lim.window_start<=clock_timestamp()-interval '1 day' then
    update private.fairybucks_permission_mail_limits set window_start=clock_timestamp(),attempts=0 where parent_id=p_parent;
    lim.attempts:=0;
   end if;
   if lim.attempts>=6 or lim.last_attempt>clock_timestamp()-interval '5 minutes' then
    return jsonb_build_object('status','rate_limited','parent_id',p_parent,'version',r.notice_version,'notice_hash',r.notice_hash);end if;
   update private.fairybucks_permission_mail_limits set attempts=attempts+1,last_attempt=clock_timestamp() where parent_id=p_parent;
   insert into private.fairybucks_permission_mail(request_id,kind) values(r.id,'notice');
  end if;
 end if;
 if r.id is null then result_status:='needed';
 elsif r.state='withdrawn' then result_status:='withdrawn';
 elsif r.notice_version<>release.notice_version or r.notice_hash<>release.notice_hash or r.parent_email<>email
   or (r.expires_at<=clock_timestamp() and r.state<>'verified') then result_status:='needed';
 elsif r.state='verified' and exists(select 1 from private.fairybucks_parent_consents
  where parent_id=p_parent and notice_version=r.notice_version and notice_hash=r.notice_hash and status='verified'
   and method='email_plus') then result_status:='verified';
 elsif r.state='approved' then result_status:='confirming';
 else result_status:='requested';end if;
 if p_action in ('inspect','approve') then
  if result_status not in ('requested','confirming','verified') or p_request is distinct from r.id
    or p_token_hash is null or p_token_hash is distinct from r.token_hash or r.notice_sent_at is null
    or r.expires_at<=clock_timestamp() then
   return jsonb_build_object('status','invalid_link','parent_id',p_parent);end if;
  if p_action='approve' then
   if p_guardian is not true then return jsonb_build_object('status','guardian_required','parent_id',p_parent);end if;
   if r.state='requested' then
    update private.fairybucks_email_permission_requests set state='approved',approved_at=clock_timestamp()
     where id=r.id returning * into r;
    insert into private.fairybucks_permission_mail(request_id,kind) values(r.id,'confirmation') on conflict do nothing;
    result_status:='confirming';
   end if;
  end if;
 end if;
 if p_action in ('claim_notice','claim_confirmation') then
  v_kind:=case when p_action='claim_notice' then 'notice' else 'confirmation' end;
  if p_request is distinct from r.id or p_lease is null
    or (v_kind='notice' and result_status<>'requested') or (v_kind='confirmation' and result_status<>'confirming') then
   return jsonb_build_object('status','no_mail','parent_id',p_parent);end if;
  if v_kind='notice' then
   if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or (r.token_hash is not null and r.token_hash<>p_token_hash) then
    return jsonb_build_object('status','no_mail','parent_id',p_parent);end if;
   update private.fairybucks_email_permission_requests set token_hash=p_token_hash where id=r.id;
  end if;
  select * into j from private.fairybucks_permission_mail m where m.request_id=r.id and m.kind=v_kind
    and accepted_at is null and (lease_until is null or lease_until<clock_timestamp()) order by created_at limit 1 for update;
  if j.id is null then return jsonb_build_object('status','no_mail','parent_id',p_parent);end if;
  update private.fairybucks_permission_mail set lease=p_lease,lease_until=clock_timestamp()+interval '60 seconds' where id=j.id;
  return jsonb_build_object('status','mail_claimed','parent_id',p_parent,'request_id',r.id,'job_id',j.id,
   'email',r.parent_email,'kind',v_kind,'version',r.notice_version,'notice_hash',r.notice_hash);
 end if;
 if p_action='accepted' then
  select * into j from private.fairybucks_permission_mail where id=p_job and request_id=r.id for update;
  if j.id is null or p_request is distinct from r.id or p_lease is null or p_lease is distinct from j.lease
    or length(coalesce(p_message_id,'')) not between 1 and 200 then
   return jsonb_build_object('status','mail_not_recorded','parent_id',p_parent);end if;
  if (j.kind='notice' and result_status<>'requested') or (j.kind='confirmation' and result_status not in ('confirming','verified')) then
   return jsonb_build_object('status','mail_not_recorded','parent_id',p_parent);end if;
  if j.accepted_at is null then
   update private.fairybucks_permission_mail set accepted_at=clock_timestamp(),message_id=p_message_id where id=j.id;
   if j.kind='notice' then
    update private.fairybucks_email_permission_requests set notice_sent_at=clock_timestamp() where id=r.id;
   elsif r.state='approved' then
    -- A provider acknowledgement is a delivery attempt, not proof of inbox receipt.
    update private.fairybucks_parent_consents set status='verified',verified_at=clock_timestamp(),
      method='email_plus',evidence_ref=r.id::text,reviewer='permission-email-service'
     where parent_id=p_parent and notice_version=r.notice_version and notice_hash=r.notice_hash and status='requested';
    if not found then raise exception 'Permission request changed';end if;
    update private.fairybucks_email_permission_requests set state='verified',confirmation_sent_at=clock_timestamp() where id=r.id;
    insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event,evidence_ref,reviewer)
     values(p_parent,r.notice_version,r.notice_hash,'verified',r.id::text,'permission-email-service');
    result_status:='verified';
   end if;
  end if;
 end if;
 return jsonb_build_object('status',result_status,'parent_id',p_parent,'request_id',r.id,
  'version',release.notice_version,'notice_hash',release.notice_hash);
end $$;
revoke all on function public.fairybucks_email_permission(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text)
 from public,anon,authenticated;
grant execute on function public.fairybucks_email_permission(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text)
 to service_role;
-- Email changes invalidate previously verified email permission at the child boundary too.
create or replace function private.fairybucks_child_permission(p_parent uuid)
returns boolean language plpgsql security definer set search_path='' as $
declare release private.fairybucks_privacy_release%rowtype;c private.fairybucks_parent_consents%rowtype;
begin
 select * into release from private.fairybucks_privacy_release where singleton for share;
 if found and not release.enforcement_enabled then return true;end if;
 if not found or not release.notice_ready then return false;end if;
 select * into c from private.fairybucks_parent_consents where parent_id=p_parent
  and notice_version=release.notice_version and notice_hash=release.notice_hash and status='verified' for share;
 if not found then return false;end if;
 if c.method='email_plus' then
  return release.email_method_reviewed and exists(
   select 1 from private.fairybucks_email_permission_requests r join auth.users u on u.id=r.parent_id
   where r.parent_id=p_parent and r.state='verified' and r.parent_email=u.email and u.email_confirmed_at is not null
    and r.notice_version=release.notice_version and r.notice_hash=release.notice_hash and r.confirmation_sent_at is not null);
 end if;
 return true;
end $;
revoke all on function private.fairybucks_child_permission(uuid) from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
