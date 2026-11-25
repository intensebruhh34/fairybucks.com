import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

// Full deletion paths in a disposable PGlite DB. Fictional data only.
// Executes read-only snapshots of installed deletion RPC bodies.
// Auth claims, digest, PIN verification and throttling are test doubles.
const db = new PGlite();
const uuid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const A=uuid(1),B=uuid(2),SA=uuid(3),SB=uuid(4),CA=uuid(5),SIB=uuid(6),CB=uuid(7);
const RA=uuid(8),RS=uuid(9),RB=uuid(10),T=uuid(11),UNLOCK='a'.repeat(64);
const sql=(s,args=[])=>db.query(s,args);
const one=async(s,args=[])=> (await sql(s,args)).rows[0];
const n=async(table,col,value)=>Number((await one('select count(*)::int n from '+table+' where '+col+'=$1',[value])).n);
async function as(parent,session,recent=false){
 await sql("select set_config('test.user',$1,false)",[parent||'']);
 await sql("select set_config('test.sid',$1,false)",[session||'']);
 await sql("select set_config('test.recent',$1,false)",[recent?'yes':'no']);
}
async function pin(v){await sql("select set_config('test.pin',$1,false)",[v]);}
const delExplorer=(child,expectedParent=A,nickname='A Child',confirmation=null,pinText=null)=>
 sql('select public.fairybucks_delete_explorer($1,$2,$3,$4,$5) v',[child,expectedParent,nickname,confirmation,pinText]).then(r=>r.rows[0].v);
const delAccount=(confirmation=null,token=null,parent=A)=>
 sql('select public.fairybucks_delete_account($1,$2,$3) v',[confirmation,token,parent]).then(r=>r.rows[0].v);
