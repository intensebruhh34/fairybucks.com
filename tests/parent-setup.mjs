import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const source=readFileSync(new URL('../parent-setup.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
for(const [,id] of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),'Missing DOM element '+id);
assert.match(html,/Help your child practice saving and budgeting—with a little Tooth Fairy magic/);
assert.match(html,/id="setup-guardian" type="checkbox" required/);assert.doesNotMatch(html,/id="setup-guardian"[^>]*\bchecked/);
assert.match(html,/Give permission and continue/);assert.match(html,/Explore the Family Vault/);
function fixture(options={}){
 const elements=new Map(),nodes=[];
 const make=()=>{const n={hidden:true,checked:false,disabled:false,value:'',valueAsNumber:5,textContent:'',events:{},children:[],
  focus(){},append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},reset(){},querySelectorAll(){return [];},addEventListener(name,fn){this.events[name]=fn;}};nodes.push(n);return n;};
 const $=id=>{if(!elements.has(id))elements.set(id,make());return elements.get(id);};
 const state={owner:'owner',allowed:false,sentEmail:false,pin:false,count:0,completed:false,calls:[],done:[],saved:0,reward:5,failSave:false};
 const ready=()=>({status:'ready',parent_id:'owner',has_pin:state.pin,explorers:state.count,completed:state.completed,first_explorer:'first',reward:state.reward});
 const client={auth:{getUser:async()=>({data:{user:{id:state.owner,email_confirmed_at:'today'}}})},rpc:async(name,args)=>{
  state.calls.push([name,args]);
  if(name==='fairybucks_parent_setup'){
   if(args.p_action==='save'){state.saved++;state.count=1;state.reward=args.p_reward;if(state.failSave)throw Error('lost reply');}
   if(args.p_action==='finish')state.completed=true;
   return {data:ready()};
  }
  if(name==='fairybucks_create_parent_pin'){state.pin=true;return {data:{status:'unlocked',token:'unlock'}};}
  if(name==='fairybucks_parent_pin')return {data:{status:'unlocked',token:'unlock'}};
 },functions:{invoke:async(name,{body})=>{
  state.calls.push([name,body]);if(body.action==='give_permission')state.sentEmail=true;
  return {data:{parent_id:state.owner,status:state.allowed?'verified':state.sentEmail?'requested':'needed',permission_allowed:state.allowed,version:3,notice_hash:'hash'}};
 }}};
 const api=new Function('document','parentNotice','siteContact','parentNoticeHash','storeChildToken','crypto','window','location',source.replace(/^import .+;$/gm,'').replaceAll('export ','')+'\nreturn {parentSetup};')(
  {getElementById:$,createElement:make},{version:3,sections:[['Notice','Required notice']]},{parentPermissionEnabled:true},async()=>'hash',()=>{},
  {randomUUID:()=> 'new-explorer'},{confirm:()=>false},{replace(){}});
 const flow=api.parentSetup(()=>client,user=>state.done.push(user.id));
 const submit=id=>$(id).events.submit({preventDefault(){}});
 return {flow,$,state,client,submit};
}
let s=fixture();await s.flow.open({id:'owner',email:'parent@example.test'});
assert.equal(s.$('setup-permission-step').hidden,false);assert.equal(s.$('setup-guardian').checked,false);
await s.submit('setup-permission');assert.equal(s.state.allowed,false);
s.$('setup-guardian').checked=true;await s.submit('setup-permission');assert.equal(s.state.sentEmail,true);assert.equal(s.state.allowed,false);assert.equal(s.$('setup-permission-step').hidden,false);\ns.state.allowed=true;await s.$('setup-retry').events.click();assert.equal(s.$('setup-pin-step').hidden,false);
s.$('setup-pin-new').value='493027';s.$('setup-pin-confirm').value='493028';await s.submit('setup-pin');assert.equal(s.state.pin,false);
s.$('setup-pin-confirm').value='493027';await s.submit('setup-pin');assert.equal(s.$('setup-explorer-step').hidden,false);
s.$('setup-nickname').value='Explorer';s.$('setup-gender').value='rather-not-say';s.$('setup-reward').valueAsNumber=7;
await s.submit('setup-explorer');assert.equal(s.state.saved,1);assert.equal(s.state.reward,7);assert.equal(s.$('setup-finish-step').hidden,false);
await s.$('setup-vault').events.click();assert.deepEqual(s.state.done,['owner']);assert.equal(s.state.completed,true);
await s.flow.open({id:'owner'});assert.deepEqual(s.state.done,['owner','owner']);
s=fixture();s.state.allowed=true;s.state.pin=true;s.state.failSave=true;await s.flow.open({id:'owner'});
s.$('setup-explorer-pin').value='493027';s.$('setup-nickname').value='Explorer';s.$('setup-gender').value='rather-not-say';await s.submit('setup-explorer');
assert.equal(s.state.saved,1);await s.$('setup-retry').events.click();assert.equal(s.$('setup-finish-step').hidden,false);assert.equal(s.state.saved,1);
s=fixture();s.state.owner='other';await s.flow.open({id:'owner'});assert.equal(s.state.allowed,false);assert.equal(s.$('setup-retry').hidden,false);
s=fixture();let resolve;s.client.auth.getUser=()=>new Promise(r=>resolve=r);const pending=s.flow.open({id:'owner'});s.flow.clear();resolve({data:{user:{id:'owner',email_confirmed_at:'today'}}});await pending;
assert.equal(s.$('parent-setup').hidden,true);assert.equal(s.state.calls.length,0);
console.log('PASS setup UI: unchecked consent, approval/PIN/explorer/finish, existing accounts, lost-save resume, wrong owner and late sign-out');
