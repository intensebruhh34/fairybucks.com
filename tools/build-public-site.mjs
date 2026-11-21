// Publish only audited site assets. Keep operator SQL, tests, docs, and source maps out of the hosting output.
import {cpSync,existsSync,mkdirSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const root=process.cwd();
const out=join(root,'dist');
const pages=['index.html','auth.html','child.html','permission.html','privacy.html','support.html'];
const scripts=['account-deletion.js','auth-config.js','child-session.js','child-vault.js','delivery-stages.js','explorer-deletion.js','explorer-profile-editor.js','explorer-requests.js','explorer-wallet.js','parent-consent.js','parent-guide.js','parent-notice.js','parent-pin-recovery.js','parent-setup.js','permission-page.js','public-shop.js','site-contact.js','treasure-catalog.js'];
const staticAssets=['vault-theme.css','assets/story-transition.svg',
  'printables/fairy-bucks-1.pdf','printables/fairy-bucks-2.pdf','printables/fairy-bucks-5.pdf',
  'printables/fairy-bucks-10.pdf','printables/fairy-bucks-mixed.pdf'];
const allowed=[...pages,...scripts,...staticAssets];
for(const file of allowed){
 const path=join(root,file);
 if(!existsSync(path)||!statSync(path).isFile())throw Error('Required public file missing: '+file);
}
rmSync(out,{recursive:true,force:true});
mkdirSync(out,{recursive:true});
for(const file of allowed){
 const target=join(out,file);
 mkdirSync(join(target,'..'),{recursive:true});
 cpSync(join(root,file),target);
}
console.log('Built audited public site with '+allowed.length+' files in dist/');


// Stage a restrictive, dynamically hashed script policy in report-only mode first.
// Inline module hashes are derived from the exact published HTML, preventing stale hardcoded hashes.
// Flip to an enforcing policy only after an owner-tested browser sign-in/consent/child-mode rehearsal.
const inlineHashes=new Set();
for(const page of pages){
 const html=readFileSync(join(out,page),'utf8');
 for(const match of html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>/gi)){
  if(/\\bsrc\\s*=/.test(match[1]) || !match[2].trim())continue;
  const hash=createHash('sha256').update(match[2],'utf8').digest('base64');
  inlineHashes.add("'sha256-"+hash+"'");
 }
}
const policy=[
 "default-src 'self'",
 "base-uri 'self'",
 "object-src 'none'",
 "frame-ancestors 'none'",
 "form-action 'self'",
 "script-src 'self' https://cdn.jsdelivr.net "+[...inlineHashes].sort().join(' '),
 "style-src 'self' 'unsafe-inline'",
 "img-src 'self' data:",
 "font-src 'self' data:",
 "connect-src 'self' https://cuyrujodyxpxzkdwxstk.supabase.co wss://cuyrujodyxpxzkdwxstk.supabase.co"
].join('; ');
writeFileSync(join(out,'_headers'),'/*\\n  Content-Security-Policy-Report-Only: '+policy+'\\n');
console.log('Staged CSP report-only with '+inlineHashes.size+' inline script hashes');
