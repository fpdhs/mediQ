import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {AuthError} from '../src/auth.js';
import {HealthHelperRag} from '../src/health-helper-rag.js';
import {createHealthHelperHandler,HEALTH_HELPER_PATH} from '../src/health-helper-http.js';
import {testOnlyClearedCorpus} from './helpers/health-helper-corpus.js';

test('default authenticated HTTP path returns KDCA source guidance without a model',async t=>{
  const logs=[];const audit=async row=>logs.push(row);
  const helper=new HealthHelperRag({audit});
  const route=createHealthHelperHandler({helper,audit,requireTrustedIngress:true,
    authenticate:request=>{
      if(request.headers.authorization!=='Bearer test-double')throw new AuthError(401,'AUTHENTICATION_REQUIRED');
      return {role:'PATIENT',subject:'test-account',patientId:'test-patient'};
    },requestMeta:()=>({ingressTrusted:true})});
  const server=createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost'));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const response=await fetch(`http://127.0.0.1:${server.address().port}${HEALTH_HELPER_PATH}`,{
    method:'POST',headers:{authorization:'Bearer test-double','content-type':'application/json'},
    body:JSON.stringify({question:'AFP'}),signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
  const result=await response.json();assert.equal(result.status,'SOURCE_GUIDANCE');
  assert.equal(result.generationUsed,false);assert.equal(result.sources[0].id,'kdca-cirrhosis-6560');
  assert.equal(logs.at(-1).reasonCode,'HELPER_SOURCE_GUIDANCE');
});

test('HTTP adapter authenticates before parsing; ingress, body, content and disabled-model failures audited',async t=>{
  const logs=[];const audit=async row=>logs.push(row);
  const helper=new HealthHelperRag({mode:'GENERATION',audit,corpus:testOnlyClearedCorpus()});
  const route=createHealthHelperHandler({helper,audit,requireTrustedIngress:true,
    authenticate:request=>{
      if(request.headers.authorization!=='Bearer test-double')throw new AuthError(401,'AUTHENTICATION_REQUIRED');
      return {role:request.headers['x-test-role']??'PATIENT',subject:'test-account',patientId:'test-patient'};
    },requestMeta:request=>({ingressTrusted:request.headers['x-test-ingress']==='yes'})});
  const server=createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost'));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}${HEALTH_HELPER_PATH}`;
  const headers={authorization:'Bearer test-double','x-test-ingress':'yes','content-type':'application/json'};
  const cases=[
    ['unauthenticated',{},'invalid-json',401,'AUTHENTICATION_REQUIRED'],
    ['untrusted',{...headers,'x-test-ingress':'no'},'{"question":"AFP"}',403,'TRUSTED_INGRESS_REQUIRED'],
    ['wrong-role',{...headers,'x-test-role':'DOCTOR'},'{"question":"AFP"}',403,'HELPER_PATIENT_REQUIRED'],
    ['bad-json',headers,'invalid-json',422,'INVALID_CONTENT'],
    ['oversized',headers,'x'.repeat(4097),413,'INPUT_TOO_LARGE'],
    ['content-type',{...headers,'content-type':'text/plain'},'{}',415,'JSON_REQUIRED'],
    ['record-injection',headers,'{"question":"AFP","recordRef":"someone-else"}',422,'HELPER_INPUT_INVALID'],
    ['disabled-model',headers,'{"question":"AFP"}',503,'HELPER_MODEL_NOT_CONFIGURED'],
  ];
  for(const [name,caseHeaders,body,status,code]of cases)await t.test(name,async()=>{
    const response=await fetch(url,{method:'POST',headers:caseHeaders,body,signal:AbortSignal.timeout(3000)});
    assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{error:code});assert.equal(logs.at(-1).reasonCode,code);
  });
  const response=await fetch(url,{method:'POST',headers,body:'{"question":"BMI"}',signal:AbortSignal.timeout(3000)});
  assert.equal(response.status,200);assert.equal((await response.json()).status,'INSUFFICIENT_EVIDENCE');
  assert.doesNotMatch(JSON.stringify(logs),/recordRef|someone-else|invalid-json/);
});
