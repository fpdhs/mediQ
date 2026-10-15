// Reviewer-only annotation contract. This module is deliberately not imported by patient services.
const reviewAxes=Object.freeze({
 rights:Object.freeze({reviewerRole:'RIGHTS_REVIEWER',decisions:Object.freeze(['UNASSESSED','PUBLIC_DOMAIN_SCOPE_MATCH','PERMISSION_REQUIRED','LINK_ONLY','HOLD'])}),
 translation:Object.freeze({reviewerRole:'TRANSLATION_REVIEWER',decisions:Object.freeze(['UNASSESSED','FAITHFUL','CORRECTION_REQUIRED','NOT_APPLICABLE'])}),
 clinical:Object.freeze({reviewerRole:'CLINICAL_REVIEWER',decisions:Object.freeze(['UNASSESSED','ACCEPTABLE_WITHIN_SCOPE','REVISION_REQUIRED','REJECTED'])}),
 disposition:Object.freeze({reviewerRole:'CURATION_EDITOR',decisions:Object.freeze(['UNASSESSED','RETAIN_DRAFT','REVISE','EXCLUDE'])}),
});
const reviewAxesV2=Object.freeze({...reviewAxes,sourceSupport:Object.freeze({reviewerRole:'SOURCE_EVIDENCE_REVIEWER',
 decisions:Object.freeze(['UNASSESSED','DIRECT_SUPPORT','PARTIAL_SUPPORT','NO_SUPPORT','AMBIGUOUS'])})});

const blankReview=()=>Object.fromEntries(Object.entries(reviewAxes).map(([axis])=>[axis,{
 decision:'UNASSESSED',reviewerId:null,reviewerRole:null,reviewedAt:null,rationale:null,
}]));

function fail(){throw new Error('HEALTH_HELPER_REVIEW_TEMPLATE_INVALID');}
function validIsoDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/u.test(value))return false;
 const date=new Date(`${value}T00:00:00Z`);
 return !Number.isNaN(date.valueOf())&&date.toISOString().slice(0,10)===value;
}
function countDecisions(entries,getDecision,decisions){
 return Object.fromEntries(decisions.map(decision=>[decision,entries.filter(entry=>getDecision(entry)===decision).length]));
}

export function createHealthHelperClaimReviewTemplate(locator,locatorArtifactSha256){
 if(!locator||locator.status!=='DRAFT / UNASSIGNED'||!Array.isArray(locator.candidates)
  ||!/^sha256:[a-f0-9]{64}$/u.test(locatorArtifactSha256??''))fail();
 const sources=new Map(),claims=[],seenClaimIds=new Set();
 for(const candidate of locator.candidates){
  if(typeof candidate.sourceUrl!=='string'||!/^sha256:[a-f0-9]{64}$/u.test(candidate.sourcePageSha256??'')
   ||!Array.isArray(candidate.sourceParagraphLocators)||!candidate.sourceParagraphLocators.length)fail();
  const currentSource=sources.get(candidate.sourceUrl);
  const source={sourceUrl:candidate.sourceUrl,snapshot:candidate.snapshot,sourceSnapshotPath:candidate.sourceSnapshotPath,
   sourcePageSha256:candidate.sourcePageSha256,sourceUpdatedAt:candidate.sourceUpdatedAt,
   rightsReview:{decision:'UNASSESSED',reviewerId:null,reviewerRole:null,reviewedAt:null,rationale:null}};
  if(currentSource&&(currentSource.sourcePageSha256!==source.sourcePageSha256||currentSource.sourceSnapshotPath!==source.sourceSnapshotPath))fail();
  if(!currentSource)sources.set(candidate.sourceUrl,source);
  const paragraphIds=new Set(candidate.sourceParagraphLocators.map(paragraph=>paragraph.paragraphId));
  for(const claim of candidate.claims??[]){
   if(seenClaimIds.has(claim.claimId)||claim.supportStatus!=='UNASSESSED'||!/^[a-f0-9]{64}$/u.test(claim.claimSha256??'')
    ||!Array.isArray(claim.candidateSourceParagraphIds)||!claim.candidateSourceParagraphIds.length
    ||claim.candidateSourceParagraphIds.some(id=>!paragraphIds.has(id)))fail();
   seenClaimIds.add(claim.claimId);
   claims.push({claimId:claim.claimId,chunkId:candidate.chunkId,topic:candidate.topic,claimText:claim.claimText,
    claimSha256:claim.claimSha256,sourceUrl:candidate.sourceUrl,sourcePageSha256:candidate.sourcePageSha256,
    sourceSections:claim.sourceSections,candidateSourceParagraphIds:claim.candidateSourceParagraphIds,
    review:blankReview()});
  }
 }
 if(!claims.length||claims.length!==locator.claimCount||sources.size!==new Set(locator.candidates.map(item=>item.sourceUrl)).size)fail();
 return {schemaVersion:'health-helper-claim-review-template/1',status:'REVIEW_ONLY_NOT_SERVICE_APPROVED',
  generatedAt:'2026-10-13',sourceLocatorArtifact:{file:'health-helper-cross-test-source-locators-2026-10-13-v4.json',sha256:locatorArtifactSha256},
  instructions:[
   'Review only the exact candidate text, source URL, source snapshot hash and paragraph IDs listed for each record.',
   'Paragraph IDs are location suggestions only; no paragraph-to-claim semantic match has been made.',
   'Use an organization-assigned reviewer ID, not a personal name, email, patient record or free-text patient example.',
   'Record the rationale and review date for every non-UNASSESSED decision; a decision cannot be inferred from another review axis.',
   'Any source, candidate text, paragraph locator or hash change requires a new locator/template version and a fresh review.',
   'This template records review input only. It does not authenticate reviewer identity or qualifications and cannot approve service use or deployment.'
  ],
  requiredReviewerRoles:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.reviewerRole])),
  decisionEnums:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.decisions])),
  sourceCount:sources.size,claimCount:claims.length,sources:[...sources.values()].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl)),claims};
}

