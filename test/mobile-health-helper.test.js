import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {askMobileHealthHelper} from '../public/mobile/health-helper.js';

test('mobile helper uses same authenticated endpoint and only question body', async () => {
  const controller=new AbortController();
  const result=await askMobileHealthHelper('AFP 비교 질문', {
    signal:controller.signal,isUnlocked:()=>true,
    headers:()=>({authorization:'Bearer unit-synthetic', 'x-hipass-patient-id':'must-not-send'}),
    request:async(path, options)=>{
      assert.equal(path,'/api/v1/me/health-helper/questions');
      assert.deepEqual(options.headers,{'content-type':'application/json',authorization:'Bearer unit-synthetic'});
      assert.deepEqual(JSON.parse(options.body),{question:'AFP 비교 질문'});
      assert.equal(options.signal,controller.signal);assert.equal(options.cache,'no-store');assert.equal(options.redirect,'error');
      return new Response(JSON.stringify({status:'VISIT_PREPARATION',generationUsed:true,questions:['무엇을 확인하면 좋을까요?']}));
    },
  });
  assert.equal(result.status,'VISIT_PREPARATION');
});

test('locked, missing and expired patient sessions never request a helper answer', async()=>{
  for(const options of [
    {isUnlocked:()=>false,headers:()=>({authorization:'Bearer unit'})},
    {isUnlocked:()=>true,headers:()=>({'x-hipass-role':'PATIENT'})},
    {isUnlocked:()=>true,headers:()=>{throw new Error('CAPSTONE_SESSION_EXPIRED');}},
  ])await assert.rejects(askMobileHealthHelper('AFP',{...options,request:()=>assert.fail('must not request')}));
});

test('mobile helper surfaces server rejection, offline, oversized and invalid output, never fallback success',async()=>{
  for(const response of [new Response(JSON.stringify({error:'JWT_INVALID_SIGNATURE'}),{status:401}),
    new Response(JSON.stringify({error:'HELPER_MODEL_UNAVAILABLE'}),{status:503}),
    new Response('x'.repeat(32769)),new Response('not-json')]) {
    await assert.rejects(askMobileHealthHelper('AFP',{isUnlocked:()=>true,headers:()=>({authorization:'Bearer unit'}),request:async()=>response}));
  }
  await assert.rejects(askMobileHealthHelper('AFP',{isUnlocked:()=>true,headers:()=>({authorization:'Bearer unit'}),request:async()=>{throw new TypeError('offline');}}));
});

test('response after mobile lock is rejected',async()=>{
  let unlocked=true;
  await assert.rejects(askMobileHealthHelper('AFP',{isUnlocked:()=>unlocked,headers:()=>({authorization:'Bearer unit'}),request:async()=>{
    unlocked=false;return new Response(JSON.stringify({status:'VISIT_PREPARATION'}));
  }}),/MOBILE_APP_LOCKED/);
});

test('mobile integration preserves four tabs, resets notes on lock and patient change, shares renderer without storage',()=>{
  const app=readFileSync('public/mobile/app.js','utf8'),html=readFileSync('public/mobile/index.html','utf8'),adapter=readFileSync('public/mobile/health-helper.js','utf8');
  assert.match(app,/createMobileHealthHelper/);assert.match(app,/if \(tabName === 'helper' && !state.isAuthenticated\) return/);
  for(const name of ['async function handleLockApp','function handlePatientSelect']){
    const part=app.slice(app.indexOf(name),app.indexOf(name)+650);assert.match(part,/healthHelper\?\.reset\(\)/);
  }
  assert.equal((html.match(/class="nav-item(?: active)?"/g)||[]).length,4);
  assert.match(html,/id="tab-helper"/);assert.match(html,/data-tab="helper"/);
  assert.doesNotMatch(adapter,/localStorage|sessionStorage|innerHTML|127\.0\.0\.1|11434|patientId|recordValues/);
  assert.match(adapter,/surface:'mobile'/);
  assert.match(app,/document.readyState === 'complete'\) register\(\)/);
});

test('PWA caches public helper assets only, never question POST or authenticated responses',async()=>{
  const worker=readFileSync('public/mobile/sw.js','utf8'),handlers=new Map(),puts=[];
  vm.runInNewContext(worker,{URL,AbortSignal,Response,
    self:{location:{origin:'https://synthetic.invalid'},addEventListener:(name,fn)=>handlers.set(name,fn)},
    caches:{open:async()=>({put:async(...args)=>puts.push(args),match:async()=>undefined})},
    fetch:async()=>new Response('public-static'),
  });
  for(const path of ['/mobile/health-helper.js','/mobile/health-helper.css','/ui/patient-helper.js','/ui/patient-helper.css','/ui/health-comparison.js','/ui/health-comparison.css','/ui/health-record-client.js']){
    let pending;handlers.get('fetch')({request:new Request('https://synthetic.invalid'+path),respondWith(value){pending=value;}});
    assert.equal((await pending).status,200);
    handlers.get('fetch')({request:new Request('https://synthetic.invalid'+path,{headers:{authorization:'Bearer unit'}}),respondWith(){assert.fail('authenticated asset cached');}});
  }
  handlers.get('fetch')({request:new Request('https://synthetic.invalid/api/v1/me/health-helper/questions',{method:'POST',body:'{}'}),respondWith(){assert.fail('question intercepted');}});
  handlers.get('fetch')({request:new Request('https://synthetic.invalid/api/v1/me/health-records/synthetic'),respondWith(){assert.fail('health record GET intercepted');}});
  assert.equal(puts.length,7);
});
