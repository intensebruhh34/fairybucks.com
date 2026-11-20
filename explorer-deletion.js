export function explorerDeletion(getClient,onDeleted,onSetup,onReset) {
 const $=id=>document.getElementById(id);let active=null;
 function clear(){
  active=null;$('delete-explorer-panel').hidden=true;$('delete-explorer-form').reset();
  $('delete-explorer-fields').disabled=false;$('delete-explorer-cancel').disabled=false;
  $('delete-explorer-form').hidden=true;$('delete-explorer-retry').hidden=true;
  $('delete-explorer-setup').hidden=true;$('delete-explorer-status').textContent='';
  $('delete-explorer-name').textContent='';
 }
 function isActive(view){return active===view;}
 async function open(profile,ownerId){
  if(active?.saving)return;
  clear();const view=active={profile:{id:profile.id,nickname:profile.nickname},ownerId};
  $('delete-explorer-panel').hidden=false;$('delete-explorer-title').focus();
  $('delete-explorer-name').textContent=profile.nickname;
  $('delete-explorer-status').textContent='Checking this explorer…';
  try{
   const {data,error}=await getClient().rpc('fairybucks_delete_explorer',{p_child_id:profile.id,p_expected_parent:ownerId});
   if(!isActive(view))return;
   if(error)throw error;
   if(data?.status==='unavailable'){
    $('delete-explorer-status').textContent='This explorer is no longer available. Cancel and reload your explorers.';return;
   }
   if(!['ready','setup_required'].includes(data?.status)||data.profile?.id!==profile.id)throw Error('Review unavailable');
   view.profile=data.profile;$('delete-explorer-name').textContent=data.profile.nickname;
   if(data.status==='setup_required'){
    $('delete-explorer-setup').hidden=false;
    $('delete-explorer-status').textContent='Create a Parent PIN before deleting an explorer. Then reopen this review.';return;
   }
   view.ready=true;$('delete-explorer-form').hidden=false;
   $('delete-explorer-status').textContent='Review carefully. Nothing is deleted until you enter your PIN, type DELETE and select Permanently delete explorer.';
  }catch{
   if(isActive(view)){$('delete-explorer-status').textContent='We could not load deletion controls. Try again or contact support.';$('delete-explorer-retry').hidden=false;}
  }
 }
 async function submit(event){
  event.preventDefault();const view=active;if(!view?.ready||view.saving)return;
  if($('delete-explorer-confirm').value!=='DELETE'){$('delete-explorer-status').textContent='Type DELETE exactly to confirm.';return;}
  const pin=$('delete-explorer-pin').value;
  if(!/^[0-9]{6}$/.test(pin)){$('delete-explorer-status').textContent='Enter your six-digit Parent PIN.';return;}
  view.saving=true;$('delete-explorer-fields').disabled=true;$('delete-explorer-cancel').disabled=true;
  $('delete-explorer-pin').value='';$('delete-explorer-status').textContent='Deleting this explorer and their vault records…';
  try{
   const {data,error}=await getClient().rpc('fairybucks_delete_explorer',{
    p_child_id:view.profile.id,p_expected_parent:view.ownerId,p_expected_nickname:view.profile.nickname,p_confirmation:'DELETE',p_pin:pin
   });
   if(!isActive(view))return;
   if(error)throw error;
   const messages={incorrect_pin:'That PIN did not match. Nothing was deleted.',locked:'Too many PIN attempts. Wait 15 minutes or reset your Parent PIN. Nothing was deleted.',invalid_pin:'Enter your six-digit Parent PIN. Nothing was deleted.',confirmation_required:'Type DELETE exactly to confirm. Nothing was deleted.'};
   if(messages[data?.status]){$('delete-explorer-status').textContent=messages[data.status];return;}
   if(data?.status==='changed'&&data.profile?.id===view.profile.id){
    view.profile=data.profile;$('delete-explorer-name').textContent=data.profile.nickname;$('delete-explorer-confirm').value='';
    $('delete-explorer-status').textContent='This explorer’s nickname changed in another window. Review the updated name, then enter your PIN and type DELETE again. Nothing was deleted.';return;
   }
   if(data?.status==='setup_required'){
    view.ready=false;$('delete-explorer-form').hidden=true;$('delete-explorer-setup').hidden=false;
    $('delete-explorer-status').textContent='Create a Parent PIN, then reopen this review. Nothing was deleted.';return;
   }
   if(data?.status==='unavailable'){
    view.ready=false;$('delete-explorer-form').hidden=true;
    $('delete-explorer-status').textContent='This explorer is no longer available. Cancel and reload your explorers.';return;
   }
   if(data?.status!=='deleted'||data.child_id!==view.profile.id)throw Error('Deletion not confirmed');
   try{sessionStorage.removeItem('fairybucks-tooth:'+view.profile.id);}catch{}
   clear();await onDeleted(view.profile,view.ownerId);
  }catch{
   if(isActive(view)){
    view.ready=false;$('delete-explorer-form').hidden=true;$('delete-explorer-retry').hidden=false;
    $('delete-explorer-status').textContent='We could not confirm deletion. It may have completed if the response was lost. Reload the review or your explorer list before trying again, or contact support.';
   }
  }finally{view.saving=false;if(isActive(view)){$('delete-explorer-fields').disabled=false;$('delete-explorer-cancel').disabled=false;}}
 }
 $('delete-explorer-form').addEventListener('submit',submit);
 $('delete-explorer-retry').addEventListener('click',()=>{if(active&&!active.saving)open(active.profile,active.ownerId);});
 $('delete-explorer-cancel').addEventListener('click',()=>{if(!active?.saving)clear();});
 $('delete-explorer-setup').addEventListener('click',()=>{if(!active?.saving){clear();onSetup();}});
 $('delete-explorer-reset').addEventListener('click',()=>{if(!active?.saving){clear();onReset();}});
 return {open,clear};
}
