import { createHash } from 'node:crypto';

export const CORPUS_VERSION = 'health-ko-20261011-candidate-v3';
const reviewedAt = '2026-10-11';
export const AFP_SOURCE = Object.freeze({
  id: 'amc-afp-133', institution: '서울아산병원', title: '알파태아단백 검사 안내',
  url: 'https://www.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=133',
  sections: Object.freeze(['정의', '검사결과', '주의사항', '헬스팁']),
  checkedAt: reviewedAt, publishedAt: null, updatedAt: null,
  reuseStatus: 'NOT_CLEARED_FOR_RAG', contentReview: 'UNASSIGNED',
  licenseLabel: '기관 콘텐츠 제공 정책', licenseScope: 'SITE_POLICY_LINKED_FROM_ITEM',
  permissionEvidence: null,
  reusePolicyUrl: 'https://www.amc.seoul.kr/asan/custom/homepageinquiry/contentsInquiryRegistView.do',
  reuseNote: 'AFP 페이지에서 연결된 제공 안내의 재가공 제한 확인. 현재 RAG 재서술 용도는 승인하지 않음. 별도 허가 증거 없음.',
});
export const LIVER_SOURCE = Object.freeze({
  id: 'kdca-liver-5444', institution: '질병관리청 국가건강정보포털', title: '간기능검사',
  url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444',
  sections: Object.freeze(['요약문', '검사 항목', '검사 결과 해석']),
  checkedAt: reviewedAt, publishedAt: '2020-07-15', updatedAt: '2026-05-06',
  reuseStatus: 'NOT_CLEARED_FOR_RAG', contentReview: 'UNASSIGNED',
  licenseLabel: '공공누리 제4유형', licenseScope: 'ITEM_FOOTER',
  licenseTermsUrl: 'https://www.kogl.or.kr/info/licenseType4.do', permissionEvidence: null,
  reusePolicyUrl: 'https://health.kdca.go.kr/healthinfo/biz/health/portalUseGuidance/hlthinsReqst/hlthinsReqstMth.do?index=1',
  reuseNote: '간기능검사 개별 페이지 하단의 출처표시·상업적이용금지·변경금지 확인. 현재 RAG 재서술 용도는 승인하지 않음.',
});

// Only the named item's text is licensed here, not other pages, images or city branding.
export const REPLACEMENT_SOURCE = Object.freeze({
  id: 'uiwang-laboratory-0305', institution: '의왕시 보건소', title: '검사실',
  url: 'https://www.uiwang.go.kr/heal/UWHEAL0305',
  sections: Object.freeze(['검사종류 및 금액 · 간기능검사·생화학 11종']),
  checkedAt: reviewedAt, publishedAt: null, updatedAt: '2023-02-22',
  reuseStatus: 'CLEARED', contentReview: 'UNASSIGNED',
  licenseLabel: '공공누리 제1유형', licenseScope: 'ITEM_FOOTER',
  licenseTermsUrl: 'https://www.kogl.or.kr/info/licenseType1.do',
  permissionEvidence: Object.freeze({ type: 'PUBLIC_LICENSE', checkedAt: reviewedAt,
    url: 'https://www.uiwang.go.kr/heal/UWHEAL0305', locator: '컨텐츠 라이센스 · 제1유형 출처표시' }),
  attribution: '의왕시청·의왕시 보건소, 검사실(최종수정 2023-02-22), 공공누리 제1유형. 검사 종류 안내 일부를 프로젝트에서 재서술함.',
  reuseNote: '출처 링크 및 변경 표시 필요. 기관 후원·인증을 주장하지 않음. 검사 종류 안내에 한정하며 개인 결과 해석·현재 검사비·검사 주기 근거로 사용하지 않음.',
});

