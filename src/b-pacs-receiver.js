import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extractSingleDicomInstance } from './dicomweb-single-instance.js';
import { HCC_SOURCE_CONTRACT } from './hcc-source-contract.js';

const sha = body => createHash('sha256').update(body).digest('hex');
const fail = code => { throw new Error(code); };
const objectId = /^[a-f0-9]{8}(?:-[a-f0-9]{8}){4}$/u;

export function loadPinnedBImportManifest(file) {
  const body = readFileSync(file);
  if (body.length > 4 * 1024 * 1024) fail('PACS_MANIFEST_INVALID');
  const manifest = JSON.parse(body.toString('utf8'));
  if (manifest.canonicalManifestSha256 !== HCC_SOURCE_CONTRACT.manifestSha256
    || manifest.datasetType !== 'SYNTHETIC' || manifest.clinicalUse !== false
    || manifest.studyInstanceUID !== HCC_SOURCE_CONTRACT.studyUid || manifest.seriesInstanceUID !== HCC_SOURCE_CONTRACT.seriesUid
    || manifest.instanceCount !== 700 || manifest.instances?.length !== 700) fail('PACS_MANIFEST_INVALID');
  const rows = new Map();
  for (const row of manifest.instances) {
    if (!/^[0-9]+(?:\.[0-9]+)+$/u.test(row.sopInstanceUID) || row.sopInstanceUID.length > 64
      || !/^[a-f0-9]{64}$/u.test(row.sha256) || !Number.isSafeInteger(row.bytes)
      || row.bytes < 132 || row.bytes > 8388608 || rows.has(row.sopInstanceUID)) fail('PACS_MANIFEST_INVALID');
    rows.set(row.sopInstanceUID, Object.freeze({ sha256: row.sha256, bytes: row.bytes }));
  }
  const inventory = manifest.instances.map(row => [row.sopInstanceUID, row.bytes, row.sha256]).sort((a, b) => a[0].localeCompare(b[0], 'en'));
  if (sha(Buffer.from(JSON.stringify(inventory))) !== HCC_SOURCE_CONTRACT.inventorySha256) fail('PACS_MANIFEST_MISMATCH');
  // Never expose mutable approved inventory to an HTTP caller.
  return sop => rows.get(sop);
}

/** Actual Orthanc REST registration (not the legacy encrypted archive simulator).
 * Injected transport MUST be B-local authenticated mTLS with finite deadlines.
 * No arbitrary origins/paths, local plaintext files, retries or delete operations.
 */
export function createBPacsReceiver({ lookupExpected, pacs, authorize, assertStorageReady }) {
  if (![lookupExpected, pacs, authorize, assertStorageReady].every(x => typeof x === 'function')) fail('PACS_RECEIVER_DEPENDENCIES_REQUIRED');
  const active = new Set();
  const json = result => {
    if (result.body.length > 32768) fail('PACS_METADATA_TOO_LARGE');
    try { return JSON.parse(result.body.toString('utf8')); } catch { fail('PACS_RESPONSE_INVALID'); }
  };
  return { async receive({ decoded, route }) {
    if (!route.importing || route.requestedAction !== 'DOWNLOAD' || route.studyInstanceUid !== HCC_SOURCE_CONTRACT.studyUid
      || route.seriesInstanceUid !== HCC_SOURCE_CONTRACT.seriesUid || !decoded.importContext) fail('PACS_IMPORT_SCOPE_MISMATCH');
    const expected = lookupExpected(route.sopInstanceUid);
    if (!expected) fail('PACS_INSTANCE_NOT_IN_MANIFEST');
    if (active.has(route.sopInstanceUid)) fail('PACS_IMPORT_IN_PROGRESS');
    active.add(route.sopInstanceUid);
    let dicom;
    try {
      dicom = extractSingleDicomInstance(decoded);
      if (dicom.length !== expected.bytes || sha(dicom) !== expected.sha256) fail('PACS_SOURCE_HASH_MISMATCH');
      // Exact pinned raw hash binds both pixel bytes and all original DICOM UIDs.
      await assertStorageReady();
      const evidence = { manifestSha256: HCC_SOURCE_CONTRACT.manifestSha256, ...expected, orthancId: null };
      const check = async phase => {
        const result = await authorize({ ...decoded.importContext, phase, evidence });
        if (result.status !== 200 || result.body.authorized !== true) fail('PACS_IMPORT_AUTHORIZATION_UNAVAILABLE');
      };
      await check('BEFORE_IMPORT'); // Live consent + durable audit BEFORE any PACS mutation.
      const found = await pacs('/tools/find', { method: 'POST', body: Buffer.from(JSON.stringify({ Level: 'Instance',
        Query: { SOPInstanceUID: route.sopInstanceUid } })), maxBytes: 32768 });
      if (found.status !== 200) fail('PACS_LOOKUP_FAILED');
      const matches = json(found);
      if (!Array.isArray(matches) || matches.length > 1 || matches.some(id => !objectId.test(id))) fail('PACS_UID_CONFLICT');
      let id = matches[0], alreadyStored = Boolean(id);
      if (!id) {
        // Recheck after destination latency; expiry/revoke is not a retry reason.
        await check('BEFORE_IMPORT');
        const stored = await pacs('/instances', { method: 'POST', body: dicom, contentType: 'application/dicom', maxBytes: 32768 });
        if (stored.status !== 200) fail('PACS_STORE_UNCONFIRMED');
        const result = json(stored);
        if (!['Success', 'AlreadyStored'].includes(result.Status) || !objectId.test(result.ID)) fail('PACS_STORE_UNCONFIRMED');
        id = result.ID; alreadyStored = result.Status === 'AlreadyStored';
      }
      const details = await pacs(`/instances/${id}`, { method: 'GET', maxBytes: 32768 });
      if (details.status !== 200 || json(details).MainDicomTags?.SOPInstanceUID !== route.sopInstanceUid) fail('PACS_DESTINATION_UID_MISMATCH');
      const file = await pacs(`/instances/${id}/file`, { method: 'GET', maxBytes: 8388608 });
      try {
        if (file.status !== 200 || file.body.length !== expected.bytes || sha(file.body) !== expected.sha256) fail('PACS_DESTINATION_HASH_MISMATCH');
      } finally { file.body?.fill(0); }
      evidence.orthancId = id;
      await check('PACS_VERIFIED'); // Failure after write = unconfirmed, NEVER false completion or destructive rollback.
      return { status: 'PACS_INSTANCE_VERIFIED', simulation: false, destinationVerification: true,
        studyInstanceUid: route.studyInstanceUid, seriesInstanceUid: route.seriesInstanceUid,
        sopInstanceUid: route.sopInstanceUid, ...evidence, alreadyStored };
    } finally { dicom?.fill(0); active.delete(route.sopInstanceUid); }
  } };
}
