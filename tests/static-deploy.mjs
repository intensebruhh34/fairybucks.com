import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';
import {join,relative,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname);
execFileSync(process.execPath,['tools/build-public-site.mjs'],{cwd:root,stdio:'pipe'});
const output=join(root,'dist');
function files(dir){return readdirSync(dir).flatMap(name=>{const p=join(dir,name);return statSync(p).isDirectory()?files(p):[relative(output,p)];});}
const paths=files(output);
for(const required of ['index.html','auth.html','child.html','privacy.html','permission.html','support.html','parent-notice.js','auth-config.js','vault-theme.css','assets/story-transition.svg','printables/fairy-bucks-mixed.pdf'])assert.ok(paths.includes(required),required+' must deploy');
for(const file of paths)assert.doesNotMatch(file,/^(docs|tests|tools|supabase|\.github|\.git)\//);
for(const forbidden of ['.gitignore','CNAME','_config.yml','netlify.toml','tests/package.json','docs/reviews/pilot-launch-2026-11-20.md','supabase/migrations/20261121212500_parent_notice_v4_email_link.sql'])assert.ok(!existsSync(join(output,forbidden)),'Must not deploy '+forbidden);
assert.match(readFileSync(join(output,'auth.html'),'utf8'),/I approved — Continue setup/);
assert.ok(paths.every(path=>!path.endsWith('.sql')));
console.log('PASS static public build allowlist and privacy-sensitive file exclusions');
