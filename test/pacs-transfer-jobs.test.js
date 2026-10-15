import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PacsTransferJobCoordinator, PacsTransferJobError, PostgresPacsTransferJobRepository } from "../src/pacs-transfer-jobs.js";

const actorId = "doctor-demo-01";
const sourceHospitalId = "HOSP-A";
const targetHospitalId = "HOSP-B";
const consentId = "consent-demo-01";
const auditSessionId = "audit-transfer-demo-01";
const expectedHash = "a".repeat(64);
const future = () => new Date(Date.now() + 60_000).toISOString();
const item = (index = 1) => ({
  studyInstanceUid: "1.2.3",
  seriesInstanceUid: "1.2.3.4",
  sopInstanceUid: `1.2.3.4.${index}`
});
const request = (items = [item()], extra = {}) => ({
  actorId, sourceHospitalId, targetHospitalId, consentId, auditSessionId, purpose: "TREATMENT",
  permission: "DOWNLOAD_ALLOWED", validUntil: future(), idempotencyKey: "synthetic-idempotency-key-01", items, ...extra
});
const authorization = (job, claimed, extra = {}) => ({
  ephemeral: "synthetic-worker-authorization",
  scope: { actorId: job.actorId, sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
    consentId: job.consentId, auditSessionId: job.auditSessionId, purpose: job.purpose, permission: job.permission,
    studyInstanceUid: claimed.studyInstanceUid, seriesInstanceUid: claimed.seriesInstanceUid,
    sopInstanceUid: claimed.sopInstanceUid, validUntil: job.validUntil },
  ...extra
});

class CapturePool {
  calls = [];
  items = [];
  jobId = null;
  async connect() {
    return {
      query: async (sql, values = []) => {
        this.calls.push({ sql, values });
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rowCount: 0, rows: [] };
        if (sql.includes("INSERT INTO capstone_pacs_transfer_jobs")) {
          this.jobId = values[0];
          return { rowCount: 1, rows: [{ job_id: this.jobId }] };
        }
        if (sql.includes("INSERT INTO capstone_pacs_transfer_items")) {
          this.items = JSON.parse(values[1]);
          return { rowCount: this.items.length, rows: [] };
        }
        throw new Error("UNEXPECTED_SQL");
      },
      release() {}
    };
  }
}

