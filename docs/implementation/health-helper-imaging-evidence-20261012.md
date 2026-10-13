# 초음파·CT 상세 근거 후보 — v6 · DRAFT / UNASSIGNED

관찰일: 2026-10-12 KST
범위: 간 초음파 및 복부 CT의 목적·한계·준비·비교 준비 8개 고정 답변 초안
콘텐츠 검토: `UNASSIGNED` · 임상 사용: 금지 · 실제 서비스 연결/배포: 미수행

## 이번 단위

검사별 4개 의도를 분리했다. 본문은 MedlinePlus 및 FDA의 공개 원문으로 확인한 뒤 프로젝트가 한국어로 작성한 요약이다. 공식 번역이나 임상 검토본이 아니며, Qwen 호출 없이 저장된 문장 그대로만 반환한다.

| 검사·의도 | 초안 범위 | 경계 |
|---|---|---|
| 간 초음파 · 목적 | 소리 파동 영상과 간 등 복부 장기의 일반적인 관찰 목적 | 개별 환자의 검사 이유·판독은 담당 의료진 확인 |
| 간 초음파 · 한계 | 이온화 방사선을 사용하지 않음. 결과 의미는 실제로 살핀 부위에 따라 달라짐 | 개인 영상 판독·진단 확정 안 함 |
| 간 초음파 · 준비 | 부위별 준비가 다르며 일반 초음파 안내의 물 섭취·금식 예시를 간 초음파에 일괄 적용하지 않음 | 해당 검사기관의 금식·수분 안내 확인 |
| 간 초음파 · 비교 준비 | 이전 영상검사의 날짜·종류·기관을 정리하면 영상 이력 논의에 도움 | 자동 영상비교·변화 판독 아님 |
| 복부 CT · 목적 | 장기·뼈·조직의 크기와 구조를 보여주는 단면 및 3D 보기 | 이번 검사로 확인할 질문은 의뢰한 의료진에게 확인 |
| 복부 CT · 한계 | 이온화 방사선 사용과 가능한 낮은 선량 안내. 영상의학과 전문의가 영상을 검토해 담당 의료진에게 전달 | AI가 영상·판독을 해석하거나 개인 이익·위험을 계산하지 않음 |
| 복부 CT · 준비 | 금식 요청 가능성, 경구·주사·관장 조영제, 옷·장신구 안내, 임신 가능성 알림 | 개인별 검사 지침은 검사기관·의료진 안내 우선 |
| 복부 CT · 비교 준비 | 촬영 날짜·종류·기관, CT 부위·조영제 조건을 의료진과 확인 | 기록만으로 직접 비교 가능성이나 변화를 판단하지 않음 |

## 출처·이용조건

