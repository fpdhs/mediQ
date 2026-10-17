import test from 'node:test';
import assert from 'node:assert/strict';
import {liverFunctionEntries,retrieveLiverFunctionEvidence,verifyLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {validateEducationOutput} from '../src/health-helper-medlineplus.js';

test('liver panel and AST/ALT/GGT purpose, limits and preparation are isolated extractive candidates',()=>{
 const rows=[
  ['간기능 검사 목적은 무엇인가요?','liver-panel-purpose'],['간기능 검사만으로 원인을 알 수 있나요?','liver-panel-limits'],
  ['간기능 검사 전에는 어떻게 준비하나요?','liver-panel-preparation'],
  ['AST 검사는 왜 하나요?','liver-ast-purpose'],['AST 결과만으로 간 상태를 알 수 있나요?','liver-ast-limits'],
  ['AST 검사 전 금식이나 약 조정이 필요한가요?','liver-ast-preparation'],
  ['ALT 검사는 왜 하나요?','liver-alt-purpose'],['ALT 수치가 높으면 간 손상 정도를 알 수 있나요?','liver-alt-limits'],
  ['ALT 검사 전에는 어떻게 준비하나요?','liver-alt-preparation'],
  ['GGT 검사는 왜 하나요?','liver-ggt-purpose'],['GGT만으로 원인을 알 수 있나요?','liver-ggt-limits'],
  ['GGT 검사 전에는 어떻게 준비하나요?','liver-ggt-preparation'],
  ['AST 이전 결과와 비교할 때 무엇을 확인하나요?','liver-any-comparison'],
 ];
 for(const [question,id] of rows){
  const result=retrieveLiverFunctionEvidence(question);assert.equal(result.status,'CANDIDATE',question);
  assert.equal(result.evidence[0].chunk_id,id);assert.equal(result.evidence[0].contentReview,'UNASSIGNED');
  assert.equal(result.extractiveOnly,true);
  const output={answer:result.evidence[0].text_ko,evidenceIds:['E1'],questions:[result.questionTemplate]};
  assert.equal(validateEducationOutput(output,result).status,'GENERATED');
  assert.throws(()=>validateEducationOutput({...output,answer:output.answer+' 추가 해석'},result),/REJECTED/);
  assert.throws(()=>validateEducationOutput({...output,questions:['간암이 맞나요?']},result),/REJECTED/);
 }
 assert.equal(liverFunctionEntries.length,13);
});

test('liver evidence fails closed on personal values, diagnosis, mixed markers and uncovered requests',()=>{
 for(const q of ['AST 82 결과를 해석해줘','홍길동 간기능 검사 준비','AST로 간암을 확진해줘']){
  const result=retrieveLiverFunctionEvidence(q);
  assert.ok(['PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(result.status),`${q}: ${result.status}`);
  assert.deepEqual(result.evidence,[]);
 }
 for(const q of ['AST와 ALT 수치를 비교해줘','AST 목적과 준비는?','GGT 정상범위는?','AST 간기능 추세 비교와 목적']){
  const result=retrieveLiverFunctionEvidence(q);assert.equal(result.status,'INSUFFICIENT_EVIDENCE',q);assert.deepEqual(result.evidence,[]);
 }
 assert.equal(retrieveLiverFunctionEvidence('AST가 무엇인가요?').status,'CANDIDATE','existing concept route remains available');
});

test('liver candidate source snapshots remain separate and not deployable',async()=>{
 const manifest=await verifyLiverFunctionEvidence(new URL('../data/health-helper-liver-evidence-20261013-v4/',import.meta.url));
 assert.equal(manifest.entryCount,13);assert.equal(manifest.serviceDeployment,false);assert.equal(manifest.sources.length,6);
});
