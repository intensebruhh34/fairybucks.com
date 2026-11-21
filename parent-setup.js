import {parentNotice} from '/parent-notice.js';
import {parentNoticeHash} from '/parent-consent.js';
import {siteContact} from '/site-contact.js';
import {storeChildToken} from '/child-session.js';

// Server records decide completed steps; nothing sensitive is saved to browser storage.
export function parentSetup(getClient,onDone){
 const $=id=>document.getElementById(id);let active=null;
 function clear(){
  active=null;$('parent-setup').hidden=true;
  for(const id of ['setup-pin','setup-explorer'])$(id).reset();
  $('setup-guardian').checked=false;$('setup-handoff-pin').value='';
  $('setup-status').textContent='';$('setup-notice-copy').replaceChildren();
  $('setup-check-permission').hidden=true;
 }
 function show(view,step){
  if(view!==active)return;
  view.step=step;
  for(const id of ['permission','pin','explorer','finish'])$('setup-'+id+'-step').hidden=id!==step;
  $('setup-progress').textContent={permission:'Welcome and parent permission',pin:'Protect parent controls',explorer:'Set up your first explorer',finish:'Your Family Vault is ready'}[step];
  $('setup-title').textContent={permission:'A little magic. A lesson that lasts.',pin:'Keep grown-up settings in your hands',explorer:'Meet your first explorer',finish:'Let the magic begin'}[step];
  $('setup-title').focus();$('setup-status').textContent='';
 }
 async function rpc(view,action='status',extra={}){
  const {data,error}=await getClient().rpc('fairybucks_parent_setup',{p_action:action,p_expected_parent:view.user.id,...extra});
  if(view!==active)return null;
  if(error||!data)throw Error('We couldn’t confirm setup. Please try again.');
  if(data.status==='ready'&&data.parent_id!==view.user.id)throw Error('Sign in again to continue.');
  return data;
 }
 async function permission(view,action='status'){
  const {data,error}=await getClient().functions.invoke('parent-permission-email',{body:{action,expectedParent:view.user.id,guardian:action==='give_permission'&&$('setup-guardian').checked}});
  if(view!==active)return false;
  if(error||data?.parent_id!==view.user.id||data.version!==parentNotice.version||data.notice_hash!==view.hash)
   throw Error('We couldn’t confirm parent permission. Try again. You can still review existing records in the Parent Portal.');
  if(data.status==='verified'||data.permission_allowed===true){view.awaitingEmail=false;return true;}
  if(data.status==='requested'||data.status==='confirming')view.awaitingEmail=true;
  if(action==='give_permission'){
   if(data.status==='requested'){view.awaitingEmail=true;return false;}
   throw Error(data.status==='rate_limited'?'Please wait before trying again. Permission emails are limited to one per five minutes and six per day.':'We couldn’t send your permission email. Check your connection and try again.');
  }
  return false;
 }
 async function next(view){
  if(view!==active)return;
  if(!view.allowed){
   show(view,'permission');
   $('setup-check-permission').hidden=!view.awaitingEmail;
   if(view.awaitingEmail)$('setup-status').textContent='Check your parent email and approve through the link. Then return here and select “I approved — Continue setup.” No child access is granted until approval is verified.';
   return;
  }
  $('setup-check-permission').hidden=true;
  const d=await rpc(view);if(!d)return;
  view.data=d;
  if(d.status!=='ready')throw Error('Setup is unavailable. Please try again.');
  if(d.completed&&d.explorers>0&&d.has_pin){onDone(view.user);return;}
  if(!d.has_pin){show(view,'pin');return;}
  if(!d.explorers){
   show(view,'explorer');$('setup-reward').value=d.reward;
   $('setup-unlock-area').hidden=Boolean(view.unlock);return;
  }
  show(view,'finish');$('setup-handoff-unlock').hidden=Boolean(view.unlock);
 }
 async function run(fn){
  const view=active;if(!view||view.busy)return;
  view.busy=true;$('setup-retry').hidden=true;
  for(const button of $('parent-setup').querySelectorAll('button'))button.disabled=true;
  try{await fn(view);}catch(error){
   if(view===active){$('setup-status').textContent=error.message||'We couldn’t confirm setup. Try again.';$('setup-retry').hidden=false;}
  }finally{if(view===active){view.busy=false;for(const button of $('parent-setup').querySelectorAll('button'))button.disabled=false;}}
 }
 async function open(user){
  clear();const view=active={user};$('parent-setup').hidden=false;
  $('setup-email').textContent=user.email||'';
  $('setup-notice-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{
   const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');
   h.textContent=title;p.textContent=copy;section.append(h,p);return section;
  }));
  show(view,'permission');$('setup-status').textContent='Checking your setup…';
  await run(async()=>{
   const {data,error}=await getClient().auth.getUser();if(view!==active)return;
   if(error||data.user?.id!==user.id||!data.user.email_confirmed_at)throw Error('Verify your parent email before continuing setup.');
   view.hash=await parentNoticeHash();if(view!==active)return;
   let rehearsal=false;
   if(!siteContact.parentPermissionEnabled){
    const scope=await getClient().rpc('fairybucks_permission_rehearsal');if(view!==active)return;
    if(scope.error)throw Error('We couldn’t check setup availability. Try again.');
    rehearsal=scope.data?.parent_id===user.id&&scope.data?.enabled===true;
   }
   if(!siteContact.parentPermissionEnabled&&!rehearsal){
    // Existing development access is not consent. Never fake a successful approval.
    view.preview=true;view.allowed=false;
    $('setup-preview').hidden=false;$('setup-give-permission').hidden=true;
    $('setup-check-permission').hidden=true;
    $('setup-guardian-label').hidden=true;$('setup-preview-continue').hidden=true;
    $('setup-status').textContent='New explorer setup is paused until parent permission is available. You can still sign in and review existing family records.';
    return;
   }
   $('setup-preview').hidden=true;$('setup-give-permission').hidden=false;
   $('setup-guardian-label').hidden=false;$('setup-preview-continue').hidden=true;
   $('setup-check-permission').hidden=true;
   view.allowed=await permission(view);if(view!==active)return;await next(view);
  });
 }
 $('setup-permission').addEventListener('submit',event=>{
  event.preventDefault();if(!$('setup-guardian').checked)return;
  return run(async view=>{view.allowed=await permission(view,'give_permission');if(view===active)await next(view);});
 });
 $('setup-check-permission').addEventListener('click',()=>run(async view=>{
  view.allowed=await permission(view);
  if(view!==active)return;
  await next(view);
  if(!view.allowed)$('setup-status').textContent='Approval is not recorded yet. Open your emailed link, approve it, then select “I approved — Continue setup” again.';
 }));
 $('setup-preview-continue').addEventListener('click',()=>run(next));
 $('setup-pin').addEventListener('submit',event=>{
  event.preventDefault();return run(async view=>{
   const pin=$('setup-pin-new').value;
   if(!/^\d{6}$/.test(pin)||pin!==$('setup-pin-confirm').value)throw Error('Enter the same six-digit PIN in both fields.');
   const {data,error}=await getClient().rpc('fairybucks_create_parent_pin',{p_pin:pin,p_expected_parent:view.user.id});
   if(view!==active)return;$('setup-pin').reset();
   if(error)throw Error('We couldn’t confirm PIN creation. Try again; an existing PIN will not be replaced.');
   if(data?.status==='unlocked')view.unlock=data.token;
   else if(!['pin_required','locked'].includes(data?.status))throw Error('We couldn’t create your PIN. Please try again.');
   await next(view);
  });
 });
 async function unlock(view,pin){
  if(!/^\d{6}$/.test(pin))throw Error('Enter your six-digit Parent PIN.');
  const {data,error}=await getClient().rpc('fairybucks_parent_pin',{p_pin:pin,p_setup:false});
  if(view!==active)return false;
  if(error||data?.status!=='unlocked')throw Error(data?.status==='locked'?'Too many incorrect PINs. Wait fifteen minutes before trying again.':'We couldn’t unlock Parent controls. Check your PIN and try again.');
  view.unlock=data.token;return true;
 }
 $('setup-explorer').addEventListener('submit',event=>{
  event.preventDefault();return run(async view=>{
   if(!view.unlock&&!await unlock(view,$('setup-explorer-pin').value))return;
   $('setup-explorer-pin').value='';view.pendingId??=crypto.randomUUID();
   const d=await rpc(view,'save',{p_child_id:view.pendingId,p_nickname:$('setup-nickname').value.trim(),
    p_age:$('setup-age').value===''?null:$('setup-age').valueAsNumber,p_gender:$('setup-gender').value,
    p_reward:$('setup-reward').valueAsNumber,p_unlock_token:view.unlock});if(!d)return;
   if(d.status==='unlock_required'){view.unlock=null;$('setup-unlock-area').hidden=false;throw Error('For your security, enter your Parent PIN to finish saving.');}
   if(d.status==='already_started'){await next(view);return;}
   if(d.status!=='ready')throw Error(d.status==='permission_required'?'Parent permission is required. Return to the portal to review it.':'We couldn’t save the explorer. Check the details and try again.');
   view.data=d;$('setup-explorer').reset();await next(view);
  });
 });
 async function finish(view,handoff){
  if(handoff&&!view.unlock){if(!await unlock(view,$('setup-handoff-pin').value))return;$('setup-handoff-pin').value='';}
  const d=await rpc(view,'finish');if(!d)return;
  if(d.status!=='ready')throw Error('Setup changed. Check again before continuing.');
  if(!handoff){onDone(view.user);return;}
  if(!window.confirm('Open your explorer’s child vault? This tab will sign out of the parent account. Returning to parent controls requires signing in again.'))return;
  const {data,error}=await getClient().rpc('fairybucks_start_child_session',{p_child_id:d.first_explorer,p_unlock_token:view.unlock});
  if(view!==active)return;
  if(error||!data){view.unlock=null;$('setup-handoff-unlock').hidden=false;throw Error('Enter your Parent PIN and try Hand Over the Magic again.');}
  const signedOut=await getClient().auth.signOut({scope:'local'});
  if(signedOut.error)throw Error('We couldn’t sign out of the parent account. Please try again.');
  const state=await getClient().auth.getSession();
  if(state.error||state.data.session)throw Error('The parent account is still signed in. Return to sign-in and try again.');
  storeChildToken(data);location.replace('/child.html');
 }
 $('setup-vault').addEventListener('click',()=>run(view=>finish(view,false)));
 $('setup-handoff').addEventListener('click',()=>run(view=>finish(view,true)));
 $('setup-retry').addEventListener('click',()=>{const user=active?.user;if(user)return open(user);});
 $('setup-parent-only').addEventListener('click',()=>{if(active&&!active.busy)onDone(active.user);});
 return {open,clear,accountChanged(userId){if(active&&active.user.id!==userId){clear();return true;}return false;}};
}