// Candidate paraphrases only: neither public availability nor source authority grants reuse clearance.
const drafts = [
  ['afp-definition', AFP_SOURCE.id, ['AFP'], 'DEFINITION', '정의', 'AFP는 혈액에서 측정하는 단백질이다. 성인의 간 손상 등 여러 상황에서 증가할 수 있다.'],
  ['afp-reference', AFP_SOURCE.id, ['AFP'], 'REFERENCE', '검사결과', 'AFP 참고범위는 검사 방법과 기관에 따라 다를 수 있다. 해당 결과지의 참고범위를 확인한다.'],
  ['afp-limits', AFP_SOURCE.id, ['AFP'], 'LIMITS', '주의사항·헬스팁', 'AFP 결과만으로 질환을 확정하지 않는다. 의료진이 다른 검사와 임상 상황을 함께 살핀다.'],
  ['liver-overview', LIVER_SOURCE.id, ['LIVER', 'AST', 'ALT', 'GGT'], 'DEFINITION', '요약문', '간기능검사에는 간세포 손상과 담도 상태 등 서로 다른 측면을 살피는 항목이 포함된다.'],
  ['liver-reference', LIVER_SOURCE.id, ['LIVER', 'AST', 'ALT', 'GGT'], 'REFERENCE', '검사 결과 해석', '검사실에 따라 참고범위가 달라질 수 있어 해당 검사기관의 기준을 우선 확인한다.'],
  ['liver-limits', LIVER_SOURCE.id, ['LIVER', 'AST', 'ALT', 'GGT'], 'LIMITS', '검사 결과 해석', '개별 간기능 수치만으로 질환을 판단하지 않는다. 다른 장기의 상태와 임상 상황도 함께 고려한다.'],
  ['ast-alt-role', LIVER_SOURCE.id, ['AST', 'ALT'], 'DEFINITION', '검사 결과 해석 · 1) 아미노기 전달 효소', 'AST와 ALT는 간세포 손상을 살피는 효소 검사다. AST는 근육 등 간 이외의 조직에도 존재한다.'],
  ['ggt-role', LIVER_SOURCE.id, ['GGT'], 'DEFINITION', '검사 결과 해석 · 4) 감마 글루타밀 전이 효소', 'GGT는 간과 담도 상태를 살피는 검사에 쓰인다. 증가 원인은 다양하므로 다른 정보와 함께 해석한다.'],
  ['liver-test-list', REPLACEMENT_SOURCE.id, ['LIVER'], 'DEFINITION', '검사종류 및 금액 · 간기능검사·생화학 11종', '의왕시 보건소의 검사 안내에는 간기능검사가 제시되어 있다. 생화학 검사 묶음에는 간기능 외에 혈당, 신장기능, 콜레스테롤 관련 검사도 포함되어 있다.'],
];
// Pinned to the candidate text compared with the official page on 2026-10-11.
// This is an agent source-concordance check, NOT permission or independent clinical approval.
const comparedTextHashes = Object.freeze({
  'afp-definition': '48104d99e9cea4ddafa93ae7ed22c3059f012e967e55f4876efdfa25f3aeb05b',
  'afp-reference': 'f2a4c08a48daccb1a0d32e6b82dbe37bdd32ab50c5e0bd71283e4cc64ddb7b94',
  'afp-limits': 'a085d5a297692c03ab18a2edb795b6f590ae8dd0ec53fabc443b07b690ddcd66',
  'liver-overview': '016e4fcd15bad412239a1580092b74a34b58e87a64e8d0692f46805ca1331e40',
  'liver-reference': 'b087d27087d9944f4000bb999edfdbf72111b11d4d3f01616c9bcc54aded66cd',
  'liver-limits': '6ea3177f7d1e18ea6f895766138d24be5d42c2b185c1f635d0526347c135fbb9',
  'ast-alt-role': 'ad35b8fb7c153257746af70dfef8cde2d055c0b38d337c04b4609973c0849a99',
  'ggt-role': '5272531319c70bf4a063da2fbf30d047b9e2a37d7d39f1e2c42a897a7912d8b8',
  'liver-test-list': 'd5a11e4d178e7b0f8b2c8990349656aa3f4f8dca1afb5defaf652d95d954bfc1',
});
const chunks = drafts.map(([id, sourceId, topics, intent, section, text]) => Object.freeze({
  id, sourceId, topics: Object.freeze(topics), intent, section, text,
  conditions: sourceId === REPLACEMENT_SOURCE.id
    ? '해당 보건소의 검사 목록 설명만 지원. AST·ALT·AFP의 의미·참고범위·해석 한계는 지원하지 않음.'
    : '일반 성인 검사 설명 후보. 검사기관의 참고범위와 임상 맥락 필요.',
  ...(sourceId === REPLACEMENT_SOURCE.id ? { supportedIntents: Object.freeze(['DEFINITION']) } : {}),
  limitations: '개인 수치 평가·진단·처방·검사 주기 결정에 사용하지 않음.',
  contentReview: 'UNASSIGNED', version: CORPUS_VERSION,
  sourceComparison: Object.freeze({ status: 'MATCHED_TO_SOURCE', reviewerType: 'AGENT',
    checkedAt: reviewedAt, comparedTextSha256: comparedTextHashes[id] }),
  // Hash identifies our candidate text, NOT the original institution's page or its approval.
  candidateTextSha256: createHash('sha256').update(text, 'utf8').digest('hex'),
}));
export const HELPER_CORPUS = Object.freeze({ version: CORPUS_VERSION,
  reviewStatus: 'DRAFT / UNASSIGNED', sources: Object.freeze([AFP_SOURCE, LIVER_SOURCE, REPLACEMENT_SOURCE]),
  chunks: Object.freeze(chunks) });

