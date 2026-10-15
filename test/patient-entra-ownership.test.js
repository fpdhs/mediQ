import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import { createPatientEntraOwnershipResolver } from '../src/patient-entra-ownership-binding.js';
import { PatientSelfViewAuthorityReader } from '../src/patient-self-view-authority.js';
import { PatientSelfViewGrantRepository } from '../src/patient-self-view-grant-repository.js';
import { PatientSelfViewAuthorization } from '../src/patient-self-view-authorization.js';

const guid = n => `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'hp-entra-ownership-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'actors.json');
  const map = { schemaVersion: 1, tenantId: guid(1), actors: [
    { objectId: guid(4), actorId: 'synthetic-patient-hcc', role: 'PATIENT', patientId: 'MEDIQ-SYN-HCC-001' },
    { objectId: guid(5), actorId: 'synthetic-doctor-b', role: 'DOCTOR', doctorId: 'DOC-B-01', hospitalId: 'HOSP-B' }] };
  const save = () => writeFileSync(file, JSON.stringify(map)); save();
  const env = { AUTH_MODE: 'ENTRA_OIDC', ENTRA_TENANT_ID: guid(1), ENTRA_SPA_CLIENT_ID: guid(2),
    ENTRA_API_AUDIENCE: guid(3), ENTRA_API_SCOPE: 'access_as_user', HIPASS_ENTRA_ACTOR_MAP_FILE: file };
  const resolver = createPatientEntraOwnershipResolver(env);
  const input = { principal: { role: 'PATIENT', subject: 'synthetic-patient-hcc', patientId: 'MEDIQ-SYN-HCC-001',
    authMethod: 'ENTRA_OIDC_ACCESS_TOKEN', authMode: 'ENTRA_OIDC', issuer: `https://login.microsoftonline.com/${guid(1)}/v2.0`,
    audience: guid(3), entraObjectId: guid(4), expiresAtMs: 301000 },
    patientId: 'MEDIQ-SYN-HCC-001', studyInstanceUid: '1.2.3', seriesInstanceUid: '1.2.3.1', requestedAction: 'VIEW' };
  const row = { subject: 'synthetic-hcc-account', patient_id: input.patientId, account_status: 'ACTIVE', evidence_kind: 'CAPSTONE_MOCK_IDP',
    account_revision: guid(1), ref_id: guid(2), version: 1, ref_status: 'ACTIVE', study_instance_uid: '1.2.3',
    source_hospital_id: 'HOSP-A', hospital_status: 'ACTIVE', series_instance_uid: '1.2.3.1' };
  const queries = [];
  const query = async q => { queries.push(q); return { rows: [row] }; };
  const reader = new PatientSelfViewAuthorityReader({ pool: { query }, enabled: true, allowIssuedGrant: true,
    clock: () => 1000, resolveEntraOwnership: resolver });
  return { env, map, save, file, resolver, input, row, reader, queries, query };
}

test('Entra exact mapping uses canonical ownership but retains authenticated actor', async t => {
  const f = fixture(t), decision = await f.reader.authorize(f.input);
  assert.equal(decision.decision, 'ALLOWED');
  assert.equal(decision.scope.subject, 'synthetic-patient-hcc');
  assert.equal(decision.scope.ownershipSubject, 'synthetic-hcc-account');
  assert.equal(f.queries[0].values[0], 'synthetic-hcc-account');
  assert.equal(createPatientEntraOwnershipResolver({ AUTH_MODE: 'TEST' }), null);
});

test('wrong identity/issuer/audience/role/patient/auth provenance/expiry deny', async t => {
  const f = fixture(t);
  for (const patch of [{ entraObjectId: guid(6) }, { entraObjectId: undefined }, { issuer: 'foreign' },
    { audience: 'foreign' }, { role: 'DOCTOR' }, { subject: 'synthetic-hcc-account' },
    { patientId: 'other' }, { authMethod: 'TEST_JWT', authMode: 'TEST' }, { expiresAtMs: 1000 }]) {
    assert.equal((await f.reader.authorize({ ...f.input, principal: { ...f.input.principal, ...patch } })).decision, 'DENIED');
  }
  assert.equal(f.queries.length, 0);
});

test('missing ownership, suspended registration, foreign series and download never authorize', async t => {
  const f = fixture(t);
  for (const patch of [{ account_status: 'SUSPENDED' }, { ref_status: 'REVOKED' }, { series_instance_uid: '1.2.3.2' }]) {
    const original = { ...f.row }; Object.assign(f.row, patch);
    assert.equal((await f.reader.authorize(f.input)).decision, 'DENIED'); Object.assign(f.row, original);
  }
  assert.equal((await f.reader.authorize({ ...f.input, requestedAction: 'DOWNLOAD' })).decision, 'DENIED');
  f.reader.pool.query = async () => ({ rows: [] });
  assert.equal((await f.reader.authorize(f.input)).reasonCode, 'PATIENT_OWNERSHIP_UNVERIFIED');
});

