import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path=pg_catalog as $$
 declare c record;begin
 for c in select * from pg_event_trigger_ddl_commands() where object_type='table' and schema_name='public' loop
 execute format('alter table %s enable row level security',c.object_identity);
 end loop;end $$;
 create event trigger ensure_rls on ddl_command_end when tag in ('CREATE TABLE') execute function public.rls_auto_enable();`);
 const original=(await db.query(`select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) as body`)).rows[0].body;
 const name=readdirSync(new URL('supabase/migrations',root)).find(n=>n.includes('restrict_maintenance_function'));
 await db.exec(readFileSync(new URL('supabase/migrations/'+name,root),'utf8'));
 await db.exec(readFileSync(new URL('supabase/checks/maintenance_function_security.sql',root),'utf8'));
 assert.equal((await db.query(`select pg_get_functiondef('public.rls_auto_enable()'::regprocedure) as body`)).rows[0].body,original);
 // The conditional migration must also work when a development database lacks this dashboard helper.
 await db.exec('drop event trigger ensure_rls;drop function public.rls_auto_enable();');
 await db.exec(readFileSync(new URL('supabase/migrations/'+name,root),'utf8'));
 console.log('PASS maintenance role denial, automatic RLS, unchanged helper and absent-helper compatibility');
} finally {await db.close();}
