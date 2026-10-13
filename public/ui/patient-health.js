import {libraryHospital, libraryStudy} from './patient-library.js';
import {createWalletDock,createWalletIcon} from './wallet-home.js';

const KDCA='https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=';
const REPORT=KDCA+'6765';
const STATUS={OK:['✓','비교 기준 안'],BORDER:['!','경계 구간'],HIGH:['↑','높음'],LOW:['↓','낮음'],CONTEXT:['↔','연계 해석'],REPORT:['▤','합성 기관 소견'],UNKNOWN:['i','추가 정보 필요']};
const OBESITY=KDCA+'6694';
const LIPIDS='https://health.kdca.go.kr/healthinfo/biz/health/ntcnInfo/healthSourc/thtimtCntnts/thtimtCntntsView.do?thtimt_cntnts_sn=124';
const CREATININE='https://health.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=104';
const KIDNEY='https://www.knuh.kr/content/04information/06_02.asp?sh_d_num=217';
const VERIFIED_ON='2026-10-11';
// Curated domestic references. Verification date is not a publication date.
// These support education/comparison, never certify the fictional report.
const reference=(publisher,title,url,section,type,updated=null)=>({publisher,title,url,section,type,updated,verifiedOn:VERIFIED_ON});
const REF={
 obesity:reference('질병관리청 · 국가건강정보포털','비만',OBESITY,'개요-정의 · BMI 계산식, 비만 단계와 허리둘레','성인 분류 기준','2026-07-29'),
 bmi:reference('e-나라지표 · 질병관리청 소관 지표','비만 유병률','https://www.index.go.kr/unity/potal/main/EachDtlPageDetail.do?idx_cd=2705','의미분석 · 지표개념: 저체중·정상·비만전단계','성인 분류 기준'),
 bp:reference('질병관리청 · 국가건강정보포털','고혈압',REPORT,'개요-정의 · 2022 고혈압 진료지침에 따른 혈압의 분류','진료실 혈압 분류','2026-04-27'),
 glucose:reference('질병관리청 · 국가건강정보포털','당뇨병',KDCA+'5305','진단 및 검사 · 공복혈당 / 치료 관련 합병증 · 저혈당','공복혈당 분류·저혈당 설명','2026-09-16'),
 liver:reference('질병관리청 · 국가건강정보포털','간기능검사',KDCA+'5444','검사 결과 해석 · AST·ALT·GGT 참고 범위','일반 검사 참고범위','2026-05-06'),
 hb:reference('서울아산병원','혈색소(Hemoglobin)','https://health.amc.seoul.kr/asan/mobile/healthinfo/management/managementDetail.do?managementId=119','검사결과 · 남성 13.0–17.0 g/dL','성별 검사 참고범위'),
 creatinine:reference('서울아산병원','크레아티닌(Creatinine)',CREATININE,'검사결과 · 0.50–1.4 mg/dL / 주의사항','일반 검사 참고범위'),
 kidney:reference('경북대학교병원','만성콩팥병',KIDNEY,'만성콩팥병의 5단계 · 사구체 여과율과 콩팥손상','여과율 수치 구간'),
 kidneyContext:reference('질병관리청 · 국가건강정보포털','만성콩팥병',KDCA+'5457','개요-정의 · 콩팥손상·기능 감소의 지속 기간','해석의 조건·한계','2026-05-12'),
 urine:reference('질병관리청 · 국가건강정보포털','소변이상(단백뇨)',KDCA+'6711','진단 및 검사 · 요시험지봉 검사법','정성 결과 해석','2026-05-15'),
 lipids:reference('질병관리청 · 국가건강정보포털','혈압·혈당이 높다면? 지금부터 관리하세요!',LIPIDS,'이상지질혈증 · 분류 기준 표(총콜레스테롤·LDL·HDL·중성지방)','지질 수치 분류','2025-08'),
 hcv:reference('질병관리청 · 국가건강정보포털','C형간염',KDCA+'5309','진단 및 검사 · 항체 선별검사와 HCV RNA 확인','정성 결과 해석','2026-06-08'),
 lung:reference('질병관리청 · 국가건강정보포털','폐기능검사',KDCA+'6258','검사 항목 · FEV₁·FVC / 검사 결과 해석','검사 설명만 제공','2026-08-03'),
 checkup:reference('질병관리청 · 국가건강정보포털','건강검진(국가건강검진)',KDCA+'6671','세부 내용 · 일반건강검진 및 검사항목','검사항목 설명만 제공','2026-06-01'),
};
const EVIDENCE={
 '키':[REF.obesity],'체중':[REF.bmi,REF.obesity],'허리둘레':[REF.obesity],'체질량지수':[REF.bmi,REF.obesity],
 '혈압':[REF.bp],'시력 · 좌 / 우':[REF.checkup],'청력 · 좌 / 우':[REF.checkup],
 '혈색소':[REF.hb],'공복혈당':[REF.glucose],'간 효소 AST':[REF.liver],'간 효소 ALT':[REF.liver],'간 효소 γ-GTP':[REF.liver],
 '혈청 크레아티닌':[REF.creatinine],'신장기능 eGFR':[REF.kidney,REF.kidneyContext],'요단백':[REF.urine],
 '총콜레스테롤':[REF.lipids],'HDL 콜레스테롤':[REF.lipids],'LDL 콜레스테롤':[REF.lipids],'중성지방':[REF.lipids],
 'C형간염 항체':[REF.hcv],'폐기능검사':[REF.lung],'흉부 방사선검사':[REF.checkup],'구강검진':[REF.checkup],
};
export function screeningEvidence(label){
 return Object.hasOwn(EVIDENCE,label)?EVIDENCE[label].map(item=>({...item})):[];
}
const EXPLANATIONS={
 '키':'몸의 길이입니다. 체중과 함께 체질량지수를 계산할 때 사용해요.', '체중':'몸의 무게입니다. 이전 측정값과 함께 보는 것이 좋아요.',
 '허리둘레':'복부 크기를 측정한 값입니다. 측정 방법과 성별에 따라 해석이 달라요.', '체질량지수':'키에 대한 체중의 비율입니다. 근육량이나 체지방을 직접 측정한 값은 아니에요.',
 '혈압':'혈액이 혈관 벽에 가하는 압력입니다. 위 수치와 아래 수치를 각각 확인해요.',
 '시력 · 좌 / 우':'좌우 눈의 보는 능력입니다. 교정 여부와 측정 조건을 함께 확인해요.', '청력 · 좌 / 우':'좌우 귀의 듣는 능력을 확인합니다. 원문 결과를 우선해요.',
 '혈색소':'혈액에서 산소를 운반하는 성분입니다. 낮거나 높은 이유는 다른 검사와 함께 확인해요.',
 '공복혈당':'공복 상태의 혈액 속 포도당 농도입니다. 식사·공복 시간·약물의 영향을 받을 수 있어요.',
 '간 효소 AST':'간과 근육 등에 있는 효소입니다. 이 수치 하나로 간 질환을 판단하지 않아요.',
 '간 효소 ALT':'주로 간에 있는 효소입니다. 다른 검사·증상과 함께 해석해요.',
 '간 효소 γ-GTP':'간·담도와 관련된 효소입니다. 약물 등 여러 요인이 수치에 영향을 줍니다.',
 '혈청 크레아티닌':'근육 대사에서 생기는 물질입니다. 신장 기능·근육량 등을 함께 고려해요.',
 '신장기능 eGFR':'신장이 혈액을 걸러내는 능력의 추정값입니다. 합성 보고값이며 앱 계산 결과가 아니에요. 한 번의 수치로 신장질환을 확정하지 않아요.',
 '요단백':'소변에 단백질이 검출되는지 확인합니다. 수치 막대 대신 기관 원문 결과를 확인해요.',
 '총콜레스테롤':'혈액 속 콜레스테롤의 총량입니다. HDL·LDL과 함께 보는 것이 좋아요.',
 'HDL 콜레스테롤':'콜레스테롤 운반에 관여하는 지질입니다. 다른 지질 수치와 반대 방향으로 해석될 수 있어요.',
 'LDL 콜레스테롤':'혈중 지질의 한 종류입니다. 개인별 심혈관 위험에 따라 목표가 달라요.',
 '중성지방':'혈액 속 지방의 한 종류입니다. 식사·공복 여부를 함께 확인해요.',
};

