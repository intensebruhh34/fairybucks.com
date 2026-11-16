export function explorerProfileEditor(getClient,onSaved) {
 const $=id=>document.getElementById(id);let active=null;
 const original=p=>({nickname:p.nickname,age:p.age??null,gender:p.gender||'rather-not-say'});
 function fill(view,profile){view.profile=profile;view.original=original(profile);$('edit-profile-name').value=profile.nickname;$('edit-profile-age').value=profile.age??'';$('edit-profile-gender').value=profile.gender||'rather-not-say';}
 function clear(){active=null;$('edit-profile-panel').hidden=true;$('edit-profile-form').reset();$('edit-profile-fields').disabled=false;$('edit-profile-cancel').disabled=false;$('edit-profile-status').textContent='';}
 function open(profile,ownerId){
  if(active?.saving)return;
  clear();const view=active={ownerId};fill(view,profile);
  $('edit-profile-title').textContent='Edit explorer: '+profile.nickname;
  $('edit-profile-panel').hidden=false;$('edit-profile-name').focus();
 }
 async function save(event){
  event.preventDefault();const view=active;if(!view||view.saving)return;
  const nickname=$('edit-profile-name').value.trim(),ageText=$('edit-profile-age').value;
  const age=ageText===''?null:Number(ageText),gender=$('edit-profile-gender').value;
  if(!nickname||nickname.length>35){$('edit-profile-status').textContent='Enter a nickname with 1–35 characters.';return;}
  if(age!==null&&(!Number.isInteger(age)||age<2||age>18)){$('edit-profile-status').textContent='Leave age blank or enter a whole number from 2 to 18.';return;}
  if(!['boy','girl','rather-not-say'].includes(gender)){$('edit-profile-status').textContent='Choose an available option or Rather not say.';return;}
  view.saving=true;$('edit-profile-fields').disabled=true;$('edit-profile-cancel').disabled=true;
  $('edit-profile-status').textContent='Saving explorer details…';
  try{
   const {data,error}=await getClient().rpc('fairybucks_edit_explorer',{p_child_id:view.profile.id,p_nickname:nickname,p_age:age,p_gender:gender,p_expected_parent:view.ownerId,p_original:view.original});
   if(view!==active)return;
   if(error)throw error;
   if(data?.status==='changed'&&data.profile?.id===view.profile.id){fill(view,data.profile);$('edit-profile-status').textContent='This explorer changed in another window. The latest details are loaded; review them before saving again.';return;}
   if(data?.status==='unavailable'){$('edit-profile-status').textContent='This explorer is no longer available. Cancel and reload your explorers.';return;}
   if(data?.status!=='saved'||data.profile?.id!==view.profile.id)throw Error('Save not confirmed');
   clear();await onSaved(data.profile,view.ownerId);
  }catch{
   if(view===active)$('edit-profile-status').textContent='We could not confirm the save. Try again, or cancel and reload your explorers. Their balances and history are unchanged by profile editing.';
  }finally{view.saving=false;if(view===active){$('edit-profile-fields').disabled=false;$('edit-profile-cancel').disabled=false;}}
 }
 $('edit-profile-form').addEventListener('submit',save);
 $('edit-profile-cancel').addEventListener('click',()=>{if(!active?.saving)clear();});
 return {open,clear};
}
