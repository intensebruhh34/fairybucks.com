-- Step 4 readiness check. Run as ONE separate Supabase SQL Editor query.
-- Uses random disposable accounts, explorers and catalog items. Everything rolls back.
-- Supports databases both with and without the staged consent tables.
begin;
do $$
declare
 a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();sa uuid:=gen_random_uuid();sb uuid:=gen_random_uuid();fa uuid;fb uuid;
 c1 uuid:=gen_random_uuid();c2 uuid:=gen_random_uuid();other uuid:=gen_random_uuid();
 ta uuid:=gen_random_uuid();tb uuid:=gen_random_uuid();ka integer;kb integer;
 r1 uuid:=gen_random_uuid();r2 uuid:=gen_random_uuid();r3 uuid:=gen_random_uuid();r4 uuid:=gen_random_uuid();r5 uuid:=gen_random_uuid();
 unlock_a text:=encode(extensions.gen_random_bytes(32),'hex');unlock_b text:=encode(extensions.gen_random_bytes(32),'hex');
 child_a text:=encode(extensions.gen_random_bytes(32),'hex');result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(sa,a),(sb,b);
 select id into fa from public.families where owner_id=a;
 if fa is null then insert into public.families(owner_id) values(a) returning id into fa;end if;
 select id into fb from public.families where owner_id=b;
 if fb is null then insert into public.families(owner_id) values(b) returning id into fb;end if;
 insert into public.child_profiles(id,family_id,nickname) values(c1,fa,'Treasure check A'),(c2,fa,'Treasure check B'),(other,fb,'Other family');
 insert into public.fairy_wallets(child_id,balance) values(c1,7),(c2,50),(other,50)
 on conflict(child_id) do update set balance=excluded.balance;
 select coalesce(max(shop_key),0)+1 into ka from public.treasures;kb:=ka+1;
 insert into public.treasures(id,shop_key,name,category,fairy_price,is_active)
 values(ta,ka,'Rollback treasure A','Learning',7,true),(tb,kb,'Rollback treasure B','Learning',11,true);
 insert into private.fairybucks_parent_unlocks(parent_id,session_id,token_hash,expires_at)
 values(a,sa,extensions.digest(unlock_a,'sha256'),clock_timestamp()+interval '5 minutes'),
       (b,sb,extensions.digest(unlock_b,'sha256'),clock_timestamp()+interval '5 minutes');
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at)
 values(c1,extensions.digest(child_a,'sha256'),clock_timestamp()+interval '1 hour');
 -- Only synthetic-account permission fixtures; no launch flags are enabled.
 if to_regclass('private.fairybucks_privacy_release') is not null
 and to_regclass('private.fairybucks_parent_consents') is not null then
  update private.fairybucks_privacy_release set notice_ready=true;
  insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at,verified_at,method,evidence_ref,reviewer)
  select a,notice_version,notice_hash,'verified',now(),now(),'signed_form','SYNTHETIC-TREASURE-CHECK','Rollback fixture'
  from private.fairybucks_privacy_release;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);
 perform set_config('role','authenticated',true);
 if public.fairybucks_submit_treasure(c1,r1,ka,99) is distinct from 'price_changed' then raise exception 'Stale price accepted';end if;
 if public.fairybucks_submit_treasure(c1,r1,ka,7) is distinct from 'requested' then raise exception 'Request failed';end if;
 if public.fairybucks_submit_treasure(c1,r1,ka,7) is distinct from 'requested' then raise exception 'Same-ID retry failed';end if;
 if public.fairybucks_submit_treasure(c1,gen_random_uuid(),ka,7) is distinct from 'already_pending' then raise exception 'Duplicate pending item allowed';end if;
 if public.fairybucks_submit_treasure(c1,gen_random_uuid(),kb,11) is distinct from 'insufficient_balance' then raise exception 'Pending reservation ignored';end if;
 if public.fairybucks_decide_treasure(c1,r1,'approved',null) is distinct from 'unlock_required' then raise exception 'Approval without PIN allowed';end if;
 if public.fairybucks_decide_treasure(c1,r1,'declined',null) is distinct from 'unlock_required' then raise exception 'Decline without PIN allowed';end if;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c1) is distinct from 7
 or exists(select 1 from public.fairy_transactions where child_id=c1)
 or (select count(*) from public.treasure_requests where child_id=c1)<>1 then raise exception 'Pending request changed money or duplicated rows';end if;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(child_a,'cancel',r1)->>'status' is distinct from 'cancelled' then raise exception 'Child cancellation failed';end if;
 if public.fairybucks_child_action(child_a,'cancel',r1)->>'status' is distinct from 'cancelled' then raise exception 'Child cancellation retry failed';end if;
 begin perform public.fairybucks_decide_treasure(c1,r1,'approved',unlock_a);raise exception 'Child called parent approval';exception when insufficient_privilege then null;end;
 perform set_config('role','authenticated',true);
 if public.fairybucks_submit_treasure(c1,r2,ka,7) is distinct from 'requested' then raise exception 'Cancellation did not release reservation';end if;
 if public.fairybucks_decide_treasure(c1,r2,'declined',unlock_a) is distinct from 'declined' then raise exception 'Decline failed';end if;
 if public.fairybucks_decide_treasure(c1,r2,'declined',unlock_a) is distinct from 'declined' then raise exception 'Decline retry failed';end if;
 if public.fairybucks_decide_treasure(c1,r2,'approved',unlock_a) is distinct from 'already_decided' then raise exception 'Declined request later approved';end if;
 if public.fairybucks_submit_treasure(c1,r3,ka,7) is distinct from 'requested' then raise exception 'Decline did not release reservation';end if;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c1) is distinct from 7
 or exists(select 1 from public.fairy_transactions where child_id=c1) then raise exception 'Cancellation or decline changed money';end if;
 -- Change only our disposable catalog item. Approval/refund must use its captured cost.
 update public.treasures set fairy_price=9 where id=ta;
 perform set_config('role','authenticated',true);
 if public.fairybucks_decide_treasure(c1,r3,'approved',unlock_a) is distinct from 'approved' then raise exception 'Captured-price approval failed';end if;
 if public.fairybucks_decide_treasure(c1,r3,'approved',unlock_a) is distinct from 'approved' then raise exception 'Approval retry failed';end if;
 if public.fairybucks_decide_treasure(c1,r3,'cancelled') is distinct from 'already_decided' then raise exception 'Approved request cancelled without refund flow';end if;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(child_a,'cancel',r3)->>'status' is distinct from 'already_decided' then raise exception 'Child cancelled approved treasure';end if;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c1) is distinct from 0
 or (select count(*) from public.fairy_transactions where child_id=c1 and amount=-7)<>1
 or (select price_at_request from public.treasure_requests where id=r3) is distinct from 7 then raise exception 'Approval charged twice or used new catalog price';end if;
 perform set_config('role','authenticated',true);
 if public.fairybucks_update_delivery(c1,r3,'packaging','workshop',unlock_a) is distinct from 'saved' then raise exception 'Packaging failed';end if;
 if public.fairybucks_update_delivery(c1,r3,'refunded','workshop',unlock_a) is distinct from 'stage_changed' then raise exception 'Stale refund accepted';end if;
 if public.fairybucks_update_delivery(c1,r3,'refunded','packaging',null) is distinct from 'unlock_required' then raise exception 'Refund without PIN allowed';end if;
 if public.fairybucks_update_delivery(c1,r3,'refunded','packaging',unlock_a) is distinct from 'refunded' then raise exception 'Refund failed';end if;
 if public.fairybucks_update_delivery(c1,r3,'refunded','packaging',unlock_a) is distinct from 'refunded' then raise exception 'Refund retry failed';end if;
 if public.fairybucks_decide_treasure(c1,r3,'approved',unlock_a) is distinct from 'already_decided' then raise exception 'Refunded request re-approved';end if;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c1) is distinct from 7
 or (select count(*) from public.fairy_transactions where child_id=c1 and amount=7)<>1
 or (select balance from public.fairy_wallets where child_id=c2) is distinct from 50 then raise exception 'Refund was wrong, duplicated or crossed explorers';end if;
 -- Sibling request cannot be cancelled by the first child's scoped session.
 perform set_config('role','authenticated',true);
 if public.fairybucks_submit_treasure(c2,r4,ka,9) is distinct from 'requested' then raise exception 'Sibling request failed';end if;
 perform set_config('role','anon',true);
 if public.fairybucks_child_action(child_a,'cancel',r4)->>'status' is distinct from 'already_decided' then raise exception 'Child cancelled sibling request';end if;
 perform set_config('role','authenticated',true);
 if public.fairybucks_decide_treasure(c2,r4,'approved',unlock_a) is distinct from 'approved' then raise exception 'Sibling approval failed';end if;
 if public.fairybucks_update_delivery(c2,r4,'landed','workshop',unlock_a) is distinct from 'invalid_stage' then raise exception 'Tracker skipped stages';end if;
 if public.fairybucks_update_delivery(c2,r4,'packaging','workshop',unlock_a) is distinct from 'saved' then raise exception 'Sibling packaging failed';end if;
 if public.fairybucks_update_delivery(c2,r4,'flying','packaging',unlock_a) is distinct from 'saved' then raise exception 'Flying failed';end if;
 if public.fairybucks_update_delivery(c2,r4,'arriving','flying',unlock_a) is distinct from 'saved' then raise exception 'Arriving failed';end if;
 if public.fairybucks_update_delivery(c2,r4,'landed','arriving',unlock_a) is distinct from 'saved' then raise exception 'Landing failed';end if;
 if public.fairybucks_update_delivery(c2,r4,'refunded','landed',unlock_a) is distinct from 'already_completed' then raise exception 'Landed treasure refunded';end if;
 perform set_config('role','none',true);
 if (select balance from public.fairy_wallets where child_id=c2) is distinct from 41
 or (select count(*) from public.fairy_transactions where child_id=c2)<>1
 or (select status from public.treasure_requests where id=r4) is distinct from 'fulfilled' then raise exception 'Delivery changed money or lost completion';end if;
 -- Insufficient balance and unavailable items must not create pending rows.
 perform set_config('role','authenticated',true);
 if public.fairybucks_submit_treasure(c1,r5,ka,9) is distinct from 'insufficient_balance' then raise exception 'Unaffordable request accepted';end if;
 perform set_config('role','none',true);
 update public.treasures set is_active=false where id=tb;
 perform set_config('role','authenticated',true);
 if public.fairybucks_submit_treasure(c2,r5,kb,11) is distinct from 'unavailable' then raise exception 'Inactive treasure requested';end if;
 -- Another signed-in family must not approve, cancel or refund our requests.
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'session_id',sb)::text,true);
 begin perform public.fairybucks_submit_treasure(c1,gen_random_uuid(),ka,9);raise exception 'Cross-family request allowed';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_decide_treasure(c1,r1,'cancelled');raise exception 'Cross-family cancellation allowed';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_decide_treasure(c1,r3,'approved',unlock_b);raise exception 'Cross-family approval allowed';exception when insufficient_privilege then null;end;
 begin perform public.fairybucks_update_delivery(c1,r3,'refunded','refunded',unlock_b);raise exception 'Cross-family refund allowed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()-interval '1 second' where parent_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',sa)::text,true);perform set_config('role','authenticated',true);
 if public.fairybucks_decide_treasure(c1,r3,'approved',unlock_a) is distinct from 'unlock_required'
 or public.fairybucks_update_delivery(c1,r3,'refunded','refunded',unlock_a) is distinct from 'unlock_required' then raise exception 'Expired PIN allowed money action';end if;
 perform set_config('role','none',true);
 delete from auth.sessions where id=sa;perform set_config('role','authenticated',true);
 begin perform public.fairybucks_submit_treasure(c1,gen_random_uuid(),ka,9);raise exception 'Ended sign-in requested treasure';exception when insufficient_privilege then null;end;
 perform set_config('role','anon',true);
 result:=public.fairybucks_child_action(child_a);
 if result->>'status' is distinct from 'active' or result::text ~* 'amazon|a[.]co|USD|purchase_url'
 or jsonb_array_length(result->'requests')<>3 then raise exception 'Child view leaked sourcing or mixed explorers';end if;
 perform set_config('role','none',true);
 if exists(select 1 from public.treasure_requests where id=r5)
 or (select balance from public.fairy_wallets where child_id=other) is distinct from 50 then raise exception 'Rejected action changed data';end if;
end $$;
select 'PASS: reservations, child cancellation, declines, captured-price approval/refund, retries, delivery and family/PIN/session isolation.' as result;
rollback;
