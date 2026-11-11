begin;
create table private.fairybucks_tooth_rewards (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 amount integer not null default 5 check(amount between 1 and 100)
);
alter table private.fairybucks_tooth_rewards enable row level security;
revoke all on private.fairybucks_tooth_rewards from public,anon,authenticated;
create function public.fairybucks_tooth_reward(p_child_id uuid,p_unlock_token text,p_amount integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 parent uuid := auth.uid();
 auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
 reward integer;
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','unlock_required'); end if;
 perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
 and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for share;
 if not found then return jsonb_build_object('status','unlock_required'); end if;
 if not exists(select 1 from public.child_profiles c join public.families f on f.id=c.family_id where c.id=p_child_id and f.owner_id=parent) then
  raise insufficient_privilege using message='Explorer is unavailable';
 end if;
 if p_amount is not null then
  if p_amount not between 1 and 100 then return jsonb_build_object('status','invalid_amount'); end if;
  insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent,p_amount)
   on conflict(parent_id) do update set amount=excluded.amount;
 end if;
 select amount into reward from private.fairybucks_tooth_rewards where parent_id=parent;
 return jsonb_build_object('status','saved','amount',coalesce(reward,5));
end $$;
revoke all on function public.fairybucks_tooth_reward(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.fairybucks_tooth_reward(uuid,text,integer) to authenticated;
create or replace function public.fairybucks_record_tooth(
  p_child_id uuid, p_request_id uuid, p_lost_on date, p_unlock_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  reward integer;
begin
  if parent is null or not exists (
    select 1 from auth.sessions where id = auth_session and user_id = parent
  ) then
    raise insufficient_privilege using message = 'A signed-in parent is required';
  end if;
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
    return 'unlock_required';
  end if;
  perform 1 from private.fairybucks_parent_unlocks
    where parent_id = parent and session_id = auth_session
      and token_hash = extensions.digest(p_unlock_token, 'sha256')
      and expires_at > clock_timestamp()
    for share;
  if not found then
    return 'unlock_required';
  end if;
  if not exists (
    select 1 from public.child_profiles c join public.families f on f.id = c.family_id
    where c.id = p_child_id and f.owner_id = parent
  ) then
    raise insufficient_privilege using message = 'Explorer is unavailable';
  end if;
  if p_request_id is null or p_lost_on is null
    or p_lost_on not between date '1900-01-01' and current_date + 1 then
    raise invalid_parameter_value using message = 'A request ID and valid tooth date are required';
  end if;

  -- Serialize the amount with a concurrent settings save. Ledger rows retain the award.
  insert into private.fairybucks_tooth_rewards(parent_id,amount) values(parent,5)
    on conflict(parent_id) do nothing;
  select amount into reward from private.fairybucks_tooth_rewards where parent_id=parent for share;

  insert into public.lost_teeth (id, child_id, lost_on)
    values (p_request_id, p_child_id, p_lost_on)
    on conflict (id) do nothing;
  if not found then
    if exists (
      select 1 from public.lost_teeth t join public.fairy_transactions tx on tx.id = t.id
      where t.id = p_request_id and t.child_id = p_child_id and tx.child_id = p_child_id
        and tx.amount > 0 and tx.description = 'Lost tooth reward'
    ) then
      return case when exists (select 1 from public.lost_teeth
        where id = p_request_id and corrected_at is not null) then 'corrected' else 'saved' end;
    end if;
    raise unique_violation using message = 'Request ID is already in use';
  end if;

  insert into public.fairy_wallets as w (child_id, balance)
    values (p_child_id, reward)
    on conflict (child_id) do update set balance = w.balance + excluded.balance,
      updated_at = clock_timestamp();
  insert into public.fairy_transactions (id, child_id, amount, description)
    values (p_request_id, p_child_id, reward, 'Lost tooth reward');
  return 'saved';
end;
$$;

notify pgrst, 'reload schema';
commit;
