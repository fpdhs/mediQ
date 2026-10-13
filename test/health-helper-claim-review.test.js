import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {buildHealthHelperClaimReviewProgress,buildHealthHelperClaimReviewProgressV2,createHealthHelperClaimReviewTemplate,
 createHealthHelperClaimReviewTemplateV2,validateHealthHelperClaimReviewTemplate,validateHealthHelperClaimReviewTemplateV2} from '../src/health-helper-claim-review.js';

const locatorPath=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);
const templatePath=new URL('../docs/implementation/health-helper-claim-review-template-2026-10-13.json',import.meta.url);
const templateV2Path=new URL('../docs/implementation/health-helper-claim-review-template-2026-10-13-v2.json',import.meta.url);
const readLocator=async()=>JSON.parse(await readFile(locatorPath,'utf8'));
const digestBytes=async()=>`sha256:${createHash('sha256').update(await readFile(locatorPath)).digest('hex')}`;

test('blank review worksheet is hash-bound, role-separated and never service-approved',async()=>{
 const locator=await readLocator(),digest=await digestBytes();
 const template=createHealthHelperClaimReviewTemplate(locator,digest);
 assert.equal(template.sourceCount,14);
 assert.equal(template.claimCount,30);
 assert.equal(template.status,'REVIEW_ONLY_NOT_SERVICE_APPROVED');
 assert.equal(validateHealthHelperClaimReviewTemplate(template,locator,digest),true);
 for(const source of template.sources)assert.equal(source.rightsReview.decision,'UNASSESSED');
 for(const claim of template.claims){
  assert.deepEqual(Object.keys(claim.review).sort(),['clinical','disposition','rights','translation']);
  for(const entry of Object.values(claim.review))assert.equal(entry.decision,'UNASSESSED');
 }
});

test('saved review worksheet is bound to the exact checked-in locator bytes',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=JSON.parse(await readFile(templatePath,'utf8'));
 assert.equal(template.sourceLocatorArtifact.sha256,digest);
 assert.equal(validateHealthHelperClaimReviewTemplate(template,locator,digest),true);
});

test('review worksheet v2 adds a claim-level source-support axis without replacing v1',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplateV2(locator,digest);
 const saved=JSON.parse(await readFile(templateV2Path,'utf8'));
 assert.equal(template.schemaVersion,'health-helper-claim-review-template/2');
 assert.equal(template.claimCount,30);assert.equal(template.status,'REVIEW_ONLY_NOT_SERVICE_APPROVED');
 assert.equal(validateHealthHelperClaimReviewTemplateV2(template,locator,digest),true);
 assert.deepEqual(template.requiredReviewerRoles.sourceSupport,'SOURCE_EVIDENCE_REVIEWER');
 assert.equal(template.decisionEnums.sourceSupport.includes('DIRECT_SUPPORT'),true);
 assert.deepEqual(template.claims[0].review.sourceSupport.assessedParagraphIds,[]);
 assert.equal(saved.schemaVersion,template.schemaVersion);
 assert.equal(await readFile(templatePath,'utf8').then(text=>JSON.parse(text).schemaVersion),'health-helper-claim-review-template/1');
});

