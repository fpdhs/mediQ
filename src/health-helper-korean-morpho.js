// Pure JS lightweight Korean morphological & phonological analyzer for medical RAG.
// Decomposes Hangul syllables into jamo, determines batchim (final consonants),
// and separates noun stems from particles/endings based on phonological rules.

const HANGUL_BASE = 0xAC00;
const HANGUL_END = 0xD7A3;
const CHOSUNG_BASE = 588; // 21 * 28
const JUNGSUNG_BASE = 28;

const CHOSUNG = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const JUNGSUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

const JONGSUNG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/**
 * Decomposes a Hangul syllable into its constituent Jamo.
 * Returns null if not a precomposed Hangul syllable.
 */
export function decomposeHangul(char) {
  if (typeof char !== 'string' || char.length === 0) return null;
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_END) return null;

  const offset = code - HANGUL_BASE;
  const initialIndex = Math.floor(offset / CHOSUNG_BASE);
  const medialIndex = Math.floor((offset % CHOSUNG_BASE) / JUNGSUNG_BASE);
  const finalIndex = offset % JUNGSUNG_BASE;

  return {
    initial: CHOSUNG[initialIndex],
    medial: JUNGSUNG[medialIndex],
    final: JONGSUNG[finalIndex],
    hasFinal: finalIndex > 0,
    initialIndex,
    medialIndex,
    finalIndex,
  };
}

/**
 * Checks whether the character has a final consonant (받침).
 * Non-Hangul characters return false.
 */
export function hasBatchim(char) {
  const decomposed = decomposeHangul(char);
  return decomposed !== null && decomposed.hasFinal;
}

// Complex multi-syllable particles & postpositional phrases
const COMPOUND_PARTICLES = [
  '에대해서는', '에대해서', '에대해선', '에대하여', '에대해',
  '에관해서는', '에관해서', '에관해선', '에관하여', '에관해',
  '이라는것은', '이라는것', '이라는건', '이라는', '이라고는', '이라고',
  '이라는점', '이란것은', '이란것', '이란건',
  '에게서는', '에게서', '에게는', '으로는', '으로부터', '이라면', '이라도',
  '에서는', '에서도', '에서의', '에의'
];

// Standalone postpositional markers
const STANDALONE_POSTPOSITIONS = new Set([
  '대해서는', '대해서', '대해선', '대하여', '대해',
  '관해서는', '관해서', '관해선', '관하여', '관해',
  '관련해서는', '관련해서', '관련하여', '관련해'
]);

// Single / double syllable particles categorized by phonological constraints
const PARTICLES = [
  { text: '이란', phonology: 'BATCHIM_REQUIRED' },
  { text: '란', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '이라', phonology: 'BATCHIM_REQUIRED' },
  { text: '라는', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '이랑', phonology: 'BATCHIM_REQUIRED' },
  { text: '랑', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '으로', phonology: 'BATCHIM_EXCEPT_RIEUL' },
  { text: '로', phonology: 'NO_BATCHIM_OR_RIEUL' },
  { text: '은', phonology: 'BATCHIM_REQUIRED' },
  { text: '는', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '이', phonology: 'BATCHIM_REQUIRED' },
  { text: '가', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '을', phonology: 'BATCHIM_REQUIRED' },
  { text: '를', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '과', phonology: 'BATCHIM_REQUIRED' },
  { text: '와', phonology: 'NO_BATCHIM_REQUIRED' },
  { text: '에서', phonology: 'ANY' },
  { text: '에게', phonology: 'ANY' },
  { text: '한테', phonology: 'ANY' },
  { text: '부터', phonology: 'ANY' },
  { text: '까지', phonology: 'ANY' },
  { text: '처럼', phonology: 'ANY' },
  { text: '보다', phonology: 'ANY' },
  { text: '마다', phonology: 'ANY' },
  { text: '에는', phonology: 'ANY' },
  { text: '에도', phonology: 'ANY' },
  { text: '의', phonology: 'ANY' },
  { text: '에', phonology: 'ANY' },
  { text: '도', phonology: 'ANY' },
  { text: '만', phonology: 'ANY' }
];

// Conversational endings / request verbs / question verbs
const CONVERSATIONAL_ENDINGS = [
  '무엇인가요', '무엇입니까', '무엇인가', '무엇인지요', '무엇인지',
  '뭐인가요', '뭔가요', '뭔지요', '뭔지', '뭐예요', '뭐야', '무엇', '뭐',
  '알려주실래요', '알려주시기바랍니다', '알려주세요', '알려줘요', '알려줘', '알려달라',
  '설명해주실래요', '설명부탁드립니다', '설명부탁드려요', '설명해주세요', '설명해줘요', '설명해줘', '설명해',
  '궁금합니다', '궁금해요', '궁금해',
  '인가요', '일까요', '습니까', '합니다', '됩니다', '해요', '해주세요', '해줘요'
];

const STANDALONE_CONVERSATIONAL_VERBS = new Set([
  '알려주실래요', '알려주시기바랍니다', '알려주세요', '알려줘요', '알려줘', '알려달라',
  '설명해주실래요', '설명부탁드립니다', '설명부탁드려요', '설명해주세요', '설명해줘요', '설명해줘', '설명해',
  '궁금합니다', '궁금해요', '궁금해',
  '무엇인가요', '무엇입니까', '무엇인가', '무엇인지요', '무엇인지',
  '뭐인가요', '뭔가요', '뭔지요', '뭔지', '뭐예요', '뭐야', '무엇', '뭐',
  '어떤가요', '어떨까요', '어떤지', '어떤'
]);

