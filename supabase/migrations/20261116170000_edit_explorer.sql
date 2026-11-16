begin;
create function public.fairybucks_edit_explorer(p_child_id uuid,p_nickname text,p_age integer,p_gender text,p_expected_parent uuid,p_original jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare parent uuid:=auth.uid();auth_session uuid:=nullif(auth.jwt()->>'session_id','')::uuid;profile public.child_profiles%rowtype;details jsonb;
begin
 if parent is null or p_expected_parent is distinct from parent
 or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='The current parent sign-in is required';end if;
 perform 1 from auth.users where id=parent for update;
 if not found then raise insufficient_privilege using message='Parent account is unavailable';end if;
 if p_nickname is null or char_length(btrim(p_nickname)) not between 1 and 35
 or (p_age is not null and p_age not between 2 and 18)
 or p_gender is null or p_gender not in ('boy','girl','rather-not-say') then
  raise invalid_parameter_value using message='Check the nickname and optional explorer details';end if;
 select c.* into profile from public.child_profiles c join public.families f on f.id=c.family_id
 where c.id=p_child_id and f.owner_id=parent for update of c;
 if not found then return jsonb_build_object('status','unavailable');end if;
 details:=jsonb_build_object('nickname',profile.nickname,'age',profile.age,'gender',coalesce(profile.gender,'rather-not-say'));
 if p_original is distinct from details then
  return jsonb_build_object('status','changed','profile',details||jsonb_build_object('id',profile.id));end if;
 -- Metadata only: stable explorer/family IDs keep all balances, teeth and requests attached.
 update public.child_profiles set nickname=btrim(p_nickname),age=p_age,gender=p_gender where id=profile.id;
 return jsonb_build_object('status','saved','profile',jsonb_build_object('id',profile.id,'nickname',btrim(p_nickname),'age',p_age,'gender',p_gender));
end $$;
revoke all on function public.fairybucks_edit_explorer(uuid,text,integer,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.fairybucks_edit_explorer(uuid,text,integer,text,uuid,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
