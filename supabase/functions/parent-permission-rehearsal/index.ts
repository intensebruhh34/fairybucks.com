// Self-contained for Dashboard deployment. No npm imports; no secrets or live credentials here.
// Keep this snapshot identical to parent-notice.js/site-contact.js; tests enforce parity.
export const permissionSnapshot = {
  "notice": {
    "version": 2,
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
        "After confirming your parent account email, request a permission email. Read the notice in that email, open its secure link, sign in to the same parent account if needed, and affirm that you are the parent or legal guardian and consent to the described collection and use. We send a separate confirmation explaining how to withdraw permission. Child mode and new explorer profiles are enabled only after that confirmation is accepted for delivery. Links expire after seven days. If you decline or do not approve, child mode stays unavailable; you can still review existing records, get help or delete your account. No printed form, signature, payment or government ID is requested."
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

export function createRehearsalHandler({env,fetch:send,crypto:secure,atob:decode,btoa:encode64,now=()=>Date.now()}) {
 const origin='https://fairybucks.com',day=86400000;
 const bytes=value=>new TextEncoder().encode(value);
 const hex=value=>[...new Uint8Array(value)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const hash=async value=>hex(await secure.subtle.digest('SHA-256',bytes(value)));
 const sign=async payload=>{
  const key=await secure.subtle.importKey('raw',bytes(env('PERMISSION_LINK_SECRET')),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await secure.subtle.sign('HMAC',key,bytes('fairybucks-rehearsal-v1:'+payload)));
 };
 const equal=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
 return async request=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const requestOrigin=request.headers.get('Origin');
  if(requestOrigin===origin)headers['Access-Control-Allow-Origin']=origin;
  const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(requestOrigin&&requestOrigin!==origin)return reply({status:'test_not_available'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return reply({status:'method_not_allowed'},405);
  // Explicitly disabled after real sending is enabled. A separate, private single-inbox allowlist is mandatory.
  const allowed=(env('PERMISSION_REHEARSAL_EMAIL')||'').trim().toLowerCase();
  if(env('PARENT_EMAIL_PERMISSION_ENABLED')!=='false'||!allowed||!env('RESEND_API_KEY')
    ||(env('PERMISSION_LINK_SECRET')||'').length<32)return reply({status:'test_not_available'},503);
  const url=env('SUPABASE_URL'),anon=env('SUPABASE_ANON_KEY'),service=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service)return reply({status:'test_not_available'},503);
  try {
   if(Number(request.headers.get('content-length')||0)>4096)return reply({status:'invalid_request'},400);
   const raw=await request.text();if(raw.length>4096)return reply({status:'invalid_request'},400);
   let body;try{body=JSON.parse(raw);}catch{return reply({status:'invalid_request'},400);}
   if(!body||!['request','inspect','confirm'].includes(body.action))return reply({status:'invalid_request'},400);
   const auth=request.headers.get('Authorization')||'';
   if(!/^Bearer [A-Za-z0-9._-]+$/.test(auth))return reply({status:'sign_in_required'},401);
   const authResponse=await send(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:auth}});
   if(!authResponse.ok)return reply({status:'sign_in_required'},401);
   const user=await authResponse.json();
   if(!user.id||!user.email_confirmed_at||(user.email||'').toLowerCase()!==allowed)
    return reply({status:'test_not_available'},403);
   const part=auth.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
   const session=JSON.parse(decode(part+'='.repeat((4-part.length%4)%4))).session_id;
   if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(session||''))return reply({status:'sign_in_required'},401);
   const noticeHash=await hash(JSON.stringify(permissionSnapshot));
   // Read-only status validates the same active Auth session in the database. No request/approval/withdrawal call is made.
   const statusResponse=await send(url+'/rest/v1/rpc/fairybucks_email_permission',{
    method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
    body:JSON.stringify({p_action:'status',p_parent:user.id,p_session:session,
     p_version:permissionSnapshot.notice.version,p_notice_hash:noticeHash})
   });
   if(!statusResponse.ok)return reply({status:'sign_in_required'},401);
   const status=await statusResponse.json();
   if(status.parent_id!==user.id||status.status!=='setup_pending')return reply({status:'test_not_available'},403);
   let token,payload;
   if(body.action==='request'){
    if(body.acknowledged!==true)return reply({status:'test_acknowledgement_required'},400);
    payload={parent:user.id,email_hash:await hash(allowed),notice_hash:noticeHash,
     expires:(Math.floor(now()/day)+1)*day};
    const encoded=encode64(JSON.stringify(payload)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    token=encoded+'.'+await sign(encoded);
   }else {
    if(typeof body.token!=='string'||body.token.length>1200)return reply({status:'invalid_test_link'},400);
    const parts=body.token.split('.');
    if(parts.length!==2||!/^[A-Za-z0-9_-]+$/.test(parts[0])||!/^[0-9a-f]{64}$/.test(parts[1])
      ||!equal(parts[1],await sign(parts[0])))return reply({status:'invalid_test_link'},400);
    const encoded=parts[0].replace(/-/g,'+').replace(/_/g,'/');
    payload=JSON.parse(decode(encoded+'='.repeat((4-encoded.length%4)%4)));
    if(payload.parent!==user.id||payload.email_hash!==await hash(allowed)||payload.notice_hash!==noticeHash
      ||!Number.isSafeInteger(payload.expires)||payload.expires<=now()||payload.expires>now()+day)
     return reply({status:'invalid_test_link'},400);
    token=body.token;
    if(body.action==='inspect')return reply({status:'test_link_ready',parent_id:user.id});
    if(body.acknowledged!==true)return reply({status:'test_acknowledgement_required'},400);
   }
   const kind=body.action==='request'?'notice':'confirmation';
   const testHeader='TEST ONLY — NOT PARENTAL CONSENT\nThis checks email delivery and account/link matching. It does not record consent, enable child mode, change balances or authorize data collection.\n\n';
   const link=origin+'/permission-test.html#token='+token;
   const text=testHeader+noticeText()+'\n\n'+(kind==='notice'
    ?'Open this test link, sign in to the same parent account, then select Send test confirmation. Opening the link alone sends no confirmation.\n'+link+'\n\nThe test link expires within 24 hours. You can ignore it.'
    :'Your test confirmation email was submitted. No parental consent has been recorded. The future live process will let parents withdraw permission in the Parent Portal at https://fairybucks.com/auth.html. For help contact '+permissionSnapshot.contact.supportEmail+'.')
    +'\n\nTEST ONLY — The notice above is a preview of the planned service. This test grants no permission.';
   const response=await send('https://api.resend.com/emails',{
    method:'POST',headers:{Authorization:'Bearer '+env('RESEND_API_KEY'),'Content-Type':'application/json',
     'Idempotency-Key':'fairybucks-test-'+kind+'-'+await hash(token)},
    body:JSON.stringify({from:'Fairy Bucks <no-reply@fairybucks.com>',to:[user.email],
     reply_to:permissionSnapshot.contact.supportEmail,
     subject:kind==='notice'?'TEST ONLY — Fairy Bucks permission notice':'TEST ONLY — Fairy Bucks confirmation',
     text})
   });
   if(!response.ok)return reply({status:'test_email_retry'},502);
   const accepted=await response.json();
   if(typeof accepted.id!=='string'||!accepted.id)return reply({status:'test_email_retry'},502);
   // No token, email address or provider/credential details are returned to the caller.
   return reply({status:kind==='notice'?'test_notice_sent':'test_confirmation_sent',parent_id:user.id});
  }catch{return reply({status:'test_unavailable'},503);}
 };
}
if(typeof Deno!=='undefined')Deno.serve(createRehearsalHandler({
 env:name=>Deno.env.get(name),fetch:globalThis.fetch,crypto:globalThis.crypto,
 atob:globalThis.atob,btoa:globalThis.btoa
}));
