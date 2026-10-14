import test from 'node:test';
import assert from 'node:assert/strict';
import {importPreflight} from '../public/ui/import-preflight.js';
const now = Date.parse('2026-10-13T00:00:00Z');
const consent = {consentId:'demo',status:'ACTIVE',permission:'DOWNLOAD_ALLOWED',targetHospitalId:'HOSP-B',validFrom:'2026-10-12',validUntil:'2026-10-14',scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:null,allowed:true}]};
const instance = {studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.1',sopInstanceUid:'1.2.3.1.1',hospitalId:'HOSP-B'};
test('one selected instance inside study-wide consent enables confirmation only',()=>assert.equal(importPreflight(consent,instance,now).ready,true));
test('one selected instance inside series-limited consent enables confirmation only',()=>assert.equal(importPreflight({...consent,scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.1',allowed:true}]},instance,now).ready,true));
test('missing, revoked, view-only, wrong hospital, expired, future and out-of-scope block local readiness',()=>{
  for(const candidate of [null,{...consent,status:'REVOKED'},{...consent,permission:'VIEW_ONLY'},{...consent,targetHospitalId:'HOSP-C'},{...consent,validUntil:'2026-10-13'},{...consent,validFrom:'2026-10-14'},{...consent,scopes:[]},{...consent,scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.2'}]}]) assert.equal(importPreflight(candidate,instance,now).ready,false);
  for(const missing of [{...instance,sopInstanceUid:''},{...instance,seriesInstanceUid:''},{...instance,studyInstanceUid:'1.2.3.4'.repeat(20)}]) assert.equal(importPreflight(consent,missing,now).ready,false);
});
