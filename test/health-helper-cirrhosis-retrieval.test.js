import test from 'node:test';
import assert from 'node:assert/strict';
import { createPatientTranslationRag } from '../src/health-helper-patient-translation.js';
import { HealthHelperRag } from '../src/health-helper-rag.js';

test('colloquial cirrhosis questions retrieve evidence and answer without false regex blockage', async () => {
  const env = {
    HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo',
    HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC',
    HIPASS_HEALTH_HELPER_MODEL: 'ollama',
    HIPASS_HELPER_SOCKET: '/run/helper/ollama.sock'
  };

  const rag = await createPatientTranslationRag({
    env,
    generateAnswer: async (retrieval) => {
      assert.equal(retrieval.topic, '190');
      return {
        status: 'GENERATED',
        answer: '간경변증은 간에 흉터가 생기는 것입니다.',
        evidenceIds: ['E1'],
        questions: ['진료에서 이 자료와 관련해 무엇을 확인하면 좋을까요?'],
        claimEvidence: [{ evidenceId: 'E1', sentenceIndexes: [0] }],
        sources: [{ id: 'E1', url: 'https://medlineplus.gov/cirrhosis.html', title: '간경변증', contextNote: 'test' }]
      };
    }
  });

  const helper = new HealthHelperRag({
    translationRag: rag,
    audit: async () => {}
  });

  const patient = { role: 'PATIENT', subject: 'sub-1', patientId: 'p-1' };

  // Definition question with colloquial suffix -란
  const defResult = await helper.ask(patient, { question: '간경화란 무엇인가요?' });
  assert.equal(defResult.status, 'GENERATED');
  assert.match(defResult.answer, /간경변증/u);

  // General explanation question with -에 대해서 알려달라
  const explainResult = await helper.ask(patient, { question: '간경화에 대해서 알려달라' });
  assert.equal(explainResult.status, 'GENERATED');
  assert.match(explainResult.answer, /간경변증/u);

  // Standalone cirrhosis keyword
  const standaloneCirrhosis = await helper.ask(patient, { question: '간경화' });
  assert.equal(standaloneCirrhosis.status, 'GENERATED');
  assert.match(standaloneCirrhosis.answer, /간경변증/u);

  // Question containing '약' as part of an ordinary word (만약, 약간) should NOT be refused
  const falsePositiveYak = await helper.ask(patient, { question: '만약 간경화가 의심되면 어떤 검사를 하나요?' });
  assert.notEqual(falsePositiveYak.status, 'REFUSED');

  // Genuine medication prescription request SHOULD be refused
  const trueMedicationRefusal = await helper.ask(patient, { question: '간경화에 무슨 약을 먹어야 하나요?' });
  assert.equal(trueMedicationRefusal.status, 'REFUSED');
});

test('standalone and colloquial medical test questions (AFP, ultrasound) retrieve definition evidence', async () => {
  const env = {
    HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo',
    HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC',
    HIPASS_HEALTH_HELPER_MODEL: 'ollama',
    HIPASS_HELPER_SOCKET: '/run/helper/ollama.sock'
  };

  let capturedRetrieval = null;
  const rag = await createPatientTranslationRag({
    env,
    generateAnswer: async (retrieval) => {
      capturedRetrieval = retrieval;
      return {
        status: 'GENERATED',
        answer: retrieval.evidence[0].text_ko,
        evidenceIds: [retrieval.evidence[0].chunk_id],
        questions: ['검사 목적을 확인해 주실 수 있나요?'],
        claimEvidence: [{ evidenceId: retrieval.evidence[0].chunk_id, sentenceIndexes: [0] }],
        sources: [{ id: retrieval.evidence[0].chunk_id, url: retrieval.evidence[0].source_url, title: retrieval.evidence[0].title_ko, contextNote: 'test' }]
      };
    }
  });

  const helper = new HealthHelperRag({
    translationRag: rag,
    audit: async () => {}
  });

  const patient = { role: 'PATIENT', subject: 'sub-2', patientId: 'p-2' };

  // Standalone AFP
  const afpAlone = await helper.ask(patient, { question: 'AFP' });
  assert.equal(afpAlone.status, 'GENERATED');
  assert.equal(capturedRetrieval.topic, 'school-demo-medical-test-afp-tumor-marker');
  assert.match(afpAlone.answer, /혈액 검체에서 AFP/u);

  // Standalone AFP test
  const afpExam = await helper.ask(patient, { question: 'AFP 검사' });
  assert.equal(afpExam.status, 'GENERATED');

  // Colloquial ending
  const afpExplain = await helper.ask(patient, { question: 'AFP에 대해서 알려줘' });
  assert.equal(afpExplain.status, 'GENERATED');

  // Standalone Ultrasound
  const usAlone = await helper.ask(patient, { question: '초음파' });
  assert.equal(usAlone.status, 'GENERATED');
  assert.equal(capturedRetrieval.topic, 'school-demo-medical-test-ultrasound');
  assert.match(usAlone.answer, /음파를 이용해/u);

  // Standalone Liver Ultrasound
  const liverUs = await helper.ask(patient, { question: '간 초음파' });
  assert.equal(liverUs.status, 'GENERATED');
  assert.match(liverUs.answer, /간, 담낭, 췌장 또는 비장을 포함한 복부 장기/u);

  // Clinical diagnosis refusal must be preserved
  const diagRefuse = await helper.ask(patient, { question: '내 AFP로 간암인지 진단해 주세요' });
  assert.equal(diagRefuse.status, 'REFUSED');
});
