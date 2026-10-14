import {readFile} from 'node:fs/promises';
import {sha256} from './health-helper-medlineplus.js';
import {retrieveUploadedEvidence} from './medlineplus-upload-corpus.js';
let liverFunctionModule=null;
let afpEvidenceModule=null;
try{
 liverFunctionModule=await import('./health-helper-liver-evidence.js');
}catch{}
try{
 afpEvidenceModule=await import('./health-helper-afp-evidence.js');
}catch{}

const fixtureUrl=new URL('../fixtures/health-helper-school-demo-medical-tests-2026-10-13.json',import.meta.url);
const policyUrl='https://medlineplus.gov/about/using/usingcontent/';
const validPage=url=>{
 try{
  const value=new URL(url);
  return value.protocol==='https:'&&value.hostname==='medlineplus.gov'&&!value.port&&!value.username&&!value.password
   &&!value.search&&!value.hash&&(/^\/[a-z0-9]+\.html$/u.test(value.pathname)||/^\/lab-tests\/[a-z0-9-]+\/$/u.test(value.pathname));
 }catch{return false;}
};

export async function loadSchoolDemoMedicalTestAddendum(){
 const bytes=await readFile(fixtureUrl),fixture=JSON.parse(bytes.toString('utf8'));
 if(fixture.schemaVersion!==1||fixture.version!=='medlineplus-medical-tests-school-demo-ko-20261013-v1'
  ||fixture.status!=='DRAFT / UNASSIGNED'||fixture.collection!=='MedlinePlus Medical Tests'
  ||fixture.sourceLanguage!=='English'||fixture.language!=='Korean'
  ||fixture.rightsStatus!=='public_domain_medical_test_information'||fixture.rightsPolicyUrl!==policyUrl
  ||fixture.humanReview!=='UNASSIGNED'||fixture.clinicalUse!==false||fixture.serviceDeployment!==false
  ||!Array.isArray(fixture.documents)||fixture.documents.length!==2
  ||fixture.bundleSha256!==sha256(JSON.stringify(fixture.documents)))throw Error('MEDICAL_TEST_ADDENDUM_MANIFEST_INVALID');
 const chunks=[],held=[];
 for(const document of fixture.documents){
  if(typeof document.id!=='string'||typeof document.titleKo!=='string'||!document.titleKo.trim()
   ||document.schoolDemoCandidateStatus!=='PASS'
   ||!validPage(document.sourceUrl)||document.aiQaStatus!=='HOLD'||document.contentReview!=='UNASSIGNED'
   ||document.sourceContentReview!=='UNASSIGNED'||!Array.isArray(document.unresolvedIssues)
   ||!document.unresolvedIssues.length||!Array.isArray(document.aliasesKo)||!document.aliasesKo.length
   ||!Array.isArray(document.segments)||!document.segments.length)throw Error('MEDICAL_TEST_ADDENDUM_DOCUMENT_INVALID');
  const seen=new Set();
  for(const segment of document.segments){
   if(typeof segment.id!=='string'||seen.has(segment.id)||typeof segment.textEn!=='string'||!segment.textEn.trim()
    ||typeof segment.textKo!=='string'||!segment.textKo.trim()||!/[가-힣]/u.test(segment.textKo)
    ||sha256(segment.textEn)!==segment.sourceSha256||sha256(segment.textKo)!==segment.translationSha256
    ||/[<>\u0000-\u0008]/u.test(segment.textKo)||!/[.!?。！？]$/u.test(segment.textKo))
    throw Error('MEDICAL_TEST_ADDENDUM_SEGMENT_INVALID');
   seen.add(segment.id);
   chunks.push({chunk_id:`${document.id}-${segment.id}`,doc_id:document.id,topic:document.id,title_ko:document.titleKo,
    source_title:document.titleKo,text_ko:segment.textKo,textSha256:segment.translationSha256,source_hash:segment.sourceSha256,
    source_url:document.sourceUrl,source_updated_at:null,source_segment_ids:[segment.id],segmentOffset:0,
    section_path:[segment.sectionKo],aliases:[document.titleKo,...document.aliasesKo],
    ai_qa_status:document.aiQaStatus,contentReview:document.contentReview,sourceContentReview:document.sourceContentReview,
    unresolvedIssueCount:document.unresolvedIssues.length,demoIndexStatus:'PASS',schoolDemoCandidateStatus:'PASS',
    attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:policyUrl,
    translation_notice:'비공식 한국어 번역 후보 · 독립 대조 및 임상 검토 미실시 · 학교 발표용 비임상 데모.'});
  }
  held.push({id:document.id,title:document.titleKo,title_en:document.titleEn,source_url:document.sourceUrl,
   status:'HOLD',schoolDemoCandidateStatus:'PASS',aiQaStatus:document.aiQaStatus,sourceContentReview:document.sourceContentReview,
   unresolvedIssueCount:document.unresolvedIssues.length,reason:document.unresolvedIssues.join(' · '),
   aliases:[document.titleKo,...document.aliasesKo],schoolDemoRetrievable:true,clinicalUse:false});
 }
 return Object.freeze({version:fixture.version,status:fixture.status,schoolDemoCandidateStatus:'PASS',
  schoolDemoCandidateStatusMeaning:'Accepted into the school-demo RAG candidate corpus only; this is not translation accuracy, content QA, rights, medical, or clinical approval.',
  indexScope:'SCHOOL_DEMO_MEDICAL_TEST_ADDENDUM',
  collection:fixture.collection,rightsCheckedAt:fixture.rightsCheckedAt,totalDocuments:fixture.documents.length,
  indexedDocuments:new Set(chunks.map(chunk=>chunk.doc_id)).size,demoIndexPassDocuments:new Set(chunks.map(chunk=>chunk.doc_id)).size,
  held,chunks,clinicalUse:false,serviceDeployment:false});
}

