import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const fromSource=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const {parentNotice}=await import(fromSource(readFileSync(new URL('parent-notice.js',root),'utf8')));
const {siteContact}=await import(fromSource(readFileSync(new URL('site-contact.js',root),'utf8')));
const checkEmailHandler=async function checkEmailHandler(source,notice,contact){
 const expect=(v,m)=>{if(!v)throw Error(m);};
 const uuid='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',rid='33333333-3333-4333-8333-333333333333',job='44444444-4444-4444-8444-444444444444';
 class ResponseStub{constructor(body,options={}){this.body=body;this.status=options.status||200;this.ok=this.status<400;this.headers=options.headers;}async json(){return JSON.parse(this.body);}}
 const encoder=class{encode(v){return new Uint8Array(Array.from(v,c=>c.charCodeAt(0)));}};
 const api=new Function('TextEncoder','Response',source.replaceAll('export ','')+'\nreturn {createPermissionHandler,permissionSnapshot};')(encoder,ResponseStub);
 expect(JSON.stringify(api.permissionSnapshot.notice)===JSON.stringify(notice),'Server notice differs from browser notice');
 for(const k of ['operatorName','mailingAddress','phone','supportEmail'])expect(api.permissionSnapshot.contact[k]===contact[k],'Contact snapshot mismatch');
 function setup(options={}){
  const calls=[],mails=[],settings={PARENT_EMAIL_PERMISSION_ENABLED:'true',SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'PUBLIC',
   SUPABASE_SERVICE_ROLE_KEY:'PRIVATE-SERVICE',RESEND_API_KEY:'PRIVATE-RESEND',PERMISSION_LINK_SECRET:'x'.repeat(64),...options.env};
  const user={id:uuid,email:'parent@example.test',email_confirmed_at:'2026-11-16'};
  const result=status=>({status,parent_id:uuid,request_id:rid,version:notice.version,notice_hash:'0'.repeat(64)});
  const state={options};
  const fetch=async(url,init={})=>{
   calls.push({url,init});
   if(url.endsWith('/auth/v1/user'))return new ResponseStub(JSON.stringify(user),{status:options.authFail?401:200});
   if(url.endsWith('/rpc/fairybucks_permission_rehearsal'))return new ResponseStub(JSON.stringify({parent_id:options.scopeWrong?'other':uuid,enabled:options.scope===true}));
   if(url.endsWith('/rpc/fairybucks_email_permission')){
    const p=JSON.parse(init.body);let r;
    if(options.rpc)r=options.rpc(p,result);
    if(!r){
     if(p.p_action==='start')r=result('requested');
     if(p.p_action==='approve')r=result(p.p_guardian?'confirming':'guardian_required');
     if(p.p_action==='status')r=result('confirming');
     if(p.p_action==='claim_notice'||p.p_action==='claim_confirmation')r={...result('mail_claimed'),job_id:job,
      email:options.wrongMail?'other@example.test':user.email,kind:p.p_action==='claim_notice'?'notice':'confirmation'};
     if(p.p_action==='accepted')r=result(options.kind==='notice'?'requested':'verified');
    }
    return new ResponseStub(JSON.stringify(r));
   }
   if(url==='https://api.resend.com/emails'){
    mails.push(init);return new ResponseStub(JSON.stringify(options.noProviderId?{}:{id:'mail-123'}),{status:options.mailFail?503:200});
   }
   throw Error('Unexpected network request');
  };
  const handler=api.createPermissionHandler({env:n=>settings[n],fetch,atob:()=>JSON.stringify({session_id:session}),
   crypto:{randomUUID:()=>job,subtle:{digest:async()=>new ArrayBuffer(32),importKey:async()=>({}),sign:async()=>new ArrayBuffer(32)}}});
  const request=(body,headers={},method='POST')=>({method,headers:{get:k=>({'Origin':'https://fairybucks.com','Authorization':'Bearer a.b.c',...headers}[k]||null)},text:async()=>JSON.stringify(body)});
  return {handler,request,calls,mails,state,result};
 }
 let s=setup({env:{PARENT_EMAIL_PERMISSION_ENABLED:'false'}}),r=await s.handler(s.request({action:'request'}));
 expect(r.status===503&&s.calls.length===0,'Disabled function performed network work');
 s=setup({env:{PARENT_EMAIL_PERMISSION_ENABLED:'false',PARENT_PERMISSION_REHEARSAL_ENABLED:'true'}});
 r=await s.handler(s.request({action:'request',guardian:true}));expect(r.status===503&&s.mails.length===0,'Unselected account entered rehearsal');
 s=setup({scope:true,scopeWrong:true,env:{PARENT_EMAIL_PERMISSION_ENABLED:'false',PARENT_PERMISSION_REHEARSAL_ENABLED:'true'}});
 r=await s.handler(s.request({action:'request',guardian:true}));expect(r.status===503&&s.mails.length===0,'Wrong account scope entered rehearsal');
 s=setup({scope:true,kind:'notice',env:{PARENT_EMAIL_PERMISSION_ENABLED:'false',PARENT_PERMISSION_REHEARSAL_ENABLED:'true'}});
 r=await s.handler(s.request({action:'request',guardian:true}));expect((await r.json()).status==='requested'&&s.mails.length===1,'Selected rehearsal account could not request notice');
 s=setup();r=await s.handler(s.request({action:'request'},{Origin:'https://attacker.test'}));
 expect(r.status===403&&s.calls.length===0,'Foreign origin accepted');
 r=await s.handler(s.request({action:'request'},{Authorization:''}));
 expect(r.status===401&&s.mails.length===0,'Unauthenticated email sent');
 s=setup({authFail:true});r=await s.handler(s.request({action:'request'}));
 expect(r.status===401&&s.mails.length===0,'Invalid parent authentication accepted');
 s=setup({kind:'notice'});r=await s.handler(s.request({action:'request',guardian:true,parent_id:'attacker'}));
 expect((await r.json()).status==='requested'&&s.mails.length===1,'Notice request did not send one notice');
 const payload=JSON.parse(s.mails[0].body);
 expect(payload.to[0]==='parent@example.test'&&payload.reply_to===contact.supportEmail,'Mail recipient/reply mismatch');
 for(const [,copy]of notice.sections)expect(payload.text.includes(copy),'Direct notice content missing');
 expect(payload.text.includes('/permission.html#request=')&&!payload.text.includes('/permission.html?'),'Secret link not confined to fragment');
 expect(s.mails[0].headers['Idempotency-Key']==='fairybucks-permission-'+job,'Stable mail retry key missing');
 const params=s.calls.filter(c=>c.url.includes('/rpc/')).map(c=>JSON.parse(c.init.body));
 expect(params.every(p=>p.p_parent===uuid&&p.p_session===session),'Browser chose parent/session identity');
 expect(params.some(p=>p.p_action==='accepted'),'Notice provider acknowledgement not recorded');
 s=setup();r=await s.handler(s.request({action:'approve',requestId:rid,token:'0'.repeat(64),guardian:false}));
 expect((await r.json()).status==='guardian_required'&&s.mails.length===0,'Unchecked approval sent mail');
 s=setup();r=await s.handler(s.request({action:'approve',requestId:rid,token:'0'.repeat(64),guardian:true}));
 expect((await r.json()).status==='confirming'&&s.mails.length===0,'Approval must queue confirmation without sending immediately');
 s=setup();r=await s.handler(s.request({action:'status'}));
 expect((await r.json()).status==='confirming'&&s.mails.length===0,'Status refresh must not dispatch confirmation');
 s=setup({rpc:()=>({status:'verified',parent_id:'different'})});r=await s.handler(s.request({action:'status'}));
 expect(r.status===503,'Wrong-parent RPC reply accepted');
 s=setup();r=await s.handler(s.request({action:'approve',requestId:rid,token:'bad',guardian:true}));
 expect(r.status===400&&s.mails.length===0,'Malformed link accepted');
 const serialized=JSON.stringify(await r.json());
 expect(!serialized.includes('PRIVATE-')&&!serialized.includes('token'),'Secret leaked in public result');
 return 'PASS email handler: staging/auth/origin, full notice, account binding, explicit approval, confirmation, idempotency and failed-send protection';
};
console.log(await checkEmailHandler(readFileSync(new URL('supabase/functions/parent-permission-email/index.ts',root),'utf8'),parentNotice,siteContact));

