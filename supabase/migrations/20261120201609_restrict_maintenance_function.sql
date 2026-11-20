-- Maintenance event triggers do not need application-role execution grants.
-- Preserve the existing function definition, owner and event-trigger attachment.
begin;
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is not null then
  if (select prorettype from pg_proc where oid='public.rls_auto_enable()'::regprocedure)<>'pg_catalog.event_trigger'::regtype then
   raise exception 'Unexpected rls_auto_enable signature; review before changing grants';
  end if;
  revoke all on function public.rls_auto_enable() from public,anon,authenticated,service_role;
 end if;
end $$;
commit;
