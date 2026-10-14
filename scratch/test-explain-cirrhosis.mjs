import { createPatientTranslationRag } from '../src/health-helper-patient-translation.js';

async function main() {
  const env = {
    HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo',
    HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC',
    HIPASS_HEALTH_HELPER_MODEL: 'ollama',
    HIPASS_HELPER_SOCKET: '/run/helper/ollama.sock'
  };

  const rag = await createPatientTranslationRag({
    env,
    generateAnswer: async (retrieval) => {
      console.log('generateAnswer called with retrieval:');
      console.log('Focus:', retrieval.focus);
      console.log('Evidence count:', retrieval.evidence?.length);
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

  const res = await rag('간경화에 대해서 알려달라', { signal: new AbortController().signal });
  console.log('Result:', JSON.stringify(res, null, 2));
}

main().catch(console.error);
