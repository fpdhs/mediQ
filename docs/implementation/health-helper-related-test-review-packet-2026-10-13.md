# 건강도우미 교차검사 관계 후보 검토 패킷

> **범위 변경 (2026-10-13):** 이 문서는 이전 환자 서비스 후보 작업의 보관용 기록이다. 사용자의 최신 지시에 따라 출처·번역·임상·편집 검토자 배정과 30개 문장/출처 버전 검토는 활성 작업에서 제외했으며, 학교 발표용 MVP의 시작 조건이나 승인 근거가 아니다. 현재 실행 범위는 [한국어 번역 전용 학교 RAG](./health-helper-school-demo-rag-2026-10-13.md)다.

작성일: 2026-10-13
상태: 검토 요청 전 준비본 · 승인 아님
대상: 환자용 건강도우미의 합성/교육 후보 RAG

## 목적과 제한

이 문서는 후보자료에서 다른 검사·추가검사와의 관계가 문구상 직접 확인되는 16개 질의의 독립 검토를 준비한다. 새로운 임상 설명을 작성하거나 모델 가중치를 학습한 산출물이 아니다. 검색기는 기존 프로젝트 작성 요약 중 하나의 chunk를 선택하고, 출력 검증기는 그 문구의 변경·추론 덧붙임을 거부한다.

모든 항목은 계속 `DRAFT / UNASSIGNED`, `medicalReview=UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false`다. MedlinePlus 요약·한국어 문구의 권리 검토, 번역 검토, 적격 임상 검토, 환자 API 연결, 배포는 완료되지 않았다. 소스 경로와 기준일은 현재 로컬 후보 manifest 및 chunk metadata에 기록된 값이며, 검토자는 링크의 현행 문서와 재사용 조건을 별도로 확인해야 한다.

검색 결과의 `RELATED_TESTS`는 질문 분류 라벨일 뿐, 임상적 이유나 개인별 해석을 생성할 권한이 아니다. 후보 텍스트가 말하는 관계와 조건만 확인해야 한다. 특히 시력·청력·간염·치과 항목의 후속/추가 검사는 필요성이나 결과에 따라 달라질 수 있으므로 후보의 조건부 표현을 삭제하거나 일반화해서는 안 된다.

## 검토가 필요한 후보 16개

본문 SHA-256은 검색기가 선택한 기존 한국어 후보 문구의 정확한 해시다. 검토·수정 후 본문이 달라지면 기존 해시는 더 이상 유효하지 않으므로 새 후보 버전과 해시를 발행하고 이전 후보를 덮어쓰지 않는다.

