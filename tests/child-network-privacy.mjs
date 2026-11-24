import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Static regression only: does not capture browser/SDK requests or provider-side logging.
// It checks child-specific executable code and resource-loading markup for newly added
// third-party endpoints and known tracking APIs. Run in CI on every PR.
const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const child=read('child.html');
const vault=read('child-vault.js');
const session=read('child-session.js');
const cfg=read('auth-config.js');
const privacy=read('privacy.html');
const otherPages=['index.html','auth.html','permission.html','support.html'];
const importedChild=['child-vault.js','child-session.js','treasure-catalog.js','delivery-stages.js','auth-config.js'];
const allScripts=['child-vault.js','child-session.js','treasure-catalog.js','delivery-stages.js'];
function remoteResources(markup){
 // Media/script/style resource tags automatically loaded by browsers.
 return [...markup.matchAll(/<(?:script|link|img|iframe|source)\\b[^>]*?\\b(?:src|href)\\s*=\\s*["']([^"']+)["']/gi)]
  .map(m=>m[1]).filter(u=>/^https?:\\/\\//i.test(u)||/^\\/\\//.test(u));
}
assert.deepEqual(remoteResources(child),[],'Child Mode gained an automatic off-site resource');
const imports=[...vault.matchAll(/\\bfrom\\s*['"]([^'"]+)['"]/g)].map(m=>m[1]);
assert.ok(imports.length>=2,'Could not inspect child imports');
assert.ok(imports.every(u=>u.startsWith('/')),'Child Mode has a remote or bare module import');
for(const path of allScripts){
 const body=read(path);
 assert.doesNotMatch(body,/(?:googletagmanager|google-analytics|facebook\\.net|doubleclick|hotjar|mixpanel|amplitude|segment\\.com|sendBeacon\\s*\\(|document\\.cookie\\s*=)/i,
  'Child-facing JS contains a tracker or browser-cookie writer: '+path);
 assert.doesNotMatch(body,/https?:\\/\\/(?!localhost)/i,'Child-facing JS gained an explicit outside URL: '+path);
}
assert.match(vault,/fetch\\(config\\.url\\s*\\+\\s*['"]\\/rest\\/v1\\/rpc\\/fairybucks_child_action['"]/,
 'Expected child action RPC endpoint is missing or altered');
assert.match(vault,/credentials:\\s*['"]omit['"]/,'Child Mode must not attach cookies to the RPC fetch');
assert.match(vault,/referrerPolicy:\\s*['"]no-referrer['"]/,'Child Mode RPC should omit referrer');
assert.match(child,/<meta\\s+name="referrer"\\s+content="no-referrer"/,'Child referrer control missing');
assert.match(session,/sessionStorage\\.setItem\\(key,\\s*token\\)/,'Child token storage behavior changed');
assert.doesNotMatch(session,/localStorage/,'Child token accidentally persisted in long-lived localStorage');
assert.match(cfg,/https:\\/\\/cuyrujodyxpxzkdwxstk\\.supabase\\.co/,'Unexpected Supabase origin');
assert.match(privacy,/<strong>Netlify:<\\/strong>/,'Privacy notice must identify the deployed hosting provider');
assert.doesNotMatch(privacy,/<strong>GitHub Pages:<\\/strong>/,'Outdated host reference');
let externalParents=new Set();
for(const page of otherPages){
 for(const u of remoteResources(read(page)))externalParents.add(u);
}
assert.ok([...externalParents].every(u=>/^https:\\/\\/cdn\\.jsdelivr\\.net\\//.test(u)),
 'Unexpected automatic parent/public external assets: '+[...externalParents].join(','));
console.log('PASS static child network allowlist: local child resources; Supabase child RPC; no known tracking calls; child session storage; Netlify privacy attribution');
console.log('NOTE: Parent/permission pages still load the jsDelivr Supabase SDK; browser HAR/Edge traffic remains unmeasured.');
