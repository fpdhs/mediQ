import test from 'node:test';
import assert from 'node:assert/strict';
import {createWalletDock,mountPatientWalletDock} from '../public/ui/wallet-home.js';

function fixture(){
  const make=tag=>({tag,children:[],dataset:{},attributes:{},className:'',
    classList:{add(value){this.owner.className+=' '+value;}},
    append(...items){for(const item of items){item.parent=this;this.children.push(item);}},
    setAttribute(name,value){this.attributes[name]=value;},
    querySelectorAll(){return this.children.flatMap(child=>[...(child.className.split(' ').includes('mq-wallet-dock')?[child]:[]),...child.querySelectorAll()]);},
    querySelector(){return this.children.find(child=>child.className.split(' ').includes('mq-wallet-dock'));},
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
  });
  const create=tag=>{const node=make(tag);node.classList.owner=node;return node;};
  return {create,document:{createElement:create,createElementNS:(_,tag)=>create(tag)}};
}

test('dock keeps four cards, labels current page and only navigates other cards',()=>{
  const f=fixture(),old=globalThis.document;globalThis.document=f.document;
  try{
    const calls=[],dock=createWalletDock({selected:'sharing',navigate:route=>calls.push(route)});
    const cards=dock.children[0].children;
    assert.equal(cards.length,4);
    assert.deepEqual(cards.map(card=>card.dataset.walletRoute),['requests','records','sharing','helper']);
    assert.equal(cards[2].attributes['aria-current'],'page');
    assert.ok(cards[2].className.includes('is-selected'));
    cards[2].onclick();assert.deepEqual(calls,[]);
    cards[1].onclick();assert.deepEqual(calls,['records']);
    assert.equal(dock.children[1].attributes['aria-hidden'],'true');
  }finally{globalThis.document=old;}
});

test('home and dock use identical artwork and card structure',()=>{
  const f=fixture(),old=globalThis.document;globalThis.document=f.document;
  try{
    const home=createWalletDock({home:true,navigate(){}}),dock=createWalletDock({navigate(){}});
    const shape=n=>({tag:n.tag,className:n.className,text:n.textContent,src:n.src,children:n.children.map(shape)});
    assert.deepEqual(home.children.map(shape),dock.children.map(shape));
    assert.equal(home.tag,'section');assert.equal(dock.tag,'nav');
  }finally{globalThis.document=old;}
});

test('web dock follows task content, preserves form, maps routes and removes redraw duplicates',()=>{
  const f=fixture(),old=globalThis.document;globalThis.document=f.document;
  try{
    const root=f.create('section'),form=f.create('form');form.value='unapproved draft';root.append(form);
    const wrapper=f.create('div');wrapper.append(createWalletDock({selected:'records',navigate(){}}));root.append(wrapper);
    const calls=[],dock=mountPatientWalletDock(root,'consent',route=>calls.push(route));
    assert.equal(root.children.at(-1),dock);assert.equal(root.children[0],form);assert.equal(form.value,'unapproved draft');
    assert.equal(root.querySelectorAll().length,1);
    const cards=dock.children[0].children;assert.equal(cards[2].attributes['aria-current'],'page');
    cards[0].onclick();cards[1].onclick();assert.deepEqual(calls,['activity','phr']);
    wrapper.append(createWalletDock({selected:'records',navigate(){}}));
    assert.equal(mountPatientWalletDock(root,'consent',()=>{}),dock);
    assert.equal(root.querySelectorAll().length,1);
    assert.equal(mountPatientWalletDock(root,'home',()=>{}),null);
  }finally{globalThis.document=old;}
});
