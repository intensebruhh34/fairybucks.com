-- One hour is an operator-selected initial delay, not a statutory safe harbor.
-- No sending, scheduler or public release is enabled by installation.
begin;
alter table private.fairybucks_permission_mail add column first_confirmation_attempt_at timestamptz;
create function private.fairybucks_email_permission_core(
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
 if not found or (p_session is not null and not exists(select 1 from auth.sessions where id=p_session and user_id=p_parent)) then
  raise insufficient_privilege using message='An active confirmed parent sign-in is required';end if;
 select * into release from private.fairybucks_effective_permission_release(p_parent);
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
      method='email_plus',evidence_ref=r.id::text,reviewer=case when exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent) then 'permission-email-rehearsal' else 'permission-email-service' end
     where parent_id=p_parent and notice_version=r.notice_version and notice_hash=r.notice_hash and status='requested';
    if not found then raise exception 'Permission request changed';end if;
    update private.fairybucks_email_permission_requests set state='verified',confirmation_sent_at=clock_timestamp() where id=r.id;
    insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event,evidence_ref,reviewer)
     values(p_parent,r.notice_version,r.notice_hash,'verified',r.id::text,case when exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=p_parent) then 'permission-email-rehearsal' else 'permission-email-service' end);
    result_status:='verified';
   end if;
  end if;
 end if;
 return jsonb_build_object('status',result_status,'parent_id',p_parent,'request_id',r.id,
  'version',release.notice_version,'notice_hash',release.notice_hash);
end $$;
revoke all on function private.fairybucks_email_permission_core(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function public.fairybucks_email_permission(
 p_action text,p_parent uuid,p_session uuid,p_version integer,p_notice_hash text,
 p_request uuid default null,p_token_hash text default null,p_guardian boolean default false,
 p_job uuid default null,p_lease uuid default null,p_message_id text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_session is null then raise insufficient_privilege using message='Active parent session required';end if;
 if p_action='claim_confirmation' or (p_action='accepted' and exists(
  select 1 from private.fairybucks_permission_mail where id=p_job and kind='confirmation')) then
  if not exists(select 1 from private.fairybucks_email_permission_requests where id=p_request and parent_id=p_parent
   and approved_at<=clock_timestamp()-interval '1 hour') then
   return jsonb_build_object('status','confirming','parent_id',p_parent);end if;
 end if;
 if p_action='claim_confirmation' and exists(select 1 from private.fairybucks_permission_mail where request_id=p_request and kind='confirmation' and first_confirmation_attempt_at<=clock_timestamp()-interval '23 hours') then
  return jsonb_build_object('status','confirming','parent_id',p_parent);end if;
 result:=private.fairybucks_email_permission_core(p_action,p_parent,p_session,p_version,p_notice_hash,
  p_request,p_token_hash,p_guardian,p_job,p_lease,p_message_id);
 if p_action='claim_confirmation' and result->>'status'='mail_claimed' then
  update private.fairybucks_permission_mail set first_confirmation_attempt_at=coalesce(first_confirmation_attempt_at,clock_timestamp()) where id=(result->>'job_id')::uuid;end if;
 return result;
end $$;

-- Service-only dispatcher. Account ownership is derived from the queued job, never a supplied email.
create function public.fairybucks_confirmation_dispatch(
 p_action text,p_version integer,p_notice_hash text,p_public boolean default false,p_rehearsal boolean default false,
 p_request uuid default null,p_job uuid default null,p_lease uuid default null,p_message_id text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.fairybucks_email_permission_requests%rowtype;rel private.fairybucks_privacy_release%rowtype;
 result jsonb;ids jsonb;
begin
 if p_action='list' then
  select coalesce(jsonb_agg(x.id),'[]'::jsonb) into ids from (
   select q.id from private.fairybucks_email_permission_requests q
   join private.fairybucks_permission_mail m on m.request_id=q.id and m.kind='confirmation'
   join auth.users u on u.id=q.parent_id and u.email=q.parent_email and u.email_confirmed_at is not null
   cross join lateral private.fairybucks_effective_permission_release(q.parent_id) eff
   where eff.notice_ready and eff.email_method_reviewed and eff.enforcement_enabled
    and eff.notice_version=p_version and eff.notice_hash=p_notice_hash
    and ((p_rehearsal and exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=q.parent_id and expires_at>clock_timestamp()))
     or (p_public and not exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=q.parent_id))) and q.state='approved' and q.approved_at<=clock_timestamp()-interval '1 hour'
    and q.expires_at>clock_timestamp() and m.accepted_at is null
    and (m.lease_until is null or m.lease_until<clock_timestamp())
    and (m.first_confirmation_attempt_at is null or m.first_confirmation_attempt_at>clock_timestamp()-interval '23 hours')
   order by q.approved_at limit 20
  ) x;
  return jsonb_build_object('requests',ids);
 end if;
 if p_action not in ('claim','accepted') then raise invalid_parameter_value;end if;
 select * into r from private.fairybucks_email_permission_requests where id=p_request;
 if not found then return jsonb_build_object('status','no_mail');end if;
 -- Same lock order as parent approval/withdrawal/account deletion.
 perform 1 from auth.users where id=r.parent_id and email=r.parent_email and email_confirmed_at is not null for update;
 if not found then return jsonb_build_object('status','no_mail');end if;
 select * into rel from private.fairybucks_effective_permission_release(r.parent_id);
 if not rel.notice_ready or not rel.email_method_reviewed or not rel.enforcement_enabled
 or rel.notice_version is distinct from p_version or rel.notice_hash is distinct from p_notice_hash then
  return jsonb_build_object('status','no_mail');end if;
 if exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=r.parent_id) then
  if not p_rehearsal or not exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=r.parent_id and expires_at>clock_timestamp()) then
   return jsonb_build_object('status','no_mail');end if;
 elsif not p_public then return jsonb_build_object('status','no_mail');end if;
 select * into r from private.fairybucks_email_permission_requests where id=p_request for update;
 if r.state<>'approved' or r.expires_at<=clock_timestamp() or r.approved_at is null
 or r.approved_at>clock_timestamp()-interval '1 hour' then return jsonb_build_object('status','no_mail');end if;
 if p_action='claim' then
  if exists(select 1 from private.fairybucks_permission_mail where request_id=r.id and kind='confirmation'
   and first_confirmation_attempt_at<=clock_timestamp()-interval '23 hours') then
   return jsonb_build_object('status','manual_review');end if;
  result:=private.fairybucks_email_permission_core('claim_confirmation',r.parent_id,null,p_version,p_notice_hash,
   p_request=>r.id,p_lease=>p_lease);
  if result->>'status'='mail_claimed' then
   update private.fairybucks_permission_mail set first_confirmation_attempt_at=coalesce(first_confirmation_attempt_at,clock_timestamp()) where id=(result->>'job_id')::uuid;
  end if;
  return result;
 end if;
 return private.fairybucks_email_permission_core('accepted',r.parent_id,null,p_version,p_notice_hash,
  p_request=>r.id,p_job=>p_job,p_lease=>p_lease,p_message_id=>p_message_id);
end $$;
revoke all on function public.fairybucks_confirmation_dispatch(text,integer,text,boolean,boolean,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.fairybucks_confirmation_dispatch(text,integer,text,boolean,boolean,uuid,uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
