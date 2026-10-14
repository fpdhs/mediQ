import {retrieveLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {retrieveAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {sourceGuidanceFromEvidence} from '../src/health-helper-medlineplus.js';

function adaptEvidenceForSchoolDemo(retrieval) {
  if (retrieval.status !== 'CANDIDATE' || !retrieval.evidence?.length) return retrieval;
  const adaptedEvidence = retrieval.evidence.map((chunk, index) => ({
    ...chunk,
    demoIndexStatus: 'PASS',
    ai_qa_status: chunk.ai_qa_status ?? 'HOLD',
    contentReview: chunk.contentReview ?? 'UNASSIGNED',
    sourceContentReview: chunk.sourceContentReview ?? 'UNASSIGNED',
    unresolvedIssueCount: chunk.unresolvedIssueCount ?? 0,
    allowedSentenceIndexes: chunk.allowedSentenceIndexes ?? [0],
  }));
  return {
    ...retrieval,
    extractiveOnly: true,
    evidence: adaptedEvidence,
  };
}

const ast = adaptEvidenceForSchoolDemo(retrieveLiverFunctionEvidence('AST: 이 검사는 무엇을 확인하나요?'));
console.log('AST Retrieval adapted:', ast.status);
try {
  const guidance = sourceGuidanceFromEvidence(ast);
  console.log('AST Guidance success! Excerpt:', guidance.sources[0]?.excerpt);
  console.log('AST Source title:', guidance.sources[0]?.title);
} catch (e) {
  console.error('AST Guidance error:', e);
}

const afpComp = adaptEvidenceForSchoolDemo(retrieveAfpEvidence('AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?'));
console.log('\nAFP Comp Retrieval adapted:', afpComp.status);
try {
  const guidance = sourceGuidanceFromEvidence(afpComp);
  console.log('AFP Comp Guidance success! Excerpt:', guidance.sources[0]?.excerpt);
  console.log('AFP Comp Source title:', guidance.sources[0]?.title);
} catch (e) {
  console.error('AFP Comp Guidance error:', e);
}
