import test from 'node:test';
import assert from 'node:assert/strict';
import {candidateSourceFingerprint,candidateRuntimeStatus,compareCandidateRuntime} from '../src/health-helper-candidate-runtime.js';

const fingerprint=`sha256:${'a'.repeat(64)}`;
const uploaded={version:'medlineplus-upload-ko-20261012-v3',indexScope:'SCHOOL_DEMO_ALL_TRANSLATIONS',
 indexedDocuments:1017,demoIndexPassDocuments:1017,schoolDemoCandidateStatus:'PASS',chunks:Array(20338),held:Array(107)};
const supplement={version:'medlineplus-medical-tests-school-demo-ko-20261013-v1',status:'DRAFT / UNASSIGNED',
 indexScope:'SCHOOL_DEMO_MEDICAL_TEST_ADDENDUM',collection:'MedlinePlus Medical Tests',indexedDocuments:2,
 demoIndexPassDocuments:2,schoolDemoCandidateStatus:'PASS',chunks:Array(9),held:Array(2),clinicalUse:false,serviceDeployment:false};
const status=()=>candidateRuntimeStatus({sourceFingerprint:fingerprint,schoolDemo:true,uploaded,supplements:[supplement],startedAt:'2026-10-13T00:00:00.000Z'});
test('runtime status describes the school snapshot without paths, secrets or model readiness claims',()=>{
 const value=status();assert.equal(compareCandidateRuntime(value,{sourceFingerprint:fingerprint}).result,'PASS');
 assert.equal(value.modelAvailability,'NOT_CHECKED');assert.ok(Object.isFrozen(value));assert.ok(Object.isFrozen(value.corpus));
 assert.equal(value.corpusSupplements[0].indexedDocuments,2);assert.ok(Object.isFrozen(value.corpusSupplements[0]));
 assert.equal(value.corpus.schoolDemoCandidatePassDocuments,1017);assert.equal(value.corpusSupplements[0].schoolDemoCandidatePassDocuments,2);
 assert.doesNotMatch(JSON.stringify(value),/password|secret|C:\\|127\.0\.0\.1|question|text_ko/iu);
 assert.throws(()=>candidateRuntimeStatus({sourceFingerprint:fingerprint,schoolDemo:true,uploaded:{...uploaded,indexScope:'QA_PASS_TRANSLATIONS_ONLY'},startedAt:value.startedAt}));
});
test('runtime comparison rejects stale sources, wrong profiles and incomplete corpus snapshots',()=>{
 const cases=[
  [{...status(),startupSourceFingerprint:`sha256:${'b'.repeat(64)}`},'SOURCE_SNAPSHOT_MISMATCH'],
  [{...status(),runtimeContract:'old'},'RUNTIME_CONTRACT_MISMATCH'],
  [{...status(),profile:'UPLOADED_QA_PASS_TRANSLATIONS'},'SCHOOL_PROFILE_MISMATCH'],
  [{...status(),corpus:{...status().corpus,indexedDocuments:910}},'CORPUS_SNAPSHOT_MISMATCH'],
  [{...status(),corpus:{...status().corpus,schoolDemoCandidateStatus:'HOLD'}},'CORPUS_SNAPSHOT_MISMATCH'],
  [{...status(),corpusSupplements:[]},'CORPUS_SUPPLEMENT_MISMATCH'],
  [{...status(),clinicalUse:true},'SERVICE_BOUNDARY_MISMATCH'],
  [{...status(),startedAt:'invalid'},'RUNTIME_STATUS_INVALID'],
 ];
 for(const [actual,issue] of cases){const result=compareCandidateRuntime(actual,{sourceFingerprint:fingerprint});assert.equal(result.result,'FAIL');assert.ok(result.issues.includes(issue));}
 assert.equal(compareCandidateRuntime(null,{sourceFingerprint:fingerprint}).result,'FAIL');
});
test('current candidate source fingerprint is deterministic and bounded',async()=>{
 const first=await candidateSourceFingerprint();assert.match(first,/^sha256:[a-f0-9]{64}$/u);
 assert.equal(await candidateSourceFingerprint(),first);
});
