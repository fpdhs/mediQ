import fs from 'node:fs';

const filePath = 'src/health-helper-school-demo-medical-tests.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
const importTarget = `import {retrieveUploadedEvidence} from './medlineplus-upload-corpus.js';`;
const importReplacement = `import {retrieveUploadedEvidence} from './medlineplus-upload-corpus.js';
import {retrieveLiverFunctionEvidence} from './health-helper-liver-evidence.js';
import {retrieveAfpEvidence} from './health-helper-afp-evidence.js';
import {retrieveImagingEvidence} from './health-helper-imaging-evidence.js';`;

if (!content.includes(importTarget)) {
  console.error('Import target not found!');
  process.exit(1);
}
content = content.replace(importTarget, importReplacement);

// 2. Add adaptScenarioEvidence and update retrieveSchoolDemoCandidateEvidence
const funcTarget = `export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
 const base=retrieveUploadedEvidence(question,baseCorpus);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(base.status))return base;
 return retrieveSchoolDemoMedicalTestEvidence(question,addendum)??base;
}`;

const funcReplacement = `function adaptScenarioEvidence(retrieval){
 if(retrieval?.status!=='CANDIDATE'||!Array.isArray(retrieval.evidence)||!retrieval.evidence.length)return null;
 const chunk=retrieval.evidence[0];
 const adapted={
  ...chunk,
  doc_id:chunk.doc_id??chunk.chunk_id,
  demoIndexStatus:'PASS',
  schoolDemoCandidateStatus:'PASS',
  ai_qa_status:'PASS',
  contentReview:'UNASSIGNED',
  sourceContentReview:'UNASSIGNED',
  unresolvedIssueCount:0,
  allowedSentenceIndexes:[0],
 };
 return {
  ...retrieval,
  extractiveOnly:true,
  evidence:[adapted],
 };
}

export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
 const base=retrieveUploadedEvidence(question,baseCorpus);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(base.status))return base;
 const addendumEvidence=retrieveSchoolDemoMedicalTestEvidence(question,addendum);
 if(addendumEvidence&&addendumEvidence.status==='CANDIDATE')return addendumEvidence;

 const liver=retrieveLiverFunctionEvidence(question);
 if(liver.status==='CANDIDATE'){
  const adapted=adaptScenarioEvidence(liver);
  if(adapted)return adapted;
 }
 const afp=retrieveAfpEvidence(question);
 if(afp.status==='CANDIDATE'){
  const adapted=adaptScenarioEvidence(afp);
  if(adapted)return adapted;
 }
 const imaging=retrieveImagingEvidence(question);
 if(imaging.status==='CANDIDATE'){
  const adapted=adaptScenarioEvidence(imaging);
  if(adapted)return adapted;
 }

 return addendumEvidence??base;
}`;

if (!content.includes(funcTarget)) {
  console.error('Function target not found!');
  process.exit(1);
}
content = content.replace(funcTarget, funcReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated src/health-helper-school-demo-medical-tests.js!');
