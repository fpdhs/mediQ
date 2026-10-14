import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import path from "node:path";
import { readFileSync } from "node:fs";
import { createCapstoneBPortal } from "../src/capstone-b-portal.js";

async function start(t, transport, configuration = {}) {
  const server = http.createServer(createCapstoneBPortal({ root: path.resolve("public"), ca: Buffer.from("test-ca"), transport, importTransport: transport, ...configuration }));
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return (pathname, options) => fetch(origin + pathname, { ...options, signal: AbortSignal.timeout(3000) });
}

test('B PACS import denies wrong origin or missing DPoP before contacting A', async t => {
  let upstreamCalls = 0;
  const get = await start(t, async () => { upstreamCalls++; throw new Error('Unexpected A request'); }, {
    encryptionRequired: true,
    imageDecryption: { open: async () => { throw new Error('Unexpected decryption'); } },
    pacsReceiver: { receive: async () => { throw new Error('Unexpected PACS import'); } },
  });
  const route = '/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import';
  const origin = 'https://192.168.111.149:9443';
  const cases = [
    [{ method: 'POST', headers: { origin: 'https://evil.invalid', authorization: 'DPoP token', dpop: 'proof' } }, 403],
    [{ method: 'POST', headers: { origin, authorization: 'DPoP token' } }, 401],
    [{ method: 'POST', headers: { origin, authorization: 'Bearer token', dpop: 'proof' } }, 401],
    [{ method: 'GET', headers: { origin, authorization: 'DPoP token', dpop: 'proof' } }, 403],
  ];
  for (const [options, expected] of cases) assert.equal((await get(route, options)).status, expected);
  assert.equal(upstreamCalls, 0);
});

test('B PACS import rejects request bytes and missing receiver before contacting A', async t => {
  let upstreamCalls = 0;
  const transport = async () => { upstreamCalls++; throw new Error('Unexpected A request'); };
  const origin = 'https://192.168.111.149:9443';
  const route = '/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import';
  const notReady = await start(t, transport, { encryptionRequired: true, imageDecryption: { open: async () => ({}) } });
  assert.equal((await notReady(route, { method: 'POST', headers: { origin, authorization: 'DPoP token', dpop: 'proof' } })).status, 503);

  const ready = await start(t, transport, { encryptionRequired: true, imageDecryption: { open: async () => ({}) },
    pacsReceiver: { receive: async () => ({}) } });
  const response = await ready(route, { method: 'POST', headers: { origin, authorization: 'DPoP token', dpop: 'proof' }, body: 'not-empty' });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'PACS_IMPORT_BODY_NOT_ALLOWED');
  assert.equal(upstreamCalls, 0);
});

test('B PACS import uses its bounded long-running transport without widening other routes', async t => {
  const seen = [];
  const get = await start(t, async (...args) => {
    seen.push(args);
    return { status: 403, contentType: 'application/json', body: Buffer.from('{"error":"ACCESS_DENIED"}') };
  }, { encryptionRequired: true, imageDecryption: { open: async () => { throw new Error('Unexpected decrypt'); } },
    pacsReceiver: { receive: async () => { throw new Error('Unexpected PACS import'); } } });
  const route = '/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import';
  const response = await get(route, { method: 'POST', headers: {
    origin: 'https://192.168.111.149:9443', authorization: 'DPoP synthetic.token', dpop: 'synthetic-proof',
  } });
  assert.equal(response.status, 403);
  assert.equal(seen.length, 1);
  assert.equal(seen[0][0], 'https://10.90.88.2:9443');
  assert.equal(seen[0][1], route);
  assert.equal(seen[0][2].method, 'POST');
  assert.equal(seen[0][2].timeoutMs, 55000);
  assert.equal(seen[0][2].maxBytes, 12582912);
  assert.equal(seen[0][2].body, undefined);
  assert.deepEqual(Object.keys(seen[0][2].headers).sort(), ['authorization', 'dpop']);
});

