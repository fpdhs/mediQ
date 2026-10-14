// Patient-facing Korean text refinement for medical RAG responses.
// Polishes direct-translation idioms, standardizes Fahrenheit units to Celsius,
// and normalizes clinical dialogue instructions without mutating underlying corpus hashes.

const UNIT_CONVERSIONS = [
  { regex: /102를\s*넘는\s*열/gu, replacement: '38.9°C(화씨 102°F)를 넘는 고열' },
  { regex: /100\.4를\s*넘는\s*열/gu, replacement: '38.0°C(화씨 100.4°F)를 넘는 발열' },
  { regex: /(?<!섭씨\s*|°C\s*|\()\b102\s*도\b/gu, replacement: '38.9°C(화씨 102°F)' },
  { regex: /(?<!섭씨\s*|°C\s*|\()\b100\.4\s*도\b/gu, replacement: '38.0°C(화씨 100.4°F)' },
  { regex: /(?<!섭씨\s*|°C\s*|\()\b104\s*도\b/gu, replacement: '40.0°C(화씨 104°F)' },
];

const GLOSSARY_REPLACEMENTS = [
  // 2nd person pronouns
  { regex: /누군가\s*당신이\s*보지\s*않는\s*사이에/gu, replacement: '주의를 기울이지 않는 사이에' },
  { regex: /누군가\s*당신\s*모르게/gu, replacement: '본인도 모르는 사이에' },
  { regex: /당신의\s*몸/gu, replacement: '신체' },
  { regex: /당신의\s*피/gu, replacement: '혈액' },
  { regex: /당신의\s*건강/gu, replacement: '건강' },
  { regex: /당신의\s*의사/gu, replacement: '담당 의사' },
  { regex: /\b당신이\b/gu, replacement: '환자분이' },
  { regex: /\b당신의\b/gu, replacement: '본인의' },
  { regex: /\b당신에게\b/gu, replacement: '환자분에게' },
  { regex: /\b당신을\b/gu, replacement: '환자분을' },

  // Clinical consultation idioms
  { regex: /의사와\s*이야기하(?:세요|십시오)/gu, replacement: '의료진과 상담하세요' },
  { regex: /의료진과\s*이야기하(?:세요|십시오)/gu, replacement: '의료진과 상담하세요' },
  { regex: /주치의와\s*이야기하(?:세요|십시오)/gu, replacement: '주치의와 상의하세요' },
  { regex: /의사와\s*이야기하기\s*(?:어려워|힘들어)/gu, replacement: '의사에게 털어놓거나 상담하기 어려워' },

  // Healthcare provider literal translation
  { regex: /건강\s*관리\s*제공자/gu, replacement: '담당 의료진' },
  { regex: /의료\s*제공자들이/gu, replacement: '참여 의료진과 기관들이' },
  { regex: /의료\s*제공자\s*조직/gu, replacement: '의료기관 조직' },
  { regex: /우선의료제공자조직/gu, replacement: '우선의료기관조직' },
  { regex: /의료\s*제공자가/gu, replacement: '의료진이' },
  { regex: /의료\s*제공자는/gu, replacement: '의료진은' },
  { regex: /의료\s*제공자를/gu, replacement: '의료진을' },
  { regex: /의료\s*제공자의/gu, replacement: '의료진의' },
  { regex: /의료\s*제공자에게/gu, replacement: '의료진에게' },
  { regex: /의료\s*제공자/gu, replacement: '의료진' },

  // Possessive repetitions in pediatric contexts
  { regex: /아이의\s*의료진은/gu, replacement: '소아청소년과 의료진은' },
  { regex: /아이의\s*의료진과/gu, replacement: '담당 의료진과' },
  { regex: /아이의\s*의료진이/gu, replacement: '의료진이' },
  { regex: /아기의\s*의료진이/gu, replacement: '소아과 의료진이' },
  { regex: /아기의\s*의사는/gu, replacement: '담당 의사는' },

  // Disease possession literal
  { regex: /가벼운\s*형태의\s*질환을\s*가지고\s*있어/gu, replacement: '가벼운 형태의 질환이 있어' },
  { regex: /폐질환을\s*가지고\s*있습니다/gu, replacement: '폐질환을 앓고 있습니다' },
];

export function refinePatientMedicalKorean(text) {
  if (typeof text !== 'string' || !text.trim()) return text;
  let refined = text;

  for (const {regex, replacement} of UNIT_CONVERSIONS) {
    refined = refined.replace(regex, replacement);
  }

  for (const {regex, replacement} of GLOSSARY_REPLACEMENTS) {
    refined = refined.replace(regex, replacement);
  }

  return refined;
}
