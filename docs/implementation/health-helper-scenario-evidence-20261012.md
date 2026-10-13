# 시나리오 26검사 RAG 근거 보완 — DRAFT / UNASSIGNED

2026-10-12 KST. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty(이번 작업 시작 시 260개). 기존 변경·번역 중지·데이터·PACS·배포본을 보존했다. 이 문서는 전체 질문 대응 또는 의료 콘텐츠 승인이 아니다.

## 이번에 보완한 범위

기존 기본 검색의 후보4/보류4/부족18은 **동일 질문의 일반 개념 설명 후보26**으로 보완했다. 기존 HOLD107을 해제한 것이 아니라 별도로 확인한 Medical Tests 본문과 Health Topics 요약에서 프로젝트 한국어 개념 요약 초안을 작성했다. 전체 문서 재번역·파인튜닝·벡터DB 도입은 하지 않았다. 기존 1,017 등록/910 후보/107 HOLD 그대로이며 별도 개념 요약26개가 추가된다.

| 실제 검사 | 새 근거 |
|---|---|
| 키·체중·허리둘레·체질량지수 | [Obesity Screening](https://medlineplus.gov/lab-tests/obesity-screening/) |
| 혈압 | [Measuring Blood Pressure](https://medlineplus.gov/lab-tests/measuring-blood-pressure/) |
| 시력 · 좌 / 우 | [Vision Screening](https://medlineplus.gov/lab-tests/vision-screening/) |
| 청력 · 좌 / 우 | [Hearing Tests for Adults](https://medlineplus.gov/lab-tests/hearing-tests-for-adults/) |
| 혈색소 | [Hemoglobin Test](https://medlineplus.gov/lab-tests/hemoglobin-test/) |
| 공복혈당 | [Blood Glucose Test](https://medlineplus.gov/lab-tests/blood-glucose-test/) |
| 간 효소 AST | [AST Test](https://medlineplus.gov/lab-tests/ast-test/) |
| 간 효소 ALT | [ALT Blood Test](https://medlineplus.gov/lab-tests/alt-blood-test/) |
| 간 효소 γ-GTP | [GGT Test](https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/) |
| 혈청 크레아티닌 | [Creatinine Test](https://medlineplus.gov/lab-tests/creatinine-test/) |
| 신장기능 eGFR | [eGFR and GFR Tests](https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/) |
| 요단백 | [Protein in Urine](https://medlineplus.gov/lab-tests/protein-in-urine/) |
| 총콜레스테롤·HDL·LDL | [Cholesterol Levels](https://medlineplus.gov/lab-tests/cholesterol-levels/) |
| 중성지방 | [Triglycerides Test](https://medlineplus.gov/lab-tests/triglycerides-test/) |
| C형간염 항체 | [Hepatitis Testing](https://medlineplus.gov/lab-tests/hepatitis-testing/) |
| 폐기능검사 | [Lung Function Tests](https://medlineplus.gov/lab-tests/lung-function-tests/) |
| 흉부 방사선검사 | [X-Rays / Summary](https://medlineplus.gov/xrays.html) |
| 구강검진 | [Dental Exam](https://medlineplus.gov/lab-tests/dental-exam/) |
| 혈청 AFP | [AFP Tumor Marker Test](https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/) |
| 간 초음파 | [Ultrasound](https://medlineplus.gov/lab-tests/sonogram/) |
| 복부 CT | [CT Scans / Summary](https://medlineplus.gov/ctscans.html) |

[NLM 이용정책](https://medlineplus.gov/about/using/usingcontent/)은 Health Topics 요약뿐 아니라 Medical test information도 공공영역 범위에 명시한다. 이 범위만 활용하며 외부 참고문헌 본문·의료백과·약물자료·이미지를 수집/생성 근거로 넣지 않는다. 출처 표시는 Source: MedlinePlus, National Library of Medicine.이다. 미국 자료의 수치/대상자/검사 주기를 한국 기준으로 자동 승계하지 않는다. AFP 임신 선별 자료와 종양표지자 자료를 구분했다.

21개 원문 + 정책 페이지의 HTTP snapshot22개와 SHA-256 manifest는 `data/health-helper-scenario-evidence-20261012/`에 저장했다. snapshot HTML은 출처 추적용이고 모델 입력은 짧은 한국어 요약뿐이다. sourceUpdatedAt는 임의 추정하지 않고 null, 원문 확인일 2026-10-12를 따로 기록한다. 신규 한국어 문장은 프로젝트 작성 초안이지 공식 번역·독립 검토 PASS가 아니다.

## 구현 / 제한

- `src/health-helper-scenario-evidence.js`: 26개 명시적 검사 별칭·직접 근거·출처 절·적용 범위·초안 상태. 모델 호출 전 source snapshot/notes hash 검증.
- `scripts/build-health-helper-scenario-evidence.js`: 고정 HTTPS 출처22개만, redirect 금지·20초 timeout·2MB 상한·동시4개; 새 폴더에 배타적 생성.
- `scripts/medlineplus-local-preview.js`: opt-in `HIPASS_SCENARIO_EVIDENCE=1`, 별도 127.0.0.1:11440. 기존11438/11439 유지. 실제 인증 환자 API 아님.
- `src/health-helper-medlineplus.js`: 새 CONCEPT intent만 extractive 제한. Qwen이 한국어 근거 요약을 그대로 반환해야 하며 공백 외 변경/추가 설명은 거부한다. 기존 일반 후보 경로와 방문질문 relay 계약 유지.
- `public/ui/patient-helper.js`: 검증한 lab-tests 경로만 원문 링크 허용. 임의 lab-tests URL·query·fragment·다른 도메인 금지.
- 신규 단위/음성 테스트 및 `scripts/check-health-helper-scenario-candidate.js`: 기본26검색과 실제 로컬 모델 응답·보류/거부 경로 확인.

개인 결과·합성 CT/초음파 픽셀·시나리오 진단은 근거에 넣지 않았다. 실제 환자 인증·동의·정책·감사·DB·Gateway·PACS·배포/등록 변경 없음. 관련 FR-006~009 기록 주제 연계, FR-037~041 기존 감사 경계, FR-042~046 데이터 분리 유지. 의료 설명 부가기능의 신규 FR/NFR ID는 기존 승인 문서에서 추가 확인 필요하며 임의 번호를 만들지 않는다.

지원: `검사명 + 무엇인가요/개념/뜻/설명`의 일반 개념. 정상범위·개인 진단·치료·상승 원인·비교 의미·검사 준비·추적 주기·다중 phase·window/level은 짧은 요약만으로 답하지 않는다. 아직 근거/콘텐츠 검토 공백이다. 기존 수치 계산과 본인 기록 서버 계약 변경 없음.

## 발견한 실패와 보정

첫 AFP 응답은 정의를 빠뜨리고 한계만 설명했다. 첫 자유 재서술 초음파 응답은 근거에 없는 준비 사항과 혈류/기능 한계를 추가했다. schema/출처ID만 통과한 시스템 결과와 의학 설명 품질을 분리하며, 후자는 FAIL로 기록한다. 이후 CONCEPT의 본문을 근거와 공백 외 동일하게 제한하고 같은 오염 응답을 거부하는 테스트를 추가했다. 이 보정은 다른 모든 자유 재서술 경로가 안전하다는 증명이 아니다.

v2 smoke의 CT 본문은 공백 하나 차이로 test assertion FAIL였다. 런타임 계약이 허용한 공백 정규화와 테스트를 정렬했다. 원래 v1/v2 결과는 보존하며 최신 결과로 소급 변경하지 않는다.

## 검증

`node scripts/build-health-helper-scenario-evidence.js` exit0: 출처22, 개념26, 모델호출0.

`node --test test/health-helper-scenario-evidence.test.js test/health-helper-scenario-scope.test.js test/medlineplus-upload.test.js test/health-helper-medlineplus.test.js test/synthetic-health.test.js test/patient-helper.test.js` exit0, 33/33 PASS, 818.2223ms. 원문/요약 hash, 26기본질문, 개인입력·임상 거부, 모호한 다중 주제·미지원 intent·URL·출력 오염, 기존 비교·인증·질문 메모 회귀 범위. 전체 프로젝트 테스트/빌드는 미실행.

312개 평가 정의의 routing: CANDIDATE52(개념26 + 원문을 모델에 보내지 않는 injection26), INSUFFICIENT_EVIDENCE208, REFUSED26, PERSONAL_INPUT_NOT_SUPPORTED26. **312개 생성 품질 PASS가 아니다.** 나머지8질문 차원의 설명 공백을 거부로 처리한 것을 근거 확보 완료로 바꾸지 않는다.

최신 로컬 모델/HTTP v3: `node scripts/check-health-helper-scenario-candidate.js` exit0, 7/7 PASS. AFP17,359/19,988ms 등 실행별 시간은 이력별 result.json에 보존한다. 최신 생성3건의 시간은 AFP19,988ms, 초음파21,156ms, CT17,778ms이며 텍스트 공백 정규화 후 근거 요약 일치다. 음성/부족/보류4건은 3~9ms. 증적 `data/health-helper-scenario-check-20261012-v3/result.json`. 이 결과는 정확성 검수나 26주제 전체 모델 검증이 아니다.

실제 로컬 브라우저 웹에서 AFP 답변→출처 카드→원문 새 탭→담기→수정 동작 확인, 모바일390×844에서도 보정 후 AFP 동일 근거 요약 표시·출처 열기·담기·수정 확인. 모바일 증적 `.playwright-cli/page-2026-10-12T08-13-40-275Z.yml`, `output/playwright/scenario-evidence-mobile-20261012.png`. Playwright 스킬을 사용해 실제 DOM 조작과 원문 새 탭을 확인했으며 스크린샷만으로 모델 검증을 주장하지 않는다. 이 preview의 기록 선택기는 실제 인증 기록에 연결하지 않았고 비교 데이터가 없으며 서버 환자 화면으로 해석하지 않는다.

최종 웹 재질문에서도 근거 요약 동일성과 담은 질문의 수정 내용 유지 확인. 캡처 `output/playwright/scenario-evidence-web-final-20261012.png`. 이전 free-form 캡처 `scenario-evidence-web-20261012.png`는 이력이다.

현재 서비스 등록·배포, 실제 환자 API/설치형 PWA/전체 MVP는 NOT VERIFIED. 신규 증적은 DRAFT / UNASSIGNED, 의료전문가 검토 미실시. 커밋·푸시 없음.

## 다음 작업 한 개

AFP의 목적·단독 해석 한계·검사 간 역할·비교 조건을 각각 별도 권리/내용 검토 청크로 확장하고, 실제 인증 relay 계약에 연결하기 전 동일 정상·거부 브라우저 흐름을 검증한다. 현재 26개 일반 개념 보완을 원래 전체 시나리오 의학 질문 범위의 완료로 선언하지 않는다.
