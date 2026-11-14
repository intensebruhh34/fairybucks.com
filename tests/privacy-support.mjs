import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('site-contact.js',root),'utf8');
const {siteContact,supportEmail,renderContact}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(supportEmail,'support@fairybucks.com');
class Element{constructor(){this.textContent='';this.children=[];}replaceChildren(){this.children=[];}append(e){this.children.push(e);}}
const email=new Element(),draft=new Element(),supportPending=new Element();
globalThis.document={createElement:()=>new Element(),querySelectorAll(selector){return selector==='[data-support-email]'?[email]:selector==='[data-contact-incomplete]'?[draft]:selector==='[data-support-incomplete]'?[supportPending]:[];}};
renderContact();assert.equal(email.children[0].href,'mailto:support@fairybucks.com');
assert.equal(supportPending.hidden,true,'Confirmed inbox must hide support setup notice');
assert.equal(draft.hidden,false,'Missing operator details must not be concealed');
for(const file of ['auth.html','index.html','child.html'])assert.match(readFileSync(new URL(file,root),'utf8'),/href="\/privacy\.html"/);
const privacy=readFileSync(new URL('privacy.html',root),'utf8');assert.match(privacy,/Draft notice/);assert.match(privacy,/Supabase/);assert.match(privacy,/GitHub Pages/);assert.match(privacy,/Resend/);assert.match(privacy,/jsDelivr/);assert.match(privacy,/backup/);
assert.doesNotMatch(privacy,/COPPA.compliant|fully compliant|guarantee/i);
assert.ok(!siteContact.operatorName&&!siteContact.mailingAddress&&!siteContact.phone,'Do not invent public operator details');
console.log('PASS monitored support link, honest draft status, provider/storage disclosures and prominent privacy access');
