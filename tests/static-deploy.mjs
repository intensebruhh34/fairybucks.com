import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {join,relative,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
execFileSync(process.execPath,['tools/build-public-site.mjs'],{cwd:root,stdio:'pipe'});
const output=join(root,'dist');
function files(dir){return readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?files(p):[relative(output,p)];});}
const paths=files(output);
for(const required of ['index.html','auth.html','child.html','privacy.html','permission.html','support.html','parent-notice.js','auth-config.js','vault-theme.css','_headers','assets/story-transition.svg','printables/fairy-bucks-mixed.pdf'])assert.ok(paths.includes(required),required+' must deploy');
for(const file of paths)assert.doesNotMatch(file,/^(docs|tests|tools|supabase|\.github|\.git)\//);
for(const forbidden of ['permission-test.html','permission-test.js','.gitignore','CNAME','_config.yml','netlify.toml','tests/package.json','docs/reviews/pilot-launch-2026-11-20.md','supabase/migrations/20261121212500_parent_notice_v4_email_link.sql'])assert.ok(!existsSync(join(output,forbidden)),'Must not deploy '+forbidden);
assert.match(readFileSync(join(output,'auth.html'),'utf8'),/I approved — Continue setup/);
assert.ok(paths.every(path=>!path.endsWith('.sql')));
console.log('PASS static public build allowlist and privacy-sensitive file exclusions');

// The experimental permission email page remains in source control for private regression tests, not public hosting.
const headers=readFileSync(join(output,'_headers'),'utf8');
assert.match(headers,/Content-Security-Policy-Report-Only:/);
assert.match(headers,/script-src 'self' https:\/\/cdn\\.jsdelivr\\.net/);
assert.match(headers,/connect-src 'self' https:\/\/cuyrujodyxpxzkdwxstk\\.supabase\\.co/);
const inline=[...readFileSync(join(output,'auth.html'),'utf8').matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script\\s*>/gi)].filter(x=>!(/\\bsrc\\s*=/.test(x[1]))&&x[2].trim());
assert.ok(inline.length>0,'Parent page needs an inline module under test');
const {createHash}=await import('node:crypto');
for(const [, , body] of inline){const digest=createHash('sha256').update(body,'utf8').digest('base64');assert.ok(headers.includes("'sha256-"+digest+"'"),'Generated CSP missing parent module hash');}
console.log('PASS public build excludes permission test UI; hashed report-only CSP generated');
