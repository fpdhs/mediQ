// Loopback-only synthetic presentation fixture. No login, patient data or API requests.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),publicRoot=path.join(root,'public');
const fixture=`import {initializeViewerStudio} from '/ui/viewer-studio.js';
const view=new URL(location.href).searchParams.get('view')||'viewer';
document.title='합성 UI 검증 · '+view;
document.querySelector('#patient-portal-app').hidden=view!=='share';
document.querySelector('#hospital-saas-app').hidden=view==='share';
document.querySelectorAll('.mq-screen').forEach(s=>s.hidden=s.id!==(view==='images'?'clinical-desk':'viewer-screen'));
document.querySelectorAll('.patient-page').forEach(s=>s.hidden=!s.querySelector('.share-review'));
const share=document.querySelector('.share-review');if(view==='share'){for(let p=share;p&&p.id!=='patient-portal-app';p=p.parentElement)p.hidden=false;}
if(view==='viewer')document.querySelector('#hospital-saas-app').classList.add('mq-focus-viewer');
initializeViewerStudio({openViewer:async()=>{},renewAccess:async()=>{await new Promise(r=>setTimeout(r,600));document.querySelector('#viewer-countdown').textContent='04:59 남음';document.querySelector('#viewer-alert').textContent='합성 UI 검증 · 갱신 성공 표시';}});
document.querySelector('#studio-patient-label').textContent='홍길동 · 합성 시연';
document.querySelector('#viewer-countdown').textContent='토큰 만료됨 (재발급 필요)';
document.querySelector('#share-exam-title').textContent='복부 CT';
document.querySelector('#share-exam-meta').textContent='A대학병원 · 2026.10.10';
document.querySelector('#share-exam-count').textContent='선택한 시리즈 1개 · 합성 영상 700장';
if(view==='share'){document.querySelector('#hospital-saas-app').hidden=true;document.querySelectorAll('#patient-portal-app [data-page]').forEach(p=>p.hidden=!p.contains(share));}
`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/fixture.js'){res.writeHead(200,{'Content-Type':types['.js']});res.end(fixture);return;}
  if(u.pathname==='/'){
   let html=await readFile(path.join(publicRoot,'index.html'),'utf8');
   html=html.replace('<script type="module" src="/app.js"></script>','<script type="module" src="/fixture.js"></script>');
   res.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'});res.end(html);return;
  }
  const file=path.resolve(publicRoot,'.'+decodeURIComponent(u.pathname));
  if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
  const body=await readFile(file);
  res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404).end();}
}).listen(11455,'127.0.0.1',()=>console.log('Synthetic UI only: http://127.0.0.1:11455'));
