import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const start = source.indexOf('function transferItemsForPreflight()');
const end = source.indexOf('// Hospital B PACS Archive Workstation Module');
const workbench = source.slice(start, end);
const jobId = 'a11ce000-1111-4111-8111-111111111111';
const itemId = 'b22ce000-2222-4222-8222-222222222222';
const leaseId = 'c33ce000-3333-4333-8333-333333333333';
const item = { itemId, ordinal: 1, studyInstanceUid: '1.2.3', seriesInstanceUid: '1.2.3.1', sopInstanceUid: '1.2.3.1.1' };
const activeJob = state => ({ jobId, state, totalItems: 1, succeededItems: state === 'COMPLETED' ? 1 : 0,
  failedItems: 0, items: [{ ...item, state: state === 'COMPLETED' ? 'SUCCEEDED' : 'IN_PROGRESS' }] });
const validToken = () => ({ decision: 'ALLOWED', tokenType: 'DPoP', accessToken: 'header.payload.signature',
  permission: 'DOWNLOAD_ALLOWED', allowedStudyUid: item.studyInstanceUid, allowedSeriesUids: [item.seriesInstanceUid],
  expiresAt: new Date(Date.now() + 120000).toISOString() });
const validReceipt = () => ({ status: 'PACS_INSTANCE_VERIFIED', simulation: false, destinationVerification: true,
  studyInstanceUid: item.studyInstanceUid, seriesInstanceUid: item.seriesInstanceUid, sopInstanceUid: item.sopInstanceUid,
  sha256: 'a'.repeat(64), bytes: 4096, alreadyStored: false });

function fixture({ tokenResult = validToken(), importResult = validReceipt(), importCall } = {}) {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { checked: true, disabled: false, hidden: false, textContent: '', dataset: {},
      style: {}, className: '', replaceChildren() {}, setAttribute() {}, append() {} });
    return nodes.get(id);
  };
  const calls = { create: [], claim: [], token: [], import: [], status: [], active: [] };
  const consent = { consentId: 'selected-consent', sourceHospitalId: 'HOSP-A', targetHospitalId: 'HOSP-B',
    purpose: 'TREATMENT', permission: 'DOWNLOAD_ALLOWED', status: 'ACTIVE' };
  let claimed = false;
  let currentJob = activeJob('IN_PROGRESS');
  const context = vm.createContext({
    pacsImportBusy: false, isPreflightPassed: true,
    preflightFingerprint: JSON.stringify({ consentId: consent.consentId, items: [{ studyInstanceUid: item.studyInstanceUid,
      seriesInstanceUid: item.seriesInstanceUid, sopInstanceUid: item.sopInstanceUid }] }),
    transferQueue: [], transferQueueConsentId: '', activeTransferJobId: '', activeTransferJobs: [],
    currentPersona: 'DOCTOR',
    consentMutationPending: false, selectedStudyUid: item.studyInstanceUid, selectedSeriesUid: item.seriesInstanceUid,
    selectedSopUid: item.sopInstanceUid, lastStudies: [], lastConsents: [consent], lastInstances: [],
    demo: { doctorId: 'doctor-b', targetHospitalId: 'HOSP-B', purpose: 'TREATMENT' },
    document: { querySelector: node, createElement: () => ({ dataset: {}, setAttribute() {}, append() {}, type: '', textContent: '' }) },
    crypto: { randomUUID: () => randomUUID() },
    getConsentForStudy: () => consent,
    importPreflight: () => ({ ready: true, checks: [] }),
    renderOutput() {}, toFriendlyError: value => value,
    fetchJson: async (path, options = {}) => {
      if (path === '/api/pacs-transfer-jobs' && options.method === 'POST') {
        calls.create.push({ path, options }); return { jobId, created: true };
      }
      if (path === '/api/pacs-transfer-jobs/active') {
        calls.active.push(path);
        return { jobs: ['COMPLETED', 'FAILED', 'EXPIRED', 'REVOKED'].includes(currentJob.state) ? [] : [{ jobId,
          state: currentJob.state, totalItems: currentJob.totalItems, succeededItems: currentJob.succeededItems,
          failedItems: currentJob.failedItems, validUntil: new Date(Date.now() + 60000).toISOString() }] };
      }
      if (path.endsWith('/claim') && options.method === 'POST') {
        calls.claim.push({ path, options });
        if (claimed) return { claimed: false, job: currentJob };
        claimed = true;
        return { claimed: true, jobId, auditSessionId: 'transfer-audit', consentId: consent.consentId,
          sourceHospitalId: consent.sourceHospitalId, targetHospitalId: consent.targetHospitalId,
          purpose: consent.purpose, permission: consent.permission, validUntil: new Date(Date.now() + 60000).toISOString(),
          item, leaseId };
      }
      if (path === '/api/dicom-access/request') {
        calls.token.push({ path, options }); return tokenResult;
      }
      if (path.endsWith('/import')) {
        calls.import.push({ path, options });
        if (importCall) return importCall();
        currentJob = activeJob(importResult.status === 'PACS_INSTANCE_VERIFIED' && importResult.destinationVerification === true
          ? 'COMPLETED' : 'IN_PROGRESS');
        return importResult;
      }
      if (path.endsWith(`/${jobId}`)) { calls.status.push(path); return currentJob; }
      throw new Error(`UNEXPECTED_ROUTE ${path}`);
    },
    postJson: async (path, body) => {
      calls.token.push({ path, body });
      return tokenResult;
    },
  });
  vm.runInContext(workbench, context);
  return { calls, node, run: () => vm.runInContext('runPacsImport()', context),
    restore: () => vm.runInContext('restorePacsTransferJob()', context) };
}

