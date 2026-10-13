// Local-only narrow relay. Azure reaches it through a pinned SSH Unix socket forward.
import {createServer} from 'node:http';
import {ollamaVisitPayload} from '../src/health-helper-ollama.js';
import {validateVisitQuestions} from '../src/health-helper-visit.js';
let active=false;
const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method!=='POST'||req.url!=='/visit-questions')return send(404,{error:'NOT_FOUND'});
  if(active)return send(429,{error:'BUSY'});
  active=true;const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55000);
  res.on('close',()=>controller.abort());
  try {
    let bytes=0,data='';for await(const part of req){bytes+=part.length;if(bytes>4096)throw new Error('INPUT_INVALID');data+=part;}
    const payload=ollamaVisitPayload(JSON.parse(data));
    const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error'});
    if(!response.ok)throw new Error('MODEL_UNAVAILABLE');
    const body=await response.text();if(body.length>65536)throw new Error('OUTPUT_TOO_LARGE');
    const result=JSON.parse(body);if(result.done!==true||result.done_reason!=='stop')throw new Error('OUTPUT_INCOMPLETE');
    send(200,{questions:validateVisitQuestions(JSON.parse(result.message.content))});
  } catch {send(503,{error:'MODEL_UNAVAILABLE'});} finally {clearTimeout(timer);active=false;}
});
server.requestTimeout=60000;server.headersTimeout=10000;server.listen(11436,'127.0.0.1',()=>console.log('Visit relay listening on loopback only'));
