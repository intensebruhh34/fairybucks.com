import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {parentNotice} from '/parent-notice.js';
import {siteContact,renderContact} from '/site-contact.js';
import {parentNoticeHash} from '/parent-consent.js';
const $=id=>document.getElementById(id);
renderContact();
const link=new URLSearchParams(location.hash.slice(1));
const requestId=link.get('request'),token=link.get('token');
// Fragments never go to hosting logs/referrers. Do not persist this token to browser storage.
history.replaceState(null,'',location.pathname);
const valid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(requestId||'')&&/^[0-9a-f]{64}$/.test(token||'');
let client=null,generation=0,busy=false,canApprove=false,owner=null,hash=null;
function hide(){
 canApprove=false;$('permission-approve').hidden=true;$('permission-notice').hidden=true;
 $('permission-login').hidden=true;$('permission-retry').hidden=true;$('permission-switch').hidden=true;$('permission-guardian').checked=false;
 $('permission-account').textContent='';
}
async function check(action='inspect'){
 if(busy||!client)return;busy=true;const current=++generation;
 canApprove=false;$('permission-approve').hidden=true;$('permission-submit').disabled=true;
 $('permission-status').textContent='Checking parent permission…';
 try{
  const {data:auth,error:authError}=await client.auth.getUser();
  if(current!==generation)return;
  if(authError||!auth.user){hide();$('permission-login').hidden=false;$('permission-status').textContent='Sign in to review your permission email.';return;}
  owner=auth.user.id;$('permission-switch').hidden=false;
  if(!siteContact.parentPermissionEnabled||!siteContact.privacyNoticeReviewed){
   const {data:scope,error:scopeError}=await client.rpc('fairybucks_permission_rehearsal');
   if(current!==generation)return;
   if(scopeError||scope?.parent_id!==owner||scope?.enabled!==true){
    hide();$('permission-switch').hidden=false;$('permission-status').textContent='Email permission is still being prepared. This account is not enabled for the private rehearsal.';return;
   }
  }
  const {data,error}=await client.functions.invoke('parent-permission-email',{
   body:{action,requestId,token,guardian:action==='approve'&&$('permission-guardian').checked}
  });
  if(current!==generation)return;
  if(error||!data||data.parent_id!==owner)throw Error('Permission unavailable');
  if(data.version!==parentNotice.version||data.notice_hash!==hash){
   hide();$('permission-switch').hidden=false;$('permission-status').textContent='This notice changed or email permission is not ready. Return to the Parent Portal for a new email.';return;
  }
  if(!['requested','confirming','email_retry','verified'].includes(data.status)){
   hide();$('permission-switch').hidden=false;$('permission-status').textContent='This link is expired, withdrawn or belongs to another parent account. Return to the portal for a new email.';return;
  }
  $('permission-login').hidden=true;$('permission-notice').hidden=false;
  $('permission-account').textContent='Signed in as '+auth.user.email;
  canApprove=data.status==='requested';$('permission-approve').hidden=!canApprove;
  $('permission-retry').hidden=false;
  $('permission-status').textContent={
   requested:'Read the notice below, then choose whether to give permission.',
   confirming:'Your approval was received. We will automatically send a confirmation after at least one hour. You can close this page; child mode stays unavailable until confirmation is sent.',
   email_retry:'Your approval was received, but the confirmation email could not be confirmed. Select Check again to retry.',
   verified:'Permission is recorded and your confirmation email has been submitted for delivery. You can continue in the Parent Portal.'
  }[data.status];
 }catch{
  if(current===generation){canApprove=false;$('permission-status').textContent='We could not confirm permission. Check again or reopen the email. No permission is granted by this message.';$('permission-retry').hidden=false;}
 }finally{busy=false;if(current===generation)$('permission-submit').disabled=false;}
}
$('permission-login').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!client)return;
 const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{
  const {error}=await client.auth.signInWithPassword({email:$('permission-email').value.trim(),password:$('permission-password').value});
  $('permission-password').value='';if(error)throw error;await check();
 }catch{$('permission-status').textContent='Sign-in failed. Check your parent email and password.';}
 finally{button.disabled=false;}
});
$('permission-approve').addEventListener('submit',event=>{
 event.preventDefault();if(canApprove&&$('permission-guardian').checked)return check('approve');
});
$('permission-retry').addEventListener('click',()=>check('status'));
$('permission-switch').addEventListener('click',async()=>{
 if(busy||!client)return;++generation;hide();
 const {error}=await client.auth.signOut({scope:'local'});
 $('permission-login').hidden=Boolean(error);$('permission-switch').hidden=!error;
 $('permission-status').textContent=error?'Could not sign out. Try again.':'Sign in to the parent account that received this email.';
});
async function initialize(){
 hide();
 if(!valid){$('permission-status').textContent='Reopen the full permission link from your email, or request a new one in the Parent Portal.';return;}
 const cfg=window.FAIRYBUCKS_AUTH_CONFIG;
 if(!cfg?.url||!/^sb_publishable_/.test(cfg.publishableKey||''))throw Error('Setup pending');
 client=createClient(cfg.url,cfg.publishableKey,{auth:{detectSessionInUrl:false,autoRefreshToken:true,persistSession:true}});
 hash=await parentNoticeHash();
 $('permission-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{
  const section=document.createElement('section'),h=document.createElement('h2'),p=document.createElement('p');
  h.textContent=title;p.textContent=copy;section.append(h,p);return section;
 }));
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||(owner&&session?.user.id!==owner)){
   ++generation;hide();$('permission-login').hidden=false;
   $('permission-status').textContent='Sign in to the parent account that received this email.';
  }
 });
 await check();
}
initialize().catch(()=>{$('permission-status').textContent='Permission setup is unavailable. Return to the Parent Portal or contact support.';});
