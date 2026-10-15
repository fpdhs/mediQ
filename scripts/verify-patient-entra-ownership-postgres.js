// Isolated, disposable synthetic DB only. Never uses a deployed connection URL.
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PatientSelfViewAuthorityReader } from '../src/patient-self-view-authority.js';
import { PatientSelfViewGrantRepository } from '../src/patient-self-view-grant-repository.js';
import { PatientSelfViewAuthorization } from '../src/patient-self-view-authorization.js';

const name = `hp-entra-owner-${randomUUID()}`, password = randomBytes(32).toString('hex');
const env = { ...process.env, POSTGRES_PASSWORD: password };
const docker = args => execFileSync('docker', args, { env, encoding: 'utf8', timeout: 15000,
  stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true }).trim();
let id, admin, pool;
let stage = 'startup', failureCode;
try {
  id = docker(['run', '-d', '--name', name, '--label', `highpass.ownership-probe=${name}`, '-e', 'POSTGRES_PASSWORD',
    '-p', '127.0.0.1::5432', 'postgres:16-alpine']);
  const port = JSON.parse(docker(['inspect', id]))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
  stage = 'readiness';
  const deadline = Date.now() + 45000;
  while (!admin && Date.now() < deadline) {
    const candidate = new pg.Client({ host: '127.0.0.1', port, user: 'postgres', password,
      database: 'postgres', connectionTimeoutMillis: 1500, query_timeout: 5000 });
    candidate.on('error', () => {});
    try { await candidate.connect(); await candidate.query('SELECT 1'); admin = candidate; }
    catch { await candidate.end().catch(() => {}); await new Promise(r => setTimeout(r, 300)); }
  }
  assert.ok(admin, 'DB_START_TIMEOUT'); stage = 'schema';
  await admin.query(`CREATE TABLE patients(patient_id text PRIMARY KEY);
    CREATE TABLE hospitals(hospital_id text PRIMARY KEY,status text);
    CREATE TABLE imaging_studies(study_instance_uid text PRIMARY KEY,patient_id text,source_hospital_id text);
    CREATE TABLE imaging_series(series_instance_uid text PRIMARY KEY,study_instance_uid text);
    CREATE TABLE probe_audit(actor_id text,grant_id uuid);
    INSERT INTO patients VALUES('MEDIQ-SYN-HCC-001'); INSERT INTO hospitals VALUES('HOSP-A','ACTIVE');
    INSERT INTO imaging_studies VALUES('1.2.3','MEDIQ-SYN-HCC-001','HOSP-A');
    INSERT INTO imaging_series VALUES('1.2.3.1','1.2.3');`);
  for (const file of ['033_capstone_patient_self_view_authority.sql','034_capstone_patient_self_view_grants.sql',
    '038_patient_entra_grant_actor.sql']) await admin.query(await readFile(new URL('../db/migrations/' + file, import.meta.url), 'utf8'));
  const ref = randomUUID();
  await admin.query("INSERT INTO capstone_patient_accounts VALUES('synthetic-hcc-account','MEDIQ-SYN-HCC-001','CAPSTONE_MOCK_IDP','ACTIVE',$1)", [randomUUID()]);
  await admin.query("INSERT INTO capstone_patient_ownership_refs VALUES($1,'synthetic-hcc-account','MEDIQ-SYN-HCC-001','1.2.3','HOSP-A','ACTIVE',1)", [ref]);
  const ddl = (await admin.query("SELECT format('CREATE ROLE hp_owner_probe LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD %L',$1::text) AS ddl", [password])).rows[0].ddl;
  await admin.query(ddl);
  await admin.query(`GRANT USAGE ON SCHEMA public TO hp_owner_probe;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO hp_owner_probe;
    GRANT INSERT ON capstone_patient_self_view_grants,probe_audit TO hp_owner_probe;
    GRANT UPDATE(patient_id) ON patients TO hp_owner_probe;
    GRANT UPDATE(status) ON hospitals TO hp_owner_probe;
    GRANT UPDATE(study_instance_uid) ON imaging_studies TO hp_owner_probe;
    GRANT UPDATE(series_instance_uid) ON imaging_series TO hp_owner_probe;
    GRANT UPDATE(evidence_kind) ON capstone_patient_accounts TO hp_owner_probe;
    GRANT UPDATE(ref_id) ON capstone_patient_ownership_refs TO hp_owner_probe;`);
  pool = new pg.Pool({ host: '127.0.0.1', port, user: 'hp_owner_probe', password, database: 'postgres', max: 2 });
  let revision = 'binding-v1';
  const resolveEntraOwnership = () => ({ ownershipSubject: 'synthetic-hcc-account', objectId: 'test-oid', issuer: 'test-issuer', audience: 'test-audience', revision });
  const input = { principal: { subject: 'synthetic-patient-hcc', patientId: 'MEDIQ-SYN-HCC-001', role: 'PATIENT',
    authMethod: 'ENTRA_OIDC_ACCESS_TOKEN', authMode: 'ENTRA_OIDC', entraObjectId: 'test-oid', issuer: 'test-issuer', audience: 'test-audience', expiresAtMs: 301000 },
    patientId: 'MEDIQ-SYN-HCC-001', studyInstanceUid: '1.2.3', seriesInstanceUid: '1.2.3.1', requestedAction: 'VIEW' };
  const authority = new PatientSelfViewAuthorityReader({ pool, enabled: true, allowIssuedGrant: true, resolveEntraOwnership, clock: () => 1000 });
  const scope = (await authority.authorize(input)).scope;
  assert.ok(scope); stage = 'transaction';
  const grant = { grantId: randomUUID(), auditSessionId: randomUUID(), tokenHash: 'a'.repeat(64), ownershipRevision: scope.ownershipRevision,
    proofKeyThumbprint: 'a'.repeat(43), viewingGatewayId: 'hospital-b-portal', issuedAtMs: 1000, expiresAtMs: 301000 };
  const repository = new PatientSelfViewGrantRepository({ pool, enabled: true, resolveEntraOwnership, clock: () => 1000,
    appendAudit: async (tx, event) => {
      await tx.query({ text: 'INSERT INTO probe_audit VALUES($1,$2)', values: [event.actorId, event.grantId] });
      return { auditId: randomUUID(), auditSessionId: event.auditSessionId, recordHash: 'b'.repeat(64) };
    } });
  await repository.create(input, grant);
  const row = (await pool.query('SELECT subject,authenticated_subject FROM capstone_patient_self_view_grants')).rows[0];
  assert.deepEqual(row, { subject: 'synthetic-hcc-account', authenticated_subject: 'synthetic-patient-hcc' });
  assert.equal((await pool.query('SELECT actor_id FROM probe_audit')).rows[0].actor_id, 'synthetic-patient-hcc');
  assert.ok((await pool.query("SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid='capstone_patient_self_view_grants'::regclass AND contype='f'")).rows[0].n >= 2);
  stage = 'live-revalidation';
  const authorizer = new PatientSelfViewAuthorization({ pool, authority, sourceHospitalId: 'HOSP-A', clock: () => 1000 });
  const claims = { jti: grant.grantId, sub: input.principal.subject, patientId: input.patientId,
    iss: 'highpass-control-plane', aud: 'mediq-patient-self-view-gateway', studyInstanceUid: '1.2.3', allowedSeriesUids: ['1.2.3.1'],
    cnf: { jkt: grant.proofKeyThumbprint }, auditSessionId: grant.auditSessionId, iat: 1, exp: 301 };
  assert.ok(await authorizer.readLive(claims, grant.tokenHash));
  revision = 'binding-v2'; assert.equal(await authorizer.readLive(claims, grant.tokenHash), null);
  await assert.rejects(repository.create(input, { ...grant, grantId: randomUUID(), auditSessionId: randomUUID() }));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM probe_audit')).rows[0].n, 1);
  revision = 'binding-v1';
  await admin.query("UPDATE capstone_patient_accounts SET status='SUSPENDED'");
  assert.equal(await authorizer.readLive(claims, grant.tokenHash), null);
  stage = 'passed';
} catch (error) {
  failureCode = /^[A-Z0-9_]+$/.test(error.code ?? '') ? error.code : 'PROBE_FAILED';
  process.exitCode = 1;
} finally {
  await pool?.end(); await admin?.end();
  if (id) {
    const container = JSON.parse(docker(['inspect', id]))[0];
    assert.equal(container.Config.Labels['highpass.ownership-probe'], name);
    docker(['rm', '-f', '-v', id]);
  }
  console.log(JSON.stringify({ status: stage === 'passed' ? 'PASS' : 'FAIL', stage,
    scope: 'ISOLATED_POSTGRES_SYNTHETIC_BINDING_NOT_LIVE', cleanup: 'PASS', failureCode,
    fullAuditChain: 'NOT VERIFIED: transaction audit fixture only' }));
}