const sentences=chunk=>chunk.text_ko.match(/[^.!?。！？]+[.!?。！？]+/gu)??[];
const select=(chunks,id,pattern,focus,intent='UNDERSTAND')=>{
 const chunk=chunks.find(item=>item.source_segment_ids?.includes(id)&&pattern.test(item.text_ko));
 if(!chunk)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const index=sentences(chunk).findIndex(sentence=>pattern.test(sentence));
 if(index<0)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 return {status:'CANDIDATE',topic:chunk.topic,intent,focus:[focus],claimEvidenceRequired:true,
  evidence:[{...chunk,allowedSentenceIndexes:[index],focusSentenceIndexes:{[focus]:[index]}}]};
};

// Narrow school-demo routes bind each accepted wording to one complete translated source sentence.
// The raw question is used only by these rules and is not included in the model payload.
export function retrieveSchoolDemoMedicalTestEvidence(question,addendum){
 if(typeof question!=='string'||!question.trim()||question.length>600)return null;
 const chunks=addendum?.indexScope==='SCHOOL_DEMO_MEDICAL_TEST_ADDENDUM'?addendum.chunks:[];
 if(!chunks.length)return null;
 const afp=/\bAFP\b|알파\s*태아단백/iu.test(question),liverUltrasound=/간\s*초음파/u.test(question);
 const scenarioSpecific=/(?:시나리오|사례|기록|내역|결과\s*(?:가|는|을|이)|수치|진단|확진|환자|홍길동)/u.test(question);
 if(afp&&liverUltrasound){
  if(scenarioSpecific||/(?:진단|확진|암인지|암인가|판정|의미가\s*뭔)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  if(!/(?:어떻게|어떤|관계|함께|사용|쓰이|역할|설명|연결|왜|이유)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  return select(chunks,'AFP-USE-01',/간경변증 또는 만성 B형·C형 간염/u,'AFP_ULTRASOUND_SURVEILLANCE','PURPOSE');
 }
 if(afp){
  if(/(?:단독|혼자|만으로).{0,12}(?:선별|진단|암)|(?:선별|진단).{0,12}(?:AFP|알파태아단백)/iu.test(question))
   return select(chunks,'AFP-LIMIT-01',/AFP 검사 결과만으로 암을 선별하거나 진단하지 않습니다/u,'AFP_TEST_LIMIT','LIMITATIONS');
  if(/(?:비교|이전|지난|추세|준비|기록|챙겨)/u.test(question)){
   const comp=afpEvidenceModule?.retrieveAfpEvidence?.(question);
   if(comp?.status==='CANDIDATE')return adaptScenarioEvidence(comp);
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  }
  if(/(?:수치|결과|높|낮|정상|비정상)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  if(/(?:암인지|암인가|진단|확진|판정|치료|처방|복용)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  return select(chunks,'AFP-DEF-01',/혈액 검체에서 AFP/u,'AFP_TEST_DEFINITION','UNDERSTAND');
 }
 if(liverUltrasound){
  if(/(?:암|종양|병변|이상|진단|확진|판정|치료|처방|복용|수치|결과|의미)/u.test(question))
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  if(/(?:어떤\s*(?:부위|장기)|어떤\s*장기를\s*살펴|어디를\s*(?:보|살펴|검사))/u.test(question))
   return select(chunks,'US-USE-02',/간, 담낭, 췌장 또는 비장을 포함한 복부 장기/u,'ULTRASOUND_BODY_REGION','UNDERSTAND');
  if(/(?:목적|왜\s*(?:하|사용|쓰이)|어떻게\s*(?:사용|쓰이)|용도)/u.test(question))
   return select(chunks,'US-USE-01',/검사 종류와 살펴보는 신체 부위/u,'ULTRASOUND_PURPOSE','PURPOSE');
  return select(chunks,'US-USE-02',/간, 담낭, 췌장 또는 비장을 포함한 복부 장기/u,'ULTRASOUND_BODY_REGION','UNDERSTAND');
 }
 if(/초음파/u.test(question)){
  if(/(?:암|종양|병변|이상|진단|확진|판정|치료|처방|복용|수치|결과|의미)/u.test(question))
   return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  if(/(?:목적|왜\s*(?:하|사용|쓰이)|어떻게\s*(?:사용|쓰이)|용도)/u.test(question))
   return select(chunks,'US-USE-01',/검사 종류와 살펴보는 신체 부위/u,'ULTRASOUND_PURPOSE','PURPOSE');
  return select(chunks,'US-DEF-01',/^초음파는 음파를/u,'ULTRASOUND_DEFINITION','UNDERSTAND');
 }
 return null;
}

function adaptScenarioEvidence(retrieval){
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
 if(addendumEvidence!==null)return addendumEvidence;

 if(liverFunctionModule?.retrieveLiverFunctionEvidence){
  const liver=liverFunctionModule.retrieveLiverFunctionEvidence(question);
  if(liver?.status==='CANDIDATE'){
   const adapted=adaptScenarioEvidence(liver);
   if(adapted)return adapted;
  }
 }

 return base;
}
