# 환자 건강도우미 RAG 후보자료 지속 개선·승격 계획

작성일: 2026-10-13 (Asia/Seoul)
상태: **권고안 / 실행계획 초안 · 임상·권리·운영 승인 아님**

## 사용자 범위 결정 — 2026-10-13

사용자 지시에 따라 학교 발표용 MVP 경로를 활성 범위로 선택했다. 이 경로에서는 별도 출처·번역·임상·편집 검토자 배정 및 30개 claim 검토를 진행 항목에서 제거한다. 아래의 이전 환자 서비스 승격 제안과 기존 검토 문서·빈 양식은 역사 기록이며 최신 범위 결정을 대체하거나 학교 데모의 실행 조건으로 쓰지 않는다.

범위 재확인: 사용자 제공 한국어 번역으로 학교 데모 RAG를 진행하고 별도 검토자를 배정하지 않는다. 요청에 따라 활성 데모 코퍼스 1,019개 자료를 코퍼스 채택 `PASS`로 표시한다. 이 PASS는 데모 검색 후보 채택을 뜻하며, 콘텐츠 QA·번역 의미 정확성·임상 검증 상태와 분리한다. 기존 콘텐츠 QA HOLD와 미해결 이슈는 그대로 표시한다. 별도 Qwen 번역 초안(134 완료·45 자동 HOLD)은 이번 활성 코퍼스 및 PASS 집계에 포함하지 않는다. 현재 구현·검증 결과는 [학교 발표용 RAG 실행 기록](./health-helper-school-demo-rag-2026-10-13.md)을 기준으로 한다.

발표용 RAG는 사용자 제공 한국어 번역 코퍼스를 검색 지식베이스로 사용한다. 별도 학교 데모 프로필은 1,017개 Health Topics와 2개 Medical Tests를 데모 번역 후보 `PASS`로 색인하고, 자동 QA `HOLD` 109건과 미해결 이슈를 별도 표시한다. 후보 `PASS`는 데모 코퍼스 채택일 뿐 번역·내용·임상 승인이 아니다. QA 통과 전용 프로필은 910개 문서만 색인하고 HOLD는 제외한다. 두 프로필 모두 `DRAFT / UNASSIGNED`이며 환자 API에 연결되지 않는다. 검색은 한국어 번역 제목·별칭·본문만 사용하고, 모델에는 초점 분류와 허용된 한국어 근거 문장만 보내며 원문 질문·영어 원문은 보내지 않는다. Qwen 가중치 학습·파인튜닝은 하지 않는다.

이 결정은 합성 질문만 받는 학교 발표용 비임상 데모에 한정한다. 진단·치료, 개인 기록 해석, 환자 API 연결, 실제 환자 서비스 배포에는 적용하지 않는다. 화면에서 번역 기반 데모와 비임상 범위를 표시한다. 환자 서비스의 기존 승인·보안 게이트는 별도 범위로 유지한다.

## 1. 권고 요약

RAG는 일반적으로 모델 가중치를 후보문서로 계속 학습시키는 방식이 아니다. 이 프로젝트에서는 후보자료를 검수·버전관리하고, 승인된 문서 조각을 검색 코퍼스에 반영하는 **지식베이스 갱신**으로 진행한다. 파인튜닝이나 외부 임베딩 서비스는 현재 필요하지 않으며, 개인 환자기록을 학습자료로 쓰지 않는다.

현재 환자용 API는 로컬 Qwen 설정이 있으면 `VISIT_PREPARATION`, 없으면 `SOURCE_GUIDANCE` 경로를 사용한다. 의료 설명 후보를 모으는 `health-helper-education-retrieval` 및 MedlinePlus 후보 경로는 별도 개발·로컬 검토 경로이며 환자 API의 승인된 임상 코퍼스가 아니다. 따라서 이번 권고는 후보를 운영 답변에 즉시 연결하는 것이 아니라, **후보 → 검수 → 평가 → 승인 가능한 불변 버전**의 반복 절차를 확립하는 것이다.

## 2. 현재 후보 기준선

저장소의 문서·코드·로컬 후보 manifest에서 확인한 값이다. 로컬 ignored 데이터가 기준이므로 Git clone만으로 재현된다는 뜻은 아니다.

