import { readFileSync } from 'node:fs';

// Checked by the B mTLS boundary for EVERY request, not a configuration boolean
// or an old JSON PASS receipt. Only the dedicated encrypted mount is accepted.
export function assertBPacsEncryptedMount(read = file => readFileSync(file, 'utf8'), expectedLuksUuid = process.env.B_PACS_ENCRYPTED_LUKS_UUID) {
  if (typeof expectedLuksUuid !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(expectedLuksUuid)) {
    throw new Error('PACS_ENCRYPTED_MOUNT_REQUIRED');
  }
  const entries = read('/proc/self/mountinfo').split('\n').filter(Boolean).map(line => line.split(' '));
  const matching = entries.filter(fields => fields[4] === '/run/pacs-storage-check');
  if (matching.length !== 1 || !/^\d+:\d+$/u.test(matching[0][2])) throw new Error('PACS_ENCRYPTED_MOUNT_REQUIRED');
  const uuid = read(`/sys/dev/block/${matching[0][2]}/dm/uuid`).trim();
  const expected = `CRYPT-LUKS2-${expectedLuksUuid.replaceAll('-', '')}-highpass-b-pacs`;
  if (uuid !== expected) throw new Error('PACS_ENCRYPTED_MOUNT_REQUIRED');
}
