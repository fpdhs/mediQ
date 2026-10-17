import { createHash, randomUUID } from "node:crypto";

const MAX_ITEMS = 10000;
const MAX_ATTEMPTS = 5;
const MAX_BATCH_STEPS = 100;
const UID = /^[0-9]+(?:\.[0-9]+)+$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const TERMINAL_JOB_STATES = new Set(["COMPLETED", "FAILED", "EXPIRED", "REVOKED"]);
const POLICY_DENIAL_CODES = new Set(["ACCESS_DENIED_NO_CONSENT", "CONSENT_REVOKED", "CONSENT_EXPIRED",
  "HOSPITAL_MISMATCH", "DOCTOR_HOSPITAL_MISMATCH", "PURPOSE_MISMATCH", "SCOPE_MISMATCH",
  "DOWNLOAD_NOT_ALLOWED", "TOKEN_EXPIRED", "TOKEN_INVALID", "TOKEN_SCOPE_MISMATCH"]);

export class PacsTransferJobError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = "PacsTransferJobError";
    this.code = code;
    this.status = status;
  }
}

const digest = value => createHash("sha256").update(value).digest("hex");
const canonical = value => JSON.stringify(value);
const timestampMs = value => value instanceof Date ? value.getTime() : Date.parse(value);
const validText = (value, max, pattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u) =>
  typeof value === "string" && value.length > 0 && value.length <= max && pattern.test(value);

function normalizeCreateRequest(input, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new PacsTransferJobError("TRANSFER_JOB_INVALID");
  const allowed = new Set(["actorId", "sourceHospitalId", "targetHospitalId", "consentId", "auditSessionId", "purpose", "permission", "validUntil", "idempotencyKey", "items"]);
  if (Object.keys(input).some(key => !allowed.has(key))) throw new PacsTransferJobError("TRANSFER_JOB_FIELD_NOT_ALLOWED");
  const { actorId, sourceHospitalId, targetHospitalId, consentId, auditSessionId, purpose, permission, validUntil, idempotencyKey } = input;
  if (![actorId, consentId, auditSessionId].every(value => validText(value, 128))
      || ![sourceHospitalId, targetHospitalId].every(value => validText(value, 64))) throw new PacsTransferJobError("TRANSFER_JOB_IDENTITY_INVALID");
  if (sourceHospitalId === targetHospitalId) throw new PacsTransferJobError("TRANSFER_HOSPITALS_MUST_DIFFER");
  if (!validText(purpose, 32, /^[A-Z][A-Z0-9_]{0,31}$/u)) throw new PacsTransferJobError("TRANSFER_JOB_PURPOSE_INVALID");
  if (permission !== "DOWNLOAD_ALLOWED") throw new PacsTransferJobError("DOWNLOAD_NOT_ALLOWED", 403);
  if (typeof idempotencyKey !== "string" || idempotencyKey.length < 16 || idempotencyKey.length > 256) throw new PacsTransferJobError("IDEMPOTENCY_KEY_INVALID");
  const validUntilMs = Date.parse(validUntil);
  if (!Number.isFinite(validUntilMs) || validUntilMs <= now + 5000) throw new PacsTransferJobError("TRANSFER_JOB_EXPIRED", 409);
  if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > MAX_ITEMS) throw new PacsTransferJobError("TRANSFER_JOB_ITEMS_INVALID");
  const seen = new Set();
  const items = input.items.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || Object.keys(item).some(key => !["studyInstanceUid", "seriesInstanceUid", "sopInstanceUid"].includes(key))) {
      throw new PacsTransferJobError("TRANSFER_JOB_ITEM_INVALID");
    }
    const { studyInstanceUid, seriesInstanceUid, sopInstanceUid } = item;
    if (![studyInstanceUid, seriesInstanceUid, sopInstanceUid].every(uid => typeof uid === "string" && uid.length <= 64 && UID.test(uid))) {
      throw new PacsTransferJobError("TRANSFER_JOB_ITEM_INVALID");
    }
    if (seen.has(sopInstanceUid)) throw new PacsTransferJobError("TRANSFER_JOB_DUPLICATE_SOP", 409);
    seen.add(sopInstanceUid);
    return { itemId: randomUUID(), ordinal: index + 1, studyInstanceUid, seriesInstanceUid, sopInstanceUid,
      sourceSha256: null };
  });
  const manifest = items.map(({ ordinal, studyInstanceUid, seriesInstanceUid, sopInstanceUid, sourceSha256 }) =>
    ({ ordinal, studyInstanceUid, seriesInstanceUid, sopInstanceUid, sourceSha256 }));
  const identity = { actorId, sourceHospitalId, targetHospitalId, consentId, auditSessionId, purpose, permission, validUntil: new Date(validUntilMs).toISOString(), manifest };
  const requestIdentity = { actorId, sourceHospitalId, targetHospitalId, consentId, purpose, permission,
    validUntil: identity.validUntil, manifest };
  return {
    jobId: randomUUID(), ...identity, validUntil: identity.validUntil, items,
    idempotencyKeyHash: digest(idempotencyKey),
    requestFingerprint: digest(canonical(requestIdentity)),
    manifestSha256: digest(canonical(manifest))
  };
}

