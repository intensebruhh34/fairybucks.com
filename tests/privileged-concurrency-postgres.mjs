import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';

// Parallel requests use DISTINCT psql processes/sessions against a disposable
// PostgreSQL GitHub Actions service. No real Supabase project is contacted.
// The SQL bodies are exact read-only snapshots of installed production RPCs.
// Auth is simulated using per-session GUCs; PostgreSQL row locks are real.
const root = new URL('./', import.meta.url);
const source=readFileSync(new URL('./fixtures/privileged-rpc-live-2026-11-23.sql',root),'utf8');
const helper=readFileSync(new URL('./fixtures/private-treasure-submit-live-2026-11-23.sql',root),'utf8');
const uuid=n=>n.toString(16).padStart(8,'0')+'-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const A=uuid(1),SID=uuid(2),TREASURE_A=uuid(3),TREASURE_B=uuid(4),REQ_APPROVE=uuid(5),REQ_REFUND=uuid(6),TOOTH=uuid(7);
const C1=uuid(11),C2=uuid(12),C3=uuid(13),C4=uuid(14),C5=uuid(15),C6=uuid(16),TOOTH6=uuid(17);
const U='a'.repeat(64);
function functionSql(name){
 const start=source.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');
 assert.ok(start>=0,'Missing installed body '+name);
 const first=source.indexOf('$function$',start);
 const second=source.indexOf('$function$',first+10);
 assert.ok(second>first,'Missing function closing tag '+name);
 return source.slice(start,second+10)+';';
}
async function psql(input){
 return new Promise((resolve,reject)=>{
  const proc=spawn('psql',['-X','-Atq','-v','ON_ERROR_STOP=1'],{env:process.env});
  let out='',err='';
  proc.stdout.on('data',d=>out+=d);
  proc.stderr.on('data',d=>err+=d);
  proc.on('error',reject);
  proc.on('close',code=>code===0?resolve(out.trim()):reject(Error('psql exited '+code+': '+err.slice(-2500))));
  proc.stdin.end(input+'\n');
 });
}
const authSql=(command,delay='0.15')=>`
BEGIN;
SET LOCAL "test.user" = '${A}';
SET LOCAL "test.sid" = '${SID}';
SELECT pg_sleep(${delay});
SELECT ${command};
COMMIT;`;
const simultaneous=async (c1,c2)=>{
 const [a,b]=await Promise.all([psql(authSql(c1)),psql(authSql(c2))]);
 return [a,b].map(x=>x.split(/\r?\n/).filter(Boolean).at(-1));
};
const scalar=async expr=>(await psql('SELECT '+expr+';')).trim();
await psql(`
CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE TABLE auth.users(id uuid primary key);
CREATE TABLE auth.sessions(id uuid primary key,user_id uuid not null);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql stable AS
 'select nullif(current_setting(''test.user'',true),'''')::uuid';
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql stable AS
 'select jsonb_build_object(''session_id'',current_setting(''test.sid'',true))';
CREATE TABLE public.families(id uuid primary key,owner_id uuid not null);
CREATE TABLE public.child_profiles(id uuid primary key,family_id uuid not null,nickname text);
CREATE TABLE public.treasures(
 id uuid primary key,name text,is_active boolean,shop_key integer unique,fairy_price integer);
CREATE TABLE public.treasure_requests(
 id uuid primary key,child_id uuid,treasure_id uuid,price_at_request integer,status text,
 delivery_stage text,created_at timestamptz default clock_timestamp());
CREATE TABLE public.fairy_wallets(
 child_id uuid primary key,balance integer,updated_at timestamptz default clock_timestamp());
CREATE TABLE public.fairy_transactions(
 id uuid primary key default gen_random_uuid(),child_id uuid,amount integer,description text);
CREATE TABLE public.lost_teeth(id uuid primary key,child_id uuid,lost_on date,corrected_at timestamptz);
CREATE TABLE private.fairybucks_parent_unlocks(
 parent_id uuid primary key,session_id uuid,token_hash bytea,expires_at timestamptz);
CREATE TABLE private.fairybucks_tooth_rewards(parent_id uuid primary key,amount integer);
INSERT INTO auth.users VALUES ('${A}');
INSERT INTO auth.sessions VALUES ('${SID}','${A}');
INSERT INTO public.families VALUES ('${A}','${A}');
INSERT INTO public.treasures VALUES
 ('${TREASURE_A}','15 FB Item A',true,1,15),
 ('${TREASURE_B}','15 FB Item B',true,2,15);
INSERT INTO public.child_profiles VALUES
 ('${C1}','${A}','Tooth add'),
 ('${C2}','${A}','Approve'),
 ('${C3}','${A}','Refund'),
 ('${C4}','${A}','Same item'),
 ('${C5}','${A}','Competing items'),
 ('${C6}','${A}','Tooth correction');
INSERT INTO public.fairy_wallets(child_id,balance) VALUES
 ('${C1}',0),('${C2}',20),('${C3}',12),('${C4}',20),('${C5}',20),('${C6}',15);
INSERT INTO private.fairybucks_tooth_rewards VALUES ('${A}',5);
INSERT INTO private.fairybucks_parent_unlocks VALUES
 ('${A}','${SID}',extensions.digest('${U}','sha256'),clock_timestamp()+interval '1 hour');
INSERT INTO public.treasure_requests(id,child_id,treasure_id,price_at_request,status,delivery_stage)
 VALUES ('${REQ_APPROVE}','${C2}','${TREASURE_A}',8,'pending','workshop'),
 ('${REQ_REFUND}','${C3}','${TREASURE_A}',8,'approved','workshop');
INSERT INTO public.lost_teeth VALUES ('${TOOTH6}','${C6}',current_date,null);
INSERT INTO public.fairy_transactions(id,child_id,amount,description)
 VALUES ('${TOOTH6}','${C6}',5,'Lost tooth reward');
`);
// Install the actual SQL bodies, unchanged.
await psql(helper+ '\n'+[
 'fairybucks_record_tooth','fairybucks_undo_tooth',
 'fairybucks_decide_treasure','fairybucks_update_delivery'
].map(functionSql).join('\n'));