// Educational comparison of fictional adult-male fixtures, not a clinical decision engine.
// Institution referenceRange/interpretation remain null and are never overwritten.
export function screeningAssessment(field,context={}) {
 const unknown={status:'UNKNOWN',label:field.value===null?'결과 미등록':'비교 기준 없음',explanation:EXPLANATIONS[field.label]||'기관의 검사 결과와 설명을 확인해 주세요.',range:'기관 참고범위 미등록',source:null,version:'2026-10-11',segments:[]};
 if(context.synthetic!==true||context.sex!=='M'||context.age!==56)return unknown;
 if(field.value===null||field.value===undefined)return {...unknown,label:'결과 미등록'};
 const result=(status,label,range,source,explanation=unknown.explanation,segments=[])=>({...unknown,status,label,range,source,explanation,segments});
 const numeric=(unit)=>field.unit===unit&&typeof field.value==='number'&&Number.isFinite(field.value)&&field.value>=0;
 if(field.label==='키'&&numeric('cm')&&field.value>0)return result('CONTEXT','BMI 계산에 사용','성인 키 단독의 정상·비정상 분류는 제공하지 않아요.',OBESITY);
 if(field.label==='체중'){
  const height=context.heightCm;
  if(!numeric('kg')||field.value<=0||typeof height!=='number'||!Number.isFinite(height)||height<=0)return {...unknown,label:'키·체중 확인 필요'};
  const bmi=field.value/(height/100)**2;
  const a=screeningAssessment({label:'체질량지수',value:bmi,unit:'kg/㎡'},context);
  return {...a,label:`BMI ${bmi.toFixed(1)} · ${a.label}`,explanation:`키 ${height}cm와 연계한 체중 해석이에요. BMI 정상 구간의 체중 환산은 약 ${(18.5*(height/100)**2).toFixed(1)}–${(23*(height/100)**2).toFixed(1)}kg이며 개인별 목표 체중이나 감량 처방이 아닙니다.`,segments:[]};
 }
 if(field.label==='체질량지수'&&numeric('kg/㎡')&&field.value>0){
  const v=field.value,status=v<18.5?'LOW':v<23?'OK':v<25?'BORDER':'HIGH';
  const label=v<18.5?'저체중':v<23?'정상 BMI 구간':v<25?'비만 전단계':v<30?'1단계 비만':v<35?'2단계 비만':'3단계 비만';
  return result(status,label,'한국 성인 기준 <18.5 저체중 · 18.5–<23 정상 · 23–<25 비만 전단계 · ≥25 비만',OBESITY,unknown.explanation,[{name:'BMI',value:v,min:15,max:35,status}]);
 }
 if(field.label==='허리둘레'&&numeric('cm')&&field.value>0)return result(field.value>=90?'HIGH':'OK',field.value>=90?'복부비만 기준 이상':'복부비만 기준 미만','성인 남성 ≥90cm · 여성 ≥85cm (현재 남성 기준)',OBESITY,unknown.explanation,[{name:field.label,value:field.value,min:60,max:110,status:field.value>=90?'HIGH':'OK'}]);
 if(field.label==='요단백'&&field.unit===''){
  const states={'음성':['OK','단백 불검출'],'약양성':['REPORT','약양성 · 원문 확인'],'±':['REPORT','약양성 · 원문 확인'],'1+':['HIGH','단백 검출'],'2+':['HIGH','단백 검출'],'3+':['HIGH','단백 검출'],'4+':['HIGH','단백 검출']};
  if(typeof field.value!=='string'||!Object.hasOwn(states,field.value))return unknown;
  const pair=states[field.value];
  return result(...pair,'정성 검사: 음성 / 약양성 / 1+–4+. 검사 방법·소변 농도에 따라 해석이 달라요.',KDCA+'6711','음성은 이 검사에서 단백이 검출되지 않았다는 뜻이에요. 신장질환 전체를 배제하지 않습니다. 약양성은 임의 경계 위험도로 바꾸지 않아요.');
 }
 if(field.label==='C형간염 항체'&&field.unit===''){
  if(!['음성','양성'].includes(field.value))return unknown;
  return result(field.value==='음성'?'OK':'REPORT',field.value==='음성'?'항체 불검출':'항체 검출 · 추가 확인','음성/양성 정성 결과. 양성만으로 현재 감염을 확정하지 않아요.',REF.hcv.url,'양성이면 HCV RNA 등 추가 검사가 필요해요. 항체 음성만으로 모든 상황의 감염을 배제하지 않습니다.');
 }
 if(['시력 · 좌 / 우','청력 · 좌 / 우','폐기능검사','흉부 방사선검사','구강검진'].includes(field.label)&&typeof field.value==='string'&&field.unit===''&&field.syntheticReport?.summary){
  return result('REPORT','합성 기관 소견','가상 보고서에 작성된 소견 · 앱의 자동 판정이 아닙니다.',screeningEvidence(field.label)[0]?.url||null,`${field.syntheticReport.summary} ${field.syntheticReport.followUp}`);
 }
 if(field.label==='신장기능 eGFR'&&numeric('mL/min/1.73㎡')){
  const v=field.value,status=v>=90?'OK':v>=60?'BORDER':'LOW';
  return result(status,v>=90?'G1 수치 구간':v>=60?'G2 수치 구간':'낮은 수치 구간 · 추가 확인','≥90 G1 · 60–<90 G2 · <60 감소 구간; 질환 진단과 구분',KIDNEY,'수치 구간만 비교합니다. 60–89만으로 만성콩팥병을 뜻하지 않아요. 지속 기간·요단백·다른 신장 손상 지표를 함께 확인합니다.',[{name:'eGFR',value:v,min:0,max:120,status}]);
 }
 if(['총콜레스테롤','LDL 콜레스테롤','중성지방'].includes(field.label)&&numeric('mg/dL')){
  const [border,high]=field.label==='총콜레스테롤'?[200,240]:field.label==='LDL 콜레스테롤'?[130,160]:[150,200];
  const v=field.value,status=v>=high?'HIGH':v>=border?'BORDER':'OK';
  const label=field.label==='LDL 콜레스테롤'&&v>=100&&v<130?'일반 분류상 정상 구간':STATUS[status][1];
  return result(status,label,field.label==='LDL 콜레스테롤'?'<100 적정 · 100–<130 정상 · 130–<160 경계 · 160–<190 높음 · ≥190 매우 높음':field.label==='총콜레스테롤'?'<200 적정 · 200–<240 경계 · ≥240 높음':'<150 적정 · 150–<200 경계 · 200–<500 높음 · ≥500 매우 높음',LIPIDS,unknown.explanation+' 일반 분류와 개인별 치료 목표는 다릅니다.',[{name:field.label,value:v,min:0,max:high*1.3,status}]);
 }
 if(field.label==='HDL 콜레스테롤'&&numeric('mg/dL'))return result(field.value<40?'LOW':'OK',field.value<40?'낮음':'낮음 기준에 해당하지 않음','현재 성인 남성 기준 <40mg/dL 낮음. 높을수록 무조건 건강하다는 뜻은 아닙니다.',LIPIDS,unknown.explanation,[{name:field.label,value:field.value,min:20,max:80,status:field.value<40?'LOW':'OK'}]);
 const rules={
  '혈색소':{unit:'g/dL',min:13,max:17,domain:[10,19],source:REF.hb.url,range:'서울아산병원 남성 참고 예시 13–17 g/dL (양끝 포함)'},
  '공복혈당':{unit:'mg/dL',min:70,max:100,border:126,domain:[40,160],source:KDCA+'5305',range:'70–<100 기준 안 · 100–<126 경계 · ≥126 높음 · <70 낮음'},
  '간 효소 AST':{unit:'U/L',min:0,max:40,domain:[0,80],source:KDCA+'5444',range:'참고 예시 0–40 U/L'},
  '간 효소 ALT':{unit:'U/L',min:0,max:40,domain:[0,80],source:KDCA+'5444',range:'질병관리청 참고 예시 0–40 U/L · 검사기관별 범위와 다를 수 있음'},
  '간 효소 γ-GTP':{unit:'U/L',min:11,max:63,domain:[0,100],source:KDCA+'5444',range:'성인 남성 참고 예시 11–63 U/L'},
  '혈청 크레아티닌':{unit:'mg/dL',min:0.5,max:1.4,domain:[0,2],source:CREATININE,range:'서울아산병원 일반 참고 예시 0.50–1.4 mg/dL (양끝 포함) · 남성 전용 범위 아님'},
 };
 if(field.label==='혈압'){
  if(field.unit!=='mmHg'||typeof field.value!=='string'||!/^\d+\s*\/\s*\d+$/.test(field.value))return unknown;
  const [s,d]=field.value.split('/').map(Number);
  if(s<=0||d<=0||s<=d)return unknown;
  const classify=(value,normal,high)=>value>=high?'HIGH':value>=normal?'BORDER':'OK';
  // The source defines upper screening bands only, not a lower BP reference range.
  if(s<120&&d<80)return {...unknown,label:'상한 기준 미만',range:'수축기 <120 · 이완기 <80; 낮은 혈압 판단 기준 미등록',source:REPORT};
  return {...unknown,status:s>=140||d>=90?'HIGH':'BORDER',label:s>=140||d>=90?'높음':'경계 구간',source:REPORT,range:'수축기 120–<140 / 이완기 80–<90 경계 · ≥140 또는 ≥90 높음',segments:[{name:'수축기',value:s,min:90,max:160,status:classify(s,120,140)},{name:'이완기',value:d,min:60,max:105,status:classify(d,80,90)}]};
 }
 const rule=rules[field.label];
 if(!rule||rule.unit!==field.unit||typeof field.value!=='number'||!Number.isFinite(field.value)||field.value<0)return unknown;
 const v=field.value,status=v<rule.min?'LOW':rule.border?(v>=rule.border?'HIGH':v>=rule.max?'BORDER':'OK'):v>rule.max?'HIGH':'OK';
 return {...unknown,status,label:STATUS[status][1],range:rule.range,source:rule.source,segments:[{name:field.label,value:v,min:rule.domain[0],max:rule.domain[1],status}]};
}

