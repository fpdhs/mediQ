import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {clinicianHomeModel} from '../public/ui/clinician-home.js';
const now=Date.parse('2026-10-13T00:00:00Z');
const study={studyInstanceUid:'1.2.3',description:'합성 복부 CT',modality:'CT',series:[{seriesInstanceUid:'1.2.3.1',instanceCount:180},{seriesInstanceUid:'1.2.3.2',instanceCount:180}]};
const consent={status:'ACTIVE',validFrom:'2026-10-12',validUntil:'2026-10-14',permission:'VIEW_ONLY',scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.1'}]};
const model=c=>clinicianHomeModel([study],'1.2.3',()=>c,{patientName:'홍길동',scenario:{age:56}},now);
test('home viewer confirms the displayed TRANSFER purpose and clears previous token before existing policy request',async()=>{
 const app=readFileSync('public/app.js','utf8');
 const source=app.slice(app.indexOf('async function openClinicianHomeViewer('),app.indexOf('function syncSelectedStudyUi(',app.indexOf('async function openClinicianHomeViewer(')));
 let opened=0,refreshed=0,active=true;
 const context=vm.createContext({getConsentForStudy:()=>active?{purpose:'TRANSFER'}:null,selectedStudyUid:'1.2.3',lastConsents:[],selectedStudy:study,clinicianDetailModel:()=>[[],[],['','동의 유효 · 서버 검증 필요']],demo:{purpose:'TREATMENT'},accessPurposeSelect:{value:'TREATMENT'},consentViewRevision:0,latestToken:'old',latestTokenInfo:{},resetViewerData(){},openViewer:async()=>{opened++;},loadDashboard:async()=>{refreshed++;}});
 vm.runInContext(source,context);await context.openClinicianHomeViewer();
 assert.equal(context.demo.purpose,'TRANSFER');assert.equal(context.accessPurposeSelect.value,'TRANSFER');assert.equal(context.latestToken,null);assert.equal(context.latestTokenInfo,null);assert.equal(opened,1);
 active=false;await context.openClinicianHomeViewer();assert.equal(opened,1);assert.equal(refreshed,1);
});
test('home connects loaded Hong scenario metadata without inventing additional patients',()=>{
 const m=model(consent);assert.equal(m.patient,'홍길동');assert.equal(m.age,56);assert.equal(m.rows.length,1);assert.equal(m.attention,0);assert.equal(m.series.length,1);assert.equal(m.series[0].seriesInstanceUid,'1.2.3.1');
});
test('missing, revoked, expired and future consent require attention and never grant access',()=>{
 for(const c of [null,{...consent,status:'REVOKED'},{...consent,status:'EXPIRED'},{...consent,validFrom:'2026-10-14'},{...consent,validUntil:'2026-10-12'}])assert.equal(model(c).attention,1);
 assert.equal(model(null).series.length,0);
});
test('disabled scopes, another study and unknown selection never expose permitted series',()=>{
 assert.equal(model({...consent,scopes:[{studyInstanceUid:'1.2.3',allowed:false}]}).series.length,0);
 assert.equal(model({...consent,scopes:[{studyInstanceUid:'9.9'}]}).series.length,0);
 assert.equal(clinicianHomeModel([study],'9.9',()=>consent).selected,undefined);
});
test('single home uses real viewer path without pixel requests or unsafe HTML in presentation module',()=>{
 const html=readFileSync('public/index.html','utf8'), app=readFileSync('public/app.js','utf8'),js=readFileSync('public/ui/clinician-home.js','utf8');
 assert.equal(html.split('id="clinical-home"').length-1,1);
 assert.equal(html.includes('clinical-home-hero'),false);
 assert.match(app,/onOpen:openClinicianHomeViewer/);
 assert.match(app,/demo.purpose=consent.purpose/);
 assert.match(app,/postJson\("\/api\/dicom-access\/request"/);
 assert.equal(/innerHTML|fetch\(|\/dicomweb/.test(js),false);
 assert.match(js,/textContent/);
});
