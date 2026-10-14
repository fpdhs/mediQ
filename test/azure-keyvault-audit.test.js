import test from 'node:test';
import assert from 'node:assert/strict';
import { listAzureKeyVaultAudit } from '../src/azure-keyvault-audit.js';

const workspaceId = '21d34104-2703-491f-a2c1-b74f6ac6bf07';
const enabled = { HIPASS_AZURE_AUDIT_MI_ENABLED: '1', HIPASS_AUDIT_WORKSPACE_ID: workspaceId };

test('Azure Key Vault query stays disabled without explicit server-side MI configuration', async () => {
  let called = false;
  const result = await listAzureKeyVaultAudit({ env: {}, fetchImpl: async () => { called = true; } });
  assert.equal(result.status, 'not_configured');
  assert.equal(called, false);
});

test('isolated Control reads only the fixed Unix socket and filters relay response fields', async () => {
  const result = await listAzureKeyVaultAudit({ env: { ...enabled, HIPASS_AUDIT_SOCKET: '/run/security-audit/audit.sock' },
    fetchImpl: async () => { throw new Error('Control must stay isolated'); },
    socketRequest: async socket => {
      assert.equal(socket, '/run/security-audit/audit.sock');
      return { status: 'available', observedAt: '2026-10-14T04:00:00Z', access_token: 'never-return', events: [
        { eventRef: 'a'.repeat(24), resource: 'KV-HP-DEMO-4869EDD9', timeGenerated: '2026-10-14T03:00:00Z', operationName: 'SecretGet', resultType: 'Success', resultSignature: 'Succeeded', CorrelationId: 'private' },
        { eventRef: 'b'.repeat(24), resource: 'OTHER', timeGenerated: '2026-10-14T03:00:00Z' },
      ] };
    } });
  assert.equal(result.status, 'available');
  assert.equal(result.events.length, 1);
  assert.equal(JSON.stringify(result).includes('never-return'), false);
  assert.equal(JSON.stringify(result).includes('CorrelationId'), false);
  const denied = await listAzureKeyVaultAudit({ env: { ...enabled, HIPASS_AUDIT_SOCKET: '/tmp/other.sock' } });
  assert.equal(denied.status, 'misconfigured');
  const failed = await listAzureKeyVaultAudit({ env: { ...enabled, HIPASS_AUDIT_SOCKET: '/run/security-audit/audit.sock' },
    socketRequest: async () => { throw new Error('connection failure'); } });
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.reason, 'AUDIT_RELAY_UNAVAILABLE');
});

test('Azure Key Vault query uses managed identity and returns bounded, privacy-filtered events', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return { ok: true, json: async () => ({ access_token: 'never-return-this-token' }) };
    return { ok: true, json: async () => ({ tables: [{ columns: ['TimeGenerated', 'Resource', 'OperationName', 'ResultType', 'ResultSignature', 'CorrelationId'].map(name => ({ name })), rows: [
      ['2026-10-14T00:00:00Z', 'KV-HP-DEMO-4869EDD9', 'SecretGet', 'Success', 'Succeeded', 'correlation-secret'],
      ['2026-10-14T00:01:00Z', 'UNAPPROVED-VAULT', 'SecretGet', 'Success', 'Succeeded', 'other'],
      ['2026-10-14T00:02:00Z', 'KV-HP-RECOVER-4869EDD9', 'KeyGet', 'Failure', 'raw user payload', 'correlation-private'],
    ] }] }) };
  };

  const result = await listAzureKeyVaultAudit({ env: enabled, fetchImpl });
  assert.equal(result.status, 'available');
  assert.equal(result.windowHours, 24);
  assert.equal(result.events.length, 2);
  assert.equal(result.events[0].resource, 'KV-HP-DEMO-4869EDD9');
  assert.equal(result.events[0].resultSignature, 'Succeeded');
  assert.equal(result.events[1].resultSignature, 'OTHER');
  assert.equal(JSON.stringify(result).includes('correlation-secret'), false);
  assert.equal(JSON.stringify(result).includes('never-return-this-token'), false);
  assert.equal(JSON.stringify(result).includes('raw user payload'), false);
  assert.match(calls[0].url, /169\.254\.169\.254/u);
  assert.match(calls[1].url, new RegExp(workspaceId, 'u'));
  assert.match(calls[1].options.body, /take 100/u);
  assert.equal(calls[1].options.redirect, 'error');
});

test('Azure workspace configuration is validated and insufficient role is not shown as empty results', async () => {
  const invalid = await listAzureKeyVaultAudit({ env: { ...enabled, HIPASS_AUDIT_WORKSPACE_ID: 'not-a-guid' }, fetchImpl: async () => { throw new Error('should not call'); } });
  assert.equal(invalid.status, 'misconfigured');

  let calls = 0;
  const denied = await listAzureKeyVaultAudit({ env: enabled, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return { ok: true, json: async () => ({ access_token: 'test-token' }) };
    return { ok: false, status: 403 };
  } });
  assert.equal(denied.status, 'permission_required');
  assert.equal(denied.events.length, 0);
});
