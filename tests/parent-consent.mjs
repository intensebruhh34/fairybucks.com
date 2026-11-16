import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const noticeSource=readFileSync(new URL('parent-notice.js',root),'utf8');
const {parentNotice}=await import(asModule(noticeSource));
const actualContact=await import(asModule(readFileSync(new URL('site-contact.js',root),'utf8')));
const contact={operatorName:actualContact.siteContact.operatorName,mailingAddress:actualContact.siteContact.mailingAddress,phone:actualContact.siteContact.phone,supportEmail:actualContact.siteContact.supportEmail};
const expected=createHash('sha256').update(JSON.stringify({notice:parentNotice,contact})).digest('hex');
assert.match(readFileSync(new URL('supabase/migrations/20261115010000_parent_consent.sql',root),'utf8'),/notice_ready boolean not null default false/);
assert.equal(expected.length,64);
assert.equal(actualContact.siteContact.parentPermissionEnabled,false,'Merge must preserve the existing development flow');
assert.match(readFileSync(new URL('supabase/migrations/20261115010000_parent_consent.sql',root),'utf8'),/enforcement_enabled boolean not null default false/);
const fakeContact={siteContact:{operatorName:'Test operator',mailingAddress:'Test mailing address',phone:'Test phone',supportEmail:'support@example.test',privacyNoticeReviewed:true}};
let source=readFileSync(new URL('parent-consent.js',root),'utf8').replace("'/parent-notice.js'",JSON.stringify(asModule(noticeSource))).replace("'/site-contact.js'",JSON.stringify(asModule('export const siteContact='+JSON.stringify(fakeContact.siteContact))));
const {parentConsent,parentNoticeHash}=await import(asModule(source));
class Element{constructor(){this.children=[];this.hidden=true;this.checked=false;this.events={};}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}addEventListener(n,fn){this.events[n]=fn;}focus(){}}
const els=new Map();const $=id=>{if(!els.has(id))els.set(id,new Element());return els.get(id);};
globalThis.document={getElementById:$,createElement:()=>new Element()};
let printed=0;globalThis.window={confirm:()=>true,print(){printed++;}};
// Actual staged config must not call an undeployed RPC or claim verified permission.
const stagedSource=source.replace(JSON.stringify(asModule('export const siteContact='+JSON.stringify(fakeContact.siteContact))),JSON.stringify(asModule('export const siteContact='+JSON.stringify(actualContact.siteContact))));
const staged=await import(asModule(stagedSource));let stagedCalls=0,stagedAllowed=false;
const staging=staged.parentConsent(()=>{stagedCalls++;throw Error('RPC must not be needed before activation');},allowed=>stagedAllowed=allowed);
await staging.open('test-owner');assert.equal(stagedCalls,0);assert.equal(stagedAllowed,true);assert.equal($('parent-consent-panel').hidden,true);
staging.clear();assert.equal(stagedAllowed,false);
const hash=await parentNoticeHash();const user={id:'test-owner',email:'parent@example.test'};let status='needed',calls=[],permissions=[];
const client={auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{
 calls.push([name,args]);if(args.p_action==='request')status='requested';if(args.p_action==='withdraw')status='withdrawn';
 return {data:{status,version:parentNotice.version,notice_hash:hash,requested_at:'2026-11-14T00:00:00Z'}};
}};
const flow=parentConsent(()=>client,value=>permissions.push(value));
await flow.open(user.id);assert.equal($('consent-request-form').hidden,false);assert.equal(permissions.at(-1),false);
$('consent-request-form').events.submit({preventDefault(){}});assert.equal(calls.length,1,'Unchecked guardian assertion must not send a request');
$('consent-guardian').checked=true;$('consent-request-form').events.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));
assert.equal(status,'requested');assert.equal(permissions.at(-1),false,'A request is not verified consent');
assert.equal($('consent-print-button').hidden,false);$('consent-print-button').events.click();assert.equal(printed,1);
assert.ok(calls.some(([,a])=>a.p_action==='request'&&a.p_notice_hash===hash&&a.p_guardian===true));
status='verified';await flow.open(user.id);assert.equal(permissions.at(-1),true);
$('consent-withdraw').events.click();await new Promise(r=>setImmediate(r));assert.equal(permissions.at(-1),false);assert.equal(status,'withdrawn');
// Never restore access from a late response after sign-out or an account switch.
let resolve;client.rpc=()=>new Promise(r=>{resolve=r;});const opening=flow.open(user.id);while(!resolve)await new Promise(r=>setImmediate(r));flow.clear();
resolve({data:{status:'verified',version:1,notice_hash:hash}});await opening;assert.equal($('parent-consent-panel').hidden,true);assert.equal(permissions.at(-1),false);
client.rpc=async()=>({data:{status:'verified',version:1,notice_hash:'stale'}});await flow.open(user.id);assert.equal(permissions.at(-1),false);
client.rpc=async()=>{throw Error('network');};await flow.open(user.id);assert.equal(permissions.at(-1),false);
const childSource=readFileSync(new URL('child-vault.js',root),'utf8');assert.doesNotMatch(childSource,/cdn\.jsdelivr|supabase-js|createClient/);
assert.match(childSource,/credentials: 'omit'/);assert.match(childSource,/permission_required/);
console.log('PASS notice hash, guardian assertion, requested versus verified permission, withdrawal, stale responses and child CDN removal');
