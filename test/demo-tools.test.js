import test from 'node:test';
import assert from 'node:assert/strict';
import {demoEnvironment,demoToolsModel,demoMenuGroups,runDemoAction} from '../public/ui/demo-tools.js';
const study={patientId:'SYNTHETIC-P1',studyInstanceUid:'2.25.1'};
const consent={patientId:study.patientId,consentId:'synthetic-consent',status:'ACTIVE',validFrom:'2020-01-01',validUntil:'2099-01-01',scopes:[{studyInstanceUid:study.studyInstanceUid,allowed:true}]};
const base={persona:'DOCTOR',roles:['DOCTOR'],environment:'LOCAL',ready:true,study,consent};
const item=(state,id)=>demoToolsModel(state).items.find(i=>i.id===id);
test('environment defaults closed for unknown/public hosts',()=>{
 assert.equal(demoEnvironment('localhost'),'LOCAL');assert.equal(demoEnvironment('192.168.111.149'),'PRIVATE');
 for(const host of ['highpass-demo.japaneast.cloudapp.azure.com','other.example','localhost.attacker.example'])assert.equal(demoEnvironment(host),'PUBLIC');
});
test('patient, doctor and admin menus are separate and roles cannot be selected into existence',()=>{
 const patient={...base,persona:'PATIENT',roles:['PATIENT']};
 assert.equal(item(patient,'doctor-home'),undefined);assert.ok(item(patient,'sharing'));
 for(const id of ['simulate','admin','audit','pacs'])assert.equal(item(patient,id),undefined);
 assert.equal(item(base,'patient-home'),undefined);assert.equal(item(base,'audit'),undefined);
 assert.equal(item({...base,roles:['SECURITY_ADMIN']},'audit').enabled,true);
 assert.equal(item({...base,roles:[]},'doctor-home'),undefined);
});
test('public environment keeps authenticated security observability but denies internal-only tools',()=>{
 for(const id of ['pacs','journey'])assert.equal(item({...base,environment:'PUBLIC',roles:['DOCTOR','SECURITY_ADMIN']},id).enabled,false);
 assert.equal(item({...base,environment:'PUBLIC',roles:['DOCTOR','SECURITY_ADMIN']},'admin'),undefined);
 assert.equal(item({...base,environment:'PUBLIC',roles:['DOCTOR','SECURITY_ADMIN']},'audit').enabled,true);
 for(const id of ['qr','simulate'])assert.equal(item({...base,environment:'PUBLIC'},id).enabled,true);
});
test('context binds consent to the selected patient and study, never first table row',()=>{
 assert.equal(demoToolsModel(base).consent,consent);
 for(const state of [{...base,ready:false},{...base,study:{...study,patientId:'OTHER'}},{...base,study:{...study,studyInstanceUid:'2.25.2'}},{...base,study:{studyInstanceUid:'2.25.1'},consent:{...consent,patientId:undefined}}])assert.equal(demoToolsModel(state).consent,null);
 for(const status of ['REVOKED','EXPIRED'])assert.equal(item({...base,consent:{...consent,status}},'simulate').enabled,false);
 assert.equal(item({...base,consent:{...consent,validUntil:'invalid'}},'simulate').enabled,false);
});
test('cancel, unsupported action and changed selection never execute mutation',async()=>{
 const presenter={...base,environment:'PUBLIC',roles:['DOCTOR']};
 let state=presenter,calls=0;
 const options={read:()=>state,confirm:async()=>false,execute:async()=>{calls++;}};
 assert.equal(await runDemoAction('simulate',options),false);
 assert.equal(await runDemoAction('unknown',options),false);
 assert.equal(await runDemoAction('simulate',{...options,confirm:async()=>{state={...presenter,seriesUid:'2.25.99'};return true;}}),false);
 state=presenter;
 assert.equal(await runDemoAction('simulate',{...options,confirm:async()=>{state={...base,roles:[]};return true;}}),false);
 assert.equal(calls,0);
 state=presenter;assert.equal(await runDemoAction('simulate',{...options,confirm:async()=>true}),true);assert.equal(calls,1);
});
test('QR demo accepts input only on public synthetic profile; never manufactures patient tickets',()=>{
 assert.equal(item(base,'simulate').enabled,false);
 assert.equal(item({...base,environment:'PUBLIC'},'simulate').enabled,true);
});

test('groups separate navigation, explanation and mutating actions without duplicating menus',()=>{
 const groups=demoMenuGroups(demoToolsModel(base).items);
 assert.deepEqual(groups.map(g=>g.id),['flow','explanation','navigation','execution']);
 assert.deepEqual(groups[0].items.map(i=>i.id),['clinical-records','qr','pacs']);
 assert.deepEqual(groups.find(g=>g.id==='execution').items.map(i=>i.id),['simulate']);
 assert.ok(groups.flatMap(g=>g.items).every(i=>i.icon));
 assert.equal(new Set(groups.flatMap(g=>g.items.map(i=>i.id))).size,demoToolsModel(base).items.length);
 const patient=demoMenuGroups(demoToolsModel({...base,persona:'PATIENT',roles:['PATIENT']}).items);
 assert.deepEqual(patient.map(g=>g.id),['flow','navigation']);
});

test('public-only restrictions are grouped without granting actions or leaking admin menus',()=>{
 const groups=demoMenuGroups(demoToolsModel({...base,environment:'PUBLIC'}).items);
 assert.deepEqual(groups.map(g=>g.id),['flow','navigation','execution','restricted']);
 assert.deepEqual(groups.at(-1).items.map(i=>i.id),['pacs','journey']);
 assert.ok(groups.at(-1).items.every(i=>!i.enabled));
 assert.equal(groups.flatMap(g=>g.items).some(i=>['admin','audit'].includes(i.id)),false);
});
