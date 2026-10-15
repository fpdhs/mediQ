import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { PacsTransferJobCoordinator, PostgresPacsTransferJobRepository } from "../src/pacs-transfer-jobs.js";

const connectionString = process.env.PACS_TRANSFER_TEST_DATABASE_URL;
const hash = "c".repeat(64);
const jobRequest = (idempotencyKey, items = [1, 2]) => ({
  actorId: "doctor-synthetic-pg-test",
  sourceHospitalId: "HOSP-A-SYNTHETIC",
  targetHospitalId: "HOSP-B-SYNTHETIC",
  consentId: "consent-synthetic-pg-test",
  auditSessionId: "audit-synthetic-pg-test",
  purpose: "TREATMENT",
  permission: "DOWNLOAD_ALLOWED",
  validUntil: new Date(Date.now() + 120000).toISOString(),
  idempotencyKey,
  items: items.map(index => ({ studyInstanceUid: "1.2.840.10008.1", seriesInstanceUid: "1.2.840.10008.1.1",
    sopInstanceUid: `1.2.840.10008.1.1.${index}` }))
});

test("PostgreSQL transfer-job migration, idempotency, claims, and receipts", { skip: !connectionString }, async t => {
  const url = new URL(connectionString);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(url.hostname), "integration DB must be loopback-only");
  assert.equal(decodeURIComponent(url.pathname.slice(1)), "pacs_transfer_jobs_test", "integration DB must be disposable and explicitly named");
  const pool = new pg.Pool({ connectionString, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  t.after(() => pool.end());
  const migration = await readFile("db/migrations/039_capstone_pacs_transfer_jobs.sql", "utf8");
  await pool.query(migration);
  const repository = new PostgresPacsTransferJobRepository(pool);
  const key = `synthetic-${randomUUID()}`;
  const request = jobRequest(key);
  const created = await repository.create(request);
  const cleanupIds = [created.jobId];
  assert.equal(created.created, true);
  assert.deepEqual(await repository.create(request), { jobId: created.jobId, created: false });
  assert.deepEqual(await repository.create({ ...request, auditSessionId: "new-generated-audit-session" }),
    { jobId: created.jobId, created: false }, "server-generated audit session does not break idempotent replay");
  await assert.rejects(repository.create(jobRequest(key, [1])), error => error.code === "IDEMPOTENCY_CONFLICT");
  assert.equal((await repository.listActive(request.actorId, request.targetHospitalId)).some(job => job.jobId === created.jobId), true);
  assert.equal((await repository.listActive("another-doctor", request.targetHospitalId)).some(job => job.jobId === created.jobId), false);
  assert.equal((await repository.listActive(request.actorId, "HOSP-C-SYNTHETIC")).some(job => job.jobId === created.jobId), false);

  const claims = await Promise.all(Array.from({ length: 4 }, () => repository.claimNext(created.jobId, request.actorId)));
  assert.equal(claims.filter(Boolean).length, 1, "concurrent workers must obtain at most one lease per job");
  const firstClaim = claims.find(Boolean);
  assert.ok(firstClaim);
  assert.equal(firstClaim.item.ordinal, 1);
  assert.equal(await repository.claimNext(created.jobId, request.actorId), null, "only one live object lease per job");
  const firstFinished = await repository.finishItem({ jobId: created.jobId, actorId: request.actorId,
    itemId: firstClaim.item.itemId, leaseId: firstClaim.leaseId, outcome: "SUCCEEDED",
    receipt: { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
      studyInstanceUid: firstClaim.item.studyInstanceUid, seriesInstanceUid: firstClaim.item.seriesInstanceUid,
      sopInstanceUid: firstClaim.item.sopInstanceUid, sha256: hash } });
  assert.equal(firstFinished.succeededItems, 1);
  assert.equal(firstFinished.state, "IN_PROGRESS");

  const secondClaim = await repository.claimNext(created.jobId, request.actorId);
  assert.ok(secondClaim);
  assert.equal(secondClaim.item.ordinal, 2);
  const finished = await repository.finishItem({ jobId: created.jobId, actorId: request.actorId,
    itemId: secondClaim.item.itemId, leaseId: secondClaim.leaseId, outcome: "SUCCEEDED",
    receipt: { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
      studyInstanceUid: secondClaim.item.studyInstanceUid, seriesInstanceUid: secondClaim.item.seriesInstanceUid,
      sopInstanceUid: secondClaim.item.sopInstanceUid, sha256: hash } });
  assert.equal(finished.state, "COMPLETED");
  assert.equal(finished.succeededItems, 2);
  assert.equal(finished.items.every(item => item.state === "SUCCEEDED"), true);
  assert.equal((await repository.listActive(request.actorId, request.targetHospitalId)).some(job => job.jobId === created.jobId), false);

  const retryJob = await repository.create(jobRequest(`synthetic-${randomUUID()}`, [3]));
  cleanupIds.push(retryJob.jobId);
  const firstAttempt = await repository.claimNext(retryJob.jobId, request.actorId);
  const retryState = await repository.finishItem({ jobId: retryJob.jobId, actorId: request.actorId,
    itemId: firstAttempt.item.itemId, leaseId: firstAttempt.leaseId, outcome: "RETRYABLE", reasonCode: "UPSTREAM_TIMEOUT" });
  assert.equal(retryState.items[0].state, "RETRYABLE");
  assert.equal(retryState.items[0].attemptCount, 1);
  const resumedAttempt = await repository.claimNext(retryJob.jobId, request.actorId);
  const retried = await repository.finishItem({ jobId: retryJob.jobId, actorId: request.actorId,
    itemId: resumedAttempt.item.itemId, leaseId: resumedAttempt.leaseId, outcome: "SUCCEEDED",
    receipt: { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
      studyInstanceUid: resumedAttempt.item.studyInstanceUid, seriesInstanceUid: resumedAttempt.item.seriesInstanceUid,
      sopInstanceUid: resumedAttempt.item.sopInstanceUid, sha256: hash } });
  assert.equal(retried.state, "COMPLETED");
  assert.equal(retried.items[0].attemptCount, 2);

  const crashedJob = await repository.create(jobRequest(`synthetic-${randomUUID()}`, [6]));
  cleanupIds.push(crashedJob.jobId);
  const lostLease = await repository.claimNext(crashedJob.jobId, request.actorId);
  await pool.query(`UPDATE capstone_pacs_transfer_items SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE item_id=$1`,
    [lostLease.item.itemId]);
  const afterRestart = await repository.claimNext(crashedJob.jobId, request.actorId);
  assert.equal(afterRestart.item.itemId, lostLease.item.itemId, "an expired in-progress SOP must resume idempotently");
  assert.equal(afterRestart.item.attemptCount, 2);
  assert.notEqual(afterRestart.leaseId, lostLease.leaseId);
  const crashRecovered = await repository.finishItem({ jobId: crashedJob.jobId, actorId: request.actorId,
    itemId: afterRestart.item.itemId, leaseId: afterRestart.leaseId, outcome: "SUCCEEDED",
    receipt: { status: "PACS_INSTANCE_VERIFIED", simulation: false, destinationVerification: true,
      studyInstanceUid: afterRestart.item.studyInstanceUid, seriesInstanceUid: afterRestart.item.seriesInstanceUid,
      sopInstanceUid: afterRestart.item.sopInstanceUid, sha256: hash } });
  assert.equal(crashRecovered.state, "COMPLETED");
  assert.equal(crashRecovered.items[0].attemptCount, 2);

  const deniedJob = await repository.create(jobRequest(`synthetic-${randomUUID()}`, [4, 5]));
  cleanupIds.push(deniedJob.jobId);
  const deniedClaim = await repository.claimNext(deniedJob.jobId, request.actorId);
  const denied = await repository.finishItem({ jobId: deniedJob.jobId, actorId: request.actorId,
    itemId: deniedClaim.item.itemId, leaseId: deniedClaim.leaseId, outcome: "FAILED",
    reasonCode: "SCOPE_MISMATCH", stopRemaining: true });
  assert.equal(denied.state, "FAILED");
  assert.deepEqual(denied.items.map(item => item.state), ["FAILED", "FAILED"]);

  const reportRequest = jobRequest(`synthetic-${randomUUID()}`, [10]);
  const reportJob = await repository.create(reportRequest);
  cleanupIds.push(reportJob.jobId);
  const reportClaim = await repository.claimNext(reportJob.jobId, request.actorId);
  const transferBinding = { jobId: reportJob.jobId, itemId: reportClaim.item.itemId, leaseId: reportClaim.leaseId,
    actorId: request.actorId, sourceHospitalId: request.sourceHospitalId, targetHospitalId: request.targetHospitalId,
    consentId: reportRequest.consentId, purpose: reportRequest.purpose, permission: reportRequest.permission,
    validUntil: reportRequest.validUntil, studyInstanceUid: reportClaim.item.studyInstanceUid,
    seriesInstanceUid: reportClaim.item.seriesInstanceUid, sopInstanceUid: reportClaim.item.sopInstanceUid };
  assert.equal(await repository.assertActiveLease(transferBinding), true);
  await assert.rejects(repository.assertActiveLease({ ...transferBinding, seriesInstanceUid: "1.2.999" }),
    error => error.code === "TRANSFER_CLAIM_SCOPE_MISMATCH");
  const verifiedReceipt = { ...transferBinding, sha256: hash, destinationSopInstanceUid: reportClaim.item.sopInstanceUid };
  assert.deepEqual(await repository.recordVerifiedReceipt(verifiedReceipt), { accepted: true, replay: false });
  assert.deepEqual(await repository.recordVerifiedReceipt(verifiedReceipt), { accepted: true, replay: true });
  const reported = await repository.read(reportJob.jobId, request.actorId);
  assert.equal(reported.state, "COMPLETED");
  assert.equal(reported.items[0].sourceSha256, hash);
  assert.equal(reported.items[0].destinationSha256, hash);
  await assert.rejects(repository.recordVerifiedReceipt({ ...verifiedReceipt, sha256: "d".repeat(64) }),
    error => error.code === "TRANSFER_RECEIPT_CONFLICT");

  const staleRequest = jobRequest(`synthetic-${randomUUID()}`, [11]);
  const staleJob = await repository.create(staleRequest);
  cleanupIds.push(staleJob.jobId);
  const staleClaim = await repository.claimNext(staleJob.jobId, request.actorId);
  await pool.query(`UPDATE capstone_pacs_transfer_items SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE item_id=$1`,
    [staleClaim.item.itemId]);
  const staleBinding = { jobId: staleJob.jobId, itemId: staleClaim.item.itemId, leaseId: staleClaim.leaseId,
    actorId: request.actorId, sourceHospitalId: request.sourceHospitalId, targetHospitalId: request.targetHospitalId,
    consentId: staleRequest.consentId, purpose: staleRequest.purpose, permission: staleRequest.permission,
    validUntil: staleRequest.validUntil, studyInstanceUid: staleClaim.item.studyInstanceUid,
    seriesInstanceUid: staleClaim.item.seriesInstanceUid, sopInstanceUid: staleClaim.item.sopInstanceUid };
  await assert.rejects(repository.assertActiveLease(staleBinding), error => error.code === "TRANSFER_LEASE_LOST");
  await assert.rejects(repository.recordVerifiedReceipt({ ...staleBinding, sha256: hash,
    destinationSopInstanceUid: staleClaim.item.sopInstanceUid }), error => error.code === "TRANSFER_LEASE_LOST");

  const batchRequest = jobRequest(`synthetic-${randomUUID()}`, [7, 8, 9]);
  const batchJob = await repository.create(batchRequest);
  cleanupIds.push(batchJob.jobId);
  let authorizationCount = 0;
  const coordinatorFor = repo => new PacsTransferJobCoordinator(repo, {
    authorizeItem: async ({ job, item }) => {
      authorizationCount++;
      return { allowed: true, authorization: { scope: { actorId: job.actorId,
        sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
        consentId: job.consentId, auditSessionId: job.auditSessionId, purpose: job.purpose,
        permission: job.permission, studyInstanceUid: item.studyInstanceUid,
        seriesInstanceUid: item.seriesInstanceUid, sopInstanceUid: item.sopInstanceUid,
        validUntil: job.validUntil } } };
    },
    transferItem: async ({ item }) => ({ status: "PACS_INSTANCE_VERIFIED", simulation: false,
      destinationVerification: true, studyInstanceUid: item.studyInstanceUid,
      seriesInstanceUid: item.seriesInstanceUid, sopInstanceUid: item.sopInstanceUid,
      sha256: hash })
  });
  const firstBatch = await coordinatorFor(repository).runBatch(batchJob.jobId, request.actorId, { maxSteps: 2 });
  assert.equal(firstBatch.job.succeededItems, 2);
  assert.equal(firstBatch.job.items[0].sourceSha256, hash);
  assert.equal(firstBatch.job.items[1].sourceSha256, hash);
  assert.equal(firstBatch.job.items[2].state, "PENDING");
  assert.equal(firstBatch.job.items[2].sourceSha256, null);
  assert.equal(firstBatch.yielded, true);
  const resumedBatch = await coordinatorFor(new PostgresPacsTransferJobRepository(pool))
    .runBatch(batchJob.jobId, request.actorId, { maxSteps: 2 });
  assert.equal(resumedBatch.job.state, "COMPLETED");
  assert.equal(resumedBatch.job.succeededItems, 3);
  assert.equal(resumedBatch.stepsRun, 1);
  assert.equal(resumedBatch.job.items.every(item => item.sourceSha256 === hash && item.destinationSha256 === hash), true);
  assert.equal(authorizationCount, 3, "a new coordinator must reauthorize every resumed SOP");

  const cleanup = await pool.connect();
  try {
    await cleanup.query("BEGIN");
    await cleanup.query("DELETE FROM capstone_pacs_transfer_items WHERE job_id = ANY($1::uuid[])", [cleanupIds]);
    await cleanup.query("DELETE FROM capstone_pacs_transfer_jobs WHERE job_id = ANY($1::uuid[])", [cleanupIds]);
    await cleanup.query("COMMIT");
  } catch (error) { await cleanup.query("ROLLBACK"); throw error; }
  finally { cleanup.release(); }
});
