import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchScreeningGlossary, isClinicalDiagnosisRequest, HEALTH_SCREENING_GLOSSARY } from '../src/health-helper-glossary-interceptor.js';

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

test('Screening Glossary: matches Major Liver Diseases (Cirrhosis, Liver Cancer, Fatty Liver)', () => {
  const cirrhosisQueries = ['간경화', '간경화란?', '간경화가 뭐야?', '간경변증', '간경변증이란', '간경변증에 대해 알려주세요', '간경화에 대해서 알려달라'];
  for (const q of cirrhosisQueries) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'cirrhosis');
    assert.match(res.response.answer, /간경변증/);
    assert.ok(res.response.questions.length >= 2);
  }

  const cancerQueries = ['간암', '간암이란?', '간암이 뭐야?', '간세포암', '간세포암이란 무엇인가요?', 'HCC', '간 종양'];
  for (const q of cancerQueries) {
    const res = matchScreeningGlossary(q);
    assert.ok(res, `Expected match for: ${q}`);
    assert.equal(res.item.id, 'liver-cancer');
    assert.match(res.response.answer, /간세포암/);
    assert.ok(res.response.questions.length >= 2);
  }

  assert.equal(matchScreeningGlossary('지방간')?.item.id, 'fatty-liver');
  assert.equal(matchScreeningGlossary('지방간이란?')?.item.id, 'fatty-liver');
  assert.equal(matchScreeningGlossary('만성 간염')?.item.id, 'chronic-hepatitis');
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
    '간경화 완치 약 알려줘'
  ];

  for (const q of unsafeQueries) {
    assert.ok(isClinicalDiagnosisRequest(q), `Expected unsafe classification for: ${q}`);
    const res = matchScreeningGlossary(q);
    assert.equal(res, null, `Unsafe query must not be intercepted: ${q}`);
  }
});

