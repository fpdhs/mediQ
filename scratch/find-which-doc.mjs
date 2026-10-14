import { loadUploadedCorpus, retrieveUploadedEvidence } from '../src/medlineplus-upload-corpus.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const documents = [...new Map((corpus.chunks ?? []).map(chunk => [chunk.doc_id, { docId: chunk.doc_id, title: chunk.title_ko }])).values()];

  for (const doc of documents) {
    const q = `${doc.title} 설명`;
    const r = retrieveUploadedEvidence(q, corpus);
    if (!r.sourceLookupOnly && r.status === 'CANDIDATE') {
      // Is there any title that might have been sourceLookupOnly before?
      // E.g. containing 약, 치료, etc.
      if (/약|치료|당뇨/.test(doc.title)) {
        console.log(`Title with keyword: "${doc.title}", status: ${r.status}, responseMode: ${r.sourceLookupOnly ? 'SOURCE_LOOKUP_ONLY' : r.extractiveOnly ? 'SOURCE_GUIDANCE' : 'MODEL_SELECTION'}`);
      }
    }
  }
}

main().catch(console.error);
