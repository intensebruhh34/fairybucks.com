// Launch preparation only. This gate must remain green while public enrollment is OFF.
// A later explicit, reviewed activation must replace these staging-only expectations.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const read=path=>readFileSync(new URL(path,root),'utf8');
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(read(path)).toString('base64'));
const {siteContact}=await load('site-contact.js');
const {parentNotice}=await load('parent-notice.js');
assert.equal(siteContact.privacyNoticeReviewed,false,'STOP: public privacy-review flag switched without release approval');
assert.equal(siteContact.parentPermissionEnabled,false,'STOP: public child permission flag switched without release approval');
assert.equal(siteContact.supportEmail,'support@fairybucks.com','Support destination changed unexpectedly');
assert.ok([4,5].includes(parentNotice.version),'Unexpected direct-notice version: review the upgrade');

const comparison={notice:parentNotice,contact:{
 operatorName:siteContact.operatorName,mailingAddress:siteContact.mailingAddress,
 phone:siteContact.phone,supportEmail:siteContact.supportEmail
}};
const hash=createHash('sha256').update(JSON.stringify(comparison)).digest('hex');
const migrations=readdirSync(new URL('supabase/migrations/',root)).filter(name=>
 name.includes('_parent_notice_v'+parentNotice.version+'_')&&name.endsWith('.sql')
);
assert.equal(migrations.length,1,'Require exactly one matching notice version migration');
assert.ok(read('supabase/migrations/'+migrations[0]).includes(hash),'Notice hash differs from matching SQL migration');

for(const name of ['parent-permission-email','parent-permission-confirmation','parent-permission-rehearsal']){
 const source=read('supabase/functions/'+name+'/index.ts');
 const matched=source.match(/export const permissionSnapshot\s*=\s*(\{[\s\S]*?\});\s*export function/);
 assert.ok(matched,'Missing auditable permissionSnapshot in '+name);
 const snapshot=JSON.parse(matched[1]);
 assert.deepEqual(snapshot,comparison,name+' has stale/different consent notice or operator contact');
}
const privacy=read('privacy.html');
if(parentNotice.version===4){
 assert.match(privacy,/GitHub Pages/,'Version 4 privacy page should still describe its actual host');
}else{
 assert.match(privacy,/Netlify/,'Version 5 privacy page must name the planned Netlify host');
}
for(const file of ['child.html','child-vault.js','public-shop.js','treasure-catalog.js']){
 assert.doesNotMatch(read(file),/\bUSD\b|\bAmazon\b|\$\s*\d/i,
  'STOP: child-facing file includes dollar or merchant content: '+file);
}
for(const file of ['child.html','auth.html','index.html']){
 assert.match(read(file),/privacy\.html/,'Missing privacy navigation: '+file);
}
assert.match(read('tools/build-public-site.mjs'),/const allowed=/,'Expected explicit publish allowlist');
assert.doesNotMatch(read('tools/build-public-site.mjs'),/['"]permission-test\.html['"]\s*,/,
 'Permission test page may not be part of public allowlist');
console.log('PASS launch staging preflight: public enrollment OFF, notice '+parentNotice.version+
 ' / matching hash '+hash.slice(0,12)+'…, all three edge snapshots match, child money copy safe, privacy navigation and explicit build allowlist');
