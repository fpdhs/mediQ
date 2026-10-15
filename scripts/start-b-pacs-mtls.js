import { readFileSync } from 'node:fs';
import { assertBPacsEncryptedMount } from '../src/b-pacs-storage-boundary.js';
import { createBPacsMtlsServer } from '../src/b-pacs-mtls-service.js';

class StartupError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function readSecret(environmentName, expectedPath) {
  if (process.env[environmentName] !== expectedPath) throw new StartupError('PACS_MTLS_SECRET_CONFIGURATION_REQUIRED');
  try { return readFileSync(expectedPath); }
  catch { throw new StartupError('PACS_MTLS_SECRET_UNAVAILABLE'); }
}

try {
  const expectedLuksUuid = process.env.B_PACS_ENCRYPTED_LUKS_UUID;
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(expectedLuksUuid ?? '')) {
    throw new StartupError('PACS_ENCRYPTED_MOUNT_REQUIRED');
  }
  const cert = readSecret('B_PACS_TLS_CERT_FILE', '/run/secrets/b-pacs-server.crt');
  const key = readSecret('B_PACS_TLS_KEY_FILE', '/run/secrets/b-pacs-server.key');
  const ca = readSecret('B_PACS_TLS_CA_FILE', '/run/secrets/ca.crt');
  try { assertBPacsEncryptedMount(undefined, expectedLuksUuid); }
  catch { throw new StartupError('PACS_ENCRYPTED_MOUNT_NOT_READY'); }

  const server = createBPacsMtlsServer({ cert, key, ca, expectedLuksUuid,
    assertStorageReady: uuid => assertBPacsEncryptedMount(undefined, uuid) });
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  server.setTimeout(10000, socket => socket.destroy());
  server.once('error', () => process.stderr.write('PACS_MTLS_LISTENER_FAILED\n', () => process.exit(1)));
  server.listen(8443, '0.0.0.0');
} catch (error) {
  const code = error instanceof StartupError ? error.code : 'PACS_MTLS_STARTUP_FAILED';
  process.stderr.write(`${code}\n`);
  process.exitCode = 1;
}
