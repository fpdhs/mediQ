import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';

const app = readFileSync(process.env.PACS_STORE_CANDIDATE_APP || new URL('../public/app.js', import.meta.url), 'utf8');
const start = app.indexOf('let proofKeyPromise;');
const end = app.indexOf('function developmentPrincipalHeaders');
const routingSource = app.slice(start, end);
const demoOrigin = 'https://highpass-demo.japaneast.cloudapp.azure.com';
const imageOrigin = 'https://highpass-images-b.japaneast.cloudapp.azure.com';
const route = '/dicomweb/studies/2.25.1/series/2.25.2/instances/2.25.3/import';

async function browserFetch(path, options, tokenPayload = { cnf: { jkt: 'synthetic-thumbprint' } }) {
  const calls = [];
  const token = `header.${Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')}.signature`;
  const context = vm.createContext({
    Headers, URL, AbortSignal, TextEncoder, crypto: webcrypto, atob, btoa,
    location: { hostname: 'highpass-demo.japaneast.cloudapp.azure.com', origin: demoOrigin },
    document: { documentElement: { dataset: { capstone: '1' } } },
    fetch: async (url, request) => { calls.push({ url, request }); return new Response('{}', { status: 200 }); },
  });
  vm.runInContext(routingSource, context);
  const request = { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers ?? {}) } };
  const response = await vm.runInContext(`proofFetch(${JSON.stringify(path)}, ${JSON.stringify(request)})`, context);
  return { calls, response, token };
}

test('Azure web sends only selected DPoP import to the B image origin', async () => {
  const { calls, token } = await browserFetch(route, { method: 'POST' });
  assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).origin, imageOrigin);
  assert.equal(new URL(calls[0].url).pathname, route);
  assert.equal(calls[0].request.method, 'POST');
  assert.equal(calls[0].request.credentials, 'omit');
  assert.equal(calls[0].request.redirect, 'error');
  assert.equal(calls[0].request.cache, 'no-store');
  const headers = new Headers(calls[0].request.headers);
  assert.equal(headers.get('authorization'), `DPoP ${token}`);
  const proofParts = headers.get('dpop').split('.');
  const proof = JSON.parse(Buffer.from(proofParts[1], 'base64url').toString('utf8'));
  assert.equal(proof.htm, 'POST');
  assert.equal(proof.htu, `${imageOrigin}${route}`);
  assert.ok(proof.ath);
});

test('unbound token is rejected before a cross-origin import request', async () => {
  await assert.rejects(browserFetch(route, { method: 'POST' }, {}), /PACS_IMPORT_DPOP_REQUIRED/);
});

test('Azure edge allowlist contains only scoped DICOM reads and single-instance import', () => {
  const caddy = readFileSync(new URL('../infra/azure/patient-images-b.Caddyfile', import.meta.url), 'utf8');
  const getPattern = new RegExp(caddy.match(/path_regexp clinician_get\s+(\S+)/u)[1]);
  const importPattern = new RegExp(caddy.match(/path_regexp clinician_import\s+(\S+)/u)[1]);
  assert.equal(getPattern.test('/dicomweb/studies'), true);
  assert.equal(getPattern.test('/dicomweb/studies/2.25.1/series'), true);
  assert.equal(getPattern.test('/dicomweb/studies/2.25.1/series/2.25.2/instances'), true);
  assert.equal(getPattern.test('/dicomweb/studies/2.25.1/series/2.25.2/instances/2.25.3/rendered'), true);
  assert.equal(getPattern.test(route), false);
  assert.equal(importPattern.test(route), true);
  assert.equal(importPattern.test(route.replace('/import', '/download')), false);
  assert.match(caddy, /respond @query[^\n]*403/u);
  assert.equal((caddy.match(/header Origin https:\/\/highpass-demo\.japaneast\.cloudapp\.azure\.com/gu) ?? []).length >= 4, true);
  assert.doesNotMatch(caddy, /Access-Control-Allow-Credentials/u);
  assert.match(caddy, /response_header_timeout 60s/u);
  assert.match(caddy, /write 65s/u);
  assert.match(caddy,/Access-Control-Allow-Headers "authorization, dpop, x-hipass-transfer-item-id, x-hipass-transfer-job-id, x-hipass-transfer-lease-id"/u);
  const rollout = readFileSync(new URL('../scripts/patient-viewer-rollout-remote.py', import.meta.url), 'utf8');
  assert.ok(rollout.includes(caddy.match(/path_regexp clinician_import\s+(\S+)/u)[1]));
  assert.ok(rollout.includes(caddy.match(/header_regexp Access-Control-Request-Headers\s+(\S+)/u)[1]));
  assert.ok(rollout.includes("conf['environment']['CAPSTONE_B_IMPORT_BROWSER_ORIGIN']='https://highpass-demo.japaneast.cloudapp.azure.com'"));
});
