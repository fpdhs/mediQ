// One-off, A-only operator import and byte-for-byte verification for the pinned synthetic Study.
// Runs in a read-only, unprivileged container on A's internal PACS network.
import { createHash } from 'node:crypto';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import path from 'node:path';

const datasetRoot = '/dataset';
const expected = {
  studyUid: '2.25.259656708708993797343330994179169711072',
  seriesUid: '2.25.18361638789025095699746776899955737977',
  manifestSha256: 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721',
  totalBytes: 2202766342,
  instanceCount: 700,
  patientId: 'MEDIQ-SYN-HG-REF700-001',
  patientName: 'SYNTHETIC^HONG_GILDONG_56',
};
const manifest = JSON.parse(readFileSync(path.join(datasetRoot, 'manifest.json'), 'utf8'));
if (manifest.datasetType !== 'SYNTHETIC' || manifest.clinicalUse !== false || manifest.validationStatus !== 'PASS'
  || manifest.studyInstanceUID !== expected.studyUid || manifest.seriesInstanceUID !== expected.seriesUid
  || manifest.canonicalManifestSha256 !== expected.manifestSha256 || manifest.totalInstances !== expected.instanceCount
  || manifest.totalDicomBytes !== expected.totalBytes || manifest.instances?.length !== expected.instanceCount) {
  throw new Error('FIXED_SYNTHETIC_MANIFEST_MISMATCH');
}

const tls = {
  ca: readFileSync('/tmp/hcc-ca.crt'),
  cert: readFileSync('/tmp/hcc-gateway-client.crt'),
  key: readFileSync('/tmp/hcc-gateway-client.key'),
  servername: 'hospital-a-orthanc-mtls',
  rejectUnauthorized: true,
};

function getJson(pathname, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const request = https.get({ ...tls, hostname: 'orthanc-mtls', port: 8443, path: pathname,
      headers: { accept: 'application/dicom+json' }, timeout: timeoutMs }, response => {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) request.destroy(new Error('QIDO_RESPONSE_LIMIT'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error('QIDO_STATUS_' + response.statusCode));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error('QIDO_RESPONSE_INVALID')); }
      });
      response.on('error', reject);
    });
    request.on('timeout', () => request.destroy(new Error('QIDO_TIMEOUT')));
    request.on('error', reject);
  });
}

function requestOrthanc(method, pathname, sourcePath = null, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const headers = sourcePath ? { 'content-type': 'application/dicom', 'content-length': String(statSync(sourcePath).size) } : {};
    const request = http.request({ hostname: 'orthanc', port: 8042, method, path: pathname, headers, timeout: timeoutMs }, response => {
      resolve({ request, response });
    });
    request.on('timeout', () => request.destroy(new Error('ORTHANC_TIMEOUT')));
    request.on('error', reject);
    if (sourcePath) createReadStream(sourcePath).on('error', error => request.destroy(error)).pipe(request);
    else request.end();
  });
}