export function createHealthHelperClaimReviewTemplateV2(locator,locatorArtifactSha256){
 const base=createHealthHelperClaimReviewTemplate(locator,locatorArtifactSha256);
 const entry={decision:'UNASSESSED',reviewerId:null,reviewerRole:null,reviewedAt:null,rationale:null,assessedParagraphIds:[]};
 return {...base,schemaVersion:'health-helper-claim-review-template/2',
  instructions:[...base.instructions,
   'For every claim, an independent SOURCE_EVIDENCE_REVIEWER must assess the exact claim against the listed source paragraphs.',
   'DIRECT_SUPPORT requires at least one identified paragraph to support the full claim, including its conditions and uncertainty; paragraph location alone is not support.',
   'Use PARTIAL_SUPPORT, NO_SUPPORT or AMBIGUOUS when the exact claim is not fully supported; include the relevant paragraph IDs and reasoning in the rationale.',
   'A source-support decision is review input only and does not approve the content, grant reuse rights, or enable patient-service use.'],
  requiredReviewerRoles:Object.fromEntries(Object.entries(reviewAxesV2).map(([axis,rule])=>[axis,rule.reviewerRole])),
  decisionEnums:Object.fromEntries(Object.entries(reviewAxesV2).map(([axis,rule])=>[axis,rule.decisions])),
  claims:base.claims.map(claim=>({...claim,review:{...claim.review,sourceSupport:{...entry}}}))};
}