| 후보 묶음 | 확인 상태 | 사용 제한 |
|---|---|---|
| 정적 RAG 소스 후보 `health-ko-20261011-candidate-v3` | 3개 출처·9개 청크, `eligibleCount=0` | 서울아산 AFP 3개와 질병관리청 간기능 5개는 RAG 재사용 허가·근거 및 콘텐츠 검토 미완료. 의왕시 보건소 1개는 제1유형 근거가 있지만 콘텐츠/청크 검토가 미배정 |
| 사용자 제공 MedlinePlus 한국어 후보 v3 및 별도 Medical Tests 부록 | 기반 후보: 1,017개 등록. QA-pass-only: 910개 문서·17,019개 청크. 학교 데모 전체 번역: 1,017개 문서·20,338개 청크. 별도 부록 2개 문서·9개 청크. 기존 HOLD 107건·미해결 111건, 부록 QA HOLD 2건 유지 | 부록을 포함한 데모 검색 뷰는 1,019개 문서·20,347개 청크다. 전체 번역 포함은 학교 데모 프로필에만 해당하며 출처 상태를 표시한다. 색인 PASS와 AI QA PASS는 임상 승인이나 번역 검수 완료가 아니며, 어떤 프로필도 환자 서비스 승격을 뜻하지 않는다 |
| 검사 개념 후보 | 26개 시나리오 개념과 AFP·간기능·영상·검진 상세 후보 코드가 존재 | 결과는 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false` |
| 환자 서비스 | 기존 인증 API·감사 경로와 질문 준비·원문 안내가 확인됨 | 개인 기록 해석은 연결하지 않음. 후보 교육 코퍼스의 서비스 승격은 확인되지 않음 |

후보 수와 구체적 제한의 근거는 [MedlinePlus 업로드 기록](./medlineplus-upload-20261012.md), [시나리오 근거 기록](./health-helper-scenario-evidence-20261012.md), 현재 [통합 검색 구현](../../src/health-helper-education-retrieval.js), [업로드 코퍼스 게이트](../../src/medlineplus-upload-corpus.js)다.

## 3. 지속 개선 절차

각 단계의 상태는 서로 독립적으로 기록한다. 예를 들어 번역 자동검사 PASS가 권리 확인이나 임상 검토 PASS로 승격되어서는 안 된다.

1. **접수·출처 고정**: 원본 제공자, 정확한 URL/자료 유형, 수집일, 원문 버전·해시, 허용 이용범위와 근거를 기록한다. URL이 같더라도 본문 해시가 달라지면 새 후보 버전으로 취급한다.
2. **권리 검토**: 저장, 발췌, 번역, 검색, 화면표시, AI 재서술 각각의 허용 범위를 확인한다. 불명확한 자료는 `LINK_ONLY` 또는 `HOLD`이며 답변 코퍼스에 넣지 않는다.
3. **번역·콘텐츠 검토**: 원문과 한국어를 문단 단위로 연결하고 숫자, 단위, 부정, 비교, 조건, 연령·대상 범위를 검토한다. 자동 QA 결과와 사람 검토 결과를 별도 필드로 보존한다.
4. **청크·색인 후보 생성**: 원문 문맥과 출처 식별자를 유지하는 결정적 분할을 적용한다. 청크 텍스트와 원문 참조 해시를 보존한다. 임베딩은 측정된 검색 실패가 키워드/별칭 검색으로 해결되지 않고, 권리·데이터 처리 검토가 끝난 뒤에만 별도 ADR로 검토한다.
5. **검색 평가**: 환자 합성정보가 없는 고정 평가셋으로 예상 출처·검색 상태·보류·거부·근거 부족을 측정한다. 복수 주제·복수 의도·정상범위·수치 해석·개인정보·프롬프트 인젝션 질문도 포함한다.
6. **응답 평가**: 초기에는 승인된 문장만 추출하는 응답을 우선한다. 생성형 답변을 시험할 때 각 문장이 검색 근거로 뒷받침되는지, 출처 링크·문서 범위가 맞는지, 수치·진단·치료 조언이 새로 생기지 않는지 별도로 검토한다.
7. **승인된 릴리스 패키지 생성**: 아래 승격 조건을 모두 만족한 정확한 코퍼스·검색기·프롬프트 버전을 읽기 전용 산출물로 고정한다. 후보 폴더를 직접 수정해 운영본으로 사용하지 않는다.
8. **제한 배포·관찰·롤백**: 실제 환자 서비스를 대상으로 할지는 별도 PM·보안·임상 승인을 받는다. 배포 시 이전 패키지로 되돌릴 수 있어야 하며, 첫 오류만으로 후보 게이트를 완화하지 않는다.

## 4. 상태 모델과 승격 조건

문서마다 다음 상태를 별도 관리한다.

```text
rightsStatus:       UNASSESSED | LINK_ONLY | CLEARED | HOLD
translationStatus:  NOT_REQUIRED | DRAFT | REVIEWED | HOLD
clinicalReview:     UNASSIGNED | PENDING | APPROVED | REJECTED
retrievalEval:      NOT_RUN | FAIL | PASS
releaseStatus:      CANDIDATE | APPROVED | REVOKED
```

검색 가능한 **서비스 승인 근거**가 되려면 모두 충족해야 한다.

- 해당 사용 방식(검색·인용·번역·재서술)에 대한 권리 확인과 근거 기록
- 원문·번역·청크 해시가 검토된 버전과 정확히 일치
- 필요한 경우 적격 검토자의 한국어 번역 및 임상 내용 승인
- 예상 검색 결과, 출처 일치, 보류·거부·개인정보 테스트 PASS
- 미지원 질문에서 안전한 근거 부족 응답, 지원 질문에서 출처와 근거 범위 일치
- 별도 담당자가 릴리스 패키지·롤백 기준을 확인하고 승격 승인

현재 저장소의 자동 검사나 AI QA만으로 위 승인 상태를 설정하지 않는다. HOLD 자료의 상태 변경에는 문제 해결 근거와 새 해시, 사람 검토를 요구한다.

## 5. 평가 기준 권고

평가셋은 검색 기준 질문과 금지/보류 질문을 모두 포함하고, 예상 출처 ID·허용 결과·필수 근거를 고정한다. 각 코퍼스 버전마다 동일한 집합을 재실행해 이전 버전과 비교한다.

| 지표 | 개발 게이트 권고 |
|---|---|
| 지원 질문의 올바른 출처 검색 Recall@3 | 95% 이상을 초기 목표로 제안; 임상 승인 기준은 아님 |
| HOLD/권리 미확인 자료의 검색 노출 | 0건 |
| 개인정보·개인 수치 질문의 거부/미지원 처리 | 100% |
| 진단·치료·응급 조언 요청의 안전 거부 | 100% |
| 출처 없는 인용 및 평가에서 확인된 중대 비근거 주장 | 0건 |
| 평가 실행 재현성 | 동일 입력·버전에서 결과와 해시가 동일 |

Recall 목표를 통과해도 의학적 정확성이 입증되는 것은 아니다. 임상 검토와 권리 승인을 대체하지 않는다. 합성 사용자 질문 외 실제 환자 질문을 평가 수집에 사용하지 않으며, 실패 분석은 가능한 한 질문 원문 대신 오류 유형·검색 결과 ID만 남긴다.

## 6. 우선 실행 배치

첫 배치는 전체 1,017건 재처리보다 **범위가 좁고 실패 원인을 설명할 수 있는 CT·초음파 일반 개념 후보**로 제한할 것을 권고한다. AFP의 간경변증 간접 참조는 AFP 전용 근거로 승격하지 않는다. A1C 등 HOLD 항목은 해결 전 평가 정답으로 사용하지 않고, HOLD 제외 회귀 사례로만 둔다.

이 절의 검토자 배정은 이전 환자 서비스 승격 계획이며, 사용자 결정에 따라 학교 발표용 MVP의 활성 작업에서 제외했다. 학교 데모는 기존 번역 코퍼스와 자동 QA/HOLD 구분을 사용하며 별도 검토자 계정을 요구하지 않는다.

## 7. 이 실행에서 수행한 작업과 제한

- 후보 코퍼스 manifest, 격리된 후보 검색기, 현재 환자 API 모드를 대조해 지속 개선 절차와 승격 게이트를 이 문서로 정리했다.
- `node scripts/health-helper-source-inventory.js`를 실행해 정적 RAG 후보 3개 출처·9개 청크, 승인 가능한 의료 근거 0개를 확인했다. MedlinePlus 910개 업로드 후보는 별도 로컬 후보 코퍼스이며 이 인벤토리 결과와 혼합하지 않는다.
- `node --test test/medlineplus-upload.test.js test/health-helper-education-retrieval.test.js test/health-helper-scenario-evidence.test.js test/health-helper-source-inventory.test.js` 결과는 **15/15 PASS** (0.618초). 이 시험은 후보 해시·HOLD 제외·개인정보/임상 거부·검색 범위·승인 게이트의 코드 계약을 확인하며 임상 품질 승인이나 배포 PASS가 아니다.
- 현재 작업트리의 기존 변경은 보존했다. 환자 API·DB·모델 설정·승인 상태·후보 코퍼스·배포본은 변경하지 않았다.
- 새 모델 호출, 번역 배치 재개, 후보를 서비스 코퍼스에 승격하는 동작 및 배포는 수행하지 않았다. 이는 임상/권리 검토 미배정 상태에서 안전하게 할 수 있는 다음 단계가 아니기 때문이다.
- 문서는 권고 초안이며 요구사항 승인, 의학 검증, 의료기관 운영 승인으로 간주할 수 없다.
- 후속 원문 섹션 감사에서 간기능·검진 후보 93개의 `section`을 저장된 공식 페이지 스냅샷 제목(H1–H6)과 대조했다. 잘못된 제목 연결 9건을 확인하고 메타데이터만 수정했으며, 새 source snapshot verifier가 섹션 제목 불일치를 fail closed하도록 했다. 이는 구조적 추적성 검사로 한국어 요약의 임상적 정확성이나 재사용 권한 승인이 아니다.
- 교차검사 16개 후보 중 AFP는 다른 검사와 함께 사용되는 범위를 보다 직접적으로 설명하는 `afp-detail-purpose`로 재연결했다. 다른 후보 요약 문구를 새로 작성하거나 서비스 적격 상태를 변경하지 않았다.
- [문장별 출처 locator JSON](./health-helper-cross-test-source-locators-2026-10-13-v2.json)을 생성했다. 16개 후보·30개 한국어 문장의 후보 해시, 허용 목록 원문 URL, 스냅샷/페이지 해시, heading-bounded HTML fingerprint를 연결한다. 의미상 지지 여부는 모든 문장에서 `UNASSESSED`다.
- MedlinePlus 공식 이용정책이 의료검사 정보를 공공영역 범주로 열거한다는 점을 확인해 [범위 점검 메모](./health-helper-medlineplus-rights-scope-2026-10-13.md)에 16개 후보/14개 고유 `/lab-tests/` URL의 제한된 매핑을 기록했다. 정책 근거는 남겼지만 프로젝트/제품 승인 상태는 `PENDING`이며 서비스 승격이나 법률 판단을 의미하지 않는다.
- 현재 실제 웹 경로도 재확인했다. `src/server.js`는 `/api/v1/me/health-helper/questions`의 `HealthHelperRag`를 `VISIT_PREPARATION`(로컬 Ollama 설정 시) 또는 `SOURCE_GUIDANCE`로 생성하고, 환자 서비스 쪽에서 `health-helper-education-retrieval.js`를 호출하지 않는다. 312문항/16개 후보 평가는 격리된 로컬 retrieval 결과이며 환자 화면 RAG 성능으로 보고하지 않는다. 관련 경계 회귀를 `test/health-helper-rag.test.js`에 추가했다.
- 수정 뒤 집중·통합 회귀 `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-source-inventory.test.js test/health-helper-cross-test-source-locators.test.js`는 **75/75 PASS**. section heading/manifest/hash, 16개 후보 선택, 30개 sentence locator, 미승인 후보가 patient-service model에 전달되지 않는 경계와 기존 거부·보류·감사 계약을 확인했다.

### 2026-10-13 출처 최신성 메타데이터 보강

- 16개 교차검사 후보의 14개 고유 MedlinePlus 페이지에서 고정된 HTML 스냅샷의 명시적 `Last updated` 표기를 추출했다. 날짜는 페이지 원문 갱신 표시일이며, 이번 실행일이나 재조회일로 대체하지 않았다.
- 날짜는 해시 고정된 후보 `notes.json`에 덮어쓰지 않고 URL별 파생 메타데이터로 분리했다. 각 후보 응답의 `source_updated_at`와 [locator v3](./health-helper-cross-test-source-locators-2026-10-13-v3.json)는 HTML 날짜·URL 매핑·응답 메타데이터가 일치할 때 생성된다. 최신 [locator v4](./health-helper-cross-test-source-locators-2026-10-13-v4.json)는 해당 자료에 문단 locator도 추가한다. 추출 누락·모호성·불일치는 fail closed다.
- locator v2·v3는 기존 증적으로 보존한다. v4는 후보·문장 해시, 페이지 snapshot hash, 섹션 fingerprint, 원문 갱신일에 더해 제목 구간의 문단 ordinal/hash를 기록한다. 16개 후보와 30개 주장의 의미상 지지는 여전히 `UNASSESSED`; 임상·번역·제품·법률 승인, 현재 웹페이지 재검증 또는 서비스 적격성은 뜻하지 않는다.
- RAG 지속 개선에 대한 권고는 **모델 가중치 재학습이 아니라 승인된 지식베이스의 버전 단위 갱신**이다. 후보별 권리·번역·임상 검토와 정확한 본문 해시 승인을 받은 뒤, 승인된 문장만 검색·인용하고 고정 합성 평가셋으로 이전 버전과 비교한다. 지금은 사람 검토 패킷 보강과 격리 후보 검색·회귀만 진행하며 patient API 연결, embedding/LLM 학습, 배포는 하지 않는다.
- 이번 날짜 추출기는 누락·복수 일자·잘못된 달력 날짜를 `null`로 처리하는 단위시험을 포함한다. 날짜 메타데이터는 임상 근거 품질 향상으로 집계하지 않는다.

### 2026-10-13 추가 검색 평가·보완

- `scripts/evaluate-health-helper-scenario-retrieval.js`를 추가해 로컬 합성 평가셋 312건을 재현 가능하게 평가한다. 출력에는 평가셋 SHA-256과 교육 검색·방문준비 관련 소스파일별 SHA-256을 포함한다. 원문 질문은 결과 보고서에 덤프하지 않는다.
- `src/health-helper-liver-evidence.js`에서 `간 효소 AST/ALT/GGT`를 전체 간기능 패널로 오분류하던 분류조건을 좁혔다. 상세 효소 후보 9개 목적·한계·준비 질의와 3개 비교 질의가 검색되며, 개별 효소와 간기능 패널을 동시에 지칭하는 모호한 질의는 계속 근거 없이 거부한다.
- `src/health-helper-visit.js`의 일반 진료준비 경로에 합성 평가셋의 26개 고정 주제 allowlist를 추가하고 계약 버전을 `visit-preparation-20261013-v2`로 올렸다. 이 경로는 프로젝트 작성의 일반 질문준비 지침만 모델에 보내며, 환자 원문·검사값·의료 설명 후보를 보내지 않는다. 둘 이상의 주제 또는 미등록 주제는 거부한다. 이는 FHIR/MedlinePlus 근거검색의 확장이 아니다.
- 당시 312건 평가 결과: 일반 질의 208건 중 교육 근거검색 후보 131건(62.98%), 근거 부족 77건. 의도별로 `EXPLAIN` 105/156 후보, `COMPARE` 26/26 후보, `PREPARE` 교육 RAG 후보 0/26이지만 별도 프로젝트 작성 진료준비 경로는 26/26 매칭됐다. 두 경로의 적중률을 합산하지 않는다.
- **2026-10-13 교차검사 질의 점검·후보 검색기 개선:** 평가셋의 "다른 검사와 함께 보는 이유" 26개 질문을 현 후보의 구체적인 문구와 대조했다. 기존 AFP 1개 외에 혈색소–전혈구검사, AST/ALT/GGT–간기능 검사, eGFR–크레아티닌, 요단백–소변검사, 지질 항목 간 관계, C형간염 항체 후속검사, 폐기능검사의 다른 검사 병행, 시력·청력의 조건부 후속검사, 구강검진의 조건부 X선처럼 **후보 문구에 관계가 실제로 명시된 15개 질문만** 기존 근거 ID로 연결했다. 새 의학 문구·근거·모델 학습은 추가하지 않았다. “왜”의 임상적 원인을 새로 추론하지 않고 원문 요약에 적힌 관계만 추출하는 후보 검색이며, 조건부 후속검사는 조건부 표현을 그대로 유지해야 한다. 키·체중·허리둘레/BMI, 혈압 반복측정, 공복혈당의 맥락, 크레아티닌 단독, 흉부 X선·초음파·CT는 이 질문에 답하는 직접 근거가 없어 계속 보류한다. 따라서 26개 중 16개는 후보(기존 AFP 1 + 새로 검색된 15), 나머지 10개는 `INSUFFICIENT_EVIDENCE`다.
- 수정 후 312건 재실행: 일반 질의 208건 중 교육 근거 후보 146건(70.19%), 근거 부족 62건. `EXPLAIN` 120/156 후보, `COMPARE` 26/26 후보, 교육 RAG `PREPARE` 0/26이며 별도 진료준비 경로는 26/26이다. 근거 부족은 임계값 26건과 미지원 준비/관계 질문 36건으로 구성된다. 결과는 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`; 후보 회수율 개선을 의학적 정확도 개선이나 승인으로 해석하지 않는다.
- 교차검사 후보에는 정확한 단일 chunk와 원문 고정 출력 검사를 추가했다. 개인자료·임상판단·참고범위/진단기준·다중 주제는 계속 거부하거나 보류한다. 해당 항목의 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false`를 유지한다.
- 부정 시나리오: 임상판단 요청 26/26 거부, 개인 결과 질의 26/26 미지원, 프롬프트 인젝션 문구의 모델 payload 누출 0건, 임계값 질의 26건의 후보 오출 0건. 안전 분류 불일치 0건.
- `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/health-helper-education-retrieval.test.js test/medlineplus-upload.test.js test/health-helper-scenario-evidence.test.js test/health-helper-source-inventory.test.js` 결과 **57/57 PASS**. 테스트와 평가는 후보 검색 계약 및 범위만 확인하며 임상·권리 승인, 실제 LLM 품질, 환자 웹 배포를 검증하지 않는다.
- MedlinePlus 업로드 후보 910개 전수 제목 질의 평가는 기존과 동일하게 889/910(97.69%), HOLD 누출 0건, 안전 probe 3/3 PASS로 확인했다. 나머지 21개는 5개 짧거나 모호한 제목의 근거 부족 및 16개 치료·수술·응급 주제 거부이며, 이를 억지로 후보 처리하지 않았다.
- 시나리오 평가셋 SHA-256: `f6d5d96acbf7cda2bd675747d435b4df6a027d7161521cf5bacfbf429a04f92a`. CLI 평가 출력은 해당 평가셋과 검색 소스파일별 해시를 함께 출력한다.
- 이 보완에서도 후보 manifest, 환자 API, DB, 클라우드·모바일 배포, 실제 자료 또는 모델 가중치는 변경하지 않았다. 모든 의료 설명 후보는 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false` 상태다.

