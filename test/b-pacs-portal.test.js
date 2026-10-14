import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { createCapstoneBPortal } from '../src/capstone-b-portal.js';

const origin = 'https://192.168.111.149:9443';
const azureOrigin = 'https://highpass-demo.japaneast.cloudapp.azure.com';
const route = '/dicomweb/studies/2.25.1/series/2.25.2/instances/2.25.3/import';
async function fixture(t, enabled = true, importBrowserOrigins = [origin]) {
  let fetched = 0, imported = 0, plaintext;
  const mockTransport=async (_origin,_path,options)=>{
    fetched++;
    assert.equal(options.method,'POST');
    return {status:200,body:Buffer.from('encrypted fixture'),contentType:'encrypted-fixture'};
  };
  const server = http.createServer(createCapstoneBPortal({ root: path.resolve('public'), ca: 'fixture-ca', encryptionRequired: true,
    importBrowserOrigins,
    transport: mockTransport, importTransport: mockTransport,
    imageDecryption: { async open(_response, path, options) { assert.equal(path, route); assert.equal(options.method, 'POST');
      plaintext = Buffer.from('fixture-dicom'); return { body: plaintext, importContext: {} }; } },
    ...(enabled ? { pacsReceiver: { async receive() { imported++; return { status: 'PACS_INSTANCE_VERIFIED' }; } } } : {}) }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return { counts: () => ({ fetched, imported }), plaintext: () => plaintext, call: opts => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method: 'POST', headers: { origin, authorization: 'DPoP fixture-token', dpop: 'fixture-proof' }, signal: AbortSignal.timeout(3000), ...opts }) };
}
test('B import default-off denies BEFORE source image or key access', async t => {
  const f = await fixture(t, false); assert.equal((await f.call()).status, 503); assert.deepEqual(f.counts(), { fetched: 0, imported: 0 });
});
test('B import returns only verification metadata and clears transient pixels', async t => {
  const f = await fixture(t); const response = await f.call(); assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'PACS_INSTANCE_VERIFIED'); assert.ok(f.plaintext().every(x => x === 0));
});
test('B import permits only explicitly configured Azure clinician origin and exact preflight', async t => {
  const f = await fixture(t, true, [origin, azureOrigin]);
  const preflight = await f.call({ method: 'OPTIONS', headers: { origin: azureOrigin,
    'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,dpop' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), azureOrigin);
  assert.equal(preflight.headers.get('access-control-allow-methods'), 'POST');
  const response = await f.call({ headers: { origin: azureOrigin, authorization: 'DPoP fixture-token', dpop: 'fixture-proof' } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), azureOrigin);
  assert.equal(f.counts().imported, 1);
});
test('B import denies Azure origin unless explicitly enabled before contacting A', async t => {
  const f = await fixture(t);
  const response = await f.call({ headers: { origin: azureOrigin, authorization: 'DPoP fixture-token', dpop: 'fixture-proof' } });
  assert.equal(response.status, 403);
  assert.deepEqual(f.counts(), { fetched: 0, imported: 0 });
});
test('B import browser origin configuration rejects arbitrary or wildcard origins', () => {
  for (const importBrowserOrigins of [['*'], ['https://evil.test'], [origin, azureOrigin, 'https://evil.test']]) {
    assert.throws(() => createCapstoneBPortal({ root: path.resolve('public'), ca: 'fixture-ca', importBrowserOrigins }),
      /PACS_IMPORT_BROWSER_ORIGIN_INVALID/);
  }
});
for (const opts of [{ method: 'GET' }, { headers: { origin: 'https://evil.test', authorization: 'DPoP fixture-token', dpop: 'fixture-proof' } },
  { headers: { origin, authorization: 'Bearer fixture-token', dpop: 'fixture-proof' } }, { headers: { origin, authorization: 'DPoP fixture-token' } }, { body: '{}' }]) {
  test(`B rejects ${JSON.stringify(opts)} without source or destination side effects`, async t => {
    const f = await fixture(t); assert.ok((await f.call(opts)).status >= 400); assert.deepEqual(f.counts(), { fetched: 0, imported: 0 });
  });
}
