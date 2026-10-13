import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, publicEncrypt, privateDecrypt, constants, randomBytes, createHash, sign, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { JsonStore } from "../src/store.js";
import { HipassService } from "../src/services.js";
import { authorizeDataPlane, parseDataPlaneRequest } from "../src/data-plane-authorization.js";
import { ConsentBoundKeyRelease } from "../src/consent-bound-key-release.js";
import { createCapstoneImageEncryptor, createCapstoneImageDecryptor, encryptedDicomType } from "../src/capstone-encrypted-transfer.js";

async function setup(t, { unwrapControlDelayMs = 0, importing = false } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "hp-encrypted-route-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new JsonStore(path.join(directory, "db.json")); await store.load();
  const current = new Date();
  const service = new HipassService(store, () => current.toISOString(), { tokenSecret: randomBytes(32).toString("hex") });
  const config = { sourceHospitalId: "HOSP-A", recipientHospitalId: "HOSP-B", publicBaseUrl: "https://192.168.111.149:9443",
    keyId: `https://capstone-demo.vault.azure.net/keys/demo/${"a".repeat(32)}`, pacsImportEnabled: importing };
  // Seed consent expires before this future test clock; keep synthetic bounds explicit.
  const consent = store.get("consents").find(row => row.consentId === "CONSENT-DEMO-ACTIVE");
  consent.validFrom = new Date(current.getTime() - 1000).toISOString();
  consent.validUntil = new Date(current.getTime() + 60000).toISOString();
  const study = "1.2.410.100.1.20260620.001", series = study + ".1";
  const requestPath = `/dicomweb/studies/${study}/series/${series}/instances/${series}.1/${importing ? 'import' : 'rendered'}`;
  if (importing) consent.permission = 'DOWNLOAD_ALLOWED';
  const issued = await service.requestDicomAccessToken({ consentId: consent.consentId, doctorId: "DOC-B-01", requestingHospitalId: "HOSP-B", purpose: "TREATMENT", requestedAction: importing ? 'DOWNLOAD' : "VIEW", studyInstanceUid: study, seriesInstanceUid: series });
  const input = { method: importing ? 'POST' : 'GET', path: requestPath, token: issued.accessToken, authorizationScheme: "Bearer", clientIp: "192.0.2.1" };
  if (importing) {
    const proofKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' }), jwk = proofKeys.publicKey.export({ format: 'jwk' });
    const claims = service.verifyAccessTokenSignature(input.token).claims;
    claims.cnf = { jkt: createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url') };
    input.token = service.signAccessToken(claims);
    store.get('dicomAccessTokenLogs').find(x => x.tokenId === claims.jti).tokenHash = 'sha256:' + createHash('sha256').update(input.token).digest('hex');
    input.authorizationScheme = 'DPoP';
    const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const data = `${encode({ typ: 'dpop+jwt', alg: 'ES256', jwk })}.${encode({ jti: randomUUID(), htm: 'POST', htu: config.publicBaseUrl + requestPath,
      iat: current.getTime() / 1000 | 0, ath: createHash('sha256').update(input.token).digest('base64url') })}`;
    input.dpopProof = data + '.' + sign('sha256', Buffer.from(data), { key: proofKeys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  }
  const granted = await authorizeDataPlane(service, input, config);
  assert.equal(granted.status, 200);
  const rows = new Map(); // Explicit fixture, NOT a persistence/real Vault claim.
  const repository = { persistent: true, async create(row) { rows.set(row.releaseId, row); }, async read(id) { return rows.get(id); },
    async consume(id) { const row = rows.get(id); if (!row || row.consumed) return false; row.consumed = true; return true; } };
  const authority = new ConsentBoundKeyRelease({ service, repository, configuration: config });
  const control = async (endpoint, body) => {
    try {
      if (endpoint.endsWith("/authorize") && unwrapControlDelayMs) await new Promise(resolve => setTimeout(resolve, unwrapControlDelayMs));
      if (endpoint.endsWith("/wrap-authorize")) return { status: 200, body: { authorized: await authority.authorizeWrap(body) } };
      if (endpoint.endsWith("/prepare")) return { status: 200, body: await authority.prepare(body) };
      return { status: 200, body: { authorized: await authority.authorize({ ...body, authenticatedHospitalId: "HOSP-B" }) } };
    } catch { return { status: 403, body: { error: "DENIED" } }; }
  };
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let afterUnwrap = () => {};
  const keyTransport = async ({ url, body }) => {
    const options = { key: url.includes("/unwrapkey?") ? keys.privateKey : keys.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" };
    const input = Buffer.from(body.value, "base64url");
    const output = url.includes("/unwrapkey?") ? privateDecrypt(options, input) : publicEncrypt(options, input);
    if (url.includes("/unwrapkey?")) afterUnwrap();
    const value = output.toString("base64url"); output.fill(0); input.fill(0);
    return { kid: config.keyId, value };
  };
  const dependencies = { keyId: config.keyId, tokenProvider: async () => "synthetic-token", control, keyTransport, now: () => current };
  const a = createCapstoneImageEncryptor(dependencies);
  const b = createCapstoneImageDecryptor({ ...dependencies, publicBaseUrl: config.publicBaseUrl, recipientHospitalId: "HOSP-B" });
  const body = Buffer.from("synthetic image response only");
  const seal = () => a.seal({ body, contentType: importing ? 'application/dicom' : "image/png", route: parseDataPlaneRequest({ method: input.method, path: requestPath }, config.publicBaseUrl), grant: granted.body });
  return { a, b, seal, body, store, current, requestPath, setAfterUnwrap: callback => { afterUnwrap = callback; } };
}

test('POST import retains DOWNLOAD + method/path-bound crypto and one-use release', async t => {
  const { seal, b, requestPath, body } = await setup(t, { importing: true });
  const result = await seal();
  await assert.rejects(b.open(result, requestPath), /ROUTE_INVALID|SCOPE_MISMATCH/);
  const decoded = await b.open(result, requestPath, { method: 'POST' });
  assert.deepEqual(decoded.body, body); assert.ok(decoded.importContext.releaseId); decoded.body.fill(0);
  await assert.rejects(b.open(result, requestPath, { method: 'POST' }), /KV_POLICY_DENIED/);
});

test("encrypted hospital transport uses live consent wrap/pre/post authority and one-time RSA/AES roundtrip", async t => {
  const { seal, b, body, requestPath } = await setup(t);
  const ciphertext = await seal();
  assert.equal(ciphertext.contentType, encryptedDicomType);
  assert.ok(!ciphertext.body.includes(body));
  const restored = await b.open(ciphertext, requestPath);
  assert.deepEqual(restored.body, body); restored.body.fill(0);
  await assert.rejects(b.open(ciphertext, requestPath), /KV_POLICY_DENIED/);
});

test("no plaintext fallback, substituted MIME/chunk and other Instance route deny", async t => {
  const { seal, b, body, requestPath } = await setup(t);
  await assert.rejects(b.open({ body, contentType: "image/png" }, requestPath), /REQUIRED/);
  const ciphertext = await seal();
  await assert.rejects(b.open(ciphertext, requestPath.replace(/\/rendered$/u, "/download")), /SCOPE_MISMATCH/);
  for (const tamper of [payload => { payload.contentType = "image/jpeg"; }, payload => { payload.chunks[0].tag = "A".repeat(22); }]) {
    const payload = JSON.parse(ciphertext.body.toString()); tamper(payload);
    await assert.rejects(b.open({ ...ciphertext, body: Buffer.from(JSON.stringify(payload)) }, requestPath), /KV_POLICY_DENIED/);
  }
});

test("revocation while unwrap is in flight and elapsed package expiry never release plaintext", async t => {
  const { seal, b, store, requestPath, setAfterUnwrap, current } = await setup(t);
  const ciphertext = await seal();
  setAfterUnwrap(() => { store.get("consents").find(row => row.consentId === "CONSENT-DEMO-ACTIVE").status = "REVOKED"; });
  await assert.rejects(b.open(ciphertext, requestPath), /KV_POLICY_DENIED/);
  store.get("consents").find(row => row.consentId === "CONSENT-DEMO-ACTIVE").status = "ACTIVE";
  setAfterUnwrap(() => {}); current.setTime(current.getTime() + 31000);
  await assert.rejects(b.open(ciphertext, requestPath), /KV_POLICY_DENIED/);
});

test("bounded crypto budget accommodates both preserved five-second live policy delays", {timeout:20000}, async t => {
  const {seal,b,body,requestPath}=await setup(t,{unwrapControlDelayMs:5100});
  const encrypted=await seal();
  const began=performance.now();
  const restored=await b.open(encrypted,requestPath);
  assert.ok(performance.now()-began>=10000);
  assert.deepEqual(restored.body,body);
  restored.body.fill(0);
  // The same consumed package remains rejected, not made reusable by budget changes.
  await assert.rejects(b.open(encrypted,requestPath),/KV_POLICY_DENIED/);
});
