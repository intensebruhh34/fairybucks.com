import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {parentNotice} from '/parent-notice.js';
import {siteContact} from '/site-contact.js';
const $=id=>document.getElementById(id);
const token=new URLSearchParams(location.hash.slice(1)).get('token');
history.replaceState(null,'',location.pathname);
let client=null,owner=null,busy=false,ready=false,generation=0;
function hide(){
 ready=false;$('test-notice').hidden=true;$('test-login').hidden=true;$('test-switch').hidden=true;
 $('test-retry').hidden=true;$('test-account').textContent='';$('test-acknowledge').checked=false;
}
function message(text){$('test-status').textContent=text;}
async function inspect(){
 if(!client||busy)return;busy=true;ready=false;const current=++generation;
 $('test-action-form').hidden=true;$('test-retry').hidden=true;
 try{
  const {data,error}=await client.auth.getUser();if(current!==generation)return;
  if(error||!data.user){hide();owner=null;$('test-login').hidden=false;message('Sign in to your chosen test parent account.');return;}
  owner=data.user.id;$('test-switch').hidden=false;$('test-login').hidden=true;
  if(token){
   const result=await client.functions.invoke('parent-permission-rehearsal',{body:{action:'inspect',token}});
   if(current!==generation)return;
   if(result.error||result.data?.parent_id!==owner||result.data.status!=='test_link_ready')throw Error('Test link unavailable');
  }
  $('test-account').textContent='Signed in as '+data.user.email;
  $('test-notice').hidden=false;$('test-action-form').hidden=false;
  $('test-send').textContent=token?'Send test confirmation':'Email me a test notice';
  $('test-acknowledge').checked=false;ready=true;
  message(token?'The test link matches this parent account. Sending a test confirmation records no consent.':'Ready to request a test notice for this parent account. The server will check the private test inbox setting.');
 }catch{
  if(current===generation){ready=false;$('test-action-form').hidden=true;$('test-retry').hidden=false;
   message('The test is not available for this account or link. Check the private test inbox setting, or reopen the email. The link may have expired.');}
 }finally{busy=false;if(current===generation)$('test-send').disabled=false;}
}
async function sendTest(event){
 event.preventDefault();if(!ready||busy||!$('test-acknowledge').checked)return;
 busy=true;const current=++generation;const expectedOwner=owner;
 $('test-send').disabled=true;$('test-retry').hidden=true;
 message('Submitting the test email…');
 try{
  const {data:auth,error:authError}=await client.auth.getUser();if(current!==generation)return;
  if(authError||auth.user?.id!==expectedOwner)throw Error('Account changed');
  const {data,error}=await client.functions.invoke('parent-permission-rehearsal',{
   body:{action:token?'confirm':'request',token:token||undefined,acknowledged:true}
  });
  if(current!==generation)return;
  const expected=token?'test_confirmation_sent':'test_notice_sent';
  if(error||data?.parent_id!==expectedOwner||data.status!==expected)throw Error('Mail unavailable');
  ready=false;$('test-action-form').hidden=true;$('test-acknowledge').checked=false;
  message(token?'Test confirmation submitted for delivery. Check your inbox/spam folder. No consent was recorded and the vault was not changed.':'Test notice submitted for delivery. Open its link from your inbox/spam folder to check the confirmation step. No consent was recorded.');
 }catch{
  if(current===generation){$('test-retry').hidden=false;message('The test email could not be confirmed. Check the test inbox setting and delivery setup, then retry. A retry uses the same message identifier. No consent was recorded.');}
 }finally{busy=false;if(current===generation)$('test-send').disabled=false;}
}
$('test-action-form').addEventListener('submit',sendTest);
$('test-retry').addEventListener('click',inspect);
$('test-login').addEventListener('submit',async event=>{
 event.preventDefault();if(busy||!client)return;const button=event.currentTarget.querySelector('button');button.disabled=true;
 try{
  const {error}=await client.auth.signInWithPassword({email:$('test-email').value.trim(),password:$('test-password').value});
  $('test-password').value='';if(error)throw error;await inspect();
 }catch{message('Sign-in failed. Check your parent email and password.');}finally{button.disabled=false;}
});
$('test-switch').addEventListener('click',async()=>{
 if(busy||!client)return;++generation;hide();
 const {error}=await client.auth.signOut({scope:'local'});
 $('test-login').hidden=Boolean(error);$('test-switch').hidden=!error;
 message(error?'Could not sign out. Try again.':'Sign in to your chosen test parent account.');
});
async function initialize(){
 hide();
 if(siteContact.parentPermissionEnabled!==false||siteContact.privacyNoticeReviewed!==false){message('This staged delivery test is unavailable after activation.');return;}
 if(token&&(token.length>1200||!/^[-A-Za-z0-9_]+\.[0-9a-f]{64}$/.test(token))){message('Reopen the full test link from the email.');return;}
 const cfg=window.FAIRYBUCKS_AUTH_CONFIG;
 if(!cfg?.url||!/^sb_publishable_/.test(cfg.publishableKey||''))throw Error('Setup pending');
 client=createClient(cfg.url,cfg.publishableKey,{auth:{detectSessionInUrl:false,autoRefreshToken:true,persistSession:true}});
 $('test-copy').replaceChildren(...parentNotice.sections.map(([title,copy])=>{
  const section=document.createElement('section'),h=document.createElement('h3'),p=document.createElement('p');
  h.textContent=title;p.textContent=copy;section.append(h,p);return section;
 }));
 client.auth.onAuthStateChange((event,session)=>{
  if(event==='SIGNED_OUT'||(owner&&session?.user.id!==owner)){
   ++generation;owner=null;hide();$('test-login').hidden=false;message('Sign in to the parent account chosen for this test.');
  }
 });
 await inspect();
}
initialize().catch(()=>message('Could not prepare this test. Return to the Parent Portal or contact support.'));
