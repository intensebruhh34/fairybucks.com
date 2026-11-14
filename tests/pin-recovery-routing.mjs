import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
 .replace(/^import .*;$/gm,'').replace('initialize().catch','globalThis.ready=initialize().catch');
async function route(hash,search='',child=false,session=true,proof='ready'){
 const nodes=new Map(),observed={recovery:0,password:false,childCleared:0,redirect:null,signed:0};
 const node=id=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:'',value:'',classList:{toggle(){}},addEventListener(){},replaceChildren(){},reset(){}});return nodes.get(id);};
 const user={id:'parent-a',email:'parent@example.test'};
 const wallet={open(){}};const requests={open(){},renderReview(){}};
 const client={auth:{onAuthStateChange(){},async getSession(){return {data:{session:session?{user}:null}};},async verifyOtp(){return {};},async exchangeCodeForSession(){return {};}},async rpc(){return {data:{status:proof}};}};
 const context={URLSearchParams,console,setTimeout,clearTimeout,
 document:{getElementById:node,querySelectorAll(){return [];},querySelector:node},
 window:{FAIRYBUCKS_AUTH_CONFIG:{url:'https://example.test',publishableKey:'sb_publishable_test'},addEventListener(){}},
 location:{origin:'https://example.test',pathname:'/auth.html',hash,search,replace(url){observed.redirect=url;}},
 history:{replaceState(){}},createClient:()=>client,
 explorerWallet:()=>wallet,explorerRequests:()=>requests,
 parentGuide:()=>({clear(){},open(){observed.signed++;}}),
 parentPinRecovery:(_client,_target,onOpen)=>({clear(){},accountChanged(){return false;},async open(){onOpen();observed.recovery++;}}),
 childToken:()=>child?'synthetic-child-session':null,storeChildToken(){},clearChildToken(){observed.childCleared++;}};
 vm.createContext(context);vm.runInContext(source,context);await context.ready;
 observed.password=node('new-password').hidden===false;
 return observed;
}
let r=await route('#access_token=synthetic&type=magiclink','',true);
assert.equal(r.recovery,1);assert.equal(r.childCleared,1);assert.equal(r.redirect,null);assert.equal(r.password,false);
r=await route('#access_token=synthetic&type=recovery');assert.equal(r.password,true);assert.equal(r.recovery,0);
r=await route('#access_token=synthetic&type=invite');assert.equal(r.password,true);assert.equal(r.recovery,0);
r=await route('#access_token=synthetic&type=signup');assert.equal(r.signed,1);assert.equal(r.recovery,0);
r=await route('','?code=synthetic');assert.equal(r.recovery,1);assert.equal(r.password,false);
r=await route('','?token_hash=synthetic&type=email');assert.equal(r.recovery,1);
r=await route('','',true);assert.equal(r.redirect,'/child.html');assert.equal(r.recovery,0);
r=await route('#access_token=synthetic&type=magiclink','',false,false);assert.equal(r.recovery,0);assert.equal(r.password,false);
r=await route('');assert.equal(r.signed,1);assert.equal(r.recovery,0);
console.log('PASS magic-link/PKCE callbacks, child-session return, expired link and unchanged password/invite/signup routing');
