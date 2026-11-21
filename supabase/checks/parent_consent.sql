-- Rollback-only fixtures. Uses new random users, never verifies real parent accounts.
begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s_a uuid:=gen_random_uuid();s_b uuid:=gen_random_uuid();
 f_a uuid:=gen_random_uuid();f_b uuid:=gen_random_uuid();c_a uuid:=gen_random_uuid();c_b uuid:=gen_random_uuid();
 hash text;v integer;token text;unlock text;result jsonb;claims jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(s_a,a),(s_b,b);
 select id into f_a from public.families where owner_id=a limit 1;
 if f_a is null then f_a:=gen_random_uuid();insert into public.families(id,owner_id) values(f_a,a);end if;
 select id into f_b from public.families where owner_id=b limit 1;
 if f_b is null then f_b:=gen_random_uuid();insert into public.families(id,owner_id) values(f_b,b);end if;
 insert into public.child_profiles(id,family_id,nickname) values(c_a,f_a,'Consent fixture A'),(c_b,f_b,'Consent fixture B');
 insert into private.parent_pin_security(parent_id,pin_hash) values(a,extensions.crypt('111111',extensions.gen_salt('bf',4)));
 select notice_hash,notice_version into hash,v from private.fairybucks_privacy_release;
 -- Pre-launch access must fail closed even when enforcement is not yet released.
 update private.fairybucks_privacy_release set notice_ready=false,enforcement_enabled=false;
 grant insert on public.child_profiles to authenticated;
 claims:=jsonb_build_object('sub',a,'session_id',s_a);
 perform set_config('request.jwt.claims',claims::text,true);perform set_config('role','authenticated',true);
 begin insert into public.child_profiles(family_id,nickname) values(f_a,'Staged development fixture');
  raise exception 'Staging allowed new explorer without permission';
 exception when insufficient_privilege then null;end;
 unlock:=public.fairybucks_parent_pin('111111',false)->>'token';
 begin perform public.fairybucks_start_child_session(c_a,unlock);
  raise exception 'Staging allowed child handoff without permission';
 exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_start_child_session(c_a,repeat('0',64));
  raise exception 'Staging bypassed child mode restriction';
 exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_start_child_session(c_b,unlock);
  raise exception 'Staging bypassed family ownership';
 exception when insufficient_privilege then null;end;
 -- Directly inject an expiring synthetic session to verify that the child RPC
 -- denies access even to an existing token before parent permission is released.
 perform set_config('role','none',true);
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at)
 values(c_a,extensions.digest(token,'sha256'),clock_timestamp()+interval '1 hour');
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(token)->>'status'<>'permission_required'
 then raise exception 'Staging allowed child view without permission';end if;
 perform set_config('role','none',true);
 if exists(select 1 from private.fairybucks_parent_consents where parent_id=a) then raise exception 'Staging fabricated consent';end if;
 update private.fairybucks_privacy_release set enforcement_enabled=true;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(token)->>'status'<>'permission_required' then raise exception 'Activation retained unverified child access';end if;
 perform set_config('role','authenticated',true);
 if public.fairybucks_parent_consent()->>'status'<>'setup_pending' then raise exception 'Draft notice allowed request';end if;
 if public.fairybucks_parent_consent('request',v,hash,true)->>'status'<>'setup_pending' then raise exception 'Draft request accepted';end if;
 begin perform public.fairybucks_start_child_session(c_a,repeat('0',64));raise exception 'Unverified handoff allowed';exception when insufficient_privilege then null;end;
 -- Authenticated inserts are evaluated by the trigger even if the RLS layer were misconfigured.
 perform set_config('role','none',true);grant insert on public.child_profiles to authenticated;
 perform set_config('role','authenticated',true);
 begin insert into public.child_profiles(family_id,nickname) values(f_a,'Must block');raise exception 'Unverified profile allowed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);update private.fairybucks_privacy_release set notice_ready=true;
 perform set_config('role','authenticated',true);
 if public.fairybucks_parent_consent('request',v,hash,false)->>'status'<>'guardian_required' then raise exception 'Guardian assertion missing';end if;
 if public.fairybucks_parent_consent('request',v+1,hash,true)->>'status'<>'notice_changed' then raise exception 'Wrong notice version accepted';end if;
 if public.fairybucks_parent_consent('request',v,repeat('0',64),true)->>'status'<>'notice_changed' then raise exception 'Wrong notice hash accepted';end if;
 if public.fairybucks_parent_consent('request',v,hash,true)->>'status'<>'requested' then raise exception 'Request not recorded';end if;
 if public.fairybucks_parent_consent('request',v,hash,true)->>'status'<>'requested' then raise exception 'Request retry failed';end if;
 begin perform private.fairybucks_verify_signed_consent(a,v,hash,'FAKE','Browser');raise exception 'Browser self-verified';exception when insufficient_privilege then null;end;
 begin perform 1 from private.fairybucks_parent_consents;raise exception 'Browser read private consent table';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 if (select count(*) from private.fairybucks_consent_events where parent_id=a)<>1 then raise exception 'Duplicate request events';end if;
 perform private.fairybucks_verify_signed_consent(a,v,hash,'SYNTHETIC-CONSENT-CHECK','Rollback test');
 perform set_config('role','authenticated',true);
 if public.fairybucks_parent_consent()->>'status'<>'verified' then raise exception 'Verified status absent';end if;
 insert into public.child_profiles(family_id,nickname) values(f_a,'Verified fixture explorer');
 begin insert into public.child_profiles(family_id,nickname) values(f_b,'Wrong owner');raise exception 'Cross-family profile allowed';exception when insufficient_privilege then null;end;
 unlock:=public.fairybucks_parent_pin('111111',false)->>'token';
 token:=public.fairybucks_start_child_session(c_a,unlock);
 if token is null then raise exception 'Verified handoff failed';end if;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(token)->>'status'<>'active' then raise exception 'Verified child view failed';end if;
 begin perform public.fairybucks_parent_consent('request',v,hash,true);raise exception 'Anonymous consent accepted';exception when insufficient_privilege then null;end;
 begin perform private.fairybucks_child_action_core(token);raise exception 'Anonymous core bypass allowed';exception when insufficient_privilege then null;end;
 -- Changing the notice immediately blocks old child sessions even before their TTL expires.
 perform set_config('role','none',true);update private.fairybucks_privacy_release set notice_hash=repeat('f',64);
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(token)->>'status'<>'permission_required' then raise exception 'Changed notice kept old child access';end if;
 perform set_config('role','none',true);update private.fairybucks_privacy_release set notice_hash=hash;
 perform set_config('role','authenticated',true);perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',s_b)::text,true);
 if public.fairybucks_parent_consent()->>'status'<>'needed' then raise exception 'Other parent inherited consent';end if;
 perform set_config('request.jwt.claims',claims::text,true);
 if public.fairybucks_parent_consent('withdraw')->>'status'<>'withdrawn' then raise exception 'Withdrawal failed';end if;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(token)->>'status'<>'expired' then raise exception 'Withdrawal kept child session';end if;
 perform set_config('role','none',true);
 if not exists(select 1 from public.child_profiles where id=c_a) then raise exception 'Withdrawal removed reviewable family data';end if;
 if (select count(*) from private.fairybucks_consent_events where parent_id=a)<>3 then raise exception 'Consent audit history incorrect';end if;
 perform set_config('role','authenticated',true);
 if public.fairybucks_parent_consent('request',v,hash,true)->>'status'<>'requested' then raise exception 'New request after withdrawal failed';end if;
 -- Deleting the account removes consent records/events as well (signed files outside DB are an operator task).
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',floor(extract(epoch from clock_timestamp()))))))::text,true);
 unlock:=public.fairybucks_parent_pin('111111',false)->>'token';
 if public.fairybucks_delete_account('DELETE',unlock,a)->>'status'<>'deleted' then raise exception 'Account deletion failed with consent rows';end if;
 perform set_config('role','none',true);
 if exists(select 1 from private.fairybucks_parent_consents where parent_id=a) or exists(select 1 from private.fairybucks_consent_events where parent_id=a)
 then raise exception 'Deleted account retained consent records';end if;
 if not exists(select 1 from public.child_profiles where id=c_b) then raise exception 'Other family changed';end if;
end $$;
select 'PASS: versioned parent consent, privileged verification, enforced child gates, withdrawal and deletion.' as result;
rollback;
