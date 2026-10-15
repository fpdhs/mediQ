import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeSecurityReport} from '../public/ui/security-report.js';
test('report chart denominator uses only selected evidence, never overview totals',()=>{
  const report={scope:{sources:{app:{total:10000}}},events:[
    {source:'APP',time:'2026-10-14T00:02:00Z',resultGroup:'거부·실패',reasonCode:'TOKEN_EXPIRED'},
    {source:'APP',time:'2026-10-14T00:04:00Z',resultGroup:'거부·실패',reasonCode:'TOKEN_EXPIRED',review:{status:'INVESTIGATING'}},
    {source:'AZURE_KEYVAULT',time:'2026-10-14T01:00:00Z',resultGroup:'허용·성공',reasonCode:'OK'},
  ]};const result=summarizeSecurityReport(report);assert.equal(result.total,3);assert.equal(result.denied,2);assert.equal(result.outcomes[1].percent,66.7);assert.equal(result.reviewed,1);assert.equal(result.unreviewed,2);assert.deepEqual(result.reasons,[{label:'TOKEN_EXPIRED',count:2}]);assert.equal(result.hours.length,2);assert.equal(result.hours[0].count,2);
});
test('unknown outcomes stay visible without being labelled successful',()=>{
  const result=summarizeSecurityReport({events:[{source:'APP',resultGroup:'unrecognized',time:'not-a-date'}]});assert.equal(result.outcomes[2].count,1);assert.equal(result.outcomes[0].count,0);assert.equal(result.hours.length,0);assert.equal(result.total,1);
});
test('empty selected evidence yields no fabricated percentages or timeline buckets',()=>{
  const result=summarizeSecurityReport({events:[]});assert.equal(result.total,0);assert.ok(result.outcomes.every(item=>item.count===0&&item.percent===0));assert.deepEqual(result.hours,[]);assert.deepEqual(result.reasons,[]);
});
