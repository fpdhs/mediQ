import { loadUploadedCorpus, retrieveUploadedEvidence } from '../src/medlineplus-upload-corpus.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const documents = [...new Map((corpus.chunks ?? []).map(chunk => [chunk.doc_id, { docId: chunk.doc_id, title: chunk.title_ko }])).values()];

  const sourceLookupOnly = [];
  for (const doc of documents) {
    const r = retrieveUploadedEvidence(`${doc.title} 설명`, corpus);
    if (r.sourceLookupOnly) {
      sourceLookupOnly.push(doc.title);
    }
  }

  console.log('sourceLookupOnly count:', sourceLookupOnly.length);
  console.log(sourceLookupOnly);
}

main().catch(console.error);