function publicJob(row, items = []) {
  if (!row) return null;
  return {
    jobId: row.job_id ?? row.jobId,
    actorId: row.actor_id ?? row.actorId,
    sourceHospitalId: row.source_hospital_id ?? row.sourceHospitalId,
    targetHospitalId: row.target_hospital_id ?? row.targetHospitalId,
    consentId: row.consent_id ?? row.consentId,
    auditSessionId: row.audit_session_id ?? row.auditSessionId,
    purpose: row.purpose,
    permission: row.permission,
    state: row.state,
    totalItems: Number(row.total_items ?? row.totalItems),
    succeededItems: Number(row.succeeded_items ?? row.succeededItems ?? 0),
    failedItems: Number(row.failed_items ?? row.failedItems ?? 0),
    manifestSha256: row.manifest_sha256 ?? row.manifestSha256,
    validUntil: row.valid_until ?? row.validUntil,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    items: items.map(item => ({
      itemId: item.item_id ?? item.itemId,
      ordinal: Number(item.ordinal),
      studyInstanceUid: item.study_instance_uid ?? item.studyInstanceUid,
      seriesInstanceUid: item.series_instance_uid ?? item.seriesInstanceUid,
      sopInstanceUid: item.sop_instance_uid ?? item.sopInstanceUid,
      sourceSha256: item.source_sha256 ?? item.sourceSha256 ?? null,
      state: item.state,
      attemptCount: Number(item.attempt_count ?? item.attemptCount ?? 0),
      maxAttempts: Number(item.max_attempts ?? item.maxAttempts ?? 3),
      destinationSha256: item.destination_sha256 ?? item.destinationSha256 ?? null,
      reasonCode: item.reason_code ?? item.reasonCode ?? null
    }))
  };
}

function authorizationMatchesItem(authorization, job, item) {
  const scope = authorization?.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) return false;
  const expected = {
    actorId: job.actorId,
    sourceHospitalId: job.sourceHospitalId,
    targetHospitalId: job.targetHospitalId,
    consentId: job.consentId,
    auditSessionId: job.auditSessionId,
    purpose: job.purpose,
    permission: job.permission,
    studyInstanceUid: item.studyInstanceUid,
    seriesInstanceUid: item.seriesInstanceUid,
    sopInstanceUid: item.sopInstanceUid
  };
  const fields = [...Object.keys(expected), "validUntil"];
  if (Object.keys(scope).sort().join("\0") !== [...fields].sort().join("\0")) return false;
  if (!Object.keys(expected).every(field => scope[field] === expected[field])) return false;
  return Number.isFinite(timestampMs(scope.validUntil)) && timestampMs(scope.validUntil) === timestampMs(job.validUntil);
}

export class PostgresPacsTransferJobRepository {
  persistent = true;
  constructor(pool) {
    if (!pool || typeof pool.connect !== "function") throw new TypeError("POSTGRES_POOL_REQUIRED");
    this.pool = pool;
  }

