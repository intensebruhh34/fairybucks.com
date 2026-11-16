import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../explorer-wallet.js',import.meta.url),'utf8');
const {explorerWallet}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const nodes=new Map();
const $=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,_disabled:false,get disabled(){return this._disabled;},set disabled(value){this._disabled=Boolean(value);},value:'',textContent:'',events:{},children:[],open:false,addEventListener(n,f){this.events[n]=f;},reset(){},replaceChildren(...items){this.children=items;}});return nodes.get(id);};
globalThis.document={getElementById:$,createElement:()=>({})};globalThis.window={confirm:()=>true};
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
let timers=[],calls=[],handler=()=>({data:null});
const oldTimeout=globalThis.setTimeout,oldClear=globalThis.clearTimeout;
globalThis.setTimeout=f=>(timers.push(f),f);globalThis.clearTimeout=()=>{};
const state={a:{balance:5,tooth_count:1,transactions:[],teeth:[],correctable_teeth:[]},b:{balance:9,tooth_count:2,transactions:[],teeth:[],correctable_teeth:[]}};
const client={async rpc(name,args){calls.push({name,args});if(name==='fairybucks_explorer_summary')return {data:state[args.p_child_id]};if(name==='fairybucks_parent_pin')return {data:args?{status:'unlocked',token:'test-unlock'}:{status:'pin_required'}};return handler(name,args);}};
const wallet=explorerWallet(()=>client);
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const submit=id=>$(id).events.submit({preventDefault(){}});
async function unlock(id){wallet.open(id);$('parent-controls').open=true;$('parent-controls').events.toggle();await flush();$('parent-pin').value='123456';await submit('pin-form');await flush();}
try{
 handler=()=>({data:{status:'saved',amount:5}});
 await unlock('a');assert.equal($('wallet-balance').textContent,'5 FB');assert.equal($('record-tooth').disabled,false);
 // A slow save must not freeze the next explorer's controls or change its display.
 let resolveSave;handler=()=>new Promise(resolve=>{resolveSave=resolve;});$('tooth-reward-amount').value='3';const slowSave=submit('reward-form');await flush();assert.equal($('reward-save').disabled,true);
 handler=()=>({data:{status:'saved',amount:3}});await unlock('b');
 assert.equal($('reward-save').disabled,false,'Switching explorers must restore enabled reward controls');
 assert.equal($('reward-retry').disabled,false);assert.equal($('tooth-reward-amount').disabled,false);assert.equal($('wallet-balance').textContent,'9 FB');
 resolveSave({data:{status:'saved',amount:3}});await slowSave;assert.equal($('wallet-balance').textContent,'9 FB');
 // The latest reload wins, including when an older request fails later.
 let rejectOld;handler=()=>new Promise((resolve,reject)=>{rejectOld=reject;});$('reward-retry').events.click();await flush();
 handler=()=>({data:{status:'saved',amount:9}});$('reward-retry').events.click();await flush();rejectOld(Error('late network error'));await flush();
 assert.equal($('reward-status').textContent,'Current family reward: 9 FB per tooth.','An old reload error must not replace newer success');
 // Invalid amounts never write; an uncertain tooth save reuses its ID after a retry/reopen.
 const before=calls.length;$('tooth-reward-amount').value='0';await submit('reward-form');assert.equal(calls.length,before);assert.match($('reward-status').textContent,/whole number/);
 let rejectTooth;handler=(name)=>name==='fairybucks_record_tooth'?new Promise((resolve,reject)=>{rejectTooth=reject;}):({data:{status:'saved',amount:9}});
 const record=$('record-tooth').events.click();await flush();await $('record-tooth').events.click();const first=calls.filter(c=>c.name==='fairybucks_record_tooth');assert.equal(first.length,1);rejectTooth(Error('lost response'));await record;assert.match($('tooth-status').textContent,/Couldn't confirm/);
 wallet.open(null);await unlock('b');handler=()=>({data:'saved'});await $('record-tooth').events.click();
 const retries=calls.filter(c=>c.name==='fairybucks_record_tooth');assert.equal(retries.length,2);assert.equal(retries[0].args.p_request_id,retries[1].args.p_request_id);assert.equal(storage.size,0);
 // Corrections send the selected explorer/tooth and retain the original reward amount.
 state.b.correctable_teeth=[{id:'original-tooth',lost_on:'2026-11-01',created_at:'2026-11-01T12:00:00Z',reward:3}];await wallet.refresh('b');$('undo-tooth-id').value='original-tooth';handler=()=>({data:'insufficient_balance'});await submit('undo-tooth-form');assert.match($('tooth-status').textContent,/enough Fairy Bucks/);assert.equal(calls.at(-1).args.p_child_id,'b');
 handler=()=>({data:'undone'});await submit('undo-tooth-form');assert.match($('tooth-status').textContent,/3 Fairy Bucks taken back/);
 // Expired unlocks return to PIN entry and stop further tooth writes.
 timers.at(-1)();assert.equal($('tooth-controls').hidden,true);assert.equal(wallet.unlockToken('b'),null);
 const count=calls.length;await $('record-tooth').events.click();assert.equal(calls.length,count);
 console.log('PASS wallet switching during saves, latest reload, duplicate clicks, uncertain retry IDs, original corrections and PIN expiry');
}finally{wallet.open(null);globalThis.setTimeout=oldTimeout;globalThis.clearTimeout=oldClear;}
