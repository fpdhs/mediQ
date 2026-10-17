import test from 'node:test';
import assert from 'node:assert/strict';
import { patientPublicOrigins, patientRequestOrigin, PATIENT_APP_ORIGIN, PATIENT_IMAGE_ORIGIN } from '../src/patient-public-origins.js';
const legacy='https://192.168.111.149:9443';
const env={HIPASS_PATIENT_ISSUANCE_ORIGIN:PATIENT_APP_ORIGIN,HIPASS_PATIENT_IMAGE_ORIGIN:PATIENT_IMAGE_ORIGIN};
test('patient origin pair is exact, explicit, and does not alter doctor URLs',()=>{
  assert.deepEqual(patientPublicOrigins(env,legacy),{issuance:PATIENT_APP_ORIGIN,images:PATIENT_IMAGE_ORIGIN});
  assert.deepEqual(patientPublicOrigins({},legacy),{issuance:legacy,images:legacy});
  assert.equal(patientRequestOrigin('/api/patients/MEDIQ-SYN-HCC-001/studies/1.2.3/self-view-grants',env,legacy),PATIENT_APP_ORIGIN);
  assert.equal(patientRequestOrigin('/api/dicom-access/request',env,legacy),legacy);
  assert.equal(patientRequestOrigin('/api/patients/p/studies/1.2.3/self-view-grants?redirect=evil',env,legacy),legacy);
  for(const patch of [{HIPASS_PATIENT_IMAGE_ORIGIN:''},{HIPASS_PATIENT_ISSUANCE_ORIGIN:''},
    {HIPASS_PATIENT_IMAGE_ORIGIN:'https://evil.invalid'},{HIPASS_PATIENT_IMAGE_ORIGIN:PATIENT_IMAGE_ORIGIN+'/path'}])
    assert.throws(()=>patientPublicOrigins({...env,...patch},legacy),/PAIR_INVALID/);
});

test('Entra clinician issuance uses only the explicitly configured public origin',()=>{
  assert.equal(patientRequestOrigin('/api/dicom-access/request',{...env,AUTH_MODE:'ENTRA_OIDC'},legacy),PATIENT_APP_ORIGIN);
  assert.equal(patientRequestOrigin('/api/dicom-access/request',{AUTH_MODE:'ENTRA_OIDC'},legacy),legacy);
  assert.equal(patientRequestOrigin('/api/dicom-access/request?redirect=evil',{...env,AUTH_MODE:'ENTRA_OIDC'},legacy),legacy);
  assert.throws(()=>patientRequestOrigin('/api/dicom-access/request',{...env,AUTH_MODE:'ENTRA_OIDC',HIPASS_PATIENT_ISSUANCE_ORIGIN:'https://evil.invalid'},legacy),/PAIR_INVALID/);
});
