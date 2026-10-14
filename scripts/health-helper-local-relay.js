// Local-only narrow relay. Azure reaches it through a pinned SSH Unix socket forward.
import {createServer} from 'node:http';
import {ollamaVisitPayload} from '../src/health-helper-ollama.js';
import {validateVisitQuestions} from '../src/health-helper-visit.js';
import {validateTranslationRelayPayload} from '../src/health-helper-translation-relay.js';
let active=false;
async function acquireLock(timeoutMs=1000){
  const start=Date.now();
  while(active){
    if(Date.now()-start>timeoutMs)return false;
    await new Promise(r=>setTimeout(r,40));
  }
  active=true;
  return true;
}
const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};
  if(req.method!=='POST'||!['/visit-questions','/translation-selection'].includes(req.url))return send(404,{error:'NOT_FOUND'});
  if(!(await acquireLock()))return send(429,{error:'BUSY'});
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),55000);
  res.on('close',()=>controller.abort());
  try {
    let bytes=0;const parts=[];for await(const part of req){bytes+=part.length;if(bytes>32768)throw new Error('INPUT_INVALID');parts.push(part);}
    const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
    const payload=req.url==='/translation-selection'?validateTranslationRelayPayload(input):ollamaVisitPayload(input);
    const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',signal:controller.signal,
      headers:{'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error'});
    if(!response.ok)throw new Error('MODEL_UNAVAILABLE');
    const body=await response.text();if(body.length>65536)throw new Error('OUTPUT_TOO_LARGE');
    const result=JSON.parse(body);if(result.done!==true||result.done_reason!=='stop')throw new Error('OUTPUT_INCOMPLETE');
    send(200,req.url==='/translation-selection'?result:{questions:validateVisitQuestions(JSON.parse(result.message.content))});
  } catch {send(503,{error:'MODEL_UNAVAILABLE'});} finally {clearTimeout(timer);active=false;}
});
server.requestTimeout=60000;server.headersTimeout=10000;server.listen(11436,'127.0.0.1',()=>console.log('Visit relay listening on loopback only'));
