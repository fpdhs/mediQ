# 건강도우미 RAG 구현·출처 선별 기록

상태: DRAFT / UNASSIGNED. 2026-10-11 Asia/Seoul. 전체 MVP/v3 완료 증거가 아니다.

## 전체 영어 자료 한국어 번역·로컬 연결 — 2026-10-12

상태: **번역 RUNNING / DRAFT / UNASSIGNED. 실제 서비스 미배포.** 00:16:17 KST 관측에서 추가 1,007문서 중 22문서 초안 생성, 저장된 자동 HOLD 4개, 실패 0개, 현재 점검 기준의 로컬 검색 후보 18문서·56조각, 임상 승인 0개다. 이 수치는 관측 스냅샷이며 전체 번역 완료가 아니다. 최신 진행은 `node scripts/medlineplus-batch-status.js`로 확인한다.

- 입력 `medlineplus_all_english_sources.jsonl`: 25,114,244 bytes, SHA-256 `de29f457bd2728f7fac3c3cd420a1e6aa2f5bebfcd8f48862aae003bd7869f09`. 제공 manifest와 일치한다. 1,017문서(1,016 XML 요약·1 공식 COVID 보충자료) 중 이전 번역 10문서를 보존하고 나머지 1,007개를 처리한다. 원본 XML/ZIP 파일은 미제공이므로 그 파일의 hash/원본성은 NOT VERIFIED다.
- `src/medlineplus-translation.js`와 `scripts/translate-medlineplus-full.js`: 연속 원문 범위 보존, 로컬 Qwen3.5:4b 번역, 문단별 원문·번역 hash, 숫자·부정·비교 표현·일부 용어 점검, 유한 timeout/재시도, checkpoint와 재개를 구현했다. 번역 계획은 4,929개 모델 요청 단위다. CPU 처리로 장시간 실행될 수 있으며 완료 시각을 보증하지 않는다.
- 새 경로 `data/medlineplus-full-ko-20261011-v2/`의 part/document는 배타 생성한다. 이전 v1 초안과 기존 자료는 삭제하지 않는다. 기존 cache는 원문 hash 및 현재 점검을 다시 통과한 경우에만 재사용한다. data는 기존 ignore 대상이므로 Git clone만으로 자료가 재현되지 않는다.
- `src/medlineplus-draft-corpus.js`는 현재 점검·hash를 통과한 초안만 localhost 후보에 연결한다. 저장 당시 HOLD와 현재 자동 점검 결과는 다를 수 있지만 사람 승인으로 승격하지 않는다. 제목/별칭 중심 제한 검색이며 모든 질문에 대응하는 의미 검색을 완성한 것은 아니다.
- 실제 CT 설명 연결에서 contrast material을 ‘대비 물질’로 표현한 초안을 발견했다. 용어 점검을 추가하고 해당 v1 초안을 제외했다. v2 CT 문단에도 enema의 오역이 관측돼 ‘관장’ 점검을 추가했다. 자동 점검은 의학적 정확성이나 완전한 원문 대조 검수를 보증하지 않는다. 실행 중 worker는 시작 당시 코드를 사용하며 로컬 loader는 최신 기준으로 다시 검사한다. 재개 시 worker도 최신 기준을 사용한다.
- 공유 렌더러의 MedlinePlus 링크 범위는 고정 공식 도메인의 단일 topic 경로로 확장했으며 고혈압·불면증 보류는 유지한다. 공식 번역/NLM 검수라고 표시하지 않는다. production corpus 승인 게이트·환자 인증·감사 경로는 완화하지 않았다.

검증: 최신 집중 실행 **61/61 PASS**, exit0, 1.300초(번역·초안 loader·기존 인증/감사·모바일 계약 포함). `git diff --check` exit0(기존 LF→CRLF 경고만). 최신 점검 코드를 불러온 로컬 후보 서버의 실제 브라우저에서 ‘신장 검사는 무엇인가요?’ 질문 → Qwen 답변 → MedlinePlus 출처·이용조건 drawer → 진료 질문 담기를 확인했다. 한 문서의 두 인용 chunk가 한 출처 카드에 합쳐진다. 화면 연결은 확인됐지만 번역 excerpt에 ‘비정상적인 것을 검색’ 등 어색한 표현이 있어 **번역·의학적 품질 PASS로 보지 않는다**. 모델 답변의 ‘정기 검사’ 문구도 임상 검토 전에는 승인하지 않는다. 예전 빈혈→원문→질문 담기/수정 브라우저 동작 증거는 아래 절에 보존한다. 전체 1,007문서 번역/내용 검수, 새 자료 전부의 실제 브라우저 대화, 인증된 서비스 연결 및 B 웹/PWA 배포는 **NOT VERIFIED**다. 기존 전체 테스트 결과를 최신 변경 전체의 PASS로 승계하지 않는다.

실행/재개:

```powershell
node scripts/translate-medlineplus-full.js --prepare
node scripts/translate-medlineplus-full.js
node scripts/medlineplus-batch-status.js
node scripts/medlineplus-local-preview.js
```

현재 번역 worker PID 18964는 hidden background로 실행 중이다. 이미 worker가 살아 있으면 다시 시작하지 않는다. 중단할 때는 `Get-CimInstance Win32_Process -Filter 'ProcessId=18964'`로 해당 번역 script의 node 프로세스인지 확인한 뒤 그 PID만 중단한다. 실행자료는 보존하며 다음 실행에서 checkpoint를 재개한다. 로컬 미리보기는 `http://127.0.0.1:11438/`, 모바일 렌더링은 `/?surface=mobile`이다. 타 기기용 배포 주소가 아니다. 커밋·푸시·Cloud/A/B/PACS 배포는 하지 않았다.

다음 작업 한 개: **번역 배치 완료 후 원문 대조·내용 검토 및 HOLD 정리**. 검토된 범위만 기존 인증·감사 API로 연결한다. 관련 요구사항은 사용자 추가 건강도우미 범위이며 기존 FR-006~009 표시, FR-014~025 인가/토큰, FR-037~041 감사 계약을 보존한다. 별도 승인된 RAG FR/NFR ID는 미확정이다.

## MedlinePlus 설명형 RAG 로컬 후보 — 2026-10-11

이번 작업은 기존 승인 게이트를 유지한 채 **공개 근거 검색 → 실제 로컬 Qwen 설명 → 출처 카드 → 진료 질문 담기·수정** 후보를 구현했다. 기존 Cloud/B 서비스의 모델 경로·인증·감사·배포는 변경하지 않았다. 아래 출처 선별 기록은 이전 작업 이력이다.

### 자료 및 구현

- 사용자 Downloads의 `medlineplus_ko.jsonl` 10문서와 `medlineplus_rag_chunks.jsonl` 34조각을 검증했다. 8개 PASS 주제만 검색하며 고혈압·불면증 HOLD는 제외한다. PASS는 제공 파일의 AI 대조 판정이다. 의료전문가 검수·독립 내용 승인은 미실시/UNASSIGNED다.
- 제공 원문 title/full_summary_html canonical JSON SHA-256, 조각의 원문 hash·번역 문단 ID·본문 대응, 중복 ID·출처 URL·권리 상태를 검증한다. 원본 XML ZIP은 제공되지 않았으므로 ZIP 원본성은 NOT VERIFIED다. source_updated_at의 null을 수집일로 바꾸지 않았다.
- 새 생성 경로는 `data/medlineplus-ko-candidate-20261011/`이다. 디렉터리가 이미 있으면 importer가 실패하며 덮어쓰지 않는다. manifest에 입력 파일·생성 corpus 해시를 보존한다. data는 기존 Git ignore 대상이며 clone만으로 재현되지 않는다. 재현에 동일 입력 자료와 importer가 필요하다.
- 추가 코드: `src/health-helper-medlineplus.js`, `scripts/import-medlineplus-candidate.js`, `scripts/medlineplus-local-preview.js`, `scripts/medlineplus-model-smoke.js`, `scripts/verify-medlineplus-candidate.js`, `test/health-helper-medlineplus.test.js`.
- 공유 렌더러 `public/ui/patient-helper.js`에 고정된 8개 MedlinePlus URL, 출처별 이용조건 링크, 접힌 근거 본문을 연결했다. 기존 KDCA 링크·문구·승인 게이트는 유지했다. 실제 웹/PWA 배포본에는 아직 반영하지 않았다.
- 주제·의도 기반 제한 검색으로 최대 3조각을 로컬 `qwen3.5:4b`에 전달한다. 사용자 원문·환자 식별자·기록 수치는 모델에 전달하지 않는다. 임베딩/벡터 DB/모델 가중치 학습은 이번 범위가 아니다. 후속 대화는 마지막 주제만 재사용하며 임의 전체 대화 이력은 모델에 보내지 않는다.
- CPU 실행이므로 답변을 짧게 제한했다. 실제 모델 smoke 성공 관측은 28.497초/34.128초(이전 출력 계약)이며 최초 브라우저 호출 timeout 및 질문 출력 거부도 있었다. 고정 지연 SLA 또는 안정성을 입증한 결과는 아니다.

### 검증과 한계

| 검증 | 결과 | 범위 |
|---|---|---|
| importer 및 로컬 HTTP 검증 | PASS | [20/20 증적](../../artifacts/health-helper/medlineplus-1791729306474/verification.json): 8주제 검색, HOLD/미지원 제외, 입력·corpus hash, 개인 수치/처방 질문·외부 Origin·추가 필드 차단 |
| focused 테스트 | PASS | 65/65, exit0, 최종 관측 0.600초. 기존 출처/인증/감사 fail-closed 및 웹·모바일 계약 회귀 포함 |
| 전체 Node 실행 | FAIL → 재실행 PASS | 최초 1043/1044, 감사 ID operator 테스트 1FAIL, 83.387초. 해당 파일 무수정 단독 6/6 PASS(신규 테스트 포함). 전체 dot reporter 재실행 exit0. 최초 실패 원인은 확정하지 않았다. 후속 소규모 변경은 focused 검증 대상 |
| 실제 데스크톱 브라우저 | PASS(동작 범위) | 빈혈 질문·실제 Qwen 답변·출처/이용조건 펼치기·MedlinePlus 원문 새 탭·질문 담기·수정. 초기 미리보기 CSS 경로 오류는 수정했다 |
| 실제 모바일 크기 브라우저 | PASS(동작 범위) | 390×844, 빈혈 답변 → ‘그러면 원인은 무엇인가요?’ 후속 답변 → 질문 담기·수정. [화면](../../output/playwright/medlineplus-mobile.png). 초기 후보 root ID/CSS 누락에 따른 버튼 겹침은 수정했다. 실기기 PWA 검증은 아님 |
| 의학적 설명 정확성·다양한 대화 품질 | NOT VERIFIED | 출력 schema/출처 ID 검증은 문장별 의학적 함의·환각 부재를 보증하지 않는다. 관측 답변에 철분 부족 표현의 단순화와 일반적인 질문 추천이 있어 내용 검토 필요 |
| 현재 서비스 인증 API·감사 연결 및 배포 | NOT VERIFIED | localhost 전용 개발 후보. 환자 로그인/개인 기록/Cloud·A/B/PACS/Key Vault 경로를 시험하지 않았다 |