const topicRules = [
  ['AFP', /\bafp\b|알파\s*태아\s*단백/iu], ['AST', /\bast\b|\bsgot\b/iu],
  ['ALT', /\balt\b|\bsgpt\b/iu], ['GGT', /\bggt\b|\bgtp\b|감마|γ\s*gtp/iu],
  ['LIVER', /간\s*기능|간\s*수치/u],
];
export function helperTopics(question) {
  if (typeof question !== 'string' || question.length > 600) return [];
  return topicRules.filter(([, pattern]) => pattern.test(question)).map(([topic]) => topic);
}

// Bibliographic link index only: no copied medical text, embeddings or derivative summaries.
export const KDCA_LINK_INDEX_VERSION = 'kdca-links-20261011-v1';
export const KDCA_LINK_INDEX = Object.freeze([
  Object.freeze({ id: LIVER_SOURCE.id, institution: LIVER_SOURCE.institution, title: LIVER_SOURCE.title,
    url: LIVER_SOURCE.url, publishedAt: LIVER_SOURCE.publishedAt, updatedAt: LIVER_SOURCE.updatedAt,
    checkedAt: reviewedAt, section: '검사 항목 · 검사 결과 해석',
    topics: Object.freeze(['LIVER', 'AST', 'ALT', 'GGT']),
    licenseLabel: '공공누리 제4유형 · 출처표시·상업적이용금지·변경금지',
    licenseTermsUrl: 'https://www.kogl.or.kr/info/licenseType4.do', useMode: 'LINK_ONLY' }),
  Object.freeze({ id: 'kdca-cirrhosis-6560', institution: '질병관리청 국가건강정보포털', title: '간경변증',
    url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6560',
    publishedAt: '2024-07-30', updatedAt: '2026-06-08', checkedAt: reviewedAt,
    section: '정기 진찰 · AFP 언급 위치', topics: Object.freeze(['AFP']),
    contextNote: '간경변증 환자의 정기 진찰 맥락입니다. AFP 전용 설명이나 본인 진단·검사 주기 안내가 아닙니다.',
    licenseLabel: '공공누리 제4유형 · 출처표시·상업적이용금지·변경금지',
    licenseTermsUrl: 'https://www.kogl.or.kr/info/licenseType4.do', useMode: 'LINK_ONLY' }),
]);
export function retrieveKdcaLinks(question) {
  const topics = helperTopics(question);
  return KDCA_LINK_INDEX.filter(source => source.topics.some(topic => topics.includes(topic)))
    .slice(0, 3).map(source => ({ ...source, topics: [...source.topics] }));
}
export function retrieveHelperEvidence(question, corpus = HELPER_CORPUS) {
  const topics = helperTopics(question);
  if (!topics.length) return [];
  const sources = new Map(corpus.sources.map(source => [source.id, source]));
  const intent = /범위|정상|기준/u.test(question) ? 'REFERENCE' : /한계|단독|확정/u.test(question) ? 'LIMITS' : 'DEFINITION';
  return corpus.chunks.filter(chunk => {
    const source = sources.get(chunk.sourceId);
    return isClearedHelperSource(source)
      && chunk.contentReview === 'APPROVED' && isReviewedChunk(chunk)
      && (!chunk.supportedIntents || chunk.supportedIntents.includes(intent))
      && chunk.topics.some(topic => topics.includes(topic));
  }).map((chunk, index) => ({ chunk, index, rank: Number(chunk.intent === intent) }))
    .sort((a, b) => b.rank - a.rank || a.index - b.index).slice(0, 6)
    .map(({ chunk }) => ({ ...chunk, topics: [...chunk.topics] }));
}

// Approval flags alone are not a permission record. The record must identify
// an item-specific licence or written permission; this is not a legal validator.
export function isClearedHelperSource(source) {
  const proof = source?.permissionEvidence;
  if (source?.reuseStatus !== 'CLEARED' || source.contentReview !== 'APPROVED'
    || !['PUBLIC_LICENSE', 'WRITTEN_PERMISSION'].includes(proof?.type)
    || !/^\d{4}-\d{2}-\d{2}$/.test(proof?.checkedAt ?? '')
    || typeof proof?.locator !== 'string' || !proof.locator.trim()) return false;
  try {
    const url = new URL(proof.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

export function isReviewedChunk(chunk) {
  return typeof chunk.text === 'string' && chunk.text.length > 0 && chunk.text.length <= 1400
    && typeof chunk.approvedTextSha256 === 'string'
    && chunk.approvedTextSha256 === chunk.candidateTextSha256
    && createHash('sha256').update(chunk.text, 'utf8').digest('hex') === chunk.approvedTextSha256;
}

export function canonicalHelperTopic(evidence) {
  const topics = [...new Set(evidence.flatMap(chunk => chunk.topics))];
  const labels = { AFP: 'AFP', LIVER: '간기능', AST: 'AST', ALT: 'ALT', GGT: 'GGT' };
  return topics.filter(topic => Object.hasOwn(labels, topic)).map(topic => labels[topic]).join('·')
    + ' 검사의 일반 설명과 해석 한계 및 다음 진료 질문';
}
