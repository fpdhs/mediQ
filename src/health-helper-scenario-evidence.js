// Small source-grounded Korean editorial drafts; not official translations or clinical approval.
import {sha256} from './health-helper-medlineplus.js';
import {readFile} from 'node:fs/promises';
export const POLICY='https://medlineplus.gov/about/using/usingcontent/';
const lab=path=>`https://medlineplus.gov/lab-tests/${path}/`;
const obesity=lab('obesity-screening'),lipids=lab('cholesterol-levels');
const entries=[
 ['키',['키','신장 측정'],obesity,'Obesity Screening','키는 체중과 함께 성인의 체질량지수를 계산하는 데 사용됩니다. 키와 체중으로 계산한 지수는 체지방량을 직접 측정하지 않습니다.','How is a BMI calculated?'],
 ['체중',['체중','몸무게'],obesity,'Obesity Screening','체중에는 지방뿐 아니라 근육·뼈·수분도 포함됩니다. 키와 함께 체질량지수를 계산해 체중 관련 건강 위험을 살피는 데 사용합니다.','What is obesity screening?'],
 ['허리둘레',['허리둘레','허리 둘레'],obesity,'Obesity Screening','허리둘레는 복부에 지방이 얼마나 모여 있는지 살피는 데 활용하는 측정입니다. 체질량지수와 함께 체중 관련 위험을 평가하는 보조 정보로 사용됩니다.','What happens during an obesity screening?'],
 ['체질량지수',['체질량지수','BMI'],obesity,'Obesity Screening','체질량지수는 키와 체중으로 계산하는 지수입니다. 체지방을 직접 측정하지 않으므로 근육이 많은 사람 등에서는 지수만으로 몸의 구성을 판단할 수 없습니다.','How is a BMI calculated?'],
 ['혈압',['혈압'],lab('measuring-blood-pressure'),'Measuring Blood Pressure','혈압은 심장이 혈액을 보낼 때 동맥에 가해지는 압력입니다. 수축기와 이완기 압력을 표시하며 자세·운동·긴장 등 측정 상황에 따라 달라질 수 있어 여러 측정 결과를 함께 봅니다.','What is a blood pressure measurement?'],
 ['시력 · 좌 / 우',['시력','시력 검사'],lab('vision-screening'),'Vision Screening','시력 선별검사는 가까운 것과 먼 것을 얼마나 잘 보는지 확인합니다. 모든 눈 질환을 찾아내는 검사는 아니므로 필요한 경우 종합적인 눈 검사를 함께 고려합니다.','What is vision screening?'],
 ['청력 · 좌 / 우',['청력','청력 검사'],lab('hearing-tests-for-adults'),'Hearing Tests for Adults','청력검사는 소리를 얼마나 잘 듣는지 측정합니다. 청력 저하의 정도와 청각 경로의 어떤 부분에 문제가 있는지 확인하는 데 도움을 줍니다.','What are hearing tests?'],
 ['혈색소',['혈색소','헤모글로빈'],lab('hemoglobin-test'),'Hemoglobin Test','혈색소는 적혈구에 있는 단백질로 산소를 운반합니다. 혈색소 검사는 혈액 속 양을 측정해 빈혈 등을 확인하는 데 사용하며 당화혈색소 검사와는 다릅니다.','What is a Hemoglobin Test?'],
 ['공복혈당',['공복혈당','공복 혈당'],lab('blood-glucose-test'),'Blood Glucose Test','혈당검사는 혈액 속 포도당의 양을 측정합니다. 공복 검사는 음식 섭취 조건을 맞춘 검사이며 결과는 검사 조건과 다른 건강 정보를 함께 고려해 해석합니다.','What is a blood glucose test?'],
 ['간 효소 AST',['AST','간 효소 AST'],lab('ast-test'),'AST Test','AST는 간뿐 아니라 심장·근육 등에도 있는 효소입니다. 혈액 속 AST를 측정해 간이나 다른 조직의 손상 가능성을 살피며 다른 검사와 함께 해석합니다.','What is an AST test?'],
 ['간 효소 ALT',['ALT','간 효소 ALT'],lab('alt-blood-test'),'ALT Blood Test','ALT는 주로 간에 있는 효소입니다. 혈액 속 ALT를 측정해 간 손상이나 질환을 확인하는 데 도움을 얻으며 보통 다른 간 관련 검사와 함께 시행합니다.','What is an ALT Blood Test?'],
 ['간 효소 γ-GTP',['γ-GTP','감마지티피','GGT','간 효소 γ-GTP'],lab('gamma-glutamyl-transferase-ggt-test'),'Gamma-glutamyl Transferase (GGT) Test','GGT는 주로 간에 있는 효소로 혈액 속 양을 측정합니다. 간이나 담관 손상을 살피는 데 사용하지만 이 검사만으로 간 질환의 구체적인 원인을 알 수는 없습니다.','What is a gamma-glutamyl transferase (GGT) test?'],
 ['혈청 크레아티닌',['크레아티닌','혈청 크레아티닌'],lab('creatinine-test'),'Creatinine Test','크레아티닌은 근육 활동 등으로 생기는 노폐물이며 신장이 혈액에서 걸러냅니다. 혈액 검사는 신장 기능을 살피는 데 쓰지만 근육량·식사·활동 등의 영향도 받습니다.','What is a creatinine test?'],
 ['신장기능 eGFR',['eGFR','사구체여과율','신장기능 eGFR'],lab('estimated-glomerular-filtration-rate-egfr-and-gfr-tests'),'Estimated Glomerular Filtration Rate (eGFR) and GFR Tests','추정 사구체여과율은 신장이 혈액의 노폐물을 얼마나 잘 걸러내는지 추정하는 값입니다. 흔히 크레아티닌 결과 등을 이용하며 직접 측정한 여과율과는 구분합니다.','What are estimated glomerular filtration rate (eGFR) and GFR tests?'],
 ['요단백',['요단백','소변 단백','단백뇨'],lab('protein-in-urine'),'Protein in Urine','요단백 검사는 소변에 단백질이 얼마나 있는지 확인합니다. 신장의 여과 기능을 살피는 데 활용하지만 결과의 의미는 다른 검사와 건강 상태를 함께 확인해야 합니다.','What is a protein in urine test?'],
 ['총콜레스테롤',['총콜레스테롤','총 콜레스테롤'],lipids,'Cholesterol Levels','총콜레스테롤은 혈액 속 전체 콜레스테롤의 양이며 HDL과 LDL 등을 포함합니다. 지질검사 결과는 다른 지질 수치와 심혈관 위험 요인을 함께 고려합니다.','What is it used for?'],
 ['HDL 콜레스테롤',['HDL','HDL 콜레스테롤'],lipids,'Cholesterol Levels','HDL 콜레스테롤은 혈액 속 LDL 콜레스테롤을 제거하는 데 도움을 줍니다. 지질검사에서 HDL과 다른 지질 수치를 함께 확인해 심혈관 건강 정보를 얻습니다.','What is it used for?'],
 ['LDL 콜레스테롤',['LDL','LDL 콜레스테롤'],lipids,'Cholesterol Levels','LDL 콜레스테롤이 많으면 동맥에 침착물이 쌓이는 데 기여할 수 있습니다. LDL 결과는 직접 측정값일 수도 있고 다른 지질 수치로 계산한 추정값일 수도 있습니다.','What do the results mean?'],
 ['중성지방',['중성지방','트리글리세리드'],lab('triglycerides-test'),'Triglycerides Test','중성지방은 몸이 에너지원으로 사용하는 지방의 한 종류입니다. 혈액 속 양을 검사해 심혈관 위험 등을 살피는 데 활용합니다.','What is a triglycerides test?'],
 ['C형간염 항체',['C형간염 항체','C형 간염 항체'],lab('hepatitis-testing'),'Hepatitis Testing','간염 항체는 면역계가 감염에 대응하면서 만드는 단백질입니다. 항체 결과는 과거 감염과 관련될 수도 있어 현재 감염 여부를 확인하려면 추가 검사가 필요할 수 있습니다.','What do the results mean?'],
 ['폐기능검사',['폐기능검사','폐기능 검사'],lab('lung-function-tests'),'Lung Function Tests','폐기능검사는 폐가 얼마나 잘 작동하는지 확인하는 여러 검사입니다. 폐활량검사는 내쉬는 공기의 양과 속도를 측정하며 다른 검사와 함께 폐 질환을 평가하는 데 사용합니다.','What are lung function tests?'],
 ['흉부 방사선검사',['흉부 방사선검사','흉부 X선','흉부 엑스레이'], 'https://medlineplus.gov/xrays.html','X-Rays','엑스선 검사는 방사선을 이용해 뼈와 장기의 모습을 영상으로 만듭니다. 흉부 엑스선은 폐렴 등을 확인하는 데 활용되며 영상의 의미는 의료진이 해석합니다.','Summary / What is an x-ray?'],
 ['구강검진',['구강검진','치과 검진'],lab('dental-exam'),'Dental Exam','구강검진은 치아와 잇몸을 살펴 충치나 잇몸 질환의 징후를 확인하는 검사입니다. 필요에 따라 눈으로 보이지 않는 문제를 확인하기 위한 치과 엑스선 검사를 함께 시행할 수 있습니다.','What is a dental exam?'],
 ['혈청 AFP',['AFP','혈청 AFP','알파태아단백'],lab('alpha-fetoprotein-afp-tumor-marker-test'),'Alpha Fetoprotein (AFP) Tumor Marker Test','AFP 종양표지자 검사는 혈액 속 AFP 단백질의 양을 측정합니다. 간 질환 등에서도 높아질 수 있고 일부 암에서는 정상일 수 있어 단독으로 암을 확정하거나 배제하지 않고 영상검사 등과 함께 봅니다.','What is an AFP (alpha-fetoprotein) tumor marker test?'],
 ['간 초음파',['간 초음파','간초음파'],lab('sonogram'),'Ultrasound','초음파는 소리의 파동으로 몸 안 장기의 모습을 만드는 검사입니다. 간 같은 복부 장기의 구조를 살피는 데 사용하며 검사 부위에 따라 준비 방법과 결과의 의미가 달라집니다.','What is an ultrasound? / What is it used for?'],
 ['복부 CT',['복부 CT','CT','컴퓨터단층촬영'], 'https://medlineplus.gov/ctscans.html','CT Scans','CT는 엑스선 장비로 몸 안의 단면 영상을 만드는 검사입니다. 장기와 뼈 등 구조를 자세히 보여주며 검사 목적에 따라 조영제를 사용할 수 있어 준비 사항은 검사기관에 확인합니다.','Summary / What is a CT scan?'],
];
export const scenarioEntries=Object.freeze(entries.map(([label,aliases,url,title,text,section],i)=>Object.freeze({
 id:`scenario-${i+1}`,label,aliases:Object.freeze(aliases),url,title,text,section,
 reviewStatus:'DRAFT / UNASSIGNED',clinicalUse:false,checkedAt:'2026-10-12',
 rightsPolicy:POLICY,rightsScope:url.includes('/lab-tests/')?'Medical test information':'Health Topics summary only',
 supportedIntents:Object.freeze(['CONCEPT']),unsupported:'개별 정상범위·준비·원인·치료·개인 판독은 이 짧은 개념 근거만으로 답하지 않음',
})));
export async function verifyScenarioEvidence(folder){
 const m=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const notes=await readFile(new URL('notes.json',folder));
 if(m.status!=='DRAFT / UNASSIGNED'||m.medicalReview!=='UNASSIGNED'||m.clinicalUse!==false||m.serviceDeployment!==false
  ||sha256(notes)!==m.notesSha256||notes.toString()!==JSON.stringify(scenarioEntries,null,2)+'\n')throw Error('SCENARIO_EVIDENCE_REJECTED');
 for(const s of m.sources){
  if(!/^sources\/[a-f0-9]{64}\.html$/.test(s.file)||![POLICY,...scenarioEntries.map(e=>e.url)].includes(s.url))throw Error('SCENARIO_SOURCE_REJECTED');
  if(sha256(await readFile(new URL(s.file,folder)))!==s.sha256)throw Error('SCENARIO_SOURCE_HASH_MISMATCH');
 }
 for(const url of [POLICY,...scenarioEntries.map(e=>e.url)])if(!m.sources.some(s=>s.url===url))throw Error('SCENARIO_SOURCE_MISSING');
 return m;
}
const normalized=s=>s.toLowerCase().replace(/\s+/g,'');
export function retrieveScenarioEvidence(question){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 if(/\d|@|https?:|홍길동|주민|전화|주소|이름|성명/.test(question))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[]};
 if(/처방|복용|치료|수술|확진|진단해|응급|숨.*(?:차|막)|가슴.*(?:아프|통증)/.test(question))return {status:'REFUSED',evidence:[]};
 const q=normalized(question),matches=scenarioEntries.filter(e=>e.aliases.some(a=>{
  if(/^[a-z]+$/i.test(a))return new RegExp(`(?<![a-z])${a}(?![a-z])`,'i').test(question);
  return q.includes(normalized(a));
 }));
 if(matches.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:matches.length?'AMBIGUOUS_SCENARIO_TOPICS':'NO_SCENARIO_TOPIC'};
 const e=matches[0];
 // Concept-only editorial notes must not silently answer eight unsupported intents.
 if(!/무엇|뭐|개념|뜻|설명/.test(q)||/원인|증상|한계|알수없는|범위|기준|비교|준비|다른검사|다음진료|목적|질문|주기|조영|단계|phase|기간|얼마|정상|왜|높|낮|위험|퍼센트|증가|감소/.test(q))
  return {status:'INSUFFICIENT_EVIDENCE',topic:e.id,evidence:[],sourceHint:{title:e.title,url:e.url},reason:'INTENT_NOT_COVERED_BY_CONCEPT_NOTE'};
 const c={chunk_id:e.id,doc_id:e.id,topic:e.id,title_ko:e.label,text_ko:e.text,textSha256:sha256(e.text),
  source_url:e.url,source_updated_at:null,section_path:[e.section],contentReview:'UNASSIGNED',clinicalUse:false,
  attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:POLICY,
  translation_notice:'프로젝트 작성 한국어 개념 요약 초안 · 공식 번역 아님 · 의료전문가 검수 미실시 · 2026-10-12 원문 확인'};
 return {status:'CANDIDATE',topic:e.id,intent:'CONCEPT',evidence:[c]};
}