class MemoryJobRepository {
  constructor(items) {
    this.job = { jobId: randomUUID(), actorId, sourceHospitalId, targetHospitalId, consentId, auditSessionId,
      purpose: "TREATMENT", permission: "DOWNLOAD_ALLOWED", state: "CREATED", totalItems: items.length,
      succeededItems: 0, failedItems: 0, validUntil: future(), items: items.map((entry, index) => ({
        itemId: randomUUID(), ordinal: index + 1, ...entry, state: "PENDING", attemptCount: 0, maxAttempts: 2,
        destinationSha256: null, reasonCode: null
      })) };
    this.activeLease = null;
  }
  async claimNext(jobId, ownerId) {
    if (jobId !== this.job.jobId || ownerId !== actorId || ["COMPLETED", "FAILED", "EXPIRED", "REVOKED"].includes(this.job.state)) return null;
    if (this.activeLease) return null;
    const next = this.job.items.find(row => ["PENDING", "RETRYABLE"].includes(row.state) && row.attemptCount < row.maxAttempts);
    if (!next) return null;
    const leaseId = randomUUID();
    next.state = "IN_PROGRESS";
    next.attemptCount++;
    this.activeLease = { itemId: next.itemId, leaseId };
    this.job.state = "IN_PROGRESS";
    return { job: { ...this.job, items: undefined }, item: { ...next }, leaseId };
  }
  async finishItem({ jobId, actorId: ownerId, itemId, leaseId, outcome, reasonCode = null, receipt = null, stopRemaining = false }) {
    assert.equal(jobId, this.job.jobId);
    assert.equal(ownerId, actorId);
    assert.deepEqual(this.activeLease, { itemId, leaseId });
    const row = this.job.items.find(value => value.itemId === itemId);
    assert.ok(row);
    if (outcome === "SUCCEEDED" && (!receipt || receipt.status !== "PACS_INSTANCE_VERIFIED"
        || receipt.destinationVerification !== true || receipt.simulation === true
        || receipt.studyInstanceUid !== row.studyInstanceUid || receipt.seriesInstanceUid !== row.seriesInstanceUid
        || receipt.sopInstanceUid !== row.sopInstanceUid || !/^[a-f0-9]{64}$/u.test(receipt.sha256 ?? "")
        || (row.sourceSha256 && receipt.sha256 !== row.sourceSha256))) {
      outcome = "FAILED";
      reasonCode = "DESTINATION_RECEIPT_MISMATCH";
    }
    if (outcome === "RETRYABLE" && row.attemptCount >= row.maxAttempts) outcome = "FAILED";
    row.state = outcome;
    row.reasonCode = reasonCode;
    if (outcome === "SUCCEEDED" && row.sourceSha256 == null) row.sourceSha256 = receipt.sha256;
    row.destinationSha256 = outcome === "SUCCEEDED" ? receipt.sha256 : null;
    this.activeLease = null;
    if (stopRemaining || ["REVOKED", "EXPIRED"].includes(outcome)) {
      const haltedState = ["REVOKED", "EXPIRED"].includes(outcome) ? outcome : "FAILED";
      for (const pending of this.job.items.filter(value => ["PENDING", "RETRYABLE"].includes(value.state))) pending.state = haltedState;
      if (["REVOKED", "EXPIRED"].includes(haltedState)) this.job.state = haltedState;
      else {
        const succeeded = this.job.items.filter(value => value.state === "SUCCEEDED").length;
        this.job.failedItems = this.job.items.filter(value => ["FAILED", "EXPIRED", "REVOKED"].includes(value.state)).length;
        this.job.succeededItems = succeeded;
        this.job.state = succeeded ? "PARTIAL" : "FAILED";
      }
    } else {
      const succeeded = this.job.items.filter(value => value.state === "SUCCEEDED").length;
      const failed = this.job.items.filter(value => ["FAILED", "EXPIRED", "REVOKED"].includes(value.state)).length;
      const unfinished = this.job.items.some(value => ["PENDING", "IN_PROGRESS", "RETRYABLE"].includes(value.state));
      this.job.succeededItems = succeeded;
      this.job.failedItems = failed;
      this.job.state = unfinished ? (succeeded && failed ? "PARTIAL" : "IN_PROGRESS") : failed ? (succeeded ? "PARTIAL" : "FAILED") : "COMPLETED";
    }
    return this.read(jobId, ownerId);
  }
  async read(jobId, ownerId) { return jobId === this.job.jobId && ownerId === actorId ? structuredClone(this.job) : null; }
}

test("Postgres job creation persists only hashed idempotency and per-object metadata", async () => {
  const pool = new CapturePool();
  const repository = new PostgresPacsTransferJobRepository(pool);
  const input = request([item(1), item(2)]);
  const result = await repository.create(input);
  assert.equal(result.created, true);
  assert.equal(pool.items.length, 2);
  assert.equal(pool.items[0].sop_instance_uid, item(1).sopInstanceUid);
  assert.equal(pool.items[0].source_sha256, null);
  assert.equal(pool.calls.some(call => call.values.includes(input.idempotencyKey)), false);
  assert.equal(pool.calls.some(call => call.values.some(value => typeof value === "string" && /token|dicom.?bytes|plaintext/i.test(value))), false);
  const jobParams = pool.calls.find(call => call.sql.includes("INSERT INTO capstone_pacs_transfer_jobs")).values;
  assert.equal(jobParams[8], createHash("sha256").update(input.idempotencyKey).digest("hex"));
  assert.match(pool.calls.find(call => call.sql.includes("INSERT INTO capstone_pacs_transfer_jobs")).sql, /\$1/);
});

