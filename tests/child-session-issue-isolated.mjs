import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Local, disposable database with synthetic identifiers; never touches live families.
// Uses the exact installed child-session issuance RPC bodies from a read-only snapshot.
// Auth claims, consent, digest and token randomness are synthetic test substitutes.
const db = new PGlite();
const id = n => n.toString(16).padStart(8,'0')+'-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const A=id(1),B=id(2),SA=id(3),SB=id(4),CA=id(5),CB=id(6);
const unlock='a'.repeat(64), expectedToken='ab'.repeat(32);
const fixture=readFileSync(new URL('./fixtures/child-session-issue-live-2026-11-23.sql',import.meta.url),'utf8');

async function asParent(parent,session){
  await db.query("select set_config('test.parent',$1,false)",[parent??'']);
  await db.query("select set_config('test.session',$1,false)",[session??'']);
}
async function start(explorer,token=unlock){
  const r=await db.query('select public.fairybucks_start_child_session($1,$2) as token',[explorer,token]);
  return r.rows[0].token;
}
async function shouldReject(f, message){
  await assert.rejects(f, /permission|signed-in|unavailable|required/i, message);
}
async function grantUnlock(parent,session){
  await db.query(
    "insert into private.fairybucks_parent_unlocks values ($1,$2,decode(md5($3),'hex'),clock_timestamp()+interval '15 minutes') on conflict (parent_id) do update set session_id=excluded.session_id,token_hash=excluded.token_hash,expires_at=excluded.expires_at",
    [parent,session,unlock]
  );
}
async function rowCount(child){
  const r=await db.query('select count(*)::int n from private.fairybucks_child_sessions where child_id=$1',[child]);
  return Number(r.rows[0].n);
}

try{
  await db.exec(`
    create schema private;create schema auth;create schema extensions;
    create table auth.sessions(id uuid primary key,user_id uuid not null);
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''test.parent'',true),'''')::uuid';
    create function auth.jwt() returns jsonb language sql stable as
      'select case when coalesce(current_setting(''test.session'',true),'''')='''' then ''{}''::jsonb else jsonb_build_object(''session_id'',current_setting(''test.session'',true)) end';
    create table public.families(id uuid primary key,owner_id uuid not null);
    create table public.child_profiles(id uuid primary key,family_id uuid not null);
    create table private.fairybucks_parent_unlocks(
      parent_id uuid primary key,session_id uuid not null,token_hash bytea not null,expires_at timestamptz not null
    );
    create table private.fairybucks_child_sessions(
      child_id uuid primary key,token_hash bytea not null unique,expires_at timestamptz not null
    );
    create table private.test_permission(parent_id uuid primary key,allowed boolean not null);
    create function private.fairybucks_child_permission(p_parent uuid)
      returns boolean language sql stable as
      'select coalesce((select allowed from private.test_permission where parent_id=p_parent),false)';
    create function extensions.digest(input text,algorithm text) returns bytea
      language sql immutable strict as 'select decode(md5(input),''hex'')';
    create function extensions.gen_random_bytes(count integer) returns bytea
      language sql volatile strict as 'select decode(repeat(''ab'',count),''hex'')';
  `);
  await db.query('insert into auth.sessions values ($1,$2),($3,$4)',[SA,A,SB,B]);
  await db.query('insert into public.families values ($1,$1),($2,$2)',[A,B]);
  await db.query('insert into public.child_profiles values ($1,$2),($3,$4)',[CA,A,CB,B]);
  await db.query('insert into private.test_permission values ($1,true),($2,true)',[A,B]);
  await db.exec(fixture);

  // Token issuance requires BOTH parental consent and an actual live Auth session.
  await asParent(A,null);await grantUnlock(A,SA);
  await shouldReject(()=>start(CA),'Missing Auth session must fail');
  assert.equal(await rowCount(CA),0);

  await asParent(A,SB);
  await shouldReject(()=>start(CA),'Other parent Auth session must fail');
  assert.equal(await rowCount(CA),0);

  await asParent(A,SA);
  await db.query('delete from auth.sessions where id=$1',[SA]);
  await shouldReject(()=>start(CA),'Revoked Auth session must fail');
  assert.equal(await rowCount(CA),0);
  await db.query('insert into auth.sessions values ($1,$2)',[SA,A]);

  await db.query('update private.test_permission set allowed=false where parent_id=$1',[A]);
  await shouldReject(()=>start(CA),'Withdrawn consent must block issuance');
  assert.equal(await rowCount(CA),0);
  await db.query('update private.test_permission set allowed=true where parent_id=$1',[A]);

  assert.equal(await start(CA,'broken'),null,'Malformed unlock token must fail');
  assert.equal(await rowCount(CA),0);
  assert.equal(await start(CA,'b'.repeat(64)),null,'Incorrect unlock token must fail');
  assert.equal(await rowCount(CA),0);
  await db.query("update private.fairybucks_parent_unlocks set expires_at=clock_timestamp()-interval '1 second' where parent_id=$1",[A]);
  assert.equal(await start(CA),null,'Expired unlock must fail');
  assert.equal(await rowCount(CA),0);
  await grantUnlock(A,SA);

  await shouldReject(()=>start(CB),'Cross-family explorer must reject');
  assert.equal(await rowCount(CB),0);

  const childToken=await start(CA);
  assert.equal(childToken,expectedToken,'Successful parent handoff should return generated token');
  assert.equal(await rowCount(CA),1);
  const stored=(await db.query('select token_hash,expires_at from private.fairybucks_child_sessions where child_id=$1',[CA])).rows[0];
  assert.notEqual(stored.token_hash,childToken,'Database must store hash, not plaintext token');
  assert.ok(new Date(stored.expires_at).getTime()>Date.now(),'Session expiry must be in future');
  assert.equal((await db.query('select count(*)::int n from private.fairybucks_parent_unlocks where parent_id=$1',[A])).rows[0].n,0,'Parent PIN unlock consumed on handoff');
  assert.equal(await start(CA),null,'Consumed unlock cannot create another session');
  assert.equal(await rowCount(CA),1);
  console.log('PASS isolated issuance: signed-in live parent session, permission, family scoping, unlock validity, hashed handoff token, unlock consumption');
}finally{await db.close();}
