import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { evaluateUploadedRetrieval } from '../scripts/evaluate-medlineplus-upload-retrieval.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const report = evaluateUploadedRetrieval(corpus);
  console.log('sourceLookupOnlyTitleQueries:', report.counts.sourceLookupOnlyTitleQueries);
  console.log('sourceLookupOnlyTitleEvidenceCount:', report.counts.sourceLookupOnlyTitleEvidenceCount);
  console.log('sourceLookupOnlySourceQualityCounts:', report.counts.sourceLookupOnlySourceQualityCounts);
}

main().catch(console.error);
