# 사용자 제공 MedlinePlus 한국어 자료 연결

## 2026-10-12 보류 자료 등록 추가 — 현행 v3

사용자 추가 지시에 따라 HOLD 107개도 원문 식별자·출처·보류 상태·미해결 사항·번역 세그먼트를 등록했다. 총 등록 1,017개, AI 답변 검색 가능 910개/17,036청크, 답변 근거 사용 불가 HOLD 107개. data/medlineplus-upload-ko-20261012-v3/에 새 후보 생성, 이전 v1/v2와 원본은 보존한다. 보류를 PASS로 승격하지 않는다.

로컬 검토 화면 상단에 ‘등록된 보류 자료’ 목록과 원문 링크를 추가했다. /candidate/held-sources는 107개 HOLD 메타데이터만 반환하며 보류 번역 본문은 모델이나 브라우저에 전송하지 않는다. 해당 주제 질문은 SOURCE_ON_HOLD 검색 결과를 SOURCE_GUIDANCE 안내·출처 링크로 표시, generationUsed=false 및 추천 질문 없음. 의료전문가 검수 전 일반 설명 생성에 포함하지 않는다.

관련 테스트 17/17 PASS(exit0,604.1044ms), 원문 해시·HOLD 본문 보존·107개 등록·보류 검색 근거 없음·기존 helper 회귀 확인. 실제 로컬 HTTP 목록107/HOLD, A1C 질문200/SOURCE_GUIDANCE/generationUsed=false/원문링크 PASS. 수정 src/medlineplus-upload-corpus.js, scripts/import-medlineplus-upload.js, scripts/medlineplus-local-preview.js, test/medlineplus-upload.test.js. 실제 B/Cloud/PWA 배포 및 새 목록의 브라우저 조작은 NOT VERIFIED. 서버 환자 인증·동의·감사·DICOM 경계 변경 없음. 신규 증거 DRAFT / UNASSIGNED. 아래 v2 내용은 과거 이력이다.

2026-10-12 KST · DRAFT / UNASSIGNED · 개발 검토 후보 · 임상/운영 승인 아님.

## 결과와 범위

원본 1,017개: AI QA PASS 910개를 17,036개 청크로 연결, HOLD 107개 제외. 의료전문가 검수·독립적인 전체 최신성 검증은 미실시다. 파일의 과거 AI PASS를 의료 콘텐츠 승인으로 승계하지 않았다. 새 후보는 data/medlineplus-upload-ko-20261012-v2/이며 최초 v1 후보도 보존한다. 기존 번역 작업은 재개하지 않았다. 외부 링크 본문·이미지·실환자 기록을 수집하지 않았다.

Health Topics 요약은 NLM 정책상 미국 공공영역 콘텐츠이고 출처 표시가 요구된다. 의료백과·약물자료·외부 링크·이미지까지 허용하는 포괄 라이선스가 아니다. 확인: https://medlineplus.gov/about/using/usingcontent/ (2026-10-12). 기관 공식 한국어 번역이라고 표시하지 않는다. HTML/TXT는 열람용 동반자료이며 HTML을 실행하거나 검색 본문으로 넣지 않는다.

## 구조 / 변경

- src/medlineplus-upload-corpus.js: 입력 식별자·출처URL·권리범위·원문hash 검증, 보류 제외, 세그먼트 분할 및 검색. 문서 제목의 CT 등 약어도 연결한다.
- scripts/import-medlineplus-upload.js: 새 폴더에만 배타적 생성, manifest와 입력/코퍼스 SHA-256 기록. 원본 파일 수정 없음.
- scripts/medlineplus-local-preview.js: 기존 createPatientHelper 공유 renderer의 웹/모바일 검토 화면과 Qwen 설명·출처·질문 추천 경로에 새 코퍼스 선택 연결. 기존 preview 기본 경로 유지. 127.0.0.1:11439 격리, Host/Origin 검사, 요청 크기·속도·모델 timeout/출력 제한 유지.
- test/medlineplus-upload.test.js: 수집·해시·보류·오염·개인정보·출력 입력 보호 및 실제 자료 검증.

개인 질문 원문과 수치는 모델에 보내지 않는다. 주제/의도와 검색된 공용 근거만 사용한다. 모델이 URL을 생성하지 못하고 서버 근거 ID에서 출처를 구성한다. 자료는 모델 명령이 아니다. 임베딩·벡터DB·모델 파인튜닝은 수행하지 않았으며 기존 경량 키워드 기반 RAG를 유지한다. 의학적으로 정답인 답변을 보장하지 않는다.