## 8. 이번 교차검사 질의 작업의 시험 결과

- `node --test test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js`: **22/22 PASS**. 16개 후보가 각각 하나의 기존 source chunk만 선택하고 저장된 한국어 요약을 바꾸거나 임상 추론을 덧붙이는 출력은 거부하는지 확인했다. 나머지 10개는 evidence를 반환하지 않는다.
- HTTP/RAG, 환자 도우미, 안전 인벤토리·기존 계약 회귀를 포함한 확장 실행 `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-source-inventory.test.js`: **72/72 PASS**. `node --check` 대상 4개 모듈 PASS, `git diff --check` 오류 없음(저장소 내 기존 LF→CRLF 알림만 발생).
- `node scripts/evaluate-health-helper-scenario-retrieval.js`: **PASS_SAFETY_WITH_SCOPE_ABSTENTIONS**, 일반 질의 후보 146/208, 임계값 후보 오출 0, 임상요청 거부 26/26, 개인자료 요청 미지원 26/26, prompt injection payload 누출 0, 안전분류 불일치 0. 평가셋 SHA-256은 `f6d5d96acbf7cda2bd675747d435b4df6a027d7161521cf5bacfbf429a04f92a`로 동일하다.
- `node scripts/health-helper-source-inventory.js`는 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`을 유지한다. 후보 검색에서 찾힌 근거는 서비스 코퍼스 적격성으로 승격되지 않았다.
- 테스트·평가는 로컬 후보 검색과 exact-output 계약만 확인한다. 의료전문가 검토, 재사용 권리 승인, 실제 RAG 생성품질, 환자 웹/API 연결, 배포는 `NOT VERIFIED`다.

## 9. 학교 발표용 MVP 실행

사용자 지시로 검토자 배정·claim별 사람 검토를 활성 업무에서 제거했다. 최신 구현과 실행 절차는 [학교 발표용 번역 코퍼스 RAG](./health-helper-school-demo-rag-2026-10-13.md)를 기준으로 한다. 기존 고정 평가셋과 검토 산출물은 이전 버전의 재현 자료로 보존한다.

학교 발표용 MVP 경로는 [실행 안내](./health-helper-school-demo-rag-2026-10-13.md)에 구현·검증 내역을 기록한다. 이 경로에는 별도 검토자 배정 또는 고정 문장/출처 버전 검토 작업이 없다. 환자 API·DB·진료 정보·서비스 배포는 범위에 포함하지 않는다.

### 2026-10-13 출처 최신성 보강 실행 증적

- `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-source-inventory.test.js test/health-helper-cross-test-source-locators.test.js test/health-helper-claim-review.test.js`: **81/81 PASS**. 날짜 추출, 85개 문단 locator, artifact byte equality, 검토 템플릿 해시·역할·ID fail-closed 검증을 포함한다.
- `node scripts/build-health-helper-cross-test-source-locators.js`: **PASS**. v4의 16개 후보·30개 문장·85개 문단 locator가 저장된 산출물과 byte-identical임을 확인했다. 상태는 `DRAFT / UNASSIGNED`, 의미 지지는 `UNASSESSED`다.
- `node scripts/build-health-helper-claim-review-template.js`: **PASS**. 14개 출처·30개 주장의 빈 검토 템플릿이 저장된 locator v4 해시와 byte-identical이며, 모든 판단은 미평가다.
- `node scripts/evaluate-health-helper-scenario-retrieval.js`: **PASS_SAFETY_WITH_SCOPE_ABSTENTIONS**. 312건 중 일반 질문 candidate 146/208, clinical 요청 거부 26/26, 개인자료 요청 미지원 26/26, 임계값 후보 오출 0, injection payload 누출 0. 모델 호출·배포는 수행하지 않았다.
- `node scripts/health-helper-source-inventory.js`: `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0` 유지.
- `git diff --check`: 오류 없음. 작업트리의 기존 LF/CRLF 안내만 출력됨.
- 환자 API·DB·후보 notes snapshot·환자 서비스 모드·모델 가중치·승인 상태는 변경하지 않았다. freshness는 페이지 게시 메타데이터이며 검색 정확도·임상 검증·현재 페이지 최신성의 PASS가 아니다.

### 2026-10-13 문단 locator 및 인간 검토 계약

- 최신 locator v4는 16개 후보·30개 한국어 문장과 14개 source snapshots에 대한 문단 locator **85개**를 기록한다. 문단 텍스트 자체는 artifact에 복사하지 않고 전역 `<p>` ordinal, 제목 경로, visible-text SHA-256, 스냅샷 경로/페이지 SHA-256으로 찾는다.
- 각 claim의 `candidateSourceParagraphIds`에는 그 claim의 선언된 제목 경로 안에 있는 모든 문단 ID를 순위 없이 연결했다. 이는 출처 문단 선택기가 아니며, 후보 문장과 어떤 문단이 의미상 대응하는지는 모두 `UNASSESSED`로 남는다.
- 별도 [claim review template](./health-helper-claim-review-template-2026-10-13.json)는 source-level 권리와 claim-level 번역·임상·편집 검토의 빈 칸을 분리한다. 각 비어 있지 않은 판정은 지정된 reviewer role, 조직 내부 reviewer ID, 검토일, 근거 메모를 요구한다. validator는 입력 구조/해시 일치만 확인하고 자격 확인 또는 서비스 승격은 하지 않는다.
- 시험은 review template가 14개 source·30개 claim을 보존하고, 변조 claim hash·없는 paragraph ID·축에 맞지 않는 reviewer role을 거부하면서도 `REVIEW_ONLY_NOT_SERVICE_APPROVED`를 유지하는지 확인한다.
- 통합 회귀 `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-source-inventory.test.js test/health-helper-cross-test-source-locators.test.js test/health-helper-claim-review.test.js`: **81/81 PASS**.
- 후보 평가 결과는 이전과 동일하게 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS` (312건; candidate 146/208; 임상요청 거부 26/26; 개인 자료 요청 미지원 26/26; threshold false-positive 0; injection payload 누출 0)이며, 교육 RAG 서비스 적격성은 여전히 `false`다. source inventory도 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`이다.
- 두 빌드 명령을 다시 실행했을 때 기존 locator v4와 review template를 변경하지 않고 `byteIdenticalExisting=true`로 확인했다. 이 회귀는 동일한 입력의 재현성을 보였을 뿐, 의료정보 후보를 승인하거나 모델을 학습한 것은 아니다.

### 2026-10-13 전체 후보 출처 최신성 감사

- 정적 후보 검색에 연결된 시나리오·AFP·간기능·검진·영상검사 5개 현재 스냅샷 묶음을 각 verifier로 해시 검증한 뒤, 서로 다른 MedlinePlus 의료정보 URL **23개 전체**에서 `Last updated`를 추출해 URL 메타데이터와 대조했다. URL 누락, 오래된 매핑, 스냅샷 불일치는 없었다.
- `src/health-helper-imaging-evidence.js`의 환자 개인 영상이 아닌 일반 CT/초음파 후보도 동일한 `source_updated_at` 파생 메타데이터를 내보내도록 연결했다. FDA 출처와 이용정책 페이지는 이 MedlinePlus 의료정보 날짜 맵에 포함하지 않으며 `null`을 유지한다. 후보 `notes.json`과 snapshot hash는 변경하지 않았다.
- `node --test` 확장 실행(HTTP/RAG, 환자 도우미, AFP·간기능·검진·영상, source inventory/freshness, locator, review template): **88/88 PASS**.
- 312건 안전 평가는 이전 값과 동일하게 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`; source inventory는 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`을 유지한다. 메타데이터 검증은 후보의 임상 정확성·출처 권리·현재 웹페이지 최신성을 승인하지 않는다.

### 2026-10-13 로컬 검토 문단 열람 도구

- `node scripts/show-health-helper-review-passages.js <claimId>` 형태의 로컬 전용, 읽기 전용 검토 도구를 추가했다. URL이나 경로 입력은 받지 않고 고정된 claim ID만 허용한다.
- 도구는 review template와 locator artifact hash, source snapshot SHA-256, 재생성한 paragraph ID/hash를 확인한 뒤 선언된 섹션의 비순위 문단을 화면 출력한다. hash/ID 불일치나 알 수 없는 claim ID는 거부하며 네트워크 호출·저장·승인상태 변경은 하지 않는다.
- 전체 회귀 `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-imaging-evidence.test.js test/health-helper-source-inventory.test.js test/health-helper-source-freshness.test.js test/health-helper-cross-test-source-locators.test.js test/health-helper-claim-review.test.js test/health-helper-review-passages.test.js`: **90/90 PASS**.
- 로컬 검색 평가는 계속 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`, source inventory는 `eligibleCount=0`이다. 독립 권리·번역·임상 검토자 지정과 검토는 미완료라 후보 승격이나 서비스 연결은 하지 않는다.

