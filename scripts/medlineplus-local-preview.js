// Isolated, loopback-only candidate. No patient records, authentication or production API replacement.
import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {readFile} from 'node:fs/promises';
import {sha256,retrieveMedlineplus,educationPayload,validateEducationOutput,sourceGuidanceFromEvidence} from '../src/health-helper-medlineplus.js';
import {loadTranslationDrafts} from '../src/medlineplus-draft-corpus.js';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {retrieveScenarioEvidence,verifyScenarioEvidence} from '../src/health-helper-scenario-evidence.js';
import {retrieveAfpEvidence,verifyAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {retrieveLiverFunctionEvidence,verifyLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {retrieveImagingEvidence,verifyImagingEvidence} from '../src/health-helper-imaging-evidence.js';
import {retrieveHealthEducationEvidence} from '../src/health-helper-education-retrieval.js';
import {verifyScreeningEvidence} from '../src/health-helper-screening-evidence.js';
const port=Number(process.env.HIPASS_MEDLINEPLUS_PREVIEW_PORT??11438);
const schoolDemo=process.env.HIPASS_HEALTH_HELPER_SCHOOL_DEMO==='1';
if(![11438,11439,11440,11441,11442,11443,11444,11445].includes(port))throw Error('PREVIEW_PORT_REJECTED');
if(schoolDemo&&(port!==11445||process.env.HIPASS_MEDLINEPLUS_UPLOADED!=='1'))throw Error('SCHOOL_DEMO_PROFILE_INVALID');
const bindAddress=schoolDemo?(process.env.HIPASS_HEALTH_HELPER_SCHOOL_BIND_ADDRESS??'127.0.0.1'):'127.0.0.1';
const publicHost=schoolDemo?(process.env.HIPASS_HEALTH_HELPER_SCHOOL_PUBLIC_HOST??'127.0.0.1'):'127.0.0.1';
if(schoolDemo&&(![4].includes(isIP(publicHost))||!(bindAddress==='0.0.0.0'||bindAddress==='127.0.0.1'||isIP(bindAddress)===4)
  ||bindAddress==='127.0.0.1'&&publicHost!=='127.0.0.1'
  ||bindAddress!=='127.0.0.1'&&publicHost==='127.0.0.1'
  ||bindAddress!=='0.0.0.0'&&bindAddress!=='127.0.0.1'&&bindAddress!==publicHost))throw Error('SCHOOL_DEMO_BINDING_INVALID');
const expectedHost=`${publicHost}:${port}`;
const expectedOrigin=`http://${expectedHost}`;
const modelTimeoutMs=schoolDemo?120000:55000;
const education=process.env.HIPASS_HEALTH_EDUCATION==='1';
if(education&&port!==11444)throw Error('EDUCATION_PREVIEW_PORT_REJECTED');
const afp=process.env.HIPASS_AFP_EVIDENCE==='1';
if(afp&&port!==11441)throw Error('AFP_PREVIEW_PORT_REJECTED');
const liver=process.env.HIPASS_LIVER_EVIDENCE==='1';
if(liver&&port!==11442)throw Error('LIVER_PREVIEW_PORT_REJECTED');
const imaging=process.env.HIPASS_IMAGING_EVIDENCE==='1';
if(imaging&&port!==11443)throw Error('IMAGING_PREVIEW_PORT_REJECTED');
if(education&&[afp,liver,imaging].some(Boolean))throw Error('EDUCATION_PREVIEW_MODE_CONFLICT');
if([afp,liver,imaging].filter(Boolean).length>1)throw Error('SINGLE_TOPIC_PREVIEW_ONLY');
const scenario=process.env.HIPASS_SCENARIO_EVIDENCE==='1';
if(education&&scenario)throw Error('EDUCATION_PREVIEW_MODE_CONFLICT');
if(scenario&&port!==11440&&!(afp&&port===11441)&&!(liver&&port===11442)&&!(imaging&&port===11443))throw Error('SCENARIO_PREVIEW_PORT_REJECTED');
if((afp||liver||imaging)&&!scenario)throw Error('DETAIL_EVIDENCE_REQUIRES_SCENARIO');
if(education){
 await verifyScenarioEvidence(new URL('../data/health-helper-scenario-evidence-20261012/',import.meta.url));
 await verifyAfpEvidence(new URL('../data/health-helper-afp-evidence-20261012-v2/',import.meta.url));
 await verifyLiverFunctionEvidence(new URL('../data/health-helper-liver-evidence-20261012-v2/',import.meta.url));
 await verifyImagingEvidence(new URL('../data/health-helper-imaging-evidence-20261012-v6/',import.meta.url));
 await verifyScreeningEvidence(new URL('../data/health-helper-screening-evidence-20261012-v1/',import.meta.url));
}
if(afp)await verifyAfpEvidence(new URL('../data/health-helper-afp-evidence-20261012-v2/',import.meta.url));
if(liver)await verifyLiverFunctionEvidence(new URL('../data/health-helper-liver-evidence-20261012-v2/',import.meta.url));
if(imaging)await verifyImagingEvidence(new URL('../data/health-helper-imaging-evidence-20261012-v6/',import.meta.url));
if(scenario)await verifyScenarioEvidence(new URL('../data/health-helper-scenario-evidence-20261012/',import.meta.url));
const uploaded=process.env.HIPASS_MEDLINEPLUS_UPLOADED==='1'
 ?await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:schoolDemo}):null;
