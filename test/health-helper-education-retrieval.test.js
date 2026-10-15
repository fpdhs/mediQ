import test from 'node:test';
import assert from 'node:assert/strict';
import {scenarioEntries} from '../src/health-helper-scenario-evidence.js';
import {afpEntries} from '../src/health-helper-afp-evidence.js';
import {liverFunctionEntries} from '../src/health-helper-liver-evidence.js';
import {imagingEvidenceEntries} from '../src/health-helper-imaging-evidence.js';
import {screeningEvidenceEntries} from '../src/health-helper-screening-evidence.js';
import {retrieveHealthEducationEvidence} from '../src/health-helper-education-retrieval.js';
import {validateEducationOutput} from '../src/health-helper-medlineplus.js';

test('one retrieval entry point covers every scenario concept and detailed evidence candidate',()=>{
  assert.equal(scenarioEntries.length,26);
  assert.equal(afpEntries.length,4);
  assert.equal(liverFunctionEntries.length,13);
  assert.equal(imagingEvidenceEntries.length,8);
  assert.equal(screeningEvidenceEntries.length,80);

  for(const entry of scenarioEntries){
    const result=retrieveHealthEducationEvidence(`${entry.label}는 무엇인가요?`);
    assert.equal(result.status,'CANDIDATE',entry.label);
    assert.equal(result.retriever,'SCENARIO_CONCEPT',entry.label);
    assert.equal(result.evidence.length,1,entry.label);
    assert.equal(result.evidence[0].contentReview,'UNASSIGNED',entry.label);
    assert.equal(result.reviewStatus,'DRAFT / UNASSIGNED',entry.label);
    assert.equal(result.clinicalUse,false,entry.label);
    assert.equal(result.serviceEligible,false,entry.label);
  }

  const prompt=(route,entry)=>{
    const topic=route==='AFP_DETAIL'?'AFP'
      :route==='LIVER_DETAIL'?(entry.marker==='PANEL'?'간기능 검사':entry.marker==='ANY'?'간기능':entry.marker)
      :route==='IMAGING_DETAIL'?(entry.modality==='ULTRASOUND'?'간 초음파':'복부 CT')
      :entry.label;
    const phrase={PURPOSE:'검사 목적은 무엇인가요?',LIMITS:'검사 한계는 무엇인가요?',
      PREPARATION:'검사 준비는 어떻게 하나요?',COMPARISON:'이전 검사 결과와 비교할 때 무엇을 확인하나요?'}[entry.intent];
    return `${topic} ${phrase}`;
  };

  for(const [entries,expectedRoute] of [
    [afpEntries,'AFP_DETAIL'],[liverFunctionEntries,'LIVER_DETAIL'],[imagingEvidenceEntries,'IMAGING_DETAIL'],
  ])for(const entry of entries){
    const question=prompt(expectedRoute,entry);
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,'CANDIDATE',entry.id);
    assert.equal(result.retriever,expectedRoute,entry.id);
    assert.equal(result.evidence[0].chunk_id,entry.id,entry.id);
    assert.equal(result.evidence[0].contentReview,'UNASSIGNED',entry.id);
  }

  for(const entry of screeningEvidenceEntries){
    const result=retrieveHealthEducationEvidence(prompt('SCREENING_DETAIL',entry));
    assert.equal(result.status,'CANDIDATE',entry.id);
    // Liver-specific explanations take precedence over the shorter screening cross-list for AST/ALT/GGT.
    const expectedRoute=['ast','alt','ggt'].includes(entry.key)?'LIVER_DETAIL':'SCREENING_DETAIL';
    assert.equal(result.retriever,expectedRoute,entry.id);
    assert.equal(result.evidence.length,1,entry.id);
    assert.equal(result.evidence[0].contentReview,'UNASSIGNED',entry.id);
    assert.equal(result.clinicalUse,false,entry.id);
    assert.equal(result.serviceEligible,false,entry.id);
  }
});

