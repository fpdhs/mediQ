import { PostgresStore } from '../../src/postgres-store.js';
import { HipassService } from '../../src/services.js';
import { createSeedData } from '../../src/seed.js';
import { HCC_DATASET_ID, HCC_SOURCE_PATIENT_ID, hccCatalog } from '../../src/capstone-hcc-catalog.js';
import { issueHccChallenge, acceptHccReport, HCC_SOURCE_CONTRACT } from '../../src/hcc-source-verification.js';
const value = (Value, vr = 'LO') => ({ Value: [Value], vr });
export function source({ missing = false, badSeries = false, badCount = false, structuredPatientName = false, omitStudyDescription = false } = {}) {
  const study = hccCatalog('2026-10-10T00:00:00.000Z').studies[0];
  return {
    async qidoStudies(uid) { return { status: 200, body: missing ? [] : [{
      '0020000D': value(uid, 'UI'), '00100020': value(HCC_SOURCE_PATIENT_ID),
      '00100010': value(structuredPatientName ? { Alphabetic: 'SYNTHETIC^HONG_GILDONG_56' } : 'SYNTHETIC^HONG_GILDONG_56', 'PN'),
      '00080020': value('20261010', 'DA'),
      ...(!omitStudyDescription ? { '00081030': value('SYNTHETIC CT DEMO - NOT FOR CLINICAL USE') } : {}) }] }; },
    async qidoSeries(uid) { return { status: 200, body: (badSeries ? study.series.slice(1) : study.series).map(row => ({
      '0020000D': value(uid, 'UI'), '0020000E': value(row.seriesInstanceUid, 'UI'), '00080060': value('CT', 'CS'),
      '0008103E': value(row.description) })) }; },
    async qidoInstances(uid, seriesUid) {
      const record = study.series.find(row => row.seriesInstanceUid === seriesUid);
      return { status: 200, body: Array.from({ length: badCount ? record.instanceCount - 1 : record.instanceCount }, (_, i) => ({
        '0020000D': value(uid, 'UI'), '0020000E': value(seriesUid, 'UI'), '00080018': value(`2.25.${i + 1}`, 'UI') })) };
    },
  };
}
export function fixture(sourceOptions) {
  const store = Object.create(PostgresStore.prototype), calls = [];
  store.data = createSeedData(); store.data.auditLogs = [];
  store.persistedData = structuredClone(store.data); store.saveQueue = Promise.resolve();
  store.client = { async query(sql) { calls.push(sql); return { rows: [] }; } };
  const service = new HipassService(store, () => '2026-10-10T12:00:00.000Z'); service.orthanc = source(sourceOptions);
  return { store, service, calls, principal: { role: 'SECURITY_ADMIN', hospitalId: 'HOSP-A', actorId: 'synthetic-source-admin' },
    input: { datasetId: HCC_DATASET_ID }, env: { HIPASS_CAPSTONE_SINGLE_WRITER: '1', HIPASS_CAPSTONE_HCC_CATALOG: '1',
      HIPASS_CAPSTONE_MOCK_IDP: '1', HIPASS_CONTROL_PLANE_ONLY: '1', HIPASS_STORE: 'postgres', NODE_ENV: 'production', AUTH_MODE: 'TEST' } };
}
export const gatewayPrincipal = { role: 'INTERNAL_SERVICE', subject: 'hcc-source-gateway', hospitalId: 'HOSP-A',
  authMethod: 'INTERNAL_SERVICE_TOKEN', scopes: ['gateway:hcc-source-verify'] };
export async function prepareReceipt(f) {
  const args = { ...f, principal: gatewayPrincipal };
  const challenge = await issueHccChallenge(args);
  const receipt = await acceptHccReport({ ...args, input: { challengeId: challenge.challengeId, ...HCC_SOURCE_CONTRACT } });
  f.input.receiptId = receipt.receiptId; return receipt;
}