/**
 * Phonologically validates whether a particle can attach to the given stem character.
 */
function checkPhonology(lastChar, phonology) {
  if (!lastChar) return false;
  if (/[a-zA-Z0-9]/.test(lastChar)) return true;

  const decomposed = decomposeHangul(lastChar);
  if (!decomposed) return true;

  const hasF = decomposed.hasFinal;
  const isRieul = decomposed.final === 'ㄹ';

  switch (phonology) {
    case 'BATCHIM_REQUIRED':
      return hasF;
    case 'NO_BATCHIM_REQUIRED':
      return !hasF;
    case 'BATCHIM_EXCEPT_RIEUL':
      return hasF && !isRieul;
    case 'NO_BATCHIM_OR_RIEUL':
      return !hasF || isRieul;
    case 'ANY':
    default:
      return true;
  }
}

/**
 * Strips known conversational verbal endings from an eojeol or clause.
 */
export function stripConversationalEnding(token) {
  if (typeof token !== 'string') return { stem: '', ending: null };
  const trimmed = token.trim();
  for (const ending of CONVERSATIONAL_ENDINGS) {
    if (trimmed.length > ending.length && trimmed.endsWith(ending)) {
      return {
        stem: trimmed.slice(0, -ending.length).trim(),
        ending
      };
    }
  }
  return { stem: trimmed, ending: null };
}

/**
 * Separates a single eojeol (word) into its noun stem and attached particles.
 */
export function separateStemAndParticles(token) {
  if (typeof token !== 'string' || !token.trim()) {
    return { stem: '', particle: null, type: 'EMPTY', isSeparated: false };
  }

  const rawTrimmed = token.trim().replace(/[?!.,~·;:]+$/gu, '');
  if (!rawTrimmed) return { stem: '', particle: null, type: 'PUNCTUATION', isSeparated: false };

  // 1. Check if token itself is a standalone postposition (e.g. '대해서', '관하여')
  if (STANDALONE_POSTPOSITIONS.has(rawTrimmed)) {
    return { stem: '', particle: rawTrimmed, type: 'POSTPOSITION', isSeparated: true };
  }

  // 2. Check if token itself is a standalone conversational verb (e.g. '알려줘', '궁금해')
  if (STANDALONE_CONVERSATIONAL_VERBS.has(rawTrimmed)) {
    return { stem: '', particle: rawTrimmed, type: 'INTENT_VERB', isSeparated: true };
  }

  // 3. Check compound particles first
  for (const compound of COMPOUND_PARTICLES) {
    if (rawTrimmed.length > compound.length && rawTrimmed.endsWith(compound)) {
      const stem = rawTrimmed.slice(0, -compound.length).trim();
      if (stem.length > 0) {
        return { stem, particle: compound, type: 'NOUN', isCompound: true, isSeparated: true };
      }
    }
  }

  // 4. Check conversational verbal endings attached to stems
  const endingCheck = stripConversationalEnding(rawTrimmed);
  if (endingCheck.ending && endingCheck.stem.length > 0) {
    const sub = separateStemAndParticles(endingCheck.stem);
    return {
      stem: sub.stem || endingCheck.stem,
      particle: [sub.particle, endingCheck.ending].filter(Boolean).join(' '),
      type: 'NOUN',
      isSeparated: true
    };
  }

  // 5. Check phonologically governed single/double syllable particles
  for (const { text, phonology } of PARTICLES) {
    if (rawTrimmed.length > text.length && rawTrimmed.endsWith(text)) {
      const candidateStem = rawTrimmed.slice(0, -text.length);
      const lastChar = candidateStem.slice(-1);
      if (checkPhonology(lastChar, phonology)) {
        return { stem: candidateStem, particle: text, type: 'NOUN', isSeparated: true };
      }
    }
  }

  return { stem: rawTrimmed, particle: null, type: 'NOUN', isSeparated: false };
}

/**
 * Performs full morphological analysis on a Korean sentence or query.
 */
export function morphoAnalyze(text) {
  if (typeof text !== 'string') {
    return { raw: '', tokens: [], stems: [], particles: [], nounCandidates: [] };
  }

  const raw = text.normalize('NFC').trim();
  const rawWords = raw.split(/\s+/).filter(Boolean);
  const tokens = [];
  const stems = [];
  const particles = [];

  for (const word of rawWords) {
    const separated = separateStemAndParticles(word);
    tokens.push(separated);
    if (separated.stem && separated.type === 'NOUN') {
      stems.push(separated.stem);
    }
    if (separated.particle) {
      particles.push(separated.particle);
    }
  }

  // Extract N-gram noun phrase candidates (1-gram, 2-gram, 3-gram) from noun stems
  const nounCandidates = extractNgramStems(stems);

  return {
    raw,
    tokens,
    stems,
    particles,
    nounCandidates
  };
}

/**
 * Extracts contiguous n-grams (up to length 3) from stem tokens
 */
export function extractNgramStems(stems, maxN = 3) {
  if (!Array.isArray(stems) || !stems.length) return [];
  const results = [];
  const n = stems.length;

  for (let len = Math.min(maxN, n); len >= 1; len--) {
    for (let i = 0; i <= n - len; i++) {
      const phrase = stems.slice(i, i + len).join(' ');
      if (phrase.trim()) results.push(phrase.trim());
    }
  }

  return [...new Set(results)];
}
