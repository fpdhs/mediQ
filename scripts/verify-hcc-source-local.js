// Disposable local PostgreSQL + real fixed local bytes. NOT live PACS/TLS/browser evidence.
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import pg from 'pg';
import { PostgresStore } from '../src/postgres-store.js';
import { HipassService } from '../src/services.js';
import { probeHccSource } from '../src/hcc-source-probe.js';
import { issueHccChallenge, acceptHccReport } from '../src/hcc-source-verification.js';
import { registerHccCatalog, HCC_DATASET_ID } from '../src/capstone-hcc-catalog.js';
import { fixture, source, gatewayPrincipal } from '../test/helpers/hcc-source-fixture.js';
const name = `hp-hcc-source-${randomBytes(8).toString('hex')}`, password = randomBytes(32).toString('hex'), appPassword = randomBytes(32).toString('hex');
const started = Date.now(), checks = []; let ownedId, client, store, child, failure, cleanup = false;
const docker = args => new Promise((resolve, reject) => {
  const child = spawn('docker', args, { windowsHide: true, env: { ...process.env, POSTGRES_PASSWORD: password }, stdio: ['ignore','pipe','pipe'] });
  let output = ''; const timer = setTimeout(() => { child.kill(); reject(new Error('DOCKER_TIMEOUT')); }, 30000);
  child.stdout.on('data', x => { output += x; if (output.length > 65536) child.kill(); }); child.stderr.resume();
  child.on('error', e => { clearTimeout(timer); reject(e); });
  child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(output.trim()) : reject(new Error('DOCKER_FAILED')); });
});
try {
  const root = path.resolve('artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010');
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  const mock = source(), ids = manifest.instances.map((_, i) => (i + 1).toString(16)), byId = new Map(ids.map((id, i) => [id, manifest.instances[i]]));
  const qido = async rows => ({ status: 200, body: Buffer.from(JSON.stringify(rows)) });
  const transport = async (route, options) => {
    if (route.startsWith('/dicom-web/studies?')) return qido((await mock.qidoStudies(manifest.studyInstanceUID)).body);
    if (route.endsWith('/series')) return qido((await mock.qidoSeries(manifest.studyInstanceUID)).body);
    if (route.startsWith('/dicom-web/') && route.endsWith('/instances')) return qido(manifest.instances.map(x => ({
      '0020000D': { Value: [manifest.studyInstanceUID] }, '0020000E': { Value: [manifest.seriesInstanceUID] }, '00080018': { Value: [x.sopInstanceUID] } })));
    if (route === '/tools/find') { assert.equal(options.method, 'POST'); return qido(['abcd']); }
    if (route === '/series/abcd') return qido({ MainDicomTags: { SeriesInstanceUID: manifest.seriesInstanceUID }, Instances: ids });
    const match = route.match(/^\/instances\/([a-f0-9]+)(\/file)?$/), row = byId.get(match?.[1]); assert.ok(row);
    if (!match[2]) return qido({ MainDicomTags: { SOPInstanceUID: row.sopInstanceUID } });
    const filename = path.resolve(root, row.file); assert.ok(filename.startsWith(root + path.sep));
    return { status: 200, body: await readFile(filename) };
  };
  const report = await probeHccSource({ manifest, request: transport, deadlineMs: 60000 });
  checks.push('LOCAL_REAL_700_DICOM_BYTES_HASHED_PINNED_INVENTORY');
  await assert.rejects(probeHccSource({ manifest, request: async (route, options) => {
    const result = await transport(route, options);
    if (route.endsWith('/file')) { result.body = Buffer.from(result.body); result.body[256] ^= 1; }
    return result;
  } }), /HCC_PACS_RAW_HASH_MISMATCH/);
  await assert.rejects(probeHccSource({ manifest, request: async () => ({ status: 503 }) }), /HCC_PACS_RESPONSE_UNAVAILABLE/);
  checks.push('RAW_BYTE_CORRUPTION_REJECTED_AND_PACS_OUTAGE_NOT_POLICY_DENY');
  const image = await docker(['image','inspect','postgres:16-alpine','--format','{{.Id}}']); assert.match(image, /^sha256:[a-f0-9]{64}$/);
  ownedId = await docker(['run','--rm','-d','--name',name,'--label',`highpass.hcc-source-owner=${name}`, '--tmpfs','/var/lib/postgresql/data:rw,size=256m',
    '-e','POSTGRES_PASSWORD','-p','127.0.0.1::5432',image]);
  const port = Number(await docker(['inspect',ownedId,'--format','{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}']));
  const config = { host: '127.0.0.1', port, database: 'postgres', user: 'postgres', password, connectionTimeoutMillis: 1500, query_timeout: 6000, statement_timeout: 5000 };
  const end = Date.now() + 45000;
  while (!client && Date.now() < end) {
    const c = new pg.Client(config); c.on('error', () => {});
    try { await c.connect(); await c.query('SELECT 1'); client = c; }
    catch { await c.end().catch(() => {}); await new Promise(r => setTimeout(r, 200)); }
  }
  assert.ok(client, 'DB_READINESS');
  const ddl = (await client.query("SELECT format('CREATE ROLE hcc_test_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD %L',$1::text) AS ddl", [appPassword])).rows[0].ddl;
  await client.query(ddl); await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE,CREATE ON SCHEMA public TO hcc_test_app');
  const uri = `postgresql://hcc_test_app:${appPassword}@127.0.0.1:${port}/postgres`;
  store = new PostgresStore(uri); await store.load();
  const env = fixture().env, service = new HipassService(store), args = { service, env, principal: gatewayPrincipal };
  const challenge = await issueHccChallenge({ ...args, input: { datasetId: HCC_DATASET_ID } });
  const input = { challengeId: challenge.challengeId, ...report };
  const receipt = await acceptHccReport({ ...args, input });
  await store.close(); store = new PostgresStore(uri); await store.load();
  const reloaded = new HipassService(store);
  await assert.rejects(acceptHccReport({ ...args, service: reloaded, input }), e => e.code === 'HCC_SOURCE_REPORT_REPLAY');
  checks.push('POSTGRES_RELOAD_REPORT_REPLAY_DENIED');
  const registration = { service: reloaded, env, principal: { role: 'SECURITY_ADMIN', hospitalId: 'HOSP-A', actorId: 'synthetic-source-admin' },
    input: { datasetId: HCC_DATASET_ID, receiptId: receipt.receiptId } };
  const result = await registerHccCatalog(registration); assert.equal(result.instanceCount, 700);
  await store.close(); store = new PostgresStore(uri); await store.load();
  const finalService = new HipassService(store); assert.equal(finalService.verifyAuditIntegrity().ok, true);
  await assert.rejects(registerHccCatalog({ ...registration, service: finalService }), e => e.code === 'HCC_SOURCE_RECEIPT_USED');
  const stored = (await client.query("SELECT action FROM audit_logs WHERE audit_session_id=$1 ORDER BY created_at,audit_id", [challenge.challengeId])).rows;
  assert.equal(stored.length, 3); assert.equal(store.get('imagingStudies').filter(x => x.patientId === 'MEDIQ-SYN-HCC-001').length, 1);
  checks.push('POSTGRES_CATALOG_ATOMIC_AUDIT_RELOAD_RECEIPT_REUSE_DENIED');
  await store.close(); store = undefined;
  const reservation = createServer(); await new Promise(r => reservation.listen(0, '127.0.0.1', r));
  const apiPort = reservation.address().port; await new Promise(r => reservation.close(r));
  const sourceToken = randomBytes(32).toString('hex'), dataToken = randomBytes(32).toString('hex');
  child = spawn(process.execPath, ['src/server.js'], { windowsHide: true, stdio: ['ignore','ignore','pipe'],
    env: { ...process.env, ...env, DATABASE_URL: uri, PORT: String(apiPort), HIPASS_LISTEN_HOST: '127.0.0.1',
      HIPASS_CAPSTONE_PATIENT_GRANTS: '0', HIPASS_CAPSTONE_KEY_RELEASE: '0', HIPASS_CAPSTONE_PATIENT_KEY_RELEASE: '0',
      HIPASS_HCC_SOURCE_GATEWAY_TOKEN: sourceToken, HIPASS_DATA_PLANE_SERVICE_TOKEN: dataToken, HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID: 'HOSP-A',
      HIPASS_DATA_PLANE_PUBLIC_BASE_URL: 'https://example.invalid', HIPASS_PUBLIC_BASE_URL: 'https://example.invalid',
      DICOM_TOKEN_SECRET: randomBytes(32).toString('hex'), TEST_JWT_SECRET: randomBytes(32).toString('hex'),
      HIPASS_CAPSTONE_LOGIN_KEY: randomBytes(32).toString('hex'), HIPASS_INGRESS_SECRET: randomBytes(32).toString('hex'),
      HIPASS_DPOP_REQUIRED: '1', JWT_ISSUER: 'highpass-capstone-test-idp', JWT_AUDIENCE: 'highpass-capstone-api', HIPASS_ENABLE_CURATED_DICOM: '0' } });
  child.stderr.resume();
  const base = `http://127.0.0.1:${apiPort}`, readyEnd = Date.now() + 45000; let ready = false;
  while (!ready && Date.now() < readyEnd) {
    if (child.exitCode !== null) throw new Error('CONTROL_EXITED');
    try { ready = (await fetch(base + '/api/health', { signal: AbortSignal.timeout(1500) })).status === 200; } catch {}
    if (!ready) await new Promise(r => setTimeout(r, 200));
  }
  assert.ok(ready);
  const post = (route, body, token = sourceToken) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json',
    ...(token ? { 'x-hipass-service-token': token } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
  const challengePath = '/gateway/hcc-source/challenge', reportPath = '/gateway/hcc-source/report';
  assert.equal((await post(challengePath, { datasetId: HCC_DATASET_ID }, null)).status, 401);
  assert.equal((await post(challengePath, { datasetId: HCC_DATASET_ID }, dataToken)).status, 403);
  const httpChallengeResponse = await post(challengePath, { datasetId: HCC_DATASET_ID }); assert.equal(httpChallengeResponse.status, 200);
  const httpChallenge = await httpChallengeResponse.json(), httpInput = { challengeId: httpChallenge.challengeId, ...report };
  assert.equal((await post(reportPath, { ...httpInput, instanceCount: 699 })).status, 400);
  const accepted = await post(reportPath, httpInput); assert.equal(accepted.status, 200);
  assert.equal(accepted.headers.get('cache-control'), 'no-store');
  assert.equal((await post(reportPath, httpInput)).status, 409);
  assert.equal((await post(reportPath + '?token=not-a-credential', httpInput)).status, 400);
  const httpAudit = (await client.query("SELECT action FROM audit_logs WHERE audit_session_id=$1", [httpChallenge.challengeId])).rows;
  assert.equal(httpAudit.length, 2);
  assert.ok((await client.query("SELECT count(*)::int AS n FROM audit_logs WHERE action='HCC_SOURCE_REPORT_DENIED' AND result='FAIL'")).rows[0].n >= 5);
  checks.push('ACTUAL_LOCAL_CONTROL_HTTP_AUTH_SCOPE_FIXED_REPORT_REPLAY_DENIAL_AUDIT');
} catch { failure = 'LOCAL_SOURCE_VERIFICATION_NOT_COMPLETED'; }
finally {
  if (child && child.exitCode === null) { const ended = new Promise(r => child.once('close', r)); child.kill(); await ended; }
  await store?.close().catch(() => {}); await client?.end().catch(() => {});
  if (ownedId) {
    try {
      const actual = JSON.parse(await docker(['inspect', ownedId]))[0];
      assert.equal(actual.Config.Labels['highpass.hcc-source-owner'], name); assert.equal(actual.Name, '/' + name);
      await docker(['stop','--time','5',ownedId]); cleanup = true;
    } catch { failure = 'OWNED_TEST_DB_CLEANUP_NOT_CONFIRMED'; }
  }
}
const sources = [];
for (const filename of ['src/hcc-source-contract.js','src/hcc-source-verification.js','src/hcc-source-probe.js',
  'src/capstone-hcc-catalog.js','src/auth.js','src/server.js','src/postgres-store.js','src/capstone-control-ingress.js',
  'scripts/start-capstone-control.js','scripts/verify-hcc-source-gateway.js','scripts/verify-hcc-source-local.js']) {
  sources.push({ path: filename, sha256: createHash('sha256').update(await readFile(filename)).digest('hex') });
}
const result = { status: failure ? 'FAIL' : 'PASS', scope: 'LOCAL_REAL_BYTES_AND_POSTGRES_CONTRACT_NOT_VM_TLS_DEPLOYMENT_OR_BROWSER',
  observedAt: new Date().toISOString(), sources,
  review: 'DRAFT / UNASSIGNED', checks, cleanup, durationMs: Date.now() - started,
  livePacs: 'NOT VERIFIED', liveAuthenticatedGateway: 'NOT VERIFIED', deployment: 'NOT VERIFIED', ...(failure ? { error: failure } : {}) };
const directory = path.resolve(`artifacts/workstation/hcc-source-local-${name}`); await mkdir(directory, { recursive: true });
await writeFile(path.join(directory,'result.json'), JSON.stringify(result,null,2), { flag: 'wx' });
console.log(JSON.stringify({ ...result, sources: sources.length, evidence: path.join(directory,'result.json') })); process.exitCode = failure ? 1 : 0;
