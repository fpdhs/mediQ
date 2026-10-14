import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoCandidateEvidence } from '../src/health-helper-school-demo-medical-tests.js';
import { generateCandidateAnswer } from '../src/health-helper-candidate-generation.js';

async function main() {
  const base = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const supplement = await loadSchoolDemoMedicalTestAddendum();
  const corpus = {
    ...base,
    chunks: [...base.chunks, ...supplement.chunks],
    held: [...base.held, ...supplement.held],
    heldDocuments: [...base.heldDocuments, ...supplement.held]
  };

  const question = "간경화에 대해서 알려달라";
  console.log('Retrieving evidence for:', question);
  const retrieval = retrieveSchoolDemoCandidateEvidence(question, corpus, supplement);
  console.log('Retrieval status:', retrieval.status, 'Focus:', retrieval.focus, 'ExtractiveOnly:', retrieval.extractiveOnly);

  retrieval.claimEvidenceRequired = true;
  console.log('Calling generateCandidateAnswer with local Ollama...');
  try {
    const res = await generateCandidateAnswer(retrieval);
    console.log('generateCandidateAnswer SUCCESS:');
    console.log(JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('generateCandidateAnswer FAILED:');
    console.error('Code:', err.code, 'Reason:', err.reasonCode, 'Message:', err.message);
    console.error(err);
  }
}

main().catch(console.error);