test("job creation fails closed for VIEW_ONLY, duplicate SOPs, and payload/token fields", async () => {
  const repository = new PostgresPacsTransferJobRepository(new CapturePool());
  await assert.rejects(repository.create(request([item()], { permission: "VIEW_ONLY" })), error => error instanceof PacsTransferJobError && error.code === "DOWNLOAD_NOT_ALLOWED");
  await assert.rejects(repository.create(request([item(1), item(1)])), error => error.code === "TRANSFER_JOB_DUPLICATE_SOP");
  await assert.rejects(repository.create({ ...request(), accessToken: "never-persist-this" }), error => error.code === "TRANSFER_JOB_FIELD_NOT_ALLOWED");
  await assert.rejects(repository.create(request([{ ...item(), sourceSha256: "b".repeat(64) }])), error => error.code === "TRANSFER_JOB_ITEM_INVALID");
  await assert.rejects(repository.create(request([{ ...item(), studyInstanceUid: "1" }])), error => error.code === "TRANSFER_JOB_ITEM_INVALID");
  await assert.rejects(repository.create(request([item()], { sourceHospitalId: "H".repeat(65) })), error => error.code === "TRANSFER_JOB_IDENTITY_INVALID");
  await assert.rejects(repository.create(request([item()], { targetHospitalId: sourceHospitalId })), error => error.code === "TRANSFER_HOSPITALS_MUST_DIFFER");
});

test("job creation rejects caller-supplied source hashes and stores no expected hash", async () => {
  const pool = new CapturePool();
  const repository = new PostgresPacsTransferJobRepository(pool);
  await assert.rejects(repository.create(request([{ ...item(1), sourceSha256: expectedHash }])),
    error => error.code === "TRANSFER_JOB_ITEM_INVALID");
  const result = await repository.create(request([item(1)]));
  assert.equal(result.created, true);
  assert.equal(pool.items[0].source_sha256, null);
  assert.equal(JSON.stringify(pool.calls).includes(expectedHash), false);
});

test("resumed items are reauthorized and bounded transient retry remains per-SOP", async () => {
  const repository = new MemoryJobRepository([item(1)]);
  let authorizationCount = 0;
  let transferCount = 0;
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => {
      authorizationCount++;
      assert.equal(job.consentId, consentId);
      assert.equal(claimed.state, "IN_PROGRESS");
      return { allowed: true, authorization: authorization(job, claimed, { ephemeral: `grant-${authorizationCount}` }) };
    },
    transferItem: async ({ item: claimed, authorization }) => {
      transferCount++;
      assert.equal(authorization.ephemeral, `grant-${authorizationCount}`);
      if (transferCount === 1) { const error = new Error("temporary"); error.code = "UPSTREAM_TIMEOUT"; error.retryable = true; throw error; }
      return { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
        studyInstanceUid: claimed.studyInstanceUid, seriesInstanceUid: claimed.seriesInstanceUid,
        sopInstanceUid: claimed.sopInstanceUid, sha256: expectedHash };
    }
  });
  let result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.items[0].state, "RETRYABLE");
  assert.equal(result.state, "IN_PROGRESS");
  result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.items[0].state, "SUCCEEDED");
  assert.equal(result.state, "COMPLETED");
  assert.equal(authorizationCount, 2);
  assert.equal(transferCount, 2);
});

test("bounded batch processing returns durable progress and resume reauthorizes each SOP", async () => {
  const repository = new MemoryJobRepository([item(1), item(2), item(3)]);
  const authorized = [];
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => {
      authorized.push(claimed.sopInstanceUid);
      return { allowed: true, authorization: authorization(job, claimed) };
    },
    transferItem: async ({ item: claimed }) => ({ status: "PACS_INSTANCE_VERIFIED", simulation: false,
      destinationVerification: true, studyInstanceUid: claimed.studyInstanceUid,
      seriesInstanceUid: claimed.seriesInstanceUid, sopInstanceUid: claimed.sopInstanceUid,
      sha256: expectedHash })
  });
  const first = await coordinator.runBatch(repository.job.jobId, actorId, { maxSteps: 2 });
  assert.equal(first.stepsRun, 2);
  assert.equal(first.yielded, true);
  assert.equal(first.job.state, "IN_PROGRESS");
  assert.equal(first.job.succeededItems, 2);
  assert.deepEqual(first.job.items.map(entry => entry.state), ["SUCCEEDED", "SUCCEEDED", "PENDING"]);
  const resumed = await coordinator.runBatch(repository.job.jobId, actorId, { maxSteps: 2 });
  assert.equal(resumed.stepsRun, 1);
  assert.equal(resumed.yielded, false);
  assert.equal(resumed.job.state, "COMPLETED");
  assert.equal(resumed.job.succeededItems, 3);
  assert.equal(authorized.length, 3);
});

