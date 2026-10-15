import { createHash } from 'node:crypto';
import { request as httpRequest } from 'node:http';

const WORKSPACE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const ALLOWED_RESOURCES = new Set(['KV-HP-DEMO-4869EDD9', 'KV-HP-RECOVER-4869EDD9']);
const KQL = `AzureDiagnostics
| where TimeGenerated >= ago(24h)
| where ResourceProvider == 'MICROSOFT.KEYVAULT' and Category == 'AuditEvent'
| where Resource in~ ('KV-HP-DEMO-4869EDD9','KV-HP-RECOVER-4869EDD9')
| project TimeGenerated, Resource, OperationName, ResultType, ResultSignature, CorrelationId
| order by TimeGenerated desc
| take 100`;

/** Server-side, read-only Key Vault audit query. Never returns the MI token or raw request URI/identity claims. */
export async function listAzureKeyVaultAudit({ env = process.env, fetchImpl = globalThis.fetch, socketRequest = readAuditSocket } = {}) {
  const workspaceId = env.HIPASS_AUDIT_WORKSPACE_ID ?? '';
  if (env.HIPASS_AZURE_AUDIT_MI_ENABLED !== '1' || !workspaceId) {
    return { status: 'not_configured', reason: 'MANAGED_IDENTITY_OR_WORKSPACE_NOT_CONFIGURED', observedAt: new Date().toISOString(), events: [] };
  }
  if (!WORKSPACE_ID_RE.test(workspaceId)) {
    return { status: 'misconfigured', reason: 'WORKSPACE_ID_INVALID', observedAt: new Date().toISOString(), events: [] };
  }

  if (env.HIPASS_AUDIT_SOCKET) {
    if (env.HIPASS_AUDIT_SOCKET !== '/run/security-audit/audit.sock') {
      return { status: 'misconfigured', reason: 'AUDIT_SOCKET_INVALID', observedAt: new Date().toISOString(), events: [] };
    }
    try {
      const result = await socketRequest(env.HIPASS_AUDIT_SOCKET);
      const statuses = ['available', 'not_configured', 'permission_required', 'misconfigured', 'unavailable'];
      if (!statuses.includes(result?.status) || !Array.isArray(result.events)) throw new Error('AUDIT_RELAY_INVALID');
      const events = result.events.slice(0, 100).filter(event => /^[a-f0-9]{24}$/u.test(event.eventRef ?? '')
        && ALLOWED_RESOURCES.has(String(event.resource).toUpperCase()) && Number.isFinite(Date.parse(event.timeGenerated)))
        .map(event => ({ eventRef: event.eventRef, timeGenerated: event.timeGenerated.slice(0, 40),
          resource: String(event.resource).toUpperCase(), operationName: safeText(event.operationName, 120),
          resultType: safeText(event.resultType, 48), resultSignature: safeText(event.resultSignature, 48) }));
      return { status: result.status, reason: /^[A-Z_]{1,80}$/u.test(result.reason ?? '') ? result.reason : null,
        observedAt: Number.isFinite(Date.parse(result.observedAt)) ? result.observedAt : new Date().toISOString(),
        windowHours: 24, events };
    } catch {
      return { status: 'unavailable', reason: 'AUDIT_RELAY_UNAVAILABLE', observedAt: new Date().toISOString(), events: [] };
    }
  }

  try {
    const token = await managedIdentityToken(fetchImpl);
    const response = await fetchImpl(`https://api.loganalytics.azure.com/v1/workspaces/${workspaceId}/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ query: KQL, timespan: 'PT24H' }),
      redirect: 'error',
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      return { status: response.status === 403 ? 'permission_required' : 'unavailable',
        reason: response.status === 403 ? 'LOG_ANALYTICS_READER_REQUIRED' : response.status === 429 ? 'QUERY_THROTTLED' : 'LOG_ANALYTICS_QUERY_FAILED',
        observedAt: new Date().toISOString(), events: [] };
    }
    const payload = await response.json();
    const rows = [];
    for (const table of payload?.tables ?? []) {
      const names = table.columns?.map(column => column.name) ?? [];
      for (const values of table.rows ?? []) rows.push(Object.fromEntries(names.map((name, index) => [name, values[index]])));
    }
    const events = rows.slice(0, 100).map(toSafeEvent).filter(Boolean);
    return { status: 'available', reason: null, observedAt: new Date().toISOString(), windowHours: 24, events };
  } catch (error) {
    const reason = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'AZURE_AUDIT_QUERY_TIMEOUT'
      : error?.message === 'MANAGED_IDENTITY_UNAVAILABLE' ? 'MANAGED_IDENTITY_UNAVAILABLE'
        : 'AZURE_AUDIT_SOURCE_UNAVAILABLE';
    return { status: 'unavailable', reason, observedAt: new Date().toISOString(), events: [] };
  }
}

function readAuditSocket(socketPath) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ socketPath, path: '/keyvault-audit', method: 'GET', timeout: 12000 }, response => {
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 131072) { response.destroy(); request.destroy(new Error('AUDIT_RELAY_TOO_LARGE')); }
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          if (response.statusCode !== 200) throw new Error('AUDIT_RELAY_HTTP_FAILED');
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('AUDIT_RELAY_TIMEOUT')));
    request.on('error', reject);
    request.end();
  });
}

export async function findAzureKeyVaultAuditEvent(eventRef, options = {}) {
  if (typeof eventRef !== 'string' || !/^[a-f0-9]{24}$/u.test(eventRef)) return null;
  const result = await listAzureKeyVaultAudit(options);
  if (result.status !== 'available') return { sourceStatus: result.status };
  return result.events.find(event => event.eventRef === eventRef) ?? null;
}

async function managedIdentityToken(fetchImpl) {
  const url = new URL('http://169.254.169.254/metadata/identity/oauth2/token');
  url.searchParams.set('api-version', '2018-02-01');
  url.searchParams.set('resource', 'https://api.loganalytics.io');
  const response = await fetchImpl(url, { headers: { Metadata: 'true' }, redirect: 'error', signal: AbortSignal.timeout(2500) });
  if (!response.ok) throw new Error('MANAGED_IDENTITY_UNAVAILABLE');
  const body = await response.json();
  if (typeof body?.access_token !== 'string' || !body.access_token) throw new Error('MANAGED_IDENTITY_UNAVAILABLE');
  return body.access_token;
}

function toSafeEvent(row) {
  const resource = String(row.Resource ?? '');
  if (!ALLOWED_RESOURCES.has(resource.toUpperCase())) return null;
  const timeGenerated = typeof row.TimeGenerated === 'string' ? row.TimeGenerated : '';
  if (!Number.isFinite(Date.parse(timeGenerated))) return null;
  const operationName = safeText(row.OperationName, 120);
  const resultType = safeText(row.ResultType, 48) || 'UNKNOWN';
  const rawResultSignature = safeText(row.ResultSignature, 160);
  const resultSignature = /^(?:Succeeded|Success|Failure|Failed|Forbidden|Unauthorized|BadRequest|Conflict|NotFound|InternalServerError)$/iu.test(rawResultSignature)
    ? rawResultSignature : rawResultSignature ? 'OTHER' : '';
  const correlationId = safeText(row.CorrelationId, 128);
  const stableRef = createHash('sha256').update(JSON.stringify([timeGenerated, resource.toUpperCase(), operationName, resultType, resultSignature, correlationId])).digest('hex').slice(0, 24);
  return { eventRef: stableRef, timeGenerated, resource: resource.toUpperCase(), operationName, resultType, resultSignature };
}

function safeText(value, limit) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, limit);
}
