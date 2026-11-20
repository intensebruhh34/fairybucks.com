-- Rollback-only verification. Does not delete real family or permission records.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 f uuid:=gen_random_uuid(); x uuid:=gen_random_uuid(); y uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
 r uuid; result jsonb; h text:=repeat('a',64);
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (a,a||'@example.test',now()),(b,b||'@example.test',now()),(c,c||'@example.test',now());
 insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at,withdrawn_at)
 values(a,2,h,'requested',now()-interval '40 days',null),
 (b,2,h,'verified',now()-interval '40 days',null),
 (c,2,h,'withdrawn',now()-interval '40 days',now()-interval '31 days');
 insert into private.fairybucks_email_permission_requests(parent_id,parent_email,notice_version,notice_hash,state,expires_at)
 values(a,a||'@example.test',2,h,'requested',now()-interval '31 days'),
 (b,b||'@example.test',2,h,'verified',now()-interval '31 days'),
 (c,c||'@example.test',2,h,'withdrawn',now()-interval '31 days');
 select id into r from private.fairybucks_email_permission_requests where parent_id=a;
 insert into private.fairybucks_permission_mail(request_id,kind) values(r,'notice');
 insert into private.fairybucks_permission_mail_limits(parent_id,window_start,last_attempt)
 values(a,now()-interval '31 days',now()-interval '31 days'),(b,now(),now());
 update private.fairybucks_privacy_release set enforcement_enabled=false;
 insert into public.families(id,owner_id) values(f,b);
 insert into public.child_profiles(id,family_id,nickname) values(x,f,'Expired'),(y,f,'Active');
 insert into public.fairy_wallets(child_id,balance) values(x,13),(y,27);
 insert into private.fairybucks_child_sessions values(x,decode(repeat('1',64),'hex'),now()-interval '1 hour'),
 (y,decode(repeat('2',64),'hex'),now()+interval '1 hour');
 insert into auth.sessions(id,user_id) values(sid,b);
 insert into private.fairybucks_parent_unlocks values(b,sid,decode(repeat('3',64),'hex'),now()-interval '1 hour');
 result:=private.fairybucks_retention_cleanup();
 if exists(select 1 from private.fairybucks_child_sessions where child_id=x)
 or exists(select 1 from private.fairybucks_parent_unlocks where parent_id=b)
 or not exists(select 1 from private.fairybucks_child_sessions where child_id=y)
 or (select sum(balance) from public.fairy_wallets where child_id in(x,y))<>40
 or (select count(*) from public.child_profiles where id in(x,y))<>2
 then raise exception 'Session expiry or vault preservation failed';end if;
 if exists(select 1 from private.fairybucks_email_permission_requests where parent_id in(a,c))
 or exists(select 1 from private.fairybucks_permission_mail where request_id=r)
 or exists(select 1 from private.fairybucks_permission_mail_limits where parent_id=a)
 then raise exception 'Old transport data retained';end if;
 if not exists(select 1 from private.fairybucks_email_permission_requests where parent_id=b and state='verified')
 or not exists(select 1 from private.fairybucks_parent_consents where parent_id=c and status='withdrawn')
 or not exists(select 1 from private.fairybucks_permission_mail_limits where parent_id=b)
 then raise exception 'Active permission, refusal record or live limit removed';end if;
 -- A recent expired request must survive its grace period.
 insert into private.fairybucks_email_permission_requests(parent_id,parent_email,notice_version,notice_hash,state,expires_at)
 values(a,a||'@example.test',2,h,'approved',now()-interval '1 day');
 perform private.fairybucks_retention_cleanup();
 if not exists(select 1 from private.fairybucks_email_permission_requests where parent_id=a)
 then raise exception 'Grace period ignored';end if;
 if has_function_privilege('anon','private.fairybucks_retention_cleanup()','execute')
 or has_function_privilege('authenticated','private.fairybucks_retention_cleanup()','execute')
 or has_function_privilege('service_role','private.fairybucks_retention_cleanup()','execute')
 then raise exception 'Cleanup exposed to API role';end if;
end $$;
select 'PASS retention cleanup, active permission preservation, grace period and API denial' as result;
rollback;
