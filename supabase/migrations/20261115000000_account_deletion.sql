begin;

-- Explicit, narrowly scoped deletion avoids changing existing foreign-key behavior.
-- Unknown dependencies cause a full rollback instead of a partial account deletion.
create function public.fairybucks_delete_account(
 p_confirmation text default null, p_unlock_token text default null, p_expected_parent uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
 parent uuid := auth.uid();
 claims jsonb := auth.jwt();
 auth_session uuid := nullif(claims->>'session_id','')::uuid;
 verified_at bigint;
 needs_pin boolean;
 children jsonb;
begin
 if parent is null or (p_expected_parent is not null and p_expected_parent<>parent)
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent)
 or not exists(select 1 from auth.users where id=parent) then
  raise insufficient_privilege using message='A signed-in parent is required';
 end if;
 select max((entry->>'timestamp')::bigint) into verified_at
 from jsonb_array_elements(coalesce(claims->'amr','[]'::jsonb)) entry
 where entry->>'method' in ('password','otp','magiclink') and entry->>'timestamp' ~ '^[0-9]{1,12}$';
 select exists(select 1 from private.parent_pin_security where parent_id=parent) into needs_pin;
 select coalesce(jsonb_agg(c.id),'[]'::jsonb) into children from public.child_profiles c
 join public.families f on f.id=c.family_id where f.owner_id=parent;
 if verified_at is null or verified_at < extract(epoch from clock_timestamp())-600
 or verified_at > extract(epoch from clock_timestamp())+30 then
  return jsonb_build_object('status','reauth_required','requires_pin',needs_pin,'child_ids',children);
 end if;
 if p_confirmation is null then
  return jsonb_build_object('status','ready','requires_pin',needs_pin,'child_ids',children);
 end if;
 if p_confirmation<>'DELETE' then return jsonb_build_object('status','confirmation_required'); end if;
 -- Lock account and family rows before removing dependent data, also covering concurrent profile additions.
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Account is unavailable'; end if;
 perform 1 from public.families where owner_id=parent for update;
 perform 1 from private.parent_pin_security where parent_id=parent for update;
 -- Recheck after locking in case PIN setup/reset raced the review screen.
 if found then
  if p_unlock_token is null or p_unlock_token !~ '^[0-9a-f]{64}$' then
   return jsonb_build_object('status','unlock_required');
  end if;
  perform 1 from private.fairybucks_parent_unlocks where parent_id=parent and session_id=auth_session
   and token_hash=extensions.digest(p_unlock_token,'sha256') and expires_at>clock_timestamp() for update;
  if not found then return jsonb_build_object('status','unlock_required'); end if;
 end if;
 -- A session revoked while waiting on a lock cannot authorize deletion.
 if not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='Sign in again before deleting your account';
 end if;
 delete from private.fairybucks_child_sessions s using public.child_profiles c,public.families f
  where s.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.treasure_requests r using public.child_profiles c,public.families f
  where r.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.fairy_transactions t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.lost_teeth t using public.child_profiles c,public.families f
  where t.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.fairy_wallets w using public.child_profiles c,public.families f
  where w.child_id=c.id and c.family_id=f.id and f.owner_id=parent;
 delete from public.child_profiles c using public.families f where c.family_id=f.id and f.owner_id=parent;
 delete from public.families where owner_id=parent;
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
 delete from private.parent_pin_security where parent_id=parent;
 delete from private.fairybucks_tooth_rewards where parent_id=parent;
 delete from private.fairybucks_parent_guides where parent_id=parent;
 delete from private.fairybucks_pin_recoveries where parent_id=parent;
 delete from auth.sessions where user_id=parent;
 -- Auth identities and refresh tokens use Supabase's own cascades. Storage ownership or an
 -- unexpected external dependency makes the entire transaction fail; never use CASCADE here.
 delete from auth.users where id=parent;
 if not found then raise exception 'Account deletion could not be confirmed'; end if;
 return jsonb_build_object('status','deleted');
end;
$$;
revoke all on function public.fairybucks_delete_account(text,text,uuid) from public,anon,authenticated;
grant execute on function public.fairybucks_delete_account(text,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