export function validateHealthHelperClaimReviewTemplate(template,locator,locatorArtifactSha256){
 if(!template||!locator||template.schemaVersion!=='health-helper-claim-review-template/1'
  ||template.status!=='REVIEW_ONLY_NOT_SERVICE_APPROVED'||template.sourceLocatorArtifact?.sha256!==locatorArtifactSha256
  ||template.sourceLocatorArtifact?.file!=='health-helper-cross-test-source-locators-2026-10-13-v4.json'
  ||template.claimCount!==locator.claimCount||!Array.isArray(template.claims)||!Array.isArray(template.sources))fail();
 const expectedRoles=Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.reviewerRole]));
 const expectedEnums=Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.decisions]));
 if(JSON.stringify(template.requiredReviewerRoles)!==JSON.stringify(expectedRoles)
  ||JSON.stringify(template.decisionEnums)!==JSON.stringify(expectedEnums))fail();
 const expected=new Map();
 for(const candidate of locator.candidates??[])for(const claim of candidate.claims??[])
  expected.set(claim.claimId,{candidate,claim});
 if(expected.size!==template.claims.length)fail();
 const found=new Set();
 for(const record of template.claims){
  const match=expected.get(record.claimId);
  if(!match||found.has(record.claimId))fail();
  found.add(record.claimId);
  const {candidate,claim}=match,paragraphIds=new Set(candidate.sourceParagraphLocators.map(item=>item.paragraphId));
  if(record.chunkId!==candidate.chunkId||record.topic!==candidate.topic||record.claimText!==claim.claimText
   ||record.claimSha256!==claim.claimSha256||record.sourceUrl!==candidate.sourceUrl
   ||record.sourcePageSha256!==candidate.sourcePageSha256
   ||JSON.stringify(record.sourceSections)!==JSON.stringify(claim.sourceSections)
   ||JSON.stringify(record.candidateSourceParagraphIds)!==JSON.stringify(claim.candidateSourceParagraphIds)
   ||record.candidateSourceParagraphIds.some(id=>!paragraphIds.has(id)))fail();
  validateReview(record.review,reviewAxes);
 }
 const expectedSources=new Map(locator.candidates.map(candidate=>[candidate.sourceUrl,candidate]));
 if(template.sources.length!==expectedSources.size||template.sourceCount!==expectedSources.size)fail();
 const foundSources=new Set();
 for(const source of template.sources){
  const candidate=expectedSources.get(source.sourceUrl);
  if(!candidate||foundSources.has(source.sourceUrl)||source.sourcePageSha256!==candidate.sourcePageSha256||source.sourceSnapshotPath!==candidate.sourceSnapshotPath
   ||source.sourceUpdatedAt!==candidate.sourceUpdatedAt)fail();
  foundSources.add(source.sourceUrl);
  validateReview({rights:source.rightsReview},{rights:reviewAxes.rights});
 }
 return true;
}

export function validateHealthHelperClaimReviewTemplateV2(template,locator,locatorArtifactSha256){
 if(!template||template.schemaVersion!=='health-helper-claim-review-template/2'||!Array.isArray(template.claims))fail();
 const expectedRoles=Object.fromEntries(Object.entries(reviewAxesV2).map(([axis,rule])=>[axis,rule.reviewerRole]));
 const expectedEnums=Object.fromEntries(Object.entries(reviewAxesV2).map(([axis,rule])=>[axis,rule.decisions]));
 if(JSON.stringify(template.requiredReviewerRoles)!==JSON.stringify(expectedRoles)
  ||JSON.stringify(template.decisionEnums)!==JSON.stringify(expectedEnums))fail();
 for(const claim of template.claims){
  validateReview(claim.review,reviewAxesV2);
  const support=claim.review.sourceSupport,allowedParagraphIds=new Set(claim.candidateSourceParagraphIds);
  if(!Array.isArray(support.assessedParagraphIds)||new Set(support.assessedParagraphIds).size!==support.assessedParagraphIds.length
   ||support.assessedParagraphIds.some(id=>!allowedParagraphIds.has(id))
   ||(support.decision==='UNASSESSED'&&support.assessedParagraphIds.length!==0)
   ||(support.decision!=='UNASSESSED'&&support.assessedParagraphIds.length===0))fail();
 }
 const v1Template={...template,schemaVersion:'health-helper-claim-review-template/1',
  requiredReviewerRoles:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.reviewerRole])),
  decisionEnums:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.decisions])),
  claims:template.claims.map(claim=>({...claim,review:Object.fromEntries(Object.entries(claim.review).filter(([axis])=>axis!=='sourceSupport'))}))};
 validateHealthHelperClaimReviewTemplate(v1Template,locator,locatorArtifactSha256);
 return true;
}

