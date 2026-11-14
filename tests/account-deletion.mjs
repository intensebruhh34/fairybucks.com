import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../account-deletion.js',import.meta.url),'utf8');
const {accountDeletion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const elements=new Map();
class Element{constructor(){this.events={};this.hidden=true;this.value='';this.disabled=false;}addEventListener(n,fn){this.events[n]=fn;}focus(){}reset(){for(const id of ['account-deletion-pin','account-deletion-confirm'])$(id).value='';}}
const $=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
globalThis.document={getElementById:$};
let mode='ready',requiresPin=true,deleted=0,signedOut=0,calls=[],pinResult='unlocked',back=null;
const user={id:'owner-a',email:'parent@example.test'};
const client={auth:{getUser:async()=>({data:{user}}),signOut:async()=>{signedOut++;return {}; }},rpc:async(name,args)=>{
 calls.push([name,args]);if(name==='fairybucks_parent_pin')return {data:{status:pinResult,token:'synthetic-unlock'}};
 return {data:args?.p_confirmation?{status:mode==='expired'?'reauth_required':'deleted'}:{status:mode,requires_pin:requiresPin,child_ids:['child-a']}};
}};
globalThis.sessionStorage={removeItem(key){calls.push(['remove',key]);}};
const flow=accountDeletion(()=>client,()=>{},()=>deleted++,user=>back=user);
const submit=()=>$('account-deletion-form').events.submit({preventDefault(){}});
await flow.open();assert.equal($('account-deletion-form').hidden,false);assert.equal(deleted,0);
$('account-deletion-confirm').value='delete';const before=calls.length;await submit();assert.equal(calls.length,before);
$('account-deletion-confirm').value='DELETE';$('account-deletion-pin').value='123';await submit();assert.equal(deleted,0);
$('account-deletion-pin').value='654321';pinResult='incorrect_pin';await submit();assert.equal(deleted,0);assert.match($('account-deletion-status').textContent,/did not match/);
assert.equal(calls.filter(([name,args])=>args?.p_confirmation).length,0);
pinResult='unlocked';$('account-deletion-pin').value='654321';await submit();
assert.equal(deleted,1);assert.equal(signedOut,1);assert.equal($('account-deletion-panel').hidden,true);
assert.ok(calls.some(([name,key])=>name==='remove'&&key==='fairybucks-tooth:child-a'));
const request=calls.find(([name,args])=>args?.p_confirmation)?.[1];
assert.equal(request.p_expected_parent,user.id);assert.equal(request.p_confirmation,'DELETE');
assert.equal(request.p_unlock_token,'synthetic-unlock');
mode='reauth_required';await flow.open();assert.equal($('account-deletion-form').hidden,true);assert.equal($('account-deletion-signout').hidden,false);
mode='ready';requiresPin=false;await flow.open();assert.equal($('account-deletion-pin-area').hidden,true);
$('account-deletion-confirm').value='DELETE';await submit();assert.equal(deleted,2);
// A fresh review can expire while the parent is reading it.
await flow.open();mode='expired';$('account-deletion-confirm').value='DELETE';await submit();assert.equal(deleted,2);assert.equal($('account-deletion-form').hidden,true);
// Never label an uncertain server response as successful deletion.
mode='ready';await flow.open();client.rpc=async()=>{throw Error('network');};
$('account-deletion-confirm').value='DELETE';await submit();assert.equal(deleted,2);assert.match($('account-deletion-status').textContent,/may already be deleted/);
// Navigation/account changes while a read is in flight cannot restore deletion controls.
let resolve;client.rpc=()=>new Promise(r=>{resolve=r;});const opening=flow.open();await new Promise(r=>setImmediate(r));flow.clear();
resolve({data:{status:'ready',requires_pin:false,child_ids:[]}});await opening;assert.equal($('account-deletion-panel').hidden,true);
client.rpc=async()=>({data:{status:'ready',requires_pin:false,child_ids:[]}});await flow.open();assert.equal(flow.accountChanged('owner-b'),true);assert.equal($('account-deletion-panel').hidden,true);
console.log('PASS deletion review, typed confirmation, PIN check, recent sign-in, empty account, cleanup, account switch and uncertain result');
