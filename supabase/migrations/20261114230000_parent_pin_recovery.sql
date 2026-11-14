begin;

-- Records consumed email proofs, never PINs or email-link tokens.
create table private.fairybucks_pin_recoveries (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 verified_at bigint not null,
 reset_at timestamptz not null default now()
);
alter table private.fairybucks_pin_recoveries enable row level security;
revoke all on private.fairybucks_pin_recoveries from public, anon, authenticated;

create function public.fairybucks_recover_parent_pin(p_new_pin text default null, p_expected_parent uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 parent uuid := auth.uid();
 claims jsonb := auth.jwt();
 auth_session uuid := nullif(claims->>'session_id','')::uuid;
 email_proof bigint;
 pin_state private.parent_pin_security%rowtype;
begin
 if parent is null or (p_expected_parent is not null and p_expected_parent<>parent) or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent)
 or not exists(select 1 from public.families where owner_id=parent) then
  raise insufficient_privilege using message='A signed-in parent with a Family Vault is required';
 end if;
 -- Trust only Supabase-signed AMR, never browser flags or editable user_metadata.
 -- Require a confirmed email and the email provider, excluding phone OTP sessions.
 if claims->'app_metadata'->>'provider' is distinct from 'email'
 or not exists(select 1 from auth.users where id=parent and email_confirmed_at is not null
   and email=claims->>'email') then
  return jsonb_build_object('status','email_required');
 end if;
 select max((entry->>'timestamp')::bigint) into email_proof
 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) entry
 where entry->>'method' in ('otp','magiclink')
 and entry->>'timestamp' ~ '^[0-9]{1,12}$';
 if email_proof is null or email_proof < extract(epoch from clock_timestamp())-600
 or email_proof > extract(epoch from clock_timestamp())+30 then
  return jsonb_build_object('status','email_required');
 end if;
 -- The PIN row serializes reset/unlock operations and competing reset submissions.
 select * into pin_state from private.parent_pin_security where parent_id=parent for update;
 if not found then return jsonb_build_object('status','setup_required'); end if;
 if exists(select 1 from private.fairybucks_pin_recoveries where parent_id=parent and verified_at>=email_proof) then
  return jsonb_build_object('status','email_used');
 end if;
 if p_new_pin is null then return jsonb_build_object('status','ready'); end if;
 if p_new_pin !~ '^[0-9]{6}$' then return jsonb_build_object('status','invalid_pin'); end if;
 update private.parent_pin_security set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf',12)),
  failed_attempts=0, locked_until=null, updated_at=clock_timestamp() where parent_id=parent;
 insert into private.fairybucks_pin_recoveries(parent_id,verified_at) values(parent,email_proof)
 on conflict(parent_id) do update set verified_at=excluded.verified_at,reset_at=clock_timestamp();
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
 where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 return jsonb_build_object('status','saved');
end;
$$;
revoke all on function public.fairybucks_recover_parent_pin(text,uuid) from public,anon,authenticated;
grant execute on function public.fairybucks_recover_parent_pin(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
