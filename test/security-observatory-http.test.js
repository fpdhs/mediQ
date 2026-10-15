import test from 'node:test';
import assert from 'node:assert/strict';
import { startIsolatedServer, boundedFetch } from '../scripts/test-support/isolated-server.js';

test('security overview is server-authorized and distinguishes unavailable Azure logs from an empty feed', { timeout: 20000 }, async t => {
  const baseUrl = await startIsolatedServer(t);
  const anonymous = await boundedFetch(`${baseUrl}/api/security/overview`);
  assert.equal(anonymous.status, 401);

  for (const role of ['PATIENT', 'DOCTOR']) {
    const identity = role === 'PATIENT' ? { 'x-hipass-patient-id': 'SYNTHETIC-P1' }
      : { 'x-hipass-doctor-id': 'DOC-B-01', 'x-hipass-hospital-id': 'HOSP-B' };
    const denied = await boundedFetch(`${baseUrl}/api/security/overview`, { headers: { 'x-hipass-role': role, 'x-hipass-user-id': `test-${role}`, ...identity } });
    assert.equal(denied.status, 403, await denied.text());
  }

  const allowed = await boundedFetch(`${baseUrl}/api/security/overview`, { headers: { 'x-hipass-role': 'SECURITY_ADMIN', 'x-hipass-user-id': 'synthetic-security-auditor' } });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
  const overview = await allowed.json();
  assert.equal(overview.applicationAudit.status, 'available');
  assert.equal(overview.azureKeyVaultAudit.status, 'not_configured');
  assert.ok(Array.isArray(overview.applicationAudit.events));
  assert.ok(Array.isArray(overview.applicationAudit.alerts));
  assert.equal(JSON.stringify(overview).includes('access_token'), false);
  const adminHeaders = { 'x-hipass-role': 'SECURITY_ADMIN', 'x-hipass-user-id': 'synthetic-security-auditor' };
  const deniedEvent = overview.applicationAudit.alerts.find(event => event.action === 'SECURITY_CONSOLE_DENIED');
  assert.ok(deniedEvent, 'role denial must be recorded without exposing the protected feed');
  const review = { source: 'APP', eventRef: deniedEvent.auditId, status: 'REVIEWED', note: '역할 제한 정상 동작 확인' };
  const refused = await boundedFetch(`${baseUrl}/api/security/reviews`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hipass-role': 'PATIENT', 'x-hipass-user-id': 'test-PATIENT', 'x-hipass-patient-id': 'SYNTHETIC-P1' },
    body: JSON.stringify(review) });
  assert.equal(refused.status, 403);
  const bad = await boundedFetch(`${baseUrl}/api/security/reviews`, { method: 'POST', headers: { ...adminHeaders, 'content-type': 'application/json' },
    body: JSON.stringify({ ...review, note: 'patient@example.com' }) });
  assert.equal(bad.status, 400);
  const saved = await boundedFetch(`${baseUrl}/api/security/reviews`, { method: 'POST', headers: { ...adminHeaders, 'content-type': 'application/json' },
    body: JSON.stringify(review) });
  assert.equal(saved.status, 201);
  const refreshed = await boundedFetch(`${baseUrl}/api/security/overview`, { headers: adminHeaders });
  const result = await refreshed.json();
  assert.ok(result.reviews.some(item => item.eventRef === deniedEvent.auditId && item.status === 'REVIEWED'));
  assert.ok(result.applicationAudit.events.some(item => item.action === 'SECURITY_OVERVIEW_READ'));
  assert.ok(result.applicationAudit.events.some(item => item.auditId === deniedEvent.auditId), 'review must preserve the original event');
});