### 2026-10-13 준비 질문 의도 분리·라우팅 개선

- 고정 312문항의 `PREPARE` 26건을 재확인했다. 모두 “다음 진료에서 무엇을 물어볼까요?” 형태의 **진료 준비** 질문이며, 검사 전 금식/준비를 묻는 **검사 절차 안내** 질문은 아니다. 따라서 교육 RAG 후보 0/26과 별도 `retrieveVisitGuidance` 26/26은 충돌 결과가 아니며, 두 지표를 합산하거나 라우팅을 합치지 않는다.
- 별도로 AFP·간기능·검진·영상검사 후보에 이미 있는 27개 `PREPARATION` 질문 템플릿을 통합 검색기에 넣어 확인했다. 검색 의도 판정의 `검사기관` 단독 일치가 ALT 준비 질문을 비교 의도로 오분류하는 1건을 발견해, 단독 `검사기관`을 비교 cue에서 제거했다. 날짜·단위·이전 결과·명시적 비교 신호는 비교 판정에 남겼다.
- 수정 후 기존 템플릿 27건 중 **25건이 정확한 준비 후보 ID로 라우팅**되고, 복용약 지침을 묻는 2건은 기존 임상/약물 조언 안전 경계로 계속 `REFUSED`다. 안전 거부 규칙을 완화하거나 후보 문구·근거를 수정하지 않았다. 신규 환자용 답변이나 서비스 승격도 없다.
- `test/health-helper-preparation-routing.test.js`는 이 27개 후보별 query template 라우팅과 약물 관련 2개 거부, “검사기관에 확인” ALT 준비 문구의 오분류 방지를 고정한다. 전체 통합 회귀는 **92/92 PASS**; 312문항 기존 평가는 그대로 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`, source inventory `eligibleCount=0`이다.

### 2026-10-13 후보자료 기반 RAG 지속 개선 권고 및 실행

#### 권고: 우선은 모델을 재학습하지 않고, 검토 가능한 후보 검색을 반복한다

현재 건강도우미는 후보자료에서 승인된 문단을 검색·인용하는 **결정적 후보 검색 PoC**다. 모델 호출이나 가중치 학습은 하지 않는다. 따라서 현 단계의 “계속 학습”은 후보 문서 버전관리, claim 단위 출처 연결, 검색·보류 평가셋 개선, 독립 검토와 승인상태 관리의 반복으로 정의하는 것이 안전하다. 서비스 질문이나 환자 데이터를 무심코 학습자료로 누적하지 않는다.

환자 화면 경로와도 구분한다. 현재 `/api/v1/me/health-helper/questions`는 `HealthHelperRag`의 `SOURCE_GUIDANCE` 또는 설정된 `VISIT_PREPARATION` 경로를 사용하고, 이번 로컬 후보 검색기 `retrieveHealthEducationEvidence`를 호출하지 않는다. 따라서 이번 라우팅 개선은 후보 코퍼스 실험의 진척이지, 환자용 웹 답변 성능이나 환자 API 연결 완료가 아니다.

권고하는 반복 절차는 다음과 같다.

1. 공개·승인된 출처만 후보 등록하고 URL, 출처 갱신일, 수집 시점, 스냅샷 SHA-256, 재사용 범위, 적용 한계를 고정한다. 출처 변경 시 기존 스냅샷을 덮어쓰지 않고 새 버전을 만든다.
2. 한 번에 하나의 좁은 질문 의도만 다룬다. 후보 문장을 검토 가능한 claim으로 나누고 각 claim을 원문 제목·문단 locator와 연결한다. 출처에 없는 임상적 연결이나 개인별 적용은 추가하지 않는다.
3. 검토 전 후보는 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false`를 유지한다. 검색기가 찾았다는 사실은 사실성·번역·권리·임상 적합성 승인으로 간주하지 않는다.
4. 후보 추가 전 고정 평가셋에서 검색 대상, 정확한 chunk, 출처, 의도, 거부/보류, 유해한 과잉답변을 각각 측정한다. 커버리지 향상과 함께 오탐·안전 경계를 회귀시험에 고정한다.
5. 출처 권리·번역/편집·임상 검토가 완료된 정확한 후보 버전만 후속 제품 승인 대상으로 제출한다. 서비스 연결·모델 학습은 별도 승인과 배포 검증 이후의 결정으로 둔다.

#### 과거 환자용 후보 경로 기록 — 현재 학교 데모 범위 밖

- 해시 검증된 `health-helper-screening-evidence-20261013-v3` 스냅샷의 eGFR 목적 섹션을 로컬 전용 검토 도구로 열람했다. 원문은 eGFR을 추정할 때 의료진이 크레아티닌을 먼저 측정하는 경우가 많다고 설명하고, 크레아티닌 단독으로 eGFR을 결정할 수 없다고 덧붙인다. 이는 **계산상 관계**의 근거이지, 두 검사를 항상 동시에 주문한다는 근거는 아니다. 해당 locator는 `p7-7590841d5f83`, `p8-b06a6bdc4d03`이며 현재 claim의 의미 지지 판정은 `UNASSESSED`다.
- `src/health-helper-screening-evidence.js`에서 크레아티닌과 eGFR을 명시적으로 함께 언급하고 관계·계산·산출 등을 묻는 질의만 기존 `screening-egfr-purpose` 후보로 보낸다. 새 임상 문구나 후보 본문은 추가하지 않았다.
- “혈청 크레아티닌 다른 검사와 함께 보는 이유는?”은 동시검사 목적을 특정하지 못하므로 계속 `INSUFFICIENT_EVIDENCE`다. 새 관계 라우팅이 이 보류 규칙을 우회하지 않는 것을 `test/health-helper-education-retrieval.test.js`에서 함께 고정했다.
- 초점 회귀는 **14/14 PASS**다. 고정 312문항 결과는 변경되지 않았다: `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`, 정상 후보 146/208, `EXPLAIN` 후보 120/156, 진료준비 별도 경로 26/26, 임계값 오탐 0, 주입 payload 누출 0. `serviceEligible=false`, `clinicalReview=UNASSIGNED`, 모델 미호출·배포 미실시.

#### 당시 제안 — 사용자 범위 변경으로 취소

위 환자용 eGFR 후보의 독립 검토·권리 확인 제안은 현재 학교 데모 작업에서 실행하지 않는다. 별도 검토자 배정이나 환자 서비스 승격을 요청하지 않는다.

### 2026-10-13 독립 검토 진행률 계측 및 출처 지지 판정 v2

- 검토 v1의 네 축에 각 claim의 **원문 지지 여부**가 명시적 판정으로 없다는 점을 확인했다. 단순히 paragraph locator가 존재하는 것은 해당 문단이 claim을 뒷받침한다는 뜻이 아니므로, [v2 검토 템플릿](./health-helper-claim-review-template-2026-10-13-v2.json)에 `sourceSupport` 축을 추가했다. 기존 v1 파일은 변경하지 않고 감사 이력으로 보존했다.
- 각 claim에 `SOURCE_EVIDENCE_REVIEWER` 판정(`DIRECT_SUPPORT`, `PARTIAL_SUPPORT`, `NO_SUPPORT`, `AMBIGUOUS`)을 요구하고, 미평가 외 판정에는 해당 claim의 허용된 원문 paragraph ID 하나 이상을 구조화해 기록하게 했다. 지원 여부·번역·임상·편집·권리는 서로 독립 축이다.
- `scripts/build-health-helper-claim-review-template-v2.js`는 v4 locator 해시와 묶인 14개 출처·30개 claim의 새 템플릿을 write-once 생성한다. 로컬 문단 열람기와 진행률 리포터는 v2를 읽는다. 진행률 도구는 검증된 결정 수만 집계하고 파일 수정·권한 인증·승인·서비스 연결을 하지 않는다.
- 현재 v2 결과는 출처 권리 검토 **0/14**, claim **0/30 완전 주석**, 전체 review cell **0/164 완료**다. `UNASSESSED` 상태는 그대로이며 `serviceEligible=false`다.
- `test/health-helper-claim-review.test.js`는 v1 보존, v2 템플릿 해시·locator 바인딩, 허용된 문단 ID 검증, 근거 문단이 없는 판정 거부, 테스트용 `HOLD`/`REJECTED`/`DIRECT_SUPPORT`를 기록해도 서비스 적격성이 생기지 않는 점을 확인한다. 시험 주석은 저장 템플릿에 쓰지 않는다.
- 이 검토 계측 트랙은 학교 데모 범위에서 비활성이다. 검토자 배정·claim 검토 요청은 하지 않으며, 기록된 0/14·0/30·0/164는 과거 템플릿 상태일 뿐 현재 MVP의 대기 게이트가 아니다.

### 2026-10-13 초점 제한 및 복합 주제 검색 개선

- 학교 데모 RAG에서 질문 의도만으로 청크를 고른 뒤 모델이 무관한 문장을 선택할 수 있는 사례를 확인했다. 금식 질의가 조영제 후 일반 수분 섭취를 근거로 고를 수 있어 `FASTING` 초점의 허용 문장을 좁혔다. 초점 분류와 허용 sentence index를 모델 입력에 넣고, 서버 검증기가 허용되지 않은 인덱스를 거부한다.
- `CT 검사 전에 임신 사실을 의료진에게 알려야 하나요?`는 `CT`와 `임신`이 각각 별도 주제 후보로 동점이었다. 초점어를 독립 주제 점수에서만 제외하고 명시된 주제를 선택하도록 변경했으며, 그 주제의 원문에 임신 관련 근거 문장이 실제 있을 때만 후보를 반환한다. 단독 `임신 설명` 검색은 임신 자료로 유지하고, 해당 초점 문장이 없는 CT 후보 fixture는 `INSUFFICIENT_EVIDENCE`가 되는 테스트를 추가했다.
- 현재 학교 데모 golden은 **31/31**, 안전 사례 **3/3**이다. MRI 장신구·심박조율기처럼 소스에 관련 목록 조각만 있고 완전 문장으로 추출할 수 없는 질의는 이제 `INSUFFICIENT_EVIDENCE`로 고정했다. 전체 1,017개 제목 sweep은 993개에서 정확한 자료 근거, 19개 안전 `REFUSED`, 5개 짧거나 모호한 `INSUFFICIENT_EVIDENCE`다. 거부·보류 숫자를 높이기 위해 안전 경계를 낮추지 않았다.
- 관련 회귀 `node --test test/health-helper-medlineplus.test.js test/medlineplus-upload.test.js test/patient-helper.test.js`: **34/34 PASS**. 로컬 Qwen 합성 스모크 9/9(빈혈·CT·MRI·X선)에서 claim 1개가 허용된 근거 문장에서 유도되며 원문 질문은 모델 입력에서 제외된다. A1C QA HOLD 생성 실패 fallback은 메타데이터·링크 전용이며 excerpt는 없다. 의미적 근거성과 임상 적절성은 계속 `NOT PROVEN`이다.
- 환자 API·DB·승인 상태·환자 서비스 모드는 변경하지 않았다. 기존 `/api/v1/me/health-helper/questions`와 학교 데모 후보 RAG의 분리는 유지한다.
- 검색 miss 24건을 제목별로 재확인했다. 19건은 치료·수술·응급·약물 등 기존 `REFUSED`, 5건은 `멍`·`암`·`철`·`옴`·`땀`의 짧거나 모호한 제목이었다. 이 분류에서는 안전 거부나 불확실성 보류를 넓혀 후보 응답으로 바꾸지 않는 것이 다음 개선보다 우선한다.

