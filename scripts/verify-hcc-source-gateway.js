// One-off within A Gateway. Reads PACS via mTLS, sends metadata proof only;
// never imports/deletes DICOM, registers catalog, or grants patient access.
import { readFileSync } from 'node:fs';
import { boundedHttps, requireHttpsOrigin } from '../src/data-plane-gateway.js';
import { probeHccSource } from '../src/hcc-source-probe.js';
import { HCC_SOURCE_CONTRACT } from '../src/hcc-source-contract.js';
const required = name => { if (!process.env[name]) throw new Error(`${name}_REQUIRED`); return process.env[name]; };
const file = name => readFileSync(required(name));
let stage = 'CONFIGURATION';
let rawFileCount = 0;
try {
  const manifest = JSON.parse(file('HCC_SOURCE_MANIFEST_FILE').toString('utf8'));
  const token = file('HCC_SOURCE_SERVICE_TOKEN_FILE').toString('utf8').trim();
  if (Buffer.byteLength(token) < 32 || /[\r\n]/.test(token)) throw new Error('HCC_SOURCE_CREDENTIAL_INVALID');
  const controlOrigin = requireHttpsOrigin(required('DATA_PLANE_CONTROL_ORIGIN'));
  const orthancOrigin = requireHttpsOrigin(required('DATA_PLANE_ORTHANC_ORIGIN'));
  const controlTls = { ca: file('DATA_PLANE_CONTROL_CA_FILE') };
  const orthancTls = { ca: file('DATA_PLANE_ORTHANC_CA_FILE'), cert: file('DATA_PLANE_ORTHANC_CERT_FILE'),
    key: file('DATA_PLANE_ORTHANC_KEY_FILE'), servername: required('DATA_PLANE_ORTHANC_SERVERNAME') };
  const control = async (path, input) => {
    stage = path.endsWith('/challenge') ? 'CONTROL_CHALLENGE' : 'CONTROL_REPORT';
    const result = await boundedHttps(controlOrigin, path, { tls: controlTls, method: 'POST', timeoutMs: 10000,
      maxBytes: 4096, headers: { 'content-type': 'application/json', 'x-hipass-service-token': token }, body: JSON.stringify(input) });
    if (result.status !== 200) throw new Error('HCC_CONTROL_PROOF_REJECTED');
    return JSON.parse(result.body.toString('utf8'));
  };
  const challenge = await control('/gateway/hcc-source/challenge', { datasetId: HCC_SOURCE_CONTRACT.datasetId });
  if (typeof challenge.challengeId !== 'string' || !/^hcc-source-[a-f0-9-]{36}$/.test(challenge.challengeId)
    || Object.entries(HCC_SOURCE_CONTRACT).some(([k, v]) => challenge[k] !== v)) throw new Error('HCC_CONTROL_CHALLENGE_INVALID');
  const report = await probeHccSource({ manifest, request: (path, options) => {
    stage = path.endsWith('/file') ? 'PACS_RAW_HASH' : path.startsWith('/dicom-web/') ? 'PACS_QIDO' : 'PACS_RESOURCE';
    if (stage === 'PACS_RAW_HASH') rawFileCount += 1;
    return boundedHttps(orthancOrigin, path, {
    ...options, tls: orthancTls, maxBytes: 8 * 1024 * 1024, headers: {
      accept: path.startsWith('/dicom-web/') ? 'application/dicom+json' : path.endsWith('/file') ? 'application/dicom' : 'application/json',
      'content-type': 'application/json' } }); } });
  const receipt = await control('/gateway/hcc-source/report', { challengeId: challenge.challengeId, ...report });
  console.log(JSON.stringify({ status: 'PASS', scope: 'AUTHENTICATED_SOURCE_REPORT_ONLY', ...receipt,
    instanceCount: report.instanceCount, seriesCount: report.seriesCount,
    verification: 'AUTHENTICATED_GATEWAY_RAW_HASH_REPORT',
    registered: false, deployed: false, clinicalUse: false }));
} catch (error) {
  // Do not print exception objects, TLS material, endpoint credentials or tokens.
  const reason = /^HCC_[A-Z_]+$/.test(error?.message ?? '') ? error.message
    : ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID'].includes(error?.code)
      ? error.code : 'SANITIZED_TRANSPORT_OR_RUNTIME_FAILURE';
  console.error(JSON.stringify({ status: 'FAIL', scope: 'HCC_SOURCE_VERIFICATION', error: 'SOURCE_PROOF_NOT_COMPLETED', stage, rawFileCount, reason }));
  process.exitCode = 1;
}
