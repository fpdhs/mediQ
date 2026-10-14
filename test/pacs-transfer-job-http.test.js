import test from "node:test";
import assert from "node:assert/strict";
import { createPacsTransferJobHttpHandler } from "../src/pacs-transfer-job-http.js";

const jobId = "a11ce000-1111-4111-8111-111111111111";
const future = () => new Date(Date.now() + 60_000).toISOString();
const consent = (overrides = {}) => ({ consentId: "consent-demo-01", patientId: "patient-demo-01",
  sourceHospitalId: "HOSP-A", targetHospitalId: "HOSP-B", purpose: "TREATMENT",
  permission: "DOWNLOAD_ALLOWED", validFrom: new Date(Date.now() - 60_000).toISOString(),
  validUntil: future(), status: "ACTIVE", ...overrides });
const item = (index = 1, seriesInstanceUid = "1.2.3.4") => ({ studyInstanceUid: "1.2.3",
  seriesInstanceUid, sopInstanceUid: `${seriesInstanceUid}.${index}` });

function harness({ consentRow = consent(), policyDecision = "ALLOWED", created = true, principal = {
  role: "DOCTOR", doctorId: "doctor-demo-01", hospitalId: "HOSP-B" }, jobValidUntil = consentRow.validUntil } = {}) {
  const calls = { creates: [], reads: [], active: [], claims: [], finishes: [], policies: [], audits: [], saves: 0 };
  const repo = {
    async create(input) { calls.creates.push(input); return { jobId, created }; },
    async read(id, actorId) { calls.reads.push({ id, actorId }); return id === jobId && actorId === "doctor-demo-01"
      ? { jobId, actorId, targetHospitalId: "HOSP-B", auditSessionId: "transfer-test", consentId: consentRow.consentId,
        sourceHospitalId: "HOSP-A", purpose: "TREATMENT", permission: "DOWNLOAD_ALLOWED", validUntil: jobValidUntil,
        state: "CREATED", totalItems: 1, succeededItems: 0, failedItems: 0, items: [] } : null; },
    async listActive(actorId, targetHospitalId) { calls.active.push({ actorId, targetHospitalId }); return [
      { jobId, state: "IN_PROGRESS", totalItems: 2, succeededItems: 1, failedItems: 0 }]; },
    async claimNext(id, actorId) { calls.claims.push({ id, actorId }); return { leaseId: "b22ce000-2222-4222-8222-222222222222",
      item: { itemId: "c33ce000-3333-4333-8333-333333333333", ordinal: 1, ...item(), state: "IN_PROGRESS" } }; },
    async finishItem(input) { calls.finishes.push(input); return { state: "FAILED" }; }
  };
  const service = {
    store: { get(name) { return name === "consents" ? [consentRow] : []; }, async save() { calls.saves++; } },
    effectiveConsentStatus(row) { return row.status; },
    async evaluateDicomAccessRequest(input) { calls.policies.push(input); return { decision: policyDecision, reasonCode: "SCOPE_MISMATCH" }; },
    async writeAudit(event) { calls.audits.push(event); }
  };
  const route = createPacsTransferJobHttpHandler({ repository: repo, service,
    readJson: async request => request.body });
  return { route, repo, service, calls, principal };
}

function responseRecorder() {
  return { headers: {}, setHeader(name, value) { this.headers[name] = value; },
    writeHead(status, headers) { this.status = status; Object.assign(this.headers, headers); },
    end(body) { this.body = body; }, json() { return JSON.parse(this.body); } };
}

async function call(h, { method = "POST", path = "/api/pacs-transfer-jobs", body, headers = {}, principal = h.principal } = {}) {
  const response = responseRecorder();
  const handled = await h.route({ method, headers, body, resume() {} }, response, new URL(path, "https://control.example"), principal,
    { ipAddress: "127.0.0.1", userAgent: "test" });
  return { handled, response };
}

