# 건강도우미 RAG 질문 의도별 근거 검색 및 모델 호출 안정성 개선 — 2026-10-14

## 작업 목적

건강도우미(Health Helper) 한국어 번역 RAG 시스템에서 질문 의도(검사 목적, 검사 전 준비사항, 결과 한계, 비교 의도)별 근거 검색 정확도를 향상시키고, 로컬 relay 동시성 큐 대기와 일시적 오류 시 transient retry를 통해 모델 호출 안정성을 개선한다. 학교 발표용 비임상 MVP/PoC 범위를 엄격히 유지하며, 실환자 개인정보 및 임상 진단 추론을 일체 사용하지 않는다.

## 관련 요구사항

- VNFR-USA-001: 사용자 의도에 부합하는 명확하고 자연스러운 상태 및 건강 정보 안내.
- VNFR-AVL-001: 모델 호출 유한 타임아웃(30초) 및 SSH 소켓/릴레이 가용성 보장.
- FR-037~041: 감사 기능군 보존 및 모델 입력 최소화 원칙 준수 (원 질문, 환자 식별자, 검사 수치 미전송).
- RAG 교육 정보 기능은 기존 FR-001~046 의료영상 교류 핵심 기능의 신규 구현 완료로 집계하지 않는다.

## 분석한 기존 구조

1. **질문 검색 라우팅 한계**:
   - `src/health-helper-school-demo-medical-tests.js`의 `retrieveSchoolDemoMedicalTestEvidence`에서 질문 키워드 정규식이 좁게 설정되어 있어 "AFP 검사 목적은 무엇인가요?", "초음파 검사는 왜 하나요?" 등 자연스러운 환자 질문이 `INSUFFICIENT_EVIDENCE`로 빠지는 문제가 존재함.
   - 모든 세그먼트 선택 시 `intent`가 `'UNDERSTAND'`로 고정되어 검사 목적(`PURPOSE`), 검사 결과 한계(`LIMITATIONS`) 구분이 미흡했음.
2. **모델 전송 및 Relay 동시성 간헐적 실패**:
   - `scripts/health-helper-local-relay.js`에서 단일 요청 실행 중 다른 요청이 들어올 때 즉시 `429 BUSY`를 반환하여, Azure 배포 직후 최초 검증 시 소켓 지연 및 일시적 충돌로 `SOURCE_GUIDANCE`로 fallback되는 현상이 발생함.
   - `src/health-helper-patient-translation.js`의 `patientTranslationFetch`에 transient error 대응 로직이 부재하여 일시적 소켓 리셋이나 429 수신 시 즉시 실패함.
   - 모델 실패 원인(Error reasonCode)이 캡처되지 않고 삼켜져 사후 관측(Observability)이 어려웠음.

## 수정한 파일

- `src/health-helper-school-demo-medical-tests.js`:
  - `select` 함수에 `intent` 파라미터 추가 (`UNDERSTAND`, `PURPOSE`, `LIMITATIONS`).
  - AFP 정의/목적 (`AFP-DEF-01`), 결과 한계 (`AFP-LIMIT-01`), 간 초음파 복합 감시 (`AFP-USE-01`) 라우팅 확장.
  - 초음파 정의 (`US-DEF-01`), 목적/활용 (`US-USE-01`), 부위/장기 (`US-USE-02`) 라우팅 지원.
- `scripts/health-helper-local-relay.js`:
  - `acquireLock` 큐 대기 로직 추가 (최대 1,000ms 동안 40ms 간격으로 대기 후 획득, 찰나의 동시 요청 및 재시도 충돌 방지).
- `src/health-helper-patient-translation.js`:
  - `patientTranslationFetch`에 transient error/429 발생 시 400ms 지연 후 1회 재시도(transient retry) 로직 추가.
  - `createPatientTranslationRag`에서 모델 실패 시 `generationFailureReason` 내부 진단 메타데이터 기록 (환자 화면 비노출 유지).
- `test/health-helper-school-demo-medical-tests.test.js`:
  - 질문 의도별 (검사 목적, 한계, 정의, 부위) 라우팅 검증 단위 테스트 추가.

## 구현한 기능

