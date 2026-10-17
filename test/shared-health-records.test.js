import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {AuthError,TestProvider} from '../src/auth.js';
import {createHmac,randomBytes} from 'node:crypto';
import {HCC_PATIENT_ID} from '../src/capstone-hcc-catalog.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
import {authorizeSharedHealth,healthRecordScope,validateHealthRecordSelection,createSharedHealthHandler,SHARED_HEALTH_PATH} from '../src/shared-health-records.js';
import {compareSharedRecords} from '../public/ui/clinician-health.js';
import {shareReviewModel} from '../public/ui/patient-share-review.js';
import {PostgresStore} from '../src/postgres-store.js';
import {HipassService} from '../src/services.js';
import {createSeedData} from '../src/seed.js';
import {hccCatalog} from '../src/capstone-hcc-catalog.js';
const records=syntheticHealthRecords();
const doctor={role:'DOCTOR',doctorId:'DOC-B-01',hospitalId:'HOSP-B',subject:'doctor-b'};
const doctors=[{doctorId:'DOC-B-01',hospitalId:'HOSP-B',roles:['Doctor'],approvedPurposes:['TRANSFER','TREATMENT']}];
const hospitals=()=>[{hospitalId:'HOSP-A',status:'ACTIVE'},{hospitalId:'HOSP-B',status:'ACTIVE'}];
const consent=()=>({consentId:'synthetic-consent',patientId:HCC_PATIENT_ID,sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',status:'ACTIVE',validFrom:new Date(Date.now()-10000).toISOString(),validUntil:new Date(Date.now()+100000).toISOString(),healthRecordScope:healthRecordScope([records[0].id,records.find(r=>r.kind==='AFP').id])});
test('health selection is explicit, known, bounded and clinical-purpose only',()=>{
  const input={patientId:HCC_PATIENT_ID,sourceHospitalId:'HOSP-A',purpose:'TRANSFER'};
  assert.equal(validateHealthRecordSelection(input),null);assert.equal(healthRecordScope([]),null);
  assert.equal(validateHealthRecordSelection({...input,healthRecordIds:[records[0].id]}),null);
  for(const ids of ['all',[records[0].id,records[0].id],['unknown'],Array(31).fill('x')])assert.equal(validateHealthRecordSelection({...input,healthRecordIds:ids}),'HEALTH_RECORD_SCOPE_INVALID');
  for(const change of [{patientId:'other'},{purpose:'RESEARCH'},{sourceHospitalId:'HOSP-B'}])assert.equal(validateHealthRecordSelection({...input,...change,healthRecordIds:[records[0].id]}),'HEALTH_RECORD_SCOPE_INVALID');
});
test('only consent-selected records are visible; legacy image consents grant no health access',()=>{
  assert.equal(authorizeSharedHealth(doctor,consent(),doctors).length,2);
  const cases=[['NO_CONSENT',null],['REVOKED',{status:'REVOKED'}],['EXPIRED',{status:'EXPIRED'}],['EXPIRED',{validUntil:new Date(Date.now()-1).toISOString()}],['EXPIRED',{validFrom:new Date(Date.now()+50000).toISOString()}],['HOSPITAL_MISMATCH',{targetHospitalId:'HOSP-C'}],['PURPOSE_MISMATCH',{purpose:'RESEARCH'}],['SCOPE_REQUIRED',{healthRecordScope:null}],['SCOPE_REQUIRED',{healthRecordScope:{version:'wrong',ids:[records[0].id]}}],['SCENARIO_REQUIRED',{patientId:'other'}]];
  for(const [code,change]of cases)assert.throws(()=>authorizeSharedHealth(doctor,change===null?null:{...consent(),...change},doctors),e=>e.code.includes(code));
  assert.throws(()=>authorizeSharedHealth({...doctor,role:'PATIENT'},consent(),doctors),e=>e.code==='HEALTH_RECORD_DOCTOR_REQUIRED');
  assert.throws(()=>authorizeSharedHealth({...doctor,doctorId:'other'},consent(),doctors),e=>e.code==='DOCTOR_HOSPITAL_MISMATCH');
  assert.throws(()=>authorizeSharedHealth(doctor,consent(),[{...doctors[0],approvedPurposes:[]}]),e=>e.code==='PURPOSE_MISMATCH');
});
test('HTTP read/list gates persist audit before disclosure, recheck revocation and fail closed',async t=>{
  let row=consent(),failAudit=false,revokeDuringAudit=false;const logs=[];
  let hospitalActive=true;
  const route=createSharedHealthHandler({requireTrustedIngress:true,authenticate:req=>{if(!req.headers.authorization)throw new AuthError(401,'TOKEN_INVALID');return req.headers.authorization==='Bearer patient'?{...doctor,role:'PATIENT'}:doctor;},requestMeta:req=>({ingressTrusted:req.headers['x-test-ingress']==='yes'}),eligible:()=>true,consents:()=>[row],doctors:()=>doctors,hospitals:()=>hospitalActive?hospitals():[],audit:async event=>{if(failAudit)throw Error('offline');logs.push(event);if(revokeDuringAudit)row.status='REVOKED';}});
  const server=createServer((req,res)=>route(req,res,new URL(req.url,'http://localhost')));server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}${SHARED_HEALTH_PATH}`,headers={authorization:'Bearer doctor','x-test-ingress':'yes'};
  const check=async(path,status,opts={})=>{const response=await fetch(base+path,{headers,signal:AbortSignal.timeout(2000),...opts});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');const body=await response.json();if(status!==200)assert.equal(body.records,undefined);return body;};
  assert.equal((await check('',200)).shares.length,1);
  const path='?consentId=synthetic-consent&purpose=TRANSFER';assert.equal((await check(path,200)).records.length,2);
  await check(path,401,{headers:{}});await check(path,403,{headers:{...headers,authorization:'Bearer patient'}});await check(path,403,{headers:{authorization:'Bearer doctor'}});
  await check('?consentId=missing&purpose=TRANSFER',403);await check('?consentId=synthetic-consent&purpose=TREATMENT',403);await check('?patientId=other',422);await check('?purpose=TRANSFER',422);await check('?consentId=x&consentId=y',422);await check(path,405,{method:'POST',body:'{}'});
  hospitalActive=false;await check(path,403);hospitalActive=true;
  assert.ok(logs.some(l=>l.action==='SHARED_HEALTH_RECORDS_READ'&&l.result==='SUCCESS'));assert.doesNotMatch(JSON.stringify(logs),/24\.6|건강검진|"consentId":"missing"/);
  revokeDuringAudit=true;await check(path,403);revokeDuringAudit=false;assert.equal((await check('',200)).shares.length,0);
  row=consent();failAudit=true;await check(path,503);
});
test('comparison uses shared prior records only; selection changes the consent acknowledgement fingerprint',()=>{
  const afps=records.filter(r=>r.kind==='AFP'),current=afps[0];
  assert.equal(compareSharedRecords(current,[current]),null);
  assert.equal(compareSharedRecords(current,afps).previous.value,8.4);
  assert.equal(compareSharedRecords(current,[current,{...afps[1],unit:'different'}]),null);
  assert.equal(compareSharedRecords(current,[current,{...afps[1],value:0}]).percent,null);
  const base={};assert.notEqual(shareReviewModel({...base,healthRecordIds:[]}).signature,shareReviewModel({...base,healthRecordIds:[records[0].id]}).signature);
});
test('new consent stores selected scope; rejected IDs cannot mutate consent collections',async()=>{
  const data=createSeedData(),catalog=hccCatalog(new Date().toISOString());data.patients.push(catalog.patient);data.imagingStudies.push(...catalog.studies);let saved;
  const store={get:name=>data[name],save:async()=>{saved=structuredClone(data);}};
  const service=new HipassService(store);
  const input={patientId:HCC_PATIENT_ID,sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',validUntil:new Date(Date.now()+60000).toISOString(),scopes:[{studyInstanceUid:catalog.studies[0].studyInstanceUid}],healthRecordIds:[records[0].id]};
  const result=await service.createConsent(input);assert.deepEqual(result.healthRecordScope,healthRecordScope(input.healthRecordIds));
  assert.deepEqual(saved.consents.find(c=>c.consentId===result.consentId).healthRecordScope,result.healthRecordScope);
  const count=data.consents.length;await assert.rejects(service.createConsent({...input,healthRecordIds:['unknown']}),e=>e.code==='HEALTH_RECORD_SCOPE_INVALID');assert.equal(data.consents.length,count);
  store.save=async()=>{throw Error('SIMULATED_PERSISTENCE_FAILURE');};
  await assert.rejects(service.createConsent(input),/SIMULATED_PERSISTENCE_FAILURE/);
  assert.equal(data.consents.length,count);assert.ok(data.consentScopes.every(scope=>data.consents.some(c=>c.consentId===scope.consentId)));
});
test('Postgres binding and read mapping retain versioned IDs without SQL interpolation',async()=>{
  const store=Object.create(PostgresStore.prototype),row=consent();let sql,values;
  store.client={query:async(text,params)=>{sql=text;values=params;return {rows:[]};}};
  await store.insertConsents([row]);assert.match(sql,/\$13::jsonb/);assert.doesNotMatch(sql,/demo-2026/);assert.deepEqual(JSON.parse(values[12]),row.healthRecordScope);
  store.client={query:async()=>({rows:[{consent_id:row.consentId,health_record_scope:row.healthRecordScope}]})};
  assert.deepEqual((await store.readTable('consents'))[0].healthRecordScope,row.healthRecordScope);
});
test('signed JWT HTTP read rejects tampering, expiry, other doctor, hospital and patient role',async t=>{
  const secret=randomBytes(32).toString('base64url'),provider=new TestProvider({TEST_JWT_SECRET:secret}),logs=[];
  const sign=change=>{const head=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url');const payload=Buffer.from(JSON.stringify({iss:'hipass-test',aud:'hipass-api',sub:'synthetic-doctor',role:'DOCTOR',roles:['DOCTOR'],doctorId:'DOC-B-01',hospitalId:'HOSP-B',exp:Math.floor(Date.now()/1000)+60,...change})).toString('base64url');return `${head}.${payload}.${createHmac('sha256',secret).update(`${head}.${payload}`).digest('base64url')}`;};
  const route=createSharedHealthHandler({authenticate:req=>provider.authenticate(req),requestMeta:()=>({}),eligible:()=>true,consents:()=>[consent()],doctors:()=>doctors,hospitals,audit:async row=>logs.push(row)});
  const server=createServer((req,res)=>route(req,res,new URL(req.url,'http://localhost')));server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}${SHARED_HEALTH_PATH}?consentId=synthetic-consent&purpose=TRANSFER`;
  const normal=sign({});
  for(const [token,status] of [[normal,200],[normal.slice(0,-8)+'tampered',401],[sign({exp:1}),401],[sign({doctorId:'other'}),403],[sign({hospitalId:'HOSP-C'}),403],[sign({role:'PATIENT',roles:['PATIENT'],patientId:HCC_PATIENT_ID}),403]]){
    const response=await fetch(url,{headers:{authorization:`Bearer ${token}`},signal:AbortSignal.timeout(2000)});assert.equal(response.status,status);const body=await response.json();if(status!==200)assert.equal(body.records,undefined);
  }
  assert.ok(logs.some(row=>row.reasonCode==='JWT_INVALID_SIGNATURE'));assert.ok(logs.some(row=>row.reasonCode==='JWT_EXPIRED'));
});
