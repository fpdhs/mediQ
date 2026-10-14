import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {educationPayload,sourceGuidanceFromEvidence,validateEducationOutput} from '../src/health-helper-medlineplus.js';
import {createCandidateQuestionHandler} from '../src/health-helper-candidate-http.js';
import {helperSourceUrl} from '../public/ui/patient-helper.js';
import {loadSchoolDemoMedicalTestAddendum,retrieveSchoolDemoCandidateEvidence} from '../src/health-helper-school-demo-medical-tests.js';
import {evaluateSchoolDemoMedicalTestHoldout} from '../scripts/evaluate-health-helper-school-demo-medical-tests.js';

const base=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
const addendum=await loadSchoolDemoMedicalTestAddendum();
const combined={...base,chunks:[...base.chunks,...addendum.chunks],held:[...base.held,...addendum.held],
 heldDocuments:[...base.heldDocuments,...addendum.held]};

test('Medical Tests supplement hashes English source and Korean projection separately and keeps review HOLD',()=>{
 assert.equal(addendum.version,'medlineplus-medical-tests-school-demo-ko-20261013-v1');
 assert.equal(addendum.totalDocuments,2);assert.equal(addendum.indexedDocuments,2);
 assert.equal(addendum.demoIndexPassDocuments,2);assert.equal(addendum.chunks.length,9);
 assert.equal(addendum.schoolDemoCandidateStatus,'PASS');assert.equal(addendum.chunks.every(chunk=>chunk.schoolDemoCandidateStatus==='PASS'),true);
 assert.equal(addendum.held.length,2);assert.equal(addendum.chunks.every(chunk=>chunk.demoIndexStatus==='PASS'),true);
 assert.equal(addendum.chunks.every(chunk=>chunk.ai_qa_status==='HOLD'&&chunk.sourceContentReview==='UNASSIGNED'),true);
 assert.equal(addendum.chunks.every(chunk=>!('text_en'in chunk)&&!('sourceText'in chunk)),true);
 assert.equal(addendum.clinicalUse,false);assert.equal(addendum.serviceDeployment,false);
});

test('AFP and liver ultrasound retrieval is limited to the source-supported screening context',()=>{
 const question='간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?';
 const result=retrieveSchoolDemoCandidateEvidence(question,combined,addendum);
 assert.equal(result.status,'CANDIDATE');assert.equal(result.topic,'school-demo-medical-test-afp-tumor-marker');
 assert.deepEqual(result.focus,['AFP_ULTRASOUND_SURVEILLANCE']);assert.deepEqual(result.evidence[0].allowedSentenceIndexes,[1]);
 assert.match(result.evidence[0].text_ko,/간경변증 또는 만성 B형·C형 간염/u);
 assert.match(result.evidence[0].text_ko,/간 초음파를 6개월마다 함께 사용할 수 있습니다/u);
 assert.equal(result.evidence[0].ai_qa_status,'HOLD');
});

test('personal results, diagnosis requests, and patient-scenario linkage never use the addendum',()=>{
 for(const question of [
  '제 AFP 결과가 간암을 뜻하나요?',
  'AFP와 간 초음파로 간암을 진단할 수 있나요?',
  'AFP와 간 초음파 자료는 간암 시나리오와 어떻게 연결되나요?',
 ]){
  const result=retrieveSchoolDemoCandidateEvidence(question,combined,addendum);
  assert.ok(['PERSONAL_INPUT_NOT_SUPPORTED','INSUFFICIENT_EVIDENCE'].includes(result.status),question);
  assert.equal(result.evidence.length,0,question);
 }
});

test('AFP and ultrasound definitions select only their exact Korean source sentence',()=>{
 const afp=retrieveSchoolDemoCandidateEvidence('AFP 검사는 무엇인가요?',combined,addendum);
 assert.equal(afp.status,'CANDIDATE');assert.equal(afp.evidence[0].text_ko,'AFP 종양표지자 검사는 혈액 검체에서 AFP(알파태아단백) 수치를 측정하는 혈액검사입니다.');
 const ultrasound=retrieveSchoolDemoCandidateEvidence('초음파는 어떤 검사인가요?',combined,addendum);
 assert.equal(ultrasound.status,'CANDIDATE');assert.equal(ultrasound.evidence[0].text_ko,'초음파는 음파를 이용해 신체 내부의 장기, 조직 및 다른 구조의 영상(초음파 영상)을 만드는 영상검사입니다.');
});

