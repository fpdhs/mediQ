import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {sha256,retrieveMedlineplus,validateMedlineplusBatch} from '../src/health-helper-medlineplus.js';
const root=new URL('../',import.meta.url);const folder=new URL('data/medlineplus-ko-candidate-20261011/',root);
const bytes=await readFile(new URL('corpus.json',folder));const corpus=JSON.parse(bytes);
const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));const results=[];
const check=(name,ok)=>{results.push({name,result:ok?'PASS':'FAIL'});};
check('corpus manifest SHA-256',sha256(bytes)===manifest.corpusSha256);
const raw=await Promise.all(manifest.inputs.map(async input=>{const b=await readFile(input.path);check('input SHA-256 '+input.path,sha256(b)===input.sha256);return b.toString('utf8').trim().split(/\r?\n/u).map(JSON.parse);}));
check('source and translated segment revalidation',validateMedlineplusBatch(...raw).chunks.length===34);
for(const q of ['빈혈','제2형 당뇨병','천식','위식도역류','감기','독감','두통','허리 통증'])check('retrieval '+q,retrieveMedlineplus(q,corpus).status==='CANDIDATE');
for(const q of ['고혈압','불면증','AFP','CT'])check('unsupported '+q,retrieveMedlineplus(q,corpus).status==='INSUFFICIENT_EVIDENCE');
for(const [question,expected] of [['빈혈 수치 10','PERSONAL_INPUT_NOT_SUPPORTED'],['빈혈 처방','REFUSED']]){
 const r=await fetch('http://127.0.0.1:11438/candidate/questions',{method:'POST',headers:{origin:'http://127.0.0.1:11438','content-type':'application/json'},body:JSON.stringify({question}),signal:AbortSignal.timeout(5000)});
 check('local HTTP '+expected,r.status===200&&(await r.json()).status===expected);
}
const wrongOrigin=await fetch('http://127.0.0.1:11438/candidate/questions',{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify({question:'빈혈'}),signal:AbortSignal.timeout(5000)});
check('foreign Origin denied',wrongOrigin.status===403);
const injected=await fetch('http://127.0.0.1:11438/candidate/questions',{method:'POST',headers:{origin:'http://127.0.0.1:11438','content-type':'application/json'},body:JSON.stringify({question:'빈혈',patientId:'injected'}),signal:AbortSignal.timeout(5000)});
check('unknown fields denied',injected.status===400);
const evidence=new URL(`artifacts/health-helper/medlineplus-${Date.now()}/`,root);await mkdir(evidence,{recursive:true});
await writeFile(new URL('verification.json',evidence),JSON.stringify({observedAt:new Date().toISOString(),review:'DRAFT / UNASSIGNED',
 corpusSha256:manifest.corpusSha256,results,modelAnswerVerification:'separate browser observations',productionDeployment:false},null,2),{flag:'wx'});
console.log(JSON.stringify({evidence:decodeURIComponent(evidence.pathname),pass:results.filter(r=>r.result==='PASS').length,total:results.length}));
if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
