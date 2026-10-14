import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),publicRoot=path.join(root,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    const file=url.pathname==='/'?path.join(root,'scripts/fixtures/reception-desk-preview.html'):url.pathname==='/reception-preview.js'?path.join(root,'scripts/fixtures/reception-desk-preview.js'):path.resolve(publicRoot,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(publicRoot+path.sep)&&!file.startsWith(path.join(root,'scripts/fixtures')+path.sep)){res.writeHead(403).end();return;}
    const body=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404).end();}
}).listen(11452,'127.0.0.1',()=>console.log('Synthetic reception UI QA: http://127.0.0.1:11452'));
