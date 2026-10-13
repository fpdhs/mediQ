// Source-grounded ultrasound/CT editorial drafts. Not approved clinical advice.
import {readFile} from 'node:fs/promises';
import {POLICY,retrieveScenarioEvidence} from './health-helper-scenario-evidence.js';
import {sha256} from './health-helper-medlineplus.js';
import {sourceUpdatedAtForUrl} from './health-helper-source-freshness.js';

const ultrasound='https://medlineplus.gov/lab-tests/sonogram/';
const ct='https://medlineplus.gov/ctscans.html';
const imagingRecord='https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication';
const fdaPolicy='https://www.fda.gov/about-fda/about-website/website-policies';
const useLabel={PURPOSE:'목적',LIMITS:'한계',PREPARATION:'준비',COMPARISON:'비교 조건'};
const definitions=[
 ['ULTRASOUND','PURPOSE','간 초음파는 무엇을 살펴보나요?',ultrasound,'What is an ultrasound? · What is it used for?',
  '초음파는 소리의 파동으로 장기와 조직의 영상을 만듭니다. 간은 초음파로 살펴볼 수 있는 복부 장기 중 하나입니다. 검사의 구체적인 목적은 초음파 종류와 확인하는 부위에 따라 달라지므로, 이번 검사에서 확인하려는 내용은 의뢰한 의료진에게 물어보세요.',
  '간 초음파로 이번에 확인하려는 구조나 질문은 무엇인가요?'],
 ['ULTRASOUND','LIMITS','초음파 결과만으로 무엇을 판단할 수 없나요?',ultrasound,'What is it used for? · What do the results mean?',
  '초음파는 이온화 방사선을 사용하지 않으며, 숙련된 검사자가 올바르게 사용할 때 일반적으로 안전한 검사로 여겨집니다. MedlinePlus는 진단 초음파 결과의 의미가 살펴본 부위에 따라 달라진다고 안내합니다. 이 일반 설명은 개인 영상을 판독하거나 진단을 확정하지 않으므로, 본인 결과는 담당 의료진에게 확인하세요.',
  '제 초음파 판독에서 담당 의료진에게 확인할 핵심 내용은 무엇인가요?'],
 ['ULTRASOUND','PREPARATION','간 초음파 전에는 어떻게 준비하나요?',ultrasound,'Will I need to do anything to prepare for the test?',
  '초음파 준비는 검사 부위에 따라 다르며 준비가 필요 없는 검사도 있습니다. MedlinePlus는 일부 초음파에서 물을 마시거나 다른 초음파에서 몇 시간 금식할 수 있다고 설명하지만, 이것을 간 초음파에 일괄 적용할 수는 없습니다. 금식·물 섭취 여부는 이번 검사기관의 안내를 확인하세요.',
  '이번 초음파 검사에 금식이나 물 섭취가 필요한지 어디서 확인하나요?'],
 ['ULTRASOUND','COMPARISON','이전 초음파와 비교하려면 무엇을 챙기나요?',imagingRecord,'Patient Medical Imaging Record Card',
  '이전 영상검사의 날짜·종류·촬영 기관을 정리하면 환자와 의료진이 영상 이력을 논의하는 데 도움이 됩니다. 이전 영상과 판독문을 이번 기록과 함께 볼 수 있는지는 담당 의료진에게 확인하세요. 이 안내는 초음파 영상을 자동 비교하거나 변화를 판독하지 않습니다.',
  '이전 초음파 영상과 판독문을 이번 검사와 함께 검토할 수 있을까요?'],
 ['CT','PURPOSE','복부 CT는 어떤 정보를 보여주나요?',ct,'Summary · What is a CT scan? · Who needs a CT scan?',
  'CT는 엑스선 장비로 몸의 단면 영상을 만들어 장기·뼈·다른 조직의 크기와 구조를 보여주며, 여러 단면을 입체 보기로 구성할 수도 있습니다. 의료진은 여러 건강 문제의 진단·치료·관찰에 CT를 활용합니다. 이번 복부 CT가 확인하려는 질문은 의뢰한 의료진에게 확인하세요.',
  '이번 복부 CT가 확인하려는 진료 질문은 무엇인가요?'],
 ['CT','LIMITS','CT 영상만 보고 제 결과를 판단할 수 있나요?',ct,'Summary · What should you expect after a CT scan?',
  'CT는 이온화 방사선을 사용하며 MedlinePlus는 방사선량을 가능한 한 낮게 유지한다고 설명합니다. 영상은 영상의학과 전문의가 검토해 담당 의료진에게 전달합니다. 이 일반 설명은 개인의 이익·위험을 계산하거나 CT 영상의 소견을 판정하지 않으므로, 판독 결과의 의미와 다음 단계는 담당 의료진에게 물어보세요.',
  '제 CT 판독에서 확인된 내용과 다음 단계는 무엇인가요?'],
 ['CT','PREPARATION','복부 CT 전에 무엇을 준비해야 하나요?',ct,'How do you prepare for a CT scan?',
  'CT 검사 전 몇 시간 동안 먹거나 마시지 말라는 안내를 받을 수 있고, 일부 검사에는 검사 부위에 따라 조영제를 마시거나 주사 또는 관장으로 투여할 수 있습니다. 촬영에 방해가 될 수 있어 옷을 갈아입거나 장신구를 빼도록 안내받을 수도 있습니다. 임신 중이거나 가능성이 있으면 미리 알리고, 이번 검사기관의 개별 지침을 따르세요.',
  '이번 CT의 금식과 조영제 안내를 검사기관에 확인했나요?'],
 ['CT','COMPARISON','이전 CT와 비교하려면 무엇을 확인하나요?',imagingRecord,'Patient Medical Imaging Record Card',
  '이전 영상검사의 날짜·종류·촬영 기관을 정리하면 환자와 의료진이 영상 이력을 논의하는 데 도움이 됩니다. CT는 검사 부위와 조영제 투여 여부도 검사기관에 확인해 함께 전달할 수 있습니다. 기록만으로 두 CT의 직접 비교 가능성이나 변화를 판단하지 않으며, 비교·판독은 담당 의료진에게 확인하세요.',
  '이전 CT와 이번 CT의 검사 부위와 조영제 조건을 함께 검토할 수 있을까요?'],
];

