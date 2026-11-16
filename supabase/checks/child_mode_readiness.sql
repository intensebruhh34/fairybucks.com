-- Step 5: child-mode protection. Run this whole file as one SQL Editor query.
-- Random disposable fixtures; all changes roll back. No real parent login is needed.
begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sa uuid:=gen_random_uuid();fa uuid;fb uuid;
 ca uuid:=gen_random_uuid();sibling uuid:=gen_random_uuid();other uuid:=gen_random_uuid();
 ra uuid:=gen_random_uuid();rs uuid:=gen_random_uuid();rb uuid:=gen_random_uuid();new_request uuid:=gen_random_uuid();
 unlock text:=encode(extensions.gen_random_bytes(32),'hex');t1 text;t2 text;t3 text;view_data jsonb;before_count bigint;
 treasure uuid;price integer;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(sa,a);
 select id into fa from public.families where owner_id=a;
 if fa is null then insert into public.families(owner_id) values(a) returning id into fa;end if;
 select id into fb from public.families where owner_id=b;
 if fb is null then insert into public.families(owner_id) values(b) returning id into fb;end if;
 insert into public.child_profiles(id,family_id,nickname) values(ca,fa,'Child scope A'),(sibling,fa,'Sibling scope'),(other,fb,'Other family scope');
 insert into public.fairy_wallets(child_id,balance) values(ca,100),(sibling,200),(other,300)
 on conflict(child_id) do update set balance=excluded.balance;
 select id,fairy_price into treasure,price from public.treasures where shop_key=1 and is_active;
 if treasure is null then raise exception 'Expected active catalog item 1';end if;
 insert into public.treasure_requests(id,child_id,treasure_id,status,price_at_request)
 values(ra,ca,treasure,'pending',price),(rs,sibling,treasure,'pending',price),(rb,other,treasure,'pending',price);
 if to_regclass('private.fairybucks_privacy_release') is not null
 and to_regclass('private.fairybucks_parent_consents') is not null then
  update private.fairybucks_privacy_release set notice_ready=true;
  insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at,verified_at,method,evidence_ref,reviewer)
  select a,notice_version,notice_hash,'verified',now(),now(),'signed_form','SYNTHETIC-CHILD-CHECK','Rollback fixture'
  from private.fairybucks_privacy_release;
 end if;
 insert into private.fairybucks_parent_unlocks(parent_id,session_id,token_hash,expires_at)
 values(a,sa,extensions.digest(unlock,'sha256'),clock_timestamp()+interval '5 minutes');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_start_child_session(ca,null) is not null then raise exception 'Child mode started without PIN';end if;
 if public.fairybucks_start_child_session(ca,repeat('0',64)) is not null then raise exception 'Wrong PIN token started child mode';end if;
 begin perform public.fairybucks_start_child_session(other,unlock);raise exception 'Parent opened another family child';exception when insufficient_privilege then null;end;
 t1:=public.fairybucks_start_child_session(ca,unlock);
 if t1 is null or t1 !~ '^[0-9a-f]{64}$' then raise exception 'Valid handoff did not return a scoped token';end if;
 if public.fairybucks_start_child_session(sibling,unlock) is not null then raise exception 'Handoff did not consume parent unlock';end if;
 perform set_config('role','none',true);
 if not exists(select 1 from private.fairybucks_child_sessions where child_id=ca and token_hash=extensions.digest(t1,'sha256')
 and expires_at between clock_timestamp()+interval '59 minutes' and clock_timestamp()+interval '61 minutes') then raise exception 'Child token hash or expiry is wrong';end if;
 -- Child requests intentionally use no parent login or Authorization.
 perform set_config('request.jwt.claims','{}',true);perform set_config('role','anon',true);
 view_data:=public.fairybucks_child_action(t1);
 if view_data->>'status' is distinct from 'active' or view_data->>'nickname' is distinct from 'Child scope A'
 or (view_data->>'balance')::int is distinct from 100 or jsonb_array_length(view_data->'requests')<>1
 or view_data->'requests'->0->>'id' is distinct from ra::text then raise exception 'Child saw sibling or other-family data';end if;
 if exists(select 1 from jsonb_object_keys(view_data) k where k not in('status','nickname','balance','tooth_count','catalog','requests'))
 or view_data::text ~* 'amazon|a[.]co|USD|purchase_url|price_cents|parent_id|email|unlock_token' then raise exception 'Child payload exposed parent or sourcing details';end if;
 if public.fairybucks_child_action(t1,'cancel',rs)->>'status' is distinct from 'already_decided'
 or public.fairybucks_child_action(t1,'cancel',rb)->>'status' is distinct from 'already_decided' then raise exception 'Child cancelled someone else request';end if;
 begin perform public.fairybucks_child_action(t1,'approved',ra);raise exception 'Child action approved a request';exception when invalid_parameter_value then null;end;
 begin perform public.fairybucks_parent_purchase(ca,ra,unlock);raise exception 'Child accessed purchase details';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_explorer_summary(sibling);raise exception 'Child called parent wallet reader';exception when insufficient_privilege then null;end;
 begin perform 1 from public.fairybucks_list_treasure_requests(sibling);raise exception 'Child called parent request reader';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_parent_pin('123456',false);raise exception 'Child called parent PIN checker';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_delete_account('DELETE',unlock,a);raise exception 'Child called account deletion';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_decide_treasure(ca,ra,'approved',unlock);raise exception 'Child approved treasure';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_update_delivery(ca,ra,'refunded','workshop',unlock);raise exception 'Child refunded treasure';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_record_tooth(ca,gen_random_uuid(),current_date,unlock);raise exception 'Child credited a tooth';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_tooth_reward(ca,unlock,100);raise exception 'Child changed tooth reward';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_undo_tooth(ca,gen_random_uuid(),unlock);raise exception 'Child corrected tooth history';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_edit_explorer(ca,'Changed',null,'boy',a,'{}');raise exception 'Child edited a profile';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_start_child_session(sibling,unlock);raise exception 'Child switched to a sibling session';exception when insufficient_privilege then null;end;
 begin perform 1 from private.fairybucks_child_sessions;raise exception 'Child read stored session hashes';exception when insufficient_privilege then null;end;
 begin perform 1 from private.fairybucks_purchase_options;raise exception 'Child read private purchase table';exception when insufficient_privilege then null;end;
 if public.fairybucks_child_action(null)->>'status' is distinct from 'expired'
 or public.fairybucks_child_action('malformed')->>'status' is distinct from 'expired'
 or public.fairybucks_child_action(repeat('0',64))->>'status' is distinct from 'expired' then raise exception 'Missing/malformed/unknown child token accepted';end if;
 -- A second parent-approved handoff replaces this explorer's first token.
 perform set_config('role','none',true);
 insert into private.fairybucks_parent_unlocks(parent_id,session_id,token_hash,expires_at)
 values(a,sa,extensions.digest(unlock,'sha256'),clock_timestamp()+interval '5 minutes');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 t2:=public.fairybucks_start_child_session(ca,unlock);
 if t2 is null or t2=t1 then raise exception 'New handoff did not rotate child token';end if;
 perform set_config('role','none',true);select count(*) into before_count from public.treasure_requests where child_id=ca;
 perform set_config('request.jwt.claims','{}',true);perform set_config('role','anon',true);
 if public.fairybucks_child_action(t1)->>'status' is distinct from 'expired'
 or public.fairybucks_child_action(t1,'cancel',ra)->>'status' is distinct from 'expired'
 or public.fairybucks_child_action(t1,'request',new_request,1,price)->>'status' is distinct from 'expired' then raise exception 'Replaced token retained access';end if;
 if public.fairybucks_child_action(t2)->>'status' is distinct from 'active' then raise exception 'New token failed';end if;
 perform set_config('role','none',true);
 update private.fairybucks_child_sessions set expires_at=clock_timestamp()-interval '1 second' where child_id=ca;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(t2)->>'status' is distinct from 'expired'
 or public.fairybucks_child_action(t2,'cancel',ra)->>'status' is distinct from 'expired'
 or public.fairybucks_child_action(t2,'request',new_request,1,price)->>'status' is distinct from 'expired' then raise exception 'Expired child session still read or wrote';end if;
 perform set_config('role','none',true);
 if (select count(*) from public.treasure_requests where child_id=ca)<>before_count
 or exists(select 1 from public.treasure_requests where id in(ra,rs,rb) and status<>'pending')
 or exists(select 1 from public.fairy_transactions where child_id in(ca,sibling,other)) then raise exception 'Blocked child actions changed records';end if;
 -- Ending a newly opened session is idempotent and leaves no usable token.
 insert into private.fairybucks_parent_unlocks(parent_id,session_id,token_hash,expires_at)
 values(a,sa,extensions.digest(unlock,'sha256'),clock_timestamp()+interval '5 minutes');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 t3:=public.fairybucks_start_child_session(ca,unlock);
 perform set_config('request.jwt.claims','{}',true);perform set_config('role','anon',true);
 if public.fairybucks_child_action(t3,'end')->>'status' is distinct from 'ended'
 or public.fairybucks_child_action(t3,'end')->>'status' is distinct from 'ended'
 or public.fairybucks_child_action(t3)->>'status' is distinct from 'expired' then raise exception 'Ended child session retained access';end if;
 perform set_config('role','none',true);
 if exists(select 1 from private.fairybucks_child_sessions where child_id=ca)
 or (select balance from public.fairy_wallets where child_id=sibling) is distinct from 200
 or (select balance from public.fairy_wallets where child_id=other) is distinct from 300 then raise exception 'Child session ending changed another explorer';end if;
end $$;
select 'PASS: scoped child data, parent-only actions, consumed unlock, token rotation, expiry and session ending.' as result;
rollback;
