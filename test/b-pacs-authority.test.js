import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/store.js';
import { HipassService } from '../src/services.js';
import { authorizeDataPlane } from '../src/data-plane-authorization.js';
import { ConsentBoundKeyRelease } from '../src/consent-bound-key-release.js';
import { HCC_SOURCE_CONTRACT as fixed } from '../src/hcc-source-contract.js';

async function fixture(t, { transferJobRepository = null } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'hp-b-pacs-authority-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new JsonStore(path.join(dir, 'db.json')); await store.load();
  const service = new HipassService(store, () => '2026-10-08T14:00:00.000Z', { tokenSecret: randomBytes(32).toString('hex') });
  const consent = store.get('consents').find(x => x.consentId === 'CONSENT-DEMO-ACTIVE');
  consent.permission = 'DOWNLOAD_ALLOWED';
  const study = store.get('imagingStudies').find(x => x.studyInstanceUid === '1.2.410.100.1.20260620.001');
  study.studyInstanceUid = fixed.studyUid;
  study.series = [{ seriesInstanceUid: fixed.seriesUid }];
  for (const scope of store.get('consentScopes').filter(x => x.consentId === consent.consentId)) {
    scope.studyInstanceUid = fixed.studyUid; scope.seriesInstanceUid = fixed.seriesUid;
  }
  const config = { sourceHospitalId: 'HOSP-A', recipientHospitalId: 'HOSP-B', publicBaseUrl: 'https://demo.test',
    keyId: `https://capstone-demo.vault.azure.net/keys/demo/${'a'.repeat(32)}`, pacsImportEnabled: true };
  const requestPath = `/dicomweb/studies/${fixed.studyUid}/series/${fixed.seriesUid}/instances/2.25.1001/import`;
  const issued = await service.requestDicomAccessToken({ consentId: consent.consentId, doctorId: 'DOC-B-01', requestingHospitalId: 'HOSP-B',
    purpose: 'TREATMENT', requestedAction: 'DOWNLOAD', studyInstanceUid: fixed.studyUid, seriesInstanceUid: fixed.seriesUid });
  assert.equal(issued.decision, 'ALLOWED', issued.reasonCode);
  const keys = generateKeyPairSync('ec', { namedCurve: 'P-256' }), jwk = keys.publicKey.export({ format: 'jwk' });
  const claims = service.verifyAccessTokenSignature(issued.accessToken).claims;
  claims.cnf = { jkt: createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url') };
  const token = service.signAccessToken(claims);
  store.get('dicomAccessTokenLogs').find(x => x.tokenId === claims.jti).tokenHash = 'sha256:' + createHash('sha256').update(token).digest('hex');
  const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const input = { method: 'POST', path: requestPath, authorizationScheme: 'DPoP', token, clientIp: '192.0.2.1' };
  const proof = () => {
    const data = `${encode({ typ: 'dpop+jwt', alg: 'ES256', jwk })}.${encode({ htm: 'POST', htu: config.publicBaseUrl + requestPath,
      jti: randomUUID(), iat: Date.parse(service.clock()) / 1000, ath: createHash('sha256').update(token).digest('base64url') })}`;
    return `${data}.${sign('sha256', Buffer.from(data), { key: keys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
  };
  input.dpopProof = proof();
  const granted = await authorizeDataPlane(service, input, config); assert.equal(granted.status, 200, granted.body.reason);
  const records = new Map();
  const repository = { persistent: true, async create(row) { records.set(row.releaseId, row); }, async read(id) { return records.get(id); },
    async consume(id) { const row = records.get(id); if (row.consumed) return false; row.consumed = true; return true; } };
  const policy = new ConsentBoundKeyRelease({ service, repository, transferJobRepository, configuration: config });
  const packageBinding = { packageId: 'fixture-pacs-package', keyId: config.keyId, wrappedKeyHash: 'a'.repeat(64),
    ciphertextHash: 'b'.repeat(64), manifestHash: 'c'.repeat(64), recipientHospitalId: 'HOSP-B' };
  const receipt = granted.body.receipt, prepared = await policy.prepare({ receipt, packageBinding });
  const context = { receipt, packageBinding, releaseId: prepared.releaseId, authenticatedHospitalId: 'HOSP-B' };
  await policy.authorize({ ...context, phase: 'AFTER_UNWRAP' });
  const evidence = { manifestSha256: fixed.manifestSha256, sha256: 'd'.repeat(64), bytes: 200, orthancId: null };
  return { store, service, consent, policy, input, proof, config, context, evidence };
}

test('POST DPoP authorizes fixed B import and produces correlated B report audit', async t => {
  const f = await fixture(t);
  assert.equal(await f.policy.authorizeImport({ ...f.context, phase: 'BEFORE_IMPORT', evidence: f.evidence }), true);
  const evidence = { ...f.evidence, orthancId: '12345678-12345678-12345678-12345678-12345678' };
  assert.equal(await f.policy.authorizeImport({ ...f.context, phase: 'PACS_VERIFIED', evidence }), true);
  const audit = f.store.get('auditLogs').find(x => x.action === 'PACS_INSTANCE_VERIFIED');
  assert.equal(audit.studyInstanceUid, fixed.studyUid); assert.ok(audit.auditSessionId); assert.match(audit.reason, /AUTHENTICATED_B_REPORT/);
});

test('authenticated B PACS verification completes only the exact claimed job item', async t => {
  const calls = { claims: [], receipts: [] };
  const transferJobRepository = {
    async assertActiveLease(input) { calls.claims.push(input); return true; },
    async recordVerifiedReceipt(input) { calls.receipts.push(input); return { accepted: true }; },
  };
  const f = await fixture(t, { transferJobRepository });
  const transferJob = { jobId: randomUUID(), itemId: randomUUID(), leaseId: randomUUID() };
  const evidence = { ...f.evidence, orthancId: null };
  assert.equal(await f.policy.authorizeImport({ ...f.context, transferJob, phase: 'BEFORE_IMPORT', evidence }), true);
  assert.equal(calls.claims.length, 1);
  assert.equal(calls.claims[0].actorId, 'DOC-B-01');
  assert.equal(calls.claims[0].consentId, f.consent.consentId);
  assert.equal(calls.claims[0].permission, 'DOWNLOAD_ALLOWED');
  const verified = { ...evidence, orthancId: '12345678-12345678-12345678-12345678-12345678' };
  assert.equal(await f.policy.authorizeImport({ ...f.context, transferJob, phase: 'PACS_VERIFIED', evidence: verified }), true);
  assert.equal(calls.receipts.length, 1);
  assert.equal(calls.receipts[0].jobId, transferJob.jobId);
  assert.equal(calls.receipts[0].destinationSopInstanceUid, fixed.sopUid ?? f.input.path.split('/').at(-2));
  assert.equal(calls.receipts[0].sha256, verified.sha256);
  assert.equal(f.store.get('auditLogs').some(row => row.action === 'PACS_INSTANCE_VERIFIED'), true);
});

test('transfer completion report fails closed when the durable job lease is unavailable', async t => {
  const f = await fixture(t);
  const transferJob = { jobId: randomUUID(), itemId: randomUUID(), leaseId: randomUUID() };
  await assert.rejects(f.policy.authorizeImport({ ...f.context, transferJob, phase: 'BEFORE_IMPORT', evidence: f.evidence }), /KEY_RELEASE_/);
  assert.equal(f.store.get('auditLogs').some(row => row.action === 'PACS_IMPORT_AUTHORIZED'), false);
});

test('import feature-off, Bearer, missing proof, tampered token and DPoP replay deny', async t => {
  const f = await fixture(t);
  assert.equal((await authorizeDataPlane(f.service, f.input, { ...f.config, pacsImportEnabled: false })).body.reason, 'PACS_IMPORT_DISABLED');
  assert.equal((await authorizeDataPlane(f.service, { ...f.input, authorizationScheme: 'Bearer' }, f.config)).body.reason, 'PACS_IMPORT_PROOF_REQUIRED');
  for (const input of [{ ...f.input, dpopProof: undefined }, { ...f.input, token: f.input.token + 'x' }, f.input]) {
    assert.equal((await authorizeDataPlane(f.service, input, f.config)).body.active, false);
  }
  assert.ok(!f.store.get('auditLogs').some(x => x.action === 'PACS_INSTANCE_VERIFIED'));
});

for (const [name, change] of [
  ['revoked consent', f => { f.consent.status = 'REVOKED'; }],
  ['expired receipt', f => { f.service.clock = () => '2026-10-08T14:00:31.000Z'; }],
  ['VIEW_ONLY downgrade', f => { f.consent.permission = 'VIEW_ONLY'; }],
  ['hospital suspension', f => { f.store.get('hospitals').find(x => x.hospitalId === 'HOSP-B').status = 'SUSPENDED'; }],
  ['wrong recipient', f => { f.context.authenticatedHospitalId = 'HOSP-C'; }],
  ['evidence injection', f => { f.evidence.rawDicom = 'forbidden'; }],
]) test(`${name} denies before import audit/completion`, async t => {
  const f = await fixture(t); change(f);
  await assert.rejects(f.policy.authorizeImport({ ...f.context, phase: 'BEFORE_IMPORT', evidence: f.evidence }), /KEY_RELEASE_/);
  assert.ok(!f.store.get('auditLogs').some(x => ['PACS_IMPORT_AUTHORIZED', 'PACS_INSTANCE_VERIFIED'].includes(x.action)));
});
