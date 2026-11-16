import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../parent-pin-recovery.js',import.meta.url),'utf8');
const {parentPinRecovery}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const nodes=new Map();class Node{constructor(){this.hidden=true;this.value='';this.events={};}addEventListener(n,fn){this.events[n]=fn;}focus(){}reset(){for(const id of ['pin-recovery-new','pin-recovery-confirm'])$(id).value='';}}
const $=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};globalThis.document={getElementById:$};
let status='setup_required',calls=[],done=[],pending;const user={id:'synthetic-parent',email:'parent@example.test'};
const client={auth:{getUser:async()=>({data:{user}})},rpc:async(name,args)=>{calls.push([name,args]);if(pending)return pending;if(name==='fairybucks_create_parent_pin'&&args?.p_pin){if(status==='setup_required'){status='pin_required';return {data:{status:'unlocked'}};}return {data:{status:'pin_required'}};}return {data:{status}};}};
const flow=parentPinRecovery(()=>client,'https://example.test/auth.html',()=>{},(...a)=>done.push(a));
await flow.refreshSetup(user.id);assert.equal($('pin-setup-open').hidden,false);
await flow.open({setup:true});assert.equal($('pin-recovery-form').hidden,false);assert.match($('pin-recovery-title').textContent,/Create/);assert.equal($('pin-recovery-send').hidden,true);
$('pin-recovery-new').value='123456';$('pin-recovery-confirm').value='654321';await $('pin-recovery-form').events.submit({preventDefault(){}});assert.equal(calls.filter(([,args])=>args?.p_pin).length,0);
$('pin-recovery-confirm').value='123456';await $('pin-recovery-form').events.submit({preventDefault(){}});assert.equal(done.at(-1)[2],'created');assert.equal(calls.at(-1)[1].p_expected_parent,user.id);assert.equal($('pin-recovery-new').value,'');assert.equal(calls.some(([name])=>name==='fairybucks_recover_parent_pin'),false,'Creation must not request recovery or an email');
await flow.refreshSetup(user.id);assert.equal($('pin-setup-open').hidden,true);
await flow.open({setup:true});assert.equal($('pin-recovery-form').hidden,true);assert.match($('pin-recovery-status').textContent,/already set/);
// Recovery on an account with no PIN offers creation instead of a dead-end error.
status='setup_required';await flow.open();assert.equal($('pin-recovery-form').hidden,false);assert.match($('pin-recovery-title').textContent,/Create/);
// A concurrent PIN creation must never become an overwrite/reset.
status='pin_required';$('pin-recovery-new').value='123456';$('pin-recovery-confirm').value='123456';await $('pin-recovery-form').events.submit({preventDefault(){}});assert.match($('pin-recovery-status').textContent,/not changed/);assert.equal(done.length,1);
// Account switches/sign-out invalidate a late setup response.
status='setup_required';await flow.open({setup:true});let resolve;pending=new Promise(r=>resolve=r);$('pin-recovery-new').value='123456';$('pin-recovery-confirm').value='123456';const saving=$('pin-recovery-form').events.submit({preventDefault(){}});flow.accountChanged('other-parent');resolve({data:{status:'unlocked'}});await saving;pending=null;assert.equal(done.length,1);assert.equal($('pin-recovery-panel').hidden,true);
const html=readFileSync(new URL('../auth.html',import.meta.url),'utf8');assert.doesNotMatch(html,/id="pin-recovery-open"/);assert.match(html,/id="pin-setup-open" hidden>Create Parent PIN/);assert.match(html,/<\/form>\s*<button type="button" id="pin-forgot" hidden>Reset Parent PIN/);
console.log('PASS first-PIN setup without explorers, existing-PIN protection, reset fallback, placement and stale responses');
