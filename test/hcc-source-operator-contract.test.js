import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fixture, prepareReceipt } from './helpers/hcc-source-fixture.js';

test('catalog operator accepts actual audit receipt IDs, not challenge IDs', async () => {
  const receipt = await prepareReceipt(fixture());
  const source = readFileSync(new URL('../scripts/hcc-source-catalog-live-check.js', import.meta.url), 'utf8');
  const literal = source.match(/!\/(\^audit_[^\n]+?)\/\.test\(value\.receiptId/);
  assert.ok(literal, 'operator must validate the server audit receipt namespace');
  const pattern = new RegExp(literal[1]);
  assert.equal(pattern.test(receipt.receiptId), true);
  assert.equal(pattern.test('hcc-source-00000000-0000-0000-0000-000000000000'), false);
  assert.equal(pattern.test('invented'), false);
  assert.equal(receipt.instanceCount, undefined, 'receipt is not the source report contract');
  const operator = readFileSync(new URL('../scripts/hcc-source-live-integration.py', import.meta.url), 'utf8');
  assert.ok(!operator.includes("value.get('instanceCount')!=700"));
  assert.ok(operator.includes("identity(before)!=identity(after)"));
});
