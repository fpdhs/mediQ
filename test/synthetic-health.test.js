import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {AuthError} from '../src/auth.js';
import {syntheticHealthRecords,screeningFields} from '../src/synthetic-health-records.js';
import {createSyntheticHealthHandler,SYNTHETIC_HEALTH_PATH} from '../src/synthetic-health-http.js';
import {comparisonMetrics,compareHealthPoints} from '../public/ui/health-comparison.js';
import {createHealthRecordClient} from '../public/ui/health-record-client.js';

test('fixed 2025/2026 fixtures retain AFP and 2026 values; BMI and age are year-specific',()=>{
  const rows=syntheticHealthRecords();assert.equal(rows.length,8);assert.equal(new Set(rows.map(r=>r.id)).size,8);
  assert.deepEqual(rows.filter(r=>r.kind==='AFP').map(r=>r.value),[24.6,8.4,6.2]);
  const metrics=comparisonMetrics(rows),blood=metrics.find(m=>m.title==='공복혈당');
  assert.deepEqual(blood.points.map(p=>p.value),[98,104]);assert.equal(rows[1].age,55);
  assert.equal(screeningFields(2025).find(f=>f.label==='체질량지수').value,25.6);
  assert.equal(screeningFields(2026).find(f=>f.label==='체중').value,72);
  assert.equal(screeningFields(2026).find(f=>f.label==='공복혈당').value,104);
  assert.equal(metrics.length,24);assert.ok(rows.every(r=>r.synthetic&&!r.patientId&&!r.study));
});
test('comparison is deterministic; zero, text, methods, units, missing and reversed dates never become a false percent',()=>{
  const point={date:'2025-10-08',value:12,unit:'ng/mL',method:'synthetic',hospital:'A'};
  const next={...point,date:'2026-10-08',value:18};
  assert.deepEqual(compareHealthPoints(point,next),{status:'NUMERIC',difference:6,percent:50,message:'합성 수치 비교 · 진단·악화 판정 아님'});
  assert.equal(compareHealthPoints({...point,value:0},next).percent,null);
  for(const value of [null,'<2',NaN,Infinity,'음성'])assert.equal(compareHealthPoints({...point,value},next).status,'TEXT');
  assert.equal(compareHealthPoints(point,{...next,unit:'mg/dL'}).status,'INCOMPATIBLE');
  assert.equal(compareHealthPoints(point,{...next,method:'other'}).status,'INCOMPATIBLE');
  assert.equal(compareHealthPoints({...point,method:null},next).status,'INCOMPATIBLE');
  assert.equal(compareHealthPoints(next,point).status,'INVALID');assert.equal(compareHealthPoints(point,null).status,'MISSING');
  assert.match(compareHealthPoints(point,{...next,hospital:'B'}).message,/기관이 다릅니다/);
});
test('authenticated scenario-only read is audited and fail-closed, never accepts patient overrides',async t=>{
  const logs=[];let failAudit=false;
  const route=createSyntheticHealthHandler({requireTrustedIngress:true,authenticate:req=>{
    if(!req.headers.authorization)throw new AuthError(401,'AUTHENTICATION_REQUIRED');
    return {subject:req.headers.authorization==='Bearer owner'?'owner':'other',role:req.headers.authorization==='Bearer doctor'?'DOCTOR':'PATIENT'};
  },requestMeta:req=>({ingressTrusted:req.headers['x-test-ingress']==='yes'}),eligible:p=>p.subject==='owner',audit:async row=>{if(failAudit)throw new Error('DB down');logs.push(row);}});
  const server=createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost'));});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const origin=`http://127.0.0.1:${server.address().port}${SYNTHETIC_HEALTH_PATH}`,headers={authorization:'Bearer owner','x-test-ingress':'yes'};
  for(const [name,opts,path,status] of [
    ['success',{headers},'',200],['no-auth',{headers:{}},'',401],['untrusted',{headers:{authorization:'Bearer owner'}},'',403],
    ['other-owner',{headers:{...headers,authorization:'Bearer other'}},'',403],['doctor',{headers:{...headers,authorization:'Bearer doctor'}},'',403],
    ['override',{headers},'?patientId=other',422],['method',{method:'POST',headers,body:'{}'},'',405],
  ])await t.test(name,async()=>{const res=await fetch(origin+path,{...opts,signal:AbortSignal.timeout(2000)});assert.equal(res.status,status);assert.equal(res.headers.get('cache-control'),'no-store');const body=await res.json();if(status===200){assert.equal(body.records.length,8);assert.equal(body.clinicalUse,false);}else assert.ok(!body.records);});
  assert.ok(logs.some(r=>r.reasonCode==='SYNTHETIC_HEALTH_RECORDS_DELIVERED'));
  for(const row of logs)assert.deepEqual(Object.keys(row).sort(),['actorType','actorId','action','result','reasonCode','auditSessionId'].sort());
  assert.doesNotMatch(JSON.stringify(logs.map(({auditSessionId,...row})=>row)),/24\.6|132|patientId/);failAudit=true;
  const res=await fetch(origin,{headers,signal:AbortSignal.timeout(2000)});assert.equal(res.status,503);assert.ok(!(await res.json()).records);
});
test('client forwards only signed auth, never caches API data; reset rejects late results',async()=>{
  let resolve,available=true;const observations=[];
  const client=createHealthRecordClient({headers:()=>({authorization:'Bearer fixture','x-patient':'ignored'}),available:()=>available,onChange:(r,s)=>observations.push([r.length,s]),request:async(path,opts)=>{
    assert.equal(path,SYNTHETIC_HEALTH_PATH);assert.deepEqual(opts.headers,{authorization:'Bearer fixture'});assert.equal(opts.cache,'no-store');return new Promise(r=>resolve=r);
  }});
  const pending=client.load();available=false;client.reset();resolve(new Response(JSON.stringify({synthetic:true,clinicalUse:false,records:syntheticHealthRecords()})));await pending;assert.equal(client.records().length,0);assert.equal(client.status(),'EMPTY');
  const failed=createHealthRecordClient({available:()=>true,headers:()=>({authorization:'Bearer unit'}),request:async()=>new Response('{"error":"DENIED"}',{status:403})});await failed.load();assert.equal(failed.status(),'ERROR');assert.equal(failed.records().length,0);
});