const rejected=async(work,why)=>assert.rejects(work,/sign|current|required|unavailable|delete|account|violates|foreign|key|constraint/i,why);
try {
 await db.exec(`
 create schema auth;create schema private;create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 create function auth.uid() returns uuid language sql stable as
 'select nullif(current_setting(''test.user'',true),'''')::uuid';
 create function auth.jwt() returns jsonb language sql stable as
 'select (case when nullif(current_setting(''test.sid'',true),'''') is null then ''{}''::jsonb else jsonb_build_object(''session_id'',current_setting(''test.sid'',true)) end) || (case when current_setting(''test.recent'',true)=''yes'' then jsonb_build_object(''amr'',jsonb_build_array(jsonb_build_object(''method'',''password'',''timestamp'',floor(extract(epoch from clock_timestamp()))::bigint))) else ''{}''::jsonb end)';
 create function extensions.digest(input text,algorithm text) returns bytea language sql immutable strict as
 'select decode(md5(input),''hex'')';
 create table public.families(id uuid primary key,owner_id uuid not null references auth.users(id));
 create table public.child_profiles(
 id uuid primary key,family_id uuid references public.families(id),nickname text,age integer,gender text);
 create table public.treasures(id uuid primary key,name text,is_active boolean,shop_key integer,fairy_price integer);
 create table public.treasure_requests(id uuid primary key,child_id uuid references public.child_profiles(id),
 treasure_id uuid,price_at_request integer,status text,delivery_stage text,created_at timestamptz default now());
 create table public.fairy_wallets(child_id uuid primary key references public.child_profiles(id),balance integer,updated_at timestamptz default now());
 create table public.fairy_transactions(id uuid primary key default gen_random_uuid(),child_id uuid references public.child_profiles(id),amount integer,description text);
 create table public.lost_teeth(id uuid primary key,child_id uuid references public.child_profiles(id),lost_on date,corrected_at timestamptz);
 create table private.fairybucks_parent_unlocks(parent_id uuid primary key,session_id uuid,token_hash bytea,expires_at timestamptz);
 create table private.parent_pin_security(parent_id uuid primary key);
 create table private.fairybucks_child_sessions(child_id uuid primary key references public.child_profiles(id),token_hash bytea,expires_at timestamptz);
 create table private.fairybucks_tooth_rewards(parent_id uuid primary key,amount integer);
 create table private.fairybucks_parent_guides(parent_id uuid primary key);
 create table private.fairybucks_pin_recoveries(parent_id uuid primary key);
 create function public.fairybucks_parent_pin(p_pin text,p_setup boolean) returns jsonb
 language sql stable as 'select jsonb_build_object(''status'',case when p_pin=current_setting(''test.pin'',true) then ''unlocked'' else ''incorrect_pin'' end)';
 `);
 await sql("insert into auth.users values($1,'a@example.invalid',clock_timestamp()),($2,'b@example.invalid',clock_timestamp())",[A,B]);
 await sql('insert into auth.sessions values($1,$2),($3,$4)',[SA,A,SB,B]);
 await sql('insert into public.families values($1,$1),($2,$2)',[A,B]);
 await sql("insert into public.child_profiles values($1,$2,'A Child',7,'rather-not-say'),($3,$2,'Sibling',9,'rather-not-say'),($4,$5,'B Child',8,'rather-not-say')",[CA,A,SIB,CB,B]);
 await sql("insert into public.treasures values($1,'Treasury',true,1,8)",[T]);
 await sql('insert into public.fairy_wallets(child_id,balance) values($1,20),($2,30),($3,40)',[CA,SIB,CB]);
 await sql("insert into public.treasure_requests(id,child_id,treasure_id,price_at_request,status) values($1,$2,$7,8,'pending'),($3,$4,$7,8,'pending'),($5,$6,$7,8,'pending')",[RA,CA,RS,SIB,RB,CB,T]);
 for(const child of [CA,SIB,CB]) {
  await sql("insert into public.lost_teeth values($1,$2,current_date,null)",[uuid(100+[CA,SIB,CB].indexOf(child)),child]);
  await sql("insert into public.fairy_transactions(child_id,amount,description) values($1,5,'reward')",[child]);
  await sql("insert into private.fairybucks_child_sessions values($1,decode(md5($2),'hex'),clock_timestamp()+interval '1 hour')",[child,child]);
 }
 await sql('insert into private.parent_pin_security values($1),($2)',[A,B]);
 await sql('insert into private.fairybucks_tooth_rewards values($1,5),($2,5)',[A,B]);
 await sql("insert into private.fairybucks_parent_unlocks values($1,$2,decode(md5($3),'hex'),clock_timestamp()+interval '15 minutes')",[A,SA,UNLOCK]);
 const fixture=readFileSync(new URL('./fixtures/privileged-rpc-live-2026-11-23.sql',import.meta.url),'utf8');
 // Only install deletion RPCs; other public procedures depend on unrelated fixtures.
 for(const name of ['fairybucks_delete_explorer','fairybucks_delete_account']){
  const start=fixture.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
  assert.ok(start>=0,'Missing installed definition: '+name);
  const end=fixture.indexOf('$function$',fixture.indexOf('AS $function$',start)+13);
  assert.ok(end>=0,'Missing function terminator for '+name);
  await db.exec(fixture.slice(start,end+'$function$'.length)+';');
 }
 await as(A,SA,true);await pin('123456');
 assert.equal((await delExplorer(CA)).status,'ready');
 assert.equal((await delExplorer(CB)).status,'unavailable','Cannot delete other parent explorer');
 assert.equal((await delExplorer(CA,A,'Stale', 'DELETE','123456')).status,'changed');
 assert.equal((await delExplorer(CA,A,'A Child','wrong','123456')).status,'confirmation_required');
 assert.equal((await delExplorer(CA,A,'A Child','DELETE','12')).status,'invalid_pin');
 await pin('654321');
 assert.equal((await delExplorer(CA,A,'A Child','DELETE','123456')).status,'incorrect_pin');
 await pin('123456');
 assert.equal(await n('public.child_profiles','id',CA),1,'Bad PIN must not delete');
 // Unexpected dependent table forces atomic rollback, including child session deletion.
 await db.exec('create table public.deletion_blocker(child_id uuid references public.child_profiles(id));');
 await sql('insert into public.deletion_blocker values($1)',[CA]);
 await rejected(()=>delExplorer(CA,A,'A Child','DELETE','123456'),'Unexpected foreign key forces rollback');
 assert.equal(await n('public.child_profiles','id',CA),1);
 assert.equal(await n('private.fairybucks_child_sessions','child_id',CA),1);
 await db.exec('drop table public.deletion_blocker');
 assert.equal((await delExplorer(CA,A,'A Child','DELETE','123456')).status,'deleted');
 for(const table of ['child_profiles','fairy_wallets','fairy_transactions','lost_teeth','treasure_requests']){
  assert.equal(await n('public.'+table,table==='child_profiles'?'id':'child_id',CA),0,table+' deleted');
 }
 assert.equal(await n('private.fairybucks_child_sessions','child_id',CA),0);
 assert.equal(await n('public.child_profiles','id',SIB),1,'Sibling remains');
 assert.equal(await n('public.child_profiles','id',CB),1,'Other family remains');
 assert.equal(await n('auth.users','id',A),1,'Parent account remains after explorer deletion');
 assert.equal((await delExplorer(CA)).status,'unavailable','Deleted explorer cannot be targeted twice');
 // Separate account deletion permission path, with intentionally no remaining unlock.
 assert.equal((await delAccount(null,null,A)).status,'ready','Recent sign-in permits review');
 await as(A,SA,false);
 assert.equal((await delAccount('DELETE',UNLOCK,A)).status,'reauth_required','Old sign-in blocks deletion');
 await as(A,SB,true);
 await rejected(()=>delAccount('DELETE',UNLOCK,A),'Wrong session blocks deletion');
 await as(A,SA,true);
 assert.equal((await delAccount('wrong',UNLOCK,A)).status,'confirmation_required');
 assert.equal((await delAccount('DELETE',null,A)).status,'unlock_required');
 // Restore parent PIN unlock consumed by explorer deletion.
 await sql("insert into private.fairybucks_parent_unlocks values($1,$2,decode(md5($3),'hex'),clock_timestamp()+interval '15 minutes')",[A,SA,UNLOCK]);
 // Unknown dependent row blocks account deletion and rolls back the entire deletion transaction.
 await db.exec('create table public.account_blocker(parent_id uuid references auth.users(id));');
 await sql('insert into public.account_blocker values($1)',[A]);
 await rejected(()=>delAccount('DELETE',UNLOCK,A),'Unexpected dependent account data must roll back');
 assert.equal(await n('auth.users','id',A),1);
 assert.equal(await n('auth.sessions','user_id',A),1);
 assert.equal(await n('public.child_profiles','id',SIB),1);
 await db.exec('drop table public.account_blocker');
 assert.equal((await delAccount('DELETE',UNLOCK,A)).status,'deleted');
 for(const table of ['auth.users','auth.sessions','public.families','private.fairybucks_parent_unlocks','private.parent_pin_security']){
  assert.equal(await n(table,table==='auth.sessions'?'user_id':table==='public.families'?'owner_id':'parent_id'===table?'parent_id':(['auth.users'].includes(table)?'id':'parent_id'),A),0,table+' removed for parent A');
 }
 assert.equal(await n('public.child_profiles','id',SIB),0);
 assert.equal(await n('auth.users','id',B),1,'Other parent remains');
 assert.equal(await n('public.child_profiles','id',CB),1,'Other family explorer remains');
 console.log('PASS isolated deletion: ownership, confirmation, PIN, fresh reauth, dependency rollback, sibling preservation, child cleanup, account/session deletion');
}finally{await db.close();}