| 질의 주제 | 선택 chunk | 원문 섹션 | 공식 출처 | 후보 문구 SHA-256 |
|---|---|---|---|---|
| 시력 선별검사 | `screening-vision-purpose` | What is vision screening? · What is it used for? | [MedlinePlus — Vision Screening](https://medlineplus.gov/lab-tests/vision-screening/) | `b06d9c76050752d87fcef46e4b929a8501a6c7e91506867ac025ed0e26b79761` |
| 청력검사 | `screening-hearing-limits` | What do the results mean? | [MedlinePlus — Hearing Tests for Adults](https://medlineplus.gov/lab-tests/hearing-tests-for-adults/) | `20a783466ff57ebd2a81801e3bc5680e30be8f37c9dc722c8b07db60d5da727e` |
| 혈색소 | `screening-hemoglobin-purpose` | What is a Hemoglobin Test? · What is it used for? | [MedlinePlus — Hemoglobin Test](https://medlineplus.gov/lab-tests/hemoglobin-test/) | `942c7fc6d6ec1acf2408935ac54e8695336e58c6c8404a60ea6a1dbf73ede92f` |
| 간 효소 AST | `liver-ast-purpose` | What is an AST test? | [MedlinePlus — AST Test](https://medlineplus.gov/lab-tests/ast-test/) | `b2d8c4b9bebfbf635ae33b476f98379a3a7c6754b7357450cbe6f556be23ff35` |
| 간 효소 ALT | `liver-alt-purpose` | What is an ALT Blood Test? · Why do I need an ALT blood test? | [MedlinePlus — ALT Blood Test](https://medlineplus.gov/lab-tests/alt-blood-test/) | `547e6e035fb223b5db55b961b5b96b229118933760e8c8e3fcdc64d34d1b73a6` |
| 간 효소 γ-GTP | `liver-ggt-purpose` | What is a gamma-glutamyl transferase (GGT) test? | [MedlinePlus — Gamma-Glutamyl Transferase (GGT) Test](https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/) | `8d51c5805d05b9c2fbd49dc4b05cee4a51de8b04a7ff7b235d08bc4664f81b34` |
| 신장기능 eGFR | `screening-egfr-purpose` | What are estimated glomerular filtration rate (eGFR) and GFR tests? | [MedlinePlus — eGFR and GFR Tests](https://medlineplus.gov/lab-tests/estimated-glomerular-filtration-rate-egfr-and-gfr-tests/) | `6a444338032c343e8701d12cece62c606197430b0b9cc793e27d7bbf576f4e49` |
| 요단백 | `screening-urine-protein-purpose` | What is a protein in urine test? · What is it used for? | [MedlinePlus — Protein in Urine](https://medlineplus.gov/lab-tests/protein-in-urine/) | `f0dd26e414a91f7283bd02602717d7bef9a702e1c246642da881645c58b19967` |
| 총콜레스테롤 | `screening-total-cholesterol-purpose` | What is it used for? | [MedlinePlus — Cholesterol Levels](https://medlineplus.gov/lab-tests/cholesterol-levels/) | `3ec14b3489cff09e95bf920f5e0ba6076682ea40ac627d58baa0cfdcba332fb8` |
| HDL 콜레스테롤 | `screening-hdl-purpose` | What is it used for? | [MedlinePlus — Cholesterol Levels](https://medlineplus.gov/lab-tests/cholesterol-levels/) | `3f1397595e6408f0da7b4c62dcd3c9ea358f8c9a17c39123365d88915e522481` |
| LDL 콜레스테롤 | `screening-ldl-purpose` | What is it used for? | [MedlinePlus — Cholesterol Levels](https://medlineplus.gov/lab-tests/cholesterol-levels/) | `e2176574e022bf724f1de15f966caf32f7130c34268b82f9c24562806cb7f745` |
| 중성지방 | `screening-triglycerides-limits` | What is it used for? | [MedlinePlus — Triglycerides Test](https://medlineplus.gov/lab-tests/triglycerides-test/) | `0aca66857cab84b05b4676c140c4b9412b9fc0f24bfb11219921c574d3828154` |
| C형간염 항체 | `screening-hcv-antibody-limits` | What is it used for? · What do the results mean? | [MedlinePlus — Hepatitis Testing](https://medlineplus.gov/lab-tests/hepatitis-testing/) | `9b192ee5e7a8652cfea64650a4bf478283128576add656ebea342635801e0f97` |
| 폐기능검사 | `scenario-21` | What are lung function tests? | [MedlinePlus — Lung Function Tests](https://medlineplus.gov/lab-tests/lung-function-tests/) | `77ad1a709893a61eb821257cabeba7577b851e3c6c998b583f4047c38c9c1033` |
| 구강검진 | `screening-dental-purpose` | What is a dental exam? · What is it used for? | [MedlinePlus — Dental Exam](https://medlineplus.gov/lab-tests/dental-exam/) | `a725b1e34ba1b3cfbad4cd7a10ec0f5f052e020fe12ed375dbc0cebe5f53d6fa` |
| 혈청 AFP | `afp-detail-purpose` | What is it used for? | [MedlinePlus — Alpha Fetoprotein (AFP) Tumor Marker Test](https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/) | `447853179b15ac9303c2e5e8ce1bb8b1b7289f167a478616fdc5bbd0b34a6907` |

## 후보별 검토 질문

각 행마다 별도로 기록한다. 하나의 항목 승인이나 수정이 다른 항목의 검토 결과를 승계하지 않는다.

1. 현재 연결된 원문 섹션이 한국어 후보 문구를 직접 뒷받침하는가?
2. 한국어 요약에서 의미·불확실성·조건·검사명·단위가 추가되거나 빠지지 않았는가?
3. 문구가 실제 임상적 동시 시행 이유를 단정하는가, 아니면 검사 간 관계/후속 가능성만 설명하는가? 후자라면 질문과 UI도 그 범위로 한정해야 한다.
4. 개인 검사 결과, 진단, 치료, 준비 지시, 정상범위, 임계값으로 오해될 수 있는 표현이 없는가?
5. 원문 링크의 재사용 가능 범위, 출처 표시, 저장/반출 가능 범위가 프로젝트의 후보 저장 방식에 적용 가능한가?
6. 승인한다면 승인 대상인 정확한 원문 URL·섹션·한국어 본문 SHA-256·사용 목적·제품 경로·검토 일자를 특정할 수 있는가?

## 별도 abstention 유지: 10개 질문

다음은 312문항 세트에서 여전히 `INSUFFICIENT_EVIDENCE`다. 유사 문구를 가져와 채우거나 새 설명을 만들어 넣지 않는다.

- 키, 체중, 허리둘레, 체질량지수 — 측정값 관계 근거를 "다른 검사"의 이유로 바꾸지 않음
- 혈압 — 여러 시점의 반복 측정은 다른 검사와 함께 시행하는 근거가 아님
- 공복혈당 — 다른 결과/건강 이력과 해석한다는 후보만으로 동시검사 이유를 주장하지 않음
- 혈청 크레아티닌 — 이번 질의의 짝 검사를 특정하는 후보가 없음
- 흉부 방사선검사, 간 초음파, 복부 CT — 현재 후보는 검사 개념·준비 범위이며 다른 검사와의 결합 이유를 설명하지 않음

## 승인 및 변경 기록

| 검토 영역 | 담당자 | 상태 | 기록 대상 |
|---|---|---|---|
| 출처 이용권리·재사용 범위 | 미지정 | `UNASSIGNED` | URL/섹션별 저장·요약·표시·서비스 이용 가능 범위 |
| 한국어 출처 충실도 | 미지정 | `UNASSIGNED` | 원문과 초안 비교, 조건·한정어, 번역 수정사항 |
| 적격 의료전문가 검토 | 미지정 | `UNASSIGNED` | 항목별 임상 범위·표현 적절성·금지되는 추론 |
| 제품/보안 승인 | 미지정 | `UNASSIGNED` | 로그인 경로·환자 API 연결·감사·오류 상태·릴리스 조건 |

변경 결정 전까지 현행은 **후보 검색 개선만 완료**로 기록한다. 승인 요청/승인 결과가 오기 전에는 상태 승격, 사용자-facing 임상 답변, Patient API 연결 또는 배포를 하지 않는다.

## 2026-10-13 출처 섹션 경로 재점검

새 MedlinePlus 스냅샷의 HTML 제목(H1–H6)과 후보의 `section` 경로를 결정적으로 대조했다. 이전 경로 중 AST·ALT·GGT 목적, eGFR 목적, 중성지방 한계 후보의 섹션 연결이 실제 관련 설명이 있는 제목과 달랐고, 전체 93개 간기능/검진 후보를 검사하면서 ALT 한계, 키 비교, 허리둘레 목적, FDA 영상기록 카드 비교 후보에서 4개의 제목 불일치를 추가로 발견했다. 섹션 메타데이터만 고치고 한국어 요약 본문은 변경하지 않았다. AFP 교차검사 질문은 “함께 사용하는 관계”를 보다 직접적으로 설명하는 `PURPOSE` chunk로 연결했다.

검증기는 이제 고정 스냅샷의 제목에서 모든 섹션 경로가 존재하는지 확인하고, 불일치하면 fail closed한다. 새 스냅샷은 `health-helper-liver-evidence-20261013-v4` 및 `health-helper-screening-evidence-20261013-v3`이다. 이번 구조 검사는 제목 위치만 확인하며 출처 문단과 한국어 요약의 사실 일치·번역 정확도·의학적 적절성을 승인하지 않는다. 검토자와 서비스 상태는 계속 `UNASSIGNED`/비활성이다.

검토 위치를 고정하기 위해 [문장별 출처 locator JSON v2](./health-helper-cross-test-source-locators-2026-10-13-v2.json)을 추가했다. v2에는 후보·문장 해시, URL, 스냅샷 해시, 제목 경로와 HTML fingerprint가 있다. [locator v3](./health-helper-cross-test-source-locators-2026-10-13-v3.json)는 고정 스냅샷의 `Last updated` 날짜를 보강하고, 최신 [locator v4](./health-helper-cross-test-source-locators-2026-10-13-v4.json)는 각 후보 제목 구간의 `<p>` ordinal과 visible-text hash를 기록한다. 문장마다 해당 제목 경로의 모든 문단 ID를 순위 없이 연결하므로 어느 문단도 자동으로 지지 근거로 선택하지 않는다. `supportStatus`는 계속 전부 `UNASSESSED`다.

당시 검토 입력은 최신 [v2 claim review template](./health-helper-claim-review-template-2026-10-13-v2.json)에 기록하도록 제안했다. 14개 출처와 30개 문장은 모두 `UNASSESSED` 상태다. 해당 제안은 2026-10-13 사용자 범위 결정으로 활성 계획에서 제외되었으며 학교 데모의 진행을 막지 않는다.

출처 재사용은 [MedlinePlus 이용범위 점검 메모](./health-helper-medlineplus-rights-scope-2026-10-13.md)에 별도로 기록했다. 공식 정책상 후보 원문은 공공영역의 Medical test information 범주와 맞는 것으로 보이나, 이는 프로젝트/제품의 서비스 이용승인이 아니며 저작권 예외·번역 검수·임상 검토도 포함하지 않는다. 검토 담당자 지정과 승인 전까지 권리 상태를 승격하지 않는다.

## 재현 증적

- 평가 데이터: `data/health-helper-scenario-scope-20261012-v2/evaluation.jsonl`
- 평가셋 SHA-256: `f6d5d96acbf7cda2bd675747d435b4df6a027d7161521cf5bacfbf429a04f92a`
- 검색 구현: `src/health-helper-education-retrieval.js`, `src/health-helper-screening-evidence.js`, `src/health-helper-liver-evidence.js`, `src/health-helper-scenario-evidence.js`, `src/health-helper-source-sections.js`
- 회귀: `node --test test/health-helper-rag.test.js test/health-helper-education-retrieval.test.js test/health-helper-liver-evidence.test.js test/health-helper-screening-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-cross-test-source-locators.test.js`
- 평가: `node scripts/evaluate-health-helper-scenario-retrieval.js`
- 이번 기록의 관련 건강도우미 HTTP/RAG·스냅샷·locator 회귀는 75/75 PASS다. 모델 생성품질·출처 권리·임상 적절성·서비스 배포는 미검증이다.
