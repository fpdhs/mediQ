import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {archiveRetentionDecision,captureArchiveRetention,purgeExpiredArchive} from '../src/archive-retention.js';
import {importStudyToHospitalBPacs,readArchivedDicomBuffer} from '../src/pacs-import-engine.js';
import {JsonStore} from '../src/store.js';
import {HipassService} from '../src/services.js';
const before='2026-10-13T00:00:00Z', after='2026-10-14T00:00:00Z';
const consent={consentId:'synthetic-consent',patientId:'P-1001',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',status:'ACTIVE',permission:'DOWNLOAD_ALLOWED',validFrom:'2026-10-12T00:00:00Z',validUntil:after};
const base={studyInstanceUid:'1.2.3',patientId:'P-1001',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',retention:captureArchiveRetention(consent,before)};
test('deadline is fixed; extension cannot extend old archive and equality denies',()=>{
  assert.equal(archiveRetentionDecision(base,consent,before).allowed,true);
  assert.equal(archiveRetentionDecision(base,{...consent,validUntil:'2027-01-01'},after).deleteDue,true);
  assert.equal(archiveRetentionDecision(base,{...consent,status:'REVOKED'},before).deleteDue,true);
  assert.equal(archiveRetentionDecision({...base,retention:undefined},consent,before).allowed,false);
  assert.equal(archiveRetentionDecision(base,null,before).deleteDue,false);
});
async function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hipass-retention-test-'));
  t.after(()=>{assert.ok(path.basename(root).startsWith('hipass-retention-test-'));fs.rmSync(root,{recursive:true,force:true});});
  const kek=randomBytes(32);
  await importStudyToHospitalBPacs({baseDestDir:root,studyInstanceUid:'1.2.3',kek,consent,clock:()=>before,allowSynthetic:true,
    studyData:{series:[{seriesInstanceUid:'1.2.3.1',instances:[{sopInstanceUid:'1.2.3.1.1'}]}]}});
  const file=path.join(root,'1.2.3','1.2.3.1','1.2.3.1.1.dcm.enc');
  const manifest=()=>JSON.parse(fs.readFileSync(path.join(root,'1.2.3','manifest.json'),'utf8'));
  const read=(live=consent,now=before)=>readArchivedDicomBuffer({baseDestDir:root,studyInstanceUid:'1.2.3',seriesInstanceUid:'1.2.3.1',sopInstanceUid:'1.2.3.1.1',kek,consent:live,now});
  return {root,file,manifest,read};
}
test('real encrypted files expire; key envelope removed; audit retained; repeat is idempotent',async t=>{
  const f=await fixture(t), events=[];
  assert.equal(f.read().subarray(128,132).toString(),'DICM');
  assert.throws(()=>f.read(consent,after),/retention/);
  const args={root:f.root,studyUid:'1.2.3',getConsent:()=>consent,now:after,audit:async e=>events.push(e)};
  assert.equal((await purgeExpiredArchive(args)).state,'DELETED');
  assert.equal(fs.existsSync(f.file),false);assert.equal(f.manifest().keyEnvelope,undefined);
  assert.deepEqual(events.map(e=>e.action),['ARCHIVE_DELETE_STARTED','ARCHIVE_DELETE_COMPLETED']);
  await purgeExpiredArchive(args);assert.equal(events.length,2);
});
test('revocation denies immediately; failed deletion remains denied and retries only managed ciphertext',async t=>{
  const f=await fixture(t), revoked={...consent,status:'REVOKED'};
  assert.throws(()=>f.read(revoked),/retention/);
  const unrelated=path.join(f.root,'preserve.txt');fs.writeFileSync(unrelated,'keep');
  const args={root:f.root,studyUid:'1.2.3',getConsent:()=>revoked,now:before,audit:async()=>{}};
  assert.equal((await purgeExpiredArchive({...args,unlink:()=>{throw new Error('disk busy');}})).state,'DELETE_FAILED');
  assert.equal(f.manifest().keyEnvelope,undefined);assert.throws(()=>f.read(),/retention/);
  assert.equal((await purgeExpiredArchive(args)).state,'DELETED');assert.equal(fs.readFileSync(unrelated,'utf8'),'keep');
});
test('audit unavailable denies deletion and plaintext; invalid path cannot select external files',async t=>{
  const f=await fixture(t);
  const result=await purgeExpiredArchive({root:f.root,studyUid:'1.2.3',getConsent:()=>consent,now:after,audit:async()=>{throw new Error('audit unavailable');}});
  assert.equal(result.state,'DELETE_FAILED');assert.equal(fs.existsSync(f.file),true);assert.throws(()=>f.read(),/retention/);
  await assert.rejects(purgeExpiredArchive({root:f.root,studyUid:'../outside'}),/UID/);
});

test('service revocation persists audit and deletes only consent-bound configured storage',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'hipass-retention-test-'));
  t.after(()=>{assert.ok(path.basename(root).startsWith('hipass-retention-test-'));fs.rmSync(root,{recursive:true,force:true});});
  const store=new JsonStore(path.join(root,'db.json'));await store.load();
  const archiveRoot=path.join(root,'hospital-b-pacs');
  const service=new HipassService(store,()=>before,{hospitalArchiveRoot:archiveRoot,hospitalArchiveKek:randomBytes(32),allowSyntheticArchive:true});
  const live=await service.createConsent({patientId:'P-1001',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TREATMENT',permission:'DOWNLOAD_ALLOWED',validUntil:after,scopes:[{studyInstanceUid:'1.2.410.100.1.20260518.002'}]});
  await service.executePacsImport({consentId:live.consentId,doctorId:'DOC-B-01',targetHospitalId:'HOSP-B',studyInstanceUid:'1.2.410.100.1.20260518.002'});
  assert.equal(service.listHospitalBPacsArchive()[0].access.allowed,true);
  await service.revokeConsent(live.consentId,'P-1001');
  const record=service.listHospitalBPacsArchive()[0];
  assert.equal(record.retention.state,'DELETED');assert.equal(record.access.allowed,false);assert.equal(record.keyEnvelope,undefined);
  assert.ok(store.get('auditLogs').some(e=>e.action==='ARCHIVE_DELETE_COMPLETED'));
  assert.ok(store.get('auditLogs').some(e=>e.action==='CONSENT_REVOKED'));
});
