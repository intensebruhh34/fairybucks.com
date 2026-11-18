-- Replace the placeholder with the same parent email used to start the rehearsal.
-- Withdraw test-only approvals and revoke child sessions before returning to staged development.
begin;
do $$
declare parent uuid;
begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'Do not return to development access during an enforced release';end if;
 select id into parent from auth.users where lower(email)=lower('REPLACE_WITH_CONFIRMED_PARENT_EMAIL');
 if parent is null then raise exception 'Choose the rehearsal parent email';end if;
 if not exists(select 1 from private.fairybucks_permission_rehearsals where parent_id=parent) then
  raise exception 'This account is not selected for rehearsal';end if;
 with changed as (
  update private.fairybucks_parent_consents set status='withdrawn',withdrawn_at=clock_timestamp()
  where parent_id=parent and status<>'withdrawn' returning notice_version,notice_hash
 ) insert into private.fairybucks_consent_events(parent_id,notice_version,notice_hash,event,reviewer)
 select parent,notice_version,notice_hash,'withdrawn','permission-email-rehearsal-close' from changed;
 update private.fairybucks_email_permission_requests set state='withdrawn',token_hash=null where parent_id=parent;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
 where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from private.fairybucks_permission_rehearsals where parent_id=parent;
end $$;
select 'Rehearsal closed; test approval withdrawn; child sessions ended.' as result;
commit;
