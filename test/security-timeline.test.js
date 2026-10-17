import test from 'node:test';
import assert from 'node:assert/strict';
import {auditEvent,auditModels} from '../public/ui/security-timeline.js';
test('denial differs from error; unknown is not success',()=>{
  assert.equal(auditEvent({result:'DENIED'}).kind,'denied');
  assert.equal(auditEvent({result:'ERROR'}).kind,'error');
  assert.equal(auditEvent({result:'NEW'}).kind,'unknown');
});
test('missing reason, session and timestamp stay unknown',()=>{
  const row=auditEvent({});assert.equal(row.session,'unlinked');assert.equal(row.date,'시각 미확인');assert.equal(row.reason,'사유 코드 미제공');
});
test('only supplied records sorted, no manufactured stages',()=>{
  const rows=auditModels([{timestamp:'2026-10-13T01:00:00Z',action:'IMAGE_VIEWED'},{timestamp:'2026-10-12T01:00:00Z',action:'ACCESS_CHECK'}]);
  assert.equal(rows.length,2);assert.equal(rows[0].action,'ACCESS_CHECK');assert.match(auditEvent({result:'SUCCESS'}).description,/전체 완료를 뜻하지/);
});
