import https from 'node:https';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { assertBPacsEncryptedMount } from '../src/b-pacs-storage-boundary.js';

const cert = readFileSync(process.env.B_PACS_TLS_CERT_FILE);
const key = readFileSync(process.env.B_PACS_TLS_KEY_FILE);
const ca = readFileSync(process.env.B_PACS_TLS_CA_FILE);
const acceptedSan = 'URI:spiffe://highpass.local/hospital-b/pacs-receiver';
const routes = (method, path) => (method === 'GET' && (path === '/system' || /^\/instances\/[a-f0-9]{8}(?:-[a-f0-9]{8}){4}(?:\/file)?$/u.test(path)))
  || (method === 'POST' && ['/tools/find', '/instances'].includes(path));
const server = https.createServer({ cert, key, ca, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, async (req, res) => {
  const fail = status => { if (!res.headersSent && !res.destroyed) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end('{"error":"B_PACS_BOUNDARY_DENIED"}'); } };
  const sans = req.socket.getPeerCertificate().subjectaltname?.split(',').map(x => x.trim()) ?? [];
  if (!req.socket.authorized || !sans.includes(acceptedSan)) { req.resume(); return fail(403); }
  if (!routes(req.method, req.url)) { req.resume(); return fail(403); }
  try { assertBPacsEncryptedMount(); } catch { req.resume(); return fail(503); }
  let size = 0; const chunks = [];
  try {
    for await (const chunk of req) { size += chunk.length; if (size > (req.url === '/instances' ? 8388608 : 8192)) return fail(413); chunks.push(chunk); }
    const body = Buffer.concat(chunks);
    if (req.method === 'GET' && size) return fail(400);
    if (req.url === '/tools/find') {
      const query = JSON.parse(body.toString('utf8'));
      if (Object.keys(query).sort().join() !== 'Level,Query' || query.Level !== 'Instance'
        || Object.keys(query.Query ?? {}).join() !== 'SOPInstanceUID' || !/^[0-9]+(?:\.[0-9]+)+$/u.test(query.Query.SOPInstanceUID)
        || query.Query.SOPInstanceUID.length > 64) return fail(400);
    }
    const upstream = http.request({ hostname: 'b-orthanc', port: 8042, method: req.method, path: req.url,
      headers: { 'content-type': req.url === '/instances' ? 'application/dicom' : 'application/json', 'content-length': size } }, incoming => {
      let total = 0;
      res.writeHead(incoming.statusCode, { 'content-type': incoming.headers['content-type'] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      incoming.on('data', chunk => { total += chunk.length; if (total > 8388608) { incoming.destroy(); res.destroy(); } else res.write(chunk); });
      incoming.on('end', () => res.end()); incoming.on('error', () => res.destroy());
    });
    const timer = setTimeout(() => upstream.destroy(), 4000);
    upstream.on('close', () => { clearTimeout(timer); body.fill(0); for (const chunk of chunks) chunk.fill(0); });
    upstream.on('error', () => fail(502)); res.on('close', () => upstream.destroy()); upstream.end(body);
  } catch { fail(400); }
});
server.headersTimeout = 5000; server.requestTimeout = 10000; server.setTimeout(10000, socket => socket.destroy());
server.listen(8443, '0.0.0.0');
