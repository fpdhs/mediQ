// 2-Layer Intent Classification for Medical RAG.
// Layer 1: Topic Disambiguation (1,019 MedlinePlus topics + medical test addendum + colloquial aliases)
// Layer 2: Intent Classification (DEFINITION/UNDERSTAND, CAUSES, SYMPTOMS, PREPARE, LIMITATIONS)
// Default intent: DEFINITION (UNDERSTAND)

import { morphoAnalyze } from './health-helper-korean-morpho.js';

// Canonical intent constants
export const INTENTS = Object.freeze({
  DEFINITION: 'UNDERSTAND',
  CAUSE: 'CAUSES',
  SYMPTOM: 'SYMPTOMS',
  PREPARATION: 'PREPARE',
  LIMITATION: 'LIMITATIONS',
  COMPARISON: 'COMPARE',
  MULTI_INTENT: 'MULTI_INTENT'
});

const normalize = str => (str ?? '').normalize('NFC').toLowerCase().replace(/\s+/gu, '');

// Intent keyword patterns
const INTENT_RULES = [
  {
    intent: INTENTS.MULTI_INTENT,
    pattern: /(?:증상.{0,12}(?:과|및)\s*원인|원인.{0,12}(?:과|및)\s*증상)/u
  },
  {
    intent: INTENTS.LIMITATION,
    pattern: /(?:단독|혼자|만으로).{0,12}(?:선별|진단|암|질환)|(?:선별|진단).{0,12}(?:만으로|단독)|검사\s*결과의\s*한계/u
  },
  {
    intent: INTENTS.COMPARISON,
    pattern: /(?:비교|이전|지난|추세|과거\s*결과|차이점|차이)/u
  },
  {
    intent: INTENTS.PREPARATION,
    pattern: /(?:금식|공복|식사|음식|음료|옷|장신구|머리핀|보청기|심박\s*조율기|금속|제거|빼|치워|갈아입|준비|검사\s*전|(?:검사|촬영)\s*전에|찍기\s*전|알려야|고지)/u
  },
  {
    intent: INTENTS.SYMPTOM,
    pattern: /(?:증상|징후|어떤\s*(?:느낌|증상)|어떻게\s*느|몸(?:이|에)(?!서).*(?:어떻게|어떤)|느껴|어떤\s*변화|피곤|피로|쇠약|약해|어지럽|어지러|메스껍|구토|설사|발진|가렵|발열|오한|춥|통증|아프)/u
  },
  {
    intent: INTENTS.CAUSE,
    pattern: /(?:원인|이유|왜.*(?:생기|생겨|생겼|생긴|발생|일어나)|무엇.*(?:원인|유발|초래|일으키)|어떻게.*(?:생기|생겨|발생)|때문)/u
  },
  {
    intent: INTENTS.DEFINITION,
    pattern: /(?:무엇|뭐|뜻|정의|어떤\s*검사|무슨\s*검사|무엇을\s*(?:확인|측정|보)|목적|왜\s*(?:하|검사|받)|원리|개요|설명|알려|궁금|뭔|어떻|란|이란)/u
  }
];

/**
 * Layer 1: Resolves topic from question using morphological candidates.
 * Checks addendum first, then colloquial clinical aliases, then corpus topics.
 */
export function resolveTopicFromQuestion(question, corpus, addendum = null) {
  if (typeof question !== 'string' || !question.trim()) return null;

  const analysis = morphoAnalyze(question);
  const candidates = analysis.nounCandidates.map(normalize);
  const rawNormalized = normalize(question);

  // 1. Check addendum medical test topics (AFP, Ultrasound)
  const addendumChunks = addendum?.chunks ?? [];
  if (addendumChunks.length > 0) {
    const isAfp = /\bafp\b|알파태아단백/iu.test(rawNormalized);
    const isLiverUs = /간초음파/u.test(rawNormalized);
    const isUs = /초음파/u.test(rawNormalized);

    if (isAfp && isLiverUs) {
      return {
        topicId: 'school-demo-medical-test-afp-tumor-marker',
        subTopicId: 'school-demo-medical-test-ultrasound',
        topicTitle: 'AFP 및 간 초음파 복합',
        matchedAlias: 'AFP 및 간 초음파',
        source: 'ADDENDUM_COMBINED',
        confidence: 1.0
      };
    }
    if (isAfp) {
      return {
        topicId: 'school-demo-medical-test-afp-tumor-marker',
        topicTitle: '알파태아단백(AFP) 종양표지자 검사',
        matchedAlias: 'AFP',
        source: 'ADDENDUM',
        confidence: 1.0
      };
    }
    if (isLiverUs) {
      return {
        topicId: 'school-demo-medical-test-ultrasound',
        topicTitle: '초음파',
        matchedAlias: '간 초음파',
        source: 'ADDENDUM',
        confidence: 1.0
      };
    }
    if (isUs) {
      return {
        topicId: 'school-demo-medical-test-ultrasound',
        topicTitle: '초음파',
        matchedAlias: '초음파',
        source: 'ADDENDUM',
        confidence: 0.95
      };
    }
  }

  // 2. Check MedlinePlus corpus topics
  if (!corpus?.chunks?.length) return null;

  // Build candidate matches scored by match length & specificity
  let bestMatch = null;

  for (const chunk of corpus.chunks) {
    if (chunk.demoIndexStatus !== 'PASS') continue;
    const aliases = [chunk.title_ko, ...(chunk.aliases ?? [])].filter(Boolean);

    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      if (normalizedAlias.length < 2) continue;

      // Check if morphological noun candidate exactly equals alias
      const exactCandidateMatch = candidates.includes(normalizedAlias);
      // Check if normalized raw question contains alias
      const substringMatch = rawNormalized.includes(normalizedAlias);

      if (exactCandidateMatch || substringMatch) {
        const score = normalizedAlias.length + (exactCandidateMatch ? 10 : 0);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = {
            topicId: chunk.topic,
            topicTitle: chunk.title_ko,
            matchedAlias: alias,
            source: 'CORPUS',
            score
          };
        }
      }
    }
  }

  if (bestMatch) {
    return {
      topicId: bestMatch.topicId,
      topicTitle: bestMatch.topicTitle,
      matchedAlias: bestMatch.matchedAlias,
      source: bestMatch.source,
      confidence: Math.min(1.0, bestMatch.score / 20)
    };
  }

  return null;
}

/**
 * Layer 2: Classifies the user's intent.
 * If no specific pattern is matched, defaults to DEFINITION (UNDERSTAND).
 */
export function classifyIntent(question) {
  if (typeof question !== 'string' || !question.trim()) {
    return INTENTS.DEFINITION;
  }

  for (const { intent, pattern } of INTENT_RULES) {
    if (pattern.test(question)) {
      return intent;
    }
  }

  // Default intent when no explicit cue is found: DEFINITION (UNDERSTAND)
  return INTENTS.DEFINITION;
}

/**
 * 2-Layer Joint Classifier:
 * Returns both the extracted topic and the classified intent.
 */
export function classifyTopicAndIntent(question, corpus, addendum = null) {
  const topic = resolveTopicFromQuestion(question, corpus, addendum);
  const intent = classifyIntent(question);

  return {
    topic,
    intent,
    isDefaultIntent: !INTENT_RULES.slice(0, -1).some(r => r.pattern.test(question))
  };
}
