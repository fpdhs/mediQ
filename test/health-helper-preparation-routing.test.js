import test from 'node:test';
import assert from 'node:assert/strict';
import {retrieveHealthEducationEvidence} from '../src/health-helper-education-retrieval.js';
import {afpEntries} from '../src/health-helper-afp-evidence.js';
import {liverFunctionEntries} from '../src/health-helper-liver-evidence.js';
import {screeningEvidenceEntries} from '../src/health-helper-screening-evidence.js';
import {imagingEvidenceEntries} from '../src/health-helper-imaging-evidence.js';

const preparationCandidates=[
 ...afpEntries.filter(entry=>entry.intent==='PREPARATION').map(entry=>({entry,question:`AFP ${entry.question}`})),
 ...liverFunctionEntries.filter(entry=>entry.intent==='PREPARATION').map(entry=>({entry,question:entry.question})),
 ...screeningEvidenceEntries.filter(entry=>entry.intent==='PREPARATION').map(entry=>({entry,question:entry.question})),
 ...imagingEvidenceEntries.filter(entry=>entry.intent==='PREPARATION').map(entry=>({entry,question:entry.question})),
];
const deliberateMedicationRefusals=new Set(['liver-panel-preparation','liver-ast-preparation']);
const expectedRetriever=id=>id.startsWith('afp-')?'AFP_DETAIL':id.startsWith('liver-')?'LIVER_DETAIL':
 id.startsWith('screening-')?'SCREENING_DETAIL':id.startsWith('imaging-')?'IMAGING_DETAIL':null;

test('candidate-specific preparation prompts route narrowly without weakening medication refusal',()=>{
 assert.equal(preparationCandidates.length,27);
 for(const {entry,question} of preparationCandidates){
  const result=retrieveHealthEducationEvidence(question);
  if(deliberateMedicationRefusals.has(entry.id)){
   assert.equal(result.status,'REFUSED',question);
   assert.equal(result.reason,'CLINICAL_REQUEST_NOT_SUPPORTED',question);
   assert.equal(result.serviceEligible,false,question);
   continue;
  }
  assert.equal(result.status,'CANDIDATE',question);
  assert.equal(result.evidence[0].chunk_id,entry.id,question);
  assert.equal(result.retriever,expectedRetriever(entry.id),question);
  assert.equal(result.intent,'PREPARATION',question);
  assert.equal(result.evidence[0].contentReview,'UNASSIGNED',question);
  assert.equal(result.evidence[0].clinicalUse,false,question);
  assert.equal(result.serviceEligible,false,question);
 }
});

test('asking a facility where to confirm preparation routes to preparation, not comparison',()=>{
 const result=retrieveHealthEducationEvidence('이번 ALT 검사에서 금식이 필요한지 검사기관에 확인해야 할까요?');
 assert.equal(result.status,'CANDIDATE');
 assert.equal(result.retriever,'LIVER_DETAIL');
 assert.equal(result.evidence[0].chunk_id,'liver-alt-preparation');
 assert.equal(result.intent,'PREPARATION');
 assert.equal(result.serviceEligible,false);
});
