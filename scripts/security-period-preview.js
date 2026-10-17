// Loopback-only synthetic presentation fixture; never deployed to Azure.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {buildEventIndex,parseEventQuery,createSecurityReport} from '../src/security-console.js';
import {createPeriodSecurityReport,readSecurityReportSnapshot} from '../src/security-period-report.js';
const now=Date.now(),stamp=i=>new Date(now-i*3600000).toISOString();
const logs=Array.from({length:163},(_,i)=>({auditId:'SYNTH-'+i,actorType:'DOCTOR',actorId:'SYNTHETIC',hospitalId:'HOSP-B',action:i%3?'TOKEN_ISSUED':'IMAGE_VIEWED',result:i%4?'SUCCESS':'DENIED',reasonCode:i%4?'OK':'TOKEN_EXPIRED',createdAt:stamp(i)}));
const vault={status:'unavailable',events:[]},waf={status:'available',scope:'로컬 합성 표본 · 전체 접속 통계 아님',events:[]},entra={status:'not_configured',events:[]};
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>기간 보고서 · 합성 UI 검증</title><link rel="stylesheet" href="/ui/security-console.css"><style>body{margin:0;background:#edf2f8;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:24px auto;padding:0 16px}body>aside{padding:16px;background:#fff1c9;color:#503c00}</style><aside>로컬 합성 UI 검증 · 실제 Azure·환자·Entra 기록 아님</aside><main data-screen="audit"><section></section></main><script type="module">import {renderSecurityConsole} from '/ui/security-console.js';const root=document.querySelector('main section');const api={state:'ready',overview:{applicationAudit:{integrity:{ok:true,checked:163}}},fetchJson:async url=>{const r=await fetch(url);if(!r.ok)throw Error();return r.json();},postJson:async(url,body)=>{const r=await fetch(url,{method:'POST',body:JSON.stringify(body)});if(!r.ok)throw Error();return r.json();},refresh:()=>renderSecurityConsole(root,api)};renderSecurityConsole(root,api);</script></html>`;
createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
 if(/^\/ui\/security-(console|report|period-panel)\.(js|css)$/u.test(url.pathname)){const b=await readFile(new URL('../public'+url.pathname,import.meta.url));res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(b);return;}
 if(url.pathname==='/api/security/events'||url.pathname==='/api/security/reports'){
  const index=buildEventIndex(logs,vault,[],parseEventQuery(url.searchParams),waf,entra);res.setHeader('Content-Type','application/json');
  if(req.method==='POST'){let body='';for await(const b of req){body+=b;if(body.length>16384)throw Error();}const value=JSON.parse(body);res.end(JSON.stringify(value.snapshotId?readSecurityReportSnapshot(value,'SYNTHETIC'):value.mode==='PERIOD'?createPeriodSecurityReport(index,value,'SYNTHETIC'):createSecurityReport(index,value,'SYNTHETIC')));}
  else{const {allEvents,filteredEvents,...view}=index;res.end(JSON.stringify(view));}return;
 }
 if(url.pathname!=='/'){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
}catch{res.writeHead(400).end('{"error":"PREVIEW_INVALID"}');}}).listen(11456,'127.0.0.1',()=>console.log('Synthetic period UI: http://127.0.0.1:11456'));
