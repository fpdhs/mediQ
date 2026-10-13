# AFP 상세 근거 후보 — DRAFT / UNASSIGNED

관찰일: 2026-10-12 KST
기준 코드: 시작 시 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + 기존 dirty changes. 기존 변경은 보존했다.
관련 범위: 환자 영상·검사 기록 화면 FR-006~009 연결 및 기존 감사 경계 FR-037~041. 건강 안내를 위한 신규 FR/NFR은 승인 문서에 아직 특정되지 않았다.

## 이번 단위

AFP 종양표지자에 관한 목적, 한계, 준비, 결과 비교를 네 개 독립 근거로 분리했다. 기존의 개념 설명(26개)과 `HOLD` 107개는 변경하지 않았다. 임신 선별 AFP 자료와 개인 합성 AFP 수치는 검색·답변 근거에서 제외한다.

| 의도 | 출처 절 | 초안의 범위 | 검증 상태 |
|---|---|---|---|
| 목적 | AFP Tumor Marker Test · What is it used for? | 다른 검사와 병행하는 평가·모니터링의 일반 설명 | 자동 구조/출처 검사 PASS · 전문가 검토 UNASSIGNED |
| 한계 | AFP Tumor Marker Test · What do the results mean? | 비암성 간 상태에서도 상승할 수 있고 일부 암에서 정상일 수 있음; 단독 진단 금지 | 자동 구조/출처 검사 PASS · 전문가 검토 UNASSIGNED |
| 준비 | AFP Tumor Marker Test · Will I need to do anything to prepare? | AFP 자체의 특별 준비 안내만 요약; 동시 검사의 지침은 검사기관에 확인 | 자동 구조/출처 검사 PASS · 전문가 검토 UNASSIGNED |
| 비교 조건 | How to Understand Your Lab Results · What is a reference range? | 검사기관별 참고범위·방법·단위 차이를 보고서와 함께 확인 | 자동 구조/출처 검사 PASS · AFP 검사법 동등성은 보증하지 않음 · 전문가 검토 UNASSIGNED |

