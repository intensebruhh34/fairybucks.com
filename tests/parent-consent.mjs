import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const moduleFrom=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {parentNotice}=await import(moduleFrom(readFileSync(new URL('parent-notice.js',root),'utf8')));
const {siteContact}=await import(moduleFrom(readFileSync(new URL('site-contact.js',root),'utf8')));
const contact={operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,phone:siteContact.phone,supportEmail:siteContact.supportEmail};
const hash=createHash('sha256').update(JSON.stringify({notice:parentNotice,contact})).digest('hex');
assert.ok(readFileSync(new URL('supabase/migrations/20261121160000_guided_parent_setup.sql',root),'utf8').includes(hash),'Notice/database fingerprint mismatch');
assert.equal(siteContact.parentPermissionEnabled,false);
assert.equal(siteContact.privacyNoticeReviewed,false);
const checkPermissionUI=async function checkPermissionUI(source,notice,contact){
 const expect=(v,m)=>{if(!v)throw Error(m);};
 function setup(settings={}){
  const elements=new Map(),make=()=>({hidden:true,disabled:false,checked:false,value:'',textContent:'',children:[],events:{},
   append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},addEventListener(n,f){this.events[n]=f;}});
  const $=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
  const state={allowed:false,calls:0,authCalls:0,status:'needed',owner:'owner',throwError:false};
  const api=new Function('document','window','siteContact','parentNotice','crypto','TextEncoder',
   source.replace(/^import .+;$/gm,'').replaceAll('export ','')+'\nreturn {parentConsent};')(
   {getElementById:$,createElement:make},{confirm:()=>true},{...contact,...settings},notice,
   {subtle:{digest:async()=>new ArrayBuffer(32)}},class{encode(){return new Uint8Array();}});
  const client={rpc:async()=>({data:{parent_id:state.owner,selected:settings.rehearsal===true,enabled:settings.rehearsal===true}}),auth:{getUser:async()=>{state.authCalls++;return {data:{user:{id:'owner'}}};}},
   functions:{invoke:async(name,args)=>{
    state.calls++;if(state.throwError)throw Error('network');
    if(state.handler)return state.handler(name,args);
    if(args.body.action==='give_permission')state.status='requested';
    if(args.body.action==='withdraw')state.status='withdrawn';
    return {data:{status:state.status,parent_id:state.owner,version:notice.version,notice_hash:'0'.repeat(64)}};
   }}};
  const flow=api.parentConsent(()=>client,allowed=>state.allowed=allowed);
  return {flow,$,state};
 }
 let s=setup();await s.flow.open('owner');
 expect(!s.state.allowed&&s.state.calls===0&&s.state.authCalls===0,'Pre-launch site must deny child access without a verified rehearsal');
 expect(!s.$('consent-rehearsal-panel').hidden&&s.$('consent-rehearsal-email').value.includes('PREVIEW ONLY'),'Email preview absent');
 s.flow.clear();expect(!s.state.allowed&&s.$('consent-rehearsal-email').value==='','Sign-out retained preview');
 s=setup({rehearsal:true});await s.flow.open('owner');
 expect(!s.state.allowed&&!s.$('parent-consent-panel').hidden&&!s.$('consent-request-form').hidden,'Selected account did not enter gated rehearsal');
 s.state.status='verified';await s.flow.open('owner');expect(s.state.allowed,'Selected verified tester stayed blocked');
 s.state.throwError=true;await s.flow.open('owner');expect(!s.state.allowed,'Rehearsal network failure kept child access enabled');
 s=setup({parentPermissionEnabled:true,privacyNoticeReviewed:true});await s.flow.open('owner');
 expect(!s.state.allowed&&!s.$('consent-request-form').hidden,'Needed permission flow absent');
 s.$('consent-request-form').events.submit({preventDefault(){}});expect(s.state.calls===1,'Unchecked request submitted');
 s.$('consent-guardian').checked=true;await s.$('consent-request-form').events.submit({preventDefault(){}});
 expect(s.state.status==='requested'&&!s.state.allowed,'Request alone granted permission');
 s.state.status='confirming';await s.flow.open('owner');expect(!s.state.allowed,'Pending confirmation granted permission');
 s.state.status='verified';await s.flow.open('owner');expect(s.state.allowed,'Verified permission absent');
 await s.$('consent-withdraw').events.click();expect(!s.state.allowed&&s.state.status==='withdrawn','Withdrawal failed');
 s.state.status='verified';s.state.owner='other';await s.flow.open('owner');expect(!s.state.allowed,'Other parent granted permission');
 s.state.owner='owner';s.state.throwError=true;await s.flow.open('owner');expect(!s.state.allowed,'Network error preserved permission');
 s.state.throwError=false;let resolve;s.state.handler=()=>new Promise(r=>resolve=r);
 const pending=s.flow.open('owner');
 for(let i=0;i<20&&!resolve;i++)await Promise.resolve();
 expect(Boolean(resolve),'Pending permission RPC absent');s.flow.clear();
 resolve({data:{status:'verified',parent_id:'owner',version:notice.version,notice_hash:'0'.repeat(64)}});await pending;
 expect(!s.state.allowed&&s.$('parent-consent-panel').hidden,'Late reply restored signed-out permission');
 return 'PASS permission UI: staged preview, guardian choice, request/confirmation separation, withdrawal, account binding, failures and late replies';
};
console.log(await checkPermissionUI(readFileSync(new URL('parent-consent.js',root),'utf8'),parentNotice,siteContact));
