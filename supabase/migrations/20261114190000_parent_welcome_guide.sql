begin;
create table private.fairybucks_parent_guides (
 parent_id uuid primary key references auth.users(id) on delete cascade,
 completed_version integer not null check(completed_version > 0),
 completed_at timestamptz not null default clock_timestamp()
);
alter table private.fairybucks_parent_guides enable row level security;
revoke all on private.fairybucks_parent_guides from public,anon,authenticated;
create function public.fairybucks_parent_guide(p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 parent uuid := auth.uid();
 auth_session uuid := nullif(auth.jwt()->>'session_id','')::uuid;
 completed integer;
begin
 if parent is null or not exists(select 1 from auth.sessions where id=auth_session and user_id=parent) then
  raise insufficient_privilege using message='An active parent sign-in is required';
 end if;
 if p_complete is true then
  insert into private.fairybucks_parent_guides(parent_id,completed_version) values(parent,1)
   on conflict(parent_id) do nothing;
 end if;
 select completed_version into completed from private.fairybucks_parent_guides where parent_id=parent;
 return jsonb_build_object('version',1,'completed',coalesce(completed,0)>=1);
end $$;
revoke all on function public.fairybucks_parent_guide(boolean) from public,anon,authenticated;
grant execute on function public.fairybucks_parent_guide(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
