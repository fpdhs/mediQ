import test from 'node:test';
import assert from 'node:assert/strict';
import {vaultItem} from '../public/ui/hospital-vault.js';
const record = state => ({retention:{policy:'CONSENT_BOUND_V1',state,validUntil:'2026-10-20T00:00:00Z'}});
test('legacy records never imply verified storage or a deadline',()=>{
  assert.deepEqual(vaultItem({}),{group:'review',label:'보관정책 확인 필요',deadline:'기한 미확인'});
});
test('stored records require explicit access result',()=>{
  assert.match(vaultItem(record('STORED')).label,/접근 차단/);
  assert.equal(vaultItem({...record('STORED'),access:{allowed:true}}).label,'암호화 보관 중');
});
test('pending, failed and completed deletion are distinct',()=>{
  assert.equal(vaultItem(record('DELETE_PENDING')).group,'deleting');
  assert.match(vaultItem(record('DELETE_FAILED')).label,/재시도/);
  assert.deepEqual(vaultItem(record('DELETED')).group,'ended');
  assert.equal(vaultItem(record('DELETED')).label,'삭제 완료');
});
test('unknown state and invalid time do not fabricate completion',()=>{
  assert.equal(vaultItem(record('NEW')).group,'review');
  assert.equal(vaultItem({retention:{policy:'CONSENT_BOUND_V1',validUntil:'bad'}}).deadline,'기한 미확인');
});
