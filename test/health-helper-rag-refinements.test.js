import test from 'node:test';
import assert from 'node:assert/strict';
import {isNonAnswerListLead, validateEducationOutput} from '../src/health-helper-medlineplus.js';
import {loadUploadedCorpus, retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoCandidateEvidence} from '../src/health-helper-school-demo-medical-tests.js';

test('isNonAnswerListLead detects incomplete list lead sentences and rejects them', () => {
  const leadSamples = [
    '나타날 수 있는 증상은 다음과 같습니다.',
    'ALL의 위험을 높이는 요인은 다음과 같습니다.',
    '종양의 종류는 아래와 같습니다.',
    '아데노이드 비대로 생길 수 있는 다른 문제는 다음과 같습니다.',
    '증상에는 다음이 포함될 수 있습니다:',
    '다음에 해당하면 의료진에게 알리세요:',
    '다음과 같습니다.',
    '아래와 같습니다',
  ];
  for (const sample of leadSamples) {
    assert.equal(isNonAnswerListLead(sample), true, `Failed to detect lead: ${sample}`);
  }

  const normalAnswers = [
    '천식은 기도의 만성 염증 질환입니다.',
    '빈혈의 가장 흔한 원인은 철분 부족입니다.',
    '초음파는 음파를 이용해 신체 내부를 관찰하는 검사입니다.',
    'AST는 간뿐 아니라 심장·근육 등에도 있는 효소입니다.',
  ];
  for (const normal of normalAnswers) {
    assert.equal(isNonAnswerListLead(normal), false, `False positive on normal answer: ${normal}`);
  }
});

test('validateEducationOutput rejects single incomplete list lead answer', () => {
  const retrieval = {
    status: 'CANDIDATE',
    intent: 'UNDERSTAND',
    evidence: [{
      chunk_id: 'C1',
      doc_id: 'D1',
      title_ko: '청신경종',
      text_ko: '청신경종은 양성 종양입니다. 나타날 수 있는 증상은 다음과 같습니다. 청력 상실이 발생할 수 있습니다.',
      source_url: 'https://medlineplus.gov/test.html',
    }]
  };

  const badOutput = {
    answer: '나타날 수 있는 증상은 다음과 같습니다.',
    evidenceIds: ['C1'],
    questions: ['진료에서 무엇을 확인할까요?']
  };

  assert.throws(
    () => validateEducationOutput(badOutput, retrieval),
    err => err.message === 'EDUCATION_OUTPUT_REJECTED' && err.reasonCode === 'OUTPUT_CONTENT_UNSAFE'
  );
});

test('colloquial symptom queries map to clinical MedlinePlus topics accurately', async () => {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), {includeQaHolds: true});
  const addendum = await loadSchoolDemoMedicalTestAddendum();

  const testCases = [
    { query: '피검사 간 수치 설명해줘', expectedTopicKeywords: ['간기능', '간 효소', '간 질환'] },
    { query: '황달은 무엇인가요?', expectedTopicKeywords: ['황달'] },
    { query: '역류성 식도염 증상 설명해줘', expectedTopicKeywords: ['위식도역류'] },
  ];

  for (const {query, expectedTopicKeywords} of testCases) {
    const res = retrieveSchoolDemoCandidateEvidence(query, corpus, addendum);
    assert.equal(res.status, 'CANDIDATE', `Failed to retrieve for query: ${query}`);
    assert.ok(res.evidence.length > 0, `No evidence for query: ${query}`);
    const title = res.evidence[0].title_ko;
    const matchesKeyword = expectedTopicKeywords.some(kw => title.includes(kw));
    assert.ok(matchesKeyword, `Query "${query}" matched title "${title}", expected one of: ${expectedTopicKeywords.join(', ')}`);
  }
});