test('question intent routing distinguishes purpose, limitations, and definitions', () => {
 const afpPurpose = retrieveSchoolDemoCandidateEvidence('AFP 검사의 목적은 무엇인가요?', combined, addendum);
 assert.equal(afpPurpose.status, 'CANDIDATE');
 assert.equal(afpPurpose.topic, 'school-demo-medical-test-afp-tumor-marker');
 assert.equal(afpPurpose.intent, 'UNDERSTAND');
 assert.match(afpPurpose.evidence[0].text_ko, /혈액 검체에서 AFP/u);

 const afpLimit = retrieveSchoolDemoCandidateEvidence('AFP 검사만으로 암을 진단할 수 있나요?', combined, addendum);
 assert.equal(afpLimit.status, 'CANDIDATE');
 assert.equal(afpLimit.intent, 'LIMITATIONS');
 assert.deepEqual(afpLimit.focus, ['AFP_TEST_LIMIT']);
 assert.match(afpLimit.evidence[0].text_ko, /AFP 검사 결과만으로 암을 선별하거나 진단하지 않습니다/u);

 const usPurpose = retrieveSchoolDemoCandidateEvidence('초음파 검사는 왜 하나요?', combined, addendum);
 assert.equal(usPurpose.status, 'CANDIDATE');
 assert.equal(usPurpose.intent, 'PURPOSE');
 assert.deepEqual(usPurpose.focus, ['ULTRASOUND_PURPOSE']);
 assert.match(usPurpose.evidence[0].text_ko, /검사 종류와 살펴보는 신체 부위에 따라/u);

 const usAnatomy = retrieveSchoolDemoCandidateEvidence('간 초음파로 어디를 검사하나요?', combined, addendum);
 assert.equal(usAnatomy.status, 'CANDIDATE');
 assert.equal(usAnatomy.intent, 'UNDERSTAND');
 assert.deepEqual(usAnatomy.focus, ['ULTRASOUND_BODY_REGION']);
 assert.match(usAnatomy.evidence[0].text_ko, /간, 담낭, 췌장 또는 비장을 포함한 복부 장기/u);
});

test('Medical Test source links pass safe URL validation while held text stays out of fallback excerpts',()=>{
 const retrieval=retrieveSchoolDemoCandidateEvidence('AFP 검사는 무엇인가요?',combined,addendum);
 const result=sourceGuidanceFromEvidence(retrieval);
 assert.equal(result.status,'SOURCE_GUIDANCE');assert.equal(result.generationUsed,false);
 assert.equal(result.sources[0].url,'https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/');
 assert.equal(helperSourceUrl(result.sources[0].url),result.sources[0].url);
 assert.equal(helperSourceUrl('https://medlineplus.gov/lab-tests/sonogram/'),'https://medlineplus.gov/lab-tests/sonogram/');
 assert.equal(Object.hasOwn(result.sources[0],'excerpt'),false);
 assert.match(result.sources[0].contextNote,/자동 QA HOLD/u);
});

test('Medical Tests retrieval holdout covers support, false-positive abstention, hashes and QA state',async()=>{
 const result=await evaluateSchoolDemoMedicalTestHoldout();
 assert.equal(result.result,'PASS');assert.equal(result.index.medicalTestDocuments,2);
 assert.equal(result.index.medicalTestDemoIndexPass,2);assert.equal(result.index.medicalTestQaHolds,2);
 assert.equal(result.index.baseSchoolDemoCandidatePass,1017);assert.equal(result.index.medicalTestSchoolDemoCandidatePass,2);
 assert.deepEqual(result.counts,{supported:5,supportedPass:5,abstentions:5,abstentionsPass:5,falsePositives:0,total:10,passed:10});
 assert.equal(result.clinicalReview,'UNASSIGNED');assert.equal(result.semanticGrounding,'NOT_ASSESSED');
});

