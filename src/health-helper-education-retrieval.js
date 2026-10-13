// Unified local evidence routing for the scenario's draft educational corpus.
// This module does not grant content approval or enable the production API.
import {retrieveScenarioEvidence,retrieveScenarioRelatedTestEvidence} from './health-helper-scenario-evidence.js';
import {retrieveAfpEvidence} from './health-helper-afp-evidence.js';
import {retrieveLiverFunctionEvidence} from './health-helper-liver-evidence.js';
import {retrieveImagingEvidence} from './health-helper-imaging-evidence.js';
import {retrieveScreeningEvidence} from './health-helper-screening-evidence.js';

const routes = Object.freeze([
  {name:'AFP_DETAIL', priority:100, retrieve:retrieveAfpEvidence},
  {name:'IMAGING_DETAIL', priority:95, retrieve:retrieveImagingEvidence},
  {name:'LIVER_DETAIL', priority:90, retrieve:retrieveLiverFunctionEvidence},
  {name:'SCREENING_DETAIL', priority:80, retrieve:retrieveScreeningEvidence},
  {name:'SCENARIO_RELATED_TESTS', priority:70, retrieve:retrieveScenarioRelatedTestEvidence},
  {name:'SCENARIO_CONCEPT', priority:10, retrieve:retrieveScenarioEvidence},
]);
const terminalStatuses = new Set(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED']);
const terminalPriority = new Map([
  ['INVALID_INPUT', 0],
  ['PERSONAL_INPUT_NOT_SUPPORTED', 1],
  ['REFUSED', 2],
]);

function evidenceKey(evidence) {
  return `${evidence.chunk_id ?? evidence.id ?? ''}:${evidence.source_url ?? ''}`;
}

function failClosed(result, route, candidates = []) {
  return {
    ...result,
    evidence: [],
    retriever: route,
    reviewStatus: 'DRAFT / UNASSIGNED',
    clinicalUse: false,
    serviceEligible: false,
    candidateCount: candidates.length,
  };
}

function isExplicitClinicalRequest(question){
  const compact=question.replace(/\s+/gu,'');
  const personalDiagnosis=/(?:진단|확진)(?:해줘|해주세요|해주실|해줄|받아|내려|가능|부탁)|(?:암|질환|병)인지(?:알려|확인|봐|맞)/u.test(compact)
    ||/(?:내|제|이번|이전).{0,8}(?:결과|수치|기록).{0,8}(?:진단|확진)/u.test(compact);
  const medicationAdvice=/(?:약물|의약품|약제|약).{0,12}(?:복용|먹어|먹|중단|끊|처방|용량|변경|바꾸|시작|줄|늘)/u.test(compact)
    ||/(?:복용|먹어|먹|중단|끊|처방|용량|변경|바꾸|시작|줄|늘).{0,12}(?:약물|의약품|약제|약)/u.test(compact);
  return personalDiagnosis||medicationAdvice||/치료|수술|응급|숨.*(?:차|막)|가슴.*(?:아프|통증)/u.test(question);
}

/**
 * Routes one question to exactly one of the project-authored evidence candidates.
 * Result statuses are still candidates only: callers must preserve the medical-review gate.
 */
export function retrieveHealthEducationEvidence(question) {
  if (typeof question === 'string' && isExplicitClinicalRequest(question)) {
    return failClosed({status:'REFUSED',reason:'CLINICAL_REQUEST_NOT_SUPPORTED'},'SAFETY_BOUNDARY');
  }
  if(typeof question==='string'&&/(?:참고\s*범위|정상\s*범위|진단\s*기준|판정\s*기준|기준치|정상\s*수치|reference\s*range|normal\s*range|diagnostic\s*criteria|cut[\s-]?off)/iu.test(question)){
    return failClosed({status:'INSUFFICIENT_EVIDENCE',reason:'UNAPPROVED_REFERENCE_RANGE_OR_THRESHOLD'},'THRESHOLD_SCOPE');
  }
  const evaluated = routes.map(route => ({route, result:route.retrieve(question)}));
  const terminals = evaluated
    .filter(({result}) => terminalStatuses.has(result.status))
    .sort((a,b) => terminalPriority.get(a.result.status) - terminalPriority.get(b.result.status));
  if (terminals.length) return failClosed(terminals[0].result, terminals[0].route.name);

  const candidates = evaluated.filter(({result}) => result.status === 'CANDIDATE');
  const detailCandidates = candidates.filter(({result}) => result.extractiveOnly === true);
  if (detailCandidates.length) {
    const winningPriority = Math.max(...detailCandidates.map(({route}) => route.priority));
    const winners = detailCandidates.filter(({route}) => route.priority === winningPriority);
    const unique = new Map();
    for (const item of winners) for (const evidence of item.result.evidence ?? []) unique.set(evidenceKey(evidence), item);
    if (unique.size !== 1) return failClosed({status:'INSUFFICIENT_EVIDENCE',reason:'AMBIGUOUS_EDUCATION_RETRIEVAL'},'AMBIGUOUS',candidates);
    const winner = [...unique.values()][0];
    return {
      ...winner.result,
      retriever:winner.route.name,
      reviewStatus:'DRAFT / UNASSIGNED',
      clinicalUse:false,
      serviceEligible:false,
      candidateCount:candidates.length,
    };
  }

  const conceptEvidence = new Map();
  for (const item of candidates) for (const evidence of item.result.evidence ?? []) {
    conceptEvidence.set(evidenceKey(evidence), item);
  }
  if (conceptEvidence.size === 1) {
    const winner = [...conceptEvidence.values()][0];
    return {
      ...winner.result,
      retriever:'SCENARIO_CONCEPT',
      reviewStatus:'DRAFT / UNASSIGNED',
      clinicalUse:false,
      serviceEligible:false,
      candidateCount:candidates.length,
    };
  }
  if (conceptEvidence.size > 1) return failClosed({status:'INSUFFICIENT_EVIDENCE',reason:'AMBIGUOUS_EDUCATION_RETRIEVAL'},'AMBIGUOUS',candidates);

  const insufficient = evaluated.find(({result}) => result.status === 'INSUFFICIENT_EVIDENCE');
  return failClosed(insufficient?.result ?? {status:'INSUFFICIENT_EVIDENCE',reason:'NO_EDUCATION_EVIDENCE'},
    insufficient?.route.name ?? 'NO_MATCH',candidates);
}
