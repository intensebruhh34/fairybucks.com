begin;
alter table public.treasure_requests add column delivery_stage text
  check (delivery_stage in ('workshop','packaging','flying','arriving','landed','refunded'));
create function public.fairybucks_update_delivery(
 p_child_id uuid, p_request_id uuid, p_stage text, p_expected_stage text, p_unlock_token text
) returns text language plpgsql security definer set search_path = '' as $$
declare
 parent uuid := auth.uid();
 auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
 request public.treasure_requests%rowtype;
 current_stage text;
 stages text[] := array['workshop','packaging','flying','arriving','landed'];
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then return 'unlock_required'; end if;
 perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
  and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for share;
 if not found then return 'unlock_required'; end if;
 select r.* into request from public.treasure_requests r
 join public.child_profiles c on c.id=r.child_id join public.families f on f.id=c.family_id
 where r.id=p_request_id and r.child_id=p_child_id and f.owner_id=parent for update of r;
 if not found then raise insufficient_privilege using message='Treasure request is unavailable'; end if;
 current_stage := coalesce(request.delivery_stage,'workshop');
 if request.status='cancelled' and current_stage='refunded' and p_stage='refunded' then return 'refunded'; end if;
 if request.status='fulfilled' then return 'already_completed'; end if;
 if request.status <> 'approved' then return 'not_approved'; end if;
 if current_stage = p_stage then return 'saved'; end if;
 if p_expected_stage is distinct from current_stage then return 'stage_changed'; end if;
 if p_stage='refunded' then
  -- The row lock makes this credit and cancellation atomic and safe to retry.
  insert into public.fairy_wallets as w(child_id,balance) values(p_child_id,request.price_at_request)
   on conflict(child_id) do update set balance=w.balance+excluded.balance,updated_at=clock_timestamp();
  insert into public.fairy_transactions(child_id,amount,description)
   values(p_child_id,request.price_at_request,'Treasure cancelled: Fairy Bucks returned');
  update public.treasure_requests set status='cancelled',delivery_stage='refunded' where id=request.id;
  return 'refunded';
 end if;
 if p_stage is null or array_position(stages,p_stage) is distinct from array_position(stages,current_stage)+1 then
  return 'invalid_stage';
 end if;
 update public.treasure_requests set delivery_stage=p_stage,
  status=case when p_stage='landed' then 'fulfilled' else 'approved' end where id=request.id;
 return 'saved';
end $$;
revoke all on function public.fairybucks_update_delivery(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.fairybucks_update_delivery(uuid,uuid,text,text,text) to authenticated;

-- Add the child-safe stage to the existing request projection.
drop function public.fairybucks_list_treasure_requests(uuid);
create function public.fairybucks_list_treasure_requests(p_child_id uuid)
returns table(id uuid,name text,price integer,status text,delivery_stage text)
language sql stable security definer set search_path='' as $$
 select r.id,t.name,r.price_at_request,r.status,r.delivery_stage
 from public.treasure_requests r join public.treasures t on t.id=r.treasure_id
 join public.child_profiles c on c.id=r.child_id join public.families f on f.id=c.family_id
 where r.child_id=p_child_id and f.owner_id=auth.uid()
 order by (r.status='pending') desc,r.created_at desc,r.id desc;
$$;
revoke all on function public.fairybucks_list_treasure_requests(uuid) from public,anon,authenticated;
grant execute on function public.fairybucks_list_treasure_requests(uuid) to authenticated;
create or replace function public.fairybucks_child_action(
  p_token text, p_action text default 'view', p_request_id uuid default null,
  p_shop_key integer default null, p_expected_price integer default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
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
$$;


notify pgrst, 'reload schema';
commit;
