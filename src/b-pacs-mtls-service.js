import https from 'node:https';
import http from 'node:http';

const CLIENT_SAN = 'URI:spiffe://highpass.local/hospital-b/pacs-receiver';
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;
const UID = /^[0-9]+(?:\.[0-9]+)+$/u;
const MAX_DICOM_BYTES = 8 * 1024 * 1024;
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function allowedRoute(method, path) {
  return (method === 'GET' && (path === '/system' || /^\/instances\/[a-f0-9]{8}(?:-[a-f0-9]{8}){4}(?:\/file)?$/u.test(path)))
    || (method === 'POST' && ['/tools/find', '/instances'].includes(path));
}

function reply(response, status, body = '{"error":"B_PACS_BOUNDARY_DENIED"}') {
  if (response.headersSent || response.destroyed) return;
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(body);
}

function validateFindBody(body) {
  try {
    const query = JSON.parse(body.toString('utf8'));
    return Object.keys(query).sort().join() === 'Level,Query' && query.Level === 'Instance'
      && Object.keys(query.Query ?? {}).join() === 'SOPInstanceUID'
      && typeof query.Query.SOPInstanceUID === 'string' && query.Query.SOPInstanceUID.length <= 64
      && UID.test(query.Query.SOPInstanceUID);
  } catch {
    return false;
  }
}

export function forwardToBOrthanc({ method, path, body, signal }) {
  return new Promise((resolve, reject) => {
    const upstream = http.request({ hostname: 'b-orthanc', port: 8042, method, path,
      headers: { 'content-type': path === '/instances' ? 'application/dicom' : 'application/json', 'content-length': body.length } }, incoming => {
      let total = 0;
      const chunks = [];
      const clearChunks = () => { for (const chunk of chunks) chunk.fill(0); };
      incoming.on('data', chunk => {
        total += chunk.length;
        if (total > MAX_RESPONSE_BYTES) {
          incoming.destroy(new Error('B_PACS_UPSTREAM_RESPONSE_LIMIT'));
          return;
        }
        chunks.push(chunk);
      });
      incoming.on('end', () => {
        const responseBody = Buffer.concat(chunks);
        clearChunks();
        resolve({ statusCode: incoming.statusCode ?? 502,
          contentType: incoming.headers['content-type'] ?? 'application/octet-stream', body: responseBody });
      });
      incoming.on('aborted', () => { clearChunks(); reject(new Error('B_PACS_UPSTREAM_INTERRUPTED')); });
      incoming.on('error', error => {
        clearChunks();
        reject(error);
      });
    });
    const timer = setTimeout(() => upstream.destroy(new Error('B_PACS_UPSTREAM_TIMEOUT')), 4000);
    upstream.on('close', () => clearTimeout(timer));
    upstream.on('error', reject);
    signal?.addEventListener('abort', () => upstream.destroy(new Error('B_PACS_CLIENT_DISCONNECTED')), { once: true });
    upstream.end(body);
  });
}

export function createBPacsMtlsHandler({ expectedLuksUuid, assertStorageReady, forward = forwardToBOrthanc }) {
  if (!UUID.test(expectedLuksUuid ?? '') || typeof assertStorageReady !== 'function' || typeof forward !== 'function') {
    throw new TypeError('B_PACS_MTLS_DEPENDENCIES_REQUIRED');
  }

  return async (request, response) => {
    const san = request.socket.getPeerCertificate().subjectaltname?.split(',').map(value => value.trim()) ?? [];
    if (!request.socket.authorized || !san.includes(CLIENT_SAN)) {
      request.resume();
      reply(response, 403);
      return;
    }
    if (!allowedRoute(request.method, request.url)) {
      request.resume();
      reply(response, 403);
      return;
    }
    try {
      await assertStorageReady(expectedLuksUuid);
    } catch {
      request.resume();
      reply(response, 503);
      return;
    }

    const limit = request.url === '/instances' ? MAX_DICOM_BYTES : 8192;
    let length = 0;
    let body = null;
    const chunks = [];
    try {
      for await (const chunk of request) {
        length += chunk.length;
        if (length > limit) {
          chunk.fill(0);
          for (const part of chunks) part.fill(0);
          request.resume();
          reply(response, 413);
          return;
        }
        chunks.push(Buffer.from(chunk));
        chunk.fill(0);
      }
      if (request.method === 'GET' && length !== 0) {
        reply(response, 400);
        return;
      }
      body = Buffer.concat(chunks);
      if (request.url === '/tools/find' && !validateFindBody(body)) {
        body.fill(0);
        reply(response, 400);
        return;
      }
      const controller = new AbortController();
      response.once('close', () => { if (!response.writableFinished) controller.abort(); });
      const result = await forward({ method: request.method, path: request.url, body, signal: controller.signal });
      const resultBody = Buffer.isBuffer(result?.body) ? result.body : null;
      if (!Number.isInteger(result?.statusCode) || !resultBody || resultBody.length > MAX_RESPONSE_BYTES) {
        resultBody?.fill(0);
        reply(response, 502);
      } else if (!response.destroyed) {
        response.writeHead(result.statusCode, { 'content-type': result.contentType ?? 'application/octet-stream', 'cache-control': 'no-store' });
        response.once('close', () => { if (!response.writableFinished) resultBody.fill(0); });
        response.end(resultBody, () => resultBody.fill(0));
      } else resultBody.fill(0);
    } catch {
      reply(response, 502);
    } finally {
      body?.fill(0);
      for (const chunk of chunks) chunk.fill(0);
    }
  };
}

export function createBPacsMtlsServer({ cert, key, ca, expectedLuksUuid, assertStorageReady, forward }) {
  const handler = createBPacsMtlsHandler({ expectedLuksUuid, assertStorageReady, ...(forward ? { forward } : {}) });
  return https.createServer({ cert, key, ca, requestCert: true, rejectUnauthorized: true, minVersion: 'TLSv1.2' }, handler);
}