const checkApprovalPage=async function checkApprovalPage(source,notice,contact){
 const expect=(v,m)=>{if(!v)throw Error(m);};
 const rid='33333333-3333-4333-8333-333333333333';
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 function setup(config={}){
  const nodes=new Map(),make=()=>({hidden:true,disabled:false,checked:false,value:'',textContent:'',children:[],events:{},
   append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},addEventListener(n,f){this.events[n]=f;},querySelector(){return {disabled:false};}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,make());return nodes.get(id);};
  const state={calls:[],owner:'owner',status:'requested',fail:false,history:[],authHandler:null};
  const client={rpc:async()=>({data:{parent_id:state.owner,enabled:config.selected===true}}),auth:{
   async getUser(){return state.authHandler?state.authHandler():{data:{user:state.owner?{id:state.owner,email:'parent@example.test'}:null}};},
   onAuthStateChange(f){state.authChanged=f;},async signInWithPassword(){state.owner='owner';return {};},
   async signOut(){state.owner=null;state.authChanged('SIGNED_OUT',null);return {};}
  },functions:{async invoke(name,args){
   state.calls.push(args.body);if(state.fail)throw Error('network');
   return {data:{status:state.status,parent_id:state.owner,version:notice.version,notice_hash:'hash'}};
  }}};
  const params=class{constructor(v){this.p=Object.fromEntries(v.split('&').map(p=>p.split('=')));}get(k){return this.p[k]||null;}};
  const api=new Function('createClient','parentNotice','siteContact','renderContact','parentNoticeHash','document','location','history','window','URLSearchParams',
    source.replace(/^import .+;$/gm,'')+'\nreturn {check};')(
   ()=>client,notice,{...contact,parentPermissionEnabled:!config.staged,privacyNoticeReviewed:!config.staged},()=>{},async()=>'hash',
   {getElementById:$,createElement:make},
   {hash:'#request='+rid+'&token='+'0'.repeat(64),pathname:'/permission.html'},
   {replaceState(...x){state.history.push(x);}},
   {FAIRYBUCKS_AUTH_CONFIG:{url:'https://example.test',publishableKey:'sb_publishable_fixture'}},params);
  return {api,$,state,client};
 }
 let s=setup({staged:true});await flush();
 expect(s.state.calls.length===0&&s.$('permission-approve').hidden,'Nonselected account accessed staged approval');
 s=setup({staged:true,selected:true});await flush();
 expect(s.state.calls.length===1&&!s.$('permission-approve').hidden,'Selected account could not inspect rehearsal notice');
 s=setup();await flush();
 expect(s.state.history.length===1&&s.state.history[0][2]==='/permission.html','Token fragment was retained');
 expect(s.state.calls.length===1&&s.state.calls[0].action==='inspect','Opening link approved permission');
 expect(!s.$('permission-approve').hidden,'Valid notice did not expose explicit approval');
 s.$('permission-approve').events.submit({preventDefault(){}});expect(s.state.calls.length===1,'Unchecked approval submitted');
 s.$('permission-guardian').checked=true;await s.$('permission-approve').events.submit({preventDefault(){}});
 expect(s.state.calls.at(-1).action==='approve'&&s.state.calls.at(-1).guardian===true,'Explicit approval absent');
 s.state.fail=true;await s.api.check();
 expect(!s.$('permission-retry').hidden&&s.$('permission-approve').hidden,'Network failure left approval active or retry hidden');
 s.state.fail=false;s.state.status='invalid_link';await s.api.check();
 expect(!s.$('permission-switch').hidden&&s.$('permission-approve').hidden,'Wrong-account link hid account switch');
 await s.$('permission-switch').events.click();expect(!s.$('permission-login').hidden,'Sign-out did not show parent sign-in');
 s=setup();await flush();let resolve;s.state.authHandler=()=>new Promise(r=>resolve=r);
 const pending=s.api.check();s.state.authChanged('SIGNED_OUT',null);resolve({data:{user:{id:'owner',email:'parent@example.test'}}});await pending;
 expect(s.$('permission-approve').hidden&&s.$('permission-account').textContent==='','Late account lookup restored approval');
 return 'PASS approval page: fragment removal, no automatic approval, affirmative consent, failure recovery, account switching and stale replies';
};
console.log(await checkApprovalPage(readFileSync(new URL('permission-page.js',root),'utf8'),parentNotice,siteContact));
