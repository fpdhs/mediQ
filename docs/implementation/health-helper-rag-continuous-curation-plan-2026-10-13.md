# 환자 건강도우미 RAG 후보자료 지속 개선·승격 계획

작성일: 2026-10-13 (Asia/Seoul)
상태: **권고안 / 실행계획 초안 · 임상·권리·운영 승인 아님**

## 1. 권고 요약

RAG는 일반적으로 모델 가중치를 후보문서로 계속 학습시키는 방식이 아니다. 이 프로젝트에서는 후보자료를 검수·버전관리하고, 승인된 문서 조각을 검색 코퍼스에 반영하는 **지식베이스 갱신**으로 진행한다. 파인튜닝이나 외부 임베딩 서비스는 현재 필요하지 않으며, 개인 환자기록을 학습자료로 쓰지 않는다.

현재 환자용 API는 로컬 Qwen 설정이 있으면 `VISIT_PREPARATION`, 없으면 `SOURCE_GUIDANCE` 경로를 사용한다. 의료 설명 후보를 모으는 `health-helper-education-retrieval` 및 MedlinePlus 후보 경로는 별도 개발·로컬 검토 경로이며 환자 API의 승인된 임상 코퍼스가 아니다. 따라서 이번 권고는 후보를 운영 답변에 즉시 연결하는 것이 아니라, **후보 → 검수 → 평가 → 승인 가능한 불변 버전**의 반복 절차를 확립하는 것이다.

## 2. 현재 후보 기준선

저장소의 문서·코드·로컬 후보 manifest에서 확인한 값이다. 로컬 ignored 데이터가 기준이므로 Git clone만으로 재현된다는 뜻은 아니다.

| 후보 묶음 | 확인 상태 | 사용 제한 |
|---|---|---|
| 정적 RAG 소스 후보 `health-ko-20261011-candidate-v3` | 3개 출처·9개 청크, `eligibleCount=0` | 서울아산 AFP 3개와 질병관리청 간기능 5개는 RAG 재사용 허가·근거 및 콘텐츠 검토 미완료. 의왕시 보건소 1개는 제1유형 근거가 있지만 콘텐츠/청크 검토가 미배정 |
| 사용자 제공 MedlinePlus 한국어 후보 v3 | 1,017개 등록, 910개 검색 후보, 17,036개 청크, 107개 HOLD. manifest는 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceDeployment=false` | AI QA PASS는 임상 승인이나 번역 검수 완료가 아니다. HOLD는 검색·답변에서 계속 제외 |
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

작업 분담 권고:

- 김범희: 원문 범위·출처 및 DICOM/검사 의미 매핑, 후보 상태·평가 케이스 검토, 안전·음성시험 증적 관리
- 이재석: 승인된 계약 이후 Cloud/Mobile 후보 패키지 로딩·API·표시 연결. 승인 전에는 서비스 승격 코드나 배포를 진행하지 않음
- PM: 출처별 이용범위 및 릴리스 범위 승인, 임상 검토를 맡을 적격 검토자 지정
- 임상 검토자: 해당 후보 원문/한국어 요약과 제한 문구를 독립 확인. 현재 저장소에서 담당자는 확인되지 않음

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
- 수정 뒤 집중·통합 회귀 `node --test test/health-helper-http.test.js test/health-helper-rag.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-source-inventory.test.js test/health-helper-cross-test-source-locators.test.js`는 **74/74 PASS**. section heading/manifest/hash, 16개 후보 선택, 30개 sentence locator, 환자 도우미 거부·보류·감사 경계 계약을 확인했다.

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

## 9. 다음 한 가지 작업

**문서화한 16개 후보를 승인 단계로 옮기지 말고, PM이 출처별 재사용권리 확인자와 적격 임상 검토자를 지정하도록 요청한다.** 항목별 source URL·section·본문 SHA-256·검토 질문은 [교차검사 관계 후보 검토 패킷](./health-helper-related-test-review-packet-2026-10-13.md)에 고정했다. 검토자가 배정되면 독립 검토 기록만 추가하고, 본문 수정은 새 후보 버전·해시·회귀평가가 생길 때까지 보류한다. 10개 abstention은 검토 패킷에서 별도 후속 근거 수집 대상으로 남긴다. 권리/임상 검토가 끝나지 않은 동안 환자 API 연결·서비스 승격·배포를 하지 않는다.

다음 출처·제품 승격 전제는 PM이 출처별 이용권리 확인자와 적격 임상 검토자를 지정하는 것이다. 16개 후보와 30개 문장의 검토 위치는 locator JSON에 고정되어 있다. 검토 전에는 후보 상태를 올리지 않는다. 마지막 기록된 환자 웹 집중 결과와 B 웹 관측은 [진행 기록의 2026-10-13 항목](./health-helper-rag-2026-10-11.md#최신-관측--2026-10-13-0338-kst)을 참조한다.
