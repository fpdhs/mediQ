import { randomUUID } from "node:crypto";
import { AuthError, PrincipalRole, assertDoctorPrincipal } from "./auth.js";
import { PacsTransferJobError, pacsTransferJobLimits } from "./pacs-transfer-jobs.js";

const ROOT = "/api/pacs-transfer-jobs";
const MAX_POLICY_SCOPES = 100;
const UID = /^[0-9]+(?:\.[0-9]+)+$/u;
const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const timestampMs = value => value instanceof Date ? value.getTime() : Date.parse(value);

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  response.end(JSON.stringify(body));
}

function errorResponse(response, error) {
  const status = error instanceof AuthError ? error.statusCode
    : error instanceof PacsTransferJobError ? error.status : 503;
  const code = error instanceof AuthError || error instanceof PacsTransferJobError
    ? error.code : "PACS_TRANSFER_JOB_UNAVAILABLE";
  json(response, status, { error: code });
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > pacsTransferJobLimits.maxItems) {
    throw new PacsTransferJobError("TRANSFER_JOB_ITEMS_INVALID");
  }
  const seen = new Set();
  const series = new Map();
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)
        || Object.keys(item).sort().join(",") !== "seriesInstanceUid,sopInstanceUid,studyInstanceUid"
        || ![item.studyInstanceUid, item.seriesInstanceUid, item.sopInstanceUid]
          .every(uid => typeof uid === "string" && uid.length <= 64 && UID.test(uid))) {
      throw new PacsTransferJobError("TRANSFER_JOB_ITEM_INVALID");
    }
    if (seen.has(item.sopInstanceUid)) throw new PacsTransferJobError("TRANSFER_JOB_DUPLICATE_SOP", 409);
    seen.add(item.sopInstanceUid);
    const key = `${item.studyInstanceUid}\0${item.seriesInstanceUid}`;
    series.set(key, { studyInstanceUid: item.studyInstanceUid, seriesInstanceUid: item.seriesInstanceUid });
  }
  if (series.size > MAX_POLICY_SCOPES) throw new PacsTransferJobError("TRANSFER_JOB_POLICY_SCOPE_LIMIT");
  return { items, series: [...series.values()] };
}

async function persistAudit(service) {
  const store = service.store;
  if (typeof store.saveRequiredAppendOnly === "function") {
    if (store.appendOnlyChanges?.() === null) throw new Error("AUDIT_PERSISTENCE_UNAVAILABLE");
    await store.saveRequiredAppendOnly();
  } else await store.save();
}

