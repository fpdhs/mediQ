import { createHash } from 'node:crypto';
import { AuthError, PrincipalRole } from './auth.js';
import { ServiceValidationError } from './services.js';
import { requireHccReceipt, serializeHcc } from './hcc-source-verification.js';
import { HCC_DATASET_ID, HCC_STUDY_UID, HCC_SERIES_UID, HCC_MANIFEST_SHA256 } from './hcc-source-contract.js';
export { HCC_DATASET_ID, HCC_STUDY_UID, HCC_SERIES_UID, HCC_MANIFEST_SHA256 } from './hcc-source-contract.js';

// Pinned, fixed synthetic dataset. The canonical source manifest lives in the
// ignored generated artifact directory and its SHA is recorded below/reported.
// Registration requires a durable authenticated A Gateway raw-hash receipt.
// The QIDO helper below validates metadata only; it cannot authorize registration.
// No patient names, UIDs, endpoints, or DICOM bytes are accepted from requests.
export const HCC_PATIENT_ID = 'MEDIQ-SYN-HCC-001';
// DICOM source identity is intentionally distinct from the Control Plane's
// synthetic patient key; this is a fixed mapping, never caller supplied.
export const HCC_SOURCE_PATIENT_ID = 'MEDIQ-SYN-HG-REF700-001';
export const HCC_PATIENT_NAME = 'SYNTHETIC^HONG_GILDONG_56';
export const HCC_PATIENT_SUBJECT = 'synthetic-hcc-account';
export const HCC_INSTANCE_COUNT = 700;
export const HCC_PRESENTATION = Object.freeze({ id: 'HONG_GILDONG_SYNTHETIC_56', patientName: '홍길동', age: 56,
  sourceHospitalName: 'A대학병원', targetHospitalName: 'B대학병원', examName: '복부 CT · 700장 합성 표시 스택',
  referralSummary: '발표용 가상 설정: A대학병원에서 간암 진단 후 B대학병원으로 전원합니다. 본 합성 CT는 진단 근거가 아닙니다.',
  diagnosisOrigin: '발표용 가상 설정 — 영상에서 진단을 도출하지 않음', synthetic: true,
  imagingNotice: '합성·비임상 표시용 영상이며 실제 환자 영상, HU 보정 영상 또는 진단 자료가 아닙니다.' });

const fixedSeries = Object.freeze([
  Object.freeze({ seriesInstanceUid: HCC_SERIES_UID, modality: 'CT', description: 'REFERENCE-INTERPOLATED SYNTHETIC CT', instanceCount: HCC_INSTANCE_COUNT, bytes: 2202766342, previewImageUrl: null }),
]);

const tag = (row, id) => {
  const value = row?.[id]?.Value?.[0];
  // DICOM JSON represents PN components as an object (e.g. { Alphabetic }).
  return id === '00100010' && value && typeof value === 'object' ? value.Alphabetic : value;
};
const equalSeries = (actual = [], expected = fixedSeries) => actual.length === expected.length
  && expected.every(wanted => {
    const found = actual.find(row => row.seriesInstanceUid === wanted.seriesInstanceUid);
    return Boolean(found && ['modality', 'description', 'instanceCount', 'bytes', 'previewImageUrl'].every(key => found[key] === wanted[key]));
  });

export function hccCatalog(createdAt) {
  const patient = { patientId: HCC_PATIENT_ID, name: '홍길동 (합성 환자)', birthDate: '1970-01-01', phone: null, createdAt };
  const study = {
    studyId: 'HP-SYN-HCC-CT-20261010-001', patientId: patient.patientId, sourceHospitalId: 'HOSP-A',
    studyInstanceUid: HCC_STUDY_UID, modality: 'CT', bodyPart: 'ABDOMEN', studyDate: '2026-10-10',
    description: '합성 복부 CT 시연 영상 · 700 slices · NOT FOR CLINICAL USE', metadataOnly: false,
    series: fixedSeries.map(row => ({ ...row })),
  };
  const catalogSha256 = createHash('sha256').update(JSON.stringify({ manifestSha256: HCC_MANIFEST_SHA256, patient, study })).digest('hex');
  return { patient, studies: [study], catalogSha256, manifestSha256: HCC_MANIFEST_SHA256 };
}

function sameStudy(actual, expected) {
  const studyFields = ['studyId', 'patientId', 'sourceHospitalId', 'studyInstanceUid', 'modality', 'bodyPart', 'studyDate', 'description', 'metadataOnly'];
  return studyFields.every(key => actual[key] === expected[key]) && equalSeries(actual.series, expected.series);
}

