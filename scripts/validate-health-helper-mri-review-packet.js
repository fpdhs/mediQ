import {readFile} from 'node:fs/promises';
import {validateHealthHelperMriReviewPacket} from '../src/health-helper-mri-review-packet.js';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const [packet,corpus,manifest]=await Promise.all([
  readJson('../docs/implementation/health-helper-mri-list-review-packet-2026-10-13-v1.json'),
  readJson('../data/medlineplus-upload-ko-20261012-v3/corpus.json'),
  readJson('../data/medlineplus-upload-ko-20261012-v3/manifest.json'),
]);
const result=validateHealthHelperMriReviewPacket(packet,corpus,manifest);
console.log(`MRI_LIST_REVIEW_PACKET_PASS claims=${result.claimCount} segments=${result.segmentCount} rights=${result.rightsDecision} status=${result.status}`);
