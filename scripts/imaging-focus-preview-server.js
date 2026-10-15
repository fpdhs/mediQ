import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),publicRoot=path.join(root,'public');
const fixture=`import {initializeViewerStudio} from '/ui/viewer-studio.js';
document.title='합성 UI 검증 · 환자 영상';
document.querySelector('#patient-portal-app').hidden=true;
document.querySelector('#hospital-saas-app').hidden=false;
document.querySelectorAll('.mq-screen').forEach(s=>s.hidden=s.id!=='clinical-desk');
document.querySelector('#clinical-preview-host').append(document.querySelector('.mq-viewer-shell'));
initializeViewerStudio({openViewer:async()=>{}});
document.querySelector('#doctor-studies').textContent='검사 선택 대기 · 레이아웃 검증';
document.querySelector('#clinical-dossier').textContent='합성 UI 검증 · 서버 접근 승인 아님';
document.querySelector('#clinical-open-viewer').onclick=()=>{document.querySelectorAll('.mq-screen').forEach(s=>s.hidden=s.id!=='viewer-screen');document.querySelector('#hospital-saas-app').classList.add('mq-focus-viewer');document.querySelector('#viewer-screen').append(document.querySelector('.mq-viewer-shell'));};`;
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/focus-fixture.js'){res.writeHead(200,{'Content-Type':types['.js']});res.end(fixture);return;}
  if(url.pathname==='/'){
   let html=await readFile(path.join(publicRoot,'index.html'),'utf8');
   html=html.replace('<script type="module" src="/app.js"></script>','<script type="module" src="/focus-fixture.js"></script>');
   res.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'});res.end(html);return;
  }
  const file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(publicRoot+path.sep)){res.writeHead(403).end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404).end();}
}).listen(11454,'127.0.0.1',()=>console.log('Synthetic imaging UI layout QA: http://127.0.0.1:11454'));
