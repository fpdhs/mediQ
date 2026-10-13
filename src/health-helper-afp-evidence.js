// Independent AFP editorial candidate. No inherited medical approval or patient data.
import {readFile} from 'node:fs/promises';
import {POLICY,retrieveScenarioEvidence} from './health-helper-scenario-evidence.js';
import {sha256} from './health-helper-medlineplus.js';
const afp='https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/';
const results='https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/';
const relatedTestQuestionPattern=/(?:다른\s*검사|추가\s*검사|함께|같이).*(?:이유|왜|목적)|(?:이유|왜|목적).*(?:다른\s*검사|추가\s*검사|함께|같이)/u;
export const afpEntries=Object.freeze([
 ['PURPOSE',afp,'What is it used for?','AFP 종양표지자 검사는 다른 검사와 함께 특정 암의 평가를 돕거나 이미 진단된 질환과 치료 경과를 살피는 데 사용됩니다. 검사 목적은 환자의 건강 이력과 진료 상황에 따라 달라집니다.','이번 AFP 검사의 목적은 무엇인가요?'],
 ['LIMITS',afp,'What do the results mean?','AFP는 암이 아닌 간 손상이나 간 질환에서도 높아질 수 있고 일부 암에서는 정상일 수 있습니다. 따라서 AFP만으로 암 여부를 판단하지 않고 건강 이력과 영상검사 등 다른 결과를 함께 확인합니다.','AFP와 다른 검사 결과를 함께 어떻게 이해하면 좋을까요?'],
 ['PREPARATION',afp,'Will I need to do anything to prepare for the test?','AFP 종양표지자 검사 자체에는 특별한 준비가 필요하지 않다고 원문에서 설명합니다. 이 안내는 AFP 검사 자체에 대한 설명이며 함께 받는 다른 검사의 준비를 대신하지 않습니다.','함께 받는 검사 때문에 별도 준비가 필요한가요?'],
 ['COMPARISON',results,'What is a reference range?','검사기관마다 검사 방법과 참고범위가 달라 다른 기관의 결과를 그대로 비교할 수 없습니다. 시간에 따른 변화를 살필 때는 같은 검사기관의 결과인지, 보고서의 단위와 참고범위가 무엇인지 먼저 확인합니다.','이전 AFP 결과와 이번 결과는 같은 조건에서 비교할 수 있나요?'],
].map(([intent,url,section,text,question])=>Object.freeze({id:`afp-detail-${intent.toLowerCase()}`,intent,url,section,text,question,
 title:'혈청 AFP · '+({PURPOSE:'목적',LIMITS:'한계',PREPARATION:'준비',COMPARISON:'비교 조건'}[intent]),
 status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',checkedAt:'2026-10-12',clinicalUse:false,
 rightsPolicy:POLICY,rightsScope:'Medical test information only',
 applicability:intent==='COMPARISON'?'일반 검사 결과 비교 원칙; AFP 고유 검사법의 동등성을 보증하지 않음':'AFP 종양표지자 검사 일반 설명; 임신 선별검사와 구분',
 questionOrigin:'PROJECT_TEMPLATE',sourceUpdatedAt:null,
})));
export async function verifyAfpEvidence(folder){
 const m=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const notes=await readFile(new URL('notes.json',folder));
 const allowed=[POLICY,afp,results];
 if(m.status!=='DRAFT / UNASSIGNED'||m.medicalReview!=='UNASSIGNED'||m.clinicalUse!==false||m.serviceDeployment!==false
  ||sha256(notes)!==m.notesSha256||notes.toString()!==JSON.stringify(afpEntries,null,2)+'\n'
  ||!Array.isArray(m.sources)||m.sources.length!==allowed.length)throw Error('AFP_EVIDENCE_REJECTED');
 for(const url of allowed)if(m.sources.filter(s=>s.url===url).length!==1)throw Error('AFP_SOURCE_MISSING');
 for(const s of m.sources){
  if(!allowed.includes(s.url)||!/^sources\/[a-f0-9]{64}\.html$/.test(s.file))throw Error('AFP_SOURCE_REJECTED');
  if(sha256(await readFile(new URL(s.file,folder)))!==s.sha256)throw Error('AFP_SOURCE_HASH_MISMATCH');
 }
 return m;
}
export function retrieveAfpEvidence(question){
 const base=retrieveScenarioEvidence(question);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(base.status))return base;
 if(!/(?<![a-z])AFP(?![a-z])|알파태아단백/i.test(question))return base;
 if(/암인가|암이야|암인지|암.*(?:맞|아니|확정|진단|판별)|확정.*암|진단.*암|임신|태아|주기|몇개월|정상|수치|높|낮|증가|감소|퍼센트|범위|기준/.test(question))
  return {status:/암인가|암이야|암인지|암.*(?:맞|아니|확정|진단|판별)|확정.*암|진단.*암/.test(question)?'REFUSED':'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AFP_DETAIL_OUT_OF_SCOPE'};
 // Relation to imaging is supported only in the AFP limits intent; never answer CT preparation via AFP.
 if(/CT|초음파|AST|ALT|GGT/i.test(question)&&!/함께|한계|알.*없|판단/.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_SCENARIO_TOPICS'};
 const relatedTestQuestion=relatedTestQuestionPattern.test(question);
 const intents=relatedTestQuestion?[['PURPOSE',/.*/]]:[['PURPOSE',/목적|쓰이나|사용하|왜.*검사/],['LIMITS',/한계|알.*없는|다른 검사와 함께|함께.*(?:해석|이해|보는 이유)|판단/],
  ['PREPARATION',/준비|공복|금식/],['COMPARISON',/비교|이전|직전|지난/]].filter(([,p])=>p.test(question));
 if(!intents.length)return base;
 if(intents.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_AFP_INTENTS'};
 const e=afpEntries.find(x=>x.intent===intents[0][0]);
 return {status:'CANDIDATE',topic:'scenario-24',intent:relatedTestQuestion?'RELATED_TESTS':e.intent,extractiveOnly:true,
  questionTemplate:relatedTestQuestion?'자료에 명시된 이 검사와 다른 검사 사이의 관계는 무엇인가요?':e.question,
  evidence:[{chunk_id:e.id,doc_id:e.id,topic:'scenario-24',title_ko:e.title,text_ko:e.text,textSha256:sha256(e.text),
   source_url:e.url,source_updated_at:e.sourceUpdatedAt,section_path:[e.section],contentReview:'UNASSIGNED',clinicalUse:false,
   attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:POLICY,
   translation_notice:`프로젝트 작성 한국어 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · ${e.checkedAt} 확인 · ${e.applicability}`} ]};
}
