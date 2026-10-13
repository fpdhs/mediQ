import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCrossTestSourceLocators} from '../scripts/build-health-helper-cross-test-source-locators.js';
import {sourceSectionFingerprints,sourceSectionsExist} from '../src/health-helper-source-sections.js';

test('source section fingerprints bind exact heading-bounded HTML and reject absent paths',()=>{
 const html='<h2>Top &amp; overview</h2><p>First paragraph.</p><h3>Detail</h3><p>Nested detail.</p><h2>Next</h2><p>Later text.</p>';
 assert.equal(sourceSectionsExist(html,'Top & overview · Detail'),true);
 assert.equal(sourceSectionsExist(html,'Top & overview · Missing'),false);
 const fingerprints=sourceSectionFingerprints(html,'Top & overview · Detail');
 assert.equal(fingerprints.length,2);
 for(const row of fingerprints)assert.match(row.sectionHtmlSha256,/^sha256:[a-f0-9]{64}$/u);
 assert.notEqual(fingerprints[0].sectionHtmlSha256,fingerprints[1].sectionHtmlSha256);
 assert.equal(sourceSectionFingerprints(html,'Missing'),null);
});

test('cross-test reviewer locators bind exact candidate hashes to fixed source sections without asserting support',async()=>{
 const report=await buildCrossTestSourceLocators();
 assert.equal(report.status,'DRAFT / UNASSIGNED');
 assert.equal(report.candidateCount,16);
 assert.equal(report.candidates.length,16);
 assert.ok(report.claimCount>=16);
 assert.ok(report.snapshots.includes('Liver v4'));
 assert.ok(report.snapshots.includes('Screening v3'));
 for(const row of report.candidates){
  assert.equal(row.reviewStatus,'DRAFT / UNASSIGNED',row.chunkId);
  assert.equal(row.clinicalUse,false,row.chunkId);
  assert.equal(row.serviceEligible,false,row.chunkId);
  assert.equal(row.supportAssessment,'UNASSESSED',row.chunkId);
  assert.match(row.candidateTextSha256,/^[a-f0-9]{64}$/u);
  assert.match(row.sourcePageSha256,/^sha256:[a-f0-9]{64}$/u);
   assert.ok(row.sectionPath.length>0,row.chunkId);
  assert.equal(row.sourceSectionFingerprints.length,row.sectionPath.join(' · ').split('·').filter(Boolean).length,row.chunkId);
  for(const sourceSection of row.sourceSectionFingerprints)assert.match(sourceSection.sectionHtmlSha256,/^sha256:[a-f0-9]{64}$/u);
  for(const claim of row.claims){
   assert.match(claim.claimSha256,/^[a-f0-9]{64}$/u);
   assert.equal(claim.supportStatus,'UNASSESSED');
   assert.deepEqual(claim.sourceSections,row.sectionPath);
  }
 }
});
