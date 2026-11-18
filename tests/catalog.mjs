import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname;
const db=new PGlite({extensions:{pgcrypto}});
await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private; create schema extensions;
create extension pgcrypto with schema extensions;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table auth.sessions(id uuid primary key,user_id uuid references auth.users, created_at timestamptz default now());
create function auth.jwt() returns jsonb language sql as $$select current_setting('request.jwt.claims',true)::jsonb$$;
create function auth.uid() returns uuid language sql as $$select (auth.jwt()->>'sub')::uuid$$;
create table public.families(id uuid primary key default gen_random_uuid(),owner_id uuid references auth.users);
create table public.child_profiles(id uuid primary key default gen_random_uuid(),family_id uuid references families,nickname text,age integer,gender text,created_at timestamptz default now());
create table public.fairy_wallets(child_id uuid primary key references child_profiles,balance int,updated_at timestamptz default now());
create table public.fairy_transactions(id uuid primary key default gen_random_uuid(),child_id uuid references child_profiles,amount int,description text,created_at timestamptz default now());
create table public.lost_teeth(id uuid primary key default gen_random_uuid(),child_id uuid references child_profiles,lost_on date,created_at timestamptz default now());
create table private.parent_pin_security(parent_id uuid primary key references auth.users,pin_hash text,failed_attempts int default 0,locked_until timestamptz,updated_at timestamptz default now());
create table public.treasures(id uuid primary key default gen_random_uuid(),name text,category text check(category in ('Learning','Creativity','Treasure')),description text,fairy_price int,is_active bool);
create table public.treasure_requests(id uuid primary key,child_id uuid references child_profiles,treasure_id uuid references treasures,status text,price_at_request int,created_at timestamptz default now());
grant usage on schema public,auth to authenticated,anon;
grant execute on function auth.uid(),auth.jwt() to authenticated,anon;
insert into auth.users(id) values('44a684ee-6e65-4098-80d7-3a21c3e2bcb4'),('0ad4c55a-d913-4ccf-8dca-954bbe8acd94');
insert into auth.sessions values(gen_random_uuid(),'44a684ee-6e65-4098-80d7-3a21c3e2bcb4',now());
insert into families(owner_id) select id from auth.users;
update auth.users set email=id::text||'@example.test',email_confirmed_at=now();`);
const legacyExplorerCheck=process.argv.includes('--explorer-without-consent');
const files=readdirSync(root+'/supabase/migrations').sort().filter(f=>!legacyExplorerCheck||(!f.includes('parent_consent')&&!f.includes('account_permission_rehearsal')));
for(const f of files){await db.exec(readFileSync(root+'/supabase/migrations/'+f,'utf8'));}
if(legacyExplorerCheck){
 await db.exec(readFileSync(root+'/supabase/checks/child_mode_readiness.sql','utf8'));
 console.log('PASS child mode readiness: scope, parent-action denial, token lifecycle');
 await db.exec(readFileSync(root+'/supabase/checks/treasure_request_readiness.sql','utf8'));
 console.log('PASS treasure request readiness: reservations, decisions, captured prices, refunds and isolation');
  await db.exec(readFileSync(root+'/supabase/checks/tooth_reward_readiness.sql','utf8'));
 console.log('PASS reward readiness without staged consent tables');
 await db.exec(readFileSync(root+'/supabase/checks/edit_explorer.sql','utf8'));
 console.log('PASS explorer verification on a database without the staged consent migration');
 await db.close();process.exit(0);
}
await db.exec(readFileSync(root+'/supabase/checks/treasure_request_readiness.sql','utf8'));
console.log('PASS treasure request readiness: reservations, decisions, captured prices, refunds and isolation');
await db.exec(readFileSync(root+'/supabase/checks/child_mode_readiness.sql','utf8'));
 console.log('PASS child mode readiness: scope, parent-action denial, token lifecycle');
// Test-only permissions keep legacy regression fixtures exercising their original behavior.
// Enable enforcement only in local regression fixtures; production defaults to staged development.
await db.exec(`update private.fairybucks_privacy_release set notice_ready=true,enforcement_enabled=true;
insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,requested_at,verified_at,method,evidence_ref,reviewer)
select u.id,r.notice_version,r.notice_hash,'verified',now(),now(),'signed_form','LOCAL-TEST-ONLY','Test fixture'
from auth.users u cross join private.fairybucks_privacy_release r;`);
const { catalog } = await import('data:text/javascript;base64,' + Buffer.from(readFileSync(root+'/treasure-catalog.js','utf8')).toString('base64'));
const saved = (await db.query('select shop_key, name, fairy_price, category, description from treasures order by shop_key')).rows;
assert.deepEqual(saved, catalog.map(t => ({shop_key:t.id,name:t.name,fairy_price:t.price,category:t.category,description:t.description})));
assert.doesNotMatch(JSON.stringify(catalog), /amazon|a\.co|USD|\$/i);
console.log('PASS static and database catalogs match; public catalog contains no purchase details');
await db.exec(readFileSync(root+'/supabase/checks/catalog_parent_purchases.sql','utf8'));
console.log('PASS rollback checks: prices, valid/wrong/expired unlocks, family isolation, anon denial, child payload, unchanged wallet');
await db.exec(readFileSync(root+'/supabase/checks/delivery_refunds.sql','utf8'));
console.log('PASS delivery progression, stale updates, completion, family/PIN checks, duplicate refunds and child tracker');
await db.exec(readFileSync(root+'/supabase/checks/adjustable_tooth_rewards.sql','utf8'));
await db.exec(readFileSync(root+'/supabase/checks/tooth_reward_readiness.sql','utf8'));
console.log('PASS reward readiness: new balances, limits, two explorers, original corrections, retry and access protection');
console.log('PASS adjustable rewards, original corrections, replay and access checks');
await db.exec(readFileSync(root+'/supabase/checks/hot_wheels_barbie.sql','utf8'));
console.log('PASS new treasure mappings and protected purchase access');
await db.exec(readFileSync(root+'/supabase/checks/parent_welcome_guide.sql','utf8'));
console.log('PASS welcome completion, persistence, isolation and session checks');
await db.exec(readFileSync(root+'/supabase/checks/parent_pin_recovery.sql','utf8'));
console.log('PASS email PIN recovery, single-use proofs, isolation and revocation');
await db.exec(readFileSync(root+'/supabase/checks/account_deletion.sql','utf8'));
console.log('PASS account deletion, PIN/recent-auth checks, atomic cleanup and family isolation');
await db.exec(readFileSync(root+'/supabase/checks/edit_explorer.sql','utf8'));
console.log('PASS explorer edits, optional details, conflict protection and two-explorer data separation');
await db.exec(readFileSync(root+'/supabase/checks/parent_pin_setup.sql','utf8'));
console.log('PASS independent first-PIN setup, no explorers, existing PIN protection and session checks');
await db.exec(readFileSync(root+'/supabase/checks/parent_consent.sql','utf8'));
console.log('PASS consent readiness, verified-only gates, version/hash checks, withdrawal and isolation');
await db.exec(readFileSync(root+'/supabase/checks/email_parent_consent.sql','utf8'));
console.log('PASS email permission state, service-only transitions, confirmation, expiry, withdrawal and deletion');
await db.exec(readFileSync(root+'/supabase/checks/account_permission_rehearsal.sql','utf8'));
console.log('PASS private account rehearsal: isolation, expiry, email approval and child gates');
// Verify the migration leaves legacy request prices and balances intact.
await db.exec(`insert into child_profiles(id,family_id,nickname) select '11111111-1111-4111-8111-111111111111',id,'Legacy' from families limit 1;
insert into fairy_wallets values('11111111-1111-4111-8111-111111111111',42,now());
insert into treasure_requests values(gen_random_uuid(),'11111111-1111-4111-8111-111111111111',(select id from treasures where shop_key=2),'pending',12,now());`);
// Reapply only the catalog UPDATE to a request that was captured at the former price.
const migration=readFileSync(root+'/supabase/migrations/'+files.find(f => f.includes('catalog_parent_purchases')),'utf8');
await db.exec(migration.slice(migration.indexOf('update public.treasures'),migration.indexOf('-- Retailer')));
assert.equal((await db.query('select price_at_request from treasure_requests')).rows[0].price_at_request,12);
assert.equal((await db.query('select balance from fairy_wallets')).rows[0].balance,42);
console.log('PASS existing request cost and wallet unchanged by catalog update');
const {checkParentDataRights}=await import('./parent-data-rights.mjs');
await checkParentDataRights(db,root);
await db.close();
