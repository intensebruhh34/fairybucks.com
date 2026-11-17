import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const asModule=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const source=readFileSync(new URL('supabase/functions/parent-permission-rehearsal/index.ts',root),'utf8');
const {createRehearsalHandler,permissionSnapshot}=await import(asModule(source));
const {parentNotice}=await import(asModule(readFileSync(new URL('parent-notice.js',root),'utf8')));
const {siteContact}=await import(asModule(readFileSync(new URL('site-contact.js',root),'utf8')));
assert.deepEqual(permissionSnapshot.notice,parentNotice);
for(const field of ['operatorName','mailingAddress','phone','supportEmail'])assert.equal(permissionSnapshot.contact[field],siteContact[field]);
const parent='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
const settings={PARENT_EMAIL_PERMISSION_ENABLED:'false',PERMISSION_REHEARSAL_EMAIL:'parent@example.test',
 PERMISSION_LINK_SECRET:'FIXTURE-ONLY-NOT-A-LIVE-KEY-'.repeat(3),RESEND_API_KEY:'TEST-ONLY-RESEND',
 SUPABASE_URL:'https://database.example.test',SUPABASE_ANON_KEY:'TEST-PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'TEST-SERVICE'};
let time=Date.UTC(2026,10,17,12),user={id:parent,email:'parent@example.test',email_confirmed_at:'2026-11-17'},sessionActive=true,mailFail=false;
const requests=[],mails=[];
const handler=createRehearsalHandler({env:key=>settings[key],crypto:webcrypto,atob,btoa,now:()=>time,
 fetch:async(url,init={})=>{
  requests.push({url,init});
  if(url.endsWith('/auth/v1/user'))return Response.json(user);
  if(url.endsWith('/rpc/fairybucks_email_permission')){
   const args=JSON.parse(init.body);
   assert.equal(args.p_action,'status','Rehearsal must never write consent');
   assert.equal(args.p_parent,user.id);assert.equal(args.p_session,session);
   return Response.json({status:'setup_pending',parent_id:user.id},{status:sessionActive?200:401});
  }
  assert.equal(url,'https://api.resend.com/emails');mails.push(init);
  return Response.json({id:'TEST-MAIL-ID'},{status:mailFail?503:200});
 }});
const request=(body,headers={},method='POST')=>new Request('https://function.example.test',{
 method,headers:{Origin:'https://fairybucks.com',Authorization:'Bearer a.'+btoa(JSON.stringify({session_id:session}))+'.c',...headers},
 ...(method==='POST'?{body:JSON.stringify(body)}:{})
});
let r=await handler(request({action:'request',acknowledged:true}));
assert.equal((await r.json()).status,'test_notice_sent');assert.equal(mails.length,1);
const firstMail=mails[0],mail=JSON.parse(firstMail.body);
assert.deepEqual(mail.to,['parent@example.test']);assert.equal(mail.reply_to,'support@fairybucks.com');
assert.match(mail.subject,/TEST ONLY/);assert.match(mail.text,/does not record consent/);
for(const [,copy]of parentNotice.sections)assert.ok(mail.text.includes(copy));
const link=mail.text.split('\n').find(line=>line.startsWith('https://fairybucks.com/permission-test.html#token='));
assert.ok(link);const token=new URLSearchParams(new URL(link).hash.slice(1)).get('token');
assert.ok(token);
const before=mails.length;r=await handler(request({action:'inspect',token}));
assert.equal((await r.json()).status,'test_link_ready');assert.equal(mails.length,before,'Opening link sent mail');
r=await handler(request({action:'confirm',token}));
assert.equal((await r.json()).status,'test_acknowledgement_required');assert.equal(mails.length,before);
r=await handler(request({action:'confirm',token,acknowledged:true,to:'attacker@example.test'}));
const result=await r.json();assert.deepEqual(result,{status:'test_confirmation_sent',parent_id:parent});
assert.ok(!JSON.stringify(result).includes(token));assert.deepEqual(JSON.parse(mails.at(-1).body).to,['parent@example.test']);
assert.match(JSON.parse(mails.at(-1).body).subject,/TEST ONLY.*confirmation/);
await handler(request({action:'request',acknowledged:true}));
assert.equal(mails.at(-1).headers['Idempotency-Key'],firstMail.headers['Idempotency-Key']);
assert.equal(mails.at(-1).body,firstMail.body,'Retries changed the notice payload');
// No write-capable action can be selected by a caller.
const count=mails.length;r=await handler(request({action:'approve',token,acknowledged:true}));assert.equal(r.status,400);assert.equal(mails.length,count);
r=await handler(request({action:'confirm',token:token.slice(0,-1)+(token.endsWith('0')?'1':'0'),acknowledged:true}));
assert.equal((await r.json()).status,'invalid_test_link');assert.equal(mails.length,count);
user={...user,id:'33333333-3333-4333-8333-333333333333'};
r=await handler(request({action:'confirm',token,acknowledged:true}));assert.equal((await r.json()).status,'invalid_test_link');assert.equal(mails.length,count);
user={...user,id:parent,email:'other@example.test'};
r=await handler(request({action:'request',acknowledged:true}));assert.equal(r.status,403);assert.equal(mails.length,count);
user={...user,email:'parent@example.test',email_confirmed_at:null};
r=await handler(request({action:'request',acknowledged:true}));assert.equal(r.status,403);assert.equal(mails.length,count);
user={...user,email_confirmed_at:'2026-11-17'};sessionActive=false;
r=await handler(request({action:'request',acknowledged:true}));assert.equal(r.status,401);assert.equal(mails.length,count);
sessionActive=true;time+=86400000;
r=await handler(request({action:'confirm',token,acknowledged:true}));assert.equal((await r.json()).status,'invalid_test_link');assert.equal(mails.length,count);
time-=86400000;mailFail=true;
r=await handler(request({action:'confirm',token,acknowledged:true}));assert.equal((await r.json()).status,'test_email_retry');
mailFail=false;const oldSecret=settings.PERMISSION_LINK_SECRET;settings.PERMISSION_LINK_SECRET='CHANGED-TEST-ONLY-SECRET-'.repeat(3);
r=await handler(request({action:'confirm',token,acknowledged:true}));assert.equal((await r.json()).status,'invalid_test_link');
settings.PERMISSION_LINK_SECRET=oldSecret;
for(const key of ['PERMISSION_REHEARSAL_EMAIL','PERMISSION_LINK_SECRET','RESEND_API_KEY']){
 const saved=settings[key];settings[key]='';const n=requests.length;
 r=await handler(request({action:'request',acknowledged:true}));assert.equal(r.status,503);assert.equal(requests.length,n);
 settings[key]=saved;
}
settings.PARENT_EMAIL_PERMISSION_ENABLED='true';const n=requests.length;
r=await handler(request({action:'request',acknowledged:true}));assert.equal(r.status,503);assert.equal(requests.length,n);
settings.PARENT_EMAIL_PERMISSION_ENABLED='false';
r=await handler(request({action:'request',acknowledged:true},{Origin:'https://attacker.example.test'}));assert.equal(r.status,403);
r=await handler(request({action:'request',acknowledged:true},{Authorization:''}));assert.equal(r.status,401);
r=await handler(request(null,{},'GET'));assert.equal(r.status,405);
assert.ok(requests.filter(r=>r.url.includes('/rpc/')).every(r=>JSON.parse(r.init.body).p_action==='status'));
console.log('PASS rehearsal server: real HMAC/hash, private inbox, active session, full notice, no consent writes, explicit confirmation, expiry, idempotency and failures');

const pageSource=readFileSync(new URL('permission-test.js',root),'utf8');
const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function page(linkToken=null){
 const nodes=new Map(),make=()=>({hidden:true,disabled:false,checked:false,value:'',textContent:'',children:[],events:{},
  append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},addEventListener(k,f){this.events[k]=f;},querySelector(){return {disabled:false};}});
 const $=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
 const state={calls:[],auth:null,history:[]};
 const client={auth:{
  async getUser(){return state.auth?state.auth():{data:{user:{id:parent,email:'parent@example.test'}}};},
  onAuthStateChange(f){state.changed=f;},async signOut(){state.changed('SIGNED_OUT',null);return {};},
  async signInWithPassword(){return {};}
 },functions:{async invoke(name,args){state.calls.push(args.body);return {data:{parent_id:parent,status:{inspect:'test_link_ready',request:'test_notice_sent',confirm:'test_confirmation_sent'}[args.body.action]}};}}};
 const api=new Function('createClient','parentNotice','siteContact','document','location','history','window',
  pageSource.replace(/^import .+;$/gm,'')+'\nreturn {inspect};')(
  ()=>client,parentNotice,siteContact,{getElementById:$,createElement:make},
  {hash:linkToken?'#token='+linkToken:'',pathname:'/permission-test.html'},
  {replaceState(...x){state.history.push(x);}},
  {FAIRYBUCKS_AUTH_CONFIG:{url:'https://database.example.test',publishableKey:'sb_publishable_TEST'}});
 return {$,state,api};
}
let p=page();await flush();
assert.equal(p.state.calls.length,0,'Loading request page sent mail');
await p.$('test-action-form').events.submit({preventDefault(){}});assert.equal(p.state.calls.length,0,'Unchecked test sent mail');
p.$('test-acknowledge').checked=true;await p.$('test-action-form').events.submit({preventDefault(){}});
assert.equal(p.state.calls[0].action,'request');assert.equal(p.$('test-action-form').hidden,true);
p=page(token);await flush();
assert.equal(p.state.calls.length,1);assert.equal(p.state.calls[0].action,'inspect');
assert.equal(p.state.history[0][2],'/permission-test.html','Fragment was not removed');
await p.$('test-action-form').events.submit({preventDefault(){}});assert.equal(p.state.calls.length,1);
p.$('test-acknowledge').checked=true;await p.$('test-action-form').events.submit({preventDefault(){}});
assert.equal(p.state.calls.at(-1).action,'confirm');
p=page();await flush();let resolve;p.state.auth=()=>new Promise(r=>resolve=r);
const pending=p.api.inspect();p.state.changed('SIGNED_OUT',null);
resolve({data:{user:{id:parent,email:'parent@example.test'}}});await pending;
assert.equal(p.$('test-notice').hidden,true);assert.equal(p.$('test-account').textContent,'');
assert.match(readFileSync(new URL('auth.html',root),'utf8'),/href="\/permission-test\.html"/);
console.log('PASS rehearsal page: no automatic mail/confirmation, explicit test acknowledgement, fragment cleanup and stale-account protection');
