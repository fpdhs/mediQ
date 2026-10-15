import test from 'node:test';
import assert from 'node:assert/strict';
import {transferTrackingModel} from '../public/ui/transfer-tracking.js';

test('empty inventory is not PACS completion or transfer failure', () => {
  const model = transferTrackingModel();
  assert.equal(model.count, '0');
  assert.equal(model.allowTool, false);
  assert.equal(model.steps[3][1], 'NOT VERIFIED');
});
test('VIEW_ONLY suppresses import action even with archived files', () => {
  const model = transferTrackingModel({consent:{permission:'VIEW_ONLY',status:'ACTIVE'},archives:[{}]});
  assert.equal(model.allowTool, false);
  assert.equal(model.steps[1][1], '반입 대상 아님');
});
test('archive existence does not prove selected consent delivery or integrity', () => {
  const model = transferTrackingModel({consent:{permission:'DOWNLOAD_ALLOWED',status:'ACTIVE'},archives:[{sha256:'a',instancesCount:700}]});
  assert.equal(model.allowTool, true);
  assert.equal(model.steps[2][1], '수신 증적 미확인');
  assert.equal(model.steps[3][1], 'NOT VERIFIED');
});
test('loading and transport errors do not expose stale counts or authorize actions', () => {
  for (const state of ['loading','error']) {
    const model = transferTrackingModel({state, archives:[{}],consent:{permission:'DOWNLOAD_ALLOWED',status:'ACTIVE'}});
    assert.equal(model.count,'—');
    assert.equal(model.allowTool,false);
  }
  assert.match(transferTrackingModel({state:'error'}).note,/접근 거부나 전송 실패를 뜻하지 않습니다/);
});
test('revoked and expired consent do not offer import tool', () => {
  for (const status of ['REVOKED','EXPIRED']) assert.equal(transferTrackingModel({consent:{status,permission:'DOWNLOAD_ALLOWED'}}).allowTool,false);
});
