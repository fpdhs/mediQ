import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('public/index.html','utf8');
const css=readFileSync('public/ui/clinician-preparation.css','utf8');
test('preparation design retains one existing protected preview and action contract',()=>{
 for(const id of ['clinical-open-viewer','clinical-preview-host','clinical-dossier','doctor-studies','clinician-search','clinician-filter','desk-details-dialog'])assert.equal(html.split(`id="${id}"`).length-1,1);
 assert.equal(html.split('id="viewer-image"').length-1,1);
});
test('briefing board removes wallet and does not fabricate clinical completion',()=>{
 const desk=html.match(/id="clinical-desk"[\s\S]*?(?=<!-- 2\.2 Cloud DICOM Viewer -->)/)[0];
 assert.ok(!desk.includes('prep-wallet'));assert.ok(html.includes('진료 질문 공유는 아직 연결되지 않았습니다'));
 assert.ok(desk.includes('오늘의 진료 순서'));
 assert.ok(css.includes('background: #101b2a'));
 assert.ok(css.includes('#clinical-preview-host .studio-lock'));
 assert.ok(css.includes('prefers-reduced-motion'));assert.ok(css.includes('max-width: 700px'));
});
