import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('isolated HTTP status route authenticates patient, conceals other ownership and forbids cache', { timeout: 20000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hp-ticket-status-'));
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const child = spawn(process.execPath, ['src/server.js'], { windowsHide: true, stdio: 'ignore', env: {
    ...process.env, NODE_ENV: 'development', AUTH_MODE: 'DEVELOPMENT_MOCK', HIPASS_STORE: 'json',
    HIPASS_DB_PATH: path.join(directory, 'db.json'), PORT: String(port),
    DICOM_TOKEN_SECRET: randomBytes(32).toString('hex'), HIPASS_DPOP_REQUIRED: '0', HIPASS_INGRESS_SECRET: '',
  } });
  t.after(async () => {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise(resolve => child.once('exit', resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const patient = { 'x-hipass-role': 'PATIENT', 'x-hipass-patient-id': 'P-1001' };
  const call = async (route, headers = {}, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(3000) });
    return { status: response.status, body: await response.json(), cache: response.headers.get('cache-control') };
  };
  const deadline = Date.now() + 8000;
  while (true) {
    try { if ((await call('/api/health')).status === 200) break; } catch {}
    if (Date.now() >= deadline || child.exitCode !== null) throw new Error('ISOLATED_SERVER_UNAVAILABLE');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const consent = await call('/api/consents', patient, { patientId: 'P-1001', sourceHospitalId: 'HOSP-A', targetHospitalId: 'HOSP-B', purpose: 'TREATMENT', permission: 'VIEW_ONLY', validUntil: new Date(Date.now() + 3600000).toISOString(), scopes: [{ studyInstanceUid: '1.2.410.100.1.20260620.001' }] });
  assert.equal(consent.status, 201);
  const issued = await call(`/api/consents/${consent.body.consentId}/handoff-ticket`, patient, {});
  assert.equal(issued.status, 201);
  const route = `/api/consents/${consent.body.consentId}/handoff-tickets/${issued.body.ticketId}`;
  assert.equal((await call(route)).status, 401);
  assert.equal((await call(route, { 'x-hipass-role': 'DOCTOR', 'x-hipass-doctor-id': 'DOC-B-01', 'x-hipass-hospital-id': 'HOSP-B' })).status, 403);
  const other = await call(route, { ...patient, 'x-hipass-patient-id': 'P-1002' });
  const missing = await call(route.replace(issued.body.ticketId, 'missing-ticket'), patient);
  assert.equal(other.status, 404); assert.equal(missing.status, 404); assert.deepEqual(other.body, missing.body);
  const status = await call(route, patient);
  assert.equal(status.status, 200); assert.equal(status.cache, 'no-store'); assert.equal(status.body.status, 'ISSUED');
  assert.deepEqual(Object.keys(status.body).sort(), ['consentId', 'expiresAt', 'status', 'ticketId']);
  const issuance=`/api/consents/${consent.body.consentId}/handoff-ticket`;
  assert.equal((await call(issuance,patient,{replaceExisting:'yes'})).status,400);
  assert.equal((await call(issuance,{...patient,'x-hipass-patient-id':'P-1002'},{replaceExisting:true})).status,403);
  const replacement=await call(issuance,patient,{replaceExisting:true});
  assert.equal(replacement.status,201);assert.equal(replacement.cache,'no-store');
  assert.equal((await call(route,patient)).body.status,'REVOKED');
  const revoked = await call(`/api/consents/${consent.body.consentId}/revoke`, patient, {});
  assert.equal(revoked.status, 200); assert.equal((await call(route, patient)).body.status, 'REVOKED');
  const fresh=await call('/api/consents',patient,{patientId:'P-1001',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TREATMENT',permission:'VIEW_ONLY',validUntil:new Date(Date.now()+3600000).toISOString(),scopes:[{studyInstanceUid:'1.2.410.100.1.20260620.001'}]});
  const packet=await call(`/api/consents/${fresh.body.consentId}/handoff-ticket`,patient,{});
  assert.equal(packet.status,201);
  const nonce=new URL(packet.body.qr.payload).pathname.split('/').at(-1);
  const doctor={'x-hipass-role':'DOCTOR','x-hipass-doctor-id':'DOC-B-01','x-hipass-hospital-id':'HOSP-B'};
  const redeem='/api/transfers/tickets/redeem-viewer';
  assert.equal((await call(redeem,{}, {nonce,inputMethod:'MANUAL'})).status,401);
  assert.equal((await call(redeem,patient,{nonce,inputMethod:'MANUAL'})).status,403);
  assert.equal((await call(redeem,doctor,{nonce,inputMethod:'DEMO_IMPORT'})).status,403); // mock profile cannot enable synthetic public tool
  assert.equal((await call(redeem,doctor,{nonce,inputMethod:'MANUAL'})).body.decision,'ALLOWED');
  assert.equal((await call(redeem,doctor,{nonce,inputMethod:'MANUAL'})).body.decision,'DENIED');
  assert.equal((await call('/api/clinician/receptions')).status,401);
  assert.equal((await call('/api/clinician/receptions',patient)).status,403);
  const receipts=await call('/api/clinician/receptions',doctor);
  assert.equal(receipts.status,200,JSON.stringify(receipts.body));assert.equal(receipts.cache,'no-store');
  assert.equal(receipts.body.receptions.length,1);
  assert.equal(receipts.body.receptions[0].studies.length,1);
  assert.doesNotMatch(JSON.stringify(receipts.body),/nonceHash|accessToken|auditSessionId/);
  assert.equal((await call('/api/clinician/receptions',{'x-hipass-role':'DOCTOR','x-hipass-doctor-id':'DOC-A-01','x-hipass-hospital-id':'HOSP-A'})).body.receptions.length,0);
});
