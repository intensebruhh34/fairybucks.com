-- Run after installation. Creates one empty probe table, then rolls it back.
begin;
do $$
begin
 if to_regprocedure('public.rls_auto_enable()') is null then
  raise exception 'Expected maintenance helper is missing';end if;
 if exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
  and has_function_privilege(r.oid,'public.rls_auto_enable()'::regprocedure,'execute')) then
  raise exception 'Maintenance helper still has application-role execution';end if;
 if not exists(select 1 from pg_event_trigger where evtfoid='public.rls_auto_enable()'::regprocedure and evtenabled='O') then
  raise exception 'Maintenance event trigger missing or disabled';end if;
end $$;
create table public.fairybucks_security_rls_probe(id integer);
do $$begin
 if not exists(select 1 from pg_class where oid='public.fairybucks_security_rls_probe'::regclass and relrowsecurity) then
  raise exception 'Automatic RLS stopped working';end if;
end $$;
select 'PASS maintenance grants restricted; automatic RLS still works' as result;
rollback;
