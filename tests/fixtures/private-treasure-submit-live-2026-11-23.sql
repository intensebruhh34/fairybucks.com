-- Exact read-only snapshot of private.fairybucks_submit_for_explorer; test fixture only.
CREATE OR REPLACE FUNCTION private.fairybucks_submit_for_explorer(p_child_id uuid, p_request_id uuid, p_shop_key integer, p_expected_price integer)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  treasure uuid;
  price integer;
  wallet_balance integer;
  reserved bigint;
begin
  -- Serialize submissions for this explorer, including two tabs requesting the same item.
  perform 1 from public.child_profiles c
    where c.id = p_child_id for no key update of c;
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
$function$;
