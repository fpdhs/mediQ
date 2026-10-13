import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {HELPER_CORPUS, AFP_SOURCE, LIVER_SOURCE, REPLACEMENT_SOURCE, helperTopics, retrieveHelperEvidence,
  canonicalHelperTopic} from '../src/health-helper-corpus.js';
import {HealthHelperRag, validateHelperOutput} from '../src/health-helper-rag.js';
import {testOnlyClearedCorpus} from './helpers/health-helper-corpus.js';

test('nine traceable candidate chunks: unique IDs, current candidate hashes, no patient fixtures',()=>{
  assert.equal(HELPER_CORPUS.chunks.length,9);
  assert.equal(new Set(HELPER_CORPUS.chunks.map(chunk=>chunk.id)).size,9);
  for(const chunk of HELPER_CORPUS.chunks){
    const source=HELPER_CORPUS.sources.find(source=>source.id===chunk.sourceId);
    assert.ok(source);assert.ok(chunk.section);assert.ok(chunk.conditions);assert.ok(chunk.limitations);
    assert.equal(chunk.candidateTextSha256,createHash('sha256').update(chunk.text,'utf8').digest('hex'));
    assert.equal(chunk.contentReview,'UNASSIGNED');assert.equal(source.checkedAt,'2026-10-11');
  }
  assert.equal(AFP_SOURCE.publishedAt,null);assert.equal(LIVER_SOURCE.updatedAt,'2026-05-06');
  assert.doesNotMatch(JSON.stringify(HELPER_CORPUS),/홍길동|24\.6|6\.2|8\.4|patientId|StudyInstanceUID|간암/);
});

test('public official sources are excluded while permission and review remain pending',()=>{
  for(const question of ['AFP','간기능','AST','ALT','GGT'])assert.deepEqual(retrieveHelperEvidence(question),[]);
  assert.equal(HELPER_CORPUS.reviewStatus,'DRAFT / UNASSIGNED');
  assert.throws(()=>{HELPER_CORPUS.chunks.push({});},TypeError);
});

test('item and linked policy restrictions are explicit, with no invented permission evidence',()=>{
  assert.equal(LIVER_SOURCE.licenseScope,'ITEM_FOOTER');
  assert.equal(LIVER_SOURCE.licenseLabel,'공공누리 제4유형');
  assert.equal(AFP_SOURCE.licenseScope,'SITE_POLICY_LINKED_FROM_ITEM');
  for(const source of [AFP_SOURCE,LIVER_SOURCE]){
    assert.equal(source.reuseStatus,'NOT_CLEARED_FOR_RAG');
    assert.equal(source.permissionEvidence,null);assert.equal(source.contentReview,'UNASSIGNED');
  }
});

test('replacement license clearance does not grant independent content approval',()=>{
  assert.equal(REPLACEMENT_SOURCE.reuseStatus,'CLEARED');
  assert.equal(REPLACEMENT_SOURCE.licenseLabel,'공공누리 제1유형');
  assert.equal(REPLACEMENT_SOURCE.permissionEvidence.type,'PUBLIC_LICENSE');
  assert.equal(REPLACEMENT_SOURCE.contentReview,'UNASSIGNED');
  assert.match(REPLACEMENT_SOURCE.attribution,/의왕시.*재서술/u);
  assert.deepEqual(retrieveHelperEvidence('간기능 검사 종류'),[]);
});

test('reviewed replacement cannot unlock restricted sources or unsupported medical explanations',()=>{
  const corpus=structuredClone(HELPER_CORPUS);
  corpus.sources.find(s=>s.id===REPLACEMENT_SOURCE.id).contentReview='APPROVED';
  const chunk=corpus.chunks.find(c=>c.sourceId===REPLACEMENT_SOURCE.id);
  chunk.contentReview='APPROVED';chunk.approvedTextSha256=chunk.candidateTextSha256;
  assert.deepEqual(retrieveHelperEvidence('간기능 검사 종류',corpus).map(c=>c.id),['liver-test-list']);
  for(const question of ['AFP','AST','ALT','GGT','간기능 정상 범위','간기능 단독 해석 한계']){
    assert.deepEqual(retrieveHelperEvidence(question,corpus),[]);
  }
});

