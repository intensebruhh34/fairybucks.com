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
  tooth_a uuid := gen_random_uuid();
  tooth_b uuid := gen_random_uuid();
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
  perform set_config('role','authenticated',true);
  if public.fairybucks_tooth_reward(explorer,null,1)->>'status' <> 'unlock_required' then raise exception 'Missing PIN accepted'; end if;
  if (public.fairybucks_tooth_reward(explorer,unlock)->>'amount')::int <> 5 then raise exception 'Default changed'; end if;
  if public.fairybucks_tooth_reward(explorer,unlock,0)->>'status' <> 'invalid_amount' then raise exception 'Zero accepted'; end if;
  if public.fairybucks_tooth_reward(explorer,unlock,101)->>'status' <> 'invalid_amount' then raise exception 'Invalid amount accepted'; end if;
  if public.fairybucks_record_tooth(explorer,tooth_a,current_date,unlock) <> 'saved' then raise exception 'Default tooth failed'; end if;
  perform public.fairybucks_tooth_reward(explorer,unlock,1);
  perform public.fairybucks_record_tooth(explorer,tooth_b,current_date,unlock);
  perform public.fairybucks_tooth_reward(explorer,unlock,9);
  -- Replay an existing award after changing the setting: no new credit or error.
  if public.fairybucks_record_tooth(explorer,tooth_a,current_date,unlock) <> 'saved' then raise exception 'Replay failed after setting change'; end if;
  perform public.fairybucks_undo_tooth(explorer,tooth_a,unlock);
  perform public.fairybucks_undo_tooth(explorer,tooth_a,unlock);
  if public.fairybucks_record_tooth(explorer,tooth_a,current_date,unlock) <> 'corrected' then raise exception 'Corrected replay failed'; end if;
  perform set_config('role','none',true);
  if (select balance from fairy_wallets where child_id=explorer) <> 101 then raise exception 'Wrong award or correction amount'; end if;
  if (select amount from fairy_transactions where id=tooth_a) <> 5 or (select amount from fairy_transactions where id=tooth_b) <> 1 then raise exception 'Historical award modified'; end if;
  if (select count(*) from fairy_transactions where child_id=explorer and amount=-5) <> 1 then raise exception 'Repeated correction debited twice'; end if;
  update child_profiles set family_id=(select id from families where owner_id=parent_b) where id=explorer;
  perform set_config('role','authenticated',true);
  begin
   perform public.fairybucks_tooth_reward(explorer,unlock,2);
   raise exception 'Cross family change accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('role','none',true);
  update child_profiles set family_id=(select id from families where owner_id=parent_a) where id=explorer;
  update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()-interval '1 second' where parent_id=parent_a;
  perform set_config('role','authenticated',true);
  if public.fairybucks_tooth_reward(explorer,unlock,2)->>'status' <> 'unlock_required' then raise exception 'Expired PIN accepted'; end if;
  perform set_config('role','anon',true);
  begin
   perform public.fairybucks_tooth_reward(explorer,unlock,2);
   raise exception 'Anonymous setting accepted';
  exception when insufficient_privilege then null; end;
  perform set_config('role','none',true);
end $$;
select 'PASS: adjustable rewards, historical awards, replay protection, original-amount corrections and family/PIN isolation.' as result;
rollback;
