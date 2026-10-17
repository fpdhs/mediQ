// Isolated loopback fixture preview. Never a login substitute or public deployment.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {scenarioHealthStandard} from '../src/scenario-health-standard.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
import {hccCatalog} from '../src/capstone-hcc-catalog.js';
const root=path.resolve('public');
const html=readFileSync(path.join(root,'index.html'),'utf8');
const section=html.slice(html.indexOf('<details class="health-standard">'),html.indexOf('</section>',html.indexOf('<details class="health-standard">')));
const head=html.slice(html.indexOf('<head>')+6,html.indexOf('</head>')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link[^>]+auth-boot[^>]+>/g,'');
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
  if(url.pathname==='/'){
    res.setHeader('content-type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko"><head>${head}<style>body{padding:24px;max-width:1200px;margin:auto}.health-standard{margin-top:20px}button{min-height:44px}</style></head><body><p>로컬 합성 fixture UI 검증 · Azure 인증 검증 아님</p><button id="failure">다음 요청 실패로 전환</button><button id="reset">세션 초기화 예시</button>${section}<script type="module" src="/fixture-controller.js"></script></body></html>`);return;
  }
  if(url.pathname==='/fixture-controller.js'){
    res.setHeader('content-type','text/javascript');res.end(`import {createScenarioHealthStandard} from '/ui/scenario-health-standard.js';let fail=false;const root=document.querySelector('.health-standard');root.open=true;const ui=createScenarioHealthStandard({root,available:()=>true,onSnapshot:()=>{},onView:()=>{document.querySelector('#phr-load-state').textContent='기존 권한 확인 Viewer 호출 연결 (로컬 콜백 검증)';},request:async()=>{if(fail)throw new Error('HEALTH_RECORDS_UNAVAILABLE');return (await fetch('/fixture-data')).json();}});document.querySelector('#phr-refresh').onclick=()=>ui.load();document.querySelector('#failure').onclick=()=>{fail=true};document.querySelector('#reset').onclick=()=>ui.reset();await ui.load();`);return;
  }
  if(url.pathname==='/fixture-data'){
    res.setHeader('content-type','application/json');res.end(JSON.stringify({synthetic:true,clinicalUse:false,records:syntheticHealthRecords(),...scenarioHealthStandard(syntheticHealthRecords(),hccCatalog('2026-10-10').studies)}));return;
  }
  const file=path.resolve(root,'.'+url.pathname),types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.svg':'image/svg+xml'};
  if(!file.startsWith(root+path.sep)||!types[path.extname(file)]){res.writeHead(404);res.end();return;}
  try{res.setHeader('content-type',types[path.extname(file)]);res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}
}).listen(3097,'127.0.0.1',()=>console.log('Local fixture preview http://127.0.0.1:3097/'));
