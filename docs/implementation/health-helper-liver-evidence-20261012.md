# 간기능 검사 상세 근거 후보 — DRAFT / UNASSIGNED

관찰일: 2026-10-12 KST
대상: 건강도우미 상세 안내의 간기능 패널·AST·ALT·GGT
판정: 자동 원문/구조 검증은 코드로 확인. 의료전문가 콘텐츠 검토는 `UNASSIGNED`. 실제 환자 API 연결과 배포는 미수행.

## 범위와 원문

간기능 패널과 AST·ALT·GGT 각각에 대해 목적·한계·준비 내용을, 세부 수치 비교에는 공통 비교 조건을 제공하는 프로젝트 작성 한국어 요약 후보 13개를 작성했다. MedlinePlus의 Medical Test 정보 원문과 이용정책 총 6개 페이지를 제한 URL 목록으로 다시 가져와 SHA-256 snapshot으로 저장했다. 근거 목록·버전·파일 해시는 `data/health-helper-liver-evidence-20261012-v2/manifest.json`에 있다. `v1` 스냅샷은 검증기가 출력에서 숫자 문자를 막는 제약과 충돌해 superseded 되었으며 현재 런타임은 `v2`만 읽는다. v1 파일은 이력 보존이며 덮어쓰지 않았다.

