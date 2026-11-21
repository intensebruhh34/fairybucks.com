// Self-contained for Dashboard deployment. No npm imports; no secrets or live credentials here.
// Keep this snapshot identical to parent-notice.js/site-contact.js; tests enforce parity.
export const permissionSnapshot = {
  "notice": {
    "version": 4,
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
        "First verify your parent account email. During setup, review this notice and confirm that you are the parent or legal guardian to request a permission email. Requesting the email does not grant child access. Open the unique link sent to your verified email, sign in to the same parent account, review the notice and explicitly select I give permission there. Only after that approval is recorded can you finish setup and open child mode. We send a separate confirmation after a delay; it includes the original notice and instructions to withdraw permission, with no reply or further approval required. If confirmation cannot be submitted within seven days, child access pauses until the issue is resolved. Email permission links expire after seven days. If you decline or do not approve, child mode stays unavailable; you can still review existing records, get help or delete your account. No printed form, signature, payment or government ID is requested."
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
export function confirmationText() {
 return "Your parental permission has been successfully recorded!\n\nYour family is one step closer to enjoying the magic of Fairy Bucks.\n\nNo further action is required.\n\nYou can review or withdraw your permission anytime through the Fairy Bucks Parent Portal:\nhttps://fairybucks.com/auth.html\n\nFairy Bucks | ITS Security\nP.O. Box 240\nWest Warren, MA 01092\nPhone: (774) 922-5011\nSupport: support@fairybucks.com\nPrivacy Policy: https://fairybucks.com/privacy.html\n\nIf you did not authorize this permission, please contact support or withdraw permission through your Parent Portal.\n\nFor your records, the original parent-permission notice is reproduced below:\n\n"+noticeText();
}
export function createConfirmationHandler({env,fetch:send,crypto:secure}) {
 return async request=>{
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if(request.method!=='POST'||request.headers.get('Origin'))return reply({status:'forbidden'},403);
  const authorization=request.headers.get('Authorization')||'';
  if(!/^Bearer [A-Za-z0-9_-]{32,256}$/.test(authorization))return reply({status:'forbidden'},403);
  const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),resend=env('RESEND_API_KEY');
  if(!url||!service||!resend)return reply({status:'setup_pending'},503);
  try{
   // The scheduler's key is generated/encrypted in Vault. Only its hash is checked
   // by a service-only RPC; no key is printed, exported, or placed in cron SQL.
   const check=await send(url+'/rest/v1/rpc/fairybucks_check_confirmation_worker',{
    method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
    body:JSON.stringify({p_secret:authorization.slice(7)})
   });
   if(!check.ok||await check.json()!==true)return reply({status:'forbidden'},403);
   const pub=env('PARENT_EMAIL_PERMISSION_ENABLED')==='true',rehearsal=env('PARENT_PERMISSION_REHEARSAL_ENABLED')==='true';
   if(!pub&&!rehearsal)return reply({status:'staged'},503);
   const bytes=await secure.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(permissionSnapshot)));
   const hash=[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
   const version=permissionSnapshot.notice.version;
   const rpc=async(action,extra={})=>{
    const response=await send(url+'/rest/v1/rpc/fairybucks_confirmation_dispatch',{
     method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},
     body:JSON.stringify({p_action:action,p_version:version,p_notice_hash:hash,p_public:pub,p_rehearsal:rehearsal,...extra})
    });
    if(!response.ok)throw Error('dispatch failed');return response.json();
   };
   const batch=await rpc('list');if(!Array.isArray(batch.requests)||batch.requests.length>20)throw Error('Invalid batch');
   let sent=0,failed=0;
   for(const id of batch.requests){
    try{
     const lease=secure.randomUUID();
     const job=await rpc('claim',{p_request:id,p_lease:lease});
     if(job.status!=='mail_claimed')continue;
     if(job.kind!=='confirmation'||job.request_id!==id||job.version!==version||job.notice_hash!==hash||!job.email||!job.job_id)throw Error('Invalid job');
     const response=await send('https://api.resend.com/emails',{
      method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json','Idempotency-Key':'fairybucks-permission-'+job.job_id},
      body:JSON.stringify({from:'Fairy Bucks <no-reply@fairybucks.com>',to:[job.email],reply_to:permissionSnapshot.contact.supportEmail,
       subject:'Fairy Bucks permission confirmation',text:confirmationText()})
     });
     if(!response.ok)throw Error('Provider failed');const accepted=await response.json();
     if(typeof accepted.id!=='string'||!accepted.id)throw Error('Provider ID missing');
     const result=await rpc('accepted',{p_request:id,p_job:job.job_id,p_lease:lease,p_message_id:accepted.id});
     if(result.status==='verified')sent++; // Withdrawal during delivery cannot regrant permission.
    }catch{failed++;}
   }
   // Aggregate counts only: never log bodies, recipient addresses, links or credentials.
   return reply({status:failed?'retry_pending':'ok',sent,failed},failed?503:200);
  }catch{return reply({status:'unavailable'},503);}
 };
}
if(typeof Deno!=='undefined')Deno.serve(createConfirmationHandler({env:n=>Deno.env.get(n),fetch:globalThis.fetch,crypto:globalThis.crypto}));
