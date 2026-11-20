-- Synthetic fixtures only. Run this whole script, including ROLLBACK, after installation.
begin;
create table public.fairybucks_delete_check_dependency(child_id uuid references public.child_profiles(id));
do $$
declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();s uuid:=gen_random_uuid();fa uuid;fb uuid;
 c uuid:=gen_random_uuid();sibling uuid:=gen_random_uuid();other uuid:=gen_random_uuid();t uuid;result jsonb;n integer;
begin
 if has_table_privilege('authenticated','public.child_profiles','DELETE')
 or has_table_privilege('anon','public.child_profiles','DELETE') then
  raise exception 'Direct profile DELETE would bypass PIN-confirmed RPC';end if;
 -- Permit synthetic fixture creation without verifying or modifying any real parent's permission.
 if to_regclass('private.fairybucks_privacy_release') is not null then
  update private.fairybucks_privacy_release set enforcement_enabled=false;
 end if;
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@example.test',now()),(b,b::text||'@example.test',now());
 insert into auth.sessions(id,user_id) values(s,a);
 select id into fa from public.families where owner_id=a limit 1;
 if fa is null then insert into public.families(owner_id) values(a) returning id into fa;end if;
 select id into fb from public.families where owner_id=b limit 1;
 if fb is null then insert into public.families(owner_id) values(b) returning id into fb;end if;
 insert into public.child_profiles(id,family_id,nickname,gender) values(c,fa,'Delete me','boy'),(sibling,fa,'Keep me','girl'),(other,fb,'Other family','rather-not-say');
 insert into public.fairy_wallets(child_id,balance) values(c,25),(sibling,40),(other,50) on conflict(child_id) do update set balance=excluded.balance;
 insert into public.lost_teeth(child_id,lost_on) values(c,current_date),(sibling,current_date);
 insert into public.fairy_transactions(child_id,amount,description) values(c,25,'Synthetic reward'),(sibling,40,'Keep reward');
 select id into t from public.treasures where shop_key=1;
 insert into public.treasure_requests(id,child_id,treasure_id,status,price_at_request) values(gen_random_uuid(),c,t,'approved',15),(gen_random_uuid(),sibling,t,'pending',15);
 insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at) values(c,extensions.digest(c::text,'sha256'),now()+interval '1 hour'),(sibling,extensions.digest(sibling::text,'sha256'),now()+interval '1 hour');
 if to_regclass('public.wishlists') is not null then
  execute 'insert into public.wishlists(child_id,treasure_id) values($1,$2)' using c,t;
 end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'session_id',s)::text,true);
 perform set_config('role','authenticated',true);
 if public.fairybucks_delete_explorer(c,a)->>'status'<>'setup_required' then raise exception 'Missing PIN setup was not blocked';end if;
 if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456')->>'status'<>'setup_required' then raise exception 'Deletion without existing PIN accepted';end if;
 perform set_config('role','none',true);
 insert into private.parent_pin_security(parent_id,pin_hash) values(a,extensions.crypt('123456',extensions.gen_salt('bf',4)));
 perform set_config('role','authenticated',true);
 result:=public.fairybucks_delete_explorer(c,a);
 if result->>'status'<>'ready' or result->'profile'->>'id'<>c::text then raise exception 'Review failed';end if;
 if public.fairybucks_delete_explorer(other,a)->>'status'<>'unavailable' then raise exception 'Other family review exposed';end if;
 begin perform public.fairybucks_delete_explorer(c,b);raise exception 'Wrong current parent accepted';exception when insufficient_privilege then null;end;
 if public.fairybucks_delete_explorer(c,a,'Delete me','delete','123456')->>'status'<>'confirmation_required' then raise exception 'Confirmation bypass';end if;
 if public.fairybucks_delete_explorer(c,a,'Old name','DELETE','123456')->>'status'<>'changed' then raise exception 'Stale nickname accepted';end if;
 if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE',null)->>'status'<>'invalid_pin' then raise exception 'Missing fresh PIN accepted';end if;
 for n in 1..4 loop
  if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','000000')->>'status'<>'incorrect_pin' then raise exception 'Wrong PIN accepted';end if;
 end loop;
 if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','000000')->>'status'<>'locked' then raise exception 'PIN rate limit missing';end if;
 if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456')->>'status'<>'locked' then raise exception 'Locked PIN bypass';end if;
 perform set_config('role','anon',true);
 begin perform public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456');raise exception 'Anonymous deletion allowed';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);
 if (select failed_attempts from private.parent_pin_security where parent_id=a)<>5 then raise exception 'PIN failure counter rolled back';end if;
 update private.parent_pin_security set failed_attempts=0,locked_until=null where parent_id=a;
 if (select balance from public.fairy_wallets where child_id=c)<>25 then raise exception 'Failed attempt changed balance';end if;
 -- A dependency failure must preserve all records, not partially delete a vault.
 insert into public.fairybucks_delete_check_dependency values(c);
 perform set_config('role','authenticated',true);
 begin perform public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456');raise exception 'Unknown dependency ignored';exception when foreign_key_violation then null;end;
 perform set_config('role','none',true);
 if not exists(select 1 from public.child_profiles where id=c)
 or not exists(select 1 from public.treasure_requests where child_id=c)
 or not exists(select 1 from private.fairybucks_child_sessions where child_id=c)
 or not exists(select 1 from public.fairy_wallets where child_id=c and balance=25) then raise exception 'Dependency failure partially deleted explorer';end if;
 delete from public.fairybucks_delete_check_dependency where child_id=c;
 -- A revoked Auth session is insufficient even when the PIN is correct.
 delete from auth.sessions where id=s;
 perform set_config('role','authenticated',true);
 begin perform public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456');raise exception 'Revoked session accepted';exception when insufficient_privilege then null;end;
 perform set_config('role','none',true);insert into auth.sessions(id,user_id) values(s,a);
 perform set_config('role','authenticated',true);
 result:=public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456');
 if result->>'status'<>'deleted' or result->>'child_id'<>c::text then raise exception 'Deletion failed';end if;
 if public.fairybucks_delete_explorer(c,a,'Delete me','DELETE','123456')->>'status'<>'unavailable' then raise exception 'Retry targeted another explorer';end if;
 perform set_config('role','none',true);
 if exists(select 1 from public.child_profiles where id=c)
 or exists(select 1 from public.fairy_wallets where child_id=c)
 or exists(select 1 from public.fairy_transactions where child_id=c)
 or exists(select 1 from public.lost_teeth where child_id=c)
 or exists(select 1 from public.treasure_requests where child_id=c)
 or exists(select 1 from private.fairybucks_child_sessions where child_id=c)
 or exists(select 1 from private.fairybucks_parent_unlocks where parent_id=a) then raise exception 'Selected records remain';end if;
 if to_regclass('public.wishlists') is not null then
  execute 'select count(*)::int from public.wishlists where child_id=$1' into n using c;
  if n<>0 then raise exception 'Selected wishlist remains';end if;
 end if;
 if not exists(select 1 from public.fairy_wallets where child_id=sibling and balance=40)
 or not exists(select 1 from public.fairy_wallets where child_id=other and balance=50)
 or not exists(select 1 from private.fairybucks_child_sessions where child_id=sibling)
 or not exists(select 1 from public.lost_teeth where child_id=sibling)
 or not exists(select 1 from public.treasure_requests where child_id=sibling)
 or not exists(select 1 from auth.users where id=a)
 or not exists(select 1 from auth.sessions where id=s and user_id=a)
 or not exists(select 1 from private.parent_pin_security where parent_id=a) then raise exception 'Sibling, other family or parent altered';end if;
end $$;
select 'PASS fresh PIN and lockout, exact confirmation, changed name, session/family isolation, atomic explorer deletion and sibling preservation' as result;
rollback;
