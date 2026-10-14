import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoCandidateEvidence } from '../src/health-helper-school-demo-medical-tests.js';
import { educationPayload } from '../src/health-helper-medlineplus.js';

async function main() {
  const base = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const supplement = await loadSchoolDemoMedicalTestAddendum();
  const corpus = {
    ...base,
    chunks: [...base.chunks, ...supplement.chunks],
    held: [...base.held, ...supplement.held],
    heldDocuments: [...base.heldDocuments, ...supplement.held]
  };

  const questions = [
    '간경화에 대해서 알려달라',
    '간경화에 대해 알려주세요',
    '간경화란 무엇인가요?',
    '간경변증은 어떤 질환인가요?'
  ];

  for (const q of questions) {
    console.log(`\n================ Question: "${q}" ================`);
    const r = retrieveSchoolDemoCandidateEvidence(q, corpus, supplement);
    console.log('Status:', r.status);
    console.log('Topic:', r.topic);
    console.log('Intent:', r.intent);
    console.log('Focus:', r.focus);
    console.log('ExtractiveOnly:', r.extractiveOnly);
    console.log('Evidence count:', r.evidence?.length);
    if (r.evidence?.length) {
      console.log('Evidence doc_ids:', r.evidence.map(e => e.doc_id));
      console.log('Evidence titles:', r.evidence.map(e => e.title_ko));
      console.log('Evidence 0 allowedSentenceIndexes:', r.evidence[0].allowedSentenceIndexes);
      console.log('Evidence 0 focusSentenceIndexes:', r.evidence[0].focusSentenceIndexes);
      try {
        r.claimEvidenceRequired = true;
        const payload = educationPayload(r);
        console.log('Payload generated successfully! User message:');
        console.log(payload.messages[1].content);
      } catch (e) {
        console.log('educationPayload ERROR:', e.message);
      }
    }
  }
}

main().catch(console.error);
