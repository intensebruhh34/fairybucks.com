import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const checkPermissionRehearsal=async function checkPermissionRehearsal(source,notice,contact){
 const expect=(v,m)=>{if(!v)throw Error(m);};const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
 function setup(settings={}) {
  const nodes=new Map();const make=()=>({hidden:true,disabled:false,value:'',textContent:'',children:[],events:{},append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},addEventListener(n,f){this.events[n]=f;}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
  const state={printed:0,rpc:0,auth:0,allowed:false,authHandler:async()=>({data:{user:{id:'owner',email:'private-parent@example.test'}}})};
  const config={...contact,...settings};
  const api=new Function('document','window','siteContact','parentNotice','crypto','TextEncoder',source.replace(/^import .+;$/gm,'').replaceAll('export ','')+'\nreturn {parentConsent,permissionRehearsalEmail};')(
   {getElementById:$,createElement:make},{confirm:()=>true,print(){state.printed++;}},config,notice,{subtle:{digest:async()=>new ArrayBuffer(32)}},class{encode(){return new Uint8Array();}});
  const client={auth:{async getUser(){state.auth++;return state.authHandler();}},async rpc(){state.rpc++;return {data:{status:'verified',parent_id:'owner',version:notice.version,notice_hash:'0'.repeat(64)}};}};
  const flow=api.parentConsent(()=>client,v=>state.allowed=v);
  const allText=e=>[e.textContent,...e.children.map(allText)].join('\n');
  return {api,flow,$,state,allText};
 }
 const s=setup();await s.flow.open('owner');
 expect(s.state.allowed&&!s.$('consent-rehearsal-panel').hidden,'Staging must remain usable with the rehearsal panel');
 expect(s.state.auth===0&&s.state.rpc===0,'Showing rehearsal must not call account/consent APIs');
 await s.$('consent-rehearsal-preview').events.click();
 const draft=s.$('consent-rehearsal-email').value,form=s.allText(s.$('consent-print'));
 expect(draft.includes('REHEARSAL ONLY')&&form.includes('REHEARSAL ONLY'),'Email and form must be marked test-only');
 expect(draft.includes('Notice version: '+notice.version)&&form.includes('Notice version: '+notice.version),'Notice version mismatch');
 expect(draft.includes('0'.repeat(64))&&form.includes('0'.repeat(64)),'Email/form references do not match');
 for(const [,copy] of notice.sections)expect(draft.includes(copy),'Notice section missing from draft');
 expect(draft.includes(contact.operatorName)&&draft.includes(contact.supportEmail)&&draft.includes(contact.phone),'Approved contact missing');
 expect(!draft.includes('private-parent@example.test')&&!form.includes('private-parent@example.test')&&form.includes('REHEARSAL-ONLY-NOT-A-REAL-ACCOUNT'),'Rehearsal used real account details');
 s.$('consent-rehearsal-print').events.click();expect(s.state.printed===1,'Prepared rehearsal did not print');
 s.$('consent-refresh').events.click();s.$('consent-withdraw').events.click();s.$('consent-guardian').checked=true;s.$('consent-request-form').events.submit({preventDefault(){}});
 expect(s.state.rpc===0,'Rehearsal sent a real consent request/status/withdrawal');
 s.flow.clear();expect(s.$('consent-rehearsal-panel').hidden&&s.$('consent-rehearsal-email').value===''&&s.$('consent-print').children.length===0,'Sign-out/account clear retained paperwork');
 s.$('consent-rehearsal-print').events.click();expect(s.state.printed===1,'Cleared paperwork was printable');
 // Duplicate clicks and late replies must not restore a signed-out preview.
 await s.flow.open('owner');let resolve;s.state.authHandler=()=>new Promise(r=>resolve=r);
 const pending=s.$('consent-rehearsal-preview').events.click();const before=s.state.auth;await s.$('consent-rehearsal-preview').events.click();expect(s.state.auth===before,'Duplicate preview re-authenticated twice');
 s.flow.clear();resolve({data:{user:{id:'owner'}}});await pending;await flush();
 expect(s.$('consent-rehearsal-email').value===''&&s.$('consent-rehearsal-panel').hidden,'Late preview survived account clear');
 await s.flow.open('owner');s.state.authHandler=async()=>({data:{user:{id:'other'}}});await s.$('consent-rehearsal-preview').events.click();
 expect(s.$('consent-rehearsal-print').disabled&&s.$('consent-print').children.length===0,'Wrong parent prepared paperwork');
 const live=setup({parentPermissionEnabled:true,privacyNoticeReviewed:true});await live.flow.open('owner');
 const authCount=live.state.auth;await live.$('consent-rehearsal-preview').events.click();live.$('consent-rehearsal-print').events.click();
 expect(live.$('consent-rehearsal-panel').hidden&&live.state.auth===authCount&&live.state.printed===0,'Live permission mode exposed rehearsal actions');
 let rejected=false;try{s.api.permissionRehearsalEmail('invalid');}catch{rejected=true;}expect(rejected,'Invalid notice reference accepted');
 return 'PASS rehearsal: full notice/contact/reference, test-only form, no consent writes, account checks, duplicate/late replies and staging/live separation';
};
const moduleFrom=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {parentNotice}=await import(moduleFrom(readFileSync(new URL('parent-notice.js',root),'utf8')));
const {siteContact}=await import(moduleFrom(readFileSync(new URL('site-contact.js',root),'utf8')));
console.log(await checkPermissionRehearsal(readFileSync(new URL('parent-consent.js',root),'utf8'),parentNotice,siteContact));
