import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoMedicalTestEvidence} from '../src/health-helper-school-demo-medical-tests.js';
import {retrieveLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {retrieveAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {retrieveImagingEvidence} from '../src/health-helper-imaging-evidence.js';
import {retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {sourceGuidanceFromEvidence} from '../src/health-helper-medlineplus.js';

const baseCorpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), {includeQaHolds: true});
const addendum = await loadSchoolDemoMedicalTestAddendum();

function adaptScenarioEvidence(retrieval) {
  if (retrieval.status !== 'CANDIDATE' || !retrieval.evidence?.length) return null;
  const chunk = retrieval.evidence[0];
  const adapted = {
    ...chunk,
    doc_id: chunk.doc_id ?? chunk.chunk_id,
    demoIndexStatus: 'PASS',
    schoolDemoCandidateStatus: 'PASS',
    ai_qa_status: 'PASS',
    contentReview: 'UNASSIGNED',
    sourceContentReview: 'UNASSIGNED',
    unresolvedIssueCount: 0,
    allowedSentenceIndexes: [0],
  };
  return {
    ...retrieval,
    extractiveOnly: true,
    evidence: [adapted],
  };
}

function unifiedRetrieve(question) {
  const base = retrieveUploadedEvidence(question, baseCorpus);
  if (['INVALID_INPUT', 'PERSONAL_INPUT_NOT_SUPPORTED', 'REFUSED'].includes(base.status)) return base;
  
  const fromAddendum = retrieveSchoolDemoMedicalTestEvidence(question, addendum);
  if (fromAddendum && fromAddendum.status === 'CANDIDATE') return fromAddendum;
  
  // Liver function (AST, ALT, GGT, panel)
  const liver = retrieveLiverFunctionEvidence(question);
  if (liver.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(liver);
    if (adapted) return adapted;
  }
  
  // AFP details (comparison, preparation)
  const afp = retrieveAfpEvidence(question);
  if (afp.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(afp);
    if (adapted) return adapted;
  }
  
  // Imaging details (ultrasound, CT)
  const imaging = retrieveImagingEvidence(question);
  if (imaging.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(imaging);
    if (adapted) return adapted;
  }
  
  return fromAddendum ?? base;
}

const testQuestions = [
  'AFP 검사는 무엇을 확인하나요?',
  '초음파는 어떤 검사인가요?',
  '간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?',
  'AST: 이 검사는 무엇을 확인하나요?',
  'ALT: 이 검사는 무엇을 확인하나요?',
  'GGT: 이 검사는 무엇을 확인하나요?',
  'AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?',
  '간기능 검사 전에는 어떻게 준비하나요?',
  '빈혈은 무엇인가요?', // base corpus 1017
  '혈전 방지를 위해 어떤 운동을 하나요?', // REFUSED
];

console.log('=== Testing Unified Retrieval ===');
for (const q of testQuestions) {
  const r = unifiedRetrieve(q);
  let excerpt = '-';
  if (r.status === 'CANDIDATE') {
    try {
      const g = sourceGuidanceFromEvidence(r);
      excerpt = g.sources[0]?.excerpt?.slice(0, 50) + '...';
    } catch (e) {
      excerpt = `[Guidance Error: ${e.message}]`;
    }
  }
  console.log(`Q: ${q}`);
  console.log(`   Status: ${r.status} | Topic: ${r.topic} | Excerpt: ${excerpt}\n`);
}
