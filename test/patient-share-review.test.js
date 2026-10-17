import test from 'node:test';
import assert from 'node:assert/strict';
import {shareReviewModel,createShareReview} from '../public/ui/patient-share-review.js';
const input = () => ({study:{studyInstanceUid:'2.25.1',sourceHospitalId:'HOSP-A',series:[{seriesInstanceUid:'2.25.2',instanceCount:700}]},seriesUid:'2.25.2',source:'HOSP-A',target:'HOSP-B',purpose:'TREATMENT',permission:'VIEW_ONLY',from:new Date().toISOString(),until:new Date(Date.now()+3600000).toISOString(),patientName:'합성 환자'});
test('review represents the selected series and actual instance count',()=>{const model=shareReviewModel(input());assert.equal(model.valid,true);assert.equal(model.count,700);assert.equal(model.series.length,1);});
test('invalid scope, institution, permission and dates fail closed',()=>{for(const change of [{seriesUid:'2.25.9'},{source:'HOSP-C'},{target:'HOSP-A'},{target:'unknown'},{permission:'ALL'},{purpose:'unknown'},{from:'invalid'},{until:'2000-01-01'}])assert.equal(shareReviewModel({...input(),...change}).valid,false,JSON.stringify(change));});
test('review fingerprint changes with every grant-relevant input',()=>{const data=input();for(const change of [{seriesUid:''},{target:'HOSP-C'},{purpose:'TRANSFER'},{permission:'DOWNLOAD_ALLOWED'},{until:new Date(Date.now()+7200000).toISOString()}])assert.notEqual(shareReviewModel(data).signature,shareReviewModel({...data,...change}).signature);});
test('confirmation is required, edits invalidate it and pending requests remain disabled',()=>{
 const nodes=new Map(),listeners={};const root={querySelector(id){if(!nodes.has(id))nodes.set(id,{checked:false,textContent:'',hidden:false,disabled:false,addEventListener(name,fn){this[name]=fn;},focus(){this.focused=true;}});return nodes.get(id);},querySelectorAll(){return[];},addEventListener(name,fn){listeners[name]=fn;}};
 let data=input();const ui=createShareReview({root,read:()=>data,onBack(){}});ui.refresh();assert.equal(ui.allowed(),false);
 const ack=nodes.get('#share-review-ack');ack.checked=true;assert.equal(ui.allowed(),true);
 ui.refresh(true);assert.equal(ui.allowed(),false);ui.refresh(false);assert.equal(ui.allowed(),true);
 data={...data,permission:'DOWNLOAD_ALLOWED'};ui.refresh();assert.equal(ack.checked,false);assert.equal(ui.allowed(),false);
 assert.equal(nodes.get('#share-allow-download').textContent,'선택 범위의 다운로드 허용');
 ack.checked=true;listeners.input({target:{}});assert.equal(ui.allowed(),false);
 nodes.get('#share-select-exam').click();assert.equal(nodes.get('.share-edit').open,true);assert.equal(nodes.get('#patient-study-select').focused,true);
});
test('past approval is not presented as renewed or active',()=>{const data=input();assert.equal(shareReviewModel({...data,consent:{status:'ACTIVE',validFrom:'2020-01-01',validUntil:'2020-01-02'}}).previous,'EXPIRED');assert.equal(shareReviewModel({...data,consent:{status:'REVOKED'}}).previous,'REVOKED');});
