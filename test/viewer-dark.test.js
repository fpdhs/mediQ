import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/ui/clinical-glass.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const viewer=html.slice(html.indexOf('<section class="mq-screen" id="viewer-screen"'),html.indexOf('<!-- 2.5 PACS Import'));
test('viewer removes demonstration badges but keeps identity and functional state',()=>{
  for(const text of ['studio-synthetic','합성 시연 영상 · 임상 판단 금지','합성 데이터로 구성된 시연 환경입니다.'])assert.ok(!viewer.includes(text));
  for(const id of ['studio-patient-label','viewer-status','viewer-alert','viewer-countdown','viewer-perm-label','studio-open-image'])assert.ok(viewer.includes(`id="${id}"`));
});
test('empty initial watermark still accepts existing audit watermark',()=>{
  assert.ok(viewer.includes('id="viewer-watermark"></div>'));
  assert.ok(app.includes('function updateWatermark(sessionInfo)'));
  assert.ok(app.includes('sessionInfo?.auditSessionId'));
  assert.ok(!css.match(/#viewer-watermark\s*\{[^}]*display\s*:\s*none/));
});
test('notice suppression is scoped to an active clinician viewer only',()=>{
  assert.ok(css.includes('body:has(#hospital-saas-app.mq-focus-viewer:not([hidden])) > aside[style*="background:#edf3fa"][style*="text-align:center"]{display:none}'));
  assert.ok(css.includes('--studio-base:#192225'));
  assert.ok(css.includes('.studio-topbar{background:var(--studio-base);color:var(--studio-text)'));
});