async function responseJson(response, request) {
  const chunks = []; let size = 0;
  for await (const chunk of response) {
    size += chunk.length;
    if (size > 65536) { request.destroy(); throw new Error('ORTHANC_JSON_RESPONSE_LIMIT'); }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function orthancJson(pathname) {
  const { response, request } = await requestOrthanc('GET', pathname, null, 30000);
  if (response.statusCode !== 200) { response.resume(); throw new Error('ORTHANC_JSON_STATUS_' + response.statusCode); }
  return responseJson(response, request);
}

async function fileSha256(record) {
  const sourcePath = path.resolve(datasetRoot, record.file);
  if (!sourcePath.startsWith(datasetRoot + path.sep) || !sourcePath.endsWith('.dcm')) throw new Error('DATASET_PATH_INVALID');
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of createReadStream(sourcePath)) { hash.update(chunk); bytes += chunk.length; }
  return { sourcePath, sha256: hash.digest('hex'), bytes };
}

async function verifyReadback(resourceId, record) {
  if (typeof resourceId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(resourceId)) throw new Error('ORTHANC_RESOURCE_ID_INVALID');
  const { response } = await requestOrthanc('GET', `/instances/${encodeURIComponent(resourceId)}/file`);
  if (response.statusCode !== 200) { response.resume(); throw new Error('ORTHANC_READBACK_STATUS_' + response.statusCode); }
  const hash = createHash('sha256'); let bytes = 0;
  for await (const chunk of response) { hash.update(chunk); bytes += chunk.length; }
  if (bytes !== record.bytes || hash.digest('hex') !== record.sha256) throw new Error('ORTHANC_RAW_DICOM_SHA256_MISMATCH');
}

const uniqueSops = new Set(); let totalBytes = 0;
const recordsBySop = new Map();
for (let index = 0; index < manifest.instances.length; index++) {
  const record = manifest.instances[index];
  if (!record.sopInstanceUID || uniqueSops.has(record.sopInstanceUID) || !/^[0-9.]+$/.test(record.sopInstanceUID)) throw new Error('INSTANCE_UID_INVENTORY_INVALID');
  uniqueSops.add(record.sopInstanceUID);
  recordsBySop.set(record.sopInstanceUID, record);
  const local = await fileSha256(record);
  if (local.bytes !== record.bytes || local.sha256 !== record.sha256) throw new Error('TRANSFERRED_DICOM_HASH_MISMATCH');
  totalBytes += local.bytes;
}
if (uniqueSops.size !== expected.instanceCount || totalBytes !== expected.totalBytes) throw new Error('FULL_HASH_INVENTORY_MISMATCH');
console.log(JSON.stringify({ phase: 'REMOTE_STAGE_FULL_SHA256', status: 'PASS', instanceCount: uniqueSops.size, bytes: totalBytes }));

// Read-only resumability guard. The only permitted existing state is a subset of
// this exact Study/Series with SOP UIDs from the manifest and byte-identical raw DICOM.
const studyRowsBefore = await getJson('/dicom-web/studies?includefield=0020000D&includefield=00100020&includefield=00100010&includefield=00080020&includefield=00081030');
if (!Array.isArray(studyRowsBefore)) throw new Error('A_PACS_QIDO_STUDY_INVENTORY_INVALID');
const studyUidsBefore = studyRowsBefore.map(row => row?.['0020000D']?.Value?.[0]);
if (studyUidsBefore.some(uid => typeof uid !== 'string') || new Set(studyUidsBefore).size !== studyUidsBefore.length
  || studyUidsBefore.some(uid => uid !== expected.studyUid)) throw new Error('A_PACS_CONTAINS_UNEXPECTED_STUDY_UID');
let existingSeriesRows = []; let existingInstanceRows = [];
if (studyUidsBefore.length === 1) {
  const studyBefore = studyRowsBefore[0];
  const value = (row, tag) => row?.[tag]?.Value?.[0];
  const textValue = (row, tag) => {
    const field = value(row, tag);
    return typeof field === 'string' ? field : typeof field?.Alphabetic === 'string' ? field.Alphabetic : null;
  };
  const metadataMatches = {
    studyUid: value(studyBefore, '0020000D') === expected.studyUid,
    patientId: value(studyBefore, '00100020') === expected.patientId,
    patientName: textValue(studyBefore, '00100010') === expected.patientName,
    studyDate: value(studyBefore, '00080020') === '20261010',
    syntheticDescription: value(studyBefore, '00081030') == null
      || value(studyBefore, '00081030') === 'SYNTHETIC CT DEMO - NOT FOR CLINICAL USE',
  };
  console.log(JSON.stringify({ phase: 'A_PACS_EXISTING_STUDY_METADATA_CHECK', status: Object.values(metadataMatches).every(Boolean) ? 'PASS' : 'FAIL', checks: metadataMatches,
    studyDescriptionReturnedByQido: value(studyBefore, '00081030') != null }));
  if (Object.values(metadataMatches).some(match => !match)) {
    throw new Error('A_PACS_EXISTING_STUDY_METADATA_MISMATCH');
  }
  existingSeriesRows = await getJson(`/dicom-web/studies/${expected.studyUid}/series`);
  existingInstanceRows = await getJson(`/dicom-web/studies/${expected.studyUid}/instances`);
  const existingSeriesUids = existingSeriesRows.map(row => row?.['0020000E']?.Value?.[0]);
  const existingSops = existingInstanceRows.map(row => row?.['00080018']?.Value?.[0]);
  if (existingSeriesRows.length !== 1 || existingSeriesUids[0] !== expected.seriesUid
    || existingSops.some(uid => typeof uid !== 'string' || !recordsBySop.has(uid))
    || new Set(existingSops).size !== existingSops.length) throw new Error('A_PACS_EXISTING_STUDY_NOT_EXACT_SUBSET');
}
const qidoSops = existingInstanceRows.map(row => row?.['00080018']?.Value?.[0]);
const orthancAllIds = await orthancJson('/instances');
const orthancInventoryMatches = Array.isArray(orthancAllIds) && orthancAllIds.length === qidoSops.length
  && orthancAllIds.every(id => typeof id === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(id));
console.log(JSON.stringify({ phase: 'A_PACS_ORTHANC_QIDO_INVENTORY_CHECK', status: orthancInventoryMatches ? 'PASS' : 'FAIL',
  orthancResponseIsArray: Array.isArray(orthancAllIds), orthancResourceCount: Array.isArray(orthancAllIds) ? orthancAllIds.length : null,
  qidoInstanceCount: qidoSops.length, orthancIdFormatValid: Array.isArray(orthancAllIds) && orthancAllIds.every(id => typeof id === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(id)) }));
if (!orthancInventoryMatches) throw new Error('A_PACS_ORTHANC_QIDO_INVENTORY_MISMATCH');
const orthancIds = new Map();
for (const resourceId of orthancAllIds) {
  const instance = await orthancJson(`/instances/${encodeURIComponent(resourceId)}`);
  const sopUid = instance?.MainDicomTags?.SOPInstanceUID;
  const record = recordsBySop.get(sopUid);
  if (!record || orthancIds.has(sopUid) || !instance.ParentSeries) throw new Error('A_PACS_ORTHANC_INSTANCE_NOT_IN_MANIFEST');
  const series = await orthancJson(`/series/${instance.ParentSeries}`);
  if (series?.MainDicomTags?.SeriesInstanceUID !== expected.seriesUid || !series.ParentStudy) throw new Error('A_PACS_ORTHANC_SERIES_UID_MISMATCH');
  const study = await orthancJson(`/studies/${series.ParentStudy}`);
  if (study?.MainDicomTags?.StudyInstanceUID !== expected.studyUid) throw new Error('A_PACS_ORTHANC_STUDY_UID_MISMATCH');
  await verifyReadback(resourceId, record);
  orthancIds.set(sopUid, resourceId);
}
if (orthancIds.size !== qidoSops.length || qidoSops.some(uid => !orthancIds.has(uid))) throw new Error('A_PACS_ORTHANC_QIDO_SOP_SET_MISMATCH');
console.log(JSON.stringify({ phase: 'A_PACS_EXISTING_SUBSET_RAW_SHA256', status: 'PASS', verifiedExistingInstances: orthancIds.size }));

for (let index = 0; index < manifest.instances.length; index++) {
  const record = manifest.instances[index];
  if (orthancIds.has(record.sopInstanceUID)) continue;
  const sourcePath = path.resolve(datasetRoot, record.file);
  const { response, request } = await requestOrthanc('POST', '/instances', sourcePath);
  const reply = await responseJson(response, request);
  if (![200, 201].includes(response.statusCode) || reply.Status !== 'Success' || !reply.ID || orthancIds.has(record.sopInstanceUID)) {
    throw new Error('A_PACS_IMPORT_STOPPED_NO_AUTOMATIC_ROLLBACK');
  }
  await verifyReadback(reply.ID, record);
  orthancIds.set(record.sopInstanceUID, reply.ID);
  if ((index + 1) % 25 === 0 || index + 1 === manifest.instances.length) {
    console.log(JSON.stringify({ phase: 'A_ONLY_IMPORT_AND_RAW_READBACK', status: 'RUNNING', verified: index + 1, total: expected.instanceCount }));
  }
}

const studyRows = await getJson(`/dicom-web/studies?StudyInstanceUID=${encodeURIComponent(expected.studyUid)}&includefield=00100020&includefield=00100010&includefield=00080020&includefield=00081030`);
const seriesRows = await getJson(`/dicom-web/studies/${expected.studyUid}/series`);
const instanceRows = await getJson(`/dicom-web/studies/${expected.studyUid}/instances`);
const value = (row, tag) => row?.[tag]?.Value?.[0];
const textValue = (row, tag) => {
  const field = value(row, tag);
  return typeof field === 'string' ? field : typeof field?.Alphabetic === 'string' ? field.Alphabetic : null;
};
const actualSops = instanceRows.map(row => value(row, '00080018'));
const actualSeries = seriesRows.map(row => value(row, '0020000E'));
const expectedSopSet = new Set(manifest.instances.map(row => row.sopInstanceUID));
if (studyRows.length !== 1 || value(studyRows[0], '0020000D') !== expected.studyUid
  || value(studyRows[0], '00100020') !== expected.patientId || textValue(studyRows[0], '00100010') !== expected.patientName
  || value(studyRows[0], '00080020') !== '20261010'
  || (value(studyRows[0], '00081030') != null && value(studyRows[0], '00081030') !== 'SYNTHETIC CT DEMO - NOT FOR CLINICAL USE')
  || actualSeries.length !== 1 || actualSeries[0] !== expected.seriesUid
  || actualSops.length !== expected.instanceCount || new Set(actualSops).size !== expected.instanceCount
  || actualSops.some(uid => !expectedSopSet.has(uid)) || actualSops.some(uid => !orthancIds.has(uid))) throw new Error('A_PACS_MTLS_QIDO_POST_IMPORT_MISMATCH');

console.log(JSON.stringify({ status: 'PASS', scope: 'HOSPITAL_A_TEST_ORTHANC_ONLY', operation: 'SYNTHETIC_STUDY_IMPORT_AND_FULL_RAW_BYTE_READBACK',
  studyCount: 1, seriesCount: actualSeries.length, instanceCount: orthancIds.size, rawReadbackSha256Matches: orthancIds.size,
  bytes: totalBytes, manifestSha256: expected.manifestSha256, mTLSQido: 'PASS', destinationB: 'NOT TOUCHED', review: 'DRAFT / UNASSIGNED' }));
