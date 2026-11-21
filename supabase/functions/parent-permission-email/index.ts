// Self-contained for Dashboard deployment. No npm imports; no secrets or live credentials here.
// Keep this snapshot identical to parent-notice.js/site-contact.js; tests enforce parity.
export const permissionSnapshot = {
  "notice": {
    "version": 3,
    "title": "Permission for your family's Fairy Vault",
    "sections": [
      [
        "What we collect",
        "You provide a parent email and explorer nicknames, with age and gender optional. The vault records tooth dates, Fairy Buck balances and transactions, treasure requests, decisions and delivery stages. Child mode uses a temporary identifier tied to an explorer; requests and cancellations are saved to that explorer. Hosting and database requests can include IP addresses, browser details and security logs."
      ],
      [
        "Why we use it",
        "We use this information to run your family vault, authenticate access, save rewards, send requests to you for review, display progress, prevent misuse and answer support or privacy requests. Your child does not create an email account, upload photos, use chat or publish a profile."
      ],
      [
        "Who helps run it",
        "GitHub Pages hosts the website. Supabase provides authentication, database and access controls. Resend delivers account and permission emails. jsDelivr serves the authentication library on parent pages. Support messages are forwarded to the operator's Gmail inbox. These services are used to operate, secure and support the vault; the full Privacy notice explains the providers and their purposes. This website does not sell family information or use it for targeted advertising. This permission does not authorize unrelated disclosures or optional advertising."
      ],
      [
        "Retention and deletion",
        "Vault records are kept while your family uses the account. The pilot retention policy and provider log/backup schedules are described in Privacy. Parents can review vault records, ask support for a copy or corrections, withdraw child-mode permission, or permanently delete their account and family data. Active-database deletion does not immediately erase independent provider logs/backups or copies outside the website."
      ],
      [
        "Your choice",
        "Consent is optional. We will not enable child-mode access or allow new explorer profiles until your permission is verified. Refusing does not prevent you from reviewing existing family records, getting support or deleting the account. You can withdraw permission in the portal; child sessions will end. Contact support from your registered parent email for assistance. Never send passwords, PINs or sign-in links."
      ],
      [
        "How email permission works",
        "First verify your parent account email. During setup, read this notice and explicitly confirm that you are the parent or legal guardian and give permission for the described collection and use. We submit the full notice to your verified email before recording your approval. Once your approval is recorded, you can finish setup and open child mode. We send a separate confirmation after a delay; it requires no reply, code or further approval and explains how to withdraw permission. If confirmation cannot be submitted within seven days, child access pauses until the issue is resolved. Email permission links expire after seven days. If you decline or do not approve, child mode stays unavailable; you can still review existing records, get help or delete your account. No printed form, signature, payment or government ID is requested."
      ]
    ]
  },
  "contact": {
    "operatorName": "ITS Security",
    "mailingAddress": "P.O. Box 240\nWest Warren, MA 01092",
    "phone": "(774) 922-5011",
    "supportEmail": "support@fairybucks.com"
  }
};
export function noticeText(snapshot=permissionSnapshot) {
 const {notice,contact}=snapshot;
 return [
  'Fairy Bucks is operated by '+contact.operatorName+'.',contact.mailingAddress,
  'Phone: '+contact.phone,'Support: '+contact.supportEmail,
  'Privacy: https://fairybucks.com/privacy.html','',
  'Your permission is required before we collect information from a child through child mode. Without it, we will not enable child mode or new explorer profiles.',
  '',...notice.sections.flatMap(([title,copy])=>[title,copy,'']),
  'Notice version: '+notice.version
 ].join('\n');
}
export function createPermissionHandler({env,fetch:send,crypto:secure,atob:decode}) {
 const origin='https://fairybucks.com';
 const hex=bytes=>[...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const encode=value=>new TextEncoder().encode(value);
 const hash=async value=>hex(await secure.subtle.digest('SHA-256',encode(value)));
 const fingerprint=()=>hash(JSON.stringify(permissionSnapshot));
 const tokenFor=async id=>{
  const key=await secure.subtle.importKey('raw',encode(env('PERMISSION_LINK_SECRET')),
   {name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await secure.subtle.sign('HMAC',key,encode('fairybucks-parent-permission:v2:'+id)));
 };
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const requestOrigin=request.headers.get('Origin');
  if(requestOrigin===origin)headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='authorization,apikey,content-type,x-client-info';
  headers['Access-Control-Allow-Methods']='POST,OPTIONS';
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(requestOrigin && requestOrigin!==origin)return reply({status:'forbidden'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({status:'method_not_allowed'},405);
  // Must be explicitly enabled AFTER provider/method review and an end-to-end test.
  const publicEnabled=env('PARENT_EMAIL_PERMISSION_ENABLED')==='true';
  if(!publicEnabled&&env('PARENT_PERMISSION_REHEARSAL_ENABLED')!=='true')return reply({status:'staged'},503);
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service||!env('RESEND_API_KEY')||(env('PERMISSION_LINK_SECRET')||'').length<32)
   return reply({status:'setup_pending'},503);
  try {
   if(Number(request.headers.get('content-length')||0)>4096)return reply({status:'invalid_request'},400);
   const raw=await request.text();
   if(raw.length>4096)return reply({status:'invalid_request'},400);
   let body;try{body=JSON.parse(raw);}catch{return reply({status:'invalid_request'},400);}
   if(!body||!['status','request','give_permission','inspect','approve','withdraw'].includes(body.action))
    return reply({status:'invalid_request'},400);
   const auth=request.headers.get('Authorization')||'';
   if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))return reply({status:'sign_in_required'},401);
   const authReply=await send(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:auth}});
   if(!authReply.ok)return reply({status:'sign_in_required'},401);
   const user=await authReply.json();
   if(!user.id||!user.email||!user.email_confirmed_at)return reply({status:'confirm_account_email'},403);
   let session;
   try {
    const part=auth.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
    session=JSON.parse(decode(part+'='.repeat((4-part.length%4)%4))).session_id;
   }catch{return reply({status:'sign_in_required'},401);}
   const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
   if(!uuid.test(session||''))return reply({status:'sign_in_required'},401);
   if(!publicEnabled){
    const scopeReply=await send(url+'/rest/v1/rpc/fairybucks_permission_rehearsal',{
     method:'POST',headers:{apikey:anon,Authorization:auth,'Content-Type':'application/json'},body:'{}'
    });
    if(!scopeReply.ok)return reply({status:'staged'},503);
    const scope=await scopeReply.json();
    if(scope?.parent_id!==user.id||scope?.enabled!==true)return reply({status:'staged'},503);
   }
   const version=permissionSnapshot.notice.version,noticeHash=await fingerprint();
   const rpc=async(action,extra={})=>{
    const response=await send(url+'/rest/v1/rpc/fairybucks_email_permission',{
     method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
     body:JSON.stringify({p_action:action,p_parent:user.id,p_session:session,p_version:version,p_notice_hash:noticeHash,...extra})
    });
    if(!response.ok)throw Error('Permission unavailable');
    const data=await response.json();
    if(!data||data.parent_id!==user.id)throw Error('Permission account mismatch');
    return data;
   };
   const publicResult=data=>({
    status:data.status,parent_id:user.id,version:data.version,notice_hash:data.notice_hash,permission_allowed:data.permission_allowed===true
   });
   // Stable job keys make a lost Resend acknowledgement safe to retry.
   const attemptMail=async(data,kind)=>{
    const id=data.request_id;
    if(!uuid.test(id||''))return data;
    const token=await tokenFor(id),lease=secure.randomUUID();
    const job=await rpc(kind==='notice'?'claim_notice':'claim_confirmation',{
     p_request:id,p_token_hash:await hash(token),p_lease:lease
    });
    if(job.status!=='mail_claimed')return rpc('status');
    if(job.email!==user.email||job.version!==version||job.notice_hash!==noticeHash||job.kind!==kind)
     throw Error('Mail account/notice mismatch');
    const link=origin+'/permission.html#request='+id+'&token='+token;
    const text=kind==='notice'
     ?noticeText()+'\n\nTo give permission, open this link, sign in to this same parent account if asked, read the notice and select I give permission. Opening the link alone does not approve anything.\n'+link+'\n\nThis link expires seven days after the request. If you do not want to give permission, ignore it. You can review existing records or delete your parent account in the Parent Portal.'
     :'Your parent permission is confirmed. No further action is needed.\n\nYou can review or withdraw your permission through the Parent Portal at any time.\n\n'+noticeText()+'\n\nYou can revoke this permission at any time. Sign in at https://fairybucks.com/auth.html and select Withdraw parent permission. This ends child sessions and pauses new explorer profiles. You can still review or delete existing family records. If you did not approve, withdraw permission or contact '+permissionSnapshot.contact.supportEmail+'. Never send a password or Parent PIN.';
    const response=await send('https://api.resend.com/emails',{
     method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json',
      'Idempotency-Key':'fairybucks-permission-'+job.job_id},
     body:JSON.stringify({from:'Fairy Bucks <no-reply@fairybucks.com>',to:[user.email],
      reply_to:permissionSnapshot.contact.supportEmail,
      subject:kind==='notice'?'Your permission for Fairy Bucks':'Fairy Bucks permission confirmation',
      text})
    });
    if(!response.ok)return {...data,status:'email_retry'};
    const accepted=await response.json();
    if(typeof accepted.id!=='string'||!accepted.id)return {...data,status:'email_retry'};
    return rpc('accepted',{p_request:id,p_job:job.job_id,p_lease:lease,p_message_id:accepted.id});
   };
   let result;
   if(body.action==='give_permission'){
    if(body.expectedParent!==user.id)return reply({status:'account_changed'},409);
    if(body.guardian!==true)return reply({status:'guardian_required'},400);
    result=await rpc('status');
    if(result.status!=='verified'&&result.permission_allowed!==true){
     if(!['requested','confirming'].includes(result.status))result=await rpc('start',{p_guardian:true});
     if(result.status==='requested')result=await attemptMail(result,'notice');
     // This authenticated choice is bound to the verified parent, active session and
     // exact emailed notice. Never accept a parent ID, recipient or hash from the browser.
     if(result.status==='requested'){
      const id=result.request_id;
      if(!uuid.test(id||''))throw Error('Permission request unavailable');
      result=await rpc('approve',{p_request:id,p_token_hash:await hash(await tokenFor(id)),p_guardian:true});
     }
    }
    return reply(publicResult(result));
   }
   if(body.action==='inspect'||body.action==='approve'){
    if(!uuid.test(body.requestId||'')||!/^[0-9a-f]{64}$/.test(body.token||''))
     return reply({status:'invalid_link'},400);
    result=await rpc(body.action,{p_request:body.requestId,p_token_hash:await hash(body.token),p_guardian:body.guardian===true});
   }else if(body.action==='request'){
    result=await rpc('start',{p_guardian:body.guardian===true});
   }else result=await rpc(body.action);
   if(body.action==='request'&&result.status==='requested')result=await attemptMail(result,'notice');
   // Confirmation is durable background work; it never depends on a page refresh.
   return reply(publicResult(result));
  }catch{
   // Do not log request bodies, parent details, link tokens, credentials or provider responses.
   return reply({status:'unavailable'},503);
  }
 };
}
// Gateway JWT verification is disabled only because this handler verifies the parent with Auth
// and the RPC verifies that same active session. Do not remove either check.
if(typeof Deno!=='undefined')Deno.serve(createPermissionHandler({
 env:name=>Deno.env.get(name),fetch:globalThis.fetch,crypto:globalThis.crypto,atob:globalThis.atob
}));
