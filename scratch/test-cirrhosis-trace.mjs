import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });

  const q1 = "간경화란 무엇인가요?";
  const q2 = "간경화에 대해서 알려달라";

  // Check aliases and topics in corpus for 간경화 or 간경변증
  const cirrhosisChunks = corpus.chunks.filter(c => 
    c.title_ko?.includes('간경변') || c.title_ko?.includes('간경화') ||
    (c.aliases && c.aliases.some(a => a.includes('간경화') || a.includes('간경변')))
  );
  console.log('Cirrhosis chunks count:', cirrhosisChunks.length);
  if (cirrhosisChunks.length) {
    console.log('Sample chunk:');
    console.log('doc_id:', cirrhosisChunks[0].doc_id);
    console.log('topic:', cirrhosisChunks[0].topic);
    console.log('title_ko:', cirrhosisChunks[0].title_ko);
    console.log('aliases:', cirrhosisChunks[0].aliases);
    console.log('ai_qa_status:', cirrhosisChunks[0].ai_qa_status);
  }

  // Let's trace why "간경화란 무엇인가요?" returns INSUFFICIENT_EVIDENCE
  // We can inspect the steps in retrieveUploadedEvidence
}

main().catch(console.error);
