// Private Unix-socket reader. No TCP listener, arbitrary URL, query, or token API.
import { createServer } from 'node:http';
import { chmodSync, existsSync, lstatSync, unlinkSync } from 'node:fs';
import { listAzureKeyVaultAudit } from '../src/azure-keyvault-audit.js';
import { listEntraAudit } from '../src/entra-audit.js';

const socket = '/run/security-audit/audit.sock';
if (process.env.HIPASS_AUDIT_SOCKET) throw new Error('RELAY_SOCKET_RECURSION_DENIED');
if (existsSync(socket)) {
  if (!lstatSync(socket).isSocket()) throw new Error('UNEXPECTED_AUDIT_SOCKET_PATH');
  unlinkSync(socket);
}
const busy = new Set();
const caches=new Map();
const server = createServer(async (request, response) => {
  response.setHeader('content-type', 'application/json');
  response.setHeader('cache-control', 'no-store');
  if (request.method !== 'GET' || !['/health', '/keyvault-audit', '/entra-audit'].includes(request.url)) {
    response.writeHead(403); response.end('{"error":"AUDIT_RELAY_ROUTE_DENIED"}'); return;
  }
  if (request.url === '/health') { response.end('{"status":"UP"}'); return; }
  const cached=caches.get(request.url);
  if (cached && Date.now() - cached.at < 15000) { response.end(JSON.stringify(cached.result)); return; }
  if (busy.has(request.url)) { response.writeHead(429); response.end('{"error":"AUDIT_QUERY_BUSY"}'); return; }
  busy.add(request.url);
  try {
    const result = await (request.url==='/entra-audit'?listEntraAudit():listAzureKeyVaultAudit());
    if (result.status === 'available') caches.set(request.url,{ at: Date.now(), result });
    response.end(JSON.stringify(result));
  } catch { response.writeHead(503); response.end('{"error":"AUDIT_RELAY_UNAVAILABLE"}'); }
  finally { busy.delete(request.url); }
});
server.requestTimeout = 15000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
server.listen(socket, () => chmodSync(socket, 0o660));
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close(() => process.exit(0)));
