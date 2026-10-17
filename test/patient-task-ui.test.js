import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(name,'utf8');
test('task cards have clear titles and preserve approval form identities',()=>{
 const html=read('public/index.html');
 assert.equal((html.match(/class="patient-task-card"/g)||[]).length,3);
 for(const title of ['영상 공유','공유 내용 확인','공유 승인 전 확인'])assert.ok(html.includes('<h1>'+title+'</h1>'));
 for(const id of ['sharing-study','sharing-target','sharing-prepare','share-review-ack','patient-consent','patient-revoke','history-list','history-detail','share-patient-name'])assert.equal(html.split('id="'+id+'"').length-1,1);
 assert.match(html,/id="patient-consent"[^>]*disabled/);
 assert.doesNotMatch(html,/내 영상을, 필요한 병원에\.|내 영상이 이어준 진료\./);
});
test('sharing joins the common typography; no global banner injection or policy removal',()=>{
 const css=read('public/ui/patient-typography.css'),edge=read('scripts/start-public-web.js');
 assert.doesNotMatch(css,/:not\(\.sharing-page \*\)/);
 assert.match(css,/--hp-patient-page-title:26px/);
 assert.doesNotMatch(edge,/인터넷 합성 시연 · CT 열람\/전송/);
 for(const marker of ['signIngress','ENTRA_REQUIRED','PUBLIC_ROUTE_NOT_ENABLED',"'cache-control','no-store'","data-capstone"])assert.ok(edge.includes(marker));
 assert.match(read('public/index.html'),/합성 환자·비임상 시연 환경/);
});