// Fictional report, not NHIS/FHIR data. Null is missing, never a normal result.
// Only authenticated server fixtures; no local fallback after a failed request.
export function healthRecords(studies, syntheticScenario=false, serverRecords=[]) {
  const rows=studies.map(study=>({id:study.studyInstanceUid,date:study.studyDate||'',hospital:libraryHospital(study.sourceHospitalId),kind:'IMAGE',title:libraryStudy(study).title,study,synthetic:false}));
  if(syntheticScenario)rows.push(...serverRecords.filter(record=>record.synthetic===true));
  return rows.sort((a,b)=>b.date.localeCompare(a.date));
}
export function filterHealth(rows,filter='ALL',query='') {
  const text=query.trim().toLocaleLowerCase();
  return rows.filter(row=>(filter==='ALL'||(filter==='IMAGE'?['IMAGE','ULTRASOUND'].includes(row.kind):filter==='DICOM'?row.kind==='IMAGE':filter==='ULTRASOUND'?row.kind==='ULTRASOUND':filter==='BLOOD'?row.kind==='AFP':filter==='CHECKUP'?row.kind==='CHECKUP':false))
    &&`${row.title} ${row.hospital} ${row.date}`.toLocaleLowerCase().includes(text));
}
const el=(tag,cls,text)=>{const item=document.createElement(tag);item.className=cls;if(text!==undefined)item.textContent=text;return item;};
const action=(label,fn,cls='btn')=>{const b=el('button',cls,label);b.type='button';b.onclick=fn;return b;};
const walletIcon=kind=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.classList.add('health-bifold-icon');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',kind==='share'?'M8 8l8-4M8 16l8 4M8 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM22 20a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z':'M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0ZM7 10h.01M11 10h.01M15 10h.01');svg.append(path);return svg;};
const assessmentView=field=>{
 const a=screeningAssessment(field,{synthetic:true,sex:'M',age:56,heightCm:170}),box=el('div','health-assessment');
 box.append(el('span',`health-status health-status-${a.status.toLowerCase()}`,`${STATUS[a.status][0]} ${a.label}`));
 for(const segment of a.segments){const bar=el('div',`health-range health-range-${segment.status.toLowerCase()}`);bar.setAttribute('role','img');bar.setAttribute('aria-label',`${segment.name} ${segment.value} ${field.unit} · ${a.label} · ${a.range}`);
  const marker=el('span','health-range-marker');marker.style.left=`${Math.max(2,Math.min(98,(segment.value-segment.min)/(segment.max-segment.min)*100))}%`;bar.append(marker);box.append(el('small','health-range-caption',`${segment.name} · ${segment.value} ${field.unit}`),bar);
 }
 box.append(el('p','health-range-copy',a.range),el('p','health-explanation',a.explanation));
 const details=el('details','health-criteria');details.append(el('summary','','기준과 해석 알아보기'));
 const notes=el('details','health-criteria-notes');notes.append(el('summary','','시연 데이터·해석 유의사항'));
 notes.append(el('p','health-note','결과의 출처: 프로젝트에서 임의 작성한 합성 시연 데이터. 아래 기관은 비교 기준·검사 설명의 출처이며 이 가상 결과를 검사·판독·인증한 기관이 아닙니다.'));
 const meta=el('dl','health-evidence-meta');
 for(const [label,value]of [['적용 기준',a.range],['적용 조건','합성 시연 · 성인 남성 56세. 공복혈당은 공복 검사, 혈압은 진료실 측정의 비교 예시입니다.'],['주의사항','실제 검사에서는 검사기관의 참고범위를 우선합니다. 기준 안이어도 질환을 배제하지 않으며 색상은 진단·응급도를 뜻하지 않습니다.']])meta.append(el('dt','',label),el('dd','',value));
 if(field.label==='체중')meta.append(el('dt','','계산 방법'),el('dd','','체중 ÷ 키(m)²로 BMI를 계산하고, BMI 범위 × 키(m)²로 체중을 환산합니다. 개인별 권장 체중이 아닙니다.'));
 if(['간 효소 AST','간 효소 ALT','간 효소 γ-GTP'].includes(field.label))meta.append(el('dt','','단위 표기'),el('dd','','원문 IU/L을 이 합성 fixture에서는 같은 효소활성 단위 U/L로 표시합니다. 실제 검사법의 일치 여부는 별도 확인이 필요합니다.'));
 notes.append(meta);
 const references=screeningEvidence(field.label);
 for(const item of references){
  const card=el('section','health-evidence-card');card.append(el('strong','health-evidence-publisher',item.publisher),el('p','health-evidence-title',item.title));
  const info=el('dl','health-evidence-meta');for(const [label,value]of [['근거 종류',item.type],['해당 내용',item.section],['자료 개정·발행',item.updated||'원문에 명시된 날짜 확인 불가'],['서비스 확인일',item.verifiedOn]])info.append(el('dt','',label),el('dd','',value));card.append(info);
  const link=el('a','','국내 출처 원문 보기 · 새 창');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);details.append(card);
 }
 if(a.status==='REPORT')notes.append(el('p','health-note','합성 소견 자체의 근거는 시연 fixture입니다. 국내 자료는 검사 설명 또는 정성 결과 해석을 제공할 뿐, 이 소견의 임상적 타당성을 보증하지 않습니다.'));
 if(!references.length)details.append(el('p','health-note','확인한 국내 출처가 없어 자동 비교를 제공하지 않습니다.'));
 details.append(notes);
 box.append(details);return box;
};
const recordIcon=kind=>{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  for(const [name,value]of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.7','stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true',focusable:'false'}))svg.setAttribute(name,value);
  const paths=kind==='CHECKUP'?['M9 4H5v17h14V4h-4','M9 2h6v4H9z','M8 11l2 2 5-5','M8 17h8']:kind==='AFP'?['M9 3h6M10 3v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3','M8 15h8']:kind==='ULTRASOUND'?['M8 4h8l2 4-6 3-6-3z','M12 11v3','M7 14a7 7 0 0 0 10 0','M4 17a11 11 0 0 0 16 0']:['M4 4h16v16H4z','M8 9h.01M4 16l5-5 4 4 3-3 4 4'];
  for(const d of paths){const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',d);svg.append(path);}return svg;
};
export function createPatientHealth({root,onView,onShare,openPreview,onCompare,onHome,onSharing,onRequests,patientName=()=>''}) {
  if(!root)return null;
  let rows=[],selected='',filter='ALL',query='',active=false,generation=0,abort,session,url,timer,signature='',screeningSection='SUMMARY',detailOpened=false,showAll=false;
  const clear=()=>{generation++;abort?.abort();session?.close();session=undefined;clearTimeout(timer);if(url)URL.revokeObjectURL(url);url=undefined;};
  const preview=async(study,image)=>{const version=generation;abort=new AbortController();let created;
    try{created=await openPreview(study,abort.signal);if(version!==generation||!active){created.close();return;}session=created;
      const blob=await created.frame(0);if(version!==generation||!active)return;url=URL.createObjectURL(blob);image.src=url;image.hidden=false;created.close();session=undefined;
      timer=setTimeout(()=>{clear();image.removeAttribute('src');image.hidden=true;},Math.max(0,created.expiresAt-Date.now()));
    }catch{if(version===generation){image.hidden=true;image.removeAttribute('src');image.alt='미리보기 연결 실패 · 영상 보기에서 다시 확인하세요.';const label=image.parentElement?.querySelector('.health-preview-label');if(label)label.textContent='미리보기를 확인하지 못했어요. 영상 보기에서 다시 확인하세요.';}}
    finally{created?.close();}
  };
  const draw=()=>{
    clear();root.replaceChildren();const layout=el('div','health-layout'),main=el('div','health-main'),detail=el('aside','health-detail');detail.setAttribute('aria-label','선택한 건강기록');
    layout.classList.add('health-wallet-sheet','health-extracted-sheet');
    const sheet=el('section','health-expanded-card');sheet.setAttribute('aria-label','내 지갑에서 꺼낸 건강기록 카드');
    const heading=el('header','health-heading');
    if(onHome)heading.append(action('‹ 내 지갑으로',onHome,'health-wallet-back'));
    const symbol=el('span','health-sheet-symbol');symbol.append(createWalletIcon('records'));symbol.setAttribute('aria-hidden','true');
    heading.append(symbol,el('h1','',patientName()?`${patientName()}님의 건강기록`:'내 건강기록'),el('p','health-intro','검사부터 건강검진까지, 한곳에서 확인하세요.'));
    const compare=action('검사 변화 비교',()=>onCompare?.('혈청 AFP'),'health-compare-button');compare.disabled=!onCompare||!rows.some(r=>r.kind==='AFP');heading.append(compare);main.append(heading);
    const tools=el('div','health-tools');
    for(const [key,label]of [['ALL','전체'],['DICOM','의료영상'],['CHECKUP','건강검진'],['BLOOD','혈액검사'],['ULTRASOUND','초음파']]){const b=action(label,()=>{filter=key;detailOpened=false;draw();},'health-filter');b.setAttribute('aria-pressed',String(filter===key));tools.append(b);}
    const search=el('input','health-search');search.type='search';search.placeholder='병원·검사 검색';search.value=query;search.setAttribute('aria-label','건강기록 검색');search.oninput=()=>{query=search.value;draw();root.querySelector('.health-search').focus();};tools.append(search);main.append(tools);
    const visible=filterHealth(rows,filter,query),record=visible.find(row=>row.id===selected)||visible[0];if(record)selected=record.id;
    if(!visible.length){main.append(el('p','health-empty','표시할 기록이 없어요. 검색 조건이나 등록된 검사 목록을 확인해 주세요.'));detail.hidden=true;}
    let date='',group,previewTarget;
    const latest=visible.find(r=>r.study);
    if(latest){
      const hero=el('section','health-hero'),card=el('article','health-featured'),copy=el('div','health-featured-copy');
      copy.append(el('p','health-kicker','최근 영상 검사'),el('h2','',latest.title),el('p','health-featured-meta',`${latest.date||'검사일 확인 필요'} · ${latest.hospital}`),el('p','health-note','등록된 합성 시연 영상입니다. 검사 정보를 확인하고 필요한 영상만 열어보세요.'));
      const actions=el('div','health-featured-actions');actions.append(action('영상 보기',()=>onView(latest.study),'btn primary'),action('검사 정보',()=>{selected=latest.id;detailOpened=true;draw();root.querySelector('.health-detail h2')?.focus();},'btn'));copy.append(actions);
      const image=el('img','health-thumbnail health-featured-image');image.alt='권한 확인된 합성 DICOM 미리보기';image.hidden=true;
      const frame=el('div','health-featured-frame');frame.append(image,el('span','health-preview-label','합성 시연 영상 · 권한 확인 후 미리보기'));
      card.append(copy,frame);previewTarget={study:latest.study,image};
      hero.append(card);main.append(hero);
    }
    const compact=filter==='ALL'&&!query&&!showAll;
    if(filter==='ALL'&&!query){const bar=el('div','health-records-bar');bar.append(el('h2','','최근 건강기록'),action(showAll?'최근 기록만 보기':`전체 기록 보기 · ${visible.length}건`,()=>{showAll=!showAll;draw();},'health-wallet-back'));main.append(bar);}
    const listed=compact?visible.filter(row=>!row.study).slice(0,3):visible;
    for(const row of listed){const year=compact?'':/^\d{4}-/.test(row.date)?row.date.slice(0,4):'';if(year!==date||!group){date=year;group=el('section',compact?'health-group health-recent-grid':'health-group');if(!compact)group.append(el('h2','health-date',date?`${date}년`: '검사일 확인 필요'));main.append(group);}
      const b=action('',()=>{selected=row.id;detailOpened=true;screeningSection='SUMMARY';draw();root.querySelector('.health-detail h2')?.focus();},'health-record');b.setAttribute('aria-pressed',String(detailOpened&&row===record));
      const mark=el('span','health-record-icon');mark.append(recordIcon(row.kind));mark.setAttribute('aria-hidden','true');
      const copy=el('span','health-record-copy');copy.append(el('small','',`${row.hospital}${row.synthetic?' · 합성 시연 기록':''}`),el('strong','',row.title));
      copy.append(el('span','',`${row.date||'날짜 확인 필요'} · `+(row.study?`${libraryStudy(row.study).series}개 시리즈 · ${libraryStudy(row.study).count??'수 확인 필요'}장`:row.kind==='CHECKUP'?`${row.fields.length}개 항목 · 합성 검진 결과`:row.kind==='AFP'?`${row.value.toFixed(1)} ${row.unit} · 가상 수치`:'영상 검사 · 합성 초음파 예시')));
      b.append(mark,copy,el('span','health-record-action',detailOpened&&row===record?'보고 있는 기록':'기록 확인 ›'));group.append(b);
      if(row.study&&!previewTarget){const image=el('img','health-thumbnail');image.alt='권한 확인된 합성 DICOM 첫 영상';image.hidden=true;b.prepend(image);previewTarget={study:row.study,image};}
    }
    if(record){detail.append(el('p','health-kicker','선택한 건강기록'),el('h2','',record.title),el('p','',record.kind==='AFP'?'혈액으로 확인하는 종양표지자 검사':record.hospital));
      const metadata=el('dl','health-meta');for(const [label,value]of [['검사일',record.date||'확인 필요'],['기관',record.hospital],['자료',record.synthetic?'시안용 합성 기록':'등록된 프로젝트 합성 DICOM']])metadata.append(el('dt','',label),el('dd','',value));detail.append(metadata);
      if(record.study){detail.append(el('p','health-result',`${libraryStudy(record.study).series}개 시리즈 · ${libraryStudy(record.study).count??'수 확인 필요'}장`),action('CT / 영상 보기',()=>onView(record.study),'btn primary'),action('공유 내용 확인',()=>onShare(record.study),'btn'));}
      else if(record.kind==='CHECKUP'){
        detail.classList.add('health-checkup');
        detail.append(el('p','health-note',`홍길동 · ${record.age}세 · 완전 합성·비임상 시연 자료. 실제 국가검진 결과를 조회한 것이 아닙니다.`));
        const sections=[['SUMMARY','요약'],['BODY','신체·감각'],['LAB','혈액·소변'],['EXTRA','추가 검사'],['OPINION','기관 소견']];
        const nav=el('nav','health-checkup-nav');nav.setAttribute('aria-label','검진 결과 영역');
        for(const [key,label]of sections){const b=action(label,()=>{screeningSection=key;draw();root.querySelector(`[data-checkup-section="${key}"]`)?.focus({preventScroll:true});},'health-filter');b.dataset.checkupSection=key;b.setAttribute('aria-pressed',String(screeningSection===key));nav.append(b);}detail.append(nav);
        const content=el('section','health-checkup-content');content.setAttribute('aria-label',sections.find(([key])=>key===screeningSection)[1]);
        if(screeningSection==='SUMMARY'){
          content.append(el('h3','','내 몸의 기록, 한눈에'),el('p','health-note','홍길동님의 검사 기록을 모았어요. 수치는 가상 예시이며 건강점수·진단을 생성하지 않습니다.'));
          const assessments=record.fields.map(field=>({field,a:screeningAssessment(field,{synthetic:true,sex:record.sex,age:record.age,heightCm:170})}));
          const attention=assessments.filter(({field,a})=>field.label!=='체중'&&['BORDER','HIGH','LOW'].includes(a.status));
          content.append(el('h3','','먼저 살펴볼 항목'),el('p','health-note',attention.length?attention.map(({field,a})=>`${field.label}: ${a.label}`).join(' / '):'비교 가능한 항목에서 경계·범위 밖 표시 없음. 전체 정상 판정은 아닙니다.'));
          const legend=el('div','health-status-legend');for(const key of ['OK','BORDER','HIGH','REPORT','CONTEXT'])legend.append(el('span',`health-status health-status-${key.toLowerCase()}`,`${STATUS[key][0]} ${STATUS[key][1]}`));content.append(legend);
          content.append(el('p','health-note',`전체 ${record.fields.length}항목 · 합성 결과 등록 ${record.fields.filter(f=>f.value!==null&&f.value!==undefined).length}항목 · 추가 정보 필요 ${assessments.filter(({a})=>a.status==='UNKNOWN').length}항목. 체중·BMI는 주의 항목에 중복 집계하지 않아요. 전체 정상 판정은 아닙니다.`));
          const measures=el('div','health-checkup-measures');
          for(const label of ['혈압','공복혈당','체중']){const field=record.fields.find(f=>f.label===label),box=el('div','');box.append(el('small','',label),el('strong','',String(field.value)),el('span','',field.unit),record.age===55?el('small','health-note','이전 검사값 · 비교에서 변화 확인'):assessmentView(field));measures.append(box);}content.append(measures);
          content.append(action('전체 결과 확인',()=>{screeningSection='LAB';draw();root.querySelector('[data-checkup-section="LAB"]')?.focus({preventScroll:true});},'btn'));
          content.append(action('2025·2026 검진 비교하기',()=>onCompare?.('공복혈당'),'btn'));
        }else if(screeningSection==='OPINION'){
          content.append(el('h3','','가상 검진기관 소견'),el('p','health-note','사용자 요청에 따라 임의 작성한 합성 시연 소견 · 실제 기관 원문이나 자동 진단이 아닙니다.'),el('p','health-note','시연 안내: BMI·혈압·공복혈당의 비교 구간을 확인하고 다음 진료에서 기록을 함께 살펴보는 예시입니다. 구강검진의 치석·잇몸 소견은 치과 확인 안내 예시입니다. 간 CT·초음파·AFP와 별도 기록이며 기존 전원 시나리오를 변경하지 않습니다.'));
        }else{
          const list=el('dl','health-checkup-fields');
          for(const field of record.fields.filter(f=>f.group===screeningSection)){const line=el('div','');line.append(el('dt','',field.label));const value=el('dd',field.value===null?'health-missing':'',field.value===null?'결과 미등록':`${field.value} ${field.unit}`.trim());value.append(el('small','',field.note||'가상 시연 값'),record.age===55?el('small','health-note','2025년 · 합성 환자 55세 · 아래 비교에서 수치 확인'):assessmentView(field),action('건강도우미에서 비교하기',()=>onCompare?.(field.label),'health-date-button'));line.append(value);list.append(line);}content.append(list);
          content.append(el('p','health-note','모든 수치·소견은 합성 시연 자료입니다. 공개 비교 기준과 임의 작성한 가상 소견을 구분합니다. 실제 기관의 참고범위·보고서가 연계된 것은 아닙니다.'));
          if(screeningSection==='LAB')content.append(el('p','health-note','지질검사는 남성 24세 이상·여성 40세 이상에서 4년 주기인 성별·연령별 항목입니다. HbA1c·AFP는 공통 일반검진 항목으로 추가하지 않습니다.'));
          if(screeningSection==='EXTRA')content.append(el('p','health-note','흉부 방사선·구강검진은 공통 항목이며, C형간염·폐기능은 연령별 항목입니다. 이 화면은 실제 대상자 확인 결과가 아닙니다.'));
        }
        detail.append(content);
        const related=el('div','health-checkup-related');related.append(el('h3','','함께 확인할 검사 기록'));
        for(const other of rows.filter(row=>row.study||(row.date===record.date&&['AFP','ULTRASOUND'].includes(row.kind))))related.append(action(other.title,()=>{selected=other.id;filter='ALL';query='';draw();},'health-date-button'));
        related.append(el('p','health-note','CT 공유에 건강검진·초음파·AFP는 자동 포함되지 않습니다. 간 검사 이력은 국가 간암검진 대상 판정이 아닙니다.'));detail.append(related);
        const sources=el('details','health-checkup-sources');sources.append(el('summary','','검사항목 공식 출처'));
        for(const [label,href]of [['질병관리청 · 국가건강검진','https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6671'],['일산병원 · 일반건강검진','https://www.nhimc.or.kr/health/conts/104001000000000.do']]){const link=el('a','',label);link.href=href;link.target='_blank';link.rel='noopener noreferrer';sources.append(link);}detail.append(sources);
      }else{
        if(record.kind==='AFP'){
          const result=el('div','health-result health-afp');result.append(el('small','','가상 시연 검사값'),el('strong','',record.value.toFixed(1)),el('span','',record.unit));detail.append(result);
          detail.append(el('p','health-note','발표용으로 임의 작성한 수치입니다. 실제 검사 결과가 아니며 정상·이상 판정과 기관 참고범위를 제공하지 않습니다.'));
          const table=el('table','health-afp-history');const caption=el('caption','','혈청 AFP 가상 기록');table.append(caption);const head=el('thead',''),header=el('tr','');for(const label of ['검사일','가상 수치']){const th=el('th','',label);th.scope='col';header.append(th);}head.append(header);table.append(head);const body=el('tbody','');
          for(const row of rows.filter(row=>row.kind==='AFP')){const tr=el('tr','');tr.append(el('td','',row.date),el('td','',`${row.value.toFixed(1)} ${row.unit}`));body.append(tr);}table.append(body);detail.append(table,action('건강도우미에서 AFP 비교하기',()=>onCompare?.('혈청 AFP'),'btn'));
        }else{
          const figure=el('figure','health-ultrasound'),image=el('img','');image.src=record.image;image.alt='완전 합성 간 초음파 시연 이미지 · 실제 검사 및 임상 사용 불가';image.loading='lazy';image.onerror=()=>{image.hidden=true;figure.querySelector('figcaption').textContent='합성 이미지 연결 실패 · 실제 검사 자료가 아닙니다.';};
          figure.append(image,el('figcaption','','AI 생성 합성 이미지 · 세 날짜에 동일한 예시 사용 · 비임상'));detail.append(figure,el('p','health-note','가상 기록 메모: 간 초음파 검진 이력을 확인하는 시연입니다. 이 이미지는 실제 검사 영상·DICOM·판독 결과가 아닙니다.'));
        }
        const history=el('div','health-previous');history.append(el('h3','','같은 검사 이력'));for(const other of rows.filter(row=>row.kind===record.kind)){const b=action(other.date.replaceAll('-','.'),()=>{selected=other.id;query='';draw();},'health-date-button');b.setAttribute('aria-pressed',String(other.id===record.id));history.append(b);}detail.append(history);}
      detail.append(el('h3','','기록의 출처'),el('p','health-note',record.synthetic?'검진: 시안용 합성 기록':'영상: 프로젝트 고정 합성 데이터'),el('p','health-note','건강정보 고속도로: 실제 연계 전'),el('p','health-note','검사 수치만으로 질환을 판단하지 않아요. 의심 소견 이후 검사 일정은 의료진이 정합니다.'));
    }
    detail.hidden=!detailOpened||!record;
    if(record){const h=detail.querySelector('h2');h?.setAttribute('tabindex','-1');detail.prepend(action('목록으로 돌아가기',()=>{detailOpened=false;draw();root.querySelector('.health-record[aria-pressed]')?.focus();},'health-wallet-back'));}
    main.append(el('p','health-disclaimer','합성 시연 기록 · 국가 서비스 실제 연계 전 · 임상 사용 불가'));
    const dock=createWalletDock({selected:'records',navigate:route=>{
      if(route==='requests')(onRequests||onSharing)?.();
      else if(route==='sharing')onSharing?.();
      else if(route==='helper')onCompare?.('');
    }});
    dock.querySelector('[data-wallet-route="helper"]').title='영상 픽셀은 AI에 전달하지 않습니다.';
    sheet.append(main,detail);layout.append(sheet,dock);root.append(layout);if(active&&previewTarget&&openPreview)preview(previewTarget.study,previewTarget.image);
  };
  return {update(studies,syntheticScenario,serverRecords=[]){const next=JSON.stringify([studies,syntheticScenario,serverRecords]);if(next===signature)return;signature=next;rows=healthRecords(studies,syntheticScenario,serverRecords);draw();},setActive(value){if(active===value)return;active=value;if(active)draw();else{clear();const image=root.querySelector('.health-thumbnail');image?.removeAttribute('src');if(image)image.hidden=true;}}};
}
