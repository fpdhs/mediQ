import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { loadPinnedBImportManifest } from '../src/b-pacs-receiver.js';

const tests = ['b-pacs-receiver', 'b-pacs-authority', 'b-pacs-portal', 'b-pacs-storage-boundary',
  'data-plane-authorization', 'data-plane-gateway', 'consent-bound-key-release', 'key-release-http-handler',
  'capstone-encrypted-transfer', 'capstone-b-portal', 'patient-self-view-authorization', 'patient-data-plane-gateway', 'patient-bound-key-release'];
const files = ['Dockerfile.b-pacs-receiver', 'Dockerfile.b-pacs-receiver.dockerignore', 'src/b-pacs-receiver.js', 'src/b-pacs-storage-boundary.js', 'src/data-plane-authorization.js',
  'src/data-plane-gateway.js', 'src/capstone-encrypted-transfer.js', 'src/consent-bound-key-release.js',
  'src/key-release-http-handler.js', 'src/capstone-b-portal.js', 'src/server.js', 'scripts/start-capstone-b-portal.js',
  'scripts/start-b-pacs-mtls.js', 'orthanc/hospital-b-receiver.json', 'infra/workstation/hospital-b-pacs-receiver.compose.yml',
  'infra/workstation/hospital-b-pacs-portal.compose.yml'];
const sha = body => createHash('sha256').update(body).digest('hex');
const folder = path.resolve('artifacts/workstation', 'b-pacs-candidate-' + new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(folder, { recursive: false });
const start = Date.now();
const command = ['--test', '--test-concurrency=4', ...tests.map(name => 'test/' + name + '.test.js')];
const result = spawnSync(process.execPath, command, { encoding: 'utf8', timeout: 120000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const log = (result.stdout ?? '') + (result.stderr ?? '');
writeFileSync(path.join(folder, 'tests.txt'), log);
const summary = { review: 'DRAFT / UNASSIGNED', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()), observedAt: new Date().toISOString(),
  command: [process.execPath, ...command], exitCode: result.status, durationMs: Date.now() - start,
  tests: Number(log.match(/(?:#|ℹ) tests (\d+)/u)?.[1] ?? 0), pass: Number(log.match(/(?:#|ℹ) pass (\d+)/u)?.[1] ?? 0),
  fail: Number(log.match(/(?:#|ℹ) fail (\d+)/u)?.[1] ?? 0), sourceHashes: Object.fromEntries(files.map(file => [file, sha(readFileSync(file))])),
  deployed: false, live700Transfer: 'NOT VERIFIED' };
const dataset = path.resolve('artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010');
const manifest = JSON.parse(readFileSync(path.join(dataset, 'manifest.json')));
const lookup = loadPinnedBImportManifest(path.join(dataset, 'manifest.json'));
let verified = 0, bytes = 0;
const hashStart = Date.now();
for (const row of manifest.instances) {
  const file = path.resolve(dataset, row.file);
  if (!file.startsWith(dataset + path.sep)) throw new Error('SOURCE_PATH_OUTSIDE_DATASET');
  const body = readFileSync(file), expected = lookup(row.sopInstanceUID);
  const match = body.length === expected.bytes && sha(body) === expected.sha256; body.fill(0);
  if (!match) throw new Error('SOURCE_RAW_HASH_MISMATCH');
  verified++; bytes += expected.bytes;
}
summary.localSourceHashes = { status: 'PASS', verified, bytes, durationMs: Date.now() - hashStart,
  scope: 'RAW_FILE_HASHES_NOT_LIVE_PACS_VERIFICATION' };
writeFileSync(path.join(folder, 'result.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, sourceHashes: undefined, evidence: path.join(folder, 'result.json') }));
process.exitCode = result.status === 0 && summary.fail === 0 ? 0 : 1;