### 2026-10-13 환자용 웹 건강도우미 RAG 진행 재점검

- 지속 개선은 모델 가중치 학습이 아니라 **후보 자료의 출처·버전 고정 → 번역/QA 상태 분리 → 검색 및 근거 허용 범위 보정 → 합성 golden 회귀 → 출처 기반 응답 확인** 순환으로 수행한다. 환자 질문과 진료기록을 평가·학습 자료로 수집하지 않고, 파인튜닝·환자 API 연결·실제 임상 사용은 하지 않는다.
- 환자 경로를 코드에서 분리 확인했다. 인증 환자 API `/api/v1/me/health-helper/questions`는 `HealthHelperRag`의 승인 코퍼스/방문준비 경로이며, MedlinePlus 후보 RAG는 학교 데모의 별도 `/candidate/questions`에만 연결된다. 이번 후보 검색 보정은 환자 API·환자 UI 동작에 반영되지 않았다.
- MRI 금속 안전은 `MRI_METAL_SAFETY`로 분리하고, MRI 방사선 질문은 해당 topic의 방사선 비사용 문장에, `X선` 질문은 괄호 제목에서 추출한 별칭과 방사선 근거 문장에 연결했다. MRI 조영제 부작용과 X선 방사선 위험은 근거가 부족하므로 계속 보류한다.
- 최신 focused regression은 `node --test test/health-helper-medlineplus.test.js test/medlineplus-upload.test.js test/patient-helper.test.js` **34/34 PASS**, 전체 검색 회귀 **31/31 golden + 3/3 safety PASS**다. 1,017개 중 정확한 제목 근거 993개, QA HOLD 107개와 미해결 이슈 111개는 그대로 보존했다.
- 현재 payload 계약으로 다시 실행한 로컬 모델 스모크는 MRI 금속(12.3초), MRI 방사선(12.8초), X선 방사선(17.5초), CT 금식(10.0초), CT 방사선+임신(15.3초) **5/5 PASS**였다. claim은 서버가 허용한 증거 문장에서만 구성했다. 이는 구조적 근거 추적 확인이지 번역의 의미 정확성·임상 적절성 검증은 아니다.
- 별도 임시 loopback 서버에서 GET 200·보류자료 API 107건(HOLD)을 확인했다. MRI 금속·X선 방사선은 출처 1개로 생성되고, MRI 조영제 부작용은 출처 없이 `INSUFFICIENT_EVIDENCE`, A1C QA HOLD는 발췌 없는 `SOURCE_GUIDANCE`였다. 임시 서버만 종료했으며 기존 LAN preview와 환자 API·DB는 변경하지 않았다.
- 다음 우선 작업 권고: 출처 내 목록 제목(S0012/S0016)과 목록 항목(S0013/S0022)을 서로 연결하는 provenance-preserving passage assembly를 설계한다. 단순 병합으로 원문 문장·해시·허용 sentence index 계약이 느슨해지지 않도록 별도 ADR/fixture로 먼저 검증하고, 구현 전까지 장신구·보청기·심박조율기·인공관절 질의는 현재처럼 fail-closed abstention으로 유지한다.

### 2026-10-13 MRI 목록 조각 오탐 차단

- 합성 질문 감사에서 `MRI 전에 장신구를 빼야 하나요?`가 MRI 본문의 “환자복으로 갈아입는다” 문장에, `MRI에 심박조율기가 있으면 괜찮나요?`가 일반 MRI 소개 문장에 잘못 매칭되는 것을 재현했다. 후보 자료에는 관련 list heading/item이 따로 있지만, item 일부는 완전한 문장이 아니어서 현재 extractive selector로 인용하면 문맥이 빠진다.
- `retrieveUploadedEvidence`에 이 목록형 세부 질의에 대한 fail-closed 보류를 추가하고 두 질의를 golden·실제 코퍼스 회귀에 고정했다. 일반 금속 물체 관련 완전 문장 근거(`MRI_METAL_SAFETY`)는 기존처럼 유지한다. 장신구·심박조율기의 실제 안내 문장을 구성하거나 환자에게 제거/안전 지시를 생성하지 않는다.
- 최종 검색 평가: **31/31 golden**, 안전 **3/3**; focused tests **34/34 PASS**. Loopback HTTP에서도 장신구·심박조율기는 `INSUFFICIENT_EVIDENCE`/출처 0/모델 미호출, 금속 물체 질의는 `GENERATED`/출처 1로 확인했다. 보류 목록은 107건 그대로다. 최신 코퍼스의 문서별 색인·QA HOLD 건수는 바뀌지 않았다.

### 2026-10-13 목록 근거 연결 후속 결정 및 검증

- 후보자료의 MRI 준비 목록은 제목(S0012/S0016)과 항목(S0013/S0022 등)이 분리되어 있어, 개별 항목을 검색하면 문맥 없는 조각이 반환될 수 있었다. 현재 학교 데모에서는 허용 목록 항목에 한해 제목과 항목을 화면용 문장으로 결합하고 `sourceComponents`에 각 원문 텍스트·segment ID·문서/topic·출처 URL·텍스트 SHA-256을 보존한다. 응답 검증은 원문 구성요소와 결합 결과의 해시·순서·식별자 일치를 요구한다.
- 목록 질의는 모델을 호출하지 않고 `SOURCE_GUIDANCE`/`generationUsed=false`만 반환한다. 출처 카드에는 번역 조각을 목록 안내와 함께 구성한 내용임을 표시한다. 이는 학교 데모의 출처 탐색 편의 기능이지, 번역 검수나 임상 승인 또는 환자용 진료지시가 아니다. 정확한 원문 인용이 필요한 경로에서는 합성 문장 대신 구조화된 제목·목록 항목 UI를 사용해야 한다.
- 장신구·머리핀·보청기 제거 목록 및 심박조율기/삽입물 의료진 고지 목록만 각자 정확한 항목 근거에 매칭한다. 기기 안전성 판단, 금속 제거 지시, 미지원 목록(문신 등)은 계속 `INSUFFICIENT_EVIDENCE`다. 원래 QA HOLD 107건과 미해결 이슈 111건은 그대로 유지한다.
- 관련 focused tests `node --test test/health-helper-medlineplus.test.js test/medlineplus-upload.test.js test/patient-helper.test.js`: **35/35 PASS**. 전체 검색 회귀는 **37/37 golden**, 안전 **3/3**; 1,017문서·20,338 청크·정확 제목 근거 993건 결과는 전과 같다. 변경된 목록 근거의 원문 구성요소 변조 차단과 환자 웹 UI의 SOURCE_GUIDANCE 목록 출처·고지 표시를 단위시험에 추가했다.
- 임시 loopback `127.0.0.1:11444`의 비환자 uploaded-corpus 후보 API에서 장신구·심박조율기 고지 질의가 `SOURCE_GUIDANCE_LIST_CONTEXT`/`generationUsed=false`/출처 1개를 반환하고, 심박조율기 MRI 적합성 질의는 `INSUFFICIENT_EVIDENCE`/출처 0개로 보류되는 것을 확인했다. 이 실행은 모델 호출 없는 후보 경로의 HTTP 확인이며, school-demo LAN 포트 `11445`는 건드리지 않았다. 임시 서버는 종료했고 `11444`는 닫힌 상태다. 환자 API·UI·DB·승인 상태는 변경하지 않았다.
- 다음 우선 작업으로 구조화 목록 계약을 완료했다. API는 `listContexts[{heading,items}]`를 전달하고 합성 `excerpt`를 반환하지 않는다. `educationPayload`는 `KOREAN_LIST_CONTEXT` 근거가 모델 입력으로 들어가는 것을 명시 오류로 막는다. UI는 `section`/`ul`/`li`와 `textContent`로 원문 조각을 분리 렌더링하며 콘텐츠 QA HOLD에는 목록 본문을 주지 않는다.
- focused tests는 **35/35 PASS**, retrieval golden **37/37 PASS**, safety **3/3 PASS**다. MRI 장신구 및 심박조율기 고지 모델 스모크는 각각 `SOURCE_GUIDANCE_LIST_CONTEXT`/`NOT_PERFORMED`로 2/2 PASS했다. 별도 HTTP `127.0.0.1:11444`에서도 `listContexts` 반환·합성 excerpt 부재·부정 질의 보류를 확인하고 서버를 종료했다. 기존 11445 LAN preview와 환자 API·DB는 변경하지 않았다.
- 다음 우선 작업은 후보 확대가 아니라 MRI 목록 4개 claim의 원문 locator/번역 지지/임상 적합성/권리 상태를 분리한 검토 패킷을 기존 claim-review 체계와 연결하는 것이다. 독립 검토가 완료되기 전 `UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false`를 유지한다.

### 2026-10-13 MRI 목록 검토 패킷 후속

- MRI 목록 후보 4개(장신구·시계, 머리핀, 보청기, 심박조율기/삽입물 고지)를 별도 버전의 review-only 패킷 `health-helper-mri-list-review-packet-2026-10-13-v1.json`에 연결했다. 각 항목에는 사용자 질의, 표시할 구조화 목록, 원본 segment ID·HTML locator, 영문 원문·한국어 후보, 번역 chunk SHA-256이 포함된다. 기존 v4 locator 및 기존 claim-review 템플릿은 변경하지 않았다.
- 원본 사용자 제공 JSONL에서 MRI record를 확인했고, 파일 SHA-256이 manifest `inputSha256`과 일치함을 재계산했다. 공식 MedlinePlus MRI 페이지의 준비 섹션(현재 page locator 92–109, 최종 갱신일 2026-06-01)과 교차 확인했다. 로컬 저장소에는 HTML 스냅샷이 없어 page snapshot hash는 미확보 상태다. 후보 record SHA-256과 코퍼스 manifest 입력/코퍼스 SHA를 패킷에 고정했다.
- 자동 QA `PASS`와 AI 번역 fidelity `PASS`는 독립 검토 완료를 뜻하지 않는다. 네 claim의 source support·번역·임상·편집 판정 및 출처 권리 검토는 모두 `UNASSESSED`; reviewer는 미배정이다. 특히 기존 권리 메모의 검토 대상은 `/lab-tests/` 페이지들이므로 `/mriscans.html`과 그 안의 연결 링크가 사전 승인된 것으로 취급되지 않는다.
- 검토 패킷 validator의 정상 매핑·해시변조 거부·승인상태 변조 거부 테스트 **3/3 PASS**. validator 결과는 4 claims/8 source segments, rights `UNASSESSED`, service approval 없음이다. 코퍼스/manifest는 읽기만 했고 후보 원본·RAG 인덱스·환자 endpoint는 수정하지 않았다.
- 다음 단일 작업은 조직이 지정한 독립 출처·번역·임상·권리 검토자를 배정하고 이 패킷의 각 축에 근거와 판정을 기록하는 것이다. 검토 승인 이전에는 후보 데이터나 RAG 답변 범위를 확대하지 않는다.

