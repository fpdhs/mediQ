import test from 'node:test';
import assert from 'node:assert/strict';
import {loadHealthHelperReviewPassages} from '../scripts/show-health-helper-review-passages.js';

test('review passage inspector resolves only hash-verified local unranked paragraphs for a fixed claim ID',async()=>{
 const result=await loadHealthHelperReviewPassages('screening-vision-purpose-claim-1');
 assert.equal(result.status,'REVIEW_ONLY_NOT_SERVICE_APPROVED');
 assert.equal(result.supportAssessment,'UNASSESSED');
 assert.deepEqual(result.assessedSourceParagraphIds,[]);
 assert.ok(result.paragraphs.length>0);
 assert.ok(result.paragraphs.every(paragraph=>paragraph.text.length>0&&paragraph.paragraphSha256.startsWith('sha256:')));
 assert.match(result.warning,/unranked/u);
});

test('review passage inspector rejects arbitrary URL-like input and unknown claim IDs',async()=>{
 await assert.rejects(()=>loadHealthHelperReviewPassages('https://example.invalid/'),/REVIEW_CLAIM_ID_INVALID/u);
 await assert.rejects(()=>loadHealthHelperReviewPassages('unknown-claim-999'),/REVIEW_CLAIM_NOT_FOUND/u);
});
