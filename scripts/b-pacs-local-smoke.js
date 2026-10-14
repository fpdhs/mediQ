// Local disposable Orthanc protocol test ONLY. No A/B VM, no cloud, no live
// consent/Key Vault assertion. tmpfs keeps this one synthetic DICOM off disk.
import { execFileSync } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import https from 'node:https';
import { existsSync, readFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createBPacsReceiver, loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';
import { createBPacsMtlsServer } from '../src/b-pacs-mtls-service.js';
import { HCC_SOURCE_CONTRACT as fixed } from '../src/hcc-source-contract.js';
import { parseDataPlaneRequest } from '../src/data-plane-authorization.js';

const image = process.env.HIPASS_B_PACS_ORTHANC_SMOKE_IMAGE ?? 'sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368';
const dataset = path.resolve('artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010');
const config = path.resolve('infra/workstation/orthanc/hospital-b-receiver.json');
const manifest = JSON.parse(readFileSync(path.join(dataset, 'manifest.json'))), first = manifest.instances[0];
const name = 'hp-b-pacs-local-smoke-' + randomUUID().slice(0, 8);
const docker = args => execFileSync('docker', args, { encoding: 'utf8', timeout: 30000, windowsHide: true }).trim();
const configuredOpenssl = process.env.OPENSSL_BIN;
const windowsGitOpenssl = 'C:/Program Files/Git/usr/bin/openssl.exe';
const openssl = configuredOpenssl && existsSync(configuredOpenssl) ? configuredOpenssl
  : existsSync(windowsGitOpenssl) ? windowsGitOpenssl : 'openssl';
const start = Date.now(), out = { review: 'DRAFT / UNASSIGNED', scope: 'LOCAL_SINGLE_INSTANCE_ORTHANC_PROTOCOL', image,
  actualBVm: 'NOT VERIFIED', liveConsent: 'NOT VERIFIED', liveKeyVault: 'NOT VERIFIED', mtls: 'NOT VERIFIED',
  storage: 'DISPOSABLE_TMPFS_NOT_PERSISTENT_PACS', storageGate: 'TEST_DOUBLE_ONLY', requestedInstances: 1, transferredInstances: 0 };
let created = false, pixels, mtlsServer, certificateDirectory, certificates;
const orthancResponseBuffers = [];

function makeCertificates(directory) {
  const file = value => path.join(directory, value);
  const run = args => {
    const result = spawnSync(openssl, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
    if (result.error || result.status !== 0) throw new Error('SMOKE_CERTIFICATE_GENERATION_FAILED');
  };
  run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
    '-subj', '/CN=Highpass Temporary B PACS Smoke CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', file('ca.key'), '-out', file('ca.crt')]);
  for (const role of ['server', 'client']) {
    run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-subj', `/CN=b-pacs-smoke-${role}`,
      '-keyout', file(`${role}.key`), '-out', file(`${role}.csr`)]);
    const profile = path.resolve(`config/b-pacs-mtls-${role}.ext`);
    run(['x509', '-req', '-sha256', '-days', '1', '-in', file(`${role}.csr`), '-CA', file('ca.crt'),
      '-CAkey', file('ca.key'), '-set_serial', role === 'server' ? '2001' : '2002', '-extfile', profile,
      '-out', file(`${role}.crt`)]);
  }
  return { ca: readFileSync(file('ca.crt')), serverCert: readFileSync(file('server.crt')), serverKey: readFileSync(file('server.key')),
    clientCert: readFileSync(file('client.crt')), clientKey: readFileSync(file('client.key')) };
}

