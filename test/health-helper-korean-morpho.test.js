import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decomposeHangul,
  hasBatchim,
  separateStemAndParticles,
  morphoAnalyze,
  extractNgramStems
} from '../src/health-helper-korean-morpho.js';
import {
  classifyIntent,
  classifyTopicAndIntent,
  resolveTopicFromQuestion,
  INTENTS
} from '../src/health-helper-intent-classifier.js';
import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { loadSchoolDemoMedicalTestAddendum } from '../src/health-helper-school-demo-medical-tests.js';

test('Hangul decomposition and batchim phonological detection', () => {
  assert.equal(hasBatchim('가'), false);
  assert.equal(hasBatchim('화'), false);
  assert.equal(hasBatchim('파'), false);

  assert.equal(hasBatchim('간'), true);
  assert.equal(hasBatchim('증'), true);
  assert.equal(hasBatchim('혈'), true);
  assert.equal(hasBatchim('액'), true);

  const decomposed = decomposeHangul('경');
  assert.equal(decomposed.initial, 'ㄱ');
  assert.equal(decomposed.medial, 'ㅕ');
  assert.equal(decomposed.final, 'ㅇ');
  assert.equal(decomposed.hasFinal, true);

  // Non-hangul returns null/false safely
  assert.equal(decomposeHangul('A'), null);
  assert.equal(hasBatchim('1'), false);
});

test('Phonologically accurate stem and particle separation', () => {
  // Batchim-sensitive topic particle separation
  const cirrhosis1 = separateStemAndParticles('간경화란');
  assert.equal(cirrhosis1.stem, '간경화');
  assert.equal(cirrhosis1.particle, '란');
  assert.equal(cirrhosis1.isSeparated, true);

  const cirrhosis2 = separateStemAndParticles('간경변증은');
  assert.equal(cirrhosis2.stem, '간경변증');
  assert.equal(cirrhosis2.particle, '은');

  // Phonology violation: 간경변증 (has batchim) cannot take '는'
  const invalidPhonology = separateStemAndParticles('간경변증는');
  assert.equal(invalidPhonology.isSeparated, false);

  // Compound particles
  const compound = separateStemAndParticles('간경화에서는');
  assert.equal(compound.stem, '간경화');
  assert.equal(compound.particle, '에서는');
  assert.equal(compound.isCompound, true);

  // Alphanumeric acronyms
  const afp = separateStemAndParticles('AFP는');
  assert.equal(afp.stem, 'AFP');
  assert.equal(afp.particle, '는');

  // Ultrasound particle '로' (after no batchim)
  const us = separateStemAndParticles('초음파로');
  assert.equal(us.stem, '초음파');
  assert.equal(us.particle, '로');
});

test('morphological analysis extracts clean noun candidates', () => {
  const analysis1 = morphoAnalyze('간경화에 대해서 알려줘');
  assert.deepEqual(analysis1.stems, ['간경화']);
  assert.ok(analysis1.nounCandidates.includes('간경화'));

  const analysis2 = morphoAnalyze('간 초음파 검사는 왜 하나요?');
  assert.ok(analysis2.nounCandidates.includes('간 초음파 검사'));
  assert.ok(analysis2.nounCandidates.includes('간 초음파'));
  assert.ok(analysis2.nounCandidates.includes('초음파'));

  const ngrams = extractNgramStems(['간', '초음파', '검사']);
  assert.ok(ngrams.includes('간 초음파 검사'));
  assert.ok(ngrams.includes('간 초음파'));
  assert.ok(ngrams.includes('초음파'));
});

test('2-Layer Intent Classification correctly routes topics and intents', async () => {
  const base = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const addendum = await loadSchoolDemoMedicalTestAddendum();
  const corpus = { ...base, chunks: [...base.chunks, ...addendum.chunks], held: [...base.held, ...addendum.held] };

  // 1. Standalone AFP keyword -> Layer 1: AFP, Layer 2: Default DEFINITION
  const c1 = classifyTopicAndIntent('AFP', corpus, addendum);
  assert.equal(c1.topic.topicId, 'school-demo-medical-test-afp-tumor-marker');
  assert.equal(c1.intent, INTENTS.DEFINITION);
  assert.equal(c1.isDefaultIntent, true);

  // 2. Standalone Ultrasound -> Layer 1: Ultrasound, Layer 2: Default DEFINITION
  const c2 = classifyTopicAndIntent('초음파', corpus, addendum);
  assert.equal(c2.topic.topicId, 'school-demo-medical-test-ultrasound');
  assert.equal(c2.intent, INTENTS.DEFINITION);

  // 3. Standalone Liver Ultrasound -> Layer 1: Ultrasound (matched alias '간 초음파'), Layer 2: Default DEFINITION
  const c3 = classifyTopicAndIntent('간 초음파', corpus, addendum);
  assert.equal(c3.topic.topicId, 'school-demo-medical-test-ultrasound');
  assert.equal(c3.topic.matchedAlias, '간 초음파');
  assert.equal(c3.intent, INTENTS.DEFINITION);

  // 4. Standalone Cirrhosis -> Layer 1: Topic 190, Layer 2: Default DEFINITION
  const c4 = classifyTopicAndIntent('간경화', corpus, addendum);
  assert.equal(c4.topic.topicId, '190');
  assert.equal(c4.intent, INTENTS.DEFINITION);

  // 5. Explicit Cause Intent -> CAUSE
  const c5 = classifyTopicAndIntent('간경화의 원인은 무엇인가요?', corpus, addendum);
  assert.equal(c5.topic.topicId, '190');
  assert.equal(c5.intent, INTENTS.CAUSE);
  assert.equal(c5.isDefaultIntent, false);

  // 6. Explicit Symptom Intent -> SYMPTOM
  const c6 = classifyTopicAndIntent('간경화의 증상은 어떤 것들이 있나요?', corpus, addendum);
  assert.equal(c6.topic.topicId, '190');
  assert.equal(c6.intent, INTENTS.SYMPTOM);

  // 7. Explicit Preparation Intent -> PREPARATION
  const c7 = classifyTopicAndIntent('CT 촬영 전에 금식해야 하나요?', corpus, addendum);
  assert.equal(c7.topic.topicId, '3951');
  assert.equal(c7.intent, INTENTS.PREPARATION);

  // 8. Explicit Limitation Intent -> LIMITATION
  const c8 = classifyTopicAndIntent('AFP 검사 결과만으로 암을 진단할 수 있나요?', corpus, addendum);
  assert.equal(c8.topic.topicId, 'school-demo-medical-test-afp-tumor-marker');
  assert.equal(c8.intent, INTENTS.LIMITATION);
});
