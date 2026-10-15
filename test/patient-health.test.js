import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {healthRecords as authenticatedHealthRecords,filterHealth,screeningAssessment,screeningEvidence} from '../public/ui/patient-health.js';
import {screeningFields,syntheticHealthRecords} from '../src/synthetic-health-records.js';
const healthRecords=(studies,scenario)=>authenticatedHealthRecords(studies,scenario,syntheticHealthRecords());
const study={studyInstanceUid:'1.2.3',studyDate:'2026-10-10',description:'합성 복부 CT 시연 영상',sourceHospitalId:'HOSP-A',modality:'CT',series:[{instanceCount:700}]};
test('health fixtures are scenario-only and each test is separately identified',()=>{
 assert.equal(healthRecords([study],false).length,1);
 const rows=healthRecords([study],true);assert.equal(rows.length,9);assert.equal(new Set(rows.map(r=>r.id)).size,9);
 assert.equal(rows.filter(r=>r.date==='2026-10-08').length,3);assert.ok(rows.filter(r=>r.synthetic).every(r=>!r.study));
 assert.deepEqual(rows.filter(r=>r.kind==='AFP').map(r=>r.value),[24.6,8.4,6.2]);
 assert.ok(rows.filter(r=>r.kind==='AFP').every(r=>r.unit==='ng/mL'&&r.synthetic));
 assert.ok(rows.filter(r=>r.kind==='ULTRASOUND').every(r=>r.image==='/images/mediq-synthetic-liver-ultrasound-v1.png'&&r.synthetic));
 assert.equal(rows[0].study,study);assert.equal(study.series[0].instanceCount,700);
});
test('independent lab and imaging filters and hospital search',()=>{const rows=healthRecords([study],true);
 assert.equal(filterHealth(rows,'DICOM').length,1);assert.equal(filterHealth(rows,'ULTRASOUND').length,3);
 assert.equal(filterHealth(rows,'BLOOD').length,3);assert.equal(filterHealth(rows,'IMAGE').length,4);
 assert.equal(filterHealth(rows,'CHECKUP').length,2);assert.equal(filterHealth(rows,'UNKNOWN').length,0);
 assert.equal(filterHealth(rows,'ALL','검진기관 C').length,2);assert.equal(filterHealth(rows,'ALL','없음').length,0);
});

