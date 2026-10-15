import test from 'node:test';
import assert from 'node:assert/strict';
import { toSecurityAuditView } from '../src/security-observatory-view.js';

test('security view emits the allowlisted audit fields and redacts free-text reasons and identifiers', () => {
  const view = toSecurityAuditView({
    auditId: 'audit-123', auditSessionId: 'session-123', actorType: 'DOCTOR',
    actorId: 'patient@example.test', hospitalId: '<img src=x>', action: 'ACCESS_DENIED', result: 'FAIL',
    reason: 'Patient Hong Gil-dong AFP result 999', createdAt: '2026-10-14T00:00:00.000Z',
    patientId: 'MEDIQ-SYN-HCC-001', studyInstanceUid: '1.2.3.4', ipAddress: '192.0.2.1',
  });

  assert.deepEqual(view, {
    auditId: 'audit-123', auditSessionId: 'session-123', actorType: 'DOCTOR', actorId: 'REDACTED',
    hospitalId: 'UNKNOWN', action: 'ACCESS_DENIED', result: 'FAIL', reasonCode: 'DETAILS_REDACTED',
    createdAt: '2026-10-14T00:00:00.000Z',
  });
  assert.equal(JSON.stringify(view).includes('Hong'), false);
  assert.equal(JSON.stringify(view).includes('1.2.3.4'), false);
});

test('security view keeps reason codes but never exposes serialized review notes as a reason', () => {
  assert.equal(toSecurityAuditView({ reasonCode: 'TOKEN_EXPIRED' }).reasonCode, 'TOKEN_EXPIRED');
  assert.equal(toSecurityAuditView({ reason: 'SECURITY_REVIEW:{"note":"private detail"}' }).reasonCode, 'SECURITY_REVIEW_RECORDED');
});
