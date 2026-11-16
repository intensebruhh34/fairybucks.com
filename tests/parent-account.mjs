import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../auth.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'').replace('initialize().catch','globalThis.ready=initialize().catch');
const nodes=new Map(),calls=[];let signed=0,authEvent;
function node(id){if(!nodes.has(id))nodes.set(id,{hidden:true,value:'',textContent:'',disabled:false,events:{},classList:{toggle(){}},addEventListener(name,fn){this.events[name]=fn;},querySelector(){return node(id+'-submit');},replaceChildren(){},reset(){}});return nodes.get(id);}
const user={id:'synthetic-parent',email:'parent@example.test'};
let signupResult={data:{user,session:null}},resendResult={},loginResult={error:Error('Invalid login credentials')};
const client={auth:{onAuthStateChange(fn){authEvent=fn;},async getSession(){return {data:{session:null}};},async signUp(args){calls.push(['signup',args]);return signupResult;},async resend(args){calls.push(['resend',args]);return resendResult;},async signInWithPassword(args){calls.push(['login',args]);return loginResult;},async resetPasswordForEmail(...args){calls.push(['forgot',...args]);return {};},async updateUser(args){calls.push(['password',args]);return {data:{user}};},async signOut(){calls.push(['logout']);authEvent('SIGNED_OUT',null);return {};}}};
const context={URLSearchParams,console,setTimeout,clearTimeout,document:{getElementById:node,querySelectorAll(){return [];},querySelector:node},window:{FAIRYBUCKS_AUTH_CONFIG:{url:'https://example.test',publishableKey:'sb_publishable_test'},addEventListener(){}},location:{origin:'https://example.test',pathname:'/auth.html',hash:'',search:''},history:{replaceState(){}},createClient:()=>client,renderContact(){},parentConsent:()=>({clear(){},open(){}}),accountDeletion:()=>({clear(){},accountChanged(){return false;}}),explorerWallet:()=>({open(){}}),explorerRequests:()=>({open(){},renderReview(){}}),parentGuide:()=>({clear(){},open(){signed++;}}),parentPinRecovery:()=>({clear(){},open(){},accountChanged(){return false;}}),childToken:()=>null,storeChildToken(){},clearChildToken(){}};
vm.createContext(context);vm.runInContext(source,context);await context.ready;
async function submit(id){node(id).events.submit({preventDefault(){},currentTarget:node(id)});await new Promise(r=>setImmediate(r));}
node('signup-email').value=' parent@example.test ';node('signup-password').value='SyntheticPasswordOnly';await submit('signup');
assert.equal(calls.at(-1)[1].email,'parent@example.test');assert.equal(calls.at(-1)[1].options.emailRedirectTo,'https://example.test/auth.html');assert.equal(node('signup-password').value,'');assert.match(node('message').textContent,/Resend confirmation/);assert.equal(signed,0);
node('resend-email').value=' parent@example.test ';await submit('resend');
assert.equal(calls.at(-1)[1].type,'signup');assert.equal(calls.at(-1)[1].email,'parent@example.test');assert.equal(calls.at(-1)[1].options.emailRedirectTo,'https://example.test/auth.html');assert.match(node('message').textContent,/If this address/);assert.equal(signed,0);
resendResult={error:Error('Wait before requesting another email')};await submit('resend');assert.match(node('message').textContent,/Wait/);assert.equal(node('resend-submit').disabled,false);
// A second submit while the first request is pending must not send another email.
let release;client.auth.resend=async args=>{calls.push(['resend',args]);return await new Promise(resolve=>release=resolve);};
const count=calls.length;await submit('resend');await submit('resend');assert.equal(calls.length,count+1);release({});await new Promise(r=>setImmediate(r));assert.equal(node('resend-submit').disabled,false);
node('login-email').value=user.email;node('login-password').value='synthetic';await submit('login');assert.equal(signed,0);assert.match(node('message').textContent,/Invalid login/);
loginResult={data:{user}};await submit('login');assert.equal(signed,1);
await node('logout').events.click();assert.equal(node('login').hidden,false);assert.equal(node('signed-in').hidden,true);assert.match(node('message').textContent,/Signed out/);
node('forgot-email').value=' parent@example.test ';await submit('forgot');assert.equal(calls.at(-1)[1],user.email);assert.equal(calls.at(-1)[2].redirectTo,'https://example.test/auth.html');assert.match(node('message').textContent,/If that email/);
node('password-new').value='SyntheticPasswordOnly';node('password-confirm').value='different';const before=calls.length;await submit('new-password');assert.equal(calls.length,before);assert.match(node('message').textContent,/don't match/);
node('password-confirm').value=node('password-new').value;await submit('new-password');assert.equal(calls.at(-1)[0],'password');assert.match(node('message').textContent,/Password saved/);
console.log('PASS signup/resend, duplicate submission, wrong credentials, login/logout, reset email and password confirmation');