export function isHccCatalogCommitted(store) {
  const data = store.persistedData;
  if (!data?.patients?.some(row => row.patientId === HCC_PATIENT_ID)) return false;
  const expected = hccCatalog('2026-10-10T00:00:00.000Z');
  return Boolean(data.patients.some(row => row.patientId === HCC_PATIENT_ID
    && row.name === expected.patient.name && row.birthDate === expected.patient.birthDate && row.phone === null)
    && expected.studies.every(study => data.imagingStudies?.some(row => sameStudy(row, study))));
}

export async function verifyHccSourceStudy(orthanc) {
  if (typeof orthanc?.qidoStudies !== 'function' || typeof orthanc?.qidoSeries !== 'function' || typeof orthanc?.qidoInstances !== 'function') {
    throw new ServiceValidationError('SOURCE_DATASET_NOT_READY', 'The fixed synthetic source dataset is unavailable', [], 409);
  }
  let studies;
  try {
    const result = await orthanc.qidoStudies(HCC_STUDY_UID);
    studies = result?.status === 200 ? result.body : null;
  } catch { studies = null; }
  if (!Array.isArray(studies) || studies.length !== 1 || tag(studies[0], '0020000D') !== HCC_STUDY_UID
    || tag(studies[0], '00100020') !== HCC_SOURCE_PATIENT_ID || tag(studies[0], '00100010') !== HCC_PATIENT_NAME
    || tag(studies[0], '00080020') !== '20261010'
    // StudyDescription is optional in a QIDO response. If present, still pin it;
    // the later authenticated all-instance raw hashes bind the source files to the manifest.
    || (tag(studies[0], '00081030') !== undefined && tag(studies[0], '00081030') !== 'SYNTHETIC CT DEMO - NOT FOR CLINICAL USE')) {
    throw new ServiceValidationError('SOURCE_DATASET_NOT_READY', 'The fixed synthetic source dataset is unavailable', [], 409);
  }
  let series;
  try {
    const result = await orthanc.qidoSeries(HCC_STUDY_UID);
    series = result?.status === 200 ? result.body : null;
  } catch { series = null; }
  const expectedUids = new Set(fixedSeries.map(row => row.seriesInstanceUid));
  if (!Array.isArray(series) || series.length !== fixedSeries.length
    || series.some(row => {
      const expected = fixedSeries.find(item => item.seriesInstanceUid === tag(row, '0020000E'));
      return tag(row, '0020000D') !== HCC_STUDY_UID || !expected || !expectedUids.has(tag(row, '0020000E'))
        || tag(row, '00080060') !== 'CT' || tag(row, '0008103E') !== expected.description;
    })
    || new Set(series.map(row => tag(row, '0020000E'))).size !== fixedSeries.length) {
    throw new ServiceValidationError('SOURCE_DATASET_NOT_READY', 'The fixed synthetic source dataset is unavailable', [], 409);
  }
  for (const row of fixedSeries) {
    let instances;
    try {
      const result = await orthanc.qidoInstances(HCC_STUDY_UID, row.seriesInstanceUid);
      instances = result?.status === 200 ? result.body : null;
    } catch { instances = null; }
    const instanceUids = Array.isArray(instances) ? instances.map(item => tag(item, '00080018')) : [];
    if (!Array.isArray(instances) || instances.length !== row.instanceCount || new Set(instanceUids).size !== row.instanceCount
      || instances.some(item => tag(item, '0020000D') !== HCC_STUDY_UID || tag(item, '0020000E') !== row.seriesInstanceUid
        || typeof tag(item, '00080018') !== 'string' || !/^(?:0|[1-9][0-9]*)(?:\.(?:0|[1-9][0-9]*))*$/.test(tag(item, '00080018')))) {
      throw new ServiceValidationError('SOURCE_DATASET_NOT_READY', 'The fixed synthetic source dataset is unavailable', [], 409);
    }
  }
  return { studyCount: 1, seriesCount: fixedSeries.length, instanceCount: fixedSeries.reduce((sum, row) => sum + row.instanceCount, 0), verification: 'ORTHANC_QIDO_COUNTS_ONLY' };
}

