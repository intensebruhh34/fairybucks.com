begin;

alter table public.lost_teeth add column corrected_at timestamptz;

create function public.fairybucks_undo_tooth(
  p_child_id uuid, p_tooth_id uuid, p_unlock_token text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  parent uuid := auth.uid();
  auth_session uuid := nullif(auth.jwt()->>'session_id', '')::uuid;
  correction_time timestamptz;
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

  select t.corrected_at, tx.amount into correction_time, reward
    from public.lost_teeth t join public.fairy_transactions tx
      on tx.id = t.id and tx.child_id = t.child_id
      and tx.description = 'Lost tooth reward' and tx.amount > 0
    where t.id = p_tooth_id and t.child_id = p_child_id
    for update of t;
  if not found then
    return 'tooth_unavailable';
  end if;
  if correction_time is not null then
    return 'undone';
  end if;

  update public.fairy_wallets
    set balance = balance - reward, updated_at = clock_timestamp()
    where child_id = p_child_id and balance >= reward;
  if not found then
    return 'insufficient_balance';
  end if;

  update public.lost_teeth set corrected_at = clock_timestamp() where id = p_tooth_id;
  insert into public.fairy_transactions (child_id, amount, description)
    values (p_child_id, -reward, 'Lost tooth correction');
  return 'undone';
end;
$$;

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
  reward constant integer := 5;
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

  insert into public.lost_teeth (id, child_id, lost_on)
    values (p_request_id, p_child_id, p_lost_on)
    on conflict (id) do nothing;
  if not found then
    if exists (
      select 1 from public.lost_teeth t join public.fairy_transactions tx on tx.id = t.id
      where t.id = p_request_id and t.child_id = p_child_id and tx.child_id = p_child_id
        and tx.amount = reward and tx.description = 'Lost tooth reward'
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

create or replace function public.fairybucks_explorer_summary(p_child_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'balance', coalesce((select w.balance from public.fairy_wallets w where w.child_id = c.id), 0),
    'tooth_count', (select count(*) from public.lost_teeth t where t.child_id = c.id and t.corrected_at is null),
    'teeth', coalesce((
      select jsonb_agg(t.lost_on order by t.lost_on desc)
      from (select lost_on from public.lost_teeth where child_id = c.id and corrected_at is null
        order by lost_on desc, created_at desc, id desc limit 20) t
    ), '[]'::jsonb),
    'correctable_teeth', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'lost_on', t.lost_on, 'created_at', t.created_at, 'reward', tx.amount)
        order by t.created_at desc, t.id desc)
      from public.lost_teeth t join public.fairy_transactions tx
        on tx.id = t.id and tx.child_id = t.child_id
        and tx.description = 'Lost tooth reward' and tx.amount > 0
      where t.child_id = c.id and t.corrected_at is null
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(to_jsonb(tx) order by tx.created_at desc, tx.id desc)
      from (select id, amount, description, created_at from public.fairy_transactions where child_id = c.id
        order by created_at desc, id desc limit 20) tx
    ), '[]'::jsonb)
  )
  from public.child_profiles c
  join public.families f on f.id = c.family_id
  where c.id = p_child_id and f.owner_id = auth.uid();
$$;

revoke all on function public.fairybucks_undo_tooth(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fairybucks_undo_tooth(uuid, uuid, text) to authenticated;
notify pgrst, 'reload schema';

commit;