test('B PACS import binds an optional job lease only to its authenticated Control report, never to A transport', async t => {
  const job = { jobId: 'a11ce000-1111-4111-8111-111111111111', itemId: 'b22ce000-2222-4222-8222-222222222222',
    leaseId: 'c33ce000-3333-4333-8333-333333333333' };
  const received = [], upstream = [];
  const get = await start(t, async (...args) => {
    upstream.push(args);
    return { status: 200, contentType: 'application/vnd.highpass.encrypted-dicom+json', body: Buffer.from('ciphertext') };
  }, { encryptionRequired: true, imageDecryption: { open: async (_result, _path, options) => {
    received.push(options); return { body: Buffer.from('synthetic DICOM'), importContext: { transferJob: options.transferJob } };
  } }, pacsReceiver: { receive: async ({ decoded }) => ({ status: 'PACS_INSTANCE_VERIFIED', transferJob: decoded.importContext.transferJob }) } });
  const route = '/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import';
  const headers = { origin: 'https://192.168.111.149:9443', authorization: 'DPoP token', dpop: 'proof',
    'x-hipass-transfer-job-id': job.jobId, 'x-hipass-transfer-item-id': job.itemId,
    'x-hipass-transfer-lease-id': job.leaseId };
  const preflight = await get(route, { method: 'OPTIONS', headers: { origin: headers.origin,
    'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,dpop,x-hipass-transfer-job-id,x-hipass-transfer-item-id,x-hipass-transfer-lease-id' } });
  assert.equal(preflight.status, 204);
  const response = await get(route, { method: 'POST', headers });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).transferJob, job);
  assert.deepEqual(received[0].transferJob, job);
  assert.deepEqual(Object.keys(upstream[0][2].headers).sort(), ['authorization', 'dpop']);
});

test('B PACS import rejects incomplete or malformed transfer lease headers before A is called', async t => {
  let upstreamCalls = 0;
  const get = await start(t, async () => { upstreamCalls++; throw new Error('Unexpected A request'); }, {
    encryptionRequired: true, imageDecryption: { open: async () => ({}) }, pacsReceiver: { receive: async () => ({}) },
  });
  const route = '/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import';
  const base = { origin: 'https://192.168.111.149:9443', authorization: 'DPoP token', dpop: 'proof' };
  const partial = await get(route, { method: 'POST', headers: { ...base, 'x-hipass-transfer-job-id': 'a11ce000-1111-4111-8111-111111111111' } });
  assert.equal(partial.status, 400);
  const invalid = await get(route, { method: 'POST', headers: { ...base,
    'x-hipass-transfer-job-id': 'job', 'x-hipass-transfer-item-id': 'b22ce000-2222-4222-8222-222222222222',
    'x-hipass-transfer-lease-id': 'c33ce000-3333-4333-8333-333333333333' } });
  assert.equal(invalid.status, 400);
  assert.equal(upstreamCalls, 0);
});

test('B PACS import does not report success when the A Gateway transport is interrupted', async t => {
  let receiverCalls = 0;
  const get = await start(t, async () => { throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }, {
    encryptionRequired: true,
    imageDecryption: { open: async () => { throw new Error('Must not decrypt'); } },
    pacsReceiver: { receive: async () => { receiverCalls++; return { status: 'PACS_INSTANCE_VERIFIED' }; } },
  });
  const response = await get('/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import', {
    method: 'POST', headers: { origin: 'https://192.168.111.149:9443', authorization: 'DPoP token', dpop: 'proof' },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'CAPSTONE_PORTAL_UNAVAILABLE');
  assert.equal(receiverCalls, 0);
});

test('B PACS import masks destination failures and clears transient plaintext', async t => {
  let plaintext, ciphertext;
  const get = await start(t, async () => {
    ciphertext = Buffer.from('synthetic ciphertext');
    return { status: 200, contentType: 'application/vnd.highpass.encrypted-dicom+json', body: ciphertext };
  }, {
    encryptionRequired: true,
    imageDecryption: { open: async () => {
      plaintext = Buffer.from('synthetic DICOM plaintext');
      return { contentType: 'application/dicom', body: plaintext };
    } },
    pacsReceiver: { receive: async () => { throw Object.assign(new Error('destination timeout'), { code: 'ETIMEDOUT' }); } },
  });
  const response = await get('/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/import', {
    method: 'POST', headers: { origin: 'https://192.168.111.149:9443', authorization: 'DPoP token', dpop: 'proof' },
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'CAPSTONE_PORTAL_UNAVAILABLE');
  assert.ok(plaintext.every(byte => byte === 0));
  assert.ok(ciphertext.every(byte => byte === 0));
});

test('Entra-only CSP extension permits the fixed Microsoft authority, never arbitrary hosts',async t=>{
  const get=await start(t,async()=>({status:200,contentType:'application/json',body:Buffer.from('{}')}),{entraLoginEnabled:true});
  const response=await get('/entra-redirect.html');assert.equal(response.status,200);
  const policy=response.headers.get('content-security-policy');
  assert.match(policy,/connect-src 'self' https:\/\/login\.microsoftonline\.com;/);
  assert.match(policy,/script-src 'self';/);assert.match(policy,/frame-ancestors 'none';/);
  assert.equal(response.headers.get('cross-origin-opener-policy'),null);
});
test('only exact helper POST has finite 65s/32KiB budget; image and other API budgets remain unchanged',async t=>{
  const calls=[];const get=await start(t,async(...args)=>{calls.push(args);return {status:200,contentType:'application/json',body:Buffer.from('{}')};});
  await get('/api/v1/me/health-helper/questions',{method:'POST',headers:{origin:'https://192.168.111.149:9443'}});
  assert.equal(calls[0][2].timeoutMs,65000);assert.equal(calls[0][2].maxBytes,32768);
  for(const p of ['/api/health','/dicomweb/studies','/api/v1/me/health-helper/questions?x=1'])await get(p);
  for(const args of calls.slice(1)){assert.equal(args[2].timeoutMs,10000);assert.equal(args[2].maxBytes,33554432);}
});

test('wallet WebP is public artwork with a bounded size; clinical and query paths remain blocked', async t => {
  const get = await start(t, () => { throw new Error('Unexpected upstream'); });
  const response = await get('/images/mediq-login-wallet.webp');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'image/webp');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,4).toString(), 'RIFF');
  assert.ok(bytes.length <= 2097152);
  for (const route of ['/assets/clinical/private.webp', '/images/mediq-login-wallet.webp?token=test']) {
    assert.ok([400,404].includes((await get(route)).status));
  }
});

