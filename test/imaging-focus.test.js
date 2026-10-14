import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {prepareImagingWorkspace} from '../public/ui/viewer-studio.js';

class Node{
  constructor(tag,cls=''){this.tag=tag;this.classes=new Set(cls.split(' ').filter(Boolean));this.classList={contains:c=>this.classes.has(c),add:c=>this.classes.add(c)};this.childNodes=[];this.textContent='';}
  append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.childNodes.push(n);}}
  prepend(n){n.remove();n.parent=this;this.childNodes.unshift(n);}
  remove(){if(this.parent)this.parent.childNodes=this.parent.childNodes.filter(n=>n!==this);this.parent=null;}
  before(n){const p=this.parent,i=p.childNodes.indexOf(this);n.remove();n.parent=p;p.childNodes.splice(i,0,n);}
  replaceChildren(...nodes){for(const n of this.childNodes)n.parent=null;this.childNodes=[];this.append(...nodes);}
  all(){return [this,...this.childNodes.flatMap(n=>n.all())];}
  querySelector(s){return this.all().find(n=>s==='h3'?n.tag==='h3':s==='.mq-title h2'?n.tag==='h2':n.classes.has(s.slice(1)))||null;}
  querySelectorAll(s){assert.equal(s,':scope > section');return this.childNodes.filter(n=>n.tag==='section');}
}
test('focus layout moves existing bound nodes once without cloning the protected viewport',()=>{
  const desk=new Node('section'),canvas=new Node('section','mq-clinical-canvas'),copy=new Node('div','desk-hero-copy'),visual=new Node('div','desk-hero-visual'),guide=new Node('aside','prep-guide'),section=new Node('section'),h3=new Node('h3'),button=new Node('button'),activity=new Node('section','desk-activity'),title=new Node('h2');h3.textContent='건강기록';
  section.append(h3,button);guide.append(section);canvas.append(copy,visual);desk.append(canvas,guide,activity,title);
  const root={querySelector:()=>desk,createElement:tag=>new Node(tag)};
  prepareImagingWorkspace(root);assert.equal(canvas.childNodes[0],visual);assert.equal(guide.childNodes[0],copy);assert.equal(guide.childNodes[1].childNodes[0].tag,'details');assert.ok(guide.all().includes(button));assert.equal(guide.childNodes[2].childNodes[1],activity);assert.equal(title.textContent,'환자 영상');
  const count=desk.all().length;prepareImagingWorkspace(root);assert.equal(desk.all().length,count);
});
test('missing legacy structure leaves the screen unchanged',()=>{const desk=new Node('section');prepareImagingWorkspace({querySelector:()=>desk});assert.equal(desk.classList.contains('imaging-focus'),false);prepareImagingWorkspace({querySelector:()=>null});});
test('presentation never fetches scans, creates tokens or fabricates MPR imagery',()=>{
  const source=readFileSync('public/ui/viewer-studio.js','utf8');assert.doesNotMatch(source,/fetch\(|postJson\(|innerHTML|cloneNode|localStorage|sessionStorage/);assert.match(source,/await openViewer\(\)/);
  const css=readFileSync('public/ui/clinician-preparation.css','utf8');assert.match(css,/\.imaging-focus/);assert.match(css,/grid-template-columns:minmax\(180px/);
});
