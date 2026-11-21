// Publish only audited site assets. Keep operator SQL, tests, docs, and source maps out of the hosting output.
import {cpSync,existsSync,mkdirSync,rmSync,statSync} from 'node:fs';
import {join} from 'node:path';
const root=process.cwd();
const out=join(root,'dist');
const pages=['index.html','auth.html','child.html','permission.html','permission-test.html','privacy.html','support.html'];
const scripts=['account-deletion.js','auth-config.js','child-session.js','child-vault.js','delivery-stages.js','explorer-deletion.js','explorer-profile-editor.js','explorer-requests.js','explorer-wallet.js','parent-consent.js','parent-guide.js','parent-notice.js','parent-pin-recovery.js','parent-setup.js','permission-page.js','permission-test.js','public-shop.js','site-contact.js','treasure-catalog.js'];
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
