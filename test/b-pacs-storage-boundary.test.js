import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBPacsEncryptedMount } from '../src/b-pacs-storage-boundary.js';

const info = '42 31 253:1 / /run/pacs-storage-check ro - ext4 /dev/mapper/highpass-b-pacs rw';
const expectedLuksUuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const uuid = 'CRYPT-LUKS2-' + expectedLuksUuid.replaceAll('-', '') + '-highpass-b-pacs';
test('storage boundary reads exact mounted block device encryption, not a JSON PASS flag', () => {
  const calls = [];
  assertBPacsEncryptedMount(file => { calls.push(file); return file === '/proc/self/mountinfo' ? info : uuid; }, expectedLuksUuid);
  assert.deepEqual(calls, ['/proc/self/mountinfo', '/sys/dev/block/253:1/dm/uuid']);
});
for (const [name, mount, value, expected] of [['plain ext4', info, '', expectedLuksUuid], ['missing mount', '', uuid, expectedLuksUuid],
  ['other mapper', info, uuid.replace('highpass-b-pacs', 'unrelated'), expectedLuksUuid], ['different encrypted volume', info, uuid.replace(/a/g, 'b'), expectedLuksUuid],
  ['ambiguous mount', info + '\n' + info, uuid, expectedLuksUuid], ['forged PASS', info, '{"encryption":"PASS"}', expectedLuksUuid],
  ['missing expected UUID', info, uuid, undefined], ['malformed expected UUID', info, uuid, 'not-a-uuid']]) test(`storage refuses ${name}`, () => {
  assert.throws(() => assertBPacsEncryptedMount(file => file === '/proc/self/mountinfo' ? mount : value, expected), /ENCRYPTED_MOUNT/);
});
