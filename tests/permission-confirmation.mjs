import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
const source=readFileSync(new URL('../supabase/functions/parent-permission-confirmation/index.ts',import.meta.url),'utf8');
const {createConfirmationHandler,permissionSnapshot}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const parent=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../parent-notice.js',import.meta.url))).toString('base64'));
assert.deepEqual(permissionSnapshot.notice,parent.parentNotice);
const digest=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(permissionSnapshot)));
const hash=Buffer.from(digest).toString('hex'),id='11111111-1111-4111-8111-111111111111',job='22222222-2222-4222-8222-222222222222';
function setup(options={}){
 const env={PERMISSION_WORKER_SECRET:'PRIVATE-WORKER-SECRET-32-BYTES-LONG',PARENT_EMAIL_PERMISSION_ENABLED:'true',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE-SERVICE',RESEND_API_KEY:'PRIVATE-RESEND',...options.env};
 const calls=[],mails=[];let accepted=0;
 const fetch=async(url,init)=>{
  calls.push([url,init]);const b=JSON.parse(init.body);
  if(url.includes('/rpc/')){
   let data;
   if(b.p_action==='list')data={requests:[id]};
   if(b.p_action==='claim')data=options.noMail?{status:'no_mail'}:{status:'mail_claimed',request_id:id,job_id:job,kind:'confirmation',email:'parent@example.test',version:2,notice_hash:options.badHash?'bad':hash};
   if(b.p_action==='accepted'){accepted++;data={status:options.withdrawn?'no_mail':'verified'};}
   return new Response(JSON.stringify(data));
  }
  mails.push(init);return new Response(JSON.stringify(options.noId?{}:{id:'provider-id'}),{status:options.mailFail?503:200});
 };
 const handler=createConfirmationHandler({env:n=>env[n],fetch,crypto:webcrypto});
 const request=(key=env.PERMISSION_WORKER_SECRET,origin)=>new Request('https://example.test',{method:'POST',headers:{Authorization:'Bearer '+key,...(origin?{Origin:origin}:{})},body:'{}'});
 return {handler,request,calls,mails,get accepted(){return accepted;}};
}
let s=setup(),r=await s.handler(s.request('wrong'));assert.equal(r.status,403);assert.equal(s.calls.length,0);
r=await s.handler(s.request(undefined,'https://fairybucks.com'));assert.equal(r.status,403);assert.equal(s.calls.length,0);
s=setup({env:{PARENT_EMAIL_PERMISSION_ENABLED:'false'}});r=await s.handler(s.request());assert.equal(r.status,503);assert.equal(s.calls.length,0);
s=setup({noMail:true});r=await s.handler(s.request());assert.equal(s.mails.length,0);
s=setup({badHash:true});r=await s.handler(s.request());assert.equal(s.mails.length,0);assert.equal(r.status,503);
for(const options of [{mailFail:true},{noId:true}]){s=setup(options);r=await s.handler(s.request());assert.equal(r.status,503);assert.equal(s.accepted,0);}
s=setup();r=await s.handler(s.request());assert.equal((await r.json()).sent,1);assert.equal(s.accepted,1);
const mail=JSON.parse(s.mails[0].body);assert.deepEqual(mail.to,['parent@example.test']);assert.ok(mail.text.includes('revoke this permission'));for(const [,text]of parent.parentNotice.sections)assert.ok(mail.text.includes(text));
assert.equal(s.mails[0].headers['Idempotency-Key'],'fairybucks-permission-'+job);
s=setup({withdrawn:true});r=await s.handler(s.request());assert.equal((await r.json()).sent,0);
assert.ok(!JSON.stringify(await (await s.handler(s.request('wrong'))).json()).includes('PRIVATE-'));
console.log('PASS delayed sender: secret/staging/origin, exact notice, rejected jobs, provider failures, stable retries and late withdrawal');