test('public-license attribution and adaptation note survive citation resolution',()=>{
  const corpus=testOnlyClearedCorpus();const evidence=retrieveHelperEvidence('간기능',corpus);
  const result=validateHelperOutput({answer:'검사 목록에는 여러 항목이 있어요.',
    sourceIds:[REPLACEMENT_SOURCE.id],questions:['어떤 항목을 함께 확인하나요?']},evidence,corpus);
  assert.equal(result.sources[0].attribution,REPLACEMENT_SOURCE.attribution);
  assert.equal(result.sources[0].licenseTermsUrl,REPLACEMENT_SOURCE.licenseTermsUrl);
});

test('agent source comparison is pinned to candidate text, never independent clinical approval',()=>{
  for(const chunk of HELPER_CORPUS.chunks){
    assert.equal(chunk.sourceComparison.comparedTextSha256,chunk.candidateTextSha256);
    assert.equal(chunk.sourceComparison.status,'MATCHED_TO_SOURCE');
    assert.equal(chunk.sourceComparison.reviewerType,'AGENT');
    assert.equal(chunk.contentReview,'UNASSIGNED');assert.equal(chunk.approvedTextSha256,undefined);
  }
  for(const id of ['ast-alt-role','ggt-role']){
    assert.match(HELPER_CORPUS.chunks.find(chunk=>chunk.id===id).section,/검사 결과 해석/u);
  }
});

test('both source clearance and chunk review are mandatory, missing flags fail closed',()=>{
  for(const mutate of [c=>delete c.sources[0].reuseStatus,c=>c.sources[0].contentReview='UNASSIGNED',
    c=>c.chunks.filter(x=>x.sourceId===AFP_SOURCE.id).forEach(x=>x.contentReview='UNASSIGNED')]){
    const corpus=testOnlyClearedCorpus();mutate(corpus);
    assert.deepEqual(retrieveHelperEvidence('AFP',corpus),[]);
  }
});

test('permission evidence is mandatory for retrieval and citation, flags alone cannot enable generation',()=>{
  for(const proof of [null, {}, {type:'SITE_PUBLIC'},
    {type:'WRITTEN_PERMISSION',checkedAt:'2026-10-11',url:'http://test.invalid/',locator:'test'},
    {type:'PUBLIC_LICENSE',checkedAt:'2026-10-11',url:'https://test.invalid/',locator:''}]){
    const corpus=testOnlyClearedCorpus();
    corpus.sources.find(source=>source.id===AFP_SOURCE.id).permissionEvidence=proof;
    assert.deepEqual(retrieveHelperEvidence('AFP',corpus),[]);
    assert.throws(()=>validateHelperOutput({answer:'일반 검사 설명이에요.',sourceIds:[AFP_SOURCE.id],
      questions:['어떤 점을 확인하면 좋을까요?']},corpus.chunks,corpus),{code:'HELPER_OUTPUT_REJECTED'});
  }
});

test('bounded canonical topic retrieval supports aliases and ranks requested explanation',()=>{
  const corpus=testOnlyClearedCorpus();
  for(const [question,topic]of [['알파태아단백','AFP'],['sgot','AST'],['sgpt','ALT'],['감마 GTP','GGT'],['간 수치','LIVER']]){
    assert.ok(helperTopics(question).includes(topic));assert.ok(retrieveHelperEvidence(question,corpus).length);
  }
  assert.equal(retrieveHelperEvidence('AFP 정상범위',corpus)[0].id,'afp-reference');
  assert.equal(retrieveHelperEvidence('AFP 단독 해석 한계',corpus)[0].id,'afp-limits');
  assert.equal(retrieveHelperEvidence('AFP AST ALT GGT 간기능',corpus).length,6);
  for(const question of ['breakfast','ALTitude','BMI',null,'가'.repeat(601)]){
    assert.deepEqual(retrieveHelperEvidence(question,corpus),[]);
  }
  assert.doesNotMatch(canonicalHelperTopic(retrieveHelperEvidence('홍길동 ALT',corpus)),/홍길동/);
});

