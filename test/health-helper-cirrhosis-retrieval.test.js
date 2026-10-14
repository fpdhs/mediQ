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

  // Question containing '약' as part of an ordinary word (만약, 약간) should NOT be refused
  const falsePositiveYak = await helper.ask(patient, { question: '만약 간경화가 의심되면 어떤 검사를 하나요?' });
  assert.notEqual(falsePositiveYak.status, 'REFUSED');

  // Genuine medication prescription request SHOULD be refused
  const trueMedicationRefusal = await helper.ask(patient, { question: '간경화에 무슨 약을 먹어야 하나요?' });
  assert.equal(trueMedicationRefusal.status, 'REFUSED');
});
