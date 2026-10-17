// Resume-safe generation of translation DRAFTs, not clinical/production approval.
import {readFile,mkdir,writeFile,rename,appendFile} from 'node:fs/promises';
import {readFileSync,unlinkSync} from 'node:fs';
import {verifyFullScope,sourceBody,splitTranslationSource,translationPayload,translationChecks,digest} from '../src/medlineplus-translation.js';
const root=new URL('../',import.meta.url),folder=new URL('data/medlineplus-full-ko-20261011-v2/',root);
const legacy=new URL('data/medlineplus-full-ko-20261011/',root);
const sourcesPath='C:/Users/user/Downloads/medlineplus_all_english_sources.jsonl';
const manifestPath='C:/Users/user/Downloads/full_scope_manifest.json';
const [bytes,manifestBytes]=await Promise.all([readFile(sourcesPath),readFile(manifestPath)]);
const manifest=JSON.parse(manifestBytes);const records=verifyFullScope(bytes,manifest);
const plan={generatorVersion:'ko-translation-v2-terminology',sourceFile:sourcesPath,sourceSha256:digest(bytes),manifestSha256:digest(manifestBytes),documents:records.length,
 pending:records.filter(d=>d.translation_status==='PENDING').length,excludedHistoricalHolds:manifest.existing_hold_topic_ids,
 review:'DRAFT / UNASSIGNED',model:'qwen3.5:4b',originalXmlZipVerification:'NOT VERIFIED',productionDeployment:false};
try{await mkdir(folder);await writeFile(new URL('plan.json',folder),JSON.stringify(plan,null,2),{flag:'wx'});await mkdir(new URL('parts/',folder));await mkdir(new URL('documents/',folder));}
catch(e){if(e.code!=='EEXIST')throw e;const old=JSON.parse(await readFile(new URL('plan.json',folder),'utf8'));if(old.sourceSha256!==plan.sourceSha256||old.manifestSha256!==plan.manifestSha256)throw new Error('RESUME_SOURCE_MISMATCH');}
if(process.argv.includes('--prepare')){console.log(JSON.stringify(plan));process.exit(0);}
const lock=new URL('run.lock',folder);const nonce=`${process.pid}-${Date.now()}`;
try{const old=JSON.parse(await readFile(lock,'utf8'));if(!Number.isSafeInteger(old.pid)||old.pid<1)throw new Error('INVALID_JOB_LOCK');
 let alive=true;try{process.kill(old.pid,0);}catch(e){if(e.code==='ESRCH')alive=false;else throw e;}
 if(alive)throw new Error('TRANSLATION_JOB_ALREADY_RUNNING');unlinkSync(lock);
}catch(e){if(e.code!=='ENOENT')throw e;}
await writeFile(lock,JSON.stringify({pid:process.pid,nonce}),{flag:'wx'});
process.on('exit',()=>{try{if(JSON.parse(readFileSync(lock,'utf8')).nonce===nonce)unlinkSync(lock);}catch{}});
const log=value=>appendFile(new URL('events.jsonl',folder),JSON.stringify({at:new Date().toISOString(),...value})+'\n');
const priorities=['6308','3951','6382','310','309'];
const pending=records.filter(d=>d.translation_status==='PENDING').sort((a,b)=>{
 const rank=id=>priorities.includes(id)?priorities.indexOf(id):-1;
 return (rank(a.source_topic_id)<0?999:rank(a.source_topic_id))-(rank(b.source_topic_id)<0?999:rank(b.source_topic_id));});
