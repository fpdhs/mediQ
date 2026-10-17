// Source-grounded liver-test editorial drafts. Not approved clinical advice.
import {readFile} from 'node:fs/promises';
import {POLICY,retrieveScenarioEvidence} from './health-helper-scenario-evidence.js';
import {sha256} from './health-helper-medlineplus.js';
import {sourceSectionsExist} from './health-helper-source-sections.js';
import {sourceUpdatedAtForUrl} from './health-helper-source-freshness.js';

const root='https://medlineplus.gov/lab-tests/';
const urls=Object.freeze({
 panel:`${root}liver-function-tests/`,
 ast:`${root}ast-test/`,
 alt:`${root}alt-blood-test/`,
 ggt:`${root}gamma-glutamyl-transferase-ggt-test/`,
 comparison:`${root}how-to-understand-your-lab-results/`,
});

const definitions=[
 ['PANEL','PURPOSE','간기능 검사에는 무엇이 포함되고 왜 하나요?',urls.panel,'What are liver function tests? · What are they used for?',
  '간기능 패널은 혈액에서 간과 관련된 여러 단백질·효소·빌리루빈 등을 함께 측정합니다. 검사 구성은 다를 수 있으며, 증상 확인이나 이미 알려진 간질환의 경과·치료 반응, 일부 약물의 영향을 살피는 데 도움을 줍니다.',
  '이번 간기능 검사에는 어떤 항목이 포함되며, 각 항목을 확인하는 이유는 무엇인가요?'],
 ['PANEL','LIMITS','간기능 검사만으로 원인을 알 수 있나요?',urls.panel,'What do the results mean?',
  '간기능 검사만으로 특정 질환을 확정하기는 보통 어렵습니다. 의료진은 여러 검사값의 양상과 증상·병력·복용 약 등을 함께 살펴 이상 결과의 원인을 확인합니다.',
  '제 검사에서 함께 살펴야 할 다른 결과나 정보는 무엇인가요?'],
 ['PANEL','PREPARATION','간기능 검사 전에는 어떻게 준비하나요?',urls.panel,'Will I need to do anything to prepare for the test?',
  '검사기관이나 의료진의 준비 안내를 먼저 확인하세요. MedlinePlus는 간기능 검사 전 열 시간에서 열두 시간 금식이 필요할 수 있다고 설명하며, 복용 중인 약은 알리되 의료진 지시 없이 중단하지 말라고 안내합니다.',
  '이번 검사에서 금식 시간과 복용 약 관련해 따라야 할 지침은 무엇인가요?'],
 ['AST','PURPOSE','AST 검사는 왜 하나요?',urls.ast,'What is an AST test?',
  'AST 혈액검사는 혈액 속 AST 양을 측정하며, 간 문제를 살피거나 경과를 확인하는 데 도움을 줄 수 있습니다. AST는 단독으로 또는 다른 간기능 검사와 함께 시행될 수 있습니다.',
  '이번 AST 검사를 다른 간기능 검사와 함께 보는 이유는 무엇인가요?'],
 ['AST','LIMITS','AST 결과만으로 간 상태를 알 수 있나요?',urls.ast,'What is an AST test? · What do the results mean?',
  'AST는 간뿐 아니라 심장·근육 등에도 있어 수치만으로 원인을 특정할 수 없습니다. 운동·일부 약물·나이와 성별 등도 결과에 영향을 줄 수 있으므로 검사 보고서와 다른 정보를 함께 확인해야 합니다.',
  'AST 결과를 해석할 때 함께 확인할 다른 검사나 조건은 무엇인가요?'],
 ['AST','PREPARATION','AST 검사 전 금식이나 약 조정이 필요한가요?',urls.ast,'Will I need to do anything to prepare for the test?',
  'AST와 함께 받는 검사에 따라 최대 열두 시간 금식이 필요할 수 있지만, 실제 준비는 검사기관 안내를 확인하세요. 복용 약을 알리고 의료진 지시 없이 약을 중단하지 마세요.',
  '이번 AST 검사에서 금식이 필요한지, 복용 약을 어떻게 안내하면 될까요?'],
 ['ALT','PURPOSE','ALT 검사는 왜 하나요?',urls.alt,'What is an ALT Blood Test? · Why do I need an ALT blood test?',
  'ALT 혈액검사는 간 건강을 살피고 간 관련 문제를 진단하거나 경과를 확인하는 데 도움을 줍니다. 보통 다른 간기능 검사와 함께 시행됩니다.',
  '이번 ALT 검사를 다른 간기능 검사와 함께 보는 이유는 무엇인가요?'],
 ['ALT','LIMITS','ALT 수치가 높으면 간 손상 정도를 알 수 있나요?',urls.alt,'What do the results mean? · Is there anything else I need to know about an ALT blood test?',
  'ALT가 높아도 치료가 필요한 질환을 뜻하지 않을 수 있고, ALT 양만으로 간 손상 정도를 알 수는 없습니다. 나이·성별·체중·약과 보충제·격한 운동 등도 결과에 영향을 줄 수 있습니다.',
  'ALT 결과와 다른 검사·복용 약·최근 운동을 함께 확인해야 하나요?'],
 ['ALT','PREPARATION','ALT 검사 전에는 어떻게 준비하나요?',urls.alt,'Will I need to do anything to prepare for the test?',
  'ALT와 함께 받는 혈액검사에 따라 몇 시간 금식이 필요할 수 있습니다. 검사기관의 구체적인 안내를 따르고, 복용 약은 알리되 의료진 지시 없이 중단하지 마세요.',
  '이번 ALT 검사에서 금식이 필요한지 검사기관에 확인해야 할까요?'],
 ['GGT','PURPOSE','GGT 검사는 왜 하나요?',urls.ggt,'What is a gamma-glutamyl transferase (GGT) test?',
  'GGT 검사는 혈액 속 GGT를 측정해 간이나 담관 관련 문제를 살피는 데 도움을 줍니다. 다른 간기능 검사, 특히 ALP 결과와 함께 확인할 수 있습니다.',
  '이번 GGT 검사를 다른 간기능 검사와 함께 확인하는 이유는 무엇인가요?'],
 ['GGT','LIMITS','GGT만으로 원인을 알 수 있나요?',urls.ggt,'What is a gamma-glutamyl transferase (GGT) test?',
  'GGT 검사만으로 간질환의 구체적인 원인을 진단할 수 없습니다. 약·보충제, 음주, 흡연, 식사 등이 결과에 영향을 줄 수 있어 다른 검사와 건강 정보를 함께 살펴야 합니다.',
  'GGT 결과를 해석할 때 함께 확인할 검사나 생활·복용 정보는 무엇인가요?'],
 ['GGT','PREPARATION','GGT 검사 전에는 어떻게 준비하나요?',urls.ggt,'Will I need to do anything to prepare for the test?',
  'GGT는 식사 후 수치가 낮아질 수 있어 의료진이 일정 시간 금식을 요청할 수 있습니다. 약·보충제·음주·흡연도 결과에 영향을 줄 수 있으니 검사기관에 준비 방법을 확인하세요.',
  '이번 GGT 검사 전 금식이나 생활 관련해 따라야 할 안내가 있나요?'],
 ['ANY','COMPARISON','간기능 결과를 이전 검사와 비교할 때 무엇을 확인하나요?',urls.comparison,'What is a reference range?',
  '검사 방법·참고범위·단위는 검사기관에 따라 다를 수 있습니다. 보고서에 적힌 해당 기관의 참고범위와 단위를 확인하고, 시간에 따른 추세는 가능하면 같은 검사기관의 결과끼리 비교하세요.',
  '두 결과의 검사기관·단위·참고범위가 같아 직접 비교할 수 있나요?'],
];