test('source-support review requires a cited paragraph from that claim and an accountable reviewer',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplateV2(locator,digest);
 const record=template.claims[0],review={decision:'DIRECT_SUPPORT',reviewerId:'reviewer-19',reviewerRole:'SOURCE_EVIDENCE_REVIEWER',
  reviewedAt:'2026-10-13',rationale:'p5가 claim의 범위와 표현을 직접 뒷받침함.',assessedParagraphIds:[record.candidateSourceParagraphIds[0]]};
 record.review.sourceSupport=review;
 assert.equal(validateHealthHelperClaimReviewTemplateV2(template,locator,digest),true);
 record.review.sourceSupport.assessedParagraphIds=['p999-deadbeef0000'];
 assert.throws(()=>validateHealthHelperClaimReviewTemplateV2(template,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
 record.review.sourceSupport=review;record.review.sourceSupport.assessedParagraphIds=[];
 assert.throws(()=>validateHealthHelperClaimReviewTemplateV2(template,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
});

test('review worksheet rejects stale claim hashes and fabricated paragraph references',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplate(locator,digest);
 const stale=structuredClone(template);stale.claims[0].claimSha256='0'.repeat(64);
 assert.throws(()=>validateHealthHelperClaimReviewTemplate(stale,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
 const forged=structuredClone(template);forged.claims[0].candidateSourceParagraphIds=['p999-deadbeef0000'];
 assert.throws(()=>validateHealthHelperClaimReviewTemplate(forged,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
 const alteredScope=structuredClone(template);alteredScope.sourceCount++;
 assert.throws(()=>validateHealthHelperClaimReviewTemplate(alteredScope,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
});

test('reviewed annotation requires an axis-matched reviewer ID, date and rationale but remains non-approval',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplate(locator,digest);
 template.claims[0].review.translation={decision:'FAITHFUL',reviewerId:'reviewer-17',reviewerRole:'TRANSLATION_REVIEWER',
  reviewedAt:'2026-10-13',rationale:'원문 문단과 핵심 한정 표현을 대조함.'};
 assert.equal(validateHealthHelperClaimReviewTemplate(template,locator,digest),true);
 template.claims[0].review.translation.reviewerRole='CLINICAL_REVIEWER';
 assert.throws(()=>validateHealthHelperClaimReviewTemplate(template,locator,digest),/HEALTH_HELPER_REVIEW_TEMPLATE_INVALID/u);
 assert.equal(template.status,'REVIEW_ONLY_NOT_SERVICE_APPROVED');
});

test('review progress report is read-only accounting and never creates service eligibility',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplate(locator,digest);
 const report=buildHealthHelperClaimReviewProgress(template,locator,digest);
 assert.equal(report.status,'REVIEW_PROGRESS_ONLY_NOT_SERVICE_APPROVED');
 assert.equal(report.sources.total,14);assert.equal(report.sources.rightsReviewed,0);assert.equal(report.sources.rightsPending,14);
 assert.equal(report.claims.total,30);assert.equal(report.claims.fullyAnnotated,0);assert.equal(report.claims.partiallyAnnotated,0);
 assert.equal(report.claims.unassessed,30);assert.equal(report.reviewCells.reviewed,0);
 assert.equal(report.reviewCells.total,134);assert.equal(report.reviewCells.pending,134);assert.equal(report.serviceEligible,false);

 const annotated=structuredClone(template),source=annotated.sources[0],claim=annotated.claims[0];
 source.rightsReview={decision:'HOLD',reviewerId:'reviewer-17',reviewerRole:'RIGHTS_REVIEWER',reviewedAt:'2026-10-13',rationale:'테스트용 보류 주석.'};
 claim.review.clinical={decision:'REJECTED',reviewerId:'reviewer-18',reviewerRole:'CLINICAL_REVIEWER',reviewedAt:'2026-10-13',rationale:'테스트용 기각 주석.'};
 const partial=buildHealthHelperClaimReviewProgress(annotated,locator,digest);
 assert.equal(partial.sources.rightsReviewed,1);assert.equal(partial.sources.rightsDecisions.HOLD,1);
 assert.equal(partial.claims.partiallyAnnotated,1);assert.equal(partial.claims.decisionsByAxis.clinical.REJECTED,1);
 assert.equal(partial.reviewCells.reviewed,2);assert.equal(partial.serviceEligible,false);
});

test('review progress v2 accounts for source-support decisions but cannot authorize patient use',async()=>{
 const locator=await readLocator(),digest=await digestBytes(),template=createHealthHelperClaimReviewTemplateV2(locator,digest);
 const report=buildHealthHelperClaimReviewProgressV2(template,locator,digest);
 assert.equal(report.schemaVersion,'health-helper-review-progress/2');
 assert.equal(report.reviewCells.total,164);assert.equal(report.reviewCells.pending,164);
 assert.equal(report.claims.decisionsByAxis.sourceSupport.UNASSESSED,30);assert.equal(report.serviceEligible,false);
 const claim=template.claims[0];claim.review.sourceSupport={decision:'DIRECT_SUPPORT',reviewerId:'reviewer-19',
  reviewerRole:'SOURCE_EVIDENCE_REVIEWER',reviewedAt:'2026-10-13',rationale:'p5가 이 claim을 직접 뒷받침함.',
  assessedParagraphIds:[claim.candidateSourceParagraphIds[0]]};
 const partial=buildHealthHelperClaimReviewProgressV2(template,locator,digest);
 assert.equal(partial.reviewCells.reviewed,1);assert.equal(partial.reviewCells.pending,163);
 assert.equal(partial.claims.partiallyAnnotated,1);assert.equal(partial.claims.decisionsByAxis.sourceSupport.DIRECT_SUPPORT,1);
 assert.equal(partial.serviceEligible,false);
});