MedlinePlus Health Topics 요약 재사용 범위를 [공식 이용조건](https://medlineplus.gov/about/using/usingcontent/)과 [XML 설명](https://medlineplus.gov/xml.html)에서 확인했다. 외부 연결 본문·A.D.A.M.·ASHP·이미지는 포함하지 않는다. 한국어 번역과 AI 설명은 NLM의 공식 한국어 자료/검수·추천이라고 표시하지 않는다.

보안: 후보 서버는 127.0.0.1:11438만 listen하고 Host/Origin을 고정한다. 본인 인증을 제공하는 서비스가 아닌 공개 자료 개발 도구다. 개인 데이터 접속 경로가 없으며 4KB 요청·55초 모델·60초 요청 제한, 단일 활성 호출·분당 5회, 64KB 응답 제한과 서버 출처 매핑을 둔다. 기존 환자 인증을 우회하는 공개 API를 만들지 않았다. 정규 감사로그 연동은 아직 없으며 이를 운영 보안 완료로 보고하지 않는다.

관련 요구사항: 사용자 추가 건강도우미 범위. FR-006~009의 기존 기록 화면은 읽기 전용으로 보존하고 FR-014~025 접근정책/토큰 및 FR-037~041 감사 경로는 변경하지 않았다. 별도 승인된 RAG FR/NFR ID는 이번 작업에서 확정하지 않았다.

재현(저장소 루트):

```powershell
node scripts/import-medlineplus-candidate.js C:/Users/user/Downloads/medlineplus_ko.jsonl C:/Users/user/Downloads/medlineplus_rag_chunks.jsonl data/medlineplus-ko-candidate-20261011
node scripts/medlineplus-local-preview.js
node scripts/verify-medlineplus-candidate.js
node scripts/medlineplus-model-smoke.js
```

이미 생성된 환경에서는 첫 import 명령을 생략한다. 브라우저는 `http://127.0.0.1:11438/`, 모바일 렌더러는 `/?surface=mobile`. Ollama의 `qwen3.5:4b` 실행이 필요하며 다른 PC에서 이 주소에 접속할 수 없다. 서버 종료는 해당 터미널 Ctrl+C. 서비스 배포를 하지 않아 서비스 rollback은 불필요하다. 기존 자료 삭제·커밋·푸시는 하지 않았다.

다음 작업 한 개: **빈혈 후보의 원문·번역·생성 답변 내용 검토를 확정하고, 그 승인 범위에 한해 기존 인증·감사 API에 연결하는 수직 흐름**. 승인 전 기존 production corpus의 APPROVED 게이트는 완화하지 않는다.

## 설명형 RAG 자료 선별과 사용 허가

2026-10-11 착수 범위는 기존 출처의 이용조건 재확인과 설명용 자료 선별이다.
모델 재학습, 의료 설명 생성 활성화, 웹/PWA 배포는 포함하지 않는다.
이 절은 로컬 후속 작업이며 아래 배포 증거를 대체하지 않는다.

### 출처별 사용 범위

| 자료 | 확인한 이용조건과 내용 범위 | 결정 |
|---|---|---|
| [질병관리청 간기능검사](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444) | 개별 하단 출처표시·상업적이용금지·변경금지. 검사 목적·항목·결과 해석 절 존재. 이번 조회에서 AI유형 병기 확인되지 않음 | 원문 안내 유지. AST/ALT/GGT 설명 후보 5개 모델 입력 차단 |
| [서울아산병원 AFP](https://www.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=133) | 정의·검사결과·주의사항·헬스팁 및 콘텐츠 제공 문의 링크 확인. 별도 RAG 허가 없음 | 설명 후보 3개 차단. 저장·검색·재서술 범위 허가 필요 |
| [의왕시 보건소 검사실](https://www.uiwang.go.kr/heal/UWHEAL0305) | 개별 제1유형 확인. 간기능·혈당·신장·지질 검사 목록. 수정일 2023-02-22 | 목록 설명 후보 1개 재사용 조건 확인. 내용 검토 UNASSIGNED. AFP·AST 개념 설명 근거로 확대하지 않음 |
| [질병관리청 당뇨병](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5305) | 제목·진단 및 검사 절 확인. 이번 텍스트 조회에서 개별 이용표시 확정 못함 | 혈당·당화혈색소 자료 후보. 본문 수집·임베딩·모델 입력 보류 |
| [질병관리청 비만](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6694) | 페이지 접근 확인. 이번 텍스트 조회에서 개별 이용표시 확정 못함 | BMI·허리둘레 후보. 이용조건 미확정, 모델 입력 보류 |
| [서울아산병원 크레아티닌](https://health.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=104) | 검사 설명 페이지 접근 확인. 기존 화면의 참고범위 연결은 RAG 허가가 아님 | 별도 제공 허가 검토 후보. 모델 입력 보류 |
| [국가암정보센터 정보사용신청](https://www.cancer.go.kr/lay1/program/S1T614C616/form/info.do) | 변경은 협의 필요. 비영리·출처표시·배포 조건 및 인터넷 링크 조건 존재 | 허가 요청 후보. 개별 간암 콘텐츠를 수집하거나 화면 링크에 추가하지 않음 |

새 코퍼스에 일반 의학 본문을 복사하지 않았다. 기존 후보 9개를 보존하며
사용 가능한 실제 의학 설명 근거는 현재 0개다. 검색 결과의 제1유형 표시는
다른 페이지·그림·로고에 승계하지 않는다. 지방자치단체 검사 목록을 AFP 정의나
개인 결과 해석의 근거로 쓰지 않는다.

### 공공누리 AI유형 확인 기준

[보건복지부 AI유형 이용조건](https://www.mohw.go.kr/menu.es?mid=a10103020700)은
AI유형 자료에 대한 동일·실질 유사 출력 방지, RAG 직접 인용 시 출처표시,
학습용 데이터 재판매 금지 조건을 안내한다. 이 안내 자체는 모든 건강정보에 대한 허가가 아니다.
[질병관리청 활용방법](https://health.kdca.go.kr/healthinfo/biz/health/portalUseGuidance/hlthinsReqst/hlthinsReqstMth.do?index=1)과
개별 자료 표시를 함께 확인한다. 제4유형만 확인된 항목은 계속 LINK_ONLY로 유지한다.
AI유형이 개별 자료에 표시되거나 서면 허가를 얻으면 적용 범위와 기술적 조치를 검토한다.
AI유형 허가를 자동 CLEARED로 처리하는 경로는 이번에 추가하지 않았다.

### 첫 설명 지식베이스의 범위

AFP, AST, ALT, GGT, 공복혈당, 당화혈색소, 크레아티닌, eGFR, BMI, 허리둘레,
지질검사, 간 초음파, 복부 CT의 13개 개념을 선별 대상으로 둔다.
AFP·간기능부터 진행하며 CT/초음파의 진단·영상 판독 지식을 넣지 않는다.
나머지 출처는 기존 건강기록 링크 후보에서 개별 원문·이용조건을 확인한 뒤 결정한다.
이 목록은 런타임 지원 주제나 승인된 자료 수를 의미하지 않는다.

허용된 근거 단위에는 검사명·설명 의도·해당 절·본문·적용 조건·해석 한계·기관·URL·날짜·
허가 증거·내용 검토자·승인 텍스트 SHA-256을 연결한다. 설명 결과는 쉬운 개념 설명,
검사 목적, 단독 해석의 한계, 진료 질문, 출처 순으로 구성할 계획이다.
수치 비교는 기존 서버 계산으로 유지하고 개인 기록은 공용 지식베이스에 넣지 않는다.

### 허가 요청 초안

아직 발송하지 않았다. 질병관리청 문의 경로는 활용방법 안내와 포털 관리자 연락처,
서울아산병원은 [콘텐츠 제공 문의](https://www.amc.seoul.kr/asan/custom/homepageinquiry/contentsInquiryRegistView.do),
국가암정보센터는 위 정보사용신청을 사용한다.

> 합성 자료만 사용하는 비상업적 캡스톤 프로젝트에서 검사 개념 설명 도우미를 개발하고 있습니다.
> 지정 자료와 해당 절을 내부 저장·분할·검색 색인화하고, 로컬 Qwen 모델의 문맥으로 전달하여
> 쉬운 한국어 설명과 진료 준비 질문을 생성하는 이용이 가능한지 문의드립니다.
> 모델 가중치 학습과 원문 데이터셋 재판매는 하지 않으며, 출처·원문 링크·이용조건·변경 사실을 표시합니다.
> 원문 그림·로고와 실제 환자정보는 사용하지 않습니다. 진단·처방은 제공하지 않습니다.
> 허용되는 자료·버전·저장기간·공개 답변 범위·인용 및 재서술 조건을 서면으로 확인 부탁드립니다.

### 코드와 검증 범위

`scripts/health-helper-source-inventory.js`는 기존 코퍼스의 허가·검토·사용 가능 수를 보고한다.
네트워크 조회, 모델 호출, 승인 기록 변경, 배포를 하지 않는다.
검색과 생성 출처 검증에 `isClearedHelperSource`를 함께 적용하여 CLEARED/APPROVED 플래그만으로는
통과하지 못하게 했다. 항목별 공개 라이선스 또는 서면 허가 기록의 형식도 요구한다.
이는 허가 기록의 형식 검증이며 실제 법률 적합성이나 문장별 사실성을 자동 보증하지 않는다.
시험 대역의 허가는 명시적인 TEST DOUBLE이며 사람 승인으로 승계하지 않는다.

기존 Ollama adapter는 진료 질문 전용이다. 의료 설명 생성에는 별도의 제한된 payload·출처/근거
출력 검증과 relay 경로 구현이 필요하며 아직 연결하지 않았다. API·DB·웹·PWA 계약은 변경하지 않는다.
관련 요구사항: RAG 고유 FR/NFR 미배정; FR-037~041 감사 및 인증·최소수집 공통 제약 유지.
현재 HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존. 신규 증적 DRAFT / UNASSIGNED.

다음 작업 한 개는 AFP·간기능 자료에 대한 구체적인 이용허락 범위 확보다.
권리자의 회신이나 개별 AI유형 확인 없이 의료 설명 생성을 활성화하지 않는다.

### 착수 검증 결과

2026-10-11 18:51 KST. `node --test test/health-helper-corpus.test.js test/health-helper-source-inventory.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/health-helper-visit.test.js`:
48/48 PASS, exit 0, Node 시험 시간 427.9326ms. 실제 로컬 HTTP 및 모델/인증 대역 범위다.
`node --test test/capstone-control-ingress.test.js test/mobile-capstone-auth.test.js test/patient-self-view-authorization.test.js test/patient-helper.test.js test/mobile-health-helper.test.js`:
42/42 PASS, exit 0, 재확인 Node 시험 시간 832.8669ms. 브라우저 DOM·인증 경계 회귀이며 실제 VM 브라우저 시험이 아니다.
`node scripts/health-helper-source-inventory.js`: exit 0, sources 3 / candidates 9 / eligible 0.
`node scripts/security-secret-scan.js`: PASS, findings 0, exit 0.
변경 서버·보고 스크립트 `node --check` 및 `git diff --check`: exit 0. 기존 CRLF 경고 보존.
전체 테스트·Security Gate·실제 Qwen 의료 설명·브라우저 종단·웹/PWA 배포: NOT VERIFIED / 미실행.
commit/push 및 허가 요청 발송 없음.

## 2025·2026 합성 건강기록 비교 — 2026-10-11

작업 범위: 인증된 홍길동 합성 시나리오의 고정 기록을 웹/PWA에서 함께 조회하고,
검사·두 날짜 선택 → 수치 비교 → 주제 기반 진료 질문 → 질문 담기·수정을 연결한다.
frontend-design 스킬에 따라 기존 Pretendard·절제된 블루·세이지 질문 공간을 유지했다.
기존 2026 검진 23항목 및 AFP 6.2/8.4/24.6은 보존했다. 2025 검진 23항목만 추가했으며
55세·74kg·170cm의 BMI는 25.6이다. 임의 작성한 합성 자료이며 실제 검사/진단/기관 인증이 아니다.

새 API: GET /api/v1/me/health-records/synthetic. 서버는 PATIENT·홍길동 patientId/subject·
HCC 실행 환경·등록된 고정 CT catalog·trusted ingress를 확인한다. query/body 환자 지정은 불허한다.
조회 성공/거부는 SYNTHETIC_HEALTH_RECORDS_READ 감사로 append한다. 감사 장애면 503이며 데이터는 반환하지 않는다.
응답 no-store, PWA API 캐시 제외, 브라우저 RAM만 사용하고 잠금/환자 전환 시 제거한다.
기존 API 변경, DB migration, CT/PACS/동의/QR 변경은 없다. FR-037~041 감사 그룹이 영향 범위이며
신규 합성 건강기록/도우미 FR/NFR 번호는 UNASSIGNED다. 전체 그룹 충족을 선언하지 않는다.

비교: 날짜 순서·단위·검사 방법 일치 시 숫자 차이와 증가율을 코드로 계산한다.
0/음수 이전값에는 증가율을 만들지 않고, 문자 소견은 나란히 보여준다. 기관이 다르면 별도 표시한다.
실제 검사기관 참고범위는 미등록이며 그래프는 두 관측점만 표시한다. 악화/호전/위험도 판정은 하지 않는다.
개인 기록은 화면의 인증된 비교 공간에만 연결되고 기존 모델 recordContext=NOT_CONNECTED는 유지한다.
AI에는 검사 주제·질문 의도만 보내며 수치/날짜/환자 ID/CT/공공누리 제4유형 원문을 보내지 않는다.
AFP/간기능 이외 주제는 현재 근거 등록 범위에 따라 INSUFFICIENT_EVIDENCE일 수 있다.

변경 파일: src/server.js, public/app.js, public/ui/patient-health.js, public/ui/patient-helper.js/css,
public/mobile/health-helper.js/sw.js, Dockerfile.health-helper, scripts/health-helper-align.py/runtime-check.py,
test/patient-helper.test.js/patient-health.test.js/mobile-health-helper.test.js.
새 파일: src/synthetic-health-records.js/synthetic-health-http.js, public/ui/health-record-client.js,
public/ui/health-comparison.js/css, test/synthetic-health.test.js.

집중 검증 41/41 PASS, exit0, 1.331초. 마지막 Security Gate PASS:
artifacts/health-comparison-security-gate-recheck-20261011.json (unit 62.002초, secret1.262초, audit1.425초).
두 이미지 Trivy HIGH0/CRITICAL0. Docker build exit0; 명시 BASE ARG의 기본값 경고는 있으나 이미지 생성 성공.
최초 게이트 FAIL과 전역 1033/1034 FAIL을 보존한다. 기존 Privacy output-overflow/token-limit-before-detect
실패의 단독 재실행 2/2 PASS, 마지막 게이트 PASS이나 간헐 실패 원인은 확정하지 않았다.
신규 감사 테스트는 UUID 문자열의 '132'를 수치 누출로 오인하는 정규식을 필드 검증으로 수정했다.

최종 관측 2026-10-11 18:35 KST: Control3d1cb6c2…/B UIe184f8e4… 배포·복구·재적용 PASS.
보호 대상 ingress/Postgres 컨테이너·환경·마운트·포트 변경 없음, 서버9/UI14 소스 해시 정렬 PASS.
증적: artifacts/workstation/helper-align-cloud-20261011T092304Z/result.json 및
helper-align-b-20261011T092424Z/result.json. rollbackFiles에 고정된 기존 compose 파일 목록으로 복구할 수 있다.
재현 명령: python scripts/health-helper-runtime-check.py --verify --qwen (credentials concealed stdin).
결과 exit0, artifacts/workstation/health-helper-runtime-20261011T092936Z/result.json scoped PASS.
기록 API200/8records/version/hash 확인, 무인증·변조401/query422/POST405 및 감사 해시 PASS.
첫 재검증은 RemoteDisconnected exit1로 종료되어 결과 JSON이 없으며 성공으로 취급하지 않는다.
후속 동일 이미지 재검증 PASS; 원인을 정책 DENY나 특정 장애로 단정하지 않는다.

실제 브라우저: 웹 로그인→2025 검진→공복혈당 비교98→104(+6.1%)→AFP6.2→24.6
→Qwen 추천·출처 카드→담기·수정→체중74→72(-2.7%) 전환 후 메모 유지 PASS.
같은 날짜 비교는 안내만, 혈압132/84→128/82는 숫자 증가율 없이 나란히 표시 PASS.
PWA 로그인→AFP8.4→24.6(+192.9%)→Qwen 추천→담기·수정→공복혈당 비교→메모 유지
→앱 잠금 후 비교 숫자/담은 질문0 확인 PASS. 두 화면 캡처 error 로그0.
artifacts/workstation/health-comparison-browser-20261011/result.json 및 web-comparison.png/mobile-comparison.png.
웹 viewport1280/scrollWidth1265, PWA content480px; 좁은375px/실물 휴대폰 NOT VERIFIED.
사용자 선택 탭을 건드리지 않으려고 브라우저 전역 viewport 변경을 하지 않았다.
자료는 synthetic 시연 고정 fixture다. 실검진기관/FHIR/임상 연계, 전체 CT/QR 종단은 NOT VERIFIED.
신규 증적 DRAFT / UNASSIGNED, commit/push 없음. 다음 작업 한 개: 실물 휴대폰에서 비교→질문 메모 흐름 확인.
이전 절의 PASS는 당시 범위 이력이다.

## 진료 리허설·질문 카드 스튜디오 배치 보완 — 2026-10-11

목적: 승인한 시안의 검사 선택 위치·대화 단계·근거 서랍·질문 메모 우선순위를 웹과 PWA에 함께 반영.
관련 FR-037~FR-041 기존 감사 경로 유지; 새 건강도우미 FR/NFR는 UNASSIGNED.
기존 Node ESM·DOM 렌더러·인증된 POST /api/v1/me/health-helper/questions·모바일 어댑터 재사용.
API/DB/권한/Cloud/CT 데이터 변경 없음. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존.

변경 파일: public/ui/patient-helper.js/css, public/mobile/health-helper.css/sw.js,
test/patient-helper.test.js, scripts/health-helper-align.py/health-helper-runtime-check.py.
추가 파일: scripts/helper-studio-diagnostic.py (B 읽기 전용 진단, 비밀정보·환경값 출력 안 함).
frontend-design: 기존 Pretendard·절제 블루 유지, 세이지 공간과 종이 카드에만 강조.
ui-ux-pro-max: native details/summary·초점·48px 모바일 버튼·16px 입력·단일 열 검수.

기능: 제목 아래 전체 너비 검사 주제 바, 동일 주제 중복 제거, 세 가지 질문 선택 칩,
대화 진행 단계, 답변별 공식 링크와 접히는 이용조건, 담은 질문 우선 배치,
원문으로 되돌릴 수 있는 프로젝트 작성 '더 짧게', 모바일 질문 메모 점프.
칩/짧게/담기/수정은 모델 호출 안 함. 공식 원문은 링크 안내만 유지.
본인 기록 해석·KDCA 본문 재서술·CT 판독 구현으로 표현하지 않는다.
새 대화·검사 변경은 편집한 질문 유지; 잠금/reset은 메모·숨은 dialog·초안 삭제.
질문은 메모리에서만 유지, 새로고침 시 삭제. 세션·권한·개인정보 전달 범위 완화 없음.

검증 이력:
- 집중 16/16 PASS. 처음 추가 테스트의 DOM 모형 className 조회 오류 수정 전 실패 보존.
- 전체 실행 node --test --test-concurrency=4: 1022/1022 PASS, exit 0, 66059.7943ms.
  artifacts/workstation/helper-studio-unit-20261011.log.
- Security Gate 최종 PASS, unit 60281ms / secret 1250ms / dependency 1463ms, 각 exit 0.
  artifacts/workstation/helper-studio-security-final-20261011.json.
  이전 helper-studio-security-20261011.json의 unit FAIL은 이력으로 보존.
  그 실행의 세부 stdout을 gate가 저장하지 않아 실패 원인 특정은 NOT VERIFIED; 재실행 성공으로 소급 삭제하지 않음.
- Docker build exit 0. ARG 기본값 경고 2건은 기존 Dockerfile 이력; 이번 빌드는 명시적 base 사용.
- 최신 이미지 3034c26e… HIGH/CRITICAL 0. helper-b-qwen-studio-v2-final-20261011.json.
- 최초 배포 helper-align-b-20261011T080700Z: TimeoutExpired FAIL / rollback PASS.
  재시도 helper-align-b-20261011T082634Z: studio-v1 배포·rollback·재적용 PASS.
- studio-v2 첫 attestation: SW 캐시 파일 source/image hash 불일치로 원격 변경 전 차단.
  기존 스캔 파일 보존, 최신 SW v18로 재빌드·재스캔.

최종 배포·브라우저 검증 결과는 아래 완료 절에 기록한다. 신규 증적 DRAFT / UNASSIGNED.

### 배치 보완 완료 절 — 2026-10-11 17:50 KST

B UI 최종 image sha256:3034c26ed8afec060c33283acf306acd2a85bf574c3967977fc47235771fb543.
Control sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7 유지.
배포·rollback·후보 재적용·9개 소스 hash 정렬 PASS(exit0):
artifacts/workstation/helper-align-b-20261011T083840Z/result.json.
환경변수·보안 mount·기존 compose 파일 hash 유지; 실제 재적용 image는 후속 inventory로 확인.
후속 runtime PASS(exit0): artifacts/workstation/health-helper-runtime-20261011T084558Z/result.json.
로그인200, AFP/ALT LOCAL_QWEN 질문 생성200, 무인증/변조401, 환자 override422,
임상 요청 REFUSED, 미등록 주제 INSUFFICIENT_EVIDENCE, PostgreSQL 감사 세션·hash 존재 확인.
전체 감사 체인 재검증은 아님. recordContext=NOT_CONNECTED / medicalContentGeneration=false 유지.

실제 B 웹 브라우저: 새 로그인→건강도우미→AFP 비교 칩→질문 전송→공식 출처 카드·서랍
→추천 담기·수정→다른 추천 짧게/원문 복원 PASS. saved group 우선 및 간 초음파로 주제 전환 후
편집한 메모 보존 PASS. 중복 주제는 4개로 정리. desktop CSS columns 744.125px/480.078px,
document width/scrollWidth1918/1918. 화면: artifacts/workstation/helper-studio-browser-20261011/web.png.
공식 원문 별도 탭의 '간경변증 | 국가건강정보포털 | 질병관리청' 확인은 같은 작업의 studio-v1
브라우저 실행에서 수행했으며, 최종 v2에서는 동일 허용 URL·출처 카드·서랍을 확인했다.
v2 원문 새 탭 재실행은 NOT VERIFIED로 구분한다.

실제 B PWA 브라우저: 새 로그인→홈 CTA→AFP 준비 칩→LOCAL_QWEN 추천·출처→서랍
→짧게→담기·수정→'내 질문1개 보기' scroll/focus PASS.
ALT로 주제 전환 시 대화 초기화·수정한 AFP 메모 유지 PASS. warn/error 수집0.
담기 버튼 실제48px, 입력16px. 모바일 전용 화면 좁은 viewport에서 실제 CSS375/scrollWidth375,
가로 넘침 없음; 이 좁은 화면 관측은 기존 로그인된 세션에서 수행했다.
mobile.png는 당시 실제 표시 화면이며, 좁은 화면에서 전체 로그인 절차를 별도 재실행했다는 증거는 아님.
mobile-wide.png는 CSS1265 viewport 중앙 모바일 레이아웃에서 실행한 위 조작 흐름 증거.
실물 휴대폰·설치·재접속·가로 회전·텍스트 확대·dark mode·최신 모델 장애 재검증 NOT VERIFIED.

명령: node --test test/patient-helper.test.js test/mobile-health-helper.test.js test/patient-context-display.test.js
(16/16, 약256ms, exit0); node --test --test-concurrency=4 (1022/1022, 66059.7943ms, exit0).
HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 node scripts/security-gate.js (최종 PASS, 위 각 단계 시간 참조).
docker build --target ui --build-arg UI_BASE=highpass-helper:ui-qwen-studio-v1-20261011
--build-arg CONTROL_BASE=highpass-helper:control-qwen-v2-20261011 -f Dockerfile.health-helper
-t highpass-helper:ui-qwen-studio-v2-20261011 . (exit0; 전체 소요시간 미수집).
python scripts/health-helper-align.py --role B --baseline artifacts/workstation/health-helper-runtime-20261011T083258Z/result.json --apply
(exit0; preflight/scan/source attestation 포함),
python scripts/health-helper-runtime-check.py --verify --qwen (exit0; API 전체 소요시간 미수집).
인증정보는 대화형 입력으로만 제공; 문서·명령에 비밀값 기록하지 않는다.
재현: /hipass/#PATIENT 또는 /mobile/ → 로그인 → 건강도우미 → AFP 주제 → 준비/비교 칩
→전송→담기→메모 수정→ALT/간 초음파 전환 후 메모 확인.
복구: 위 align 도구가 해당 실행의 검증된 base로 rollback 후 후보 재적용을 수행했고 PASS 기록을 남김.
수동 compose 변경·임의 이전 이미지 복원은 현재 상태 확인 없이 실행하지 않는다.
미해결: 과거 unit gate FAIL의 세부 원인 미확정, 실기기·자동기동/HA·독립 검토·FR/NFR 배정.
다음 작업 한 개: 실제 휴대폰에서 PWA 설치→재접속→동일 질문 흐름 확인.
이번 완료는 지정 UI·질문 흐름에 한정한다. CT/QR/동의 전체 종단, 전체 MVP/v3 완료 선언 없음.
commit/push 없음. 신규 증적 DRAFT / UNASSIGNED.

## 모바일 전용 PWA 연결 — 2026-10-11 최신 지정 흐름 검증

### 목적·관련 요구사항·기존 구조

기존 /mobile/ 로그인·서명된 환자 세션·앱 잠금·네 메뉴를 유지하고 건강도우미 지정 흐름을 연결한다.
기존 공통 createPatientHelper 렌더러와 동일 POST /api/v1/me/health-helper/questions 계약을 재사용한다.
API/DB/모델 정책 변경 없음. FR-037~FR-041 감사, 인증·최소수집 제약 유지. 신규 건강도우미 FR/NFR는 UNASSIGNED.
모바일은 환자 기록 값을 조회·해석하지 않고 AFP/AST/ALT/GGT/간기능 검사 주제 선택만 제공한다.

### 파일·기능·보안 검토

신규: public/mobile/health-helper.js, public/mobile/health-helper.css, test/mobile-health-helper.test.js.
수정: public/mobile/app.js/index.html/sw.js, public/ui/patient-helper.js, test/patient-context-display.test.js,
Dockerfile.health-helper, scripts/health-helper-align.py/health-helper-runtime-check.py.
기존 dirty sw.js 및 다른 파일의 선행 변경을 보존한다. 프레임워크·권한 모델·서버 API 추가 없음.

홈 진입 버튼·내 정보 진입 버튼 → 검사 주제 → 질문 → 공식 원문 카드 → AI 추천 → 담기·수정·모아보기.
모바일은 공통 컴포넌트의 기록 보기 버튼을 노출하지 않으며 '아래 메모' 문구로 작은 화면에 맞춘다.
폰트·기존 블루 #3566b8 유지, 세이지 #dfe9dd 메모, 48px 버튼·16px 입력·단일 열·기존 하단 네 메뉴 유지.
frontend-design 스킬로 기존 제품 팔레트·가독성·구조를 유지했으며 새 시각 체계를 도입하지 않았다.

인증된 PATIENT Bearer만 API에 전달, 개발 역할 헤더 fallback 없음. 잠금/세션 만료 시 요청 불가;
잠금·환자 전환은 요청 abort와 대화·메모 초기화. 늦은 응답은 공통 renderer generation guard로 무시한다.
질문/응답/토큰/메모는 브라우저 저장소나 service worker cache에 기록하지 않는다.
SW v16의 exact public shell allowlist에 정적 helper 파일만 추가했다. signed login이 window.load 후 완료해도
SW 등록되도록 readyState 분기 보완; 강제 페이지 reload로 기존 메모를 지우지 않는다.
65초 공통 UI timeout, 동일 서버 거부·유한 중계 제한 유지. CT/QR/동의·Cloud/DB/PACS 변경 없음.

### 검증·보존한 실패

초기 집중28/28 PASS. 최초 security gate unit FAIL(74.073초), secret/dependency PASS.
로그를 남긴 전체 재실행은1019/1021 PASS: patient-context-display의 새 healthHelper test double 누락,
기존 Privacy HTTP의 model-unavailable/output-overflow/queue-full/late-result 4조건 실패.
fixture는 실제 앱의 새 의존성을 반영하고 환자 전환 reset 확인을 추가했다. Privacy 시험 예산·정책은 완화하지 않음.
Privacy/환자 context 개별5/5 PASS; 최종 전체1021/1021 PASS(70.244초),
security gate 재실행 PASS(unit59.732초 / secret1.446초 / dependency1.696초).
최초 Privacy 실패의 기술 원인은 미확정이며 개별/전체 후속 PASS로 최초 실패를 삭제하지 않는다.

로그: artifacts/workstation/helper-mobile-node-tests-20261011.log,
helper-mobile-node-tests-fixed-20261011.log, helper-mobile-security-gate-20261011.log.
명령: node --test --test-concurrency=4 --test-reporter=spec;
HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 기준 node scripts/security-gate.js. 최종 모두 exit0.
초기 후보 v1 후 SW 등록 시점 보완, 최종 v2를 별도 스캔.
정확한 B 후보 sha256:4601c1f7bd494a2ea0b8e14951a57d5641cd34f3b2dd7032ee5b8480bb304854:
artifacts/security/container-scan/helper-b-qwen-mobile-v2-20261011.json HIGH/CRITICAL0 PASS.
배포 전 최신 baseline은 health-helper-runtime-20261011T071104Z/result.json(Cloud39d2… / B83c468…)이다.
사전 runtime/이미지 hash·기존 설정 비교 preflight PASS: helper-align-b-20261011T071903Z/result.json.

### 브라우저에서 발견한 추가 수정과 최신 배포

v2에서 실제 질문 생성·출처 열기·담기·수정·모아보기 및 임상 질문 거부 시 메모 보존 확인.
앱 잠금 시 visible 메모는 사라졌지만 닫힌 dialog의 notesList에 문구가 남았음: 초기화 FAIL로 보존.
공통 reset에 notesList.replaceChildren(), 수동 입력 초안 및 상태 문구 초기화를 추가했다.
모바일 진료 준비 안내의 '오른쪽'을 '아래 메모'로 조정. 공식 자료 본문 변경 아님.
SW v16으로 공개 shell cache 버전을 갱신했다. focused12/12 PASS(0.391초),
최종 security gate PASS(unit65.321초 / secret3.221초 / dependency2.600초 / exit0).
증적: artifacts/workstation/helper-mobile-v3-security-gate-20261011.json.

v3 배포를 scan 완료 전 실행한 첫 명령은 scan 파일 부재로 exit1; 원격 변경 전 중단.
scan 완료 후 재실행은 PASS. B 최종 image:
sha256:a3338717c7e96a051d6b2545bccf9eff40a58e3a4151d4ec5742c34fa144dccf.
artifacts/security/container-scan/helper-b-qwen-mobile-v3-20261011.json HIGH/CRITICAL0 PASS.
배포·복구·재적용 및 source hash 확인 PASS:
artifacts/workstation/helper-align-b-20261011T073443Z/result.json.
최초 v2 배포·복구 기록은 helper-align-b-20261011T072044Z/result.json에 보존.
최종 API·감사·이미지: health-helper-runtime-20261011T073744Z/result.json PASS(exit0).
Cloud39d2… / ingress ac29… / PostgreSQL8d0e… 유지.
AFP·ALT 실제 Qwen 생성, 무인증/변조401, 환자 override422, 임상 REFUSED,
미등록 주제 INSUFFICIENT_EVIDENCE 및 감사 세션 연결 확인. 전체 감사 chain 재검증 아님.

최신 모바일 브라우저에서 signed 로그인→홈→건강도우미→질문 생성→출처→담기·수정·모아보기 확인.
브라우저 증적·실제 화면: artifacts/workstation/health-helper-runtime-20261011T073744Z/browser-verification.json,
같은 폴더 mobile-helper.png. viewport390 요청, 실제 CSS375/scrollWidth375; warn/error0 확인.
최종 잠금: 숨김 dialog notes0 / 수동 초안 빈 값 / 이전 문구 DOM에 없음 PASS.
기존 앱의 개발 인증·단말 보안 시뮬레이션을 실제 IdP/FIDO2로 주장하지 않는다.
실제 휴대전화 설치/오프라인 AI/개인 기록 해석/의료 설명 생성은 NOT VERIFIED.
모델·PC·SSH가 꺼지면 사용 불가. 자동 시작/HA 미구현. 최신 모바일에서 실제 모델 정지 시험은 NOT VERIFIED;
서버 실패·offline·oversize·late reply 차단은 집중 테스트 범위 PASS이며 과거 웹 장애 증적과 구분한다.
재현: /mobile/ → 환자로 시작하기 → 기존 시연 계정 로그인 → 홈의 '내 기록을 알기 쉽게'.
복구: 위 배포 스크립트가 receipt의 기존 compose 구성으로 되돌린 후 readiness 확인을 실제 수행했다.
같은 baseline 파일로 재실행하지 않는다. 실행 전 현재 이미지·설정을 다시 읽고 해당 후보/scan/hash를 대조한다.
다음 작업 한 개: 실제 휴대전화에서 홈 화면 설치·재접속·동일 질문 흐름 검증.
신규 증적 DRAFT / UNASSIGNED, commit/push 없음. 기존 검토를 신규 코드에 승계하지 않는다.

## 최신 실행: 2026-10-11 16:01 KST 로컬 Qwen 진료 질문 흐름 — scoped PASS

HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty 보존. 신규 증적 DRAFT / UNASSIGNED.
지정한 환자 웹 흐름은 신규 로그인 → AFP 질문 → 실제 Qwen 진료 질문 → 공식 출처 카드 → 원문 열기 → 질문 담기·수정·모아보기다.
전체 의료 설명 RAG, 전체 MVP/v3 또는 모바일 전용 PWA 완료가 아니다.

실행 이미지:
- Control `sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7`.
- B Portal `sha256:83c468fb4613e60e4c0eef370484e6e37fca6191e6c7898ec845df860f8ee27c`.
- 기존 ingress `ac29dc9d…`, PostgreSQL `8d0e686f…` 유지. CT/PACS/동의/DB schema 변경 없음.

| 검증 | 결과 | 범위와 증적 |
|---|---|---|
| 최신 이미지·소스 hash·readiness·rollback 후 재적용 | PASS | helper-align-cloud-20261011T063754Z / helper-align-b-20261011T065225Z의 result.json |
| AFP/ALT 실제 AI 질문 API | PASS | health-helper-runtime-20261011T065633Z/result.json, VISIT_PREPARATION / LOCAL_QWEN / generationUsed=true |
| 무인증·변조 토큰·patientId 주입 | PASS | 401 AUTHENTICATION_REQUIRED / 401 JWT_INVALID_SIGNATURE / 422 HELPER_INPUT_INVALID |
| 임상 판단·미등록 주제 | PASS | REFUSED / INSUFFICIENT_EVIDENCE. HTTP200을 생성 성공으로 해석하지 않음 |
| 최신 환자 브라우저 전체 지정 흐름 | PASS | 위 API 폴더 browser-verification.json 및 browser-qwen-desktop.jpg, KDCA 6560 원문 heading 확인 |
| 390px 반응형 가로 넘침 수정 | PASS | viewport390 / document375, browser-responsive-390.jpg. 이전 v2 document399 FAIL은 보존 |
| 모델 장애·오류 안내·기존 메모 보존·복구 후 후속 질문 | PASS | 같은 Control + B v2에서 실제 relay 종료/복구 검증. v3는 CSS만 추가 변경; v3 장애 재실행은 NOT VERIFIED |
| 감사 연결 | PASS | API db37446f… 및 브라우저 cbb0e0e1… 생성 세션과 record_hash 존재. 전체 hash chain 재검증 아님 |
| 브라우저 error/warn | PASS | 최신 검증 탭 수집 빈 목록 |
| 모바일 전용 PWA·실제 휴대전화·의료 설명 생성·개인 기록 해석 | NOT VERIFIED | 이번 범위 밖; 의료 설명 생성 비활성, recordContext NOT_CONNECTED |

명령 및 종료 결과:
- `node --test --test-concurrency=4 --test-reporter=spec`: exit0, 1015/1015, 64.678초. artifacts/workstation/helper-qwen-final-node-tests-20261011.log. 마지막 CSS minmax 수정 전 전체 실행이며 이후 UI 집중6/6 PASS.
- helper/Portal/Gateway/UI 집중27/27 PASS, visit 전용6/6 PASS. `node scripts/security-gate.js`는 HIPASS_SECURITY_GATE_TIMEOUT_MS=120000 기준 PASS(unit70.411초 / secrets3.334초 / dependency2.926초).
- 정확한 최종 이미지 검사: artifacts/security/container-scan/helper-cloud-qwen-v2-20261011.json 및 helper-b-qwen-v3-20261011.json, HIGH/CRITICAL0 PASS. 마지막 secret scan PASS.
- `python scripts/health-helper-align.py --role CLOUD --baseline <당시 baseline> --apply`, `--role B`는 exit0, pinned SSH / rollback / 재적용 PASS. 소요시간 별도 전체 계측 없음. 최신 B baseline은 health-helper-runtime-20261011T064304Z/result.json이었다. 낡은 baseline으로 반복 실행하지 않는다.
- `python scripts/health-helper-runtime-check.py --verify --qwen`: exit0, 최신 이미지에서 API 정상·거부 및 감사 확인. health-helper-runtime-20261011T065633Z/result.json.
- `python scripts/health-helper-local-ops.py --audit`: exit0, helper-qwen-audit-20261011T070100Z/result.json. 최신 브라우저 생성 약8.629초. 성능 보장·부하 시험 아님.

생성 파일: src/health-helper-visit.js, src/health-helper-ollama.js, scripts/health-helper-local-relay.js,
scripts/health-helper-local-ops.py, test/health-helper-visit.test.js.
연결 변경: src/health-helper-rag.js/server.js/capstone-b-portal.js/data-plane-gateway.js,
public/ui/patient-helper.js/css, Dockerfile.health-helper, test/capstone-b-portal.test.js,
scripts/health-helper-runtime-check.py/health-helper-align.py. 기존 dirty 파일의 선행 변경은 보존했다.

재현: B 환자 웹 → 시연 환자 로그인 → 건강도우미 → AFP 비교 질문 → AI 추천 담기 → 문구 수정 → 질문 모아보기.
실행·복구는 아래 Runbook과 각 배포 receipt의 rollbackFiles를 사용한다. 별도 commit/push 없음.
남은 위험: PC/SSH 의존·CPU 추론·동시1회·자동 기동 없음·메모는 페이지 메모리만·공식 본문 이용 허가 및 독립 검토 미완료.
다음 구현 단위 한 개: 모바일 전용 PWA 로그인에서 동일 인증 API의 질문 생성·담기·수정 흐름 연결 및 정상·거부 검증.

## 로컬 Qwen 구현 범위와 제약

이번 구현은 **의료 설명 생성 RAG가 아닌, 프로젝트 작성 진료 준비 지침 검색 + Qwen 질문 생성**이다.
질병관리청 제4유형 본문은 복제·임베딩·모델 입력·재서술하지 않는다. 기존 공식 원문 카드와 이용조건을 유지한다.
AFP/AST/ALT/GGT/간기능의 정규화된 주제와 UNDERSTAND/COMPARE/PREPARE 의도만 모델에 전달한다.
선택한 합성 기록의 수치·환자 식별정보·질문 자유문·CT 픽셀·공식 의학 본문은 모델 입력에 포함하지 않는다.
대화 전체를 모델에 보내지 않으며, 선택한 검사 주제로 후속 질문을 연결한다. 실제 본인 기록 해석은 NOT CONNECTED다.

연결은 환자 HTTPS → B Portal → 인증된 Cloud Control → 읽기 전용 사설 Unix socket → pinned SSH →
Windows loopback relay(127.0.0.1:11436) → Ollama(127.0.0.1:11434)다. AI TCP 공개 포트·신규 클라우드 리소스·DB migration 없음.
Qwen3.5:4b Q4_K_M, 로컬 모델 digest `2a654d98e6fba55d452b7043684e9b57a947e393bbffa62485a7aac05ee4eefd`.
모델은 기존 설치본을 사용했으며 이번 작업에서 학습/파인튜닝하거나 새 모델을 다운로드하지 않았다.
초기 모델 호출 49.6초(모델 로딩 약39.2초), 이후 시험 호출 약4.7~10.3초. 동시 사용량/장기 부하 성능 증거는 아니다.

기존 환자 인증·신뢰 ingress·감사 기록을 유지한다. 사용자별 분당5회 및 active 제한, relay 동시1회,
출력 질문 최대2개, JSON schema/질문 형식/금지 내용 재검증을 적용한다. 모델 불가/시간 초과/부적절 출력은 실패다.
서버/relay deadline 60/55초, UI65초. B의 **정확한 helper POST**만 65초/32KiB HTTPS 응답 한도를 사용한다.
기존 DICOM/Gateway 및 다른 API의 10초 제한·TLS 검증·권한·암호화는 바꾸지 않는다.
관련 기존 요구사항: FR-037~FR-041(감사), 보안/개인정보 최소화 원칙. 건강도우미 전용 FR/NFR ID는 UNASSIGNED.

### 보존한 중간 실패

`artifacts/workstation/health-helper-runtime-20261011T062928Z/result.json`: 로그인200, 첫 helper503
CAPSTONE_PORTAL_UNAVAILABLE, 이후 동시 요청429, 전체 FAIL. B 중계10초와 약11.7초 모델 처리의 예산 불일치,
일부 모델 평서문 출력 확인. 이를 정책상 DENY나 정상 생성으로 처리하지 않았다.
첫 후보 Control85330586… / B42e73664… 배포·복구 자체는 PASS였으나 사용자 AI 흐름 성공은 아니었다.
정확한 경로 전용 transport 및 question-mark schema/few-shot 예시를 보완한 v2를 별도 검증한다.

### 실행·복구

PC에서 Ollama가 실행 중인지 먼저 확인한다. 기존 프로세스를 무작정 종료하지 않는다.

```powershell
& 'C:\Users\user\AppData\Local\Programs\Ollama\ollama.exe' serve
node scripts/health-helper-local-relay.js
```

두 서비스는 loopback 전용이다. 다른 터미널에서 기존 pinned SSH로 연결한다.

```powershell
ssh -N -T -o BatchMode=yes -o StrictHostKeyChecking=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -o UserKnownHostsFile=C:/Users/user/.ssh/highpass-capstone-cloud/known_hosts -i C:/Users/user/.ssh/highpass-capstone-cloud/id_ed25519 -R /home/highpassadmin/.highpass-helper/ollama.sock:127.0.0.1:11436 highpassadmin@138.91.2.60
python scripts/health-helper-local-ops.py --socket-ready
python scripts/health-helper-runtime-check.py --verify --qwen
```

인증정보는 도구의 concealed 입력으로만 전달한다. SSH socket이 이미 있으면 현재 연결 상태를 확인하고,
임의로 파일/프로세스를 삭제하지 않는다. PC 절전·종료·SSH 단절 시 AI가 중단되며 저장한 질문은 페이지 메모리에 유지된다.
현재 모바일 전용 `/mobile/` PWA에 새 건강도우미 메뉴를 추가한 것은 아니다. 환자 웹의 반응형 화면/동일 서버 API와 구분한다.
의료 설명 생성에 필요한 사용 허가·콘텐츠 검토, 실기기 모바일 접속, 다중 환자 부하·HA·기동 자동화는 미완료다.

## 최신 실행: 2026-10-11 14:45 KST API·배포 정렬 및 실제 브라우저 PASS

이 절 이후 '미배포/미검증/다음 작업'은 당시 이력이다. 현재 상태는 통합 상태 문서의 최상단 절을 참조한다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty; 신규 증적 DRAFT / UNASSIGNED.

### 원인과 최소 변경

엄격한 TLS 검증으로 기존 환자 로그인 200 뒤 helper POST가 404 `API route not found`임을 확인했다.
Cloud 기존 80fac45b…에는 helper route/modules가 없으며 B ec1faaa0…에는 이전 정적 화면이 있었다.
인증 우회나 정책 완화가 아닌 실행 코드 정렬로 해결했다. Dockerfile.health-helper의 Control target은
server.js 및 helper 4개 모듈, UI target은 patient-helper.js/css만 overlay한다.
새 운영 도구 scripts/health-helper-runtime-check.py, scripts/health-helper-align.py는 pinned SSH,
유한 timeout, 이미지·파일 hash, 기존 Compose/runtime 설정 비교, readiness 및 rollback을 사용한다.
DB schema/CT/PACS/동의 수정·신규 모델 활성화 없음. 정상 요청/로그인으로 발생한 감사 append는 유지.

### 실제 결과

| 검사 | 결과 | 범위 |
|---|---|---|
| 서버·UI 이미지 및 소스 hash 정렬 | PASS | Control cb2a0e4e… / B b78f1e35… |
| 배포 → 이전 이미지 복구 → 후보 재적용 | PASS | 양쪽 readiness, 기존 설정 보존; Cloud ingress/PG 불변 |
| 로그인 후 AFP/ALT 원문 안내 API | PASS | 200 SOURCE_GUIDANCE, generationUsed=false |
| 무인증 / 변조 토큰 / patientId 주입 | PASS | 401 AUTHENTICATION_REQUIRED / 401 JWT_INVALID_SIGNATURE / 422 HELPER_INPUT_INVALID |
| 임상 판단 요청 / 미등록 주제 | PASS | HTTP 200이지만 각각 REFUSED / INSUFFICIENT_EVIDENCE; 생성 성공 아님 |
| 실제 환자 브라우저 AFP 질문→카드→원문 | PASS | 새 로그인, 간경변증 6560 원문 새 탭 로드·AFP 위치 확인 |
| 응답 예시 질문 담기→수정→모아보기 | PASS | 수정한 문장 표시; 페이지 메모리 한정 |
| 감사 연결 | PASS | API requestId ecc0b0cb-9533-4752-9a13-a3778a161ec0와 audit_session_id 일치; hash 존재 |
| 콘솔 error/warn | PASS | 새 검증 탭 수집 결과 빈 목록 |
| 생성형 RAG·개인화·영구 메모·CT/QR 전체 회귀 | NOT VERIFIED | 원문 안내형 흐름과 별도 |

합성 홍길동 56세 계정으로 로그인했고 홈에서 기존 CT 1시리즈·700장 목록을 확인했지만 픽셀을 재검증하지 않았다.
원문 조건을 보존하고 본문 재서술·임베딩을 수행하지 않았다. 추천은 PROJECT_TEMPLATE이며 AI 생성이 아니다.
기존 사용자 탭/메모를 보존하고 검증용 새 탭에 결과를 남겼다. 로컬 구 서버는 재시작하지 않았다.

### 명령·증적·복구

- 집중: `node --test test/health-helper-corpus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js test/capstone-control-ingress.test.js test/capstone-b-portal.test.js` — exit0, 60/60, 1.502초.
- 전체: `node --test --test-concurrency=4 --test-reporter=spec` — exit0, 1008/1008, 63.939초. 로그 `artifacts/workstation/helper-alignment-baseline-20261011/full-tests.log`.
- Security Gate: `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000` 환경에서 `node scripts/security-gate.js` 재실행 PASS(unit 59.891초, secrets 2.238초, dependency 2.408초). 최초 unit exit1/67.471초의 개별 실패 원인은 로그 미확보로 미확정.
- 이미지 검사: `node scripts/container-scan.js`, HIPASS_CONTAINER_SCAN_IMAGE와 HIPASS_TRIVY_RESULT 지정. `artifacts/security/container-scan/helper-cloud-20261011.json`, `helper-b-20261011.json`: 해당 정확한 이미지 HIGH/CRITICAL 0.
- 배포: `python scripts/health-helper-align.py --role CLOUD --baseline artifacts/workstation/health-helper-runtime-20261011T053134Z/result.json --apply` 및 같은 명령 `--role B`. 모두 exit0, timeout 내 종료. 개별 전체 소요시간은 별도 계측하지 않음.
- 배포/복구 증적: `artifacts/workstation/helper-align-cloud-20261011T053501Z/result.json`, `helper-align-b-20261011T053720Z/result.json`. 전체 image ID, Compose files/rollbackFiles, hash 포함.
- 실제 API: `python scripts/health-helper-runtime-check.py --verify` — exit0. `artifacts/workstation/health-helper-runtime-20261011T054128Z/result.json`에 상태 코드·감사·배포 hash. 종료코드만으로 PASS 처리하지 않고 각 응답을 대조했다.
- 브라우저: 같은 폴더 `browser-flow.jpg`, `browser-flow-full.jpg`. 약 14:42~14:45 KST, 실제 클릭/입력, 새 로그인; 대역 사용 없음.
- 재현: B 환자 웹 신규 로그인 → 건강도우미 → AFP 공식 자료 요청 → 기관명 링크 → 담기 → 문구 수정 → 질문 모아보기. 새로고침 시 메모 소멸은 현재 계약이다.
- 복구: 해당 receipt의 rollbackFiles 순서와 기존 runtime 환경을 유지하여 `docker compose -p <기존 프로젝트> -f <각 rollbackFiles> up -d --no-deps --pull never <control 또는 portal>` 실행. secret 포함 환경은 출력하지 않으며 health/TLS를 재확인한다. 실제 복구는 이번 도구에서 검증했고, 현재는 후보 이미지가 재적용된 상태다. 낡은 baseline으로 apply를 반복하지 않는다.

관련 요구사항: 신규 RAG FR/NFR 미배정, FR-037~041 감사 및 인증·최소수집 원칙 제약. 기존 API 계약/DB migration 변경 없음.
다음 작업은 이 고정 이미지·증적의 독립 검토 한 개다. 전체 MVP/v3 또는 생성형 RAG 완료를 선언하지 않는다.

## 이전 브라우저 관측: 질문 응답 차단, 메모 부분 PASS

2026-10-11 14:12~14:17 Asia/Seoul. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty.
검토 상태 DRAFT / UNASSIGNED. 실제 IAB 환자 탭에서 클릭·입력·접근성 트리·화면으로 확인했다.
네트워크 응답 대역이나 인증 우회는 사용하지 않았다. 기존 로그인 세션을 사용했으며 신규 로그인 검증은 아니다.

| 단계 | B병원 실제 환자 화면 | 로컬 실행 화면 |
|---|---|---|
| AFP는 어떤 검사인가요? 제출 | FAIL — 설명을 받지 못했어요 표시 | FAIL — 동일 실패 안내 |
| 질병관리청 출처 카드 | NOT VERIFIED — 질문 응답 실패로 미표시 | NOT VERIFIED — 미표시 |
| 카드에서 원문 열기 | NOT VERIFIED — 클릭할 출처 없음 | NOT VERIFIED — 클릭할 출처 없음 |
| 기존 프로젝트 예시 질문 담기 | PASS — 기존 1개에서 2개로 증가 | PASS — 0개에서 1개로 증가 |
| 담은 질문 수정·모아보기 | PASS — 수정 문장과 기존 질문 함께 표시 | PASS — 수정 문장 표시 |

B URL: https://192.168.111.149:9443/hipass/#PATIENT.
화면은 구형 '설명 듣기 / AFP 일반 설명 범위'이며 최신 '공식 자료 찾기 / 질병관리청 원문 안내'가 아니다.
로컬 URL: http://localhost:3000/hipass/#PATIENT. 최신 정적 화면이지만 로그인 후 환자 정보 표시 전의 개발 화면이며,
홍길동 고정 CT 로그인 시나리오의 대체 증거가 아니다. 로컬 Node PID5240 시작 시각은 2026-10-07 13:53:26,
server.js 최종 변경은 2026-10-11 13:03:38, health-helper-rag.js는 14:04:22다.
실행 서버가 신규 API 파일 변경보다 먼저 시작되어 서버/정적 코드 불일치가 확인된다.
각 실패의 HTTP 상태·서버 거부 코드와 B/Control 실행 이미지 digest는 이번에 확보하지 못했다.
401·모델 미설정·정책 거부 등 정확한 실패 사유를 단정하지 않는다.

메모 수정 증거: '브라우저 검증용: 이전 결과와 비교할 때 무엇을 확인하면 좋을까요?'가 모아보기에 표시됨.
B의 검증용 두 번째 질문만 제거하고 기존 '다음 진료 전에 무엇을 준비할까요?'를 보존했다.
로컬 임시 탭은 닫았다. 메모는 페이지 메모리 범위이며 서버 저장·새로고침 후 보존을 검증한 것이 아니다.
CT·동의·PACS·인증서·서버 프로세스·배포본을 변경하지 않았고 commit/push 없음.
브라우저 단계에는 셸 종료 코드가 없으며 위 값은 UI 관측 결과다.
진단 명령 Get-NetTCPConnection, Get-Process/Get-Item, rg, git rev-parse 및 git diff --check는 exit0.
git diff --check는 0.734초, 기존 CRLF 경고 유지. 신규 단위/전체 회귀는 재실행하지 않았다.
관련 신규 RAG FR/NFR 미배정; FR-037~041 감사 공통 제약 유지. 실제 요청 감사 연결은 NOT VERIFIED.

전체 '질문 → 출처 카드 → 원문 → 담기·수정' 결과는 FAIL이며 메모 UI만 부분 PASS다.
다음 작업 한 개: 실제 배포 API 응답 코드·감사·실행 이미지와 최신 코드 차이를 확인하고,
서버 재시작/배포 범위 확정 후 같은 브라우저 흐름을 다시 검증한다. 이번 검증에서 재배포하지 않는다.

## 이전 구현: 질병관리청 원문 검색·대화 안내 연결 — 로컬 / DRAFT

2026-10-11 Asia/Seoul. 이번 실제 완료 범위는 **서버 원문 링크 검색 → 대화 안내 응답 →
출처 카드 → 프로젝트 진료 질문 예시 담기**의 로컬 구현과 HTTP/DOM 대역 검증이다.
실제 브라우저 로그인 종단 완료 또는 생성형 RAG 완성은 아니다.

질병관리청 [포털](https://health.kdca.go.kr/healthinfo/),
[간기능검사 5444](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444),
[간경변증 6560](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6560)을 재확인했다.
검색 목록 버전은 kdca-links-20261011-v1, 링크 2개. 본문 전문·요약·수치·이미지 복제나 임베딩 없음.
AFP 링크는 6560의 '정기 진찰' 내 AFP 언급 위치를 가리킨다. 간경변증 환자 맥락이며 AFP 전용
설명·개인 진단·검사 주기 안내가 아니라는 설명을 출처 카드에 붙인다. 간기능/AST/ALT/GGT는 5444로 연결.
BMI 등 등록되지 않은 주제는 INSUFFICIENT_EVIDENCE. 전체 포털 수집·일반 질환 검색은 구현하지 않았다.

### 코드·API·화면 영향

- src/health-helper-corpus.js: 불변 링크 목록·기관·제목·등록/갱신/확인일·관련 절·개별 제4유형 조건.
  생성 근거 후보와 LINK_ONLY 자료를 분리하며 이전 후보 v3와 생성 게이트는 보존.
- src/health-helper-rag.js: 기본 SOURCE_GUIDANCE 모드. 모델이 설정되어 있어도 원문 안내에서는 호출하지 않음.
  반환문은 프로젝트가 작성한 고정 탐색 안내이며 의학 원문의 재서술이 아니다.
  권한/입력/임상요청 거절은 기존대로 수행하고 HELPER_SOURCE_GUIDANCE 감사 이벤트를 남긴다.
  사용자 질문·수치·이름·기록은 외부 사이트/모델/감사 본문으로 보내지 않음. audit 장애는 성공 응답 차단.
- public/ui/patient-helper.js/css: 기존 Pretendard·절제된 블루·세이지 질문 영역 유지(frontend-design 적용).
  기존 아산 AFP 전용 링크 가정을 제거하고 KDCA 출처 카드·원문 새 창·조건·맥락·갱신일 표시.
  HTTPS 정확한 KDCA 호스트·콘텐츠 경로·숫자 ID만 허용하며 임의 URL·추가 쿼리·자격정보는 차단.
  textContent 유지. 안내의 질문은 PROJECT_TEMPLATE / AI 추천 아님. 기존 담기·수정·대화 전환 보존.
- test/health-helper-corpus.test.js, health-helper-rag.test.js, health-helper-http.test.js,
  patient-helper.test.js: 기본 원문 안내·모델 미호출·감사 실패·입력 우회·출처 링크/카드·질문 담기 검증.
  기존 생성 시험은 명시적으로 GENERATION 및 승인 대역을 지정. 실제 기관 승인으로 승계하지 않음.

POST /api/v1/me/health-helper/questions 요청은 {question:string} 유지, DB 변경 없음.
변경 전 기본 후보는 승인 근거 부족으로 INSUFFICIENT_EVIDENCE.
변경 후 등록된 주제는 HTTP200 SOURCE_GUIDANCE, sources/section/license/contextNote,
generationUsed=false, questionOrigin=PROJECT_TEMPLATE. 질문 예시·고정 탐색 안내이지 AI 생성 답변이 아님.
영향 화면은 환자 건강도우미. 단순 API 성공을 실제 환자 웹 종단 성공으로 표현하지 않는다.
신규 RAG FR/NFR 미배정; FR-037~041 감사 및 인증·최소수집 공통 제약 유지.

### 실행 결과·남은 범위

| 검증 | 결과 | 실제 실행 |
|---|---|---|
| 집중 corpus/RAG/HTTP/UI | PASS | node --test test/health-helper-corpus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js, 45/45, exit0, 0.396초 |
| 기존 인증·접근경계 회귀 | PASS | node --test test/capstone-control-ingress.test.js test/mobile-capstone-auth.test.js test/patient-self-view-authorization.test.js, 28/28, exit0, 0.854초 |
| 비밀정보 검사 | PASS | node scripts/security-secret-scan.js, findings0, exit0, 호출 1.975초(구문 검사 포함) |
| 변경 서버/UI JS 구문 | PASS | node --check 3개 파일, exit0 |
| 실제 브라우저 로그인·답변 카드·원문 열기·담기 | NOT VERIFIED | DOM 대역 시험과 별개 |
| 실제 모델·개인 기록·벡터 검색·전체 회귀 | NOT VERIFIED | 모델 호출 없이 제한 주제의 링크 메타데이터 검색만 구현 |

이용조건은 변경금지·비상업·출처표시 유지. 신규 증적 DRAFT / UNASSIGNED, 독립 사람 검토 없음.
서버/정적 소스만 로컬 변경. A/B/Cloud/PACS·700장 CT·DB·인증서·실행 이미지 변경·모델 설치·배포·commit/push 없음.
복구: 배포하지 않았으므로 VM rollback 대상 없음. 기존 미커밋 작업을 보존하고 무관한 파일을 reset하지 않는다.
다음 작업 한 개: 허용된 로컬 환경에서 실제 환자 로그인→건강도우미→AFP/ALT 원문 카드→
링크 열기→질문 담기·수정을 브라우저로 검증. 그 전 새 이미지 배포/전체 완료 선언을 하지 않는다.

## 이전 결정: 질병관리청 기본 출처 · 비상업적 원문 안내 우선

2026-10-11 Asia/Seoul 사용자 지시로 기본 출처를 질병관리청 국가건강정보포털로 확정한다.
자료 교체 탐색 우선 방향은 아래 이전 이력으로 전환한다. 이 결정은 자료 선정 정책이며
제4유형 자료의 생성형 재서술 허가 또는 신규 콘텐츠 승인으로 처리하지 않는다.

- 용도: 비상업적 캡스톤·합성 시연. 상업 서비스 전환 시 이용조건을 다시 검토한다.
- 기본 제공 방식: 질문 주제에 맞는 질병관리청 원문 링크와 기관·자료명·개별 이용조건 안내.
- 출처표시·비상업적 이용·변경금지 세 조건을 모두 지킨다. 비상업적 사용만으로 변경금지가 해제되지 않는다.
- 제4유형 원문을 AI로 요약·번역·쉬운 말로 재서술하거나 수치·표를 바꾸는 사용은 현재 승인하지 않는다.
- 원문 표시가 필요한 경우 개별 자료 조건과 인용 범위·문맥을 검토하고 원문을 변경 없이 구분한다.
  이번 작업은 원문 전문 복제나 자동 발췌 허가를 확정한 것이 아니다.
- 직접 작성한 일반 UI 안내·질문 메모와 질병관리청 콘텐츠를 구분하며 기관 후원·판독·인증을 암시하지 않는다.
- 생성형 답변이 꼭 필요하면 변경 허용 자료를 별도 근거로 쓰거나 재서술 용도에 대한 별도 허가를 확보한다.

기준: [공공누리 제4유형 공식 이용조건](https://www.kogl.or.kr/info/licenseType4.do),
[질병관리청 간기능검사](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444).
이 방향에서 건강도우미는 우선 **근거 검색·원문 안내형**으로 설계하며 이를 생성형 RAG 완성으로 부르지 않는다.
기존 후보 v3·차단 플래그·정확한 텍스트 해시와 DRAFT / UNASSIGNED 상태는 보존한다.
현재 코드는 원문 안내형으로 전환 구현한 상태가 아니며 이번에는 문서 기준만 변경했다.
관련 신규 RAG FR/NFR 미배정. 기존 인증·최소수집·감사 제약을 유지하며 권한이나 API 변경 없음.
이번 코드 테스트·브라우저·배포: NOT VERIFIED/미실행. 모델 활성화·commit/push 없음.

다음 작업 한 개: 질병관리청 기본 출처의 주제별 원문 링크 카탈로그와 건강도우미의 출처 안내 응답을 연결한다.
모델에 제4유형 재서술 후보를 전달하지 않고 원문 열기·이용조건 표시를 실제 화면에서 확인한다.

## 이전 작업: 변경 허용 출처로 교체 착수 — 후보 v3 / 부분 진행

2026-10-11 Asia/Seoul. 사용자 선택은 별도 허가 신청이 아니라 변경·재서술 허용 국내 공식 출처 탐색이다.
`health-ko-20261011-candidate-v3`: 기존 차단 후보 8개 보존 + 허용 출처 기반 제한 후보 1개.
전체 AFP·간기능 근거 교체는 **미완료**. 부족한 검사 목록으로 기존 의학 설명 8개를 대체하지 않았다.

| 자료 | 이용조건·내용 확인 | 이번 결정 |
|---|---|---|
| [의왕시 보건소 검사실](https://www.uiwang.go.kr/heal/UWHEAL0305) | 개별 하단 제1유형, 변경 가능. 간기능 및 생화학 검사 목록. 최종수정 2023-02-22 | `uiwang-laboratory-0305` 추가, 공개 라이선스 범위의 reuseStatus=CLEARED. 독립 콘텐츠 검토 UNASSIGNED |
| [옥천군 보건소 각종검사](https://safe.oc.go.kr/health/contents.do?key=1368) | 개별 제1유형. 목록 중심으로 의학적 설명 부족 | 중복 목록으로 후보 수를 늘리지 않음 |
| [의왕시 생화학 검사 질의응답](https://www.uiwang.go.kr/heal/UWHEAL0506/6980955?curPage=8) | 구체적인 AST/ALT 목록이 있으나 해당 게시물 제4유형. 인접 검사실의 제1유형을 승계할 수 없음 | 제외 |
| [정책브리핑 간 질환 생활수칙](https://www.korea.kr/news/healthView.do?newsId=148955632) | AFP 설명 존재. 실제 HTML은 공공누리 미부착 자료에 담당자 협의 안내 | 허가 확인 없이 포함하지 않음 |
| [국가암정보센터 간 수치·AFP FAQ](https://www.cancer.go.kr/lay1/bbs/S1T811C676/E/22/view.do?article_seq=22537&mode=view&rn=139) | 유용한 내용이나 [저작권 정책](https://www.cancer.go.kr/lay1/S1T633C636/contents.do)에 변경 사전협의 제한 | 제외 |
| 대한진단검사의학회 AFP 숙련도 원저 DOI 10.47429/lmo.2021.11.4.245 | Crossref에 CC BY-NC 4.0 등록. [학술지 원문](https://labmedonline.org/journal/view.html?doi=10.47429/lmo.2021.11.4.245) 본문·개별 이용조건의 완전한 재확인 미완료 | 후보 코퍼스에 포함하지 않음. 공공기관 자료나 일반환자 안내로 오인하지 않음 |

제1유형 권리·조건: [공공누리 공식 이용약관](https://www.kogl.or.kr/info/licenseType1.do).
변경과 상업적 이용은 출처표시 조건 아래 허용되며 기관 후원·인증을 암시해서는 안 된다.
판정은 공개 이용조건에 근거한 프로젝트 결정이지 별도 기관 허가·법률 자문·임상 승인이 아니다.
사진·로고·전체 웹페이지·다른 게시물까지 허용된 것으로 확대하지 않는다. 학습/미세조정은 이번 범위가 아니다.

새 `liver-test-list`의 정확한 범위는 **보건소 검사 안내에 간기능검사가 있고 생화학 묶음에
혈당·신장기능·콜레스테롤 검사도 포함됨**이라는 목록 설명이다. 정상수치·AST/ALT 기전·AFP
해석·진료 주기·현재 비용은 설명하지 않는다. 별도 supportedIntents=DEFINITION을 붙여
정상범위/해석 한계 질문의 근거로 검색하지 못하게 했다. 개인 수치·합성 환자·영상은 추가하지 않았다.
대조 텍스트 SHA-256: `d5a11e4d178e7b0f8b2c8990349656aa3f4f8dca1afb5defaf652d95d954bfc1`.
출처·해당 절·공개 라이선스 증거 위치·최종수정일·재서술 표시·출처 링크를 코드에 고정했다.
이 해시는 우리 후보 문장의 식별값이지 원문 HTML 해시나 기관 인증이 아니다.

출처 허용과 콘텐츠 승인은 분리한다. 새 출처도 contentReview=UNASSIGNED이며 현재 검색 결과는
전 주제 빈 배열, 모델 입력은 차단된다. 기존 아산 AFP·질병관리청 제4유형 8개 후보는 계속
NOT_CLEARED_FOR_RAG다. 새 자료에 허가가 있다는 이유로 기존 자료를 자동 승인하지 않는다.
기존 citation 반환은 attribution/licenseTermsUrl을 보존하지만 실제 화면의 완전한 이용조건 표시와
독립 콘텐츠 검토는 활성화 전 별도 확인 필요. 기존 링크 중심 건강기록 UI는 수정하지 않았다.

변경: src/health-helper-corpus.js, test/health-helper-corpus.test.js 및 기존 두 상태 문서.
새 파일·라이브러리·DB·API 요청 계약 없음. 기존 Node ESM 검색·생성·인증·감사 구조 유지.
관련 신규 RAG FR/NFR 미배정. FR-037~041 감사 및 최소수집·fail-closed 공통 제약 유지.

검증: `node --test test/health-helper-corpus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js`:
39/39 PASS, exit0, 0.359초. 생성/인증 일부는 명시적 대역. 신규 테스트는 공개 라이선스와 콘텐츠
승인 분리·제한 자료 차단 유지·부족한 설명의 검색 차단·citation 귀속정보 보존을 확인한다.
`node scripts/security-secret-scan.js`: PASS, findings0, exit0, 1.791초.
`node --check src/health-helper-corpus.js`, `git diff --check`: exit0. 기존 CRLF 경고 유지.
추적 diff 검사는 미추적 파일 전체 검사를 대신하지 않으며 해당 JS는 구문 검사와 집중 테스트로 확인했다.
실제 생성 모델·브라우저 종단·전체 회귀·독립 콘텐츠 승인: NOT VERIFIED.
모델 활성화·A/B/Cloud/PACS 배포·700장 CT 변경·commit/push 없음.

다음 작업 한 개: AFP의 **일반적 의미와 단독 해석 한계**를 직접 지원하면서 개별 변경 허용 조건도
확인되는 국내 기관 자료 확보. 현재 목록 후보만으로 실제 AFP 챗봇을 활성화하지 않는다.

## 이전 검토: 후보 v2의 이용조건·원문 대조 결과

확인일 2026-10-11 KST. 대상 `health-ko-20261011-candidate-v2`, 2개 출처·8개 후보.
검토 수행자: Codex 에이전트(공식 페이지 대조). 사람 검토자/독립 콘텐츠 승인: UNASSIGNED.
김범희의 과거 PASS를 이 후보의 승인으로 승계하지 않았다. 확정한 것은 아래 프로젝트 사용 결정이며
기관의 이용 허가나 임상 콘텐츠 승인, 법률 판단을 받은 것이 아니다.

### 이용조건 결정

| 자료 | 이번에 추가 확인한 개별 근거 | 현재 RAG 재서술 용도 결정 |
|---|---|---|
| 질병관리청 간기능검사 5444 | 해당 페이지 하단 자체에 출처표시·상업적이용금지·변경금지 조건 표시 | NOT_CLEARED_FOR_RAG: 자동 답변 근거로 사용하지 않음 |
| 서울아산병원 AFP 133 | 해당 페이지의 콘텐츠 제공 문의 링크가 재가공 제한·신청 절차 안내로 연결 | NOT_CLEARED_FOR_RAG: 별도 허가 증거 없으므로 사용하지 않음 |

출처: [간기능검사 개별 페이지](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444),
[공공누리 제4유형 공식 조건](https://www.kogl.or.kr/info/licenseType4.do),
[AFP 개별 페이지](https://www.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=133),
[서울아산병원 제공 안내](https://www.amc.seoul.kr/asan/custom/homepageinquiry/contentsInquiryRegistView.do).
제4유형의 공유·이용 조건을 생성형 재서술에 대한 포괄 허가로 해석하지 않았다.
비영리 캡스톤, 출처 링크, 로컬 모델, 환자 동의만으로 변경 제한이 없어지는 것으로 처리하지 않는다.
사실 설명 자체에 대한 법적 보호 범위까지 단정하지 않으며, 이번에는 보수적인 프로젝트 게이트 결정을 적용한다.
원문 링크 안내와 RAG 입력/요약 생성은 구분한다. 기존 건강기록 화면의 링크·설명은 이번 작업에서 바꾸지 않았다.

### 8개 후보 콘텐츠 대조표

| 후보 ID | 원문의 대조 절 | 결과·수정 |
|---|---|---|
| afp-definition | 정의·정맥혈 검사 방법 | 혈액 측정 및 간 손상 등 여러 증가 상황에 대한 일반 설명 일치 |
| afp-reference | 검사결과 | 방법·기관별 차이와 결과지 확인을 설명. 원문의 수치 예시는 후보에 넣지 않음 |
| afp-limits | 헬스팁 | 단독 결과의 진단 한계 일치. 다른 정보와 의료진 확인은 보수적 안내 |
| liver-overview | 요약문 | 항목별 손상·기능 평가가 다름을 설명하는 범위에 한정 |
| liver-reference | 검사 결과 해석 | 원문이 직접 설명하는 검사실 간 차이로 문장 축소. 기존 '측정 방법' 표현 제거 |
| liver-limits | 검사 결과 해석 | 다른 장기와 임상 상황을 함께 고려하는 한계 설명 일치 |
| ast-alt-role | 검사 결과 해석 → 간세포 손상 → 아미노기 전달 효소 | AST/ALT와 간 이외 조직 설명 일치. 기존 절 표시 오류 수정 |
| ggt-role | 검사 결과 해석 → 감마 글루타밀 전이 효소 | 다양한 증가 원인과 종합 해석 설명 일치. 기존 절 표시 오류 수정 |

수치 판정·개인 위험도·주기·치료 권고는 후보에 넣지 않았다. 질환의 진단적 특이성을 주장하지 않는다.
이 표는 에이전트 원문 대조 결과이며 독립 의료 검토를 대체하지 않는다. 내용이 짧다는 이유로
저작권 사용 승인까지 받은 것으로 표시하지 않는다. 후보 전체는 여전히 DRAFT / UNASSIGNED다.

`src/health-helper-corpus.js`에 각 대조 결과의 `reviewerType=AGENT`, 확인일과 정적
`comparedTextSha256`을 기록했다. 테스트에서 현재 후보 텍스트와 정확히 일치하는지 확인한다.
이 대조 해시는 `approvedTextSha256`이 아니며 기존 실행 게이트를 활성화하지 않는다.
출처 `permissionEvidence=null`, 출처·후보 `contentReview=UNASSIGNED` 유지.

### 허가 확인에 필요한 내용 — 아직 발송하지 않음

기관에 확인할 사용 범위는 비영리 캡스톤의 로컬 RAG: 짧은 근거 후보 저장·색인, 모델 입력,
쉬운 설명 재서술 및 진료 질문 생성, 원문 출처 표시다. 원문 전체·이미지·로고는 재배포하지 않고
기관의 인증·후원을 주장하지 않으며 실제 환자정보는 입력하지 않는다. 학습/미세조정은 별도 범위로 제외한다.
허가 결과에는 대상 자료·버전, 저장/색인/생성/공개 시연의 범위, 기간, 상업적 전환 조건과
허가 증빙을 남겨야 한다. OpenAPI를 받는 것만으로 재서술 권한까지 확보했다고 간주하지 않는다.
외부 기관 연락·신청에는 별도 사용자 지시가 필요하며 이번에 메일/신청을 보내지 않았다.

### 이번 실행 결과와 다음 결정

- `node --test test/health-helper-corpus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js`:
  36/36 PASS, exit 0, 0.325초. 원문 일치는 에이전트가 대조했으며 테스트는 메타데이터·해시·게이트를 검증한다.
  테스트 대역의 CLEARED/APPROVED는 기관 허가나 독립 콘텐츠 승인 증거가 아니다.
- 실제 생성 모델, 독립 사람 콘텐츠 검토, 기관 별도 허가: NOT VERIFIED.
- 모델 설치/활성화, A/B/Cloud 배포, 원본 CT/DB 변경, commit/push 없음.

다음 선택이 필요하다: (A) 별도 허가 확인 절차를 진행하거나 (B) 재서술 용도가 허용된 출처로 교체한다.
발표 일정에는 B를 권장하되 후보를 무단 활성화하거나 자료를 자동 교체하지 않는다.
독립 콘텐츠 검토에는 후보 v2의 정확한 해시를 고정하며 이용 허가와 별도로 판정한다.

## 이전 착수 기록: 후보 v1

## 현재 결정: 공식 근거 후보 구축, 자동 답변 활성화 보류

이번 착수 범위는 기존 출처 목록 점검 → AFP·간기능 원문/이용조건 재확인 →
8개 근거 후보와 검색·출처·검토 게이트 구현까지다. 모델 활성화·자료 대량 수집·웹 배포는 하지 않았다.
이 절이 현재 결정이며 아래의 초기 AFP/Azure 구현 기록과 다음 작업은 과거 이력이다.
사용자가 선택한 비Azure 방향을 따른다. 기존 비활성 Azure adapter는 보존하되 실행하지 않는다.

확인된 요구사항: 공식 검사 설명과 환자 기록 분리, 개인 기록은 인증된 서버 계약으로만 연결,
진단·처방·영상 판독 제공 금지. 합리적 가정: 작은 검토 코퍼스에서는 동의어/주제 검색부터 시작하며
벡터 DB·외부 임베딩은 필수가 아니다. 현재 구현은 RAG 검색·검증 기반이며 실제 생성형 챗봇 완성이 아니다.

### 출처 선별표

`public/ui/patient-health.js`의 REF 14개와 기존 AFP RAG 출처를 확인했다.
다음 표의 재확인은 **이번 착수 작업** 기준이다. 기존 UI의 확인일/자료 날짜를 신규 확인 결과로 승계하지 않는다.

| 출처 / 기존 식별자 | 이번 선택·확인 | 런타임 사용 |
|---|---|---|
| 서울아산병원 AFP managementId=133 | 원문·콘텐츠 제공 안내 확인, 후보 3개 | 이용조건 확인·콘텐츠 검토 전 제외 |
| 질병관리청 간기능검사 cntnts_sn=5444 | 원문·이용 안내 확인, 후보 5개 | 이용조건 확인·콘텐츠 검토 전 제외 |
| 질병관리청 비만 6694 | 다음 순위, 원문/이용조건 재확인 안 함 | 제외 |
| e-나라지표 비만 유병률 idx_cd=2705 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 고혈압 6765 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 당뇨병 5305 | 다음 순위, 재확인 안 함 | 제외 |
| 서울아산병원 혈색소 managementId=119 | 다음 순위, 재확인 안 함 | 제외 |
| 서울아산병원 크레아티닌 managementId=104 | 다음 순위, 재확인 안 함 | 제외 |
| 경북대학교병원 만성콩팥병 sh_d_num=217 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 만성콩팥병 5457 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 단백뇨 6711 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 지질 분류 thtimt_cntnts_sn=124 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 C형간염 5309 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 폐기능검사 6258 | 다음 순위, 재확인 안 함 | 제외 |
| 질병관리청 국가건강검진 6671 | 다음 순위, 재확인 안 함 | 제외 |
| 홍길동 합성 결과·간암 시나리오·CT·초음파 | 의학 지식으로 사용하지 않음 | 공용 코퍼스에서 제외 |

### 재확인한 원문과 이용조건

- [AFP 원문](https://www.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=133):
  정의·검사결과·주의사항·헬스팁 확인. 게시/수정 날짜 미제공은 null로 유지한다.
- [간기능검사 원문](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444):
  게시 2020-07-15, 수정 2026-05-06. 요약문·검사항목·검사결과해석 확인.
- [질병관리청 이용 안내](https://health.kdca.go.kr/healthinfo/biz/health/portalUseGuidance/hlthinsReqst/hlthinsReqstMth.do?index=1):
  공공누리 제4유형(출처표시·상업적 이용금지·변경금지)과 개별 저작물 표시 확인 안내가 있다.
- [서울아산병원 콘텐츠 제공 안내](https://www.amc.seoul.kr/asan/custom/homepageinquiry/contentsInquiryRegistView.do):
  제공 절차와 비영리·재가공 제한을 안내한다.

이것은 이용 허가 또는 확정적 법률 판단이 아니다. 특히 해당 항목의 개별 이용조건과
검색 입력·재서술·생성 답변이라는 사용 범위가 허용되는지 아직 확인하지 않았다.
외부 기관에 신청·연락하지 않았으며 과거 사용자 PASS를 이 권리 확인으로 대체하지 않는다.

### 구현과 경계

`src/health-helper-corpus.js`: 버전 `health-ko-20261011-candidate-v1`, 출처 2개, 후보 8개.
AFP 정의·참고범위 차이·단독 해석 한계; 간기능 개요·참고범위·종합 해석·AST/ALT·GGT로 나눈다.
원문 전체나 표/수치 기준을 복사하지 않았다. 짧은 재서술 후보도 승인 전에는 모델에 넣지 않는다.
각 후보에 출처 ID·해당 절·조건·한계·버전·후보 텍스트 SHA-256을 붙였다.
해시는 **우리 후보 텍스트** 식별값이며 기관 원문 HTML의 해시나 기관 인증이 아니다.

런타임 검색에는 출처 `reuseStatus=CLEARED`, 출처·후보 `contentReview=APPROVED`,
현재 텍스트와 일치하는 `approvedTextSha256`이 모두 필요하다. 현재 실제 출처는 모두 미충족이다.
요청 body나 환경변수로 승인 플래그를 바꾸는 경로는 없다. 테스트의 승인 플래그는 명시적 대역이며
실제 출처 허가를 뜻하지 않는다. 게이트 활성화 시에도 기관·버전·검토 근거의 별도 확인이 필요하다.

검색은 AFP/AST/ALT/GGT/간기능의 제한된 동의어와 설명·기준·한계 우선순위로 최대 6개만 반환한다.
벡터 검색·재순위 모델·개인화 다중 턴은 구현하지 않았다. 생성 결과의 sourceIds는 실제 검색된
서버 출처로 해석하고 evidenceIds를 연결한다. 모든 출처가 AFP로 표시되던 단일 출처 가정을 제거했다.
자유 질문 원문·합성 수치·환자 ID·CT는 모델에 보내지 않는다. 개인 기록은 계속 NOT_CONNECTED다.
승인된 근거 없음은 INSUFFICIENT_EVIDENCE이며 생성 성공으로 표시하지 않는다.
기존 숫자/링크/HTML/진단·처방 제한, 인증·signed ingress·감사·timeout을 유지한다.
DB·API 요청 계약·UI·배포 이미지 변경 없음. 신규 응답 provenance evidenceIds만 추가한다.
관련 요구사항: 새 RAG FR/NFR는 미배정. FR-037~041 감사 및 인증·최소수집 공통 제약을 유지한다.

### 이번 검증과 다음 작업 한 개

- `node --test test/health-helper-corpus.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js`:
  34/34 PASS, exit 0, 0.403초. 로컬 HTTP/인증 대역·모델 대역이며 실제 모델/기관 승인 증거 아님.
- `node --test test/capstone-control-ingress.test.js test/mobile-capstone-auth.test.js test/patient-self-view-authorization.test.js`:
  28/28 PASS, exit 0, 0.763초. 이번 변경 관련 경계 회귀이며 실제 VM 종단 증거 아님.
- `node scripts/security-secret-scan.js`: PASS, findings 0, exit 0, 1.971초.
  변경 서버 JS의 `node --check` 및 `git diff --check`: exit 0. 기존 CRLF 경고 유지.
- 전체 Node 재실행, 실제 로컬 모델, 실제 브라우저 답변/추천 질문 생성: NOT VERIFIED.
  이전 전체 시험의 Privacy HTTP 실패 기록은 현재 상태 문서에 보존하며 이번 결과로 승계하지 않는다.
- A/B/Cloud/PACS 배포·등록, 모델 설치/활성화, commit/push: 수행하지 않음.

다음 작업 한 개: 선택한 근거의 RAG 사용 범위에 대한 이용조건과 콘텐츠 검토를 확정한다.
허용되지 않으면 재서술·모델 입력에 사용하지 않고 허용 범위가 확인된 자료로 교체한다.
그 이후 비Azure 로컬 생성 adapter와 실제 AFP 설명→출처→추천 질문→담기/수정을 검증한다.
현재 DRAFT / UNASSIGNED이며 자동 답변 활성화·전체 RAG/MVP 완료로 판정하지 않는다.

## 이전 이력: AFP 단일 출처·Azure adapter 초기 구현

## 구현 범위와 계약

기존 Node ESM, 인증, signed ingress, 감사 저장소와 세이지색 질문 카드 UI를 유지한다.
신규 `POST /api/v1/me/health-helper/questions`는 `{question:string}`만 받는다.
환자 인증 주체를 요구한다. 클라이언트 patientId, recordRef, 수치와 추가 필드는 거부한다.
개인 기록 해석은 **NOT CONNECTED**다. 화면의 합성 AFP fixture를 서버 소유권 증거로 사용하지 않는다.
이번 흐름은 AFP 일반 질문 → 키워드/동의어 근거 검색 → 모델 생성 → 출처/형식 검증 → 추천 질문 담기/수정이다.
서로 다른 자유 질문에 맞춘 개인화 대화는 아직 아니다. 모든 AFP 질문을 일반 AFP 설명 주제로 정규화한다.

공개 근거는 서울아산병원의 [알파태아단백 안내](https://www.amc.seoul.kr/asan/healthinfo/management/managementDetail.do?managementId=133)
중 정의·검사결과·주의사항·헬스팁을 짧게 재서술했다. 확인일 2026-10-11, 게시일 미제공.
코퍼스 버전 `afp-ko-20261011-draft`. 단일 출처의 교육용 시험이며 의료진 콘텐츠 검토는 미완료다.
모델은 출처 ID만 반환하고 URL은 서버가 고정 출처에서 해석한다. 외부 웹 검색·도구 호출은 없다.

## 안전 경계

- 자유 입력 원문, 이름, CT 픽셀, 사용자·환자 ID, 개인 기록, 인증 토큰은 모델 payload에 넣지 않는다.
- 입력에서 AFP 주제만 선택해 공개 근거와 정규화된 주제를 전달한다. 질문을 audit에 남기지 않는다.
- 진단·치료 요청의 일부를 정책 응답으로 거절한다. 키워드 분류는 완전한 의료 안전 분류기가 아니다.
- 근거 없음은 `INSUFFICIENT_EVIDENCE`, 정책 거절은 `REFUSED`; AI 생성 성공과 구분한다.
- 숫자/용량/임의 링크/HTML/알 수 없는 출처/추가 출력 필드는 거부한다.
- 형식·출처 검증은 **문장별 사실성, 임상적 안전성 보증이 아니다**. 실제 모델 평가·검토가 필요하다.
- 모델 미설정 503, 장애 503, timeout 504. 감사 시작 실패 시 모델을 호출하지 않는다.
- 4KB body, 질문 600자, 출력 64KB, 생성 15초, 클라이언트 18초. 사용자당 분당 5호출,
  프로세스당 동시 4호출. 제한은 프로세스 메모리이므로 HA/전체 비용 상한 보장이 아니다.
- 기존 동의·QR·키 발급·Viewer·PACS 데이터에는 쓰지 않는다. 정상 감사 append만 추가한다.
- 개인 기록 조회·DPoP 바인딩 API 확장은 이번 범위 밖이다. 관련 종단 강제 검증을 주장하지 않는다.

## Azure 설정 (아직 활성화/배포하지 않음)

서버 secret 관리 환경에서만 `HIPASS_HEALTH_HELPER_MODEL=azure`, `AZURE_OPENAI_ENDPOINT`,
`AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_KEY`를 공급한다. 브라우저/소스/Git에 키를 넣지 않는다.
HTTPS `*.openai.azure.com` 리소스 루트만 허용하며 redirect를 거부한다.
기본 설정은 모델 비활성이다. 설치된 Key Vault만으로 모델 사용 권한이 있다고 가정하지 않는다.
실제 학생 구독의 모델 제공 여부·쿼터·지역·비용·데이터 처리 조건 확인 후 활성화해야 한다.
현재 Azure 리소스 생성·실제 모델 호출·A/B/Cloud 배포는 하지 않았다.

REST 계약: [Azure chat completions](https://learn.microsoft.com/en-us/rest/api/aifoundry/azureopenai/chat),
[Structured outputs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/structured-outputs).
실제 배포 모델의 strict JSON schema 및 max_completion_tokens 지원은 NOT VERIFIED.

## 요구사항 영향

신규 건강도우미 기능의 승인 FR/NFR ID는 기존 기준 문서에서 확인되지 않아 임의로 만들지 않는다.
FR-037~041 감사 그룹 및 인증·최소수집·서버 권한·fail-closed 원칙을 공통 제약으로 적용한다.
해당 그룹의 전체 충족을 이 테스트 결과로 선언하지 않는다.
기존 API 변경 없음; 신규 API와 환자 건강도우미 화면만 연결한다. DB schema/migration 변경 없음.

## 검증과 다음 작업

집중 검증 명령: `node --test test/health-helper-rag.test.js test/health-helper-http.test.js test/patient-helper.test.js`.
결과 24/24 PASS, exit 0, 0.330초. 기존 경계 회귀 명령:
`node --test test/capstone-control-ingress.test.js test/mobile-capstone-auth.test.js test/patient-self-view-authorization.test.js`
결과 28/28 PASS, exit 0, 1.102초. 변경 JS 구문 검사 exit 0.
Azure REST는 fetch 테스트 대역으로만 검증한다. HTTP 테스트는 실제 로컬 HTTP와 인증/ingress 대역을 사용한다.
실제 JWT 로그인→RAG, 실제 signed ingress/DPoP, 화면 클릭→추천 저장/수정, B 배포는 NOT VERIFIED.
전역 회귀와 CT/QR 종단 성공을 승계하지 않는다.
다음 작업 한 개: 사용 가능한 Azure 모델 배포·비용·처리 조건을 읽기 전용 확인하고, AFP 답변의
실제 생성·근거 충실성·브라우저 추천 카드 저장/수정을 같은 흐름에서 검증한다.

## 최신 관측 — 2026-10-13 02:18 KST

상태: **진행 중 · DRAFT / UNASSIGNED · 실제 환자 서비스 미활성**. HEAD는
`c1040c8439a0bdb78c68a7a83a73d84bc2704f31`이며 작업 트리는 dirty다. 이번 RAG 파일은
미커밋 상태이며 commit/push·B/Cloud 배포는 하지 않았다.

- 사용자가 중지한 전체 MedlinePlus 번역 worker는 현재 프로세스 조회에서 찾지 못했다. 번역을 재개하거나 종료하지 않았다. 기존 loopback preview 11438–11443은 관측 당시 이미 실행 중이어서 손대지 않았다. 이번 검증을 위해 시작한 11444 서버와 Playwright 브라우저는 종료했고 11444 listener가 사라진 것을 확인했다.
- 최근 `retrieveHealthEducationEvidence` 비교 모호성 수정과 후보 preview 안내 문구 변경 후 RAG 집중 회귀 **85/85 PASS**, `node --check scripts/medlineplus-local-preview.js`, 대상 파일 `git diff --check` PASS. 이 테스트는 의학 콘텐츠 승인이나 운영 연결을 뜻하지 않는다.
- loopback 통합 후보의 실제 브라우저에서 CT 고정 근거 응답, MedlinePlus 원문 새 탭, 근거 서랍의 위치·이용조건·초안 표시, 추천 질문 담기와 수정, 진단 요청 거부, 근거 부족 응답을 확인했다. 그림 증적은 `output/playwright/health-rag-ct-browser.png` 및 `output/playwright/health-rag-qwen-rejected.png`다. 로그인·환자 인증·서버 감사 연결 없는 localhost 후보 검증이며 실기기 PWA/B 웹 검증은 아니다.
- Qwen3.5:4b가 `복부 CT는 무엇인가요?`에 대해 종료 상태 `done=true`로 문장을 생성했지만, 단일 출처 초안을 그대로 보존하라는 `validateEducationOutput`의 extractive 검사와 불일치하여 `EDUCATION_OUTPUT_REJECTED`로 거부됐다. 실제 설명 생성 PASS가 아니다. 출력 필터를 약화하지 않았고 사용자 화면에 해당 생성문을 답변으로 제공하지 않았다. 원문 고정 CT 상세 질문은 `SOURCE_GUIDANCE`, `generationUsed=false`로 표시됐다.
- `CT와 초음파 중 어떤 검사가 더 정확한가요?`는 근거 부족으로 안전하게 보류한다. 로컬 검토 화면 안내를 “현재 건강검진·AFP·간기능·초음파·CT의 개념과 상세 질문 후보만 지원”으로 구체화했다.

따라서 승인된 의료 근거·Qwen 설명·개인 로그인·기존 환자 인증/감사 연결·모바일 실기기·배포/복구 검증은 여전히 NOT VERIFIED다. MedlinePlus/그 외 후보의 독립 의료전문가 검토와 항목별 재사용 승인도 `UNASSIGNED` 또는 미확정이므로 기존 승인을 승계하지 않는다.

다음 작업 한 개: 정확한 최신 source/text hash에 대한 독립 의료전문가 검토 및 출처별 재사용 허용 상태를 확정한다. 그 전까지 draft module은 실제 patient API의 RAG 근거로 활성화하지 않는다.

## 최신 관측 — 2026-10-13 02:29 KST

추가 B 환자 브라우저 확인(같은 배포 URL, 합성 시연 로그인, 질문에는 환자 수치·식별정보 미포함):

- `AFP 검사 설명을 어디서 볼 수 있나요?` 제출 후 화면은 “설명을 받지 못했어요”를 표시했다. 실제 RAG 답변/출처 카드 PASS가 아니다.
- 자산 요청에서는 `/app.js`와 `/ui/patient-helper.js`가 각각 HTTP 200으로 로드됐다. 제출 시점 네트워크 관측에는 `/api/v1/me/health-helper/questions` 요청이 나타나지 않았다. UI 실패 원인은 아직 확정할 수 없다.
- 같은 세션에서 `/api/health`는 200, 기존 PHR summary/imaging 조회는 403, favicon은 503이었다. 이 403/503이 RAG 실패 원인이라고 단정하지 않는다.
- 질문 카드 편집/저장, 원문 열기, 의료전문가 검토, 배포 변경은 이번 live 확인에서 수행하지 않았다. 브라우저 세션은 종료했다.

다음 작업 한 개: 실제 B 배포의 submit handler → 인증 헤더 준비 → RAG API 요청 경계를 동일한 비개인 질문으로 추적하고, 미관측 요청이 어디서 끊기는지 확인한다. 이를 해결하기 전까지 B 환자 화면의 RAG는 NOT VERIFIED로 유지한다.

## 최신 관측 — 2026-10-13 03:38 KST

같은 B 배포 주소에서 새 합성 환자 로그인 세션으로 건강도우미 브라우저 흐름을 다시 확인했다. 이는 B의 현재 사용자 흐름 관측이며 전체 RAG 설명 성공을 뜻하지 않는다.

- `AFP는 어떤 검사인가요?` 제출은 실제 화면에서 완료됐다. 응답 유형은 `VISIT_PREPARATION`: 로컬 Qwen이 진료 질문 2개를 생성했다. 의료 설명 생성은 아니며 화면 상태도 “로컬 Qwen 질문 추천 · 공식 원문은 AI 입력으로 사용하지 않습니다 · 개인 기록 해석 아님”으로 표시됐다. 연결된 링크는 질병관리청 `간경변증` 문서이며 AFP 전용 설명 자료가 아니다. 이 한계는 출처 서랍을 열어야 보이는 상태였다.
- `AFP로 암인지 진단해줘`에는 진단 거부 문장이 표시됐다. 다만 화면 하단 상태는 거부 이유 대신 일반 “현재 답변 가능한 범위를 확인해 주세요”로 표시됐다.
- 선택된 기록이 AFP인 채 `CT와 초음파 중 어떤 검사가 더 정확한가요?`를 입력했을 때, AFP 질문 준비 답변 및 간경변증 출처가 이어서 표시됐다. 화면으로 관찰한 현상이며 실제 요청 payload는 수집하지 않았다. 입력된 고유 검사명을 무시하고 선택 기록 주제를 덧붙이는 클라이언트 문맥 연결이 원인일 가능성을 코드에서 확인했다.
- 로컬 코드는 명시적으로 CT·초음파 등 다른 검사명이 있는 질문에 선택된 AFP/간기능 주제를 자동 덧붙이지 않도록 변경했다. 서버 후보는 해당 주제 조합을 `INSUFFICIENT_EVIDENCE`로 유지한다. Qwen 질문 준비 응답에는 “간경변증 진료 맥락이며 AFP 전용 설명은 아님”을 명시하고, 출처 맥락 주의문을 접힌 서랍 밖에도 보이게 했다.
- 환자 웹 오류 안내를 인증 만료·시간 초과·안전검증 거부·요청 제한·모델 연결 장애별로 구분했다. 원시 서버 오류는 화면에 노출하지 않으며 작성 중 질문과 담은 메모를 유지한다.

검증: `node --test test/health-helper-rag.test.js test/health-helper-visit.test.js test/health-helper-http.test.js test/patient-helper.test.js test/mobile-health-helper.test.js` **50/50 PASS**, exit 0, 0.515초. 두 수정 JS에 `node --check` PASS. 테스트는 합성 대역·로컬 코드 계약 검증이며 B 재배포 검증이 아니다.

변경 파일: `src/health-helper-rag.js`, `public/ui/patient-helper.js`, `test/health-helper-visit.test.js`, `test/patient-helper.test.js`. 실제 B·Cloud 배포와 commit/push는 하지 않았다. RAG 소스 인벤토리는 여전히 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`; MedlinePlus 번역 후보 910건, HOLD 107건도 DRAFT / UNASSIGNED이며 의료전문가 검토·재사용 승인 상태를 승격하지 않는다.

남은 상태: AFP 의료 설명 생성·정확한 근거 카드·독립 의료 검토·항목별 이용허락·서버 감사 및 기존 인증을 통한 설명형 RAG의 실제 B/PWA 검증은 **NOT VERIFIED**다. 이번 브라우저 관측은 진료 질문 추천과 거부 경로만 확인했다.

반영 경로를 읽기 전용 확인했다. `Dockerfile.health-helper`와 `scripts/health-helper-align.py`가 전용 이미지·B/CLOUD 역할별 자산 해시 대조·기준선과 security scan 확인·readiness·rollback 절차를 제공한다. 스크립트는 고정된 candidate image tag와 기준선 artifact를 요구하며 `--apply`가 실제 컨테이너를 교체한다. 이번에는 해당 스크립트 실행·candidate image 변경·VM 인증·배포를 하지 않았다.

다음 작업 한 개: 변경 자산의 현재 해시·기존 baseline·고정 candidate image tag를 대조해 이번 수정만 들어간 candidate로 격리 가능한지 확인하고, 가능하면 `--apply` 없는 B preflight만 수행한다. 의료 설명은 승인·검토 게이트를 그대로 둔다. 검토되지 않은 설명 생성으로 배포하지 않는다.

## 최신 관측 — 2026-10-13 10:37 KST

후보자료의 “다른 검사와 함께 보는 이유” 질문 26개를 현재 고정 후보 요약과 대조하고, 직접적인 관계 문구가 있는 것만 extractive candidate로 연결했다. 모델 가중치를 학습하거나 새 의료 설명을 추가하지 않았다.

- 기존 AFP 후보 1개에 더해 15개 질문에서 기존 단일 chunk를 찾도록 후보 검색기 allowlist를 좁게 확장했다. AST/ALT/GGT, 혈색소, eGFR, 요단백, 지질 항목, HCV 항체의 조건부 추가 확인, 폐기능검사, 시력·청력 후속검사, 구강검진의 조건부 X선 관련 후보가 포함된다. 검색은 chunk를 그대로 인용하며 생성문에 임상 추론을 덧붙이면 거부한다.
- 나머지 10개(키·체중·허리둘레/BMI, 혈압, 공복혈당, 크레아티닌, 흉부 X선, 간 초음파, 복부 CT)는 해당 “다른 검사” 질문에 직접 답하는 후보가 없어 계속 `INSUFFICIENT_EVIDENCE`다.
- 312문항 평가셋은 일반 질문 후보 131/208에서 146/208(70.19%)으로 변했다. 임상요청 거부 26/26, 개인 결과 미지원 26/26, 참고범위/기준 후보 오출 0/26, 인젝션 payload 누출 0건, 분류 불일치 0건. 평가 결과는 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`; 이것은 retrieval-contract PASS이지 임상 품질 PASS가 아니다.
- 상세 검색 회귀 22/22 PASS, HTTP/RAG·환자 도우미·소스 인벤토리를 포함한 확장 회귀 72/72 PASS. `scripts/health-helper-source-inventory.js`는 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`을 계속 반환했다.
- 검토 준비 문서 [교차검사 관계 후보 검토 패킷](./health-helper-related-test-review-packet-2026-10-13.md)을 만들었다. 16개 후보의 chunk ID, 원문 URL/섹션, 본문 SHA-256, 검토 항목을 고정했다. 출처 권리 확인자·적격 의료 검토자는 미지정이므로 모든 근거가 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceEligible=false`다.

수정은 로컬 교육 후보 검색기·회귀 테스트·계획/검토 문서에 한정했다. 환자 API, DB, 모델 설정/가중치, 후보 서비스 승격, 실제 자료, 배포는 변경하지 않았다. B 환자 웹에 새 결과가 반영됐다고 주장하지 않는다.

다음 작업: PM이 출처별 이용권리 검토자와 적격 임상 검토자를 지정하도록 요청한다. 배정 전에는 후보 상태나 사용자-facing 답변을 승격하지 않는다.

## 최신 관측 — 2026-10-13 10:45 KST

교차검사 관계 후보의 원문 섹션 추적성을 재검사했다. 후보자료를 계속 “학습”시키는 작업은 모델 가중치 변경이 아니라, 원문 스냅샷과 후보 chunk 연결을 바로잡고 검토 가능한 버전으로 고정하는 방식으로 진행했다.

- MedlinePlus 페이지 HTML 제목(H1–H6)과 섹션 메타데이터를 대조해 기존 AST·ALT·GGT 목적, eGFR 목적, 중성지방 한계 연결 5건을 수정했다. 추가로 전체 간기능·검진 후보 93개를 검사해 ALT 한계, 키 비교, 허리둘레 목적, FDA 영상기록 카드 비교의 제목 불일치 4건도 수정했다. 한국어 후보 본문은 변경하지 않았다.
- `src/health-helper-source-sections.js`를 추가하고 간기능/검진 스냅샷 검증기에 연결했다. 저장 섹션 경로가 고정된 원문 HTML 제목에 존재하는지 검사하고, notes/원문 해시 또는 제목과 불일치하면 검증이 실패한다.
- 이전 스냅샷은 보존하고 `data/health-helper-liver-evidence-20261013-v4/` 및 `data/health-helper-screening-evidence-20261013-v3/`에 새 후보 notes·manifest·source snapshot을 생성했다. 두 manifest 모두 `DRAFT / UNASSIGNED`, `clinicalUse=false`, `serviceDeployment=false`다.
- AFP 교차검사 질문은 `afp-detail-limits`에서 더 직접적인 사용 관계 근거인 `afp-detail-purpose`로 이동했다. 선택 근거 SHA-256은 `447853179b15ac9303c2e5e8ce1bb8b1b7289f167a478616fdc5bbd0b34a6907`이다.
- 집중 후보 회귀 22/22 PASS, 관련 3개 JavaScript `node --check` PASS, `git diff --check` 오류 없음(저장소 기존 CRLF 변환 알림만 있음). 312건 평가 결과는 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`: 일반 질문 후보 146/208(70.19%), 임상 요청 26/26 거부, 개인 결과 요청 26/26 미지원, 기준값 후보 오출 0, 인젝션 payload 누출 0, 안전 분류 불일치 0, `serviceEligible=false`다.
- `node scripts/health-helper-source-inventory.js`는 여전히 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, `eligibleCount=0`을 반환한다. 제목 일치는 claim-level/임상 검증이 아니며, 16개 항목의 권리·번역·임상 리뷰는 `UNASSIGNED`다.

이번 변경은 후보 코드·후보 스냅샷·검토 문서에 한정했다. 환자 API/DB, 모델 설정·가중치, 실제 환자자료, 서비스 적격 상태, 배포는 변경하지 않았다. 다음 기술 작업은 교차검사 후보의 한국어 주장별 원문 근거 위치를 기록해 사람 검토를 돕는 것이다. PM의 출처 권리 검토자 및 적격 임상 검토자 지정은 별도 선행조치로 남는다.

## 최신 관측 — 2026-10-13 10:49 KST

16개 교차검사 후보의 검토 위치를 재현할 수 있도록 [문장별 source locator JSON](./health-helper-cross-test-source-locators-2026-10-13-v2.json)을 생성했다.

- 총 16개 후보·30개 한국어 후보 문장 각각에 대해 candidate sentence SHA-256, 후보 본문 SHA-256, 원문 URL, 로컬 source snapshot 경로/페이지 해시, 섹션 제목 경로, 제목 구간 HTML fingerprint를 기록한다.
- locator 생성기는 후보 snapshot manifest 및 notes/hash 계약을 다시 검증하고, source section path가 실제 H1–H6 제목과 일치하지 않으면 실패한다. 출력 상태는 `DRAFT / UNASSIGNED`, 각 claim `supportStatus=UNASSESSED`다.
- 관련 집중·통합 회귀 74/74 PASS, `node --check` PASS, `git diff --check` 오류 없음. 312개 고정 평가셋은 `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`, 후보 146/208(70.19%), 개인 결과 미지원 26/26, 임상 질문 거부 26/26, 기준값 후보 오출 0, prompt injection payload 누출 0, 모델호출/배포 없음이다.
- source inventory는 `NO_ELIGIBLE_MEDICAL_EVIDENCE`, eligibleCount 0이다. locator는 출처 위치와 버전 추적을 돕지만, 한국어 문장이 원문에 의해 의미상 뒷받침되는지 판정하지 않는다.

다음 선행조치는 PM이 출처별 재사용 검토자와 적격 임상 검토자를 지정하여 locator에 고정된 30개 문장을 검토하도록 하는 것이다. 검토 전에는 후보를 서비스 RAG에 연결하거나 환자-facing 의료 설명으로 승격하지 않는다.

## 최신 관측 — 2026-10-13 10:55 KST

이번에는 출처 재사용 범위와 환자 서비스 통합 경계를 확인했다.

- MedlinePlus 공식 [이용 정책](https://medlineplus.gov/about/using/usingcontent/)을 확인했다. NLM은 영어·스페인어의 `Medical test information`을 공공영역 콘텐츠로 열거하고, 해당 공공영역 정보의 재사용 및 출처 표시를 안내한다. 현 locator의 16개 후보는 14개 고유 `/lab-tests/` URL에 한정되고, 출처 표기는 정책이 제안하는 `Source: MedlinePlus, National Library of Medicine.` 형식과 일치한다.
- [MedlinePlus 이용범위 메모](./health-helper-medlineplus-rights-scope-2026-10-13.md)를 작성했다. 이는 정확한 콘텐츠 클래스에 관한 정책 근거일 뿐 법률·제품 승인으로 승격하지 않는다. 사이트 내 A.D.A.M., 약품 정보, 이미지·삽화 등 별도 저작권 콘텐츠는 후보에 포함하지 않고, 전체 HTML 스냅샷도 환자 서비스에 노출하지 않는다.
- 실제 웹 경로에서 `src/server.js`는 `HealthHelperRag`를 `VISIT_PREPARATION`(로컬 Ollama 설정 시) 또는 `SOURCE_GUIDANCE`로 설정한다. `src/health-helper-education-retrieval.js`는 현재 환자 API/웹 경로에서 호출되지 않는다. 따라서 앞선 312문항/146 후보 검색 결과는 격리된 로컬 교육 후보 검색 평가이며 실제 환자용 의료 설명 RAG의 Recall/정확도라고 볼 수 없다.
- `test/health-helper-rag.test.js`에 교차검사 후보가 `CANDIDATE`로 검색되더라도 승인되지 않은 서비스 코퍼스에는 도달하지 않아 모델 호출이 발생하지 않는 회귀를 추가했다. 해당 회귀 포함 건강도우미 통합 실행은 **75/75 PASS**다.
- 재실행한 312문항 평가와 소스 인벤토리는 이전 상태를 유지했다. `PASS_SAFETY_WITH_SCOPE_ABSTENTIONS`, 146/208(70.19%), 기준값 후보 오출 0, 임상 질문 거부 26/26, 개인 결과 미지원 26/26, injection payload 누출 0이며, 승인 가능한 정적 의료 근거는 여전히 0이다.

**후속 범위 결정 (2026-10-13):** 위의 검토자 배정·30개 문장/출처 버전 검토는 사용자 결정으로 학교 발표용 MVP의 활성 작업에서 제외했다. 현재 작업은 별도 검토자 없이 한국어 번역문만 검색 지식베이스로 쓰는 격리 데모다. 구현·실행 상태는 [학교 발표용 RAG 실행 안내](./health-helper-school-demo-rag-2026-10-13.md)를 기준으로 한다. 이 결정은 환자 API 연결·서비스 배포를 승인하지 않는다.
