import { createPatientTranslationRag } from '../src/health-helper-patient-translation.js';
import { HealthHelperRag } from '../src/health-helper-rag.js';
import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoCandidateEvidence } from '../src/health-helper-school-demo-medical-tests.js';
import { retrieveUploadedEvidence } from '../src/medlineplus-upload-corpus.js';

async function main() {
  const env = {
    HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo',
    HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC',
    HIPASS_HEALTH_HELPER_MODEL: 'ollama',
    HIPASS_HELPER_SOCKET: '/run/helper/ollama.sock'
  };

  const base = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const supplement = await loadSchoolDemoMedicalTestAddendum();
  const corpus = {
    ...base,
    chunks: [...base.chunks, ...supplement.chunks],
    held: [...base.held, ...supplement.held],
    heldDocuments: [...base.heldDocuments, ...supplement.held]
  };

  const testQuestions = [
    '간경화에 대해서 알려주세요',
    '간경화에 대해서 알려달라',
    '간경화란 무엇인가요?',
    '간경변증에 대해 알려주세요',
    '간경화는 어떤 질환인가요?'
  ];

  console.log('=== Testing retrieveUploadedEvidence ===');
  for (const q of testQuestions) {
    const resUpload = retrieveUploadedEvidence(q, corpus);
    console.log(`Q: "${q}" -> upload status: ${resUpload.status}, evidence count: ${resUpload.evidence?.length}`);
    const resCandidate = retrieveSchoolDemoCandidateEvidence(q, corpus, supplement);
    console.log(`Q: "${q}" -> candidate status: ${resCandidate.status}, evidence count: ${resCandidate.evidence?.length}`);
  }

  console.log('=== Testing createPatientTranslationRag ===');
  const translationRag = await createPatientTranslationRag({
    env,
    generateAnswer: async (retrieval) => ({
      answer: '간경화는 간 조직이 굳어지는 질환입니다.',
      sources: retrieval.evidence.map(e => ({ id: e.doc_id, title: e.title_ko, contextNote: 'test' })),
      questions: ['간경화 원인은 무엇인가요?'],
      claimEvidence: []
    })
  });

  const rag = new HealthHelperRag({
    audit: async () => {},
    translationRag
  });

  for (const q of testQuestions) {
    try {
      const res = await rag.ask({ role: 'PATIENT', patientId: 'p-1', subject: 'sub-1' }, { question: q });
      console.log(`RAG ask Q: "${q}" -> status: ${res.status}, answer: ${res.answer?.slice(0, 50)}...`);
    } catch (e) {
      console.log(`RAG ask Q: "${q}" -> ERROR: ${e.code || e.message}`);
    }
  }
}

main().catch(console.error);
