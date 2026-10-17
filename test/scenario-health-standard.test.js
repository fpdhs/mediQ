import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import {scenarioHealthStandard,isScenarioHealthPatient} from '../src/scenario-health-standard.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
import {hccCatalog,HCC_PATIENT_ID,HCC_PATIENT_SUBJECT,HCC_STUDY_UID} from '../src/capstone-hcc-catalog.js';
import {createSyntheticHealthHandler,STANDARD_HEALTH_PATH} from '../src/synthetic-health-http.js';
import {AuthError} from '../src/auth.js';
import {createHealthRecordClient} from '../public/ui/health-record-client.js';
import {validateStandardSnapshot} from '../public/ui/scenario-health-standard.js';

const legacy={subject:HCC_PATIENT_SUBJECT,role:'PATIENT',patientId:HCC_PATIENT_ID};
const entra={subject:'synthetic-patient-hcc',role:'PATIENT',patientId:HCC_PATIENT_ID,authMethod:'ENTRA_OIDC_ACCESS_TOKEN',authMode:'ENTRA_OIDC'};
const studies=()=>hccCatalog('2026-10-10T00:00:00Z').studies;
test('one scenario source projects 8 records, 49 results and the registered 700 instance CT',()=>{
  const records=syntheticHealthRecords();
  const result=scenarioHealthStandard(records,studies(),new Date('2026-10-13T00:00:00Z'));
  assert.deepEqual(result.counts,{records:8,observations:49,imagingStudies:1});
  const resources=result.fhirBundle.entry.map(e=>e.resource),observations=resources.filter(r=>r.resourceType==='Observation');
  assert.deepEqual(observations.filter(r=>r.code.text==='혈청 AFP').map(r=>r.valueQuantity.value),[24.6,8.4,6.2]);
  assert.equal(resources.filter(r=>r.resourceType==='DiagnosticReport').length,8);
  const ct=resources.find(r=>r.resourceType==='ImagingStudy');
  assert.equal(ct.numberOfInstances,700);assert.equal(ct.identifier[0].value,`urn:oid:${HCC_STUDY_UID}`);assert.equal(ct.status,'registered');
  const refs=new Set(resources.map(r=>`${r.resourceType}/${r.id}`));
  for(const r of resources){assert.match(r.id,/^[A-Za-z0-9.-]{1,64}$/);if(r.subject)assert.ok(refs.has(r.subject.reference));for(const ref of r.result??[])assert.ok(refs.has(ref.reference));assert.equal(r.meta.tag[0].code,'synthetic-nonclinical');}
  assert.equal(new Set(result.fhirBundle.entry.map(e=>e.fullUrl)).size,resources.length);
  assert.ok(!JSON.stringify(result).includes('birthDate'));assert.ok(!JSON.stringify(result).includes('endpoint'));
  assert.equal(validateStandardSnapshot({...result,synthetic:true,clinicalUse:false,records}).counts.records,8);
  assert.throws(()=>scenarioHealthStandard(records,[{patientId:'other'}]));
  assert.throws(()=>validateStandardSnapshot({records}));
});
test('only server-authenticated mapped Entra or fixed legacy patient qualifies',()=>{
  assert.ok(isScenarioHealthPatient(legacy));assert.ok(isScenarioHealthPatient(entra));
  for(const change of [{role:'DOCTOR'},{patientId:'P-1001'},{subject:'other'},{authMode:'TEST'},{authMethod:'DEVELOPMENT_MOCK'}])assert.equal(isScenarioHealthPatient({...entra,...change}),false);
});
test('standard endpoint enforces identity, ingress, input, durable audit and registration',async t=>{
  let committed=true,auditUp=true;const logs=[];
  const route=createSyntheticHealthHandler({authenticate:async req=>{if(req.headers.authorization!=='Bearer patient'&&req.headers.authorization!=='Bearer doctor')throw new AuthError(401,'AUTHENTICATION_REQUIRED');return req.headers.authorization==='Bearer patient'?entra:{...entra,role:'DOCTOR'};},
    requestMeta:req=>({ingressTrusted:req.headers['x-test-ingress']==='yes'}),requireTrustedIngress:true,
    eligible:p=>committed&&isScenarioHealthPatient(p),studies:()=>studies(),audit:async row=>{if(!auditUp)throw new Error('down');logs.push(row);}});
  const server=createServer(async(req,res)=>{if(!await route(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}${STANDARD_HEALTH_PATH}`,headers={authorization:'Bearer patient','x-test-ingress':'yes'};
  for(const [name,options,suffix,status] of [
    ['owner',{headers},'',200],['no-auth',{},'',401],['tampered',{headers:{...headers,authorization:'Bearer tampered'}},'',401],
    ['role',{headers:{...headers,authorization:'Bearer doctor'}},'',403],['ingress',{headers:{authorization:'Bearer patient'}},'',403],
    ['override',{headers},'?patientId=other',422],['method',{headers,method:'POST',body:'{}'},'',405],
  ])await t.test(name,async()=>{const response=await fetch(url+suffix,options),body=await response.json();assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');if(status===200){assert.equal(body.counts.records,8);assert.equal(body.studies.length,1);}else assert.ok(!body.records&&!body.fhirBundle);});
  committed=false;assert.equal((await fetch(url,{headers})).status,403);committed=true;
  auditUp=false;const failure=await fetch(url,{headers});assert.equal(failure.status,503);assert.ok(!(await failure.json()).records);
  assert.ok(logs.some(r=>r.reasonCode==='SCENARIO_HEALTH_STANDARD_DELIVERED'));
  const auditContent=logs.map(({auditSessionId,...row})=>row);
  assert.doesNotMatch(JSON.stringify(auditContent),/24\.6|700|ng\/mL/);
});
test('explicit refresh fetches again; normal cache reads do not',async()=>{
  let calls=0;const client=createHealthRecordClient({available:()=>true,headers:()=>({authorization:'Bearer test'}),request:async()=>{calls++;return new Response(JSON.stringify({synthetic:true,clinicalUse:false,records:syntheticHealthRecords()}));}});
  await client.load();await client.load();assert.equal(calls,1);await client.load({force:true});assert.equal(calls,2);assert.equal(client.records().length,8);
});
test('web uses patient scoped standard route without legacy sample fallback in capstone',()=>{
  const html=readFileSync('public/index.html','utf8'),app=readFileSync('public/app.js','utf8'),ui=readFileSync('public/ui/scenario-health-standard.js','utf8');
  assert.match(html,/<summary>내 건강기록 확인<\/summary>/);assert.match(html,/내 기록 다시 불러오기/);assert.doesNotMatch(html,/PHR 새로고침|표준 데이터 확인 · 기존 FHIR 조회/);
  assert.match(app,/return scenarioHealthStandard.load\(\)/);assert.match(ui,/textContent/);assert.doesNotMatch(ui,/innerHTML|localStorage|sessionStorage|\/dicomweb\//);
});
