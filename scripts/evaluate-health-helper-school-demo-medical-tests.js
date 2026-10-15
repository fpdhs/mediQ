import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {educationPayload,sha256} from '../src/health-helper-medlineplus.js';
import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {loadSchoolDemoMedicalTestAddendum,retrieveSchoolDemoCandidateEvidence} from '../src/health-helper-school-demo-medical-tests.js';

const fixtureUrl=new URL('../fixtures/health-helper-school-demo-medical-test-retrieval-holdout-2026-10-13.json',import.meta.url);
export async function evaluateSchoolDemoMedicalTestHoldout(){
 const fixture=JSON.parse(await readFile(fixtureUrl,'utf8'));
 const base=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 const addendum=await loadSchoolDemoMedicalTestAddendum();
 if(fixture.schemaVersion!==1||fixture.corpusVersion!==base.version||fixture.addendumVersion!==addendum.version
  ||!Array.isArray(fixture.cases)||new Set(fixture.cases.map(item=>item.id)).size!==fixture.cases.length)
  throw Error('MEDICAL_TEST_HOLDOUT_INVALID');
 const corpus={...base,chunks:[...base.chunks,...addendum.chunks],held:[...base.held,...addendum.held],
  heldDocuments:[...base.heldDocuments,...addendum.held]};
 const cases=fixture.cases.map(item=>{
  const retrieval=retrieveSchoolDemoCandidateEvidence(item.question,corpus,addendum),candidate=retrieval.status==='CANDIDATE';
  const evidence=retrieval.evidence??[],chunk=evidence[0];
  const exactEvidence=item.class!=='SUPPORTED'||candidate&&evidence.length===1&&chunk.topic===item.expectedTopic
   &&chunk.source_segment_ids?.includes(item.expectedSegmentId)&&chunk.text_ko.includes(item.expectedEvidence);
  const integrity=item.class!=='SUPPORTED'||candidate&&chunk.demoIndexStatus==='PASS'
   &&chunk.schoolDemoCandidateStatus==='PASS'&&sha256(chunk.text_ko)===chunk.textSha256;
  const qaHoldPreserved=item.class!=='SUPPORTED'||candidate&&chunk.ai_qa_status==='HOLD'
   &&chunk.sourceContentReview==='UNASSIGNED'&&chunk.unresolvedIssueCount>0;
  let payloadIsolation=true;
  if(candidate){
   const payload=educationPayload({...retrieval,claimEvidenceRequired:true});
   const userPayload=JSON.parse(payload.messages.find(message=>message.role==='user').content);
   const selectableSentences=userPayload.evidence.flatMap(item=>item.sentences.map(sentence=>sentence.text));
   payloadIsolation=!JSON.stringify(payload).includes(item.question)
    &&(item.class!=='SUPPORTED'||selectableSentences.includes(item.expectedEvidence));
  }
  const expectedAbstention=item.class!=='ABSTAIN'||retrieval.status===item.expectedStatus&&evidence.length===0;
  return {id:item.id,class:item.class,expectedStatus:item.expectedStatus,actualStatus:retrieval.status,
   expectedTopic:item.expectedTopic??null,actualTopic:retrieval.topic??null,
   expectedSegmentId:item.expectedSegmentId??null,actualSegmentIds:chunk?.source_segment_ids??[],
   sourceCount:evidence.length,exactEvidence,integrity,qaHoldPreserved,payloadIsolation,expectedAbstention,
   pass:item.class==='SUPPORTED'?exactEvidence&&integrity&&qaHoldPreserved&&payloadIsolation:expectedAbstention};
 });
 const supported=cases.filter(item=>item.class==='SUPPORTED'),abstain=cases.filter(item=>item.class==='ABSTAIN');
 return {corpusVersion:base.version,addendumVersion:addendum.version,
  index:{baseDocuments:base.indexedDocuments,baseChunks:base.chunks.length,baseDemoIndexPass:base.demoIndexPassDocuments,
   baseSchoolDemoCandidatePass:base.schoolDemoCandidateStatus==='PASS'?base.indexedDocuments:0,
   medicalTestDocuments:addendum.indexedDocuments,medicalTestChunks:addendum.chunks.length,
   medicalTestDemoIndexPass:addendum.demoIndexPassDocuments,
   medicalTestSchoolDemoCandidatePass:addendum.schoolDemoCandidateStatus==='PASS'?addendum.indexedDocuments:0,
   medicalTestQaHolds:addendum.held.length},
  counts:{supported:supported.length,supportedPass:supported.filter(item=>item.pass).length,
   abstentions:abstain.length,abstentionsPass:abstain.filter(item=>item.pass).length,
   falsePositives:abstain.filter(item=>item.actualStatus==='CANDIDATE').length,
   total:cases.length,passed:cases.filter(item=>item.pass).length},
  result:cases.every(item=>item.pass)?'PASS':'FAIL',clinicalReview:'UNASSIGNED',clinicalUse:false,
  serviceDeployment:false,semanticGrounding:'NOT_ASSESSED',cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await evaluateSchoolDemoMedicalTestHoldout();
 process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
 if(result.result!=='PASS')process.exitCode=1;
}