const labelFor=(marker,intent)=>`${marker==='PANEL'?'간기능 검사':marker==='ANY'?'간기능 검사 결과 비교':'간 효소 '+marker} · ${({PURPOSE:'목적',LIMITS:'한계',PREPARATION:'준비',COMPARISON:'비교 조건'})[intent]}`;
export const liverFunctionEntries=Object.freeze(definitions.map(([marker,intent,_,url,section,text,question])=>Object.freeze({
 id:`liver-${marker.toLowerCase()}-${intent.toLowerCase()}`,marker,intent,url,section,text,question,
 title:labelFor(marker,intent),status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',
 checkedAt:intent==='PURPOSE'&&['AST','ALT','GGT'].includes(marker)?'2026-10-13':'2026-10-12',
 clinicalUse:false,rightsPolicy:POLICY,rightsScope:'MedlinePlus Medical Test information only',
 applicability:'일반 검사 설명 초안. 개인 결과·진단·한국 검사기관의 개별 지침을 대체하지 않음',questionOrigin:'PROJECT_TEMPLATE',sourceUpdatedAt:null,
})));

export async function verifyLiverFunctionEvidence(folder){
 const m=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const notes=await readFile(new URL('notes.json',folder));
 const allowed=[POLICY,...Object.values(urls)];
 if(m.status!=='DRAFT / UNASSIGNED'||m.medicalReview!=='UNASSIGNED'||m.clinicalUse!==false||m.serviceDeployment!==false
  ||sha256(notes)!==m.notesSha256||notes.toString()!==JSON.stringify(liverFunctionEntries,null,2)+'\n'
  ||!Array.isArray(m.sources)||m.sources.length!==allowed.length)throw Error('LIVER_EVIDENCE_REJECTED');
 for(const url of allowed)if(m.sources.filter(s=>s.url===url).length!==1)throw Error('LIVER_SOURCE_MISSING');
 const sourceHtmlByUrl=new Map();
 for(const s of m.sources){
  if(!allowed.includes(s.url)||!/^sources\/[a-f0-9]{64}\.html$/.test(s.file))throw Error('LIVER_SOURCE_REJECTED');
  const html=await readFile(new URL(s.file,folder),'utf8');
  if(sha256(html)!==s.sha256)throw Error('LIVER_SOURCE_HASH_MISMATCH');
  sourceHtmlByUrl.set(s.url,html);
 }
 if(liverFunctionEntries.some(entry=>!sourceSectionsExist(sourceHtmlByUrl.get(entry.url),entry.section)))throw Error('LIVER_SOURCE_SECTION_MISMATCH');
 return m;
}

