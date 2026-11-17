-- Rollback-only synthetic fixtures. Sends no email and changes no lasting release settings.
begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sa uuid:=gen_random_uuid();sb uuid:=gen_random_uuid();
 v integer;h text;x jsonb;rid uuid;job uuid;lease uuid:=gen_random_uuid();confirm_job uuid;confirm_lease uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 select notice_version,notice_hash into v,h from private.fairybucks_privacy_release;
 update private.fairybucks_privacy_release set notice_ready=true,enforcement_enabled=true,email_method_reviewed=false;
 if public.fairybucks_email_permission('start',a,sa,v,h,p_guardian=>true)->>'status'<>'setup_pending' then
  raise exception 'Unreviewed email method allowed';end if;
 update private.fairybucks_privacy_release set email_method_reviewed=true;
 if public.fairybucks_email_permission('start',a,sa,v,h)->>'status'<>'guardian_required' then
  raise exception 'Missing guardian assertion accepted';end if;
 x:=public.fairybucks_email_permission('start',a,sa,v,h,p_guardian=>true);rid:=(x->>'request_id')::uuid;
 if x->>'status'<>'requested' or rid is null then raise exception 'Request not recorded';end if;
 if private.fairybucks_child_permission(a) then raise exception 'Request granted permission';end if;
 if public.fairybucks_email_permission('approve',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64),p_guardian=>true)->>'status'<>'invalid_link' then
  raise exception 'Unsent notice approved';end if;
 x:=public.fairybucks_email_permission('claim_notice',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64),p_lease=>lease);
 job:=(x->>'job_id')::uuid;
 if x->>'status'<>'mail_claimed' or x->>'email'<>a::text||'@example.test' then raise exception 'Notice not claimed';end if;
 if public.fairybucks_email_permission('claim_notice',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64),p_lease=>gen_random_uuid())->>'status'<>'no_mail' then
  raise exception 'Duplicate sender claimed leased mail';end if;
 if public.fairybucks_email_permission('accepted',a,sa,v,h,p_request=>rid,p_job=>job,p_lease=>gen_random_uuid(),p_message_id=>'TEST-NOTICE')->>'status'<>'mail_not_recorded' then
  raise exception 'Wrong mail lease accepted';end if;
 perform public.fairybucks_email_permission('accepted',a,sa,v,h,p_request=>rid,p_job=>job,p_lease=>lease,p_message_id=>'TEST-NOTICE');
 if public.fairybucks_email_permission('approve',b,sb,v,h,p_request=>rid,p_token_hash=>repeat('a',64),p_guardian=>true)->>'status'<>'invalid_link' then
  raise exception 'Different parent approved link';end if;
 if public.fairybucks_email_permission('approve',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('b',64),p_guardian=>true)->>'status'<>'invalid_link' then
  raise exception 'Wrong token approved';end if;
 update private.fairybucks_email_permission_requests set expires_at=clock_timestamp()-interval '1 second' where id=rid;
 if public.fairybucks_email_permission('inspect',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64))->>'status'<>'invalid_link' then
  raise exception 'Expired link accepted';end if;
 update private.fairybucks_email_permission_requests set expires_at=clock_timestamp()+interval '1 day' where id=rid;
 if public.fairybucks_email_permission('approve',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64))->>'status'<>'guardian_required' then
  raise exception 'Unchecked approval accepted';end if;
 x:=public.fairybucks_email_permission('approve',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64),p_guardian=>true);
 if x->>'status'<>'confirming' or private.fairybucks_child_permission(a) then raise exception 'Approval bypassed confirmation';end if;
 x:=public.fairybucks_email_permission('claim_confirmation',a,sa,v,h,p_request=>rid,p_lease=>confirm_lease);
 confirm_job:=(x->>'job_id')::uuid;
 if x->>'status'<>'mail_claimed' then raise exception 'Confirmation job absent';end if;
 -- A failed send has no accepted acknowledgement and cannot grant access.
 if public.fairybucks_email_permission('status',a,sa,v,h)->>'status'<>'confirming' then raise exception 'Failed mail granted permission';end if;
 x:=public.fairybucks_email_permission('accepted',a,sa,v,h,p_request=>rid,p_job=>confirm_job,p_lease=>confirm_lease,p_message_id=>'TEST-CONFIRM');
 if x->>'status'<>'verified' or not private.fairybucks_child_permission(a) then raise exception 'Email permission did not verify';end if;
 perform public.fairybucks_email_permission('accepted',a,sa,v,h,p_request=>rid,p_job=>confirm_job,p_lease=>confirm_lease,p_message_id=>'TEST-CONFIRM');
 if (select count(*) from private.fairybucks_consent_events where parent_id=a and event='verified')<>1 then raise exception 'Duplicate verification event';end if;
 update auth.users set email='changed-'||a::text||'@example.test' where id=a;
 if private.fairybucks_child_permission(a) then raise exception 'Email change retained child permission';end if;
 update auth.users set email=a::text||'@example.test' where id=a;
 update private.fairybucks_privacy_release set notice_hash=repeat('f',64);
 if private.fairybucks_child_permission(a) then raise exception 'Changed notice retained permission';end if;
 update private.fairybucks_privacy_release set notice_hash=h;
 -- Legacy public withdrawal must cancel email approval as well.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);
 perform set_config('role','authenticated',true);
 begin perform public.fairybucks_email_permission('status',a,sa,v,h);raise exception 'Browser called service RPC';exception when insufficient_privilege then null;end;
 begin perform 1 from private.fairybucks_permission_mail;raise exception 'Browser read private mail';exception when insufficient_privilege then null;end;
 perform public.fairybucks_parent_consent('withdraw');
 perform set_config('role','none',true);
 if private.fairybucks_child_permission(a) then raise exception 'Withdrawal retained permission';end if;
 if public.fairybucks_email_permission('accepted',a,sa,v,h,p_request=>rid,p_job=>confirm_job,p_lease=>confirm_lease,p_message_id=>'LATE-CONFIRM')->>'status'<>'mail_not_recorded' then
  raise exception 'Late mail regranted withdrawn consent';end if;
 if public.fairybucks_email_permission('start',a,sa,v,h,p_guardian=>true)->>'status'<>'rate_limited' then
  raise exception 'Withdraw/restart bypassed mail rate limit';end if;
 if public.fairybucks_email_permission('inspect',a,sa,v,h,p_request=>rid,p_token_hash=>repeat('a',64))->>'status'<>'invalid_link' then
  raise exception 'Replaced link survived';end if;
 delete from auth.sessions where id=sa;
 begin perform public.fairybucks_email_permission('status',a,sa,v,h);raise exception 'Expired parent session accepted';exception when insufficient_privilege then null;end;
 delete from auth.users where id=a;
 if exists(select 1 from private.fairybucks_email_permission_requests where parent_id=a)
  or exists(select 1 from private.fairybucks_permission_mail where request_id=rid)
  or exists(select 1 from private.fairybucks_permission_mail_limits where parent_id=a) then
  raise exception 'Deleted account retained email permission data';end if;
 if has_function_privilege('anon','public.fairybucks_email_permission(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text)','execute')
  or not has_function_privilege('service_role','public.fairybucks_email_permission(text,uuid,uuid,integer,text,uuid,text,boolean,uuid,uuid,text)','execute') then
  raise exception 'Incorrect permission RPC grants';end if;
end $$;
select 'PASS: email permission, explicit approval, separate confirmation, retries, expiry, isolation, withdrawal, rate limits and deletion.' as result;
rollback;