export function buildHealthHelperClaimReviewProgress(template,locator,locatorArtifactSha256){
 validateHealthHelperClaimReviewTemplate(template,locator,locatorArtifactSha256);
 const sourceRightsDecisions=countDecisions(template.sources,source=>source.rightsReview.decision,reviewAxes.rights.decisions);
 const claimDecisionCounts=Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[
  axis,countDecisions(template.claims,claim=>claim.review[axis].decision,rule.decisions),
 ]));
 const claimReviewCells=template.claims.flatMap(claim=>Object.values(claim.review));
 const sourceReviewCells=template.sources.map(source=>source.rightsReview);
 const reviewedCells=[...claimReviewCells,...sourceReviewCells].filter(review=>review.decision!=='UNASSESSED').length;
 const totalCells=claimReviewCells.length+sourceReviewCells.length;
 const fullyAnnotatedClaimCount=template.claims.filter(claim=>Object.values(claim.review)
  .every(review=>review.decision!=='UNASSESSED')).length;
 return {
  schemaVersion:'health-helper-review-progress/1',
  status:'REVIEW_PROGRESS_ONLY_NOT_SERVICE_APPROVED',
  sourceLocatorSha256:template.sourceLocatorArtifact.sha256,
  sources:{total:template.sources.length,rightsReviewed:sourceReviewCells.filter(review=>review.decision!=='UNASSESSED').length,
   rightsPending:sourceRightsDecisions.UNASSESSED,rightsDecisions:sourceRightsDecisions},
  claims:{total:template.claims.length,fullyAnnotated:fullyAnnotatedClaimCount,
   partiallyAnnotated:template.claims.length-fullyAnnotatedClaimCount-template.claims.filter(claim=>Object.values(claim.review)
    .every(review=>review.decision==='UNASSESSED')).length,
   unassessed:template.claims.filter(claim=>Object.values(claim.review).every(review=>review.decision==='UNASSESSED')).length,
   decisionsByAxis:claimDecisionCounts},
  reviewCells:{reviewed:reviewedCells,total:totalCells,pending:totalCells-reviewedCells},
  serviceEligible:false,
  note:'This report counts structurally valid annotations only. It does not authenticate reviewer qualifications, assess evidence, approve a candidate, or authorize patient-service use.',
 };
}

export function buildHealthHelperClaimReviewProgressV2(template,locator,locatorArtifactSha256){
 validateHealthHelperClaimReviewTemplateV2(template,locator,locatorArtifactSha256);
 const baseTemplate={...template,schemaVersion:'health-helper-claim-review-template/1',
  requiredReviewerRoles:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.reviewerRole])),
  decisionEnums:Object.fromEntries(Object.entries(reviewAxes).map(([axis,rule])=>[axis,rule.decisions])),
  claims:template.claims.map(claim=>({...claim,review:Object.fromEntries(Object.entries(claim.review).filter(([axis])=>axis!=='sourceSupport'))}))};
 const report=buildHealthHelperClaimReviewProgress(baseTemplate,locator,locatorArtifactSha256);
 const supportDecisions=countDecisions(template.claims,claim=>claim.review.sourceSupport.decision,reviewAxesV2.sourceSupport.decisions);
 const supportReviewed=template.claims.length-supportDecisions.UNASSESSED;
 const partiallyAnnotated=template.claims.filter(claim=>{
  const assessedCount=Object.values(claim.review).filter(review=>review.decision!=='UNASSESSED').length;
  return assessedCount>0&&assessedCount<Object.keys(reviewAxesV2).length;
 }).length;
 const fullyAnnotated=template.claims.filter(claim=>Object.values(claim.review).every(review=>review.decision!=='UNASSESSED')).length;
 const unassessed=template.claims.filter(claim=>Object.values(claim.review).every(review=>review.decision==='UNASSESSED')).length;
 report.schemaVersion='health-helper-review-progress/2';
 report.claims.fullyAnnotated=fullyAnnotated;report.claims.partiallyAnnotated=partiallyAnnotated;report.claims.unassessed=unassessed;
 report.claims.decisionsByAxis.sourceSupport=supportDecisions;
 report.reviewCells.reviewed+=supportReviewed;report.reviewCells.total+=template.claims.length;
 report.reviewCells.pending=report.reviewCells.total-report.reviewCells.reviewed;
 return report;
}

function validateReview(review,axes){
 if(!review||Object.keys(review).length!==Object.keys(axes).length)fail();
 for(const [axis,rule] of Object.entries(axes)){
  const entry=review[axis];
  if(!entry||!rule.decisions.includes(entry.decision))fail();
  if(entry.decision==='UNASSESSED'){
   if(entry.reviewerId!==null||entry.reviewerRole!==null||entry.reviewedAt!==null||entry.rationale!==null)fail();
   continue;
  }
  if(typeof entry.reviewerId!=='string'||!/^[A-Za-z0-9._:-]{1,64}$/u.test(entry.reviewerId)
   ||entry.reviewerRole!==rule.reviewerRole||!validIsoDate(entry.reviewedAt)
   ||typeof entry.rationale!=='string'||!entry.rationale.trim()||entry.rationale.length>1000)fail();
 }
}
