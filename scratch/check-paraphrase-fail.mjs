import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';
import { evaluateParaphraseHoldout, loadParaphraseHoldout } from '../scripts/evaluate-medlineplus-upload-holdout.js';

async function main() {
  const c = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const paraphraseFixture = loadParaphraseHoldout();
  const paraphrase = evaluateParaphraseHoldout(c, paraphraseFixture);

  console.log('Failed cases in paraphrase:');
  const failed = paraphrase.cases.filter(result => !result.pass);
  console.log(JSON.stringify(failed, null, 2));
}

main().catch(console.error);
