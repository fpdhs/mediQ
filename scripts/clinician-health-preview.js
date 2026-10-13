// Loopback-only fixture: real shared-health handler, ephemeral signed Test JWT,
// memory-only audit/consents. No production DB, ingress, PACS, or credentials.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHmac,randomBytes} from 'node:crypto';
import {TestProvider} from '../src/auth.js';
import {createSharedHealthHandler,healthRecordScope} from '../src/shared-health-records.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
import {HCC_PATIENT_ID} from '../src/capstone-hcc-catalog.js';
const secret=randomBytes(32).toString('base64url'),auth=new TestProvider({TEST_JWT_SECRET:secret});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const head=encode({alg:'HS256',typ:'JWT'}),claims=encode({iss:'hipass-test',aud:'hipass-api',sub:'preview-doctor',role:'DOCTOR',roles:['DOCTOR'],doctorId:'DOC-B-01',hospitalId:'HOSP-B',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});
const token=`${head}.${claims}.${createHmac('sha256',secret).update(`${head}.${claims}`).digest('base64url')}`;
const rows=syntheticHealthRecords();
const consent={consentId:'preview-selected-health',patientId:HCC_PATIENT_ID,sourceHospitalId:'HOSP-A',targetHospitalId:'HOSP-B',purpose:'TRANSFER',permission:'VIEW_ONLY',status:'ACTIVE',validFrom:new Date(Date.now()-10000).toISOString(),validUntil:new Date(Date.now()+3600000).toISOString(),healthRecordScope:healthRecordScope(rows.map(r=>r.id))};
const audits=[];
const route=createSharedHealthHandler({authenticate:req=>auth.authenticate(req),requestMeta:()=>({}),audit:async row=>audits.push(row),consents:()=>[consent],doctors:()=>[{doctorId:'DOC-B-01',hospitalId:'HOSP-B',roles:['DOCTOR'],approvedPurposes:['TRANSFER']}],hospitals:()=>[{hospitalId:'HOSP-A',status:'ACTIVE'},{hospitalId:'HOSP-B',status:'ACTIVE'}],eligible:()=>true});
const publicRoot=path.resolve('public');
const server=createServer(async(req,res)=>{
  res.setHeader('cache-control','no-store');
  const url=new URL(req.url,'http://127.0.0.1');
  try{
    if(await route(req,res,url))return;
    if(url.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
    if(url.pathname==='/preview'){
      const html=await readFile(path.join(publicRoot,'index.html'),'utf8');
      const styles=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).join('\n');
      res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{margin:0;background:#f4f7fb;font-family:Pretendard,sans-serif}main{max-width:1200px;margin:auto;padding:32px 22px}nav{display:flex;gap:28px;background:white;padding:24px;flex-wrap:wrap}nav strong{margin-right:auto;color:#192b43}nav span{color:#5d7592}.preview-label{padding:8px;text-align:center;font-size:12px;background:#e8eff9;color:#355478}nav .selected{color:#3566b8;font-weight:700}</style><body><div class="preview-label">로컬 합성 fixture · Test JWT / 메모리 감사 · 운영 배포·PACS 검증 아님</div><nav><strong>Medi Q</strong><span>진료 준비</span><span class="selected">환자 기록</span><span>환자·영상</span><span>영상 접수</span><span>공유 현황</span></nav><main><div id="clinician-health-records"></div><hr><section id="share-health-picker"></section><p id="picker-result">선택한 기록 없음</p></main><script type="module">
      import{createClinicianHealth}from'/ui/clinician-health.js';import{createHealthSharePicker}from'/ui/health-share-picker.js';
      const ui=createClinicianHealth(document.querySelector('#clinician-health-records'),{headers:()=>({authorization:${JSON.stringify('Bearer '+token)}}),available:()=>true,onImages:()=>{document.querySelector('.preview-label').textContent='환자·영상 이동 요청 · fixture에서는 영상을 열지 않습니다.';}});ui.setActive(true);window.addEventListener('pagehide',()=>ui.reset());
      const picker=createHealthSharePicker(document.querySelector('#share-health-picker'),{onChange:()=>document.querySelector('#picker-result').textContent=picker.titles().join(', ')||'선택한 기록 없음'});picker.update(${JSON.stringify(rows).replaceAll('<','\\u003c')});
      </script></body></html>`);return;
    }
    const file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(publicRoot+path.sep)||url.pathname.startsWith('/api/')){res.writeHead(404).end();return;}
    const bytes=await readFile(file),types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};res.setHeader('content-type',types[path.extname(file)]??'application/octet-stream');res.end(bytes);
  }catch{res.writeHead(500).end();}
});
server.requestTimeout=10000;server.headersTimeout=10000;
server.listen(11448,'127.0.0.1',()=>console.log('Local synthetic health UI http://127.0.0.1:11448/preview'));
