import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const fn = source.slice(source.indexOf('function navigateHospitalScreen('),source.indexOf('// Backwards-compatible View activation helper'));
test('A/B navigation uses exclusive screens and preserves selection without requesting a token',()=>{
  const screens=['dashboard','studies','records','viewer','qr'].map(screen=>({dataset:{screen},hidden:true}));
  const classes=new Set();
  const app={dataset:{},querySelector(){return null;},classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}},querySelectorAll(selector){return selector==='.mq-screen'?screens:[];}};
  let recordsActive=false;
  const ctx=vm.createContext({document:{querySelector(selector){return selector==='#hospital-saas-app'?app:null;}},stopCinePlayback(){},loadHospitalBPacsArchive(){},selectedStudyUid:'study-preserved',currentPersona:'DOCTOR',clinicianHealth:{setActive:on=>{recordsActive=on;}}});
  ctx.stopCameraQrScan = () => {};
  vm.runInContext(fn,ctx);
  for(const name of ['viewer','records','studies','qr','viewer']){
    vm.runInContext(`navigateHospitalScreen('${name}')`,ctx);
    assert.deepEqual(screens.filter(s=>!s.hidden).map(s=>s.dataset.screen),[name]);
    assert.equal(app.dataset.uiTheme,name==='viewer'?'diagnostic-dark':'clinical-white');
    assert.equal(classes.has('mq-focus-viewer'),name==='viewer');
    assert.equal(ctx.selectedStudyUid,'study-preserved');
    assert.equal(recordsActive,name==='records');
  }
});
test('clinician sign-in opens the action-first home without claiming unverified connectivity',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const home=html.match(/<section class="mq-screen clinician-home" id="clinical-home"[\s\S]*?<\/section>\s*<!-- 2\.3 5-Step Exchange Pipeline -->/)?.[0];
  assert.ok(home,'clinician home section exists');
  assert.match(source,/navigateHospitalScreen\("dashboard"\)/);
  assert.match(html,/id="clinical-home" data-screen="dashboard"/);
  assert.match(html,/id="clinical-desk" data-screen="studies" hidden/);
  assert.match(html,/id="metric-health">확인 중<\/strong>/);
  assert.doesNotMatch(html,/가상 병원 A Gateway<\/span><span class="mq-badge mq-badge-good">ONLINE/);
  assert.match(html,/영상 열기 직전에도 서버가 권한을 다시 확인합니다/);
  assert.match(html,/data-view-jump="studies">전달된 검사 확인/);
  assert.match(home,/환자 동의와 영상 전달/);
  assert.ok(home.indexOf('class="clinical-home-latest"') < home.indexOf('class="clinical-home-flow"'),'recent handoff is presented before workflow guidance');
  assert.ok(home.indexOf('class="clinical-home-flow"') < home.indexOf('class="clinical-home-status"'),'system telemetry follows the active work area');
  assert.match(home,/다음 진료를 준비하세요/);
  assert.match(home,/네 가지가 맞아야/);
  for(const label of ['받는 병원','진료 목적','검사 범위','유효 시간']) assert.match(home,new RegExp(label));
  assert.doesNotMatch(home,/지갑/);
  const stylesheet=readFileSync(new URL('../public/ui/clinician-preparation.css',import.meta.url),'utf8');
  const homeRefresh=stylesheet.slice(stylesheet.lastIndexOf('/* Clinician home:'));
  assert.match(homeRefresh,/@media \(max-width: 760px\)[\s\S]*?\.clinical-home-hero \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  const deployedScreens=new Set(['dashboard','studies','records','viewer','qr','exchange','audit','pacs-archive','admin','transfer']);
  for(const [,target] of home.matchAll(/data-view-jump="([^"]+)"/g)) assert.ok(deployedScreens.has(target),`deployed clinician route exists: ${target}`);
});
test('dedicated Viewer retains one pixel element and an explicit return action',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.equal((html.match(/id="viewer-image"/g)||[]).length,1);
  assert.ok(html.includes('mq-viewer-back'));
  assert.equal(html.includes('id="clinician-inline-viewer"'),false);
});
test('navigation relocates the same authorized Viewer shell, never copies pixels',()=>{
  const shell={id:'one-viewer'};
  let mounted=null;
  const preview={append(node){assert.equal(node,shell);mounted='A';}};
  const viewer={append(node){assert.equal(node,shell);mounted='B';}};
  const app={dataset:{},classList:{toggle(){}},querySelectorAll(){return[];},querySelector(selector){return selector==='.mq-viewer-shell'?shell:viewer;}};
  const context=vm.createContext({document:{querySelector(selector){return selector==='#hospital-saas-app'?app:selector==='#clinical-preview-host'?preview:null;}},stopCinePlayback(){},loadHospitalBPacsArchive(){},clinicianHealth:null,currentPersona:'DOCTOR'});
  context.stopCameraQrScan = () => {};
  vm.runInContext(fn,context);
  for(const [screen,host] of [['studies','A'],['viewer','B'],['studies','A']]) {
    vm.runInContext(`navigateHospitalScreen('${screen}')`,context); assert.equal(mounted,host);
  }
});
