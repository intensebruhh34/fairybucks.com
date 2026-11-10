begin;

alter table public.treasures add column shop_key integer unique;
insert into public.treasures (shop_key, name, category, fairy_price, is_active) values
  (1, 'Little Scientist Kit', 'Learning', 15, true),
  (2, 'Magical Art Studio', 'Creativity', 12, true),
  (3, 'Dinosaur Adventure Book', 'Learning', 8, true),
  (4, 'Fairy Garden Starter', 'Learning', 18, true),
  (5, 'Puzzle Quest', 'Learning', 10, true),
  (6, 'Cuddly Star Friend', 'Treasure', 20, true),
  (7, 'Space Explorer Kit', 'Learning', 25, true),
  (8, 'Wonderland Storybook', 'Learning', 7, true),
  (9, 'Treasure Dig Kit', 'Treasure', 14, true),
  (10, 'Make Your Own Jewelry', 'Creativity', 16, true),
  (11, 'Outdoor Explorer Kit', 'Learning', 23, true),
  (12, 'Colorful Clay Set', 'Creativity', 9, true);

-- Route writes through the RPCs so browser-supplied prices and statuses cannot bypass checks.
revoke insert, update, delete, truncate on public.treasure_requests from public, anon, authenticated;

create function public.fairybucks_treasure_offer(p_shop_key integer)
returns table (name text, fairy_price integer)
language sql stable security invoker set search_path = ''
as $$
  select t.name, t.fairy_price from public.treasures t
  where t.shop_key = p_shop_key and t.is_active;
$$;

create function public.fairybucks_list_treasure_requests(p_child_id uuid)
returns table (id uuid, name text, price integer, status text)
language sql stable security definer set search_path = ''
as $$
  select r.id, t.name, r.price_at_request, r.status
  from public.treasure_requests r
  join public.treasures t on t.id = r.treasure_id
  join public.child_profiles c on c.id = r.child_id
  join public.families f on f.id = c.family_id
  where r.child_id = p_child_id and f.owner_id = auth.uid()
  order by (r.status = 'pending') desc, r.created_at desc, r.id desc;
$$;

create function public.fairybucks_submit_treasure(
  p_child_id uuid, p_request_id uuid, p_shop_key integer, p_expected_price integer
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  treasure uuid;
  price integer;
  wallet_balance integer;
  reserved bigint;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent account is required';
  end if;
  -- Serialize submissions for this explorer, including two tabs requesting the same item.
  perform 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = parent for no key update of c;
  if not found then
    raise insufficient_privilege using message = 'Explorer is unavailable';
  end if;

  select id, fairy_price into treasure, price from public.treasures where shop_key = p_shop_key for share;
  if not found then return 'unavailable'; end if;
  if exists (
    select 1 from public.treasure_requests where id = p_request_id
      and child_id = p_child_id and treasure_id = treasure
  ) then return 'requested'; end if;
  if not exists (select 1 from public.treasures where id = treasure and is_active) then
    return 'unavailable';
  end if;
  if price is distinct from p_expected_price then return 'price_changed'; end if;
  if exists (
    select 1 from public.treasure_requests where child_id = p_child_id
      and treasure_id = treasure and status = 'pending'
  ) then return 'already_pending'; end if;

  select balance into wallet_balance from public.fairy_wallets where child_id = p_child_id for update;
  select coalesce(sum(price_at_request), 0) into reserved
    from public.treasure_requests where child_id = p_child_id and status = 'pending';
  if coalesce(wallet_balance, 0) - reserved < price then return 'insufficient_balance'; end if;

  insert into public.treasure_requests (id, child_id, treasure_id, status, price_at_request)
    values (p_request_id, p_child_id, treasure, 'pending', price);
  return 'requested';
end;
$$;

create function public.fairybucks_decide_treasure(
  p_child_id uuid, p_request_id uuid, p_decision text, p_unlock_token text default null
)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  request public.treasure_requests%rowtype;
  item_name text;
  item_active boolean;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent account is required';
  end if;
  if p_decision is null or p_decision not in ('approved', 'declined', 'cancelled') then
    raise invalid_parameter_value using message = 'Invalid treasure request decision';
  end if;
  if p_decision <> 'cancelled' then
    if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
      return 'unlock_required';
    end if;
    perform 1 from private.fairybucks_parent_unlocks
      where parent_id = parent and session_id = auth_session
        and token_hash = extensions.digest(p_unlock_token, 'sha256')
        and expires_at > clock_timestamp()
      for share;
    if not found then return 'unlock_required'; end if;
  end if;

  select r.* into request from public.treasure_requests r
    join public.child_profiles c on c.id = r.child_id
    join public.families f on f.id = c.family_id
    where r.id = p_request_id and r.child_id = p_child_id and f.owner_id = parent
    for update of r;
  if not found then
    raise insufficient_privilege using message = 'Treasure request is unavailable';
  end if;
  if request.status = p_decision then return p_decision; end if;
  if request.status <> 'pending' then return 'already_decided'; end if;

  if p_decision = 'approved' then
    select name, is_active into item_name, item_active
      from public.treasures where id = request.treasure_id for share;
    if item_active is not true then return 'unavailable'; end if;
    update public.fairy_wallets
      set balance = balance - request.price_at_request, updated_at = clock_timestamp()
      where child_id = p_child_id and balance >= request.price_at_request;
    if not found then return 'insufficient_balance'; end if;
    insert into public.fairy_transactions (child_id, amount, description)
      values (p_child_id, -request.price_at_request, 'Treasure approved: ' || item_name);
  end if;
  update public.treasure_requests set status = p_decision where id = request.id;
  return p_decision;
end;
$$;

revoke all on function public.fairybucks_treasure_offer(integer) from public, anon, authenticated;
revoke all on function public.fairybucks_list_treasure_requests(uuid) from public, anon, authenticated;
revoke all on function public.fairybucks_submit_treasure(uuid, uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.fairybucks_decide_treasure(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.fairybucks_treasure_offer(integer) to authenticated;
grant execute on function public.fairybucks_list_treasure_requests(uuid) to authenticated;
grant execute on function public.fairybucks_submit_treasure(uuid, uuid, integer, integer) to authenticated;
grant execute on function public.fairybucks_decide_treasure(uuid, uuid, text, text) to authenticated;
notify pgrst, 'reload schema';

commit;
