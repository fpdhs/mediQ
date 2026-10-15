import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCrossTestSourceLocators} from '../scripts/build-health-helper-cross-test-source-locators.js';
import {extractSourceUpdatedAt,sourceParagraphTextAt,sourceSectionFingerprints,sourceSectionParagraphLocators,sourceSectionsExist} from '../src/health-helper-source-sections.js';
import {sourceUpdatedAtForUrl} from '../src/health-helper-source-freshness.js';

const locatorArtifactUrl=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);

test('source update date extraction accepts one explicit visible date and rejects missing or ambiguous dates',()=>{
 assert.equal(extractSourceUpdatedAt('<footer>Last updated: October 5, 2025</footer>'),'2025-10-05');
 assert.equal(extractSourceUpdatedAt('<script>Last updated: January 1, 2000</script><p>Last updated July 15, 2026</p>'),'2026-07-15');
 assert.equal(extractSourceUpdatedAt('<p>No editorial date</p>'),null);
 assert.equal(extractSourceUpdatedAt('<p>Last updated May 1, 2024</p><p>Last updated June 2, 2025</p>'),null);
});

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

test('paragraph locators are heading-bounded, stable references and do not assert semantic support',()=>{
 const html='<p>Navigation text is outside the section.</p><h2>Top</h2><p>First &amp; visible paragraph.</p><h3>Detail</h3><p><b>Nested</b> detail paragraph.</p><h2>Next</h2><p>Later text.</p>';
 const locators=sourceSectionParagraphLocators(html,'Top · Detail');
 assert.equal(locators.length,2);
 assert.equal(locators[0].paragraphOrdinal,2);
 assert.equal(locators[1].paragraphOrdinal,3);
 assert.deepEqual(locators[0].sectionTitles,['Top']);
 assert.deepEqual(locators[1].sectionTitles,['Top','Detail']);
 for(const locator of locators){
  assert.match(locator.paragraphId,/^p\d+-[a-f0-9]{12}$/u);
  assert.match(locator.paragraphSha256,/^sha256:[a-f0-9]{64}$/u);
  assert.ok(locator.visibleTextLength>0);
 }
 assert.equal(sourceSectionParagraphLocators(html,'Missing'),null);
 assert.deepEqual(sourceSectionParagraphLocators('<h2>Empty</h2><div>No paragraph node</div>','Empty'),[]);
 assert.equal(sourceParagraphTextAt(html,2),'First & visible paragraph.');
 assert.equal(sourceParagraphTextAt(html,0),null);
 assert.equal(sourceParagraphTextAt(html,99),null);
});

test('cross-test reviewer locators bind exact candidate hashes to fixed source sections without asserting support',async()=>{
 const report=await buildCrossTestSourceLocators();
 assert.deepEqual(report,JSON.parse(await readFile(locatorArtifactUrl,'utf8')));
 assert.equal(report.status,'DRAFT / UNASSIGNED');
  assert.equal(report.candidateCount,16);
  assert.equal(report.candidates.length,16);
  assert.equal(new Set(report.candidates.map(row=>row.sourceUrl)).size,14);
  assert.ok(report.claimCount>=16);
 assert.ok(report.snapshots.includes('Liver v4'));
 assert.ok(report.snapshots.includes('Screening v3'));
 for(const row of report.candidates){
  const sourceUrl=new URL(row.sourceUrl);
  assert.equal(sourceUrl.origin,'https://medlineplus.gov',row.chunkId);
  assert.match(sourceUrl.pathname,/^\/lab-tests\//u,row.chunkId);
  assert.equal(row.reviewStatus,'DRAFT / UNASSIGNED',row.chunkId);
  assert.equal(row.clinicalUse,false,row.chunkId);
  assert.equal(row.serviceEligible,false,row.chunkId);
  assert.match(row.sourceUpdatedAt,/^\d{4}-\d{2}-\d{2}$/u,row.chunkId);
  assert.equal(row.sourceUpdatedAt,sourceUpdatedAtForUrl(row.sourceUrl),row.chunkId);
  assert.ok(row.sourceParagraphLocators.length>0,row.chunkId);
  const paragraphIds=new Set(row.sourceParagraphLocators.map(paragraph=>paragraph.paragraphId));
  for(const claim of row.claims){
   assert.equal(claim.supportStatus,'UNASSESSED');
   assert.ok(claim.candidateSourceParagraphIds.length>0,claim.claimId);
   assert.deepEqual(claim.candidateSourceParagraphIds,row.sourceParagraphLocators.map(paragraph=>paragraph.paragraphId),claim.claimId);
   for(const paragraphId of claim.candidateSourceParagraphIds)assert.ok(paragraphIds.has(paragraphId),claim.claimId);
  }
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
