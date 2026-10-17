import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, publicEncrypt, privateDecrypt, constants, randomBytes, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { JsonStore } from '../src/store.js';
import { HipassService } from '../src/services.js';
import { authorizeDataPlane, recordDataPlaneReady } from '../src/data-plane-authorization.js';
import { ConsentBoundKeyRelease } from '../src/consent-bound-key-release.js';
import { createCapstoneImageEncryptor, createCapstoneImageDecryptor, encryptedDicomType } from '../src/capstone-encrypted-transfer.js';
import { createDataPlaneHandler } from '../src/data-plane-gateway.js';
import { createCapstoneBPortal } from '../src/capstone-b-portal.js';
import { createBPacsReceiver, loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';
import { HCC_SOURCE_CONTRACT } from '../src/hcc-source-contract.js';

const dataset = path.resolve('artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010');
const digest = value => createHash('sha256').update(value).digest('hex');

test('one consented synthetic DICOM traverses B Portal and A Gateway into B receiver with correlated audits', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'hp-a-to-b-flow-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const manifest = JSON.parse(await readFile(path.join(dataset, 'manifest.json'), 'utf8'));
  assert.equal(manifest.canonicalManifestSha256, HCC_SOURCE_CONTRACT.manifestSha256);
  const source = manifest.instances[0];
  const dicom = await readFile(path.join(dataset, source.file));
  assert.equal(dicom.length, source.bytes);
  assert.equal(digest(dicom), source.sha256);

  const store = new JsonStore(path.join(directory, 'control.json'));
  await store.load();
  const now = new Date();
  const service = new HipassService(store, () => now.toISOString(), { tokenSecret: randomBytes(32).toString('hex') });
  const consent = store.get('consents').find(row => row.consentId === 'CONSENT-DEMO-ACTIVE');
  consent.permission = 'DOWNLOAD_ALLOWED';
  consent.validFrom = new Date(now.getTime() - 1000).toISOString();
  consent.validUntil = new Date(now.getTime() + 60000).toISOString();
  const study = store.get('imagingStudies').find(row => row.studyInstanceUid === '1.2.410.100.1.20260620.001');
  study.studyInstanceUid = HCC_SOURCE_CONTRACT.studyUid;
  study.series = [{ seriesInstanceUid: HCC_SOURCE_CONTRACT.seriesUid }];
  for (const scope of store.get('consentScopes').filter(row => row.consentId === consent.consentId)) {
    scope.studyInstanceUid = HCC_SOURCE_CONTRACT.studyUid;
    scope.seriesInstanceUid = HCC_SOURCE_CONTRACT.seriesUid;
  }

  const keyId = `https://capstone-demo.vault.azure.net/keys/demo/${'a'.repeat(32)}`;
  const publicBaseUrl = 'https://192.168.111.149:9443';
  const configuration = { sourceHospitalId: 'HOSP-A', recipientHospitalId: 'HOSP-B', publicBaseUrl, keyId, pacsImportEnabled: true };
  const requestPath = `/dicomweb/studies/${HCC_SOURCE_CONTRACT.studyUid}/series/${HCC_SOURCE_CONTRACT.seriesUid}/instances/${source.sopInstanceUID}/import`;
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const issueBoundToken = async () => {
    const issued = await service.requestDicomAccessToken({ consentId: consent.consentId, doctorId: 'DOC-B-01',
      requestingHospitalId: 'HOSP-B', purpose: 'TREATMENT', requestedAction: 'DOWNLOAD',
      studyInstanceUid: HCC_SOURCE_CONTRACT.studyUid, seriesInstanceUid: HCC_SOURCE_CONTRACT.seriesUid });
    assert.equal(issued.decision, 'ALLOWED', issued.reasonCode);
    const proofKeys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = proofKeys.publicKey.export({ format: 'jwk' });
    const claims = service.verifyAccessTokenSignature(issued.accessToken).claims;
    claims.cnf = { jkt: createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y })).digest('base64url') };
    const token = service.signAccessToken(claims);
    store.get('dicomAccessTokenLogs').find(row => row.tokenId === claims.jti).tokenHash = `sha256:${digest(token)}`;
    return { token, proof() {
      const proofBody = `${encode({ typ: 'dpop+jwt', alg: 'ES256', jwk })}.${encode({ htm: 'POST', htu: publicBaseUrl + requestPath,
        jti: randomUUID(), iat: Math.floor(now.getTime() / 1000), ath: createHash('sha256').update(token).digest('base64url') })}`;
      return `${proofBody}.${sign('sha256', Buffer.from(proofBody), { key: proofKeys.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    } };
  };
  const firstAuthorization = await issueBoundToken();
  let failVerifiedAuditOnce = true;

  const transferJob = { jobId: randomUUID(), itemId: randomUUID(), leaseId: randomUUID() };
  const transferState = { state: 'IN_PROGRESS', sha256: null };
  const transferReports = [];
  const transferJobRepository = {
    async assertActiveLease(input) {
      transferReports.push({ phase: 'BEFORE_IMPORT', input });
      assert.equal(input.jobId, transferJob.jobId);
      assert.equal(input.itemId, transferJob.itemId);
      assert.equal(input.leaseId, transferJob.leaseId);
      assert.equal(input.actorId, 'DOC-B-01');
      if (transferState.state !== 'IN_PROGRESS') throw new Error('TRANSFER_LEASE_LOST');
      return true;
    },
    async recordVerifiedReceipt(input) {
      transferReports.push({ phase: 'PACS_VERIFIED', input });
      assert.equal(transferState.state, 'IN_PROGRESS');
      assert.equal(input.jobId, transferJob.jobId);
      assert.equal(input.itemId, transferJob.itemId);
      assert.equal(input.leaseId, transferJob.leaseId);
      transferState.state = 'SUCCEEDED'; transferState.sha256 = input.sha256;
      return { accepted: true, replay: false };
    }
  };

  const releases = new Map();
  const repository = { persistent: true,
    async create(record) { releases.set(record.releaseId, record); },
    async read(id) { return releases.get(id); },
    async consume(id) { const record = releases.get(id); if (!record || record.consumed) return false; record.consumed = true; return true; } };
  const policy = new ConsentBoundKeyRelease({ service, repository, transferJobRepository, configuration });
  const control = async (endpoint, body) => {
    try {
      if (endpoint === '/gateway/data-plane/authorize') return await authorizeDataPlane(service, body, configuration);
      if (endpoint === '/gateway/data-plane/ready') return await recordDataPlaneReady(service, body, configuration);
      if (endpoint === '/gateway/data-plane/package/wrap-authorize') return { status: 200, body: { authorized: await policy.authorizeWrap(body) } };
      if (endpoint === '/gateway/data-plane/package/prepare') return { status: 200, body: await policy.prepare(body) };
      if (endpoint === '/gateway/data-plane/package/authorize') return { status: 200,
        body: { authorized: await policy.authorize({ ...body, authenticatedHospitalId: 'HOSP-B' }) } };
      if (endpoint === '/gateway/data-plane/package/import-authorize' && body.phase === 'PACS_VERIFIED' && failVerifiedAuditOnce) {
        failVerifiedAuditOnce = false;
        return { status: 503, body: { error: 'SYNTHETIC_AUDIT_INTERRUPTION' } };
      }
      if (endpoint === '/gateway/data-plane/package/import-authorize') return { status: 200,
        body: { authorized: await policy.authorizeImport({ ...body, authenticatedHospitalId: 'HOSP-B' }) } };
      return { status: 404, body: { error: 'TEST_CONTROL_ROUTE_NOT_FOUND' } };
    } catch {
      return { status: 403, body: { error: 'TEST_POLICY_DENIED' } };
    }
  };

  const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const keyTransport = async ({ url, body }) => {
    const unwrap = url.includes('/unwrapkey?');
    const input = Buffer.from(body.value, 'base64url');
    const output = unwrap
      ? privateDecrypt({ key: rsa.privateKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, input)
      : publicEncrypt({ key: rsa.publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, input);
    const value = output.toString('base64url');
    input.fill(0);
    output.fill(0);
    return { kid: keyId, value };
  };
  const tokenProvider = async () => 'synthetic-key-vault-token';

  const handler = createDataPlaneHandler({ publicBaseUrl, controlOrigin: 'https://control.test', orthancOrigin: 'https://orthanc.test',
    serviceToken: randomBytes(32).toString('base64url'), encryptionRequired: true,
    imageEncryptionFactory: requestControl => createCapstoneImageEncryptor({ keyId, tokenProvider, control: requestControl, keyTransport, now: () => now }),
    transport: async (origin, pathname, options) => {
      if (origin === 'https://control.test') {
        const result = await control(pathname, JSON.parse(options.body));
        return { status: result.status, contentType: 'application/json', body: Buffer.from(JSON.stringify(result.body)) };
      }
      assert.equal(origin, 'https://orthanc.test');
      assert.equal(pathname, `/dicom-web/studies/${HCC_SOURCE_CONTRACT.studyUid}/series/${HCC_SOURCE_CONTRACT.seriesUid}/instances/${source.sopInstanceUID}`);
      return { status: 200, contentType: 'application/dicom', body: Buffer.from(dicom) };
    } });
  const server = createServer((request, response) => { void handler(request, response); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => server.close(resolve)));

  const destination = new Map();
  const orthancId = '11111111-22222222-33333333-44444444-55555555';
  let pacsWriteCount = 0;
  const pacs = async (pathname, options) => {
    if (pathname === '/tools/find') {
      const query = JSON.parse(options.body.toString('utf8')).Query.SOPInstanceUID;
      return { status: 200, body: Buffer.from(JSON.stringify(destination.has(query) ? [orthancId] : [])) };
    }
    if (pathname === '/instances' && options.method === 'POST') {
      const existing = destination.has(source.sopInstanceUID);
      destination.set(source.sopInstanceUID, Buffer.from(options.body));
      pacsWriteCount++;
      return { status: 200, body: Buffer.from(JSON.stringify({ Status: existing ? 'AlreadyStored' : 'Success', ID: orthancId })) };
    }
    if (pathname === `/instances/${orthancId}`) return { status: 200, body: Buffer.from(JSON.stringify({ MainDicomTags: { SOPInstanceUID: source.sopInstanceUID } })) };
    if (pathname === `/instances/${orthancId}/file`) return { status: 200, body: Buffer.from(destination.get(source.sopInstanceUID) ?? []) };
    throw new Error('TEST_PACS_ROUTE_NOT_FOUND');
  };
  const receiver = createBPacsReceiver({ lookupExpected: loadPinnedBImportManifest(path.join(dataset, 'manifest.json')),
    pacs,
    // In-memory test double: it proves import sequencing, not encrypted-at-rest storage readiness.
    assertStorageReady: async () => {},
    authorize: body => control('/gateway/data-plane/package/import-authorize', body) });

  const decryptor = createCapstoneImageDecryptor({ keyId, tokenProvider, control,
    publicBaseUrl, recipientHospitalId: 'HOSP-B', keyTransport, now: () => now });
  const sourceAddress = server.address();
  const observedCiphertexts = [];
  const observedContentTypes = [];
  const portalHandler = createCapstoneBPortal({ root: path.resolve('public'), ca: Buffer.from('synthetic-test-ca'),
    origin: publicBaseUrl, encryptionRequired: true, imageDecryption: decryptor, pacsReceiver: receiver,
    importTransport: async (origin, pathname, options) => {
      assert.equal(origin, 'https://10.90.88.2:9443');
      const forwarded = await fetch(`http://127.0.0.1:${sourceAddress.port}${pathname}`, {
        method: options.method, headers: options.headers, signal: AbortSignal.timeout(options.timeoutMs) });
      const body = Buffer.from(await forwarded.arrayBuffer());
      const contentType = forwarded.headers.get('content-type');
      observedCiphertexts.push(body);
      observedContentTypes.push(contentType);
      return { status: forwarded.status, contentType, body };
    } });
  const portal = createServer((request, response) => { void portalHandler(request, response); });
  await new Promise((resolve, reject) => { portal.once('error', reject); portal.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise(resolve => portal.close(resolve)));

  const sendImport = authorization => fetch(`http://127.0.0.1:${portal.address().port}${requestPath}`, {
    method: 'POST', headers: { origin: publicBaseUrl, authorization: `DPoP ${authorization.token}`, dpop: authorization.proof(),
      'x-hipass-transfer-job-id': transferJob.jobId, 'x-hipass-transfer-item-id': transferJob.itemId,
      'x-hipass-transfer-lease-id': transferJob.leaseId },
    signal: AbortSignal.timeout(20000) });

  try {
    const interrupted = await sendImport(firstAuthorization);
    assert.equal(interrupted.status, 503);
    await interrupted.arrayBuffer();
    assert.equal(destination.size, 1, 'PACS write happened before the final audit interruption');
    assert.equal(pacsWriteCount, 1);
    assert.equal(transferState.state, 'IN_PROGRESS', 'an interrupted final report must not complete the durable job');
    assert.equal(store.get('auditLogs').some(row => row.action === 'PACS_INSTANCE_VERIFIED'), false,
      'a stored object without final audit must not be reported as verified');

    const resumedAuthorization = await issueBoundToken();
    const response = await sendImport(resumedAuthorization);
    assert.equal(response.status, 200);
    assert.ok(observedContentTypes.every(value => value === encryptedDicomType));
    assert.ok(observedCiphertexts.every(body => !body.includes(dicom)));
    const receipt = await response.json();
    assert.equal(receipt.status, 'PACS_INSTANCE_VERIFIED');
    assert.equal(receipt.sopInstanceUid, source.sopInstanceUID);
    assert.equal(receipt.sha256, source.sha256);
    assert.equal(receipt.bytes, source.bytes);
    assert.equal(receipt.manifestSha256, HCC_SOURCE_CONTRACT.manifestSha256);
    assert.equal(receipt.alreadyStored, true, 'retry reconciles the existing PACS object instead of overwriting it');
    assert.equal(digest(destination.get(source.sopInstanceUID)), source.sha256);
    assert.equal(destination.size, 1);
    assert.equal(pacsWriteCount, 1);
    assert.equal(transferState.state, 'SUCCEEDED');
    assert.equal(transferState.sha256, source.sha256);
    assert.equal(transferReports.some(row => row.phase === 'PACS_VERIFIED'), true);

    consent.status = 'REVOKED';
    const revoked = await sendImport(resumedAuthorization);
    assert.equal(revoked.status, 403, 'A rejects a still-unexpired token after consent revocation');
    await revoked.arrayBuffer();
    assert.equal(pacsWriteCount, 1);

    consent.status = 'ACTIVE';
    consent.validUntil = new Date(now.getTime() + 60000).toISOString();
    now.setTime(now.getTime() + 61000);
    const expired = await sendImport(resumedAuthorization);
    assert.equal(expired.status, 403, 'A rejects access after the current consent expires');
    await expired.arrayBuffer();
    assert.equal(pacsWriteCount, 1);
  } finally {
    for (const body of observedCiphertexts) body.fill(0);
    dicom.fill(0);
    for (const stored of destination.values()) stored.fill(0);
  }

  const requiredActions = ['KEY_WRAP_AUTHORIZED', 'KEY_RELEASE_PREPARED', 'KEY_RELEASE_PRECHECKED', 'KEY_RELEASE_CONSUMED',
    'DATA_PLANE_RESPONSE_PREPARED', 'PACS_IMPORT_AUTHORIZED', 'PACS_INSTANCE_VERIFIED'];
  const audit = store.get('auditLogs');
  for (const action of requiredActions) assert.ok(audit.some(row => row.action === action && row.result === 'SUCCESS'), `missing audit ${action}`);
  const verified = audit.find(row => row.action === 'PACS_INSTANCE_VERIFIED');
  assert.equal(verified.consentId, consent.consentId);
  assert.equal(verified.studyInstanceUid, HCC_SOURCE_CONTRACT.studyUid);
  assert.equal(verified.seriesInstanceUid, HCC_SOURCE_CONTRACT.seriesUid);
  assert.equal(verified.sopInstanceUid, source.sopInstanceUID);
  assert.equal(verified.hospitalId, 'HOSP-B');
});
