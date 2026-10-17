import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const redeem=source.slice(source.indexOf('let qrReceptionBusy ='),source.indexOf('async function simulateQrScan()'));
const reset=source.slice(source.indexOf('function resetQrScan()'),source.indexOf('function updateVisitModePacket('));
function fixture(postJson) {
  const nodes=new Map();
  const node=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'previous patient',dataset:{},disabled:false});return nodes.get(id);};
  const context=vm.createContext({document:{querySelector:node,getElementById:id=>node('#'+id)},postJson,
    stopCameraQrScan(){},toFriendlyError:code=>code,renderOutput(){},latestToken:null,latestTokenInfo:null,latestTicketNonce:null,
    selectedStudyUid:null,selectedStudy:null,lastStudies:[],viewerStatus:null,lastSeries:[],
    syncSelectedStudyUi(){},setDownloadState(){},startCountdownTimer(){},updateWatermark(){},updatePipelineSteps(){},broadcastSync(){},
    demo:{patientId:'local-placeholder'},loadDashboard:async()=>{},navigateHospitalScreen:screen=>{context.screen=screen;},
    loadGatewayStudies:async()=>{},loadSeriesForActiveToken:async()=>{},showToast(){}});
  vm.runInContext(reset+'\n'+redeem,context);
  return {context,node,run:()=>vm.runInContext("redeemScannedNonce('synthetic-test-nonce')",context)};
}
test('server denial clears stale identity and does not open Viewer',async()=>{
  const f=fixture(async()=>({decision:'DENIED',reasonCode:'CONSENT_EXPIRED'}));await f.run();
  assert.equal(f.node('#qr-scanned-patient').textContent,'서버 확인 후 표시');
  assert.match(f.node('#qr-handoff-message').textContent,/CONSENT_EXPIRED/);
  assert.equal(f.context.screen,undefined);assert.equal(f.context.latestToken,null);
});
test('in-flight duplicate is ignored and transport failure restores controls',async()=>{
  let reject,calls=0;const f=fixture(()=>{calls++;return new Promise((_,r)=>{reject=r;});});
  const first=f.run();await f.run();assert.equal(calls,1);assert.equal(f.node('#qr-manual-submit').disabled,true);
  reject(new Error('timeout'));await first;
  assert.equal(f.node('#qr-manual-submit').disabled,false);
  assert.match(f.node('#qr-handoff-status').textContent,/연결 상태 확인 필요/);
  assert.equal(f.context.latestToken,null);
});
test('allowed response shows server identity and follows reception desk path',async()=>{
  const f=fixture(async()=>({decision:'ALLOWED',accessToken:'test-only',patientId:'server-patient',ticketId:'ticket-test',viewerContext:{studyInstanceUid:'1.2.3',permission:'VIEW_ONLY'}}));
  await f.run();assert.equal(f.node('#qr-scanned-patient').textContent,'server-patient');assert.equal(f.context.screen,'dashboard');
  assert.equal(f.node('#qr-manual-submit').disabled,false);
});
