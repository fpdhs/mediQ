# 건강도우미 RAG 환자 한국어 표현 정제 및 단위 정규화 파이프라인 고도화 — 2026-10-14

## 작업 목적

MedlinePlus 한국어 번역 코퍼스 정밀 검수에서 식별된 환자 경험 저해 요인(미국식 화씨 체온 직역에 따른 102°C 오인 위험, "당신" 2인칭 대명사 직역, "의사와 이야기하세요" 같은 기계적 직역투, "의료 제공자(Provider)" 등)을 실시간 환자 프레젠테이션 레이어에서 자연스럽고 안전한 한국어 표현으로 교정하는 정제(Refinement) 파이프라인을 도입한다.

## 핵심 아키텍처 원칙 준수

- **Control Plane 및 코퍼스 원본 해시 무결성 보존**:
  - `data/medlineplus-upload-ko-20261012-v3/` 원본 번역 파일들의 해시 검증(`sha256(chunk.text_ko) === chunk.textSha256`, `bundleSha256` 등)을 손상시키지 않기 위해 원본 파일을 변경하지 않습니다.
  - 환자에게 응답이 최종 전달되는 `patientPresentation(result)` 레이어에 정제 파이프라인을 적용하여, 원본 데이터 무결성과 환자 UI 가독성을 동시에 완벽히 만족합니다.
- **불변식 유지**:
  - `QA HOLD`, `UNASSIGNED`, `색인 PASS` 등 내부 검수 용어의 환자 화면 비노출 유지.
  - `answer.answer === answer.sources[0].excerpt` 계약 일관성 유지.
  - 모델에 환자 식별자, 원 질문, 수치 미전송 원칙 엄수.

## 생성한 파일

- `src/health-helper-korean-refinement.js`:
  - 화씨 체온 $\to$ 섭씨 변환/병기 (`102를 넘는 열` $\to$ `38.9°C(화씨 102°F)를 넘는 고열`).
  - 2인칭 대명사 정제 (`당신이` $\to$ `환자분이`, `당신의` $\to$ `본인의`, 주어 생략).
  - 의료 상담 표현 교정 (`의사와 이야기하세요` $\to$ `의료진과 상담하세요`, `주치의와 이야기하세요` $\to$ `주치의와 상의하세요`).
  - 의료 제공자 어휘 및 한국어 조사 음운 규칙 처리 (`의료 제공자가` $\to$ `의료진이`, `의료 제공자는` $\to$ `의료진은`, `건강관리 제공자` $\to$ `담당 의료진`).
  - 소아 질환 소유격 직역 완화 (`아이의 의료진은` 반복 $\to$ `소아청소년과 의료진은`).
- `test/health-helper-korean-refinement.test.js`:
  - 5개 핵심 정제 패턴 단위 테스트 (5/5 PASS).

## 수정한 파일

- `src/health-helper-patient-translation.js`:
  - `patientPresentation`에 `refinePatientMedicalKorean`을 통합하여 `answer`, `sources[].excerpt`, `claimEvidence`에 일관되게 정제 적용.
- `test/health-helper-patient-translation.test.js`:
  - 환자 프레젠테이션 단계에서 화씨 변환 및 어색한 번역투 교정 검증 통합 테스트 추가 (PASS).

## 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| 정제 모듈 단위 테스트 | **PASS** | `test/health-helper-korean-refinement.test.js` 5/5 통과 |
| 환자 RAG 및 프레젠테이션 통합 회귀 | **PASS** | `test/health-helper-patient-translation.test.js` 5/5 통과 |
| RAG 핵심 로직 및 안전 정책 | **PASS** | `test/health-helper-rag.test.js` 통과 |
| HTTP 어댑터 및 역할/입력 검증 | **PASS** | `test/health-helper-http.test.js` 통과 |
| 환자 UI 인터랙션 및 상태 관리 | **PASS** | `test/patient-helper.test.js` 통과 |
| 의료검사 의도 라우팅 회귀 | **PASS** | `test/health-helper-school-demo-medical-tests.test.js` 8/8 통과 |
| 후보 생성 및 전송 분리 회귀 | **PASS** | `test/health-helper-candidate-generation.test.js` 통과 |
| 전체 건강도우미 통합 테스트 스위트 | **PASS** | 72/72 통과 (3,429ms) |
| 학교 데모 의학검사 Holdout 평가 | **PASS** | `evaluate-health-helper-school-demo-medical-tests.js` 10/10 통과 |
| MedlinePlus 코퍼스 Holdout 평가 | **PASS** | `evaluate-medlineplus-upload-holdout.js` 통과 |
| 실제 Entra 환자 로그인 후 질문 제출 | **NOT VERIFIED** | 사용자 합의 지침에 따라 실제 로그인은 추후 진행으로 분리 |
| 실제 PACS 및 실제 환자 데이터 연결 | **NOT VERIFIED** | 학교 발표용 가상 MVP/PoC 범위 제외 |
