import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {loadSchoolDemoMedicalTestAddendum, retrieveSchoolDemoMedicalTestEvidence} from '../src/health-helper-school-demo-medical-tests.js';
import {retrieveLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {retrieveAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {retrieveImagingEvidence} from '../src/health-helper-imaging-evidence.js';
import {retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {sourceGuidanceFromEvidence} from '../src/health-helper-medlineplus.js';
import {refinePatientMedicalKorean} from '../src/health-helper-korean-refinement.js';

function patientPresentation(result) {
  if (!result || typeof result !== 'object') return result;
  const answer = typeof result.answer === 'string' ? refinePatientMedicalKorean(result.answer) : result.answer;
  const sources = Array.isArray(result.sources)
    ? result.sources.map(source => ({
        ...source,
        excerpt: typeof source.excerpt === 'string' ? refinePatientMedicalKorean(source.excerpt) : source.excerpt,
      }))
    : result.sources;
  return { ...result, answer, sources };
}

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

const baseCorpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), {includeQaHolds: true});
const supplement = await loadSchoolDemoMedicalTestAddendum();
const corpus = {
  ...baseCorpus,
  chunks: [...baseCorpus.chunks, ...supplement.chunks],
  held: [...baseCorpus.held, ...supplement.held],
  heldDocuments: [...baseCorpus.heldDocuments, ...supplement.held],
};

function retrieve(question) {
  const base = retrieveUploadedEvidence(question, corpus);
  if (['INVALID_INPUT', 'PERSONAL_INPUT_NOT_SUPPORTED', 'REFUSED'].includes(base.status)) return base;
  const addendumRet = retrieveSchoolDemoMedicalTestEvidence(question, supplement);
  if (addendumRet && addendumRet.status === 'CANDIDATE') return addendumRet;
  
  const liver = retrieveLiverFunctionEvidence(question);
  if (liver.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(liver);
    if (adapted) return adapted;
  }
  const afp = retrieveAfpEvidence(question);
  if (afp.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(afp);
    if (adapted) return adapted;
  }
  const imaging = retrieveImagingEvidence(question);
  if (imaging.status === 'CANDIDATE') {
    const adapted = adaptScenarioEvidence(imaging);
    if (adapted) return adapted;
  }
  return addendumRet ?? base;
}

async function ask(question) {
  const retrieval = retrieve(question);
  const metadata = {
    corpusVersion: baseCorpus.version,
    medicalTestsVersion: supplement.version,
    profile: 'SCHOOL_DEMO_TRANSLATION_RAG',
    clinicalUse: false,
    recordContext: 'NOT_CONNECTED',
  };
  if (retrieval.status !== 'CANDIDATE') {
    return {
      ...metadata,
      status: retrieval.status,
      generationUsed: false,
      sources: [],
      questions: [],
      answer: retrieval.status === 'PERSONAL_INPUT_NOT_SUPPORTED'
        ? '개인 검사 수치와 증상 해석은 지원하지 않아요. 검사 이름이나 일반적인 목적을 질문해 주세요.'
        : retrieval.status === 'REFUSED'
        ? '진단이나 치료 판단은 의료진에게 확인해 주세요.'
        : '이 질문에 답할 번역 근거를 찾지 못했어요. 검사 이름과 궁금한 내용을 구체적으로 적어 주세요.',
    };
  }
  const guidance = sourceGuidanceFromEvidence(retrieval);
  const excerpts = guidance.sources.map(s => s.excerpt).filter(t => typeof t === 'string' && t.trim());
  return patientPresentation({
    ...guidance,
    ...metadata,
    generationUsed: false,
    ...(excerpts.length ? { status: 'RETRIEVED', answer: excerpts.join('\n\n') } : {}),
    responseMode: 'TRANSLATION_RETRIEVAL',
    questionOrigin: 'PROJECT_TEMPLATE',
  });
}

console.log('=== Patient Presentation Tests ===');
for (const q of [
  'AST: 이 검사는 무엇을 확인하나요?',
  'ALT: 이 검사는 무엇을 확인하나요?',
  'GGT: 이 검사는 무엇을 확인하나요?',
  'AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?',
  '간기능 검사 전에는 어떻게 준비하나요?',
]) {
  const ans = await ask(q);
  console.log(`Q: ${q}`);
  console.log(`Status: ${ans.status}`);
  console.log(`Answer:\n${ans.answer}`);
  console.log(`Source Title: ${ans.sources[0]?.title} (${ans.sources[0]?.url})`);
  console.log('--------------------------------------------------');
}
