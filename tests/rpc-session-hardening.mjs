import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const migration = readFileSync(new URL('../supabase/migrations/20261123235000_require_live_session_for_treasure_listing.sql', import.meta.url), 'utf8');
const parentA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const parentB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const explorerA = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const item = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const request = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
try {
  await db.exec(`
    create schema auth;
    create table auth.sessions(id uuid primary key, user_id uuid not null);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''test.parent'', true), '''')::uuid';
    create function auth.jwt() returns jsonb language sql stable as
      'select coalesce(nullif(current_setting(''test.jwt'', true), '''')::jsonb, ''{}''::jsonb)';
    create table public.families(id uuid primary key, owner_id uuid not null);
    create table public.child_profiles(id uuid primary key, family_id uuid not null);
    create table public.treasures(id uuid primary key, name text not null);
    create table public.treasure_requests(
      id uuid primary key, child_id uuid not null, treasure_id uuid not null,
      price_at_request integer not null, status text not null, delivery_stage text,
      created_at timestamptz default now()
    );
    create function public.fairybucks_list_treasure_requests(p_child_id uuid)
    returns table(id uuid,name text,price integer,status text,delivery_stage text)
    language sql stable security definer set search_path to ''
    as 'select r.id,t.name,r.price_at_request,r.status,r.delivery_stage
         from public.treasure_requests r join public.treasures t on t.id=r.treasure_id
         where r.child_id=p_child_id';
  `);
  await db.query('insert into auth.sessions values ($1,$2)',[sessionA,parentA]);
  await db.query('insert into public.families values ($1,$2)',[parentA,parentA]);
  await db.query('insert into public.child_profiles values ($1,$2)',[explorerA,parentA]);
  await db.query('insert into public.treasures values ($1,$2)',[item,'Test treasure']);
  await db.query('insert into public.treasure_requests(id,child_id,treasure_id,price_at_request,status,delivery_stage) values ($1,$2,$3,7,$4,$5)',[request,explorerA,item,'pending','building']);

  await db.exec(migration);
  const query = () => db.query('select * from public.fairybucks_list_treasure_requests($1)',[explorerA]);
  const signedIn = async (parent, session) => {
    await db.query('select set_config($1,$2,false)', ['test.parent',parent]);
    await db.query('select set_config($1,$2,false)', ['test.jwt',JSON.stringify(session ? {session_id:session}:{})]);
    return (await query()).rows;
  };
  assert.equal((await signedIn(parentA,sessionA)).length,1,'Valid owner session must list own request');
  assert.equal((await signedIn(parentB,sessionA)).length,0,'Different parent cannot list another family');
  assert.equal((await signedIn(parentA,null)).length,0,'Missing session_id must fail closed');
  await db.query('delete from auth.sessions where id=$1',[sessionA]);
  assert.equal((await signedIn(parentA,sessionA)).length,0,'Revoked session must fail closed');
  await db.query('insert into auth.sessions values ($1,$2)',[sessionA,parentB]);
  assert.equal((await signedIn(parentA,sessionA)).length,0,'Session belonging to another user must fail closed');
  assert.equal((await signedIn(parentB,sessionA)).length,0,'Other user still lacks family ownership');
  console.log('PASS treasure request listing requires live, matching parent Auth session and family ownership');
} finally {
  await db.close();
}