export function createPacsTransferJobHttpHandler({ repository, service, readJson }) {
  if (typeof repository?.create !== "function" || typeof repository?.read !== "function" || typeof repository?.listActive !== "function"
      || typeof service?.evaluateDicomAccessRequest !== "function" || typeof readJson !== "function") {
    throw new TypeError("PACS_TRANSFER_JOB_HTTP_DEPENDENCIES_REQUIRED");
  }

  return async function routePacsTransferJob(request, response, url, principal, requestMeta) {
    if (url.pathname !== ROOT && !url.pathname.startsWith(`${ROOT}/`)) return false;
    response.setHeader?.("cache-control", "no-store");
    try {
      assertDoctorPrincipal(principal, { doctorId: principal?.doctorId, hospitalId: principal?.hospitalId });
      if (url.pathname === `${ROOT}/history`) {
        request.resume();
        if (request.method !== "GET" || url.search) throw new PacsTransferJobError("TRANSFER_JOB_QUERY_INVALID");
        if (typeof repository.listHistory !== "function") throw new Error("PACS_TRANSFER_HISTORY_UNAVAILABLE");
        const jobs = await repository.listHistory(principal.doctorId, principal.hospitalId);
        await service.writeAudit({ actorType: "DOCTOR", actorId: principal.doctorId,
          hospitalId: principal.hospitalId, action: "PACS_TRANSFER_HISTORY_READ", result: "SUCCESS",
          ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null });
        await persistAudit(service);
        json(response, 200, { jobs });
        return true;
      }
      if (url.pathname === `${ROOT}/active`) {
        if (request.method !== "GET" || url.search) {
          request.resume();
          throw new PacsTransferJobError("TRANSFER_JOB_QUERY_INVALID");
        }
        request.resume();
        const jobs = await repository.listActive(principal.doctorId, principal.hospitalId);
        await service.writeAudit({ actorType: "DOCTOR", actorId: principal.doctorId,
          hospitalId: principal.hospitalId, action: "PACS_TRANSFER_ACTIVE_JOBS_READ", result: "SUCCESS",
          ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null });
        await persistAudit(service);
        json(response, 200, { jobs });
        return true;
      }
      if (url.pathname === ROOT && request.method === "POST") {
        const body = await readJson(request, { maxBytes: 4 * 1024 * 1024, strictUtf8: true });
        if (!body || typeof body !== "object" || Array.isArray(body)
            || Object.keys(body).sort().join(",") !== "consentId,items"
            || typeof body.consentId !== "string") throw new PacsTransferJobError("TRANSFER_JOB_INVALID");
        const { items, series } = validateItems(body.items);
        const idempotencyKey = request.headers?.["idempotency-key"];
        if (typeof idempotencyKey !== "string" || idempotencyKey.length < 16 || idempotencyKey.length > 256) {
          throw new PacsTransferJobError("IDEMPOTENCY_KEY_INVALID");
        }
        const consent = service.store.get("consents").find(row => row.consentId === body.consentId);
        if (!consent || service.effectiveConsentStatus(consent) !== "ACTIVE") {
          throw new PacsTransferJobError("ACCESS_DENIED_NO_CONSENT", 403);
        }
        if (consent.permission !== "DOWNLOAD_ALLOWED") throw new PacsTransferJobError("DOWNLOAD_NOT_ALLOWED", 403);
        if (consent.targetHospitalId !== principal.hospitalId || consent.sourceHospitalId === consent.targetHospitalId) {
          throw new PacsTransferJobError("HOSPITAL_MISMATCH", 403);
        }
        const validFrom = timestampMs(consent.validFrom);
        const validUntil = timestampMs(consent.validUntil);
        if (!Number.isFinite(validFrom) || !Number.isFinite(validUntil) || validFrom > Date.now() || validUntil <= Date.now()) {
          throw new PacsTransferJobError("CONSENT_EXPIRED", 403);
        }
        for (const entry of series) {
          const policy = await service.evaluateDicomAccessRequest({ consentId: consent.consentId,
            doctorId: principal.doctorId, requestingHospitalId: principal.hospitalId,
            studyInstanceUid: entry.studyInstanceUid, seriesInstanceUid: entry.seriesInstanceUid,
            purpose: consent.purpose, requestedAction: "DOWNLOAD" }, requestMeta);
          if (policy.decision !== "ALLOWED") throw new PacsTransferJobError(policy.reasonCode ?? "ACCESS_DENIED", policy.statusCode ?? 403);
        }
        let auditSessionId = `transfer-${randomUUID()}`;
        const result = await repository.create({ actorId: principal.doctorId,
          sourceHospitalId: consent.sourceHospitalId, targetHospitalId: consent.targetHospitalId,
          consentId: consent.consentId, auditSessionId, purpose: consent.purpose,
          permission: consent.permission, validUntil: consent.validUntil, idempotencyKey, items });
        let action = "PACS_TRANSFER_JOB_CREATED";
        if (!result.created) {
          const existing = await repository.read(result.jobId, principal.doctorId);
          if (!existing || existing.targetHospitalId !== principal.hospitalId) throw new Error("IDEMPOTENT_JOB_LOOKUP_FAILED");
          auditSessionId = existing.auditSessionId;
          action = "PACS_TRANSFER_JOB_IDEMPOTENT_REPLAY";
        }
        await service.writeAudit({ auditSessionId, actorType: "DOCTOR", actorId: principal.doctorId,
          hospitalId: principal.hospitalId, consentId: consent.consentId,
          sourceHospitalId: consent.sourceHospitalId, targetHospitalId: consent.targetHospitalId,
          action, result: "SUCCESS",
          ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null });
        await persistAudit(service);
        json(response, result.created ? 202 : 200, { jobId: result.jobId, created: result.created });
        return true;
      }
      const claimMatch = url.pathname.match(/^\/api\/pacs-transfer-jobs\/([^/]+)\/claim$/u);
      if (claimMatch) {
        if (request.method !== "POST" || !JOB_ID.test(claimMatch[1]) || url.search
            || (request.headers?.["content-length"] !== undefined && request.headers["content-length"] !== "0")
            || request.headers?.["transfer-encoding"] !== undefined) {
          request.resume();
          throw new PacsTransferJobError("TRANSFER_CLAIM_REQUEST_INVALID");
        }
        request.resume();
        const job = await repository.read(claimMatch[1], principal.doctorId);
        if (!job || job.targetHospitalId !== principal.hospitalId) {
          json(response, 404, { error: "PACS_TRANSFER_JOB_NOT_FOUND" });
          return true;
        }
        const claim = await repository.claimNext(job.jobId, principal.doctorId, { leaseMs: 120000 });
        if (!claim) {
          json(response, 200, { claimed: false, job: await repository.read(job.jobId, principal.doctorId) });
          return true;
        }
        const consent = service.store.get("consents").find(row => row.consentId === job.consentId);
        const now = timestampMs(typeof service.clock === "function" ? service.clock() : new Date().toISOString());
        const validUntil = timestampMs(consent?.validUntil ?? "");
        let denial = null;
        if (!consent) denial = "ACCESS_DENIED_NO_CONSENT";
        else if (service.effectiveConsentStatus(consent) !== "ACTIVE") denial = service.effectiveConsentStatus(consent) === "REVOKED" ? "CONSENT_REVOKED" : "CONSENT_EXPIRED";
        else if (consent.permission !== "DOWNLOAD_ALLOWED" || job.permission !== "DOWNLOAD_ALLOWED") denial = "DOWNLOAD_NOT_ALLOWED";
        else if (consent.sourceHospitalId !== job.sourceHospitalId || consent.targetHospitalId !== principal.hospitalId
            || consent.purpose !== job.purpose || timestampMs(job.validUntil) !== validUntil) denial = "SCOPE_MISMATCH";
        else if (!Number.isFinite(now) || !Number.isFinite(validUntil) || validUntil <= now) denial = "CONSENT_EXPIRED";
        if (!denial) {
          const policy = await service.evaluateDicomAccessRequest({ consentId: job.consentId,
            doctorId: principal.doctorId, requestingHospitalId: principal.hospitalId,
            studyInstanceUid: claim.item.studyInstanceUid, seriesInstanceUid: claim.item.seriesInstanceUid,
            purpose: job.purpose, requestedAction: "DOWNLOAD" }, requestMeta);
          if (policy.decision !== "ALLOWED") denial = policy.reasonCode ?? "POLICY_REVALIDATION_DENIED";
        }
        if (denial) {
          const reasonCode = /^[A-Z][A-Z0-9_]{0,63}$/u.test(denial) ? denial : "POLICY_REVALIDATION_DENIED";
          const outcome = reasonCode === "CONSENT_REVOKED" ? "REVOKED"
            : reasonCode === "CONSENT_EXPIRED" ? "EXPIRED" : "FAILED";
          await repository.finishItem({ jobId: job.jobId, actorId: principal.doctorId,
            itemId: claim.item.itemId, leaseId: claim.leaseId, outcome, reasonCode, stopRemaining: true });
          await service.writeAudit({ auditSessionId: job.auditSessionId, actorType: "DOCTOR",
            actorId: principal.doctorId, hospitalId: principal.hospitalId, consentId: job.consentId,
            sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
            action: "PACS_TRANSFER_ITEM_CLAIM_DENIED", result: "FAIL", reasonCode,
            ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null });
          await persistAudit(service);
          json(response, 403, { error: reasonCode });
          return true;
        }
        await service.writeAudit({ auditSessionId: job.auditSessionId, actorType: "DOCTOR",
          actorId: principal.doctorId, hospitalId: principal.hospitalId, consentId: job.consentId,
          sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
          action: "PACS_TRANSFER_ITEM_CLAIMED", result: "SUCCESS",
          ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null,
          studyInstanceUid: claim.item.studyInstanceUid, seriesInstanceUid: claim.item.seriesInstanceUid,
          sopInstanceUid: claim.item.sopInstanceUid });
        await persistAudit(service);
        json(response, 200, { claimed: true, jobId: job.jobId, auditSessionId: job.auditSessionId,
          consentId: job.consentId, sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
          purpose: job.purpose, permission: job.permission, validUntil: job.validUntil,
          item: claim.item, leaseId: claim.leaseId });
        return true;
      }
      const match = url.pathname.match(/^\/api\/pacs-transfer-jobs\/([^/]+)$/u);
      if (url.pathname === ROOT || request.method !== "GET" || !match || !JOB_ID.test(match[1]) || url.search) {
        json(response, 404, { error: "PACS_TRANSFER_JOB_NOT_FOUND" });
        return true;
      }
      const job = await repository.read(match[1], principal.doctorId);
      if (!job || job.targetHospitalId !== principal.hospitalId) {
        json(response, 404, { error: "PACS_TRANSFER_JOB_NOT_FOUND" });
        return true;
      }
      await service.writeAudit({ auditSessionId: job.auditSessionId, actorType: "DOCTOR",
        actorId: principal.doctorId, hospitalId: principal.hospitalId, consentId: job.consentId,
        sourceHospitalId: job.sourceHospitalId, targetHospitalId: job.targetHospitalId,
        action: "PACS_TRANSFER_JOB_STATUS_READ", result: "SUCCESS",
        ipAddress: requestMeta?.ipAddress ?? null, userAgent: requestMeta?.userAgent ?? null });
      await persistAudit(service);
      json(response, 200, job);
      return true;
    } catch (error) {
      errorResponse(response, error);
      return true;
    }
  };
}
