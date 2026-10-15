import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, prepareReceipt, gatewayPrincipal } from './helpers/hcc-source-fixture.js';
import { issueHccChallenge, acceptHccReport, HCC_SOURCE_CONTRACT } from '../src/hcc-source-verification.js';
import { registerHccCatalog } from '../src/capstone-hcc-catalog.js';
import { InternalServiceProvider } from '../src/auth.js';
import { allowedControlPath } from '../src/capstone-control-ingress.js';
import { probeHccSource } from '../src/hcc-source-probe.js';

test('source token is dedicated, Hospital A bound and not a generic gateway credential', () => {
  const env = { HIPASS_HCC_SOURCE_GATEWAY_TOKEN: 's'.repeat(40), HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID: 'HOSP-A', HIPASS_DATA_PLANE_SERVICE_TOKEN: 'd'.repeat(40) };
  const provider = new InternalServiceProvider(env);
  const p = provider.authenticate({ headers: { 'x-hipass-service-token': env.HIPASS_HCC_SOURCE_GATEWAY_TOKEN } });
  assert.deepEqual(p.scopes, ['gateway:hcc-source-verify']); assert.equal(p.hospitalId, 'HOSP-A');
  assert.throws(() => provider.authenticate({ headers: { 'x-hipass-service-token': 'wrong' } }), e => e.code === 'INTERNAL_SERVICE_TOKEN_INVALID');
  for (const bad of [{ HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID: 'HOSP-B' }, { HIPASS_HCC_SOURCE_GATEWAY_TOKEN: 'short' }, { HIPASS_HCC_SOURCE_GATEWAY_TOKEN: env.HIPASS_DATA_PLANE_SERVICE_TOKEN }]) {
    assert.throws(() => new InternalServiceProvider({ ...env, ...bad }).authenticate({ headers: { 'x-hipass-service-token': env.HIPASS_HCC_SOURCE_GATEWAY_TOKEN } }));
  }
  assert.equal(allowedControlPath('/gateway/hcc-source/report'), true);
  assert.equal(allowedControlPath('/gateway/hcc-source/other'), false);
});
test('wrong role, institution, credential type, scope, missing single writer fail without state changes', async () => {
  for (const change of [f => f.principal = { ...gatewayPrincipal, role: 'SECURITY_ADMIN' }, f => f.principal = { ...gatewayPrincipal, hospitalId: 'HOSP-B' },
    f => f.principal = { ...gatewayPrincipal, authMethod: 'OIDC' }, f => f.principal = { ...gatewayPrincipal, scopes: ['gateway:data-plane-authorize'] },
    f => f.env.HIPASS_CAPSTONE_SINGLE_WRITER = '0']) {
    const f = fixture(); f.principal = gatewayPrincipal; change(f); const before = structuredClone(f.store.data);
    await assert.rejects(issueHccChallenge(f)); assert.deepEqual(f.store.data, before);
  }
});
test('report is fixed, challenge-bound, server-timed and replay protected', async () => {
  const f = fixture(), args = { ...f, principal: gatewayPrincipal };
  const c = await issueHccChallenge(args), input = { challengeId: c.challengeId, ...HCC_SOURCE_CONTRACT };
  for (const bad of [{ ...input, instanceCount: 699 }, { ...input, studyUid: '2.25.1' }, { ...input, manifestSha256: '0'.repeat(64) },
    { ...input, seriesUid: '2.25.2' }, { ...input, totalBytes: 1 }, { ...input, verification: 'QIDO_ONLY' },
    { ...input, inventorySha256: '0'.repeat(64) }, { ...input, clinicalUse: true }, { ...input, extra: true }, { ...input, challengeId: 'missing' }]) {
    const before = structuredClone(f.store.data); await assert.rejects(acceptHccReport({ ...args, input: bad })); assert.deepEqual(f.store.data, before);
  }
  const results = await Promise.allSettled([acceptHccReport({ ...args, input }), acceptHccReport({ ...args, input })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.find(x => x.status === 'rejected').reason.code, 'HCC_SOURCE_REPORT_REPLAY');
  assert.equal(f.service.verifyAuditIntegrity().ok, true);
});
test('expired/future challenge and expired receipt fail closed; committed receipt works after reload', async () => {
  for (const time of ['2026-10-10T11:59:59Z', '2026-10-10T12:30:00Z']) {
    const f = fixture(), args = { ...f, principal: gatewayPrincipal }, c = await issueHccChallenge(args);
    f.service.clock = () => time;
    await assert.rejects(acceptHccReport({ ...args, input: { challengeId: c.challengeId, ...HCC_SOURCE_CONTRACT } }), e => e.code === 'HCC_SOURCE_CHALLENGE_EXPIRED');
  }
  const f = fixture(); await prepareReceipt(f); f.service.clock = () => '2026-10-10T12:05:00Z';
  await assert.rejects(registerHccCatalog(f), e => e.code === 'HCC_SOURCE_RECEIPT_INVALID');
  f.service.clock = () => '2026-10-10T12:04:59Z'; f.store.data = structuredClone(f.store.persistedData);
  const results = await Promise.allSettled([registerHccCatalog(f), registerHccCatalog(f)]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(results.find(x => x.status === 'rejected').reason.code, 'HCC_SOURCE_RECEIPT_USED');
});
test('unacknowledged database write and corrupt audit cannot authorize registration', async () => {
  const f = fixture(); await prepareReceipt(f); f.store.data.auditLogs[0].reasonCode = 'tampered';
  await assert.rejects(registerHccCatalog(f), e => e.code === 'HCC_SOURCE_AUDIT_BASELINE_UNAVAILABLE');
  const g = fixture(); g.principal = gatewayPrincipal; g.store.saveRequiredAppendOnly = async () => { throw new Error('COMMIT_UNKNOWN'); };
  await assert.rejects(issueHccChallenge(g), e => e.code === 'HCC_SOURCE_COMMIT_UNCONFIRMED');
  assert.equal(g.store.persistenceBlocked, true); assert.equal(g.store.persistedData.auditLogs.length, 0);
  await assert.rejects(issueHccChallenge(g), e => e.code === 'HCC_SOURCE_AUDIT_BASELINE_UNAVAILABLE');
});
test('count-only PACS, invented receipt and unpersisted receipt cannot authorize a catalog', async () => {
  const f = fixture(); f.input.receiptId = 'invented'; const before = structuredClone(f.store.data);
  await assert.rejects(registerHccCatalog(f), e => e.code === 'HCC_SOURCE_RECEIPT_INVALID'); assert.deepEqual(f.store.data, before);
  const g = fixture(); g.principal = gatewayPrincipal; g.store.saveRequiredAppendOnly = async () => {};
  await assert.rejects(issueHccChallenge(g), e => e.code === 'HCC_SOURCE_COMMIT_UNCONFIRMED');
  assert.equal(g.store.persistenceBlocked, true);
});
test('append-only required persistence rejects concurrent existing-row mutations without SQL writes', async () => {
  const f = fixture(); f.store.data.hospitals[0].name = 'changed';
  await assert.rejects(f.store.saveRequiredAppendOnly(), /POSTGRES_APPEND_ONLY_REQUIRED/);
  assert.equal(f.calls.length, 0);
});
test('source probe rejects modified inventory before any PACS request', async () => {
  const manifest = { datasetType: 'SYNTHETIC', clinicalUse: false, canonicalManifestSha256: HCC_SOURCE_CONTRACT.manifestSha256,
    studyInstanceUID: HCC_SOURCE_CONTRACT.studyUid, seriesInstanceUID: HCC_SOURCE_CONTRACT.seriesUid,
    instances: Array.from({ length: 700 }, (_, i) => ({ sopInstanceUID: `2.25.${i + 1}`, bytes: 1, sha256: '0'.repeat(64) })) };
  await assert.rejects(probeHccSource({ manifest, request: () => assert.fail('must not query PACS') }), /HCC_INVENTORY_HASH_MISMATCH/);
});
