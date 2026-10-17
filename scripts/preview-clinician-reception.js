// Loopback-only presentation fixture; no API, auth, or ticket redemption.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const root=path.resolve('public'),html=readFileSync(path.join(root,'index.html'),'utf8');
const links=html.match(/<link[^>]+rel="stylesheet"[^>]*>/g).filter(s=>!s.includes('auth-boot')).join('\n');
const section=html.slice(html.indexOf('<section class="mq-screen share-reception"'),html.indexOf('<!-- 2.4 Audit & Provenance -->'));
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');res.setHeader('cache-control','no-store');
 if(url.pathname==='/'){res.setHeader('content-type','text/html;charset=utf-8');res.end(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${links}<style>body{margin:0;background:#f3f7fc}#hospital-saas-app{display:block!important}.mq-screen[hidden]{display:none!important}</style></head><body><p>로컬 화면 검증 · 실제 접수 없음</p><div id="hospital-saas-app" data-ui-theme="clinical-white"><div id="clinical-home" hidden><h2></h2></div>${section}</div><script src="/jsqr.js"></script><script type="module" src="/fixture.js"></script></body></html>`);return;}
 if(url.pathname==='/fixture.js'){res.setHeader('content-type','text/javascript');res.end(`import {initializeReceptionHome} from '/ui/clinician-reception.js';initializeReceptionHome(document.querySelector('.share-reception'));document.querySelector('form').onsubmit=e=>{e.preventDefault();document.querySelector('#qr-handoff-message').textContent='로컬 화면 검증: 실제 접수하지 않았습니다.';};`);return;}
 const file=path.resolve(root,'.'+url.pathname),mime={'.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'};
 if(!file.startsWith(root+path.sep)||!mime[path.extname(file)]){res.writeHead(404).end();return;}
 try{res.setHeader('content-type',mime[path.extname(file)]);res.end(readFileSync(file));}catch{res.writeHead(404).end();}
}).listen(3099,'127.0.0.1',()=>console.log('http://127.0.0.1:3099/'));