if(schoolDemo&&(!uploaded||uploaded.retrievalCorpus!=='TRANSLATION_ONLY'))throw Error('SCHOOL_DEMO_TRANSLATION_CORPUS_REQUIRED');
let corpus={chunks:[]};
if(!schoolDemo){
 const corpusPath=new URL('../data/medlineplus-ko-candidate-20261011/corpus.json',import.meta.url);
 const corpusBytes=await readFile(corpusPath);
 const manifest=JSON.parse(await readFile(new URL('./manifest.json',corpusPath),'utf8'));
 if(sha256(corpusBytes)!==manifest.corpusSha256)throw new Error('CORPUS_HASH_MISMATCH');
 corpus=JSON.parse(corpusBytes);
}
const detailedScope=education?'건강검진 20개·AFP·간기능·초음파·CT의 개념과 상세 질문 후보':afp?'AFP의 목적·한계·준비·비교 조건':liver?'간기능 패널과 AST·ALT·GGT의 목적·한계·준비·비교 조건':imaging?'초음파·CT의 목적·한계·준비·비교 조건':'검사별 일반 개념 설명';
let active=false;let calls=[];
const candidateLabel=schoolDemo
 ?`학교 발표용 비임상 RAG MVP · 한국어 번역문만 검색·모델 근거로 사용 · 데모 색인 PASS ${uploaded.demoIndexPassDocuments}개(텍스트 무결성만 확인) · 콘텐츠 QA HOLD ${uploaded.held.length}개도 데모 검색 포함 · 의료 내용/임상 정확성 미검증 · 합성 질문 전용 · 개인 기록/진단/치료 판단 미지원 · 모델 가중치 학습 아님`
 :`로컬 검토 후보 · 공개 원문을 바탕으로 한 프로젝트 요약 · 의료전문가 검토 미실시 · 합성 입력 전용 · 현재 서비스에 미배포 ${uploaded?`· 검색 가능 ${uploaded.indexedDocuments}개 / 보류 ${uploaded.held.length}개`:''} ${education?'· 통합 질문 검색 131개 초안: 건강검진 20×4, AFP 4, 간기능 13, 초음파·CT 8 및 개념 26; 지원 범위 밖은 근거 부족':scenario?'· 검사 26개 개념 요약'+(afp?' 및 AFP 상세 질문 4종':liver?' 및 간기능 패널·AST·ALT·GGT 상세 질문 13종':imaging?' 및 초음파·CT 상세 질문 8종':' 후보; 그 밖의 상세 의도는 근거 부족'):''}`;
