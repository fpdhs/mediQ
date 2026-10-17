// Medical Screening & Major Disease Glossary Interceptor for Health Helper
// Provides instant, verified, patient-friendly definitions for:
// - Standard Health Checkup Tests (AFP, Liver Ultrasound, Chest CT, AST, ALT, GGT, Blood Glucose, HbA1c, Lipids, etc.)
// - Major Clinical Diseases (6 Major Cancers, Cardio/Cerebrovascular, Metabolic, Gastrointestinal, Respiratory, Kidney, Degenerative)
// Adheres strictly to non-diagnostic medical law (의료법 제27조 무면허 의료행위 / 진단 오인 금지)

export const GLOSSARY_QUERY_SUFFIX = /^\s*(?:(?:은|는|이|가|의|이란|란|뜻|정의|검사|검사란|검사는|검사가|수치|목적|준비|이해|측정|측정법|질환|질병|증상)\s*)*(?:가\s*뭐야|가\s*뭔가요|는\s*뭐야|는\s*뭔가요|란\s*뭐야|란\s*뭔가요|이\s*뭐야|이\s*뭔가요|이란\s*무엇인가요|란\s*무엇인가요|에\s*대해(?:서)?\s*(?:알려달라|알려줘|알려주세요|설명해줘|설명해주세요)|알려줘|알려주세요|설명해줘|설명해주세요)?(?:\s*[?？.!]*)$/iu;

export function matchGlossaryTerm(termRegex, text) {
  if (typeof text !== 'string') return false;
  const trimmed = text.trim();
  const m = trimmed.match(termRegex);
  if (!m) return false;
  const rest = trimmed.slice(m[0].length);
  return GLOSSARY_QUERY_SUFFIX.test(rest);
}

// Acute emergency symptoms triage check
export function isEmergencyRequest(question) {
  if (typeof question !== 'string') return false;
  return /(?:가슴.*(?:쥐어짜|통증|아파|압박|조여)|흉통|숨.*(?:차|안\s*쉬|가빠|못\s*쉬)|호흡\s*곤란|한쪽.*마비|말.*어눌|입.*돌아|의식.*(?:잃|흐려|소실)|실신|쓰러|토혈|피.*토|대량.*출혈)/u.test(question);
}

// Check if question is asking for an unsafe personal medical diagnosis
export function isClinicalDiagnosisRequest(question) {
  if (typeof question !== 'string') return false;
  return /(?:암인가|암이야|암인지|암.*(?:맞|아니|확정|진단|판별)|진단해|확진|몇\s*기|말기|생존율|죽나요|치료법|치료제|완치|처방|복용|먹어야|먹는.*약|약(?:[은는이가을를도과와에]|이나|으로)?(?![가-힣])|약물|약.*추천)/u.test(question);
}