1. **질문 의도별 근거 검색 정확도 개선**:
   - `AFP 검사는 무엇을 확인하나요?`, `AFP 검사의 목적은 무엇인가요?`, `AFP는 왜 검사하나요?` -> `AFP-DEF-01` (`UNDERSTAND`)
   - `AFP 검사만으로 암을 진단할 수 있나요?`, `AFP 검사 결과만으로 암을 선별하거나 진단할 수 있나요?` -> `AFP-LIMIT-01` (`LIMITATIONS`)
   - `간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?`, `AFP와 간 초음파는 왜 함께 쓰이나요?` -> `AFP-USE-01` (`PURPOSE`)
   - `초음파는 어떤 검사인가요?`, `초음파 검사의 원리는?` -> `US-DEF-01` (`UNDERSTAND`)
   - `초음파 검사는 왜 하나요?`, `초음파 검사의 목적은 무엇인가요?` -> `US-USE-01` (`PURPOSE`)
   - `간 초음파는 어떤 장기를 살펴볼 수 있나요?`, `간 초음파로 어디를 검사하나요?` -> `US-USE-02` (`UNDERSTAND`)
   - 개인 수치 해석 질문(`제 AFP 결과가 간암을 뜻하나요?` -> `PERSONAL_INPUT_NOT_SUPPORTED`) 및 모호한 수치 질문(`AFP 수치가 높으면 무슨 뜻인가요?` -> `INSUFFICIENT_EVIDENCE`)의 보수적 거부 유지.
2. **Relay 및 모델 전송 안정성 개선**:
   - 로컬 Relay에서 동시 요청 시 즉시 429를 반환하는 대신 최대 1,000ms 동안 락을 대기하여 안전하게 순차 처리.
   - Azure `patientTranslationFetch`에서 일시적인 429 또는 연결 지연 시 1회 빠른 재시도 수행.
   - 모델 실패 원인(`generationFailureReason`)을 내부 필드로 캡처하여 장애 원인 추적 가능.
3. **환자 안전 및 비노출 불변식 유지**:
   - `QA HOLD`, `UNASSIGNED`, `색인 PASS` 등 내부 검수 용어의 환자 화면(`answer`, `contextNote`) 노출 차단 유지.
   - 모델 장애 시 안전한 원문 안내 (`SOURCE_GUIDANCE`) 제공.

## 보안 검토

- 환자 Entra 인증, 신뢰된 Ingress 검증, 서버 PATIENT 역할 검증 유지.
- 모델 호출 시 환자 개인정보, 원 질문, 수치 데이터 미전송 원칙 엄수 (검색된 한국어 근거 인덱스만 전달).
- SQL Injection, XSS 위험 없음 (파라미터화 바인딩 및 React/DOM textContent escaping 준수).
- Git clean/reset 금지 준수 (작업트리의 다른 모듈 보존).

## 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| 의도별 라우팅 및 단위 회귀 | PASS | `test/health-helper-school-demo-medical-tests.test.js` 8/8 통과 |
| 환자 번역 RAG 및 Fallback 회귀 | PASS | `test/health-helper-patient-translation.test.js` 통과 |
| 후보 생성 및 전송 분리 회귀 | PASS | `test/health-helper-candidate-generation.test.js` 통과 |
| RAG 핵심 로직 및 안전 정책 | PASS | `test/health-helper-rag.test.js` 통과 |
| HTTP 어댑터 및 역할/입력 검증 | PASS | `test/health-helper-http.test.js` 통과 |
| 환자 UI 인터랙션 및 상태 관리 | PASS | `test/patient-helper.test.js` 통과 |
| 전체 건강도우미 통합 테스트 스위트 | PASS | 66/66 통과 (3,013ms) |
| 학교 데모 의학검사 Holdout 평가 | PASS | `evaluate-health-helper-school-demo-medical-tests.js` 10/10 PASS |
| MedlinePlus 코퍼스 Holdout 평가 | PASS | `evaluate-medlineplus-upload-holdout.js` PASS |
| 실제 Entra 환자 로그인 후 브라우저 질문 | NOT VERIFIED | 사용자 지침에 따라 실제 로그인은 추후 진행으로 합의됨 |
| 실제 PACS 및 실제 환자 데이터 연결 | NOT VERIFIED | 학교 발표용 가상 MVP/PoC 범위 제외 |

## 남아 있는 위험 및 미검증 사항

1. 로컬 PC/Ollama/SSH 릴레이 인프라 의존성:
   - Azure 환경에서 Qwen 생성 모델 호출은 로컬 PC의 Ollama 데몬 및 SSH 소켓 터널이 유지되어야 정상 작동하며, PC가 종료되거나 SSH 터널이 닫히면 자동으로 검증된 번역 근거 안내(`SOURCE_GUIDANCE`/`RETRIEVED`) 모드로 안전하게 fallback됩니다.
2. 실제 Microsoft Entra 환자 계정 로그인 상태에서의 브라우저 E2E 테스트는 추후 검증 예정입니다 (`NOT VERIFIED`).
