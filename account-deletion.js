export function accountDeletion(getClient,onOpen,onDeleted,onBack) {
 const $=id=>document.getElementById(id);
 let active=null;
 function clear(){
  active=null; $('account-deletion-panel').hidden=true;
  $('account-deletion-form').reset(); $('account-deletion-form').hidden=true;
  $('account-deletion-status').textContent=''; $('account-deletion-email').textContent='';
 }
 async function open(){
  onOpen(); const view=active={};
  $('account-deletion-panel').hidden=false; $('account-deletion-title').focus();
  $('account-deletion-status').textContent='Checking your account…';
  $('account-deletion-retry').hidden=true; $('account-deletion-signout').hidden=true;
  try{
   const {data:auth,error:authError}=await getClient().auth.getUser();
   if(view!==active)return;
   if(authError || !auth.user)throw authError || Error('Sign in required');
   view.user=auth.user; $('account-deletion-email').textContent=auth.user.email || '';
   const {data,error}=await getClient().rpc('fairybucks_delete_account',{p_expected_parent:view.user.id});
   if(view!==active)return;
   if(error || !['ready','reauth_required'].includes(data?.status))throw error || Error('Unavailable');
   view.children=data.child_ids || []; view.requiresPin=data.requires_pin;
   $('account-deletion-count').textContent=String(view.children.length);
   $('account-deletion-pin-area').hidden=!view.requiresPin;
   $('account-deletion-pin').required=view.requiresPin;
   $('account-deletion-submit').disabled=false;
   if(data.status==='reauth_required'){
    $('account-deletion-status').textContent='Sign out and sign in again, then reopen this screen within ten minutes. A refreshed browser session is not enough.';
    $('account-deletion-signout').hidden=false; return;
   }
   view.ready=true; $('account-deletion-form').hidden=false;
   $('account-deletion-status').textContent='Review the permanent deletion below. Nothing is deleted until you submit the form.';
  }catch{
   if(view===active){$('account-deletion-status').textContent='We could not load deletion controls. Try again, or contact support.';$('account-deletion-retry').hidden=false;}
  }
 }
 async function submit(event){
  event.preventDefault();const view=active;
  if(!view?.ready || view.saving)return;
  if($('account-deletion-confirm').value!=='DELETE'){$('account-deletion-status').textContent='Type DELETE exactly to confirm.';return;}
  const pin=$('account-deletion-pin').value;
  if(view.requiresPin && !/^[0-9]{6}$/.test(pin)){$('account-deletion-status').textContent='Enter your six-digit Parent PIN.';return;}
  view.saving=true; $('account-deletion-submit').disabled=true;
  $('account-deletion-status').textContent='Deleting your account and family data…';
  $('account-deletion-pin').value='';
  try{
   let unlock=null;
   if(view.requiresPin){
    const {data,error}=await getClient().rpc('fairybucks_parent_pin',{p_pin:pin,p_setup:false});
    if(view!==active)return;
    if(error)throw error;
    if(data?.status!=='unlocked'){
     const messages={locked:'Too many PIN attempts. Wait 15 minutes, or recover your PIN before trying again.',incorrect_pin:'That PIN did not match. Nothing was deleted.',setup_required:'Your PIN settings changed. Reopen this screen before trying again.'};
     $('account-deletion-status').textContent=messages[data?.status] || 'Parent controls could not be unlocked. Nothing was deleted.';return;
    }
    unlock=data.token;
   }
   const {data,error}=await getClient().rpc('fairybucks_delete_account',{
    p_expected_parent:view.user.id,p_confirmation:'DELETE',p_unlock_token:unlock
   });
   if(view!==active)return;
   if(error)throw error;
   if(data?.status==='reauth_required'){
    view.ready=false;$('account-deletion-form').hidden=true;$('account-deletion-signout').hidden=false;
    $('account-deletion-status').textContent='Your recent sign-in expired. Sign out, sign in again and reopen deletion. Nothing was deleted.';return;
   }
   if(data?.status==='unlock_required'){$('account-deletion-status').textContent='The PIN unlock expired or changed. Enter your PIN again. Nothing was deleted.';return;}
   if(data?.status!=='deleted')throw Error('Deletion not confirmed');
   // Remove only this family's local retry state. Never clear other sites or accounts.
   try{for(const id of view.children)sessionStorage.removeItem('fairybucks-tooth:'+id);}catch{}
   clear();
   // Supabase clears local authentication even when the deleted session cannot sign out remotely.
   try{await getClient().auth.signOut({scope:'local'});}catch{}
   onDeleted();
  }catch{
   if(view===active){
    view.ready=false;$('account-deletion-form').hidden=true;$('account-deletion-retry').hidden=false;
    $('account-deletion-status').textContent='We could not confirm deletion. Your account may already be deleted if the response was lost. Try signing in before submitting another deletion, or contact support.';
   }
  }finally{view.saving=false;if(view===active)$('account-deletion-submit').disabled=false;}
 }
 $('account-deletion-form').addEventListener('submit',submit);
 $('account-deletion-retry').addEventListener('click',open);
 $('account-deletion-back').addEventListener('click',()=>{const user=active?.user;clear();onBack(user);});
 $('account-deletion-signout').addEventListener('click',async()=>{
  const view=active;if(!view)return;
  try{const {error}=await getClient().auth.signOut({scope:'local'});if(error)throw error;clear();onBack(null);}
  catch{if(view===active)$('account-deletion-status').textContent='Sign-out failed. Try again, or contact support.';}
 });
 return {open,clear,accountChanged(userId){if(active?.user && active.user.id!==userId){clear();return true;}return false;}};
}
