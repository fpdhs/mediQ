// Loopback-only visual fixture. No patient API, credentials, approvals or PACS access.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const publicRoot=path.resolve('public');
const previewPort=Number(process.env.HIPASS_SHARING_PREVIEW_PORT??11447);
if(!Number.isInteger(previewPort)||previewPort<1024||previewPort>65535)throw new Error('Invalid sharing preview port');
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/preview'){
   const mobile=url.searchParams.has('mobile'),html=await readFile(path.join(publicRoot,mobile?'mobile/index.html':'index.html'),'utf8');
   const links=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).join('\n')+'<style>.page[hidden]{display:none!important}</style>';
   res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<style>body{background:#f5f8fc;margin:0;padding:16px}#patient-portal-app{display:block!important}#tab-share{display:block;max-width:540px;margin:auto}.preview-label{font:13px sans-serif;color:#536783;text-align:center}.page{display:block!important}</style><body><p class="preview-label">로컬 디자인 검증 · 합성 fixture · 실제 공유/서버 연결 없음</p><div id="patient-portal-app" data-ui-theme="patient-premium"></div><script type="module">
    import {createSharingSurface,createPatientSharing} from '/ui/patient-sharing.js';
    import {mountPatientWalletDock} from '/ui/wallet-home.js';
    import {createPatientHealth} from '/ui/patient-health.js';
    const doc=new DOMParser().parseFromString(${JSON.stringify(html).replaceAll('<','\\u003c')},'text/html');
    const root=doc.querySelector(${JSON.stringify(mobile?'#tab-share':'[data-page="sharing"]')});root.hidden=false;document.querySelector('#patient-portal-app').append(root);
    createSharingSurface(root,()=>{},${mobile});
    ${mobile?'':`const host=document.querySelector('#patient-portal-app');
    for(const page of ['phr','helper','activity']){const section=doc.querySelector('[data-page="'+page+'"]');section.hidden=true;host.append(section);}
    const helper=host.querySelector('#patient-health-helper');const heading=document.createElement('h1');heading.textContent='건강도우미';helper.append(heading);
    const navigate=page=>{host.querySelectorAll('[data-page]').forEach(section=>section.hidden=section.dataset.page!==page);mountPatientWalletDock(host.querySelector('[data-page="'+page+'"]'),page,navigate);};
    const records=createPatientHealth({root:host.querySelector('#patient-health-records'),patientName:()=> '합성 환자',onSharing:()=>navigate('sharing'),onRequests:()=>navigate('activity'),onCompare:()=>navigate('helper')});
    records.update([],true);navigate('sharing');`}
    ${mobile?`document.querySelector('#share-select-items').textContent='복부 CT · 2026.10.10 · A대학병원 (합성 시연)';
    const step=n=>{for(let i=1;i<=4;i++){const el=document.querySelector('#wizard-step-'+i);el.classList.toggle('active',i===n);el.style.display=i===n?'block':'none';const dot=document.querySelector('.step-dot[data-step="'+i+'"]');dot.classList.toggle('active',i<=n);if(i===n)dot.setAttribute('aria-current','step');else dot.removeAttribute('aria-current');}};
    step(1);document.querySelector('#btn-wizard-to-2').onclick=()=>step(2);document.querySelector('#btn-wizard-to-3').onclick=()=>step(3);document.querySelector('#btn-wizard-back-to-1').onclick=()=>step(1);document.querySelector('#btn-wizard-back-to-2').onclick=()=>step(2);`:`const ui=createPatientSharing({root,onPrepare:()=>{document.querySelector('.preview-label').textContent='내용 확인 이동 요청됨 · 이 fixture는 동의를 생성하지 않습니다.';},onRevoke:()=>{}});
    ui.update([{studyInstanceUid:'2.25.20261012001',sourceHospitalId:'HOSP-A',description:'합성 복부 CT 시연 영상',modality:'CT',studyDate:'2026-10-10',series:[{instanceCount:700}]}],[]);`}
   </script></body></html>`);return;
  }
  const file=path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(publicRoot+path.sep)||url.pathname.startsWith('/api/')){res.writeHead(404).end();return;}
  const data=await readFile(file);const mime={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
  res.setHeader('content-type',mime[path.extname(file)]??'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end();}
});
server.requestTimeout=10000;server.headersTimeout=10000;
server.listen(previewPort,'127.0.0.1',()=>console.log(`Local synthetic UI fixture http://127.0.0.1:${previewPort}/preview`));
