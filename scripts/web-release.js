import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import { pathToFileURL } from 'node:url';

const VERSION = 'web-release.js';
const SCHEMA = 'hipass-web-release/v1';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => JSON.stringify(value);
const allowed = name => !name.startsWith('assets/clinical/') &&
  (/\.(html|js|css|png|jpg|jpeg|webp|svg|ico|woff2)$/.test(name) || name === 'mobile/manifest.json');

async function files(root, prefix = '') {
  const result = [];
  for (const entry of await readdir(path.join(root, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isSymbolicLink()) throw new Error('SYMLINK_NOT_ALLOWED');
    if (entry.isDirectory()) result.push(...await files(root, name + '/'));
    else if (entry.isFile() && allowed(name) && name !== VERSION) result.push(name);
  }
  return result.sort();
}

function safeName(name) {
  return /^[A-Za-z0-9_./-]+$/.test(name) && !name.startsWith('/') &&
    !name.split('/').some(part => part === '..' || part === '.' || part === '') && allowed(name);
}

export async function stage(source, destination) {
  source = path.resolve(source);
  destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error('DESTINATION_INSIDE_SOURCE');
  const names = await files(source);
  if (!names.includes('index.html') || !names.includes('mobile/index.html') || !names.includes('mobile/sw.js')) throw new Error('COMPLETE_WEB_REQUIRED');
  const bytes = new Map();
  const sourceHashes = {};
  for (const name of names) {
    if (!safeName(name)) throw new Error('INVALID_ASSET_PATH');
    const data = await readFile(path.join(source, name));
    bytes.set(name, data);
    sourceHashes[name] = sha(data);
  }
  if (encode(await files(source)) !== encode(names)) throw new Error('SOURCE_CHANGED_DURING_CAPTURE');
  for (const name of names) {
    if (sha(await readFile(path.join(source, name))) !== sourceHashes[name]) throw new Error('SOURCE_CHANGED_DURING_CAPTURE');
  }
  const releaseId = sha(encode({ schema: SCHEMA, sourceHashes }));
  const sw = bytes.get('mobile/sw.js').toString('utf8');
  if (!/const CACHE_NAME = "hipass-mediq-shell-[^"]+";/.test(sw)) throw new Error('CACHE_VERSION_NOT_FOUND');
  bytes.set('mobile/sw.js', Buffer.from(sw.replace(/const CACHE_NAME = "hipass-mediq-shell-[^"]+";/,
    `const CACHE_NAME = "hipass-mediq-shell-${releaseId}";`)));
  bytes.set(VERSION, Buffer.from('export default ' + encode({ schema: SCHEMA, releaseId }) + ';\n'));
  const hashes = {};
  for (const name of [...bytes.keys()].sort()) hashes[name] = sha(bytes.get(name));
  // Refuse overwriting any prior release, including an incomplete capture.
  await mkdir(destination);
  for (const [name, data] of bytes) {
    const target = path.join(destination, 'public', name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: 'wx' });
  }
  const manifest = { schema: SCHEMA, releaseId, sourceHashes, hashes, scope: 'STATIC_WEB_ONLY' };
  await writeFile(path.join(destination, 'manifest.json'), encode(manifest) + '\n', { flag: 'wx' });
  await validate(destination);
  return manifest;
}

