import { loadUploadedCorpus, retrieveUploadedEvidence } from '../src/medlineplus-upload-corpus.js';
import * as headMod from './head-corpus.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const documents = [...new Map((corpus.chunks ?? []).map(chunk => [chunk.doc_id, { docId: chunk.doc_id, title: chunk.title_ko }])).values()];

  const currentList = new Set();
  const headList = new Set();

  for (const doc of documents) {
    const q = `${doc.title} 설명`;
    const rCurrent = retrieveUploadedEvidence(q, corpus);
    if (rCurrent.sourceLookupOnly) currentList.add(doc.title);

    const rHead = headMod.retrieveUploadedEvidence(q, corpus);
    if (rHead.sourceLookupOnly) headList.add(doc.title);
  }

  console.log('Head count:', headList.size);
  console.log('Current count:', currentList.size);

  const missingInCurrent = [...headList].filter(x => !currentList.has(x));
  console.log('Missing in current:', missingInCurrent);

  const missingInHead = [...currentList].filter(x => !headList.has(x));
  console.log('Missing in head:', missingInHead);
}

main().catch(console.error);
