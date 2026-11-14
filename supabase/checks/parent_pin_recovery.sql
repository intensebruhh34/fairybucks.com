-- Run separately after the migration. Everything below rolls back, including temporary PINs.
begin;
do $$
declare
 parent_a uuid := '44a684ee-6e65-4098-80d7-3a21c3e2bcb4';
 parent_b uuid := '0ad4c55a-d913-4ccf-8dca-954bbe8acd94';
 session_a uuid := gen_random_uuid(); session_b uuid := gen_random_uuid();
 child_a uuid := gen_random_uuid(); child_b uuid := gen_random_uuid();
 email_a text; email_b text; claims jsonb; proof bigint := floor(extract(epoch from clock_timestamp()));
 result jsonb; previous_token text; new_token text; total_before bigint;
begin
 select email into email_a from auth.users where id=parent_a and email_confirmed_at is not null;
 select email into email_b from auth.users where id=parent_b and email_confirmed_at is not null;
 if email_a is null or email_b is null then raise exception 'Both test parents must have confirmed email addresses'; end if;
 insert into auth.sessions(id,user_id) values(session_a,parent_a),(session_b,parent_b);
 insert into public.child_profiles(id,family_id,nickname)
 select child_a,id,'PIN recovery check A' from public.families where owner_id=parent_a;
 insert into public.child_profiles(id,family_id,nickname)
 select child_b,id,'PIN recovery check B' from public.families where owner_id=parent_b;
 if not exists(select 1 from public.child_profiles where id=child_a) or not exists(select 1 from public.child_profiles where id=child_b)
 then raise exception 'Both test parents need an existing Family Vault'; end if;
 insert into public.fairy_wallets(child_id,balance) values(child_a,42),(child_b,17);
 select sum(balance) into total_before from public.fairy_wallets;
 insert into private.parent_pin_security(parent_id,pin_hash) values(parent_a,extensions.crypt('111111',extensions.gen_salt('bf',4)))
 on conflict(parent_id) do update set pin_hash=excluded.pin_hash,failed_attempts=0,locked_until=null;
 insert into private.parent_pin_security(parent_id,pin_hash) values(parent_b,extensions.crypt('333333',extensions.gen_salt('bf',4)))
 on conflict(parent_id) do update set pin_hash=excluded.pin_hash,failed_attempts=0,locked_until=null;
 delete from private.fairybucks_pin_recoveries where parent_id in(parent_a,parent_b);
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at) values
 (child_a,extensions.digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour'),
 (child_b,extensions.digest(gen_random_uuid()::text,'sha256'),now()+interval '1 hour');
 claims:=jsonb_build_object('sub',parent_a,'session_id',session_a,'email',email_a,'app_metadata',jsonb_build_object('provider','email'));
 perform set_config('request.jwt.claims',claims::text,true);
 perform set_config('role','authenticated',true);
 previous_token:=public.fairybucks_parent_pin('111111',false)->>'token';
 if previous_token is null then raise exception 'Fixture unlock failed'; end if;
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Missing proof accepted'; end if;
 claims:=claims||jsonb_build_object('user_metadata',jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',proof))));
 perform set_config('request.jwt.claims',claims::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Editable metadata trusted'; end if;
 claims:=claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','password','timestamp',proof)));
 perform set_config('request.jwt.claims',claims::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Password sign-in accepted'; end if;
 claims:=claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',proof-601)));
 perform set_config('request.jwt.claims',claims::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Expired proof accepted'; end if;
 claims:=claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',proof+120)));
 perform set_config('request.jwt.claims',claims::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Future proof accepted'; end if;
 claims:=claims||jsonb_build_object('amr',jsonb_build_array(jsonb_build_object('method','magiclink','timestamp',proof)));
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('session_id',session_b))::text,true);
 begin
  perform public.fairybucks_recover_parent_pin('222222'); raise exception 'Wrong-user session accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('session_id',gen_random_uuid()))::text,true);
 begin
  perform public.fairybucks_recover_parent_pin('222222'); raise exception 'Missing session accepted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('email',email_b))::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Wrong email accepted'; end if;
 perform set_config('request.jwt.claims',(claims||jsonb_build_object('app_metadata',jsonb_build_object('provider','phone')))::text,true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'email_required' then raise exception 'Phone provider accepted'; end if;
 perform set_config('request.jwt.claims',claims::text,true);
 begin
  perform public.fairybucks_recover_parent_pin('222222',parent_b); raise exception 'Account switch accepted';
 exception when insufficient_privilege then null; end;
 if public.fairybucks_recover_parent_pin()->>'status'<>'ready' then raise exception 'Fresh magic link rejected'; end if;
 if public.fairybucks_recover_parent_pin('123')->>'status'<>'invalid_pin' then raise exception 'Invalid PIN accepted'; end if;
 perform set_config('role','none',true);
 update private.parent_pin_security set failed_attempts=5,locked_until=now()+interval '15 minutes' where parent_id=parent_a;
 perform set_config('role','authenticated',true);
 if public.fairybucks_recover_parent_pin('222222')->>'status'<>'saved' then raise exception 'Verified reset failed'; end if;
 if public.fairybucks_parent_pin('111111',false)->>'status'<>'incorrect_pin' then raise exception 'Old PIN still accepted'; end if;
 result:=public.fairybucks_parent_pin('222222',false);new_token:=result->>'token';
 if result->>'status'<>'unlocked' then raise exception 'New PIN failed or lockout was not cleared'; end if;
 if public.fairybucks_recover_parent_pin('444444')->>'status'<>'email_used' then raise exception 'Email proof replay accepted'; end if;
 if public.fairybucks_tooth_reward(child_a,previous_token)->>'status'<>'unlock_required' then raise exception 'Old unlock survived'; end if;
 if public.fairybucks_tooth_reward(child_a,new_token)->>'status'<>'saved' then raise exception 'New unlock unavailable'; end if;
 begin
  perform 1 from private.fairybucks_pin_recoveries; raise exception 'Direct recovery-table access allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('role','anon',true);
 begin
  perform public.fairybucks_recover_parent_pin('222222'); raise exception 'Anonymous reset allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('role','none',true);
 if exists(select 1 from private.fairybucks_child_sessions where child_id=child_a) then raise exception 'Child session survived reset'; end if;
 if not exists(select 1 from private.fairybucks_child_sessions where child_id=child_b) then raise exception 'Other family child session revoked'; end if;
 if extensions.crypt('333333',(select pin_hash from private.parent_pin_security where parent_id=parent_b))
 is distinct from (select pin_hash from private.parent_pin_security where parent_id=parent_b) then raise exception 'Other parent PIN changed'; end if;
 if (select sum(balance) from public.fairy_wallets) is distinct from total_before then raise exception 'Balances changed'; end if;
 if exists(select 1 from public.lost_teeth where child_id=child_a) or exists(select 1 from public.treasure_requests where child_id=child_a)
 then raise exception 'Recovery created tooth/request records'; end if;
 -- Also support Supabase's email OTP AMR variant, with a separate parent's proof.
 claims:=jsonb_build_object('sub',parent_b,'session_id',session_b,'email',email_b,'app_metadata',jsonb_build_object('provider','email'),
 'amr',jsonb_build_array(jsonb_build_object('method','otp','timestamp',proof)));
 perform set_config('request.jwt.claims',claims::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_recover_parent_pin('555555')->>'status'<>'saved' then raise exception 'Email OTP proof rejected'; end if;
 perform set_config('role','none',true);
end $$;
select 'PASS: fresh email proof, single use, lockout recovery, PIN replacement, session revocation and family isolation.' as result;
rollback;