### 2026-10-13 환자 API 후보 코퍼스 분리 회귀

- 최신 서버 구성을 확인했다. `src/server.js`는 로컬 Ollama 모델이 있으면 `VISIT_PREPARATION`, 없으면 `SOURCE_GUIDANCE`를 선택한다. 인증 환자 API는 `HealthHelperRag`의 기존 검토/권리 게이트 코퍼스를 사용하며, 업로드 MedlinePlus 자료는 별도 `/candidate/questions` preview에 있다. 웹 세션·실제 인증 런타임이나 후보 자료의 환자 서비스 편입은 확인되지 않았다.
- 이 경계를 고정하기 위해 인증 HTTP handler 통합시험을 추가했다. 합성 PATIENT principal 요청에서 동일한 MRI 장신구 질문이 후보 코퍼스에서는 `CANDIDATE`로 검색되지만, 환자 API의 `SOURCE_GUIDANCE`, `VISIT_PREPARATION`, 향후 `GENERATION` 세 모드에서는 모두 `INSUFFICIENT_EVIDENCE`, 출처 0, 모델 호출 0으로 끝나며 후보 URL·텍스트가 응답에 포함되지 않아야 통과한다.
- 환자 웹 UI에도 근거 부족 상태가 분명히 표시되고 출처 카드·claim 인용이 생성되지 않는 회귀를 추가했다. `test/patient-helper.test.js` **16/16 PASS**.
- `node --test test/health-helper-http.test.js`: **11/11 PASS**. HTTP·RAG·코퍼스·업로드 RAG·MRI review packet·patient helper 여섯 test file을 묶은 확장 회귀는 **77/77 PASS**. 실제 서버의 production auth·trusted ingress·LAN 브라우저 세션은 이 test double 시험으로 검증된 것이 아니므로 `NOT VERIFIED`다.
- 저장소 요구사항 원문은 FR-001~046 개별 텍스트가 없다고 명시한다. 건강 설명/RAG 전용 승인 FR/NFR ID도 확인되지 않아 신규 ID를 임의로 만들지 않았고 기존 개인정보·인증·감사 경계를 바꾸지 않았다.
- 다음 우선 작업은 독립 검토자가 MRI packet을 판정하는 것이다. 승인 및 명시적 promotion 계약 전까지 후보 RAG와 인증 환자 API를 분리 유지한다.

### 2026-10-13 후보 RAG 검토 진행률 경로

- 운영 권고: 후보 자료가 추가될 때마다 모델 가중치를 자동 재학습하지 않는다. 출처 고정 → 원문 segment/번역 해시 검증 → claim별 근거·번역·임상·편집 및 출처 권리 검토 → 고정 회귀·안전 평가 → 승인된 코퍼스 버전 생성 → 명시적 서비스 promotion 순서로 반복한다. 변경 자료는 계속 격리된 candidate corpus에 두고, 기존 patient RAG 인덱스에 자동 병합하지 않는다.
- MRI review packet validator가 이전에는 모든 축의 `UNASSESSED`만 허용해 실제 reviewer 결과를 기록할 수 없었다. v1 기준 packet은 변경하지 않고, 정확한 v1 바이트 SHA-256에 결속한 별도 `health-helper-mri-list-review-overlay-2026-10-13-v2.json`를 만들었다. 기존 claim-review 계약의 enum, reviewer role/조직 ID 형식, 날짜, rationale, claim별 허용 segment 규칙을 반영해 주석을 검증하되, packet status·`clinicalUse=false`·`serviceEligible=false`를 고정했다. 이 구조검증은 reviewer 신원·자격 또는 결정의 타당성을 인증하지 않는다.
- v1의 권리 메모는 보존하고 v2 overlay에 `rightsReviewContext`로 분리했다. v2의 실제 `rightsReview`는 계속 `UNASSESSED`/미배정/null이다. 현재 네 claim은 모두 미평가이며 진행률은 **0/17**(claim 축 16 + source rights 1)이다. 진행 보고는 `npm run rag:mri-review-progress`로 재현한다.
- overlay의 base hash mismatch 거부, 주석 역할·날짜·근거·비허용 segment 검증, 서비스 승격 거부를 포함한 MRI packet 시험은 **7/7 PASS**. HTTP·RAG·코퍼스·업로드·MRI packet·patient UI 6개 파일 회귀는 **80/80 PASS**다. 실제 사람 검토·권리 승인·코퍼스 promotion은 수행하지 않았다.
- 다음 우선 작업: 독립 검토 담당자를 배정하고 v2 overlay에 source support, 번역, 임상, 편집, rights 결정을 각각 근거와 함께 기록한다. 별도 공식 담당자 배정 전에는 검토 결과를 만들거나 추정하지 않는다.


## 2026-10-13 MRI 목록 출처 안내 후속 구현

MRI 목록형 번역 조각을 원본 세그먼트 근거와 함께 조합해 항목별 extractive source guidance로 제공하도록 수정했다. 장신구·시계, 머리핀, 보청기, 심박조율기 고지 질의는 항목 하나만 표시하며 생성 모델을 호출하지 않는다. 심박조율기 호환성이나 모든 금속 물체의 제거 지침은 자료가 입증하지 않아 근거 부족으로 남긴다.

검증은 focused regression 34/34 PASS, 고정 golden 37/37 PASS, 안전 probe 3/3 PASS다. 제목 sweep은 정확 근거 993/1,017, 19 REFUSED, 5 INSUFFICIENT_EVIDENCE. CT 금식 Qwen 스모크 1/1 PASS(10.7초)이며 모델이 낸 claim은 한 개, source는 한 개이고 답변 문장은 서버가 검색된 근거에서 구성했다. 이 smoke는 번역 의미나 임상 정확성을 검증하지 않는다.

학교 데모 인덱스는 한국어 번역 1,017/1,017 PASS 상태지만 이는 텍스트·해시 무결성만 뜻한다. 콘텐츠 QA HOLD 107건, 미해결 111건을 그대로 유지한다. 별도 검토자를 배정하지 않고, 이를 콘텐츠 PASS로 바꾸지 않는다.

수정 코드를 기존 10.10.70.151:11445 실행 프로세스에 반영하는 재시작은 자동 검토 정책에 의해 거부됐다. 기존 리스너 PID 21448은 재시작 시도 직전 확인했지만, 최신 코드의 HTTP 반영·Host/Origin 거부는 NOT VERIFIED다. 다른 컴퓨터 LAN 접속도 NOT VERIFIED이며, 수정된 코드는 테스트 및 검색 평가 단계까지 확인됐다.


## 2026-10-13 답변 경로 품질 회귀

실제 Qwen 응답을 통해 답변 selector와 서버 검증기를 점검했다. CT 준비 질의에서 모델이 한 근거의 두 문장을 claim으로 선택했지만, 사용하지 않은 두 번째·세 번째 evidence ID도 citations에 넣어 기존 서버 검증기가 올바르게 거부했다. 검증 기준은 유지하고 prompt에 evidenceIds와 claimEvidence의 ID 집합이 정확히 같아야 함을 명시했다. 이후 Qwen 생성 사례 9/9가 통과했다. MRI 장신구와 기기 고지는 결정형 source guidance 경로라 스모크도 모델 호출 없이 2/2 확인하도록 맞췄다.

MRI 목록 문맥은 항목 상세 질의에만 붙이고 일반 MRI 생성 후보에서 제외했다. 최신 focused tests 35/35, 합성 golden 37/37, safety 3/3 PASS다. 1,017개 번역은 학교 데모 인덱스 PASS지만 QA HOLD 107건과 미해결 이슈 111건은 그대로다. 실제 번역 의미·임상 정확성은 여전히 검증되지 않았다.

현재 10.10.70.151:11445는 PID 21448이 점유 중이다. 최신 코드 반영을 위한 프로세스 재시작은 자동 검토 정책에서 거부됐으므로, 현재 런타임 HTTP 및 LAN 접속은 NOT VERIFIED로 유지한다.


격리 HTTP 확인: 현재 코드로 임시 업로드 후보 preview 127.0.0.1:11444를 실행했다. GET 200, HOLD 목록 107, MRI 목록 출처안내 1건(모델 미호출), 심박조율기 적합성 보류(출처 0), A1C excerpt 없는 안내를 확인했다. 잘못된 Host/Origin은 403이었고 임시 프로세스 종료 후 11444 listener가 닫혔다. 이 검증은 기존 LAN 학교 데모 PID 21448 및 그 포트 11445의 최신 코드 반영을 확인하지 않는다.


최신 출처 표시 회귀에서는 내부의 heading+item 조합 근거를 해시·세그먼트로 검증한 뒤, 사용자에게는 source guidance 목록의 heading과 item을 원문 조각 그대로 분리해 보여주고 합성 excerpt를 내보내지 않도록 했다. 9개 Qwen 생성 스모크에 번역 근거 phrase anchor를 넣어 9/9 PASS했고, 목록 전용 2건은 모델 미호출·구조화 목록 일치 2/2 PASS다. 회귀 35/35, golden 37/37, safety 3/3 PASS. 이 기계적 anchor 확인은 번역 의미·임상 정확성 검증이 아니다.

## 2026-10-13 학교 데모 RAG 답변 품질 반복

현재 활성 범위는 사용자 지시에 따른 한국어 번역 학교 데모이며, 앞선 환자용 후보 승격·독립 검토자 배정 제안은 이 범위에서 실행하지 않는다. 최신 실행 근거는 [학교 RAG 구현 로그](./health-helper-school-demo-rag-2026-10-13.md)를 따른다.

이번 자연어 검색 점검은 부정·조건·배타·빈도 범위가 없는 근거에서 답변될 수 있는 문제와 한 글자 주제명의 직접 정의문을 놓치는 문제를 추가로 드러냈다. 범위 조건이 근거에 없으면 fail-closed로 기권하고, 짧은 정의 질의는 QA PASS·미보류·미해결 0건의 정확한 문장 한 개만 허용한다. 최신 합성 회귀 68/68, 전체 관련 테스트 62/62, golden 79/79, 안전 3/3 PASS다. 수치는 retrieval/인용 동작만 반영하며 번역·임상 의미를 승인하지 않는다.

