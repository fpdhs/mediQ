import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCandidateQuestion} from '../public/ui/candidate-question-context.js';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';

test('candidate context applies only to bounded follow-ups without a named topic',()=>{
 const options={contextTopic:'컴퓨터 단층촬영',topicAliases:['CT','MRI','당화혈색소','A1C','엑스선','빈혈']};
 for(const question of ['그러면 준비는 어떻게 하나요?','그럼 금식은 해야 하나요?','방사선은 사용하나요?','좀 더 설명해 주세요'])
  assert.equal(resolveCandidateQuestion(question,options),`컴퓨터 단층촬영: ${question}`);
 for(const question of ['그럼 MRI는 방사선을 사용하나요?','그럼 A1C는 무엇인가요?','그러면 엑스선은요?',
  '그럼 빈혈 원인은요?','CT는 무엇인가요?','새로운 질문입니다.'])
  assert.equal(resolveCandidateQuestion(question,options),question);
 assert.equal(resolveCandidateQuestion('그럼 mri는요?',options),'그럼 mri는요?');
 assert.equal(resolveCandidateQuestion('그럼 doctor라는 단어는?',options),'컴퓨터 단층촬영: 그럼 doctor라는 단어는?');
 assert.equal(resolveCandidateQuestion('그럼 MRI는요?',{...options,contextTopic:null}),'그럼 MRI는요?');
 assert.equal(resolveCandidateQuestion(null,options),null);
 const longQuestion=`그러면 ${'가'.repeat(591)}`;
 assert.equal(resolveCandidateQuestion(longQuestion,options),longQuestion);
});

test('real school corpus routes follow-ups and explicit topic changes to the correct evidence',async()=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 const topicAliases=[...new Set(corpus.chunks.flatMap(chunk=>chunk.aliases))];
 const cases=[
  ['컴퓨터 단층촬영','그러면 검사 전에 뭘 준비하나요?','3951','PREPARE'],
  ['컴퓨터 단층촬영','그럼 금식은 해야 하나요?','3951',null,'FASTING'],
  ['빈혈','그러면 원인은 무엇인가요?','139','CAUSES'],
  ['컴퓨터 단층촬영','그럼 MRI는 방사선을 사용하나요?','3953','UNDERSTAND','RADIATION'],
  ['컴퓨터 단층촬영','그럼 엑스선은 방사선을 사용하나요?','3949','UNDERSTAND','RADIATION'],
 ];
 for(const [contextTopic,question,topic,intent,focus] of cases){
  const resolved=resolveCandidateQuestion(question,{contextTopic,topicAliases});
  const result=retrieveUploadedEvidence(resolved,corpus);
  assert.equal(result.status,'CANDIDATE',resolved);assert.equal(result.topic,topic,resolved);
  if(intent)assert.equal(result.intent,intent,resolved);
  if(focus)assert.ok(result.focus.includes(focus),resolved);
  assert.ok(result.evidence.every(chunk=>chunk.topic===topic&&chunk.demoIndexStatus==='PASS'));
 }
 const heldQuestion=resolveCandidateQuestion('그럼 A1C는 무엇인가요?',{contextTopic:'컴퓨터 단층촬영',topicAliases});
 const heldResult=retrieveUploadedEvidence(heldQuestion,corpus);
 assert.equal(heldQuestion,'그럼 A1C는 무엇인가요?');
 assert.equal(heldResult.status,'INSUFFICIENT_EVIDENCE','a HOLD translation cannot become a model candidate through topic-context routing');
 assert.deepEqual(heldResult.evidence,[]);
 for(const question of ['그러면 심박조율기가 있으면 MRI를 해도 되나요?', '그럼 제 검사 수치 123은요?']){
  const resolved=resolveCandidateQuestion(question,{contextTopic:'컴퓨터 단층촬영',topicAliases});
  const result=retrieveUploadedEvidence(resolved,corpus);
  assert.ok(['INSUFFICIENT_EVIDENCE','PERSONAL_INPUT_NOT_SUPPORTED'].includes(result.status),resolved);
  assert.equal(result.evidence.length,0);
 }
});
