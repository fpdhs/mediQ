// Consume one exact, fresh A Gateway receipt through the authenticated catalog route.
import https from 'node:https';
import { readFileSync } from 'node:fs';

const ORIGIN = 'https://192.168.111.149:9443';
const DATASET = 'SYNTHETIC_HONG_GILDONG_56_CT_20261010_V1';
const PATIENT = 'MEDIQ-SYN-HCC-001';
const MANIFEST = 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721';
const fail = code => { throw new Error(code); };

async function input() {
  let raw = '';
  for await (const chunk of process.stdin) {
    raw += chunk.toString('utf8');
    if (raw.length > 4096) fail('INPUT_LIMIT');
  }
  const value = JSON.parse(raw);
  if (typeof value.presenterKey !== 'string' || value.presenterKey.length < 32 || value.presenterKey.length > 128
    || !/^audit_[a-f0-9]{16}$/.test(value.receiptId ?? '')
    || !/^[a-f0-9]{64}$/.test(value.proofSha256 ?? '')
    || !Number.isFinite(Date.parse(value.expiresAt)) || Date.now() >= Date.parse(value.expiresAt)) fail('INPUT_INVALID_OR_RECEIPT_EXPIRED');
  return value;
}

function request(route, payload, bearer = null) {
  return new Promise((resolve, reject) => {
    const body = payload === null ? null : Buffer.from(JSON.stringify(payload));
    const request = https.request(new URL(route, ORIGIN), {
      method: body ? 'POST' : 'GET', ca: readFileSync('tmp/certs/mtls/ca.crt'),
      rejectUnauthorized: true, minVersion: 'TLSv1.2', timeout: 8000,
      headers: {
        origin: ORIGIN,
        ...(body ? { 'content-type': 'application/json', 'content-length': body.length } : {}),
        ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      },
    }, response => {
      let size = 0;
      const chunks = [];
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 65536) request.destroy(new Error('RESPONSE_LIMIT'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        try { resolve({ status: response.statusCode, cache: response.headers['cache-control'], body: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); }
        catch { reject(new Error('RESPONSE_INVALID')); }
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('HTTP_DEADLINE')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

let credentials;
let accessToken;
try {
  credentials = await input();
  const initial = await request('/api/capstone-demo/scenario', null);
  if (initial.status !== 200 || initial.body.mainScenario !== false || initial.body.synthetic !== true) fail('CONTROL_BASELINE_UNEXPECTED');
  const login = await request('/api/capstone-demo/login', { key: credentials.presenterKey, entryRole: 'PATIENT' });
  credentials.presenterKey = '';
  if (login.status !== 200 || typeof login.body.profiles?.SECURITY_ADMIN !== 'string') fail('CAPSTONE_ADMIN_LOGIN_FAILED');
  accessToken = login.body.profiles.SECURITY_ADMIN;
  const registration = await request('/api/capstone-demo/hcc-catalog',
    { datasetId: DATASET, receiptId: credentials.receiptId }, accessToken);
  accessToken = null;
  const data = registration.body;
  if (registration.status !== 200 || registration.cache !== 'no-store'
    || data.registrationCommitAcknowledged !== true || data.patientId !== PATIENT
    || data.sourceHospitalId !== 'HOSP-A' || data.studyCount !== 1 || data.seriesCount !== 1
    || data.instanceCount !== 700 || data.sourceVerification !== 'AUTHENTICATED_GATEWAY_RAW_HASH_REPORT'
    || data.sourceReceiptId !== credentials.receiptId || data.sourceProofSha256 !== credentials.proofSha256
    || data.manifestSha256 !== MANIFEST || data.consentIssued !== false || data.clinicalUseAllowed !== false) {
    fail('FIXED_RECEIPT_BOUND_CATALOG_RESPONSE_INVALID');
  }
  const committed = await request('/api/capstone-demo/scenario', null);
  if (committed.status !== 200 || committed.body.catalogRegistered !== true || committed.body.mainScenario !== false) fail('CATALOG_COMMIT_READBACK_FAILED');
  console.log(JSON.stringify({ status: 'PASS', scope: 'AUTHENTICATED_FIXED_RECEIPT_CATALOG_METADATA_ONLY',
    patientId: PATIENT, sourceHospitalId: 'HOSP-A', studyCount: 1, seriesCount: 1, instanceCount: 700,
    manifestSha256: MANIFEST, sourceReceiptId: credentials.receiptId, sourceProofSha256: credentials.proofSha256,
    addedStudies: data.addedStudies, registrationCommitAcknowledged: true,
    catalogCommittedReadBack: true, patientOwnership: data.patientOwnership,
    consentIssued: false, clinicalUseAllowed: false }));
} catch {
  console.log(JSON.stringify({ status: 'NOT VERIFIED', reason: 'RECONCILE_RECEIPT_AND_CATALOG_BEFORE_RETRY' }));
  process.exitCode = 2;
} finally {
  if (credentials) credentials.presenterKey = '';
  credentials = null;
  accessToken = null;
}