// Same lost-tooth UUID from two real PG sessions must only credit once.
const addResults=await simultaneous(
 `public.fairybucks_record_tooth('${C1}'::uuid,'${TOOTH}'::uuid,current_date,'${U}')`,
 `public.fairybucks_record_tooth('${C1}'::uuid,'${TOOTH}'::uuid,current_date,'${U}')`
);
assert.deepEqual(addResults,['saved','saved']);
assert.equal(await scalar(`balance FROM public.fairy_wallets WHERE child_id='${C1}'`),'5');
assert.equal(await scalar(`count(*) FROM public.lost_teeth WHERE child_id='${C1}'`),'1');
assert.equal(await scalar(`count(*) FROM public.fairy_transactions WHERE child_id='${C1}' AND description='Lost tooth reward'`),'1');

// Same approval raced by two distinct real transactions: one deduction only.
const approve=await simultaneous(
 `public.fairybucks_decide_treasure('${C2}','${REQ_APPROVE}','approved','${U}')`,
 `public.fairybucks_decide_treasure('${C2}','${REQ_APPROVE}','approved','${U}')`
);
assert.deepEqual(approve,['approved','approved']);
assert.equal(await scalar(`balance FROM public.fairy_wallets WHERE child_id='${C2}'`),'12');
assert.equal(await scalar(`count(*) FROM public.fairy_transactions WHERE child_id='${C2}' AND amount=-8`),'1');

// Same refund raced by two transactions: one credit only.
const refund=await simultaneous(
 `public.fairybucks_update_delivery('${C3}','${REQ_REFUND}','refunded','workshop','${U}')`,
 `public.fairybucks_update_delivery('${C3}','${REQ_REFUND}','refunded','workshop','${U}')`
);
assert.deepEqual(refund,['refunded','refunded']);
assert.equal(await scalar(`balance FROM public.fairy_wallets WHERE child_id='${C3}'`),'20');
assert.equal(await scalar(`count(*) FROM public.fairy_transactions WHERE child_id='${C3}' AND amount=8`),'1');

// Different request UUIDs for the SAME treasure must serialize on child profile.
const submitSame=await simultaneous(
 `private.fairybucks_submit_for_explorer('${C4}','${uuid(41)}',1,15)`,
 `private.fairybucks_submit_for_explorer('${C4}','${uuid(42)}',1,15)`
);
assert.deepEqual(submitSame.slice().sort(),['already_pending','requested'].sort());
assert.equal(await scalar(`count(*) FROM public.treasure_requests WHERE child_id='${C4}' AND status='pending'`),'1');

// Different 15 FB items, only 20 FB wallet: one request must be rejected.
const submitDiff=await simultaneous(
 `private.fairybucks_submit_for_explorer('${C5}','${uuid(51)}',1,15)`,
 `private.fairybucks_submit_for_explorer('${C5}','${uuid(52)}',2,15)`
);
assert.deepEqual(submitDiff.slice().sort(),['insufficient_balance','requested'].sort());
assert.equal(await scalar(`coalesce(sum(price_at_request),0) FROM public.treasure_requests WHERE child_id='${C5}' AND status='pending'`),'15');

// Concurrent correction of same tooth cannot remove the reward twice.
const undo=await simultaneous(
 `public.fairybucks_undo_tooth('${C6}','${TOOTH6}','${U}')`,
 `public.fairybucks_undo_tooth('${C6}','${TOOTH6}','${U}')`
);
assert.deepEqual(undo,['undone','undone']);
assert.equal(await scalar(`balance FROM public.fairy_wallets WHERE child_id='${C6}'`),'10');
assert.equal(await scalar(`count(*) FROM public.fairy_transactions WHERE child_id='${C6}' AND amount=-5`),'1');

console.log('PASS real PostgreSQL concurrent-session safety: tooth add/undo, approval, refund, same-item reservation, competing-item overspend');
