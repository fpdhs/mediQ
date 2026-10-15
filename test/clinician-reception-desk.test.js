import test from 'node:test';
import assert from 'node:assert/strict';
import {createReceptionDesk,receptionSummary,receptionConsentAvailable} from '../public/ui/clinician-reception-desk.js';

const clock=Date.parse('2026-10-14T00:00:00Z');
const receipt=(overrides={})=>({ticketId:'T1',patientId:'SYNTHETIC-01',status:'CONSENT_ACTIVE',receivedAt:'2026-10-14',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',consent:{status:'ACTIVE',validFrom:'2026-10-13',validUntil:'2026-10-15',purpose:'TREATMENT',permission:'VIEW_ONLY'},studies:[{description:'Synthetic chest',modality:'CT',studyInstanceUid:'1.2.3'}],...overrides});
class Element {
  constructor(tag){this.tag=tag;this.childNodes=[];this.attributes={};this.value='';this.textContent='';}
  append(...nodes){this.childNodes.push(...nodes);}
  replaceChildren(...nodes){this.childNodes=nodes;}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){delete this.attributes[key];}
  find(cls){return this.all().find(n=>n.className?.split(' ').includes(cls));}
  all(){return [this,...this.childNodes.flatMap(n=>n.all())];}
}
function mount(options={}){
  globalThis.document={createElement:tag=>new Element(tag)};
  const root=new Element('main'),calls=[];
  const desk=createReceptionDesk(root,{read:async()=>({receptions:[receipt()]}),select:async(row,study)=>calls.push(['select',row.ticketId,study.studyInstanceUid]),navigate:route=>calls.push(['navigate',route]),active:()=>true,now:()=>clock,...options});
  return {root,desk,calls};
}
test('summary uses real rows and rejects missing, revoked, expired, future and invalid dates',()=>{
  const rows=[receipt(),receipt({consent:null}),receipt({consent:{...receipt().consent,status:'REVOKED'}}),receipt({consent:{...receipt().consent,validUntil:'2026-10-14'}}),receipt({consent:{...receipt().consent,validFrom:'2027-01-01'}}),receipt({consent:{...receipt().consent,validUntil:'bad'}})];
  assert.deepEqual(receptionSummary(rows,clock),{total:6,valid:1,recheck:5});assert.equal(receptionConsentAvailable(rows[3],clock),false);assert.deepEqual(receptionSummary([],clock),{total:0,valid:0,recheck:0});
});
test('search filters reception list without changing counters or selected context',async()=>{
  const {desk,root}=mount({read:async()=>({receptions:[receipt(),receipt({ticketId:'T2',patientId:'SYNTHETIC-02',studies:[{modality:'MR'}]})]})});await desk.load();
  const search=root.find('rd-search');search.value='MRI';search.oninput();assert.equal(root.find('rd-list').childNodes.length,1);assert.equal(root.find('rd-metric-total').childNodes[1].textContent,'2');assert.equal(root.find('rd-detail-heading').childNodes[1].textContent,'SYNTHETIC-01');
  search.value='missing';search.oninput();assert.equal(root.find('rd-empty').textContent,'검색 결과가 없습니다.');
});
test('study navigation waits for selection and missing consent has no actions',async()=>{
  const {desk,root,calls}=mount();await desk.load();await root.find('rd-study-actions').childNodes[1].onclick();assert.deepEqual(calls,[['select','T1','1.2.3'],['navigate','studies']]);
  const denied=mount({read:async()=>({receptions:[receipt({consent:null})]})});await denied.desk.load();assert.equal(denied.root.find('rd-study-actions'),undefined);assert.match(denied.root.find('rd-warning-message').textContent,/열람 권한은 없습니다/);
});
test('clear invalidates pending requests and selection cannot navigate after identity reset',async()=>{
  let resolve;const pending=new Promise(r=>resolve=r);
  const {desk,root}=mount({read:()=>pending});const load=desk.load();desk.clear();resolve({receptions:[receipt()]});await load;assert.equal(root.find('rd-list').childNodes.length,0);
  let finish;const selected=new Promise(r=>finish=r);const context=mount({select:()=>selected});await context.desk.load();const action=context.root.find('rd-study-actions').childNodes[1].onclick();context.desk.clear();finish();await action;assert.equal(context.calls.length,0);
});
test('clock expiry and selection failure do not navigate; no HTML interpolation',async()=>{
  let time=clock;const {desk,root,calls}=mount({now:()=>time,patientLabel:()=>'<img onerror=alert(1)>',select:async()=>{throw Error('denied');}});await desk.load();assert.equal(root.find('rd-receipt-top').childNodes[0].textContent,'<img onerror=alert(1)>');
  await root.find('rd-study-actions').childNodes[1].onclick();assert.equal(calls.length,0);assert.match(root.find('rd-status').textContent,/確認|확인하지 못/);
  time=Date.parse('2026-10-15');await root.find('rd-study-actions').childNodes[1].onclick();assert.equal(calls.length,0);assert.equal(root.find('rd-study-actions'),undefined);
});
