import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';

// A disposable in-memory PostgreSQL instance. No external DB, token, API or network access.
// The three installed child-RPC bodies are literal snapshots read from live function
// definitions, not JS reimplementations. Crypto digest and permission helper are
// controlled test doubles: this does not certify actual pgcrypto or the full consent system.
const db = new PGlite();
const snapshot = readFileSync(new URL('./fixtures/child-rpc-live-2026-11-23.sql', import.meta.url), 'utf8');
const id = n => n.toString(16).padStart(8,'0')+'-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const parentA=id(1), parentB=id(2), childA=id(3), childB=id(4);
const itemA=id(5), itemB=id(6), requestB=id(7);
const tokenA='a'.repeat(64), tokenB='b'.repeat(64);
const call = async (token, action='view', request=null, shop=null, price=null) => {
  const {rows} = await db.query(
    'select public.fairybucks_child_action($1,$2,$3,$4,$5) as value',
    [token,action,request,shop,price]
  );
  return rows[0].value;
};
const countFor = async child =>
  Number((await db.query('select count(*)::int as n from public.treasure_requests where child_id=$1',[child])).rows[0].n);
const statusFor = async request =>
  (await db.query('select status from public.treasure_requests where id=$1',[request])).rows[0]?.status;
const setPermission = async (parent, allowed) =>
  db.query('update private.test_permission set allowed=$2 where parent_id=$1',[parent,allowed]);

try {
  await db.exec(`
    create schema private;
    create schema extensions;
    create table public.families(id uuid primary key, owner_id uuid not null);
    create table public.child_profiles(id uuid primary key, family_id uuid not null, nickname text not null);
    create table public.treasures(
      id uuid primary key, shop_key integer unique, name text not null, category text,
      fairy_price integer not null, is_active boolean not null default true
    );
    create table public.treasure_requests(
      id uuid primary key, child_id uuid not null, treasure_id uuid not null,
      price_at_request integer not null, status text not null,
      delivery_stage text, created_at timestamptz not null default now()
    );
    create table public.fairy_wallets(child_id uuid primary key, balance integer not null);
    create table public.lost_teeth(id uuid primary key, child_id uuid not null, corrected_at timestamptz);
    create table private.fairybucks_child_sessions(
      child_id uuid primary key, token_hash bytea not null unique, expires_at timestamptz not null
    );
    create table private.test_permission(parent_id uuid primary key, allowed boolean not null);
    -- Deterministic test stand-in for extensions.digest: matches synthetic fixture hashes.
    -- No claim about the actual SHA-256 implementation is made by this test.
    create function extensions.digest(input text, algorithm text)
      returns bytea language sql immutable strict
      as 'select decode(md5(input), ''hex'')';
    create function private.fairybucks_child_permission(p_parent uuid)
      returns boolean language sql stable
      as 'select coalesce((select allowed from private.test_permission where parent_id=p_parent),false)';
  `);

  for (const [parent,child,item,shop,price,token] of [
    [parentA,childA,itemA,10,9,tokenA],
    [parentB,childB,itemB,20,13,tokenB]
  ]) {
    await db.query('insert into public.families values ($1,$2)',[parent,parent]);
    await db.query('insert into public.child_profiles values ($1,$2,$3)',[child,parent,child===childA?'Explorer A':'Explorer B']);
    await db.query('insert into public.treasures values ($1,$2,$3,$4,$5,true)',[item,shop,'Treasure '+shop,'Learning',price]);
    await db.query('insert into public.fairy_wallets values ($1,20)',[child]);
    await db.query('insert into private.test_permission values ($1,true)',[parent]);
    await db.query(
      "insert into private.fairybucks_child_sessions values ($1,decode(md5($2),'hex'),clock_timestamp()+interval '1 hour')",
      [child,token]
    );
  }
  await db.query('insert into public.treasure_requests(id,child_id,treasure_id,price_at_request,status) values ($1,$2,$3,13,$4)',[requestB,childB,itemB,'pending']);
  await db.exec(snapshot);

  for(const bad of [null,'abc','A'.repeat(64),'a'.repeat(63),'c'.repeat(64)])
    assert.equal((await call(bad)).status,'expired','Missing/malformed/unknown token must fail closed');

  const a=await call(tokenA);
  assert.equal(a.status,'active','Valid session should work');
  assert.equal(a.nickname,'Explorer A');
  assert.equal(a.balance,20);
  assert.deepEqual(a.requests,[],'Explorer A must not see Explorer B requests');
  const b=await call(tokenB);
  assert.equal(b.status,'active');
  assert.equal(b.requests.length,1,'Explorer B must see only own requests');
  assert.equal(b.requests[0].id,requestB);

  assert.equal((await call(tokenA,'cancel',requestB)).status,'already_decided','A must not cancel B request');
  assert.equal(await statusFor(requestB),'pending');

  const forged=id(10);
  assert.equal((await call(tokenA,'request',forged,10,1)).status,'price_changed');
  assert.equal(await countFor(childA),0);
  assert.equal((await call(tokenA,'request',id(11),99,1)).status,'unavailable');
  assert.equal(await countFor(childA),0);

  const reqA=id(12);
  assert.equal((await call(tokenA,'request',reqA,10,9)).status,'requested');
  assert.equal(await countFor(childA),1);
  assert.equal((await call(tokenA,'request',reqA,10,9)).status,'requested','Same request id should be idempotent');
  assert.equal(await countFor(childA),1);
  assert.equal((await call(tokenA,'request',id(13),10,9)).status,'already_pending');
  assert.equal(await countFor(childA),1);
  const reqOther=id(14);
  assert.equal((await call(tokenA,'request',reqOther,20,13)).status,'insufficient_balance','Pending reservations reduce available balance');
  assert.equal(await countFor(childA),1);
  assert.equal((await call(tokenA,'cancel',reqA)).status,'cancelled');
  assert.equal(await statusFor(reqA),'cancelled');
  assert.equal((await call(tokenA,'cancel',reqA)).status,'cancelled','Cancelling an already-cancelled request stays idempotent');
  assert.equal((await call(tokenA,'request',reqOther,20,13)).status,'requested','Cancelled reservation frees pending balance');
  assert.equal(await countFor(childA),2);

  await setPermission(parentA,false);
  assert.equal((await call(tokenA)).status,'permission_required','Withdrawal must block child data');
  assert.equal((await call(tokenA,'request',id(15),10,9)).status,'permission_required','Withdrawal must block writes');
  assert.equal(await countFor(childA),2);
  await setPermission(parentA,true);

  await db.query("update private.fairybucks_child_sessions set expires_at=clock_timestamp()-interval '1 second' where child_id=$1",[childA]);
  assert.equal((await call(tokenA)).status,'expired','Expired token must fail closed');
  assert.equal((await call(tokenA,'request',id(16),10,9)).status,'expired');
  assert.equal((await call(tokenA,'end')).status,'ended','End should permit cleanup even of expired session');
  assert.equal((await call(tokenA)).status,'expired','Ended token must not reload');
  assert.equal((await call(tokenB)).status,'active','Ending token A must not end token B');
  assert.equal(await statusFor(requestB),'pending','Explorer B request must remain unchanged');

  await db.query("update public.treasure_requests set status='approved' where id=$1",[requestB]);
  assert.equal((await call(tokenB,'cancel',requestB)).status,'already_decided','Approved request cannot be cancelled by child');
  assert.equal(await statusFor(requestB),'approved');
  console.log('PASS isolated child-RPC: invalid/unknown/expired/ended tokens, cross-explorer read/cancel, permission withdrawal, price validation, pending balance and idempotence');
} finally {
  await db.close();
}