test("batch abort yields between SOPs without claiming the next item", async () => {
  const repository = new MemoryJobRepository([item(1), item(2)]);
  const controller = new AbortController();
  let transferCount = 0;
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => ({ allowed: true, authorization: authorization(job, claimed) }),
    transferItem: async ({ item: claimed }) => {
      transferCount++;
      controller.abort();
      return { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
        studyInstanceUid: claimed.studyInstanceUid, seriesInstanceUid: claimed.seriesInstanceUid,
        sopInstanceUid: claimed.sopInstanceUid, sha256: expectedHash };
    }
  });
  const paused = await coordinator.runBatch(repository.job.jobId, actorId, { maxSteps: 10, signal: controller.signal });
  assert.equal(paused.stepsRun, 1);
  assert.equal(paused.yielded, true);
  assert.equal(paused.job.items[1].state, "PENDING");
  assert.equal(transferCount, 1);
});

test("batch reports busy when another worker owns the active item lease", async () => {
  const repository = new MemoryJobRepository([item(1)]);
  await repository.claimNext(repository.job.jobId, actorId);
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async () => { throw new Error("must-not-run"); },
    transferItem: async () => { throw new Error("must-not-run"); }
  });
  const result = await coordinator.runBatch(repository.job.jobId, actorId);
  assert.equal(result.stepsRun, 0);
  assert.equal(result.busy, true);
  assert.equal(result.job.items[0].state, "IN_PROGRESS");
});

test("revocation on resume stops before another A-to-B transfer", async () => {
  const repository = new MemoryJobRepository([item(1), item(2)]);
  let authorizationCount = 0;
  let transferCount = 0;
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => ++authorizationCount === 1
      ? { allowed: true, authorization: authorization(job, claimed, { ephemeral: true }) }
      : { allowed: false, reasonCode: "CONSENT_REVOKED" },
    transferItem: async ({ item: claimed }) => {
      transferCount++;
      return { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
        studyInstanceUid: claimed.studyInstanceUid, seriesInstanceUid: claimed.seriesInstanceUid,
        sopInstanceUid: claimed.sopInstanceUid, sha256: expectedHash };
    }
  });
  let result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.items[0].state, "SUCCEEDED");
  result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.state, "REVOKED");
  assert.equal(result.items[1].state, "REVOKED");
  assert.equal(transferCount, 1);
  assert.equal(authorizationCount, 2);
});

test("any policy-scope denial halts the full job and does not transfer later objects", async () => {
  const repository = new MemoryJobRepository([item(1), item(2)]);
  let transferCount = 0;
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async () => ({ allowed: false, reasonCode: "SCOPE_MISMATCH" }),
    transferItem: async () => { transferCount++; throw new Error("must-not-run"); }
  });
  const first = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(first.state, "FAILED");
  assert.deepEqual(first.items.map(row => row.state), ["FAILED", "FAILED"]);
  assert.equal(first.items[0].reasonCode, "SCOPE_MISMATCH");
  await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(transferCount, 0);
});

test("authorization scope mismatch halts the job before any transfer", async () => {
  const repository = new MemoryJobRepository([item(1), item(2)]);
  let transferCount = 0;
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => ({ allowed: true,
      authorization: authorization(job, claimed, { scope: { ...authorization(job, claimed).scope, targetHospitalId: "HOSP-C" } }) }),
    transferItem: async () => { transferCount++; throw new Error("must-not-run"); }
  });
  const result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.state, "FAILED");
  assert.equal(result.items.every(row => row.state === "FAILED"), true);
  assert.equal(result.items[0].reasonCode, "TOKEN_SCOPE_MISMATCH");
  assert.equal(transferCount, 0);
});