- [Ultrasound: MedlinePlus Medical Test](https://medlineplus.gov/lab-tests/sonogram/): 초음파 원리, 간을 포함한 복부 장기, 검사 부위에 따른 준비 및 결과 의미를 확인했다. Medical Test 공개 정보만 사용했다.
- [CT Scans: MedlinePlus](https://medlineplus.gov/ctscans.html): 단면 영상, 조영제 방식, 금식 가능성, 방사선 안내, 영상의학과 전문의의 판독 전달을 확인했다. Health Topic 요약만 사용했다.
- [Education and Communication · Patient Medical Imaging Record Card section: FDA](https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication): 상위 페이지 안의 해당 섹션에서 영상 기록의 날짜·종류·기관을 기록해 환자·의료진 논의를 돕는 목적을 확인했다. 이 자료를 근거로 AI가 영상들을 비교한다고 주장하지 않는다.
- [MedlinePlus 이용정책](https://medlineplus.gov/about/using/usingcontent/)은 Medical Test 정보와 Health Topic 요약의 공개 이용 범위 및 MedlinePlus 출처표시 문구를 확인하는 데 사용했다. MedlinePlus가 연결한 제3자 페이지·이미지·A.D.A.M. Medical Encyclopedia는 수집/재사용하지 않았다.
- [FDA Website Policies](https://www.fda.gov/about-fda/about-website/website-policies)는 FDA 웹 콘텐츠의 공개 이용조건을 확인하는 데 사용했다. 출처 카드에는 FDA attribution을 유지한다.

자동 검증은 정확한 출처 URL allowlist, 후보별 DRAFT/UNASSIGNED·비임상 표기, 원문 snapshot 해시를 확인한다. 최신 후보의 원문 snapshot과 manifest는 [v6 증적 폴더](../../data/health-helper-imaging-evidence-20261012-v6/manifest.json)에 있다. `v1`은 FDA source-card 제목이 부정확했고, `v2`·`v3`·`v4`는 개선 이력으로 보존한다. v5는 CT의 “3D” 표기가 공통 안전 출력검증의 숫자 거부 규칙에 걸려 테스트가 실패한 상태로 보존했다. v6에서는 해당 단어를 “입체 보기”로 바꾸고, 초음파 한계·간 초음파 준비의 과잉 일반화를 줄이며 CT 판독 담당과 준비 안내를 MedlinePlus 원문에 맞춰 보완했다. FDA 출처명도 실제 링크가 가리키는 상위 페이지와 하위 섹션을 함께 표시한다. 각 버전은 덮어쓰지 않았다.

비교 안내 중 **날짜·검사 종류·기관 기록**은 FDA의 Patient Medical Imaging Record Card 설명을 요약한 부분이다. 검사 부위·조영제 확인은 MedlinePlus CT 안내를 요약한 부분이다. 출처는 과거 영상과 현재 영상의 비교 가능성이나 변화 해석을 보장하지 않는다. 담당 의료진에게 비교를 문의하라는 부분은 프로젝트 안전 경계이며, 같은 부위·같은 조건이면 반드시 비교 가능하다고 단정하지 않는다.

## 2026-10-13 공식 출처 재대조 — 승인 아님

현재 공식 페이지를 다시 확인했으며, 아래 내용은 **출처·정책 문구의 재확인**이지 법무/권리 승인, 한국어 번역 승인, 임상 검토 또는 서비스 적격 판정이 아니다. 저장된 v6 증적은 변경하지 않았다.

| v6 후보 | 원문에서 다시 확인한 범위 | 검토자가 추가 판단할 점 |
|---|---|---|
| `imaging-ultrasound-purpose` | MedlinePlus는 초음파가 장기·조직 영상을 만들며 복부 장기 중 간도 살펴볼 수 있다고 설명한다. | 일반 검사 설명과 환자별 의뢰 목적을 분리했는지 확인 |
| `imaging-ultrasound-limits` | 결과 의미가 검사 종류와 살펴본 부위에 따라 달라진다고 안내하며, 이온화 방사선을 사용하지 않고 숙련된 검사자가 올바르게 사용할 때 일반적으로 안전하다고 설명한다. | 원문 범위를 넘는 안전성 단정이 없는지 확인 |
| `imaging-ultrasound-preparation` | 준비는 살펴보는 부위에 따라 달라지고, 준비 불필요·물 섭취·수 시간 금식 등의 예시가 있다. | 일반 예시를 간 초음파의 지침으로 오인하지 않게 한 제한문구 확인 |
| `imaging-ultrasound-comparison` | FDA 페이지는 영상검사 날짜·종류·기관을 기록해 환자와 의료진 논의를 돕는 기록카드를 설명한다. | FDA 페이지 안에서 연결하는 Image Wisely 카드 원문은 가져오거나 후보에 포함하지 않음 |
| `imaging-ct-purpose` | MedlinePlus는 CT 단면영상이 장기·뼈·기타 조직의 크기와 구조를 보여주며 진단·치료·관찰에 활용된다고 설명한다. | 일반적 용도 설명이 환자의 CT 적응증·목적 판단으로 읽히지 않는지 확인 |
| `imaging-ct-limits` | CT의 이온화 방사선과 가능한 낮은 선량 안내, 영상의학과 전문의가 영상을 검토해 담당 의료진에게 전달한다는 내용을 확인했다. | 개인 이익·위험 계산 불가 문장은 제품 안전 경계임을 분명히 유지 |
| `imaging-ct-preparation` | 금식 요청 가능성, 경구·주사·관장 조영제, 임신 가능성 고지, 옷·장신구 안내가 확인된다. | 이번 개인 검사기관의 지침을 대체하지 않는 제한문구 확인 |
| `imaging-ct-comparison` | FDA 기록카드의 날짜·종류·기관 항목과 MedlinePlus CT의 검사 부위별 조영제 사용 설명을 대조했다. | 부위·조영제 조건을 함께 전달하라는 문장은 두 원문을 연결한 프로젝트 안내이므로 임상 검토 필요 |

권리 정책 확인에서는 MedlinePlus가 Health Topic 요약과 Medical Test 정보를 공개영역으로 열거하고 출처 표시 문구를 제시하는 한편, A.D.A.M. 백과사전·약물정보·일부 이미지 등은 별도 저작권 자료로 구분하는 것을 다시 확인했다. FDA 웹사이트 정책은 별도 표시가 없는 FDA 웹 콘텐츠를 공개영역으로 설명하고 FDA 출처 크레딧을 권장한다. 이번 v6는 해당 MedlinePlus 문서 종류와 FDA 자체 설명문만 대상으로 하며 제3자 자료·이미지는 제외한다. 이는 권리 검토자 대신 내린 법률 판단이 아니다. ([MedlinePlus 이용 정책](https://medlineplus.gov/about/using/usingcontent/), [FDA Website Policies](https://www.fda.gov/about-fda/about-website/website-policies))

현재 manifest는 `DRAFT / UNASSIGNED`, `medicalReview=UNASSIGNED`, `clinicalUse=false`, `serviceDeployment=false`를 유지한다. 권리 검토 상태도 승인으로 변경하지 않는다. v6 notes SHA-256은 `60a9cf9bb4c03d9ee15f986cb5324ce0cd341ca4d2dc434532a0cfaf0f18587e`; 원문 snapshot SHA-256은 manifest에 기록한 5개 파일 값으로 고정되어 있다. 저장된 증적은 [v6 manifest](../../data/health-helper-imaging-evidence-20261012-v6/manifest.json)와 [v6 notes](../../data/health-helper-imaging-evidence-20261012-v6/notes.json)다.

## 2026-10-13 통합 환자 UI 후보 확인

- 영상 전용 loopback preview 설정에서 v4 증적을 읽던 경로를 [v6 증적 폴더](../../data/health-helper-imaging-evidence-20261012-v6/manifest.json)로 정렬했다. 회귀시험은 `test/health-helper-imaging-evidence.test.js`에 추가했다.
- 현재 코드의 통합 교육 후보 미리보기(`127.0.0.1:11444`, `HIPASS_HEALTH_EDUCATION=1`)를 Playwright로 열어 확인했다. `간 초음파 준비는 어떻게 하나요?`는 v6 고정 요약, MedlinePlus 출처, 원문 섹션, 초안·미검토 표시와 이용조건 링크를 화면에 표시했다. `복부 CT 정상범위는 얼마인가요?`는 출처 없이 근거 부족으로 abstain했다. 응답은 `SOURCE_GUIDANCE`, `generationUsed=false`였으며 Qwen 호출은 관측되지 않았다.
- 통합 후보 화면은 합성 입력·비배포·의료전문가 검토 미실시와 개인정보/수치 미전달 안내를 표시했다. 인증 환자 세션·실제 환자 API·배포 화면 검증은 아니다.
- 별도로, 작업 전부터 점유 중이던 `127.0.0.1:11443`의 실행 프로세스는 같은 초음파 질문에 v4 문구를 반환했다. 해당 프로세스는 이 실행에서 시작한 것이 아니므로 종료하지 않았다. 따라서 영상 전용 11443 화면은 사용자가 프로세스를 재시작하기 전까지 최신 v6 실행으로 검증되지 않았다. 소스의 다음 시작 경로는 v6이며 자동 검증은 5/5 PASS.
- 이 실행에서 시작한 11444 후보 서버와 Playwright 브라우저는 종료했다. 기존 11443 프로세스는 변경하지 않았다.

## 구현·거부 동작

- `src/health-helper-imaging-evidence.js`: 초음파/CT 각각 단일 의도 목적·한계·준비·비교 준비만 선택한다. 둘 이상의 검사/의도는 근거 부족, 개인 수치·식별 정보는 입력 거부, 개인 진단·암 확정은 거부, 개별 정상범위는 근거 부족으로 처리한다.
- 일반 개념 질문은 기존 일반 개념 경로를 유지한다. 상세 질문의 답과 다음 진료 질문은 고정 초안/템플릿이며 생성형 재서술을 호출하지 않는다.
- FDA 영상기록 카드와 FDA 이용정책 URL은 exact HTTPS allowlist만 UI에 연결한다. 임의 URL이나 query 변형은 허용하지 않는다. 표시 기관명·원문 제목·이용조건 링크를 구분한다.
- `scripts/build-health-helper-imaging-evidence.js`: 새 v6 경로에서만 고정 URL 5개를 수집한다. redirect 거부, 20초 timeout, 페이지별 2MB 상한, exclusive write를 사용한다.
- `scripts/medlineplus-local-preview.js`: `HIPASS_SCENARIO_EVIDENCE=1`, `HIPASS_IMAGING_EVIDENCE=1`, 11443 포트의 loopback 로컬 미리보기만 연결한다. 현재 실행 URL은 `http://127.0.0.1:11443/`; 실제 환자 로그인·서버 API·DB·PACS·배포에는 연결하지 않았다.
- 비교용 synthetic patient record, CT pixels, 개인 영상 식별정보를 검색·모델 입력에 넣지 않는다.

관련 기존 범위는 검사·영상 목록 화면 FR-006~009 및 감사·최소수집 FR-037~046의 경계를 유지한다. 건강 정보 안내 신규 기능의 승인된 FR/NFR ID는 source of truth에서 확인하지 못해 이번에 새 번호를 만들지 않았다.

## 검증 결과

- 생성: 8개 상세노트, 5개 고정 원문/정책 snapshot, 현재 후보 `v6`; manifest는 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceDeployment=false`.
- focused 및 회귀: 아래 명령 75/75 PASS, exit 0, 980.639ms. 상세 라우팅 8개, 원문 snapshot hash·정책·출처 링크, 개인정보·다중 주제·다중 의도·정상범위·진단 거부, 기존 환자/모바일 계약을 확인했다. 의료 정확도 검토 PASS가 아니다.

```powershell
node --test test/health-helper-imaging-evidence.test.js test/health-helper-afp-evidence.test.js test/health-helper-liver-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-medlineplus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/mobile-health-helper.test.js test/synthetic-health.test.js
```

- 이전 v4의 Playwright loopback 확인은 당시 v4 후보 화면에 한정된다. v5 변경은 고정 답변·출처명 수정이므로 별도 브라우저 갱신 확인은 이번 검증에 포함하지 않았다. 설치형 PWA, 인증 환자 화면, 현행 B/Cloud 배포 및 rollback은 `NOT VERIFIED`.
- 이 검증은 한 브라우저의 loopback **로컬 후보**다. 새로 생성한 응답은 프로젝트 고정 요약이며 Qwen 응답이 아니다. 의료 콘텐츠 검토 `UNASSIGNED`.
- `git diff --check` PASS. 기존 dirty/untracked 상태는 보존했고 commit·push·병원/PACS 적재·배포는 하지 않았다.

## 남은 일

1. 의료전문가가 각 근거 문장·한국 적용성·안전 경계를 검토하고 별도 승인 기록을 남긴다. 지금의 `PASS`는 자동 소프트웨어 테스트에만 적용된다.
2. 승인 이후에만 기존 환자 인증·권한·감사 API의 allowlist/계약 변경을 검토한다. 현재 출처는 KDCA 전용 인증 API에 연결되어 있지 않다.
3. 나머지 건강검진 상세 주제, 설치형 PWA의 390px 화면, 정상·거부·근거 부족·질문 카드의 실제 인증 환경 E2E, 배포·복구 후 재검증이 남아 있다.

이 작업은 지정 주제의 로컬 근거 후보 보완에 한정된다. 전체 의학 RAG, 실제 환자용 기능, MVP 또는 v3 완료를 의미하지 않는다.
