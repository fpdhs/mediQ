import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {imageInputAllowed} from '../public/ui/clinician-reception.js';
test('QR images are bounded and SVG/HTML unsupported',()=>{
  for(const type of ['image/png','image/jpeg','image/webp'])assert.equal(imageInputAllowed({type,size:1024}),true);
  for(const f of [null,{type:'image/svg+xml',size:100},{type:'text/html',size:100},{type:'image/png',size:0},{type:'image/png',size:8388609}])assert.equal(imageInputAllowed(f),false);
});
test('navigation presents QR home then desk, records and viewer',()=>{
  const html=readFileSync('public/index.html','utf8');
  assert.match(html,/data-view="dashboard"[^>]*>홈<[^]*?data-view="qr"[^>]*>접수 데스크<[^]*?data-view="records"[^>]*>환자 기록<[^]*?data-view="viewer"[^>]*>환자 영상</);
  assert.equal((html.match(/class="mq-screen[^"\n]*"[^>]*data-screen="dashboard"/g)||[]).length,1);
});
test('image import never posts data or grants access',()=>{
  const src=readFileSync('public/ui/clinician-reception.js','utf8');
  assert.doesNotMatch(src,/fetch\(|postJson\(|localStorage|sessionStorage|innerHTML/);
  assert.match(src,/request!==generation\|\|root.hidden\|\|!isActive\(\)/);
  assert.match(src,/bitmap\?\.close\(\)/);
});
test('workflow labels resolve to correct exclusive screens, not the old dashboard alias',()=>{
 const html=readFileSync('public/index.html','utf8');
 const flow=html.slice(html.indexOf('<nav class="clinical-flow"'),html.indexOf('<p id="reception-context"'));
 assert.match(flow,/data-view-jump="dashboard"[^>]*><span[^>]*>01<\/span>QR 접수/);
 assert.match(flow,/data-view-jump="qr"[^>]*><span[^>]*>02<\/span>접수 내용 확인/);
 assert.match(flow,/data-view-jump="studies"[^>]*><span[^>]*>04<\/span>검사 선택·영상 열기/);
 assert.doesNotMatch(flow,/data-view-jump="dashboard"[^>]*>[^\n]*검사 선택/);
 const app=readFileSync('public/app.js','utf8');
 assert.match(app,/screen === 'studies' \? 'viewer' : screen/);
 const redeem=app.slice(app.indexOf('async function redeemScannedNonce('),app.indexOf('async function simulateQrScan()'));
 assert.doesNotMatch(redeem,/navigateHospitalScreen\("viewer"\)/);
});
test('health records stay pinned to the selected reception and clear on identity reset',()=>{
 const app=readFileSync('public/app.js','utf8'),health=readFileSync('public/ui/clinician-health.js','utf8');
 assert.match(app,/clinicianHealth\?\.selectReception\(receipt.consentId\)/);
 assert.match(health,/result.shares.filter\(s=>s.consentId===receptionConsent\)/);
 assert.match(health,/reset\(\)\{receptionConsent=null/);
 assert.match(health,/다른 접수의 기록으로 자동 전환하지 않습니다/);
});
