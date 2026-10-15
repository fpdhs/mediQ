import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEventIndex,parseEventQuery} from '../src/security-console.js';
import {createPeriodSecurityReport,readSecurityReportSnapshot,rememberSecurityReport} from '../src/security-period-report.js';
import {summarizeSecurityReport} from '../public/ui/security-report.js';
import {periodRange,reportScope,matchesPeriod} from '../public/ui/security-period-panel.js';
import {startIsolatedServer,boundedFetch} from '../scripts/test-support/isolated-server.js';
const now=new Date('2026-10-15T02:00:00Z'),source={status:'unavailable',events:[]};
const logs=Array.from({length:251},(_,i)=>({auditId:`AUD-${i}`,action:i%2?'TOKEN_ISSUED':'IMAGE_VIEWED',result:i%2?'DENIED':'SUCCESS',reasonCode:i%2?'TOKEN_EXPIRED':'OK',createdAt:'2026-10-14T03:00:00Z',hospitalId:'HOSP-B',token:'secret-not-exportable'}));
const query=parseEventQuery(new URLSearchParams('hours=168&result=DENIED'),now);
const index=()=>buildEventIndex(logs,source,[],query);
test('period aggregate follows all filters before pagination; detail cap is not denominator',()=>{
  const r=createPeriodSecurityReport(index(),{mode:'PERIOD',format:'JSON',events:[]},'admin');
  assert.equal(r.summary.total,125);assert.equal(r.summary.denied,125);assert.equal(r.events.length,50);assert.equal(summarizeSecurityReport(r).outcomes[1].percent,100);assert.equal(r.scope.sources.azure.status,'unavailable');
  assert.ok(!JSON.stringify(r).includes('secret-not-exportable'));assert.equal(r.scope.filters.result,'DENIED');
});
test('period supports zero events without presenting unavailable source as collected',()=>{
  const empty=buildEventIndex([],source,[],query);const r=createPeriodSecurityReport(empty,{mode:'PERIOD',format:'PRINT',events:[]},'admin');assert.equal(r.summary.total,0);assert.equal(r.events.length,0);assert.equal(r.scope.sources.azure.status,'unavailable');
});
test('snapshot content is fixed, actor-bound, cloned and expiring',()=>{
  const report=createPeriodSecurityReport(index(),{mode:'PERIOD',format:'PRINT',events:[]},'admin');
  const saved=readSecurityReportSnapshot({snapshotId:report.reportId,format:'CSV'},'admin');assert.equal(saved.fingerprint,report.fingerprint);report.summary.total=999;assert.equal(saved.summary.total,125);
  assert.throws(()=>readSecurityReportSnapshot({snapshotId:report.reportId,format:'JSON'},'other'));
  assert.throws(()=>readSecurityReportSnapshot({snapshotId:report.reportId,format:'JSON'},'admin',Date.now()+16*60000));
  assert.throws(()=>readSecurityReportSnapshot({snapshotId:report.reportId,format:'JSON',events:[]},'admin'));
});
test('range constraints and Korean calendar presets are consistent',()=>{
  for(const q of ['from=bad','from=2026-10-16&until=2026-10-15','from=2026-08-01&until=2026-10-15','hours=168&from=2026-10-14','from=2026-10-14&from=2026-10-13'])assert.throws(()=>parseEventQuery(new URLSearchParams(q),now));
  assert.equal(periodRange('TODAY','','',+now).from,'2026-10-14T15:00:00.000Z');assert.equal(periodRange('MONTH','','',+now).from,'2026-09-30T15:00:00.000Z');
  assert.equal(periodRange('CUSTOM','2026-10-14T12:00','2026-10-15T11:00',+now).from,'2026-10-14T03:00:00.000Z');
  assert.throws(()=>periodRange('CUSTOM','2026-10-15T13:00','2026-10-15T14:00',+now));
});
test('manual details cannot escape time, filter or duplicate-reference constraints',()=>{
  assert.throws(()=>createPeriodSecurityReport(index(),{mode:'PERIOD',format:'JSON',events:[{source:'APP',eventRef:'AUD-0'}]},'admin'));
  const ref={source:'APP',eventRef:'AUD-1'};assert.throws(()=>createPeriodSecurityReport(index(),{mode:'PERIOD',format:'JSON',events:[ref,ref]},'admin'));
  const r=createPeriodSecurityReport(index(),{mode:'PERIOD',format:'JSON',events:[ref]},'admin');assert.equal(r.events.length,1);assert.equal(r.summary.total,125);
  assert.ok(reportScope(index()).includes('result=DENIED'));assert.equal(matchesPeriod(index().filteredEvents[0],query),true);assert.equal(matchesPeriod({...index().filteredEvents[0],result:'SUCCESS',resultGroup:'허용·성공'},query),false);
});
test('HTTP period reports and snapshot exports enforce role and owner and write audit',{timeout:20000},async t=>{
  const base=await startIsolatedServer(t),admin={'x-hipass-role':'SECURITY_ADMIN','x-hipass-user-id':'synthetic-security-auditor'};
  const post=(headers,body)=>boundedFetch(base+'/api/security/reports',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});
  const body={mode:'PERIOD',format:'JSON',events:[]};assert.equal((await post({},body)).status,401);
  assert.equal((await post({'x-hipass-role':'DOCTOR','x-hipass-user-id':'d','x-hipass-doctor-id':'DOC-B-01','x-hipass-hospital-id':'HOSP-B'},body)).status,403);
  const response=await post(admin,body);assert.equal(response.status,201);const r=await response.json();assert.equal(r.mode,'PERIOD');assert.equal(response.headers.get('cache-control'),'no-store');
  const exported=await post(admin,{snapshotId:r.reportId,format:'CSV'});assert.equal(exported.status,201);assert.equal((await exported.json()).fingerprint,r.fingerprint);
  assert.equal((await post({...admin,'x-hipass-user-id':'other-security-admin'},{snapshotId:r.reportId,format:'JSON'})).status,409);
  const events=await(await boundedFetch(base+'/api/security/events',{headers:admin})).json();assert.equal(events.filteredEvents,undefined);assert.ok(events.events.some(e=>e.action==='SECURITY_REPORT_EXPORTED'));
});
