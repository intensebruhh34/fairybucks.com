-- Run AFTER the catalog migration, in a separate SQL Editor query.
-- Uses two existing parent accounts. Everything created here is rolled back.
begin;
do $$
declare
  parent_a uuid := '44a684ee-6e65-4098-80d7-3a21c3e2bcb4';
  parent_b uuid := '0ad4c55a-d913-4ccf-8dca-954bbe8acd94';
  session_a uuid;
  explorer uuid := gen_random_uuid();
  request_id uuid := gen_random_uuid();
  unlock text := encode(extensions.gen_random_bytes(32), 'hex');
  child_key text := encode(extensions.gen_random_bytes(32), 'hex');
  result jsonb;
begin
  select id into session_a from auth.sessions where user_id = parent_a order by created_at desc limit 1;
  if session_a is null then raise exception 'Sign in to the first test account, then retry'; end if;
  if parent_a = parent_b or not exists (select 1 from public.families where owner_id = parent_b) then
    raise exception 'Two different parent accounts with Family Vaults are required';
  end if;
  insert into public.child_profiles(id, family_id, nickname)
    select explorer, id, 'Catalog check' from public.families where owner_id = parent_a;
  insert into public.fairy_wallets(child_id, balance) values(explorer, 100);
  insert into public.treasure_requests(id, child_id, treasure_id, status, price_at_request)
    select request_id, explorer, id, 'pending', fairy_price from public.treasures where shop_key = 2;
  insert into private.fairybucks_parent_unlocks(parent_id, session_id, token_hash, expires_at)
    values(parent_a, session_a, extensions.digest(unlock, 'sha256'), clock_timestamp() + interval '5 minutes')
    on conflict(parent_id) do update set session_id = excluded.session_id,
      token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',parent_a,'session_id',session_a)::text, true);
  perform set_config('role', 'authenticated', true);
  if public.fairybucks_update_delivery(explorer,request_id,'packaging','workshop',null) <> 'unlock_required' then raise exception 'Missing PIN accepted'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'packaging','workshop',unlock) <> 'not_approved' then raise exception 'Pending request advanced'; end if;
  if public.fairybucks_decide_treasure(explorer,request_id,'approved',unlock) <> 'approved' then raise exception 'Approval failed'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'landed','workshop',unlock) <> 'invalid_stage' then raise exception 'Skipped stages'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'packaging','workshop',unlock) <> 'saved' then raise exception 'Packaging failed'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'packaging','workshop',unlock) <> 'saved' then raise exception 'Retry failed'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'refunded','workshop',unlock) <> 'stage_changed' then raise exception 'Stale refund accepted'; end if;
  perform set_config('role','none',true);
  update public.child_profiles set family_id=(select id from families where owner_id=parent_b) where id=explorer;
  perform set_config('role','authenticated',true);
  begin
    perform public.fairybucks_update_delivery(explorer,request_id,'flying','packaging',unlock);
    raise exception 'Cross family update accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('role','none',true);
  update public.child_profiles set family_id=(select id from families where owner_id=parent_a) where id=explorer;
  update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()-interval '1 second' where parent_id=parent_a;
  perform set_config('role','authenticated',true);
  if public.fairybucks_update_delivery(explorer,request_id,'refunded','packaging',unlock) <> 'unlock_required' then raise exception 'Expired PIN accepted'; end if;
  perform set_config('role','none',true);
  update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()+interval '5 minutes' where parent_id=parent_a;
  perform set_config('role','authenticated',true);
  if public.fairybucks_update_delivery(explorer,request_id,'refunded','packaging',unlock) <> 'refunded' then raise exception 'Refund failed'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'refunded','packaging',unlock) <> 'refunded' then raise exception 'Refund retry failed'; end if;
  perform set_config('role','none',true);
  if (select balance from fairy_wallets where child_id=explorer) <> 100 then raise exception 'Duplicate or wrong refund'; end if;
  if (select count(*) from fairy_transactions where child_id=explorer and amount=14) <> 1 then raise exception 'Refund ledger mismatch'; end if;
  if (select status from treasure_requests where id=request_id) <> 'cancelled' then raise exception 'Refund status mismatch'; end if;
  -- Separate approved request exercises the full route and completion protection.
  request_id := gen_random_uuid();
  insert into treasure_requests(id,child_id,treasure_id,status,price_at_request)
   select request_id,explorer,id,'pending',fairy_price from treasures where shop_key=2;
  perform set_config('role','authenticated',true);
  perform public.fairybucks_decide_treasure(explorer,request_id,'approved',unlock);
  perform public.fairybucks_update_delivery(explorer,request_id,'packaging','workshop',unlock);
  perform public.fairybucks_update_delivery(explorer,request_id,'flying','packaging',unlock);
  perform public.fairybucks_update_delivery(explorer,request_id,'arriving','flying',unlock);
  if public.fairybucks_update_delivery(explorer,request_id,'landed','arriving',unlock) <> 'saved' then raise exception 'Landing failed'; end if;
  if public.fairybucks_update_delivery(explorer,request_id,'refunded','landed',unlock) <> 'already_completed' then raise exception 'Completed refund allowed'; end if;
  perform set_config('role','none',true);
  if (select balance from fairy_wallets where child_id=explorer) <> 86 then raise exception 'Delivery changed balance'; end if;
  insert into private.fairybucks_child_sessions(child_id,token_hash,expires_at)
   values(explorer,extensions.digest(child_key,'sha256'),clock_timestamp()+interval '1 hour');
  perform set_config('role','anon',true);
  begin
    perform public.fairybucks_update_delivery(explorer,request_id,'refunded','landed',unlock);
    raise exception 'Anonymous update allowed';
  exception when insufficient_privilege then null; end;
  result := public.fairybucks_child_action(child_key);
  if result::text ~* 'amazon|a[.]co|USD|purchase_url' or not exists (
   select 1 from jsonb_array_elements(result->'requests') x where x->>'delivery_stage'='landed' and x->>'status'='fulfilled'
  ) then raise exception 'Child delivery view failed'; end if;
  perform set_config('role','none',true);
end $$;
select 'PASS: delivery progression, family isolation, PIN protection, exact-once refunds and child tracker.' as result;
rollback;