test('central retrieval keeps narrow single-topic and single-intent boundaries',()=>{
  for(const question of [
    'AFP와 CT는 무엇인가요?',
    'CT와 초음파 중 어떤 검사가 더 정확한가요?',
    '혈압 목적과 검사 준비는?',
    'AST와 ALT 수치를 비교해줘',
    'PSA 검사는 무엇을 확인하나요?',
    'AFP 정상범위는 얼마인가요?',
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,'INSUFFICIENT_EVIDENCE',question);
    assert.deepEqual(result.evidence,[],question);
    assert.equal(result.serviceEligible,false,question);
  }

  for(const [question,status] of [
    ['x'.repeat(601),'INVALID_INPUT'],
    ['홍길동 혈압 결과 145는 괜찮나요?','PERSONAL_INPUT_NOT_SUPPORTED'],
    ['AFP로 간암을 확진해주세요','REFUSED'],
    ['CT로 간암을 진단해줘','REFUSED'],
    ['간 효소 AST 검사 전에 약을 중단할까요?','REFUSED'],
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,status,question);
    assert.deepEqual(result.evidence,[],question);
    assert.equal(result.clinicalUse,false,question);
  }
});

test('diagnostic terminology is allowed as general education but personal diagnosis and medication advice are refused',()=>{
  for(const question of [
    '혈압 참고범위와 진단 기준은 어떻게 다른가요?',
    '키 참고범위와 진단 기준은 어떻게 다른가요?',
    '약시 검사는 무엇을 확인하나요?',
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.notEqual(result.status,'REFUSED',question);
    assert.equal(result.clinicalUse,false,question);
    assert.equal(result.serviceEligible,false,question);
  }
  for(const question of [
    '내 혈압 수치로 고혈압인지 진단해 주세요',
    'AFP로 간암을 확진해줘',
    'AST 검사 전에 약을 중단할까요?',
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,'REFUSED',question);
    assert.deepEqual(result.evidence,[],question);
  }
});

test('unapproved reference-range and diagnostic-threshold questions abstain instead of borrowing unrelated evidence',()=>{
  for(const question of [
    '혈압 참고범위와 진단 기준은 어떻게 다른가요?',
    '간 초음파 참고범위와 진단 기준은 어떻게 다른가요?',
    '복부 CT diagnostic criteria는 무엇인가요?',
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,'INSUFFICIENT_EVIDENCE',question);
    assert.equal(result.reason,'UNAPPROVED_REFERENCE_RANGE_OR_THRESHOLD',question);
    assert.deepEqual(result.evidence,[],question);
    assert.equal(result.serviceEligible,false,question);
  }
});

test('cross-test relation queries use only explicitly related draft evidence and otherwise abstain',()=>{
  const supported = new Map([
    ['시력 · 좌 / 우','screening-vision-purpose'],
    ['청력 · 좌 / 우','screening-hearing-limits'],
    ['혈색소','screening-hemoglobin-purpose'],
    ['간 효소 AST','liver-ast-purpose'],
    ['간 효소 ALT','liver-alt-purpose'],
    ['간 효소 γ-GTP','liver-ggt-purpose'],
    ['신장기능 eGFR','screening-egfr-purpose'],
    ['요단백','screening-urine-protein-purpose'],
    ['총콜레스테롤','screening-total-cholesterol-purpose'],
    ['HDL 콜레스테롤','screening-hdl-purpose'],
    ['LDL 콜레스테롤','screening-ldl-purpose'],
    ['중성지방','screening-triglycerides-limits'],
    ['C형간염 항체','screening-hcv-antibody-limits'],
    ['폐기능검사','scenario-21'],
    ['구강검진','screening-dental-purpose'],
    ['혈청 AFP','afp-detail-purpose'],
  ]);
  for(const entry of scenarioEntries){
    const question=`${entry.label} 다른 검사와 함께 보는 이유는 무엇인가요?`;
    const result=retrieveHealthEducationEvidence(question);
    const expectedChunk=supported.get(entry.label);
    if(expectedChunk){
      assert.equal(result.status,'CANDIDATE',question);
      assert.equal(result.evidence[0].chunk_id,expectedChunk,question);
      assert.equal(result.intent,'RELATED_TESTS',question);
      assert.equal(result.extractiveOnly,true,question);
      assert.equal(result.evidence[0].contentReview,'UNASSIGNED',question);
      assert.equal(result.evidence[0].clinicalUse,false,question);
      assert.equal(result.serviceEligible,false,question);
      assert.equal(result.reviewStatus,'DRAFT / UNASSIGNED',question);
      const exactOutput={answer:result.evidence[0].text_ko,evidenceIds:['E1'],questions:[result.questionTemplate]};
      assert.equal(validateEducationOutput(exactOutput,result).status,'GENERATED',question);
      assert.throws(()=>validateEducationOutput({...exactOutput,answer:`${exactOutput.answer} 따라서 특정 질환일 수 있습니다.`},result),/REJECTED/,question);
    }else{
      assert.equal(result.status,'INSUFFICIENT_EVIDENCE',question);
      assert.deepEqual(result.evidence,[],question);
      assert.equal(result.serviceEligible,false,question);
    }
  }
  assert.equal(supported.size,16);

  const explicitPair=retrieveHealthEducationEvidence('혈청 크레아티닌과 eGFR은 어떤 관계인가요?');
  assert.equal(explicitPair.status,'CANDIDATE');
  assert.equal(explicitPair.evidence[0].chunk_id,'screening-egfr-purpose');
  assert.equal(explicitPair.intent,'RELATED_TESTS');
  assert.match(explicitPair.evidence[0].text_ko,/혈청 크레아티닌으로 계산/);
  assert.equal(explicitPair.evidence[0].contentReview,'UNASSIGNED');
  assert.equal(explicitPair.clinicalUse,false);
  assert.equal(explicitPair.serviceEligible,false);
  assert.equal(explicitPair.reviewStatus,'DRAFT / UNASSIGNED');

  const ambiguousCoTesting=retrieveHealthEducationEvidence('혈청 크레아티닌 다른 검사와 함께 보는 이유는 무엇인가요?');
  assert.equal(ambiguousCoTesting.status,'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(ambiguousCoTesting.evidence,[]);
  assert.equal(ambiguousCoTesting.serviceEligible,false);

  const clinicalDecision=retrieveHealthEducationEvidence('eGFR과 크레아티닌을 이용해 신장 질환을 진단할 수 있나요?');
  assert.notEqual(clinicalDecision.status,'CANDIDATE');
  assert.deepEqual(clinicalDecision.evidence,[]);
  assert.equal(clinicalDecision.serviceEligible,false);
});

test('screening comparison wording routes to one comparison candidate',()=>{
  const result=retrieveHealthEducationEvidence('키 이전 검사 결과와 비교할 때 무엇을 확인하나요?');
  assert.equal(result.status,'CANDIDATE');
  assert.equal(result.retriever,'SCREENING_DETAIL');
  assert.equal(result.evidence[0].chunk_id,'screening-height-comparison');
  assert.equal(result.intent,'COMPARISON');
  assert.equal(result.reviewStatus,'DRAFT / UNASSIGNED');
  assert.equal(result.clinicalUse,false);
  assert.equal(result.serviceEligible,false);
});

test('individual liver enzymes are not mistaken for the whole liver-function panel',()=>{
  for(const [question,expectedChunk] of [
    ['간 효소 AST 검사 목적을 설명해 주세요.','liver-ast-purpose'],
    ['간 효소 ALT 검사로 알 수 없는 점은 무엇인가요?','liver-alt-limits'],
    ['간 효소 γ-GTP 검사 준비는 어떻게 확인하나요?','liver-ggt-preparation'],
    ['간 효소 AST 이전 결과와 비교할 때 무엇을 확인하나요?','liver-any-comparison'],
  ]){
    const result=retrieveHealthEducationEvidence(question);
    assert.equal(result.status,'CANDIDATE',question);
    assert.equal(result.retriever,'LIVER_DETAIL',question);
    assert.equal(result.evidence[0].chunk_id,expectedChunk,question);
  }
  const ambiguous=retrieveHealthEducationEvidence('AST와 간기능 검사 목적을 함께 설명해 주세요.');
  assert.equal(ambiguous.status,'INSUFFICIENT_EVIDENCE');
  assert.deepEqual(ambiguous.evidence,[]);
});

test('screening purpose wording remains covered after comparison disambiguation',()=>{
  const result=retrieveHealthEducationEvidence('소변 단백 검사는 무엇을 확인하나요?');
  assert.equal(result.status,'CANDIDATE');
  assert.equal(result.retriever,'SCREENING_DETAIL');
  assert.equal(result.evidence[0].chunk_id,'screening-urine-protein-purpose');
  assert.equal(result.intent,'PURPOSE');
});

test('unified result still permits only the exact saved extractive draft and its single source',()=>{
  const result=retrieveHealthEducationEvidence('복부 CT 전에 무엇을 준비해야 하나요?');
  assert.equal(result.status,'CANDIDATE');
  assert.equal(result.retriever,'IMAGING_DETAIL');
  const output={answer:result.evidence[0].text_ko,evidenceIds:['E1'],questions:[result.questionTemplate]};
  const rendered=validateEducationOutput(output,result);
  assert.equal(rendered.status,'GENERATED');
  assert.equal(rendered.sources.length,1);
  assert.throws(()=>validateEducationOutput({...output,answer:`${output.answer} 임의 추가 설명`},result),/REJECTED/);
});