test('creates a durable job, requests a fresh DPoP DOWNLOAD token, and imports the claimed item', async () => {
  const f = fixture();
  await f.run();
  assert.equal(f.calls.create.length, 1);
  assert.deepEqual(JSON.parse(f.calls.create[0].options.body), { consentId: 'selected-consent', items: [{
    studyInstanceUid: item.studyInstanceUid, seriesInstanceUid: item.seriesInstanceUid, sopInstanceUid: item.sopInstanceUid,
  }] });
  assert.equal(f.calls.claim.length, 2, 'claims next item then observes the completed job');
  assert.equal(f.calls.token.length, 1);
  assert.equal(f.calls.token[0].path, '/api/dicom-access/request');
  assert.equal(f.calls.token[0].body.requestedAction, 'DOWNLOAD');
  assert.equal(f.calls.token[0].body.studyInstanceUid, item.studyInstanceUid);
  assert.equal(f.calls.import.length, 1);
  assert.equal(f.calls.import[0].path, `/dicomweb/studies/${item.studyInstanceUid}/series/${item.seriesInstanceUid}/instances/${item.sopInstanceUid}/import`);
  assert.equal(f.calls.import[0].options.method, 'POST');
  assert.equal(f.calls.import[0].options.body, undefined);
  assert.equal(f.calls.import[0].options.headers.authorization, 'Bearer header.payload.signature');
  assert.equal(f.calls.import[0].options.headers['x-hipass-transfer-job-id'], jobId);
  assert.equal(f.calls.import[0].options.headers['x-hipass-transfer-item-id'], itemId);
  assert.equal(f.calls.import[0].options.headers['x-hipass-transfer-lease-id'], leaseId);
  assert.equal(f.node('#pacs-transfer-status').textContent, '1/1 완료 · 0건 실패');
  assert.equal(f.node('#pacs-import-status-pill').textContent, 'B PACS 등록 확인');
});

test('restores resumable work from the authenticated server without browser storage', async () => {
  const f = fixture();
  await f.restore();
  assert.deepEqual(f.calls.active, ['/api/pacs-transfer-jobs/active']);
  assert.equal(f.node('#transfer-job-resume').hidden, false);
  assert.equal(f.node('#btn-resume-pacs-job').disabled, false);
});

test('token denial stops before the image request and leaves the job resumable', async () => {
  const f = fixture({ tokenResult: { decision: 'DENIED', reasonCode: 'CONSENT_REVOKED' } });
  await f.run();
  assert.equal(f.calls.create.length, 1);
  assert.equal(f.calls.claim.length, 1);
  assert.equal(f.calls.import.length, 0);
  assert.equal(f.node('#pacs-import-status-pill').textContent, '작업이 중단됨');
  assert.equal(f.node('#transfer-job-resume').hidden, false);
});

test('invalid destination evidence never becomes success and is not retried automatically', async () => {
  const f = fixture({ importResult: { ...validReceipt(), destinationVerification: false } });
  await f.run();
  assert.equal(f.calls.import.length, 1);
  assert.equal(f.node('#pacs-import-status-pill').textContent, '수신 결과 확인 필요');
  assert.match(f.node('#pacs-import-log').textContent, /자동 재전송하지 않았습니다/);
  assert.equal(f.node('#transfer-job-resume').hidden, false);
});

test('a concurrent click is ignored and an uncertain import response is never retried automatically', async () => {
  let rejectImport, importCount = 0;
  const f = fixture({ importCall: () => { importCount++; return new Promise((_, reject) => { rejectImport = reject; }); } });
  const first = f.run();
  await f.run();
  for (let attempt = 0; attempt < 20 && !rejectImport; attempt++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(importCount, 1);
  rejectImport(new Error('timeout'));
  await first;
  assert.equal(f.calls.import.length, 1);
  assert.match(f.node('#pacs-import-log').textContent, /자동 재전송하지 않았습니다/);
});
