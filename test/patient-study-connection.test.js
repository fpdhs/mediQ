import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {shareReviewModel} from '../public/ui/patient-share-review.js';
const source=readFileSync('public/app.js','utf8');
const extract=name=>source.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))[0];
const study={studyInstanceUid:'2.25.1',description:'합성 복부 CT',modality:'CT',sourceHospitalId:'HOSP-A',series:[{seriesInstanceUid:'2.25.2',instanceCount:700}]};

test('public patient snapshot requests only scoped metadata and consents; selection consumers all refresh',async()=>{
 const calls=[],events=[];
 const context={capstoneAuth:{context:{}},currentPersona:'PATIENT',dashboardRequestSequence:0,dashboardAppliedSequence:0,latestConsentId:null,consentViewRevision:0,
  demo:{patientId:'MEDIQ-SYN-HCC-001'},auditResultFilter:null,auditActionFilter:null,URLSearchParams,
  fetchDashboardReads:async paths=>{calls.push(...paths);return [[study],[]];},lastStudies:[],lastConsents:[],walletSnapshotReady:false,
  applyPatientStudySnapshot(rows){context.lastStudies=rows;events.push('studies');},
  document:{querySelector:()=>null},clinicalRecentLogs:[],loadPhrDashboard:async()=>events.push('phr')};
 for(const fn of ['refreshWalletHome','updateConsentState','renderPatientOverview','renderPresentationScenario','renderDoctorStudies','renderLogs','renderAnomalies','renderQuarantines','renderConsentHistory','renderMetrics','renderHealth','renderPatientReceipts','updatePipelineSteps'])context[fn]=()=>events.push(fn);
 context.selectConsentForStudy=()=>null;
 vm.createContext(context);vm.runInContext(extract('fetchDashboardSnapshot'),context);await context.fetchDashboardSnapshot();
 assert.deepEqual(calls,['/api/imaging-studies?patientId=MEDIQ-SYN-HCC-001&includeSeries=true','/api/patients/MEDIQ-SYN-HCC-001/consents']);
 assert.ok(events.includes('studies'));assert.ok(!events.includes('renderHealth'));
});

test('selection updates preserve current Study, recipient and draft; empty results clear stale scope',()=>{
 const context={patientStudySelect:{},patientSeriesSelect:{},lastStudies:[study],selectedStudyUid:study.studyInstanceUid,selectedSeriesUid:'2.25.2',consentMutationPending:false,
  sourceHospitalSelect:{value:'HOSP-A'},targetHospitalSelect:{value:'HOSP-C'},accessPurposeSelect:{value:'TRANSFER'},accessModeSelect:{value:'VIEW_ONLY'},demo:{},
  escapeHtml:v=>String(v),document:{querySelector:()=>null},renderPatientSeriesOptions:()=>{}};
 vm.createContext(context);vm.runInContext(extract('renderPatientStudyOptions'),context);
 context.renderPatientStudyOptions([study]);assert.equal(context.patientStudySelect.value,study.studyInstanceUid);
 assert.equal(context.targetHospitalSelect.value,'HOSP-C');assert.equal(context.accessPurposeSelect.value,'TRANSFER');assert.equal(context.selectedSeriesUid,'2.25.2');
 context.renderPatientStudyOptions([]);assert.equal(context.selectedStudyUid,'');assert.equal(context.selectedSeriesUid,'');assert.equal(context.patientStudySelect.disabled,true);
 assert.match(context.patientStudySelect.innerHTML,/등록된 영상검사가 없습니다/);
});

test('standard health refresh and dashboard use one Study application path',()=>{
 assert.match(extract('loadPhrDashboard'),/onSnapshot:async snapshot=>\{applyPatientStudySnapshot\(snapshot.studies\)/);
 const events=[],context={lastStudies:[],patientStudySnapshotAvailable:false,consentMutationPending:false,renderPatientStudyOptions:()=>events.push('options'),renderStudies:()=>events.push('cards'),shareReview:{refresh:()=>events.push('review')}};
 vm.createContext(context);vm.runInContext(extract('applyPatientStudySnapshot'),context);context.applyPatientStudySnapshot([study]);
 assert.deepEqual(events,['options','cards','review']);assert.equal(context.patientStudySnapshotAvailable,true);
 assert.throws(()=>context.applyPatientStudySnapshot(null));
});

test('review stays fail-closed until valid Study and conditions, counts registered 700 instances',()=>{
 const input={study,source:'HOSP-A',target:'HOSP-B',purpose:'TREATMENT',permission:'VIEW_ONLY',from:'2026-01-01',until:'2090-01-01'};
 assert.equal(shareReviewModel({...input,study:null}).valid,false);
 assert.equal(shareReviewModel(input).valid,true);assert.equal(shareReviewModel(input).count,700);
 assert.equal(shareReviewModel({...input,source:'HOSP-C'}).valid,false);
 assert.equal(shareReviewModel({...input,seriesUid:'2.25.999'}).valid,false);
});

test('public allowlist adds exact read-only patient consent route without opening admin, health or image routes',()=>{
 const edge=readFileSync('scripts/start-public-web.js','utf8');
 const routes=vm.runInNewContext(edge.match(/const routes=(\[[^]*?\n\]);/)[1]);
 const allowed=(method,path)=>routes.some(([m,re])=>method===m&&re.test(path));
 assert.equal(allowed('GET','/api/patients/MEDIQ-SYN-HCC-001/consents'),true);
 for(const [method,path] of [['POST','/api/patients/MEDIQ-SYN-HCC-001/consents'],['GET','/api/patients/x/consents/extra'],['GET','/api/health'],['GET','/api/audit-logs'],['GET','/patient-dicomweb/studies']])assert.equal(allowed(method,path),false);
 assert.match(edge,/AUTHENTICATION_REQUIRED/);assert.match(readFileSync('src/server.js','utf8'),/assertPatientPrincipal\(principal, segments\[2\]\)/);
});