let state={status:'RUNNING',pid:process.pid,startedAt:new Date().toISOString(),plan,completed:[],held:[],failed:[],current:null};
try{const old=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));state={...state,completed:old.completed,held:old.held,failed:old.failed};}catch(e){if(e.code!=='ENOENT')throw e;}
async function checkpoint(){state.updatedAt=new Date().toISOString();const temp=new URL(`state-${process.pid}.tmp`,folder);await writeFile(temp,JSON.stringify(state,null,2));await rename(temp,new URL('state.json',folder));}
await checkpoint();await log({event:'START',pid:process.pid});
async function fatal(error){state.status='FAILED';state.error=error.name==='TimeoutError'?'TIMEOUT':String(error.message).slice(0,200);
 try{await checkpoint();await log({event:'FATAL',reason:state.error});}finally{process.exit(1);}}
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
// Finite job: one pass through 1007 pending records, one retry per failed part.
for(const doc of pending){
 const id=doc.source_topic_id;if(state.completed.some(d=>d.id===id)||state.held.some(d=>d.id===id))continue;
 const body=sourceBody(doc);const parts=[{start:0,end:doc.title_en.length,text:doc.title_en,kind:'TITLE'},...splitTranslationSource(body).map(p=>({...p,kind:'BODY'}))];
 const translated=[];let failed=false;state.current={id,title:doc.title_en,part:0,totalParts:parts.length};await checkpoint();
 for(let i=0;i<parts.length;i++){
  const p=parts[i],file=new URL(`parts/${id}-${i}.json`,folder);let saved;
  try{saved=JSON.parse(await readFile(file,'utf8'));if(saved.sourceSha256!==digest(p.text))throw new Error('PART_SOURCE_MISMATCH');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  if(!saved){try{const cached=JSON.parse(await readFile(new URL(`parts/${id}-${i}.json`,legacy),'utf8'));
    const checks=translationChecks(p.text,cached.text_ko);
    if(cached.sourceSha256===digest(p.text)&&cached.textSha256===digest(cached.text_ko)&&checks.status==='AUTOMATED_CHECKS_PASS'){
     saved={...cached,checks,reusedFrom:'ko-translation-v1',recheckedAt:new Date().toISOString()};await writeFile(file,JSON.stringify(saved,null,2),{flag:'wx'});
    }}catch(e){if(e.code!=='ENOENT')throw e;}}
  if(!saved){for(let attempt=0;attempt<2;attempt++){
   const started=Date.now();try{
    const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(translationPayload(p)),signal:AbortSignal.timeout(90000),redirect:'error'});
    if(!response.ok)throw new Error('MODEL_HTTP_FAILURE');const decoder=new TextDecoder('utf-8',{fatal:true});let text='';
    for await(const b of response.body){text+=decoder.decode(b,{stream:true});if(text.length>65536)throw new Error('MODEL_OUTPUT_TOO_LARGE');}text+=decoder.decode();
    const r=JSON.parse(text);if(r.done!==true||r.done_reason!=='stop')throw new Error('MODEL_OUTPUT_INCOMPLETE');
    const value=JSON.parse(r.message.content);if(Object.keys(value).join(',')!=='text_ko')throw new Error('MODEL_SCHEMA_FAILURE');
    saved={part:i,kind:p.kind,start:p.start,end:p.end,sourceSha256:digest(p.text),sourceText:p.text,text_ko:value.text_ko,
     textSha256:typeof value.text_ko==='string'?digest(value.text_ko):null,checks:translationChecks(p.text,value.text_ko),elapsedMs:Date.now()-started,
     model:r.model,promptSha256:digest(JSON.stringify(translationPayload(p))),generatorVersion:plan.generatorVersion,
     translatedAt:new Date().toISOString(),review:'DRAFT / UNASSIGNED'};
    await writeFile(file,JSON.stringify(saved,null,2),{flag:'wx'});await log({event:'PART_TRANSLATED',id,part:i,checks:saved.checks.status,elapsedMs:saved.elapsedMs});break;
   }catch(e){await log({event:'PART_FAILED',id,part:i,attempt,reason:e.name==='TimeoutError'?'TIMEOUT':e.message});}
  }}
  if(!saved){failed=true;break;}translated.push(saved);state.current.part=i+1;await checkpoint();
 }
 if(failed){state.failed.push({id,reason:'PART_GENERATION_FAILED'});await checkpoint();continue;}
 const held=translated.some(p=>p.checks.status!=='AUTOMATED_CHECKS_PASS');
 const result={id,doc_id:doc.doc_id,title_en:doc.title_en,title_ko:translated[0].text_ko,source_url:doc.source_url,
  source_updated_at:doc.source_updated_at,export_generated_at:doc.export_generated_at,sourceSha256:digest(body),
  sourceFileSha256:plan.sourceSha256,sourceBodyLocation:doc.effective_source_body_location,attribution:doc.attribution,
  rights_policy_url:doc.rights_policy_url,translationStatus:held?'HOLD':'TRANSLATED_DRAFT',ai_qa_status:'UNASSIGNED',
  human_review_status:'UNASSIGNED',clinicalUse:false,parts:translated.slice(1),review:'DRAFT / UNASSIGNED'};
 const documentBytes=JSON.stringify(result,null,2);const resultFile=new URL(`documents/${id}.json`,folder);
 try{await writeFile(resultFile,documentBytes,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;if(await readFile(resultFile,'utf8')!==documentBytes)throw new Error('DOCUMENT_COLLISION');}
 const entry={id,title:doc.title_en,title_ko:result.title_ko,sha256:digest(documentBytes)};
 (held?state.held:state.completed).push(entry);state.failed=state.failed.filter(d=>d.id!==id);await checkpoint();
 await log({event:'DOCUMENT_FINISHED',id,status:result.translationStatus});
}
state.status=state.failed.length||state.held.length?'FINISHED_WITH_REVIEW_ITEMS':'TRANSLATION_DRAFTS_COMPLETE';state.current=null;await checkpoint();await log({event:'FINISH',completed:state.completed.length,held:state.held.length,failed:state.failed.length});
