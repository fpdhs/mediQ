import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(process.env.VIEWER_APP_SOURCE || 'public/app.js','utf8');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));

function context(overrides={}) {
  const events=[];
  const c=vm.createContext({events,currentPersona:'DOCTOR',consentMutationPending:false,tokenRequestPending:false,
    selectedStudyUid:'1.2.3',selectedSeriesUid:'1.2.3.2',selectedSopUid:'1.2.3.2.8',currentSliceIndex:7,
    latestToken:'expired',latestTokenInfo:{},clearCountdownTimer:()=>events.push('clear'),hideSeriesImage:()=>events.push('hide'),
    setDownloadState:()=>events.push('download'),requestDoctorToken:async options=>{events.push('request');return options;},...overrides});
  vm.runInContext(extract('async function renewViewerAccess(', 'async function requestDoctorToken('),c);
  return c;
}
test('manual renewal clears cached pixels and old token, retaining only exact navigation position',async()=>{
  const c=context(); const result=await c.renewViewerAccess();
  assert.deepEqual(c.events,['clear','hide','download','request']);
  assert.equal(c.latestToken,null);assert.equal(c.latestTokenInfo,null);
  assert.equal(result.resume.sopUid,'1.2.3.2.8');assert.equal(result.resume.index,7);
});
test('patient persona, mutation and duplicate requests never issue renewal',async()=>{
  for(const overrides of [{currentPersona:'PATIENT'},{consentMutationPending:true},{tokenRequestPending:true}]){
    const c=context(overrides);await c.renewViewerAccess();assert.deepEqual(c.events,[]);
  }
});
test('renewal preserves existing server policy request and cannot reuse the old token after denial',async()=>{
  const c=context({patientConsentReady:true,latestConsentId:'consent',demo:{doctorId:'doctor',targetHospitalId:'B',purpose:'TRANSFER'},
    currentTokenRequestContext:()=> 'scope',updateConsentOperationControls(){},postJson:async(url,body)=>{
      assert.equal(url,'/api/dicom-access/request');assert.equal(body.seriesInstanceUid,'1.2.3.2');assert.equal(body.requestedAction,'VIEW');
      return {decision:'DENIED',reasonCode:'CONSENT_REVOKED'};
    },viewerStatus:{},showViewerMessage(){},toFriendlyError:x=>x,renderOutput(){},loadDashboard:async()=>{}});
  vm.runInContext(extract('async function requestDoctorToken(', 'async function openViewer('),c);
  const r=await c.renewViewerAccess();assert.equal(r.reasonCode,'CONSENT_REVOKED');assert.equal(c.latestToken,null);assert.equal(c.tokenRequestPending,false);
});

function instanceContext(overrides={}) {
  const c=context({patientConsentReady:true,lastSeries:[],lastInstances:[],totalSlices:1,
    requireToken:()=>true,stopCinePlayback(){},clearSliceBlobCache(){},currentTokenRequestContext:()=> 'scope',
    getJson:async()=>Array.from({length:10},(_,i)=>({'00080018':{Value:[`1.2.3.2.${i+1}`]},'00200013':{Value:[i+1]}})),
    dicomValue:(r,k)=>r[k]?.Value?.[0],renderOutput(){},updateSliceControlsUi(){},renderTransferSelection(){},showViewerMessage(){},
    displaySlice:async i=>{c.displayed=i;},...overrides});
  vm.runInContext(extract('async function loadInstancesForSelectedSeries(', 'function updateSliceControlsUi('),c);return c;
}
test('renewed metadata resumes exact SOP, never position from another study or series',async()=>{
  const c=instanceContext();await c.loadInstancesForSelectedSeries({resume:{studyUid:'1.2.3',seriesUid:'1.2.3.2',sopUid:'1.2.3.2.8',index:0}});assert.equal(c.displayed,7);
  await c.loadInstancesForSelectedSeries({resume:{studyUid:'9.9',seriesUid:'1.2.3.2',index:7}});assert.equal(c.displayed,0);
});
test('late instance response cannot paint a changed request context',async()=>{
  let resolve;const c=instanceContext({getJson:()=>new Promise(r=>resolve=r)});
  const task=c.loadInstancesForSelectedSeries();c.latestToken='replacement';resolve([{}]);await task;assert.equal(c.displayed,undefined);
});
test('expiry hides previously authorized pixels without losing navigation position',()=>{
  const badge={};const c=context({document:{querySelector:()=>badge},countdownTimerId:null,stopCinePlayback(){},clearSliceBlobCache(){},
    viewerStatus:{},showViewerMessage(){},updatePipelineSteps(){},setInterval:()=>1,clearInterval(){}});
  vm.runInContext(extract('function startCountdownTimer(', 'function clearCountdownTimer('),c);
  c.startCountdownTimer('2000-01-01T00:00:00Z');assert.equal(c.latestToken,null);assert.ok(c.events.includes('hide'));assert.equal(c.currentSliceIndex,7);
});