test("job API derives actor, hospitals, purpose and consent expiry from server authority", async () => {
  const h = harness();
  const { handled, response } = await call(h, { body: { consentId: "consent-demo-01", items: [item(1), item(2)] },
    headers: { "idempotency-key": "synthetic-job-request-0001" } });
  assert.equal(handled, true);
  assert.equal(response.status, 202);
  assert.deepEqual(response.json(), { jobId, created: true });
  assert.equal(h.calls.creates.length, 1);
  const created = h.calls.creates[0];
  assert.equal(created.actorId, "doctor-demo-01");
  assert.equal(created.sourceHospitalId, "HOSP-A");
  assert.equal(created.targetHospitalId, "HOSP-B");
  assert.equal(created.purpose, "TREATMENT");
  assert.equal(created.permission, "DOWNLOAD_ALLOWED");
  assert.equal(created.validUntil, h.service.store.get("consents")[0].validUntil);
  assert.match(created.auditSessionId, /^transfer-/u);
  assert.equal(created.items.every(value => value.sourceSha256 === undefined), true);
  assert.equal(h.calls.policies.length, 1, "same Study/Series scope is policy-checked once");
  assert.equal(h.calls.audits[0].action, "PACS_TRANSFER_JOB_CREATED");
  assert.equal(h.calls.saves, 1);
});

test("idempotent job replay reuses the persisted audit session", async () => {
  const h = harness({ created: false });
  const { response } = await call(h, { body: { consentId: "consent-demo-01", items: [item()] },
    headers: { "idempotency-key": "synthetic-job-request-0001" } });
  assert.equal(response.status, 200);
  assert.deepEqual(response.json(), { jobId, created: false });
  assert.equal(h.calls.audits[0].action, "PACS_TRANSFER_JOB_IDEMPOTENT_REPLAY");
  assert.equal(h.calls.audits[0].auditSessionId, "transfer-test");
});

test("job API rejects caller-selected identity, permissions, purpose, hashes and duplicate SOPs", async () => {
  const h = harness();
  const invalidBodies = [
    [{ consentId: consent().consentId, actorId: "another-doctor", items: [item()] }, 400],
    [{ consentId: consent().consentId, purpose: "RESEARCH", items: [item()] }, 400],
    [{ consentId: consent().consentId, items: [{ ...item(), sourceSha256: "a".repeat(64) }] }, 400],
    [{ consentId: consent().consentId, items: [item(), item()] }, 409]
  ];
  for (const [body, status] of invalidBodies) {
    const { response } = await call(h, { body, headers: { "idempotency-key": "synthetic-job-request-0001" } });
    assert.equal(response.status, status);
  }
  assert.equal(h.calls.creates.length, 0);
});

test("job API bounds policy fanout and requires idempotency before policy work", async () => {
  const h = harness();
  const manyScopes = Array.from({ length: 101 }, (_, index) => {
    const seriesInstanceUid = `1.2.3.4.${index + 1}`;
    return { studyInstanceUid: "1.2.3", seriesInstanceUid, sopInstanceUid: `${seriesInstanceUid}.1` };
  });
  const tooMany = await call(h, { body: { consentId: consent().consentId, items: manyScopes },
    headers: { "idempotency-key": "synthetic-job-request-0001" } });
  assert.equal(tooMany.response.status, 400);
  const missingKey = await call(h, { body: { consentId: consent().consentId, items: [item()] } });
  assert.equal(missingKey.response.json().error, "IDEMPOTENCY_KEY_INVALID");
  assert.equal(h.calls.policies.length, 0);
  assert.equal(h.calls.creates.length, 0);
});

test("job API fails closed on consent, permission, hospital and series policy denial", async () => {
  for (const options of [
    { consentRow: consent({ status: "REVOKED" }) },
    { consentRow: consent({ permission: "VIEW_ONLY" }) },
    { consentRow: consent({ targetHospitalId: "HOSP-C" }) },
    { policyDecision: "DENIED" }
  ]) {
    const h = harness(options);
    const { response } = await call(h, { body: { consentId: "consent-demo-01", items: [item()] },
      headers: { "idempotency-key": "synthetic-job-request-0001" } });
    assert.ok(response.status === 403);
    assert.equal(h.calls.creates.length, 0);
  }
});

test("job status is private to the original doctor and receiving hospital", async () => {
  const h = harness();
  const own = await call(h, { method: "GET", path: `/api/pacs-transfer-jobs/${jobId}` });
  assert.equal(own.response.status, 200);
  assert.equal(own.response.headers["cache-control"], "no-store");
  assert.equal(h.calls.audits.at(-1).action, "PACS_TRANSFER_JOB_STATUS_READ");
  const otherDoctor = await call(h, { method: "GET", path: `/api/pacs-transfer-jobs/${jobId}`,
    principal: { role: "DOCTOR", doctorId: "doctor-other", hospitalId: "HOSP-B" } });
  assert.equal(otherDoctor.response.status, 404);
  const otherHospital = await call(h, { method: "GET", path: `/api/pacs-transfer-jobs/${jobId}`,
    principal: { role: "DOCTOR", doctorId: "doctor-demo-01", hospitalId: "HOSP-C" } });
  assert.equal(otherHospital.response.status, 404);
});

