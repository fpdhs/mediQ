// Local disposable Orthanc protocol test ONLY. No A/B VM, no cloud, no live
// consent/Key Vault assertion. tmpfs keeps this one synthetic DICOM off disk.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { createBPacsReceiver, loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';
import { HCC_SOURCE_CONTRACT as fixed } from '../src/hcc-source-contract.js';
import { parseDataPlaneRequest } from '../src/data-plane-authorization.js';

const image = 'sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a';
const dataset = path.resolve('artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010');
const manifest = JSON.parse(readFileSync(path.join(dataset, 'manifest.json'))), first = manifest.instances[0];
const name = 'hp-b-pacs-local-smoke-' + randomUUID().slice(0, 8);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000, windowsHide: true }).trim();
const start = Date.now(), out = { review: 'DRAFT / UNASSIGNED', scope: 'LOCAL_SINGLE_INSTANCE_ORTHANC_PROTOCOL', image,
  actualBVm: 'NOT VERIFIED', liveConsent: 'NOT VERIFIED', liveKeyVault: 'NOT VERIFIED', mtls: 'NOT VERIFIED',
  storage: 'DISPOSABLE_TMPFS_NOT_PERSISTENT_PACS', requestedInstances: 1, transferredInstances: 0 };
let created = false, pixels;
try {
  docker(['run', '-d', '--name', name, '--label', 'highpass.scope=b-pacs-local-smoke', '--network', 'bridge',
    '-p', '127.0.0.1::8042', '--tmpfs', '/var/lib/orthanc/db:rw,noexec,nosuid,size=512m',
    '-v', path.resolve('orthanc/hospital-b-receiver.json') + ':/etc/orthanc/orthanc.json:ro', image, '/etc/orthanc']);
  created = true;
  const info = JSON.parse(docker(['inspect', name]))[0];
  if (info.Config.Labels['highpass.scope'] !== 'b-pacs-local-smoke' || info.Image !== image) throw new Error('SMOKE_IDENTITY_MISMATCH');
  const port = info.NetworkSettings.Ports['8042/tcp'][0];
  if (port.HostIp !== '127.0.0.1') throw new Error('SMOKE_LOOPBACK_REQUIRED');
  const origin = 'http://127.0.0.1:' + port.HostPort;
  const pacs = async (pathname, options) => {
    const response = await fetch(origin + pathname, { method: options.method, body: options.body,
      headers: { 'content-type': options.contentType ?? 'application/json' }, signal: AbortSignal.timeout(4000) });
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > options.maxBytes) throw new Error('SMOKE_RESPONSE_LIMIT');
    return { status: response.status, body };
  };
  const deadline = Date.now() + 25000;
  for (;;) {
    try { if ((await pacs('/system', { method: 'GET', maxBytes: 32768 })).status === 200) break; } catch {}
    if (Date.now() >= deadline) throw new Error('SMOKE_READINESS_TIMEOUT');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  pixels = readFileSync(path.join(dataset, first.file));
  if (createHash('sha256').update(pixels).digest('hex') !== first.sha256) throw new Error('SOURCE_HASH_MISMATCH');
  const phases = [];
  const receiver = createBPacsReceiver({ lookupExpected: loadPinnedBImportManifest(path.join(dataset, 'manifest.json')), pacs,
    // Explicit test doubles. They are NOT live authorization or encrypted-storage evidence.
    assertStorageReady: async () => {}, authorize: async ({ phase }) => { phases.push(phase); return { status: 200, body: { authorized: true } }; } });
  const route = parseDataPlaneRequest({ method: 'POST', path: `/dicomweb/studies/${fixed.studyUid}/series/${fixed.seriesUid}/instances/${first.sopInstanceUID}/import` }, 'https://192.168.111.149:9443');
  const decoded = { body: pixels, contentType: 'application/dicom', importContext: { receipt: 'LOCAL_FIXTURE', releaseId: 'LOCAL_FIXTURE', packageBinding: {} } };
  const receipt = await receiver.receive({ route, decoded });
  const duplicate = await receiver.receive({ route, decoded });
  const inventory = await pacs('/instances', { method: 'GET', maxBytes: 32768 });
  if (JSON.parse(inventory.body).length !== 1 || !duplicate.alreadyStored) throw new Error('DUPLICATE_MUTATION');
  Object.assign(out, { status: 'PASS', receipt, transferredInstances: 1, duplicatePreserved: true,
    destinationRawHash: 'PASS', destinationUid: 'PASS', audit: 'TEST_DOUBLE_ONLY', testPhases: phases });
} catch (error) { out.status = 'FAIL'; out.reason = /^[A-Z_]+$/u.test(error.message) ? error.message : 'LOCAL_PACS_SMOKE_FAILED'; process.exitCode = 1; }
finally {
  pixels?.fill(0);
  if (created) {
    try {
      const info = JSON.parse(docker(['inspect', name]))[0];
      if (info.Config.Labels['highpass.scope'] !== 'b-pacs-local-smoke') throw new Error('SMOKE_CLEANUP_SCOPE');
      docker(['rm', '-f', name]); out.cleanup = 'OWNED_TMPFS_CONTAINER_REMOVED';
    } catch { out.cleanup = 'FAIL'; process.exitCode = 1; }
  }
  out.durationMs = Date.now() - start; out.observedAt = new Date().toISOString();
  const folder = path.resolve('artifacts/workstation', name); mkdirSync(folder, { recursive: false });
  writeFileSync(path.join(folder, 'result.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out, evidence: path.join(folder, 'result.json') }));
}
