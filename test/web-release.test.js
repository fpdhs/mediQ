import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { stage, validate, verify } from '../scripts/web-release.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'hipass-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  await mkdir(path.join(source, 'mobile'), { recursive: true });
  await writeFile(path.join(source, 'index.html'), '<html lang="ko">patient and doctor</html>');
  await writeFile(path.join(source, 'mobile/index.html'), '<html lang="ko">mobile</html>');
  await writeFile(path.join(source, 'mobile/sw.js'), 'const CACHE_NAME = "hipass-mediq-shell-v39";');
  return { root, source, folder: path.join(root, 'release') };
}

async function serve(t, folder, mode) {
  const server = http.createServer(async (req, res) => {
    try {
      if (mode === 'redirect') { res.writeHead(302, { location: '/login' }); res.end(); return; }
      if (mode === 'missing' && req.url === '/mobile/sw.js') { res.writeHead(404); res.end(); return; }
      let bytes = await readFile(path.join(folder, 'public', req.url));
      if (req.url === '/index.html' && mode === 'injected') bytes = Buffer.from(bytes.toString().replace('<html lang="ko">', '<html lang="ko" data-capstone="1">'));
      if (req.url === '/index.html' && mode === 'old') bytes = Buffer.from('old website');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('one content-addressed release includes mobile and web; no overwrite', async t => {
  const f = await fixture(t);
  const a = await stage(f.source, f.folder);
  const b = await stage(f.source, path.join(f.root, 'second'));
  assert.equal(a.releaseId, b.releaseId);
  assert.match(await readFile(path.join(f.folder, 'public/mobile/sw.js'), 'utf8'), new RegExp(a.releaseId));
  await assert.rejects(stage(f.source, f.folder), /EEXIST/);
  await writeFile(path.join(f.source, 'index.html'), 'new patient screen');
  const c = await stage(f.source, path.join(f.root, 'third'));
  assert.notEqual(a.releaseId, c.releaseId);
});

test('modified and undeclared bundle files fail validation', async t => {
  const f = await fixture(t);
  await stage(f.source, f.folder);
  await writeFile(path.join(f.folder, 'public/index.html'), 'tampered');
  await assert.rejects(validate(f.folder), /RELEASE_BYTES_CHANGED/);
  const second = path.join(f.root, 'second');
  await stage(f.source, second);
  await writeFile(path.join(second, 'public/extra.js'), 'extra');
  await assert.rejects(validate(second), /UNDECLARED_OR_MISSING_ASSET/);
});

test('all servers must match; injected environment marker is accepted, old screen is not', async t => {
  const f = await fixture(t);
  await stage(f.source, f.folder);
  const correct = await serve(t, f.folder, 'injected');
  const old = await serve(t, f.folder, 'old');
  assert.equal((await verify(f.folder, [correct])).status, 'PASS');
  const report = await verify(f.folder, [correct, old]);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.servers[0].status, 'PASS');
  assert.deepEqual(report.servers[1].differences, [{ asset: 'index.html', reason: 'CONTENT_MISMATCH' }]);
});

test('missing assets and redirects cannot be attested as same version', async t => {
  const f = await fixture(t);
  await stage(f.source, f.folder);
  const missing = await serve(t, f.folder, 'missing');
  const redirect = await serve(t, f.folder, 'redirect');
  const report = await verify(f.folder, [missing, redirect]);
  assert.equal(report.status, 'FAIL');
  assert.equal(report.servers[0].differences[0].reason, 'HTTP_404');
  assert.ok(report.servers[1].differences.every(d => d.reason === 'HTTP_302'));
});

test('public HTTP and credential-bearing URLs rejected; clinical assets not packaged', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.source, 'assets/clinical'), { recursive: true });
  await writeFile(path.join(f.source, 'assets/clinical/private.png'), 'not public');
  const manifest = await stage(f.source, f.folder);
  assert.ok(!Object.hasOwn(manifest.hashes, 'assets/clinical/private.png'));
  await assert.rejects(verify(f.folder, ['http://example.com']), /HTTPS_ORIGIN_REQUIRED/);
  await assert.rejects(verify(f.folder, ['https://user:secret@example.com']), /HTTPS_ORIGIN_REQUIRED/);
  await assert.rejects(verify(f.folder, []), /ORIGIN_REQUIRED/);
});