test("active jobs are doctor and receiving-hospital scoped and audited", async () => {
  const h = harness();
  const { response } = await call(h, { method: "GET", path: "/api/pacs-transfer-jobs/active" });
  assert.equal(response.status, 200);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(response.json().jobs.map(({ jobId: id, state, totalItems }) => ({ id, state, totalItems })),
    [{ id: jobId, state: "IN_PROGRESS", totalItems: 2 }]);
  assert.deepEqual(h.calls.active, [{ actorId: "doctor-demo-01", targetHospitalId: "HOSP-B" }]);
  assert.equal(h.calls.audits.at(-1).action, "PACS_TRANSFER_ACTIVE_JOBS_READ");
});

test("claim returns one leased SOP only after live consent and DOWNLOAD policy revalidation", async () => {
  const h = harness();
  const { response } = await call(h, { method: "POST", path: `/api/pacs-transfer-jobs/${jobId}/claim` });
  assert.equal(response.status, 200);
  const result = response.json();
  assert.equal(result.claimed, true);
  assert.equal(result.jobId, jobId);
  assert.equal(result.leaseId, "b22ce000-2222-4222-8222-222222222222");
  assert.equal(result.item.sopInstanceUid, item().sopInstanceUid);
  assert.equal(h.calls.policies.length, 1);
  assert.equal(h.calls.policies[0].doctorId, "doctor-demo-01");
  assert.equal(h.calls.policies[0].requestedAction, "DOWNLOAD");
  assert.equal(h.calls.audits.at(-1).action, "PACS_TRANSFER_ITEM_CLAIMED");
});

test("claim compares PostgreSQL Date expirations at millisecond precision", async () => {
  const consentRow = consent();
  const h = harness({ consentRow, jobValidUntil: new Date(consentRow.validUntil) });
  const { response } = await call(h, { method: "POST", path: `/api/pacs-transfer-jobs/${jobId}/claim` });
  assert.equal(response.status, 200);
  assert.equal(response.json().claimed, true);
  assert.equal(h.calls.policies.length, 1);
});

test("claim policy denial closes its lease, halts remaining objects, and never returns the lease", async () => {
  const h = harness({ policyDecision: "DENIED" });
  const { response } = await call(h, { method: "POST", path: `/api/pacs-transfer-jobs/${jobId}/claim` });
  assert.equal(response.status, 403);
  assert.equal(response.json().error, "SCOPE_MISMATCH");
  assert.equal(h.calls.finishes.length, 1);
  assert.equal(h.calls.finishes[0].outcome, "FAILED");
  assert.equal(h.calls.finishes[0].stopRemaining, true);
  assert.equal(h.calls.audits.at(-1).action, "PACS_TRANSFER_ITEM_CLAIM_DENIED");
});

test("claim rejects body-bearing or cross-hospital requests before acquiring a lease", async () => {
  const h = harness();
  const withBody = await call(h, { method: "POST", path: `/api/pacs-transfer-jobs/${jobId}/claim`, headers: { "content-length": "1" } });
  assert.equal(withBody.response.status, 400);
  const otherHospital = await call(h, { method: "POST", path: `/api/pacs-transfer-jobs/${jobId}/claim`,
    principal: { role: "DOCTOR", doctorId: "doctor-demo-01", hospitalId: "HOSP-C" } });
  assert.equal(otherHospital.response.status, 404);
  assert.equal(h.calls.claims.length, 0);
});

test("non-doctor callers and unrelated API paths cannot use the job handler", async () => {
  const h = harness();
  const denied = await call(h, { body: { consentId: consent().consentId, items: [item()] },
    headers: { "idempotency-key": "synthetic-job-request-0001" },
    principal: { role: "PATIENT", patientId: "patient-demo-01" } });
  assert.equal(denied.response.status, 403);
  const unrelated = await call(h, { method: "GET", path: "/api/imaging-studies" });
  assert.equal(unrelated.handled, false);
});