test('HTTP answer uses Korean evidence only, preserves QA HOLD warning and cites the medical-test source',async()=>{
 let modelCalls=0,payloadWithoutRawQuestion=true;
 let handler;
 const server=createServer((req,res)=>handler(req,res,(status,value)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));}));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port,host=`127.0.0.1:${port}`,origin=`http://${host}`;
 handler=createCandidateQuestionHandler({expectedHost:host,expectedOrigin:origin,allowSourceFallback:true,
  retrieveEvidence:question=>retrieveSchoolDemoCandidateEvidence(question,combined,addendum),
  insufficientAnswer:retrieval=>retrieval.status==='PERSONAL_INPUT_NOT_SUPPORTED'?'개인 검사 결과는 이 데모에서 해석하지 않습니다.':'근거가 부족합니다.',
  generateAnswer:(retrieval)=>{
   modelCalls++;const payload=educationPayload(retrieval),message=payload.messages.find(item=>item.role==='user');
   payloadWithoutRawQuestion=!JSON.stringify(payload).includes('간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?');
   const selected=JSON.parse(message.content).evidence[0].sentences[0].text;
   assert.equal(selected,retrieval.evidence[0].text_ko.match(/[^.!?。！？]+[.!?。！？]+/gu)[1].trim());
   return validateEducationOutput({claimEvidence:[{evidenceId:'E1',sentenceIndexes:[0]}],evidenceIds:['E1']},retrieval);
  }});
 async function post(question){
  return new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/candidate/questions',method:'POST',agent:false,
   headers:{host,origin,'content-type':'application/json'}},res=>{const parts=[];res.on('data',part=>parts.push(part));res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(parts).toString('utf8'))}));});
   req.on('error',reject);req.end(JSON.stringify({question}));});
 }
 try{
  const response=await post('간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?');
  assert.equal(response.status,200);assert.equal(response.body.status,'GENERATED');
  assert.match(response.body.answer,/AFP 검사와 간 초음파를 6개월마다 함께/u);
  assert.equal(response.body.sources[0].url,'https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/');
  assert.match(response.body.sources[0].contextNote,/자동 QA HOLD/u);
  assert.match(response.body.sources[0].contextNote,/임상 정확성 미검증/u);
  assert.equal(modelCalls,1);assert.equal(payloadWithoutRawQuestion,true);
  const personal=await post('제 AFP 결과가 간암을 뜻하나요?');
  assert.equal(personal.body.status,'PERSONAL_INPUT_NOT_SUPPORTED',JSON.stringify(personal));assert.equal(personal.body.sources.length,0);
  assert.equal(modelCalls,1);
 }finally{server.close();await once(server,'close');}
});

test('liver enzyme and AFP comparison scenario questions retrieve CANDIDATE with verified source', () => {
 const ast = retrieveSchoolDemoCandidateEvidence('AST: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(ast.status, 'CANDIDATE');
 assert.match(ast.evidence[0].text_ko, /AST/);
 assert.equal(ast.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/ast-test/');

 const alt = retrieveSchoolDemoCandidateEvidence('ALT: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(alt.status, 'CANDIDATE');
 assert.match(alt.evidence[0].text_ko, /ALT/);
 assert.equal(alt.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/alt-blood-test/');

 const ggt = retrieveSchoolDemoCandidateEvidence('GGT: 이 검사는 무엇을 확인하나요?', combined, addendum);
 assert.equal(ggt.status, 'CANDIDATE');
 assert.match(ggt.evidence[0].text_ko, /GGT/);
 assert.equal(ggt.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/');

 const comp = retrieveSchoolDemoCandidateEvidence('AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?', combined, addendum);
 assert.equal(comp.status, 'CANDIDATE');
 assert.match(comp.evidence[0].text_ko, /검사기관마다 검사 방법과 참고범위가 달라/);
 assert.equal(comp.evidence[0].source_url, 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/');
});
