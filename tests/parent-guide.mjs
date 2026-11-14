import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('parent-guide.js',root),'utf8');
const {welcome,faqs,printableSheets}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.doesNotMatch(JSON.stringify(welcome), /\bFB\b/);
assert.match(JSON.stringify(welcome), /Fairy Bucks/);
assert.doesNotMatch(JSON.stringify(welcome), /https?:|\$|\bUSD\b/);
assert.ok(faqs.some(([q,a])=>q.includes('PIN')&&a.includes('not available yet')));
const html=readFileSync(new URL('auth.html',root),'utf8');
const routeSource=html.match(/return location.hash.match\((\/.*?\/i)\)/)[1];
const pattern=new RegExp(routeSource.slice(1,-2),'i');
for(const key of [1,12,13,14,25])assert.ok(pattern.test('#explorer=11111111-1111-4111-8111-111111111111&treasure='+key));
assert.equal(pattern.test('#explorer=11111111-1111-4111-8111-111111111111&treasure=0'),false);
console.log('PASS welcome uses Fairy Bucks; FAQ reflects PIN limitation; expanded catalog routes accepted');

assert.deepEqual(printableSheets.map(s=>s.key), ['1','2','5','10','mixed']);
for(const sheet of printableSheets){
 const path=new URL('printables/fairy-bucks-'+sheet.key+'.pdf',root);
 const bytes=readFileSync(path);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
}
assert.match(html,/Printing Fairy Bucks does not change/);
console.log('PASS five printable downloads and parent balance guidance');
