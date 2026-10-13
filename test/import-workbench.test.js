import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const run=source.slice(source.indexOf('async function runPacsImport()'),source.indexOf('// Hospital B PACS Archive Workstation Module'));
function fixture(postJson) {
  const nodes=new Map(); const node=id=>{if(!nodes.has(id))nodes.set(id,{checked:true,disabled:false,textContent:'',dataset:{},style:{}});return nodes.get(id);};
  const context=vm.createContext({pacsImportBusy:false,isPreflightPassed:true,document:{querySelector:node},getConsentForStudy:()=>({consentId:'selected-consent'}),lastConsents:[],selectedStudyUid:'1.2.3',demo:{doctorId:'test',targetHospitalId:'HOSP-B'},importPreflight:()=>({ready:true}),runPreflightCheck(){},postJson,updatePipelineSteps(){},renderOutput(){},broadcastSync(){},loadHospitalBPacsArchive:async()=>{},loadDashboard:async()=>{},toFriendlyError:x=>x});
  vm.runInContext(run,context);return {node,context,run:()=>vm.runInContext('runPacsImport()',context)};
}
test('completion remains local and uses the selected consent',async()=>{
  let body;const f=fixture(async(_,b)=>{body=b;return {status:'COMPLETED',instancesTransferred:2,sha256:'test-hash',auditSessionId:'synthetic'};});await f.run();
  assert.equal(body.consentId,'selected-consent');assert.match(f.node('#pacs-destination-status').textContent,/PACS 등록 미검증/);assert.equal(f.node('#btn-pacs-import-run').disabled,true);
});
test('concurrent duplicate ignored and timeout requires inspection, no retry',async()=>{
  let reject,calls=0;const f=fixture(()=>{calls++;return new Promise((_,r)=>{reject=r;});});const first=f.run();await f.run();assert.equal(calls,1);reject(new Error('timeout'));await first;
  assert.match(f.node('#pacs-import-log').textContent,/자동 재시도하지 않습니다/);assert.equal(f.node('#btn-preflight-check').disabled,false);assert.equal(f.node('#btn-pacs-import-run').disabled,true);
});
test('denial preserves reason without declaring completion',async()=>{
  const f=fixture(async()=>({error:'CONSENT_EXPIRED'}));await f.run();assert.match(f.node('#pacs-import-log').textContent,/CONSENT_EXPIRED/);assert.equal(f.node('#pacs-import-status-pill').textContent,'요청 미완료');
});
