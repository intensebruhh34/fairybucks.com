begin;
-- First-PIN setup is independent of explorer creation. This cannot reset an existing PIN.
create function public.fairybucks_create_parent_pin(p_pin text default null,p_expected_parent uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare parent uuid:=auth.uid();auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;
begin
 if parent is null or p_expected_parent is distinct from parent
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 -- Coordinate with account deletion; never initialize another signed-in account by accident.
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Parent account is unavailable';end if;
 if p_pin is null then
  if not exists(select 1 from public.families where owner_id=parent) then
   return jsonb_build_object('status','setup_required');end if;
  return public.fairybucks_parent_pin();
 end if;
 if p_pin !~ '^[0-9]{6}$' then return jsonb_build_object('status','invalid_pin');end if;
 insert into public.families(owner_id) select parent
 where not exists(select 1 from public.families where owner_id=parent) on conflict do nothing;
 -- The existing insert-only setup path refuses to replace any existing PIN.
 return public.fairybucks_parent_pin(p_pin,true);
end $$;
revoke all on function public.fairybucks_create_parent_pin(text,uuid) from public,anon,authenticated;
grant execute on function public.fairybucks_create_parent_pin(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
