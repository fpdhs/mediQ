import test from 'node:test';
import assert from 'node:assert/strict';
import {refinePatientMedicalKorean} from '../src/health-helper-korean-refinement.js';

test('refinePatientMedicalKorean standardizes Fahrenheit body temperature with Celsius conversion', () => {
  const original = '102를 넘는 열이 있다면 즉시 의사에게 연락하세요.';
  const refined = refinePatientMedicalKorean(original);
  assert.match(refined, /38\.9°C\(화씨 102°F\)를 넘는 고열/u);
  assert.doesNotMatch(refined, /102를 넘는 열/u);

  const fever100 = '아기에게 100.4를 넘는 열이 있는 경우';
  assert.match(refinePatientMedicalKorean(fever100), /38\.0°C\(화씨 100\.4°F\)를 넘는 발열/u);
});

test('refinePatientMedicalKorean naturalizes 2nd person pronouns and colloquial possessives', () => {
  const clubDrugs = '누군가 당신이 보지 않는 사이에 음료에 이런 물질을 넣을 수 있습니다. 또는 누군가 당신 모르게 그 효과를 더 강하게 만들 수도 있습니다.';
  const refined = refinePatientMedicalKorean(clubDrugs);
  assert.match(refined, /주의를 기울이지 않는 사이에/u);
  assert.match(refined, /본인도 모르는 사이에/u);
  assert.doesNotMatch(refined, /당신이/u);
  assert.doesNotMatch(refined, /당신 모르게/u);
});

test('refinePatientMedicalKorean polishes clinical consultation idioms and provider terms', () => {
  const talkDoctor = '문제가 있다면 주치의와 이야기하세요. 그리고 의료 제공자에게 문의하세요.';
  const refined = refinePatientMedicalKorean(talkDoctor);
  assert.match(refined, /주치의와 상의하세요/u);
  assert.match(refined, /의료진에게 문의하세요/u);
  assert.doesNotMatch(refined, /이야기하세요/u);
  assert.doesNotMatch(refined, /의료 제공자/u);
});

test('refinePatientMedicalKorean polishes repetitive pediatric possessive phrasing', () => {
  const asthma = '아이의 의료진은 천식을 진단하고, 아이의 의료진과 함께 치료 계획을 세웁니다.';
  const refined = refinePatientMedicalKorean(asthma);
  assert.match(refined, /소아청소년과 의료진은/u);
  assert.match(refined, /담당 의료진과 함께/u);
  assert.doesNotMatch(refined, /아이의 의료진/u);
});

test('refinePatientMedicalKorean preserves normal medical terms untouched', () => {
  const afp = 'AFP 종양표지자 검사는 혈액 검체에서 AFP(알파태아단백) 수치를 측정하는 혈액검사입니다.';
  assert.equal(refinePatientMedicalKorean(afp), afp);

  const ultrasound = '초음파는 음파를 이용해 신체 내부의 장기, 조직 및 다른 구조의 영상(초음파 영상)을 만드는 영상검사입니다.';
  assert.equal(refinePatientMedicalKorean(ultrasound), ultrasound);
});
