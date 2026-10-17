# 건강검진 상세 근거 후보 — DRAFT / UNASSIGNED

관측일: 2026-10-12 KST
범위: 초음파·CT와 AFP·간기능 후보에 이어, 기존 시나리오의 나머지 검진 주제 20개에 대한 목적·한계·준비·비교 초안 80개
콘텐츠 검토: `UNASSIGNED` · 임상 사용: 금지 · 실제 인증 API/화면 연결·배포: 미수행

## 이번 단위

| 주제 묶음 | 세부 주제 | 근거 범위 |
|---|---|---|
| 신체계측 | 키, 체중, 허리둘레, BMI | 체중 관련 선별의 보조 지표, 한계, 측정 준비, 기록 시 항목·날짜 구분 |
| 활력·감각 | 혈압, 시력, 청력 | 측정·선별 목적과 한계, 검사 전 준비, 조건/좌우 구분 체크리스트 |
| 혈액검사 | 혈색소, 공복혈당 | 검사 목적, 단독 해석 한계, 동반 검사·금식 안내, 검사실별 비교 주의 |
| 신장 | 혈청 크레아티닌, eGFR, 요단백 | 검사별 역할과 영향 요인, 검사 준비 확인, 결과 단위·검사실 비교 주의 |
| 지질 | 총콜레스테롤, HDL, LDL, 중성지방 | 지질 패널에서의 항목 역할, 단독 위험판정 금지, 금식은 검사기관 확인, 검사실별 비교 |
| 기타 | C형간염 항체, 폐기능검사, 흉부 X선, 구강검진 | 검사 유형별 역할·한계·준비와 이전 기록 확인 질문 |

각 주제에 `PURPOSE`, `LIMITS`, `PREPARATION`, `COMPARISON`을 하나씩 두었다. 모든 한국어 문장은 원문 발췌/공식 번역이 아니라 프로젝트 작성 요약 후보이며, 출처 제목·해당 절과 링크를 함께 보존한다. 고정 문장만 추출 반환하며 Qwen/Ollama 호출은 없다.

## 원문·이용 범위

