import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const archiveRetentionPolicy = 'CONSENT_BOUND_V1';
const uid = value => typeof value === 'string' && value.length <= 64 && /^[0-9]+(?:\.[0-9]+)+$/.test(value);

export function captureArchiveRetention(consent, now) {
  const time = Date.parse(now);
  if (!consent?.consentId || consent.status !== 'ACTIVE' || consent.permission !== 'DOWNLOAD_ALLOWED'
    || !Number.isFinite(time) || !(Date.parse(consent.validFrom) <= time && time < Date.parse(consent.validUntil))) {
    throw new Error('ARCHIVE_CONSENT_REQUIRED');
  }
  return { policy: archiveRetentionPolicy, consentId: consent.consentId,
    validUntil: new Date(consent.validUntil).toISOString(), state: 'STORED', capturedAt: now };
}

// This check adds retention restrictions; it never replaces actor/token/scope authorization.
export function archiveRetentionDecision(manifest, consent, now) {
  const r = manifest.retention;
  if (r?.policy !== archiveRetentionPolicy) return { allowed: false, reason: 'RETENTION_UNBOUND', deleteDue: false };
  if (['DELETE_PENDING','DELETE_FAILED','DELETED'].includes(r.state)) return { allowed:false, reason:r.state, deleteDue:r.state !== 'DELETED' };
  if (r.state !== 'STORED' || !Number.isFinite(Date.parse(now)) || !Number.isFinite(Date.parse(r.validUntil))) return { allowed:false, reason:'RETENTION_INVALID', deleteDue:false };
  if (Date.parse(now) >= Date.parse(r.validUntil)) return { allowed:false, reason:'RETENTION_EXPIRED', deleteDue:true };
  if (!consent || consent.consentId !== r.consentId || consent.patientId !== manifest.patientId
    || consent.sourceHospitalId !== manifest.sourceHospitalId || consent.targetHospitalId !== manifest.targetHospitalId) return { allowed:false, reason:'CONSENT_UNAVAILABLE', deleteDue:false };
  if (consent.status === 'REVOKED') return { allowed:false, reason:'CONSENT_REVOKED', deleteDue:true };
  if (consent.status === 'EXPIRED' || Date.parse(now) >= Date.parse(consent.validUntil)) return { allowed:false, reason:'CONSENT_EXPIRED', deleteDue:true };
  if (consent.status !== 'ACTIVE' || consent.permission !== 'DOWNLOAD_ALLOWED' || !(Date.parse(consent.validFrom) <= Date.parse(now))) return { allowed:false, reason:'CONSENT_NOT_ACTIVE', deleteDue:false };
  return { allowed:true, reason:'WITHIN_RETENTION', deleteDue:false };
}

export function archiveStudyDirectory(root, studyUid) {
  if (!uid(studyUid)) throw new Error('ARCHIVE_UID_INVALID');
  const base = path.resolve(root);
  if (base === path.parse(base).root || base === path.resolve('.')) throw new Error('ARCHIVE_ROOT_UNSAFE');
  // Reject symbolic links / junctions in every existing path component.
  let cursor = path.parse(base).root;
  for (const part of base.slice(cursor.length).split(path.sep).filter(Boolean).concat(studyUid)) {
    cursor = path.join(cursor, part);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('ARCHIVE_SYMLINK_DENIED');
  }
  return path.join(base, studyUid);
}

function readManifest(directory) {
  const file = path.join(directory, 'manifest.json');
  if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('ARCHIVE_MANIFEST_UNSAFE');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function persist(directory, manifest) {
  const temp = path.join(directory, `retention-${randomUUID()}.tmp`);
  fs.writeFileSync(temp, JSON.stringify(manifest), { flag:'wx', mode:0o600 });
  fs.renameSync(temp, path.join(directory, 'manifest.json'));
}

/** Exact managed files only. Never recursively deletes a directory or follows storedPath. */
export async function purgeExpiredArchive({root, studyUid, getConsent, now, audit, unlink = fs.unlinkSync}) {
  const directory = archiveStudyDirectory(root, studyUid);
  const manifest = readManifest(directory);
  if (manifest.studyInstanceUid !== studyUid) throw new Error('ARCHIVE_SCOPE_MISMATCH');
  const decision = archiveRetentionDecision(manifest, await getConsent(manifest.retention?.consentId), now);
  if (!decision.deleteDue) return { ...decision, state:manifest.retention?.state ?? 'UNBOUND' };
  const r = manifest.retention;
  r.state = 'DELETE_PENDING'; r.reason = decision.reason; r.updatedAt = now;
  persist(directory, manifest); // Durable deny before deletion or audit I/O.
  try {
    await audit({action:'ARCHIVE_DELETE_STARTED',studyInstanceUid:studyUid,consentId:r.consentId,result:'SUCCESS'});
    delete manifest.keyEnvelope;
    persist(directory, manifest);
    for (const instance of manifest.instances ?? []) {
      if (!uid(instance.seriesInstanceUid) || !uid(instance.sopInstanceUid)) throw new Error('ARCHIVE_OBJECT_UID_INVALID');
      const series = path.join(directory, instance.seriesInstanceUid);
      if (fs.existsSync(series) && fs.lstatSync(series).isSymbolicLink()) throw new Error('ARCHIVE_SYMLINK_DENIED');
      const file = path.join(series, `${instance.sopInstanceUid}.dcm.enc`);
      if (!fs.existsSync(file)) continue;
      if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) throw new Error('ARCHIVE_FILE_UNSAFE');
      unlink(file);
    }
    await audit({action:'ARCHIVE_DELETE_COMPLETED',studyInstanceUid:studyUid,consentId:r.consentId,result:'SUCCESS'});
    r.state = 'DELETED'; r.deletedAt = now;
    manifest.instances = []; manifest.instancesCount = 0; manifest.totalBytes = 0;
    persist(directory, manifest);
    return {allowed:false,state:'DELETED',deleteDue:false};
  } catch {
    r.state = 'DELETE_FAILED'; r.updatedAt = now; persist(directory, manifest);
    await audit({action:'ARCHIVE_DELETE_FAILED',studyInstanceUid:studyUid,consentId:r.consentId,result:'FAIL'}).catch(()=>{});
    return {allowed:false,state:'DELETE_FAILED',deleteDue:true};
  }
}
