import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBPacsEncryptedMount } from '../src/b-pacs-storage-boundary.js';

const info = '42 31 253:1 / /run/pacs-storage-check ro - ext4 /dev/mapper/highpass-b-pacs rw';
const uuid = 'CRYPT-LUKS2-' + 'a'.repeat(32) + '-highpass-b-pacs';
test('storage boundary reads exact mounted block device encryption, not a JSON PASS flag', () => {
  const calls = [];
  assertBPacsEncryptedMount(file => { calls.push(file); return file === '/proc/self/mountinfo' ? info : uuid; });
  assert.deepEqual(calls, ['/proc/self/mountinfo', '/sys/dev/block/253:1/dm/uuid']);
});
for (const [name, mount, value] of [['plain ext4', info, ''], ['missing mount', '', uuid],
  ['other mapper', info, uuid.replace('highpass-b-pacs', 'unrelated')], ['ambiguous mount', info + '\n' + info, uuid],
  ['forged PASS', info, '{"encryption":"PASS"}']]) test(`storage refuses ${name}`, () => {
  assert.throws(() => assertBPacsEncryptedMount(file => file === '/proc/self/mountinfo' ? mount : value), /ENCRYPTED_MOUNT/);
});
