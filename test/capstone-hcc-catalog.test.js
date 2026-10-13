import test from 'node:test';
import assert from 'node:assert/strict';
import { HCC_DATASET_ID, HCC_INSTANCE_COUNT, HCC_MANIFEST_SHA256, HCC_PATIENT_ID, HCC_SERIES_UID, HCC_SOURCE_PATIENT_ID, HCC_STUDY_UID, hccCatalog, isHccCatalogCommitted, registerHccCatalog, verifyHccSourceStudy } from '../src/capstone-hcc-catalog.js';

import { fixture, source, prepareReceipt } from './helpers/hcc-source-fixture.js';

test('main scenario is pinned to the 700-slice reference-anchored synthetic CT manifest', () => {
  const { patient, studies, manifestSha256 } = hccCatalog('2026-10-10T00:00:00.000Z');
  const [study] = studies;
  assert.equal(HCC_STUDY_UID, '2.25.259656708708993797343330994179169711072');
  assert.equal(HCC_SERIES_UID, '2.25.18361638789025095699746776899955737977');
  assert.equal(HCC_SOURCE_PATIENT_ID, 'MEDIQ-SYN-HG-REF700-001');
  assert.equal(manifestSha256, 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721');
  assert.equal(patient.patientId, HCC_PATIENT_ID);
  assert.equal(study.series.length, 1);
  assert.equal(study.series[0].seriesInstanceUid, HCC_SERIES_UID);
  assert.equal(study.series[0].instanceCount, HCC_INSTANCE_COUNT);
  assert.equal(study.series[0].bytes, 2202766342);
  assert.match(study.description, /NOT FOR CLINICAL USE/);
});

test('catalog requires a committed authenticated raw-hash receipt before append', async () => {
  const f = fixture(); await prepareReceipt(f); const before = structuredClone(f.store.data);
  const result = await registerHccCatalog(f);
  assert.equal(result.studyCount, 1); assert.equal(result.seriesCount, 1); assert.equal(result.instanceCount, HCC_INSTANCE_COUNT);
  assert.equal(result.sourceVerification, 'AUTHENTICATED_GATEWAY_RAW_HASH_REPORT');
  assert.equal(result.manifestSha256, HCC_MANIFEST_SHA256); assert.equal(result.consentIssued, false);
  assert.equal(result.patientOwnership, 'NOT VERIFIED'); assert.equal(result.review, 'DRAFT / UNASSIGNED');
  assert.equal(isHccCatalogCommitted(f.store), true);
  assert.equal(f.service.listStudies(HCC_PATIENT_ID, { includeSeries: true })[0].series.length, 1);
  assert.equal(f.store.data.imagingStudies.filter(row => row.patientId !== HCC_PATIENT_ID).length,
    before.imagingStudies.length);
  assert.deepEqual(f.store.data.consents, before.consents);
  assert.deepEqual(f.store.data.dicomAccessTokenLogs, before.dicomAccessTokenLogs);
  assert.equal(f.service.verifyAuditIntegrity().ok, true);
  assert.ok(!f.calls.some(sql => /TRUNCATE|DELETE|UPDATE/i.test(sql)));
});

test('catalog does not register metadata when source Study, Series, or instance inventory is incomplete', async () => {
  for (const options of [{ missing: true }, { badSeries: true }, { badCount: true }]) {
    const f = fixture(options), before = structuredClone(f.store.data);
    await assert.rejects(verifyHccSourceStudy(f.service.orthanc), error => error.code === 'SOURCE_DATASET_NOT_READY');
    assert.deepEqual(f.store.data, before);
  }
});

test('QIDO accepts DICOM JSON PN values and an omitted optional StudyDescription', async () => {
  const f = fixture({ structuredPatientName: true, omitStudyDescription: true });
  const result = await verifyHccSourceStudy(f.service.orthanc);
  assert.equal(result.studyCount, 1);
  assert.equal(result.seriesCount, 1);
  assert.equal(result.instanceCount, HCC_INSTANCE_COUNT);
});

test('catalog is opt-in, Hospital-A-admin-only, fixed-input-only, and refuses collisions', async () => {
  for (const change of [
    f => { f.env.HIPASS_CAPSTONE_HCC_CATALOG = '0'; },
    f => { f.principal.role = 'PATIENT'; },
    f => { f.principal.hospitalId = 'HOSP-B'; },
    f => { f.input.datasetId = 'OTHER'; },
    f => { f.store.data.imagingStudies.push({ ...hccCatalog('x').studies[0], description: 'FOREIGN' }); f.store.persistedData = structuredClone(f.store.data); },
  ]) {
    const f = fixture(); await prepareReceipt(f); change(f); const before = structuredClone(f.store.data);
    await assert.rejects(registerHccCatalog(f)); assert.deepEqual(f.store.data, before);
  }
  const f = fixture(); f.service.orthanc = source({ missing: true });
  await assert.rejects(registerHccCatalog(f), error => error.code === 'SYNTHETIC_DATASET_REQUIRED');
  assert.equal(f.store.data.imagingStudies.some(row => row.studyInstanceUid === HCC_STUDY_UID), false);
});

test('failed persistence never advertises the HCC profile as committed', async () => {
  const f = fixture();
  await prepareReceipt(f);
  f.store.client.query = async sql => { if (/INSERT INTO patients/.test(sql)) throw new Error('DATABASE_UNAVAILABLE'); return { rows: [] }; };
  await assert.rejects(registerHccCatalog(f), /DATABASE_UNAVAILABLE/);
  assert.equal(isHccCatalogCommitted(f.store), false);
  assert.equal(f.service.listStudies(HCC_PATIENT_ID).length, 0);
  assert.equal(f.store.data.auditLogs.at(-1).result, 'REQUESTED');
});