export const imagingEvidenceEntries=Object.freeze(definitions.map(([modality,intent,_,url,section,text,question])=>Object.freeze({
 id:`imaging-${modality.toLowerCase()}-${intent.toLowerCase()}`,modality,intent,url,section,text,question,
 title:`${modality==='ULTRASOUND'?'간 초음파':'복부 CT'} · ${useLabel[intent]}`,
 status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',checkedAt:'2026-10-12',clinicalUse:false,
 rightsPolicy:url===imagingRecord?fdaPolicy:POLICY,
 attribution:url===imagingRecord?'Source: U.S. Food and Drug Administration.':'Source: MedlinePlus, National Library of Medicine.',
 institution:url===imagingRecord?'U.S. Food and Drug Administration':'MedlinePlus · U.S. National Library of Medicine',
 sourceTitle:url===imagingRecord?'Education and Communication · Patient Medical Imaging Record Card section':undefined,
 rightsScope:url===imagingRecord?'FDA.gov federal public content; attribution retained':'MedlinePlus public-domain Medical Test or Health Topic summary only',
 applicability:`일반 ${modality==='ULTRASOUND'?'초음파':'CT'} 설명 초안; 개인 영상·판독·진단을 대신하지 않음`,questionOrigin:'PROJECT_TEMPLATE',sourceUpdatedAt:null,
})));

