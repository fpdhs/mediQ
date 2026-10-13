import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateHealthHelperMriReviewPacket} from '../src/health-helper-mri-review-packet.js';

const json=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const [packet,corpus,manifest]=await Promise.all([
  json('../docs/implementation/health-helper-mri-list-review-packet-2026-10-13-v1.json'),
  json('../data/medlineplus-upload-ko-20261012-v3/corpus.json'),
  json('../data/medlineplus-upload-ko-20261012-v3/manifest.json'),
]);

test('MRI review packet maps candidate translations to the exact draft corpus and remains unassessed',()=>{
  const result=validateHealthHelperMriReviewPacket(packet,corpus,manifest);
  assert.deepEqual(result,{valid:true,claimCount:4,segmentCount:8,status:'REVIEW_ONLY_NOT_SERVICE_APPROVED',rightsDecision:'UNASSESSED'});
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

test('MRI review packet rejects an annotation that appears approved',()=>{
  const changed=structuredClone(packet);
  changed.claims[0].review.clinical.decision='ACCEPTABLE_WITHIN_SCOPE';
  assert.throws(()=>validateHealthHelperMriReviewPacket(changed,corpus,manifest),/HEALTH_HELPER_MRI_REVIEW_PACKET_INVALID/u);
});
