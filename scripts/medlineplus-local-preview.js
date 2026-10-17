// Isolated, loopback-only candidate. No patient records, authentication or production API replacement.
import {createServer} from 'node:http';
import {isIP} from 'node:net';
import {readFile} from 'node:fs/promises';
import {sha256,retrieveMedlineplus} from '../src/health-helper-medlineplus.js';
import {createCandidateQuestionHandler} from '../src/health-helper-candidate-http.js';
import {candidateRuntimeStatus,candidateSourceFingerprint} from '../src/health-helper-candidate-runtime.js';
import {SCHOOL_DEMO_LAN_PORTS} from '../src/health-helper-school-demo-runtime-config.js';
import {loadTranslationDrafts} from '../src/medlineplus-draft-corpus.js';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {retrieveScenarioEvidence,verifyScenarioEvidence} from '../src/health-helper-scenario-evidence.js';
import {retrieveAfpEvidence,verifyAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {retrieveLiverFunctionEvidence,verifyLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {retrieveImagingEvidence,verifyImagingEvidence} from '../src/health-helper-imaging-evidence.js';
import {retrieveHealthEducationEvidence} from '../src/health-helper-education-retrieval.js';
import {verifyScreeningEvidence} from '../src/health-helper-screening-evidence.js';
import {loadSchoolDemoMedicalTestAddendum,retrieveSchoolDemoCandidateEvidence} from '../src/health-helper-school-demo-medical-tests.js';
const port=Number(process.env.HIPASS_MEDLINEPLUS_PREVIEW_PORT??11438);
const schoolDemo=process.env.HIPASS_HEALTH_HELPER_SCHOOL_DEMO==='1';
if(![11438,11439,11440,11441,11442,11443,11444,11445,11446].includes(port))throw Error('PREVIEW_PORT_REJECTED');
if(schoolDemo&&(!SCHOOL_DEMO_LAN_PORTS.map(Number).includes(port)||process.env.HIPASS_MEDLINEPLUS_UPLOADED!=='1'))throw Error('SCHOOL_DEMO_PROFILE_INVALID');
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
const medicalTestAddendum=schoolDemo?await loadSchoolDemoMedicalTestAddendum():null;
const schoolDemoRetrievalCorpus=schoolDemo?{...uploaded,
 chunks:[...uploaded.chunks,...medicalTestAddendum.chunks],held:[...uploaded.held,...medicalTestAddendum.held],
 heldDocuments:[...uploaded.heldDocuments,...medicalTestAddendum.held]}:uploaded;
let corpus={chunks:[]};
if(!schoolDemo){
 const corpusPath=new URL('../data/medlineplus-ko-candidate-20261011/corpus.json',import.meta.url);
 const corpusBytes=await readFile(corpusPath);
 const manifest=JSON.parse(await readFile(new URL('./manifest.json',corpusPath),'utf8'));
 if(sha256(corpusBytes)!==manifest.corpusSha256)throw new Error('CORPUS_HASH_MISMATCH');
 corpus=JSON.parse(corpusBytes);
}
const detailedScope=education?'건강검진 20개·AFP·간기능·초음파·CT의 개념과 상세 질문 후보':afp?'AFP의 목적·한계·준비·비교 조건':liver?'간기능 패널과 AST·ALT·GGT의 목적·한계·준비·비교 조건':imaging?'초음파·CT의 목적·한계·준비·비교 조건':'검사별 일반 개념 설명';

const candidateLabel=schoolDemo
 ?'학교 발표용 비임상 건강도우미 데모 · 검사 기록과 의학 참고자료 기반 진료 질문 준비 (진단·처방 미지원)'
 :`로컬 검토 후보 · 공개 원문을 바탕으로 한 프로젝트 요약 · 의료전문가 검토 미실시 · 합성 입력 전용 ${uploaded?`· 검색 가능 ${uploaded.indexedDocuments}개`:''}`;
const helperAvailability=schoolDemo?'한국어 번역 코퍼스에서 근거를 찾아 짧게 설명하는 학교 발표용 데모입니다.': '검색된 공개 근거로 개념을 설명하고, 다음 진료 질문을 함께 챙겨요.';
const helperDisclaimer=schoolDemo
 ?'본 서비스는 학교 발표용 비임상 건강 정보 안내 데모입니다. 개인 건강기록 해석 및 진단·처방은 제공하지 않으며, 실제 진료와 치료에 관한 판단은 반드시 전문 의료진과 상담해 주세요. 개인정보나 식별정보는 입력하지 마세요.'
 :uploaded?'사용자 제공 한국어 번역문에서 근거를 검색하는 로컬 후보입니다. 모델 답변과 출처 안내를 구분해 표시합니다. 의료 내용과 번역 정확성은 미검증이며 실제 진료용이 아닙니다. 개인 검사 결과·식별정보를 입력하지 마세요.'
 :'로컬 검토 후보입니다. 개인 기록 수치·식별정보는 AI에 전달하지 않습니다. 상세 답변은 출처에 연결된 고정 요약 초안이며 Qwen 생성 답변이 아닙니다. 의료전문가 검토 전 서비스에 배포하지 않습니다.';
const showDebugHolds=process.env.HIPASS_SHOW_DEBUG_HOLDS==='1';
const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${schoolDemo?'건강도우미 · 학교 발표용 RAG MVP':'Medi Q · 설명형 RAG 로컬 후보'}</title><link rel="stylesheet" href="/public/ui/patient-helper.css"><link rel="stylesheet" href="/public/mobile/health-helper.css">
<style>body{margin:0;background:#f5f7fa;color:#192638;font-family:system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:24px}.candidate{padding:12px 20px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;text-align:center}</style>
<div class="candidate">${candidateLabel}</div>
${showDebugHolds&&uploaded?`<details style="padding:16px"><summary>콘텐츠 QA 보류 상태 자료 · ${uploaded.held.length+(medicalTestAddendum?.held.length??0)}개 (${schoolDemo?'학교 데모 검색 포함':'일반 후보 검색 제외'})</summary><ul id="held-source-list"></ul></details>`:''}
<div id="preview-parent"><main id="patient-health-helper"></main></div><script type="module" src="/preview.js"></script></html>`;
const contextTopicAliases=[...new Set([
 ...(uploaded?.chunks??corpus.chunks).flatMap(chunk=>chunk.aliases??[chunk.title_ko]),
 ...(uploaded?.held??[]).flatMap(document=>document.aliases??[]),
 ...(medicalTestAddendum?.chunks??[]).flatMap(chunk=>chunk.aliases??[chunk.title_ko]),
 'AFP','간기능','CT','MRI','초음파','X선','엑스선',
])].filter(alias=>typeof alias==='string'&&alias.trim());
const preview=`import {createPatientHelper} from '/public/ui/patient-helper.js';
import {resolveCandidateQuestion} from '/public/ui/candidate-question-context.js';let contextTopic=null;
const topicAliases=${JSON.stringify(contextTopicAliases)};
const mobile=new URLSearchParams(location.search).get('surface')==='mobile';if(mobile)document.querySelector('#preview-parent').id='tab-helper';
const heldList=document.querySelector('#held-source-list');
const demoIncludesHolds=${JSON.stringify(schoolDemo)};
if(heldList)fetch('/candidate/held-sources').then(r=>{if(!r.ok)throw Error();return r.json();}).then(rows=>{
 for(const row of rows){const item=document.createElement('li'),link=document.createElement('a');link.textContent=row.title+' · 데모 번역 후보 '+(row.schoolDemoCandidateStatus??'미포함')+' · 콘텐츠 QA HOLD';
 link.href=row.source_url;link.target='_blank';link.rel='noopener noreferrer';item.append(link,document.createTextNode(' — '+(demoIncludesHolds?'학교 데모 채택 상태이며 번역·임상 검증 PASS는 아님':'일반 후보 검색 제외')+' · 미해결 이슈 '+String(row.unresolvedIssueCount??0)+'건'));heldList.append(item);}
}).catch(()=>{heldList.textContent='보류 목록을 불러오지 못했습니다.';});
createPatientHelper(document.querySelector('#patient-health-helper'),{surface:mobile?'mobile':'web',ask:async(question,{signal})=>{
question=resolveCandidateQuestion(question,{contextTopic,topicAliases});
const response=await fetch('/candidate/questions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question}),signal});
const result=await response.json();if(!response.ok)throw new Error(result.error);if(!signal.aborted)contextTopic=result.contextTopic??null;return result;}});
document.querySelector('.helper-new-chat').addEventListener('click',()=>{contextTopic=null;});
document.querySelector('.helper-record-select').addEventListener('change',()=>{contextTopic=null;});
document.querySelector('[aria-label="검사 설명 질문"]').placeholder=${JSON.stringify(afp?'예: AFP 검사 목적과 비교 조건이 궁금해요':liver?'예: AST 검사 목적과 간기능 결과 비교 조건이 궁금해요':imaging?'예: 간 초음파 준비와 CT 비교 조건이 궁금해요':'예: 빈혈은 무엇인가요?')};
document.querySelector('.helper-availability').textContent=${JSON.stringify(helperAvailability)};
document.querySelector('.helper-disclaimer').textContent=${JSON.stringify(helperDisclaimer)};`;
const staticPaths=new Set(['/public/ui/patient-helper.js','/public/ui/candidate-question-context.js','/public/ui/patient-helper.css','/public/ui/health-comparison.js','/public/ui/health-comparison.css','/public/mobile/health-helper.css']);
const questionHandler=createCandidateQuestionHandler({expectedHost,expectedOrigin,modelTimeoutMs,
 allowSourceFallback:Boolean(schoolDemo&&uploaded),
 retrieveEvidence:async question=>{
  const drafts=uploaded?[]:await loadTranslationDrafts(new URL('../data/medlineplus-full-ko-20261011-v2/',import.meta.url));
  const scoped=education?retrieveHealthEducationEvidence(question):scenario?(afp?retrieveAfpEvidence(question):liver?retrieveLiverFunctionEvidence(question):imaging?retrieveImagingEvidence(question):retrieveScenarioEvidence(question)):null;
  if(education)return scoped;
  if(scenario&&scoped.reason!=='NO_SCENARIO_TOPIC')return scoped;
  if(schoolDemo)return retrieveSchoolDemoCandidateEvidence(question,schoolDemoRetrievalCorpus,medicalTestAddendum);
  return uploaded?retrieveUploadedEvidence(question,uploaded):retrieveMedlineplus(question,{...corpus,chunks:[...corpus.chunks,...drafts]});
 },
 insufficientAnswer:retrieval=>{
  if(retrieval.status==='REFUSED'){
   const q=retrieval.question??'';
   if(/운동|식단|음식|식품|영양|다이어트|예방|방지/u.test(q))
    return '특정 질환의 치료법이나 운동·예방 권고는 제공하지 않아요. 건강 관리와 운동 방법은 담당 의료진과 상담해 주세요.';
   if(/약|약물|의약품|처방|복용|투여|용량/u.test(q))
    return '약물의 처방이나 복약 용량에 대한 안내는 제공하지 않아요. 복용 관련 상담은 의료진 또는 약사와 확인해 주세요.';
   if(/진단|확진|판정|암인가|암이야|암인지/u.test(q))
    return '검사 수치나 증상으로 질환을 진단하거나 확정할 수는 없어요. 정확한 진단은 담당 의료진에게 문의해 주세요.';
   return '진단이나 치료·처방 판단은 제공하지 않아요. 증상과 검사 결과는 의료진에게 확인해 주세요.';
  }
  if(retrieval.status==='PERSONAL_INPUT_NOT_SUPPORTED')
   return '개인 건강상태·증상·검사결과의 개별 상담은 지원하지 않아요. 식별정보나 개인 검사 수치는 입력하지 마시고, 궁금한 점은 담당 의료진에게 문의해 주세요.';
  return (education||scenario)?`이 질문에 답할 충분한 근거가 없습니다. 현재 ${detailedScope}만 지원합니다.`:'질문에 답할 공개 근거가 충분하지 않습니다. 개인정보 없이 화면에 표시된 지원 주제의 개념을 질문해 주세요.';
 },
});
const runtimeStatus=candidateRuntimeStatus({sourceFingerprint:await candidateSourceFingerprint(),
 schoolDemo,uploaded,supplements:medicalTestAddendum?[medicalTestAddendum]:[],startedAt:new Date().toISOString()});
const server=createServer(async(req,res)=>{
 const send=(code,value,type='application/json')=>{res.writeHead(code,{'content-type':`${type}; charset=utf-8`,'cache-control':'no-store','x-content-type-options':'nosniff',
 'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"});res.end(type==='application/json'?JSON.stringify(value):value);};
 if(req.headers.host!==expectedHost)return send(403,{error:'HOST_REJECTED'});
 const path=new URL(req.url,`http://127.0.0.1:${port}`).pathname;
 if(req.method==='GET'){
  if(path==='/candidate/status')return send(200,runtimeStatus);
  if(path==='/favicon.ico'){res.writeHead(204);return res.end();}
  if(path==='/candidate/held-sources'&&uploaded)return send(200,[...uploaded.held,...(medicalTestAddendum?.held??[])].map(d=>({id:d.id,title:d.title,source_url:d.source_url,
   status:'HOLD',schoolDemoCandidateStatus:schoolDemo&&d.schoolDemoRetrievable?'PASS':'NOT_INCLUDED',aiQaStatus:d.aiQaStatus,sourceContentReview:d.sourceContentReview,
   unresolvedIssueCount:d.unresolvedIssueCount,reason:d.reason})));
  if(path==='/')return send(200,html,'text/html');if(path==='/preview.js')return send(200,preview,'text/javascript');
  if(staticPaths.has(path))return send(200,await readFile(new URL(`..${path}`,import.meta.url),'utf8'),path.endsWith('.css')?'text/css':'text/javascript');
  return send(404,{error:'NOT_FOUND'});
 }
 if(req.method!=='POST'||path!=='/candidate/questions')return send(404,{error:'NOT_FOUND'});
 return questionHandler(req,res,send);
});
server.requestTimeout=modelTimeoutMs+5000;server.headersTimeout=10000;
server.listen(port,bindAddress,()=>console.log(`Candidate preview: ${expectedOrigin} (not a patient service)`));
