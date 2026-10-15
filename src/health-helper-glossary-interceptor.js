// Medical Screening Glossary Interceptor for Health Helper
// Provides instant, verified, patient-friendly definitions for all standard health checkup items
// (AFP, Liver Ultrasound, Chest CT, AST, ALT, GGT, Blood Glucose, HbA1c, Lipids, Urinalysis, etc.)
// Adheres strictly to non-diagnostic medical law (의료법 제27조 무면허 의료행위 / 진단 오인 금지)

export const GLOSSARY_QUERY_SUFFIX = /^\s*(?:(?:은|는|이|가|의|이란|란|뜻|정의|검사|검사란|검사는|검사가|수치|목적|준비|이해|측정|측정법)\s*)*(?:가\s*뭐야|가\s*뭔가요|는\s*뭐야|는\s*뭔가요|란\s*뭐야|란\s*뭔가요|이\s*뭐야|이\s*뭔가요|알려줘|알려주세요|설명해줘|설명해주세요)?(?:\s*[?？.!]*)$/iu;

export function matchGlossaryTerm(termRegex, text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  const m = trimmed.match(termRegex);
  if (!m) return false;
  const rest = trimmed.slice(m[0].length);
  return GLOSSARY_QUERY_SUFFIX.test(rest);
}

export const HEALTH_SCREENING_GLOSSARY = Object.freeze([
  {
    id: 'afp',
    name: '알파태아단백(AFP) 종양표지자 검사',
    category: '종양표지자 및 정밀검사',
    termPattern: /^(?:혈청\s*)?(?:afp|알파\s*태아\s*단백)/iu,
    definition: '혈액 검체를 통해 혈액 내 AFP(알파태아단백) 단백질 수치를 측정하는 혈액검사입니다. 간경변증이나 만성 간염 환자에서 간 초음파와 함께 간암 발생 여부를 조기에 선별하거나, 치료 후 경과를 추적 관찰하는 대표적인 종양표지자로 활용됩니다.',
    normalContext: '일반적인 정상 성인의 혈청 AFP 참고치는 보통 10~20 ng/mL 이하(기관 기준에 따라 상이)이나, 검사기관마다 시약과 측정 기준이 다를 수 있습니다.',
    caution: '⚠️ 중요: AFP 수치 하나만으로 암을 단독 확진하거나 배제할 수 없습니다. 만성 간염, 간경변증 등 양성 간 질환에서도 일시적으로 상승할 수 있으며, 일부 조기 간암에서는 수치가 정상일 수 있으므로 반드시 간 초음파나 CT 등 영상검사와 함께 종합적으로 평가해야 합니다.',
    disclaimer: '본 정보는 MedlinePlus 및 국가 암 검진 기준을 반영한 비임상 일반 의학 해설이며, 환자 개인의 질병 진단이나 치료를 대신할 수 없습니다. 정확한 수치 판독은 담당 의료진에게 확인하세요.',
    suggestedQuestions: [
      '이번 AFP 검사의 구체적인 목적과 진료 계획은 무엇인가요?',
      '간 초음파 영상검사와 AFP 수치를 함께 확인하는 이유는 무엇인가요?',
      '이전 검사 결과와 비교할 때 어떤 점을 주의해서 봐야 하나요?'
    ],
    sources: [
      {
        id: 'school-demo-medical-test-afp-tumor-marker',
        title: '알파태아단백(AFP) 종양표지자 검사',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/',
        section: '검사 개요 및 목적'
      }
    ]
  },
  {
    id: 'liver-ultrasound',
    name: '간 초음파 검사 (Liver Ultrasound)',
    category: '의료영상 검사',
    termPattern: /^(?:간\s*초음파|상복부\s*초음파|복부\s*초음파|초음파)/iu,
    definition: '인체에 무해한 고주파 음파를 복부에 투과시켜 간, 담낭, 담도, 비장 등 복부 장기의 형태와 크기, 결절(혹), 지방간, 간경변증 유무를 실시간 영상으로 관찰하는 비침습적 영상의학 검사입니다.',
    normalContext: '간의 크기, 표면의 매끄러움, 내부 에코(음영)의 균일성, 혈관 구조를 확인하여 간 실질의 건강 상태를 평가합니다.',
    caution: '⚠️ 방사선 노출이 전혀 없어 안전하지만, 장 내 가스나 체형(비만 등)에 따라 시야가 제한될 수 있습니다. 초음파에서 의심스러운 결절이나 병변이 발견되면 정확한 감별을 위해 조영 증강 CT나 간 MRI 정밀검사를 추가로 시행할 수 있습니다.',
    disclaimer: '본 정보는 MedlinePlus 영상의학 정보를 기반으로 한 비임상 일반 해설이며, 실제 영상 판독은 영상의학과 전문의 및 주치의의 진료를 통해 확인하세요.',
    suggestedQuestions: [
      '초음파 검사 전에 금식이 필요한 이유와 시간은 어떻게 되나요?',
      '혈액검사(AFP, AST/ALT) 결과와 초음파 소견을 어떻게 연계해서 보나요?',
      '결절이나 지방간 소견이 관찰되었을 때 다음 추적검사 주기는 언제인가요?'
    ],
    sources: [
      {
        id: 'school-demo-medical-test-ultrasound',
        title: '초음파 검사 (Sonogram)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/sonogram/',
        section: '검사 목적 및 원리'
      }
    ]
  },
  {
    id: 'chest-ct',
    name: '흉부 CT 검사 (Chest CT Scan)',
    category: '의료영상 검사',
    termPattern: /^(?:흉부\s*ct|가슴\s*ct|\bct\b|컴퓨터\s*단층\s*촬영)/iu,
    definition: 'X선과 컴퓨터를 결합하여 흉부(가슴) 내부를 수 밀리미터 단위의 얇은 횡단면 슬라이스(수백 장) 영상으로 정밀 재구성하는 정밀 영상검사입니다. 일반 흉부 X-ray에서 잘 보이지 않는 미세 폐 결절, 폐암, 기관지 확장증, 폐렴 등을 상세히 감별합니다.',
    normalContext: '폐 실질, 기관지, 종격동, 혈관, 늑골 구조를 프레임 단위로 평가합니다. MediQ 플랫폼에서는 700장 고해상도 CT 영상을 다운로드 없이 WADO-RS 스트리밍으로 렌더링합니다.',
    caution: '⚠️ 소량의 X선 방사선이 사용되므로 임상적으로 정당한 목적이 있을 때 시행합니다. 조영제를 사용하는 CT의 경우 검사 전 4~6시간 금식이 필요하며, 알레르기 병력이나 신장 기능(혈청 크레아티닌)을 사전에 확인합니다.',
    disclaimer: '본 정보는 FDA 및 MedlinePlus 의료영상 가이드를 반영한 일반 해설이며, 방사선 노출에 대한 우려나 검사 필요성은 담당 전문의와 상의하세요.',
    suggestedQuestions: [
      '조영제를 사용하는 검사인가요? 검사 전 금식 및 주의사항이 있나요?',
      '일반 흉부 X-ray와 비교해 CT를 추가로 촬영하는 이유는 무엇인가요?',
      '폐 결절이 발견된 경우 추적 검사는 몇 개월 후에 진행하나요?'
    ],
    sources: [
      {
        id: 'fda-medical-imaging-education',
        title: '의료영상 검사 및 방사선 안전 가이드',
        institution: 'FDA / MedlinePlus',
        url: 'https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication',
        section: 'CT 원리 및 환자 안내'
      }
    ]
  },
  {
    id: 'ast-alt',
    name: '간 기능 검사 AST / ALT (GOT / GPT)',
    category: '간기능 혈액검사',
    termPattern: /^(?:ast|alt|sgot|sgpt|간\s*효소|간기능)/iu,
    definition: '간세포 내에 풍부하게 존재하는 효소들입니다. 간세포가 손상되거나 파괴되면 혈액 내로 흘러나와 농도가 높아지므로, 급만성 간염, 지방간, 알코올성 간 손상, 약물성 간 장애를 평가하는 가장 기본적인 간기능 지표입니다.',
    normalContext: '일반적인 참고치는 대략 40 U/L 이하이나, 검사기관의 연령·성별 기준에 따라 차이가 있습니다.',
    caution: '⚠️ 수치가 정상보다 높다고 해서 무조건 특정 간 질환을 의미하지는 않습니다. 과도한 운동, 근육 손상, 과로, 알코올, 복용 중인 건강기능식품 등에 의해서도 일시적으로 상승할 수 있으므로, AST와 ALT의 비율(AST/ALT ratio) 및 초음파 소견을 종합해야 합니다.',
    disclaimer: '본 정보는 국민건강보험공단 검진 기준 및 MedlinePlus 기준 일반 의학 정보입니다.',
    suggestedQuestions: [
      '수치가 일시적으로 상승할 수 있는 생활 요인(운동, 음주 등)이 있나요?',
      '수치 개선을 위해 생활 습관 외에 추가적인 간 초음파 검사가 필요한가요?',
      '현재 복용 중인 약물이나 영양제가 간 효소 수치에 영향을 주었을 가능성이 있나요?'
    ],
    sources: [
      {
        id: 'medlineplus-lft',
        title: '간기능 혈액검사 (Liver Function Tests)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/liver-function-tests/',
        section: 'AST 및 ALT 해설'
      }
    ]
  },
  {
    id: 'gamma-gtp',
    name: '감마-지티피 검사 (γ-GTP / GGT)',
    category: '간기능 혈액검사',
    termPattern: /^(?:감마\s*지티피|감마\s*gtp|gamma\s*gtp|\bggt\b)/iu,
    definition: '간의 담관(담도) 상피세포에 많이 분포하는 효소입니다. 담즙 배설에 장애가 있거나(담도 질환), 알코올 섭취 또는 특정 약물 복용 시 매우 민감하게 상승하는 효소 검사입니다.',
    normalContext: '통상 남성은 10~71 U/L, 여성은 6~42 U/L 범위로 성별 간 차이가 존재합니다.',
    caution: '⚠️ 잦은 음주나 특정 약물 복용만으로도 크게 상승할 수 있으며, 음주를 중단하면 수 주에 걸쳐 서서히 감소하는 경향을 보입니다. 단독 수치보다는 AST, ALT 및 복부 초음파와 함께 담도계 이상 유무를 종합 관찰합니다.',
    disclaimer: '일반 의학 상식 정보이며, 개인 수치 판정은 주치의와 상의하세요.',
    suggestedQuestions: [
      '음주 습관과 수치 변화 사이에 어떤 상관관계가 있나요?',
      '담관이나 담낭 질환을 확인하기 위해 추가 검사가 권고되나요?'
    ],
    sources: [
      {
        id: 'medlineplus-ggt',
        title: '감마-GTP 검사 (GGT Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/',
        section: '검사 목적'
      }
    ]
  },
  {
    id: 'blood-glucose',
    name: '공복혈당 검사 (Fasting Blood Glucose)',
    category: '당뇨 및 대사 검사',
    termPattern: /^(?:공복\s*혈당|\bfbs\b|혈당)/iu,
    definition: '최소 8시간 이상 금식(물 제외) 후 혈액 속의 포도당 농도를 측정하는 검사입니다. 당뇨병 유무 및 당뇨 전단계(공복혈당장애)를 선별하는 가장 대표적인 기본 검사입니다.',
    normalContext: '일반적으로 100 mg/dL 미만을 정상 범위로 보며, 100~125 mg/dL는 공복혈당장애(당뇨 전단계), 126 mg/dL 이상은 당뇨병 의심 기준으로 추가 확인이 필요합니다.',
    caution: '⚠️ 전날의 스트레스, 수면 부족, 감기 등 일시적 컨디션이나 금식 시간 부족에 의해 일시적으로 높게 측정될 수 있으므로, 당화혈색소(HbA1c) 검사나 재검을 통해 종합 판단합니다.',
    disclaimer: '국가 건강검진 당뇨병 선별 기준에 기초한 일반 의학 정보입니다.',
    suggestedQuestions: [
      '공복혈당장애 소견이 있을 때 당화혈색소(HbA1c) 검사를 받아야 하나요?',
      '식습관 및 운동 개선 후 재검사는 언제쯤 진행하는 것이 좋나요?'
    ],
    sources: [
      {
        id: 'medlineplus-glucose',
        title: '혈당 검사 (Blood Glucose Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/',
        section: '공복혈당 선별'
      }
    ]
  },
  {
    id: 'hba1c',
    name: '당화혈색소 검사 (HbA1c)',
    category: '당뇨 및 대사 검사',
    termPattern: /^(?:당화\s*혈색소|\bhba1c\b|\ba1c\b)/iu,
    definition: '적혈구 내의 혈색소(헤모글로빈)에 포도당이 결합된 비율을 측정하는 검사입니다. 적혈구의 수명(약 120일) 동안의 혈당 상태를 반영하므로, 당일 식사나 단기적 컨디션에 구애받지 않고 지난 2~3개월간의 평균적인 혈당 조절 정도를 정확히 나타냅니다.',
    normalContext: '정상은 5.6% 이하, 5.7~6.4%는 당뇨 전단계, 6.5% 이상은 당뇨병 진단 기준 중 하나로 활용됩니다.',
    caution: '⚠️ 빈혈이나 용혈성 질환, 이상혈색소증이 있는 경우 수치가 실제보다 낮거나 높게 왜곡될 수 있으므로 의료진의 해석이 필요합니다.',
    disclaimer: '당뇨병 학회 및 MedlinePlus 기준 일반 의학 정보입니다.',
    suggestedQuestions: [
      '공복혈당 수치와 당화혈색소 수치가 다를 때 어떤 기준으로 해석하나요?',
      '현재 상태에서 목표로 삼아야 할 당화혈색소 수치는 몇 %인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-a1c',
        title: '당화혈색소 검사 (A1C Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/',
        section: '혈당 관리 지표'
      }
    ]
  },
  {
    id: 'lipid-panel',
    name: '지질 검사 (총콜레스테롤, HDL, LDL, 중성지방)',
    category: '지질 대사 검사',
    termPattern: /^(?:총\s*콜레스테롤|콜레스테롤|\b(?:hdl|ldl)\b(?:\s*콜레스테롤)?|중성\s*지방|트리글리세라이드|지질|\blipid\b)/iu,
    definition: '혈액 내 다양한 지방 성분을 종합 측정하여 이상지질혈증(고지혈증) 및 동맥경화, 심뇌혈관 질환의 위험도를 평가하는 혈액검사입니다. 나쁜 콜레스테롤(LDL), 혈관을 청소하는 좋은 콜레스테롤(HDL), 에너지 저장 지방(중성지방)으로 세분됩니다.',
    normalContext: '일반적으로 총콜레스테롤 200 mg/dL 미만, LDL 130 mg/dL 미만, HDL 60 mg/dL 이상, 중성지방 150 mg/dL 미만을 적정 수준으로 관리합니다.',
    caution: '⚠️ 중성지방은 검사 전 식사나 음주에 매우 민감하게 변하므로 반드시 9~12시간 이상의 철저한 금식 후 채혈해야 정확합니다. 또한 LDL 목표치는 개인의 당뇨, 고혈압, 심장질환 위험도에 따라 다르게 설정됩니다.',
    disclaimer: '이상지질혈증 진료지침 기준 비임상 해설입니다.',
    suggestedQuestions: [
      'LDL 콜레스테롤과 중성지방을 낮추기 위한 식단 관리 원칙은 무엇인가요?',
      '생활습관 개선 외에 지질 강하제(스타틴 등) 복용이 필요한 상태인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-cholesterol',
        title: '콜레스테롤 검사 (Cholesterol Levels)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
        section: '지질 프로필'
      }
    ]
  },
  {
    id: 'kidney-function',
    name: '신장 기능 검사 (혈청 크레아티닌 & eGFR)',
    category: '신장 및 요검사',
    termPattern: /^(?:크레아티닌|\begfr\b|신\s*사구체\s*여과율|신장\s*기능)/iu,
    definition: '신장(콩팥)이 체내 노폐물을 걸러내는 배설 능력을 평가하는 핵심 검사입니다. 크레아티닌은 근육 활동 후 생기는 노폐물로 신장을 통해 배출되며, 이를 나이와 성별과 결합하여 신장이 1분에 여과하는 혈액량인 eGFR(추정 사구체 여과율)을 계산합니다.',
    normalContext: '혈청 크레아티닌은 통상 0.7~1.2 mg/dL 수준이며, eGFR은 60 mL/min/1.73㎡ 이상일 때 신장 기능이 양호한 것으로 평가합니다.',
    caution: '⚠️ 크레아티닌은 근육량이 많은 사람이나 심한 근력 운동 후, 고단백 식사 시 일시적으로 높게 나올 수 있으며, 탈수 상태에서도 상승할 수 있습니다.',
    disclaimer: '대한신장학회 및 MedlinePlus 기준 일반 의학 정보입니다.',
    suggestedQuestions: [
      'eGFR 수치가 감소했을 때 추가 요단백(소변) 검사가 필요한가요?',
      '신장에 부담을 주는 약물(소염진통제 등) 복용 시 주의할 점은 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-creatinine',
        title: '크레아티닌 검사 (Creatinine Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/creatinine-test/',
        section: '신장 기능 평가'
      }
    ]
  },
  {
    id: 'urinalysis-protein',
    name: '요단백 검사 (Protein in Urine)',
    category: '신장 및 요검사',
    termPattern: /^(?:요단백|소변\s*단백|단백뇨|소변)/iu,
    definition: '소변 속에 단백질이 배출되는지를 확인하는 기초 검사입니다. 정상적인 신장 사구체는 단백질을 혈액 내로 재흡수하여 소변으로 빠져나가지 못하게 막지만, 신장 필터가 손상되면 소변으로 단백질이 누출됩니다.',
    normalContext: '정상 검사 결과는 \'음성(-)\'입니다.',
    caution: '⚠️ 심한 운동, 발열, 기립성 단백뇨, 탈수, 스트레스 등에 의해 일시적인 위양성(약양성)이 나타날 수 있으므로, 1회 양성 소견 시 아침 첫 소변으로 재검사를 진행하여 지속성 단백뇨 여부를 확인합니다.',
    disclaimer: '소변검사 표준 지침 기반 일반 해설입니다.',
    suggestedQuestions: [
      '일시적인 요단백 양성과 신장 질환성 단백뇨는 어떻게 구분하나요?',
      '혈압이나 혈당 관리가 요단백에 미치는 영향은 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-protein-urine',
        title: '요단백 검사 (Protein in Urine Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/protein-in-urine/',
        section: '검사 목적 및 해석'
      }
    ]
  },
  {
    id: 'hemoglobin-anemia',
    name: '혈색소 검사 (Hemoglobin / 빈혈검사)',
    category: '혈액 및 빈혈 검사',
    termPattern: /^(?:혈색소|헤모글로빈|빈혈)/iu,
    definition: '적혈구 속에서 산소를 온몸의 세포로 운반하는 핵심 단백질인 혈색소(헤모글로빈) 농도를 측정하여 빈혈 유무를 판정하는 기본 혈액검사입니다.',
    normalContext: '성인 남성은 대략 13~17 g/dL, 성인 여성은 12~15 g/dL를 표준 범위로 권장합니다.',
    caution: '⚠️ 수치가 낮으면 철분 결핍성 빈혈, 만성 출혈, 비타민 결핍 등을 의심할 수 있으며, 반대로 수치가 너무 높으면 탈수증이나 만성 폐 질환, 다혈증을 의심할 수 있습니다.',
    disclaimer: 'MedlinePlus 혈액 검사 기준 일반 정보입니다.',
    suggestedQuestions: [
      '빈혈이 의심되는 경우 철분 수치(페리틴 등) 추가 검사가 필요한가요?',
      '어지럼증이나 피로감 등의 증상과 혈색소 수치가 연관되어 있나요?'
    ],
    sources: [
      {
        id: 'medlineplus-hemoglobin',
        title: '혈색소 검사 (Hemoglobin Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/',
        section: '빈혈 선별'
      }
    ]
  },
  {
    id: 'blood-pressure',
    name: '혈압 측정 (Blood Pressure Measurement)',
    category: '신체 계측 및 심혈관',
    termPattern: /^(?:혈압|수축기(?:\s*혈압)?|이완기(?:\s*혈압)?)/iu,
    definition: '심장이 수축하여 혈액을 전신으로 밀어낼 때의 최고 압력(수축기 혈압)과 심장이 이완할 때 혈관에 남아있는 최저 압력(이완기 혈압)을 측정하는 필수 생체 징후 검사입니다.',
    normalContext: '정상 혈압은 수축기 120 mmHg 미만 및 이완기 80 mmHg 미만입니다. 140/90 mmHg 이상은 고혈압 기준으로 평가합니다.',
    caution: '⚠️ 병원이나 낯선 환경에서 긴장하여 일시적으로 혈압이 높게 나오는 백의 고혈압(White-coat hypertension)이 흔하므로, 안정된 상태에서 2~3회 반복 측정하거나 가정 혈압을 측정하여 종합 평가합니다.',
    disclaimer: '대한고혈압학회 및 MedlinePlus 기준 일반 안내입니다.',
    suggestedQuestions: [
      '가정에서 혈압을 측정할 때 지켜야 할 정확한 자세와 시간은 언제인가요?',
      '혈압 조절을 위해 염분 섭취 제한과 유산소 운동은 어떻게 권장되나요?'
    ],
    sources: [
      {
        id: 'medlineplus-blood-pressure',
        title: '혈압 측정 (Measuring Blood Pressure)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/measuring-blood-pressure/',
        section: '혈압 기준'
      }
    ]
  },
  {
    id: 'bmi-body-metrics',
    name: '체질량지수 (BMI / 비만도 검사)',
    category: '신체 계측 및 대사',
    termPattern: /^(?:\bbmi\b|체질량\s*지수|비만도|허리\s*둘레)/iu,
    definition: '체중(kg)을 신장의 제곱(㎡)으로 나눈 값으로, 체지방의 간접적인 정도와 비만 여부를 신속하게 평가하는 표준 신체 계측 지표입니다. 허리둘레와 함께 복부비만 및 대사증후군 위험도를 예측합니다.',
    normalContext: '한국 성인 기준 통상 18.5~22.9를 정상, 23~24.9를 비만 전단계(과체중), 25 이상을 비만으로 분류합니다.',
    caution: '⚠️ BMI는 근육량이 많은 운동선수나 노인의 근감소증 상태에서는 실제 체지방률을 정확히 반영하지 못할 수 있으므로, 허리둘레와 체성분 검사를 함께 참조합니다.',
    disclaimer: '대한비만학회 및 WHO 기준 일반 해설입니다.',
    suggestedQuestions: [
      'BMI 수치와 허리둘레를 고려했을 때 대사증후군 위험이 있나요?',
      '체중 감량을 위해 권장되는 주당 감량 목표는 어느 정도인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-bmi',
        title: '비만 선별검사 (Obesity Screening)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/obesity-screening/',
        section: 'BMI 지표'
      }
    ]
  },
  {
    id: 'pulmonary-function',
    name: '폐기능검사 (Pulmonary Function Test)',
    category: '호흡기 정밀검사',
    termPattern: /^(?:폐기능|폐활량|\bfev1\b|\bfvc\b)/iu,
    definition: '폐활량계를 이용하여 최대로 들이마신 후 세게 뿜어내는 공기량(FVC, 노력성 폐활량)과 첫 1초간 내쉬는 공기량(FEV1, 1초간 노력성 호기량)을 측정하여 만성폐쇄성폐질환(COPD)이나 천식 등 기도 폐쇄 질환을 선별하는 검사입니다.',
    normalContext: '연령, 성별, 신장에 따른 정상 예측치 대비 80% 이상을 유지하는지, 1초율(FEV1/FVC)이 70% 이상인지를 확인합니다.',
    caution: '⚠️ 검사자의 호흡 노력에 따라 결과가 크게 달라질 수 있으므로 최대 노력으로 강하게 불어내야 정확합니다. 흡연자는 검사 전 금연이 권고됩니다.',
    disclaimer: '대한결핵및호흡기학회 및 MedlinePlus 기준 일반 정보입니다.',
    suggestedQuestions: [
      '폐활량 감소 소견이 있을 때 흉부 CT나 기관지 검사가 추가로 필요한가요?',
      '기침이나 호흡곤란 증상이 없을 때도 정기적인 폐기능 추적이 필요한가요?'
    ],
    sources: [
      {
        id: 'medlineplus-lung-function',
        title: '폐기능검사 (Lung Function Tests)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/lung-function-tests/',
        section: '호흡기 기능 평가'
      }
    ]
  },
  {
    id: 'chest-xray',
    name: '흉부 방사선검사 (Chest X-ray)',
    category: '의료영상 검사',
    termPattern: /^(?:흉부\s*(?:x[- ]?ray|방사선|단순\s*촬영|선)|엑스레이)/iu,
    definition: '가슴 부위에 소량의 X선을 투과시켜 폐렴, 결핵, 기흉, 심장 비대 등 호흡기 및 순환기계의 기본적 이상 소견을 신속하게 확인하는 가장 보편적인 1차 영상 선별검사입니다.',
    normalContext: '폐야(폐 영역)의 음영 깨끗함, 심장 크기 비율(심흉비 50% 미만), 늑골 구조를 확인합니다.',
    caution: '⚠️ 1차 선별검사이므로 수 밀리미터 단위의 미세한 조기 폐암이나 종격동의 작은 결절은 늑골이나 심장 음영에 가려 관찰하기 어려울 수 있으며, 이상 소견 발견 시 흉부 CT 정밀검사를 권고합니다.',
    disclaimer: '영상의학 기본 지침에 따른 일반 해설입니다.',
    suggestedQuestions: [
      '흉부 X-ray에서 관찰된 음영 변화가 있을 때 CT 검사를 받아야 하나요?'
    ],
    sources: [
      {
        id: 'medlineplus-chest-xray',
        title: '흉부 방사선검사 (Chest X-ray)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/sonogram/',
        section: '흉부 기본 선별'
      }
    ]
  },
  {
    id: 'hepatitis-testing',
    name: 'B형 · C형 간염 검사 (Hepatitis Testing)',
    category: '간기능 혈액검사',
    termPattern: /^(?:[bc]형\s*간염|\bhbsag\b|\bhbsab\b|\bhcv\b)/iu,
    definition: 'B형 및 C형 간염 바이러스 감염 유무(항원/항체)를 선별하는 혈청 검사입니다. B형간염 표면항원(HBsAg)은 감염 여부를, 표면항체(HBsAb)는 면역력(예방접종 효과)을 나타내며, C형간염 항체(HCV Ab)는 C형 바이러스 노출 여부를 판별합니다.',
    normalContext: 'HBsAg 음성 및 HBsAb 양성(항체 형성 완료) 상태가 이상적입니다.',
    caution: '⚠️ 만성 B형 또는 C형 간염 보균자는 간경변증 및 간암의 주요 고위험군이므로, 6개월 주기로 간 초음파와 혈청 AFP 검사를 정기적으로 시행하는 감시 검사가 필수적입니다.',
    disclaimer: '질병관리청 간염 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      'B형간염 항체가 없는 경우 성인 예방접종 일정은 어떻게 되나요?',
      '간염 보균자일 경우 6개월 주기 간 초음파와 AFP 정기검사를 어떻게 예약하나요?'
    ],
    sources: [
      {
        id: 'medlineplus-hepatitis',
        title: '간염 검사 (Hepatitis Testing)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/hepatitis-testing/',
        section: '바이러스 항원/항체'
      }
    ]
  }
]);

