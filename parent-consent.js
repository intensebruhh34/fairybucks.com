import {parentNotice} from '/parent-notice.js';
import {siteContact} from '/site-contact.js';
export async function parentNoticeHash(){
 const contact={operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,phone:siteContact.phone,supportEmail:siteContact.supportEmail};
 const bytes=new TextEncoder().encode(JSON.stringify({notice:parentNotice,contact}));
 return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export function permissionRehearsalEmail(hash) {
 if(!/^[0-9a-f]{64}$/.test(hash))throw Error('A current notice reference is required');
 const subject='REHEARSAL — Fairy Bucks parent permission notice';
 const body=[
  'REHEARSAL ONLY — NOT A LIVE CONSENT REQUEST',
  'Use only your own test inbox. This draft does not grant or record permission.',
  '',
  'Fairy Bucks is operated by '+siteContact.operatorName+'.',
  siteContact.mailingAddress,
  'Phone: '+siteContact.phone,
  'Support and replies: '+siteContact.supportEmail,
  '',
  'Notice version: '+parentNotice.version,
  'Notice reference: '+hash,
  'Privacy notice: https://fairybucks.com/privacy.html',
  '',
  'This is a preview of the notice planned for the pilot. Parent permission will be required before collecting information from a child through child mode. The current development website is still staged.',
  '',
  ...parentNotice.sections.flatMap(([title,copy])=>[title,copy,'']),
  'Service providers and support: Supabase stores and protects vault/authentication records; GitHub Pages serves the website; Resend delivers account emails; jsDelivr serves the parent-page authentication library; configured email forwarding and Gmail handle support messages and returned forms. The forwarding provider and retention settings remain under review.',
  '',
  'TEST ONLY: read this email and the linked Privacy draft. Print the rehearsal form in the Parent Portal, use synthetic details, sign it, and return a readable scan/photo to '+siteContact.supportEmail+' with REHEARSAL in the subject. Do not send a child’s information, government ID, password, PIN or sign-in link.',
  'For the planned live flow, a parent can refuse or withdraw permission, request review/deletion, or ask questions using the support address. A reply or signed rehearsal form does not approve a real account.',
  '',
  'OPERATOR REVIEW ITEM: finalize the response deadline and deletion procedure for uncompleted permission requests before preparing a live notice. Confirm provider details and retention, then review this draft and the signed-form process before pilot use.'
 ].join('\n');
 return {subject,body};
}
export function parentConsent(getClient,onPermission){
 const $=id=>document.getElementById(id);let active=null;
 const contactsReady=()=>Boolean(siteContact.privacyNoticeReviewed&&siteContact.operatorName&&siteContact.mailingAddress&&siteContact.phone&&siteContact.supportEmail);
 function clear(){active=null;$('parent-consent-panel').hidden=true;$('consent-copy').replaceChildren();$('consent-print').replaceChildren();$('consent-guardian').checked=false;$('consent-rehearsal-panel').hidden=true;$('consent-rehearsal-email').value='';$('consent-rehearsal-status').textContent='';$('consent-rehearsal-print').disabled=true;$('consent-rehearsal-preview').disabled=false;onPermission(false);}
 function text(tag,value){const el=document.createElement(tag);el.textContent=value;return el;}
 function renderNotice(){
  $('consent-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{const section=document.createElement('section');section.append(text('h3',title),text('p',copy));return section;}));
 }
 function printForm(view,rehearsal=false){
  const root=$('consent-print');
  root.replaceChildren(text('h1',rehearsal?'REHEARSAL ONLY — Test Consent Form':'Fairybucks — Parent Consent Form'),
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
  if(view!==active||view.busy||view.rehearsal)return;view.busy=true;
  view.verified=false;view.data=null;onPermission(false);
  $('consent-print').replaceChildren();$('consent-print').hidden=true;
  $('consent-request-form').hidden=true;$('consent-print-button').hidden=true;
  $('consent-status').textContent='Checking parent permission…';
  for(const id of ['consent-refresh','consent-request','consent-withdraw'])$(id).disabled=true;
  try{
   const {data,error}=await getClient().rpc('fairybucks_parent_consent',action==='request'?{
    p_action:action,p_version:parentNotice.version,p_notice_hash:view.hash,p_guardian:true
   }:{p_action:action});
   if(view!==active)return;
   if(error||!data||!['setup_pending','needed','requested','verified','withdrawn'].includes(data.status))throw error||Error('Permission unavailable');
   if(data.status!=='setup_pending'&&data.parent_id!==view.ownerId)throw Error('Permission account changed');
   view.data=data;render(view);
  }catch{
   if(view===active){onPermission(false);$('consent-request-form').hidden=true;$('consent-print-button').hidden=true;
    $('consent-status').textContent='We could not confirm parent permission. Refresh to check. New explorers and child mode remain paused.';}
  }finally{view.busy=false;if(view===active)for(const id of ['consent-refresh','consent-request','consent-withdraw'])$(id).disabled=false;}
 }
 async function open(ownerId){
  // Staged development keeps the existing authenticated/PIN-controlled flow working.
  // This is not verified consent. The server independently enforces the launch setting.
  if(siteContact.parentPermissionEnabled===false){clear();active={ownerId,rehearsal:true};$('consent-rehearsal-panel').hidden=false;onPermission(true);return;}
  clear();const view=active={ownerId};$('parent-consent-panel').hidden=false;renderNotice();
  $('consent-request-form').hidden=true;$('consent-print-button').hidden=true;$('consent-withdraw').hidden=true;
  try{
   const [{data,error},hash]=await Promise.all([getClient().auth.getUser(),parentNoticeHash()]);
   if(view!==active)return;
   if(error||data.user?.id!==ownerId)throw error||Error('Account changed');
   view.user=data.user;view.hash=hash;await load(view);
  }catch{if(view===active){$('consent-status').textContent='Sign in again to review parent permission.';onPermission(false);}}
 }
 async function previewRehearsal(){
  const view=active;if(!view?.rehearsal||view.busy)return;
  view.busy=true;view.rehearsalReady=false;
  $('consent-rehearsal-preview').disabled=true;$('consent-rehearsal-print').disabled=true;
  $('consent-rehearsal-email').value='';$('consent-print').replaceChildren();
  $('consent-rehearsal-status').textContent='Preparing test paperwork…';
  try{
   const [{data,error},hash]=await Promise.all([getClient().auth.getUser(),parentNoticeHash()]);
   if(view!==active)return;
   if(error||data.user?.id!==view.ownerId)throw Error('Parent sign-in changed');
   const draft=permissionRehearsalEmail(hash);
   $('consent-rehearsal-email').value='Subject: '+draft.subject+'\n\n'+draft.body;
   printForm({user:{email:'parent@example.test — synthetic fixture',id:'REHEARSAL-ONLY-NOT-A-REAL-ACCOUNT'},hash,data:{requested_at:'REHEARSAL — no database request submitted'}},true);
   view.rehearsalReady=true;$('consent-rehearsal-print').disabled=false;
   $('consent-rehearsal-status').textContent='Test draft ready. Copy it manually to your own test email. Printing or returning this form does not verify permission.';
  }catch{if(view===active)$('consent-rehearsal-status').textContent='Sign in again to prepare the test paperwork.';}
  finally{view.busy=false;if(view===active)$('consent-rehearsal-preview').disabled=false;}
 }
 $('consent-rehearsal-preview').addEventListener('click',previewRehearsal);
 $('consent-rehearsal-print').addEventListener('click',()=>{if(active?.rehearsal&&active.rehearsalReady&&!active.busy)window.print();});
 $('consent-request-form').addEventListener('submit',event=>{event.preventDefault();if(active&&!active.rehearsal&&!active.busy&&$('consent-guardian').checked)load(active,'request');});
 $('consent-refresh').addEventListener('click',()=>{if(active?.hash&&!active.rehearsal)load(active);});
 $('consent-withdraw').addEventListener('click',()=>{if(active&&!active.rehearsal&&!active.busy&&window.confirm('Withdraw parent permission and end all child vault sessions? Existing records remain available for parent review or deletion.'))load(active,'withdraw');});
 $('consent-print-button').addEventListener('click',()=>{
  const view=active;if(!view||view.rehearsal||view.busy||!contactsReady()||!['requested','verified'].includes(view.data?.status))return;
  window.print();
 });
 return {open,clear};
}
