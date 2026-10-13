// Fixed nonclinical presentation fixtures. Never a clinical/FHIR source or model input.
export const SYNTHETIC_HEALTH_VERSION = 'hong-gildong-health-20261011-v1';
export function screeningFields(year = 2026) {
  const row=(group,label,value,unit='',note='')=>({group,label,value,unit,note,referenceRange:null,interpretation:null});
  const fields=[
    row('BODY','키',170,'cm'),row('BODY','체중',72,'kg'),row('BODY','허리둘레',88,'cm'),row('BODY','체질량지수',24.9,'kg/㎡','키·체중으로 계산한 시연 값'),
    row('BODY','혈압','128 / 82','mmHg'),{...row('BODY','시력 · 좌 / 우','1.0 / 0.9','','교정시력 · 합성 시연 결과'),syntheticReport:{summary:'가상 소견: 교정시력 좌 1.0 / 우 0.9.',followUp:'증상·이전 결과와 함께 확인하는 예시이며 숫자로 질환을 판정하지 않습니다.'}},
    {...row('BODY','청력 · 좌 / 우','양측 이상 소견 없음','','합성 시연 결과'),syntheticReport:{summary:'가상 소견: 양측 선별검사에서 이상 소견 없음.',followUp:'청력 역치 수치는 제공하지 않으며 듣기 불편이 있으면 별도 확인하는 예시입니다.'}},
    row('LAB','혈색소',14.8,'g/dL'),row('LAB','공복혈당',104,'mg/dL'),row('LAB','간 효소 AST',32,'U/L'),row('LAB','간 효소 ALT',35,'U/L'),row('LAB','간 효소 γ-GTP',48,'U/L'),
    row('LAB','혈청 크레아티닌',0.9,'mg/dL'),row('LAB','신장기능 eGFR',100,'mL/min/1.73㎡','임의 작성한 합성 보고값 · 앱 계산 아님'),row('LAB','요단백','음성','','가상 결과'),
    row('LAB','총콜레스테롤',186,'mg/dL','성별·연령별 주기 검사'),row('LAB','HDL 콜레스테롤',52,'mg/dL'),row('LAB','LDL 콜레스테롤',110,'mg/dL'),row('LAB','중성지방',120,'mg/dL'),
    row('EXTRA','C형간염 항체','음성','','항체 정성검사 · 합성 시연 결과'),
    {...row('EXTRA','폐기능검사','FEV₁ 3.20 L · FVC 4.10 L · FEV₁/FVC 78%','','임의 작성한 합성 보고값'),syntheticReport:{summary:'가상 소견: 검사기관의 종합 소견에서 특이 이상 없음으로 작성.',followUp:'예측치·정상 하한·검사 품질이 없어 앱에서 정상 여부를 자동 계산하지 않습니다.'}},
    {...row('EXTRA','흉부 방사선검사','가상 보고서: 급성 이상 소견 없음','','합성 텍스트 소견 · X-ray 영상 없음'),syntheticReport:{summary:'가상 소견: 급성 이상 소견 없음.',followUp:'실제 촬영·판독을 수행한 결과가 아니며 CT 진단·전원 시나리오를 대체하지 않습니다.'}},
    {...row('EXTRA','구강검진','가상 보고서: 치석·경미한 잇몸 염증 소견','','합성 시연 결과 · 치과 확인 권고 예시'),syntheticReport:{summary:'가상 소견: 치석과 경미한 잇몸 염증 소견.',followUp:'구강관리 상담과 치과 확인을 안내하는 시연 문구입니다. 실제 진단이 아닙니다.'}},
  ];
  if(year!==2025 && year!==2026)throw new Error('SYNTHETIC_YEAR_INVALID');
  if(year===2025){
    const previous={'체중':74,'허리둘레':90,'혈압':'132 / 84','혈색소':14.6,'공복혈당':98,'간 효소 AST':28,'간 효소 ALT':30,'간 효소 γ-GTP':44,'혈청 크레아티닌':0.9,'신장기능 eGFR':102,'총콜레스테롤':192,'HDL 콜레스테롤':50,'LDL 콜레스테롤':116,'중성지방':130};
    for(const field of fields)if(Object.hasOwn(previous,field.label))field.value=previous[field.label];
    fields.find(f=>f.label==='체질량지수').value=Math.round(74/1.7**2*10)/10;
  }
  return fields;
}
export function syntheticHealthRecords(){
  const records=[2026,2025].map(year=>({id:`demo-${year}-10-08-CHECKUP`,date:`${year}-10-08`,hospital:'가상 A대학병원',kind:'CHECKUP',title:`${year} 건강검진`,synthetic:true,age:year===2026?56:55,sex:'M',method:'SYNTHETIC-CHECKUP-V1',fields:screeningFields(year)}));
  for(const date of ['2026-10-08','2026-04-08','2025-10-08'])for(const kind of ['ULTRASOUND','AFP'])records.push({id:`demo-${date}-${kind}`,date,hospital:date==='2025-10-08'?'가상 검진기관 C':'A대학병원',kind,title:kind==='AFP'?'혈청 AFP':'간 초음파',synthetic:true,method:'SYNTHETIC-ILLUSTRATION-V1',
    ...(kind==='AFP'?{value:{'2025-10-08':6.2,'2026-04-08':8.4,'2026-10-08':24.6}[date],unit:'ng/mL',referenceRange:null}:{image:'/images/mediq-synthetic-liver-ultrasound-v1.png'})});
  return records;
}