export async function validate(folder) {
  const manifest = JSON.parse(await readFile(path.join(folder, 'manifest.json'), 'utf8'));
  if (manifest.schema !== SCHEMA || !/^[a-f0-9]{64}$/.test(manifest.releaseId)) throw new Error('INVALID_MANIFEST');
  if (sha(encode({ schema: SCHEMA, sourceHashes: manifest.sourceHashes })) !== manifest.releaseId) throw new Error('INVALID_RELEASE_ID');
  const names = Object.keys(manifest.hashes);
  if (encode(names.slice().sort()) !== encode([...Object.keys(manifest.sourceHashes), VERSION].sort())) throw new Error('INCOMPLETE_MANIFEST');
  const actual = [...await files(path.join(folder, 'public')), VERSION].sort();
  if (encode(actual) !== encode(names.slice().sort())) throw new Error('UNDECLARED_OR_MISSING_ASSET');
  for (const name of names) {
    if (!safeName(name)) throw new Error('INVALID_ASSET_PATH');
    const bytes = await readFile(path.join(folder, 'public', name));
    if (sha(bytes) !== manifest.hashes[name]) throw new Error('RELEASE_BYTES_CHANGED:' + name);
    if (name !== VERSION && name !== 'mobile/sw.js' && sha(bytes) !== manifest.sourceHashes[name]) throw new Error('SOURCE_HASH_MISMATCH');
    if (name === VERSION && bytes.toString() !== 'export default ' + encode({ schema: SCHEMA, releaseId: manifest.releaseId }) + ';\n') throw new Error('VERSION_MISMATCH');
    if (name === 'mobile/sw.js' && !bytes.toString().includes(`const CACHE_NAME = "hipass-mediq-shell-${manifest.releaseId}";`)) throw new Error('CACHE_MISMATCH');
  }
  return manifest;
}

function fetchBytes(url, ca) {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.get(url, { ca, headers: { 'Cache-Control': 'no-cache' } }, response => {
      if (response.statusCode !== 200) { response.resume(); reject(new Error('HTTP_' + response.statusCode)); return; }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 32 * 1024 * 1024) response.destroy(new Error('ASSET_TOO_LARGE'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.setTimeout(10000, () => request.destroy(new Error('TIMEOUT')));
    request.on('error', reject);
  });
}

export async function verify(folder, origins, ca) {
  const manifest = await validate(folder);
  if (!origins.length) throw new Error('ORIGIN_REQUIRED');
  const results = [];
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) throw new Error('HTTPS_ORIGIN_REQUIRED');
    const differences = [];
    for (const [name, digest] of Object.entries(manifest.hashes)) {
      try {
        let data = await fetchBytes(new URL('/' + name, url), ca);
        // B injects only this known environment marker; application bytes must otherwise match.
        if (name === 'index.html' || name === 'mobile/index.html') data = Buffer.from(data.toString('utf8').replace('<html lang="ko" data-capstone="1">', '<html lang="ko">'));
        if (sha(data) !== digest) differences.push({ asset: name, reason: 'CONTENT_MISMATCH' });
      } catch (error) { differences.push({ asset: name, reason: error.code || error.message }); }
    }
    results.push({ origin: url.origin, status: differences.length ? 'FAIL' : 'PASS', differences });
  }
  return { scope: 'STATIC_WEB_ONLY', releaseId: manifest.releaseId, status: results.every(r => r.status === 'PASS') ? 'PASS' : 'FAIL', servers: results };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const reportAt = args.indexOf('--report');
  let report;
  if (reportAt >= 0) {
    report = args[reportAt + 1];
    if (!report) throw new Error('REPORT_PATH_REQUIRED');
    args.splice(reportAt, 2);
  }
  let result;
  if (command === 'stage' && args.length === 2) result = await stage(...args);
  else if (command === 'validate' && args.length === 1) result = await validate(args[0]);
  else if (command === 'verify') {
    const caAt = args.indexOf('--ca');
    let ca;
    if (caAt >= 0) { ca = await readFile(args[caAt + 1]); args.splice(caAt, 2); }
    result = await verify(args[0], args.slice(1), ca);
  } else throw new Error('Usage: web-release.js stage PUBLIC DEST | validate DEST | verify DEST HTTPS_ORIGIN... [--ca FILE] [--report FILE]');
  if (report) {
    await mkdir(path.dirname(path.resolve(report)), { recursive: true });
    await writeFile(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify(result, null, 2));
  if (result.status === 'FAIL') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
