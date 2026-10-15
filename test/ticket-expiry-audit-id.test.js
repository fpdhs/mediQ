import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

test('read-only expiry audit accepts existing unpadded IDs and rejects unsafe values', () => {
  const source=readFileSync(new URL('../scripts/ticket-expiry-audit-readonly.js',import.meta.url),'utf8');
  const declaration=source.split('\n').find(line=>line.startsWith('const ownedId='));
  assert.ok(declaration);
  const validate=vm.runInNewContext(`${declaration}\nownedId`);
  for(const prefix of ['consent','ticket']) {
    for(const suffix of ['00','d74d6fb9de2b603','0123456789abcdef']) assert.equal(validate(prefix,`${prefix}_${suffix}`),true);
    for(const suffix of ['', '0', '0'.repeat(17), 'AB', 'ab;select', 'ab\n', 'ab\r']) assert.equal(validate(prefix,`${prefix}_${suffix}`),false);
    assert.equal(validate(prefix,null),false);
    assert.equal(validate(prefix,{}),false);
  }
});
