import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../parent-guide.js',import.meta.url),'utf8');
const {parentGuide}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.events={};}
 replaceChildren(...children){this.children=children;}
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this[name]=value;}
 addEventListener(name,fn){this.events[name]=fn;}
 focus(){}
}
const elements=new Map();
globalThis.document={getElementById(id){if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id);},createElement(tag){return new Element(tag);}};
let resolveReply;
const guide=parentGuide(()=>({rpc:()=>new Promise(resolve=>{resolveReply=resolve;})}),()=>{});
guide.open('parent');
assert.equal(elements.get('printable-links').children.length,0,'Downloads must wait for the authenticated response');
resolveReply({data:{version:1,completed:true}});
await new Promise(resolve=>setImmediate(resolve));
const rows=elements.get('printable-links').children;
assert.equal(rows.length,5);
const urls=[];
for(const row of rows){
 const [open,download]=row.children[1].children;
 assert.equal(open.tag,'a');assert.equal(download.tag,'a');
 assert.equal(Object.hasOwn(open,'download'),false,'Open action must allow normal viewer navigation');
 assert.match(download.download,/^fairy-bucks-(1|2|5|10|mixed)\.pdf$/);
 assert.equal(open.href,download.href,'Open and save must use the same reviewed PDF');
 assert.equal(open.target,'_blank');assert.equal(open.rel,'noopener noreferrer');
 urls.push(open.href);
}
assert.equal(new Set(urls).size,5);
guide.clear();
assert.equal(elements.get('printable-links').children.length,0,'Sign-out must remove download controls');
assert.equal(elements.get('parent-help').hidden,true);
guide.open('other-parent');
guide.clear();resolveReply({data:{version:1,completed:true}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(elements.get('printable-links').children.length,0,'Late response must not restore signed-out controls');
console.log('PASS paired PDF actions, same-sheet targets, authentication gating and sign-out race protection');
