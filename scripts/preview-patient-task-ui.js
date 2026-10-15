// Loopback-only presentation fixture; never connects to an API or creates consent.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('public'),html=readFileSync(path.join(root,'index.html'),'utf8');
const links=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).filter(s=>!s.includes('auth-boot')).join('\n');
const controller=`
import {createPatientSharing} from '/ui/patient-sharing.js';
import {createQrTicketSurface} from '/ui/patient-qr-ticket.js';
import {createPatientHistory} from '/ui/patient-history.js';
import {createPatientHealth} from '/ui/patient-health.js';
import {createPatientHelper} from '/ui/patient-helper.js';
import {mountPatientWalletDock,createHelperSurface} from '/ui/wallet-home.js';
const source=new DOMParser().parseFromString(${JSON.stringify(html).replaceAll('<','\\u003c')},'text/html');
const host=document.querySelector('#patient-portal-app');
for(const page of ['sharing','activity','consent','phr','helper','visit'])host.append(source.querySelector('[data-page="'+page+'"]'));
const select=page=>{host.querySelectorAll('.page').forEach(p=>p.hidden=p.dataset.page!==page);const target=host.querySelector('[data-page="'+page+'"]');mountPatientWalletDock(target,page,select);window.scrollTo(0,0);};
const study={studyInstanceUid:'2.25.20261013001',sourceHospitalId:'HOSP-A',description:'합성 복부 CT',modality:'CT',studyDate:'2026-10-10',series:[{instanceCount:700}]};
const consent={consentId:'fixture-only',status:'ACTIVE',sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',validFrom:'2026-10-01T00:00:00Z',validUntil:'2090-10-20T00:00:00Z',scopes:[{studyInstanceUid:study.studyInstanceUid}],createdAt:'2026-10-01T00:00:00Z'};
const qrTicket=createQrTicketSurface({root:host.querySelector('[data-page="visit"]'),read:()=>({consents:[consent],studies:[study]}),readStatus:async()=>{throw Error('LOCAL_FIXTURE_NO_API');},issue:async()=>{throw Error('LOCAL_FIXTURE_NO_API');},navigate:select});qrTicket.refresh();
createPatientSharing({root:host.querySelector('[data-page="sharing"]'),onPrepare:()=>select('consent'),onRevoke:()=>{}}).update([study],[]);
createPatientHistory({root:host.querySelector('[data-page="activity"]'),onManage:()=>select('sharing'),onRefresh:async()=>{}}).update([study],[consent]);
createPatientHealth({root:host.querySelector('#patient-health-records'),onHome:()=>select('sharing'),onSharing:()=>select('sharing'),onRequests:()=>select('activity')}).update([study],false,[]);
const helper=host.querySelector('#patient-health-helper');createPatientHelper(helper,{navigate:select,getRecords:()=>[],ask:async()=>{throw Error('LOCAL_FIXTURE_NO_API')}});createHelperSurface(helper,select);
host.querySelectorAll('[data-route="home"]').forEach(b=>b.onclick=()=>select('sharing'));
document.querySelectorAll('[data-preview-page]').forEach(b=>b.onclick=()=>select(b.dataset.previewPage));
select('visit');
`;
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
 if(url.pathname==='/'){
  res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<style>body{background:#f5f8fc;margin:0;padding:16px}.page[hidden]{display:none!important}#patient-portal-app{display:block!important}.preview-nav{display:flex;gap:8px;flex-wrap:wrap;max-width:1120px;margin:auto}.preview-nav button{min-height:44px}.preview-note{text-align:center;font:14px sans-serif}</style></head><body><p class="preview-note">로컬 합성 화면 검증 · 실제 인증·공유 없음</p><nav class="preview-nav">${[['sharing','영상 공유'],['activity','공유 내용 확인'],['consent','승인 전 확인'],['phr','내 건강기록'],['helper','건강도우미']].map(([id,text])=>`<button data-preview-page="${id}">${text}</button>`).join('')}</nav><main id="patient-portal-app" data-ui-theme="patient-premium"></main><script type="module" src="/preview-controller.js"></script></body></html>`);return;
 }
 if(url.pathname==='/preview-controller.js'){res.setHeader('content-type','text/javascript');res.end(controller);return;}
 const file=path.resolve(root,'.'+url.pathname),mime={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
 if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404).end();return;}
 try{res.setHeader('content-type',mime[path.extname(file)]);res.end(readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(3098,'127.0.0.1',()=>console.log('Local presentation fixture http://127.0.0.1:3098/'));
