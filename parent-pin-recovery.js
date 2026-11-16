// Email verification is enforced again by the database, not by this screen.
export function parentPinRecovery(getClient, redirectTo, onOpen, onDone) {
 const $ = id => document.getElementById(id);
 let active = null;
 let setupCheck = 0;
 const statuses = {
  email_required: 'To reset your Parent PIN, first verify your account email. Request a link below, then open the newest email.',
  email_used: 'This email verification has already been used for a PIN reset. Request a new link if you need another reset.',
  setup_required: 'Create your six-digit Parent PIN below. You do not need to add an explorer first.',
  ready: 'Email verified. Choose a new six-digit Parent PIN within ten minutes of opening the email link.'
 };
 function clear() {
  setupCheck++;
  $('pin-setup-open').hidden = true;
  active = null;
  $('pin-recovery-panel').hidden = true;
  $('pin-recovery-form').reset();
  $('pin-recovery-form').hidden = true;
  $('pin-recovery-email').textContent = '';
  $('pin-recovery-status').textContent = '';
 }
 async function refreshSetup(ownerId) {
  const checkId=++setupCheck;
  $('pin-setup-open').hidden=false;
  try {
   const {data,error}=await getClient().auth.getUser();
   if(checkId!==setupCheck)return;
   if(error||data.user?.id!==ownerId){$('pin-setup-open').hidden=true;return;}
   const status=await getClient().rpc('fairybucks_create_parent_pin',{p_expected_parent:ownerId});
   if(checkId!==setupCheck)return;
   if(!status.error && ['pin_required','locked'].includes(status.data?.status))$('pin-setup-open').hidden=true;
  } catch { /* Initial setup stays available; open() verifies the current account. */ }
 }
 function showSetup(view) {
  view.mode='setup';view.ready=true;
  $('pin-recovery-title').textContent='Create your Parent PIN';
  $('pin-recovery-description').textContent='Protect Parent controls with a six-digit PIN. You can create it before adding any explorers. Your account password stays the same.';
  $('pin-recovery-effects').hidden=true;
  $('pin-recovery-status').textContent=statuses.setup_required;
  $('pin-recovery-form').hidden=false;
  $('pin-recovery-send').hidden=true;
  $('pin-recovery-save').textContent='Create Parent PIN';
  $('pin-recovery-save').disabled=false;
 }
 async function open(options={}) {
  onOpen();
  const view = active = {mode:options.setup?'setup':'recovery'};
  $('pin-recovery-title').textContent=options.setup?'Create your Parent PIN':'Reset your Parent PIN';
  $('pin-recovery-description').textContent='Verify your parent email to choose a new PIN. Your account password stays the same.';
  $('pin-recovery-effects').hidden=false;
  $('pin-recovery-save').textContent='Save new Parent PIN';
  $('pin-recovery-form').reset();
  $('pin-recovery-panel').hidden = false;
  $('pin-recovery-title').focus();
  $('pin-recovery-form').hidden = true;
  $('pin-recovery-send').hidden = true;
  $('pin-recovery-retry').hidden = true;
  $('pin-recovery-status').textContent = 'Checking your parent account…';
  try {
   const {data,error} = await getClient().auth.getUser();
   if (view !== active) return;
   if (error || !data.user) throw error || new Error('Sign in required');
   view.user = data.user;
   $('pin-recovery-email').textContent = data.user.email || '';
   const pin=await getClient().rpc('fairybucks_create_parent_pin',{p_expected_parent:view.user.id});
   if(view!==active)return;
   if(pin.error || !['setup_required','pin_required','locked'].includes(pin.data?.status))throw pin.error || Error('PIN status unavailable');
   if(pin.data?.status==='setup_required'){showSetup(view);return;}
   if(view.mode==='setup') {
    $('pin-recovery-status').textContent='Your Parent PIN is already set. Enter it in Parent controls, or use Reset Parent PIN beside the PIN field if you forgot it.';
    return;
   }
   await check(view);
  } catch {
   if (view === active) {
    $('pin-recovery-status').textContent = 'We could not verify your parent account. Return to sign-in, or try again.';
    $('pin-recovery-retry').hidden = false;
   }
  }
 }
 async function check(view) {
  const {data,error} = await getClient().rpc('fairybucks_recover_parent_pin',{p_expected_parent:view.user.id});
  if (view !== active) return;
  if (error || !statuses[data?.status]) throw error || new Error('Recovery unavailable');
  if(data.status==='setup_required'){showSetup(view);return;}
  view.ready = data.status === 'ready';
  $('pin-recovery-status').textContent = statuses[data.status];
  $('pin-recovery-form').hidden = !view.ready;
  $('pin-recovery-send').hidden = view.ready || data.status === 'setup_required';
  $('pin-recovery-send').disabled = false;
  $('pin-recovery-save').disabled = false;
 }
 async function send() {
  const view = active;
  if (!view?.user?.email || view.mode!=='recovery' || view.sending) return;
  view.sending = true;
  $('pin-recovery-send').disabled = true;
  $('pin-recovery-status').textContent = 'Sending your email verification link…';
  try {
   const {error} = await getClient().auth.signInWithOtp({email:view.user.email,
    options:{shouldCreateUser:false,emailRedirectTo:redirectTo}});
   if (view !== active) return;
   if (error) throw error;
   $('pin-recovery-status').textContent = 'Check your parent email for a sign-in link. Open the newest link to choose a new Parent PIN. Check spam too. For another email, wait at least a minute before trying again.';
  } catch {
   if (view === active) $('pin-recovery-status').textContent = 'We could not send the link. Wait a minute and try again. If it still fails, contact your pilot host.';
  } finally {
   view.sending = false;
   if (view === active) $('pin-recovery-send').disabled = false;
  }
 }
 async function save(event) {
  event.preventDefault();
  const view = active;
  if (!view?.ready || view.saving) return;
  const pin = $('pin-recovery-new').value;
  if (!/^[0-9]{6}$/.test(pin) || pin !== $('pin-recovery-confirm').value) {
   $('pin-recovery-status').textContent = 'Enter the same six-digit PIN in both fields.'; return;
  }
  view.saving = true;
  $('pin-recovery-save').disabled = true;
  $('pin-recovery-form').reset();
  $('pin-recovery-status').textContent = view.mode==='setup'?'Creating your Parent PIN…':'Saving your new Parent PIN…';
  try {
   if(view.mode==='setup') {
    const {data,error}=await getClient().rpc('fairybucks_create_parent_pin',{p_pin:pin,p_expected_parent:view.user.id});
    if(view!==active)return;
    if(error)throw error;
    if(data?.status==='unlocked'){clear();onDone(view.user,true,'created');return;}
    if(!['pin_required','locked'].includes(data?.status))throw Error('Setup result unavailable');
    view.ready=false;$('pin-recovery-form').hidden=true;
    $('pin-recovery-status').textContent='A Parent PIN is already set. It was not changed. Return to Parent controls to enter it or use Reset Parent PIN beside the PIN field.';
    return;
   }
   const {data,error} = await getClient().rpc('fairybucks_recover_parent_pin',{p_new_pin:pin,p_expected_parent:view.user.id});
   if (view !== active) return;
   if (error) throw error;
   if (data?.status === 'saved') { clear(); onDone(view.user,true); return; }
   view.ready = false;
   $('pin-recovery-form').hidden = true;
   $('pin-recovery-send').hidden = false;
   $('pin-recovery-status').textContent = statuses[data?.status] || 'The PIN could not be reset. Request a fresh email link and try again.';
  } catch {
   if (view === active) {
    // The response may have been lost after a successful commit. Never silently retry a different PIN.
    view.ready = false;
    $('pin-recovery-form').hidden = true;
    $('pin-recovery-send').hidden = view.mode==='setup';
    $('pin-recovery-retry').hidden = view.mode!=='setup';
    $('pin-recovery-status').textContent = view.mode==='setup'?'We could not confirm PIN creation. Return to the portal and check PIN setup before trying again. An existing PIN will not be overwritten.':'We could not confirm the reset. Return to your vault and try the new PIN. If it does not work, request a fresh email link.';
   }
  } finally {
   view.saving = false;
   if (view === active) $('pin-recovery-save').disabled = false;
  }
 }
 $('pin-recovery-send').addEventListener('click',send);
 $('pin-recovery-retry').addEventListener('click',()=>open({setup:active?.mode==='setup'}));
 $('pin-recovery-form').addEventListener('submit',save);
 $('pin-recovery-back').addEventListener('click',()=>{ const user=active?.user; clear(); onDone(user,false); });
 return {open,clear,refreshSetup,accountChanged(userId) {
  if (active?.user && active.user.id !== userId) { clear(); return true; }
  return false;
 }};
}
