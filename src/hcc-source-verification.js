import { createHash, randomUUID } from 'node:crypto';
import { AuthError } from './auth.js';
import { HCC_DATASET_ID, HCC_MANIFEST_SHA256, HCC_STUDY_UID, HCC_SERIES_UID,
  HCC_INVENTORY_SHA256, HCC_SOURCE_CONTRACT } from './hcc-source-contract.js';
export { HCC_SOURCE_PATHS, HCC_SOURCE_CONTRACT } from './hcc-source-contract.js';
const CHALLENGE_MS = 30 * 60_000, RECEIPT_MS = 5 * 60_000;
const queues = new WeakMap();
const fail = (code, status = 409) => { throw new AuthError(status, code); };
export function serializeHcc(service, operation) {
  const task = (queues.get(service) ?? Promise.resolve()).then(operation, operation);
  queues.set(service, task.catch(() => {})); return task;
}
function baseline(service, env) {
  if (env.HIPASS_CAPSTONE_HCC_CATALOG !== '1' || env.HIPASS_CAPSTONE_MOCK_IDP !== '1'
    || env.HIPASS_CONTROL_PLANE_ONLY !== '1' || env.HIPASS_STORE !== 'postgres'
    || env.NODE_ENV !== 'production' || env.AUTH_MODE !== 'TEST') fail('HCC_SOURCE_DISABLED', 404);
  // Audit-ledger replay protection is valid only for this declared single writer.
  if (env.HIPASS_CAPSTONE_SINGLE_WRITER !== '1') fail('HCC_SOURCE_SINGLE_WRITER_REQUIRED', 503);
  if (service.store.persistenceBlocked || typeof service.store.saveRequiredAppendOnly !== 'function' || service.store.appendOnlyChanges?.() == null
    || !service.verifyAuditIntegrity().ok) fail('HCC_SOURCE_AUDIT_BASELINE_UNAVAILABLE', 503);
  if (!service.store.get('hospitals').some(x => x.hospitalId === 'HOSP-A' && x.status === 'ACTIVE')) fail('SOURCE_HOSPITAL_INACTIVE');
}
function gateway(principal) {
  if (principal?.role !== 'INTERNAL_SERVICE' || principal.subject !== 'hcc-source-gateway'
    || principal.hospitalId !== 'HOSP-A' || principal.authMethod !== 'INTERNAL_SERVICE_TOKEN'
    || !principal.scopes?.includes('gateway:hcc-source-verify')) fail('HCC_SOURCE_GATEWAY_REQUIRED', 403);
}
function exact(input, keys) {
  if (!input || Array.isArray(input) || Object.keys(input).sort().join() !== [...keys].sort().join()) fail('HCC_SOURCE_INVALID_INPUT', 400);
}
function now(service) { const n = Date.parse(service.clock()); if (!Number.isFinite(n)) fail('HCC_SOURCE_CLOCK_UNAVAILABLE', 503); return n; }
function rows(service) { return service.store.persistedData?.auditLogs ?? []; }
function fresh(row, time, ttl) {
  const age = time - Date.parse(row?.createdAt); return Number.isFinite(age) && age >= 0 && age < ttl;
}
async function append(service, action, challengeId, reasonCode) {
  await service.writeAudit({ actorType: 'GATEWAY', actorId: 'hcc-source-gateway', hospitalId: 'HOSP-A',
    sourceHospitalId: 'HOSP-A', studyInstanceUid: HCC_STUDY_UID, seriesInstanceUid: HCC_SERIES_UID,
    auditSessionId: challengeId, action, result: 'SUCCESS', reasonCode, skipAnomalyDetection: true });
  if (service.store.appendOnlyChanges() == null) fail('HCC_SOURCE_APPEND_REQUIRED', 503);
  try { await service.store.saveRequiredAppendOnly(); }
  catch { service.store.persistenceBlocked = true; fail('HCC_SOURCE_COMMIT_UNCONFIRMED', 503); }
  const record = rows(service).findLast(x => x.action === action && x.auditSessionId === challengeId);
  if (!record) { service.store.persistenceBlocked = true; fail('HCC_SOURCE_COMMIT_UNCONFIRMED', 503); }
  return record;
}
export function issueHccChallenge(args) {
  return serializeHcc(args.service, async () => {
    const { service, principal, input, env } = args; gateway(principal); baseline(service, env);
    exact(input, ['datasetId']); if (input.datasetId !== HCC_DATASET_ID) fail('HCC_SOURCE_DATASET_MISMATCH', 400);
    const time = now(service), challengeId = `hcc-source-${randomUUID()}`;
    const row = await append(service, 'HCC_SOURCE_CHALLENGE_ISSUED', challengeId, HCC_MANIFEST_SHA256);
    return { challengeId, issuedAt: row.createdAt, expiresAt: new Date(time + CHALLENGE_MS).toISOString(), ...HCC_SOURCE_CONTRACT };
  });
}
export function acceptHccReport(args) {
  return serializeHcc(args.service, async () => {
    const { service, principal, input, env } = args; gateway(principal); baseline(service, env);
    exact(input, ['challengeId', ...Object.keys(HCC_SOURCE_CONTRACT)]);
    if (Object.entries(HCC_SOURCE_CONTRACT).some(([key, value]) => input[key] !== value)) fail('HCC_SOURCE_REPORT_MISMATCH', 400);
    const challenge = rows(service).find(x => x.action === 'HCC_SOURCE_CHALLENGE_ISSUED' && x.auditSessionId === input.challengeId);
    if (!challenge || !fresh(challenge, now(service), CHALLENGE_MS)) fail('HCC_SOURCE_CHALLENGE_EXPIRED');
    if (rows(service).some(x => x.action === 'HCC_SOURCE_REPORT_ACCEPTED' && x.auditSessionId === input.challengeId)) fail('HCC_SOURCE_REPORT_REPLAY');
    const proofSha256 = createHash('sha256').update(JSON.stringify({ challengeId: input.challengeId, ...HCC_SOURCE_CONTRACT })).digest('hex');
    const row = await append(service, 'HCC_SOURCE_REPORT_ACCEPTED', input.challengeId, `HCC_V1:${HCC_INVENTORY_SHA256}:${proofSha256}`);
    return { receiptId: row.auditId, proofSha256, auditRecordHash: row.recordHash, acceptedAt: row.createdAt,
      expiresAt: new Date(Date.parse(row.createdAt) + RECEIPT_MS).toISOString(), review: 'DRAFT / UNASSIGNED' };
  });
}
export function requireHccReceipt(service, receiptId, env) {
  baseline(service, env);
  const row = rows(service).find(x => x.auditId === receiptId && x.action === 'HCC_SOURCE_REPORT_ACCEPTED');
  const challenge = row && rows(service).find(x => x.action === 'HCC_SOURCE_CHALLENGE_ISSUED' && x.auditSessionId === row.auditSessionId);
  const proof = row && createHash('sha256').update(JSON.stringify({ challengeId: row.auditSessionId, ...HCC_SOURCE_CONTRACT })).digest('hex');
  if (!row || !challenge || row.actorId !== 'hcc-source-gateway' || row.hospitalId !== 'HOSP-A' || row.result !== 'SUCCESS'
    || row.reasonCode !== `HCC_V1:${HCC_INVENTORY_SHA256}:${proof}` || !fresh(row, now(service), RECEIPT_MS)) fail('HCC_SOURCE_RECEIPT_INVALID');
  if (rows(service).some(x => x.action === 'SYNTHETIC_CATALOG_REGISTRATION_REQUESTED' && x.auditSessionId === row.auditSessionId)) fail('HCC_SOURCE_RECEIPT_USED');
  return { studyCount: 1, seriesCount: 1, instanceCount: 700, verification: 'AUTHENTICATED_GATEWAY_RAW_HASH_REPORT',
    auditSessionId: row.auditSessionId, receiptId: row.auditId, proofSha256: proof };
}
