import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const {explorerDeletion}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../explorer-deletion.js',import.meta.url),'utf8')).toString('base64'));
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',events:{},addEventListener(n,f){this.events[n]=f;},focus(){},reset(){$('delete-explorer-pin').value='';$('delete-explorer-confirm').value='';}});return nodes.get(id);};
globalThis.document={getElementById:$};const removed=[];globalThis.sessionStorage={removeItem(k){removed.push(k);}};
let calls=[],deleted=[],setups=0,resets=0,mode='ready',resolve;
const first={id:'child-a',nickname:'First explorer'},second={id:'child-b',nickname:'Second explorer'};
const client={rpc:async(name,args)=>{
 calls.push([name,args]);
 return {data:args.p_confirmation?{status:mode==='ready'?'deleted':mode,child_id:args.p_child_id,profile:{id:args.p_child_id,nickname:'Updated nickname'}}:{status:mode,profile:{id:args.p_child_id,nickname:args.p_child_id==='child-a'?first.nickname:second.nickname}}};
}};
const flow=explorerDeletion(()=>client,async(...args)=>deleted.push(args),()=>setups++,()=>resets++);
const submit=()=>$('delete-explorer-form').events.submit({preventDefault(){}});
await flow.open(first,'parent-a');assert.equal($('delete-explorer-name').textContent,first.nickname);assert.equal($('delete-explorer-form').hidden,false);
assert.equal(calls.length,1);assert.equal(calls[0][1].p_confirmation,undefined);assert.equal(deleted.length,0);
$('delete-explorer-confirm').value='delete';$('delete-explorer-pin').value='123456';await submit();assert.equal(calls.length,1);
$('delete-explorer-confirm').value='DELETE';$('delete-explorer-pin').value='123';await submit();assert.equal(calls.length,1);
for(const state of ['incorrect_pin','locked','invalid_pin']){
 mode=state;$('delete-explorer-pin').value='123456';await submit();assert.equal(deleted.length,0);assert.equal($('delete-explorer-pin').value,'');assert.match($('delete-explorer-status').textContent,/Nothing was deleted/);
}
mode='changed';$('delete-explorer-pin').value='123456';await submit();assert.equal($('delete-explorer-name').textContent,'Updated nickname');assert.equal($('delete-explorer-confirm').value,'');assert.equal(deleted.length,0);
mode='ready';$('delete-explorer-confirm').value='DELETE';$('delete-explorer-pin').value='123456';await submit();
assert.equal(deleted.length,1);assert.equal(deleted[0][0].id,first.id);assert.equal($('delete-explorer-panel').hidden,true);assert.deepEqual(removed,['fairybucks-tooth:child-a']);
assert.deepEqual(calls.at(-1)[1],{p_child_id:first.id,p_expected_parent:'parent-a',p_expected_nickname:'Updated nickname',p_confirmation:'DELETE',p_pin:'123456'});
// Cancel and PIN setup/reset must never send a deletion request.
await flow.open(second,'parent-a');const before=calls.length;$('delete-explorer-cancel').events.click();assert.equal(calls.length,before);assert.equal($('delete-explorer-panel').hidden,true);
mode='setup_required';await flow.open(first,'parent-a');assert.equal($('delete-explorer-form').hidden,true);$('delete-explorer-setup').events.click();assert.equal(setups,1);
mode='ready';await flow.open(first,'parent-a');$('delete-explorer-reset').events.click();assert.equal(resets,1);assert.equal(deleted.length,1);
// Duplicate submission/target change while the destructive request is pending cannot retarget it.
await flow.open(first,'parent-a');$('delete-explorer-confirm').value='DELETE';$('delete-explorer-pin').value='123456';
client.rpc=async(name,args)=>{calls.push([name,args]);return await new Promise(r=>resolve=r);};const pending=submit();
assert.equal($('delete-explorer-fields').disabled,true);assert.equal($('delete-explorer-cancel').disabled,true);
const count=calls.length;await submit();await flow.open(second,'parent-b');assert.equal(calls.length,count);assert.equal(calls.at(-1)[1].p_child_id,first.id);
flow.clear();resolve({data:{status:'deleted',child_id:first.id}});await pending;assert.equal(deleted.length,1);assert.equal($('delete-explorer-panel').hidden,true);
// An old review response after account change/navigation must stay hidden.
const opening=flow.open(first,'parent-a');flow.clear();resolve({data:{status:'ready',profile:first}});await opening;assert.equal($('delete-explorer-panel').hidden,true);
client.rpc=async()=>({data:{status:'ready',profile:first}});await flow.open(first,'parent-a');
client.rpc=async()=>{throw Error('lost response');};$('delete-explorer-confirm').value='DELETE';$('delete-explorer-pin').value='123456';await submit();
assert.match($('delete-explorer-status').textContent,/may have completed/);assert.equal($('delete-explorer-form').hidden,true);assert.equal($('delete-explorer-retry').hidden,false);assert.equal(deleted.length,1);
client.rpc=async()=>({data:{status:'unavailable'}});await $('delete-explorer-retry').events.click();await new Promise(r=>setImmediate(r));assert.match($('delete-explorer-status').textContent,/no longer available/);
console.log('PASS explorer deletion UI: clear target, fresh PIN, confirmation, cancellation, setup/reset, stale replies, duplicate clicks and uncertain response');
