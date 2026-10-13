# 환자 건강도우미 RAG 후보자료 지속 개선·승격 계획

작성일: 2026-10-13 (Asia/Seoul)
상태: **권고안 / 실행계획 초안 · 임상·권리·운영 승인 아님**

## 사용자 범위 결정 — 2026-10-13

사용자 지시에 따라 학교 발표용 MVP 경로를 활성 범위로 선택했다. 이 경로에서는 별도 출처·번역·임상·편집 검토자 배정 및 30개 claim 검토를 진행 항목에서 제거한다. 아래의 이전 환자 서비스 승격 제안과 기존 검토 문서·빈 양식은 역사 기록이며 최신 범위 결정을 대체하거나 학교 데모의 실행 조건으로 쓰지 않는다.

범위 재확인: 사용자 제공 한국어 번역으로 학교 데모 RAG를 진행하고 별도 검토자를 배정하지 않는다. 번역 색인 무결성 PASS와 기존 콘텐츠 QA HOLD는 별개로 보존하며, HOLD를 콘텐츠 검증 PASS로 바꾸지 않는다. 현재 구현·검증 결과는 [학교 발표용 RAG 실행 기록](./health-helper-school-demo-rag-2026-10-13.md)을 기준으로 한다.

발표용 RAG는 사용자 제공 한국어 번역 코퍼스를 검색 지식베이스로 사용한다. 현재 별도 학교 데모 프로필은 1,017개 문서 전체를 색인하며 원래 자동 QA `HOLD` 107건도 상태·미해결 수를 표시한 채 데모 근거 후보로 포함한다. QA 통과 전용 프로필은 910개 문서만 색인하고 HOLD는 제외한다. 두 프로필 모두 `DRAFT / UNASSIGNED`이며 환자 API에 연결되지 않는다. 검색은 한국어 번역 제목·별칭·본문만 사용하고, 모델에는 초점 분류와 허용된 한국어 근거 문장만 보내며 원문 질문·영어 원문은 보내지 않는다. Qwen 가중치 학습·파인튜닝은 하지 않는다.

이 결정은 합성 질문만 받는 학교 발표용 비임상 데모에 한정한다. 진단·치료, 개인 기록 해석, 환자 API 연결, 실제 환자 서비스 배포에는 적용하지 않는다. 화면에서 번역 기반 데모와 비임상 범위를 표시한다. 환자 서비스의 기존 승인·보안 게이트는 별도 범위로 유지한다.

## 1. 권고 요약

RAG는 일반적으로 모델 가중치를 후보문서로 계속 학습시키는 방식이 아니다. 이 프로젝트에서는 후보자료를 검수·버전관리하고, 승인된 문서 조각을 검색 코퍼스에 반영하는 **지식베이스 갱신**으로 진행한다. 파인튜닝이나 외부 임베딩 서비스는 현재 필요하지 않으며, 개인 환자기록을 학습자료로 쓰지 않는다.

현재 환자용 API는 로컬 Qwen 설정이 있으면 `VISIT_PREPARATION`, 없으면 `SOURCE_GUIDANCE` 경로를 사용한다. 의료 설명 후보를 모으는 `health-helper-education-retrieval` 및 MedlinePlus 후보 경로는 별도 개발·로컬 검토 경로이며 환자 API의 승인된 임상 코퍼스가 아니다. 따라서 이번 권고는 후보를 운영 답변에 즉시 연결하는 것이 아니라, **후보 → 검수 → 평가 → 승인 가능한 불변 버전**의 반복 절차를 확립하는 것이다.

## 2. 현재 후보 기준선

저장소의 문서·코드·로컬 후보 manifest에서 확인한 값이다. 로컬 ignored 데이터가 기준이므로 Git clone만으로 재현된다는 뜻은 아니다.

| 후보 묶음 | 확인 상태 | 사용 제한 |
|---|---|---|
| 정적 RAG 소스 후보 `health-ko-20261011-candidate-v3` | 3개 출처·9개 청크, `eligibleCount=0` | 서울아산 AFP 3개와 질병관리청 간기능 5개는 RAG 재사용 허가·근거 및 콘텐츠 검토 미완료. 의왕시 보건소 1개는 제1유형 근거가 있지만 콘텐츠/청크 검토가 미배정 |
| 사용자 제공 MedlinePlus 한국어 후보 v3 | 1,017개 등록. QA-pass-only: 910개 문서·17,019개 청크. 학교 데모 전체 번역: 1,017개 문서·20,338개 청크. QA HOLD 107건·미해결 111건 유지 | 전체 번역 포함은 학교 데모 프로필에만 해당하며 출처 상태를 표시한다. AI QA PASS는 임상 승인이나 번역 검수 완료가 아니며, 어떤 프로필도 환자 서비스 승격을 뜻하지 않는다 |
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
