// Operator-only, read-only synthetic PACS verification inside an existing gateway.
// No image bytes, credentials, patient tags or authorization tokens are emitted.
import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const expected = JSON.parse(process.env.HIPASS_REBOOT_SYNTHETIC_EXPECTED);
const role = process.env.HIPASS_REBOOT_ROLE;
if (!['A', 'B'].includes(role) || expected.count !== 700 || expected.clinicalUse !== false) {
  throw Error('FIXED_SYNTHETIC_PROFILE_REQUIRED');
}
const sha = data => createHash('sha256').update(data).digest('hex');
const certRoot = role === 'A' ? '/run/secrets' : '/run/recovery';
const tls = role === 'A' ? {
  hostname: 'orthanc-mtls', servername: 'hospital-a-orthanc-mtls', port: 8443,
  rejectUnauthorized: true, ca: readFileSync(`${certRoot}/ca.crt`),
  cert: readFileSync(`${certRoot}/gateway-client.crt`), key: readFileSync(`${certRoot}/gateway-client.key`),
} : null;

function request(options, body) {
  return new Promise((resolve, reject) => {
    const transport = options.protocol === 'http:' ? http : https;
    const req = transport.request({ ...options, timeout: 10000 }, response => {
      let bytes = 0;
      const chunks = [];
      response.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 16 * 1024 * 1024) req.destroy(Error('RESPONSE_LIMIT'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(Error('REQUEST_TIMEOUT')));
    req.end(body);
  });
}

const checks = [];
try {
  if (role === 'A') {
    const base = `/dicom-web/studies/${expected.studyUid}/series/${expected.seriesUid}/instances`;
    const inventory = await request({ ...tls, path: base, headers: { accept: 'application/dicom+json' } });
    if (inventory.status !== 200) throw Error('QIDO_FAILED');
    const uids = JSON.parse(inventory.body).map(row => row['00080018']?.Value?.[0]);
    if (uids.length !== expected.count || new Set(uids).size !== expected.count || sha(JSON.stringify(uids.sort())) !== expected.uidListSha256) {
      throw Error('SYNTHETIC_INVENTORY_MISMATCH');
    }
    checks.push({ test: 'SOURCE_MTLS_QIDO_700_UIDS', status: 'PASS', count: uids.length });
    for (const sample of expected.samples) {
      const response = await request({ ...tls, path: `${base}/${sample.uid}`, headers: { accept: 'multipart/related; type="application/dicom"' } });
      if (response.status !== 200) throw Error('SOURCE_WADO_FAILED');
      let raw = response.body;
      if ((response.headers['content-type'] ?? '').startsWith('multipart/')) {
        const boundary = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(response.headers['content-type']);
        if (!boundary) throw Error('WADO_BOUNDARY_MISSING');
        const start = raw.indexOf(Buffer.from('\r\n\r\n')) + 4;
        const end = raw.indexOf(Buffer.from(`\r\n--${boundary[1] ?? boundary[2]}`), start);
        if (start < 4 || end <= start) throw Error('WADO_BODY_INVALID');
        raw = raw.subarray(start, end);
      }
      if (raw.length !== sample.bytes || sha(raw) !== sample.sha256) throw Error('SOURCE_RAW_HASH_MISMATCH');
      checks.push({ test: `SOURCE_RAW_HASH_SLICE_${sample.number}`, status: 'PASS', bytes: raw.length });
    }
  } else {
    // Maintenance inventory stays on the existing private PACS network.
    const query = JSON.stringify({ Level: 'Instance', Query: { StudyInstanceUID: expected.studyUid }, Expand: true });
    const response = await request({ protocol: 'http:', hostname: 'b-orthanc', port: 8042, path: '/tools/find', method: 'POST',
      headers: { 'content-type': 'application/json' } }, query);
    if (response.status !== 200) throw Error('RECEIVER_FIND_FAILED');
    const rows = JSON.parse(response.body);
    const uids = rows.map(row => row.MainDicomTags?.SOPInstanceUID);
    if (uids.some(uid => typeof uid !== 'string')) throw Error('RECEIVER_UIDS_INVALID');
    if (uids.length > expected.count || new Set(uids).size !== uids.length) throw Error('RECEIVER_INVENTORY_INVALID');
    const complete = uids.length === expected.count && sha(JSON.stringify([...uids].sort())) === expected.uidListSha256;
    checks.push({ test: 'RECEIVER_EXISTING_FIXED_STUDY_INVENTORY', status: 'PASS', count: uids.length,
      full700Present: complete, full700Transfer: complete ? 'PASS' : 'NOT VERIFIED' });
    const rawHashes = [];
    // Operator reads stay inside the existing isolated receiver network.
    for (const sample of expected.samples) {
      const matches = rows.filter(row => row.MainDicomTags?.SOPInstanceUID === sample.uid);
      if (matches.length !== 1) continue;
      const raw = await request({ protocol: 'http:', hostname: 'b-orthanc', port: 8042, path: `/instances/${matches[0].ID}/file` });
      const good = raw.status === 200 && raw.body.length === sample.bytes && sha(raw.body) === sample.sha256;
      checks.push({ test: `RECEIVER_RAW_HASH_SLICE_${sample.number}`, status: good ? 'PASS' : 'FAIL', bytes: raw.body.length });
    }
    // A receiving PACS may legitimately hold only previously approved instances.
    // Return only synthetic identifiers and digests for comparison with the local manifest.
    for (const row of rows.slice(0, 3)) {
      const raw = await request({ protocol: 'http:', hostname: 'b-orthanc', port: 8042, path: `/instances/${row.ID}/file` });
      if (raw.status !== 200) throw Error('RECEIVER_EXISTING_RAW_READ_FAILED');
      rawHashes.push({ uid: row.MainDicomTags.SOPInstanceUID, bytes: raw.body.length, sha256: sha(raw.body) });
    }
    checks.push({ test: 'RECEIVER_EXISTING_RAW_HASHES', status: 'PASS', rawHashes, inventorySopUids: uids });
  }
  console.log(JSON.stringify({ role, checks, status: checks.every(check => check.status === 'PASS') ? 'PASS' : 'FAIL', clinicalUse: false }));
  if (checks.some(check => check.status !== 'PASS')) process.exitCode = 1;
} catch (error) {
  console.log(JSON.stringify({ role, status: 'FAIL', reason: /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'PACS_READ_FAILED', checks }));
  process.exitCode = 1;
}
