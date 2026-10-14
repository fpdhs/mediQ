import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createBPacsMtlsServer } from '../src/b-pacs-mtls-service.js';

const root = path.resolve('.');
const profiles = {
  server: path.join(root, 'config/b-pacs-mtls-server.ext'),
  client: path.join(root, 'config/b-pacs-mtls-client.ext'),
};
const configuredOpenssl = process.env.OPENSSL_BIN;
const windowsGitOpenssl = 'C:/Program Files/Git/usr/bin/openssl.exe';
const openssl = configuredOpenssl && existsSync(configuredOpenssl) ? configuredOpenssl
  : existsSync(windowsGitOpenssl) ? windowsGitOpenssl : process.platform === 'win32' ? null : 'openssl';

function run(args, { expected = 0 } = {}) {
  const result = spawnSync(openssl, args, { encoding: 'utf8', timeout: 15000, windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, expected, `${args[0]} ${args.slice(1).join(' ')}\n${result.stderr}`);
  return result.stdout + result.stderr;
}

function mtlsRequest({ port, ca, cert, key, method = 'GET', path: requestPath, body }) {
  return new Promise((resolve, reject) => {
    const request = https.request({ hostname: 'b-pacs-mtls', port, method, path: requestPath,
      ca: readFileSync(ca), ...(cert ? { cert: readFileSync(cert), key: readFileSync(key) } : {}),
      lookup: (_hostname, options, callback) => options?.all
        ? callback(null, [{ address: '127.0.0.1', family: 4 }]) : callback(null, '127.0.0.1', 4), timeout: 5000 }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

test('B PACS startup denies missing or redirected secrets with sanitized errors', () => {
  const script = path.join(root, 'scripts/start-b-pacs-mtls.js');
  const env = { ...process.env };
  delete env.B_PACS_ENCRYPTED_LUKS_UUID;
  delete env.B_PACS_TLS_CERT_FILE;
  delete env.B_PACS_TLS_KEY_FILE;
  delete env.B_PACS_TLS_CA_FILE;

  const missingMount = spawnSync(process.execPath, [script], { encoding: 'utf8', env, timeout: 5000, windowsHide: true });
  assert.equal(missingMount.status, 1);
  assert.equal(missingMount.stderr.trim(), 'PACS_ENCRYPTED_MOUNT_REQUIRED');
  assert.equal(missingMount.stdout, '');

  const redirectedSecret = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 5000, windowsHide: true,
    env: { ...env, B_PACS_ENCRYPTED_LUKS_UUID: '627df927-a317-4950-88d1-3293a3b261b0',
      B_PACS_TLS_CERT_FILE: path.join(os.tmpdir(), 'not-a-mounted-secret') } });
  assert.equal(redirectedSecret.status, 1);
  assert.equal(redirectedSecret.stderr.trim(), 'PACS_MTLS_SECRET_CONFIGURATION_REQUIRED');
  assert.equal(redirectedSecret.stdout, '');
});

test('B PACS mTLS profiles and live loopback service enforce identity, route and storage gates', { skip: !openssl }, async t => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'hp-b-pacs-cert-profile-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const file = name => path.join(directory, name);

  run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '1',
    '-subj', '/CN=Highpass Temporary Test CA', '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-keyout', file('ca.key'), '-out', file('ca.crt')]);

  for (const name of ['server', 'client']) {
    run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256',
      '-subj', `/CN=highpass-b-pacs-${name}-test-only`, '-keyout', file(`${name}.key`), '-out', file(`${name}.csr`)]);
    run(['x509', '-req', '-sha256', '-days', '1', '-in', file(`${name}.csr`), '-CA', file('ca.crt'),
      '-CAkey', file('ca.key'), '-set_serial', name === 'server' ? '1001' : '1002',
      '-extfile', profiles[name], '-out', file(`${name}.crt`)]);
  }
  writeFileSync(file('wrong-client.ext'), [
    'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature', 'extendedKeyUsage=clientAuth',
    'subjectAltName=URI:spiffe://highpass.local/hospital-a/not-b-pacs', '',
  ].join('\n'));
  run(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-subj', '/CN=wrong-client-test',
    '-keyout', file('wrong-client.key'), '-out', file('wrong-client.csr')]);
  run(['x509', '-req', '-sha256', '-days', '1', '-in', file('wrong-client.csr'), '-CA', file('ca.crt'),
    '-CAkey', file('ca.key'), '-set_serial', '1003', '-extfile', file('wrong-client.ext'), '-out', file('wrong-client.crt')]);

  run(['verify', '-purpose', 'sslserver', '-verify_hostname', 'b-pacs-mtls', '-CAfile', file('ca.crt'), file('server.crt')]);
  run(['verify', '-purpose', 'sslclient', '-CAfile', file('ca.crt'), file('client.crt')]);
  run(['verify', '-purpose', 'sslclient', '-CAfile', file('ca.crt'), file('server.crt')], { expected: 2 });
  run(['verify', '-purpose', 'sslserver', '-CAfile', file('ca.crt'), file('client.crt')], { expected: 2 });
  run(['verify', '-purpose', 'sslserver', '-verify_hostname', 'wrong-b-pacs-host', '-CAfile', file('ca.crt'), file('server.crt')], { expected: 2 });

  const serverExtensions = run(['x509', '-in', file('server.crt'), '-noout', '-ext', 'subjectAltName,extendedKeyUsage']);
  const clientExtensions = run(['x509', '-in', file('client.crt'), '-noout', '-ext', 'subjectAltName,extendedKeyUsage']);
  assert.match(serverExtensions, /DNS:b-pacs-mtls/u);
  assert.match(serverExtensions, /TLS Web Server Authentication/u);
  assert.match(clientExtensions, /URI:spiffe:\/\/highpass\.local\/hospital-b\/pacs-receiver/u);
  assert.match(clientExtensions, /TLS Web Client Authentication/u);

  const readyChecks = [];
  const forwarded = [];
  const forwardedRequestBodies = [];
  const forwardedResponses = [];
  let storageReady = true;
  let failForward = false;
  const luksUuid = '627df927-a317-4950-88d1-3293a3b261b0';
  const server = createBPacsMtlsServer({ cert: readFileSync(file('server.crt')), key: readFileSync(file('server.key')),
    ca: readFileSync(file('ca.crt')), expectedLuksUuid: luksUuid,
    assertStorageReady: async uuid => { readyChecks.push(uuid); if (!storageReady) throw new Error('TEST_STORAGE_NOT_READY'); },
    forward: async request => { forwarded.push({ method: request.method, path: request.path, body: Buffer.from(request.body) });
      forwardedRequestBodies.push(request.body);
      if (failForward) { failForward = false; throw new Error('TEST_UPSTREAM_INTERRUPTED'); }
      const body = Buffer.from('{"status":"synthetic"}'); forwardedResponses.push(body);
      return { statusCode: 200, contentType: 'application/json', body }; } });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const port = server.address().port;

  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'), path: '/system' })).status, 200);
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'),
    method: 'POST', path: '/tools/find', body: JSON.stringify({ Level: 'Instance', Query: { SOPInstanceUID: '1.2.3' } }) })).status, 200);
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'), path: '/delete' })).status, 403);
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'),
    method: 'POST', path: '/tools/find', body: '{"Level":"Study","Query":{}}' })).status, 400);
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('wrong-client.crt'), key: file('wrong-client.key'), path: '/system' })).status, 403);
  await assert.rejects(mtlsRequest({ port, ca: file('ca.crt'), path: '/system' }));
  failForward = true;
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'),
    method: 'POST', path: '/tools/find', body: JSON.stringify({ Level: 'Instance', Query: { SOPInstanceUID: '1.2.3' } }) })).status, 502);
  const oversizedBody = Buffer.alloc(8 * 1024 * 1024 + 1, 0x5a);
  let oversizedStatus;
  try {
    oversizedStatus = (await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'),
      method: 'POST', path: '/instances', body: oversizedBody })).status;
  } finally { oversizedBody.fill(0); }
  assert.equal(oversizedStatus, 413, 'oversized DICOM is denied before Orthanc forwarding');
  storageReady = false;
  assert.equal((await mtlsRequest({ port, ca: file('ca.crt'), cert: file('client.crt'), key: file('client.key'), path: '/system' })).status, 503);
  assert.equal(readyChecks.length, 6, 'storage is checked for authenticated allowed routes, not invalid identities or paths');
  assert.ok(readyChecks.every(uuid => uuid === luksUuid));
  assert.deepEqual(forwarded.map(row => [row.method, row.path]), [['GET', '/system'], ['POST', '/tools/find'], ['POST', '/tools/find']]);
  assert.equal(forwardedResponses.length, 2);
  assert.ok(forwardedResponses.every(body => body.every(byte => byte === 0)), 'Orthanc response buffers are cleared after HTTPS delivery');
  assert.equal(forwardedRequestBodies.length, 3);
  assert.ok(forwardedRequestBodies.every(body => body.every(byte => byte === 0)), 'request buffers are cleared after upstream interruption and responses');
  for (const row of forwarded) row.body.fill(0);

  const keyFiles = ['ca.key', 'server.key', 'client.key', 'wrong-client.key'];
  assert.deepEqual(keyFiles.map(name => existsSync(file(name))), [true, true, true, true]);
  assert.match(readFileSync(profiles.client, 'utf8'), /hospital-b\/pacs-receiver/u);
});