test('patient self-hosted font is an exact public asset; arbitrary fonts and secrets stay blocked', async t => {
  const get=await start(t,()=>{throw new Error('Unexpected upstream');});
  const response=await get('/fonts/pretendard/PretendardVariable.woff2');
  assert.equal(response.status,200);
  assert.equal(response.headers.get('content-type'),'font/woff2');
  assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('content-security-policy'),/font-src 'self'/);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0,4).toString(),'wOF2');
  assert.ok(bytes.length<=2097152);
  for(const route of ['/fonts/unknown.woff2','/fonts/pretendard/secret.json','/fonts/pretendard/PretendardVariable.woff2?key=synthetic']) {
    assert.ok([400,404].includes((await get(route)).status));
  }
});

test('patient B metadata is default-off, forwards only to A and never borrows doctor pixel decryption',async t=>{
  const route='/patient-dicomweb/studies/1.2/series/1.2.3/instances',calls=[];
  const disabled=await start(t,async()=>{throw new Error('unexpected');});
  assert.equal((await disabled(route)).status,503);
  const enabled=await start(t,async(...args)=>{calls.push(args);return {status:200,contentType:'application/dicom+json',body:Buffer.from('[]')};},{patientSelfViewEnabled:true});
  assert.equal((await enabled(route,{headers:{authorization:'DPoP synthetic-token',dpop:'synthetic-proof','x-hipass-service-token':'spoof'}})).status,200);
  assert.equal(calls[0][0],'https://10.90.88.2:9443');assert.equal(calls[0][2].headers['x-hipass-service-token'],undefined);
  assert.equal((await enabled(route+'/1.2.3.4/rendered')).status,503);
  assert.equal((await enabled(route+'/1.2.3.4/download')).status,400);assert.equal(calls.length,1);
});

