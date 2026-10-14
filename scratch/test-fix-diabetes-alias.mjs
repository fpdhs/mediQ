import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { evaluateParaphraseHoldout, loadParaphraseHoldout } from '../scripts/evaluate-medlineplus-upload-holdout.js';

async function main() {
  const c = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  
  // Test "당뇨병 위험 요인 목록"
  import('../src/medlineplus-upload-corpus.js').then(mod => {
    const res = mod.retrieveUploadedEvidence('당뇨병 위험 요인 목록', c);
    console.log('Result for "당뇨병 위험 요인 목록":', res.status, 'topic:', res.topic);
  });
}

main().catch(console.error);
