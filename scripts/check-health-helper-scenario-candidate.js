import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {retrieveScenarioEvidence} from '../src/health-helper-scenario-evidence.js';
const folder=new URL('../data/health-helper-scenario-check-20261012-v3/',import.meta.url);
await mkdir(folder);const results=[];
const defs=(await readFile(new URL('../data/health-helper-scenario-scope-20261012-v2/evaluation.jsonl',import.meta.url),'utf8')).trim().split('\n').map(JSON.parse);
const statuses={};for(const d of defs){const r=retrieveScenarioEvidence(d.question);statuses[r.status]=(statuses[r.status]??0)+1;}
console.log(JSON.stringify({routingDefinitions:defs.length,statuses,modelQualityTests:false}));
for(const [question,expected] of [['AFP는 무엇인가요?','GENERATED'],['간 초음파는 무엇인가요?','GENERATED'],['CT는 무엇인가요?','GENERATED'],
 ['AFP 정상범위는 무엇인가요?','INSUFFICIENT_EVIDENCE'],['AFP로 확진해주세요','REFUSED'],['홍길동 AFP 수치 99','PERSONAL_INPUT_NOT_SUPPORTED'],['불면증은 무엇인가요?','SOURCE_GUIDANCE']]){
 const started=Date.now();let entry={question,expected};
 try{
  const response=await fetch('http://127.0.0.1:11440/candidate/questions',{method:'POST',headers:{origin:'http://127.0.0.1:11440','content-type':'application/json'},
   body:JSON.stringify({question}),signal:AbortSignal.timeout(60000)});
  const data=await response.json();entry={...entry,httpStatus:response.status,response:data};assert.equal(response.status,200);assert.equal(data.status,expected);
  if(expected==='GENERATED'){assert.ok(data.sources.length);assert.ok(data.questions.length);assert.equal(data.reviewStatus,'DRAFT / UNASSIGNED');assert.equal(data.answer.replace(/\s+/g,''),retrieveScenarioEvidence(question).evidence[0].text_ko.replace(/\s+/g,''));}
  else assert.equal(data.sources.length,expected==='SOURCE_GUIDANCE'?1:0);
  entry.result='PASS';
 }catch(e){entry.result='FAIL';entry.error=e.message;}
 entry.elapsedMs=Date.now()-started;results.push(entry);console.log(JSON.stringify({question,result:entry.result,status:entry.response?.status,elapsedMs:entry.elapsedMs}));
}
await writeFile(new URL('result.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',clinicalReview:'NOT VERIFIED',actualPatientAPI:false,
 routingDefinitions:defs.length,routingStatuses:statuses,results},null,2),{flag:'wx'});
if(results.some(r=>r.result==='FAIL'))process.exitCode=1;
