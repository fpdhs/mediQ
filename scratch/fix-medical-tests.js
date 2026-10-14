import fs from 'node:fs';

const filePath = 'src/health-helper-school-demo-medical-tests.js';
let content = fs.readFileSync(filePath, 'utf8');

// 1. in retrieveSchoolDemoMedicalTestEvidence, inside if(afp) block, add comparison check before definition check
const afpTarget = ` if(afp){
  if(/(?:단독|혼자|만으로).{0,12}(?:선별|진단|암)|(?:선별|진단).{0,12}(?:AFP|알파태아단백)/iu.test(question))
   return select(chunks,'AFP-LIMIT-01',/AFP 검사 결과만으로 암을 선별하거나 진단하지 않습니다/u,'AFP_TEST_LIMIT','LIMITATIONS');
  if(/(?:수치|결과|높|낮|정상|비정상)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};`;

const afpReplacement = ` if(afp){
  if(/(?:단독|혼자|만으로).{0,12}(?:선별|진단|암)|(?:선별|진단).{0,12}(?:AFP|알파태아단백)/iu.test(question))
   return select(chunks,'AFP-LIMIT-01',/AFP 검사 결과만으로 암을 선별하거나 진단하지 않습니다/u,'AFP_TEST_LIMIT','LIMITATIONS');
  if(/(?:비교|이전|지난|추세)/u.test(question)){
   const comp=retrieveAfpEvidence(question);
   if(comp.status==='CANDIDATE')return adaptScenarioEvidence(comp);
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  }
  if(/(?:수치|결과|높|낮|정상|비정상)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};`;

if (!content.includes(afpTarget)) {
  console.error('AFP target not found!');
  process.exit(1);
}
content = content.replace(afpTarget, afpReplacement);

// 2. in retrieveSchoolDemoCandidateEvidence:
const candidateTarget = `export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
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

const candidateReplacement = `export function retrieveSchoolDemoCandidateEvidence(question,baseCorpus,addendum){
 const base=retrieveUploadedEvidence(question,baseCorpus);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(base.status))return base;
 const addendumEvidence=retrieveSchoolDemoMedicalTestEvidence(question,addendum);
 if(addendumEvidence!==null)return addendumEvidence;

 const liver=retrieveLiverFunctionEvidence(question);
 if(liver.status==='CANDIDATE'){
  const adapted=adaptScenarioEvidence(liver);
  if(adapted)return adapted;
 }

 return base;
}`;

if (!content.includes(candidateTarget)) {
  console.error('Candidate target not found!');
  process.exit(1);
}
content = content.replace(candidateTarget, candidateReplacement);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully updated src/health-helper-school-demo-medical-tests.js!');
