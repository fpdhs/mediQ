import { pathToFileURL } from 'node:url';
import { HELPER_CORPUS, isClearedHelperSource, isReviewedChunk } from '../src/health-helper-corpus.js';

// Operator report only: no scraping, model calls, approval writes or patient data.
export function buildHelperSourceInventory(corpus = HELPER_CORPUS) {
  const sources = corpus.sources.map(source => {
    const chunks = corpus.chunks.filter(chunk => chunk.sourceId === source.id);
    const ready = isClearedHelperSource(source);
    return { id: source.id, institution: source.institution, title: source.title, url: source.url,
      licenseLabel: source.licenseLabel, permissionEvidence: source.permissionEvidence,
      reuseStatus: source.reuseStatus, contentReview: source.contentReview,
      candidateCount: chunks.length,
      eligibleCount: chunks.filter(chunk => ready && chunk.contentReview === 'APPROVED' && isReviewedChunk(chunk)).length,
      blockers: [...(source.reuseStatus !== 'CLEARED' ? ['REUSE_PERMISSION_PENDING'] : []),
        ...(!source.permissionEvidence ? ['PERMISSION_RECORD_MISSING'] : []),
        ...(source.contentReview !== 'APPROVED' ? ['SOURCE_REVIEW_PENDING'] : []),
        ...(chunks.some(chunk => chunk.contentReview !== 'APPROVED' || !isReviewedChunk(chunk)) ? ['CHUNK_REVIEW_PENDING'] : []),
        ...(source.reuseStatus === 'CLEARED' && source.contentReview === 'APPROVED' && !ready ? ['PERMISSION_RECORD_INVALID'] : [])] };
  });
  const eligibleCount = sources.reduce((sum, source) => sum + source.eligibleCount, 0);
  return { corpusVersion: corpus.version, reviewStatus: corpus.reviewStatus,
    status: eligibleCount ? 'ELIGIBLE_EVIDENCE_PRESENT' : 'NO_ELIGIBLE_MEDICAL_EVIDENCE',
    eligibleCount, sources, modelInvocation: 'NOT_PERFORMED', deployment: 'NOT_PERFORMED' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.stdout.write(`${JSON.stringify(buildHelperSourceInventory(), null, 2)}\n`);
}
