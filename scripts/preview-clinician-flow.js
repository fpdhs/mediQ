// Local presentation fixture only; never invokes APIs or creates authorizations.
import http from 'node:http';import {readFileSync} from 'node:fs';import path from 'node:path';
const root=path.resolve('public'),html=readFileSync(root+'/index.html','utf8');
const links=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).filter(s=>!s.includes('auth-boot')).join('\n');
const desk=html.slice(html.indexOf('<section class="mq-screen clinician-home"'),html.indexOf('<!-- 2.3 5-Step Exchange Pipeline -->'));
const home=html.slice(html.indexOf('<section class="mq-screen share-reception"'),html.indexOf('<!-- 2.4 Audit & Provenance -->'));
const flow=html.slice(html.indexOf('<nav class="clinical-flow"'),html.indexOf('<p id="reception-context"'));
const controller=`import {initializeReceptionHome} from '/ui/clinician-reception.js';import {createReceptionDesk} from '/ui/clinician-reception-desk.js';
initializeReceptionHome(document.querySelector('.share-reception'));
const navigate=view=>{document.querySelectorAll('[data-screen]').forEach(s=>s.hidden=s.dataset.screen!==view);if(view==='qr')desk.load();};
const receipt={ticketId:'FIXTURE',patientId:'합성 홍길동',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',receivedAt:'2026-10-14T01:00:00Z',status:'CONSENT_ACTIVE',consent:{purpose:'TRANSFER',permission:'VIEW_ONLY',validUntil:'2026-10-20'},studies:[{description:'복부 CT · 합성 시연 영상',modality:'CT',studyDate:'2026-10-10'}]};
const desk=createReceptionDesk(document.querySelector('#clinical-home'),{read:async()=>({receptions:[receipt]}),select:async()=>{},navigate,active:()=>true});
document.querySelectorAll('[data-view-jump]').forEach(b=>b.onclick=()=>navigate(b.dataset.viewJump));navigate('qr');`;
http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
if(url.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<style>body{margin:0;background:#f4f7fb;padding:16px}#hospital-saas-app{display:block!important}[hidden]{display:none!important}.clinician-home{padding:24px!important}</style></head><body><p>로컬 합성 화면 검증 · 실제 접수 없음</p><main id="hospital-saas-app" data-ui-theme="clinical-white">${flow}${desk}${home}<section data-screen="studies" hidden><h2>검사 선택 · 영상 열기</h2><p>QR 입력창 없음 · 이 fixture에서는 영상을 열지 않습니다.</p></section><section data-screen="records" hidden><h2>환자 기록</h2></section></main><script src="/jsqr.js"></script><script type="module" src="/fixture.js"></script></body></html>`);return;}
if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(controller);return;}
const file=path.resolve(root,'.'+url.pathname),mime={'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404).end();return;}try{res.setHeader('content-type',mime[path.extname(file)]);res.end(readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(3099,'127.0.0.1',()=>console.log('Flow fixture http://127.0.0.1:3099'));
