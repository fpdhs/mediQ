import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelperSourceInventory } from '../scripts/health-helper-source-inventory.js';
import { HELPER_CORPUS } from '../src/health-helper-corpus.js';
import { testOnlyClearedCorpus } from './helpers/health-helper-corpus.js';

test('inventory distinguishes reuse clearance from clinical review and has no eligible production text', () => {
  const report = buildHelperSourceInventory();
  assert.equal(report.eligibleCount, 0);
  assert.equal(report.status, 'NO_ELIGIBLE_MEDICAL_EVIDENCE');
  assert.equal(report.reviewStatus, 'DRAFT / UNASSIGNED');
  assert.equal(report.sources.length, 3);
  const replacement = report.sources.find(source => source.id === 'uiwang-laboratory-0305');
  assert.equal(replacement.reuseStatus, 'CLEARED');
  assert.ok(replacement.blockers.includes('CHUNK_REVIEW_PENDING'));
  assert.equal(report.modelInvocation, 'NOT_PERFORMED');
});
test('report does not mutate corpus or confuse test approvals with deployment', () => {
  const before = JSON.stringify(HELPER_CORPUS);
  const report = buildHelperSourceInventory(testOnlyClearedCorpus());
  assert.equal(report.eligibleCount, 9);
  assert.equal(report.deployment, 'NOT_PERFORMED');
  assert.equal(JSON.stringify(HELPER_CORPUS), before);
});
