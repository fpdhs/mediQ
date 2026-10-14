// Loopback-only synthetic UI fixture; not part of the public deployment.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {buildEventIndex,parseEventQuery,createSecurityReport} from '../src/security-console.js';
const now=new Date(),stamp=new Date(now-60000).toISOString();
const logs=[{auditId:'PREVIEW-1',actorType:'DOCTOR',actorId:'SYNTHETIC',hospitalId:'HOSP-B',action:'TOKEN_EXPIRED',result:'DENIED',reasonCode:'TOKEN_EXPIRED',createdAt:stamp}];
const vault={status:'available',events:[],observedAt:now.toISOString()};
const waf={status:'available',observedAt:now.toISOString(),scope:'로컬 합성 표본',events:[{eventRef:'a'.repeat(24),time:stamp,ruleId:'930130',result:'DETECTED'}]};
const entra={status:'available',scope:'로컬 합성 표본 · 실제 Entra 기록 아님',events:[{eventRef:'b'.repeat(24),time:stamp,application:'HIGH_PASS_WEB',result:'SUCCESS',reasonCode:'ENTRA_0'}]};
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>관제 UI · 로컬 합성 검증</title><link rel="stylesheet" href="/ui/security-console.css"><style>body{margin:0;background:#edf2f8;font:16px/1.6 system-ui,sans-serif}main{max-width:1180px;margin:24px auto;padding:0 16px}aside{padding:16px;background:#fff1c9;color:#503c00}</style><aside>로컬 합성 UI 검증 — 실제 Azure·Entra 사건 기록이 아닙니다.</aside><main data-screen="audit"><section class="security-observatory"></section></main><script type="module">import {renderSecurityConsole} from '/ui/security-console.js';const root=document.querySelector('section');const api={state:'ready',overview:{applicationAudit:{integrity:{ok:true,checked:1}}},fetchJson:async url=>(await fetch(url)).json(),postJson:async(url,body)=>(await fetch(url,{method:'POST',body:JSON.stringify(body)})).json(),refresh:()=>renderSecurityConsole(root,api)};renderSecurityConsole(root,api);</script></html>`;
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');
  if(url.pathname.startsWith('/ui/')&&/^\/ui\/security-(console|report)\.(js|css)$/u.test(url.pathname)){
   res.setHeader('Content-Type',url.pathname.endsWith('.js')?'text/javascript':'text/css');res.end(await readFile(new URL('../public'+url.pathname,import.meta.url)));return;
  }
  if(url.pathname==='/api/security/events'||url.pathname==='/api/security/reports'){
   const index=buildEventIndex(logs,vault,[],parseEventQuery(url.searchParams),waf,entra);res.setHeader('Content-Type','application/json');
   if(req.method==='POST'){let body='';for await(const chunk of req){body+=chunk;if(body.length>16384)throw new Error('TOO_LARGE');}res.end(JSON.stringify(createSecurityReport(index,JSON.parse(body),'SYNTHETIC_PREVIEW')));}
   else{const {allEvents,...view}=index;res.end(JSON.stringify(view));}return;
  }
  if(url.pathname!=='/'){res.writeHead(404).end();return;}res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);
 }catch{res.writeHead(400).end('{"error":"PREVIEW_INVALID"}');}
});
server.listen(0,'127.0.0.1',()=>console.log('LOOPBACK_UI_PREVIEW http://127.0.0.1:'+server.address().port+'/'));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(()=>process.exit(0)));