관련 요구사항: 건강도우미는 부가 기능이다. FR-014~025 인증/정책, FR-037~041 감사 경로, FR-042~046 개인정보 분리의 기존 경계는 변경하지 않았다. 현행 authenticated 서비스 API·DB·PACS·배포본 변경 없음. 격리 로컬 preview에는 환자 로그인을 붙이지 않았으며 실제 환자 API 종단 증적으로 주장하지 않는다.

## 원본 식별

Downloads/medlineplus_ko_1017.jsonl: sha256:7a396f2143b3f2894964e51ffca0f92089688abcbd24f0bae6787b56824712b7

Downloads/medlineplus_ko_1017_readable.html: sha256:ad03b358ac05276afe4140df2c8cb3042562092f100ef16819b7c3227278073a

Downloads/medlineplus_ko_1017_readable.txt: sha256:f271b78b2125fe0b61ae160bf35403eb48b705bc63830ff24c89071043cb6b2e

v2 corpus: sha256:ca6345cc8ec31ea57babbd371de5724281ce6405575ca803696f923aa7ee999e

HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + 기존 다수 미커밋 변경 보존. 커밋·푸시 없음.

## 검증

node --test test/medlineplus-upload.test.js test/health-helper-medlineplus.test.js test/medlineplus-draft-corpus.test.js test/patient-helper.test.js test/health-helper-visit.test.js → 24/24 PASS, exit0,1297.9803ms.

실제 Ollama qwen3.5:4b 빈혈 질문 → GENERATED, 한국어 설명·근거 ID·MedlinePlus 출처·추천 질문 PASS. 웹 브라우저에서 답변→출처 카드→원문 새 탭(https://medlineplus.gov/anemia.html)→담기→수정 PASS. 스크린샷 output/playwright/medlineplus-upload-web-20261012.png. 이는 로컬 후보이며 실제 환자 로그인/배포 검증이 아니다.

모바일 390×844에서도 실제 Qwen 답변→출처 카드→담기→수정 PASS, 가로 overflow 없음. output/playwright/medlineplus-upload-mobile-20261012.png. 모바일 레이아웃 검증이지 실제 휴대전화 접속·환자 인증·배포 검증은 아니다.

로컬 HTTP 음성조건: A1C 보류/AFP 근거 부족→INSUFFICIENT_EVIDENCE, 개인 이름+수치→PERSONAL_INPUT_NOT_SUPPORTED, 확진 요청→REFUSED, 외부 Origin→403 PASS. 전체 910개 모델 출력 품질·의료전문가 검수·실제 B/Cloud/PWA 배포는 NOT VERIFIED.

중간 실패는 기록: 초기 importer가 구형 10개 문서의 English metadata를 거부했고 기존 확인된 권리 스키마로만 제한 수용 후 통과. 최초 CT 약어 검색 실패→제목에서 약어 추출한 v2 후보로 보완. 모바일 selector ref 불일치로 fill 실패→fresh snapshot의 실제 textbox로 재실행. 이를 정책 DENY로 표현하지 않는다.

## 재현 / 복구

새 후보 생성: node scripts/import-medlineplus-upload.js C:/Users/user/Downloads/medlineplus_ko_1017.jsonl NEW_OUTPUT_DIRECTORY (기존 경로는 거부).

PowerShell 로컬 실행:

```powershell
$env:HIPASS_MEDLINEPLUS_UPLOADED='1'
$env:HIPASS_MEDLINEPLUS_PREVIEW_PORT='11439'
node scripts/medlineplus-local-preview.js
```

웹 http://127.0.0.1:11439/ · 모바일 레이아웃 http://127.0.0.1:11439/?surface=mobile . 같은 PC에서만 접근 가능하고 모바일 기기용 서버 배포 주소가 아니다. 실행 종료는 해당 명령 Ctrl+C; 원격 rollback 불필요(미배포).

다음 작업 한 개: 새 910개 후보의 콘텐츠 사용·시험 범위를 검토 확정한 뒤 기존 인증·감사·private relay를 유지한 실제 환자 API adapter를 구현·검증한다. 기존 방문질문 전용 relay에 의학 본문을 무단 전송하지 않는다. 의료전문가 검수/대규모 안전성 평가 없이 실환자 서비스로 전환하지 않는다.
