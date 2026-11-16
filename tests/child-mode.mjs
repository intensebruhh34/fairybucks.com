import {readFileSync} from 'node:fs';
const checkChildMode=async function checkChildMode(source) {
 const expect=(value,message)=>{if(!value)throw Error(message);};
 const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
 const vault={status:'active',nickname:'Only explorer A',balance:7,tooth_count:1,catalog:[],requests:[]};
 const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
 const body=source.replace(/^import .+;$/gm,'')+'\nreturn {load,change,request,cancel};';
 function setup(first) {
  const nodes=new Map(),events={},calls=[];
  const node=()=>({hidden:true,textContent:'',disabled:false,children:[],events:{},append(...xs){this.children.push(...xs);},replaceChildren(...xs){this.children=xs;},setAttribute(){},removeAttribute(){},focus(){},addEventListener(n,f){this.events[n]=f;},querySelector(){return node();}});
  const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const state={stored:'a'.repeat(64),clears:0,reloads:0,throwClear:false,handler:()=>({status:'expired'})};
  const doc={getElementById:$,createElement:node,querySelectorAll:()=>[],addEventListener(n,f){events[n]=f;}};
  const win={FAIRYBUCKS_AUTH_CONFIG:{url:'https://example.test',publishableKey:'sb_publishable_test'},confirm:()=>true,scrollTo(){},addEventListener(n,f){events[n]=f;}};
  const location={hash:'#vault',reload(){state.reloads++;},replace(){}};
  const fetch=async(url,options)=>{const args=JSON.parse(options.body);calls.push({url,options,args});const data=await(calls.length===1?first:state.handler(args));return {ok:true,json:async()=>data};};
  const api=new Function('window','document','location','fetch','childToken','clearChildToken','readChildRequests','storeChildRequests','deliveryText','treasureIcon','treasureDescription','crypto',body)(
   win,doc,location,fetch,()=>state.stored,()=>{state.clears++;if(state.throwClear)throw Error('Storage unavailable');state.stored=null;},()=>new Map(),()=>{},()=>'',()=>'',()=>'',{randomUUID:()=> '11111111-1111-4111-8111-111111111111'});
  return {api,state,$,calls};
 }
 // A previously active response must not redraw a page closed by an expired mutation.
 {
  const old=deferred(),s=setup(old.promise);await flush();
  await s.api.change('cancel',{p_request_id:'fixture'},()=> 'cancelled');
  expect(s.$('child-content').hidden,'Expired action must hide vault');
  old.resolve(vault);await flush();
  expect(s.$('child-content').hidden,'Late active view reopened an expired vault');
  expect(s.$('child-title').textContent==='✨ My Fairy Vault','Expired vault retained explorer name');
  const count=s.calls.length;await s.api.request({key:1,name:'Treasure',price:7});
  expect(s.calls.length===count,'Closed vault submitted another request');
 }
 // Clear private content even if removing the stored token throws.
 {
  const s=setup(vault);await flush();expect(!s.$('child-content').hidden,'Active fixture never rendered');
  s.state.throwClear=true;s.state.handler=()=>({status:'expired'});await s.api.load();
  expect(s.$('child-content').hidden,'Storage failure kept expired content visible');
  expect(s.$('request-list').children.length===0&&s.$('child-catalog').children.length===0,'Expired content was not cleared');
  expect(s.$('child-status').textContent.includes('session ended'),'Storage failure replaced expiry guidance with retry');
  s.state.handler=()=>vault;await s.api.load();expect(s.$('child-content').hidden,'Closed page reopened after storage failure');
 }
 // A changed session never receives the old explorer's delayed reply or has its token cleared.
 {
  const old=deferred(),s=setup(old.promise);await flush();s.state.stored='b'.repeat(64);old.resolve(vault);await flush();
  expect(s.$('child-content').hidden,'Old explorer displayed after session replacement');
  expect(s.state.stored==='b'.repeat(64)&&s.state.clears===0,'Old page cleared the new child token');
  expect(s.state.reloads===1,'New child session did not require a fresh page');
 }
 // Permission closure also invalidates a pending view; a missing token makes no request.
 {
  const old=deferred(),s=setup(old.promise);await flush();s.state.handler=()=>({status:'permission_required'});
  await s.api.change('cancel',{},()=> 'cancelled');old.resolve(vault);await flush();
  expect(s.$('child-content').hidden&&s.$('child-status').textContent.includes('parent permission'),'Late view bypassed permission closure');
  const missing=setup(vault);await flush();missing.state.stored=null;const count=missing.calls.length;
  await missing.api.load();expect(missing.calls.length===count&&missing.$('child-content').hidden,'Missing token still loaded child content');
 }
 // Request RPCs use only the scoped token and public key, never parent Authorization/cookies.
 {
  const s=setup(vault);await flush();const next=deferred();s.state.handler=()=>next.promise;
  const first=s.api.request({key:1,name:'Treasure',price:7});await flush();await s.api.request({key:1,name:'Treasure',price:7});
  expect(s.calls.filter(c=>c.args.p_action==='request').length===1,'Repeated click submitted twice');
  next.resolve({status:'expired'});await first;
  for(const c of s.calls){expect(c.options.credentials==='omit'&&!('Authorization' in c.options.headers),'Child RPC reused parent authentication');expect(c.args.p_token==='a'.repeat(64)&&!('p_child_id' in c.args),'Child RPC accepted a browser-selected explorer');}
 }
 return 'PASS child UI: expired/permission closure, late replies, replaced/missing sessions, storage failure and duplicate requests';
};
console.log(await checkChildMode(readFileSync(new URL('../child-vault.js',import.meta.url),'utf8')));
