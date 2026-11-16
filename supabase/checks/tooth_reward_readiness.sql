-- Existing reward/PIN migrations only. No privacy-table dependency.
-- Random, disposable fixtures; all changes roll back.
begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sa uuid:=gen_random_uuid();sb uuid:=gen_random_uuid();fa uuid;fb uuid;
 c1 uuid:=gen_random_uuid();c2 uuid:=gen_random_uuid();other uuid:=gen_random_uuid();t1 uuid:=gen_random_uuid();t2 uuid:=gen_random_uuid();t3 uuid:=gen_random_uuid();
 unlock text:=encode(extensions.gen_random_bytes(32),'hex');bad text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 select id into fa from public.families where owner_id=a;
 if fa is null then insert into public.families(owner_id) values(a) returning id into fa;end if;
 select id into fb from public.families where owner_id=b;
 if fb is null then insert into public.families(owner_id) values(b) returning id into fb;end if;
 insert into public.child_profiles(id,family_id,nickname) values(c1,fa,'Reward check A'),(c2,fa,'Reward check B'),(other,fb,'Other family');
 if exists(select 1 from public.fairy_wallets where child_id in(c1,c2,other) and balance<>0) then raise exception 'New explorer received a welcome balance';end if;
 insert into private.fairybucks_parent_unlocks(parent_id,session_id,token_hash,expires_at)
 values(a,sa,extensions.digest(unlock,'sha256'),clock_timestamp()+interval '5 minutes');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 if (public.fairybucks_tooth_reward(c1,unlock)->>'amount')::int<>5 then raise exception 'Default reward is not 5';end if;
 if public.fairybucks_tooth_reward(c1,bad,3)->>'status'<>'unlock_required' then raise exception 'Wrong PIN token accepted';end if;
 if public.fairybucks_tooth_reward(c1,unlock,0)->>'status'<>'invalid_amount' or public.fairybucks_tooth_reward(c1,unlock,101)->>'status'<>'invalid_amount' then raise exception 'Out-of-range reward accepted';end if;
 perform public.fairybucks_tooth_reward(c1,unlock,1);
 if public.fairybucks_record_tooth(c1,t1,current_date,unlock)<>'saved' then raise exception 'One-buck tooth failed';end if;
 perform public.fairybucks_tooth_reward(c2,unlock,100);
 if (public.fairybucks_tooth_reward(c1,unlock)->>'amount')::int<>100 then raise exception 'Setting is not shared within family';end if;
 perform public.fairybucks_record_tooth(c1,t2,current_date,unlock);
 perform public.fairybucks_record_tooth(c2,t3,current_date,unlock);
 perform public.fairybucks_tooth_reward(c1,unlock,3);
 if public.fairybucks_record_tooth(c1,t1,current_date,unlock)<>'saved' then raise exception 'Retry failed after reward changed';end if;
 if public.fairybucks_undo_tooth(c1,t2,unlock)<>'undone' or public.fairybucks_undo_tooth(c1,t2,unlock)<>'undone' then raise exception 'Correction/retry failed';end if;
 if public.fairybucks_record_tooth(c1,t2,current_date,unlock)<>'corrected' then raise exception 'Corrected tooth was re-awarded';end if;
 begin perform public.fairybucks_record_tooth(c2,t1,current_date,unlock);raise exception 'Request ID reused for another explorer';exception when unique_violation then null;end;
 begin perform public.fairybucks_record_tooth(c1,gen_random_uuid(),current_date+2,unlock);raise exception 'Invalid date accepted';exception when invalid_parameter_value then null;end;
 begin perform public.fairybucks_record_tooth(other,gen_random_uuid(),current_date,unlock);raise exception 'Other family credited';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_undo_tooth(other,t3,unlock);raise exception 'Other family corrected';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_tooth_reward(other,unlock,9);raise exception 'Other family setting changed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c1)<>1 or (select balance from public.fairy_wallets where child_id=c2)<>100 then raise exception 'Wrong original-amount correction or explorer balance';end if;
 if (select count(*) from public.lost_teeth where child_id=c1 and corrected_at is null)<>1 or (select count(*) from public.lost_teeth where child_id=c2 and corrected_at is null)<>1 then raise exception 'Wrong tooth count';end if;
 if (select count(*) from public.fairy_transactions where child_id=c1 and amount=-100)<>1 or (select amount from public.fairy_transactions where id=t1)<>1 or (select amount from public.fairy_transactions where id=t2)<>100 then raise exception 'History or retry changed original awards';end if;
 -- Simulate a spent reward without changing production data.
 update public.fairy_wallets set balance=0 where child_id=c2;
 perform set_config('role','authenticated',true);
 if public.fairybucks_undo_tooth(c2,t3,unlock)<>'insufficient_balance' then raise exception 'Correction allowed a negative balance';end if;
 perform set_config('role','none',true);
 if exists(select 1 from public.lost_teeth where id=t3 and corrected_at is not null) then raise exception 'Failed correction changed tooth';end if;
 if exists(select 1 from public.fairy_transactions where child_id=c2 and amount<0) then raise exception 'Failed correction wrote a debit';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb)::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_tooth_reward(other,unlock,9)->>'status'<>'unlock_required' then raise exception 'Parent A token usable by B';end if;
 perform set_config('role','none',true);
 if exists(select 1 from private.fairybucks_tooth_rewards where parent_id=b) then raise exception 'Family B setting changed';end if;
 update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()-interval '1 second' where parent_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_record_tooth(c1,gen_random_uuid(),current_date,unlock)<>'unlock_required' or public.fairybucks_undo_tooth(c1,t1,unlock)<>'unlock_required' or public.fairybucks_tooth_reward(c1,unlock,9)->>'status'<>'unlock_required' then raise exception 'Expired PIN accepted';end if;
 perform set_config('role','anon',true);
 begin perform public.fairybucks_record_tooth(c1,gen_random_uuid(),current_date,unlock);raise exception 'Anonymous tooth write allowed';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_undo_tooth(c1,t1,unlock);raise exception 'Anonymous correction allowed';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_tooth_reward(c1,unlock,9);raise exception 'Anonymous reward change allowed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;perform set_config('role','authenticated',true);
 begin perform public.fairybucks_record_tooth(c1,gen_random_uuid(),current_date,unlock);raise exception 'Ended sign-in allowed tooth write';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
end $$;
select 'PASS: no welcome balance, 1–100 rewards, separate explorers, original corrections, retries and family/PIN/session protection.' as result;
rollback;
