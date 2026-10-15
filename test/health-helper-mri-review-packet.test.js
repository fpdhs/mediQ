import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {buildHealthHelperMriReviewProgress,composeHealthHelperMriReviewPacket,validateHealthHelperMriReviewPacket} from '../src/health-helper-mri-review-packet.js';

const json=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const packetBytes=await readFile(new URL('../docs/implementation/health-helper-mri-list-review-packet-2026-10-13-v1.json',import.meta.url));
const [basePacket,overlay,corpus,manifest]=await Promise.all([
  Promise.resolve(JSON.parse(packetBytes.toString('utf8'))),
  json('../docs/implementation/health-helper-mri-list-review-overlay-2026-10-13-v2.json'),
  json('../data/medlineplus-upload-ko-20261012-v3/corpus.json'),
  json('../data/medlineplus-upload-ko-20261012-v3/manifest.json'),
]);
const basePacketSha256=`sha256:${createHash('sha256').update(packetBytes).digest('hex')}`;
const packet=composeHealthHelperMriReviewPacket(basePacket,overlay,basePacketSha256);

test('MRI v2 overlay binds immutable v1 evidence and reports zero of 17 review cells complete',()=>{
  const result=validateHealthHelperMriReviewPacket(packet,corpus,manifest);
  assert.deepEqual(result,{valid:true,claimCount:4,segmentCount:8,status:'REVIEW_ONLY_NOT_SERVICE_APPROVED',rightsDecision:'UNASSESSED'});
  const progress=buildHealthHelperMriReviewProgress(packet,corpus,manifest);
  assert.equal(progress.status,'REVIEW_PROGRESS_ONLY_NOT_SERVICE_APPROVED');
  assert.deepEqual(progress.reviewCells,{reviewed:0,total:17,pending:17});
  assert.equal(progress.claims.unassessed,4);
  assert.equal(progress.serviceEligible,false);
  assert.equal(progress.clinicalUse,false);
});

test('MRI review overlay rejects a changed base packet hash',()=>{
  assert.throws(()=>composeHealthHelperMriReviewPacket(basePacket,overlay,`sha256:${'0'.repeat(64)}`),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
  const changedOverlay=structuredClone(overlay);
  changedOverlay.basePacket.sha256=`sha256:${'0'.repeat(64)}`;
  assert.throws(()=>composeHealthHelperMriReviewPacket(basePacket,changedOverlay,basePacketSha256),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});

test('MRI review packet rejects a changed candidate translation hash',()=>{
  const changed=structuredClone(packet);
  changed.sourceSegments[3].translationSha256='sha256:'+'0'.repeat(64);
  assert.throws(()=>validateHealthHelperMriReviewPacket(changed,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});

test('MRI review packet rejects a changed English locator or candidate list display',()=>{
  const changedSource=structuredClone(packet);
  changedSource.sourceSegments[3].sourceTextEnglish='Jewelry';
  assert.throws(()=>validateHealthHelperMriReviewPacket(changedSource,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
  const changedDisplay=structuredClone(packet);
  changedDisplay.claims[0].candidateDisplay.items=['금속 물체'];
  assert.throws(()=>validateHealthHelperMriReviewPacket(changedDisplay,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});

test('MRI review annotations can be recorded without changing service eligibility',()=>{
  const changed=structuredClone(packet);
  changed.claims[0].review.sourceSupport={decision:'DIRECT_SUPPORT',reviewerId:'ORG-REV-01',reviewerRole:'SOURCE_EVIDENCE_REVIEWER',reviewedAt:'2026-10-13',rationale:'Claim is supported by the listed MRI preparation text.',assessedSegmentIds:['3953-S0012']};
  changed.claims[0].review.clinical={decision:'ACCEPTABLE_WITHIN_SCOPE',reviewerId:'ORG-CLIN-01',reviewerRole:'CLINICAL_REVIEWER',reviewedAt:'2026-10-13',rationale:'Test annotation only; not a service approval.'};
  changed.source.rightsReview={decision:'HOLD',reviewerId:'ORG-RIGHTS-01',reviewerRole:'RIGHTS_REVIEWER',reviewedAt:'2026-10-13',rationale:'Rights scope requires separate confirmation.'};
  const progress=buildHealthHelperMriReviewProgress(changed,corpus,manifest);
  assert.equal(progress.reviewCells.reviewed,3);
  assert.equal(progress.reviewCells.pending,14);
  assert.equal(progress.claims.partiallyAnnotated,1);
  assert.equal(progress.rights.decision,'HOLD');
  assert.equal(progress.packetStatus,'REVIEW_ONLY_NOT_SERVICE_APPROVED');
  assert.equal(progress.serviceEligible,false);
  assert.equal(progress.clinicalUse,false);
});

test('MRI review annotations never permit packet promotion to patient service',()=>{
  const promoted=structuredClone(packet);
  promoted.status='SERVICE_APPROVED';
  promoted.scope.serviceEligible=true;
  promoted.scope.clinicalUse=true;
  assert.throws(()=>validateHealthHelperMriReviewPacket(promoted,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});

test('MRI review packet rejects invalid reviewer role, date, rationale and unsupported evidence locator',()=>{
  const wrongRole=structuredClone(packet);
  wrongRole.claims[0].review.translation={decision:'FAITHFUL',reviewerId:'ORG-TR-01',reviewerRole:'CLINICAL_REVIEWER',reviewedAt:'2026-10-13',rationale:'Review note.'};
  assert.throws(()=>validateHealthHelperMriReviewPacket(wrongRole,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);

  const wrongDate=structuredClone(packet);
  wrongDate.claims[0].review.clinical={decision:'ACCEPTABLE_WITHIN_SCOPE',reviewerId:'ORG-CL-01',reviewerRole:'CLINICAL_REVIEWER',reviewedAt:'2026-02-30',rationale:'Review note.'};
  assert.throws(()=>validateHealthHelperMriReviewPacket(wrongDate,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);

  const blankRationale=structuredClone(packet);
  blankRationale.source.rightsReview={decision:'HOLD',reviewerId:'ORG-RIGHTS-01',reviewerRole:'RIGHTS_REVIEWER',reviewedAt:'2026-10-13',rationale:'   '};
  assert.throws(()=>validateHealthHelperMriReviewPacket(blankRationale,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);

  const unsupportedSegment=structuredClone(packet);
  unsupportedSegment.claims[0].review.sourceSupport={decision:'DIRECT_SUPPORT',reviewerId:'ORG-SRC-01',reviewerRole:'SOURCE_EVIDENCE_REVIEWER',reviewedAt:'2026-10-13',rationale:'Review note.',assessedSegmentIds:['3953-S0022']};
  assert.throws(()=>validateHealthHelperMriReviewPacket(unsupportedSegment,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});
