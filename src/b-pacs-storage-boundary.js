import { readFileSync } from 'node:fs';

// Checked by the B mTLS boundary for EVERY request, not a configuration boolean
// or an old JSON PASS receipt. Only the dedicated encrypted mount is accepted.
export function assertBPacsEncryptedMount(read = file => readFileSync(file, 'utf8')) {
  const entries = read('/proc/self/mountinfo').split('\n').filter(Boolean).map(line => line.split(' '));
  const matching = entries.filter(fields => fields[4] === '/run/pacs-storage-check');
  if (matching.length !== 1 || !/^\d+:\d+$/u.test(matching[0][2])) throw new Error('PACS_ENCRYPTED_MOUNT_REQUIRED');
  const uuid = read(`/sys/dev/block/${matching[0][2]}/dm/uuid`).trim();
  if (!/^CRYPT-LUKS[12]-[a-f0-9]{32}-highpass-b-pacs$/u.test(uuid)) throw new Error('PACS_ENCRYPTED_MOUNT_REQUIRED');
}