  async create(input) {
    const job = normalizeCreateRequest(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(`
        INSERT INTO capstone_pacs_transfer_jobs
          (job_id, actor_id, source_hospital_id, target_hospital_id, consent_id, audit_session_id, purpose, permission,
           idempotency_key_hash, request_fingerprint, manifest_sha256, state, total_items, valid_until)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'CREATED',$12,$13)
        ON CONFLICT (actor_id, target_hospital_id, idempotency_key_hash) DO NOTHING
        RETURNING job_id`, [job.jobId, job.actorId, job.sourceHospitalId, job.targetHospitalId, job.consentId,
        job.auditSessionId, job.purpose, job.permission, job.idempotencyKeyHash, job.requestFingerprint,
        job.manifestSha256, job.items.length, job.validUntil]);
      if (inserted.rowCount === 0) {
        const existing = await client.query(`SELECT job_id, request_fingerprint FROM capstone_pacs_transfer_jobs
          WHERE actor_id=$1 AND target_hospital_id=$2 AND idempotency_key_hash=$3 FOR UPDATE`,
        [job.actorId, job.targetHospitalId, job.idempotencyKeyHash]);
        if (!existing.rows[0]) throw new PacsTransferJobError("TRANSFER_JOB_IDEMPOTENCY_RACE", 503);
        if (existing.rows[0].request_fingerprint !== job.requestFingerprint) throw new PacsTransferJobError("IDEMPOTENCY_CONFLICT", 409);
        await client.query("COMMIT");
        return { jobId: existing.rows[0].job_id, created: false };
      }
      await client.query(`INSERT INTO capstone_pacs_transfer_items
        (item_id, job_id, ordinal, study_instance_uid, series_instance_uid, sop_instance_uid, source_sha256, state)
        SELECT item_id, $1, ordinal, study_instance_uid, series_instance_uid, sop_instance_uid, source_sha256, 'PENDING'
        FROM jsonb_to_recordset($2::jsonb) AS x(item_id uuid, ordinal integer, study_instance_uid text,
          series_instance_uid text, sop_instance_uid text, source_sha256 text)`,
      [job.jobId, JSON.stringify(job.items.map(item => ({ item_id: item.itemId, ordinal: item.ordinal,
        study_instance_uid: item.studyInstanceUid, series_instance_uid: item.seriesInstanceUid,
        sop_instance_uid: item.sopInstanceUid, source_sha256: item.sourceSha256 })))]);
      await client.query("COMMIT");
      return { jobId: job.jobId, created: true };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async read(jobId, actorId) {
    const header = await this.pool.query(`SELECT * FROM capstone_pacs_transfer_jobs WHERE job_id=$1 AND actor_id=$2`, [jobId, actorId]);
    if (!header.rows[0]) return null;
    const items = await this.pool.query(`SELECT item_id, ordinal, study_instance_uid, series_instance_uid,
      sop_instance_uid, source_sha256, state, attempt_count, max_attempts, destination_sha256, reason_code
      FROM capstone_pacs_transfer_items WHERE job_id=$1 ORDER BY ordinal`, [jobId]);
    return publicJob(header.rows[0], items.rows);
  }

  async listActive(actorId, targetHospitalId, { limit = 20 } = {}) {
    if (!validText(actorId, 128) || !validText(targetHospitalId, 64)
        || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new PacsTransferJobError("TRANSFER_JOB_QUERY_INVALID");
    const result = await this.pool.query(`SELECT j.job_id, j.state, j.total_items, j.succeeded_items,
      j.failed_items, j.valid_until, j.updated_at
      FROM capstone_pacs_transfer_jobs j
      WHERE j.actor_id=$1 AND j.target_hospital_id=$2 AND j.state IN ('CREATED','IN_PROGRESS','PARTIAL')
        AND j.valid_until > statement_timestamp()
        AND EXISTS (SELECT 1 FROM capstone_pacs_transfer_items i WHERE i.job_id=j.job_id
          AND i.state IN ('PENDING','IN_PROGRESS','RETRYABLE'))
      ORDER BY j.updated_at DESC LIMIT $3`, [actorId, targetHospitalId, limit]);
    return result.rows.map(row => ({ jobId: row.job_id, state: row.state,
      totalItems: Number(row.total_items), succeededItems: Number(row.succeeded_items),
      failedItems: Number(row.failed_items), validUntil: row.valid_until, updatedAt: row.updated_at }));
  }

  async listHistory(actorId, targetHospitalId, { limit = 50 } = {}) {
    if (!validText(actorId, 128) || !validText(targetHospitalId, 64)
        || !Number.isInteger(limit) || limit < 1 || limit > 50) throw new PacsTransferJobError("TRANSFER_JOB_QUERY_INVALID");
    const result = await this.pool.query(`SELECT job_id, source_hospital_id, target_hospital_id,
      state, total_items, succeeded_items, failed_items, created_at, updated_at
      FROM capstone_pacs_transfer_jobs
      WHERE actor_id=$1 AND target_hospital_id=$2
      ORDER BY created_at DESC, job_id DESC LIMIT $3`, [actorId, targetHospitalId, limit]);
    return result.rows.map(row => ({ jobId: row.job_id, sourceHospitalId: row.source_hospital_id,
      targetHospitalId: row.target_hospital_id, state: row.state, totalItems: Number(row.total_items),
      succeededItems: Number(row.succeeded_items), failedItems: Number(row.failed_items),
      createdAt: row.created_at, updatedAt: row.updated_at }));
  }

  async #transferClaim(client, input, lock = false) {
    const suffix = lock ? " FOR UPDATE OF j, i" : "";
    const result = await client.query(`SELECT j.job_id, j.actor_id, j.source_hospital_id, j.target_hospital_id,
      j.consent_id, j.purpose, j.permission, j.valid_until, j.state AS job_state,
      j.valid_until > statement_timestamp() AS valid_now,
      i.item_id, i.study_instance_uid, i.series_instance_uid, i.sop_instance_uid,
      i.source_sha256, i.destination_sha256, i.destination_sop_instance_uid, i.state AS item_state,
      i.lease_id, i.lease_expires_at, i.lease_expires_at > clock_timestamp() AS lease_live
      FROM capstone_pacs_transfer_jobs j JOIN capstone_pacs_transfer_items i ON i.job_id=j.job_id
      WHERE j.job_id=$1 AND i.item_id=$2 AND j.actor_id=$3${suffix}`,
    [input.jobId, input.itemId, input.actorId]);
    const row = result.rows[0];
    if (!row || row.source_hospital_id !== input.sourceHospitalId || row.target_hospital_id !== input.targetHospitalId
        || row.consent_id !== input.consentId || row.purpose !== input.purpose || row.permission !== input.permission
        || row.study_instance_uid !== input.studyInstanceUid || row.series_instance_uid !== input.seriesInstanceUid
        || row.sop_instance_uid !== input.sopInstanceUid || timestampMs(row.valid_until) !== timestampMs(input.validUntil)) {
      throw new PacsTransferJobError("TRANSFER_CLAIM_SCOPE_MISMATCH", 403);
    }
    return row;
  }

  async assertActiveLease(input) {
    const client = await this.pool.connect();
    try {
      const row = await this.#transferClaim(client, input);
      if (row.permission !== "DOWNLOAD_ALLOWED" || TERMINAL_JOB_STATES.has(row.job_state) || row.valid_now !== true
          || row.item_state !== "IN_PROGRESS" || row.lease_id !== input.leaseId || row.lease_live !== true) {
        throw new PacsTransferJobError("TRANSFER_LEASE_LOST", 409);
      }
      return true;
    } finally { client.release(); }
  }

  async recordVerifiedReceipt(input) {
    if (!SHA256.test(input.sha256 ?? "") || !/^[0-9]+(?:\.[0-9]+)+$/u.test(input.destinationSopInstanceUid ?? "")
        || input.destinationSopInstanceUid !== input.sopInstanceUid) throw new PacsTransferJobError("TRANSFER_RECEIPT_INVALID", 403);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.#transferClaim(client, input, true);
      if (row.item_state === "SUCCEEDED") {
        if (row.destination_sop_instance_uid !== input.destinationSopInstanceUid
            || row.destination_sha256 !== input.sha256 || row.source_sha256 !== input.sha256) {
          throw new PacsTransferJobError("TRANSFER_RECEIPT_CONFLICT", 409);
        }
        await client.query("COMMIT");
        return { accepted: true, replay: true };
      }
      if (TERMINAL_JOB_STATES.has(row.job_state) || row.valid_now !== true || row.item_state !== "IN_PROGRESS"
          || row.lease_id !== input.leaseId || row.lease_live !== true
          || (row.source_sha256 && row.source_sha256 !== input.sha256)) {
        throw new PacsTransferJobError("TRANSFER_LEASE_LOST", 409);
      }
      await client.query(`UPDATE capstone_pacs_transfer_items SET state='SUCCEEDED', reason_code=NULL,
        source_sha256=COALESCE(source_sha256,$2), destination_sop_instance_uid=$3, destination_sha256=$2,
        lease_id=NULL, lease_expires_at=NULL, updated_at=clock_timestamp() WHERE item_id=$1`,
      [input.itemId, input.sha256, input.destinationSopInstanceUid]);
      await this.#refreshState(client, input.jobId);
      await client.query("COMMIT");
      return { accepted: true, replay: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async #readWithClient(client, jobId, actorId) {
    const header = await client.query(`SELECT * FROM capstone_pacs_transfer_jobs WHERE job_id=$1 AND actor_id=$2`, [jobId, actorId]);
    if (!header.rows[0]) return null;
    const items = await client.query(`SELECT item_id, ordinal, study_instance_uid, series_instance_uid,
      sop_instance_uid, source_sha256, state, attempt_count, max_attempts, destination_sha256, reason_code
      FROM capstone_pacs_transfer_items WHERE job_id=$1 ORDER BY ordinal`, [jobId]);
    return publicJob(header.rows[0], items.rows);
  }

  async claimNext(jobId, actorId, { leaseMs = 30000 } = {}) {
    if (!Number.isInteger(leaseMs) || leaseMs < 5000 || leaseMs > 120000) throw new PacsTransferJobError("TRANSFER_LEASE_INVALID");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const selected = await client.query(`SELECT *, valid_until > statement_timestamp() AS valid_now FROM capstone_pacs_transfer_jobs
        WHERE job_id=$1 AND actor_id=$2 FOR UPDATE`, [jobId, actorId]);
      const row = selected.rows[0];
      if (!row || TERMINAL_JOB_STATES.has(row.state)) { await client.query("COMMIT"); return null; }
      const liveLease = await client.query(`SELECT 1 FROM capstone_pacs_transfer_items
        WHERE job_id=$1 AND state='IN_PROGRESS' AND lease_expires_at > clock_timestamp() LIMIT 1`, [jobId]);
      if (liveLease.rowCount) { await client.query("COMMIT"); return null; }
      if (row.valid_now !== true) {
        await client.query(`UPDATE capstone_pacs_transfer_items SET state='EXPIRED', reason_code='CONSENT_EXPIRED',
          lease_id=NULL, lease_expires_at=NULL, updated_at=clock_timestamp()
          WHERE job_id=$1 AND (state IN ('PENDING','RETRYABLE') OR (state='IN_PROGRESS' AND lease_expires_at <= clock_timestamp()))`, [jobId]);
        await this.#refreshState(client, jobId, "EXPIRED");
        await client.query("COMMIT");
        return null;
      }
      await client.query(`UPDATE capstone_pacs_transfer_items SET state='FAILED', reason_code='RETRY_LIMIT_EXCEEDED',
        lease_id=NULL, lease_expires_at=NULL, updated_at=clock_timestamp()
        WHERE job_id=$1 AND state='IN_PROGRESS' AND lease_expires_at <= clock_timestamp() AND attempt_count >= max_attempts`, [jobId]);
      const candidate = await client.query(`SELECT * FROM capstone_pacs_transfer_items
        WHERE job_id=$1 AND attempt_count < max_attempts AND
          (state IN ('PENDING','RETRYABLE') OR (state='IN_PROGRESS' AND lease_expires_at <= clock_timestamp()))
        ORDER BY ordinal LIMIT 1 FOR UPDATE SKIP LOCKED`, [jobId]);
      if (!candidate.rows[0]) {
        await this.#refreshState(client, jobId);
        await client.query("COMMIT");
        return null;
      }
      const item = candidate.rows[0];
      const leaseId = randomUUID();
      const claimed = await client.query(`UPDATE capstone_pacs_transfer_items SET state='IN_PROGRESS',
        attempt_count=attempt_count+1, lease_id=$2, lease_expires_at=clock_timestamp()+($3 * interval '1 millisecond'),
        reason_code=NULL, updated_at=clock_timestamp() WHERE item_id=$1 RETURNING *`, [item.item_id, leaseId, leaseMs]);
      await client.query(`UPDATE capstone_pacs_transfer_jobs SET state='IN_PROGRESS', updated_at=clock_timestamp() WHERE job_id=$1`, [jobId]);
      await client.query("COMMIT");
      return { job: publicJob(row), item: publicJob({ ...row, total_items: 1 }, [claimed.rows[0]]).items[0], leaseId };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async finishItem({ jobId, actorId, itemId, leaseId, outcome, reasonCode = null, receipt = null, stopRemaining = false }) {
    const allowed = new Set(["SUCCEEDED", "RETRYABLE", "FAILED", "EXPIRED", "REVOKED"]);
    if (!allowed.has(outcome)) throw new PacsTransferJobError("TRANSFER_OUTCOME_INVALID");
    if (reasonCode !== null && !/^[A-Z][A-Z0-9_]{0,63}$/u.test(reasonCode)) throw new PacsTransferJobError("TRANSFER_REASON_INVALID");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const owner = await client.query(`SELECT state FROM capstone_pacs_transfer_jobs WHERE job_id=$1 AND actor_id=$2 FOR UPDATE`, [jobId, actorId]);
      if (!owner.rows[0] || TERMINAL_JOB_STATES.has(owner.rows[0].state)) throw new PacsTransferJobError("TRANSFER_JOB_NOT_ACTIVE", 409);
      const current = await client.query(`SELECT *, lease_expires_at > clock_timestamp() AS lease_live
        FROM capstone_pacs_transfer_items WHERE item_id=$1 AND job_id=$2 FOR UPDATE`, [itemId, jobId]);
      const item = current.rows[0];
      if (!item || item.state !== "IN_PROGRESS" || item.lease_id !== leaseId || item.lease_live !== true) throw new PacsTransferJobError("TRANSFER_LEASE_LOST", 409);
      if (outcome === "SUCCEEDED") {
        if (!receipt || receipt.status !== "PACS_INSTANCE_VERIFIED" || receipt.destinationVerification !== true
            || receipt.simulation === true || receipt.studyInstanceUid !== item.study_instance_uid
            || receipt.seriesInstanceUid !== item.series_instance_uid || receipt.sopInstanceUid !== item.sop_instance_uid
            || !SHA256.test(receipt.sha256 ?? "") || (item.source_sha256 && receipt.sha256 !== item.source_sha256)) {
          outcome = "FAILED";
          reasonCode = "DESTINATION_RECEIPT_MISMATCH";
        }
      }
      const nextState = outcome === "RETRYABLE" && item.attempt_count < item.max_attempts ? "RETRYABLE"
        : outcome === "RETRYABLE" ? "FAILED" : outcome;
      await client.query(`UPDATE capstone_pacs_transfer_items SET state=$2::varchar(16), reason_code=$3,
        source_sha256=CASE WHEN $2::varchar(16)='SUCCEEDED' THEN COALESCE(source_sha256,$4) ELSE source_sha256 END,
        destination_sop_instance_uid=$5, destination_sha256=$6, lease_id=NULL, lease_expires_at=NULL,
        updated_at=clock_timestamp() WHERE item_id=$1`, [itemId, nextState, reasonCode,
        nextState === "SUCCEEDED" ? receipt.sha256 : null,
        nextState === "SUCCEEDED" ? receipt.sopInstanceUid : null, nextState === "SUCCEEDED" ? receipt.sha256 : null]);
      if (stopRemaining || nextState === "REVOKED" || nextState === "EXPIRED") {
        const haltedState = nextState === "REVOKED" || nextState === "EXPIRED" ? nextState : "FAILED";
        await client.query(`UPDATE capstone_pacs_transfer_items SET state=$2, reason_code=$3, updated_at=clock_timestamp()
          WHERE job_id=$1 AND state IN ('PENDING','RETRYABLE')`, [jobId, haltedState, reasonCode
          ?? (haltedState === "REVOKED" ? "CONSENT_REVOKED" : haltedState === "EXPIRED" ? "CONSENT_EXPIRED" : "POLICY_REVALIDATION_DENIED")]);
        await this.#refreshState(client, jobId, haltedState === "REVOKED" || haltedState === "EXPIRED" ? haltedState : null);
      } else await this.#refreshState(client, jobId);
      await client.query("COMMIT");
      return this.#readWithClient(client, jobId, actorId);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async #refreshState(client, jobId, stateOverride = null) {
    const counts = await client.query(`SELECT count(*) FILTER (WHERE state='SUCCEEDED')::int AS succeeded,
      count(*) FILTER (WHERE state IN ('FAILED','EXPIRED','REVOKED'))::int AS failed,
      count(*) FILTER (WHERE state IN ('PENDING','IN_PROGRESS','RETRYABLE'))::int AS unfinished
      FROM capstone_pacs_transfer_items WHERE job_id=$1`, [jobId]);
    const { succeeded, failed, unfinished } = counts.rows[0];
    const state = stateOverride ?? (unfinished > 0 ? (succeeded > 0 && failed > 0 ? "PARTIAL" : "IN_PROGRESS")
      : failed === 0 ? "COMPLETED" : succeeded > 0 ? "PARTIAL" : "FAILED");
    await client.query(`UPDATE capstone_pacs_transfer_jobs SET state=$2, succeeded_items=$3, failed_items=$4,
      updated_at=clock_timestamp() WHERE job_id=$1`, [jobId, state, succeeded, failed]);
  }
}

export class PacsTransferJobCoordinator {
  constructor(repository, { authorizeItem, transferItem }) {
    if (!repository || typeof repository.claimNext !== "function" || typeof repository.finishItem !== "function"
        || typeof authorizeItem !== "function" || typeof transferItem !== "function") throw new TypeError("TRANSFER_COORDINATOR_DEPENDENCIES_REQUIRED");
    this.repository = repository;
    this.authorizeItem = authorizeItem;
    this.transferItem = transferItem;
  }

  async #runOne(jobId, actorId) {
    const claim = await this.repository.claimNext(jobId, actorId);
    if (!claim) return { job: await this.repository.read(jobId, actorId), advanced: false };
    const { job, item, leaseId } = claim;
    let outcome;
    let reasonCode = null;
    let receipt = null;
    let stopRemaining = false;
    try {
      const decision = await this.authorizeItem({ job, item });
      if (!decision || decision.allowed !== true || decision.authorization == null) {
        reasonCode = /^[A-Z][A-Z0-9_]{0,63}$/u.test(decision?.reasonCode ?? "")
          ? decision.reasonCode : "POLICY_REVALIDATION_DENIED";
        outcome = reasonCode === "CONSENT_REVOKED" ? "REVOKED" : reasonCode === "CONSENT_EXPIRED" ? "EXPIRED" : "FAILED";
        stopRemaining = true;
      } else if (!authorizationMatchesItem(decision.authorization, job, item)) {
        reasonCode = "TOKEN_SCOPE_MISMATCH";
        outcome = "FAILED";
        stopRemaining = true;
      } else {
        receipt = await this.transferItem({ job, item, authorization: decision.authorization });
        outcome = "SUCCEEDED";
      }
    } catch (error) {
      const code = /^[A-Z][A-Z0-9_]{0,63}$/u.test(error?.code ?? "") ? error.code : "TRANSFER_FAILED";
      outcome = code === "CONSENT_REVOKED" ? "REVOKED" : code === "CONSENT_EXPIRED" ? "EXPIRED"
        : error?.retryable === true && error?.status !== 401 && error?.status !== 403 ? "RETRYABLE" : "FAILED";
      reasonCode = code;
      stopRemaining = error?.status === 401 || error?.status === 403 || POLICY_DENIAL_CODES.has(code)
        || outcome === "REVOKED" || outcome === "EXPIRED";
    }
    const jobResult = await this.repository.finishItem({ jobId, actorId, itemId: item.itemId, leaseId, outcome, reasonCode, receipt, stopRemaining });
    return { job: jobResult, advanced: true };
  }

  async runNext(jobId, actorId) {
    return (await this.#runOne(jobId, actorId)).job;
  }

  async runBatch(jobId, actorId, { maxSteps = 10, signal } = {}) {
    if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_BATCH_STEPS
        || (signal !== undefined && typeof signal?.aborted !== "boolean")) {
      throw new PacsTransferJobError("TRANSFER_BATCH_LIMIT_INVALID");
    }
    let job = await this.repository.read(jobId, actorId);
    if (!job) return null;
    let stepsRun = 0;
    while (stepsRun < maxSteps && !TERMINAL_JOB_STATES.has(job.state) && !signal?.aborted) {
      const next = await this.#runOne(jobId, actorId);
      if (!next.job) return null;
      job = next.job;
      if (!next.advanced) break;
      stepsRun++;
    }
    return { job, stepsRun, yielded: !TERMINAL_JOB_STATES.has(job.state)
      && (signal?.aborted === true || stepsRun >= maxSteps), busy: stepsRun === 0 && !TERMINAL_JOB_STATES.has(job.state) };
  }
}

export const pacsTransferJobLimits = Object.freeze({ maxItems: MAX_ITEMS, maxAttempts: MAX_ATTEMPTS });
