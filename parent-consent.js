import {parentNotice} from '/parent-notice.js';
import {siteContact} from '/site-contact.js';
export async function parentNoticeHash(){
 const contact={operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,phone:siteContact.phone,supportEmail:siteContact.supportEmail};
 const bytes=new TextEncoder().encode(JSON.stringify({notice:parentNotice,contact}));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function parentConsent(getClient,onPermission){
 const $=id=>document.getElementById(id);let active=null;
 function clear(){
  active=null;onPermission(false);
  $('parent-consent-panel').hidden=true;$('consent-copy').replaceChildren();
  $('consent-guardian').checked=false;$('consent-status').textContent='';
  $('consent-rehearsal-panel').hidden=true;$('consent-rehearsal-email').value='';
  for(const id of ['consent-request','consent-refresh','consent-withdraw'])$(id).disabled=false;
 }
 function renderNotice(){
  $('consent-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{
   const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');
   h.textContent=title;p.textContent=copy;section.append(h,p);return section;
  }));
 }
 function render(view){
  const d=view.data;
  const match=d.version===parentNotice.version&&d.notice_hash===view.hash;
  const ready=siteContact.privacyNoticeReviewed&&match;
  const verified=ready&&d.status==='verified';
  $('consent-status').textContent=!ready?'Email permission is still being prepared. Existing parent records and account deletion remain available.':{
   needed:'Read the notice, then request your permission email.',
   requested:'Check your parent email. Open the permission link, sign in if asked, and give permission. You can request another email after five minutes.',
   confirming:'Your approval was received. Select Refresh permission status to finish sending the confirmation.',
   email_retry:'The email could not be confirmed. Try the email request again, or refresh if you already approved.',
   rate_limited:'Please wait before requesting another email. Requests are limited to six per day and one per five minutes.',
   verified:'Parent permission is recorded. You may add explorers and open child mode. A separate confirmation email has been submitted for delivery.',
   withdrawn:'Permission withdrawn. Child sessions have ended. Existing records remain available for review or deletion.'
  }[d.status]||'Permission is unavailable. Refresh or contact support.';
  $('consent-request-form').hidden=!ready||!['needed','requested','withdrawn','email_retry','rate_limited'].includes(d.status);
  $('consent-withdraw').hidden=!ready||!['requested','confirming','email_retry','rate_limited','verified'].includes(d.status);
  onPermission(verified);
 }
 async function load(view,action='status'){
  if(view!==active||view.busy||view.staged)return;
  view.busy=true;onPermission(false);
  $('consent-request-form').hidden=true;$('consent-withdraw').hidden=true;
  $('consent-status').textContent='Checking parent permission…';
  for(const id of ['consent-request','consent-refresh','consent-withdraw'])$(id).disabled=true;
  try{
   const {data,error}=await getClient().functions.invoke('parent-permission-email',{
    body:{action,guardian:action==='request'&&$('consent-guardian').checked}
   });
   if(view!==active)return;
   if(error||!data||data.parent_id!==view.ownerId||!['needed','requested','confirming','email_retry','rate_limited','verified','withdrawn','setup_pending'].includes(data.status))
    throw Error('Permission unavailable');
   view.data=data;render(view);
  }catch{
   if(view===active){onPermission(false);$('consent-status').textContent='We could not confirm permission. Refresh to try again. New explorers and child mode remain paused.';}
  }finally{
   view.busy=false;if(view===active)for(const id of ['consent-request','consent-refresh','consent-withdraw'])$(id).disabled=false;
  }
 }
 async function open(ownerId){
  clear();const view=active={ownerId};
  if(siteContact.parentPermissionEnabled===false){
   view.staged=true;$('consent-rehearsal-panel').hidden=false;
   $('consent-rehearsal-email').value='PREVIEW ONLY — Email permission is not active.\n\n'+parentNotice.sections.map(([title,copy])=>title+'\n'+copy).join('\n\n');
   onPermission(true);return;
  }
  $('parent-consent-panel').hidden=false;renderNotice();
  $('consent-request-form').hidden=true;$('consent-withdraw').hidden=true;
  try{
   const [{data,error},hash]=await Promise.all([getClient().auth.getUser(),parentNoticeHash()]);
   if(view!==active)return;
   if(error||data.user?.id!==ownerId)throw Error('Account changed');
   view.hash=hash;await load(view);
  }catch{if(view===active){$('consent-status').textContent='Sign in again to review parent permission.';onPermission(false);}}
 }
 $('consent-request-form').addEventListener('submit',event=>{
  event.preventDefault();if(active&&!active.staged&&!active.busy&&$('consent-guardian').checked)return load(active,'request');
 });
 $('consent-refresh').addEventListener('click',()=>{if(active?.hash&&!active.staged)return load(active);});
 $('consent-withdraw').addEventListener('click',()=>{
  if(active&&!active.staged&&!active.busy&&window.confirm('Withdraw parent permission and end child sessions? Existing records remain available for review or deletion.'))return load(active,'withdraw');
 });
 return {open,clear};
}