export const HEALTH_SCREENING_GLOSSARY = Object.freeze([
  // ==========================================
  // [1] 주요 6대 암 (Major 6 Cancers)
  // ==========================================
  {
    id: 'liver-cancer',
    name: '간암 (간세포암, Hepatocellular Carcinoma)',
    category: '주요 암 질환',
    termPattern: /^(?:간\s*암|간\s*세포\s*암|\bhcc\b|간\s*종양)/iu,
    definition: '간을 이루는 간세포에서 일차적으로 발생하는 악성 종양입니다. 전체 간암의 90% 이상이 간세포암에 해당하며, 대부분 만성 B형·C형 간염이나 간경변증 등 만성 간 질환 고위험군에서 발생합니다.',
    normalContext: '간은 ‘침묵의 장기’로 초기 증상이 거의 없어 조기 발견을 위한 6개월 주기 감시검사(혈청 AFP + 간 초음파)가 핵심입니다. 진행 시 우상복부 통증, 체중 감소, 황달 등이 나타납니다.',
    caution: '⚠️ 간 초음파에서 결절(혹)이나 이상 소견 발견 시, 종양의 성상과 병기 판정을 위해 다단계 조영 증강 CT나 간 정밀 MRI 검사를 즉시 시행해야 합니다. MediQ를 통해 기존 DICOM 원본 영상을 안전하게 공유하면 중복 촬영을 방지할 수 있습니다.',
    disclaimer: '본 정보는 국립암정보센터 및 대한간암학회 가이드라인 기반의 비임상 일반 암 정보이며 개인의 암 확진을 대신할 수 없습니다.',
    suggestedQuestions: [
      '간암 조기 선별을 위해 혈청 AFP와 간 초음파 외에 조영 증강 CT가 필요한 상황인가요?',
      '만성 간 질환이 있는 경우 권장되는 간암 감시검사 주기와 추적 방법은 무엇인가요?',
      '의심 병변이 발견되었을 때 상급병원 전원 및 DICOM 영상 공유 절차는 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'cancer-info-liver',
        title: '간암 (간세포암) 개요',
        institution: '국립암정보센터 · 보건복지부',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=3333',
        section: '간암 개요 및 조기검진'
      }
    ]
  },
  {
    id: 'gastric-cancer',
    name: '위암 (위 선암, Gastric Cancer)',
    category: '주요 암 질환',
    termPattern: /^(?:위\s*암|위\s*선암|\bgastric\s*cancer\b|\bstomach\s*cancer\b)/iu,
    definition: '위 점막 상피세포에서 발생하는 악성 종양으로 한국인에게 가장 흔한 암 중 하나입니다. 헬리코박터 파일로리균 감염, 짠 음식, 탄 음식 섭취, 흡연, 가족력 등이 주요 위험 인자입니다.',
    normalContext: '조기 위암은 80% 이상에서 특별한 증상이 없으므로, 40세 이상 성인은 2년 주기 국가 위내시경 검사가 필수입니다. 진행 시 상복부 통증, 소화불량, 구토, 흑색변, 체중 감소가 나타납니다.',
    caution: '⚠️ 조기 위암 단계에서 발견되면 개복 없이 내시경 점막하 박리술(ESD)로 90% 이상 완치가 가능하므로 정기 위내시경 선별검사가 가장 중요합니다.',
    disclaimer: '국립암정보센터 위암 진료권고안 기준 비임상 일반 정보입니다.',
    suggestedQuestions: [
      '위내시경 검사에서 발견된 병변의 형태와 조직검사 결과는 어떤가요?',
      '헬리코박터 파일로리균 감염 여부와 제균 치료 필요성은 어떻게 되나요?',
      '조기 위암과 진행성 위암의 내시경 시술 및 수술적 치료 기준은 무엇인가요?'
    ],
    sources: [
      {
        id: 'cancer-info-gastric',
        title: '위암 개요 및 검진 가이드',
        institution: '국립암정보센터 · 대한위암학회',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=4637',
        section: '위암 발생과 예방'
      }
    ]
  },
  {
    id: 'colorectal-cancer',
    name: '대장암 (결장직장암, Colorectal Cancer)',
    category: '주요 암 질환',
    termPattern: /^(?:대장\s*암|결장\s*암|직장\s*암|\bcolorectal\s*cancer\b)/iu,
    definition: '대장(결장 및 직장)의 점막 상피에서 발생하는 악성 종양입니다. 대부분 대장의 양성 용종(선종성 용종)에서 시작하여 수년에 걸쳐 악성 종양으로 서서히 진행합니다.',
    normalContext: '초기에는 증상이 거의 없으며 진행 시 배변 습관 변화(변비 또는 설사), 혈변, 점액변, 잔변감, 체중 감소, 빈혈 등이 나타납니다. 50세 이상은 매년 분변잠혈검사가 국가검진으로 제공됩니다.',
    caution: '⚠️ 대장내시경 검사 중 발견된 선종성 용종을 절제하면 대장암 발생을 70~90% 예방할 수 있으므로, 분변잠혈 양성 시 또는 고위험군은 반드시 대장내시경을 받아야 합니다.',
    disclaimer: '국립암정보센터 대장암 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '대장내시경 시 제거된 용종의 조직검사 소견과 악성 위험도는 어떤가요?',
      '다음 대장내시경 추적 검사 권장 주기는 어떻게 되나요?',
      '분변잠혈검사 반응과 대장내시경 정밀검사 연계 절차는 무엇인가요?'
    ],
    sources: [
      {
        id: 'cancer-info-colorectal',
        title: '대장암 개요 및 대장내시경 선별',
        institution: '국립암정보센터 · 대한대장항문학회',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=3797',
        section: '대장암 예방과 조기발견'
      }
    ]
  },
  {
    id: 'lung-cancer',
    name: '폐암 (Lung Cancer)',
    category: '주요 암 질환',
    termPattern: /^(?:폐\s*암|\blung\s*cancer\b|폐\s*악성종양)/iu,
    definition: '폐의 기관지나 폐포 상피세포에서 기원하는 악성 종양입니다. 비소세포폐암(선암, 편평상피세포암 등)과 소세포폐암으로 구분되며, 흡연이 주요 원인이나 비흡연자 선암 발생도 흔합니다.',
    normalContext: '초기 증상이 거의 없으며 기침, 객혈, 흉통, 호흡곤란 등이 나타날 때는 이미 진행된 경우가 많습니다. 54~74세 고위험 흡연자는 국가 암 검진으로 저선량 흉부 CT가 지원됩니다.',
    caution: '⚠️ 단순 흉부 X-ray는 갈비뼈나 심장 뒤편의 미세 결절을 감별하기 어려우므로, 고위험군이나 의심 병변 발견 시 저선량 흉부 CT 검사를 권고합니다.',
    disclaimer: '국립암정보센터 및 대한폐암학회 권고안 기준 일반 정보입니다.',
    suggestedQuestions: [
      '흉부 CT에서 발견된 폐 결절의 크기와 성상(간유리 음영 vs 고형 결절)은 어떤가요?',
      '폐 결절의 악성 의심 여부와 추적 CT 검사 주기는 어떻게 되나요?',
      '비흡연자 폐암 선별과 조기 진단을 위한 권장 검진 방법은 무엇인가요?'
    ],
    sources: [
      {
        id: 'cancer-info-lung',
        title: '폐암 및 저선량 흉부 CT 선별검사',
        institution: '국립암정보센터 · 질병관리청',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=5237',
        section: '폐암 개요'
      }
    ]
  },
  {
    id: 'breast-cancer',
    name: '유방암 (Breast Cancer)',
    category: '주요 암 질환',
    termPattern: /^(?:유방\s*암|\bbreast\s*cancer\b)/iu,
    definition: '유방 조직의 유관이나 소엽 상피세포에서 발생하는 악성 종양입니다. 여성 호르몬 노출 기간(이른 초경, 늦은 폐경), 유전적 요인(BRCA 변이), 고지방 식습관, 비만 등이 주요 위험 요인입니다.',
    normalContext: '통증 없는 멍울(종괴), 유두 분비물(혈성), 피부 함몰 등이 주 증상이며, 40세 이상 여성은 2년마다 국가 유방촬영술(Mammography)이 권고됩니다.',
    caution: '⚠️ 한국 여성은 유선 조직이 치밀한 ‘치밀유방’ 비율이 높아 유방촬영술만으로는 병변이 가려질 수 있으므로, 의사 판단에 따라 유방 초음파 검사를 병행해야 조기 발견율을 높일 수 있습니다.',
    disclaimer: '국립암정보센터 및 한국유방암학회 진료 권고안 기준 일반 정보입니다.',
    suggestedQuestions: [
      '치밀유방 소견이 있는 경우 유방 초음파 검사를 함께 시행해야 하나요?',
      '유방촬영술에서 미세석회화가 관찰되었을 때 정밀검사(확대촬영 또는 조직검사)가 필요한가요?',
      '가족력이 있는 경우 권장되는 조기 선별검사 시작 시점은 언제인가요?'
    ],
    sources: [
      {
        id: 'cancer-info-breast',
        title: '유방암 개요 및 선별검사 가이드',
        institution: '국립암정보센터 · 한국유방암학회',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=4757',
        section: '유방암 진단과 검진'
      }
    ]
  },
  {
    id: 'cervical-cancer',
    name: '자궁경부암 (Cervical Cancer)',
    category: '주요 암 질환',
    termPattern: /^(?:자궁\s*경부\s*암|\bcervical\s*cancer\b)/iu,
    definition: '자궁의 입구인 자궁경부에 발생하는 악성 종양입니다. 사람유두종바이러스(HPV)의 지속적인 고위험군 감염이 주원인이며, 예방접종과 정기 검진으로 예방이 가능한 대표적인 암입니다.',
    normalContext: '20세 이상 여성은 2년마다 국가 자궁경부 세포도말검사(Pap smear)를 무료로 받을 수 있으며, 초기에는 무증상이나 진행 시 비정상 질 출혈과 분비물이 나타납니다.',
    caution: '⚠️ 정기적인 자궁경부 세포검사와 함께 HPV 예방접종(가다실 등)을 완료하는 것이 침윤성 암 발생을 예방하는 가장 확실한 방법입니다.',
    disclaimer: '국립암정보센터 자궁경부암 검진 가이드라인 기준 일반 정보입니다.',
    suggestedQuestions: [
      '자궁경부 세포검사 결과 이형성증(ASCUS/LSIL/HSIL)이 있을 때 추가 검사는 무엇인가요?',
      'HPV DNA 유전자 검사를 병행해야 하는 상황인가요?',
      '성인 이후라도 지금 HPV 백신을 접종하는 것이 예방에 도움이 되나요?'
    ],
    sources: [
      {
        id: 'cancer-info-cervical',
        title: '자궁경부암 및 HPV 예방 가이드',
        institution: '국립암정보센터 · 질병관리청',
        url: 'https://www.cancer.go.kr/lay1/program/S1T211C223/cancer/view.do?cancer_seq=4877',
        section: '자궁경부암 예방'
      }
    ]
  },

  // ==========================================
  // [2] 심뇌혈관 질환 (Cardio & Cerebrovascular)
  // ==========================================
  {
    id: 'hypertension',
    name: '고혈압 (Hypertension)',
    category: '심뇌혈관 질환',
    termPattern: /^(?:고\s*혈압|\bhypertension\b)/iu,
    definition: '수축기 혈압 140 mmHg 이상 또는 이완기 혈압 90 mmHg 이상이 지속되는 만성 혈관 질환입니다. 뚜렷한 원인 질환 없이 발생하는 본태성 고혈압이 대부분을 차지합니다.',
    normalContext: '초기 자각 증상이 거의 없어 ‘침묵의 살인자’라 불리며, 장기간 방치 시 뇌졸중, 심근경색, 만성 콩팥병 등 치명적인 심뇌혈관 합병증을 유발합니다.',
    caution: '⚠️ 병원 측정 시 일시적 긴장(백의고혈압)이 있을 수 있으므로, 가정에서 아침·저녁 올바른 자세로 측정한 혈압 기록을 주치의에게 제시하는 것이 정확한 진단과 약물 조절의 기본입니다.',
    disclaimer: '질병관리청 및 대한고혈압학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '현재 혈압 수치 기준으로 생활습관 개선(저염식, 체중감량)만으로 조절 가능한가요?',
      '가정 혈압 측정 시 올바른 시간대와 기록 방법은 어떻게 되나요?',
      '고혈압으로 인한 심장, 콩팥, 망막 손상 여부를 확인하기 위한 기본 검사는 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-hypertension',
        title: '고혈압 진단 및 관리 가이드',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5212',
        section: '고혈압 개요'
      }
    ]
  },
  {
    id: 'angina',
    name: '협심증 (Angina Pectoris)',
    category: '심뇌혈관 질환',
    termPattern: /^(?:협\s*심증|\bangina\b)/iu,
    definition: '심장 근육에 산소를 공급하는 관상동맥이 동맥경화 등으로 좁아져, 운동이나 스트레스 시 일시적으로 심장 근육에 혈류 공급이 부족해져 가슴 통증(흉통)이 발생하는 질환입니다.',
    normalContext: '빨리 걷거나 계단을 오를 때 가슴 중앙이 쥐어짜듯 뻐근하고 답답한 통증이 3~5분 정도 지속되다가 휴식을 취하면 호전되는 양상을 보입니다.',
    caution: '⚠️ 안정 시에도 통증이 발생하거나(불안정형 협심증), 통증 지속 시간이 20분 이상으로 길어지면 급성 심근경색으로의 진행 신호이므로 즉시 응급실로 가야 합니다.',
    disclaimer: '질병관리청 및 대한심장학회 진료 가이드라인 기준 일반 정보입니다.',
    suggestedQuestions: [
      '협심증 감별을 위해 심전도, 운동부하검사 또는 관상동맥 CT 중 어떤 검사가 필요한가요?',
      '안정형 협심증과 급성 심근경색을 구분하는 핵심 증상 차이는 무엇인가요?',
      '비상 시 복용하는 니트로글리세린 설하정 사용법과 보관 주의사항은 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-angina',
        title: '협심증의 증상과 검사',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5216',
        section: '협심증 개요'
      }
    ]
  },
  {
    id: 'myocardial-infarction',
    name: '급성 심근경색증 (Myocardial Infarction)',
    category: '심뇌혈관 질환',
    termPattern: /^(?:심\s*근\s*경색(?:증)?|\bmyocardial\s*infarction\b|\bmi\b|심장\s*마비)/iu,
    definition: '관상동맥에 혈전이 생겨 혈관이 완전히 막힘으로써 심장 근육 세포가 괴사하는 치명적인 초응급 심장 질환입니다.',
    normalContext: '짓누르거나 쥐어짜는 듯한 극심한 흉통이 30분 이상 지속되며 좌측 어깨, 턱, 팔로 방사통이 퍼지고 식은땀, 호흡곤란, 구토가 동반됩니다.',
    caution: '🚨 초응급 골든타임 질환: 증상 발현 후 최소 2시간(최대 12시간) 이내에 막힌 혈관을 개통하는 응급 스텐트 삽입술을 받아야 생명을 지킬 수 있습니다. 자가운전하지 말고 즉시 119를 불러야 합니다.',
    disclaimer: '중앙응급의료센터 및 대한심장학회 응급 가이드라인 기준 정보입니다.',
    suggestedQuestions: [
      '심근경색 의심 흉통 시 자가운전을 하지 않고 즉시 119 구급대를 불러야 하는 이유는 무엇인가요?',
      '심근경색 시술 후 재발 방지를 위한 항혈소판제 복용과 생활수칙은 어떻게 되나요?',
      '관상동맥 질환 위험인자(고혈압, 당뇨, 고지혈증, 흡연)의 목표 수치는 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-mi',
        title: '급성 심근경색증 골든타임 대처',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5218',
        section: '심근경색 개요'
      }
    ]
  },
  {
    id: 'cerebral-infarction',
    name: '뇌경색 (허혈성 뇌졸중, Cerebral Infarction)',
    category: '심뇌혈관 질환',
    termPattern: /^(?:뇌\s*경색|허혈성\s*뇌졸중|\bcerebral\s*infarction\b|중\s*풍)/iu,
    definition: '뇌혈관이 혈전 등으로 막혀 뇌 조직에 산소 공급이 중단되고 뇌세포가 괴사하는 질환으로, 전체 뇌졸중의 약 80% 이상을 차지합니다.',
    normalContext: '이웃손발 원칙(이-웃고 안면마비, 손-들고 편측마비, 발-말하기 어눌함)에 따른 갑작스러운 신경학적 증상이 대표적입니다.',
    caution: '🚨 초응급 질환: 증상 발생 후 4.5시간 이내 혈전용해제 투여 및 6~24시간 이내 혈관 내 혈전제거술이 시행되어야 영구적 뇌 손상을 막을 수 있습니다. 즉시 119로 신고해야 합니다.',
    disclaimer: '대한뇌졸중학회 뇌졸중 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '뇌경색 골든타임(4.5시간) 내 혈전용해 치료를 위한 필수 확인 사항은 무엇인가요?',
      '뇌경색 재발 방지를 위한 항혈전제(아스피린 등) 복용 시 주의점은 무엇인가요?',
      '경동맥 초음파 및 뇌 MRA 검사를 통해 뇌혈관 협착을 평가해야 하나요?'
    ],
    sources: [
      {
        id: 'kdca-stroke-infarction',
        title: '뇌경색 (허혈성 뇌졸중) 응급 대처',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5201',
        section: '뇌졸중 개요'
      }
    ]
  },
  {
    id: 'cerebral-hemorrhage',
    name: '뇌출혈 (출혈성 뇌졸중, Cerebral Hemorrhage)',
    category: '심뇌혈관 질환',
    termPattern: /^(?:뇌\s*출혈|출혈성\s*뇌졸중|\bcerebral\s*hemorrhage\b)/iu,
    definition: '뇌혈관의 파열로 인해 뇌 실질 내부(뇌내출혈) 또는 지주막하 공간(지주막하출혈)으로 혈액이 유출되어 뇌세포를 압박하고 손상시키는 급성 응급 질환입니다.',
    normalContext: '고혈압성 혈관 손상과 뇌동맥류 파열이 주원인입니다. 머리를 둔기로 맞은 듯한 극심한 두통, 구토, 의식 저하, 편마비가 급격히 발생합니다.',
    caution: '🚨 급격한 뇌압 상승으로 사망에 이를 수 있는 초응급 질환입니다. 뇌 CT 촬영과 함께 혈압 조절 및 응급 수술적 혈종 제거가 요구되므로 즉시 119 구급대를 호출해야 합니다.',
    disclaimer: '질병관리청 및 대한신경외과학회 기준 정보입니다.',
    suggestedQuestions: [
      '뇌동맥류 파열 위험도를 평가하기 위해 뇌혈관 MRA 검사가 필요한가요?',
      '뇌출혈 환자의 혈압 관리 목표와 재출혈 방지 수칙은 무엇인가요?',
      '뇌 CT 영상에서 확인된 출혈 부위와 수술적 치료 적응증은 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-stroke-hemorrhage',
        title: '뇌출혈 (출혈성 뇌졸중) 개요',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5203',
        section: '뇌출혈 개요'
      }
    ]
  },

  // ==========================================
  // [3] 대사 및 내분비 질환 (Metabolic & Endocrine)
  // ==========================================
  {
    id: 'diabetes',
    name: '당뇨병 (Diabetes Mellitus)',
    category: '대사 및 내분비 질환',
    termPattern: /^(?:당\s*뇨(?:병)?|\bdiabetes\b)/iu,
    definition: '췌장에서 인슐린 분비가 부족하거나 인슐린 저항성으로 인해 혈액 속 포도당이 세포로 흡수되지 못하고 만성적으로 혈당이 높아지는 대사 질환입니다.',
    normalContext: '공복혈당 126 mg/dL 이상 또는 당화혈색소 6.5% 이상일 때 진단됩니다. 초기 무증상이나 진행 시 다음, 다뇨, 다식, 체중 감소가 나타납니다.',
    caution: '⚠️ 만성 고혈당은 망막병증(실명), 신증(투석), 신경병증(족부 절단), 심근경색 등 치명적 합병증을 유발하므로 혈당·혈압·지질의 삼중 조절과 정기 합병증 검사가 필수입니다.',
    disclaimer: '질병관리청 및 대한당뇨병학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '당화혈색소(HbA1c) 목표 관리 수치를 몇 % 이하로 유지해야 하나요?',
      '당뇨병 합병증 선별을 위한 연 1회 정기 검사(안저, 미세단백뇨, 발 검진) 일정은 어떻게 되나요?',
      '식후 혈당 스파이크를 줄이기 위한 올바른 식사 순서와 운동 요령은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-diabetes',
        title: '당뇨병 진단 및 관리 가이드',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5220',
        section: '당뇨병 개요'
      }
    ]
  },
  {
    id: 'dyslipidemia',
    name: '이상지질혈증 (고지혈증, Dyslipidemia)',
    category: '대사 및 내분비 질환',
    termPattern: /^(?:이상\s*지질\s*혈증|고\s*지혈증|고\s*콜레스테롤\s*혈증|\bdyslipidemia\b)/iu,
    definition: '혈액 내 총콜레스테롤, 나쁜 콜레스테롤(LDL), 중성지방이 높거나 좋은 콜레스테롤(HDL)이 낮은 상태로, 혈관벽에 플라크가 쌓여 동맥경화를 일으키는 핵심 위험인자입니다.',
    normalContext: '국가건강검진 지질패널 검사로 확인되며 증상이 전혀 없으므로 혈액검사 수치를 주기적으로 관리해야 합니다.',
    caution: '⚠️ 개인의 심혈관 질환 위험도(고혈압, 당뇨, 흡연 등)에 따라 목표 LDL 수치가 70 mg/dL 이하까지 엄격히 권고되므로, 의사 처방에 따른 스타틴 복용을 임의 중단하면 안 됩니다.',
    disclaimer: '한국지질동맥경화학회 이상지질혈증 진료지침 기준 정보입니다.',
    suggestedQuestions: [
      '제 심혈관 위험도에 따른 목표 LDL 콜레스테롤 수치는 얼마인가요?',
      '중성지방을 낮추기 위해 알코올과 단순 당류를 얼마나 줄여야 하나요?',
      '지질강하제(스타틴) 복용 시 주의해야 할 부작용과 간기능 모니터링 방법은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-dyslipidemia',
        title: '이상지질혈증 관리 가이드',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5224',
        section: '고지혈증 개요'
      }
    ]
  },
  {
    id: 'metabolic-syndrome',
    name: '대사증후군 (Metabolic Syndrome)',
    category: '대사 및 내분비 질환',
    termPattern: /^(?:대사\s*증후군|\bmetabolic\s*syndrome\b)/iu,
    definition: '복부비만, 혈압 상승, 공복혈당 상승, 고중성지방, 낮은 HDL 등 심뇌혈관 질환의 5대 위험 요인 중 3가지 이상이 동시에 나타나는 만성 상태입니다.',
    normalContext: '인슐린 저항성이 주원인이며 방치 시 제2형 당뇨병 발생 위험이 5배, 심혈관 질환 위험이 2배 이상 증가합니다.',
    caution: '⚠️ 복부 허리둘레 감소(남성 90cm, 여성 85cm 미만)와 주 150분 이상의 유산소 운동이 질환 악화를 막는 가장 강력한 치료법입니다.',
    disclaimer: '질병관리청 및 대한비만학회 가이드라인 기준 일반 정보입니다.',
    suggestedQuestions: [
      '건강검진 결과에서 대사증후군 해당 항목이 몇 개인지 어떻게 확인하나요?',
      '대사증후군 개선을 위한 권장 체중 감량 목표(초기 5~10%)는 얼마인가요?',
      '동맥경화 조기 평가를 위한 경동맥 초음파 검사가 필요한가요?'
    ],
    sources: [
      {
        id: 'kdca-metabolic',
        title: '대사증후군 진단과 예방',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5227',
        section: '대사증후군 개요'
      }
    ]
  },
  {
    id: 'gout',
    name: '통풍 (Gout)',
    category: '대사 및 내분비 질환',
    termPattern: /^(?:통\s*풍|\bgout\b|고요산혈증)/iu,
    definition: '혈액 내 요산(Uric acid) 농도가 높아지면서 요산염 결정이 관절 연골과 주위 조직에 쌓여 극심한 염증성 통증(발작)을 유발하는 대사성 관절염입니다.',
    normalContext: '한밤중에 엄지발가락 관절이 붉게 붓고 스치기만 해도 극심한 통증이 발생하는 것이 전형적인 증상입니다.',
    caution: '⚠️ 통증이 가라앉았다고 요산저하제 복용을 중단하면 만성 통풍 결절 및 신장 손상으로 이어집니다. 혈중 요산을 6.0 mg/dL 이하로 유지하고 맥주, 고퓨린 육류, 액상과당을 피해야 합니다.',
    disclaimer: '대한류마티스학회 통풍 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '혈중 요산 목표 수치를 몇 mg/dL 이하로 유지해야 하나요?',
      '급성 발작 완화제와 만성 요산저하제의 복용 차이는 무엇인가요?',
      '맥주 외에 통풍 환자가 피해야 할 음식과 권장 수분 섭취량은 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-gout',
        title: '통풍의 원인과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5230',
        section: '통풍 개요'
      }
    ]
  },
  {
    id: 'thyroid-disorders',
    name: '갑상선 질환 (기능항진증 / 저하증 / 결절)',
    category: '대사 및 내분비 질환',
    termPattern: /^(?:갑상선(?:\s*질환|\s*기능항진증|\s*기능저하증|\s*결절)?|\bthyroid\b)/iu,
    definition: '목 앞쪽 갑상선에서 분비되는 호르몬의 과다 분비(기능항진증)나 결핍(기능저하증), 또는 혹(갑상선 결절)으로 인해 전신 대사 기능에 이상이 생기는 질환군입니다.',
    normalContext: '항진증은 체중 감소, 두근거림, 더위 못 참음이 주 증상이며, 저하증은 피로, 체중 증가, 추위 못 참음, 부종이 특징입니다. 결절은 초음파 검사로 확인합니다.',
    caution: '⚠️ 갑상선 결절의 대다수는 양성이지만, 초음파상 악성 의심 소견이 있을 경우 미세침흡인세포검사(FNAC)를 통해 갑상선암 여부를 감별해야 합니다.',
    disclaimer: '질병관리청 및 대한갑상선학회 진료지침 기준 정보입니다.',
    suggestedQuestions: [
      '혈액검사상 TSH와 Free T4 수치 이상이 의미하는 바는 무엇인가요?',
      '갑상선 초음파에서 발견된 결절의 악성 위험도 분류(K-TIRADS)는 어떤가요?',
      '갑상선 호르몬제(씬지로이드 등) 복용 시 아침 공복 복용 원칙은 왜 중요한가요?'
    ],
    sources: [
      {
        id: 'kdca-thyroid',
        title: '갑상선 질환 및 호르몬 검사',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5234',
        section: '갑상선 개요'
      }
    ]
  },

  // ==========================================
  // [4] 간·담도·소화기 질환 (Gastrointestinal & Hepato-biliary)
  // ==========================================
  {
    id: 'cirrhosis',
    name: '간경변증 (간경화, Liver Cirrhosis)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:간\s*경변(?:증)?|간\s*경화|\bcirrhosis\b)/iu,
    definition: '‘간경화’의 표준 의학용어는 ‘간경변증’입니다. 만성 간염, 음주, 지방간 등으로 인해 정상 간 조직이 딱딱한 섬유화 조직으로 대체되어 간 기능이 저하되는 만성 질환입니다.',
    normalContext: '초기 무증상(보상성)이나 진행 시 황달, 복수, 하지 부종, 간성 혼수, 위식도 정맥류 출혈 등의 합병증(비보상성)이 발생합니다.',
    caution: '⚠️ 간경변증 환자는 간암 발생의 최고위험군이므로 6개월마다 혈청 AFP 검사와 간 초음파 감시검사를 반드시 받아야 합니다. 민간요법이나 한약 복용은 급성 간부전을 초래할 수 있으므로 피해야 합니다.',
    disclaimer: '질병관리청 국가건강정보포털 및 대한간학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '현재 제 간경변증 상태(보상성 vs 비보상성)와 간 기능 잔여 정도는 어떤가요?',
      '간암 조기 발견을 위한 6개월 주기 AFP 검사와 간 초음파 정기검사 일정은 어떻게 되나요?',
      '식단 관리(저염식, 단백질 섭취 등)와 일상생활에서 피해야 할 약물이나 식품이 있나요?'
    ],
    sources: [
      {
        id: 'kdca-cirrhosis-6560',
        title: '간경변증',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6560',
        section: '간경변증 개요'
      }
    ]
  },
  {
    id: 'fatty-liver',
    name: '지방간 (지방간질환, Fatty Liver Disease)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:지방\s*간(?:질환)?|지방\s*간염|\bnafld\b|\bmasld\b)/iu,
    definition: '간세포 내에 지방(주로 중성지방)이 간 무게의 5% 이상 과도하게 쌓이는 상태입니다. 음주가 원인인 알코올성과, 비만·당뇨·대사증후군과 연관된 대사이상 지방간질환(MASLD)으로 구분됩니다.',
    normalContext: '건강검진 복부 초음파 검사 중 간 실질이 하얗게(고에코) 관찰되어 흔히 발견되며 간 효소(AST, ALT, GGT) 수치가 동반 상승할 수 있습니다.',
    caution: '⚠️ 단순 지방간을 방치하여 간세포 괴사와 염증이 동반되는 ‘지방간염’으로 악화되면 간경변증 및 간암으로 진행할 수 있습니다. 체중 감량(5~10%)과 규칙적인 운동이 필수적입니다.',
    disclaimer: '질병관리청 및 대한간학회 지방간 진료지침 기준 정보입니다.',
    suggestedQuestions: [
      '초음파상 지방간 정도(경도/중등도/중증)와 간 기능 수치와의 연관성은 어떤가요?',
      '지방간 개선을 위해 권장되는 식단 조절과 목표 체중 감량치는 어느 정도인가요?',
      '지방간염이나 간 섬유화 여부를 확인하기 위해 추가 검사가 필요한가요?'
    ],
    sources: [
      {
        id: 'kdca-fatty-liver',
        title: '지방간의 진단과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5240',
        section: '지방간 개요'
      }
    ]
  },
  {
    id: 'chronic-hepatitis',
    name: '만성 간염 (Chronic Hepatitis)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:만성\s*간염|간염\s*질환)/iu,
    definition: '간의 염증과 간세포 파괴가 6개월 이상 지속되는 상태입니다. 주로 B형 및 C형 간염 바이러스 감염이 주원인이며, 간경변증과 간암으로 이어지는 선행 질환입니다.',
    normalContext: '혈액검사를 통해 간 효소 수치(AST, ALT)와 바이러스 항원/항체 및 DNA/RNA 정량검사를 시행하여 염증 활성도와 치료 필요성을 평가합니다.',
    caution: '⚠️ 자각 증상이 거의 없으므로 만성 B형·C형 간염 환자는 간암 예방을 위해 정기적인 항바이러스 치료와 6개월 주기 간 초음파 및 혈청 AFP 감시검사가 필수적입니다.',
    disclaimer: '대한간학회 만성 B형/C형 간염 진료 가이드라인 기준 정보입니다.',
    suggestedQuestions: [
      '현재 바이러스 증식 상태와 항바이러스제 치료 시작 기준에 해당하는가요?',
      '간경변증이나 간암 예방을 위한 정기 감시검사 주기는 어떻게 되나요?',
      '가족 내 전염 방지를 위한 항체 검사와 예방접종 권장 사항은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-hepatitis',
        title: '만성 간염 관리 가이드',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5242',
        section: '간염 개요'
      }
    ]
  },
  {
    id: 'gerd',
    name: '위식도역류질환 (역류성 식도염, GERD)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:위식도\s*역류(?:질환)?|역류성\s*식도염|\bgerd\b|위산\s*역류)/iu,
    definition: '위 내용물이나 위산이 식도로 역류하여 가슴쓰림, 산 역류 등 불편한 증상을 유발하거나 식도 점막에 손상을 일으키는 만성 소화기 질환입니다.',
    normalContext: '가슴 중앙이 타는 듯한 작열감, 목으로 신물이 넘어오는 느낌, 목의 이물감, 만성 기침 등이 대표적 증상입니다.',
    caution: '⚠️ 식후 즉시 눕는 습관, 과식, 야식, 기름진 음식, 카페인 등이 역류를 악화시킵니다. 장기간 방치 시 식도 궤양이나 바렛 식도(식도암 전구 병변)로 진행할 위험이 있습니다.',
    disclaimer: '대한소화기내시경학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '위식도역류질환 진단과 식도 점막 손상 평가를 위해 위내시경 검사가 필요한가요?',
      '위산분비억제제(PPI 또는 P-CAB) 복용 기간과 감량 요령은 어떻게 되나요?',
      '야간 역류를 줄이기 위한 수면 자세 및 취침 전 식사 권장 시간은 언제인가요?'
    ],
    sources: [
      {
        id: 'kdca-gerd',
        title: '위식도역류질환의 관리',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5246',
        section: '역류성 식도염 개요'
      }
    ]
  },
  {
    id: 'cholelithiasis',
    name: '담석증 (Gallstones / Cholelithiasis)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:담\s*석(?:증)?|쓸개\s*돌|\bcholelithiasis\b|\bgallstone\b)/iu,
    definition: '담낭(쓸개)이나 담관에서 담즙 구성 성분(콜레스테롤, 빌리루빈 등)이 응결되어 돌처럼 굳어지는 질환입니다.',
    normalContext: '대부분 증상이 없어 복부 초음파 검사 중 우연히 발견됩니다. 담석이 담낭관을 막으면 기름진 식사 후 우상복부나 명치에 극심한 담도산통이 발생합니다.',
    caution: '⚠️ 통증 발작이 반복되거나 급성 담낭염, 담관염, 췌장염 등 합병증이 동반되면 복강경 담낭절제술이 필요합니다. 무증상 담석은 정기 초음파 관찰이 기본입니다.',
    disclaimer: '질병관리청 및 대한소화기학회 기준 정보입니다.',
    suggestedQuestions: [
      '초음파에서 발견된 담석의 위치와 크기는 수술적 치료가 필요한 상태인가요?',
      '담석 발작 통증과 단순 소화불량을 구분하는 응급 신호는 무엇인가요?',
      '무증상 담석 환자의 정기 초음파 추적 관찰 주기는 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-gallstones',
        title: '담석증의 증상과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5248',
        section: '담석증 개요'
      }
    ]
  },
  {
    id: 'pancreatitis',
    name: '췌장염 (Pancreatitis)',
    category: '간·담도·소화기 질환',
    termPattern: /^(?:췌\s*장염|\bpancreatitis\b)/iu,
    definition: '소화효소와 인슐린을 분비하는 췌장에 염증이 생기는 질환입니다. 췌장 소화효소가 췌장 조직을 자가소화시켜 발생하며, 잦은 과음과 담석이 주원인입니다.',
    normalContext: '명치 부위에서 시작하여 등 뒤로 뻗치는 극심한 통증(누우면 악화되고 몸을 웅크리면 완화)과 구토가 특징입니다.',
    caution: '🚨 중증 급성 췌장염은 췌장 괴사와 다발성 장기부전으로 사망률이 높은 중증 질환입니다. 등까지 찌르는 극심한 복통 발생 시 즉시 응급실로 가야 합니다.',
    disclaimer: '질병관리청 및 대한췌장담도학회 가이드라인 기준 정보입니다.',
    suggestedQuestions: [
      '췌장염 진단을 위해 복부 조영 증강 CT 검사와 아밀라아제/리파아제 혈액검사가 필요한가요?',
      '췌장염 재발 방지를 위해 금주 외에 담석 제거 수술이 필요한 상황인가요?',
      '만성 췌장염으로 인한 소화불량 및 당뇨 발생 여부를 확인하기 위한 검사는 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-pancreatitis',
        title: '췌장염의 응급 대처와 관리',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5250',
        section: '췌장염 개요'
      }
    ]
  },

  // ==========================================
  // [5] 호흡기 질환 (Respiratory Diseases)
  // ==========================================
  {
    id: 'copd',
    name: '만성폐쇄성폐질환 (COPD)',
    category: '호흡기 질환',
    termPattern: /^(?:copd|만성\s*폐쇄성\s*폐질환|폐기종|만성\s*기관지염)/iu,
    definition: '흡연이나 유해 입자 노출로 기도와 폐포에 만성 염증이 생겨 비가역적인 기류 제한이 진행되어 숨이 차게 되는 만성 호흡기 질환입니다.',
    normalContext: '만성 기침, 가래, 운동 시 호흡곤란이 특징이며 폐기능검사(PFT)에서 1초율(FEV1/FVC)이 70% 미만일 때 확진됩니다.',
    caution: '⚠️ 손상된 폐포는 재생되지 않으므로 조기 폐기능검사를 통한 진단과 즉각적인 금연, 흡입용 기관지확장제 사용이 질환 진행을 늦추는 핵심입니다.',
    disclaimer: '대한결핵및호흡기학회 COPD 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '폐기능검사(PFT) 결과상 제 기류 폐쇄 병기(경증/중등증/중증)는 어떤가요?',
      '흡입제(인헬러) 올바른 흡입 기법과 규칙적 사용이 중요한 이유는 무엇인가요?',
      '급성 악화 방지를 위해 폐렴구균 및 인플루엔자 예방접종 일정이 필요한가요?'
    ],
    sources: [
      {
        id: 'kdca-copd',
        title: '만성폐쇄성폐질환 진단과 관리',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5254',
        section: 'COPD 개요'
      }
    ]
  },
  {
    id: 'asthma',
    name: '천식 (Asthma)',
    category: '호흡기 질환',
    termPattern: /^(?:천\s*식|\basthma\b)/iu,
    definition: '기도의 알레르기 염증 반응으로 기관지가 과민해져, 찬 공기나 알레르겐 노출 시 기관지가 좁아져 쌕쌕거림(천명), 호흡곤란, 발작적 기침이 반복되는 만성 질환입니다.',
    normalContext: '밤이나 이른 아침, 감기, 운동 후에 증상이 악화되는 가역적인 기도 폐쇄가 특징입니다.',
    caution: '⚠️ 증상이 가라앉았다고 질병 조절제(흡입 스테로이드)를 임의 중단하면 급성 천식 발작으로 응급 상황이 생길 수 있으므로 규칙적으로 투여해야 합니다.',
    disclaimer: '대한천식알레르기학회 가이드라인 기준 일반 정보입니다.',
    suggestedQuestions: [
      '매일 사용하는 흡입 스테로이드(조절제)와 응급 완화제의 구체적 사용법 차이는 무엇인가요?',
      '천식 유발 알레르겐을 확인하기 위한 알레르기 검사가 필요한가요?',
      '최대호기유속계(PEF)를 활용한 자가 천식 모니터링 방법은 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-asthma',
        title: '천식의 올바른 흡입기 사용과 관리',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5256',
        section: '천식 개요'
      }
    ]
  },
  {
    id: 'pneumonia',
    name: '폐렴 (Pneumonia)',
    category: '호흡기 질환',
    termPattern: /^(?:폐\s*렴|\bpneumonia\b)/iu,
    definition: '세균, 바이러스 등 미생물 감염으로 인해 말초 기관지와 폐포(공기주머니)에 염증이 생기고 삼출물이 차는 급성 호흡기 감염 질환입니다.',
    normalContext: '고열, 오한, 누런 화농성 가래를 동반한 기침, 흉통, 호흡곤란이 전형적이며 흉부 X-ray나 CT상 폐 침윤으로 진단합니다.',
    caution: '⚠️ 65세 이상 고령자나 만성 질환자는 열 없이 기력 저하나 의식 혼미로 나타나 패혈증으로 급격히 악화될 수 있으므로 조기 항생제 투여와 입원 평가가 중요합니다.',
    disclaimer: '질병관리청 및 대한감염학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '흉부 X-ray에서 폐렴 침윤 범위와 입원 치료 필요 여부는 어떻게 평가되나요?',
      '처방된 항생제 복용 기간과 증상 호전 여부를 확인하는 방법은 무엇인가요?',
      '고령자 및 만성질환자에게 권장되는 폐렴구균 예방접종 일정은 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'kdca-pneumonia',
        title: '폐렴의 조기 진단과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5258',
        section: '폐렴 개요'
      }
    ]
  },

  // ==========================================
  // [6] 신장 및 비뇨기 질환 (Kidney & Urology)
  // ==========================================
  {
    id: 'ckd',
    name: '만성콩팥병 (만성신부전, Chronic Kidney Disease / CKD)',
    category: '신장 및 비뇨기 질환',
    termPattern: /^(?:만성\s*콩팥병|만성\s*신부전|\bckd\b|콩팥병|신부전)/iu,
    definition: '신장의 손상이나 기능 저하가 3개월 이상 지속되는 상태입니다. 당뇨병과 고혈압이 전체 원인의 70% 이상을 차지합니다.',
    normalContext: '사구체여과율(eGFR)과 소변 알부민 배설량으로 병기(1~5기)를 평가합니다. 3기 이상 진행 시 부종, 피로, 빈혈이 나타납니다.',
    caution: '⚠️ 말기신부전으로 진행 시 투석이나 신장이식이 필요합니다. 소염진통제(NSAIDs) 남용이나 불필요한 CT 조영제 노출은 신기능을 급격히 악화시킬 수 있으므로 주의해야 합니다.',
    disclaimer: '대한신장학회 만성콩팥병 진료지침 기준 정보입니다.',
    suggestedQuestions: [
      '혈청 크레아티닌 및 사구체여과율(eGFR)에 따른 제 콩팥병 병기는 몇 기인가요?',
      '신기능 보호를 위한 저염식, 단백질 제한 식단과 수분 섭취 권장량은 어떻게 되나요?',
      '신장에 부담을 줄 수 있는 약물(진통제 등) 복용 시 주의사항은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-ckd',
        title: '만성콩팥병 관리 가이드',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5262',
        section: '만성신부전 개요'
      }
    ]
  },
  {
    id: 'proteinuria',
    name: '단백뇨 및 사구체신염 (Proteinuria & Glomerulonephritis)',
    category: '신장 및 비뇨기 질환',
    termPattern: /^(?:단백\s*뇨|사구체\s*신염|신증후군|소변\s*거품|\bproteinuria\b)/iu,
    definition: '혈액 노폐물을 걸러내는 신장 사구체의 여과막이 손상되어 체내 단백질이 소변으로 빠져나오는 질환군입니다.',
    normalContext: '소변에 거품이 많이 일고 쉽게 가라앉지 않는 증상이 나타나며 눈 주위와 다리 부종, 혈압 상승이 동반될 수 있습니다.',
    caution: '⚠️ 일시적 기립성 단백뇨일 수도 있으나, 지속적인 단백뇨(1일 500mg 이상)나 혈뇨 동반 시 IgA 신증 등 사구체 질환 감별을 위해 정밀검사가 필요합니다.',
    disclaimer: '질병관리청 및 대한신장학회 기준 정보입니다.',
    suggestedQuestions: [
      '요시험지봉 단백뇨 검사 이상 시 24시간 소변검사 또는 단백/크레아티닌 비율 검사가 필요한가요?',
      '단백뇨 감소와 콩팥 보호를 위한 혈압약(ARB/ACEI) 처방이 필요한 상태인가요?',
      '신장 조직검사가 필요한 기준은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-proteinuria',
        title: '단백뇨의 진단과 의의',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5264',
        section: '단백뇨 개요'
      }
    ]
  },
  {
    id: 'urolithiasis',
    name: '요로결석 (Urinary Calculi)',
    category: '신장 및 비뇨기 질환',
    termPattern: /^(?:요로\s*결석|신장\s*결석|요관\s*결석|\burolithiasis\b)/iu,
    definition: '소변이 흐르는 길(신장, 요관, 방광)에 소변 속 칼슘, 요산 등이 뭉쳐 돌이 생기는 질환입니다. 수분 섭취 부족이 주원인입니다.',
    normalContext: '결석이 좁은 요관을 막으면 옆구리에 칼로 찌르는 듯한 극심한 산통(간헐적 통증)과 혈뇨(피오줌)가 발생합니다.',
    caution: '⚠️ 결석 폐색이 지속되면 수신증 및 급성 신우신염, 신기능 손상을 유발합니다. 4mm 미만은 자연 배출을 유도하지만 크거나 통증이 심하면 체외충격파쇄석술(ESWL)이나 내시경 수술이 필요합니다.',
    disclaimer: '대한비뇨의학회 요로결석 진료지침 기준 정보입니다.',
    suggestedQuestions: [
      '비조영 복부 CT에서 확인된 결석의 크기와 위치는 자연 배출 가능한 범위인가요?',
      '체외충격파쇄석술(ESWL)과 내시경 수술 중 어떤 치료법이 권장되나요?',
      '결석 재발 방지를 위해 권장되는 하루 수분 섭취량(2L 이상)과 식이 수칙은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-urolithiasis',
        title: '요로결석의 증상과 쇄석술',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5266',
        section: '요로결석 개요'
      }
    ]
  },

  // ==========================================
  // [7] 근골격 및 신경·퇴행성 질환 (Degenerative & Neurological)
  // ==========================================
  {
    id: 'osteoporosis',
    name: '골다공증 (Osteoporosis)',
    category: '근골격 및 신경 질환',
    termPattern: /^(?:골\s*다공증|골\s*감소증|\bosteoporosis\b|골밀도)/iu,
    definition: '뼈의 양이 줄어들고 미세구조가 약화되어 작은 충격에도 쉽게 골절이 일어나는 전신 골격계 질환입니다. 폐경 후 여성과 노인에서 호발합니다.',
    normalContext: '골절 전까지 자각 증상이 없어 ‘조용한 뼈 도둑’이라 불립니다. 골밀도(DXA) 검사상 T-score -2.5 이하일 때 진단됩니다.',
    caution: '⚠️ 대퇴골(고관절)이나 척추 골절은 장기 침상 안정으로 인한 폐렴 등 치명적 합병증을 유발합니다. 낙상 방지와 골다공증 치료제(골흡수억제제 등) 복용이 필수적입니다.',
    disclaimer: '대한골대사학회 골다공증 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '골밀도(DXA) 검사 결과 T-score 수치와 골다공증 진단 기준은 어떤가요?',
      '골다공증 약물(비스포스포네이트 등) 복용 시 주의할 점(공복 복용, 눕지 않기)은 무엇인가요?',
      '비타민 D 및 칼슘 보충제 권장 복용량과 체중 부하 운동법은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-osteoporosis',
        title: '골다공증의 예방과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5270',
        section: '골다공증 개요'
      }
    ]
  },
  {
    id: 'osteoarthritis',
    name: '퇴행성관절염 (골관절염, Osteoarthritis)',
    category: '근골격 및 신경 질환',
    termPattern: /^(?:퇴행성\s*관절염|골\s*관절염|\bosteoarthritis\b|무릎\s*관절염)/iu,
    definition: '관절을 보호하는 연골(물렁뼈)이 노화나 과사용으로 닳아 뼈와 인대에 염증과 변형이 일어나는 가장 흔한 만성 관절 질환입니다.',
    normalContext: '무릎, 고관절, 손가락에 흔하며 관절 사용 시 악화되는 통증, 아침 30분 이내 뻣뻣함(조조강직), 관절 소리가 특징입니다.',
    caution: '⚠️ 통증 때문에 움직이지 않으면 허벅지 근육(대퇴사두근)이 약해져 관절염이 악화됩니다. 평지 걷기, 수영 등 체중 부하가 적은 근력 운동과 적정 체중 유지가 핵심입니다.',
    disclaimer: '대한정형외과학회 진료 권고안 기준 일반 정보입니다.',
    suggestedQuestions: [
      '무릎 X-ray 영상에서 관절강 협착과 관절염 병기(1~4단계)는 어떻게 되나요?',
      '관절 내 주사 치료(히알루론산 등)와 약물 치료의 기대 효과는 무엇인가요?',
      '인공관절 수술을 고려해야 하는 수술적 치료 적응증은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-osteoarthritis',
        title: '퇴행성관절염의 운동과 치료',
        institution: '질병관리청 국가건강정보포털',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5272',
        section: '골관절염 개요'
      }
    ]
  },
  {
    id: 'dementia',
    name: '치매 및 알츠하이머병 (Dementia & Alzheimer\'s Disease)',
    category: '근골격 및 신경 질환',
    termPattern: /^(?:치\s*매|알츠하이머(?:병)?|\bdementia\b|\balzheimer\b|인지\s*장애)/iu,
    definition: '뇌 질환으로 인해 기억력, 언어능력, 판단력 등 다발성 인지기능이 저하되어 일상생활을 스스로 수행하지 못하게 되는 임상 증후군입니다. 알츠하이머병이 약 70%를 차지합니다.',
    normalContext: '단순 건망증과 달리 사건 전체를 잊고 힌트를 주어도 기억하지 못하며, 최근 일에 대한 기억 장애로 시작하여 점차 시공간 감각 저하로 진행합니다.',
    caution: '⚠️ 조기에 선별검사(MMSE)와 뇌 MRI를 시행하여 가역적 원인을 감별하고 인지개선 약물 치료를 시작하는 것이 인지기능 저하 속도를 늦추는 데 결정적입니다.',
    disclaimer: '중앙치매센터 및 질병관리청 국가건강정보포털 기준 일반 정보입니다.',
    suggestedQuestions: [
      '단순 노화성 건망증과 경도인지장애(MCI) 또는 치매를 감별하기 위한 정밀 인지검사는 무엇인가요?',
      '뇌 MRI 영상에서 뇌 위축이나 혈관성 치매 소견이 있는지 어떻게 확인하나요?',
      '보건소 치매안심센터를 통해 지원받을 수 있는 조기 진단 및 관리 프로그램은 무엇인가요?'
    ],
    sources: [
      {
        id: 'kdca-dementia',
        title: '치매의 조기 발견과 치료',
        institution: '중앙치매센터 · 질병관리청',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5276',
        section: '치매 개요'
      }
    ]
  },

  // ==========================================
  // [8] 건강검진 검사항목 16종 (Screening Tests)
  // ==========================================
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
    category: '영상의학 선별검사',
    termPattern: /^(?:(?:상\s*복부|복부|간)\s*)?초음파/iu,
    definition: '인체에 무해한 고주파 음파를 복부에 보내 반사되어 돌아오는 신호를 영상으로 변환하여, 간의 형태, 크기, 실질의 음영 변화, 혈관 구조, 결절(혹)이나 종양의 유무를 실시간으로 확인하는 대표적인 비침습적 영상검사입니다.',
    normalContext: '검사 당일 정확한 관찰을 위해 통상 6~8시간의 금식이 필요합니다(담낭 수축 방지 및 장내 가스 최소화 목적). 방사선 노출이 없어 임산부나 반복 검사가 필요한 환자에게도 매우 안전합니다.',
    caution: '⚠️ 장점과 한계: 초음파는 검사자의 숙련도나 환자의 복벽 두께, 장내 가스에 영향을 받을 수 있으며, 1cm 미만의 미세 결절이나 간 심부의 병변을 단독으로 정밀 감별하기 어려울 수 있습니다. 초음파에서 의심스러운 결절이 발견되면 조영 증강 CT 또는 간 MRI 등 2차 정밀 영상검사로 즉시 연계해야 합니다.',
    disclaimer: '본 정보는 MedlinePlus 및 대한영상의학회 진료 권고안을 반영한 비임상 의학 해설입니다.',
    suggestedQuestions: [
      '간 초음파에서 관찰된 결절이나 지방간 소견의 구체적 의미는 무엇인가요?',
      '추가 조영 증강 CT나 정밀 MRI 검사가 필요한 상황인가요?',
      '다음 초음파 추적 검사는 몇 개월 후에 시행하는 것이 적절한가요?'
    ],
    sources: [
      {
        id: 'school-demo-medical-test-sonogram',
        title: '초음파 검사 (Sonogram / Ultrasound)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/sonogram/',
        section: '복부 및 간 초음파 검사'
      }
    ]
  },
  {
    id: 'chest-ct',
    name: '흉부 CT 검사 (Chest Computed Tomography)',
    category: '영상의학 정밀검사',
    termPattern: /^(?:흉부|가슴)?\s*ct|컴퓨터\s*단층\s*촬영/iu,
    definition: 'X선을 신체에 360도 회전 투과시켜 컴퓨터로 인체 내부의 단면(슬라이스) 영상을 정밀하게 재구성하는 영상검사입니다. 일반 흉부 X-ray에서 발견하기 어려운 미세한 폐 결절, 종격동 병변, 림프절 비대, 대혈관 질환 등을 고해상도로 입체 평가할 수 있습니다.',
    normalContext: '폐암 조기 선별에는 방사선량을 대폭 줄인 ‘저선량 흉부 CT(Low-Dose CT)’가 널리 사용되며, 종양의 악성 여부나 혈관 평가를 위해서는 정맥 조영제를 사용하는 ‘조영 증강 CT’를 시행합니다.',
    caution: '⚠️ 주의사항: 조영제를 사용하는 경우 조영제 알레르기(두드러기, 호흡곤란 등) 병력 확인과 신장 기능(eGFR/크레아티닌) 사전 평가가 필수입니다. 또한 방사선 노출이 수반되므로 임의의 잦은 검사를 지양하고, 기존 타 병원에서 촬영한 DICOM 원본 영상을 MediQ 등의 의료영상 공유 플랫폼을 통해 연계하여 중복 촬영을 방지해야 합니다.',
    disclaimer: '본 정보는 미국 영상의학회(ACR) 및 국내 방사선 안전 가이드라인에 따른 일반 설명입니다.',
    suggestedQuestions: [
      '이번 흉부 CT 검사가 조영제를 사용하는 검사인가요, 저선량 CT인가요?',
      'CT 영상에서 발견된 폐 결절의 크기(mm 단위)와 추적 관찰 계획은 어떻게 되나요?',
      '타 병원 진료 시 MediQ 플랫폼을 통한 원본 DICOM 영상 전송 절차는 어떻게 되나요?'
    ],
    sources: [
      {
        id: 'medlineplus-chest-ct',
        title: '흉부 CT 검사 (Chest CT Scan)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/sonogram/',
        section: '흉부 단층촬영 개요'
      }
    ]
  },
  {
    id: 'ast-alt',
    name: '간 효소 검사 (AST / ALT / 간기능 검사)',
    category: '간기능 혈액검사',
    termPattern: /^(?:ast|alt|sgot|sgpt|간\s*효소|간\s*기능\s*검사)/iu,
    definition: '간세포 내에 풍부하게 존재하는 효소인 AST(아스파르테이트아미노전이효소)와 ALT(알라닌아미노전이효소)의 혈중 농도를 측정하는 검사입니다. 간세포가 손상되면 세포막이 파괴되어 이 효소들이 혈액으로 방출되어 수치가 상승합니다.',
    normalContext: '통상 성인 정상 참고치는 기관에 따라 약 0~40 U/L 범위로 제시되나, 성별, 연령, 체중에 따라 차이가 있습니다. 특히 ALT는 간세포에 더 특이적으로 존재하므로 간세포 손상 평가 시 비중 있게 해석됩니다.',
    caution: '⚠️ 심한 운동, 근육 손상, 과음, 피로, 특정 약물 복용에 의해서도 일시적으로 수치가 상승할 수 있습니다. 수치 상승 시 바이러스성 간염, 지방간, 간경변증 등을 감별하기 위해 간 초음파 검사와 함께 종합적인 판독이 필요합니다.',
    disclaimer: '대한진단검사의학회 종합검진 가이드라인 기준 일반 정보입니다.',
    suggestedQuestions: [
      '제 AST/ALT 수치 상승 원인이 약물, 음주, 지방간, 간염 중 무엇에 해당하는지 추가 검사가 필요한가요?',
      '간 효소 수치가 상승했을 때 간 초음파 영상검사를 병행해야 하는 이유는 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-lft',
        title: '간기능 검사 (Liver Function Tests)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/liver-function-tests/',
        section: 'AST/ALT 효소 해석'
      }
    ]
  },
  {
    id: 'gamma-gtp',
    name: '감마-지티피 검사 (γ-GTP / GGT)',
    category: '간기능 혈액검사',
    termPattern: /^(?:감마\s*지티피|감마\s*gtp|ggt)/iu,
    definition: '간의 담관(쓸갯길) 상피세포에 많이 분포하는 효소로, 담즙 정체나 담도계 질환, 그리고 만성 음주나 특정 약물 복용 시 민감하게 상승하는 효소 지표입니다.',
    normalContext: '통상 남성은 약 11~63 U/L, 여성은 8~35 U/L 수준을 참고치로 사용하나 검사기관마다 상이합니다.',
    caution: '⚠️ 음주에 매우 민감하여 며칠간의 음주로도 급격히 상승할 수 있으며, 복부 초음파 검사상 지방간이나 담석증이 동반되어 있을 때 지속 상승할 수 있습니다.',
    disclaimer: '대한소화기학회 검진 권고 기준 일반 정보입니다.',
    suggestedQuestions: [
      '감마-GTP 수치가 단독으로 상승한 경우 담도 이상이나 지방간 여부를 확인하기 위해 복부 초음파가 필요한가요?',
      '음주를 하지 않는데도 감마-GTP 수치가 높게 나오는 다른 원인에는 어떤 것들이 있나요?'
    ],
    sources: [
      {
        id: 'medlineplus-ggt',
        title: '감마-GTP 검사 (Gamma-Glutamyl Transferase Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/',
        section: '담도 효소 및 음주 지표'
      }
    ]
  },
  {
    id: 'blood-glucose',
    name: '공복혈당 검사 (Fasting Blood Sugar / FBS)',
    category: '당뇨 및 대사 검사',
    termPattern: /^(?:공복\s*혈당|fbs|혈당(?:\s*검사)?)/iu,
    definition: '최소 8시간 이상 금식 후 혈액 속 포도당 농도를 측정하여 당뇨병 유무 및 당 대사 이상을 조기에 선별하는 핵심 검사입니다.',
    normalContext: '정상 성인 기준 70~99 mg/dL가 정상 범위이며, 100~125 mg/dL는 당뇨 전단계(공복혈당장애), 126 mg/dL 이상이면 당뇨병을 의심하여 재검사 또는 추가 검사를 시행합니다.',
    caution: '⚠️ 금식 시간(8~12시간)이 지켜지지 않았거나 심한 스트레스 상태에서는 일시적으로 높게 나올 수 있으므로, 지난 2~3개월간의 평균 혈당을 반영하는 당화혈색소(HbA1c) 검사와 병행 평가하는 것이 안전합니다.',
    disclaimer: '대한당뇨병학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '공복혈당이 공복혈당장애(전단계) 범위일 때 식단과 운동 관리 목표는 어떻게 설정해야 하나요?',
      '당화혈색소(HbA1c) 검사를 함께 확인해야 하는 이유는 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-glucose',
        title: '혈당 검사 (Blood Glucose Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/blood-glucose-test/',
        section: '공복혈당 참고치 및 당뇨 판정'
      }
    ]
  },
  {
    id: 'hba1c',
    name: '당화혈색소 검사 (HbA1c)',
    category: '당뇨 및 대사 검사',
    termPattern: /^(?:당화\s*혈색소|hba1c|a1c)/iu,
    definition: '적혈구 내의 혈색소(헤모글로빈)에 포도당이 결합한 비율을 측정하는 검사입니다. 적혈구의 수명(약 120일) 동안의 혈당 변화를 반영하므로, 최근 2~3개월간의 장기적인 평균 혈당 조절 상태를 정확하게 나타냅니다.',
    normalContext: '5.6% 이하가 정상, 5.7~6.4%는 당뇨 전단계(고위험군), 6.5% 이상이면 당뇨병으로 진단합니다.',
    caution: '⚠️ 공복 상태가 아니어도 검사가 가능하여 당뇨병의 진단 및 치료 경과 모니터링의 가장 중요한 표준 지표로 활용됩니다.',
    disclaimer: '미국당뇨병학회(ADA) 및 대한당뇨병학회 표준 지침 기준입니다.',
    suggestedQuestions: [
      '제 당화혈색소 수치를 감안한 맞춤 혈당 조절 목표치(통상 6.5% 또는 7.0% 이하)는 얼마인가요?',
      '공복혈당과 당화혈색소 수치에 차이가 있을 때 어떻게 해석해야 하나요?'
    ],
    sources: [
      {
        id: 'medlineplus-hba1c',
        title: '당화혈색소 검사 (Hemoglobin A1c Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/hemoglobin-a1c-hba1c-test/',
        section: '장기 혈당 평가'
      }
    ]
  },
  {
    id: 'lipid-panel',
    name: '지질 패널 검사 (콜레스테롤 / 중성지방)',
    category: '지질 및 심혈관 검사',
    termPattern: /^(?:(?:hdl|ldl|총)?\s*콜레스테롤|중성\s*지방|hdl|ldl)/iu,
    definition: '총콜레스테롤, 중성지방(Triglyceride), HDL(좋은 콜레스테롤), LDL(나쁜 콜레스테롤)을 종합 측정하여 이상지질혈증 및 동맥경화 위험도를 평가하는 혈액검사입니다.',
    normalContext: '총콜레스테롤 200 mg/dL 미만, LDL 콜레스테롤 100~130 mg/dL 미만, HDL 콜레스테롤 40 mg/dL(여성 50) 이상, 중성지방 150 mg/dL 미만이 일반적인 권고 기준입니다.',
    caution: '⚠️ 심혈관 질환, 당뇨병, 고혈압 환자는 목표 LDL 기준치가 70 mg/dL 이하로 훨씬 엄격하게 적용됩니다. 중성지방은 전날 식사와 음주에 매우 민감하므로 12시간 금식이 권장됩니다.',
    disclaimer: '한국지질동맥경화학회 이상지질혈증 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '제 심혈관 위험 요인을 고려했을 때 목표 LDL 콜레스테롤 수치는 얼마인가요?',
      'LDL 콜레스테롤을 낮추기 위해 식이요법 외에 스타틴 복용이 필요한 기준은 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-cholesterol',
        title: '지질 패널 및 콜레스테롤 검사',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/cholesterol-levels/',
        section: '지질 패널 해석'
      }
    ]
  },
  {
    id: 'kidney-function',
    name: '혈청 크레아티닌 및 eGFR (신장기능 검사)',
    category: '신장기능 혈액검사',
    termPattern: /^(?:크레아티닌|egfr|사구체\s*여과율|신장\s*기능)/iu,
    definition: '근육에서 생성되는 대사 노폐물인 크레아티닌의 혈중 수치와 이를 바탕으로 계산된 분당 사구체 여과율(eGFR)을 측정하여 신장의 노폐물 배설 능력을 평가하는 핵심 검사입니다.',
    normalContext: '혈청 크레아티닌은 성인 기준 약 0.7~1.3 mg/dL, eGFR은 60 mL/min/1.73m² 이상이면 정상 신기능으로 평가합니다.',
    caution: '⚠️ eGFR이 60 미만으로 3개월 이상 지속되면 만성 콩팥병을 의심하며, 조영제를 사용하는 CT 검사 전 신기능 적합성 여부를 판단하는 필수 지표입니다.',
    disclaimer: '대한신장학회 만성콩팥병 임상진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '제 eGFR 수치 기준으로 CT 조영제 사용에 문제가 없는 상태인가요?',
      '혈청 크레아티닌 수치 상승 시 신장 손상 정도를 확인하기 위한 추가 소변검사는 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-creatinine',
        title: '크레아티닌 검사 및 신장기능',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/creatinine-test/',
        section: '사구체여과율과 신기능'
      }
    ]
  },
  {
    id: 'urinalysis-protein',
    name: '요단백 검사 (단백뇨 / 소변검사)',
    category: '소변 선별검사',
    termPattern: /^(?:요\s*단백|단백\s*뇨|소변\s*검사|소변\s*단백)/iu,
    definition: '소변 시험지봉(Dipstick)을 통해 소변에 단백질(알부민)이 비정상적으로 배출되는지 확인하여 신장의 사구체 손상 여부를 조기에 선별하는 소변검사입니다.',
    normalContext: '정상 소변은 단백질이 거의 검출되지 않아 ‘음성(Negative)’이 정상입니다.',
    caution: '⚠️ 심한 운동 후, 발열, 기립성 상태에서 일시적인 위양성이 나타날 수 있으므로, 양성(1+ 이상) 소견 시 아침 첫 소변으로 재검사하거나 정량 검사(단백/크레아티닌 비율)를 시행합니다.',
    disclaimer: '국가건강검진 요검사 표준 해설 기준입니다.',
    suggestedQuestions: [
      '소변검사에서 단백뇨 양성이 나왔을 때 정밀 신장내과 진료가 필요한가요?',
      '단백뇨 수치가 지속될 경우 사구체신염 등 정밀 신장 질환 검사가 필요한가요?'
    ],
    sources: [
      {
        id: 'medlineplus-urinalysis',
        title: '소변검사 및 단백뇨 (Urinalysis)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/urinalysis/',
        section: '단백뇨 선별'
      }
    ]
  },
  {
    id: 'hemoglobin-anemia',
    name: '혈색소 검사 (헤모글로빈 / 빈혈 검사)',
    category: '일반혈액검사(CBC)',
    termPattern: /^(?:혈색소|헤모글로빈|빈혈(?:\s*검사)?)/iu,
    definition: '적혈구 내에서 전신 조직으로 산소를 운반하는 단백질인 혈색소(Hb)의 양을 측정하여 빈혈 여부를 판별하는 일반혈액검사입니다.',
    normalContext: '성인 남성은 13~18 g/dL, 성인 여성은 12~16 g/dL 수준이 정상이며, 남성 13 미만, 여성 12 미만일 때 빈혈로 판정합니다.',
    caution: '⚠️ 수치가 낮을 경우 철분 결핍성 빈혈 외에도 위장관 출혈(위궤양, 대장 용종/암 등)에 의한 만성 출혈 가능성이 있으므로 내시경 검사를 고려할 수 있습니다.',
    disclaimer: '대한진단검사의학회 일반혈액검사 기준입니다.',
    suggestedQuestions: [
      '혈색소 수치가 낮을 때 철분제 복용 외에 위장관 출혈 여부를 확인하기 위한 내시경 검사가 필요한가요?',
      '빈혈 판정 시 철분제 복용과 함께 저장철(페리틴) 검사를 함께 확인해야 하나요?'
    ],
    sources: [
      {
        id: 'medlineplus-hemoglobin',
        title: '혈색소 검사 (Hemoglobin Test)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/hemoglobin-test/',
        section: '빈혈 판정'
      }
    ]
  },
  {
    id: 'blood-pressure',
    name: '혈압 측정 (Blood Pressure)',
    category: '기본 생체징후 검사',
    termPattern: /^(?:혈압(?:\s*측정)?|수축기|이완기)/iu,
    definition: '심장이 수축하여 혈액을 내보낼 때 혈관벽에 가해지는 압력(수축기 혈압)과 심장이 이완할 때 혈관에 남아있는 압력(이완기 혈압)을 측정하는 가장 기본적이고 중요한 생체징후 검사입니다.',
    normalContext: '수축기 120 mmHg 미만 및 이완기 80 mmHg 미만이 이상적인 정상 혈압입니다.',
    caution: '⚠️ 1회 측정만으로 고혈압을 진단하지 않으며, 2회 이상 안정된 상태에서 측정한 평균치 또는 가정 혈압 기록으로 정확히 평가합니다.',
    disclaimer: '대한고혈압학회 고혈압 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '수축기/이완기 혈압 수치가 고혈압 전단계에 해당할 때 생활습관 교정 방법은 무엇인가요?',
      '백의고혈압이나 가면고혈압을 감별하기 위해 24시간 활동혈압 검사가 필요한가요?'
    ],
    sources: [
      {
        id: 'medlineplus-blood-pressure',
        title: '혈압 측정과 고혈압 기준',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/blood-pressure-measurement/',
        section: '생체징후 측정'
      }
    ]
  },
  {
    id: 'bmi-body-metrics',
    name: '체질량지수 및 허리둘레 (BMI / 비만도)',
    category: '신체계측 검사',
    termPattern: /^(?:bmi|체질량\s*지수|비만도|허리\s*둘레)/iu,
    definition: '체중(kg)을 신장의 제곱(m²)으로 나눈 수치로, 체지방량을 간접 평가하는 국제 표준 비만 판정 지표입니다.',
    normalContext: '국내 기준 18.5 미만 저체중, 18.5~22.9 정상, 23~24.9 비만 전단계(과체중), 25 이상을 비만으로 분류합니다.',
    caution: '⚠️ BMI가 정상이더라도 복부 허리둘레(남성 90cm, 여성 85cm 이상)가 기준을 넘으면 내장비만 및 대사증후군 위험이 높으므로 함께 평가해야 합니다.',
    disclaimer: '대한비만학회 비만 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '체질량지수(BMI)와 허리둘레 수치에 따른 비만 관리 목표는 어떻게 설정해야 하나요?',
      '체중 감량과 허리둘레 감소를 위해 권장되는 일주일 운동 시간과 식단 요령은 무엇인가요?'
    ],
    sources: [
      {
        id: 'medlineplus-bmi',
        title: '체질량지수 (BMI) 측정',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/body-mass-index-bmi-measurement/',
        section: '신체계측'
      }
    ]
  },
  {
    id: 'pulmonary-function',
    name: '폐기능 검사 (Pulmonary Function Test / PFT)',
    category: '호흡기 기능검사',
    termPattern: /^(?:폐\s*기능\s*검사|폐활량(?:\s*검사)?|fev1|fvc)/iu,
    definition: '특수 호흡 측정 기구를 통해 들이마시고 내쉬는 공기의 양(폐활량)과 속도를 측정하여 기도 폐쇄나 폐 용적 감소 유무를 진단하는 호흡기 정밀 기능검사입니다.',
    normalContext: '최대 노력성 호기량(FVC)과 1초간 노력성 호기량(FEV1)을 측정하며, 1초율(FEV1/FVC) 70% 이상을 정상 범위로 봅니다.',
    caution: '⚠️ 만성 흡연자나 기침, 호흡곤란 환자에서 만성폐쇄성폐질환(COPD)이나 천식을 조기에 발견하는 핵심 검사입니다.',
    disclaimer: '대한결핵및호흡기학회 진료지침 기준 일반 정보입니다.',
    suggestedQuestions: [
      '폐기능 검사 결과에서 1초율 수치가 의미하는 호흡기 건강 상태는 어떤가요?',
      '폐활량 감소 시 천식이나 만성폐쇄성폐질환(COPD) 감별을 위해 기관지확장제 반응 검사가 필요한가요?'
    ],
    sources: [
      {
        id: 'medlineplus-spirometry',
        title: '폐기능 검사 (Spirometry / PFT)',
        institution: 'MedlinePlus · 미국 국립의학도서관',
        url: 'https://medlineplus.gov/lab-tests/spirometry/',
        section: '폐활량 및 기류 측정'
      }
    ]
  },
  {
    id: 'chest-xray',
    name: '흉부 방사선검사 (Chest X-ray)',
    category: '영상의학 선별검사',
    termPattern: /^(?:흉부\s*)?(?:x-ray|x\s*선|엑스레이|단순\s*촬영|방사선\s*검사)/iu,
    definition: 'X선을 흉부에 투과시켜 폐, 심장, 갈비뼈, 쇄골 등의 음영을 한 장의 평면 영상으로 확인하는 가장 기본적이고 필수적인 1차 영상의학 선별검사입니다.',
    normalContext: '폐렴, 폐결핵, 기흉, 늑막삼출, 심비대(심장이 커짐) 유무를 빠르게 확인할 수 있습니다.',
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

// Match user question against the health screening & major disease glossary
export function matchScreeningGlossary(question) {
  if (typeof question !== 'string') return null;
  const q = question.trim();
  if (!q || q.length > 300) return null;

  // Emergency Triage Gate: Immediate life-saving escalation for red-flag symptoms
  if (isEmergencyRequest(q)) {
    return {
      matched: true,
      item: { id: 'emergency-triage', name: '응급 증상 안내' },
      response: {
        status: 'RETRIEVED',
        answer: `🚨 [초응급 상황 안내 - 즉시 119 구급대 호출 권고]

입력하신 증상(극심한 흉통, 호흡곤란, 급격한 편측 마비, 언어장애, 의식 저하 등)은 급성 심근경색, 뇌졸중 등 '골든타임' 치료가 생명을 좌우하는 급성 중증 심뇌혈관 질환의 대표적인 위험 신호일 수 있습니다.

■ 즉시 취해야 할 행동:
1. 지체 없이 119에 전화하여 구급대를 요청하세요.
2. 환자 본인이 직접 운전하지 마시고 반드시 119 구급차를 이용하세요.
3. 환자를 편안한 자세로 눕히고 넥타이나 벨트 등 꽉 조이는 옷을 풀어주세요.
4. 의식이 흐린 환자에게 물이나 약(우황청심원 등)을 억지로 먹이면 기도 질식 위험이 있으니 절대 삼가세요.

📌 본 챗봇은 응급 의료 상담이나 진단을 대신할 수 없으며, 질병 정의 조회보다 응급실 즉시 내원이 최우선입니다.`,
        questions: [
          '가장 가까운 심뇌혈관 응급의료센터로 이송되고 있나요?',
          '증상이 시작된 정확한 시각(온셋 타임)은 언제인가요?'
        ],
        sources: [
          {
            id: 'emergency-119-kdca',
            title: '응급의료포털 E-Gen 및 심뇌혈관 골든타임 가이드',
            institution: '중앙응급의료센터 · 질병관리청',
            url: 'https://www.e-gen.or.kr/',
            section: '심뇌혈관 응급 대처'
          }
        ],
        generationUsed: false,
        glossaryMatched: true,
        category: '응급 안내',
        recordContext: 'NOT_CONNECTED'
      }
    };
  }

  // Safety Gate: Do not intercept clinical diagnosis/prescription queries!
  if (isClinicalDiagnosisRequest(q)) return null;

  for (const item of HEALTH_SCREENING_GLOSSARY) {
    if (matchGlossaryTerm(item.termPattern, q)) {
      const isDisease = item.category !== '종양표지자 및 정밀검사' &&
                        item.category !== '영상의학 선별검사' &&
                        item.category !== '영상의학 정밀검사' &&
                        item.category !== '간기능 혈액검사' &&
                        item.category !== '당뇨 및 대사 검사' &&
                        item.category !== '지질 및 심혈관 검사' &&
                        item.category !== '신장기능 혈액검사' &&
                        item.category !== '소변 선별검사' &&
                        item.category !== '일반혈액검사(CBC)' &&
                        item.category !== '기본 생체징후 검사' &&
                        item.category !== '신체계측 검사' &&
                        item.category !== '호흡기 기능검사';

      const section1 = isDisease ? '질환 개요 및 정의' : '검사 개요 및 목적';
      const section2 = isDisease ? '진료 및 증상 경과' : '일반적 참고 기준';

      // Build rich, structured patient answer
      const answer = `${item.name} 안내

■ ${section1}:
${item.definition}

■ ${section2}:
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