test('patient B pixel branch requires its own adapter, binds original token and clears transient bytes',async t=>{
  const path='/patient-dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/rendered';
  let output,deny=false;
  const get=await start(t,async()=>({status:200,contentType:'application/vnd.highpass.encrypted-dicom+json',body:Buffer.from('encrypted contract fixture')}),{
    patientSelfViewEnabled:true,patientImageDecryption:{openPatient:async(result,requestPath,{token})=>{
      assert.equal(requestPath,path);assert.equal(token,'synthetic-original-token');if(deny)throw new Error('PATIENT_GRANT_INACTIVE');
      output=Buffer.from('synthetic browser bytes');return {contentType:'image/png',body:output};
    }}
  });
  const response=await get(path,{headers:{authorization:'DPoP synthetic-original-token',dpop:'proof'}});
  assert.equal(response.status,200);assert.equal(await response.text(),'synthetic browser bytes');assert.ok(output.every(v=>v===0));
  deny=true;const rejected=await get(path,{headers:{authorization:'DPoP synthetic-original-token',dpop:'proof'}});
  assert.equal(rejected.status,503);assert.ok(!(await rejected.text()).includes('synthetic browser bytes'));
});
test("B portal activates the existing UI login and denies secret query, internal service routes and clinical static files", async t => {
  const get = await start(t, () => { throw new Error("Unexpected upstream"); });
  const page = await get("/hipass/");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /data-capstone="1"/u);
  assert.match(page.headers.get("content-security-policy"), /connect-src 'self'/u);
  for (const pathname of ["/gateway/data-plane/authorize", "/assets/clinical/sample.dcm", "/api/health?token=synthetic-value"]) assert.ok([400, 404].includes((await get(pathname)).status));
});
test("B mobile entry and exact PWA manifest preserve JWT activation without exposing arbitrary JSON", async t => {
  const get = await start(t, () => { throw new Error("Unexpected upstream"); });
  for (const pathname of ["/mobile", "/mobile/", "/mobile/index.html"]) {
    const page = await get(pathname);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /data-capstone="1"/);
    assert.match(html, /src="\/mobile\/app.js" type="module"/);
  }
  const manifest = await get("/mobile/manifest.json");
  assert.equal(manifest.status, 200);
  assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/);
  assert.equal((await manifest.json()).start_url, '/mobile/');
  for (const pathname of ["/mobile/secrets.json", "/config.json", "/mobile/manifest.json?key=synthetic-value"]) assert.ok([400, 404].includes((await get(pathname)).status));
});
test("B proxy preserves user proof but strips spoofed identity/service headers and sends only curated private upstream", async t => {
  const seen = [];
  const get = await start(t, async (...args) => { seen.push(args); return { status: 200, contentType: "application/json", body: Buffer.from("[]") }; });
  const response = await get("/dicomweb/studies", { headers: { authorization: "DPoP synthetic-token", dpop: "synthetic-proof", "x-hipass-role": "PLATFORM_ADMIN", "x-hipass-service-token": "spoofed", "x-forwarded-for": "spoofed" } });
  assert.equal(response.status, 200);
  assert.equal(seen[0][0], "https://10.90.88.2:9443");
  assert.equal(seen[0][2].headers.authorization, "DPoP synthetic-token");
  for (const key of ["x-hipass-role", "x-hipass-service-token", "x-forwarded-for"]) assert.equal(seen[0][2].headers[key], undefined);
  assert.equal((await get("/api/consents", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.invalid" }, body: "{}" })).status, 403);
  assert.equal(seen.length, 1);
});
test("Viewer cannot substitute preview images after denial or a transport error", () => {
  const app = readFileSync("public/app.js", "utf8");
  const block = app.slice(app.indexOf("// 2. Fetch rendered slice"), app.indexOf("function stepSlice"));
  assert.doesNotMatch(block, /showSeriesImage\(resolvePreview/u);
  assert.match(block, /hideSeriesImage\(\)/u);
  assert.match(block, /clearSliceBlobCache\(\)/u);
});

test("required B crypto never serves an undecrypted image and clears transient output after response", async t => {
  const route = "/dicomweb/studies/1.2/series/1.2.3/instances/1.2.3.4/rendered";
  const original = Buffer.from("synthetic browser output only");
  let plaintext, refuse = false;
  const get = await start(t, async () => ({ status: 200, contentType: "application/vnd.highpass.encrypted-dicom+json", body: Buffer.from("encrypted fixture") }), {
    encryptionRequired: true, imageDecryption: { async open() {
      if (refuse) throw new Error("CONSENT_REVOKED");
      plaintext = Buffer.from(original);
      return { contentType: "image/png", body: plaintext };
    } } });
  const response = await get(route);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), original);
  assert.ok(plaintext.every(byte => byte === 0));
  refuse = true;
  const denied = await get(route);
  assert.equal(denied.status, 503);
  assert.ok(!(await denied.text()).includes(original.toString()));
  assert.throws(() => createCapstoneBPortal({ root: "public", encryptionRequired: true }), /DECRYPTION_REQUIRED/);
});
