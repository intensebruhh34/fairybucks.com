-- Run AFTER the Hot Wheels / Barbie migration, in a separate SQL Editor query.
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
    select request_id, explorer, id, 'pending', fairy_price from public.treasures where shop_key = 13;
  insert into private.fairybucks_parent_unlocks(parent_id, session_id, token_hash, expires_at)
    values(parent_a, session_a, extensions.digest(unlock, 'sha256'), clock_timestamp() + interval '5 minutes')
    on conflict(parent_id) do update set session_id = excluded.session_id,
      token_hash = excluded.token_hash, expires_at = excluded.expires_at;
  perform set_config('request.jwt.claims', jsonb_build_object('sub',parent_a,'session_id',session_a)::text, true);
  perform set_config('role', 'authenticated', true);
  result := public.fairybucks_parent_purchase(explorer, request_id, null);
  if result->>'status' <> 'unlock_required' then raise exception 'Missing PIN bypass'; end if;
  result := public.fairybucks_parent_purchase(explorer, request_id, repeat('0',64));
  if result->>'status' <> 'unlock_required' then raise exception 'Wrong PIN token bypass'; end if;
  result := public.fairybucks_parent_purchase(explorer, request_id, unlock);
  if result->>'status' <> 'available' or result->>'price_cents' <> '999'
    or result->>'url' <> 'https://a.co/d/01spso0w' then raise exception 'Parent purchase details missing'; end if;
  if public.fairybucks_parent_purchase(gen_random_uuid(), request_id, unlock)->>'status' <> 'unavailable' then
    raise exception 'Explorer isolation failed';
  end if;
  begin
    perform 1 from private.fairybucks_purchase_options;
    raise exception 'Direct purchase table access allowed';
  exception when insufficient_privilege then null; end;
  perform set_config('role', 'none', true);
  -- Same valid session but a second family does not own this request.
  update public.child_profiles set family_id = (select id from public.families where owner_id = parent_b)
    where id = explorer;
  perform set_config('role', 'authenticated', true);
  if public.fairybucks_parent_purchase(explorer, request_id, unlock)->>'status' <> 'unavailable' then
    raise exception 'Cross-family access allowed';
  end if;
  perform set_config('role', 'none', true);
  update public.child_profiles set family_id = (select id from public.families where owner_id = parent_a)
    where id = explorer;
  update private.fairybucks_parent_unlocks set expires_at = clock_timestamp() - interval '1 second'
    where parent_id = parent_a;
  perform set_config('role', 'authenticated', true);
  if public.fairybucks_parent_purchase(explorer, request_id, unlock)->>'status' <> 'unlock_required' then
    raise exception 'Expired unlock accepted';
  end if;
  perform set_config('role', 'none', true);
  -- Verify the second new item through the same protected parent RPC.
  update public.treasure_requests set treasure_id=(select id from public.treasures where shop_key=14) where id=request_id;
  update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()+interval '5 minutes' where parent_id=parent_a;
  perform set_config('role','authenticated',true);
  result := public.fairybucks_parent_purchase(explorer,request_id,unlock);
  if result->>'price_cents' <> '629' or result->>'url' <> 'https://a.co/d/01EoZDMn' then
   raise exception 'Barbie purchase mapping failed';
  end if;
  perform set_config('role','none',true);
  -- An active child session gets only the explicit child-safe view.
  insert into private.fairybucks_child_sessions(child_id, token_hash, expires_at)
    values(explorer, extensions.digest(child_key,'sha256'), clock_timestamp() + interval '1 hour');
  perform set_config('role', 'anon', true);
  begin
    perform public.fairybucks_parent_purchase(explorer, request_id, unlock);
    raise exception 'Anonymous purchase RPC allowed';
  exception when insufficient_privilege then null; end;
  result := public.fairybucks_child_action(child_key);
  if result->>'status' <> 'active' or result::text ~* 'amazon|a[.]co|price_cents|purchase_url|USD' then
    raise exception 'Child view leaked purchase details';
  end if;
  if not exists(select 1 from jsonb_array_elements(result->'catalog') x where x->>'key'='13' and x->>'price'='14')
    or not exists(select 1 from jsonb_array_elements(result->'catalog') x where x->>'key'='14' and x->>'price'='11') then
    raise exception 'Child catalog missing new treasure prices';
  end if;
  perform set_config('role', 'none', true);
  if (select count(*) from public.treasures where shop_key in (13,14) and is_active) <> 2 then raise exception 'New treasures missing'; end if;
  if (select array_agg(fairy_price order by shop_key) from public.treasures where shop_key between 1 and 12)
      <> array[15,14,14,19,14,25,23,17,20,19,24,12] then raise exception 'Catalog prices differ'; end if;
  if (select price_at_request from public.treasure_requests where id = request_id) <> 14
      or (select balance from public.fairy_wallets where child_id = explorer) <> 100 then
    raise exception 'Reading purchase details changed a request or wallet';
  end if;
end $$;
select 'PASS: Hot Wheels and Barbie mappings, PIN protection, family isolation and child-safe access.' as result;
rollback;