- [간기능 검사](https://medlineplus.gov/lab-tests/liver-function-tests/): 패널이 여러 물질을 측정하고 목적이 경과·치료 반응 관찰 등으로 나뉘며, 보통 단독으로 특정 질환을 진단하지 않는다는 절을 사용.
- [AST 검사](https://medlineplus.gov/lab-tests/ast-test/): AST가 간 외 심장·근육 등에도 존재하고, 결과에 영향을 주는 조건과 금식 안내의 절을 사용.
- [ALT 검사](https://medlineplus.gov/lab-tests/alt-blood-test/): 다른 간검사와 함께 평가, 높다고 항상 치료가 필요한 질환을 뜻하지 않음, ALT 양으로 손상 정도를 알 수 없다는 제한, 준비 안내를 사용.
- [GGT 검사](https://medlineplus.gov/lab-tests/gamma-glutamyl-transferase-ggt-test/): 목적, 구체 원인을 단독 진단할 수 없다는 한계, 식사·약·보충제·음주·흡연 및 금식 안내를 사용.
- [검사 결과 이해](https://medlineplus.gov/lab-tests/how-to-understand-your-lab-results/): 검사실마다 방법·참고범위·단위가 다를 수 있어 결과 보고서 범위를 따르고 추세 비교 시 같은 검사실을 우선하는 내용을 사용.
- [MedlinePlus 이용정책](https://medlineplus.gov/about/using/usingcontent/): Medical Test 공개정보 범위와 출처 표시 문구를 확인. 다른 링크의 제3자 콘텐츠·이미지는 수집하지 않음.

미국 공공기관 페이지는 설명 근거 후보이지 대한민국 검사실의 정상범위·개별 준비 지침을 정하는 근거가 아니다. 한국어 문장은 공식 번역이 아닌 프로젝트 작성 요약이며, 의료전문가 검토 전 답변·임상 사용에 승인된 것이 아니다. 금식 안내는 모든 검사에 동일한 준비법을 권하는 용도가 아니다. 금식이나 약 중단은 각 검사기관/의료진의 안내를 따르도록 표현했다. 진단·치료·AFP·환자 수치·CT 픽셀은 내용에 섞지 않았다.

## 구현·안전 범위

- `src/health-helper-liver-evidence.js`: 간기능 패널 및 AST/ALT/GGT의 질문 의도 하나만 선택한다. 혼합 검사/의도, 숫자 포함 질의, 개인정보, 암 확정 요청, 정상범위 요청은 근거 부족·거부·입력거부로 분리한다. 기존 일반 개념 후보는 보존한다.
- `scripts/build-health-helper-liver-evidence.js`: HTTPS 고정 allowlist, redirect 거부, 요청 timeout 20초, 페이지 최대 2MB, 독립 신규 디렉터리·exclusive file 생성으로 원문 provenance를 스냅샷한다.
- `scripts/medlineplus-local-preview.js`: `HIPASS_LIVER_EVIDENCE=1` 및 전용 loopback 11442 opt-in에서만 연결된다. 근거 후보 답변과 질문은 저장된 정확한 요약·고정 프로젝트 문구이고 Qwen 생성이 아니다. 실제 `/api/v1/me/health-helper/questions`, 인증·권한·감사·DB·PACS에는 연결하지 않았다.
- 기존 화면 링크 허용목록은 **KDCA만** 허용하므로 이번 MedlinePlus 원문 링크는 로컬 preview source card에서만 표시한다. 실제 환자 API에 새 출처/코퍼스를 연결하려면 기존 정책·계약의 별도 변경 검토가 필요하며 이번에 이를 완화하지 않았다.

관련 현행 요구사항은 환자 검사 목록/메타데이터 경계(FR-006~009)와 감사·개인정보 경계(FR-037~046)를 유지하는 범위다. 건강 설명 기능 자체의 승인된 FR/NFR ID는 Source of Truth에서 별도 확인되지 않아 확정하지 않는다.

## 검증 결과

`node scripts/build-health-helper-liver-evidence.js` — exit 0, 13개 노트·6개 원문 스냅샷, `DRAFT / UNASSIGNED`.

`node --test test/health-helper-liver-evidence.test.js` — 3/3 PASS. 13개 목적/한계/준비/비교 routing, 결정론적 출력 계약, mixed intent·개인정보/숫자·정상범위·암 확정 fail-closed, 일반 개념경로 유지, 원문 SHA 검증을 확인했다.

회귀 명령:

```powershell
node --test test/health-helper-afp-evidence.test.js test/health-helper-liver-evidence.test.js test/health-helper-scenario-evidence.test.js test/health-helper-medlineplus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/health-helper-visit.test.js test/patient-helper.test.js test/mobile-health-helper.test.js test/synthetic-health.test.js
```

실행 결과 71/71 PASS, exit 0. 현재 코드의 마지막 개념경로 수정 후 간기능 전용 3/3도 재실행했다. 이 회귀 범위는 기존 API 인증 전 파싱 방지·PATIENT role/identity·audit failure 및 모바일 공통 helper 계약이 여전히 통과함을 확인하지만, 새 간기능 근거가 그 API를 통과한다는 뜻은 아니다.

로컬 후보 `http://127.0.0.1:11442/` 브라우저:

- 데스크톱: AST 목적 정상 응답→출처 카드 및 근거 서랍→질문 담기·수정→GGT 정상범위 `INSUFFICIENT_EVIDENCE`→암 확정 `REFUSED` 흐름을 확인했다.
- 모바일 전용 UI 경로 `?surface=mobile`: ALT 준비 정상 응답→출처 카드→질문 담기·수정→AST 정상범위 부족→암 확정 거부를 확인했다. **브라우저 창 폭은 모바일 기기 크기로 설정되지 않았으므로 실제 390px viewport·설치형 PWA 검증은 NOT VERIFIED.**
- HTTP 후보 응답: 정상 `SOURCE_GUIDANCE`, source 1/question 1/`generationUsed=false`; 부족 및 거부는 source 0/question 0/`generationUsed=false`, 거부 `recordContext=NOT_CONNECTED`.

## 남은 일

의료전문가 콘텐츠 검토, 기존 인증·권한·감사 경로로의 정식 adapter, 실제 로그인 웹 및 390px 모바일/PWA 정상·거부·질문메모 E2E, 릴리스·복구 후 재검증은 모두 `NOT VERIFIED`. 이를 위해 현재 초안을 승인 근거처럼 승격하거나 새 출처를 기존 API로 전달하지 않았다. 초음파·CT 및 나머지 검진 항목의 상세 근거도 남아 있으므로 이 작업은 전체 건강도우미 RAG/MVP/v3 완료가 아니다.

다음 작업 한 개: 같은 정책으로 초음파·CT 각각의 목적·한계·준비·비교 조건 후보를 원문 대조해 작성하고 로컬 browser normal/abstain 흐름을 검증한다. 의료전문가 검토 전 서비스 연결·배포는 하지 않는다.