test("scope-policy exceptions without HTTP status also stop remaining objects", async () => {
  const repository = new MemoryJobRepository([item(1), item(2)]);
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async () => { const error = new Error("denied"); error.code = "SCOPE_MISMATCH"; throw error; },
    transferItem: async () => { throw new Error("must-not-run"); }
  });
  const result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.state, "FAILED");
  assert.equal(result.items.every(row => row.state === "FAILED"), true);
  assert.equal(result.items[0].reasonCode, "SCOPE_MISMATCH");
});

test("destination UID/hash mismatch never becomes a successful import", async () => {
  const repository = new MemoryJobRepository([item(1)]);
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => ({ allowed: true, authorization: authorization(job, claimed) }),
    transferItem: async () => ({ status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
      studyInstanceUid: "1.2.999", seriesInstanceUid: "1.2.3.4", sopInstanceUid: "1.2.3.4.999", sha256: "b".repeat(64) })
  });
  const result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.state, "FAILED");
  assert.equal(result.items[0].state, "FAILED");
  assert.equal(result.items[0].reasonCode, "DESTINATION_RECEIPT_MISMATCH");
  assert.equal(result.succeededItems, 0);
});

test("only a verified receipt fixes a missing source hash", async () => {
  const repository = new MemoryJobRepository([item(1)]);
  const coordinator = new PacsTransferJobCoordinator(repository, {
    authorizeItem: async ({ job, item: claimed }) => ({ allowed: true, authorization: authorization(job, claimed) }),
    transferItem: async ({ item: claimed }) => ({ status: "PACS_INSTANCE_VERIFIED", simulation: false,
      destinationVerification: true, studyInstanceUid: claimed.studyInstanceUid,
      seriesInstanceUid: claimed.seriesInstanceUid, sopInstanceUid: claimed.sopInstanceUid,
      sha256: expectedHash })
  });
  const result = await coordinator.runNext(repository.job.jobId, actorId);
  assert.equal(result.state, "COMPLETED");
  assert.equal(result.items[0].sourceSha256, expectedHash);
  assert.equal(result.items[0].destinationSha256, expectedHash);
});

test("destination study or series mismatch never becomes a successful import", async () => {
  for (const field of ["studyInstanceUid", "seriesInstanceUid"]) {
    const repository = new MemoryJobRepository([item(1)]);
    const coordinator = new PacsTransferJobCoordinator(repository, {
      authorizeItem: async ({ job, item: claimed }) => ({ allowed: true, authorization: authorization(job, claimed) }),
      transferItem: async ({ item: claimed }) => ({ status: "PACS_INSTANCE_VERIFIED", simulation: false,
        destinationVerification: true, studyInstanceUid: claimed.studyInstanceUid,
        seriesInstanceUid: claimed.seriesInstanceUid, sopInstanceUid: claimed.sopInstanceUid,
        sha256: expectedHash, [field]: "1.2.999" })
    });
    const result = await coordinator.runNext(repository.job.jobId, actorId);
    assert.equal(result.state, "FAILED");
    assert.equal(result.items[0].reasonCode, "DESTINATION_RECEIPT_MISMATCH");
  }
});

test("migration contains only metadata and denies PUBLIC access", async () => {
  const sql = await readFile("db/migrations/039_capstone_pacs_transfer_jobs.sql", "utf8");
  assert.match(sql, /REVOKE ALL ON capstone_pacs_transfer_jobs, capstone_pacs_transfer_items FROM PUBLIC/u);
  assert.match(sql, /source_sha256/u);
  assert.ok(sql.includes("study_instance_uid varchar(64) NOT NULL CHECK (study_instance_uid ~ '^[0-9]+(\\.[0-9]+)+$')"));
  assert.ok(!sql.includes("study_instance_uid ~ '^[0-9]+(\\.[0-9]+)*$'"));
  assert.doesNotMatch(sql, /dicom_bytes|pixel_data|access_token|dpop_proof|dek\s+bytea|payload\s+bytea/iu);
});
