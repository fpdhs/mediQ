import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeWafSnapshot,listWafAudit} from '../src/waf-audit.js';
import {parseEventQuery,buildEventIndex,createSecurityReport} from '../src/security-console.js';
const now=Date.parse('2026-10-14T09:00:00Z');
const snapshot={status:'available',observedAt:new Date(now).toISOString(),events:[{eventRef:'a'.repeat(24),time:new Date(now-10000).toISOString(),ruleId:'930130',result:'DETECTED',ip:'secret',uri:'/?token=secret',msg:'secret'}]};
test('WAF snapshot minimizes fields, warns separately, and fails closed when stale',()=>{
  const safe=sanitizeWafSnapshot(snapshot,now);assert.equal(safe.events[0].result,'DETECTED');assert.ok(!JSON.stringify(safe).includes('secret'));
  assert.equal(sanitizeWafSnapshot(snapshot,now+180001).status,'stale');
  assert.equal(sanitizeWafSnapshot({...snapshot,events:[{...snapshot.events[0],result:'SUCCESS'}]},now).events.length,0);
});
test('WAF is a separately bounded source, searchable and reportable without changing APP denominator',()=>{
  const query=parseEventQuery(new URLSearchParams('source=WAF&q=930130'),new Date(now));
  const index=buildEventIndex([],{status:'unavailable',events:[]},[],query,sanitizeWafSnapshot(snapshot,now));
  assert.equal(index.total,1);assert.equal(index.chart.total,0);assert.equal(index.sources.waf.denied,0);
  const report=createSecurityReport(index,{events:[{source:'WAF',eventRef:'a'.repeat(24)}],format:'PRINT'},'TEST_ADMIN');
  assert.equal(report.events[0].source,'WAF');assert.throws(()=>createSecurityReport(index,{events:[{source:'APP',eventRef:'a'.repeat(24)}],format:'PRINT'},'TEST_ADMIN'));
});
test('WAF snapshot is not configured on arbitrary local paths',async()=>assert.equal((await listWafAudit({env:{HIPASS_AUDIT_SOCKET:'/tmp/other.sock'}})).status,'not_configured'));
