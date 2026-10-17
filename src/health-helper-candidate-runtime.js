import {readFile} from 'node:fs/promises';
import {sha256} from './health-helper-medlineplus.js';

export const CANDIDATE_RUNTIME_CONTRACT='candidate-runtime-20261013-v3';
const runtimeFiles=[
 'scripts/start-health-helper-school-demo-lan.js','scripts/medlineplus-local-preview.js',
 'src/health-helper-school-demo-runtime-config.js','src/health-helper-candidate-runtime.js',
 'src/health-helper-candidate-http.js','src/health-helper-candidate-generation.js',
 'src/health-helper-medlineplus.js','src/medlineplus-upload-corpus.js',
 'src/health-helper-school-demo-medical-tests.js','fixtures/health-helper-school-demo-medical-tests-2026-10-13.json',
 'public/ui/candidate-question-context.js','public/ui/patient-helper.js',
 'public/ui/patient-helper.css','public/ui/health-comparison.js','public/ui/health-comparison.css',
 'public/mobile/health-helper.css',
];
export async function candidateSourceFingerprint(){
 const entries=await Promise.all(runtimeFiles.map(async path=>[path,sha256(await readFile(new URL(`../${path}`,import.meta.url)))]));
 return sha256(JSON.stringify(entries));
}

export function candidateRuntimeStatus({sourceFingerprint,schoolDemo,uploaded,supplements=[],startedAt}){
 if(!/^sha256:[a-f0-9]{64}$/u.test(sourceFingerprint)||!Number.isFinite(Date.parse(startedAt)))throw Error('RUNTIME_STATUS_INVALID');
 if(schoolDemo&&(!uploaded||uploaded.indexScope!=='SCHOOL_DEMO_ALL_TRANSLATIONS'))throw Error('RUNTIME_PROFILE_INVALID');
 if(schoolDemo&&(uploaded.schoolDemoCandidateStatus!=='PASS'||uploaded.indexedDocuments!==uploaded.demoIndexPassDocuments))
  throw Error('RUNTIME_DEMO_CANDIDATE_STATUS_INVALID');
 if(!Array.isArray(supplements)||!schoolDemo&&supplements.length>0||supplements.some(item=>item?.status!=='DRAFT / UNASSIGNED'
  ||item?.indexScope!=='SCHOOL_DEMO_MEDICAL_TEST_ADDENDUM'||item?.collection!=='MedlinePlus Medical Tests'
  ||typeof item?.version!=='string'||!Number.isSafeInteger(item?.demoIndexPassDocuments)
  ||item.demoIndexPassDocuments!==item.indexedDocuments||item.schoolDemoCandidateStatus!=='PASS'
  ||item.clinicalUse!==false||item.serviceDeployment!==false))
  throw Error('RUNTIME_SUPPLEMENT_INVALID');
 return Object.freeze({status:'RUNNING',runtimeContract:CANDIDATE_RUNTIME_CONTRACT,
  // Snapshot at startup; this is not proof of every cached module's loaded bytes.
  startupSourceFingerprint:sourceFingerprint,startedAt,
  profile:schoolDemo?'SCHOOL_DEMO_ALL_TRANSLATIONS':uploaded?'UPLOADED_QA_PASS_TRANSLATIONS':'OTHER_CANDIDATE_PREVIEW',
  corpus:uploaded?Object.freeze({version:uploaded.version,indexScope:uploaded.indexScope,
   indexedDocuments:uploaded.indexedDocuments,indexedChunks:uploaded.chunks.length,
   demoIndexPassDocuments:uploaded.demoIndexPassDocuments,schoolDemoCandidateStatus:uploaded.schoolDemoCandidateStatus,
   schoolDemoCandidatePassDocuments:uploaded.indexedDocuments,sourceQaHoldsPreserved:uploaded.held.length}):null,
  corpusSupplements:Object.freeze(supplements.map(item=>Object.freeze({version:item.version,indexScope:item.indexScope,
   collection:item.collection,indexedDocuments:item.indexedDocuments,indexedChunks:item.chunks.length,
   demoIndexPassDocuments:item.demoIndexPassDocuments,schoolDemoCandidateStatus:item.schoolDemoCandidateStatus,
   schoolDemoCandidatePassDocuments:item.indexedDocuments,sourceQaHoldsPreserved:item.held.length,
   clinicalUse:item.clinicalUse,serviceDeployment:item.serviceDeployment}))),
  modelAvailability:'NOT_CHECKED',clinicalUse:false,patientService:false});
}

export function compareCandidateRuntime(actual,{sourceFingerprint,schoolDemo=true}={}){
 const issues=[];
 if(actual?.runtimeContract!==CANDIDATE_RUNTIME_CONTRACT)issues.push('RUNTIME_CONTRACT_MISMATCH');
 if(actual?.startupSourceFingerprint!==sourceFingerprint)issues.push('SOURCE_SNAPSHOT_MISMATCH');
 if(actual?.status!=='RUNNING'||typeof actual?.startedAt!=='string'||!Number.isFinite(Date.parse(actual.startedAt)))issues.push('RUNTIME_STATUS_INVALID');
 if(actual?.clinicalUse!==false||actual?.patientService!==false)issues.push('SERVICE_BOUNDARY_MISMATCH');
 if(schoolDemo&&(actual?.profile!=='SCHOOL_DEMO_ALL_TRANSLATIONS'
  ||actual?.corpus?.indexScope!=='SCHOOL_DEMO_ALL_TRANSLATIONS'))issues.push('SCHOOL_PROFILE_MISMATCH');
 if(schoolDemo&&(actual?.corpus?.indexedDocuments!==1017||actual?.corpus?.demoIndexPassDocuments!==1017
  ||actual?.corpus?.schoolDemoCandidateStatus!=='PASS'||actual?.corpus?.schoolDemoCandidatePassDocuments!==1017
  ||actual?.corpus?.indexedChunks!==20338||actual?.corpus?.version!=='medlineplus-upload-ko-20261012-v3'
  ||actual?.corpus?.sourceQaHoldsPreserved!==107))issues.push('CORPUS_SNAPSHOT_MISMATCH');
 if(schoolDemo&&(actual?.corpusSupplements?.length!==1||actual.corpusSupplements[0]?.version!=='medlineplus-medical-tests-school-demo-ko-20261013-v1'
  ||actual.corpusSupplements[0]?.indexScope!=='SCHOOL_DEMO_MEDICAL_TEST_ADDENDUM'
  ||actual.corpusSupplements[0]?.indexedDocuments!==2||actual.corpusSupplements[0]?.indexedChunks!==9
  ||actual.corpusSupplements[0]?.demoIndexPassDocuments!==2||actual.corpusSupplements[0]?.sourceQaHoldsPreserved!==2
  ||actual.corpusSupplements[0]?.schoolDemoCandidateStatus!=='PASS'||actual.corpusSupplements[0]?.schoolDemoCandidatePassDocuments!==2
  ||actual.corpusSupplements[0]?.clinicalUse!==false||actual.corpusSupplements[0]?.serviceDeployment!==false))
  issues.push('CORPUS_SUPPLEMENT_MISMATCH');
 return {result:issues.length?'FAIL':'PASS',issues,
  scope:'Runtime contract, startup source snapshot and corpus profile; not model or clinical readiness.'};
}
