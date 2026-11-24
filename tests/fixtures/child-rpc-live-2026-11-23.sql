-- Read-only snapshot of existing Fairybucks production PostgreSQL function definitions.
-- Captured 2026-11-23 for isolated CI regression only; not a migration.
-- No secrets or family records. Must be updated if these functions change.
-- Child permission helper is replaced with a controlled test double in CI.

-- private.fairybucks_child_action_core
CREATE OR REPLACE FUNCTION private.fairybucks_child_action_core(p_token text, p_action text DEFAULT 'view'::text, p_request_id uuid DEFAULT NULL::uuid, p_shop_key integer DEFAULT NULL::integer, p_expected_price integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  explorer uuid;
  token_digest bytea;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('status', 'expired');
  end if;
  token_digest := extensions.digest(p_token, 'sha256');
  if p_action = 'end' then
    delete from private.fairybucks_child_sessions where token_hash = token_digest;
    return jsonb_build_object('status', 'ended');
  end if;
  select child_id into explorer from private.fairybucks_child_sessions
    where token_hash = token_digest and expires_at > clock_timestamp() for share;
  if not found then return jsonb_build_object('status', 'expired'); end if;

  if p_action = 'request' then
    return jsonb_build_object('status', private.fairybucks_submit_for_explorer(
      explorer, p_request_id, p_shop_key, p_expected_price
    ));
  end if;
  if p_action = 'cancel' then
    update public.treasure_requests set status = 'cancelled'
      where id = p_request_id and child_id = explorer and status = 'pending';
    return jsonb_build_object('status', case
      when found or exists (
        select 1 from public.treasure_requests
        where id = p_request_id and child_id = explorer and status = 'cancelled'
      ) then 'cancelled' else 'already_decided' end);
  end if;
  if p_action is distinct from 'view' then
    raise invalid_parameter_value using message = 'Invalid explorer action';
  end if;

  return (
    select jsonb_build_object(
      'status', 'active',
      'nickname', c.nickname,
      'balance', coalesce((select w.balance from public.fairy_wallets w where w.child_id = explorer), 0),
      'tooth_count', (select count(*) from public.lost_teeth t where t.child_id = explorer and t.corrected_at is null),
      'catalog', coalesce((
        select jsonb_agg(jsonb_build_object('key', t.shop_key, 'name', t.name, 'category', t.category,
          'price', t.fairy_price) order by t.shop_key)
        from public.treasures t where t.is_active and t.shop_key is not null
      ), '[]'::jsonb),
      'requests', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'name', t.name, 'price', r.price_at_request,
          'status', r.status, 'delivery_stage', r.delivery_stage) order by r.created_at desc, r.id desc)
        from public.treasure_requests r join public.treasures t on t.id = r.treasure_id
        where r.child_id = explorer
      ), '[]'::jsonb)
    )
    from public.child_profiles c where c.id = explorer
  );
end;
$function$;

-- private.fairybucks_submit_for_explorer
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

-- public.fairybucks_child_action
CREATE OR REPLACE FUNCTION public.fairybucks_child_action(p_token text, p_action text DEFAULT 'view'::text, p_request_id uuid DEFAULT NULL::uuid, p_shop_key integer DEFAULT NULL::integer, p_expected_price integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare parent uuid;
begin
 if p_action<>'end' and p_token ~ '^[0-9a-f]{64}$' then
  select f.owner_id into parent from private.fairybucks_child_sessions s
   join public.child_profiles c on c.id=s.child_id join public.families f on f.id=c.family_id
   where s.token_hash=extensions.digest(p_token,'sha256') and s.expires_at>clock_timestamp();
  if found and not private.fairybucks_child_permission(parent) then
   return jsonb_build_object('status','permission_required');end if;
 end if;
 return private.fairybucks_child_action_core(p_token,p_action,p_request_id,p_shop_key,p_expected_price);
end $function$;