// Check if question is asking for an unsafe personal medical diagnosis
export function isClinicalDiagnosisRequest(question) {
  if (typeof question !== 'string') return false;
  // Patterns asking for diagnosis, staging, medication, prescription, or cancer confirmation
  return /(?:암인가|암이야|암인지|암.*(?:맞|아니|확정|진단|판별)|진단해|확진|몇기|말기|생존율|죽나요|치료법|처방|복용|약.*추천)/u.test(question);
}

// Match user question against the health screening glossary
export function matchScreeningGlossary(question) {
  if (typeof question !== 'string') return null;
  const q = question.trim();
  if (!q || q.length > 300) return null;

  // Safety Gate: Do not intercept clinical diagnosis queries!
  if (isClinicalDiagnosisRequest(q)) return null;

  for (const item of HEALTH_SCREENING_GLOSSARY) {
    if (matchGlossaryTerm(item.termPattern, q)) {
      // Build rich, structured patient answer
      const answer = `${item.name} 안내

■ 검사 개요 및 목적:
${item.definition}

■ 일반적 참고 기준:
${item.normalContext}

${item.caution}

📌 ${item.disclaimer}`;

      return {
        matched: true,
        item,
        response: {
          status: 'RETRIEVED',
          answer,
          questions: item.suggestedQuestions,
          sources: item.sources,
          generationUsed: false,
          glossaryMatched: true,
          category: item.category,
          recordContext: 'NOT_CONNECTED'
        }
      };
    }
  }

  return null;
}
