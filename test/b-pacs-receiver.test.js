import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createBPacsReceiver, loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';
import { parseDataPlaneRequest } from '../src/data-plane-authorization.js';
import { HCC_SOURCE_CONTRACT as fixed } from '../src/hcc-source-contract.js';
import { readFileSync } from 'node:fs';

const sop = '2.25.1001', id = '12345678-12345678-12345678-12345678-12345678';
const pathname = `/dicomweb/studies/${fixed.studyUid}/series/${fixed.seriesUid}/instances/${sop}/import`;
const origin = 'https://192.168.111.149:9443';
function fixture(options = {}) {
  const body = Buffer.alloc(200); body.write('DICM', 128);
  const sha256 = createHash('sha256').update(body).digest('hex');
  const calls = [], phases = [], storage = [];
  const route = parseDataPlaneRequest({ method: 'POST', path: pathname }, origin);
  const decoded = { body, contentType: 'application/dicom', importContext: { receipt: 'fixture-receipt', releaseId: 'fixture-release', packageBinding: {} } };
  const expected = { bytes: body.length, sha256 };
  const receiver = createBPacsReceiver({ lookupExpected: x => x === sop ? expected : undefined,
    assertStorageReady: async () => { if (options.storageDenied) throw new Error('ENCRYPTED_STORAGE_UNAVAILABLE'); },
    authorize: async input => { phases.push(input.phase); if (options.auditDenied === input.phase) return { status: 503, body: {} }; return { status: 200, body: { authorized: true } }; },
    pacs: async (path, config) => {
      calls.push(path);
      if (options.transportFailed) throw new Error('ETIMEDOUT');
      const json = data => ({ status: 200, body: Buffer.from(JSON.stringify(data)) });
      if (path === '/tools/find') return json(options.exists ? [id] : options.conflict ? [id, id] : []);
      if (path === '/instances') { storage.push(Buffer.from(config.body)); return json({ Status: 'Success', ID: id }); }
      if (path.endsWith('/file')) return { status: 200, body: options.badHash ? Buffer.alloc(200) : Buffer.from(body) };
      return json({ MainDicomTags: { SOPInstanceUID: options.badUid ? '2.25.999' : sop } });
    } });
  return { receiver, route, decoded, calls, phases, storage, expected };
}

test('import is POST-only selected instance DOWNLOAD; GET never mutates', () => {
  assert.equal(parseDataPlaneRequest({ method: 'POST', path: pathname }, origin).requestedAction, 'DOWNLOAD');
  for (const input of [{ method: 'GET', path: pathname }, { method: 'POST', path: pathname.replace('/import', '/download') },
    { method: 'POST', path: pathname + '?x=1' }, { method: 'POST', path: '/dicomweb/studies' }]) assert.throws(() => parseDataPlaneRequest(input, origin));
});

test('actual receiver protocol stores, retrieves UID/raw hash, then audits completion', async () => {
  const f = fixture(); const result = await f.receiver.receive(f);
  assert.equal(result.simulation, false); assert.equal(result.destinationVerification, true);
  assert.equal(result.status, 'PACS_INSTANCE_VERIFIED'); assert.equal(result.sha256, f.expected.sha256);
  assert.deepEqual(f.phases, ['BEFORE_IMPORT', 'BEFORE_IMPORT', 'PACS_VERIFIED']);
  assert.equal(f.storage.length, 1); assert.ok(!f.storage[0].equals(Buffer.alloc(200)));
});

for (const [name, change, options, reason] of [
  ['VIEW_ONLY route', f => { f.route.requestedAction = 'VIEW'; }, {}, /SCOPE/],
  ['foreign Study', f => { f.route.studyInstanceUid = '2.25.3'; }, {}, /SCOPE/],
  ['foreign Series', f => { f.route.seriesInstanceUid = '2.25.3'; }, {}, /SCOPE/],
  ['unknown SOP', f => { f.route.sopInstanceUid = '2.25.3'; }, {}, /MANIFEST/],
  ['tampered bytes', f => { f.decoded.body[0] = 1; }, {}, /SOURCE_HASH/],
  ['missing encrypted context', f => { delete f.decoded.importContext; }, {}, /SCOPE/],
  ['storage encryption gate', () => {}, { storageDenied: true }, /STORAGE/],
  ['policy or audit unavailable', () => {}, { auditDenied: 'BEFORE_IMPORT' }, /AUTHORIZATION/],
]) test(`${name} denies with zero PACS calls/mutations`, async () => {
  const f = fixture(options); change(f);
  await assert.rejects(f.receiver.receive(f), reason); assert.equal(f.calls.length, 0); assert.equal(f.storage.length, 0);
});

test('existing matching instance is verified without overwrite', async () => {
  const f = fixture({ exists: true }); assert.equal((await f.receiver.receive(f)).alreadyStored, true); assert.equal(f.storage.length, 0);
});
test('duplicate UID lookup conflict preserves destination', async () => {
  const f = fixture({ conflict: true }); await assert.rejects(f.receiver.receive(f), /UID_CONFLICT/); assert.equal(f.storage.length, 0);
});
for (const [options, reason] of [[{ badUid: true }, /UID_MISMATCH/], [{ badHash: true }, /HASH_MISMATCH/],
  [{ auditDenied: 'PACS_VERIFIED' }, /AUTHORIZATION/], [{ transportFailed: true }, /ETIMEDOUT/]]) test(`no false completion on ${reason}`, async () => {
  const f = fixture(options); await assert.rejects(f.receiver.receive(f), reason);
  if (!options.auditDenied) assert.ok(!f.phases.includes('PACS_VERIFIED'));
  assert.ok(!f.calls.some(p => /delete/i.test(p)));
});

test('concurrent same SOP has one receiver operation', async () => {
  const f = fixture(); const outcomes = await Promise.allSettled([f.receiver.receive(f), f.receiver.receive(f)]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1); assert.equal(f.storage.length, 1);
});

test('real fixed manifest pins 700 distinct SOP hashes (no payload transfer)', () => {
  const file = 'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json';
  const lookup = loadPinnedBImportManifest(file);
  for (const row of JSON.parse(readFileSync(file)).instances) assert.deepEqual(lookup(row.sopInstanceUID), { sha256: row.sha256, bytes: row.bytes });
  assert.equal(lookup('2.25.0'), undefined);
});