export function registerHccCatalog(args) {
  return serializeHcc(args.service, () => registerHccCatalogNow(args));
}
async function registerHccCatalogNow({ service, principal, input, env, meta = {} }) {
  if (env.HIPASS_CAPSTONE_HCC_CATALOG !== '1' || env.HIPASS_CAPSTONE_MOCK_IDP !== '1' || env.HIPASS_CONTROL_PLANE_ONLY !== '1'
    || env.HIPASS_STORE !== 'postgres' || env.NODE_ENV !== 'production' || env.AUTH_MODE !== 'TEST') {
    throw new AuthError(404, 'CAPSTONE_HCC_CATALOG_DISABLED');
  }
  if (principal?.role !== PrincipalRole.SECURITY_ADMIN || principal.hospitalId !== 'HOSP-A') throw new AuthError(403, 'SOURCE_CATALOG_ADMIN_REQUIRED');
  if (!input || Object.keys(input).sort().join() !== 'datasetId,receiptId' || input.datasetId !== HCC_DATASET_ID || typeof input.receiptId !== 'string') {
    throw new ServiceValidationError('SYNTHETIC_DATASET_REQUIRED', 'Select the predefined synthetic dataset');
  }
  const source = requireHccReceipt(service, input.receiptId, env);
  const store = service.store;
  if (typeof store.appendOnlyChanges !== 'function' || store.appendOnlyChanges() === null) {
    throw new ServiceValidationError('CATALOG_APPEND_BASELINE_REQUIRED', 'Catalog registration requires an unchanged persisted baseline', [], 409);
  }
  if (!store.get('hospitals').some(row => row.hospitalId === 'HOSP-A' && row.status === 'ACTIVE')) {
    throw new ServiceValidationError('SOURCE_HOSPITAL_INACTIVE', 'Source institution is unavailable', [], 409);
  }
  const { patient, studies, catalogSha256 } = hccCatalog(service.clock());
  const existingPatient = store.get('patients').find(row => row.patientId === patient.patientId);
  if (existingPatient && ['name', 'birthDate', 'phone'].some(key => existingPatient[key] !== patient[key])) {
    throw new ServiceValidationError('SYNTHETIC_CATALOG_COLLISION', 'Synthetic catalog conflicts with an existing record', [], 409);
  }
  const expected = studies[0];
  const existing = store.get('imagingStudies').filter(row => row.studyId === expected.studyId || row.studyInstanceUid === expected.studyInstanceUid
    || row.series?.some(series => expected.series.some(wanted => wanted.seriesInstanceUid === series.seriesInstanceUid)));
  if (existing.length && (existing.length !== 1 || !sameStudy(existing[0], expected))) {
    throw new ServiceValidationError('SYNTHETIC_CATALOG_COLLISION', 'Synthetic catalog conflicts with an existing record', [], 409);
  }
  const additions = existing.length ? [] : studies;
  const auditSessionId = source.auditSessionId;
  if (!existingPatient) store.get('patients').push(patient);
  store.get('imagingStudies').push(...additions);
  try {
    await service.writeAudit({ actorType: 'SYSTEM', actorId: principal.actorId ?? meta.actorId, hospitalId: 'HOSP-A', patientId: patient.patientId,
      auditSessionId, action: 'SYNTHETIC_CATALOG_REGISTRATION_REQUESTED', result: 'REQUESTED', reasonCode: existingPatient && !additions.length
        ? 'CAPSTONE_HCC_CATALOG_ALREADY_REGISTERED' : 'CAPSTONE_FIXED_HCC_SYNTHETIC_METADATA', ipAddress: meta.ipAddress,
      userAgent: meta.userAgent, ja3Fingerprint: meta.ja3Fingerprint });
    if (store.appendOnlyChanges() === null) throw new ServiceValidationError('CATALOG_APPEND_BASELINE_REQUIRED', 'Catalog registration cannot rewrite existing data', [], 409);
    await store.saveRequiredAppendOnly();
  } catch (error) {
    // A lost COMMIT acknowledgement must never allow receipt reuse in this process.
    store.persistenceBlocked = true;
    if (!isHccCatalogCommitted(store)) {
      const ownedIds = new Set(additions.map(row => row.studyId));
      store.set('imagingStudies', store.get('imagingStudies').filter(row => !ownedIds.has(row.studyId)));
      if (!existingPatient) store.set('patients', store.get('patients').filter(row => row.patientId !== HCC_PATIENT_ID));
    }
    throw error;
  }
  return { datasetId: HCC_DATASET_ID, patientId: patient.patientId, sourceHospitalId: 'HOSP-A', studyCount: 1,
    seriesCount: source.seriesCount, instanceCount: source.instanceCount, addedStudies: additions.length, catalogSha256,
    sourceVerification: source.verification, sourceReceiptId: source.receiptId, sourceProofSha256: source.proofSha256,
    manifestSha256: HCC_MANIFEST_SHA256, auditSessionId,
    registrationCommitAcknowledged: true, review: 'DRAFT / UNASSIGNED', clinicalUseAllowed: false,
    clinicalDiagnosis: 'NOT CLAIMED', consentIssued: false, patientOwnership: 'NOT VERIFIED' };
}