test('live map changes invalidate old session and grant revision; broken map fails closed', async t => {
  const f = fixture(t), first = await f.reader.authorize(f.input);
  const grantInput = { ...f.input, principal: { ...f.input.principal, authMethod: 'PATIENT_SELF_VIEW_GRANT',
    authorityType: 'PATIENT_SELF_VIEW', issuer: 'highpass-control-plane', audience: 'mediq-patient-self-view-gateway' } };
  assert.equal((await f.reader.authorize(grantInput)).scope.ownershipRevision, first.scope.ownershipRevision);
  f.map.actors[0].objectId = guid(6); f.save();
  assert.equal((await f.reader.authorize(f.input)).decision, 'DENIED');
  assert.notEqual((await f.reader.authorize(grantInput)).scope.ownershipRevision, first.scope.ownershipRevision);
  writeFileSync(f.file, 'invalid');
  assert.equal((await f.reader.authorize(grantInput)).statusCode, 503);
});

test('map change during DB snapshot rejects the in-flight decision', async t => {
  const f = fixture(t);
  f.reader.pool.query = async () => { f.map.actors[0].objectId = guid(6); f.save(); return { rows: [f.row] }; };
  assert.equal((await f.reader.authorize(f.input)).decision, 'DENIED');
});

test('transaction keeps ownership FK, stores authenticated actor and audits that actor', async t => {
  const f = fixture(t), scope = (await f.reader.authorize(f.input)).scope;
  const client = new EventEmitter(), calls = []; client.release = () => {};
  client.query = async q => { calls.push(q); return { rows: [f.row] }; };
  let audit;
  const repo = new PatientSelfViewGrantRepository({ pool: { connect: async () => client }, enabled: true,
    clock: () => 1000, resolveEntraOwnership: f.resolver, appendAudit: async (_tx, event) => {
      audit = event; return { auditId: guid(3), auditSessionId: guid(2), recordHash: 'b'.repeat(64) };
    } });
  await repo.create(f.input, { grantId: guid(1), auditSessionId: guid(2), tokenHash: 'a'.repeat(64),
    ownershipRevision: scope.ownershipRevision, proofKeyThumbprint: 'a'.repeat(43), viewingGatewayId: 'hospital-b-portal',
    issuedAtMs: 1000, expiresAtMs: 301000 });
  const insert = calls.find(q => q.text.startsWith('INSERT INTO'));
  assert.equal(insert.values[2], 'synthetic-hcc-account');
  assert.equal(insert.values[14], 'synthetic-patient-hcc');
  assert.equal(audit.actorId, 'synthetic-patient-hcc');
  assert.equal(calls.at(-1).text, 'COMMIT');
});

test('live grant checks binding revision, actor, owner, expiry and revocation', async t => {
  const f = fixture(t), scope = (await f.reader.authorize(f.input)).scope;
  const claims = { sub: f.input.principal.subject, patientId: f.input.patientId, jti: guid(1),
    iss: 'highpass-control-plane', aud: 'mediq-patient-self-view-gateway', studyInstanceUid: '1.2.3',
    allowedSeriesUids: ['1.2.3.1'], cnf: { jkt: 'a'.repeat(43) }, auditSessionId: guid(2), iat: 1, exp: 301 };
  const ledger = { subject: 'synthetic-hcc-account', authenticated_subject: claims.sub, patient_id: claims.patientId,
    status: 'ACTIVE', authority_type: 'PATIENT_SELF_VIEW', permission: 'VIEW_ONLY', source_hospital_id: 'HOSP-A',
    viewing_gateway_id: 'hospital-b-portal', study_instance_uid: '1.2.3', series_instance_uid: '1.2.3.1',
    proof_key_thumbprint: claims.cnf.jkt, audit_session_id: claims.auditSessionId, issued_at: new Date(1000),
    expires_at: new Date(301000), ref_id: scope.refId, ownership_revision: scope.ownershipRevision };
  const auth = new PatientSelfViewAuthorization({ pool: { query: async () => ({ rows: [ledger] }) },
    authority: f.reader, sourceHospitalId: 'HOSP-A', clock: () => 1000 });
  assert.ok(await auth.readLive(claims, 'hash'));
  for (const patch of [{ subject: 'foreign' }, { authenticated_subject: 'other' }, { status: 'REVOKED' },
    { expires_at: new Date(1000) }]) {
    const original = { ...ledger }; Object.assign(ledger, patch);
    assert.equal(await auth.readLive(claims, 'hash'), null); Object.assign(ledger, original);
  }
  f.map.actors[0].objectId = guid(6); f.save();
  assert.equal(await auth.readLive(claims, 'hash'), null);
});
