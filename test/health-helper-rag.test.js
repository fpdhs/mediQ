import test from 'node:test';
import assert from 'node:assert/strict';
import {HealthHelperRag, AFP_SOURCE, retrieveHelperEvidence, validateHelperOutput} from '../src/health-helper-rag.js';
import {createAzureHelperModel} from '../src/health-helper-azure.js';
import {testOnlyClearedCorpus} from './helpers/health-helper-corpus.js';
const patient={role:'PATIENT',subject:'synthetic-account',patientId:'synthetic-patient'};
const answer={answer:'AFP는 간질환의 경과를 살피는 혈액검사입니다. 검사기관의 참고범위를 확인하세요.',sourceIds:[AFP_SOURCE.id],questions:['다른 검사와 함께 어떻게 이해하면 되나요?']};
test('KDCA default source guidance never calls a model or enables derivative chunks',async()=>{
  let calls=0;const logs=[];
  const service=new HealthHelperRag({audit:async row=>logs.push(row),model:{generate:()=>{calls++;throw new Error('unexpected');}}});
  for(const question of ['AFP','AST','ALT','GGT','간기능 정상 범위']){
    const result=await service.ask(patient,{question});
    assert.equal(result.status,'SOURCE_GUIDANCE');assert.equal(result.generationUsed,false);
    assert.equal(result.questionOrigin,'PROJECT_TEMPLATE');assert.equal(result.recordContext,'NOT_CONNECTED');
    assert.ok(result.sources.every(source=>source.useMode==='LINK_ONLY' && !Object.hasOwn(source,'text')));
    assert.match(result.sources[0].url,/^https:\/\/health\.kdca\.go\.kr\//);
    assert.equal(logs.at(-1).reasonCode,'HELPER_SOURCE_GUIDANCE');
  }
  assert.equal(calls,0);
});
test('KDCA guide denies injected overrides and clinical requests; unknown topics abstain',async()=>{
  const service=new HealthHelperRag({audit:async()=>{}});
  await assert.rejects(service.ask(patient,{question:'AFP',mode:'GENERATION'}),{code:'HELPER_INPUT_INVALID'});
  assert.equal((await service.ask(patient,{question:'AFP 진단해줘'})).status,'REFUSED');
  assert.equal((await service.ask(patient,{question:'BMI'})).status,'INSUFFICIENT_EVIDENCE');
  const afp=await service.ask(patient,{question:'AFP'});
  assert.match(afp.sources[0].contextNote,/전용 설명.*아닙니다/u);
});
test('KDCA guidance audit failure returns no success and never transmits user text',async()=>{
  const logs=[];const service=new HealthHelperRag({audit:async row=>logs.push(row)});
  await service.ask(patient,{question:'홍길동 AFP 수치 999'});
  assert.doesNotMatch(JSON.stringify(logs),/홍길동|999|question|answer/);
  const broken=new HealthHelperRag({audit:async()=>{throw new Error('audit outage');}});
  await assert.rejects(broken.ask(patient,{question:'AFP'}),/audit outage/);
});
function fixture(options={}){const logs=[];const calls=[];return {logs,calls,service:new HealthHelperRag({mode:'GENERATION',corpus:testOnlyClearedCorpus(),audit:async row=>logs.push(row),model:{generate:async input=>{calls.push(input);return structuredClone(answer);}},...options})};}
test('grounded AFP generation uses canonical topic, not original text or identity',async()=>{
  const {service,calls,logs}=fixture();const result=await service.ask(patient,{question:'홍길동 AFP는 어떤 검사인가요?'});
  assert.equal(result.status,'GENERATED');assert.equal(result.recordContext,'NOT_CONNECTED');assert.equal(result.sources[0].url,AFP_SOURCE.url);
  assert.doesNotMatch(JSON.stringify(calls),/홍길동|synthetic-account|synthetic-patient/);
  assert.doesNotMatch(JSON.stringify(logs),/홍길동|어떤 검사|answer|sourceIds/);
});
test('wrong role and missing identity denied without model call',async()=>{
  for(const principal of [null,{...patient,role:'DOCTOR'},{...patient,patientId:null}]){
    const f=fixture();await assert.rejects(f.service.ask(principal,{question:'AFP'}),{code:'HELPER_PATIENT_REQUIRED'});assert.equal(f.calls.length,0);
  }
});
test('client records, unknown fields, malformed and overlong input rejected',async()=>{
  for(const body of [null,[],{}, {question:'AFP',patientId:'other'}, {question:'AFP',record:{value:90}}, {question:'가'.repeat(601)}]){
    const f=fixture();await assert.rejects(f.service.ask(patient,body),{code:'HELPER_INPUT_INVALID'});assert.equal(f.calls.length,0);
  }
});
test('unsupported evidence abstains without generation',async()=>{
  const f=fixture();assert.equal((await f.service.ask(patient,{question:'콜레스테롤 설명'})).status,'INSUFFICIENT_EVIDENCE');assert.equal(f.calls.length,0);
});
test('production corpus blocks generation while every medical source remains unreviewed',async()=>{
  let calls=0;const logs=[];
  const service=new HealthHelperRag({mode:'GENERATION',audit:async row=>logs.push(row),model:{generate:async()=>{calls++;return structuredClone(answer);}}});
  for(const question of ['AFP 설명','간기능 검사 설명','복부 CT 준비','혈청 크레아티닌 설명']){
    const result=await service.ask(patient,{question});
    assert.equal(result.status,'INSUFFICIENT_EVIDENCE',question);
    assert.deepEqual(result.sources,[],question);
    assert.equal(result.recordContext,'NOT_CONNECTED',question);
    assert.equal(logs.at(-1).reasonCode,'HELPER_EVIDENCE_INSUFFICIENT',question);
  }
  assert.equal(calls,0,'unassigned evidence must never reach the model');
});
test('clinical request is a policy response, not AI-generated success',async()=>{
  const f=fixture();assert.equal((await f.service.ask(patient,{question:'AFP로 암인지 진단해줘'})).status,'REFUSED');assert.equal(f.calls.length,0);
});
test('missing deployment is explicit 503, no fake answer',async()=>{
  const f=fixture({model:null});await assert.rejects(f.service.ask(patient,{question:'AFP 설명'}),{statusCode:503,code:'HELPER_MODEL_NOT_CONFIGURED'});
});
test('unknown citations, HTML, numeric advice and extra fields rejected',()=>{
  const corpus=testOnlyClearedCorpus();const evidence=retrieveHelperEvidence('AFP',corpus);
  for(const output of [{...answer,sourceIds:['invented']},{...answer,answer:'<script>bad</script>'},{...answer,answer:'약을 10 mg 복용하세요'},{...answer,url:'https://bad.example'},{...answer,questions:[]}]){
    assert.throws(()=>validateHelperOutput(output,evidence,corpus),{code:'HELPER_OUTPUT_REJECTED'});
  }
});
test('bounded timeout is a failure with no generated answer',async()=>{
  const f=fixture({model:{generate:()=>new Promise(()=>{})},timeoutMs:10});
  await assert.rejects(f.service.ask(patient,{question:'AFP'}),{code:'HELPER_MODEL_TIMEOUT'});
  assert.equal(f.logs.at(-1).result,'FAIL');assert.equal(f.service.active.size,0);
});
test('audit outage prevents model call',async()=>{
  const f=fixture({audit:async()=>{throw new Error('audit outage');}});
  await assert.rejects(f.service.ask(patient,{question:'AFP'}));assert.equal(f.calls.length,0);
});
test('per-user budget limits calls and resets after fixed window',async()=>{
  let now=0;const f=fixture({now:()=>now});for(let i=0;i<5;i++)await f.service.ask(patient,{question:'AFP'});
  await assert.rejects(f.service.ask(patient,{question:'AFP'}),{code:'HELPER_RATE_LIMITED'});
  now=60001;await f.service.ask(patient,{question:'AFP'});assert.equal(f.calls.length,6);
});
test('Azure adapter disabled by default, unsafe endpoint rejected',()=>{
  assert.equal(createAzureHelperModel({}),null);
  for(const endpoint of ['http://resource.openai.azure.com','https://evil.example','https://resource.openai.azure.com/path','https://resource.openai.azure.com/?key=x']){
    assert.throws(()=>createAzureHelperModel({HIPASS_HEALTH_HELPER_MODEL:'azure',AZURE_OPENAI_ENDPOINT:endpoint,AZURE_OPENAI_DEPLOYMENT:'demo',AZURE_OPENAI_API_KEY:'test-only'}),/CONFIGURATION_INVALID/);
  }
});
test('Azure REST contract with test double; rejects truncated completion',async()=>{
  let sent;const env={HIPASS_HEALTH_HELPER_MODEL:'azure',AZURE_OPENAI_ENDPOINT:'https://test-only.openai.azure.com/',AZURE_OPENAI_DEPLOYMENT:'test-model',AZURE_OPENAI_API_KEY:'test-only'};
  const model=createAzureHelperModel(env,async(url,options)=>{sent={url:String(url),...options};return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(answer)}}]}));});
  assert.deepEqual(await model.generate({topic:'AFP',evidence:retrieveHelperEvidence('AFP'),signal:new AbortController().signal}),answer);
  assert.match(sent.url,/\/openai\/v1\/chat\/completions$/);assert.equal(sent.redirect,'error');assert.equal(JSON.parse(sent.body).response_format.json_schema.strict,true);
  const broken=createAzureHelperModel(env,async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:JSON.stringify(answer)}}]})));
  await assert.rejects(broken.generate({topic:'AFP',evidence:[],signal:new AbortController().signal}),{code:'HELPER_OUTPUT_REJECTED'});
});
