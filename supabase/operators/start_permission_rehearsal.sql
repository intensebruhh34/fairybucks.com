-- After merging/installing the rehearsal migration and deploying the email function.
-- Replace the placeholder with the confirmed parent account you intend to test.
-- This revokes that family's current child sessions. No other account is selected.
begin;
do $$
declare parent uuid;
begin
 if exists(select 1 from private.fairybucks_privacy_release where enforcement_enabled) then
  raise exception 'This script is for staged development, not an enforced release';end if;
 select id into parent from auth.users
 where lower(email)=lower('REPLACE_WITH_CONFIRMED_PARENT_EMAIL') and email_confirmed_at is not null;
 if parent is null then raise exception 'Choose an existing confirmed parent email';end if;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
 where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 insert into private.fairybucks_permission_rehearsals(parent_id,expires_at)
 values(parent,clock_timestamp()+interval '24 hours')
 on conflict(parent_id) do update set expires_at=excluded.expires_at;
end $$;
select 'Private rehearsal selected for 24 hours; global release switches unchanged.' as result;
commit;