test('review is bound to exact candidate text hash; changed and unbound text are excluded',()=>{
  for(const mutate of [chunk=>{chunk.text+=' 변경됨';},chunk=>{delete chunk.approvedTextSha256;},
    chunk=>{chunk.approvedTextSha256='0'.repeat(64);}]){
    const corpus=testOnlyClearedCorpus();
    corpus.chunks.filter(chunk=>chunk.sourceId===AFP_SOURCE.id).forEach(mutate);
    assert.deepEqual(retrieveHelperEvidence('AFP',corpus),[]);
  }
});

test('citations resolve the correct source rather than mapping every source to AFP',()=>{
  const corpus=testOnlyClearedCorpus();const evidence=retrieveHelperEvidence('AFP ALT',corpus);
  const value={answer:'각 검사에는 해석 한계가 있어요.',sourceIds:[LIVER_SOURCE.id,AFP_SOURCE.id],questions:['다른 결과와 함께 어떻게 이해하나요?']};
  const result=validateHelperOutput(value,evidence,corpus);
  assert.deepEqual(result.sources.map(source=>source.url),[LIVER_SOURCE.url,AFP_SOURCE.url]);
  assert.ok(result.sources.every(source=>source.evidenceIds.length));
  assert.throws(()=>validateHelperOutput({...value,sourceIds:[LIVER_SOURCE.id]},retrieveHelperEvidence('AFP',corpus),corpus),{code:'HELPER_OUTPUT_REJECTED'});
  assert.throws(()=>validateHelperOutput(value,evidence),{code:'HELPER_OUTPUT_REJECTED'});
});

test('production candidates never reach a configured model and produce no invented answer',async()=>{
  const logs=[];let calls=0;
  const helper=new HealthHelperRag({mode:'GENERATION',audit:async row=>logs.push(row),model:{generate:async()=>{calls++;throw new Error('must not call');}}});
  const result=await helper.ask({role:'PATIENT',subject:'test-account',patientId:'test-patient'},{question:'홍길동 AFP 설명'});
  assert.equal(result.status,'INSUFFICIENT_EVIDENCE');assert.equal(calls,0);assert.deepEqual(result.sources,[]);
  assert.equal(logs.at(-1).reasonCode,'HELPER_EVIDENCE_INSUFFICIENT');
  assert.doesNotMatch(JSON.stringify(logs),/홍길동|AFP 설명/);
});

test('service snapshots server corpus; external mutation cannot enable candidate retrieval',async()=>{
  const corpus=structuredClone(HELPER_CORPUS);
  const helper=new HealthHelperRag({mode:'GENERATION',corpus,audit:async()=>{}});
  Object.assign(corpus.sources[0],{reuseStatus:'CLEARED',contentReview:'APPROVED'});
  corpus.chunks.forEach(chunk=>{chunk.contentReview='APPROVED';});
  assert.equal((await helper.ask({role:'PATIENT',subject:'test',patientId:'test'},{question:'AFP'})).status,'INSUFFICIENT_EVIDENCE');
});

test('liver explanation with a test-only source connects through generation and audit',async()=>{
  const calls=[];const logs=[];
  const helper=new HealthHelperRag({mode:'GENERATION',corpus:testOnlyClearedCorpus(),audit:async row=>logs.push(row),
    model:{generate:async input=>{calls.push(input);return {answer:'간기능검사는 여러 항목을 함께 살피는 검사예요.',sourceIds:[LIVER_SOURCE.id],questions:['다른 검사와 함께 어떻게 이해하면 되나요?']};}}});
  const result=await helper.ask({role:'PATIENT',subject:'test-account',patientId:'test-patient'},{question:'홍길동 ALT 의미'});
  assert.equal(result.status,'GENERATED');assert.equal(result.sources[0].id,LIVER_SOURCE.id);
  assert.doesNotMatch(JSON.stringify(calls),/홍길동|test-account|test-patient/);
  assert.equal(logs.at(-1).reasonCode,'HELPER_ANSWER_GENERATED');
});
