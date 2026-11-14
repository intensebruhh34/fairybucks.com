import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../parent-pin-recovery.js',import.meta.url),'utf8');
const {parentPinRecovery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element {
 constructor(){this.events={};this.hidden=true;this.disabled=false;this.value='';this.textContent='';}
 addEventListener(name,fn){this.events[name]=fn;}
 reset(){for(const id of ['pin-recovery-new','pin-recovery-confirm'])elements.get(id).value='';}
 focus(){}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element());return elements.get(id);}};
const $=id=>document.getElementById(id);
let proof='email_required',calls=[],done=[],pending=null;
const user={id:'parent-a',email:'parent@example.test'};
const client={auth:{getUser:async()=>({data:{user}}),signInWithOtp:async args=>{calls.push(['email',args]);return {error:null};}},
 rpc:async(name,args)=>{calls.push([name,args]);if(pending)return pending;
 return {data:{status:args?.p_new_pin?'saved':proof}};}};
const recovery=parentPinRecovery(()=>client,'https://example.test/auth.html',()=>{},(...args)=>done.push(args));
const click=id=>$(id).events.click();
const submit=()=>$('pin-recovery-form').events.submit({preventDefault(){}});
await recovery.open();
assert.equal($('pin-recovery-form').hidden,true);
assert.equal($('pin-recovery-send').hidden,false);
await click('pin-recovery-send');
const sent=calls.find(([name])=>name==='email')[1];
assert.equal(sent.email,user.email);assert.equal(sent.options.shouldCreateUser,false);
assert.equal(sent.options.emailRedirectTo,'https://example.test/auth.html');
assert.match($('pin-recovery-status').textContent,/newest link/);
proof='ready';await recovery.open();
assert.equal($('pin-recovery-form').hidden,false);
$('pin-recovery-new').value='654321';$('pin-recovery-confirm').value='123456';
const before=calls.length;await submit();assert.equal(calls.length,before);
$('pin-recovery-new').value='654321';$('pin-recovery-confirm').value='654321';
await submit();
assert.equal(done.length,1);assert.equal(done[0][1],true);
assert.equal(calls.find(([name,args])=>args?.p_new_pin)?.[1].p_expected_parent,user.id);
assert.equal($('pin-recovery-panel').hidden,true);
assert.equal($('pin-recovery-new').value,'');
// A verified screen can expire before Save; server rejection must hide the form.
await recovery.open();
client.rpc=async()=>({data:{status:'email_required'}});
$('pin-recovery-new').value='654321';$('pin-recovery-confirm').value='654321';await submit();
assert.equal($('pin-recovery-form').hidden,true);assert.equal(done.length,1);
assert.equal($('pin-recovery-send').hidden,false);
// Sign-out/navigation during an in-flight status check cannot reopen the form.
let resolve;
client.rpc=()=>new Promise(r=>{resolve=r;});
const opening=recovery.open();await new Promise(r=>setImmediate(r));recovery.clear();
resolve({data:{status:'ready'}});await opening;
assert.equal($('pin-recovery-panel').hidden,true);assert.equal($('pin-recovery-form').hidden,true);
// An uncertain network save does not claim success or silently repeat the write.
client.rpc=async()=>({data:{status:'ready'}});await recovery.open();
client.rpc=async()=>{throw Error('network');};
$('pin-recovery-new').value='654321';$('pin-recovery-confirm').value='654321';await submit();
assert.match($('pin-recovery-status').textContent,/could not confirm/);assert.equal(done.length,1);
client.rpc=async()=>({data:{status:'ready'}});await recovery.open();
assert.equal(recovery.accountChanged('parent-b'),true);
assert.equal($('pin-recovery-panel').hidden,true);
console.log('PASS email request, matching PINs, expiry, stale response and uncertain-save recovery UI');
