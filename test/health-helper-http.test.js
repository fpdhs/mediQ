import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {AuthError} from '../src/auth.js';
import {HealthHelperRag} from '../src/health-helper-rag.js';
import {createHealthHelperHandler,HEALTH_HELPER_PATH} from '../src/health-helper-http.js';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {testOnlyClearedCorpus} from './helpers/health-helper-corpus.js';
import {createSyntheticHccProvenanceAnswer} from '../src/health-helper-synthetic-hcc-provenance.js';
import {HCC_PATIENT_ID,HCC_PATIENT_SUBJECT} from '../src/capstone-hcc-catalog.js';

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

test('authenticated HCC helper path answers the composite demo question with provenance only',async t=>{
  const logs=[];let modelCalls=0;const audit=async row=>logs.push(row);
  const helper=new HealthHelperRag({audit,model:{generate:async()=>{modelCalls++;throw new Error('scenario must not call model');}},
    syntheticScenario:({principal,question})=>createSyntheticHccProvenanceAnswer({principal,question,enabled:true,catalogCommitted:true})});
  const route=createHealthHelperHandler({helper,audit,
    authenticate:request=>{
      if(request.headers.authorization!=='Bearer test-double')throw new AuthError(401,'AUTHENTICATION_REQUIRED');
      return request.headers['x-test-profile']==='hcc'
        ? {role:'PATIENT',subject:HCC_PATIENT_SUBJECT,patientId:HCC_PATIENT_ID}
        : {role:'PATIENT',subject:'ordinary-patient',patientId:'ordinary-synthetic-patient'};
    },requestMeta:()=>({ingressTrusted:true})});
  const server=createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost'));});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}${HEALTH_HELPER_PATH}`;
  const question='홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?';
  const headers={authorization:'Bearer test-double','content-type':'application/json'};
  const hccResponse=await fetch(url,{method:'POST',headers:{...headers,'x-test-profile':'hcc'},body:JSON.stringify({question}),signal:AbortSignal.timeout(3000)});
  assert.equal(hccResponse.status,200);assert.equal(hccResponse.headers.get('cache-control'),'no-store');
  const hcc=await hccResponse.json();assert.equal(hcc.status,'SYNTHETIC_SCENARIO');
  assert.equal(hcc.recordContext,'SYNTHETIC_SCENARIO_ONLY');assert.equal(hcc.generationUsed,false);
  assert.match(hcc.answer,/홍길동 56세 발표용 합성 기록/u);assert.match(hcc.answer,/간 효소 AST 32 U\/L/u);
  assert.match(hcc.answer,/24\.6 ng\/mL/u);assert.match(hcc.answer,/실제 촬영 영상이나 판독문은 아닙니다/u);
  assert.equal(hcc.scenarioEvidence.recordIds.length,7);
  assert.deepEqual(hcc.scenarioEvidence.records.map(record=>record.kind),['CHECKUP','AFP','AFP','AFP','ULTRASOUND','ULTRASOUND','ULTRASOUND']);
  assert.equal(hcc.scenarioEvidence.presentationId,'HONG_GILDONG_SYNTHETIC_56');

  const ordinaryResponse=await fetch(url,{method:'POST',headers,body:JSON.stringify({question}),signal:AbortSignal.timeout(3000)});
  assert.equal(ordinaryResponse.status,200);const ordinary=await ordinaryResponse.json();
  assert.notEqual(ordinary.status,'SYNTHETIC_SCENARIO');assert.doesNotMatch(JSON.stringify(ordinary),/홍길동|24\.6/u);
  const clinical=await fetch(url,{method:'POST',headers:{...headers,'x-test-profile':'hcc'},body:JSON.stringify({question:'AFP와 간 초음파가 간암 진단 근거인가요?'}),signal:AbortSignal.timeout(3000)});
  assert.equal((await clinical.json()).status,'REFUSED');assert.equal(modelCalls,0);
  assert.ok(logs.some(row=>row.reasonCode==='HELPER_SYNTHETIC_SCENARIO_PROVENANCE'));
  assert.doesNotMatch(JSON.stringify(logs),/홍길동|24\.6|어떤 관계/iu);
});

test('draft uploaded MedlinePlus RAG candidate is not exposed by the authenticated patient API',async()=>{
  const candidateCorpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url));
  const candidate=retrieveUploadedEvidence('MRI 전에 장신구를 제거해야 하나요?',candidateCorpus);
  assert.equal(candidate.status,'CANDIDATE');
  assert.equal(candidate.topic,'3953');

  for(const mode of ['SOURCE_GUIDANCE','VISIT_PREPARATION','GENERATION']){
    const logs=[];let modelCalls=0;const audit=async row=>logs.push(row);
    const helper=new HealthHelperRag({mode,audit,model:{generate:async()=>{
      modelCalls++;return {answer:'이 답변은 나오면 안 됩니다.',sourceIds:['unreviewed-medlineplus'],questions:['추가 질문']};
    }}});
    const route=createHealthHelperHandler({helper,audit,requireTrustedIngress:true,
      authenticate:request=>{
        if(request.headers.authorization!=='Bearer test-double')throw new AuthError(401,'AUTHENTICATION_REQUIRED');
        return {role:'PATIENT',subject:'synthetic-account',patientId:'synthetic-patient'};
      },requestMeta:()=>({ingressTrusted:true})});
    const server=createServer(async(req,res)=>{await route(req,res,new URL(req.url,'http://localhost'));});
    server.listen(0,'127.0.0.1');await once(server,'listening');
    try{
      const response=await fetch(`http://127.0.0.1:${server.address().port}${HEALTH_HELPER_PATH}`,{
        method:'POST',headers:{authorization:'Bearer test-double','content-type':'application/json'},
        body:JSON.stringify({question:'MRI 전에 장신구를 제거해야 하나요?'}),signal:AbortSignal.timeout(3000)});
      assert.equal(response.status,200,mode);
      const result=await response.json();
      assert.equal(result.status,'INSUFFICIENT_EVIDENCE',mode);
      assert.deepEqual(result.sources,[],mode);
      assert.equal(result.recordContext,'NOT_CONNECTED',mode);
      assert.equal(modelCalls,0,mode);
      assert.equal(logs.at(-1).reasonCode,'HELPER_EVIDENCE_INSUFFICIENT',mode);
      assert.doesNotMatch(JSON.stringify(result),/MedlinePlus|mriscans|장신구|unreviewed-medlineplus/u,mode);
    }finally{
      server.closeAllConnections();server.close();
    }
  }
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