원문: [AFP 종양표지자 검사](https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/) (2026-06-30 업데이트 표시 확인), [검사 결과 이해](https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/), [MedlinePlus 이용정책](https://medlineplus.gov/about/using/usingcontent/). 이용정책의 Medical Test 정보 공개영역과 출처표시 조건을 확인했다. 원문 HTML은 `data/health-helper-afp-evidence-20261012-v2/sources/`에서 SHA-256과 함께 보관한다. 세 페이지에서 링크된 제3자 자료·이미지는 수집하지 않았다.

## 구현과 출력 제한

- `src/health-helper-afp-evidence.js`: AFP 질문을 목적·한계·준비·비교 중 하나로만 분류. 복수 의도, 정상범위·수치·임신 AFP·주기·개인 판독 질문은 근거 부족, 암 확정/진단 질문은 거부한다.
- `src/health-helper-medlineplus.js`: AFP 상세 답변은 저장된 한국어 초안 전체와 일치해야 한다. 모델은 질문 메모도 초안에 고정된 한 문장만 돌려준다. 자유 재서술이나 추가 의료 설명은 거부한다.
- `scripts/build-health-helper-afp-evidence.js`: 제한된 공식 URL 세 개만 HTTPS, redirect 거부, 20초 timeout, 각 응답 2MB 제한으로 새 후보 v2에 해시 보관한다. v1은 이전 초안 기록이며 v2와 혼용하지 않는다.
- `scripts/medlineplus-local-preview.js`: 새 AFP 후보는 로컬 전용 11441번에서 별도 opt-in으로만 연다. 11438/11439/11440 포트와 기존 서비스에는 배포하지 않는다.
- 의료전문가 검토를 자동시험이나 과거의 검토자 승인으로 대체하지 않는다. 근거 요약은 한국어 프로젝트 작성 초안이며 MedlinePlus의 공식 번역물이 아니다.

## 검증

`node scripts/build-health-helper-afp-evidence.js` — exit 0, 노트 4개·출처 3개, `DRAFT / UNASSIGNED`.

`node --test test/health-helper-afp-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-medlineplus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/mobile-health-helper.test.js test/synthetic-health.test.js` — exit 0, 68/68 PASS. 네 intent 개별 근거·출처 allowlist·해시, 환자이름/수치/암 확정·임신·모호/다중 intent 거부, 모델입력에서 원 질문과 injection 문구 제외, 저장된 설명과 고정 질문 외 출력 차단, 기존 환자 API 인증·감사·모바일 계약 및 합성기록 회귀를 검사했다. 신규 AFP 근거 자체는 실제 환자 API에 연결하지 않았다. 자동 PASS는 임상 정확성 전문가 검토가 아니다.

Playwright headed 로컬 브라우저에서 11441 후보를 확인했다. 데스크톱은 AFP 목적→MedlinePlus 출처 링크→근거 서랍→질문 담기·수정, 모바일 viewport 390×844는 AFP 준비→출처 카드·이용조건→질문 담기·수정→정상범위 질문 `INSUFFICIENT_EVIDENCE`→암 확정 질문 `REFUSED`를 재현했다. 두 거부 응답은 `sources:[]`, `questions:[]`, `generationUsed:false`였고 기존에 담은 질문은 그대로 남았다. 일반 AFP 초안은 deterministic extractive result로 응답하며 Qwen 호출을 하지 않는다. 초기 Qwen 시도는 답에 근거문장에 없는 “혈청” 표현을 보태 exact-text 검증에 거부됐고, fail-closed를 유지하면서 후보 preview에 초안 그대로 표시하도록 바꿨다. 이 수정은 로컬 개발 후보만 대상으로 한다.

스크린샷: desktop 정상/질문 편집 상태는 [web evidence](../../.playwright-cli/page-2026-10-12T09-47-55-545Z.png), 모바일 근거 부족과 보관 질문은 [mobile insufficient](../../.playwright-cli/page-2026-10-12T09-55-20-138Z.png), 거부 응답과 보관 질문은 [mobile refused](../../.playwright-cli/page-2026-10-12T09-56-28-026Z.png). 화면은 로컬 후보이며 실제 로그인 세션이나 설치된 PWA 화면이 아니다.

기존 환자 API는 `POST /api/v1/me/health-helper/questions`에서 PATIENT principal, patientId, body 검증 후 현재 `HealthHelperRag`로 위임하고 요청 결과를 감사 기록한다. 기본 구성은 `SOURCE_GUIDANCE`; Ollama가 활성화된 구성은 `VISIT_PREPARATION`으로, 사용자가 묻는 의료 설명을 후보 근거에서 생성하는 경로와 계약이 다르다. 승인된 `health-helper-corpus`만 일반 생성에 허용되고 이 새 `DRAFT / UNASSIGNED` 근거는 허용되지 않는다. 이번에는 API, 모델 relay, DB, 권한, 감사 계약을 변경하지 않았다.

실제 서비스 연결·원격 배포·복구는 수행하지 않았다. 콘텐츠 검토 주체가 미지정이며 현재 모델 계약도 방문질문 전용이므로 실제 환자 API에 이 초안을 연결하는 것은 `NOT VERIFIED`. 로컬 browser proof는 완료했지만 운영 웹·설치 PWA·인증 세션에서 검증된 것이 아니다.

## 남은 작업

1. AFP 근거 4개에 대해 의료정보 전문가가 문장별 정확성·적용 범위를 검토하고 이름·날짜·판정·예외를 별도 남긴다.
2. 검토 후 실제 API의 evidence version/allowlist와 출력 검증 계약을 업데이트하고 환자 인증·권한·감사 회귀를 확인한다.
3. 동일 AFP 정상 질문, 암 확정·수치 해석 거부, 미지원/모호 질문, 질문 카드 담기·수정 흐름을 실제 배포 웹·모바일에서 재현한다.
4. 승인된 릴리스 절차·복구 검증 후 같은 브라우저 시나리오를 배포본에서 다시 수행한다.
5. AFP 완료 후 간기능, 초음파·CT, 남은 건강검진 주제로 순차 확장한다. 전체 주제 완수·MVP/v3 완료는 아직 선언하지 않는다.