const sources=Object.freeze([POLICY,ultrasound,ct,imagingRecord,fdaPolicy]);
export async function verifyImagingEvidence(folder){
 const m=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const notes=await readFile(new URL('notes.json',folder));
 if(m.status!=='DRAFT / UNASSIGNED'||m.medicalReview!=='UNASSIGNED'||m.clinicalUse!==false||m.serviceDeployment!==false
 ||sha256(notes)!==m.notesSha256||!Array.isArray(m.sources)||m.sources.length!==sources.length)throw Error('IMAGING_EVIDENCE_REJECTED');
 const records=JSON.parse(notes.toString());
 if(!Array.isArray(records)||records.length!==m.entryCount||records.length!==8
  ||new Set(records.map(r=>r.id)).size!==records.length
  ||records.some(r=>!['ULTRASOUND','CT'].includes(r.modality)||!['PURPOSE','LIMITS','PREPARATION','COMPARISON'].includes(r.intent)
   ||r.status!=='DRAFT / UNASSIGNED'||r.medicalReview!=='UNASSIGNED'||r.clinicalUse!==false
   ||!sources.includes(r.url)||!sources.includes(r.rightsPolicy)||typeof r.text!=='string'||typeof r.question!=='string'))throw Error('IMAGING_EVIDENCE_REJECTED');
 for(const url of sources)if(m.sources.filter(s=>s.url===url).length!==1)throw Error('IMAGING_SOURCE_MISSING');
 for(const s of m.sources){
  if(!sources.includes(s.url)||!/^sources\/[a-f0-9]{64}\.html$/.test(s.file))throw Error('IMAGING_SOURCE_REJECTED');
  if(sha256(await readFile(new URL(s.file,folder)))!==s.sha256)throw Error('IMAGING_SOURCE_HASH_MISMATCH');
 }
 return m;
}

const modalityPatterns=[['ULTRASOUND',/간\s*초음파|초음파|sonogram|ultrasound/i],['CT',/복부\s*CT|CT\s*검사|컴퓨터\s*단층\s*촬영|(?<![a-z])CT(?![a-z])/i]];
const intentPatterns=[['PURPOSE',/목적|왜|쓰이나|사용하|무엇.*(?:보여|얻)|어떤.*검사/],
 ['LIMITS',/한계|알\s*수|판독|진단|판단|정확|결과.*의미|의미|해석|방사선/],
 ['PREPARATION',/준비|금식|공복|조영제|검사.*전|물.*마시|임신|귀금속/],
 ['COMPARISON',/비교|이전|직전|지난|추세|가져|기록.*함께|함께.*검토/]];
const diagnosisPattern=/확진|진단해|암인가|암이야|간암|내.*(?:CT|초음파).*(?:결과|판독)|결과.*(?:암|간암)/;

export function retrieveImagingEvidence(question){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const base=retrieveScenarioEvidence(question);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED'].includes(base.status))return base;
 if(base.status==='REFUSED'||diagnosisPattern.test(question))return {status:'REFUSED',evidence:[],reason:'PERSONAL_DIAGNOSIS_NOT_SUPPORTED'};
 const modalities=modalityPatterns.filter(([,pattern])=>pattern.test(question)).map(([name])=>name);
 if(!modalities.length)return base;
 if(modalities.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_IMAGING_MODALITIES'};
 const intents=intentPatterns.filter(([,pattern])=>pattern.test(question)).map(([name])=>name);
 if(!intents.length)return base.status==='CANDIDATE'&&base.intent==='CONCEPT'?base:{status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'IMAGING_DETAIL_INTENT_NOT_COVERED'};
 if(intents.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'AMBIGUOUS_IMAGING_INTENTS'};
 const entry=imagingEvidenceEntries.find(item=>item.modality===modalities[0]&&item.intent===intents[0]);
 if(!entry)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'IMAGING_DETAIL_NOT_COVERED'};
 return {status:'CANDIDATE',topic:'health-imaging-tests',intent:entry.intent,extractiveOnly:true,questionTemplate:entry.question,
  evidence:[{chunk_id:entry.id,doc_id:entry.id,topic:'health-imaging-tests',title_ko:entry.title,text_ko:entry.text,textSha256:sha256(entry.text),
   source_url:entry.url,source_title:entry.sourceTitle,source_updated_at:sourceUpdatedAtForUrl(entry.url),section_path:[entry.section],contentReview:'UNASSIGNED',clinicalUse:false,
   attribution:entry.attribution,institution:entry.institution,rights_policy_url:entry.rightsPolicy,
   translation_notice:`프로젝트 작성 한국어 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · ${entry.checkedAt} 확인 · ${entry.applicability}`} ]};
}
