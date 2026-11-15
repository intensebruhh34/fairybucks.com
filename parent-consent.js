import {parentNotice} from '/parent-notice.js';
import {siteContact} from '/site-contact.js';
export async function parentNoticeHash(){
 const contact={operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,phone:siteContact.phone,supportEmail:siteContact.supportEmail};
 const bytes=new TextEncoder().encode(JSON.stringify({notice:parentNotice,contact}));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function parentConsent(getClient,onPermission){
 const $=id=>document.getElementById(id);let active=null;
 const contactsReady=()=>Boolean(siteContact.privacyNoticeReviewed&&siteContact.operatorName&&siteContact.mailingAddress&&siteContact.phone&&siteContact.supportEmail);
 function clear(){active=null;$('parent-consent-panel').hidden=true;$('consent-copy').replaceChildren();$('consent-print').replaceChildren();$('consent-guardian').checked=false;onPermission(false);}
 function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
 function renderNotice(){
  $('consent-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{const section=document.createElement('section');section.append(text('h3',title),text('p',copy));return section;}));
 }
 function printForm(view){
  const root=$('consent-print');
  root.replaceChildren(text('h1','Fairybucks — Parent Consent Form'),
   text('p',siteContact.operatorName+' · '+siteContact.mailingAddress+' · '+siteContact.phone+' · '+siteContact.supportEmail),
   text('p','Parent email: '+view.user.email),text('p','Account reference: '+view.user.id),
   text('p','Notice version: '+parentNotice.version+' · Reference: '+view.hash),
   text('p','Verification requested: '+view.data.requested_at));
  for(const [title,copy] of parentNotice.sections)root.append(text('h2',title),text('p',copy));
  root.append(text('p','Privacy notice: https://fairybucks.com/privacy.html'),
   text('p','I am the parent or legal guardian of the children whose explorer profiles I create in this account. I have read this notice and Privacy, and consent to the described collection and use for our family vault. I understand that I can withdraw permission and request deletion. This does not authorize targeted advertising or unrelated disclosure.'),
   text('p','Printed parent/guardian name: __________________________________'),
   text('p','Parent/guardian signature: _____________________________________'),
   text('p','Date signed: _____________________'),
   text('p','Email a readable scan/photo of this signed form from your registered parent email to '+siteContact.supportEmail+'. Do not include a child’s full name/photo, government ID, password or PIN. Child mode remains unavailable until the operator verifies your returned form.'));
 }
 function render(view){
  const status=view.data.status;
  const match=view.data.version===parentNotice.version&&view.data.notice_hash===view.hash;
  const ready=contactsReady()&&match&&status!=='setup_pending';
  const verified=ready&&status==='verified';view.verified=verified;
  $('consent-status').textContent=!ready?'Parent permission setup is not ready yet. Existing parent records and account deletion remain available; new explorers and child mode are paused.':{
   needed:'Read the notice, request verification, then return the signed form before adding explorers or opening child mode.',
   requested:'Verification requested. Print and sign the form, then email it to support. Child mode remains paused until your returned form is reviewed.',
   verified:'Parent permission verified for notice version '+parentNotice.version+'. You may add explorers and open child mode.',
   withdrawn:'Permission withdrawn. Child sessions have ended. Existing records remain available to you for review or deletion.'
  }[status]||'Permission is unavailable. Refresh or contact support.';
  $('consent-request-form').hidden=!ready||!['needed','withdrawn'].includes(status);
  $('consent-print-button').hidden=!ready||!['requested','verified'].includes(status);
  $('consent-withdraw').hidden=!['requested','verified'].includes(status);
  $('consent-refresh').disabled=false;$('consent-request').disabled=false;$('consent-withdraw').disabled=false;
  $('consent-print').hidden=true;
  if(ready&&['requested','verified'].includes(status))printForm(view);
  onPermission(verified);
 }
 async function load(view,action='status'){
  if(view!==active||view.busy)return;view.busy=true;
  $('consent-status').textContent='Checking parent permission…';
  for(const id of ['consent-refresh','consent-request','consent-withdraw'])$(id).disabled=true;
  try{
   const {data,error}=await getClient().rpc('fairybucks_parent_consent',action==='request'?{
    p_action:action,p_version:parentNotice.version,p_notice_hash:view.hash,p_guardian:true
   }:{p_action:action});
   if(view!==active)return;
   if(error||!data||!['setup_pending','needed','requested','verified','withdrawn'].includes(data.status))throw error||Error('Permission unavailable');
   view.data=data;render(view);
  }catch{
   if(view===active){onPermission(false);$('consent-request-form').hidden=true;$('consent-print-button').hidden=true;
    $('consent-status').textContent='We could not confirm parent permission. Refresh to check. New explorers and child mode remain paused.';}
  }finally{view.busy=false;if(view===active)for(const id of ['consent-refresh','consent-request','consent-withdraw'])$(id).disabled=false;}
 }
 async function open(ownerId){
  clear();const view=active={ownerId};$('parent-consent-panel').hidden=false;renderNotice();
  $('consent-request-form').hidden=true;$('consent-print-button').hidden=true;$('consent-withdraw').hidden=true;
  try{
   const [{data,error},hash]=await Promise.all([getClient().auth.getUser(),parentNoticeHash()]);
   if(view!==active)return;
   if(error||data.user?.id!==ownerId)throw error||Error('Account changed');
   view.user=data.user;view.hash=hash;await load(view);
  }catch{if(view===active){$('consent-status').textContent='Sign in again to review parent permission.';onPermission(false);}}
 }
 $('consent-request-form').addEventListener('submit',event=>{event.preventDefault();if(active&&!active.busy&&$('consent-guardian').checked)load(active,'request');});
 $('consent-refresh').addEventListener('click',()=>{if(active?.hash)load(active);});
 $('consent-withdraw').addEventListener('click',()=>{if(active&&!active.busy&&window.confirm('Withdraw parent permission and end all child vault sessions? Existing records remain available for parent review or deletion.'))load(active,'withdraw');});
 $('consent-print-button').addEventListener('click',()=>{
  const view=active;if(!view||view.busy||!contactsReady()||!['requested','verified'].includes(view.data?.status))return;
  window.print();
 });
 return {open,clear};
}
