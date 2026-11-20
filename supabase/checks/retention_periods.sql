-- Disposable fixtures and simulated dates, all rolled back. Never run fragments.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); f uuid:=gen_random_uuid();
 x uuid:=gen_random_uuid(); notice uuid; old_notice uuid; sid uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at,created_at) values
 (a,a||'@example.test',now(),now()-interval '2 years'),(b,b||'@example.test',now(),now()-interval '2 years');
 -- Deployment baseline must protect even an ancient existing account.
 begin
  perform private.fairybucks_record_inactivity_warning(a,a||'@example.test','TEST');
  raise exception 'Baseline failed';
 exception when others then if sqlerrm='Baseline failed' then raise;end if;end;
 update private.fairybucks_retention_policy set started_at=now()-interval '2 years';
 notice:=private.fairybucks_record_inactivity_warning(a,a||'@example.test','LOCAL-TEST-DELIVERY');
 begin
  perform private.fairybucks_delete_inactive_account(a,a||'@example.test',notice,'DELETE INACTIVE ACCOUNT '||a);
  raise exception 'Early deletion allowed';
 exception when others then if sqlerrm='Early deletion allowed' then raise;end if;end;
 update private.fairybucks_inactivity_notices set sent_at=now()-interval '31 days' where parent_id=a;
 old_notice:=notice;
 -- Resuming a session cancels the warning and counts as use.
 insert into auth.sessions(id,user_id) values(sid,a);
 if exists(select 1 from private.fairybucks_inactivity_notices where parent_id=a) then raise exception 'Sign-in did not cancel warning';end if;
 if private.fairybucks_retention_last_activity(a)<now()-interval '1 minute' then raise exception 'Sign-in not counted';end if;
 begin
  perform private.fairybucks_delete_inactive_account(a,a||'@example.test',old_notice,'DELETE INACTIVE ACCOUNT '||a);
  raise exception 'Stale warning allowed';
 exception when others then if sqlerrm='Stale warning allowed' then raise;end if;end;
 delete from auth.sessions where id=sid;
 update private.fairybucks_account_activity set last_seen_at=now()-interval '2 years' where parent_id=a;
 notice:=private.fairybucks_record_inactivity_warning(a,a||'@example.test','LOCAL-TEST-DELIVERY-2');
 update private.fairybucks_inactivity_notices set sent_at=now()-interval '31 days' where parent_id=a;
 begin
  perform private.fairybucks_delete_inactive_account(a,'wrong@example.test',notice,'DELETE INACTIVE ACCOUNT '||a);
  raise exception 'Wrong email allowed';
 exception when others then if sqlerrm='Wrong email allowed' then raise;end if;end;
 begin
  perform private.fairybucks_delete_inactive_account(a,a||'@example.test',notice,'DELETE');
  raise exception 'Generic confirmation allowed';
 exception when others then if sqlerrm='Generic confirmation allowed' then raise;end if;end;
 begin
  perform private.fairybucks_delete_inactive_account(a,a||'@example.test',old_notice,'DELETE INACTIVE ACCOUNT '||a);
  raise exception 'Replaced notice allowed';
 exception when others then if sqlerrm='Replaced notice allowed' then raise;end if;end;
 insert into private.fairybucks_support_retention(case_ref,closed_at) values('ROLLBACK-ONLY-CASE',now()-interval '91 days');
 if not exists(select 1 from private.fairybucks_support_retention where case_ref='ROLLBACK-ONLY-CASE'
 and closed_at+interval '90 days'<now() and deleted_at is null) then raise exception 'Support deadline not tracked';end if;
 if has_table_privilege('authenticated','private.fairybucks_support_retention','select')
 or has_table_privilege('anon','private.fairybucks_inactivity_notices','select') then raise exception 'Private retention records exposed';end if;
 update private.fairybucks_privacy_release set enforcement_enabled=false;
 insert into public.families(id,owner_id) values(f,a);
 insert into public.child_profiles(id,family_id,nickname) values(x,f,'Inactivity fixture');
 insert into public.fairy_wallets(child_id,balance) values(x,17);
 -- Unknown dependency must roll back the entire deletion.
 create table public.fairybucks_retention_test_dependency(parent_id uuid references auth.users);
 insert into public.fairybucks_retention_test_dependency values(a);
 begin
  perform private.fairybucks_delete_inactive_account(a,a||'@example.test',notice,'DELETE INACTIVE ACCOUNT '||a);
  raise exception 'Dependency ignored';
 exception when foreign_key_violation then null;end;
 if not exists(select 1 from public.fairy_wallets where child_id=x and balance=17) then raise exception 'Partial delete';end if;
 delete from public.fairybucks_retention_test_dependency;
 perform private.fairybucks_delete_inactive_account(a,a||'@example.test',notice,'DELETE INACTIVE ACCOUNT '||a);
 if exists(select 1 from auth.users where id=a) or exists(select 1 from public.families where id=f)
 or exists(select 1 from private.fairybucks_account_activity where parent_id=a)
 or not exists(select 1 from auth.users where id=b) then raise exception 'Wrong scope or incomplete deletion';end if;
 if has_function_privilege('anon','private.fairybucks_delete_inactive_account(uuid,text,uuid,text)','execute')
 or has_function_privilege('authenticated','private.fairybucks_record_inactivity_warning(uuid,text,text)','execute')
 or has_function_privilege('service_role','private.fairybucks_delete_inactive_account(uuid,text,uuid,text)','execute') then raise exception 'Operator API exposed';end if;
end $$;
select 'PASS 12-month baseline, warning grace, renewed activity, stale warning, exact target, atomic deletion and isolation' as result;
rollback;