test('record sheet preserves wallet return, signed thumbnail and explicit detail state',()=>{
 const source=readFileSync('public/ui/patient-health.js','utf8');
 assert.match(source,/health-wallet-sheet/);assert.match(source,/내 지갑으로/);
 assert.match(source,/detail.hidden=!detailOpened\|\|!record/);
 assert.match(source,/previewTarget=\{study:latest.study,image\}/);
 assert.match(source,/영상 픽셀은 AI에 전달하지 않습니다/);
 assert.doesNotMatch(source,/mediq-synthetic-abdominal-ct.png/);
});
test('screening preserves units, missing results and no inferred diagnosis or scope',()=>{
 const fields=screeningFields(),byName=name=>fields.find(f=>f.label===name);
 assert.equal(fields.length,23);assert.equal(new Set(fields.map(f=>f.label)).size,23);
 assert.equal(byName('체질량지수').value,Math.round(72/1.7**2*10)/10);
 assert.equal(byName('공복혈당').unit,'mg/dL');assert.equal(byName('간 효소 γ-GTP').unit,'U/L');
 assert.equal(byName('신장기능 eGFR').value,100);assert.match(byName('신장기능 eGFR').note,/합성 보고값/);
 assert.equal(byName('C형간염 항체').value,'음성');
 for(const name of ['폐기능검사','흉부 방사선검사','구강검진'])assert.ok(byName(name).syntheticReport?.summary);
 assert.ok(fields.every(f=>f.value!==null&&f.value!==undefined));
 assert.ok(fields.every(f=>f.referenceRange===null&&f.interpretation===null));
 assert.ok(!fields.some(f=>/AFP|HbA1c/.test(f.label)));
 assert.equal(healthRecords([],false).length,0);
 const record=healthRecords([],true).find(r=>r.kind==='CHECKUP');assert.ok(record.synthetic);assert.ok(!record.study&&!record.consentId);
 assert.match(readFileSync('public/ui/patient-health.js','utf8'),/CT 공유에 건강검진·초음파·AFP는 자동 포함되지 않습니다/);
});
test('health presentation has no clinical mutation and labels illustrative results',()=>{
 const source=readFileSync('public/ui/patient-health.js','utf8');assert.doesNotMatch(source,/innerHTML|fetch\(|localStorage|postJson|createPhrConsent/);
 assert.match(source,/정상·이상 판정/);assert.match(source,/국가 서비스 실제 연계 전/);assert.match(source,/onView\(record.study\)/);assert.match(source,/createElementNS/);assert.match(source,/세 날짜에 동일한 예시 사용/);
 assert.match(source,/if\(next===signature\)return/);assert.doesNotMatch(source,/◇|◉|▧/);
});
const context={synthetic:true,sex:'M',age:56,heightCm:170};
const assess=(label,value,unit)=>screeningAssessment({label,value,unit},context);
test('glucose boundaries, low values, invalid units and missing context fail safely',()=>{
 for(const [v,s]of [[69,'LOW'],[70,'OK'],[99.9,'OK'],[100,'BORDER'],[125.9,'BORDER'],[126,'HIGH']])assert.equal(assess('공복혈당',v,'mg/dL').status,s);
 for(const v of [null,undefined,NaN,Infinity,'104',-1])assert.equal(assess('공복혈당',v,'mg/dL').status,'UNKNOWN');
 assert.equal(assess('공복혈당',104,'mmol/L').status,'UNKNOWN');
 for(const c of [{},{synthetic:false,sex:'M',age:56},{synthetic:true,sex:'F',age:56},{synthetic:true,sex:'M',age:12}])assert.equal(screeningAssessment({label:'혈색소',value:14.8,unit:'g/dL'},c).status,'UNKNOWN');
});
test('interval references have no invented amber band; BP combines both pressures',()=>{
 for(const [v,s]of [[12.9,'LOW'],[13,'OK'],[16.5,'OK'],[17,'OK'],[17.01,'HIGH']])assert.equal(assess('혈색소',v,'g/dL').status,s);
 assert.equal(assess('간 효소 ALT',40,'U/L').status,'OK');assert.equal(assess('간 효소 ALT',40.1,'U/L').status,'HIGH');
 assert.equal(assess('간 효소 γ-GTP',10,'U/L').status,'LOW');assert.equal(assess('간 효소 γ-GTP',63,'U/L').status,'OK');
 for(const [v,s]of [['128 / 82','BORDER'],['120 / 79','BORDER'],['119 / 80','BORDER'],['140 / 70','HIGH'],['110 / 90','HIGH'],['90 / 60','UNKNOWN'],['128 / 128','UNKNOWN'],['bad','UNKNOWN']])assert.equal(assess('혈압',v,'mmHg').status,s);
 for(const label of ['요단백','혈청 AFP'])assert.equal(assess(label,1,'mg/dL').status,'UNKNOWN');
 assert.equal(assess('신장기능 eGFR',null,'mL/min/1.73㎡').label,'결과 미등록');
 assert.equal(screeningFields().filter(f=>screeningAssessment(f,context).status==='BORDER').length,4);
 assert.ok(screeningFields().every(f=>f.referenceRange===null&&f.interpretation===null));
});
test('all synthetic screening values have a comparison, linked context or explicit fictional report',()=>{
 const fields=screeningFields(),assessments=fields.map(f=>screeningAssessment(f,context));
 assert.ok(assessments.every(a=>a.status!=='UNKNOWN'));
 assert.equal(assessments.filter(a=>a.status==='REPORT').length,5);
 assert.equal(assessments.filter(a=>a.status==='CONTEXT').length,1);
 assert.equal(fields.filter(f=>f.label!=='체중'&&['BORDER','HIGH','LOW'].includes(screeningAssessment(f,context).status)).length,3);
 for(const field of fields){assert.equal(screeningAssessment(field,{...context,synthetic:false}).status,'UNKNOWN');assert.equal(screeningAssessment({...field,value:null},context).status,'UNKNOWN');}
 const height=fields.find(f=>f.label==='키');assert.equal(screeningAssessment(height,context).label,'BMI 계산에 사용');
 const report=fields.find(f=>f.label==='폐기능검사');assert.equal(screeningAssessment({...report,syntheticReport:undefined},context).status,'UNKNOWN');
 assert.match(readFileSync('public/ui/patient-health.js','utf8'),/실제 기관 원문이나 자동 진단이 아닙니다/);
});
test('BMI classifies unrounded values and weight requires valid height without duplicate markers',()=>{
 for(const [v,s]of [[18.49,'LOW'],[18.5,'OK'],[22.99,'OK'],[23,'BORDER'],[24.99,'BORDER'],[25,'HIGH'],[30,'HIGH'],[35,'HIGH'],[0,'UNKNOWN']])assert.equal(assess('체질량지수',v,'kg/㎡').status,s);
 assert.equal(assess('체중',72,'kg').label,'BMI 24.9 · 비만 전단계');assert.equal(assess('체중',72,'kg').segments.length,0);
 for(const heightCm of [null,0,-1,NaN,Infinity,'170'])assert.equal(screeningAssessment({label:'체중',value:72,unit:'kg'},{...context,heightCm}).status,'UNKNOWN');
 for(const [v,s]of [[89.99,'OK'],[90,'HIGH'],[0,'UNKNOWN']])assert.equal(assess('허리둘레',v,'cm').status,s);
});
test('creatinine, lipids and eGFR boundaries keep general classes separate from diagnoses',()=>{
 for(const [v,s]of [[0.49,'LOW'],[0.5,'OK'],[0.7,'OK'],[1.3,'OK'],[1.4,'OK'],[1.41,'HIGH']])assert.equal(assess('혈청 크레아티닌',v,'mg/dL').status,s);
 for(const [label,thresholds]of [['총콜레스테롤',[200,240]],['LDL 콜레스테롤',[130,160]],['중성지방',[150,200]]]){
  const [b,h]=thresholds;for(const [v,s]of [[b-.01,'OK'],[b,'BORDER'],[h-.01,'BORDER'],[h,'HIGH']])assert.equal(assess(label,v,'mg/dL').status,s);
  assert.equal(assess(label,100,'mmol/L').status,'UNKNOWN');
 }
 assert.equal(assess('HDL 콜레스테롤',39.99,'mg/dL').status,'LOW');assert.equal(assess('HDL 콜레스테롤',40,'mg/dL').status,'OK');assert.equal(assess('HDL 콜레스테롤',80,'mg/dL').status,'OK');
 for(const [v,s]of [[59.99,'LOW'],[60,'BORDER'],[89.99,'BORDER'],[90,'OK']])assert.equal(assess('신장기능 eGFR',v,'mL/min/1.73㎡').status,s);
 assert.match(assess('LDL 콜레스테롤',110,'mg/dL').explanation,/개인별 치료 목표/);
});
test('qualitative results are allowlisted and never infer current HCV infection',()=>{
 for(const [v,s]of [['음성','OK'],['±','REPORT'],['1+','HIGH'],['constructor','UNKNOWN'],['__proto__','UNKNOWN'],['임의','UNKNOWN']])assert.equal(assess('요단백',v,'').status,s);
 assert.equal(assess('C형간염 항체','음성','').status,'OK');assert.equal(assess('C형간염 항체','양성','').status,'REPORT');
 assert.match(assess('C형간염 항체','양성','').explanation,/HCV RNA/);
 assert.equal(assess('C형간염 항체','불명','').status,'UNKNOWN');
});
test('all 23 fields use domestic first-party references with specific provenance',()=>{
 const hosts=new Set(['health.kdca.go.kr','www.index.go.kr','health.amc.seoul.kr','www.knuh.kr']);
 for(const field of screeningFields()){
  const references=screeningEvidence(field.label);assert.ok(references.length>0,field.label);
  for(const r of references){const url=new URL(r.url);assert.equal(url.protocol,'https:');assert.ok(hosts.has(url.hostname));assert.ok(r.publisher&&r.title&&r.section&&r.type);assert.equal(r.verifiedOn,'2026-10-11');assert.notEqual(r.updated,r.verifiedOn);}
  const a=screeningAssessment(field,context);assert.ok(references.some(r=>r.url===a.source),field.label);
 }
 for(const label of ['constructor','__proto__','unknown'])assert.deepEqual(screeningEvidence(label),[]);
 const first=screeningEvidence('혈색소');first[0].publisher='changed';assert.equal(screeningEvidence('혈색소')[0].publisher,'서울아산병원');
});
test('source cards precede closed supplemental notes without removing safety disclosures',()=>{
 const source=readFileSync('public/ui/patient-health.js','utf8');
 assert.match(source,/const notes=el\('details','health-criteria-notes'\)/);
 assert.match(source,/notes\.append\(el\('summary','','시연 데이터·해석 유의사항'\)\)/);
 assert.match(source,/notes\.append\(meta\)/);
 assert.ok(source.indexOf('details.append(card)')<source.indexOf('details.append(notes)'));
 assert.doesNotMatch(source,/notes\.(open|hidden)\s*=/);
 assert.match(source,/notes\.append\(el\('p','health-note','결과의 출처/);
});
test('reference cards separate fixture origin from supporting source and disclose limits',()=>{
 const source=readFileSync('public/ui/patient-health.js','utf8');
 assert.doesNotMatch(source,/medlineplus|kidney\.org|cdc\.gov|thoracic\.org|knpo\.police/);
 for(const text of ['결과의 출처','검사·판독·인증한 기관이 아닙니다','근거 종류','서비스 확인일','원문에 명시된 날짜 확인 불가','검사 설명만 제공','개인별 권장 체중이 아닙니다'])assert.ok(source.includes(text),text);
 assert.match(source,/link\.rel='noopener noreferrer'/);assert.doesNotMatch(source,/innerHTML|fetch\(/);
 assert.match(assess('혈청 크레아티닌',0.9,'mg/dL').range,/남성 전용 범위 아님/);
 assert.equal(screeningEvidence('신장기능 eGFR').length,2);assert.equal(screeningEvidence('체중').length,2);
});