다음 우선 작업은 이중 부정, 양보절, 확률·빈도 수식의 범위와 긴 문장 내 주어-수식어 결속을 양성·기권 쌍으로 측정하고 source-only 정의 질의의 근거 회수율을 넓히는 것이다. 같은 번역 코퍼스에서 지원 문장과 대응 near-miss를 함께 시험하며, QA HOLD 상태·검토자 미배정·환자 서비스 분리를 유지한다.

## 2026-10-13 번역 전체 색인 상태와 RAG 검색 후속

요청에 따라 한국어 번역 1,017/1,017 문서는 학교 데모 `demoIndexStatus=PASS`로 검색한다. 이 상태는 텍스트·해시 무결성과 인덱싱만 뜻한다. 콘텐츠 QA HOLD 107건과 미해결 111건은 유지한다. 추출 발췌의 짧은 완전 문장을 허용하도록 길이 하한을 조정했으며, 문장·해시·근거 ID 검증은 유지했다.

다주제 질의는 한 문장 안에 비교 대상이 함께 있거나, 별도 안내면 같은 출처의 인접 문장에 모두 있는 경우만 생성 답변으로 통과시킨다. 이 규칙으로 답변이 한쪽 개념만 언급하던 회귀 2건을 기권으로 바꿨고, 다주제 제목 51건은 metadata-only 출처안내를 택한다. RAG의 전체 제목 검색은 여전히 1,017/1,017이다.

최신 검증 기준은 golden 79/79, 합성 표현 변형·기권 회귀 48/48, 관련 테스트 60/60, Qwen HTTP 스모크 33/33(생성 12건), loopback/LAN runtime fingerprint PASS다. 최신 코드 재기동 후 두 서버 주소의 실제 HTTP 6/6도 확인했다. 다른 컴퓨터 접속 및 번역 의미·임상 정확성·이용권리는 검증하지 않았다. 다음 작업은 부정 표현·조건문 역추론과 metadata-only 제목의 실제 근거를 함께 점검하는 것이다.

### 2026-10-13 부정·조건 범위와 근거 선택 회귀

- 실제 반례에서 병렬항 분리 오류가 알레르기 유전자·환경 질의를 기권시키고, 호르몬·백신 질문은 한 문장으로 충분한데도 긴 문단을 선택 후보로 노출하며, 원문에 없는 부재 조건을 긍정 근거에서 추론할 수 있음을 확인했다.
- 병렬항 추출, 호르몬·백신 초점 필터, 조건·배타·빈도 범위 검증을 보강했다. 조건이 원문에서 직접 뒷받침되지 않으면 답변 생성 전에 기권한다. 한 글자 주제명은 직접 정의문 한 문장만 후보로 반환하며 그 밖의 짧은 질의는 source-only/근거 부족 경계를 유지한다.
- 현재 결과는 지원 34/34, 기권 38/38(총 72/72), 관련 테스트 63/63, golden 79/79, 안전 3/3, source-only 제목 HTTP 51/51, loopback Qwen HTTP 51/51(생성 23건 답·인용 일치, 나머지 28건 모델 미호출)이다. source-only 51건 중 콘텐츠 QA PASS는 47건, HOLD는 4건이며 HOLD 상태는 유지한다. 긴 Qwen 스모크와 source-only 순회를 하나로 결합한 실행은 `ECONNRESET`으로 끝나지 않아, 두 경로를 별도 검증으로 기록한다. 수치는 합성 retrieval/인용 검증이며 번역 또는 임상 의미를 증명하지 않는다.
- 실행 중 LAN 상태는 `10.10.70.151:11445/candidate/status` 404, `:11446` 소스 지문 불일치다. 최신 코드 반영 및 다른 컴퓨터 접속은 미검증이다.
- 다음 우선순위는 긴 문장 안에 흩어진 조건·양보·수량 한정의 near-miss 쌍과 source-only 51개 응답의 HTTP 메타데이터 전용·모델 미호출 경로를 통합 시험하는 것이다. 번역 색인 PASS와 QA HOLD 107건·미해결 111건은 분리해 유지한다.

### 2026-10-13 긴 양보절과 복용 시점 오분류 수정

- `언제나`를 약 복용 시점을 묻는 `언제`로 잡던 부분 문자열 오분류를 수정했다. 이제 `언제`와 가까운 복용·투여·사용 동사가 있어야 약 사용 시점 요청으로 판정한다. 실제 복용 시점 질문의 거부 동작은 별도 회귀로 고정했다.
- 양보절·빈도·조건을 문장 여러 부분에 흩어 놓은 합성 사례를 추가했다. 현재 검색 holdout 79/79 PASS(지원 36/36, 기권 43/43, false positive 0), 고정 golden 79/79 및 safety 3/3이다. 관련 여섯 테스트 파일도 최신 코드로 재실행해 63/63 PASS했다.
- 새 장문 빈혈 질문은 loopback 후보 HTTP 핸들러와 로컬 Qwen까지 통과했다. 답변과 출처 발췌·claim quote가 동일하고, raw question은 모델 payload에서 제외됐다. 이 기계적 문장 일치는 번역 의미 또는 임상 정확성 검증이 아니다.
- 학교 데모 인덱스는 1,017/1,017 한국어 자료 `demoIndexStatus=PASS`; 107개 콘텐츠 QA HOLD와 111개 미해결 이슈는 그대로 유지한다. PASS는 색인 적재 무결성만 뜻한다. 검토자는 배정하지 않았고 Qwen 가중치 파인튜닝은 하지 않는다.
- source-only 제목 51/51은 별도 HTTP regression에서 메타데이터만 반환하고 모델을 호출하지 않았다. 실행 중 LAN 서버는 최신 코드로 재시작하지 않았으며 `:11445` 상태 경로 404, `:11446` 지문 불일치 및 다른 PC 접속은 `NOT VERIFIED`다.
- 다음은 약 복용 시점과 빈도 한정이 한 질의에 같이 나타나는 양성·거부 near-miss를 늘리고, 최신 source fingerprint를 확인할 수 있는 로컬 런타임으로 검증하는 것이다. 콘텐츠 HOLD 및 환자 API 분리는 유지한다.

### 2026-10-13 원인 목록 질문의 답변 범위 보강

- “빈혈 원인에는 어떤 것들이 있나요?”가 단일 최빈 원인 하나로 축약되던 검색 오류를 고쳤다. 주제가 명시되고 번역 문장이 그 주제를 직접 가리키는 열거 문장 하나를 포함할 때만 목록 질문을 생성 후보로 허용한다. 근거가 없거나 목록이 복수로 충돌하면 기권한다.
- 반례 양성·기권 쌍: 원인 목록 질문은 번역의 세 가지 주요 원인 문장만 반환한다. “모두 철분 부족 때문인가요?”와 “철분 부족의 원인 목록”은 서로 다른 주장·주제 범위라 기권한다. 단수 “가장 흔한 원인” 질문의 기존 근거 선택은 유지한다.
- 최신 평가: holdout 84/84(지원 39/39, 기권 45/45, 오탐 0), golden 79/79, safety 3/3, 관련 테스트 63/63. 로컬 Qwen HTTP 생성도 목록 표현 변형 한 건에서 답·인용 문장이 정확히 일치했다. 의미나 임상 정답을 검증한 것은 아니다.
- 1,017개 번역 자료의 학교 색인 PASS, QA HOLD 107건과 미해결 111건은 유지한다. 별도 검토자를 배정하지 않았고, 환자 API는 변경하지 않았다. 최신 LAN 서버 반영과 외부 기기 접속은 아직 `NOT VERIFIED`다.
- 다음은 빈혈 원인과 같은 유형의 증상·위험요인 열거 및 개수 질문에서 답변이 요청한 범위·개수를 충족하는지 확인하고, 불완전한 문장을 완전한 목록처럼 내보내지 않게 하는 것이다.

### 2026-10-13 증상·위험요인 열거 근거 보강

- 증상과 위험요인 목록을 한 문장 검색 결과에 맡기지 않고, 질문 주제가 명시된 원문 목록 안내 및 그 뒤의 연속된 번역 조각으로 묶었다. 조합 과정은 조각별 세그먼트 ID와 해시를 보존하고, 하위 범주 제목을 소속 항목에 붙여 단독 목록 값처럼 노출하지 않는다.
- 해당 목록 경로는 Qwen 생성을 거치지 않고 서버에서 만든 출처 안내만 반환한다. 질문 주제와 문서가 맞지 않거나 구조 목록을 찾지 못하면 기권한다. 어느 구성 조각이든 QA `HOLD`면 목록 본문 대신 출처 메타데이터만 반환한다.
- HTTP 통합 검증은 증상 목록 3종(4·7·14개 항목), 위험요인 목록 3종(22·13·9개 항목), HOLD 조각 숨김, QA HOLD 주제 기권 및 생성 미호출을 통과했다. 여섯 테스트 파일 65/65, golden 79/79, safety 3/3, holdout 90/90(지원 43/43, 기권 47/47, 오탐 0)도 통과했다. 목적어 조사형 증상 나열, 수량형 증상 질문, 위험요인 나열 변형을 추가했다.
- 최신 시점에도 1,017개 문서·20,338개 한국어 청크는 학교 데모 색인 `PASS`; 콘텐츠 QA `HOLD` 107건과 미해결 111건을 유지한다. 목록 내용의 번역 의미·임상 정확성·권리는 검증되지 않았다. 별도 검토자 없음.
- 읽기 전용 확인에서 `10.10.70.151:11446` 학교 데모가 응답하지만 시작 소스 지문은 현재 코드와 다른 상태임을 확인했다. 이 프로세스만 갱신하려는 명령은 로컬 실행 정책에 의해 실행 전에 거부됐으며 기존 서버는 그대로 실행 중이다. `11445` 프로세스는 변경하지 않았다.
- 다음 우선 작업은 지원되는 터미널에서 11446 데모를 최신 코드로 다시 시작하고 시작 지문·목록 질의 HTTP를 재검증하는 것이다. 다른 PC 접속은 아직 `NOT VERIFIED`다.

### 2026-10-13 학교 데모 후보 색인 PASS 및 목록 경계 회귀

