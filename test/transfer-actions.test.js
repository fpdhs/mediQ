import test from 'node:test';
import assert from 'node:assert/strict';
import {transferPresentation} from '../public/ui/transfer-actions.js';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {PostgresPacsTransferJobRepository} from '../src/pacs-transfer-jobs.js';
import {createPacsTransferJobHttpHandler} from '../src/pacs-transfer-job-http.js';
test('PC download action never requests tokens, bytes or file saving',()=>{
  const app=readFileSync('public/app.js','utf8');const action=app.slice(app.indexOf('async function downloadSelectedInstance()'),app.indexOf('function stageSelectedInstanceForPacs()'));
  assert.doesNotMatch(action,/proofFetch|postJson|createObjectURL|link\.click/);assert.match(action,/PC 다운로드는 차단/);
});

test('transfer integration binds observers without relying on a global hospitalApp',()=>{
  const app=readFileSync('public/app.js','utf8');
  const body=app.slice(app.indexOf('function bindEvents() {'),app.indexOf('  // Global & Refresh'))+'} bindEvents();';
  const host={querySelectorAll:()=>[]};
  runInNewContext(body,{initializeViewerStudio(){},openClinicianHomeViewer(){},initializeTransferActions(){return {update(){},clear(){}};},
    stageSelectedInstanceForPacs(){},document:{querySelector:selector=>selector==='#hospital-saas-app'?host:null},
    MutationObserver:class{observe(node){assert.ok(node);}},viewerImage:{},window:{addEventListener(){}}});
});
test('only completed and fully verified server counts become successful',()=>{
  assert.equal(transferPresentation({state:'COMPLETED',totalItems:2,succeededItems:2,failedItems:0}).tone,'success');
  for(const job of [{state:'CREATED',totalItems:2,succeededItems:0,failedItems:0},{state:'COMPLETED',totalItems:2,succeededItems:1,failedItems:0},{state:'FAILED',totalItems:2,succeededItems:1,failedItems:1},{state:'COMPLETED',totalItems:1,succeededItems:2,failedItems:0}])assert.notEqual(transferPresentation(job).tone,'success');
});
test('history SQL is bounded, parameterized, actor and hospital scoped; includes terminal rows',async()=>{
  let query,params;const repository=new PostgresPacsTransferJobRepository({connect(){},async query(sql,args){query=sql;params=args;return {rows:[{job_id:'test-id',state:'FAILED',total_items:2,succeeded_items:1,failed_items:1}]};}});
  const rows=await repository.listHistory('doctor-demo','HOSP-B');assert.deepEqual(params,['doctor-demo','HOSP-B',50]);assert.match(query,/actor_id=\$1 AND target_hospital_id=\$2/);assert.doesNotMatch(query,/state IN/);assert.equal(rows[0].state,'FAILED');
  await assert.rejects(repository.listHistory('doctor-demo','HOSP-B',{limit:51}));await assert.rejects(repository.listHistory("evil'",'HOSP-B'));
});
async function request({method='GET',search='',principal={role:'DOCTOR',doctorId:'doctor-demo',hospitalId:'HOSP-B'},auditFails=false}={}){
  const calls=[];const repository={create(){},read(){},listActive(){},async listHistory(...args){calls.push(args);return [{state:'COMPLETED'}];}};
  const service={evaluateDicomAccessRequest(){},async writeAudit(event){calls.push(event);if(auditFails)throw Error('audit');},store:{async save(){calls.push('saved');}}};
  const route=createPacsTransferJobHttpHandler({repository,service,readJson(){}}),response={setHeader(){},writeHead(code){this.status=code;},end(body){this.body=JSON.parse(body);}};
  await route({method,resume(){}},response,new URL('https://test/api/pacs-transfer-jobs/history'+search),principal,{});return {response,calls};
}
test('history API derives identity, persists audit and returns no-store scoped records',async()=>{
  const {response,calls}=await request();assert.equal(response.status,200);assert.deepEqual(calls[0],['doctor-demo','HOSP-B']);assert.equal(calls[1].action,'PACS_TRANSFER_HISTORY_READ');assert.equal(calls[2],'saved');
});
test('history API denies patients, caller filters, wrong methods and failed audit persistence',async()=>{
  assert.equal((await request({principal:{role:'PATIENT',patientId:'synthetic'}})).response.status,403);
  for(const options of [{search:'?doctorId=other'},{method:'POST'}]){const result=await request(options);assert.equal(result.response.status,400);assert.equal(result.calls.length,0);}
  assert.equal((await request({auditFails:true})).response.status,503);
});
