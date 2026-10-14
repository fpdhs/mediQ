import fs from 'node:fs';

const filePath = 'src/health-helper-school-demo-medical-tests.js';
let content = fs.readFileSync(filePath, 'utf8');

const target = `export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
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

const replacement = `export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
 const base=retrieveUploadedEvidence(question,baseCorpus);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(base.status))return base;
 const addendumEvidence=retrieveSchoolDemoMedicalTestEvidence(question,addendum);
 if(addendumEvidence&&addendumEvidence.status==='CANDIDATE')return addendumEvidence;
 if(base.status==='CANDIDATE')return base;

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

if (!content.includes(target)) {
  console.error('Target not found in src/health-helper-school-demo-medical-tests.js!');
  process.exit(1);
}
content = content.replace(target, replacement);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully adjusted order in src/health-helper-school-demo-medical-tests.js!');