const helperAvailability=schoolDemo?'한국어 번역 코퍼스에서 근거를 찾아 짧게 설명하는 학교 발표용 데모입니다.': '검색된 공개 근거로 개념을 설명하고, 다음 진료 질문을 함께 챙겨요.';
const helperDisclaimer=schoolDemo
 ?'번역문 검색 기반 비임상 발표 데모입니다. 색인 PASS는 한글 번역 텍스트의 무결성 검사일 뿐 콘텐츠 QA·원문 정확성·의학적 검증 PASS가 아닙니다. 일부 자료는 미해결 이슈가 있어 콘텐츠 QA HOLD 상태를 유지합니다. 개인 검사 결과·식별정보를 입력하지 마세요. 진단·치료 판단이나 실제 환자 서비스가 아닙니다. Qwen 모델 가중치는 변경하지 않았습니다.'
 :'로컬 검토 후보입니다. 개인 기록 수치·식별정보는 AI에 전달하지 않습니다. 상세 답변은 출처에 연결된 고정 요약 초안이며 Qwen 생성 답변이 아닙니다. 의료전문가 검토 전 서비스에 배포하지 않습니다.';
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${schoolDemo?'건강도우미 · 학교 발표용 RAG MVP':'Medi Q · 설명형 RAG 로컬 후보'}</title><link rel="stylesheet" href="/public/ui/patient-helper.css"><link rel="stylesheet" href="/public/mobile/health-helper.css">
<style>body{margin:0;background:#f5f7fa;color:#192638;font-family:system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:24px}.candidate{padding:16px;background:#e7eef9;border-bottom:1px solid #bbcee7}</style>
<div class="candidate">${candidateLabel}</div>
${uploaded?`<details style="padding:16px"><summary>콘텐츠 QA 보류 상태 자료 · ${uploaded.held.length}개 (${schoolDemo?'학교 데모 검색 포함':'일반 후보 검색 제외'})</summary><ul id="held-source-list"></ul></details>`:''}
<div id="preview-parent"><main id="patient-health-helper"></main></div><script type="module" src="/preview.js"></script></html>`;
const preview=`import {createPatientHelper} from '/public/ui/patient-helper.js';let contextTopic=null;
const mobile=new URLSearchParams(location.search).get('surface')==='mobile';if(mobile)document.querySelector('#preview-parent').id='tab-helper';
const heldList=document.querySelector('#held-source-list');
const demoIncludesHolds=${JSON.stringify(schoolDemo)};
if(heldList)fetch('/candidate/held-sources').then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{
 for(const row of rows){const item=document.createElement('li'),link=document.createElement('a');link.textContent=row.title+' · 콘텐츠 QA HOLD';
 link.href=row.source_url;link.target='_blank';link.rel='noopener noreferrer';item.append(link,document.createTextNode(' — '+(demoIncludesHolds?'학교 데모 색인 PASS(번역 무결성만)':'일반 후보 검색 제외')+' · 미해결 이슈 '+String(row.unresolvedIssueCount??0)+'건'));heldList.append(item);}
}).catch(()=>{heldList.textContent='보류 목록을 불러오지 못했습니다.';});
createPatientHelper(document.querySelector('#patient-health-helper'),{surface:mobile?'mobile':'web',ask:async(question,{signal})=>{
if(contextTopic && /^(그|이것|그러면|다음|어떤|원인|증상|좀 더)/u.test(question) && !/빈혈|당뇨|천식|역류|감기|독감|인플루엔자|두통|허리|고혈압|불면|AFP|간기능|CT|초음파/iu.test(question))question=contextTopic+': '+question;
const response=await fetch('/candidate/questions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question}),signal});
const result=await response.json();if(!response.ok)throw new Error(result.error);if(!signal.aborted)contextTopic=result.contextTopic??null;return result;}});
document.querySelector('.helper-new-chat').addEventListener('click',()=>{contextTopic=null;});
document.querySelector('.helper-record-select').addEventListener('change',()=>{contextTopic=null;});
document.querySelector('[aria-label="검사 설명 질문"]').placeholder=${JSON.stringify(afp?'예: AFP 검사 목적과 비교 조건이 궁금해요':liver?'예: AST 검사 목적과 간기능 결과 비교 조건이 궁금해요':imaging?'예: 간 초음파 준비와 CT 비교 조건이 궁금해요':'예: 빈혈은 무엇인가요?')};
document.querySelector('.helper-availability').textContent=${JSON.stringify(helperAvailability)};
document.querySelector('.helper-disclaimer').textContent=${JSON.stringify(helperDisclaimer)};`;
const staticPaths=new Set(['/public/ui/patient-helper.js','/public/ui/patient-helper.css','/public/ui/health-comparison.js','/public/ui/health-comparison.css','/public/mobile/health-helper.css']);
const server=createServer(async(req,res)=>{
 const send=(code,value,type='application/json')=>{res.writeHead(code,{'content-type':`${type}; charset=utf-8`,'cache-control':'no-store','x-content-type-options':'nosniff',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
 if(req.headers.host!==expectedHost)return send(403,{error:'HOST_REJECTED'});
 const path=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
 if(req.method==='GET'){
  if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(path==='/candidate/held-sources'&&uploaded)return send(200,uploaded.held.map(d=>({id:d.id,title:d.title,source_url:d.source_url,
   status:'HOLD',aiQaStatus:d.aiQaStatus,sourceContentReview:d.sourceContentReview,
   unresolvedIssueCount:d.unresolvedIssueCount,reason:d.reason})));
  if(path==='/')return send(200,html,'text/html');if(path==='/preview.js')return send(200,preview,'text/javascript');
  if(staticPaths.has(path))return send(200,await readFile(new URL(`..${path}`,import.meta.url),'utf8'),path.endsWith('.css')?'text/css':'text/javascript');
  return send(404,{error:'NOT_FOUND'});
 }
 if(req.method!=='POST'||path!=='/candidate/questions')return send(404,{error:'NOT_FOUND'});
 if(req.headers.origin!==expectedOrigin||req.headers['content-type']!=='application/json')return send(403,{error:'ORIGIN_REJECTED'});
 if(active)return send(429,{error:'BUSY'});
 calls=calls.filter(t=>Date.now()-t<60000);if(calls.length>=5)return send(429,{error:'RATE_LIMITED'});
 let bytes=0,parts=[];try{for await(const part of req){bytes+=part.length;if(bytes>4096)throw new Error();parts.push(part);}
 const data=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
 const body=JSON.parse(data);if(Object.keys(body).join(',')!=='question')throw new Error();
 const drafts=uploaded?[]:await loadTranslationDrafts(new URL('../data/medlineplus-full-ko-20261011-v2/',import.meta.url));
 const scoped=education?retrieveHealthEducationEvidence(body.question):scenario?(afp?retrieveAfpEvidence(body.question):liver?retrieveLiverFunctionEvidence(body.question):imaging?retrieveImagingEvidence(body.question):retrieveScenarioEvidence(body.question)):null;
 const retrieval=education?scoped:scenario&&scoped.reason!=='NO_SCENARIO_TOPIC'?scoped:uploaded?retrieveUploadedEvidence(body.question,uploaded):retrieveMedlineplus(body.question,{...corpus,chunks:[...corpus.chunks,...drafts]});
 if(schoolDemo&&uploaded&&retrieval.status==='CANDIDATE'&&!retrieval.extractiveOnly)retrieval.claimEvidenceRequired=true;
 if(retrieval.status==='SOURCE_ON_HOLD')return send(200,{status:'SOURCE_GUIDANCE',generationUsed:false,answer:'이 주제의 자료는 등록되어 있지만 내용 검토가 보류되어 AI 설명 근거로 사용하지 않습니다. 아래 원문을 직접 확인하거나 의료진에게 문의해 주세요.',questions:[],
 sources:retrieval.heldSources.map(d=>({id:d.id,url:d.url,title:d.title,institution:'MedlinePlus · 미국 국립의학도서관',section:'Health Topics 요약 · HOLD',
 contextNote:'등록된 보류 자료 · AI 답변 근거로 사용 안 함',licenseLabel:'Source: MedlinePlus, National Library of Medicine.',licenseUrl:'https://medlineplus.gov/about/using/usingcontent/'}))});
 if(retrieval.status!=='CANDIDATE'){
  const answer=retrieval.status==='REFUSED'?'검사 결과로 암을 확정하거나 개인 진단을 내릴 수는 없어요. 검사 목적과 다음 확인 사항은 담당 의료진에게 문의해 주세요.':
   retrieval.status==='PERSONAL_INPUT_NOT_SUPPORTED'?'이 로컬 후보에는 개인 이름이나 검사 수치를 입력할 수 없어요. 수치 해석은 담당 의료진에게 문의해 주세요.':
   (education||scenario)?`이 질문에 답할 충분한 근거가 없습니다. 현재 ${detailedScope}만 지원합니다.`:'이 질문은 현재 공개 근거 설명 범위에 포함되지 않습니다. 개인정보 없이 빈혈 등 지원 주제의 개념을 질문해 주세요.';
  return send(200,{status:retrieval.status,answer,sources:[],questions:[],generationUsed:false,recordContext:'NOT_CONNECTED'});
 }
 if(retrieval.extractiveOnly){
  const result=sourceGuidanceFromEvidence(retrieval),hasListContext=result.sources.some(source=>Array.isArray(source.listContexts)&&source.listContexts.length>0);
  return send(200,{...result,questionOrigin:'PROJECT_TEMPLATE',questions:[retrieval.questionTemplate],
   ...(hasListContext?{answer:'질문과 관련된 목록 안내와 항목을 번역 후보로 나누어 표시합니다. 본인에게 적용되는지는 의료진에게 확인해 주세요.'}:{}),
   responseMode:'SOURCE_GUIDANCE_LIST_CONTEXT',recordContext:'NOT_CONNECTED'});
 }
 active=true;calls.push(Date.now());const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),modelTimeoutMs);res.on('close',()=>controller.abort());
 try{
  const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(educationPayload(retrieval)),signal:controller.signal,redirect:'error'});
  if(!response.ok)throw new Error();let text='';const decoder=new TextDecoder('utf-8',{fatal:true});
  for await(const part of response.body){text+=decoder.decode(part,{stream:true});if(text.length>65536)throw new Error();}text+=decoder.decode();
  const result=JSON.parse(text);if(result.done!==true||result.done_reason!=='stop')throw new Error();
  send(200,{...validateEducationOutput(JSON.parse(result.message.content),retrieval),contextTopic:retrieval.evidence[0].title_ko});
 }catch{
  if(schoolDemo&&uploaded&&retrieval.claimEvidenceRequired){
   try{return send(200,sourceGuidanceFromEvidence(retrieval));}catch{/* Fail closed below. */}
  }
  send(503,{error:'MODEL_UNAVAILABLE_OR_OUTPUT_REJECTED'});
 }finally{clearTimeout(timer);active=false;}
 }catch{send(400,{error:'INVALID_INPUT'});}
});
server.requestTimeout=modelTimeoutMs+5000;server.headersTimeout=10000;
server.listen(port,bindAddress,()=>console.log(`Candidate preview: ${expectedOrigin} (not a patient service)`));
