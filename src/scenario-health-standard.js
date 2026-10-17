import {createHash} from 'node:crypto';
import {HCC_PATIENT_ID,HCC_PATIENT_SUBJECT,HCC_PRESENTATION} from './capstone-hcc-catalog.js';

// Called only AFTER authentication. Entra subjects come from the server actor map,
// never email addresses, browser patient IDs, or forwarded identity headers.
export function isScenarioHealthPatient(principal) {
  return principal?.role === 'PATIENT' && principal.patientId === HCC_PATIENT_ID
    && (principal.subject === HCC_PATIENT_SUBJECT
      || (principal.authMode === 'ENTRA_OIDC' && principal.authMethod === 'ENTRA_OIDC_ACCESS_TOKEN'
        && principal.subject === 'synthetic-patient-hcc'));
}

const meta = {tag:[{system:'urn:highpass:data-use',code:'synthetic-nonclinical',display:'합성 시연 · 임상 사용 불가'}]};
const id = value => 'syn-' + createHash('sha256').update(value).digest('hex').slice(0,24);
const units = {'cm':'cm','kg':'kg','kg/㎡':'kg/m2','mmHg':'mm[Hg]','g/dL':'g/dL','mg/dL':'mg/dL','U/L':'U/L','ng/mL':'ng/mL','mL/min/1.73㎡':'mL/min/{1.73_m2}'};

// A projection of the existing SYNTHETIC scenario, not a clinical source or a
// full FHIR server. No invented LOINC codes, diagnoses, encounters or endpoints.
export function scenarioHealthStandard(records, studies, now = new Date()) {
  if (!Array.isArray(studies) || studies.some(s => s.patientId !== HCC_PATIENT_ID)) throw new Error('SCENARIO_STUDY_BINDING_INVALID');
  const patient = {resourceType:'Patient',id:id(HCC_PATIENT_ID),meta,active:true,name:[{text:HCC_PRESENTATION.patientName}],gender:'male'};
  const subject = {reference:`Patient/${patient.id}`};
  const resources = [patient];
  for (const record of records) {
    const observations = (record.kind === 'CHECKUP' ? record.fields : record.kind === 'AFP' ? [{label:record.title,value:record.value,unit:record.unit}] : [])
      .map((field,index) => {
        const value = typeof field.value === 'number' && Number.isFinite(field.value)
          ? {valueQuantity:{value:field.value,...(field.unit ? {unit:field.unit} : {}),...(units[field.unit] ? {system:'http://unitsofmeasure.org',code:units[field.unit]} : {})}}
          : {valueString:String(field.value)};
        return {resourceType:'Observation',id:id(`${record.id}:${index}`),meta,status:'final',code:{text:field.label},subject,
          effectiveDateTime:record.date,performer:[{display:record.hospital}],method:{text:record.method},...value,
          note:[{text:'프로젝트에서 임의 작성한 합성 결과. 실제 검사·판독 결과가 아닙니다.'}]};
      });
    resources.push(...observations,{resourceType:'DiagnosticReport',id:id(record.id),meta,status:'final',code:{text:record.title},subject,
      effectiveDateTime:record.date,performer:[{display:record.hospital}],
      ...(observations.length ? {result:observations.map(o=>({reference:`Observation/${o.id}`}))} : {}),
      ...(record.kind === 'ULTRASOUND' ? {conclusion:'합성 초음파 예시 이미지가 연결된 시연 기록입니다. DICOM 검사나 실제 판독 결과가 아닙니다.'} : {})});
  }
  for (const study of studies) {
    resources.push({resourceType:'ImagingStudy',id:id(study.studyInstanceUid),meta,status:'registered',subject,
      identifier:[{system:'urn:dicom:uid',value:`urn:oid:${study.studyInstanceUid}`}],started:study.studyDate,
      description:study.description,modality:[{system:'http://dicom.nema.org/resources/ontology/DCM',code:study.modality}],
      numberOfSeries:study.series.length,numberOfInstances:study.series.reduce((n,s)=>n+s.instanceCount,0),
      series:study.series.map(s=>({uid:s.seriesInstanceUid,modality:{system:'http://dicom.nema.org/resources/ontology/DCM',code:s.modality},numberOfInstances:s.instanceCount})),
      note:[{text:'등록 카탈로그의 메타데이터입니다. 새로고침은 PACS 원본 재검증이나 영상 다운로드가 아닙니다.'}]});
  }
  return {patient:{displayName:HCC_PRESENTATION.patientName},fhirVersion:'4.0.1',fhirBundle:{resourceType:'Bundle',type:'collection',meta,
    timestamp:now.toISOString(),entry:resources.map(resource=>({fullUrl:`https://example.org/highpass-synthetic-fhir/${resource.resourceType}/${resource.id}`,resource}))},
    counts:{records:records.length,observations:resources.filter(r=>r.resourceType==='Observation').length,imagingStudies:studies.length},
    refreshedAt:now.toISOString(),studies};
}