검토한 [MedlinePlus 이용정책](https://medlineplus.gov/about/using/usingcontent/)의 공개 이용 범위에 따라 Medical Test 안내 및 Health Topic 요약의 해당 정보만 후보에 요약했다. 출처표시는 `Source: MedlinePlus, National Library of Medicine.`로 고정했다. 페이지에 연결된 제3자 자료, A.D.A.M. 백과사전, 사진·이미지는 근거 본문이나 후보에 복제하지 않았다. [FDA 영상 기록 안내](https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication)에서는 환자가 이전 영상의 날짜·종류·촬영기관을 정리해 의료진과 이야기하는 용도만 요약했다. FDA의 [웹사이트 이용정책](https://www.fda.gov/about-fda/about-website/website-policies)과 기관 출처표시도 증적에 포함했다.

고정 원문 snapshot은 출처·해시 추적을 위한 증거일 뿐 검색 corpus나 모델 입력이 아니다. 스냅샷·초안은 다음 경로에 저장되며 기존 버전을 덮어쓰지 않는다.

- Manifest: `data/health-helper-screening-evidence-20261012-v1/manifest.json`
- Candidate notes: `data/health-helper-screening-evidence-20261012-v1/notes.json`
- Source HTML: manifest가 참조하는 `sources/<sha256>.html`

주제별 주요 출처는 [비만 선별검사](https://medlineplus.gov/lab-tests/obesity-screening/), [혈압 측정](https://medlineplus.gov/lab-tests/measuring-blood-pressure/), [시력 선별검사](https://medlineplus.gov/lab-tests/vision-screening/), [성인 청력검사](https://medlineplus.gov/lab-tests/hearing-tests-for-adults/), [혈색소](https://medlineplus.gov/lab-tests/hemoglobin-test/), [혈당](https://medlineplus.gov/lab-tests/blood-glucose-test/), [크레아티닌](https://medlineplus.gov/lab-tests/creatinine-test/), [eGFR/GFR](https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/), [요단백](https://medlineplus.gov/lab-tests/protein-in-urine/), [콜레스테롤·지질](https://medlineplus.gov/lab-tests/cholesterol-levels/), [중성지방](https://medlineplus.gov/lab-tests/triglycerides-test/), [간염 검사](https://medlineplus.gov/lab-tests/hepatitis-testing/), [폐기능검사](https://medlineplus.gov/lab-tests/lung-function-tests/), [X선 검사](https://medlineplus.gov/xrays.html), [치과검진](https://medlineplus.gov/lab-tests/dental-exam/), [검사 결과 이해·검사실 간 비교 주의](https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/)다.

## 안전·범위 경계

- 환자 수치나 이름을 corpus에 넣지 않았다. 개인 결과 해석, 진단, 치료·약 조정, 정상범위·질환 문턱값 질문은 거부 또는 근거 부족으로 종료한다.
- 혈압 준비와 공복검사 안내는 일반 출처 요약이다. 개별 검사 주문에 대한 준비 지시는 검사기관·의료진 안내가 우선이다. 임의로 약을 중단하라는 답변을 만들지 않는다.
- 공통 검사실 비교 안내는 기관별 방법·단위·참고범위가 다를 수 있음을 설명하되 환자 수치를 자동 비교·판정하지 않는다.
- 시력·청력·폐기능·치과의 이전 검사 비교 질문은 출처의 명시적 권고인 것처럼 제시하지 않는다. 기록 날짜, 검사 종류, 좌우 구분 등은 프로젝트 작성의 진료 준비 체크리스트(`PROJECT_COMPARISON_CHECKLIST`)다.
- MedlinePlus/FDA 영상 기록 요약은 이전 영상의 날짜·종류·기관을 정리하는 목적만 지원한다. 이미지 픽셀 자동 비교·판독은 하지 않는다.
- 콘텐츠 정확도·한국 적용성에 대한 의료전문가 검토는 아직 배정되지 않았다. 자동 검증 PASS는 의료 검토 PASS를 뜻하지 않는다.

## 검색 및 연결 상태

`src/health-helper-screening-evidence.js`는 명시적 검사 별칭과 단일 의도만 매칭하는 로컬 후보 모듈이다. 모호한 다중 주제·다중 의도는 근거 부족, 개인 입력은 거부, 범위값 요청은 근거 부족으로 처리한다. 출력은 저장된 한 문장 그대로만 통과하도록 기존 `validateEducationOutput` 계약을 사용한다.

현재 모듈 참조는 후보 생성 스크립트와 테스트뿐이다. `src/health-helper-http.js`, 환자 웹/모바일 화면, 실제 사용자 인증·권한·감사 API에서는 이 후보를 검색하거나 반환하지 않는다. 기존 KDCA 전용 경로는 그대로 유지했다. 새로운 FR/NFR ID는 승인 요구사항에서 확인하지 못해 만들지 않았다. 기존 기록/감사 경계를 유지하는 영향 범위는 FR-006~009 및 FR-037~046이다.

## 2026-10-13 공식 국내 출처 재확인

기존 corpus 대체 출처인 [의왕시 보건소 검사실](https://www.uiwang.go.kr/heal/UWHEAL0305)을 실시간 확인했다. 페이지는 검사 항목과 짧은 임상적 의의, 혈당 검사 준비(식전 8시간 금식 또는 식후 2시간), 이용방법을 제공하고, 하단에 공공누리 제1유형 출처표시 조건을 표시한다. [공공누리 제1유형 안내](https://www.kogl.or.kr/info/licenseType1.do)는 공유·이용과 2차적 저작물 작성을 허용하며 출처표시와 기관 후원 오인 금지를 요구한다. 따라서 이 페이지의 지정 범위를 출처 링크와 변경 표시를 갖춘 RAG 검색 후보로 다루는 이용조건은 확인되지만, 이를 LLM 가중치 학습 허가나 의학적 정확성 검토로 확대 해석하지 않는다.

페이지 최종 수정일은 2023-02-22로 표시되어 있다. 비용·운영시간은 갱신 여부를 확인하지 못했으므로 답변 근거에서 제외한다. 이 페이지는 AFP, 초음파, CT의 목적·한계·비교 설명을 다루지 않는다. 혈당·간기능·BUN/크레아티닌·지질 등 나열된 검사도 참고범위나 개인 결과 해석 근거를 제공하지 않는다. 후보 하나는 이 출처 범위에 한정하며, **source/chunk content review는 여전히 `UNASSIGNED`**, 현재 corpus inventory는 계속 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`이다. 실제 API·웹·모바일 연결 및 배포는 수행하지 않았다.

## 검증 결과

- 20개 주제 × 4개 의도 = 80개 후보 및 질문 템플릿별 정확한 단일 청크 라우팅 PASS.
- 각 고정 응답이 기존 안전 출력 validator를 통과하고, 임의 문장 추가 시 거부됨을 확인.
- 입력 거부/근거 부족: 개인 결과·이름·숫자·정상범위·질환 기준·복수 주제/의도·약 조정 질문·미수록 검사·과도한 길이.
- 출처 19개 고정 URL의 snapshot/hash, 노트 SHA-256, 후보 status 및 `clinicalUse=false`, `serviceDeployment=false` 검증 PASS.
- 이번 후보 + AFP·간기능·초음파/CT·시나리오·기존 RAG/HTTP·환자 웹/모바일 회귀 79/79 PASS, exit 0, 1.214초.

```powershell
node scripts/build-health-helper-screening-evidence.js
node --test test/health-helper-screening-evidence.test.js
node --test test/health-helper-screening-evidence.test.js test/health-helper-imaging-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-liver-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-scenario-scope.test.js test/health-helper-medlineplus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/mobile-health-helper.test.js test/synthetic-health.test.js
```

## 남은 검토·작업

1. 의료전문가가 80개 문장, 출처 절, 금식/준비 표현, 프로젝트 체크리스트 표시와 한국 적용성을 원문 대조 검토하고 별도 판정 기록을 남긴다. `UNASSIGNED` 상태를 임의로 PASS로 바꾸지 않는다.
2. 승인 이후에만 기존 환자 인증·권한·감사 경로의 source allowlist와 API 계약을 검토한다. 환자 기록은 인증된 서버가 선택한 기록만 최소 범위로 제공해야 한다.
3. 실제 웹·모바일에서 정상, 개인자료 거부, 진단 거부, 근거 부족, 출처 카드/원문 열기, 질문 담기·수정 흐름을 검증한다.
4. 승인된 배포 후 rollback과 동일한 정상·거부 흐름 재검증을 남긴다.

현재 단위는 로컬 콘텐츠 후보 보완만 완료했다. 의료 검토·인증 사용자 연결·웹/모바일 E2E·배포/rollback은 `NOT VERIFIED`; 전체 RAG/MVP/v3 완료가 아니다. 기존 dirty 작업, 코드, 데이터와 ignore 상태를 보존했으며 PACS·병원 환경은 건드리지 않았다.