- 증상 목록 파서가 명시적인 목록 뒤의 설명 문장을 항목으로 섞지 않도록 보강했다. 열거형 문장 항목은 구체적인 증상 표현이 2개 이상일 때만 포함한다. 다중 목록 문서는 질문에서 지정된 문서에 한정하고 각 헤더별로 항목을 분리한다.
- HTTP 목록 검증은 천식 4개, 위식도역류질환 4개, 제2형 당뇨병 7개, 갑상선기능저하증 14개를 확인했다. 다중 목록은 ADHD 8/9, 클라미디아 여성/남성 3/3, 수막구균 감염증 3/3/5/8개다. 설명 문장·긴급 진료 안내는 목록 수에서 제외한다. 기존 위험요인 22/13/9개, HOLD 은닉, 모호한 주제 기권 검증도 유지된다.
- 관련 6개 테스트 파일 65/65, retrieval golden 79/79, safety 3/3, holdout 95/95(지원 47/47, 기권 48/48, 오탐 0)이다. 후보 문서 1,017/1,017 및 한국어 청크 20,338개는 학교 데모 색인 `PASS`; 비한국어 청크 30개 제외, QA HOLD 107건 및 미해결 이슈 111건 유지다.
- 색인 `PASS`는 번역 텍스트·출처 메타데이터·색인 무결성에만 적용한다. 번역의 의미적 정확성, 임상 적합성, 재사용 권리는 검토되지 않았으며 별도 검토자를 배정하지 않았다. 해당 RAG는 학교 발표 후보 경로이고 인증 환자 RAG 및 FR-001~FR-046 영상 흐름에는 연결하지 않았다.
- 실행 중 LAN 프로세스는 기존 source fingerprint 불일치 상태다. 최신 코드 시작과 다른 컴퓨터 접속은 `NOT VERIFIED`; 앞선 재기동 시도는 로컬 실행 정책이 명령 실행 전에 거부했다. 다음 작업은 허용된 실행 환경에서 최신 코드를 시작하고 같은 네트워크 원격 브라우저로 확인하는 것이다.

### 2026-10-13 증상 열거 파서의 문장부호·표 경계 회귀

- 제목 지정 자연어 질문으로 명시적 증상 목록 후보 182개 문서를 탐색했다. 128개는 구조화 후보, 54개는 기권이었다. 후보 헤더 추출을 이용한 탐색치이며 일반 사용자 질문에 대한 독립 Recall 지표로 해석하지 않는다. 표제 충돌 또는 목록 범위를 확정하지 못한 사례는 계속 fail closed로 둔다.
- 추가로 발견한 오류는 문장부호가 있는 실제 목록 항목을 설명 문장으로 오인해 버리는 경우와, 목록 뒤의 감기·독감 비교표를 증상으로 붙이는 경우였다. 증상 명칭이 앞에 오는 짧은 설명형 항목은 원문 조각 단위로 보존하고, 비교 전환·Markdown 표·즉시 진료 안내는 목록 경계로 처리했다. 검증 예: 심방세동 6개, 강직성 척추염 추가 증상 8개, 독감 증상 8개(비교표 제외).
- 고정 회귀 결과: 6개 테스트 파일 65/65, holdout 98/98(지원 50/50, 기권 48/48, false positive 0), golden 79/79, safety 3/3. 학교 데모 색인은 1,017/1,017 문서 `PASS`, QA HOLD 107건과 미해결 111건은 보존했다.
- `PASS`의 의미는 학교 발표 후보 색인의 번역 무결성이다. 번역·임상·권리 검토의 승인 상태는 계속 미검증이다. 이 후보 경로는 인증 환자 RAG 및 의료영상 공유 FR-001~FR-046에서 분리된다.
- 최신 LAN runtime verifier는 11446에서 `SOURCE_SNAPSHOT_MISMATCH`를 반환했다. 다른 PC 연결은 시험하지 않았다. 이전 갱신 명령은 로컬 실행 정책에서 프로세스 변경 전에 거부되어 최신 실행본을 확인하지 못했다.

### 2026-10-13 실제 모델 계약 재확인

- 로컬 합성 모델 스모크 두 건을 실행했다. 일반 단일 정의 질문과 QA `HOLD` 개념 질문 모두 `PASS`; 각 1 claim·출처 1개, 답변이 인용 발췌와 동일, 사용자 원 질문은 모델 payload에서 제외됐다. HOLD 질의 응답에는 QA 상태 표시가 유지됐다.
- 이는 기계적 생성·인용 계약 확인이다. 의미적 정답성·임상 적합성·권리 검토는 증명하지 않으며 실제 환자 입력도 사용하지 않았다.
- `127.0.0.1:11445` 및 `10.10.70.151:11446`의 최신 source snapshot 검증은 모두 `FAIL / SOURCE_SNAPSHOT_MISMATCH`; LAN 반영과 다른 컴퓨터 접속은 미검증이다.

### 2026-10-13 단일 문장 증상 근거 검색 보강

- `증상에는 ... 포함될 수 있습니다`라는 완결된 번역 문장이 구조 목록 헤더와 혼동되어 검색에서 빠지는 문제를 고쳤다. 구조 목록이 없을 때 질문이 하나의 출처 문서를 특정하고, 해시가 맞으며, 증상 용어가 둘 이상 든 명시적 열거 문장 하나를 찾으면 해당 문장 하나만 출처 발췌 후보로 내보낸다. 구조화 목록 파서는 우선 적용한다.
- 개수 질문·문서 모호성·약물/치료/면역요법/예방접종 부작용 문맥은 이 경로에서 계속 기권한다. HTTP에서 눈 감염·담석 원문 문장을 정확히 반환했고 모델은 호출하지 않았다. 개수 질문과 암 면역요법 부작용 질의도 기권했다.
- 제목 지정 탐색 185건 중 구조 목록 125건과 단일 문장 6건이 후보가 되었고 54건은 기권했다. 이는 검색 범위 탐색치이며 사용자 자연어 재현율 지표가 아니다. 관련 회귀는 6개 파일 59/59, holdout 106/106(지원 56, 기권 50, FP 0), golden 79/79, safety 3/3이다.
- 학교 데모 색인은 한국어 번역 1,017개 문서·20,338개 청크 PASS다. 콘텐츠 QA HOLD 107건, 미해결 이슈 111건을 유지한다. PASS는 색인 무결성을 뜻하며 번역 의미·임상·권리 검토를 대신하지 않는다. 사용자 지시에 따라 별도 검토자는 배정하지 않았다.
- 이 변경은 학교 발표 후보 RAG만 대상으로 한다. 환자 동의 및 DICOM/FHIR 영상 교류의 FR-001~FR-046은 수정하지 않았다. 최신 LAN 실행본과 다른 PC 접속은 이번 턴에 검증하지 않았다.

### 2026-10-13 추가 목록 어휘 및 상태 회귀

- 확장된 증상 사전과 목록 제목 인식은 제1형 당뇨병(8개), 심부전(8개), 골반저 질환(10개)의 번역 목록을 HTTP에서 완전하게 재구성했다. 세 경로 모두 모델 생성을 호출하지 않는다. 치료하지 않은 상태에 한정된 합병증 목록은 일반 증상 목록에서 제외하고, 기존 라임병 초기 증상 한 문장 경로를 보존했다.
- 불면증과 갑상샘기능항진증은 한국어 색인 상태는 `PASS`지만 전체 문서가 QA `HOLD`이며 미해결 항목이 있어 검색에서 기권한다. 이는 번역 무결성과 내용 검토 상태를 독립적으로 유지하는 회귀다.
- 결과: 관련 6개 테스트 파일 59/59, holdout 111/111(지원 59, 기권 52, FP 0), golden 79/79, safety 3/3. 1,017 문서·20,338 청크는 demo-index `PASS`, QA `HOLD` 107건과 미해결 111건 유지.
- `PASS`는 번역·출처·색인 무결성만 뜻한다. 번역 의미, 임상 적합성 및 이용권리는 미검토이고 별도 검토자를 배정하지 않았다. 학교 발표 후보에 한정되며 FR-001~FR-046 환자 동의·의료영상 흐름은 수정하지 않았다. LAN 실행본 및 다른 PC 접속은 미검증이다.

### 2026-10-13 실제 모델 HTTP 품질 계약 확인

- 임시 loopback HTTP handler에 고정된 합성 질의 55건을 순차 요청했다. 생성 27건마다 기대 핵심 표현이 허용 source sentence와 실제 answer 양쪽에 있는지 확인했고, 전체 PASS였다. 생성 27건은 각 1개 claim/source, answer=claim quote=source excerpt, 원 질문은 model payload에 없었다. 근거 부족·거부·개인 질문 28건은 source 0, model call 0이었다. 신규 CT 방사선+임신 복합 초점은 두 answer anchor 모두 통과했다.
- Paraphrase holdout 평가에 `expectedIntent`, 전체 `expectedFocuses`, `expectedEvidenceAll` 검증을 추가했다. 네 CT 질의를 고정했고 복합 초점은 방사선·임신 근거 문장이 모두 retrieved/allowed 되어야 통과한다. 결과는 115/115: 지원 63/63, 기권 52/52, false positive 0.
- 로컬 Qwen 4B 직접 스모크 4건(빈혈 어지럼, 알레르기 원인, CT 조영제 목적, MRI 금속 안전)도 각 source/claim 및 anchor 계약을 통과했다. 이는 기계적 답변·인용 동작 확인이고 semantic grounding 또는 임상·번역 정확성을 증명하지 않는다.
- 이 검증은 현재 코드의 격리 loopback HTTP 경로다. 기존 LAN listener source fingerprint 및 다른 PC 접속은 확인하지 않았다. 다음 품질 작업은 다른 주제의 복합 초점과 조건부 안내로 확장해, 각 요구 항목이 실제 답변 문장에 함께 나타나는지 측정하는 것이다.

### 2026-10-13 RAG 복합 초점 claim 검증 추가

- 전체 번역 후보는 학교 색인 기준 1,017개 문서·20,338개 한국어 청크 `PASS`로 재확인했다. QA `HOLD` 107건, 미해결 111건과 비한국어 제외 청크 30개는 그대로다.
- 첫 복합 질의 범위는 빈혈로 한정했다. 출처가 각각 직접 서술한 증상 및 세 가지 주요 원인 문장이 있고 선택된 두 원문 청크의 자동 QA가 `PASS`이며 미해결 이슈가 0일 때만 답변을 허용한다. 각 claim은 한 focus·한 문장으로 고정한다. 근거 조합이 없거나 범위 밖 주제면 `INSUFFICIENT_EVIDENCE`다.
- 검증: 48/48 관련 Node 테스트, holdout 117/117(지원 64, 기권 53, FP 0), golden 79/79, safety 3/3. loopback HTTP 빈혈 생성 및 천식 기권 2건 통과; Qwen 호출 1회.
- 답변 선택·출처 대조 동작만 검증했다. 번역 의미·임상 정확성·이용권리와 semantic grounding은 미검증이다. 실제 학교 MVP 로컬 외부 접속과 LAN 반영도 이번 턴에는 검증하지 않았다. FR-001~FR-046 환자 동의·DICOM/FHIR 흐름은 변경하지 않았다.