const relatedTestScenarioSupport=Object.freeze({
 'scenario-21':'폐기능검사는 다른 검사와 함께 폐 질환을 평가하는 데 사용될 수 있다는 후보 문구에 한정',
});
const relatedTestQuestionPattern=/(?:다른\s*검사와\s*함께|함께\s*(?:보|시행|확인)|같이\s*(?:보|시행|확인)).*(?:이유|왜|목적)|(?:이유|왜|목적).*(?:다른\s*검사|함께|같이)/u;

export function retrieveScenarioRelatedTestEvidence(question){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const baseline=retrieveScenarioEvidence(question);
 if(['INVALID_INPUT','PERSONAL_INPUT_NOT_SUPPORTED','REFUSED'].includes(baseline.status))return baseline;
 if(!relatedTestQuestionPattern.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'RELATED_TEST_QUERY_NOT_MATCHED'};
 const q=normalized(question),matches=scenarioEntries.filter(e=>e.aliases.some(a=>{
  if(/^[a-z]+$/i.test(a))return new RegExp(`(?<![a-z])${a}(?![a-z])`,'i').test(question);
  return q.includes(normalized(a));
 }));
 if(matches.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:matches.length?'AMBIGUOUS_SCENARIO_TOPICS':'NO_SCENARIO_TOPIC'};
 const e=matches[0];
 if(!relatedTestScenarioSupport[e.id])return {status:'INSUFFICIENT_EVIDENCE',evidence:[],reason:'RELATED_TEST_RATIONALE_NOT_COVERED'};
 return {status:'CANDIDATE',topic:e.id,intent:'RELATED_TESTS',extractiveOnly:true,
  questionTemplate:'자료에 명시된 이 검사와 다른 검사 사이의 관계는 무엇인가?',
  evidence:[{chunk_id:e.id,doc_id:e.id,topic:e.id,title_ko:e.label,text_ko:e.text,textSha256:sha256(e.text),
   source_url:e.url,source_updated_at:null,section_path:[e.section],contentReview:'UNASSIGNED',clinicalUse:false,
   attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:POLICY,
   translation_notice:'프로젝트 작성 한국어 개념 요약 초안 · 공식 번역 아님 · 의료전문가 검토 미실시 · 2026-10-12 원문 확인 · 일반 정보만 설명하며 진료 판단을 대신하지 않음'} ]};
}
