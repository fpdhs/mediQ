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
  assert.match(home,/id="cq-access-state"[^>]*>서버 검증 전/);
  assert.match(home,/권한 확인 후 영상 열기/);
  assert.match(home,/cq-queue/);
  assert.match(home,/cq-detail/);
  assert.match(home,/다음 진료, 바로 이어가세요/);
  assert.doesNotMatch(home,/clinical-home-hero|지갑/);
  const stylesheet=readFileSync(new URL('../public/ui/clinician-home.css',import.meta.url),'utf8');
  assert.match(stylesheet,/@media\(max-width:700px\)/);
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
