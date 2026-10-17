import test from 'node:test';
import assert from 'node:assert/strict';
import {screeningEvidenceEntries,retrieveScreeningEvidence,screeningTopics,verifyScreeningEvidence} from '../src/health-helper-screening-evidence.js';
import {validateEducationOutput} from '../src/health-helper-medlineplus.js';

test('remaining screening topics expose purpose, limits, preparation and comparison as fixed candidates',()=>{
 assert.equal(screeningTopics.length,20);
 assert.equal(screeningEvidenceEntries.length,80);
 for(const topic of screeningTopics){
  for(const intent of ['PURPOSE','LIMITS','PREPARATION','COMPARISON']){
   const entry=screeningEvidenceEntries.find(row=>row.key===topic.key&&row.intent===intent);
   assert.ok(entry,`${topic.key}/${intent}`);
   const retrieval=retrieveScreeningEvidence(entry.question);
   assert.equal(retrieval.status,'CANDIDATE',`${entry.id}: ${retrieval.reason??''}`);
   assert.equal(retrieval.evidence[0].chunk_id,entry.id);
   assert.equal(retrieval.intent,intent);
   assert.equal(retrieval.extractiveOnly,true);
   assert.equal(retrieval.evidence[0].contentReview,'UNASSIGNED');
   assert.equal(retrieval.evidence[0].clinicalUse,false);
   const output={answer:retrieval.evidence[0].text_ko,evidenceIds:['E1'],questions:[retrieval.questionTemplate]};
   assert.equal(validateEducationOutput(output,retrieval).status,'GENERATED',entry.id);
   assert.throws(()=>validateEducationOutput({...output,answer:output.answer+' 추가 해석'},retrieval),/REJECTED/,entry.id);
  }
 }
});

test('screening candidate fails closed for personal results, diagnosis, numeric cutoffs and ambiguity',()=>{
 for(const [question,status] of [
  ['내 혈압은 괜찮나요?','PERSONAL_INPUT_NOT_SUPPORTED'],
  ['홍길동의 eGFR 결과를 해석해줘','PERSONAL_INPUT_NOT_SUPPORTED'],
  ['혈압 145/95는 정상인가요?','PERSONAL_INPUT_NOT_SUPPORTED'],
  ['혈압 정상 범위가 얼마인가요?','INSUFFICIENT_EVIDENCE'],
  ['eGFR 몇 이상이면 신장 질환인가요?','INSUFFICIENT_EVIDENCE'],
  ['공복혈당으로 당뇨를 진단해줘','REFUSED'],
  ['혈압과 공복혈당의 검사 목적을 알려줘','INSUFFICIENT_EVIDENCE'],
  ['혈압의 목적과 검사 준비를 알려줘','INSUFFICIENT_EVIDENCE'],
  ['크레아티닌 검사 전에 복용 약을 어떻게 해야 하나요?','REFUSED'],
  ['PSA 검사에서 무엇을 확인하나요?','INSUFFICIENT_EVIDENCE'],
 ]){
  const result=retrieveScreeningEvidence(question);
  assert.equal(result.status,status,question);
  assert.deepEqual(result.evidence,[],question);
 }
 assert.equal(retrieveScreeningEvidence('혈압 이전 결과에서 검사일과 참고범위를 확인하는 방법은?').intent,'COMPARISON');
 assert.equal(retrieveScreeningEvidence('x'.repeat(601)).status,'INVALID_INPUT');
});

test('screening source snapshots are immutable, hashed, and explicitly non-deployable',async()=>{
 const manifest=await verifyScreeningEvidence(new URL('../data/health-helper-screening-evidence-20261013-v3/',import.meta.url));
 assert.equal(manifest.entryCount,80);
 assert.equal(manifest.topicCount,20);
 assert.equal(manifest.sources.length,19);
 assert.equal(manifest.medicalReview,'UNASSIGNED');
 assert.equal(manifest.clinicalUse,false);
 assert.equal(manifest.serviceDeployment,false);
});
