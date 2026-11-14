-- Separate rollback-only check. Uses newly generated disposable users, never existing parents.
begin;
do $$
declare
 parent_a uuid:=gen_random_uuid(); parent_b uuid:=gen_random_uuid(); parent_empty uuid:=gen_random_uuid();
 session_a uuid:=gen_random_uuid(); session_b uuid:=gen_random_uuid(); session_empty uuid:=gen_random_uuid();
 family_a uuid:=gen_random_uuid(); family_b uuid:=gen_random_uuid();
 child_a uuid:=gen_random_uuid(); child_b uuid:=gen_random_uuid();
 child_token text:=encode(extensions.gen_random_bytes(32),'hex');
 unlock_a text; claims jsonb; result jsonb; proof bigint:=floor(extract(epoch from clock_timestamp()));
begin
 insert into auth.users(id,email,email_confirmed_at) values
 (parent_a,parent_a::text||'@example.test',now()),(parent_b,parent_b::text||'@example.test',now()),
 (parent_empty,parent_empty::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(session_a,parent_a),(session_b,parent_b),(session_empty,parent_empty);
 -- Some installations create families via a signup trigger. Reuse their rows if present.
 select id into family_a from public.families where owner_id=parent_a limit 1;
 if family_a is null then family_a:=gen_random_uuid();insert into public.families(id,owner_id) values(family_a,parent_a);end if;
 select id into family_b from public.families where owner_id=parent_b limit 1;
 if family_b is null then family_b:=gen_random_uuid();insert into public.families(id,owner_id) values(family_b,parent_b);end if;
 insert into public.child_profiles(id,family_id,nickname) values(child_a,family_a,'Disposable deletion A'),(child_b,family_b,'Disposable deletion B');
 insert into public.fairy_wallets(child_id,balance) values(child_a,31),(child_b,47);
 insert into public.fairy_transactions(child_id,amount,description) values(child_a,31,'Deletion fixture'),(child_b,47,'Isolation fixture');
 insert into public.lost_teeth(child_id,lost_on) values(child_a,current_date),(child_b,current_date);
 insert into public.treasure_requests(id,child_id,treasure_id,status,price_at_request)
 values(gen_random_uuid(),child_a,(select id from public.treasures where shop_key=14),'pending',11);
 insert into private.parent_pin_security(parent_id,pin_hash) values(parent_a,extensions.crypt('111111',extensions.gen_salt('bf',4)));
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at)
 values(child_a,extensions.digest(child_token,'sha256'),now()+interval '1 hour'),
 (child_b,extensions.digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour');
 insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent_a,7);
 insert into private.fairybucks_parent_guides(parent_id,completed_version) values(parent_a,1);
 insert into private.fairybucks_pin_recoveries(parent_id,verified_at) values(parent_a,proof);
 claims:=jsonb_build_object('sub',parent_a,'session_id',session_a,
 'amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',proof)));
 perform set_config('request.jwt.claims',claims::text,true);perform set_config('role','authenticated',true);
 result:=public.fairybucks_delete_account();
 if result->>'status'<>'ready' or result->>'requires_pin'<>'true' or jsonb_array_length(result->'child_ids')<>1
 then raise exception 'Deletion review incorrect';end if;
 if public.fairybucks_delete_account('WRONG')->>'status'<>'confirmation_required' then raise exception 'Confirmation bypassed';end if;
 if public.fairybucks_delete_account('DELETE')->>'status'<>'unlock_required' then raise exception 'PIN bypassed';end if;
 if public.fairybucks_delete_account('DELETE',repeat('0',64))->>'status'<>'unlock_required' then raise exception 'Forged unlock accepted';end if;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',proof-601))))::text,true);
 if public.fairybucks_delete_account('DELETE')->>'status'<>'reauth_required' then raise exception 'Stale sign-in accepted';end if;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',proof+120))))::text,true);
 if public.fairybucks_delete_account('DELETE')->>'status'<>'reauth_required' then raise exception 'Future sign-in accepted';end if;
 perform set_config('request.jwt.claims',(claims-'amr'||jsonb_build_object('user_metadata',jsonb_build_object('amr',claims->'amr')))::text,true);
 if public.fairybucks_delete_account('DELETE')->>'status'<>'reauth_required' then raise exception 'Editable metadata trusted';end if;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('session_id',session_b))::text,true);
 begin perform public.fairybucks_delete_account('DELETE');raise exception 'Wrong session accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims',claims::text,true);
 begin perform public.fairybucks_delete_account('DELETE',null,parent_b);raise exception 'Other account targeted';exception when insufficient_privilege then null;end;
 perform set_config('role','anon',true);
 begin perform public.fairybucks_delete_account('DELETE');raise exception 'Anonymous deletion accepted';exception when insufficient_privilege then null;end;
 perform set_config('role','authenticated',true);
 unlock_a:=public.fairybucks_parent_pin('111111',false)->>'token';
 if unlock_a is null then raise exception 'Fixture PIN failed';end if;
 -- Simulate an unexpected foreign-key dependency: failure must preserve the WHOLE account.
 perform set_config('role','none',true);
 create table private.fairybucks_deletion_check_guard(parent_id uuid references auth.users(id));
 insert into private.fairybucks_deletion_check_guard values(parent_a);
 perform set_config('role','authenticated',true);
 begin
  perform public.fairybucks_delete_account('DELETE',unlock_a,parent_a);
  raise exception 'Unexpected dependency was ignored';
 exception when foreign_key_violation then null;end;
 perform set_config('role','none',true);
 if not exists(select 1 from public.fairy_wallets where child_id=child_a and balance=31)
 or not exists(select 1 from auth.sessions where id=session_a)
 or not exists(select 1 from private.fairybucks_child_sessions where child_id=child_a)
 then raise exception 'Failed deletion left partial changes';end if;
 delete from private.fairybucks_deletion_check_guard;
 perform set_config('role','authenticated',true);
 if public.fairybucks_delete_account('DELETE',unlock_a,parent_a)->>'status'<>'deleted' then raise exception 'Deletion failed';end if;
 -- Old parent and child tokens lose access immediately because their database rows are gone.
 begin perform public.fairybucks_parent_guide();raise exception 'Deleted parent session accepted';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_delete_account('DELETE',unlock_a,parent_a);raise exception 'Deletion replay accepted';exception when insufficient_privilege then null;end;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(child_token,'view')->>'status'<>'expired' then raise exception 'Deleted child token accepted';end if;
 perform set_config('role','none',true);
 if exists(select 1 from auth.users where id=parent_a) or exists(select 1 from auth.sessions where user_id=parent_a)
 or exists(select 1 from public.families where owner_id=parent_a) or exists(select 1 from public.child_profiles where id=child_a)
 or exists(select 1 from public.fairy_wallets where child_id=child_a) or exists(select 1 from public.fairy_transactions where child_id=child_a)
 or exists(select 1 from public.lost_teeth where child_id=child_a) or exists(select 1 from public.treasure_requests where child_id=child_a)
 or exists(select 1 from private.parent_pin_security where parent_id=parent_a) or exists(select 1 from private.fairybucks_parent_unlocks where parent_id=parent_a)
 or exists(select 1 from private.fairybucks_tooth_rewards where parent_id=parent_a) or exists(select 1 from private.fairybucks_parent_guides where parent_id=parent_a)
 or exists(select 1 from private.fairybucks_pin_recoveries where parent_id=parent_a) then raise exception 'Family data remained';end if;
 if not exists(select 1 from auth.users where id=parent_b) or not exists(select 1 from auth.sessions where id=session_b)
 or not exists(select 1 from public.fairy_wallets where child_id=child_b and balance=47)
 or not exists(select 1 from private.fairybucks_child_sessions where child_id=child_b)
 then raise exception 'Other family changed';end if;
 -- A parent who has not created a vault/PIN can still delete their empty account.
 claims:=jsonb_build_object('sub',parent_empty,'session_id',session_empty,
 'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',proof)));
 perform set_config('request.jwt.claims',claims::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_delete_account()->>'requires_pin'<>'false' then raise exception 'Empty account unexpectedly requires PIN';end if;
 if public.fairybucks_delete_account('DELETE',null,parent_empty)->>'status'<>'deleted' then raise exception 'Empty-account deletion failed';end if;
 perform set_config('role','none',true);
end $$;
select 'PASS: account deletion authorization, atomic cleanup, stale-token denial and family isolation.' as result;
rollback;
