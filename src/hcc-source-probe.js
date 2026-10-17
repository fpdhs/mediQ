import { createHash } from 'node:crypto';
import { HCC_SOURCE_CONTRACT } from './hcc-source-contract.js';
import { verifyHccSourceStudy } from './capstone-hcc-catalog.js';

// Injected transport must be the strict mTLS client. No curated/local fallback.
export async function probeHccSource({ manifest, request, deadlineMs = 25 * 60_000 }) {
  const fail = code => { throw new Error(code); };
  const records = manifest?.instances;
  if (!Array.isArray(records) || records.length !== 700 || new Set(records.map(x => x.sopInstanceUID)).size !== 700
    || manifest.datasetType !== 'SYNTHETIC' || manifest.clinicalUse !== false
    || manifest.canonicalManifestSha256 !== HCC_SOURCE_CONTRACT.manifestSha256
    || manifest.studyInstanceUID !== HCC_SOURCE_CONTRACT.studyUid || manifest.seriesInstanceUID !== HCC_SOURCE_CONTRACT.seriesUid) fail('HCC_MANIFEST_INVALID');
  const inventory = records.map(x => [x.sopInstanceUID, x.bytes, x.sha256]).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  if (createHash('sha256').update(JSON.stringify(inventory)).digest('hex') !== HCC_SOURCE_CONTRACT.inventorySha256) fail('HCC_INVENTORY_HASH_MISMATCH');
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs < 1 || deadlineMs > 25 * 60_000) fail('HCC_DEADLINE_INVALID');
  const end = Date.now() + deadlineMs;
  const call = async (path, options = {}) => {
    if (Date.now() >= end) fail('HCC_VERIFICATION_DEADLINE');
    const result = await request(path, { ...options, timeoutMs: Math.min(10000, end - Date.now()) });
    if (Date.now() >= end) fail('HCC_VERIFICATION_DEADLINE');
    if (result.status !== 200) fail('HCC_PACS_RESPONSE_UNAVAILABLE');
    return result;
  };
  const json = async (path, options) => JSON.parse((await call(path, options)).body.toString('utf8'));
  const s = HCC_SOURCE_CONTRACT.studyUid, se = HCC_SOURCE_CONTRACT.seriesUid;
  // Transport failures stay operational failures, not policy DENY/empty inventory.
  const qidoStudies = await json(`/dicom-web/studies?StudyInstanceUID=${s}`);
  const qidoSeries = await json(`/dicom-web/studies/${s}/series`);
  const qidoInstances = await json(`/dicom-web/studies/${s}/series/${se}/instances`);
  await verifyHccSourceStudy({
    qidoStudies: async () => ({ status: 200, body: qidoStudies }),
    qidoSeries: async () => ({ status: 200, body: qidoSeries }),
    qidoInstances: async () => ({ status: 200, body: qidoInstances }),
  });
  const expectedSops = new Set(records.map(x => x.sopInstanceUID));
  if (qidoInstances.some(x => !expectedSops.has(x?.['00080018']?.Value?.[0]))) fail('HCC_QIDO_SOP_MISMATCH');
  const seriesIds = await json('/tools/find', { method: 'POST', body: JSON.stringify({ Level: 'Series', Query: { StudyInstanceUID: s, SeriesInstanceUID: se } }) });
  const id = value => typeof value === 'string' && /^[a-f0-9-]{1,128}$/.test(value);
  if (!Array.isArray(seriesIds) || seriesIds.length !== 1 || !id(seriesIds[0])) fail('HCC_PACS_SERIES_INVALID');
  const series = await json(`/series/${seriesIds[0]}`);
  if (series.MainDicomTags?.SeriesInstanceUID !== se || series.Instances?.length !== 700
    || new Set(series.Instances).size !== 700 || !series.Instances.every(id)) fail('HCC_PACS_INVENTORY_INVALID');
  const remaining = new Map(records.map(x => [x.sopInstanceUID, x])); let totalBytes = 0;
  for (const resourceId of series.Instances) {
    const info = await json(`/instances/${resourceId}`);
    const row = remaining.get(info.MainDicomTags?.SOPInstanceUID);
    if (!row) fail('HCC_PACS_SOP_MISMATCH');
    const raw = await call(`/instances/${resourceId}/file`);
    if (!Buffer.isBuffer(raw.body) || raw.body.length !== row.bytes
      || createHash('sha256').update(raw.body).digest('hex') !== row.sha256) fail('HCC_PACS_RAW_HASH_MISMATCH');
    totalBytes += raw.body.length; remaining.delete(row.sopInstanceUID);
  }
  if (remaining.size || totalBytes !== HCC_SOURCE_CONTRACT.totalBytes) fail('HCC_PACS_TOTAL_MISMATCH');
  return { ...HCC_SOURCE_CONTRACT };
}
