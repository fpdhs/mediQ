import { HELPER_CORPUS } from '../../src/health-helper-corpus.js';

// Test double ONLY. These flags are not real source permission or clinical review.
export function testOnlyClearedCorpus() {
  const corpus = structuredClone(HELPER_CORPUS);
  corpus.version = 'TEST-ONLY-NOT-AUTHORIZATION';
  for (const source of corpus.sources) {
    source.reuseStatus = 'CLEARED'; source.contentReview = 'APPROVED';
    source.reuseNote = 'TEST DOUBLE ONLY — not institutional permission';
    source.permissionEvidence = { type: 'WRITTEN_PERMISSION', checkedAt: '2026-10-11',
      url: 'https://test.invalid/not-permission', locator: 'TEST DOUBLE ONLY' };
  }
  for (const chunk of corpus.chunks) {
    chunk.contentReview = 'APPROVED'; chunk.approvedTextSha256 = chunk.candidateTextSha256;
  }
  return corpus;
}
