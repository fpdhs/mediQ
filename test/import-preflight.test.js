import test from 'node:test';
import assert from 'node:assert/strict';
import {importPreflight} from '../public/ui/import-preflight.js';
const now = Date.parse('2026-10-13T00:00:00Z');
const consent = {consentId:'demo',status:'ACTIVE',permission:'DOWNLOAD_ALLOWED',targetHospitalId:'HOSP-B',validFrom:'2026-10-12',validUntil:'2026-10-14',scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:null,allowed:true}]};
test('complete local hints allow confirmation, not server authorization',()=>assert.equal(importPreflight(consent,'1.2.3','HOSP-B',now).ready,true));
test('missing, revoked, view-only, wrong hospital, expired, future and wrong scope block local readiness',()=>{
  for(const candidate of [null,{...consent,status:'REVOKED'},{...consent,permission:'VIEW_ONLY'},{...consent,targetHospitalId:'HOSP-C'},{...consent,validUntil:'2026-10-13'},{...consent,validFrom:'2026-10-14'},{...consent,scopes:[]},{...consent,scopes:[{studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.1'}]}]) assert.equal(importPreflight(candidate,'1.2.3','HOSP-B',now).ready,false);
});
