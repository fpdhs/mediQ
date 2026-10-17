// Project-authored visit preparation, not derivative KDCA medical content.
export const VISIT_VERSION = 'visit-preparation-20261013-v2';
export const visitSchema = {type:'object',additionalProperties:false,required:['questions'],
  properties:{questions:{type:'array',minItems:1,maxItems:2,items:{type:'string',minLength:8,maxLength:160,pattern:'^[^\\n]{8,159}\\?$'}}}};
const guidance = Object.freeze({
  COMPARE:'이전 결과와 비교할 때 확인할 정보를 의료진에게 묻는다. 변화를 단정하지 않는다.',
  PREPARE:'다음 진료에서 확인할 정보나 가져갈 기록을 의료진에게 묻는다. 검사나 치료를 권하지 않는다.',
  UNDERSTAND:'선택한 검사에 관해 의료진에게 확인할 질문을 만든다. 검사 의미나 수치를 직접 설명하지 않는다.',
});

// Explicit, non-clinical topic allowlist for the generic visit-question route.
// These labels carry no result, diagnosis, or medical explanation to the model.
const visitTopicRules = Object.freeze([
  ['키', /키(?=\s*(?:$|에|는|를|와|의|검사|준비|비교|다음|진료|질문|설명))|신장\s*측정/u],
  ['체중', /체중|몸무게/u],
  ['허리둘레', /허리\s*둘레/u],
  ['체질량지수', /체질량지수|\bBMI\b/iu],
  ['혈압', /혈압/u],
  ['시력 · 좌 / 우', /시력/u],
  ['청력 · 좌 / 우', /청력/u],
  ['혈색소', /혈색소|헤모글로빈/u],
  ['공복혈당', /공복\s*혈당|혈당\s*검사/u],
  ['AST', /\bAST\b|간\s*효소\s*AST/iu],
  ['ALT', /\bALT\b|간\s*효소\s*ALT/iu],
  ['GGT', /\bGGT\b|\bGTP\b|γ\s*[-–]?\s*GTP|감마\s*지티피/iu],
  ['혈청 크레아티닌', /혈청\s*크레아티닌|크레아티닌/u],
  ['신장기능 eGFR', /\beGFR\b|사구체\s*여과율/iu],
  ['요단백', /요단백|소변\s*단백|단백뇨/u],
  ['총콜레스테롤', /총\s*콜레스테롤/u],
  ['HDL 콜레스테롤', /\bHDL\b/iu],
  ['LDL 콜레스테롤', /\bLDL\b/iu],
  ['중성지방', /중성지방|트리글리세리드/u],
  ['C형간염 항체', /C\s*형\s*간염\s*항체/iu],
  ['폐기능검사', /폐\s*기능\s*검사/u],
  ['흉부 방사선검사', /흉부.*(?:방사선|X\s*선|엑스선)/iu],
  ['구강검진', /구강\s*(?:검진|검사)/u],
  ['AFP', /\bAFP\b|알파\s*태아\s*단백/iu],
  ['간 초음파', /간\s*초음파|초음파/u],
  ['복부 CT', /복부\s*CT|\bCT\b|컴퓨터\s*단층/iu],
]);

function visitTopics(question) {
  if (typeof question !== 'string' || question.length > 600) return [];
  return visitTopicRules.filter(([, pattern]) => pattern.test(question)).map(([topic]) => topic);
}

export function retrieveVisitGuidance(question) {
  const topics = visitTopics(question);
  if (topics.length !== 1) return null;
  const [topic] = topics;
  const intent = /비교|이전|변화/u.test(question) ? 'COMPARE' : /준비|질문|다음|진료/u.test(question) ? 'PREPARE' : 'UNDERSTAND';
  return {topic,intent,evidence:[{id:`visit-${intent.toLowerCase()}`,text:guidance[intent],origin:'PROJECT_AUTHORED'}]};
}
export function validVisitInput(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'evidence,intent,topic') return false;
  const expected = retrieveVisitGuidance(`${value.topic} ${value.intent === 'COMPARE' ? '비교' : value.intent === 'PREPARE' ? '준비' : ''}`);
  return expected && JSON.stringify(expected) === JSON.stringify(value);
}
export function validateVisitQuestions(value) {
  if (!value || Object.keys(value).join(',') !== 'questions' || !Array.isArray(value.questions)
    || value.questions.length < 1 || value.questions.length > 2) throw new Error('VISIT_OUTPUT_REJECTED');
  const questions = value.questions.map(q => typeof q === 'string' ? q.trim() : '');
  if (questions.some(q => q.length < 8 || q.length > 160 || !/[?？]$/u.test(q)
    || /[<>\d\u0000-\u001f]|https?:|www\.|진단|암|처방|복용|수술|치료|약물|응급|정상|높|낮|증가|감소|위험/u.test(q)
    || !/확인|비교|준비|알려|물어|이해|살펴|기록/u.test(q))) throw new Error('VISIT_OUTPUT_REJECTED');
  return [...new Set(questions)];
}
