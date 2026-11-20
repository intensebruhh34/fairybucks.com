begin;
-- A fresh PIN is checked inside the deletion transaction; existing unlock tokens cannot authorize it.
create function public.fairybucks_delete_explorer(
 p_child_id uuid,p_expected_parent uuid,p_expected_nickname text default null,
 p_confirmation text default null,p_pin text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare parent uuid:=auth.uid();auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
 profile public.child_profiles%rowtype;pin_result jsonb;
begin
 if parent is null or p_expected_parent is distinct from parent
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 -- Match account deletion's lock order; protect the selected family/profile from concurrent writes.
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Parent account is unavailable';end if;
 perform 1 from public.families where owner_id=parent for update;
 select c.* into profile from public.child_profiles c join public.families f on f.id=c.family_id
 where c.id=p_child_id and f.owner_id=parent for update of c;
 if not found then return jsonb_build_object('status','unavailable');end if;
 perform 1 from auth.sessions where id=auth_session and user_id=parent for share;
 if not found then raise insufficient_privilege using message='Sign in again before deleting an explorer';end if;
 if p_confirmation is null then
  return jsonb_build_object('status',case when exists(select 1 from private.parent_pin_security where parent_id=parent)
   then 'ready' else 'setup_required' end,'profile',jsonb_build_object('id',profile.id,'nickname',profile.nickname));end if;
 if p_confirmation<>'DELETE' then return jsonb_build_object('status','confirmation_required');end if;
 if p_expected_nickname is distinct from profile.nickname then
  return jsonb_build_object('status','changed','profile',jsonb_build_object('id',profile.id,'nickname',profile.nickname));end if;
 if p_pin is null or p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('status','invalid_pin');end if;
 pin_result:=public.fairybucks_parent_pin(p_pin,false);
 -- Return normally on failure so PIN throttling is committed, not rolled back by an exception.
 if pin_result->>'status' is distinct from 'unlocked' then
  return jsonb_build_object('status',pin_result->>'status');end if;
 delete from private.fairybucks_child_sessions where child_id=profile.id;
 delete from public.treasure_requests where child_id=profile.id;
 delete from public.fairy_transactions where child_id=profile.id;
 delete from public.lost_teeth where child_id=profile.id;
 delete from public.fairy_wallets where child_id=profile.id;
 -- The existing hosted schema includes wishlists; older test/development schemas may not.
 if to_regclass('public.wishlists') is not null then
  execute 'delete from public.wishlists where child_id=$1' using profile.id;
 end if;
 delete from public.child_profiles where id=profile.id;
 if not found then raise exception 'Explorer deletion could not be confirmed';end if;
 -- Clear parent unlocks: any stale protected screen must ask for the PIN again.
 delete from private.fairybucks_parent_unlocks where parent_id=parent;
 return jsonb_build_object('status','deleted','child_id',profile.id);
end $$;
revoke all on function public.fairybucks_delete_explorer(uuid,uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.fairybucks_delete_explorer(uuid,uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