function requestOrthanc(origin, request, maxBytes = 8 * 1024 * 1024) {
  const upstream = new URL(origin);
  const body = request.body ?? Buffer.alloc(0);
  return new Promise((resolve, reject) => {
    const client = http.request({ hostname: upstream.hostname, port: upstream.port, method: request.method,
      path: request.path, signal: request.signal,
      headers: { 'content-type': request.path === '/instances' ? 'application/dicom' : 'application/json',
        'content-length': body.length } }, response => {
      let length = 0;
      const chunks = [];
      response.on('data', chunk => {
        length += chunk.length;
        if (length > maxBytes) { chunk.fill(0); response.destroy(new Error('SMOKE_ORTHANC_RESPONSE_LIMIT')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        const resultBody = Buffer.concat(chunks);
        for (const chunk of chunks) chunk.fill(0);
        resolve({ statusCode: response.statusCode ?? 502,
          contentType: response.headers['content-type'] ?? 'application/octet-stream', body: resultBody });
      });
      response.on('error', error => { for (const chunk of chunks) chunk.fill(0); reject(error); });
    });
    client.setTimeout(4000, () => client.destroy(new Error('SMOKE_ORTHANC_TIMEOUT')));
    client.on('error', reject);
    client.end(body);
  });
}

function createMtlsPacsClient(port, tls, maxBytes) {
  return (requestPath, options = {}) => {
    const body = options.body ?? Buffer.alloc(0);
    return new Promise((resolve, reject) => {
      const client = https.request({ hostname: 'b-pacs-mtls', port, method: options.method ?? 'GET', path: requestPath,
        ca: tls.ca, cert: tls.clientCert, key: tls.clientKey, minVersion: 'TLSv1.2', rejectUnauthorized: true,
        lookup: (_hostname, lookupOptions, callback) => lookupOptions?.all
          ? callback(null, [{ address: '127.0.0.1', family: 4 }]) : callback(null, '127.0.0.1', 4),
        headers: { 'content-type': options.contentType ?? 'application/json', 'content-length': body.length } }, response => {
        let length = 0;
        const chunks = [];
        response.on('data', chunk => {
          length += chunk.length;
          if (length > (options.maxBytes ?? maxBytes)) { chunk.fill(0); response.destroy(new Error('SMOKE_MTLS_RESPONSE_LIMIT')); return; }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const responseBody = Buffer.concat(chunks);
          for (const chunk of chunks) chunk.fill(0);
          resolve({ status: response.statusCode ?? 502, contentType: response.headers['content-type'], body: responseBody });
        });
        response.on('error', error => { for (const chunk of chunks) chunk.fill(0); reject(error); });
      });
      client.setTimeout(5000, () => client.destroy(new Error('SMOKE_MTLS_TIMEOUT')));
      client.on('error', reject);
      client.end(body);
    });
  };
}
try {
  if (!/^sha256:[a-f0-9]{64}$/u.test(image)) throw new Error('ORTHANC_IMAGE_DIGEST_REQUIRED');
  docker(['run', '-d', '--name', name, '--label', 'highpass.scope=b-pacs-local-smoke', '--network', 'bridge',
    '--read-only', '--user', '10001:10001', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
    '--pids-limit', '128', '--memory', '512m', '--cpus', '1', '-p', '127.0.0.1::8042',
    '--tmpfs', '/tmp:rw,noexec,nosuid,nodev,size=64m,uid=10001,gid=10001',
    '--tmpfs', '/var/lib/orthanc/db:rw,noexec,nosuid,nodev,size=512m,uid=10001,gid=10001,mode=0700',
    '-v', config + ':/etc/orthanc/orthanc.json:ro', image, '/etc/orthanc']);
  created = true;
  const info = JSON.parse(docker(['inspect', name]))[0];
  if (info.Config.Labels['highpass.scope'] !== 'b-pacs-local-smoke' || info.Image !== image) throw new Error('SMOKE_IDENTITY_MISMATCH');
  const port = info.NetworkSettings.Ports['8042/tcp'][0];
  if (port.HostIp !== '127.0.0.1') throw new Error('SMOKE_LOOPBACK_REQUIRED');
  const origin = 'http://127.0.0.1:' + port.HostPort;
  certificateDirectory = mkdtempSync(path.join(os.tmpdir(), 'hp-b-pacs-mtls-smoke-'));
  certificates = makeCertificates(certificateDirectory);
  const testLuksUuid = randomUUID();
  let storageGateRequests = 0;
  mtlsServer = createBPacsMtlsServer({ cert: certificates.serverCert, key: certificates.serverKey,
    ca: certificates.ca, expectedLuksUuid: testLuksUuid,
    assertStorageReady: async uuid => { storageGateRequests++; if (uuid !== testLuksUuid) throw new Error('SMOKE_STORAGE_GATE_MISMATCH'); },
    forward: async request => {
      const response = await requestOrthanc(origin, request);
      orthancResponseBuffers.push(response.body);
      return response;
    } });
  await new Promise((resolve, reject) => { mtlsServer.once('error', reject); mtlsServer.listen(0, '127.0.0.1', resolve); });
  const pacs = createMtlsPacsClient(mtlsServer.address().port, certificates, 8 * 1024 * 1024);
  const assertLocalOrthancReady = async () => {
    const system = await pacs('/system', { method: 'GET', maxBytes: 32768 });
    try {
      if (system.status !== 200 || JSON.parse(system.body.toString('utf8')).Name !== 'Highpass B Synthetic Test PACS - Not For Clinical Use') {
        throw new Error('PACS_DESTINATION_NOT_READY');
      }
    } finally { system.body.fill(0); }
  };
  const deadline = Date.now() + 25000;
  for (;;) {
    try { await assertLocalOrthancReady(); break; } catch {}
    if (Date.now() >= deadline) throw new Error('SMOKE_READINESS_TIMEOUT');
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  pixels = readFileSync(path.join(dataset, first.file));
  if (createHash('sha256').update(pixels).digest('hex') !== first.sha256) throw new Error('SOURCE_HASH_MISMATCH');
  const phases = [];
  const receiver = createBPacsReceiver({ lookupExpected: loadPinnedBImportManifest(path.join(dataset, 'manifest.json')), pacs,
    // Authorization and the LUKS gate remain explicit test doubles in disposable tmpfs.
    assertStorageReady: assertLocalOrthancReady,
    authorize: async ({ phase }) => { phases.push(phase); return { status: 200, body: { authorized: true } }; } });
  const route = parseDataPlaneRequest({ method: 'POST', path: `/dicomweb/studies/${fixed.studyUid}/series/${fixed.seriesUid}/instances/${first.sopInstanceUID}/import` }, 'https://192.168.111.149:9443');
  const decoded = { body: pixels, contentType: 'application/dicom', importContext: { receipt: 'LOCAL_FIXTURE', releaseId: 'LOCAL_FIXTURE', packageBinding: {} } };
  const receipt = await receiver.receive({ route, decoded });
  const duplicate = await receiver.receive({ route, decoded });
  await new Promise(resolve => setImmediate(resolve));
  const plaintextBuffersCleared = orthancResponseBuffers.length > 0
    && orthancResponseBuffers.every(buffer => buffer.every(byte => byte === 0));
  out.orthancResponseBuffersCleared = plaintextBuffersCleared;
  out.orthancResponseBufferCount = orthancResponseBuffers.length;
  if (!plaintextBuffersCleared) throw new Error('SMOKE_ORTHANC_RESPONSE_NOT_CLEARED');
  const inventory = await pacs('/tools/find', { method: 'POST', body: Buffer.from(JSON.stringify({ Level: 'Instance',
    Query: { SOPInstanceUID: first.sopInstanceUID } })), maxBytes: 32768 });
  const found = JSON.parse(inventory.body.toString('utf8'));
  inventory.body.fill(0);
  if (inventory.status !== 200 || found.length !== 1 || !duplicate.alreadyStored) throw new Error('DUPLICATE_MUTATION');
  Object.assign(out, { status: 'PASS', receipt, transferredInstances: 1, duplicatePreserved: true,
    destinationRawHash: 'PASS', destinationUid: 'PASS', audit: 'TEST_DOUBLE_ONLY', testPhases: phases });
  out.mtls = 'LOCAL_EPHEMERAL_CLIENT_CERT_TO_TMPFS_ORTHANC_PASS';
  out.storageGateRequests = storageGateRequests;
} catch (error) { out.status = 'FAIL'; out.reason = /^[A-Z_]+$/u.test(error.message) ? error.message : 'LOCAL_PACS_SMOKE_FAILED'; process.exitCode = 1; }
finally {
  pixels?.fill(0);
  for (const body of orthancResponseBuffers) body.fill(0);
  if (mtlsServer?.listening) {
    mtlsServer.closeAllConnections();
    await new Promise(resolve => mtlsServer.close(resolve));
  }
  certificates?.serverKey.fill(0);
  certificates?.clientKey.fill(0);
  if (created) {
    try {
      const info = JSON.parse(docker(['inspect', name]))[0];
      if (info.Config.Labels['highpass.scope'] !== 'b-pacs-local-smoke') throw new Error('SMOKE_CLEANUP_SCOPE');
      docker(['rm', '-f', name]); out.cleanup = 'OWNED_TMPFS_CONTAINER_REMOVED';
    } catch { out.cleanup = 'FAIL'; process.exitCode = 1; }
  }
  if (certificateDirectory) rmSync(certificateDirectory, { recursive: true, force: true });
  out.durationMs = Date.now() - start; out.observedAt = new Date().toISOString();
  const folder = path.resolve('artifacts/workstation', name); mkdirSync(folder, { recursive: false });
  writeFileSync(path.join(folder, 'result.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ...out, evidence: path.join(folder, 'result.json') }));
}
