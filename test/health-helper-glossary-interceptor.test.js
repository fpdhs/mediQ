import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  matchScreeningGlossary,
  isClinicalDiagnosisRequest,
  isEmergencyRequest,
  HEALTH_SCREENING_GLOSSARY
} from '../src/health-helper-glossary-interceptor.js';

test('Screening Glossary: matches AFP and Korean aliases', () => {
  const queries = ['afp', 'AFP', 'afp가 뭐야?', '알파태아단백', '혈청 afp', 'AFP 검사 목적'];
  for (const q of queries) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for query: ${q}`);
    assert.equal(res.item.id, 'afp');
    assert.match(res.response.answer, /알파태아단백/);
    assert.ok(res.response.questions.length >= 2);
    assert.ok(res.response.sources.length >= 1);
  }
});

test('Screening Glossary: matches Liver Ultrasound and Chest CT', () => {
  const usQueries = ['간 초음파', '간초음파', '상복부 초음파', '초음파 검사'];
  for (const q of usQueries) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for query: ${q}`);
    assert.equal(res.item.id, 'liver-ultrasound');
  }

  const ctQueries = ['흉부 CT', '가슴 CT', 'CT', '컴퓨터단층촬영'];
  for (const q of ctQueries) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for query: ${q}`);
    assert.equal(res.item.id, 'chest-ct');
  }
});

test('Screening Glossary: matches Liver Enzymes (AST, ALT, GGT)', () => {
  for (const q of ['ast', 'ALT', '간 효소', '간기능 검사']) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'ast-alt');
  }

  for (const q of ['감마지티피', 'GGT', '감마 GTP']) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'gamma-gtp');
  }
});

test('Screening Glossary: matches Diabetes & Metabolism (Glucose, HbA1c, Lipids)', () => {
  for (const q of ['공복혈당', 'FBS', '혈당']) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'blood-glucose');
  }

  for (const q of ['당화혈색소', 'HbA1c', 'A1C']) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'hba1c');
  }

  for (const q of ['콜레스테롤', 'HDL 콜레스테롤', 'LDL', '중성지방']) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'lipid-panel');
  }
});

test('Screening Glossary: matches Kidney, Urinalysis, Hemoglobin, Vitals', () => {
  assert.equal(matchScreeningGlossary('크레아티닌')?.item.id, 'kidney-function');
  assert.equal(matchScreeningGlossary('eGFR')?.item.id, 'kidney-function');
  assert.equal(matchScreeningGlossary('요단백')?.item.id, 'urinalysis-protein');
  assert.equal(matchScreeningGlossary('혈색소')?.item.id, 'hemoglobin-anemia');
  assert.equal(matchScreeningGlossary('혈압')?.item.id, 'blood-pressure');
  assert.equal(matchScreeningGlossary('BMI')?.item.id, 'bmi-body-metrics');
  assert.equal(matchScreeningGlossary('폐기능검사')?.item.id, 'pulmonary-function');
});

test('Screening Glossary: matches 30 Major Diseases across all clinical groups', () => {
  // 1. Major 6 Cancers
  const cancers = [
    { query: '간암', id: 'liver-cancer' },
    { query: '위암', id: 'gastric-cancer' },
    { query: '위암이란?', id: 'gastric-cancer' },
    { query: '대장암', id: 'colorectal-cancer' },
    { query: '폐암', id: 'lung-cancer' },
    { query: '유방암', id: 'breast-cancer' },
    { query: '자궁경부암', id: 'cervical-cancer' }
  ];
  for (const { query, id } of cancers) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for cancer: ${query}`);
    assert.equal(res.item.id, id);
    assert.match(res.response.answer, /국립암정보센터|가이드라인/);
  }

  // 2. Cardio & Cerebrovascular Diseases
  const cardio = [
    { query: '고혈압', id: 'hypertension' },
    { query: '고혈압이란 무엇인가요?', id: 'hypertension' },
    { query: '협심증', id: 'angina' },
    { query: '심근경색', id: 'myocardial-infarction' },
    { query: '뇌경색', id: 'cerebral-infarction' },
    { query: '뇌출혈', id: 'cerebral-hemorrhage' }
  ];
  for (const { query, id } of cardio) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for cardio: ${query}`);
    assert.equal(res.item.id, id);
  }

  // 3. Metabolic & Endocrine Diseases
  const metabolic = [
    { query: '당뇨병', id: 'diabetes' },
    { query: '이상지질혈증', id: 'dyslipidemia' },
    { query: '고지혈증이란', id: 'dyslipidemia' },
    { query: '대사증후군', id: 'metabolic-syndrome' },
    { query: '통풍', id: 'gout' },
    { query: '갑상선 질환', id: 'thyroid-disorders' }
  ];
  for (const { query, id } of metabolic) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for metabolic: ${query}`);
    assert.equal(res.item.id, id);
  }

  // 4. Hepato-biliary & Gastrointestinal
  const gi = [
    { query: '간경변증', id: 'cirrhosis' },
    { query: '간경화에 대해서 알려달라', id: 'cirrhosis' },
    { query: '지방간', id: 'fatty-liver' },
    { query: '만성 간염', id: 'chronic-hepatitis' },
    { query: '역류성 식도염', id: 'gerd' },
    { query: '담석증', id: 'cholelithiasis' },
    { query: '췌장염', id: 'pancreatitis' }
  ];
  for (const { query, id } of gi) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for GI: ${query}`);
    assert.equal(res.item.id, id);
  }

  // 5. Respiratory
  const resp = [
    { query: 'COPD', id: 'copd' },
    { query: '천식', id: 'asthma' },
    { query: '폐렴', id: 'pneumonia' }
  ];
  for (const { query, id } of resp) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for respiratory: ${query}`);
    assert.equal(res.item.id, id);
  }

  // 6. Kidney & Urology
  const renal = [
    { query: '만성콩팥병', id: 'ckd' },
    { query: '단백뇨', id: 'proteinuria' },
    { query: '요로결석', id: 'urolithiasis' }
  ];
  for (const { query, id } of renal) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for renal: ${query}`);
    assert.equal(res.item.id, id);
  }

  // 7. Degenerative & Neurological
  const degen = [
    { query: '골다공증', id: 'osteoporosis' },
    { query: '퇴행성관절염', id: 'osteoarthritis' },
    { query: '치매', id: 'dementia' }
  ];
  for (const { query, id } of degen) {
    const res = matchScreeningGlossary(query);
    assert.ok(res, `Missing match for degenerative: ${query}`);
    assert.equal(res.item.id, id);
  }
});

test('Emergency Triage Gate: red flag symptoms trigger immediate 119 escalation', () => {
  const redFlags = [
    '가슴이 쥐어짜듯 아파요',
    '가슴에 극심한 흉통이 있어요',
    '숨이 너무 차고 안 쉬어져요',
    '갑자기 한쪽 팔다리가 마비되었어요',
    '말이 어눌해지고 입이 돌아갔어요',
    '환자가 갑자기 의식을 잃고 쓰러졌어요',
    '피를 토해요 (토혈)'
  ];

  for (const q of redFlags) {
    assert.ok(isEmergencyRequest(q), `Expected emergency detection for: ${q}`);
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected emergency intercept for: ${q}`);
    assert.equal(res.response.status, 'RETRIEVED');
    assert.equal(res.response.category, '응급 안내');
    assert.match(res.response.answer, /119/);
    assert.match(res.response.answer, /골든타임/);
  }
});

test('Safety Guardrail: clinical diagnosis or cancer queries are NOT intercepted', () => {
  const unsafeQueries = [
    'afp 수치가 15인데 암인가요?',
    '간암 진단해줘',
    '수치가 높은데 암인가',
    '확진 판정인가요?',
    '약 처방해줘',
    '나 간암인가요?',
    '간경화에 무슨 약을 먹어야 하나요?',
    '간암 3기 생존율은 어떻게 되나요?',
    '간경화 완치 약 알려줘',
    '당뇨 완치약 추천해줘',
    '고혈압 약 복용 용량 알려줘',
    '위암 몇 기인가요?'
  ];

  for (const q of unsafeQueries) {
    assert.ok(isClinicalDiagnosisRequest(q), `Expected unsafe classification for: ${q}`);
    const res = matchScreeningGlossary(q);
    assert.equal(res, null, `Unsafe query must not be intercepted: ${q}`);
  }
});