const markerPatterns=[['AST',/(?<![a-z])AST(?![a-z])|아스파르트산아미노전달효소|아스파르테이트아미노전달효소/i],
 ['ALT',/(?<![a-z])ALT(?![a-z])|알라닌아미노전달효소/i],
 ['GGT',/(?<![a-z])GGT(?![a-z])|γ\s*[-‐]?\s*GTP|감마\s*[-‐]?\s*지티피|감마글루타밀전이효소/i]];
const detailIntentPatterns=[['PURPOSE',/목적|왜|무엇.*검사|사용하|하는.*검사|설명|알려/],
 ['LIMITS',/한계|원인|알.*수|의미|해석|높|낮|정상.*(?:뜻|의미)/],
 ['PREPARATION',/준비|금식|공복|약.*(?:중단|복용)|검사.*전/],
 ['COMPARISON',/비교|이전|직전|지난|추세|참고범위|단위/]];
const relatedTestQuestionPattern=/(?:다른\s*검사와\s*함께|함께\s*(?:보|시행|확인)|같이\s*(?:보|시행|확인)).*(?:이유|왜|목적)|(?:이유|왜|목적).*(?:다른\s*검사|함께|같이)/u;

export function retrieveLiverFunctionEvidence(question){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const baseline=retrieveScenarioEvidence(question);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(baseline.status))return baseline;
 const markers=markerPatterns.filter(([,p])=>p.test(question)).map(([name])=>name);
 // "간 효소 AST" names one enzyme; it is not a request for a whole liver panel.
 // Keep the explicit panel terminology separate so the marker's own evidence can win.
 const panel=/간\s*기능(?:\s*검사)?|간기능|간\s*패널|liver\s*function|간\s*수치|피검사\s*간\s*수치/i.test(question);
 if(!markers.length&&!panel)return baseline;
 if(markers.length>1||(markers.length&&panel&&!/검사.*(?:패널|묶음|전체)|패널.*(?:구성|검사|목적)/.test(question)))
  return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_LIVER_MARKERS'};
 const marker=markers[0]??'PANEL';
 const relatedTestQuestion=relatedTestQuestionPattern.test(question);
 const intents=relatedTestQuestion?['PURPOSE']:detailIntentPatterns.filter(([,p])=>p.test(question)).map(([name])=>name);
 if(!intents.length){
  return baseline.status==='CANDIDATE'?baseline:{status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'LIVER_DETAIL_INTENT_NOT_COVERED'};
 }
 if(intents.length!==1){
  return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_LIVER_INTENTS'};
 }
 const intent=intents[0];
 let entry=liverFunctionEntries.find(e=>e.marker===marker&&e.intent===intent);
 if(!entry&&intent==='COMPARISON')entry=liverFunctionEntries.find(e=>e.marker==='ANY'&&e.intent===intent);
 if(!entry)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'LIVER_DETAIL_NOT_COVERED'};
 if(relatedTestQuestion&&!/함께|다른\s*검사/u.test(entry.text))
  return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'RELATED_TEST_RATIONALE_NOT_COVERED'};
 return {status:'CANDIDATE',topic:'health-liver-tests',intent:relatedTestQuestion?'RELATED_TESTS':entry.intent,extractiveOnly:true,
  questionTemplate:relatedTestQuestion?'자료에 명시된 이 검사와 다른 검사 사이의 관계는 무엇인가요?':entry.question,
  evidence:[{chunk_id:entry.id,doc_id:entry.id,topic:'health-liver-tests',title_ko:entry.title,text_ko:entry.text,textSha256:sha256(entry.text),
   source_url:entry.url,source_updated_at:sourceUpdatedAtForUrl(entry.url),section_path:[entry.section],contentReview:'UNASSIGNED',clinicalUse:false,
   attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:POLICY,
   translation_notice:`프로젝트 작성 한국어 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · ${entry.checkedAt} 확인 · ${entry.applicability}`} ]};
}
