import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

// Disposable synthetic database: actual installed consent SQL, no production writes.
const db=new PGlite();
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const Req='cccccccc-cccc-4ccc-8ccc-cccccccccccc', Mail='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const H='fixture-v4';
const run=(sql,params=[])=>db.query(sql,params);
const permitted=async id=>(await run('select private.fairybucks_child_permission($1) as v',[id])).rows[0].v;
async function change(sql,params=[]){await run(sql,params);}
try {
await db.exec(`
create schema private; create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create table private.fairybucks_privacy_release(
singleton boolean primary key,notice_version integer,notice_hash text,notice_ready boolean,
enforcement_enabled boolean,email_method_reviewed boolean);
create table private.fairybucks_parent_consents(
parent_id uuid,notice_version integer,notice_hash text,status text,
requested_at timestamptz,verified_at timestamptz,withdrawn_at timestamptz,
method text,evidence_ref text,reviewer text,primary key(parent_id,notice_version));
create table private.fairybucks_permission_rehearsals(
parent_id uuid primary key,expires_at timestamptz,created_at timestamptz);
create table private.fairybucks_email_permission_requests(
id uuid primary key,parent_id uuid,parent_email text,notice_version integer,notice_hash text,
token_hash text,state text,created_at timestamptz,expires_at timestamptz,
notice_sent_at timestamptz,approved_at timestamptz,confirmation_sent_at timestamptz);
create table private.fairybucks_permission_mail(
id uuid primary key,request_id uuid,kind text,created_at timestamptz);
`);
await run("insert into auth.users values ($1,'a@example.invalid',clock_timestamp()),($2,'b@example.invalid',clock_timestamp())",[A,B]);
await run('insert into private.fairybucks_privacy_release values(true,4,$1,true,true,true)',[H]);
await run("insert into private.fairybucks_parent_consents(parent_id,notice_version,notice_hash,status,method) values ($1,4,$3,'verified','email_plus'),($2,4,$3,'verified','email_plus')",[A,B,H]);
await run(`insert into private.fairybucks_email_permission_requests
(id,parent_id,parent_email,notice_version,notice_hash,state,expires_at,notice_sent_at,approved_at,confirmation_sent_at)
values($1,$2,'a@example.invalid',4,$3,'approved',clock_timestamp()+interval '10 minutes',
clock_timestamp(),clock_timestamp(),clock_timestamp())`,[Req,A,H]);
await db.exec(readFileSync(new URL('./fixtures/child-permission-live-2026-11-23.sql',import.meta.url),'utf8'));
assert.equal(await permitted(A),true,'Matching valid verified consent must pass');
assert.equal(await permitted(B),false,'Other parent must not inherit consent');
const negative=async (sql,params,undo,undoParams,label)=>{
 await change(sql,params);assert.equal(await permitted(A),false,label);
 await change(undo,undoParams);assert.equal(await permitted(A),true,'Restore '+label);
};
await negative("update private.fairybucks_parent_consents set status='withdrawn' where parent_id=$1",[A],"update private.fairybucks_parent_consents set status='verified' where parent_id=$1",[A],'Withdrawn consent');
await negative("update private.fairybucks_parent_consents set notice_hash='stale' where parent_id=$1",[A],"update private.fairybucks_parent_consents set notice_hash=$2 where parent_id=$1",[A,H],'Wrong notice hash');
await negative("update private.fairybucks_privacy_release set notice_ready=false",[],"update private.fairybucks_privacy_release set notice_ready=true",[],'Unready notice');
await negative("update private.fairybucks_privacy_release set enforcement_enabled=false",[],"update private.fairybucks_privacy_release set enforcement_enabled=true",[],'Unenforced release');
await negative("update private.fairybucks_privacy_release set email_method_reviewed=false",[],"update private.fairybucks_privacy_release set email_method_reviewed=true",[],'Unreviewed email method');
await negative("update private.fairybucks_privacy_release set notice_version=5",[],"update private.fairybucks_privacy_release set notice_version=4",[],'Old notice version');
await negative("update auth.users set email_confirmed_at=null where id=$1",[A],"update auth.users set email_confirmed_at=clock_timestamp() where id=$1",[A],'Unverified email');
await negative("update private.fairybucks_email_permission_requests set parent_email='wrong@example.invalid' where id=$1",[Req],"update private.fairybucks_email_permission_requests set parent_email='a@example.invalid' where id=$1",[Req],'Wrong recipient');
await negative("update private.fairybucks_email_permission_requests set state='requested' where id=$1",[Req],"update private.fairybucks_email_permission_requests set state='approved' where id=$1",[Req],'Unapproved permission');
await negative("update private.fairybucks_email_permission_requests set approved_at=null where id=$1",[Req],"update private.fairybucks_email_permission_requests set approved_at=clock_timestamp() where id=$1",[Req],'Missing approval timestamp');
await negative("update private.fairybucks_email_permission_requests set notice_sent_at=null where id=$1",[Req],"update private.fairybucks_email_permission_requests set notice_sent_at=clock_timestamp() where id=$1",[Req],'No notice sent');
await change('update private.fairybucks_email_permission_requests set confirmation_sent_at=null where id=$1',[Req]);
assert.equal(await permitted(A),false,'No confirmation sent or queued');
await change("insert into private.fairybucks_permission_mail(id,request_id,kind) values($1,$2,'confirmation')",[Mail,Req]);
assert.equal(await permitted(A),true,'Queued confirmation and unexpired request');
await change("update private.fairybucks_email_permission_requests set expires_at=clock_timestamp()-interval '1 minute' where id=$1",[Req]);
assert.equal(await permitted(A),false,'Expired queue cannot authorize');
await change('update private.fairybucks_email_permission_requests set confirmation_sent_at=clock_timestamp() where id=$1',[Req]);
assert.equal(await permitted(A),true,'Recorded confirmation sent');
await change("insert into private.fairybucks_permission_rehearsals values($1,clock_timestamp()+interval '10 minutes',clock_timestamp())",[A]);
await change("update private.fairybucks_parent_consents set reviewer='permission-email-rehearsal' where parent_id=$1",[A]);
assert.equal(await permitted(A),true,'Valid rehearsals work');
await change("update private.fairybucks_permission_rehearsals set expires_at=clock_timestamp()-interval '1 minute' where parent_id=$1",[A]);
assert.equal(await permitted(A),false,'Expired rehearsals fail closed');
console.log('PASS actual consent SQL isolated: parent isolation, notice freshness, withdrawal, approval evidence, confirmation and expired rehearsal');
} finally {await db.close();}
