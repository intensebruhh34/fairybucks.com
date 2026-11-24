import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Synthetic fixture exercising installed production function bodies. No live data or credentials.
// This is an authorization/financial regression test, not a live Supabase pen test.
// The digest is a controlled stand-in. Auth identity and session claims are simulated.
const db=new PGlite();
const uid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const A=uid(1),B=uid(2),SA=uid(3),SB=uid(4),CA=uid(5),CB=uid(6),TA=uid(7),TB=uid(8),RA=uid(9),RB=uid(10),TOOTH=uid(11);
const TOKEN='a'.repeat(64);
const sql=(s,args=[])=>db.query(s,args);
const run=async(name,...args)=>(await sql('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') as result',args)).rows[0].result;
const as=async(parent,session)=>{
 await sql("select set_config('test.user',$1,false)",[parent??'']);
 await sql("select set_config('test.sid',$1,false)",[session??'']);
};
const assertDenied=async(p,label)=>{await assert.rejects(p,/signed-in|current parent|unavailable|session|required|sign in/i,label)};
const balance=async c=>(await sql('select balance from public.fairy_wallets where child_id=$1',[c])).rows[0].balance;
const reqStatus=async r=>(await sql('select status from public.treasure_requests where id=$1',[r])).rows[0].status;
try{
await db.exec(`
create schema auth;create schema private;create schema extensions;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid not null);
create function auth.uid() returns uuid language sql stable as
 'select nullif(current_setting(''test.user'',true),'''')::uuid';
create function auth.jwt() returns jsonb language sql stable as
 'select case when coalesce(current_setting(''test.sid'',true),'''')='''' then ''{}''::jsonb else jsonb_build_object(''session_id'',current_setting(''test.sid'',true)) end';
create function extensions.digest(input text,algorithm text) returns bytea language sql immutable strict
 as 'select decode(md5(input),''hex'')';
create table public.families(id uuid primary key,owner_id uuid not null);
create table public.child_profiles(
 id uuid primary key,family_id uuid not null,nickname text,age integer,gender text);
create table public.treasures(id uuid primary key,name text,is_active boolean,shop_key integer,fairy_price integer);
create table public.treasure_requests(
 id uuid primary key,child_id uuid,treasure_id uuid,price_at_request integer,status text,
 delivery_stage text,created_at timestamptz default now());
create table public.fairy_wallets(child_id uuid primary key,balance integer,updated_at timestamptz default now());
create table public.fairy_transactions(
 id uuid primary key default gen_random_uuid(),child_id uuid,amount integer,description text);
create table public.lost_teeth(id uuid primary key,child_id uuid,lost_on date,corrected_at timestamptz);
create table private.fairybucks_parent_unlocks(
 parent_id uuid primary key,session_id uuid,token_hash bytea,expires_at timestamptz);
create table private.fairybucks_tooth_rewards(parent_id uuid primary key,amount integer);
create table private.parent_pin_security(parent_id uuid primary key);
create table private.fairybucks_child_sessions(child_id uuid primary key,token_hash bytea,expires_at timestamptz);
create table private.fairybucks_parent_guides(parent_id uuid primary key);
create table private.fairybucks_pin_recoveries(parent_id uuid primary key);
create table private.fairybucks_purchase_options(
 treasure_id uuid primary key,product_version text,observed_price_cents integer,
 price_checked_on date,purchase_url text);
create function public.fairybucks_parent_pin(p_pin text,p_setup boolean)
 returns jsonb language sql as 'select jsonb_build_object(''status'',''invalid_pin'')';
create function public.fairybucks_parent_guide(p_complete boolean)
 returns jsonb language sql as 'select jsonb_build_object(''status'',''saved'')';
create function private.fairybucks_child_permission(parent uuid)
 returns boolean language sql as 'select false';
`);
await sql("insert into auth.users values($1,'a@example.invalid',clock_timestamp()),($2,'b@example.invalid',clock_timestamp())",[A,B]);
await sql('insert into auth.sessions values($1,$2),($3,$4)',[SA,A,SB,B]);
await sql('insert into public.families values($1,$1),($2,$2)',[A,B]);
await sql("insert into public.child_profiles values($1,$2,'Child A',7,'rather-not-say'),($3,$4,'Child B',7,'rather-not-say')",[CA,A,CB,B]);
await sql("insert into public.treasures values($1,'Treasure A',true,1,8),($2,'Treasure B',true,2,10)",[TA,TB]);
await sql('insert into public.fairy_wallets(child_id,balance) values($1,20),($2,30)',[CA,CB]);
await sql("insert into private.fairybucks_parent_unlocks values($1,$2,decode(md5($3),'hex'),clock_timestamp()+interval '30 minutes'),($4,$5,decode(md5($3),'hex'),clock_timestamp()+interval '30 minutes')",[A,SA,TOKEN,B,SB]);
await sql('insert into private.fairybucks_tooth_rewards values($1,5),($2,5)',[A,B]);
await sql("insert into public.treasure_requests(id,child_id,treasure_id,price_at_request,status,delivery_stage) values($1,$2,$3,8,'pending','workshop'),($4,$5,$6,10,'pending','workshop')",[RA,CA,TA,RB,CB,TB]);
await db.exec(readFileSync(new URL('./fixtures/privileged-rpc-live-2026-11-23.sql',import.meta.url),'utf8'));
const cases=[
 ['fairybucks_record_tooth',[CA,TOOTH,'2026-11-20',TOKEN]],
 ['fairybucks_undo_tooth',[CA,TOOTH,TOKEN]],
 ['fairybucks_tooth_reward',[CA,TOKEN,5]],
 ['fairybucks_decide_treasure',[CA,RA,'approved',TOKEN]],
 ['fairybucks_update_delivery',[CA,RA,'packaging','workshop',TOKEN]],
 ['fairybucks_delete_explorer',[CA,A,'Child A','DELETE','123456']],
 ['fairybucks_delete_account',['DELETE',TOKEN,A]],
 ['fairybucks_parent_purchase',[CA,RA,TOKEN]],
 ['fairybucks_edit_explorer',[CA,'Safe',7,'rather-not-say',A,{}]],
 ['fairybucks_parent_setup',['status',A,null,null,null,'rather-not-say',null,null]]
];
for(const [name,args] of cases){
 await as(null,null);
 await assertDenied(()=>run(name,...args),name+' must deny anonymous');
 await as(A,null);
 await assertDenied(()=>run(name,...args),name+' must deny missing session');
 await as(A,SB);
 await assertDenied(()=>run(name,...args),name+' must deny another parent session');
}
await as(A,SA);
// Parent A must not change/view Parent B assets even with a valid A unlock.
for(const [name,args] of [
 ['fairybucks_record_tooth',[CB,TOOTH,'2026-11-20',TOKEN]],
 ['fairybucks_undo_tooth',[CB,TOOTH,TOKEN]],
 ['fairybucks_tooth_reward',[CB,TOKEN,5]],
 ['fairybucks_decide_treasure',[CB,RB,'approved',TOKEN]],
 ['fairybucks_update_delivery',[CB,RB,'packaging','workshop',TOKEN]],
]) await assertDenied(()=>run(name,...args),name+' must deny another parent asset');
assert.equal((await run('fairybucks_parent_purchase',CB,RB,TOKEN)).status,'unavailable','Private purchasing option must not leak across families');
assert.equal((await run('fairybucks_delete_explorer',CB,A,'Child B','DELETE','123456')).status,'unavailable');
assert.equal((await run('fairybucks_edit_explorer',CB,'Unsafe',7,'rather-not-say',A,{})).status,'unavailable');
assert.equal(await balance(CB),30);
assert.equal(await reqStatus(RB),'pending');
assert.equal((await sql('select count(*)::int n from public.lost_teeth')).rows[0].n,0,'No forged cross-family tooth');

// Verify unlock gating on value-changing and parent-only financial actions.
for(const [name,args,expected] of [
 ['fairybucks_record_tooth',[CA,TOOTH,'2026-11-20',null],'unlock_required'],
 ['fairybucks_undo_tooth',[CA,TOOTH,null],'unlock_required'],
 ['fairybucks_tooth_reward',[CA,null,100],'unlock_required'],
 ['fairybucks_decide_treasure',[CA,RA,'approved',null],'unlock_required'],
 ['fairybucks_update_delivery',[CA,RA,'packaging','workshop',null],'unlock_required'],
 ['fairybucks_parent_purchase',[CA,RA,null],'unlock_required']
]){
 const result=await run(name,...args);
 assert.equal(typeof result==='object'?result.status:result,expected,name+' must require unlock');
}
assert.equal((await run('fairybucks_tooth_reward',CA,TOKEN,101)).status,'invalid_amount');
assert.equal((await run('fairybucks_tooth_reward',CA,TOKEN,-1)).status,'invalid_amount');
assert.equal((await run('fairybucks_tooth_reward',CA,TOKEN,7)).amount,7);
assert.equal(await run('fairybucks_record_tooth',CA,TOOTH,'2026-11-20',TOKEN),'saved');
assert.equal(await balance(CA),27);
assert.equal(await run('fairybucks_record_tooth',CA,TOOTH,'2026-11-20',TOKEN),'saved','Tooth replay must not credit twice');
assert.equal(await balance(CA),27);
assert.equal(await run('fairybucks_undo_tooth',CA,TOOTH,TOKEN),'undone');
assert.equal(await balance(CA),20);
assert.equal(await run('fairybucks_undo_tooth',CA,TOOTH,TOKEN),'undone','Undo replay must not debit twice');
assert.equal(await balance(CA),20);
assert.equal(await run('fairybucks_decide_treasure',CA,RA,'approved',TOKEN),'approved');
assert.equal(await reqStatus(RA),'approved');
assert.equal(await balance(CA),12);
assert.equal(await run('fairybucks_decide_treasure',CA,RA,'approved',TOKEN),'approved');
assert.equal(await balance(CA),12,'Approval replay must not debit twice');
assert.equal(await run('fairybucks_update_delivery',CA,RA,'landed','workshop',TOKEN),'invalid_stage');
assert.equal(await run('fairybucks_update_delivery',CA,RA,'packaging','workshop',TOKEN),'saved');
assert.equal(await run('fairybucks_update_delivery',CA,RA,'refunded','packaging',TOKEN),'refunded');
assert.equal(await balance(CA),20,'Refund restores the approved price');
assert.equal(await run('fairybucks_update_delivery',CA,RA,'refunded','refunded',TOKEN),'refunded');
assert.equal(await balance(CA),20,'Refund replay must not credit twice');
assert.equal(await balance(CB),30);
assert.equal(await reqStatus(RB),'pending');
console.log('PASS isolated privileged RPCs: 10 no-session checks, 8 cross-family checks, protected financial writes, tooth idempotence, approval and refund idempotence');
}finally{await db.close();}
