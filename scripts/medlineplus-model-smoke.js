import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {retrieveMedlineplus,educationPayload,validateEducationOutput} from '../src/health-helper-medlineplus.js';
const corpus=JSON.parse(await readFile(new URL('../data/medlineplus-ko-candidate-20261011/corpus.json',import.meta.url),'utf8'));
const retrieval=retrieveMedlineplus(process.argv[2]??'빈혈은 무엇인가요?',corpus);const started=performance.now();
try{
 const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(educationPayload(retrieval)),signal:AbortSignal.timeout(55000)});
 const result=await response.json();console.log(JSON.stringify({elapsedMs:Math.round(performance.now()-started),done:result.done,reason:result.done_reason,promptTokens:result.prompt_eval_count,outputTokens:result.eval_count}));
 const value=JSON.parse(result.message.content);let output;
 try{output=validateEducationOutput(value,retrieval);}catch(error){console.log(JSON.stringify({rejectedCandidate:value}));throw error;}
 console.log(JSON.stringify(output,null,2));
}catch(error){console.log(JSON.stringify({status:'FAIL',elapsedMs:Math.round(performance.now()-started),reason:error.message}));process.exitCode=1;}
