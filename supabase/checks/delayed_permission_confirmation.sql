begin;
do $$
declare a uuid:=gen_random_uuid();sid uuid:=gen_random_uuid();rid uuid:=gen_random_uuid();job uuid:=gen_random_uuid();
 lease uuid:=gen_random_uuid();other_lease uuid:=gen_random_uuid();v integer;h text;x jsonb;
begin
 update private.fairybucks_privacy_release set notice_ready=true,email_method_reviewed=true,enforcement_enabled=true;
 select notice_version,notice_hash into v,h from private.fairybucks_privacy_release;
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(sid,a);
 insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at)
 values(a,v,h,'requested',now());
 insert into private.fairybucks_email_permission_requests(id,parent_id,parent_email,notice_version,notice_hash,state,approved_at,notice_sent_at)
 values(rid,a,a::text||'@example.test',v,h,'approved',now(),now());
 insert into private.fairybucks_permission_mail(id,request_id,kind) values(job,rid,'confirmation');
 if has_function_privilege('service_role','private.fairybucks_email_permission_core(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text)','execute') then raise exception 'Private core exposed';end if;
 if public.fairybucks_email_permission('claim_confirmation',a,sid,v,h,p_request=>rid,p_lease=>lease)->>'status'<>'confirming' then raise exception 'Immediate parent send allowed';end if;
 if public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Worker sent before delay';end if;
 if private.fairybucks_child_permission(a) then raise exception 'Pending approval opened child access';end if;
 update private.fairybucks_email_permission_requests set approved_at=now()-interval '61 minutes' where id=rid;
 if public.fairybucks_confirmation_dispatch('claim',v,h,false,false,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Disabled scope sent';end if;
 x:=public.fairybucks_confirmation_dispatch('list',v,h,true,false);
 if not (x->'requests' @> jsonb_build_array(rid::text)) then raise exception 'Due job missing from scheduler list';end if;
 -- Background dispatch must work after the parent leaves/signs out.
 delete from auth.sessions where id=sid;
 x:=public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease);
 if x->>'status'<>'mail_claimed' or x->>'email'<>a::text||'@example.test' then raise exception 'Due logged-out parent not claimed';end if;
 if public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>other_lease)->>'status'<>'no_mail' then raise exception 'Concurrent lease accepted';end if;
 if public.fairybucks_confirmation_dispatch('accepted',v,h,true,false,rid,job,other_lease,'TEST-MAIL')->>'status'='verified' then raise exception 'Wrong lease verified';end if;
 -- Simulate failed/lost provider response. No acceptance means no child access.
 if private.fairybucks_child_permission(a) then raise exception 'Claim granted permission';end if;
 update private.fairybucks_permission_mail set lease_until=now()-interval '1 second' where id=job;
 x:=public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>other_lease);
 if x->>'status'<>'mail_claimed' or x->>'job_id'<>job::text then raise exception 'Retry changed idempotency job';end if;
 -- Withdrawal while a request is in flight cannot be undone by a late acknowledgement.
 update private.fairybucks_parent_consents set status='withdrawn' where parent_id=a;
 if public.fairybucks_confirmation_dispatch('accepted',v,h,true,false,rid,job,other_lease,'LATE-MAIL')->>'status'='verified' then raise exception 'Withdrawal revived';end if;
 update private.fairybucks_parent_consents set status='requested' where parent_id=a;
 update private.fairybucks_email_permission_requests set state='approved' where id=rid;
 update private.fairybucks_permission_mail set first_confirmation_attempt_at=now()-interval '24 hours',lease_until=null where id=job;
 if public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease)->>'status'<>'manual_review' then raise exception 'Unbounded provider retry allowed';end if;
 update private.fairybucks_permission_mail set first_confirmation_attempt_at=null where id=job;
 update auth.users set email='changed-'||a::text||'@example.test' where id=a;
 if public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Changed email sent';end if;
 update auth.users set email=a::text||'@example.test' where id=a;
 if public.fairybucks_confirmation_dispatch('claim',v,'wrong',true,false,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Wrong notice sent';end if;
 -- A selected rehearsal is isolated from public-mode dispatch.
 insert into private.fairybucks_permission_rehearsals(parent_id,expires_at) values(a,now()+interval '2 hours');
 if public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Public dispatcher took rehearsal';end if;
 update private.fairybucks_permission_rehearsals set expires_at=now()-interval '1 second' where parent_id=a;
 if public.fairybucks_confirmation_dispatch('claim',v,h,false,true,rid,p_lease=>lease)->>'status'<>'no_mail' then raise exception 'Expired rehearsal sent';end if;
 delete from private.fairybucks_permission_rehearsals where parent_id=a;
 x:=public.fairybucks_confirmation_dispatch('claim',v,h,true,false,rid,p_lease=>lease);
 if x->>'status'<>'mail_claimed' then raise exception 'Ready retry failed';end if;
 x:=public.fairybucks_confirmation_dispatch('accepted',v,h,true,false,rid,job,lease,'TEST-MAIL');
 if x->>'status'<>'verified' or not private.fairybucks_child_permission(a) then raise exception 'Delayed confirmation failed';end if;
 -- Deleting the account/request leaves nothing for a queued late job to approve.
 delete from private.fairybucks_email_permission_requests where id=rid;
 if public.fairybucks_confirmation_dispatch('accepted',v,h,true,false,rid,job,lease,'LATE-MAIL')->>'status'<>'no_mail' then raise exception 'Deleted request revived';end if;
 perform set_config('role','authenticated',true);
 begin perform public.fairybucks_confirmation_dispatch('list',v,h);raise exception 'Browser dispatched';exception when insufficient_privilege then null;end;
 perform set_config('role','anon',true);
 begin perform public.fairybucks_confirmation_dispatch('list',v,h);raise exception 'Anonymous dispatched';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
end $$;
select 'PASS confirmation delay, background logout, scope, retry leases, withdrawal, changed email/hash, capped retries and child access' as result;
rollback;
