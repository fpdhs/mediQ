# Medi Q 발표 환경 통합 상태와 실행 순서

## 2026-10-13 의료진 화면 단일 소스 관리 — 코드 반영 / B 교체 미실행

사용자 지시에 따라 의료진 로컬/웹 화면의 수정 원본을 `public/index.html#hospital-saas-app`과 의존 파일로 통일했다. [관리·실행 절차](../operations/clinician-ui-management.md). 전체 root, 원본 CSS 순서와 공용 JS/import/이미지/폰트를 같은 묶음으로 생성하며 sourceRevision으로 관리한다. 기존 홈/보안 여정의 별도 부분 배포 entry point는 종료하고 통합 stage/build/check/release 경로를 사용한다. 기존 helper·증적은 보존한다. API/DB/인증·권한/암호화 정책 및 요구사항 baseline 변경 없음. 관련 FR-010~013 / FR-032~036, 공용 모듈의 환자 동의·공유 회귀 포함.

Python 관리/음성 회귀 12/12 PASS, 의료진·환자·공유/보관 선택 Node 회귀 34/34 PASS. snapshot 기반 통합 묶음은 정적 파일76개, sourceRevision `03358bc46638a395217c7d6e0afbf1c2d7d40b94e41d37fd99124a22b2061534`. 로컬 `http://127.0.0.1:3000`의 실제 GET root·스타일 순서·의존 파일 비교 PASS. strict CA의 B `https://192.168.111.149:9443/hipass` GET 비교는 `FAIL / SERVED_WORKSPACE_DIFFERS`: B 웹은 아직 구형 배포본이다. 이 실패를 권한 거부 결과로 취급하지 않는다.

B VM 인증 정보와 실제 후보의 의료진 로그인·메뉴 API 정상/거부·환자 로그인/공유 회귀가 준비되지 않아 B 교체 및 새 이미지 복구·인증 E2E는 NOT VERIFIED. 관리 경로의 단일화와 실제 원격 화면 교체는 별도 결과다. commit/push/merge 없음. 아래의 별도 화면 배포 절은 과거 이력이며 신규 변경에 재사용하지 않는다.

## 2026-10-13 10:42 KST B 전용 8GiB 암호화 저장소 — 생성·수동 복구 scoped PASS

**DRAFT / UNASSIGNED; PACS/700장 종단 흐름 미완료.** [저장 키 보호·복구·검증·Runbook](b-pacs-encrypted-storage-2026-10-13.md). HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty, 기존 변경·A/B/Control 서비스·고정 CT 보존. B에 새 8,589,934,592-byte backing file과 highpass-b-pacs LUKS2/AES-XTS/Argon2id mapper, ext4 nodev/nosuid/noexec mount를 생성했다. 기존 /dev/sda·partition 포맷 없음. 실제 가용 약7.35GiB. mount에는 비의료 복구 probe와 lost+found만 있고 DICOM 적재 없음.

전용 version-pinned Key Vault storage KEK로32-byte LUKS 비밀을 RSA-OAEP-256 보호; root-only wrapped manifest/header/encrypted KEK backup을 보존한다. 원시 키 파일/env/argv 저장·자동 부팅 unlock·기존 A/B identity의 권한 확대 없음. 잘못된 키 거부·Vault 재열기·실제 mount 확인 PASS. 초기 provisioning은 cleanup 조회 옵션 오류로exit1/104,389ms; 원문 보존 후 정확한 두 임시 assignment 부재를 ARM으로 재확인 PASS했다. 별도 수동 lock→새 운영자 인증/read-unwrap-only recover→임시 권한 제거 전체exit0/57,147ms PASS. 실제 B Docker에서 암호화 boundary 검사 PASS, 기존 Portal image sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3 healthy. focused12+6 PASS; 전체 회귀/신규 PACS image 배포 아님.

현재 Vault soft-delete7일, purge protection 미설정이며 공유 Vault 설정은 바꾸지 않았다. 재부팅 복구·별도 Vault backup restore·rotation·실제 Key Vault 감사 event·B PACS·700장·브라우저는 NOT VERIFIED. 다음 작업 한 개: **공유 Vault purge-protection 적용 여부와 복구 검토를 확정하고 B 수신 PACS 배포 gate 준비**. 과거 검토 PASS와 전체 MVP/v3 완료를 승계하지 않는다. commit/push 없음. 상세 증적은 연결 문서 참조. 아래 상태는 이력이다.

## 2026-10-13 10:12 KST B 실제 수신 PACS 경로 — 구현 후보 / 미배포

**지정한 사용자 흐름 미완료. DRAFT / UNASSIGNED.** [구현·검증·Runbook](b-pacs-receiver-2026-10-13.md). HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty. A/B/Control 이미지 기준선은 이번 pinned SSH inventory에 기록했다. B에는 아직 Portal만 있고 수신 PACS 없음. /opt는 /dev/sda2 ext4이며 cryptsetup/전용 암호화 mount 없음; 하이퍼바이저 저장 암호화는 미검증.

선택 Instance POST 반입, 다운로드 권한·fresh DPoP·Key Vault release·현재 동의 재검증, 고정 inventory/raw hash, B-local mTLS 경계, overwrite 금지, 목적지 raw 재조회·감사 report 후보를 구현했다. Control 원본 저장/기존 archive simulator를 실제 PACS 성공으로 승격하지 않았다. 관련 focused 97/97 PASS(exit0,18,843ms), 로컬 원본 파일 해시700/700 PASS(68,473ms). 실제 로컬 Orthanc 임시 tmpfs에는1장 등록·SOP/hash 재조회·중복 보존 PASS(exit0,32,301ms); 인증/감사는 mock이고 실제 B 전송이 아니다. 증적 artifacts/workstation/b-pacs-candidate-2026-10-13T01-10-20-165Z/result.json 및 hp-b-pacs-local-smoke-e345cdef/result.json.

실제 B 배포·mTLS·암호화 저장·700장 다운로드 동의→반입→전체 UID/hash→감사·브라우저는 **NOT VERIFIED**. UI 버튼/전체700 job/영구 보관·복구도 미완료. VM 서비스·동의·DB·CT는 변경하지 않았고 commit/push 없음. 다음 작업 한 개: **B 전용 암호화 저장소와 저장 키 보호·복구 방식을 확정한 후 수신 서비스 배포 gate 준비**. 기존 root 디스크를 포맷하거나 일반 Docker volume을 암호화 저장소로 취급하지 않는다. 과거 검토 PASS는 새 후보에 승계하지 않는다.

## 2026-10-13 09:45 KST 홍길동 CT 다운로드 → B PACS 수신 확인 — 사전 차단

결과: **지정한 사용자 흐름 미완료 / PACS 수신 NOT VERIFIED**. 첫 차단 지점은 B 수신 PACS·반입 서비스의 배포 부재와 반입 API 라우팅이다. 동의를 먼저 생성해 권한 객체만 남기지 않았으며 기존 동의·CT·DB·PACS를 변경하지 않았다. 새 B PACS 설치·네트워크 공개·배포는 이번 확인 작업에서 실행하지 않았다. DRAFT / UNASSIGNED.

실행: `python scripts/hcc-b-import-readiness.py`, exit 0, pinned SSH read-only. 증적 artifacts/workstation/hcc-b-import-readiness-20261013T004523Z/result.json. B의 전체 Docker inventory에는 hp-capstone-b-portal-portal-1 하나만 존재, image sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3 healthy. 컨테이너 mount는 인증서·서비스 credential·key identity만 존재하고 영상 보관 volume 없음. 수신 Orthanc/PACS 컨테이너 0개. Docker 외부에 별도 PACS가 있는지는 NOT VERIFIED이며 프로젝트의 등록된 수신 경로는 확인되지 않았다. Cloud Control healthy, HIPASS_CONTROL_PLANE_ONLY=1, archive worker 설정 없음.

실제 B HTTPS 진입점에 strict CA·10초 timeout·Origin 지정으로 `POST /api/transfers/pacs-import` 빈 객체를 보내 라우팅만 검사했다. 응답 **403 / METADATA_ROUTE_REQUIRED**. 인증된 다운로드 동의의 권한 거부 시험이 아니라, 현재 ingress가 이 반입 경로를 제공하지 않는다는 결과다. 네트워크 timeout을 DENY로 기록하지 않았다. 이 요청의 거부 감사 여부는 NOT VERIFIED.

확인한 코드: src/pacs-import-engine.js는 LOCAL_ENCRYPTED_ARCHIVE_SIMULATOR, simulation=true, destinationVerification=false이며 실제 C-STORE/STOW-RS/목적지 PACS 등록이 아님을 명시한다. B Portal은 API를 metadata Control로 중계하며 현재 서버는 Control 원본 저장을 금지한다. 이 보안 경계를 해제하여 기존 로컬 import API를 Azure에서 실행하는 해결책은 사용하지 않는다.

| 항목 | 결과 | 한계 |
|---|---|---|
| B/Cloud 실행 기준선 확인 | PASS | 실제 pinned SSH inventory |
| 반입 라우팅 차단 응답 확인 | PASS | 실제 HTTP 403 METADATA_ROUTE_REQUIRED |
| 이번 다운로드 허용 동의 생성 | NOT VERIFIED | 실행하지 않음; 기존 권한 변경 없음 |
| 고정 CT 700장 A 재조회·원본 해시 | NOT VERIFIED | 수신 경로 차단 이전에 재실행하지 않음 |
| CT B 영구 이동·PACS 등록·해시 대조 | NOT VERIFIED | 수신 PACS/반입 경로 미배포 |

관련 기능군 FR-001~005/010~031/037~041, 다운로드·목적지 검증 범위. 전체 MVP/v3 완료와 무관하다. 다음 작업 한 개: **B Data Plane의 실제 수신 PACS·인가된 반입 경로를 설계하고 구현**한다. 이때 기존 DOWNLOAD_ALLOWED·기관/Study/Series·유효기간 검증, 전송 암호화·키 경계, 700개 SOP UID/해시 목적지 대조, 중복/부분 실패 처리·감사를 연결해야 한다. 화면의 ‘완료’ 또는 파일 개수만으로 목적지 PACS 수신 PASS를 선언하지 않는다.

## 2026-10-13 KST 의료진 전체 화면 단일 후보 정렬 — 미배포

현재 작업 단위는 **COMPLETE_CLINICIAN_UI_CANDIDATE / DRAFT · UNASSIGNED**. B 실행 이미지는 앞 절의 보안 여정 배포본으로 유지한다. 이번 지시는 배포 후보 정렬이며 실행 서비스에 적용하지 않았다. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty, 기존 미커밋 변경 보존, commit/push 없음.

주요 메뉴: 진료 준비 / 환자 기록 / 환자 영상 / 공유 접수 / 병원 보관함. 시연도구: 전송 확인 / 영상 보안 여정 / 보안 타임라인 / 운영 관제. 각 메뉴의 화면 전체, 공용 app.js와 import 의존 모듈, 의료진 스타일·이미지·폰트를 한 이미지 후보에 묶었다. 단순한 메뉴 이름 치환이나 홈만 배포하는 방식은 사용하지 않는다.

실제 B pinned SSH로 healthy 기준선과 배포 HTML을 읽어 artifacts/workstation/clinician-bundle-20261013T003107Z에 저장했다. baseline image sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3. 배포된 HTML의 hospital-saas-app만 현재 의료진 root로 교체하고 환자 root는 byte 일치를 확인했다. 별도 로그인 capstone-auth.js와 src 서버 트리, 모바일 PWA, DB/PACS는 변경하지 않는다. **공용 app.js가 변경되므로 환자 HTML 보존이 환자 기능 보존을 증명하지는 않는다.** 공용 컨트롤러가 import하는 환자 모듈도 의존 묶음에 포함되어 환자 로그인·영상·공유 회귀가 반드시 필요하다.

후보에는 정적 파일 46개가 포함되며 manifest.json에 각 SHA-256, 메뉴 구성, 보존 대상, source HEAD/dirty 및 배포 전 gate를 기록한다. Docker build exit 0(base ARG 명시 전달; default ARG 경고 1건), image sha256:050252e774706ed9e25a985769a64e70c579867ddc38f19287badc3a698af999. verification.json PASS: 후보 46파일 SHA 일치, src 서버·인증·모바일 142파일 기준선 일치, 원본 Docker layers 보존. 생성: scripts/clinician-bundle-stage.py, clinician-bundle-verify.py, clinician-bundle-browser-check.js, test/clinician_bundle_stage_test.py. 제품 API/DB 계약 수정 없음. 관련 기능군 FR-006~041 및 동의 보존 FR-001~005. 개별 FR/NFR 원문이 없는 번호를 새로 추정하지 않는다.

PASS: `python test/clinician_bundle_stage_test.py` 3/3, exit 0(0.053초); 의료진 메뉴/진료 준비/상세/홈/전송/반입/보관/감사/보안 여정 focused `node --test` 33/33, exit 0(0.633초); 후보 JavaScript 26개 `node --check` exit 0. 로컬 실제 브라우저 주요 메뉴 5개 화면의 단일 활성, 시연도구 4개 진입 버튼 존재, 1440/390/320px 홈 overflow 없음·pageErrors 0. 첫 브라우저 harness는 Viewer 집중모드에서 숨긴 상단 메뉴를 누르려 하여 timeout FAIL; 실제 돌아가기 버튼을 먼저 누르는 순서로 수정 후 재실행 PASS. 제품 권한을 우회하거나 DOM 강제 클릭으로 해결하지 않았다.

취약점 검사 PASS: artifacts/security/container-scan/clinician-unified-20261013.json, 후보 image ID 일치, HIGH 0 / CRITICAL 0, exit 0. 알려진 취약점 검사이며 모든 보안 문제 부재를 뜻하지 않는다.

NOT VERIFIED: 후보 이미지의 실제 B 로그인·모든 메뉴 API 정상/거부·환자 로그인/공유 회귀·배포/복구. 로컬 소스 화면의 정상 전환을 미배포 후보의 서버 연동 PASS로 승계하지 않는다. 후보 이미지는 highpass-clinician:unified-20261013-candidate이며 최종 build/hash/scan 결과는 이 폴더의 verification.json과 별도 container-scan 증적을 따른다.

재생성: `python scripts/clinician-bundle-stage.py`(비밀번호는 숨김 입력, remote read-only). build: `docker build --build-arg CAPSTONE_BASE_IMAGE=highpass-clinician:security-journey-20261013-v2 -t highpass-clinician:unified-20261013-candidate artifacts/workstation/clinician-bundle-20261013T003107Z/build-context`. 검증: `python scripts/clinician-bundle-verify.py --folder artifacts/workstation/clinician-bundle-20261013T003107Z --image highpass-clinician:unified-20261013-candidate`. stage/verify 스크립트에는 배포 옵션이 없다. 다음 작업 한 개: **이 후보의 실제 인증 환경에서 의료진 로그인 → 5개 메뉴 → 환자 로그인·공유 회귀를 검증**한다. 리뷰·취약점·API 호환·복구 gate 확인 없이 후보를 자동 적용하지 않는다.

## 2026-10-13 09:21 KST 영상 보안 여정 — 입체 일러스트 분리 및 B 웹 배포

현재 판정은 **설명 UI 배포·브라우저 검증 PASS / 증적 DRAFT · UNASSIGNED**. 아래 이전 절의 B 미배포 기록은 이력이다. 전체 보안 종단/MVP/v3 완료로 승격하지 않는다. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty; 기존 변경·데이터·서비스를 보존했고 commit/push 없음.

8개 관문(본인 확인, 공유 결정, 병원 연결, 접근 심사, 임시 출입권, 보호된 전달, 열람·보관, 접근 종료)에 서로 다른 글자 없는 입체 일러스트를 생성했다. 제목·정책 설명·번호·버튼은 실제 HTML 요소다. 8관문 홈 → 선택 관문 상세 → 이전/다음 → 전체 관문으로 연결하며 이미지 실패 시에도 정책 설명을 유지한다. frontend-design은 기존 폰트·색을 유지하는 데, imagegen은 텍스트 없는 설명 일러스트 제작에 사용했다.

생성 자산은 public/assets/security-journey/*-v1.webp, 각 1536×1024, 총 939,752 bytes. manifest.json과 scripts/security-journey-assets.json에 생성 프롬프트·원본/배포 SHA-256·크기·검토 상태를 보존한다. 이미지 속 인물·영상·QR는 설명용이며 실제 신원·임상영상·사용 가능한 Ticket이 아니다. API/DB/인가/암호화 계약은 변경하지 않았다. FR-001~005, FR-010~031, FR-032~036, FR-037~041의 설명 UI이며 신규 NFR 번호를 임의 부여하지 않았다.

변경: public/index.html, public/ui/image-journey.js/css, public/ui/security-gates.js. 추가: 위 이미지·manifest, scripts/prepare-security-journey-assets.py, security-journey-assets.json, security-journey-browser-check.js, security-journey-live-browser.js, security-journey-live-runner.js, security-journey-release.py, security-journey-attest.py. B에는 기존 배포 HTML에 설명 UI만 삽입하고 정적 파일 12개만 overlay했다. 로컬 app.js 전체나 환자 UI·Control/Gateway 코드는 배포하지 않았다. 기존 B 메뉴 구조는 유지되어 B에서는 의료진 로그인 → **영상 보안 여정**, 로컬에서는 시연도구 → 영상 보안 여정으로 진입한다. 기존 실제 요청 도구는 접힌 영역에 보존했다.

| 검증 | 결과 | 근거 |
|---|---|---|
| 모듈 syntax 및 Python compile | PASS | node --check, python -m py_compile exit 0 |
| focused 단위 회귀 | PASS | node --test test/image-journey.test.js test/security-timeline.test.js test/clinical-theme-navigation.test.js, 11/11, exit 0, 약 0.225초 |
| 로컬 브라우저 | PASS | 8개 이미지 decode·각 관문 전환, 정상/거부/응답 실패 구분, 마지막 다음 비활성화, 1440/768/390/320px 가로 넘침 없음, 의도적 이미지 404에서 설명 보존 |
| B 후보 build/scan | PASS | 최종 docker build exit 0; security-journey-20261013-v2.json HIGH 0 / CRITICAL 0 |
| B 배포·복구·재적용 | PASS | result.json rollback PASS, protectedContainersUnchanged true, 기존 환경·mount·network 보존 |
| B 실제 정적 파일 | PASS | 엄격한 CA 검증, 12개 제공 파일 후보 해시 일치; HTML의 기존 data-capstone 삽입만 명시적으로 허용 |
| B 실제 의료진 로그인·표시 | PASS | 승인된 발표자 키 입력 → 실제 로그인 → 설명 홈 → 8개 관문 이미지; 1440/390/320px 가로 넘침 없음, pageErrors 0 |
| 동일 배포 8관문 실제 보안 종단 | NOT VERIFIED | 이번 작업은 설명 화면 검증이며 정책·키·영상·삭제 실측 증적 아님 |
| 환자 전용 PWA 연결 | NOT VERIFIED | 의료진 반응형 웹만 확인; 환자 PWA에 의료진 시연 메뉴를 추가하지 않음 |

최초 build는 FROM에 bare sha256를 사용하여 registry resolution FAIL, 동일 image ID의 기존 로컬 tag 확인 후 최종 build PASS. 최초 CLI 브라우저 검증은 VM sandbox의 dynamic import 제한으로 FAIL(로그인 전); Node runner로 승인 키를 메모리에서만 읽어 실제 Chrome UI 입력·로그인하여 재검증 PASS. 키를 파일·환경변수·명령행·증적에 저장하지 않았다. 기존 favicon.ico HTTP 503은 이번 자산과 별개로 관측되며 미해결; 페이지 JavaScript 오류와 구분한다. 보안 타임라인의 새 로컬 화면 전체를 B에 이식한 것은 아니며 기존 감사 조회 경로를 유지한다.

배포 기준선: sha256:9f74d1dcf2bf35337674cd2732b6904e816cb7925e1576adbcf684efb80fd6ea.
현재 B 후보: highpass-clinician:security-journey-20261013-v2 / sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3.
복구는 배포기가 result.json의 rollbackFiles(기존 Compose override 목록)로 이전 이미지를 실제 재시작·readiness 확인한 후 후보를 다시 적용했다. 이후 재배포는 새 기준선부터 stage해야 하며 오래된 baseline을 무조건 적용하지 않는다.

재현: https://192.168.111.149:9443/hipass/#DOCTOR → 의료진으로 시작하기 → 기존 승인된 시연 키 로그인 → 영상 보안 여정 → 각 관문 선택. 해시 재검증: `python scripts/security-journey-attest.py --folder artifacts/workstation/security-journey-20261013T001052Z`. 브라우저 재검증은 `node scripts/security-journey-live-runner.js <설치된 playwright/index.mjs 절대경로>`; 실제 키는 승인된 pinned SSH 경로로만 취득한다.

증적: artifacts/workstation/security-journey-20261013T001052Z/{result.json,served-assets.json,browser.json}, artifacts/security/container-scan/security-journey-20261013-v2.json. 화면: output/playwright/security-gates-b-home-1440.png, security-gates-b-home-390.png 및 로컬 detail-1440/detail-390. 독립 검토 전까지 DRAFT / UNASSIGNED. 다음 작업 한 개: 설명 이미지와 관문별 정책 문구의 사용자 검토.

## 2026-10-13 KST 영상 보안 여정 — 로컬 설명 UI

DRAFT / UNASSIGNED. 영상 여정을 영상 보안 여정으로 확장. 본인 확인/공유 결정/병원 연결/접근 심사/임시 출입권/보호된 전달/열람·보관/접근 종료 8개 관문, 직접 선택·이전/다음, 관문별 조건·차단 사례·위치·기술명·확인 한계. 환자는 동의 주체로 표시하고 파일 전달 경로와 구분. 전 구간 감사 설명과 보안 타임라인 이동 추가(동일 실행 자동 연결 아님). frontend-design의 기존 색·폰트 유지, 환자 동의 영역만 틸로 구분. 실제 이벤트/보안검증 API를 추가하지 않았으며 서버·권한 변경 없음. FR-001~005/014~031/037~041 설명에 해당.

추가 public/ui/security-gates.js. 수정 image-journey.js/css, index.html, app.js, clinician-demo-tools.js, test/image-journey.test.js. 브라우저 PASS: 8관문 표시, 6번 기술 설명, 마지막 다음 차단, 이전 이동, 390px overflow 없음. output/playwright/security-journey-desktop.png 및 security-journey-mobile.png. 설명 모의 흐름이며 실제 DPoP/Key Vault/보관 종단 증적 아님. 최신 원격 배포별 보안 검증 상태는 이 화면에서 확인하지 않음으로 표시. B VM 미배포, commit/push 없음.

## 2026-10-13 KST 보안 타임라인 — 로컬 웹 반영

DRAFT / UNASSIGNED. 감사·보안 이력을 보안 타임라인으로 변경. 기존 scoped GET /api/audit-logs(limit=64)에 연결한 시간순 목록, auditSessionId별 선택(없는 항목은 실행 연결 미확인), 결과/행위 필터, 선택 이벤트 해설·이전/다음·기술 근거를 구현했다. API 응답의 누락 단계를 채우지 않으며 전체 이력으로 주장하지 않는다. 모의 이벤트 없음. 무결성 검증은 미연결로 명시. 설명용 영상 여정과 실제 반환 기록을 분리한다.

추가: public/ui/security-timeline.js, test/security-timeline.test.js. 수정: public/app.js, public/index.html, public/ui/clinician-demo-tools.js/css. 기존 Node ESM/인증/DB/API 계약 유지. FR-037~041 감사 조회 UI, FR-010~020 권한 경계 관련. API의 canReadAuditLogs/applyAuditScope를 유지하며 관리자 권한을 확대하지 않는다. UI는 원시 토큰/키/임의 metadata를 출력하지 않고 허용한 필드만 textContent로 표시한다. 10초 timeout·최신 요청 순번·persona 변경시 기록 제거. 실패시 이전 내용 제거, 빈 정상 조회와 구분.

PASS: security-timeline/image-journey/hospital-vault 단위 10/10, exit 0, 0.250초; app/module syntax exit 0. 로컬 실제 API 64건 수신, 실행 선택지 26개 관측. 브라우저 390px 수평 넘침 없음. 모의 403 응답 주입시 오류 안내 및 이전 이벤트 0건 확인 후 route 제거/새로고침. 이는 관리자 권한 서버 E2E 시험을 대신하지 않는다. 캡처 output/playwright/security-timeline-desktop.png, security-timeline-mobile.png. 새로고침으로 최신 코드 로드 확인.

NOT VERIFIED: B VM 배포·해시 체인 검증·실행 전체 누락 검증·관리자 인증의 원격 E2E. 원격 배포 및 commit/push 하지 않음. 다음 작업은 기존 B 배포 기준선 정렬 후 동일 화면 검증. localhost:3000/#DOCTOR → 시연도구 → 보안 타임라인.

## 2026-10-13 KST 영상 여정 — 설명용 인터랙티브 로컬 웹

DRAFT / UNASSIGNED. QR·접근 확인을 영상 여정으로 변경했다. 기존 Node ESM/정적 웹과 서버 정책을 유지하고, 제어 요청과 영상 이동을 분리한 SVG/CSS 설명 무대, 열람/보관 모드, 한 단계씩/초기화, 거부/응답 실패 예시, 보관 수명주기를 추가했다. frontend-design의 기존 팔레트·폰트 유지 원칙 적용. 실제 실행 이벤트나 저장/삭제 결과가 아닌 설명용 모의 시연을 상시 표시한다. 기존 요청 도구는 별도 details로 보존했다. 기존 pipeline의 목록/이미지 존재만으로 감사 완료를 추정하는 시각화는 숨겨 새 설명 단계와 혼합하지 않는다. 해당 legacy 내부 로직 자체를 전면 개편하지는 않았다.

추가 파일: public/ui/image-journey.js, public/ui/image-journey.css, test/image-journey.test.js. 수정: public/index.html, public/app.js, public/ui/clinician-demo-tools.js. 관련 요구사항 그룹 FR-010~025, FR-026~041의 설명 화면이며 권한·API·DB 변경 없음. 새 모듈은 요청/토큰/영상/감사 데이터를 저장하지 않고 사용자 입력은 textContent로 표시한다. 스크립트로 가짜 실측 PASS를 만들지 않는다.

PASS: `node --test test/image-journey.test.js test/hospital-vault.test.js test/import-preflight.test.js test/import-workbench.test.js` 12/12, exit 0, 0.229초. localhost 실제 브라우저에서 시연도구 진입, 열람 3단계→보관 1단계 초기화, 거부시 진행 차단, 응답 실패 문구 구분, 마지막 단계 진행 차단. 설명 조작 구간 POST/PUT/PATCH/DELETE 0건. 390px horizontal overflow 없음, reduced-motion transition 0s. 데스크톱/모바일 캡처 output/playwright/image-journey-desktop.png, image-journey-mobile.png. 이는 합성 시연 UI 확인이며 실제 권한거부 E2E나 Key Vault/삭제 검증을 대신하지 않는다.

NOT VERIFIED: 실제 이벤트 수집·동일 실행 기록 재생, 최신 B VM 배포, 실제 A→B 열람/보관 종단. 기존 정적 배포 스크립트는 dashboard 전용이며 app.js/새 exchange 자산을 포함하지 않아 사용하지 않았다. 승인된 B 배포 기준선 정렬이 후속 작업이다. commit/push/원격 배포 없음. 로컬 확인 경로: http://127.0.0.1:3000/#DOCTOR → 시연도구 → 영상 여정.

## 2026-10-13 KST 병원 보관함 기본 메뉴 이동 — 로컬 반영

DRAFT / UNASSIGNED. 의료진 메뉴의 공유 접수 뒤에 병원 보관함을 배치하고 시연도구 항목과 해당 화면의 시연도구 복귀 배너를 제거했다. 기존 로컬 시연 고지·서버 권한 계약·보관 실행 경로는 유지. 변경 파일: public/index.html, public/app.js, public/ui/clinician-demo-tools.js. 관련 요구사항: FR-010~013 의료진 화면의 탐색 변경이며 권한/API 변경 없음.

검증 PASS: hospital-vault/import-preflight/import-workbench 9/9(exit 0, 0.283초). 실제 localhost 브라우저의 기본 메뉴 클릭, aria-current=page, 시연도구 내 중복 0건, 복귀 배너 숨김, 390px 수평 overflow 없음. 데스크톱 캡처 output/playwright/hospital-vault-main-menu.png. 최초 자동화 닫기 locator 이름 오류로 timeout 발생 후 실제 시연도구 닫기 이름으로 재검증 PASS. VM B 배포 NOT VERIFIED/미실시. 기존 미커밋 변경 보존, commit/push 없음.

## 2026-10-13 KST 병원 보관함 — 로컬 웹 반영 / VM B 미배포

DRAFT / UNASSIGNED. 기존 PACS 반입도구를 병원 보관함으로 이름 변경. 네이비 파일철, 선택 검사, 공유 종료 시각, 보관 조건, 접힌 기술 영수증, 전체/보관 중/삭제 처리/삭제 완료/확인 필요 필터를 구현했다. 서버 보관 목록을 사용하며 retention 없는 기존 기록은 기한 미확인·보관정책 확인 필요로 표시한다. 사용자 승인/보관 요청을 자동 실행하지 않는다. 기존 인증·동의·범위·감사 계약 변경 없음. 관련 요구사항 그룹: FR-006~009, FR-010~020, FR-037~041의 화면 표시; 새 서버 보안 검증 완료 주장이 아니다.

변경: public/index.html, public/app.js, public/ui/clinician-demo-tools.js, public/ui/clinician-demo-tools.css. 추가: public/ui/hospital-vault.js, test/hospital-vault.test.js. 기존 dirty 변경 보존. frontend-design의 파일철 중심 시각적 계층을 적용하고 Playwright로 로컬 실제 화면을 확인했다.

검증: `node --test test/hospital-vault.test.js test/import-preflight.test.js test/import-workbench.test.js test/archive-retention.test.js` 14/14 PASS, exit 0, 1.68초. app.js/hospital-vault.js syntax exit 0. localhost:3000/#DOCTOR → 시연도구 → 병원 보관함 실제 브라우저에서 메뉴 이동·필터·빈 목록·열람 전용 보관 버튼 차단 PASS. 1440px/390px 화면 확인, 모바일 수평 overflow 없음. API 503을 브라우저 route로 주입한 실패 안내 PASS(실제 서버 장애 시험 아님), 이후 mock 제거 및 실제 목록 복구. screenshots: output/playwright/hospital-vault-desktop.png, hospital-vault-mobile.png. 로컬 데이터는 기존 P-1001 Brain MRI/Chest CT 두 건이며 고정 홍길동 CT 종단 시험이 아니다.

NOT VERIFIED: B VM 배포·Key Vault 영구보관 통합·B 보관 영상 Viewer·원격 삭제 종단. 기존 원격 배포 기준선의 records 경로 불일치 차단을 우회하지 않았다. 다음 작업은 B 배포 기준선 차이를 확인하여 승인된 정적 자산 묶음을 정렬하는 것. commit/push/원격 배포/기존 영상 삭제 없음.

## 2026-10-13 KST 공유기간 연동 보관정책 — 로컬 코드·격리 시험 / VM B 미배포

DRAFT / UNASSIGNED. 사용자 승인: 고정 7일 대신 공유 validUntil, 철회/만료 후 신규 접근 차단 및 삭제, 삭제 실패 재시도, 기간 자동 연장 금지. 새 로컬 보관 manifest에 CONSENT_BOUND_V1/consentId/고정 validUntil/state를 저장한다. 복호화 함수는 현재 서버 동의와 고정기한을 함께 확인하고 legacy/plaintext fallback을 허용하지 않는다. 실제 의료진·토큰 검증을 대신하는 정책은 아니다. 기존 보관 자료는 RETENTION_UNBOUND로 접근 차단하며 자동 삭제/임의 소급 바인딩하지 않는다.

연결된 기능: revokeConsent 저장 후 cleanup, 명시적 보관 root가 설정된 서버의 시작 시/30초 간격 cleanup, manifest 먼저 DELETE_PENDING 저장, 삭제 시작 감사, 보호된 DEK 제거, 정확한 .dcm.enc만 삭제, 완료 감사 및 DELETED tombstone. 실패는 DELETE_FAILED로 차단 유지·다음 sweep 재시도. 감사 불가시 삭제를 시작하지 않는다. 디렉터리 재귀삭제/manifest storedPath 신뢰 없음. 심볼릭 링크·junction 거부. 이는 파일/키 봉투의 논리적 삭제이며 디스크 포렌식 수준 완전 소거·백업 삭제 증거가 아니다.

실행 설정: HIPASS_ARCHIVE_RETENTION_ROOT는 운영자가 검증한 B 전용 절대 저장 경로로 지정해야 한다. 환경변수 미설정 시 주기 worker는 활성화되지 않는다. HIPASS_CONTROL_PLANE_ONLY=1과 동시 설정은 시작 실패한다. 현재 원격 B portal에는 이 worker/service가 배포되지 않았다. 기존 A→B Key Vault 키의 30초·일회용 제한은 변경하지 않았으며, B 장기보관 Key Vault 권한/API/Viewer 통합은 미구현이다. 현재 로컬 crypto는 기존 KEK 경로임을 보존한다.

- 관련 FR-001~005, FR-014~025, FR-026~041 기능군. API 기존 요청 형태 유지; 보관 결과에 retention, 목록에 retention/access 추가. 신규 공개 키/평문 endpoint 없음. DB migration 없음.
- 신규 src/archive-retention.js, test/archive-retention.test.js. 수정 src/pacs-import-engine.js, src/services.js, src/server.js, public/app.js 및 관련 테스트. 보관 목록은 종료 시각/삭제 상태/접근 차단을 표시. 기존 버튼은 B 저장본 열람으로 오인하지 않도록 원본 Viewer 이동으로 명시.
- `node --test test/archive-retention.test.js test/pacs-encryption-live.test.js test/pacs-import-live.test.js test/current-gap-security.test.js test/import-preflight.test.js test/import-workbench.test.js`: 26/26 PASS, exit0, 약2.26초. 실제 임시 디렉터리 합성 DICOM 암호화·복호화·삭제 및 service 철회/감사 연결 확인. 최초 25개 실행에서 UI 문구 기대값 1 FAIL(미검증 번역) 후 수정 재실행. 기존 부정 권한 HTTP 회귀 포함. 파일 변조/키 오류 회귀 PASS.
- VM B 적재·재열람·실제 Key Vault 보관/삭제·브라우저 새 API 상태·배포/복구는 NOT VERIFIED. 기존 데이터·VM·DB 미변경. 테스트가 만든 임시 합성 파일만 테스트 후 정리됨(복구 대상 아님). commit/push 없음.
- 다음 작업: 승인된 보관정책을 B 서비스의 인증된 저장본 권한/Key Vault 경로에 연결하고 동일 고정 CT로 원격 저장→재열람→철회→삭제 종단 검증. 현재 코드를 VM B 구현 완료로 간주하지 않는다.

## 2026-10-13 KST PACS 반입도구 — 로컬 작업대 구현

DRAFT / UNASSIGNED. 기존 전송 API/권한/DB 계약을 유지하며 왼쪽 조건 확인, 오른쪽 실행·결과 영수증으로 재구성했다. frontend-design 방향을 적용해 의료진 네이비/블루그레이와 기존 폰트를 유지했다. 실측 없는 Gateway ONLINE/동의 성공 체크 제거. 화면 정보 기반 동의·권한·기관·기간·전체 Study 범위 점검은 서버 승인과 구분한다. Series 한정 동의는 전체 Study 보관 도구에서 차단한다. 명시적 확인, 실행 직전 조건 재확인, 선택 동의 ID 사용, 중복 실행 방지, 네트워크 실패시 결과 불확실 표시 및 자동 재시도 금지. 성공 후 갱신 오류는 보관 완료 응답을 취소하지 않는다.

- 관련 FR 기능군: FR-010~020, FR-026~031, FR-037~041. 서버 인증·감사 경로 변경 없음, 신규 서버 보안 PASS 주장 없음.
- 수정 public/app.js, public/index.html, public/ui/clinician-demo-tools.css. 신규 public/ui/import-preflight.js, test/import-preflight.test.js, test/import-workbench.test.js.
- `node --check public/app.js` PASS. `node --test test/import-workbench.test.js test/import-preflight.test.js test/transfer-tracking.test.js test/share-reception.test.js test/clinical-theme-navigation.test.js`: 17/17 PASS, 종료0, 약0.25초. 실행 정상·거부·중복·timeout은 stub 기반 UI 테스트.
- 실제 localhost:3000/#DOCTOR → 시연도구 → PACS 반입 도구. 기본 합성 Brain MRI / VIEW_ONLY 실행 버튼 비활성 PASS. 1440×1000 및 390×844 가로 넘침 없음. output/playwright/pacs-import-desktop.png, pacs-import-mobile.png.
- 실제 신규 보관 요청/암호화 파일 생성/감사 연결/PACS 반입 E2E 및 B 배포·복구: NOT VERIFIED. 이번 화면 검증에서는 데이터를 새로 보관하지 않았다. 기존 B 배포 기준선 불일치 미해결. 기존 변경 보존, commit/push 없음.
- 다음 작업: B 정적 파일·인증 API 기준선 정렬 후 승인된 합성 DOWNLOAD_ALLOWED 흐름의 실제 보관 요청과 거부·감사 검증.

## 2026-10-13 KST 전송 확인 — 로컬 웹 반영 / B 배포 미실행

DRAFT / UNASSIGNED. 시연도구 전송 확인에 선택 공유의 제공/수신 병원 경로판, 공유 조건→영상 전송→수신 검증→PACS 등록 단계, 접힌 전체 로컬 보관 목록을 적용했다. API가 실제 전송 receipt를 제공하지 않으므로 미확인 단계를 완료로 올리지 않는다. VIEW_ONLY에는 반입 도구를 제시하지 않는다. 실제 권한은 기존 서버 검증 유지. 목록 존재만으로 표시하던 100% 무결, PACS 영구 등록, 완벽한 보호 문구를 제거했다. API/DB 계약 변경 없음. 관련 FR-006~009, FR-010~020, FR-026~036, FR-037~041 기능군 영향 검토(감사 구현 추가 없음).

- 변경: public/index.html, public/app.js, public/ui/clinician-demo-tools.css. 신규: public/ui/transfer-tracking.js, test/transfer-tracking.test.js.
- `node --check public/app.js`: PASS. `node --test test/transfer-tracking.test.js test/share-reception.test.js test/clinical-theme-navigation.test.js test/clinician-ui-preview.test.js`: 17/17 PASS, 종료 0, 약 0.35초. UI 상태/기존 회귀 시험이며 원격 전송 검증 아님.
- 실제 localhost:3000 브라우저 목록 조회 PASS. 런타임 기본 합성 Brain MRI / VIEW_ONLY / 로컬 보관 2건 확인. 고정 홍길동 CT 배포 증거가 아님. 1440×1000, 390×844 가로 넘침 없음. output/playwright/transfer-tracking-desktop.png 및 transfer-tracking-mobile.png.
- 별도 브라우저 503 주입: 확인 불가, 건수 제거, 반입 버튼 숨김 PASS. 주입 해제 후 실제 API 복구. 실제 정책 DENY 증거가 아님. 기존 세션은 구형 페이지를 표시하여 최초 캡처 시도 timeout; 새 transfer-live 세션에서 최신 파일 확인. favicon.ico 404 남음.
- B병원 배포/복구, 실제 DICOM 전송/수신 검증/PACS 등록: NOT VERIFIED. 앞선 B 배포 사전검사 records 경로 누락 게이트를 우회하지 않았음. 커밋/푸시 없음.
- 재현: localhost:3000/#DOCTOR → 시연도구 → 전송 확인 → 상태 다시 확인. 기존 사용자 변경 보존. 다음 작업 하나: B 배포본 환자 기록 및 인증 API/정적 파일 기준선을 정렬한 뒤 후보 배포·복구 검증.

## 2026-10-13 KST 공유 접수 화면 — 로컬 구현 / 종단 접수 미검증

DRAFT / UNASSIGNED. 의료진 공유 접수를 연결 정보 입력→서버 확인→승인된 영상 열기 구성으로 변경했다. 동일 출처 공유 링크 또는 nonce 입력, 카메라 영역 접기, 설명형 결과/실패 안내 추가. 시뮬레이션 버튼은 시연도구로 이동. 기존 redeem-viewer 인증/DPoP 경로를 사용하며 중복 제출 차단, 이전 환자 표시 초기화, 서버 응답의 환자 식별자 표시, 요청 오류 후 조작 복구, 화면 이동 시 카메라 종료를 구현했다. 관련 FR-010~013, FR-014~025, FR-032~036 기능군. 서버/API/DB 계약 변경 없음.

`node --test test/share-reception.test.js test/clinical-theme-navigation.test.js test/clinician-ui-preview.test.js`: 12/12 PASS(exit 0). 접수 정상·거부·통신 실패는 응답을 주입한 UI 단위시험이며 실제 서버 종단 성공이 아니다. 실제 Chrome에서 외부 링크 입력 시 redeem 요청 0건, 390px 가로 넘침 없음. 캡처 output/playwright/share-reception-desktop.png 및 share-reception-mobile.png.

실제 로컬 접수 시 proof-policy에 인증 헤더가 누락되어 401 관측. 헤더 전달 수정 후 실행 중인 서버가 해당 endpoint에 404 반환. 현재 로컬 서버와 소스 버전 정렬이 필요하다. 최초 브라우저 거부 대기 검증은 30초 timeout FAIL이며 정책상 DENY로 기록하지 않는다. 실제 허용/거부 접수·카메라 실물 스캔·B병원 배포는 NOT VERIFIED. B 배포/복구 미실행. 다음 작업: 실행 서버 기준선과 proof-policy 제공 여부를 정렬한 후 동일 공유 접수 흐름 재검증.

## 2026-10-13 KST 의료진 시연도구 분리 — 로컬 반영 / B 배포 미실행

신규 증적 DRAFT / UNASSIGNED. 로컬 `http://127.0.0.1:3000/#DOCTOR`에 진료 준비·환자 기록·환자 영상·공유 접수 네 메뉴, 선택 환자/검사 보드, 오른쪽 시연도구 dialog를 반영했다. PACS 수신·반입, 교류 단계, 감사, 관리자 화면은 기존 경로를 유지하며 도구에서 진입한다. 도구 화면에서 진료 준비로 복귀 가능. 실제 서버 응답의 환자/검사만 표시하며 로컬 기본 fixture는 홍길동 고정 CT 배포와 다르다.

검증: 관련 Node 테스트 14/14 PASS(exit 0), 새 Chrome 세션에서 패널 열기→PACS 수신함→복귀, Escape 닫기·초점 복귀 PASS. 1440×1000 및 390×844 표시, 모바일 패널/페이지 가로 넘침 없음. 캡처 `output/playwright/clinician-demo-tools-desktop.png`, `output/playwright/clinician-demo-tools-mobile.png`. 기존 favicon.ico 404는 관측됐으며 애플리케이션 오류로 확대 해석하지 않는다. 의료 인증·DICOM 종단 전송을 새로 실행한 증적은 아니다.

B 고정 SSH 호스트 검증과 현재 배포 기준선 조회 후 `python scripts/clinician-preparation-release.py --stage --tools`에서 `missingClinicianRoutes: ['records']`로 중단(exit 1). 실행 중 B 배포본에 환자 기록 화면이 없어 메뉴 계약 불일치. 배포·서비스 재시작·DB 변경 없음. B 반영과 배포/rollback 검증 NOT VERIFIED. 다음 작업은 B의 환자 기록 화면·인증된 기록 API 연결 후보를 먼저 정렬한 뒤 시연도구 정적 배포를 재검증하는 것이다.

관련 요구사항 기능군: FR-010~013 의료진 접근, FR-032~036 Viewer 진입, FR-037~041 감사 진입. 권한 부여 방식·API·DB 변경 없음. 기존 미커밋 변경 보존, 커밋·푸시 없음. 아래 배포 이력은 이번 후보의 배포 성공을 뜻하지 않는다.

## 2026-10-13 00:39 KST 의료진 지갑 제거 — 진료 브리핑 보드 B 정적 배포 PASS

현재 권위 상태: 의료진 진료 준비는 지갑/가죽/기울어진 종이를 제거하고, 좌측 전달받은 검사 · 중앙 어두운 보호 영상 영역과 밝은 환자/검사/공유 요약 · 우측 확인 안내로 변경했다. 시안의 업무 중심 방향을 적용했으며 픽셀 단위 동일 재현이나 실제 임상 화면 검증을 주장하지 않는다. frontend-design 및 playwright 스킬로 기존 Pretendard/블루 유지와 반응형을 확인했다. 관련 FR-010~013, FR-032~036 화면 표현 변경. API/DB/인가 정책 변경 없음, NFR 번호 임의 부여 없음.

- 코드 기준: HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. 사용자 기존 변경 보존. 이번 변경 파일: `public/index.html`의 지갑 이미지 두 요소 제거, `public/ui/clinician-preparation.css`, `test/clinician-preparation.test.js`, `scripts/clinician-preparation-{release.py,browser-check.js,attest.py}`, `Dockerfile.clinician-preparation` 및 전용 dockerignore. 배포는 기존 B HTML의 clinical-desk 절과 CSS만 포함하는 2개 overlay layer. app.js/server/Control/환자 PWA/DB/PACS 및 인증정보 변경 없음.
- pinned SSH 기준 B healthy 이미지 `sha256:e734178b6e83786da131f178f49eafc785d066714c5d73b6ae479b6054b2da23`. 새 이미지 `highpass-clinician:briefing-20261013`, `sha256:4c43aec80b59b35a485105ab4e74cc4961f9918cf4dfff7ee49755669bda30a8`. 합성 레이아웃 fixture만 사용; 새 DICOM 생성/적재 없음. 환자 기록 화면이 없는 배포본에서는 연결 버튼 비활성화, 진료 질문 미연결 표시 유지.

| 검증 | 결과 | 근거/한계 |
|---|---|---|
| focused 테스트 | PASS | `node --test test/clinical-theme-navigation.test.js test/clinical-dossier.test.js test/clinician-detail.test.js test/clinician-ui-preview.test.js test/clinician-preparation.test.js`, 18/18, exit 0, 약 0.39s. 단일 pixel hook 및 철회/만료/동의 없음 분기 포함 |
| 브라우저 디자인 | PASS | `npx --yes --package @playwright/cli playwright-cli -s=clinician-records run-code --filename scripts/clinician-preparation-browser-check.js`, exit 0, 약 4.5s, 320/390/768/1024/1440px 가로 넘침 없음. 로컬 디자인 fixture이며 로그인/PACS 대체 아님. `output/playwright/clinician-preparation-{1440,390}.png` 시각 확인 |
| build / 취약점 스캔 | PASS | Docker build exit 0, 약 95s. `HIPASS_CONTAINER_SCAN_IMAGE=highpass-clinician:briefing-20261013`, `HIPASS_TRIVY_RESULT=artifacts/security/container-scan/clinician-briefing-20261013.json`, `node scripts/container-scan.js` exit 0, HIGH/CRITICAL 0. 초기 빌드 완료 전 스캔은 후보 이미지 없음으로 실패, 최종 스캔으로 재검증. FROM 기본 ARG 경고는 명시 base 전달로 빌드 성공 |
| 배포/복구 | PASS | `python scripts/clinician-preparation-release.py --folder artifacts/workstation/clinician-preparation-20261012T153204Z --image highpass-clinician:briefing-20261013 --scan artifacts/security/container-scan/clinician-briefing-20261013.json --apply`, exit 0, 약 3분. 후보→기존 기준선 복구→후보, healthy/TLS 및 보호 컨테이너·설정 불변 확인 |
| 제공 파일 | PASS | `python scripts/clinician-preparation-attest.py --folder artifacts/workstation/clinician-preparation-20261012T153204Z`, exit 0, 약 0.86s. 프로젝트 CA로 실제 HTML/CSS byte 대조 2/2 |
| 로그인→고정 CT 실제 열람 | NOT VERIFIED | 브라우저 DOCTOR 로그인 화면까지 열었으나 시연 접근 키 미입력. VM 비밀번호를 웹 키로 대체하지 않음. favicon console 오류 1건 관측, 정책 거부로 해석하지 않음 |

증적 `artifacts/workstation/clinician-preparation-20261012T153204Z/{baseline.json,result.json,served-assets.json}`, DRAFT / UNASSIGNED. 재현은 위 명령. 복구는 result.json의 rollbackFiles를 사용하는 기존 승인된 Compose/보안 환경 경로와 이전 base image로 수행한다. 전체 회귀 미실행; 이전 감사 ID 자리수 FAIL은 여전히 별도 미해결. 커밋/푸시 없음, 전체 MVP/v3 완료 아님.

다음 작업 한 개: 의료진 시연 접근 키의 안전한 입력 후 실제 로그인 → 검사 선택 → 접근 검증 → 고정 CT 열람을 확인한다.

## 2026-10-13 00:13 KST 진료 준비 디자인 — B 정적 배포 PASS / 의료진 로그인 종단 NOT VERIFIED

목적: 의료진 진료 준비 화면을 좌측 전달받은 검사 목록 / 중앙 전달 카드·기존 Blender 가죽 지갑 렌더 / 우측 진료 전 확인 안내로 변경. frontend-design으로 기존 폰트·절제된 블루·업무 중심 배치를 유지하고 Playwright로 반응형을 확인했다. 관련 기능군 FR-010~013 및 FR-032~036의 화면 표현 영향이며 인증·동의·DICOM/API·DB 계약은 변경하지 않았다. 세부 승인 NFR 번호를 임의 부여하지 않는다.

- 로컬 변경: `public/index.html`, 신규 `public/ui/clinician-preparation.css`, `test/clinician-preparation.test.js`, `scripts/clinician-preparation-{release.py,browser-check.js,attest.py}`, `Dockerfile.clinician-preparation`과 전용 dockerignore. 기존 Blender 렌더 두 장 재사용; 시안의 가짜 CT·의료진 이름·질문 데이터를 복사하지 않았다. 실제 영상은 기존 단일 권한 검증 Viewer를 유지한다. 확인 목록은 안내이며 자동 판독/진료 완료 상태가 아니다.
- 배포 기준선은 pinned SSH로 읽은 B 실행 이미지 `sha256:32ae4718f60f88a47f4a21ec34b75ad1c4dd5b067026de664cdb38bcb45111a4`, healthy. dirty 로컬 전체 index/app/server를 배포하지 않고 **배포본 HTML의 clinical-desk 절만 교체**, 스타일·모델 이미지의 3개 정적 overlay layer만 추가했다. 실제 배포본에 records 화면이 없으므로 환자 기록 버튼은 `연결 준비 중`으로 비활성화했다. 질문 공유 미연결을 표시한다. 환자 웹/PWA 파일, Control, DB, PACS, 비밀번호, 서비스 환경·mount·보안 설정은 변경하지 않았다.
- 후보 `highpass-clinician:preparation-20261013`, image ID `sha256:e734178b6e83786da131f178f49eafc785d066714c5d73b6ae479b6054b2da23`. 새 서버 기능 승인이나 이전 승인 승계로 해석하지 않는다. 증적 DRAFT / UNASSIGNED.

| 검증 | 결과 | 범위 |
|---|---|---|
| focused Node tests | PASS | `node --test test/clinical-theme-navigation.test.js test/clinical-dossier.test.js test/clinician-detail.test.js test/clinician-ui-preview.test.js test/clinician-preparation.test.js`, 18/18, exit 0, 약 0.61s; 인증 상태 분기·단일 pixel hook·잘린 fixture 거부 포함. 실제 고정 700 CT 재검증은 아님 |
| 브라우저 레이아웃 | PASS | Playwright clinician-records 세션, `scripts/clinician-preparation-browser-check.js`; 로컬 합성 디자인 fixture 320/390/768/1024/1440px 가로 넘침 없음 5/5. 실제 로그인·PACS는 대체하지 않음. `output/playwright/clinician-preparation-{1440,390}.png` |
| build / scan | PASS | 최종 build exit 0, Trivy HIGH/CRITICAL 0, `artifacts/security/container-scan/clinician-preparation-20261013.json`; 초기에 image ID FROM 해석 및 artifacts build-context 제외 오류는 배포 전에 수정. final scan은 최종 image ID와 일치 |
| 배포·readiness·rollback | PASS | `python scripts/clinician-preparation-release.py --folder artifacts/workstation/clinician-preparation-20261012T150157Z --image highpass-clinician:preparation-20261013 --scan artifacts/security/container-scan/clinician-preparation-20261013.json --apply`, exit 0, 약 3분. 후보 활성화 → 기존 base 복구 → 후보 재활성화. 구성·TLS·health 및 기존 제한 보존 확인 |
| 실제 제공 정적 파일 | PASS | `python scripts/clinician-preparation-attest.py`, exit 0, 약 1s; 프로젝트 CA로 HTML/CSS/모델 4개 bytes 대조. 실브라우저 public DOM의 CSS 로드·모델 2층·단일 viewer-image 확인 |
| 의료진 로그인 → 승인된 CT Viewer | NOT VERIFIED | 시연 접근 키 미입력. VM 비밀번호를 웹 접근 키로 사용하지 않음. 브라우저 favicon 503 기존 관측; 진료 API 정책 DENY로 해석하지 않음 |

권위 증적: `artifacts/workstation/clinician-preparation-20261012T150157Z/{baseline.json,result.json,served-assets.json}`. 복구 시 `result.json`의 `rollbackFiles` 원래 Compose 파일 목록과 위 base 이미지를 사용하고 기존 승인된 운영 인증·환경 검사 경로를 유지한다. 임의 단독 `docker run`이나 key/환경 정책 변경으로 복구하지 않는다. 새 정적 파일은 다시 위 attestation 명령으로 재현 가능하다. 전체 회귀는 이번에 재실행하지 않았고, 이전 전체 회귀의 감사 ID 길이 문제 FAIL을 이번 focused PASS로 덮지 않는다.

다음 작업 한 개: **의료진 시연 접근 키를 안전한 입력으로 제공받아 실제 로그인 → 진료 준비 → 접근 검증 → 고정 CT Viewer 확인**. 건강기록 후보 backend/schema 및 질문 공유는 별도 미완료. 커밋·푸시 없음. MVP/v3 완료 아님.

## 2026-10-12 23:50 KST 배포 인증 재확인 — B / Control PASS, 배포 NOT VERIFIED

사용자가 제공한 VM 자격증명을 가림 stdin 입력으로 사용했다. 비밀번호를 명령 인수·소스·증적에 기록하지 않았다. `python scripts/deployment-auth-preflight.py --role BOTH` exit 0: Control 전용 SSH 키와 pinned host 확인 PASS; B `server@192.168.111.149` 비밀번호 인증, 기존 공개 호스트 키, 사용자 및 승인된 NIC MAC 대조, 기존 sudo uid 0 확인 PASS. 증적: `artifacts/workstation/deployment-auth-20261012T145016Z/result.json`, DRAFT / UNASSIGNED.

범위는 인증·기존 sudo 확인뿐이다. A VM은 이번 실행 대상이 아니며 NOT VERIFIED. 애플리케이션·DB·PACS·키·sudoers를 변경하지 않았고 배포·커밋·푸시하지 않았다. 이전 B 미입력 결과는 이력으로 보존하며 이번 인증 결과와 구분한다. 다음 작업 한 개는 B/Control의 최신 실행 이미지·소스 해시·readiness 읽기 전용 inventory다. 새 건강기록 후보의 검토·스키마/rollback·배포 및 원격 종단 검증은 여전히 미완료다. 제품 FR/API 계약 변경 없음.

## 2026-10-12 배포 인증 경로 확인 — Control PASS / B 미입력 NOT VERIFIED / 배포 NOT VERIFIED

23:41 KST 이후 관측. 이전 절의 ‘Control 키 경로 없음’은 확인 범위 오류였다. `.ssh` 최상위 파일만 조사해 `C:/Users/user/.ssh/highpass-capstone-cloud/` 하위 디렉터리를 놓쳤다. 기존 `id_ed25519`와 전용 `known_hosts`가 있으며 삭제·복제·신규 키 등록 없이 기존 연결을 사용했다.

- **Control PASS:** `python scripts/deployment-auth-preflight.py --role CLOUD`, exit 0, 약 2.6s. 기존 pinned SSH `highpassadmin@138.91.2.60`, `highpass-cloud` 호스트, 기존 sudo uid 0 확인. 증적 `artifacts/workstation/deployment-auth-20261012T144101Z/result.json`. 이는 인증·기존 sudo 확인뿐이며 애플리케이션 배포/readiness·DB 변경·전체 시연 성공은 아니다.
- **B NOT VERIFIED / 미입력 종료:** 기존 승인된 배포 경로는 `server@192.168.111.149`의 VM 비밀번호 인증이며, 2026-10-08 승격 기록의 B 공개 호스트 키와 RejectPolicy를 사용한다. A용 키를 B에 사용하거나 SSH host key 검증을 끄지 않는다. `python scripts/deployment-auth-preflight.py --role B --gui`로 로컬 가림 입력창을 열었으나 값을 받지 못하고 취소/3분 만료 처리로 종료했다. 증적 `artifacts/workstation/deployment-auth-20261012T144418Z/result.json`, reason `CREDENTIAL_INPUT_CANCELLED`. 인증 시도 실패나 정책 DENY로 해석하지 않는다. 웹 시연 비밀번호를 대신 사용하거나 비밀번호를 추측하지 않는다.
- 생성: `scripts/deployment-auth-preflight.py`, `test/deployment_auth_preflight_test.py`. 변경: `scripts/health-helper-runtime-check.py`의 공통 입력 함수, `scripts/wallet-ui-rollout.py`·`scripts/health-helper-align.py`의 `--credential-gui`. 비밀번호는 argv/파일/채팅/증적에 저장하지 않으며 이번 확인은 배포·키 설치·sudoers 변경을 수행하지 않는다. Python 문자열의 물리적 zeroization을 보장한다는 주장은 하지 않는다.
- 보안/관련 요구사항: 기존 역할별 배포 운영 인증·최소권한·Secret 관리 원칙 적용, 제품 FR/API 계약 변경 없음. `python -m unittest discover -s test -p deployment_auth_preflight_test.py -v` 5/5 PASS(exit 0); 잘못된 호스트/사용자/sudo, B MAC 불일치, 입력 취소, 예외 비밀정보 비노출 확인. 두 기존 스크립트 `--help`에서 옵션 노출 확인(exit 0). 이는 실제 B 인증 성공을 대신하지 않는다.

재시도 명령: `python scripts/deployment-auth-preflight.py --role B --gui`. 읽기 전용 B 배포 inventory: `python scripts/wallet-ui-rollout.py --inventory-only --credential-gui`. 기존 UI-only rollout을 새 건강기록 API/DB 배포에 사용하지 않는다. 다음 작업은 **B 입력·인증 확인 → 양쪽 최신 배포 inventory**이며, 후보 검토·스키마/rollback·원격 종단 검증은 별도다. 커밋·푸시 없음.

## 2026-10-12 의료진 환자 기록 + 환자 웹/PWA 명시적 공유 — DRAFT / UNASSIGNED / 원격 반영 NOT VERIFIED

관측 2026-10-12 23:30 KST 전후. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, 기존 dirty 변경 보존. 이번에 구현한 것은 **환자가 선택한 합성 건강기록을 기존 영상 동의에 묶어 의료진이 열람하는 후보**다. B/Control 배포, 최신 서버 로그인 종단, 전체 MVP/v3 완료가 아니다.

### 작업 목적·기존 구조·관련 요구사항

- 기존 Node ESM Control / PostgresStore / 정적 웹·환자 PWA / signed 역할 인증을 유지했다. `frontend-design`은 기존 Pretendard·절제된 블루·상단 메뉴·목록/상세 구성 유지에, Postgres 스킬은 바인딩·최소권한 원칙에 적용했다. 새 프레임워크나 외부 의료정보 수집은 없다.
- 영향 기능군: FR-001~005(동의), FR-010~013(의료진 화면), FR-014~020(인가), FR-037~041(감사). DICOM 토큰·Gateway·Viewer 계약은 변경하지 않는다. 개별 FR 원문과 승인된 NFR ID의 대응은 아직 확정할 수 없으며, 임의 번호/완료를 만들지 않는다.
- 인증된 환자 자신의 `/api/v1/me/health-records/synthetic`은 계속 환자 전용이다. 의료진에게 환자 JWT를 제공하거나 기존 환자 전용 API의 역할 제한을 풀지 않았다.

### 생성·수정 파일과 구현 결과

- 생성: `src/shared-health-records.js`, `public/ui/clinician-health.{js,css}`, `public/ui/health-share-picker.js`, `db/migrations/037_shared_synthetic_health_scope.sql`, `Dockerfile.clinician-health`, `test/shared-health-records.test.js`, `scripts/clinician-health-{preview,browser-check}.js`.
- 수정: `src/server.js`, `src/services.js`, `src/postgres-store.js`, `public/{index.html,app.js}`, `public/ui/patient-share-review.js`, `public/mobile/{app.js,sw.js}`, 현재 후보 패키징용 `Dockerfile.health-helper`·`Dockerfile.hcc-main-scenario`, 영향받는 navigation/consent/PWA 테스트. 이전 dirty 변경을 신규 작성분으로 주장하지 않는다.
- 의료진 상단에 **진료 준비 → 환자 기록 → 환자·영상**을 배치했다. 환자 기록에는 공유 동의 선택, 검사 필터·검색, 목록/상세, 공유 범위, AFP 비교, 2025/2026 건강검진 수치 차이, 합성 초음파 미리보기가 있다. 기존 영상 화면으로 연결하되 토큰을 자동 발급하지 않는다. 모바일 폭에서는 기록을 수평 카드 목록으로, 상세를 아래에 표시한다. 기존 지갑 모델의 렌더 자산을 재사용했다.
- 환자 웹 공유 확인 화면과 PWA 공유 1단계에 건강기록을 **선택하지 않은 상태**로 표시한다. 선택 ID가 웹의 승인 fingerprint에 포함되고, 변경 시 확인 체크가 해제된다. 선택하지 않은 과거 기록은 의료진 비교에 사용하지 않는다. PWA의 미지원 `clinicalRecordId` DICOM scope와 첫 항목 자동 선택을 제거했다. 현재는 적어도 한 영상 Study와 함께 공유하는 범위이며 건강기록 단독 공유는 지원하지 않는다.
- 데이터는 `hong-gildong-health-20261011-v1`의 고정 8개 합성 기록만 사용한다. AFP 24.6 / 8.4 / 6.2 ng/mL를 변경하지 않았다. CT·PACS·기존 영상 UID 및 payload를 수정/등록/삭제하지 않았다. 색상/수치 차이는 임상 판정이 아니다.

### API·DB·보안 검토

- 변경 전 `POST /api/consents`는 영상 범위만 받았다. 변경 후 optional `healthRecordIds`를 받고, 검증된 ID와 버전만 nullable `consents.health_record_scope` JSONB에 저장한다. 이전 동의는 NULL이며 소급 건강기록 권한을 부여하지 않는다. 새 스키마는 아직 원격 DB에 적용하지 않았다. SQL INSERT/읽기 mapping은 parameterized binding으로 검증했다.
- 신규 `GET /api/v1/clinician/health-records`는 공유 목록, `?consentId=<id>&purpose=<purpose>`는 그 동의의 선택 기록을 반환한다. HCC 등록 시나리오, signed 의료진 인증, 등록 의료진 역할·소속·승인 목적, ACTIVE 제공/수신 병원, 수신 기관, ACTIVE 동의, 시작/종료, 허용 목적/권한, 알려진 기록 ID/버전을 서버에서 확인한다. 요청 병원·환자·기록값을 브라우저 입력으로 대체하지 않는다.
- trusted ingress 설정이 있으면 내부 경로도 확인한다. 감사 저장을 기다린 후 철회/기간/기관/권한을 재확인하며, 감사 실패는 503과 무자료 응답이다. 미확인 동의 ID의 원문을 감사에 복사하지 않는다. 생성 저장 실패 시 이번 요청의 미확정 동의·scope만 메모리에서 제거한다. 실제 DB commit 결과가 불명확한 장애의 운영 복구는 별도 확인이 필요하다.
- 응답은 `no-store`, UI는 메모리/유한 timeout/AbortController/요청 revision을 사용한다. 화면 이탈·역할 변경·pagehide·공유 종료 시 기록을 정리한다. PWA는 static allowlist만 캐시하고 API·토큰·환자 기록은 캐시하지 않는다. 캐시 버전 v39. 새 독립 권한 테이블, 임상 진단, 연구용 건강기록 반출 기능은 없다.

### 실행 명령·결과·증적

| 검증 | 결과 | 실행 및 한계 |
|---|---|---|
| 집중 정상·음성·영향 회귀 | PASS | `node --test test/shared-health-records.test.js test/synthetic-health.test.js test/hipass-service.test.js test/postgres-save-snapshot.test.js test/consent-operations.test.js test/patient-share-review.test.js test/mobile-capstone-auth.test.js test/presentation-bundle.test.js` — 101/101, exit 0, 최종 focused 실행 약 1.9s. JWT 변조/만료, 타 사용자/역할·기관, purpose, 미공유·철회·만료, inactive 병원, 감사/생성 저장 실패 확인. 실제 Postgres 연결 시험은 아님. |
| 실제 브라우저 컴포넌트/응답 | PASS | `node scripts/clinician-health-preview.js` → `playwright-cli -s=clinician-records run-code --filename <절대경로>/scripts/clinician-health-browser-check.js` — 15/15, exit 0, 약 4s. loopback Test JWT + 실제 handler + 메모리 합성 fixture. 320/390/768/1024/1440 폭·검색·AFP/검진 비교·선택/범위·초음파. 320px 건강검진 비교표의 document overflow(431px)를 표 내부 스크롤로 보정 후 재검증. 운영 로그인/환자 승인 종단이 아님. `output/playwright/clinician-health-{1440,390}.png`. |
| 전체 Node 회귀 | FAIL | `node --test --test-concurrency=4 --test-reporter=spec --test-reporter-destination=output/clinician-health-regression-final-20261012.log --test-reporter=dot --test-reporter-destination=stdout` — 1088/1089, exit 1, 60.3s. 실패는 기존 HCC catalog operator 감사 receipt ID 검증. 단독 `node --test test/hcc-source-operator-contract.test.js`는 1/1 PASS(exit 0); 전체 실패를 덮지 않는다. |
| 문법 검사 | PASS | `node --check`로 server/services/app/mobile app/clinician-health 확인, exit 0. |
| 원격 DB·Control/B 배포·복구·실제 웹/PWA 종단 | NOT VERIFIED | 승인된 B·Control SSH 인증 경로 없음. `.ssh`에는 A용 키만 확인했고 다른 VM에 사용하지 않았다. 이미지 build/scan·배포/rollback 신규 실행 없음. Dockerfile은 후보 정의일 뿐이다. |

중간 실패 이력: PWA v38 기대값 불일치 및 새 컨트롤러가 빠진 navigation VM fixture 두 건은 v39/기록 화면 검증으로 보정했다. JWT 음성 fixture의 patientId 누락은 인증 단계 401이었으며 유효한 환자 주체를 넣어 역할 거부 403을 검증했다. 최종 전체 회귀의 감사 ID 불일치는 여전히 남는다. 기존 `makeId`는 unpadded uint32 두 값을 합치지만 해당 operator는 정확히 16자 hex를 요구한다. 길이 차이 가능성을 확인했으며 이번 작업에서 기존 등록 코드는 수정하지 않았다.

### 재현·복구·남은 위험·다음 작업 한 개

로컬 미리보기: `node scripts/clinician-health-preview.js`, `http://127.0.0.1:11448/preview`. 메모리 합성 fixture만 생성하며 Ctrl+C로 종료하면 사라진다. 프로덕션 사용자 인증 우회 경로로 사용하지 않는다. 기존 실행 서버/데이터는 보존했다.

배포 후보는 `Dockerfile.clinician-health`의 control/ui target으로 분리했다. 승인된 환경의 새 inventory·role별 base/hash·스키마 권한·scan·콘텐츠/동의 변경 검토가 끝나기 전 빌드/배포를 완료로 선언하지 않는다. 과거 UI-only wallet rollout의 서버 byte 불변 조건으로 이 API 변경을 배포해서는 안 된다. nullable 신규 컬럼은 기존 동의를 수정하지 않으며 rollback 시 삭제하지 않는다. 구버전 Control의 whole-store 저장이 새 scope를 유실할 가능성이 있어 구버전 writer rollback은 별도 호환 검증과 writer 정지/복구 계획이 필요하다.

다음 작업 한 개: **승인된 B·Control 인증 경로 확보 → 새 배포 inventory와 이번 공유 범위 변경 검토 → 후보/DB 호환·rollback 검증 → 동시 배포 → 환자 웹/PWA 선택·승인 → 의료진 열람·철회 거부를 실제 서버에서 재검증.** 현재는 로컬 구현 후보이며 독립 검토 상태 `DRAFT / UNASSIGNED`. 커밋·푸시 없음. 전체 RAG/MVP/v3 완료 아님.

## 2026-10-12 영상공유 실제 모델 웹/PWA 연결 — DRAFT / UNASSIGNED / 원격 배포 NOT VERIFIED

관측 2026-10-12 22:35 KST 전후. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty 작업트리 보존. 아래 이전 절의 모델 단독 검토 상태를 이번 로컬 UI 연결 결과로 갱신한다. 서버 배포 완료를 의미하지 않는다.

- `assets/wallet-3d/v3/mediq-wallet.blend`의 동일 mesh/material/camera에서 뒤판과 앞포켓·잠금띠를 별도 PNG로 렌더했다. `scripts/render-wallet-ui.py`, `scripts/package-wallet-ui.py` 추가. CSS/SVG로 가죽을 생성하지 않는다. HTML 카드는 입력/접근성을 위해 유지하고 실제 모델 앞포켓이 가린다.
- 새 `public/images/mediq-wallet-model-{back,front,mobile-back,mobile-front}.webp`는 무손실 RGBA 변환이며 모바일은 같은 렌더의 오른쪽 leaf crop이다. 가죽 비율을 늘리지 않는다. 원본·hash·크기: `assets/wallet-3d/ui-v1/web-manifest.json`. 각 파일 2 MiB 미만, 1800×1100 / 900×1100. 이전 모델·SVG는 이력 보존, 이번 sharing CSS에서 참조하지 않는다.
- 수정 `public/ui/sharing-wallet-v2.css`(실제 레이어/반응형/날짜 입력 폭), `public/mobile/sw.js`(v38, 공개 자산만), `Dockerfile.wallet-ui`, `scripts/wallet-ui-rollout.py`, `test/patient-sharing.test.js`. 추가 `scripts/sharing-model-browser-check.js`. frontend-design은 로그인 지갑 소재 일관성, Playwright는 실제 로컬 브라우저 점검에 사용했다.
- FR-001~005 / FR-006~009 기능군의 UI 변경. FR-014~025 기존 서버 정책 유지. API/DB/권한/감사 계약·서버 코드·PACS 변경 없음. FR 개별 원문 부재로 세부 ID를 새로 추정하지 않는다. 기존 미커밋 화면 파일도 UI-only 후보에 포함되므로 후보 범위는 rollout FILES 목록 전체다.

검증:

| 검사 | 결과 | 근거 / 범위 |
|---|---|---|
| Blender 레이어 렌더 | PASS | exit0, 뒤판148.44초 / 앞포켓59.84초; 원본 보존 |
| 무손실 WebP 픽셀·크기 검증 | PASS | exit0, PNG와 decoded RGBA 전 픽셀 일치, manifest |
| focused 회귀 | PASS | `node --test test/patient-sharing.test.js test/patient-share-review.test.js test/mobile-health-helper.test.js test/wallet-open.test.js test/wallet-home.test.js test/patient-helper.test.js test/mobile-capstone-auth.test.js`, 49/49, exit0,568.5017ms; `artifacts/ui/sharing-model-focused-20261012.log` |
| 로컬 브라우저 | PASS | `npx.cmd --yes --package @playwright/cli playwright-cli -s=sharing-v2 run-code --filename "C:/Users/user/Documents/New project/scripts/sharing-model-browser-check.js"`, exit0,26 checks. web1440/1024/768/390/320, mobile390/360/320; overflow, 실제 레이어, 수신기관/만료 초안 거부, 확인 요청, 단계 이동, reduced motion, uncaught error 없음. `artifacts/ui/sharing-model-browser-20261012.log` |
| UI-only Docker build | PASS | `highpass-wallet:sharing-model-20261012-v1`, exit0; manifest/index `sha256:fffccbb08cf87136ad0c21dcd99ca1795a4bb0a18add885b3ccc3e77c7594647`; 필수 BASE ARG 기본값 부재 경고는 보존 |
| 후보 취약점·자산 | PASS | `artifacts/security/container-scan/sharing-model-20261012-v1.json`, HIGH0/CRITICAL0, exit0. rollout `--verify-local-only`로 후보와 작업 파일 20개 해시 일치·2MiB 제한 확인(exit0) |
| B병원 TLS/readiness | PASS | 지정 CA 검증을 유지한 10초 timeout GET `/api/health` HTTP200; SSH inventory는 수행하지 못함 |
| B 신규 자산 제공·배포/복구 | NOT VERIFIED | 신규 `/images/mediq-wallet-model-front.webp` HTTP503. B SSH 인증 미제공. 로컬 후보를 원격으로 전송하지 않음 |
| 실제 인증→승인→QR/Viewer 종단·설치형 PWA | NOT VERIFIED | 이번 브라우저는 `LOCAL_SYNTHETIC_FIXTURE_NOT_SERVER_E2E`, API 없는 합성 fixture이며 서버 동의를 생성하지 않음 |

스크린샷 `output/playwright/sharing-model-web-final.png`, `sharing-model-mobile-final.png`, `sharing-model-mobile-settings.png`. 로컬 재현 `node scripts/sharing-wallet-preview.js` → `http://127.0.0.1:11447/preview` 또는 `?mobile=1`. 원격 서비스는 변경하지 않아 이번 원격 복구 작업 없음.

중간 실패 보존: WebP 기본 인코딩의 투명 RGB 최적화로 exact 비교 FAIL 후 `exact=True`로 보정, 실패한 이번 작업 산출 파일 한 개만 제거 후 재생성. 브라우저 CLI 작업경로가 `C:/projects`여서 상대 스크립트/스크린샷 경로 실패, 절대 경로 사용으로 보정. 모바일 asset 이름을 빠뜨린 reduced-motion 검증기 FAIL 후 이름 패턴 보정. 이 결과들은 정책 DENY 또는 제품 종단 결과가 아니다.

다음 작업 한 개: 승인된 B SSH 인증 경로 확보 후 **새 read-only inventory**로 실행 이미지 확인 → 최신 후보 scan/hash 및 기존 서버 byte 일치 검증 → 배포/rollback → 실제 서버 웹/PWA 재검증. `python scripts/wallet-ui-rollout.py --inventory-only`는 concealed 입력을 사용한다. 비밀번호/개인키 내용을 채팅·argv·소스에 넣지 않는다. 과거 expected-base나 다른 후보 scan을 무조건 재사용하지 않는다. 커밋/푸시 없음, 전체 MVP/v3 완료 아님.

## 2026-10-12 영상공유 실제 지갑 모델 — DRAFT / UNASSIGNED / 디자인 검토용

사용자가 SVG/CSS 가죽 표현을 거부하여 해당 후보의 배포를 진행하지 않고 실제 Blender 모델 제작으로 전환했다. `scripts/build-wallet-model.py`는 좌우 가죽판·중앙 거싯·앞포켓·잠금띠·금속 스냅·두 장의 카드를 독립 mesh로 생성한다. 봉제선은 bevel이 있는 개별 curve이며 가죽은 Voronoi/Noise/Bump를 사용하는 절차적 재질이다. 웹 CSS나 기존 PNG를 변형해 만든 모델이 아니다. frontend-design 지침은 로그인 지갑과의 색/소재 일관성에만 적용했다.

현재 검토 후보 `assets/wallet-3d/v3/mediq-wallet.blend`. v1의 포켓 중심 곡면 오류와 흐린 질감은 v2에서 보정했고, v3에서 과한 표면 반사와 밝은 블루를 줄였다. 이전 후보는 이력으로 보존한다. 도구는 공식 Blender 4.5.0 Windows ZIP을 `tmp/wallet-model-tools/`에만 풀었으며 공식 SHA-256 `2ee75e9466d293a784fdf020f60fe1309c1e0610ecf73c64f1fc09b01e5eec56` 일치 확인 후 실행했다. 시스템 설치/시작프로그램 변경 없음.

`scripts/verify-wallet-model.py`로 v3 원본을 다시 열어 mesh 두께, 봉제선 형상, 재질 노드, ray cast 기반 카드/포켓 가림, 외부 텍스처 의존성 17/17 PASS(exit 0). 증거: `assets/wallet-3d/v3/geometry-check.json`. 이는 형상 검증이며 시안 동일성 승인 또는 웹 종단 PASS가 아니다. Cycles CPU 48 samples의 전체(1600×1050)·확대(1200×1000)·투명 배경(1800×1100) 렌더 생성 PASS(exit 0), manifest의 출력 파일 SHA-256 모두 재검증 PASS. 총 35개 object 중 mesh 12개, curve 18개다. 전체/확대 이미지를 시각 검토했으며 카드 중앙 곡면 결함이 제거된 것을 확인했다. 원본 시안과 픽셀 단위 동일성을 주장하지 않는다.

재현 명령: `tmp/wallet-model-tools/blender-4.5.0-windows-x64/blender.exe --background --factory-startup --python-exit-code 1 --python scripts/build-wallet-model.py -- --output assets/wallet-3d/<새 후보 폴더> --samples 48`. 기존 출력 폴더는 덮어쓰지 않는다. 검증 명령: 같은 Blender 실행파일에 `--background assets/wallet-3d/v3/mediq-wallet.blend --python-exit-code 1 --python scripts/verify-wallet-model.py`. 기존 geometry-check.json이 있으면 덮어쓰지 않고 종료한다. Python 문법 검사 PASS. 새 웹 배포가 없어 서비스 rollback은 해당 없음.

관련 FR-001~005, FR-006~009의 공유 화면용 표현 자산 후보이며 API/동의/권한/감사/DB/PACS/기존 웹 파일은 이번 모델 작업에서 변경하지 않았다. 신규 생성 스크립트 2개와 모델·렌더 자산, 이 현황만 추가했다. 실제 웹/PWA 합성·카드 인터랙션·성능·배포/rollback은 NOT VERIFIED. 다음 작업 한 개: 모델 렌더의 형태·재질 확인 후 동일 렌더 레이어 위에 기존 접근 가능한 폼을 연결한다. 전체 MVP/v3 완료가 아니다.

## 2026-10-12 건강도우미 AFP 상세근거 — DRAFT / UNASSIGNED / 로컬 후보

AFP 목적·한계·준비·비교 조건 4개를 원문 해시와 함께 로컬 후보 v2로 구성했다. 자동 테스트 26/26 PASS, 실제 Chrome 로컬 후보 웹·모바일에서 출처·질문 담기/수정·근거 부족·거부 흐름을 확인했다. 암 확정·개인 수치·정상범위·복수의도·임신 AFP는 제외하며 초안 답변은 저장 문장과 정확히 일치시킨다. 전문가 콘텐츠 검토는 미지정이고, 기존 환자 API·권한·감사 계약에는 연결하지 않았다. 로컬 후보는 127.0.0.1:11441이며 미배포다. 상세 증거와 다음 작업은 [AFP 후보 기록](health-helper-afp-evidence-20261012.md). 다음 단위는 후보 문장 검토와 실제 API 연결 계약 정렬이다. 전체 의학 질문 범위·MVP/v3 완료가 아니다.

## 2026-10-12 사용자 제공 한국어 MedlinePlus 연결 — DRAFT / UNASSIGNED / 로컬 후보

추가 등록: v3 후보에서 보류 107개도 HOLD 상태·사유·번역 세그먼트와 함께 등록, 총1,017개. 로컬 보류 목록과 원문 링크 제공, 답변 근거 검색은 기존910개만. 보류 주제는 AI 생성 없이 보류 안내. 관련17/17 및 로컬 HTTP 검증 PASS, 실제 배포 미실행. 자세한 최신 상태는 아래 구현 기록의 ‘보류 자료 등록 추가’를 참조한다.

1,017개 문서 중 파일상 AI QA PASS 910개, HOLD 107개. PASS 자료만 17,036개 검색 청크로 기존 웹·모바일 건강도우미 renderer의 격리 로컬 Qwen 설명형 경로에 연결했다. 보류 자료는 검색하지 않고 의료전문가 검수·최신성 검증을 승계하지 않는다. 실제 환자 API/private 방문질문 relay·B/Cloud 배포본은 변경하지 않았다. [구현·검증·원본 hash·재현·남은 작업](medlineplus-upload-20261012.md). 다음 작업은 새 후보의 사용/시험 범위 검토 후 기존 인증·감사·private relay를 보존한 실제 API adapter 연결이다. 전체 MVP 완료 아님. 이전 건강도우미 디자인 후보의 B 배포 인증 대기도 그대로 남는다.

## 2026-10-12 건강도우미 확장 카드 — DRAFT / UNASSIGNED / 배포 인증 대기

민트색 펼침 카드, 블루그레이 질문 보관함(#E5EDF6), 흰색 질문 카드, 네이비 글자(#192638)를 웹과 모바일 PWA 코드에 적용했다. 하단은 홈과 동일한 정면 가죽 지갑이며 선택한 건강도우미를 제외한 3개 카드가 남는다. 검사 비교는 접이식, 모바일 질문 보관함도 접이식이다. 기존 createPatientHelper와 인증 API·출처 처리·질문 담기/수정 handler를 그대로 유지하며 시안의 답변을 주입하지 않았다.

관련 범위: FR-006~009 기록 화면 연결, FR-001~005 공유 화면 이동(서버 정책 유지). 건강도우미 디자인은 부가 UI이며 임상 판단 기능이나 신규 FR 완료가 아니다. 서버/API/DB/동의/감사/RAG 자료·모델 계약 변경 없음. 변경: public/app.js, public/mobile/app.js, public/ui/wallet-home.js, public/ui/wallet-record-sheet.css, public/mobile/sw.js(v35). 신규 scripts/helper-extracted-browser-check.js, test/helper-extracted-design.test.js. 기존 patient-sharing 테스트의 캐시 버전 기대값만 갱신했다. frontend-design 스킬의 재질·타이포 일관성을 적용했고 모바일의 기존 ID selector가 색상을 덮는 문제를 실제 확인 후 수정했다.

검증: node --test test/helper-extracted-design.test.js test/patient-helper.test.js test/mobile-health-helper.test.js test/health-helper-visit.test.js test/wallet-home.test.js test/patient-sharing.test.js → 33/33 PASS, exit0,398.7623ms. 실제 B 서버 로그인과 API를 사용하는 LOCAL_UI_OVERLAY_REAL_BACKEND에서 웹5·모바일6 UI 검사 PASS: 지갑의 다른 카드·실제 색상·담기·수정·새 대화 후 질문 유지·비교 접기·모바일 보관함·가로 overflow 없음. 스크린샷 output/playwright/helper-extracted-{web,mobile}-20261012.png. API를 mock하지 않았으나 질문 생성 POST/원문 열기/QR/CT 종단은 이번 디자인 작업에서 재검증하지 않았으므로 NOT VERIFIED. 기존 PHR summary/imaging-studies 403은 관측됐으며 해결하지 않았다.

중간 실패: CLI 패키지 이름 오류, Docker SHA를 FROM 이미지명으로 넣어 build 실패, 브라우저 stale ref/새 대화 label 불일치 timeout, 모바일 색상 불일치. 최종 실행은 수정 후 통과했으며 이들은 정책 DENY 증거가 아니다.

최종 후보 highpass-wallet:ui-20261011: manifest sha256:7cf0a5513f3a0a49302569aa517350e840959d19d3d7c47ce04162f645f062d0, config sha256:8d71fad2c77d428f59a299b5bf1c9de2c5888d5fc435e731de7cde6f3e95ea5f. 로컬 이전 공유 후보를 helper-baseline-20261012 태그로 보존하고 UI-only Docker build PASS(exit0). Trivy 최종 검사 PASS(exit0), HIGH0/CRITICAL0: artifacts/security/container-scan/helper-extracted-20261012-final.json. 앞선 helper-extracted-20261012.json은 CSS 수정 전 후보 증거이며 최종으로 승계하지 않는다.

B 원격 배포·rollback·실제 배포본 파일 attestation은 SSH 인증 미제공으로 NOT VERIFIED. 배포 완료라고 표현하지 않는다. 다음 작업 한 개: 사용자 concealed 인증 입력 후 python scripts/wallet-ui-rollout.py --apply --expected-base sha256:32ae4718f60f88a47f4a21ec34b75ad1c4dd5b067026de664cdb38bcb45111a4 --scan-result artifacts/security/container-scan/helper-extracted-20261012-final.json 실행. 이 expected-base는 이전 관측값이며 스크립트의 신규 inventory로 일치 확인 전 배포 금지. scan 24h 최신성/후보 일치 확인 후에만 진행하며 완료 후 live-attest 및 overlay 없는 실제 브라우저 재검증 필요. rollback은 실제 inventory와 기존 rollout 절차 사용. 과거 공유 절의 배포 명령/scan은 현 후보에 사용하지 않는다. 커밋·푸시 없음, 번역 중지 유지, 전체 MVP/v3 완료 아님.

## 2026-10-12 영상공유 확장 카드 — DRAFT / UNASSIGNED / 배포 인증 대기

승인 시안 `docs/design/mediq-sharing-extracted-card-20261012.png`를 기준으로 보라색 공유 카드와 홈의 동일한 정면 가죽 지갑을 연결했다. 선택한 영상공유 카드는 지갑에서 제외하며 공유 내용 확인·내 건강기록·건강도우미가 남는다. 웹은 실시간 공유 요약, 모바일은 기존 기록 선택→병원 설정→명시적 승인→QR의 4단계를 보존한다. 시안의 썸네일과 가상 활성 상태를 그대로 주입하지 않는다. 병원·목적·권한·시작/종료·거부·철회 계약을 변경하지 않았다.

관련 FR-001~005(동의 준비/확인), FR-006~009(영상 선택), FR-014~025(기존 서버 검증 유지). 서버/API/DB/PACS 변경 없음. 수정 public/app.js, public/mobile/app.js, public/ui/patient-sharing.js(공통 표현 shell), public/ui/wallet-record-sheet.css(보라색 sheet·모바일 여백·공유 목록), public/mobile/sw.js(v34, static module cache), scripts/wallet-ui-browser-local.js, scripts/wallet-ui-rollout.py(기존 scan 증거를 덮어쓰지 않는 선택 인자). 신규 scripts/sharing-extracted-browser-check.js 및 승인 이미지. frontend-design의 소재·타이포 일관성을 적용했고 실제 화면 비교 후 과거 가죽 포켓 장식 및 모바일 빈 여백을 제거했다. 인증정보·의료기록을 static cache에 추가하지 않았다.

검증: `node --test test/patient-sharing.test.js test/patient-share-review.test.js test/wallet-home.test.js test/wallet-open.test.js test/mobile-wallet-design.test.js test/mobile-capstone-auth.test.js` 33/33 PASS(exit0,557.3526ms), `artifacts/ui/sharing-extracted-focused-20261012.log`. 최초 shell을 form factory 안에 넣은 구현은 기존 경량 DOM fixture에서 FAIL했고, 실제 초기화 계층으로 분리 후 통과했다. 브라우저 최초 로그인 시 존재하지 않는 selector 사용으로 timeout 발생, snapshot의 실제 textbox로 다시 로그인했다. 이는 제품 정책 DENY 증거가 아니다.

실제 서버 API를 사용하는 로컬 UI overlay에서 웹8·모바일6 검사 PASS(exit0): `artifacts/ui/sharing-extracted-{web,mobile}-local.log`. 검사 범위: 세 개 남은 카드, 웹 목적/권한 요약, 잘못된 종료 시각 차단, 승인 체크 자동 선택 없음, 모바일 전원 확인, 웹1440/1024/768·모바일390/360/320 overflow 없음, 건강기록 카드 이동. 캡처 `output/playwright/sharing-extracted-{web,mobile}-20261012.png`. reduced-motion PASS: `artifacts/ui/sharing-extracted-motion-20261012.log`. 신규 동의/QR 생성·사용·의료진 열람·실기기 설치형 PWA·전체 종단은 NOT VERIFIED. 과거 종단 PASS 승계 없음.

후보 빌드 PASS(exit0): `artifacts/ui/sharing-extracted-build-20261012.log`, 이미지 sha256:77b0d3513f35718cfb460d445048e739e982f453c18d8a3cab94610979f328fe. 빌드 경고 InvalidDefaultArgInFrom은 기존 필수 BASE ARG의 기본값 부재이며 이번 빌드에서는 정확한 baseline을 지정했다. baseline `highpass-wallet:sharing-baseline-20261012` = sha256:32ae4718f60f88a47f4a21ec34b75ad1c4dd5b067026de664cdb38bcb45111a4를 로컬 보존했다. 최신 원격 image/readiness 재확인·배포·rollback·제공 파일 해시·overlay 없는 신규 배포 브라우저 검증은 B SSH 인증 입력이 없어 NOT VERIFIED. 기존 웹에 반영 완료라고 선언하지 않는다. 사용자에게 concealed VM credential 입력 여부를 요청했으며 비밀번호를 채팅·파일·argv에 요구하지 않는다.

다음 작업 한 개: B VM 인증 입력 후 `python scripts/wallet-ui-rollout.py --apply --expected-base sha256:32ae4718f60f88a47f4a21ec34b75ad1c4dd5b067026de664cdb38bcb45111a4 --scan-result artifacts/security/container-scan/sharing-extracted-20261012.json` 실행. scan의 최신성·이미지 일치·HIGH/CRITICAL 부재 및 실제 baseline 일치·비UI 바이트 보존이 먼저 충족되어야 한다. 이어 `python scripts/wallet-ui-live-attest.py`, overlay 제거/실제 로그인 후 새 browser check 실행. 원격 baseline이 달라지면 중단·재확인. 기존 rollback 절차와 receipt를 사용하고 정책/인증 우회 금지. 커밋·푸시 없음, 번역 중지 유지, 전체 MVP/v3 완료 아님.

후보 Trivy 검사 PASS(exit0): HIGH0/CRITICAL0, `artifacts/security/container-scan/sharing-extracted-20261012.json` 및 `artifacts/ui/sharing-extracted-scan-20261012.log`. rollout Python compile PASS(exit0). 실제 원격 배포·복구 검증은 미실행.

## 2026-10-12 홈 지갑에서 꺼낸 건강기록 카드 — DRAFT / UNASSIGNED

사용자가 승인한 시안 docs/design/mediq-extracted-record-card-20261012.png(원본 exec-2e0970b9-143a-4555-b83b-65793d0d04d5.png)를 기준으로 건강기록을 하늘색 확장 카드에 배치하고, 하단에는 홈과 동일한 mediq-wallet-front-v1.webp(정면·중앙 잠금띠)를 사용했다. 선택한 건강기록 카드는 지갑에서 제외하고 공유 내용 확인/영상 공유/건강도우미 세 카드가 남는다. 기존 필터·검진 상세·AFP·CT 권한 기반 미리보기 계약을 유지했다. 관련 FR-006~009, FR-001~005 진입, FR-032~036 Viewer 진입. 서버/API/DB/PACS 및 인가 정책 변경 없음.

수정 public/ui/wallet-home.js(공통 dock/아이콘·카드 정의), public/ui/patient-health.js(확장 sheet 및 dock), public/app.js와 public/mobile/app.js(기존 공유 확인 경로), public/ui/wallet-home.css(import), public/mobile/sw.js(v33), Dockerfile.wallet-ui 및 기존 rollout/attest/local overlay 목록. 신규 public/ui/wallet-record-sheet.css, scripts/extracted-wallet-browser-check.js. frontend-design의 기존 소재·타이포 일관성을 적용했다. 카드 꺼내기 180ms 후 펼침 240ms, reduced-motion에서 펼침 none 확인: artifacts/ui/extracted-card-motion-20261012.log.

집중 25/25 PASS(exit0,326.8873ms): artifacts/ui/extracted-card-focused-20261012.log. 최초 실행은 제거된 helper title의 픽셀 미전달 안내 assertion에서 FAIL; 기존 안내를 새 카드 title로 유지한 재실행 PASS. 전체 테스트는 이번 UI 변경에서 재실행하지 않았다. 로컬 후보/실제 API에서 기록 필터·AFP 상세·홈 복귀 각각10검사, 선택 카드 제외·3개 dock·공유/도우미/요청 이동·3화면폭 각각7검사 PASS: artifacts/ui/extracted-card-{web,mobile}-local{,-records}.log. 브라우저 준비 중 about:blank/로그인 화면에서 실행한 검증 timeout은 코드 거부 검증이 아니며, 실제 로그인 후 재실행했다. 캡처 output/playwright/extracted-card-{web,mobile}-20261012.png. CT 미리보기 픽셀은 기존 upstream 실패로 NOT VERIFIED. 실기기 설치형 PWA는 NOT VERIFIED.

2026-10-12 13:31 KST 배포 이미지 sha256:32ae4718f60f88a47f4a21ec34b75ad1c4dd5b067026de664cdb38bcb45111a4. Trivy HIGH0/CRITICAL0 PASS, 배포·rollback PASS(exit0): artifacts/workstation/wallet-ui-20261012T042621Z/result.json. baseline ab1079d4…에서 서버·재사용 모듈 바이트 보존 확인. strict TLS 제공 파일15/15 일치 PASS(exit0): artifacts/ui/extracted-card-served-assets-20261012.json.

로컬 overlay 제거 후 실제 배포 웹/PWA ID/PW 로그인, 기록10검사 및 dock7검사 각각 PASS(exit0): artifacts/ui/extracted-card-{web,mobile}-live{,-records}.log. 합계34개 UI 검사이며 CT 픽셀 성공이 아니다. 최종 캡처 output/playwright/extracted-card-{web,mobile}-20261012.png. 관련 명령 `node --test test/patient-health.test.js test/patient-sharing.test.js test/wallet-home.test.js test/wallet-open.test.js`, 로그인 후 `npx --no-install @playwright/cli -s=hipass-ct-check run-code --filename scripts/records-sheet-browser-check.js` 및 scripts/extracted-wallet-browser-check.js; UI 제공 바이트 `python scripts/wallet-ui-live-attest.py`. 복구 baseline·compose 위치는 rollout receipt에 보존되며 baseline 복구/후보 재적용을 실제 검증했다. 남은 CT 미리보기503은 미해결, 신규 임상/영상 종단 증거 없음. 신규 증적 DRAFT / UNASSIGNED, 커밋·푸시 없음. 번역 중지 유지. 전체 MVP/v3 완료 판정이 아니다.

## 2026-10-12 지갑 카드 깊이감 보정 — DRAFT / UNASSIGNED

관련 FR-006~009, FR-001~005, FR-032~036의 화면 표시·기존 진입만 변경. public/ui/patient-health.js에 정적 SVG 공유/대화 아이콘과 왼쪽 포켓 안내를 추가하고, public/ui/wallet-bifold.css에서 긴 카드 표면을 다음 카드와 앞 포켓 뒤로 이어지게 했다. 클릭 대상은 노출된 상단이며 장식은 pointer-events:none이다. frontend-design의 소재 일관성·절제된 동작 원칙을 적용했다. 실제 3D 모델이나 새 인증 기능은 아니다. public/mobile/sw.js는 v32로 갱신했다. API/DB/권한/동의 계약 변경 없음.

집중 테스트 25/25 PASS(exit0,227.6022ms): artifacts/ui/bifold-depth-final-focused-20261012.log. 전체 테스트는 이번 보정에서 재실행하지 않았다. 모바일 최초 캡처에서 카드 하단이 지갑 밖으로 돌출된 결함을 발견하여 pseudo-element 높이를 240%에서 170%로 수정했다. 브라우저 검증 첫 재실행은 이미지 로드 전 판정해 FAIL; scripts/bifold-browser-check.js에 10초 제한 이미지 로드 대기를 추가하여 재검증했다. 로컬 UI/실제 API 후보 웹·모바일 각각 지갑5검사 PASS, 모바일 기록10검사 PASS. CT 픽셀 검증은 이 변경에 포함하지 않는다.

2026-10-12 12:34 KST 최종 이미지 sha256:ab1079d478148a2c6e3bf8fa0b3a34509cc332ef56c3e4fdd652bd1e1fd3d61e. Trivy HIGH0/CRITICAL0 PASS, 배포·rollback PASS(exit0): artifacts/workstation/wallet-ui-20261012T033102Z/result.json. 첫 배포 cfd750c6…(artifacts/workstation/wallet-ui-20261012T032530Z/result.json) 이후 모바일 돌출 보정/v32를 추가 배포했다. 서버·재사용 모듈 바이트 보존, strict TLS 공개 파일14/14 일치 PASS: artifacts/ui/bifold-depth-served-assets-20261012.json.

로컬 overlay 제거 후 실제 배포 웹/PWA ID/PW 로그인 및 각각 지갑5검사·기록10검사 PASS(exit0): artifacts/ui/bifold-depth-{web,mobile}-live{,-records}.log. 웹1440/1024/768 및 PWA390/360/320px에서 검증했다. 실제 기기 설치형 PWA는 NOT VERIFIED. 최종 캡처 output/playwright/bifold-depth-detail.png 및 bifold-depth-mobile-detail.png. 기존 CT 미리보기 픽셀 표시 실패/503 및 PHR403은 해결하지 않았으며 CT 종단 검증 PASS가 아니다. 기존 변경사항 보존, 커밋·푸시 없음. 번역 작업 중지 유지.

재현: 각 URL에서 로그인 후 `npx --no-install @playwright/cli -s=hipass-ct-check run-code --filename scripts/bifold-browser-check.js` 및 scripts/records-sheet-browser-check.js. 제공 바이트 검증은 `python scripts/wallet-ui-live-attest.py`. 복구 baseline·compose 위치는 위 두 rollout receipt에 보존; 각 배포에서 baseline 복귀/후보 재적용을 검증했다. 다음 작업 한 개는 기존 CT 미리보기503 원인 확인이며 전체 MVP/v3 완료를 선언하지 않는다.

## 2026-10-12 좌우로 펼친 지갑·건강기록 후보 — DRAFT / UNASSIGNED

관련 FR-006~009(건강기록 표시), FR-001~005(기존 공유 진입), FR-032~036(기존 Viewer 진입). 기존 인증·동의·API·DB·PACS 계약을 유지한다. 건강기록 콘텐츠는 지갑 밖에 배치하고, 최근 비영상 기록 3건 및 전체 기록 펼치기를 제공한다. 하단 지갑은 로그인의 블루 가죽·스티치·잠금 장식을 참고한 전용 RGBA 이미지를 만들고 실제 DOM 메뉴 카드와 앞 포켓 마스크를 겹쳤다. CSS 도형만으로 만든 지갑이 아니며, 회전 가능한 3D 메시나 로그인부터의 물리적 펼침 애니메이션은 구현하지 않았다. 웹/PWA 공통 화면에서 영상 공유·건강도우미 카드를 기존 경로로 연결한다.

신규 public/images/mediq-wallet-bifold-v1.webp(543124 bytes), public/ui/wallet-bifold.css, scripts/bifold-browser-check.js. 수정 public/ui/patient-health.js, public/app.js, public/mobile/app.js, public/ui/wallet-home.css, public/mobile/sw.js(v30), Dockerfile.wallet-ui 및 기존 배포·검증 스크립트. frontend-design의 소재 일관성과 이미지 생성 스킬을 적용했다. 내장 imagegen 프롬프트: “transparent isolated blue leather open bifold wallet, left and right leaves around vertical center fold, shallow V, pale stitching, empty low card pockets, stationary buttoned strap and silver snap at right margin, no text/cards/background.” 원본 exec-17511d8f-a412-406e-bd16-159d7b98a327.png를 보존하고 WebP 형식만 변환했다.

집중 25/25 PASS(exit0, 2044ms), 전체 1052/1052 PASS(exit0, 61073ms): artifacts/ui/bifold-{focused,full-tests}-20261012.log. 최초 집중 실행은 제거된 도움말 문구를 요구하는 기존 assertion에서 FAIL, 카드 title에 해당 안내를 유지한 뒤 재실행 PASS. 실제 서버를 사용하는 로컬 UI 후보에서 웹/PWA 기록 필터·AFP 상세·지갑 복귀 각10검사 및 새 카드 클릭·키보드 이동·3화면폭 각5검사 PASS. 최초 모바일 검증은 데스크톱 폭에서 기존 홈 카드가 다른 카드에 가려 timeout; 모바일 폭을 먼저 설정한 재실행 PASS. 로컬 후보 캡처 output/playwright/bifold-{web,mobile}-20261012.png. CT 미리보기 픽셀은 표시되지 않아 NOT VERIFIED이며 이 작업에서 해결하지 않았다.

최종 B 배포 이미지 sha256:ce54e67819982e888a9788d7df1076a01e5d1e0d78c8be1aac595aa3faa7ec92, Trivy HIGH0/CRITICAL0 PASS. 배포·rollback PASS(exit0): artifacts/workstation/wallet-ui-20261012T025720Z/result.json. baseline 7fd5b974…에서 서버·재사용 모듈 바이트 보존 확인. strict TLS 제공 파일14/14 일치 PASS: artifacts/ui/bifold-served-assets-20261012.json. 실제 배포 웹/PWA에서 로컬 overlay 제거 후 각각 ID/PW 로그인, 기록10검사·새 지갑5검사 PASS: artifacts/ui/bifold-{web,mobile}-live{,-records}.log. 최종 실제 캡처 output/playwright/bifold-{web,mobile}-20261012.png. 화면폭은 웹1440/1024/768, PWA390/360/320이며 실기기 검증은 NOT VERIFIED. 기존 CT rendered/Instance503 및 PHR403은 미해결이고 미리보기 픽셀 표시 실패를 숨기지 않는다. 커밋·푸시 없음, 번역 중지 유지. 전체 MVP/v3 완료 판정이 아니다.

재현: 로그인 후 `npx --no-install @playwright/cli -s=hipass-ct-check run-code --filename scripts/records-sheet-browser-check.js` 및 `scripts/bifold-browser-check.js`; 공개 파일은 `python scripts/wallet-ui-live-attest.py`. 복구 기준선과 compose 경로는 위 receipt에 보존되어 있으며 baseline 복귀 후 후보 재적용까지 실제 검증했다. 다음 작업 한 개는 기존 CT 미리보기503의 원인 확인이다.

## 2026-10-12 열린 지갑 전용 가죽 소재 후보 — DRAFT / UNASSIGNED

관련 FR-001~005, FR-006~009, FR-014~020: 동의·검사·접근정책 흐름 보존, 서버/API/DB/PACS 변경 없음. 기존 닫힌 지갑 사진을 확대 재사용하지 않고 하드웨어 없는 가죽 소재를 public/images/mediq-wallet-leather-v1.webp(523962 bytes)로 새로 저장했다. 안쪽 면과 앞 포켓은 별도 CSS 레이어로 동일한 소재를 사용한다. 중앙 골의 입체감은 정적 CSS이며 물리적인 3D 모프가 아니다. 건강도우미 열기는 별도 버튼으로 분리했다. 로그인·홈의 기존 지갑 이미지는 보존한다.

내장 imagegen 사용. 프롬프트: "seamless blue leather material texture for an opened medical wallet web interface; uniformly lit macro surface of refined royal navy blue pebbled leather, subtle small natural grain, restrained contrast, color close to #285b96; flat surface; no objects, edges, seams, stitches, button, strap, logo, text or wallet silhouette." 원본은 Codex generated_images의 exec-bf3463ca-2341-4f2a-aa8a-5b82249c050b.png에 보존하고 WebP 형식만 변환했다. CSS public/ui/wallet-open.css를 wallet-home.css에서 import한다. SW v29는 공개 자산만 추가한다. Dockerfile.wallet-ui, rollout/attest 목록에 신규 자산을 포함했다.

전체 테스트 1052/1052 PASS(exit 0, 64059.0329ms): artifacts/ui/leather-wallet-full-tests-20261012.log. Trivy HIGH 0 / CRITICAL 0 PASS. 실제 서버 연결 로컬 UI 후보: 웹 공유 초안→명시적 검토 및 1440/1024/768px PASS, 모바일 전원 검토 및 390/360/320px PASS, 두 화면의 건강기록 상단 가죽 소재·타임라인 분리 PASS. 스크린샷 output/playwright/records-wallet-{web,mobile}-20261012.png 및 sharing-wallet-{web,mobile}-20261012.png. 브라우저 검증은 신규 동의·QR·CT 픽셀을 시험하지 않았다. CT 미리보기 대기 상태 및 기존 503/403은 해결하지 않았고 종단 영상 열람은 NOT VERIFIED. 번역 중지 유지. 커밋·푸시 없음.

2026-10-12 10:43 KST 배포 및 rollback PASS: artifacts/workstation/wallet-ui-20261012T013814Z/result.json. B 이미지 sha256:7fd5b97463644b6c562fc863256786b2b1109c6646d43d70ada173a5ad55dbdb; 이전 baseline a19222d09be6a2863f8691b751ebcbcd6e031d977021f4df8f509f76550d63eb. 서버·재사용 모듈 바이트 동일성 PASS, strict TLS 공개 UI 파일 12/12 PASS(artifacts/ui/wallet-home-20261011/served-assets.json). 로컬 오버레이 제거 후 실제 배포본 웹·모바일 ID/PW 로그인→공유 검토→건강기록을 같은 브라우저 검사로 재확인 PASS. 동작 줄이기에서 포켓 padding 116px > 높이 92px 및 pointer-events:none 확인 PASS. 신규 승인·QR·CT 픽셀은 미검증. 복구는 receipt의 baseline과 기존 rollout 절차 사용. 다음 작업은 기존 미리보기 대기/Instance 503의 읽기 전용 원인 확인이며 전체 MVP/v3 완료를 선언하지 않는다.

## 2026-10-12 10:23 KST 열린 지갑의 내부·접힘선·포켓 반영 — DRAFT / UNASSIGNED

기존 하단 가죽 띠를 대신하여 공유 설정·요약 카드 주위의 안쪽 가죽 면, 중앙 접힘선, 카드 하단 앞 포켓을 CSS 레이어로 구현했다. 기존 로그인 지갑 WebP를 재사용하며 이미지 생성이나 3D 모프는 추가하지 않았다. 이미 공유한 영상은 지갑 밖으로 분리했다. 건강기록은 상단 최근 검사·도우미 카드만 지갑 안에 넣고 연도별 목록은 밖에 유지한다. 모바일은 한 장의 확인 카드와 포켓을 사용한다. 시안의 완전한 물리적 3D 재현은 아니며 정적 깊이감 구현이다.

관련 FR-001~005, FR-006~009, FR-014~020: 기존 동의 검토·검사 조회·서버 정책 유지. 변경 파일은 public/index.html, public/ui/wallet-home.css, public/mobile/sw.js(v28), scripts/sharing-wallet-browser-check.js 및 이 현재 상태 기록. 서버/API/DB/PACS/합성 CT는 변경하지 않았다. 포켓은 pointer-events:none이며 카드 아래 별도 여백에 배치한다. 인증·DPoP·명시적 승인·감사 로직 바이트 동일성 확인 PASS.

검증: focused 45/45 PASS(exit 0, 699.729ms), 전체 1051/1051 PASS(exit 0, 66631.3444ms; artifacts/ui/open-wallet-full-tests-20261012.log). Trivy HIGH 0 / CRITICAL 0. B 배포 및 baseline→candidate 복구 재현 PASS: artifacts/workstation/wallet-ui-20261012T011824Z/result.json. 이미지 sha256:a19222d09be6a2863f8691b751ebcbcd6e031d977021f4df8f509f76550d63eb; 이전 cfd359964b310d54e3448306451fbcaf1da749fb9891b14e251b36deea2f7ac8. strict TLS 공개 UI 소스 해시 10/10 PASS.

실제 브라우저: 모바일 배포본 ID/PW 로그인→공유 확인(전원)→건강기록 PASS, 390/360/320px 가로 넘침 없음. 웹 배포본도 로컬 오버레이를 제거한 뒤 ID/PW 로그인→초안 요약·잘못된 기간 차단·승인 확인란 미선택→건강기록 및 1440/1024/768px PASS. 신규 동의 생성·QR 발급·CT 픽셀은 이번 검증에서 실행하지 않았다. 기존 Instance 503 / PHR 403은 해결하지 않았으며 전체 종단 흐름은 NOT VERIFIED. 스크린샷 output/playwright/sharing-wallet-{web,mobile}-20261012.png, records-wallet-{web,mobile}-20261012.png. 번역은 계속 사용자 요청으로 중지 상태. 커밋·푸시 없음.

복구는 위 receipt의 baseline 이미지와 기존 scripts/wallet-ui-rollout.py 절차를 사용한다. 다음 작업 한 개: 실제 A Gateway→B Instance 503의 원인을 읽기 전용으로 점검. 전체 MVP/v3 완료 승격 없음.

## 2026-10-12 영상공유 · 펼쳐진 지갑 공통 디자인 — DRAFT / UNASSIGNED

관련 요구사항: FR-001~005(동의 초안·검토), FR-006~009(기존 검사 선택), FR-014~020(기존 서버 정책 보존). 새 정책·DB·PACS 변경 없음. 영상공유는 왼쪽 설정과 오른쪽 실시간 요약을 가진 종이 카드, 내 건강기록은 같은 블루 가죽 받침을 사용한다. '의견 상담' 대신 기존 서버 enum TRANSFER의 '전원'을 사용한다. 웹은 기존 전원·진료·협진 계약을 유지하며 모바일은 진료·전원 선택을 명시적 확인 이후 실제 동의 요청에 전달한다. 모바일 권한은 기존 VIEW_ONLY 유지. 정밀 3D 지갑 펼침 모프는 구현하지 않았고 기존 진입 효과와 정적 가죽 깊이감으로 연결한다.

변경: public/index.html, public/ui/patient-sharing.js, public/ui/wallet-home.css, public/mobile/index.html·app.js·sw.js(v27), Dockerfile.wallet-ui, 배포/해시 검증 스크립트 및 관련 테스트. 인증·DPoP·동의 승인·감사 서버 바이트는 배포 전 동일성을 확인한다. 초안 선택은 동의를 생성하지 않으며 최종 승인 확인란은 자동 체크하지 않는다.

검증: focused 32/32 PASS, 마지막 focused 37/37 PASS(exit 0, 490.5744ms). 전체 첫 실행 1050/1051 PASS, 1 FAIL(exit 1, 64868.8315ms): 기존 모바일 기간 테스트 픽스처에 새 필수 목적 선택이 없음. 픽스처에 TRANSFER를 명시하고 요청 값 assertion을 추가했다. 전체 재실행 1051/1051 PASS(exit 0, 61080.3538ms). 원래 실패는 artifacts/ui/sharing-wallet-full-tests-20261012.log, 재실행은 sharing-wallet-full-tests-rerun-20261012.log에 보존한다. 구문 검사·git diff --check PASS(기존 CRLF 경고 있음).

1차 후보 4bba8511… 배포·rollback PASS: artifacts/workstation/wallet-ui-20261012T003721Z/result.json. 실제 signed 로그인 브라우저에서 웹 5·모바일 5 UI 검사 PASS: 목적/권한 요약, 빈 종료 시각 차단, 확인 화면으로 전원 전달, 자동 승인 없음, 웹 1440/1024/768·모바일 390/360/320 가로 overflow 없음, 건강기록 가죽 표면. scripts/sharing-wallet-browser-check.js 및 output/playwright/sharing-wallet-{web,mobile}-20261012.png. 신규 동의 생성·QR·픽셀 종단은 NOT VERIFIED. 기존 CT Instance 503 및 PHR 오류는 해결하지 않았다.

시각 검토에서 건강기록 마지막 행과 가죽이 겹쳐 하단 여백을 보정했다. 최종 후보 sha256:cfd359964b310d54e3448306451fbcaf1da749fb9891b14e251b36deea2f7ac8: Trivy HIGH 0/CRITICAL 0 PASS. 최종 배포·rollback PASS(exit 0): artifacts/workstation/wallet-ui-20261012T004729Z/result.json. 제공 파일 10/10 해시 PASS(exit 0): artifacts/ui/sharing-wallet-final-served-assets-20261012.json. 최종 signed 로그인 브라우저 웹 5·모바일 5 UI 검사 PASS 및 마지막 기록/가죽 비겹침 assertion PASS: artifacts/ui/sharing-wallet-browser-{web,mobile}-final-20261012.log. 최종 이미지는 output/playwright/sharing-wallet-{web,mobile}-20261012.png 및 records-wallet-{web,mobile}-20261012.png. scan 보존파일 artifacts/security/container-scan/sharing-wallet-final-spacing-20261012.json. 최초 rollout 도중의 파일 불일치 관측은 interim-rollback-assets 증적으로 별도 보존했으며 최종 상태로 승계하지 않는다. 검토 전 증적 DRAFT / UNASSIGNED, commit/push 없음. 번역 작업 PAUSED_BY_USER 유지.

재현 명령: `node --test --test-concurrency=4`, `node --test test/patient-sharing.test.js test/patient-health.test.js test/wallet-home.test.js test/mobile-capstone-auth.test.js`, `python scripts/wallet-ui-live-attest.py`, `npx --no-install @playwright/cli -s=hipass-ct-check run-code --filename scripts/sharing-wallet-browser-check.js`(signed 로그인 후). 배포는 wallet-ui-rollout.py의 관측 baseline 일치·해시·TLS·scan 확인 및 baseline 복귀/후보 재적용 검증을 사용한다. 복구도 저장된 baseline receipt와 이미지 확인 후 기존 배포 절차를 사용하며 인증·정책을 완화하지 않는다.

다음 한 작업: 기존 A Gateway→B 환자 Instance 503의 읽기 전용 원인 분석. 전체 MVP/v3 완료로 승격하지 않는다.

## 2026-10-12 09:19 KST 건강기록 카드·타임라인 배포 — DRAFT / UNASSIGNED

현재 환자 UI 기준은 이 절이다. 홍길동 고정 합성 시나리오의 기존 서버 기록9건(CT1/AFP3/초음파3/검진2)을 사용하며 시안의 임의 수치·날짜를 복사하지 않았다. 공통 건강기록 화면을 작은 가죽 탭·블루 종이 표면·최근 영상 카드·검사별 필터·2026/2025 타임라인으로 구성했다. 기록 선택 때 기존 상세·23항목 해석·국내 출처를 펼치고 ‘목록으로 돌아가기’ 및 ‘내 지갑으로’를 연결했다. 기존 카드 추출/진입 효과를 유지하되 정밀 shared-element 모프나 접히는 역전환은 구현하지 않았다. 비교 버튼은 기존 건강도우미로 이동하며 별도 두 기록 선택 팝업은 만들지 않았다. 모바일에서는 기존 helper 선택 UI를 사용한다. CT 픽셀을 AI에 전달하지 않는다.

관련 FR-001~005(기존 공유 진입), FR-006~009(목록·메타데이터 표시), FR-032~036(기존 Viewer 진입)의 표시 부분. 기존 Node ESM/DOM/CSS 구조 유지, frontend-design 스킬의 재질 연속성·읽기 위계·반응형 지침 적용. 수정: `public/ui/patient-health.js`, `public/ui/wallet-home.css`, `public/app.js`, `public/mobile/app.js`, `public/mobile/sw.js`(v26), `test/patient-health.test.js`, `Dockerfile.wallet-ui`, 배포/해시 확인/로컬 overlay 스크립트. 신규 검증: `scripts/records-sheet-browser-check.js`. 시안은 [원본 시안](../design/mediq-records-sheet-20261012.png). API·서버·DB·인가·감사·PACS·원본 영상 변경 없음. 사용자 입력 textContent와 기존 서명된 pixel session을 유지하며 임의 CT 이미지 fallback 없음.

집중23/23 PASS(exit0,0.320초). 전체 `node --test --test-concurrency=4` 최초1049/1050 FAIL(exit1,110.037초): `privacy-isolated-http.test.js`의 normal-masking/bad-json/model-unavailable 결과 실패. 해당 테스트 단독2/2 PASS(exit0,7.433초), 전체 재실행1050/1050 PASS(exit0,62.626초). 최초 실패 원인은 미확정이며 재실행 성공으로 삭제하지 않는다. Syntax/diff 검사 exit0. 최종 build exit0, [Trivy](../../artifacts/security/container-scan/records-sheet-20261012-final.json) HIGH0/CRITICAL0.

기준 이미지71c67592… → 최종 `sha256:d22ffa786091091206b632551efbb996c04498119683c15cdea421bb1a7b19f6`. [실제 B 배포·복구 receipt](../../artifacts/workstation/wallet-ui-20261012T001304Z/result.json) PASS(exit0), [strict TLS 9자산 일치](../../artifacts/ui/wallet-home-20261011/records-sheet-served-assets-20261012.json) PASS. 보호 서버·기존 라이브러리·기존 helper 바이트 일치 확인. 실제 웹 및 모바일 정상 계정 로그인 후, route overlay 제거한 배포본에서 진입/4필터/AFP24.6 상세/3폭/동작 줄이기 지갑 복귀 각각10검사 PASS, 합계20검사. 모바일 실제 캐시 v26 확인. [웹 캡처](../../output/playwright/records-sheet-web-20261012.png), [모바일 캡처](../../output/playwright/records-sheet-mobile-20261012.png). 초기 모바일 로컬 overlay의 HTML marker 누락은 실제 B HTML 보존으로 고친 뒤 정상 서명 로그인해 로컬 후보만 따로 확인했다. 이후 실제 배포 검증에는 overlay/API mock 없음.

남은 실패: 실제 `/patient-dicomweb/.../instances`가503을 반환해 CT 미리보기 픽셀 표시 FAIL/Viewer 종단 NOT VERIFIED. black placeholder를 합성 CT 표시 성공으로 보지 않으며 최종 화면은 미리보기 실패 안내를 표시한다. 기존 PHR403/favicon503도 미해결. 시안과 픽셀 동일·의학적 해석·병원 전송 E2E·전체 MVP/v3 완료를 주장하지 않는다. 다음 작업 한 개는 실제 A Gateway→B 본인 Viewer Instance 조회503 원인 확인이다. 복구는 receipt의 rollbackFiles와 base 이미지로 기존 compose 이미지 전환 경로를 사용하며 이미 실제 복구/재승격을 수행했다. 커밋·푸시 없음. 번역 작업 PAUSED_BY_USER 유지.

## 2026-10-12 08:06 KST 지갑 홈 타이포그래피·정적 카드 배치 — DRAFT / UNASSIGNED

현재 지갑 UI 상태는 이 절을 우선한다. 제목을 인증 컨텍스트 이름 + ‘다음 진료를 준비해요.’로 변경하고 Pretendard를 유지했다. 웹 제목32–40px/검사명16px/보조14px, 모바일 제목30px/검사명15px/보조13px, 텍스트 버튼44px 터치 높이를 적용했다. 요약 패널 대비·여백을 조정했다. 기존 premium CSS의 reduced-motion `transform:none!important`와 충돌하던 카드 정적 기울기를 공통 CSS에서 보존하며 이동 transition만 생략한다. OS 설정은 변경하지 않았다. PWA 정적 캐시는 v25이며 API 캐싱 정책은 변경하지 않았다.

관련 FR-001~005·FR-006~009의 표시·진입에만 영향. API/DB/인가/동의/감사/PACS 계약과 서버 바이트 변경 없음. redesign-existing-projects 스킬의 위계·여백·기존 스택 보존 지침 적용. 변경 파일은 `public/ui/wallet-home.js`, `public/ui/wallet-home.css`, `public/mobile/sw.js`, `test/wallet-home.test.js`; 검증 스크립트 `scripts/wallet-type-review.js` 추가.

집중 테스트9/9 PASS(exit0,0.207초), JS syntax 및 diff check exit0. 이미지 build 최초 digest를 FROM 태그로 해석해 실패했으며, 기존 로컬 기준 이미지에 별도 baseline 태그를 부여해 재실행 exit0. 최종 후보 `sha256:71c675924398bff26be3269853c58cf9d66ce6a5a7489db366e18dc09f23fb1e`, Trivy HIGH0/CRITICAL0. [배포·복구 receipt](../../artifacts/workstation/wallet-ui-20261011T225942Z/result.json) PASS(exit0), strict TLS 실제 배포8자산 일치 PASS. 기존 receipt 경로의 날짜는 스크립트 명명 관례이며 관측은 10월12일 KST다.

실제 브라우저 웹 정상 로그인 후 검증, 모바일 기존 인증 세션 복원 후 검증. 모바일 자동 로그인 재시도는 이미 홈으로 복원돼 stale ref/입력 timeout을 기록했으며 신규 모바일 로그인 PASS로 계산하지 않는다. 카드4개 이동·동작 줄이기·이미지·3폭 검증 각각9/9, 합계18/18 PASS. 추가 정적 카드 transform/transition/가로 넘침/제목 검사는 웹1440/1024/768 및 모바일390/360/320 × reduce/no-preference, 총12조합 PASS. [실제 웹 캡처](../../output/playwright/wallet-type-web-20261012.png), [실제 모바일 캡처](../../output/playwright/wallet-type-mobile-20261012.png). 두 화면은 시안이 아닌 배포본이다.

기존 PHR summary/imaging API403, favicon503 관찰은 미해결로 유지. 실제 모바일 신규 로그인·실기기·CT 전송·전체 보안 회귀는 이번 NOT VERIFIED. 부분 UI 검증을 전체 MVP/v3 완료로 승격하지 않는다. 커밋·푸시 없음. 다음 작업 한 개: 사용자 실기기에서 상단 글자와 카드 진입 확인. MedlinePlus 번역은 사용자 요청으로 PAUSED_BY_USER이며 이 작업에서 재개하지 않았다. 아래 RUNNING 번역 기록 및 이전 지갑 기록은 과거 관측이다.

## 2026-10-12 전체 MedlinePlus 번역·로컬 연결 — DRAFT / UNASSIGNED

현재 RAG 작업의 권위 기록은 [전체 번역 진행 기록](health-helper-rag-2026-10-11.md#전체-영어-자료-한국어-번역로컬-연결--2026-10-12)이다. 입력 1,017문서 hash 확인 PASS, 추가 1,007개 번역 RUNNING. 00:16:17 KST 관측: 초안22, 저장 자동HOLD4, 현재 검사 통과 로컬 후보18문서/56조각, 임상승인0. 최신 집중61/61 PASS(exit0,1.300초). 실제 localhost 질문→Qwen→출처 drawer→질문 담기 연결은 확인했지만 신장검사 번역 excerpt와 모델 답변에 품질 이슈가 보여 의학적 답변 PASS로 인정하지 않는다. localhost 후보만 연결했고 실제 B/Cloud 배포·인증 API 연결은 NOT VERIFIED다. 기존 실행 이미지·dirty 변경 보존, commit/push 없음. 다음 작업 한 개는 배치 완료 후 원문 대조·내용 검토 및 HOLD 정리다. 아래 10월11일 기록은 이력이며 전체 제품 완료를 승격하지 않는다.

## 2026-10-11 MedlinePlus 설명형 RAG 착수 — DRAFT / UNASSIGNED

최신 추가 작업은 [MedlinePlus 로컬 후보 기록](health-helper-rag-2026-10-11.md#medlineplus-설명형-rag-로컬-후보--2026-10-11)이다. 8개 주제·34개 조각 hash/문단 검증, 실제 로컬 Qwen 빈혈 설명·출처 원문·질문 담기/수정·모바일 후속 대화를 확인했다. focused65/65, importer/HTTP20/20 PASS. 전체 회귀 최초1043/1044 FAIL 후 전체 재실행 exit0; 최초 실패 원인 미확정. 실제 서비스의 인증·감사 연결/배포와 의학적 설명 검토는 NOT VERIFIED. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + 기존 dirty 보존. B 실행 이미지는 아래 지갑 작업의 마지막 관측이며 이번에는 변경하지 않았다. 다음 작업은 빈혈 후보 내용 검토를 확정한 뒤 기존 인증·감사 API 연결 한 개다. 전체 MVP/v3 완료를 승격하지 않는다.

## 2026-10-11 카드 삽입감 개선 — DRAFT / UNASSIGNED

**최종 관측 22:48 KST: 지정 UI 변경 배포·검증 PASS.** 이 절을 현재 지갑 UI 상태로 삼고 아래 이전 관측은 이력으로 유지한다. [배포·복구 receipt](../../artifacts/workstation/wallet-ui-20261011T134229Z/result.json) PASS, exit0. 후보63171340…가 최종 실행 이미지. strict TLS [8파일 일치](../../artifacts/ui/wallet-home-20261011/served-assets.json) PASS(exit0, 1.49초). 실제 일반 로그인한 웹/PWA에서 이미지·4카드·동작 줄이기·3화면폭 각각9/9, 합계18/18 PASS; route override/API mock 없는 실제 배포 세션이다. 새 PWA 캐시는 `hipass-mediq-shell-v24` 하나만 관측, 이미지 naturalWidth1905. [실제 웹](../../output/playwright/wallet-depth-web.png), [실제 모바일](../../output/playwright/wallet-depth-mobile.png). 재현은 기존 browser-check.js/capture 스크립트와 실제 로그인. 복구 구성은 receipt의 rollbackFiles에 보존하며 실제 복구 후 재승격했다. 다음 작업은 사용자 실기기 디자인 확인 한 개. 전체 제품/의료영상 E2E 완료 판정은 아님.

이번 사용자 승인 시안은 [카드 삽입감 시안](../design/mediq-wallet-card-depth-20261011.png). 기존 사진 지갑을 유지하고 `public/ui/wallet-home.css`에서 카드 높이/각도/앞 카드 가로 구성/얇은 테두리/접촉 그림자/모바일 요약을 조정했다. `public/mobile/sw.js`는 v24. 관련 FR-001~005, FR-006~009의 표시와 진입만 영향. API/인증/인가/동의/DB/PACS 변경 없음. frontend-design 스킬의 재질 대비·위계·여백 지침을 적용했다.

HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + 기존 dirty 보존. 집중 테스트13/13 PASS(exit0, 0.331초). 로컬 후보 UI overlay+실제 로그인에서 웹/PWA 각각9검사 PASS이며 실제 배포 검증과 구분한다. 모바일 지갑 bottom803.75px(이전948.14), 문서 가로 넘침 없음. 생성 시안과 픽셀 동일성을 주장하지 않는다.

후보 `sha256:631713402bf7bbf3c0923dc559f5e57c95eacc8e8a0ebc43ab93dc79bcc92411`, Trivy HIGH0/CRITICAL0. 배포 전 기준 `sha256:bdc59853f6037e306400271673df22c10301892a01b263650318f1e5e914c59b`. 실제 배포 결과는 후속 관측으로 남긴다. 전체 회귀/병원 간 E2E는 이번에 재실행하지 않음. 기존 PHR403 및 과거 회귀2FAIL은 유지한다. commit/push 없음.

## 2026-10-11 지갑 시안 이미지 기반 구현 — DRAFT / UNASSIGNED

### 최종 관측 22:26 KST — UI 범위 PASS

이 절이 이번 지갑 UI의 현재 상태이며 아래 후보/과거 절은 이력이다. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty. 최종 B 이미지 `sha256:bdc59853f6037e306400271673df22c10301892a01b263650318f1e5e914c59b`.

- B 재배포·rollback·재승격 PASS(exit0, 약2분): [receipt](../../artifacts/workstation/wallet-ui-20261011T131958Z/result.json). 서버/재사용 UI/보호 컨테이너 변경 없음. A·Cloud·PACS·DB 변경 없음.
- `python scripts/wallet-ui-live-attest.py` exit0, 약1.36초, 실제 HTTPS 8파일 원본 바이트 일치 PASS: [증적](../../artifacts/ui/wallet-home-20261011/served-assets.json).
- 실제 서비스 일반 ID/PW 로그인 후 웹/PWA 각각 이미지 표시·4카드 이동·reduced-motion·3개 viewport 검사9/9, 합계18/18 PASS. 후보 route override 없는 `wallet-live`, `wallet-mobile-live` 사용. API/인가 모킹 없음, 동의 생성/철회 실행 없음.
- PWA 실제 캐시 `hipass-mediq-shell-v23` 단독 확인, 이미지 naturalWidth1905. 헤더 bottom130px < 인사말 top138px. 웹1440/1024/768, 모바일390/360/320에서 문서 가로 넘침 없음.
- 실제 화면: [웹](../../output/playwright/wallet-depth-web.png), [모바일](../../output/playwright/wallet-depth-mobile.png). 사진형 지갑+실제 DOM 카드이며 시안과 픽셀 단위 동일함을 보증하지 않는다. 모바일 카드는 가로 넘김 방식이다.
- 집중 테스트13/13 PASS, syntax/py_compile PASS, 최종 이미지 HIGH0/CRITICAL0. 전체 회귀는 재실행하지 않음(NOT VERIFIED); 기존2FAIL 및 PHR403/favicon503을 해결했다고 주장하지 않는다. 이번 결과는 실제 의료영상 전송/전체 MVP 완료가 아니다.
- 다음 작업 한 개: 사용자가 실제 기기에서 지갑 비율·스크롤·카드 전환을 확인하여 디자인 확정. commit/push 없음. 모든 신규 증적 DRAFT / UNASSIGNED.

재현/복구는 기존 rollout 명령과 receipt의 compose 경로를 사용한다. 재배포 시 `--expected-base`를 새로 관측한 실행 이미지로 지정한다. 카드 이동 확인은 `scripts/wallet-ui-browser-check.js`, 캡처는 `scripts/wallet-depth-capture.js`; 두 스크립트는 실제 로그인 후 실행한다. 최종 집중 테스트 명령: `node --test test/wallet-home.test.js test/mobile-wallet-design.test.js test/faq-assistant.test.js test/patient-context-display.test.js` (exit0, 1.336초).

후속 검증에서 첫 PNG 배포는 이미지 URL 404로 **실제 자산 검증 FAIL**이었다. 원인은 기존 B 정적 파일 2MiB 제한이며 배포/복구 PASS와 구분한다. 서버 제한을 수정하지 않고 원본 PNG를 보존한 채 lossless WebP(1,847,088bytes)로 변환했다. RGBA 픽셀 전체 동일성을 확인했으며 PWA v23과 WebP 경로로 수정했다. rollout에 정적 파일 크기 사전검사, 테스트에 파일 크기/서명/셸 포함 검사를 추가했다. 수정 후 집중 테스트13/13 PASS(exit0, 1.336초). 최종 후보 `sha256:bdc59853f6037e306400271673df22c10301892a01b263650318f1e5e914c59b`, Trivy HIGH0/CRITICAL0. 아래 PNG 후보 기록은 중간 이력이다.

승인 시안 [원본](../design/mediq-wallet-approved-20261011.png)을 기준으로 UI를 재구성했다. 디자인의 외형을 재현하는 작업이며 전체 제품 완료 판정은 아니다. 관련 FR-001~005 및 FR-006~009의 표시/진입만 영향, backend 인가 변경 없음.

생성 자산: `public/images/mediq-wallet-front-v1.png` (1905×826 RGBA, alpha0~255, 2,908,094bytes). 내장 image_gen 편집으로 승인 시안의 큰 지갑을 투명 자산으로 추출했다. 생성 프롬프트 요지: “Extract the exact large blue leather wallet body from the desktop left panel; preserve blue grain, stitched seams, side gusset, central strap/silver snap and Medi Q emboss; remove all cards/UI/background; transparent silhouette with empty opening for HTML cards; no redesign.” 원본 생성물은 보존했다. 사진 자산은 장식용이며 임상 영상/개인정보를 포함하지 않는다.

수정: `wallet-home.js/css`는 상단 인사말·두 요약의 가로 배치, CSS 지갑 대신 이미지 전경, 실제 카드 버튼·확인하기·추출 이동 효과. PWA v22에 정적 자산 추가. Dockerfile와 UI byte attestation/rollout allowlist에 PNG 한 개를 추가했고 attestation 최대 읽기만 4MiB로 설정했다. 기존 서버·재사용 UI 바이트 일치 검사는 유지했다.

로컬 후보 검증: 웹4카드/동작 줄이기/1440·1024·768 PASS, 모바일4카드/동작 줄이기/390·360·320 PASS. 최초 모바일 후보 화면은 기존 service worker가 이전 UI를 제공하여 새 디자인 증거에서 제외했다. 후보 전용 브라우저에서 worker를 해제하고 재실행한 결과를 사용한다. 실제 배포 세션에서는 mock/route override 없이 새 PWA v22 및 이미지 로드를 확인한다.

집중 테스트12/12 PASS(0.488초), syntax/py_compile PASS. 후보 `sha256:831cb053c9f5eafe5e433827917874db87e8086dcae519b280a498aa5dd91b0f`, Trivy HIGH0/CRITICAL0. 배포 기준 `sha256:88e9e574b5d974e6865fb2c958b80653939117dbda70db675ea4350999b2b390`. 배포 후 결과는 후속 관측에 기록한다. 과거 전체 회귀2FAIL/PHR403은 해소된 것으로 승계하지 않는다. commit/push 없음.

## 2026-10-11 지갑 디자인 재조정 — DRAFT / UNASSIGNED

이번 변경은 환자 홈의 표현과 이동 효과에 한정한다. 관련 FR-001~005(공유 상태 표시), FR-006~009(건강기록 진입)이며 인증·동의 정책·영상 데이터 계약은 변경하지 않았다. 기존 dirty 변경은 보존했다.

- 설치 스킬 목록 확인 결과 frontend-design, ui-ux-pro-max, playwright가 이미 설치되어 추가 설치 없이 사용. frontend-design의 재질·위계·과도한 장식 절제 지침을 반영했다.
- `public/ui/wallet-home.css`: 로그인 가죽 이미지 재사용, 지갑 깊이·입구·중앙 버클, 카드 각도·높이, 압축한 요약, 모바일 헤더 정상 흐름, 작은 화면 가로 카드 탐색.
- `public/ui/wallet-home.js`: 의미 없는 번호 대신 정적 SVG 아이콘, 요청 API 미연결 상태에 맞춘 ‘공유 내용 확인’ 이름, 360ms 추출 전환(동작 줄이기 시 즉시 이동).
- `public/mobile/sw.js`: 정적 셸 v21. 인증·API·영상 캐시 범위 확대 없음.
- `scripts/wallet-depth-capture.js`: 실제 화면의 헤더/인사말 위치와 이미지 기록.

집중 테스트 12/12 PASS(0.210초, exit0), JS syntax PASS. 로컬 후보 UI + 실제 서버 로그인에서 웹4카드/PWA4카드 이동·reduced-motion·웹1440/1024/768 및 모바일390/360/320 문서 넘침 검사 PASS. 해당 후보 검증은 실제 배포 검증과 구분한다.

최종 실행 이미지 `sha256:88e9e574b5d974e6865fb2c958b80653939117dbda70db675ea4350999b2b390`; Trivy HIGH0/CRITICAL0. 배포 직전 기준 `sha256:1c259ced73d3717e5986e7a5773069b7d82dffe012ee23f120eea8fab1157df5`.

21:52 KST 실제 B 배포·복구 PASS(exit0): [receipt](../../artifacts/workstation/wallet-ui-20261011T124751Z/result.json). 기존 서버·재사용 UI 바이트 및 runtime 구성을 검증하여 보존했다. strict TLS 실제 UI 7파일 일치 PASS: [served assets](../../artifacts/ui/wallet-home-20261011/served-assets.json).

실제 배포본으로 새로고침하고 ID/PW 로그인한 `wallet-live`, `wallet-mobile-live` 세션에서 각각 네 카드 진입/홈 복귀·reduced-motion·3개 화면폭 검사 8/8 PASS, 합계16/16. 최종 화면은 [웹](../../output/playwright/wallet-depth-web.png), [모바일](../../output/playwright/wallet-depth-mobile.png). 모바일 헤더 bottom130px < 인사말 top142px로 겹침 없음. 카드 설명의 가림도 최종 캡처에서 조정했다. PHR summary/imaging-studies 403 및 favicon503은 기존 제한으로 남아 있으며 이번 UI PASS는 해당 API 성공을 뜻하지 않는다.

재현: 기존 `Dockerfile.wallet-ui`로 위 기준 이미지를 지정하여 빌드 → `HIPASS_CONTAINER_SCAN_IMAGE`, `HIPASS_TRIVY_RESULT`를 지정해 `node scripts/container-scan.js` → `python scripts/wallet-ui-rollout.py --apply --expected-base <새로 관측한 실행 이미지>` → `python scripts/wallet-ui-live-attest.py` → 실제 로그인 후 browser-check/capture. 이번 배포는 원본 이미지 복구 후 재승격을 실제 수행했고 복구 구성은 receipt와 baseline.json에 보존한다. 과거 기준선을 그대로 재사용하지 않는다. 최종 실행시간은 CLI 로그 참조; 배포 구간 약2분, 브라우저 확인 약2분.

전체 회귀의 이전 2개 실패는 이번 디자인 변경으로 해결했다고 주장하지 않는다. 이번 작업에서는 전체 회귀를 재실행하지 않았으며 병원 간 전송·전체 MVP 완료도 판정하지 않는다. 실제 받은 요청 연결은 여전히 미구현이다. commit/push 없음.

## 2026-10-11 21:27 KST 지갑 홈 웹·PWA 적용 — scoped PASS / DRAFT / UNASSIGNED

현재 UI 배포 상태의 권위 절. 아래 과거 현재/최신 표현은 당시 이력이다. RAG 자료 이용허락 미확정 상태는 아래 18:51 절과 동일하며 이번 작업으로 해소하지 않았다.
HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + 기존 dirty 변경 보존. commit/push 없음.

### 작업 목적·관련 요구사항

로그인의 코발트 가죽 지갑을 홈으로 이어서, 위에는 최근 건강기록·공유 현황, 아래에는 확인할 요청/내 건강기록/영상 공유/건강도우미 네 카드를 배치했다.
FR-001~009 환자 기록·동의 화면 연결, FR-032~036 기존 본인 Viewer 연결의 표현 계층에 한정. 새 정책·API·NFR 계약을 추가하지 않았다.

### 분석한 기존 구조·생성한 파일·수정한 파일

Node ESM + 기존 vanilla 웹/PWA, 기존 `patient-health.js`, 인증된 `health-record-client.js`, signed patient Viewer를 재사용했다. 새 프레임워크·권한 모델·임상 데이터를 도입하지 않았다.
생성: `public/ui/wallet-home.js`, `public/ui/wallet-home.css`, `Dockerfile.wallet-ui`, `test/wallet-home.test.js`, `scripts/wallet-ui-{browser-local,browser-check,viewer-check,capture}.js`, `scripts/wallet-ui-{rollout,live-attest}.py`.
수정: `public/app.js`, `public/index.html`, `public/mobile/{app.js,index.html,sw.js}`, 기존 메뉴/선택계정 fixture 테스트 3개. 변경 통계에는 기존 미커밋 변경이 섞이므로 전체 Git diff를 이번 작업량으로 주장하지 않는다.

### 구현한 기능·보안 검토

- 상단 메뉴 홈/내 건강기록/영상 공유/건강도우미. 최근 기록·동의 상태는 인증된 기존 서버 결과를 사용한다.
- 첫 카드는 확인할 요청이며, 받은 요청 API가 연결되지 않은 사실을 표시하고 현재 공유 내역으로 이동한다. 가상의 B병원 요청·열람·수신 완료를 만들지 않았다.
- 중앙 세로 스트랩·은색 버튼 하나. 로그인 사진의 가죽 질감만 확대 사용해 사진 속 잠금장치를 중복 표시하지 않는다.
- 카드 꺼내기/진입 효과, 키보드 초점 이동, reduced motion. 모바일은 큰 글자를 유지한 가로 넘김 카드 지갑이다.
- 모바일 건강기록은 웹과 동일 컴포넌트 및 인증된 서버 합성 기록으로 연결한다. 이전 임시 진료 목록을 새 화면에 표시하지 않는다.
- 토큰·동의·서버 권한·CT·Gateway·Control 코드는 변경하지 않았다. 텍스트는 DOM textContent로 출력하며 자격증명·기록을 브라우저 저장소에 추가하지 않는다.
- PWA shell v20: 정적 모듈만 allowlist에 추가. 인증 API·영상 픽셀·질문 응답 캐싱 금지 유지.

### 배포 환경·테스트 결과

B UI 최종 `sha256:1c259ced73d3717e5986e7a5773069b7d82dffe012ee23f120eea8fab1157df5`.
관측 기준선 `e184f8e4…` → 첫 지갑 후보 `196327e1…` → 모바일 가독성 보완 최종 후보. 각각 image-only 설정 비교·엄격한 TLS readiness·실제 rollback·재적용을 수행했다. A/Control/PACS/DB/volume 배포 및 데이터 변경 없음.
실제 제공 파일 7개와 capstone 인증 marker를 로컬 후보 바이트와 비교했다. 서버 및 재사용 모듈 바이트도 관측된 실행 컨테이너와 동일함을 확인했다.

| 검증 | 결과 | 범위·근거 |
|---|---|---|
| 최종 UI 관련 테스트 | PASS | 52/52, exit 0 |
| 전체 테스트 중간 실행 | PASS | 1038/1038, 약 59.4초; 아래 최신 결과로 승계하지 않음 |
| 최신 전체 재실행 | FAIL | 1036/1038. catalog audit receipt ID 계약·Privacy isolated HTTP 실패. 해당 코드 미변경; 원인 확정 및 해결 안 함 |
| image build·최종 Trivy | PASS | HIGH/CRITICAL 0. build의 필수 ARG 기본값 경고는 존재 |
| 배포·복구·재적용 | PASS | B UI-only, 설정/환경/마운트 불변 |
| 실제 제공 UI 해시 | PASS | 7/7, project CA 검증, 요청 timeout 10초 |
| 실제 웹·PWA 로그인/네 카드/홈 복귀 | PASS | API mock 없이 실제 브라우저 |
| 홈 반응형·동작 줄이기 | PASS | 웹 1440/1024/768, PWA 390/360/320, 가로 overflow 없음 |
| 기존 CT 본인 Viewer | PASS | 웹·PWA 각각 1/700 → 2/700, 실제 표시 픽셀 1254×1254; 전체 700장 재검증 아님 |
| 병원 간 전송·신규 받은 요청·실기기/카메라·전체 Gate | NOT VERIFIED | 이번 UI 작업에서 실행하지 않음 |

초기 전체 실행의 메뉴 fixture 실패는 이번 메뉴 계약에 맞춰 갱신했다. 최초 Viewer 검증 스크립트가 버튼명을 잘못 지정하여 timeout된 기록도 보존하며, 실제 관측명으로 고친 뒤 웹/PWA 모두 재실행했다.
추가 모바일 배포 시 로컬의 이전 image tag 교체로 byte 비교 명령이 실패하여 배포 전 중단했다. 관측 실행 컨테이너의 바이트와 직접 비교하도록 검증 도구를 고친 뒤 preflight·배포·rollback을 다시 수행했다.

### 증적·재현 및 복구·남은 위험/미검증

증적은 모두 DRAFT / UNASSIGNED이며 기존 사람 승인을 자동 승계하지 않는다.
- [최종 배포·복구 receipt](../../artifacts/workstation/wallet-ui-20261011T121851Z/result.json)
- [브라우저 범위·실패 이력](../../artifacts/ui/wallet-home-20261011/browser-result.json), [최종 전체 테스트](../../artifacts/ui/wallet-home-20261011/test-output-final-2.txt)
- [웹 화면](../../artifacts/ui/wallet-home-20261011/web.png), [PWA 화면](../../artifacts/ui/wallet-home-20261011/mobile.png), [제공 파일 해시](../../artifacts/ui/wallet-home-20261011/served-assets.json)
- [최종 이미지 검사](../../artifacts/security/container-scan/wallet-ui-20261011-final.json)

재현: 환자 웹 `/hipass/#PATIENT` 또는 PWA `/mobile/` → 기존 시연 ID/PW 로그인 → 네 카드 클릭 → 상단/하단 홈 복귀. CT는 내 건강기록 → CT / 영상 보기 → 다음 영상. 인증정보는 문서에 복제하지 않는다.
명령: `node --test --test-concurrency=4`, 관련 9개 테스트 파일 집중 실행, `python scripts/wallet-ui-live-attest.py`, 실제 브라우저에서 check/viewer/capture 스크립트. 새로운 배포는 새로 관측한 기준선·후보 해시·scan 일치가 필요하며 기존 receipt로 자동 재배포하지 않는다.
복구는 receipt의 `rollbackFiles`로 기존 Compose 파일 조합을 복원한다. 동일 환경변수·비밀 mount를 유지한 복구가 이번 작업에서 실제 검증됐고 rollback 결과는 PASS다.
브라우저에서 favicon 503 및 표준 PHR summary/imaging-studies 403을 관측했다. 이를 정책 완화로 제거하지 않았으며 PHR 실연계 성공을 주장하지 않는다. 모바일 네이티브/실기기 터치 시험도 미실행이다.
다음 작업 한 개: 최신 전체 재실행의 audit ID/Privacy 실패를 별도 재현·원인 분석하여 회귀 Gate 신뢰성을 회복한다. 전체 MVP/v3 완료 상태는 변경하지 않는다.

## 2026-10-11 18:51 KST 설명형 RAG 자료 선별 로컬 착수

현재 상태의 권위 절. 배포 환경은 아래 18:35 절의 이미지·데이터 기록을 유지하며 이번에 재검증하지 않았다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존.
질병관리청·서울아산병원·국가암정보센터·의왕시 자료를 이용조건과 설명 범위로 분류했다.
개별 AI유형 또는 서면 허가가 확인되지 않은 본문은 모델 입력에 사용하지 않는다.
기존 후보 9개 / 출처 3개 / 의학 설명 사용 가능 0개. 허가 요청 초안은 작성했으나 발송하지 않았다.
허가 증거 누락·형식 오류 시 검색 및 생성 출처 검증 fail-closed를 보강하고 로컬 출처 보고 명령을 추가했다.
집중 48/48 및 경계·웹/PWA 코드 회귀 42/42 PASS, secret findings 0, 구문·diff 검사 exit 0.
관련 FR-037~041 감사 공통 제약; RAG 고유 FR/NFR 미배정.
의료 설명 활성화·모델 학습·웹/PWA 배포·실제 브라우저/Qwen 의료 설명·전체 Gate는 미실행이다.
신규 증적 DRAFT / UNASSIGNED. commit/push 없음. 기존 CT/공유/동의 정책과 데이터 변경 없음.
검증 명령·출처·이용조건·허가 요청 초안: [RAG 구현 기록](health-helper-rag-2026-10-11.md)의 설명형 RAG 절.
다음 작업 한 개: AFP·간기능 자료에 대한 저장·검색·모델 입력·재서술 이용허락 범위 확보.

## 2026-10-11 18:35 KST 합성 건강기록 비교 웹·PWA 배포 — scoped PASS / DRAFT / UNASSIGNED

현재 상태의 권위 절. 아래 이전 현재/최신 표기는 당시 이력이다. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존.
Control sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436,
B UI sha256:e184f8e4c56ce5a5927081eede97ca2f86427ba4cdfb359756b749b45981d531.
데이터 hong-gildong-health-20261011-v1: 기존2026 검진·AFP 보존,2025 합성 검진23항목 추가.
인증된 PATIENT/HCC 등록 시나리오 전용 GET API→공통 비교 렌더러→주제 기반 Qwen 추천→질문 담기·수정.
웹 건강기록→비교 이동·같은 날짜 거부·문자 소견·메모 유지, PWA 같은 기록·잠금 시 제거 scoped PASS.
개인 수치·식별정보·CT·공식 원문 AI 입력 없음. 수치 비교만 연결되며 모델 recordContext=NOT_CONNECTED 유지.
41/41 집중 테스트, 최종 Security Gate PASS, image HIGH/CRITICAL0, 배포·rollback·재적용 및9/14소스 정렬 PASS.
live 기록200/8records, 무인증/변조401, query422, POST405 및 해시 감사 PASS; Qwen AFP/ALT 및 기존 거부 회귀 PASS.
남은 이력: 최초 gate FAIL, 전체1033/1034 Privacy FAIL(단독2/2·후속gate PASS, 원인 미확정),
감사UUID 테스트 정규식 오탐 수정, 첫 재검증 RemoteDisconnected exit1(후속 동일 이미지PASS).
NOT VERIFIED:375px/실물 스마트폰, 임상 연계·판독, CT/동의/QR 전체 종단 재실행, HA, 전체MVP/v3.
근거: health-helper-rag-2026-10-11.md 최신 비교 절 및 artifacts/workstation/health-comparison-browser-20261011/result.json,
health-helper-runtime-20261011T092936Z/result.json, helper-align-cloud-20261011T092304Z/result.json,
helper-align-b-20261011T092424Z/result.json. 신규 증적 DRAFT / UNASSIGNED; commit/push 없음.
다음 작업 한 개: 실물 휴대폰에서 비교→질문 메모 흐름 확인.

## 2026-10-11 17:50 KST 웹·PWA 질문 스튜디오 배치 보완 — scoped PASS / DRAFT / UNASSIGNED

현재 상태의 권위 절. 아래 이전 '현재/최신' 표현은 당시 이력이다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존; commit/push 없음.
B sha256:3034c26ed8afec060c33283acf306acd2a85bf574c3967977fc47235771fb543,
Control sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7 유지.
같은 합성 환자 시나리오에서 웹/PWA 로그인→AFP 주제→Qwen 질문 추천→출처 카드·근거 서랍
→담기·수정·질문 메모 이동→주제 변경 시 메모 보존 PASS.
제목 아래 전체 폭 검사 선택, 진료 리허설 단계·칩, 세이지 질문 스튜디오, 담은 메모 우선,
모델 추가 호출 없는 짧게/원문 복원 적용. 개인 기록 수치·식별정보·CT·KDCA 제4유형 본문 모델 입력 없음.
의료 설명 생성 RAG 또는 개인 기록 해석 구현은 아니다. recordContext=NOT_CONNECTED 유지.
1022/1022 및 최종 Security Gate PASS, 최종 image HIGH/CRITICAL0, 배포·복구·재적용·소스 정렬 PASS.
최신 API 무인증/변조401, 환자 override422, 임상 REFUSED, 미등록 주제 INSUFFICIENT_EVIDENCE 및 감사 연결 PASS.
웹 width/scrollWidth1918/1918, 좁은 PWA375/375; 버튼48px·입력16px. 실물 휴대폰 검증은 아님.
최초 배포 timeout FAIL/rollback PASS, 중간 unit gate FAIL 원인 미확정, SW hash 불일치 사전 차단을 보존.
FAIL을 후속 PASS로 삭제하지 않음. CT/QR/동의 전체 종단은 이번 UI 작업에서 재실행하지 않음.
남음: 실기기 설치·재접속·가로 회전·텍스트 확대·최신 모델 장애, 자동기동/HA, 독립 검토·FR/NFR 배정.
다음 작업 한 개: 실제 휴대폰 PWA 설치→재접속→동일 질문 흐름 확인.
증적: artifacts/workstation/helper-align-b-20261011T083840Z/result.json,
health-helper-runtime-20261011T084558Z/result.json, helper-studio-browser-20261011/web.png/mobile.png.
명령·세부 범위·한계는 [구현 기록](health-helper-rag-2026-10-11.md)의 배치 보완 완료 절 참조.
전체 MVP/v3 또는 의료 설명 RAG 완료를 선언하지 않는다.

## 2026-10-11 16:42 KST 모바일 전용 PWA 질문 흐름 — scoped PASS / DRAFT / UNASSIGNED

현재 상태의 권위 절. 아래 이전 '현재/최신' 표현은 당시 이력이다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존; commit/push 없음.
Control sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7,
B sha256:a3338717c7e96a051d6b2545bccf9eff40a58e3a4151d4ec5742c34fa144dccf.
/mobile/ 신규 로그인 → 홈 건강도우미 → AFP 주제 질문 → 실제 Qwen 추천·출처 카드 → 담기·수정·모아보기 PASS.
KDCA 원문을 별도 탭에서 열어 간경변증 제목·공식 포털 확인. 임상 진단 거부 시 담은 메모 보존.
최초 잠금 시험에서 hidden dialog 잔여 문구 발견→reset 보완→최신 배포에서 notes0/초안 빈 값/잔여 문구 없음 PASS.
집중12/12 및 최종 security gate PASS, 최신 image HIGH/CRITICAL0, 배포·복구·재적용 PASS.
최신 API 무인증/변조401, 환자 override422, 임상 REFUSED, 미등록 주제 INSUFFICIENT_EVIDENCE 및 감사 연결 PASS.
모바일 width/scrollWidth 375/375에서 가로 넘침 없음; 브라우저 viewport 요청390, 실제 CSS width375 기록.
네 메뉴·기존 CT/QR/동의 유지; 관련 핵심 종단 전체를 이번 모바일 작업에서 재실행한 것은 아님.
새 helper/API/토큰/메모를 PWA cache에 저장하지 않음. 공개 shell만 exact allowlist, SW v16.
모델은 프로젝트 진료 준비 지침과 정규화 주제·의도만 받음. KDCA 제4유형 본문 및 개인 수치/CT를 입력하지 않음.
검사 주제 선택은 개인 건강기록 연동이 아니다. 의료 설명 RAG/개인 기록 해석은 미구현.
남음: 독립 검토·FR/NFR 배정, 실기기 설치·재접속·모델 실제 장애의 최신 모바일 시험, 자동기동/HA.
다음 작업 한 개: 실제 휴대전화에서 PWA 홈 화면 설치→재접속→같은 질문 흐름 검증.
증적: artifacts/workstation/health-helper-runtime-20261011T073744Z/result.json 및 browser-verification.json,
helper-align-b-20261011T073443Z/result.json; 상세는 [구현 기록](health-helper-rag-2026-10-11.md).
전체 MVP/v3 또는 의료 설명 RAG 완료를 선언하지 않는다.

## 2026-10-11 16:01 KST 로컬 Qwen 진료 질문 — scoped PASS / DRAFT / UNASSIGNED

현재 상태의 권위 절. 아래 이전 '현재/최신' 표현은 당시 이력이다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존; commit/push 없음.
Control sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7,
B sha256:83c468fb4613e60e4c0eef370484e6e37fca6191e6c7898ec845df860f8ee27c.
합성 홍길동 환자 웹: 신규 로그인 → AFP 질문 → 실제 Qwen 추천 → KDCA 원문 카드·원문 열기 → 질문 담기·수정·모아보기 PASS.
AFP/ALT API 생성, 무인증·변조 토큰401, patientId 주입422, 임상 요청 REFUSED, 미등록 주제 INSUFFICIENT_EVIDENCE PASS.
모델은 프로젝트 작성 진료 준비 지침과 정규화 주제·의도만 받는다. KDCA 제4유형 본문/환자 수치/식별정보/CT/질문 자유문 입력 없음.
이는 의료 설명 생성 RAG가 아니다. medicalContentGeneration=false / recordContext=NOT_CONNECTED.
인증된 Control에서 pinned SSH 사설 Unix socket을 통해 PC loopback Ollama/Qwen3.5:4b 연결. AI 공개 TCP 포트 없음.
정확한 helper POST만65초/32KiB; 기존 영상 및 다른 API10초 제한·TLS 검증 유지.
이미지 hash/readiness/rollback·재적용 PASS, 최종 이미지 HIGH/CRITICAL0 PASS, 전체1015/1015 PASS 및 이후 CSS 집중6/6 PASS.
실제 모델 장애에서 실패 표시·메모 보존·복구 후 후속 질문 PASS(B v2); 마지막 v3는390px 넘침 수정이며 최신 정상 흐름 재실행 PASS.
최신 감사 세션 연결/hash 존재 확인; 전체 감사 체인 재검증 아님. CT/PACS/동의/DB schema/ingress/PostgreSQL 불변.
남음: 독립 검토·전용 FR/NFR 배정, 모바일 전용 PWA·실기기, 의료 설명 생성 허가/검토, 개인 기록 서버 계약, 부하/HA/자동 기동.
다음 구현 단위 한 개: 모바일 전용 PWA에서 동일 질문 생성·담기·수정 흐름 연결과 정상·거부 검증.
증적: artifacts/workstation/health-helper-runtime-20261011T065633Z/result.json 및 browser-verification.json.
상세 명령·중간 FAIL·복구·한계: [건강도우미 최신 기록](health-helper-rag-2026-10-11.md).
전체 MVP/v3 또는 의료 설명 RAG 완료를 선언하지 않는다.

## 2026-10-11 14:45 KST 건강도우미 배포 정렬·브라우저 흐름 PASS — DRAFT / UNASSIGNED

현재 상태의 권위 절. 아래 과거의 '현재/최신' 표현은 당시 이력이다.
HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존. commit/push 없음.
기존 로그인 200 이후 helper API 404(API route not found): Cloud 실행 이미지에 신규 helper route가 없었고 B 정적 파일도 이전 버전이었다.
Control cb2a0e4e679b3a8c658200e7b3a16aa302c0c7c199d5d2a0b3f397999dbba43f,
B b78f1e35c0030a3dee8687beb337d04460450eef17d9a0aee9627f5ee07448dc로 최소 overlay 배포.
양쪽 소스 SHA-256 일치·health·이전 이미지 rollback 후 후보 재적용 PASS. Cloud ingress/PostgreSQL 컨테이너 보존.
실제 B 환자 신규 로그인 → AFP 질문 → KDCA 출처 카드 → 원문 새 탭 → 응답 질문 담기 → 수정·모아보기 PASS.
같은 배포 API의 무인증/토큰 변조 401, 환자 ID 주입 422, 임상 요청 REFUSED, 미등록 주제 INSUFFICIENT_EVIDENCE 확인.
정상 요청 ID와 PostgreSQL 감사 세션 ID 일치 및 record_hash 존재 확인(전체 체인 재검증 아님).
집중 60/60, 전체 재실행 1008/1008, Security Gate 재실행, 두 이미지 HIGH/CRITICAL 0 PASS.
첫 Security Gate unit-tests exit1은 개별 실패 로그 미확보로 원인 미확정이며 후속 PASS로 삭제하지 않는다.
원문 링크 안내형 SOURCE_GUIDANCE; AI 생성/개인 기록 해석/서버 메모 저장/전체 CT·QR 회귀는 이번 완료 범위 밖.
로컬 localhost:3000 구 실행 프로세스는 변경하지 않았다. 독립 검토 및 신규 RAG FR/NFR 배정 미완료.
다음 작업 한 개: 이번 고정 이미지·원문 안내 흐름 증적의 독립 검토.
상세 명령·증적·복구: [건강도우미 최신 기록](health-helper-rag-2026-10-11.md).

## 이전 관측: 2026-10-11 14:17 KST 실제 환자 브라우저 — 흐름 FAIL / DRAFT / UNASSIGNED

현재 상태의 권위 절. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존.
B병원 환자 기존 세션과 localhost:3000에서 AFP 일반 질문을 제출했으나 실패 안내 표시.
B 화면은 구형 '설명 듣기'이며 로컬은 최신 정적 화면이지만 서버 PID5240이 10월7일부터 실행 중으로
10월11일 신규 API 변경보다 앞선 실행본이다. 실행 이미지 digest·실패 HTTP 코드·감사 연결은 NOT VERIFIED.
출처 카드·원문 열기는 미표시로 NOT VERIFIED. 질문 담기·수정·모아보기는 양쪽 실제 브라우저 부분 PASS.
이 PASS는 기존 프로젝트 예시 질문 메모만 해당하며 검색 응답 추천·새 로그인·서버 메모 저장 성공이 아니다.
검증용 B 질문만 제거했고 기존 메모 보존, 임시 로컬 탭 닫음. CT/동의/PACS/배포/프로세스/commit/push 변경 없음.
다음 작업 한 개: 실제 배포 API 실패 사유·실행 이미지와 최신 소스 차이 확인 후 실행 정렬 범위를 확정한다.
신규 증적은 DRAFT / UNASSIGNED. 전체 RAG/MVP/v3 완료 선언 없음.
상세 관측·제외 범위: [RAG 브라우저 기록](health-helper-rag-2026-10-11.md).

## 이전 구현: 2026-10-11 KST 질병관리청 원문 검색·대화 안내 로컬 구현 — DRAFT / UNASSIGNED

현재 상태의 최신 절. 기존 HEAD + dirty 보존. kdca-links-20261011-v1의 원문 링크 2개 구축.
간기능/AST/ALT/GGT는 5444, AFP는 6560의 정기 진찰 언급 위치로 연결하며 맥락 한계 명시.
제4유형 본문을 복제·임베딩·재서술하지 않음. 기본 SOURCE_GUIDANCE는 모델을 호출하지 않고
고정 탐색 안내·출처 카드·원문 링크·프로젝트 질문 예시를 반환. 개인 기록 해석 NOT_CONNECTED.
기존 후보 v3 생성 게이트 유지. AI 추천과 프로젝트 예시 구분·기관/날짜/이용조건·안전 URL 표시 연결.
집중 45/45 PASS(exit0, 0.396초), 경계 회귀 28/28 PASS(exit0, 0.854초), secret findings0·JS구문 PASS.
HTTP 인증 및 DOM 일부는 대역. 실제 로그인→원문 카드→원문 열기→담기 브라우저 흐름 NOT VERIFIED.
생성형 RAG·전체 포털 수집·전체 회귀·개인화·독립 사람 검토 미완료. 관련 RAG FR/NFR 미배정.
서버·정적 소스·집중 테스트·기존 문서 로컬 변경; DB/CT/VM/실행 이미지·모델 활성화·배포·commit/push 없음.
다음 작업 한 개: 로컬 실제 환자 브라우저에서 위 원문 안내 흐름 검증.
실행 명령·제외 범위: [RAG 최신 기록](health-helper-rag-2026-10-11.md). 전체 MVP/v3 완료 선언 없음.

## 이전 결정: 2026-10-11 KST 질병관리청 기본 출처 확정 — DRAFT / UNASSIGNED

현재 상태의 최신 절. 사용자 지시로 질병관리청을 기본 출처로 선정하고 비상업적 캡스톤 용도로 제한.
제4유형의 출처표시·비상업적 이용·변경금지를 함께 준수한다. 비영리는 AI 재서술 허가가 아니다.
우선 근거 검색·원문 링크 안내형으로 설계하며 제4유형 후보의 생성형 입력 차단은 유지한다.
변경 허용 출처 탐색 우선 방향은 이전 이력. 후보 v3 및 기존 코드·자료를 삭제하지 않았다.
이번 작업은 문서 기준 정리만 수행. 새 코드·API·DB·UI·이미지·CT 변경이나 모델 활성화·배포 없음.
신규 코드 테스트·브라우저 검증은 미실행. 이전 39/39 PASS를 이번 사용자 흐름 성공으로 승계하지 않음.
다음 작업 한 개: 질병관리청 주제별 원문 링크 카탈로그와 건강도우미 출처 안내 응답 연결.
상세 적용 범위: [RAG 최신 기록](health-helper-rag-2026-10-11.md).
독립 콘텐츠 승인 및 실제 생성형 RAG 완료는 미검증. 전체 MVP/v3 완료를 선언하지 않는다.

## 이전 이력: 2026-10-11 KST 변경 허용 출처 교체 착수 — DRAFT / UNASSIGNED

현재 상태의 최신 절. HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존.
사용자가 선택한 국내 자료 교체를 시작했으나 AFP·간기능 전체 교체는 미완료.
의왕시 보건소 검사실 개별 제1유형을 확인하여 제한된 검사 목록 후보 1개 추가.
버전 health-ko-20261011-candidate-v3, 출처 3개·후보 9개 중 기존 8개는 계속 이용 차단.
새 출처 reuseStatus=CLEARED는 공개 라이선스 조건 범위의 결정이며 독립 콘텐츠 승인 아님.
전체 contentReview=UNASSIGNED·모델 검색 차단 유지. 내용 부족한 자료를 의학 해석 근거로 대체하지 않음.
새 후보는 DEFINITION만 지원하며 정상범위·해석 한계·AFP·AST·ALT·GGT 질문 근거로 사용하지 않음.
집중 테스트 39/39 PASS, exit0, 0.359초. 대역 시험이며 실제 생성·브라우저·전체 회귀 NOT VERIFIED.
신규 RAG FR/NFR 미배정; 기존 인증·감사·최소수집 공통 제약 유지.
UI/API 요청·DB·실행 이미지·고정 CT 변경, 배포·모델 활성화·commit/push 없음.
상세 출처 허용/제외표와 범위: [RAG 최신 기록](health-helper-rag-2026-10-11.md).
다음 작업 한 개: AFP 의미·단독 해석 한계를 직접 지원하는 변경 허용 국내 기관 자료 확보.
전체 MVP/v3 완료를 선언하지 않는다. 과거 전체 시험 FAIL 기록도 보존한다.

## 이전 이력: 2026-10-11 KST RAG 후보 v2 이용조건·원문 대조 — DRAFT / UNASSIGNED

현재 상태의 최신 절. 기존 HEAD 및 dirty 작업 보존. 신규 정책/권한 모델·배포 작업이 아니다.
간기능검사 5444 개별 페이지의 공공누리 변경금지 표시와 AFP 133에서 연결된 콘텐츠 재가공 제한을 확인했다.
현재 재서술 RAG 용도는 양쪽 모두 NOT_CLEARED_FOR_RAG로 결정. permissionEvidence=null,
독립 콘텐츠 review는 UNASSIGNED다. 과거 김범희 PASS를 승계하지 않았다.
8개 후보는 에이전트 원문 대조 완료: AST/ALT·GGT 절 표시 정정, 간기능 참고범위 문장 축소.
대조한 정확한 텍스트 해시를 기록했으며 이것을 실행 승인 해시로 취급하지 않는다.
코퍼스 버전 health-ko-20261011-candidate-v2. 승인 전 검색/모델 입력 차단 유지.

집중 Node 테스트 36/36 PASS, exit0, 0.325초. 대역 생성 성공은 실제 모델 성공이 아니다.
새 source/corpus 메타데이터와 문서만 변경; UI/API 계약·DB·PACS·700장 CT·실행 이미지 변경 없음.
실제 RAG 브라우저 흐름·독립 콘텐츠 승인·기관 별도 허가 NOT VERIFIED.
외부 신청/메일·모델 활성화·배포·commit/push 수행하지 않았다.
근거·후보별 대조·허가 확인 범위는 [RAG 최신 기록](health-helper-rag-2026-10-11.md)에 통합했다.
다음 작업 한 개: 별도 허가 확인 또는 변경 허용 출처로 교체 중 사용자 방향 결정.
전체 MVP/v3 완료를 선언하지 않는다. 이전 전체 Node FAIL 기록도 유지한다.

## 2026-10-11 13:42 KST RAG 착수·근거 후보 및 이용조건 게이트 — DRAFT / UNASSIGNED

현재 상태의 최신 절. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty 보존.
이번 변경은 로컬 Node ESM 검색/출처/검토 경계이며 사용자 흐름 전체 완료 증거가 아니다.
기존 출처 14개+AFP를 선별하고 AFP·간기능 및 두 기관 이용 안내를 재확인했다.
2개 출처·8개 후보는 재서술 사용 범위와 콘텐츠 검토 미확인으로 실제 모델 입력에서 제외한다.
이용조건·검토·승인 텍스트 해시가 모두 충족되어야 검색 가능하다. 사용자 입력 승인 우회 없음.
여러 출처 citation은 검색된 실제 서버 출처로 연결한다. 합성 환자 수치·CT는 공용 근거에 넣지 않았다.
개인 기록 NOT_CONNECTED, 실제 모델·브라우저 생성 NOT VERIFIED. Azure AI는 활성화하지 않는다.

검증: corpus/RAG/HTTP/UI 34/34 PASS(exit0, 0.403초), 기존 ingress/mobile/patient 경계
28/28 PASS(exit0, 0.763초). 모델/인증 일부는 대역이다. 전체 회귀는 재실행하지 않았고
아래 이전 전체 Node FAIL 기록을 유지한다. 신규 RAG FR/NFR 미배정, FR-037~041 감사 공통 제약 유지.
Secret scan findings0 PASS, 서버 JS 구문/추적 diff 검사 exit0. 기존 CRLF 경고 유지.
정적 UI·현재 B 이미지 `ec1faaa0ee08b957…`는 이번 작업에서 변경하거나 재관측하지 않았다.
A/B/Cloud/DB/PACS·700장 고정 데이터 변경 없음. 배포·모델 설치·commit/push 수행하지 않음.
재현 명령과 선별표: [RAG 현재 기록](health-helper-rag-2026-10-11.md).
복구는 배포 작업이 아니므로 불필요하며, 변경 전 로컬 RAG는 아래 문서의 초기 이력으로 보존한다.
다음 작업 한 개: 선택한 근거의 이용조건 및 콘텐츠 검토 확정. 미허용 자료는 교체하고 게이트를 우회하지 않는다.

## 2026-10-11 13:32 KST 건강도우미 시안 구현·B 웹 반영 — DRAFT / UNASSIGNED

현재 상태의 최신 절. 아래 AFP 구현/세이지 초안은 이전 이력이며 신규 모델 승인이 아니다.
HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty 보존. 종료된 별도 MediQ 프로젝트는 재개하지 않았다.
`frontend-design`으로 기존 Pretendard·수평 메뉴·절제된 블루를 유지하면서 기록 선택 rail, 대화창,
세이지 `#DFE9DD` 질문 포켓과 아이보리 카드로 승인 시안을 구현했다. 새로운 API/DB/권한 계약 변경 없음.
관련 기존 요구사항 FR-006~009(표시), 개인정보 최소화·XSS·접근성 원칙. RAG의 신규 FR/NFR 번호는 미배정.

구현 파일: `public/ui/patient-helper.js`, `public/ui/patient-helper.css`, `public/app.js`.
기존 `healthRecords`의 합성 표시 메타데이터를 선택할 수 있지만 선택 데이터·값·CT 픽셀은 모델로 전송하지 않는다.
정적 질문 예시와 실제 응답의 AI 추천을 구분한다. 담기·수정·중복 차단·직접 추가·삭제·모아보기 지원.
새 대화/기록 전환은 요청을 취소하고 늦은 답변을 무시하며 담은 메모를 보존한다. 역할 reset은 메모를 지운다.
질문은 메모리만 사용하며 새로고침 시 삭제된다. 현재 서비스 모델 답변은 미연결: 실패 안내만 표시하며 가짜 답변 없음.
사용자의 비Azure 방향을 반영해 화면에서 Azure AI 문구를 제거했다. 기존 비활성 adapter는 삭제/활성화하지 않았다.

배포 전 pinned SSH 재관측 PASS: `artifacts/workstation/mobile-b-rollout-20261011T041842Z/result.json`.
B 기준 이미지 `sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685`.
후보/현재 B `highpass-platform-mvp:capstone-mobile-helper-notebook-20261011`,
ID `sha256:ec1faaa0ee08b957eabf476aabc50611e7deb8ee1a28955f89a75b9f8c8ed6f9`.
정적 소스 59개 해시 일치 PASS. Trivy HIGH0/CRITICAL0 PASS:
`artifacts/security/container-scan/helper-notebook-20261011.json`.
B 배포·runtime 설정 보존·실제 rollback·재승격·strict TLS32경로 PASS(exit0):
`artifacts/workstation/mobile-b-rollout-20261011T042409Z/result.json`.
`scripts/capstone-mobile-b-rollout.py`의 정확한 29파일 기준 체인만 추가했고 tamper/다른 이미지 거부 시험 PASS.
A·Cloud·DB·PACS·고정 CT 변경 없음. Cloud에 로컬 AFP API를 배포하지 않았다.

실행 및 검증:
- `docker build --build-arg CAPSTONE_BASE_IMAGE=highpass-helper-baseline:20261011 -f Dockerfile.presentation-ui -t highpass-platform-mvp:capstone-mobile-helper-notebook-20261011 .`: exit0, 기존 FROM ARG 경고 유지.
- `node --test test/patient-helper.test.js test/health-helper-rag.test.js test/health-helper-http.test.js test/capstone-control-ingress.test.js test/mobile-capstone-auth.test.js test/patient-self-view-authorization.test.js`: 53/53 PASS, exit0, 0.928초. 모델 호출은 대역이며 실제 모델 성공 증거 아님.
- `python test/screening-rollout.test.py`: 1/1 PASS, exit0, 0.003초.
- `node --test`: FAIL, exit1, 61.347초. Privacy HTTP 시험에서 bad-json/model-unavailable/output-overflow/token-limit-before-detect assertions 실패. 원인 미확정; 이번 UI 변경으로 해결했다고 주장하지 않음.
- `node --test test/privacy-isolated-http.test.js`: 단독 2/2 PASS, exit0, 9.910초. 전체 실행 최초 실패를 소급 PASS 처리하지 않음.
- `node scripts/security-secret-scan.js`: findings0 PASS. 변경 대상 `git diff --check`: exit0, 기존 CRLF 경고.

실제 B 브라우저 PASS: 환자로 시작하기→기존 시연 ID/PW 로그인→건강도우미→질문 담기→수정→새 대화/기록 전환 후 수정 보존→중복 차단→모아보기/닫기.
AFP 질문 요청 실패 시 가짜 답변 없이 메모 유지 안내 표시. console error 관측0.
데스크톱 관측 client/scrollWidth1265/1265, grid677.438px+437.062px; 390px viewport client/scrollWidth375/375, 단일열352.922px.
기존 native 탭의 viewport override가 적용되지 않아 별도 브라우저 검증 탭으로 확인했고 임시 탭 종료/override 원복.
화면: `artifacts/workstation/helper-notebook-desktop-20261011.png`.

재현: `https://192.168.111.149:9443/hipass/#PATIENT`→환자 로그인→상단 건강도우미.
복구: 원본29파일 Compose 체인에 보존한 `792b4e3b82b8cd3e…` 이미지를 지정해 portal만 재생성하는 기존 절차. 이번 배포에서 실제 복구 및 재승격 확인.
현재30파일 체인은 향후 배포 전 새 이미지 기준으로 재관측해야 한다.
NOT VERIFIED: 실제 로컬 LLM/RAG 답변·대화 기반 추천·개인 기록 해석·PWA 신규 화면·CT/공유 전체 종단 재검증.
전체 MVP/v3 완료 또는 신규 독립 검토 PASS 아님. commit/push 없음.
다음 작업 하나: 기존 국내 공공/대학병원 근거 코퍼스를 선별·출처 검증해 비Azure 로컬 모델 경로의 AFP 답변→추천 질문 한 흐름을 검증한다.

## 2026-10-11 13:05 KST AFP RAG 로컬 첫 구현 — DRAFT / UNASSIGNED

이 절은 아래 질문 포켓 UI 기록보다 최신 **로컬 소스** 상태다. B 실행 이미지는 변경하지 않았다.
HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + 기존 dirty 변경 보존.
AFP 공개 근거 검색 → Azure REST 모델 adapter → 출처/형식 검증 → 추천 질문 담기/수정 연결을 구현했다.
환자 전용 API·signed ingress 확인·입력 제한·감사 fail-closed·모델 timeout·호출량 제한을 추가했다.
개인 기록은 NOT CONNECTED, 실제 Azure 모델은 NOT VERIFIED/미활성. 원문 질문과 개인 기록은 모델에 보내지 않는다.
기본 설정에서는 모델 미설정 503을 표시하며 가짜 답변을 제공하지 않는다.

집중 Node 24/24 PASS(exit0, 0.330초); 기존 ingress·모바일 인증·환자 self-view 회귀 28/28 PASS(exit0, 1.102초).
Azure REST와 인증 경계의 일부는 테스트 대역이며 실제 로그인→AI→브라우저 증적이 아니다.
구문 검사 PASS. 전체 Node·실제 모델·브라우저 클릭·A/B/Cloud 배포·CT/공유 종단은 이번 작업에서 NOT VERIFIED.
기존 감사 ID 자리수 실패는 이번 범위에서 해결하지 않았다. commit/push/리소스 생성 없음.
구체 계약·파일·안전 한계·설정·명령은 [AFP RAG 구현 기록](health-helper-rag-2026-10-11.md)을 참조한다.
다음 작업 하나: Azure 모델 제공 여부·배포·처리 조건·비용 확인 후 실제 AFP 답변과 추천 카드 브라우저 흐름 검증.

## 2026-10-11 건강도우미 세이지 그린 질문 포켓 — DRAFT / UNASSIGNED

작업 목적: 승인한 세이지 팔레트를 환자 웹 상단 건강도우미 화면에 반영. 기존에는 해당 화면/RAG가 없어서 질문 메모용 UI를 추가했다. RAG 연결 준비 상태, 정적 질문 예시(자동 추천 아님), 외부 AI 전송 없음 및 비진단 안내를 명시한다. 실제 모델·검색·개인 기록 분석은 구현하지 않았다. `redesign-existing-projects`를 적용하여 기존 Node ESM DOM/CSS·폰트·블루·수평 메뉴를 유지하고 포켓 `#DFE9DD`, 예시 카드 `#FAFCF8`, 담은 카드 흰색으로 제한했다.

관련 요구사항: 기존 환자 표시 영역 FR-006~009와 개인정보 최소화·XSS·접근성 원칙. 신규 RAG FR/NFR 번호는 추정하지 않는다. 변경 API/DB/동의/권한/키 계약 없음. 생성: `public/ui/patient-helper.js`, `public/ui/patient-helper.css`, `test/patient-helper.test.js`. 수정: `public/index.html`, `public/app.js`, 배포 스크립트와 정확한 Compose 체인 테스트, 이 문서. 기존 dirty 변경 보존; commit/push 없음.

구현: 상단 메뉴→건강도우미→기록 보기(기존 건강기록), 이용 도움말(기존 FAQ), 질문 예시 담기·중복 차단·직접 추가·240자/12개 제한·수정·삭제. 질문은 페이지 메모리에만 있으며 새로고침 시 삭제; 서버/브라우저 지속 저장·네트워크 전송 없음. 사용자 입력은 DOM textContent/value로만 처리한다.

검증 기록: Node 화면/자료/번들 17/17 PASS(exit0, 최종 0.325초); 인증·B 경계·공유·이력 회귀 24/24 PASS(exit0, 0.568초, 이 중 helper 3개 중복); Python 정확한 체인/변조 거부 1/1 PASS(exit0). 첫 브라우저 실행에서 수정 내용이 다른 카드 추가 시 소실되는 FAIL을 발견하여 change 대신 input 이벤트로 수정했다. 최초 이미지 `b1994ea392d79b95…` 배포·복구 PASS receipt `artifacts/workstation/mobile-b-rollout-20261011T033838Z/result.json`; 이를 최종 수정 성공 증거로 승계하지 않는다. 수정 후보 `highpass-platform-mvp:capstone-mobile-helper-sage-fix-20261011`, ID `sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685`, Trivy HIGH0/CRITICAL0 PASS `artifacts/security/container-scan/patient-helper-sage-fix-20261011.json`. 최종 배포 및 브라우저 수정 유지 확인은 아래 후속 결과에 기록한다.

코드 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty. 전체 Node 재실행·CT/공유 보안 종단·RAG·의료진/PWA 신규 건강도우미 화면은 NOT VERIFIED. 기존 전체 테스트 감사 ID 자리수 실패를 해결하지 않았다. 이번 결과는 전체 MVP/v3 완료 또는 신규 사람 승인으로 해석하지 않는다.

최종 결과(2026-10-11 12:46~12:51 Asia/Seoul): 수정 후보 B 승격·소스 해시 확인·runtime 설정 보존·실제 rollback·재승격·strict TLS 32경로 PASS(exit0). 증적 `artifacts/workstation/mobile-b-rollout-20261011T034601Z/result.json`. B 최종 image `sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685` healthy 관측. A·Cloud·DB·PACS 변경 없음. `security-secret-scan` findings0 PASS 및 diff check exit0(기존 CRLF 경고). Build exit0(기존 ARG 기본값 경고). 초기 수정 소실 FAIL은 input 이벤트 변경 후 같은 실제 브라우저 경로에서 해소 확인.

실제 브라우저 PASS: 진입→환자 시연 ID/PW 로그인→상단 건강도우미→예시 담기→질문 수정→다른 질문 직접 추가 후 수정 유지→중복 추가 차단→삭제. `<img src=x onerror=alert(1)>` 입력은 textarea의 문자 그대로 남고 생성된 img0; 검증용 카드 제거. 최종 질문2개, console errors0. 포켓 computed background `rgb(223,233,221)`; 1440px 문서 client/scrollWidth1425/1425, 390px 375/375 및 단일열339px. 임시 viewport 원복. 화면 증적 `artifacts/workstation/patient-helper-sage-20261011.jpg`. 브라우저 입력 한도 12개 전체 반복·실제 AI 응답·카메라·의료진·PWA·CT 전체 종단은 이번 검증에서 NOT VERIFIED.

재현: `https://192.168.111.149:9443/hipass/#PATIENT`→환자로 시작하기→기존 시연 계정 로그인→건강도우미. 수정 배포 명령은 기존 `capstone-mobile-b-rollout.py`에 `--apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-helper-sage-fix-20261011 --image-id sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685 --expected-current-id sha256:b1994ea392d79b952bbbe5f044362643199a864ea079f14bb3836b79b189c3aa --scan artifacts/security/container-scan/patient-helper-sage-fix-20261011.json` (암호 stdin만). 복구는 보존한 원본28파일 Compose에 baseline b1994ea392d79b95…를 지정해 portal만 재생성하는 기존 절차이며 실제 검증했다. 향후 재배포 전 최신29파일 체인을 다시 관측해야 한다. 다음 작업 한 개: 기존 UI에 실제 RAG를 연결하려면 모델/검색 자료/개인 기록 전송 정책을 먼저 확정하고 하나의 근거 있는 답변 경로로 검증할 것; 이번 작업은 UI 반영만 완료.

## 2026-10-11 건강검진 출처 상세의 정보 위계 정리 — DRAFT / UNASSIGNED

관측: 2026-10-11 12:01~12:10 Asia/Seoul. 이 절이 아래 국내 출처 정렬 기록보다 최신이다. 기존 dirty 변경 보존. 건강검진 항목의 ‘기준과 해석 알아보기’는 기관명·자료명·근거 메타데이터·국내 원문 링크를 먼저 표시한다. 반복되는 결과 출처 안내, 적용 기준·조건·주의사항 및 항목별 계산/단위 설명은 마지막의 기본 접힌 ‘시연 데이터·해석 유의사항’으로 이동했다. 합성 데이터 표시와 수치·범위·판정 색상·검사 설명·출처 레지스트리는 삭제/변경하지 않았다. 기존 폰트·팔레트 유지 및 정보의 단계적 표시에는 `frontend-design`을 적용했다.

변경 파일: `public/ui/patient-health.js`, `public/ui/patient-health.css`, `test/patient-health.test.js`, `scripts/capstone-mobile-b-rollout.py`, `test/screening-rollout.test.py`, 이 문서. 기존 Node ESM DOM/CSS 유지, 새 의존성·API·DB·인증·동의·암호화 계약 변경 없음. 관련 FR-006~009 표시 영역; Viewer 등 기존 기능의 코드 변경 없음. 신규 NFR ID를 추정하지 않는다.

검증: 항목 테스트 13/13 PASS(exit0, 0.155초); 항목+발표 패키지+B portal 접근 보호 회귀 23/23 PASS(exit0, 0.999초); 정확한 Compose 체인 및 변조 거부 Python 테스트 1/1 PASS(exit0); secret scan findings0 PASS, diff check exit0(기존 CRLF 경고). 전체 `node --test`는 962개 중 961 PASS / 1 FAIL, exit1, 61.445초: 기존 `test/hcc-source-operator-contract.test.js`의 감사 ID 자리수 문제 재발. 아래 원인 분석과 동일하며 이번 변경에서 해결하지 않았다. 전체 성공으로 표현하거나 재실행으로 실패를 지우지 않는다.

배포: 읽기 전용 재확인 `artifacts/workstation/mobile-b-rollout-20261011T030121Z/result.json` PASS; pinned SSH로 실제 26파일 Compose 체인 확인 후 정확한 baseline만 allowlist에 추가. baseline `sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a`. 후보 `highpass-platform-mvp:capstone-mobile-screening-disclosure-20261011`, image `sha256:ae7365a62702ff13d352c1f1ed9be12ab7a37c7858b970f1ffeebe543c822ce6`. Build PASS(exit0, 기존 ARG 기본값 경고); Trivy HIGH0/CRITICAL0 PASS, `artifacts/security/container-scan/patient-screening-disclosure-20261011.json`. 실제 B 승격·source byte attestation·runtime 보존·rollback·재승격·strict TLS 30경로 PASS(exit0), receipt `artifacts/workstation/mobile-b-rollout-20261011T030447Z/result.json`. A/Cloud/DB/PACS 변경 없음.

실제 브라우저: B 시연 로그인→내 건강기록→2026 건강검진→혈액·소변→혈색소 출처 펼침 PASS. 출처 카드 우선, 혈액·소변 12항목의 보조 notes 마지막/기본 닫힘 확인; Enter로 열림/닫힘 및 내용 보존 PASS. 1440px/390px 문서폭1425/375가 각각 scrollWidth와 일치, console error0, 임시 viewport 원복 PASS. 화면 증적 `artifacts/workstation/patient-screening-disclosure-20261011.png`. CT·공유 종단 흐름은 이번 실행에서 NOT VERIFIED(코드 변경 없음, 과거 PASS 승계 안 함).

재현: 환자 웹→내 건강기록→2026 건강검진→항목의 ‘기준과 해석 알아보기’; 유의사항은 원문 링크 아래 별도로 펼친다. 배포 명령은 `python scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-screening-disclosure-20261011 --image-id sha256:ae7365a62702ff13d352c1f1ed9be12ab7a37c7858b970f1ffeebe543c822ce6 --expected-current-id sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a --scan artifacts/security/container-scan/patient-screening-disclosure-20261011.json`이었다(credential stdin만). 재실행 전 최신 27-file chain 재관측 필요. 복구는 보존한 원본26파일 Compose에 baseline image를 지정해 portal만 재생성하는 기존 절차이며 이번에 실제 실행·확인했다. JS hash `1905ef839d0fc7c69523db6af7115df0ecad062be31ad7f1a6f43c5765c9e662`; CSS `da5f1a94ee22ee5a67e2dc3727f36b1887cb3b00832620d98c5b1d1b37b97050`.

남은 위험: 기존 감사 ID/등록 검증의 자리수 불일치. 다음 독립 작업으로 최소 수정과 focused 정상·음성 회귀가 필요하다. 이번 UI 정리의 범위와 분리한다. 신규 사람 승인 없음, DRAFT / UNASSIGNED. 커밋·푸시 없음, 전체 MVP/v3 완료 선언 없음.

## 2026-10-11 건강검진 항목별 국내 출처 정렬·웹 반영 — DRAFT / UNASSIGNED

관측: 2026-10-11 11:25~11:45 Asia/Seoul. 이번 절이 아래 건강검진 기록보다 최신이다. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + 기존 dirty 변경 보존. 사용자 요청에 따라 건강검진 23항목의 기준·설명 출처를 질병관리청 국가건강정보포털, e-나라지표(질병관리청 소관), 서울아산병원, 경북대학교병원의 직접 자료로 정렬했다. 기존 합성 환자·검진 수치·CT700·AFP/초음파 자료는 바꾸지 않았다. 국내 기관이 합성 결과를 검사·판독·인증한 것처럼 표시하지 않는다.

구현: `public/ui/patient-health.js`의 항목별 근거 레지스트리와 출처 카드를 추가했다. 기관명·자료명·해당 절·근거 종류·자료 개정/발행일·서비스 확인일(2026-10-11)·원문 링크를 표시한다. 날짜를 확인하지 못한 자료는 그 사실을 명시하며 서비스 확인일을 발행일로 대체하지 않는다. 지질 자료는 확인된 발행 월 2025-08까지만 표시한다. 링크는 HTTPS / 새 창 / `noopener noreferrer`; DOM `textContent` 사용, 외부 사이트로 환자 값 전송 없음. 참고자료는 비교·교육용이며 실제 검사기관 참고범위를 우선한다. 시력·청력·흉부 방사선·구강검진의 국가검진 자료는 검사항목 설명이지 해당 가상 소견의 임상 검증 근거가 아니다. 폐기능의 예측치·정상 하한이 없는 문제는 그대로 명시한다.

출처와 판정 정렬: 혈색소는 서울아산병원 남성 예시 13–17 g/dL, 크레아티닌은 같은 병원의 일반 예시 0.50–1.4 mg/dL(남성 전용 범위 아님)로 정렬했다. 기존 13–16.5 / 0.7–1.3 이력은 최신 기준이 아니다. ALT는 질병관리청 0–40과 일치하도록 설명을 정리했다. BMI는 e-나라지표의 저체중/정상/비만전단계 구분과 질병관리청 비만 기준, eGFR은 경북대학교병원 G1/G2 표와 질병관리청의 지속 기간·신장 손상 맥락을 분리한다. 수치 분류만으로 질환·개인별 치료 목표를 확정하지 않는다. 간 효소 원문 IU/L과 합성 fixture U/L의 표기 관계 및 실제 검사법 확인 필요를 표시한다.

분석/변경 범위: 기존 DOM ESM/정적 CSS 유지. `frontend-design`에 따라 기존 Pretendard·세이지·화이트를 유지하고 펼침 영역만 출처 카드로 정리했다. 이번 변경 파일은 `public/ui/patient-health.js`, `public/ui/patient-health.css`, `test/patient-health.test.js`, `scripts/capstone-mobile-b-rollout.py`, `test/screening-rollout.test.py`, 이 상태 문서다. 새 라이브러리·서버 API·DB schema·인가·암호화 정책 변경 없음. 관련 그룹 FR-006~009(목록/메타데이터 표시), FR-032~036(Viewer 연결 회귀); FR-001~005/014~025/037~041 계약 유지. NFR 번호를 임의 생성하지 않는다.

기준선: B read-only `artifacts/workstation/mobile-b-rollout-20261011T022527Z/result.json` PASS. 당시 image `sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce` healthy/암호화 설정 유지. pinned SSH로 실제 25개 Compose 파일 체인을 관측하고 해당 정확한 조합만 allowlist에 추가했다. 이전 증적을 신뢰 복구용 입력으로 사용한 최초 점검은 `TRUST_BASELINE_NOT_VERIFIED`로 중단(`...T022351Z/result.json`); 이를 완화하지 않고 기존 VM 콘솔 기반 신뢰 경로로 재점검했다.

검증 결과:

| 검증 | 결과 | 이번 실행 근거 |
|---|---|---|
| 항목별 국내 근거·경계·단위·가상 출처 분리 | PASS | `node --test test/patient-health.test.js` 12/12, exit0, 최신 재실행 0.214초 |
| 정확한 배포 조합 검증 | PASS | `python test/screening-rollout.test.py` 1/1, exit0, 0.002초 |
| 전체 Node 최초 실행 | FAIL | 960/961, exit1, 66.898초, `artifacts/workstation/patient-screening-domestic-tests-20261011.log` |
| 해당 기존 테스트 단독 재실행 | PASS | `node --test test/hcc-source-operator-contract.test.js` 1/1, exit0, 0.559초 |
| 전체 Node 재실행 | PASS | 961/961, exit0, 64.113초, `artifacts/workstation/patient-screening-domestic-tests-retry-20261011.log` |
| Secret scan / diff check | PASS | `node scripts/security-secret-scan.js` findings0; `git diff --check` exit0, 기존 CRLF 경고 보존 |
| 후보 build / Trivy | PASS | build exit0(기존 ARG 기본값 경고); HIGH0/CRITICAL0, exit0 |
| B 배포·runtime·복구·재승격·strict TLS | PASS | 아래 배포 receipt의 동일 이미지·정적 byte attest 및 30경로 확인 |
| 실제 브라우저 로그인→검진→항목별 기준 펼침 | PASS | 신체7 / 혈액·소변12 / 추가4에 국내 원문 링크, 기관·날짜·주의사항 표시 |
| 웹 1440/390px 반응형 | PASS | 문서폭1425/375px 각각 scrollWidth와 일치, 콘솔 error0; 임시 viewport 원복 |
| 고정 CT 본인 Viewer | PASS | 재로그인 후 1/700→2/700, 실제 픽셀1254×1254 확인; 전체700장 순회는 NOT VERIFIED |

기존 실패의 확인된 원인: `src/domain.js`의 `makeId`는 두 Uint32를 zero-padding 없이 hex 문자열로 연결한다. `scripts/hcc-source-catalog-live-check.js`는 `audit_` 뒤 정확히 16자리만 허용한다. 격리된 프로세스에서 `[1,4294967295]`를 입력하면 `audit_1ffffffff`가 생성되어 거부됨을 재현했다(exit0, 서비스/DB mutation 없음). 따라서 재실행 PASS는 이 기존 가변 자리수 결함의 수정 증거가 아니다. 이번 UI 요청에서 감사 ID·등록 계약을 임의 수정하지 않았다. 남은 위험으로 유지한다.

배포 후보 `highpass-platform-mvp:capstone-mobile-screening-domestic-20261011`, image `sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a`; scan `artifacts/security/container-scan/patient-screening-domestic-20261011.json`. B 배포 PASS exit0, 11:32:37~11:35:17 KST, 증적 `artifacts/workstation/mobile-b-rollout-20261011T023237Z/result.json`. 원본 Compose·baseline 이미지 보존, 실제 rollback→후보 재승격 검증 완료. A/Cloud 구성·DB schema·PACS 데이터 변경 없음. JS SHA-256 `67cd7fce4b24c8b66589393ec9f3e35f3e6f052b9a792644ad94535c5c2701b2`, CSS `028159835bc1d013ec56d4fba5ab2fd4a325a01782f4606e5baa09dfcdc8b491`.

실행 명령: `docker build --network=none --build-arg CAPSTONE_BASE_IMAGE=highpass-platform-mvp:capstone-mobile-screening-complete-20261011 -f Dockerfile.presentation-ui -t highpass-platform-mvp:capstone-mobile-screening-domestic-20261011 .`; 위 이미지/scan 환경변수로 `node scripts/container-scan.js`; `python scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-screening-domestic-20261011 --image-id sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a --expected-current-id sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce --scan artifacts/security/container-scan/patient-screening-domestic-20261011.json`. Credential은 stdin만. 실제 복구 명령은 동일 receipt에서 확인한 원본25 Compose 파일로 `HIPASS_APP_IMAGE=sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce docker compose ... up -d --no-deps --force-recreate --pull never portal`; 다음 실행 전 현재26-overlay 조합을 다시 관측해야 하며 기존 receipt만으로 자동 재배포하지 않는다.

브라우저 CT 첫 시도에서 최초 프레임 뒤 열람 기간 만료·재접속 인증 만료 안내가 발생했다. 픽셀 제거와 재로그인 요구를 보존하고 정상 로그인을 갱신해 2번째 픽셀을 확인했다. 첫 캡처 `patient-screening-domestic-ct-20261011.png`는 만료 화면이며 성공 캡처가 아니다. 성공 재시도는 `patient-screening-domestic-ct-retry-20261011.png`. 건강검진 출처 캡처는 같은 `artifacts/workstation/mediq-landing-browser-20261010/`의 `patient-screening-domestic-desktop-20261011.png`, `patient-screening-domestic-mobile-20261011.png`, 최종 혈색소 카드 `patient-screening-domestic-final-20261011.png`. source URL 검증과 브라우저 카드 검증을 구분한다. 링크 목적지를 브라우저 새 창으로 모두 순회한 검증은 NOT VERIFIED.

재현: `https://192.168.111.149:9443/hipass/#PATIENT` → 기존 시연 환자 로그인 → 내 건강기록 → 2026 건강검진 → 신체·감각/혈액·소변/추가 검사 → 기준과 해석 알아보기. 임상 타당성·실제 국가망 연계·이번 이미지 기준 전체 동의/QR/철회 음성 E2E·네이티브 모바일 앱은 NOT VERIFIED. 신규 증적 DRAFT / UNASSIGNED; 기존 사람 승인은 승계하지 않는다. commit/push·전체 MVP/v3 완료 선언 없음. 다음 작업 한 개: 기존 감사 receipt ID 생성·등록 검증의 가변 자리수 불일치를 계약 영향과 과거 ID 호환성을 확인한 뒤 별도 작업으로 수정·검증.

## 2026-10-11 건강검진 합성 결과 보완·전체 항목 해석 — DRAFT / UNASSIGNED

이번 절이 아래 건강검진 이력보다 최신이다. 사용자 요청으로 미등록 5항목에 완전 합성 시연 결과를 추가했다. eGFR 100 mL/min/1.73㎡(임의 보고값, 앱 계산 아님), C형간염 항체 음성, 폐기능 FEV₁ 3.20L/FVC 4.10L/비율78% 및 가상 기관 소견, 흉부 X-ray 급성 이상 소견 없음(텍스트만, X-ray 영상 없음), 구강검진 치석·경미한 잇몸 염증 소견/치과 확인 안내 예시. 시력·청력에도 명시적 합성 소견을 붙였다. 실제 기관 문서·검사를 확보하거나 판독한 결과가 아니다. OPINION 탭도 임의 합성 안내문으로 채우며 자동 임상 종합판정을 생성하지 않는다. 고정 홍길동 CT·간암 전원 시나리오와 AFP/초음파는 보존한다.

23항목은 수치/정성 비교17, 합성 기관 소견5, 키 연계 해석1로 구분된다. 기관 referenceRange/interpretation 원본 필드는 null로 유지한다. 체중72kg/키170cm에서 반올림 전 BMI를 계산해 비만 전단계로 표시하고 체중·BMI를 주의항목에 중복 집계하지 않는다. 허리88cm는 남성90cm 기준 미만. 크레아티닌0.9는 일반 성인 남성0.7–1.3 참고 예시 안. 총콜레스테롤186/HDL52/LDL110/TG120의 공개 일반 분류와 개인별 치료 목표를 분리한다. HDL은 낮을 때 주의하는 방향. 요단백·HCV 항체는 허용된 정성 결과만 해석한다. 기관 소견은 별도 중립색 배지이며 임의 정상 수치 기준을 만들지 않는다. eGFR은 G1/G2/감소 수치 구간만 표시하며 한 번의 값으로 만성콩팥병을 확정하지 않는다. 합성·남성·56세 외 맥락, 값 누락·단위 오류·음수·비유한값은 비교 불가로 남긴다. 정상 범위가 기관마다 다른 점과 질환 배제 불가를 화면에 표시한다.

근거(2026-10-11 확인): [대한비만학회 2022 요약 지침](https://general.kosso.or.kr/html/user/core/view/reaction/main/kosso/inc/data/guideline2022_vol8.pdf), [MedlinePlus 크레아티닌](https://medlineplus.gov/ency/article/003475.htm), [KDCA 지질 분류](https://health.kdca.go.kr/healthinfo/biz/health/ntcnInfo/healthSourc/thtimtCntnts/thtimtCntntsView.do?thtimt_cntnts_sn=124), [KDCA 요단백](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6711), [NKF G2 설명](https://www.kidney.org/kidney-topics/stage-g2-chronic-kidney-disease-ckd), [CDC HCV 항체/RNA](https://www.cdc.gov/hepatitis-c/hcp/diagnosis-testing/), [ATS 폐기능 검사](https://site.thoracic.org/advocacy-patients/patient-resources/pulmonary-function-tests). 기존 혈압/혈당/Hb/간효소 근거는 아래 이력 참조. 이 출처들은 합성 보고서의 출처가 아니라 교육용 비교 설명의 근거이다.

분석/변경: 기존 DOM ESM `public/ui/patient-health.js`, CSS, Node 시험, 배포 exact-context Python과 시험, 이 문서. frontend-design으로 기존 Pretendard/화이트/세이지를 유지하고 REPORT/CONTEXT 배지를 구분했다. 서버 API·DB·FHIR·동의·권한·PACS·클라우드 변경 없음. 합성 fixture는 기존 authenticated syntheticScenario에만 표시되며 실제 환자 자료 없음. FR-006~009 화면 표시/FR-032~036 기존 Viewer 연결 영향; FR-001~005/014~025/037~041 계약 보존. 개별 FR 원문 부재와 NFR 번호는 추정하지 않는다.

기준선: HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존. B read-only PASS `artifacts/workstation/mobile-b-rollout-20261011T015636Z/result.json`; 기존 f1fdd1bd… healthy/암호화 설정 활성. pinned SSH에서 정확한24-overlay chain을 재관측해 allowlist에 추가(와일드카드 없음). Python context시험1/1 PASS 0.006초. Node focused10/10 PASS exit0 0.259초; 전체959/959 PASS exit0 61.938초 `artifacts/workstation/patient-screening-complete-tests-20261011.log`. 정상·경계 양끝, HDL 반대 방향, 체중 높이 누락, BMI 반올림, 정성 값 prototype/비허용값, report 부재, 합성 맥락 거부를 검증했다. Secret scan findings0 PASS, git diff check exit0(기존 CRLF 경고). 적용 전 오타 patch1건은 verification failure로 미적용, 수정 patch 및 시험 성공.

Build PASS exit0(기존 mandatory ARG 기본값 경고). 후보 `highpass-platform-mvp:capstone-mobile-screening-complete-20261011` / `sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce`; Trivy HIGH0/CRITICAL0 PASS `artifacts/security/container-scan/patient-screening-complete-20261011.json`. 배포/실제 브라우저 검증은 아래에 종료 결과를 기록한다. 복구 기준 f1fdd1bd…와 원본 Compose는 보존한다. 신규 증적은 사람 검토 전 DRAFT / UNASSIGNED이며 기존 승인 승계·commit/push·전체 MVP/v3 완료 선언 없음.

배포 종료: PASS exit0 `artifacts/workstation/mobile-b-rollout-20261011T020237Z/result.json`. f1fdd1bd…→fd703f20… 이미지/소스 hash·runtime 환경/권한/포트/mount 보존, 실제 rollback→재승격·strict TLS30경로 PASS. A/Cloud 변경 false, DB/PACS/동의 scope 변경 없음. JS SHA-256 bba47f2f1602adcab129922072ecdb3bb0d8393dd7aabcb2d711fef2bbeedcd2; CSS 084491a06e8eb4e070499b61a1c8bf2cb97d9a30293ce21a8d003073b01bba13. 명령: `python scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-screening-complete-20261011 --image-id sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce --expected-current-id sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a --scan artifacts/security/container-scan/patient-screening-complete-20261011.json` (인증정보는 stdin으로만 전달). baseline Compose/image는 보존되며 다음 배포는 신규25-overlay 구성부터 재관측해야 한다. 기존 volume 삭제 없음.

실제 HTTPS 브라우저 PASS: 시작→환자 ID/PW 로그인→내 건강기록→건강검진. 요약23결과/추가정보0 및 주의BMI·혈압·혈당3개(체중 중복 제외), 신체7개/혈액12개/추가4개/가상기관 안내, eGFR100·크레아티닌 범위·HDL 방향·정성 항체/요단백 확인. 1440px 문서1425px,390px 문서375px 가로 넘침 없음; 양쪽 캡처 시각 검토 PASS. 실제 CT Viewer 픽셀1254×1254, 1/700→2/700 및 닫기 PASS, 전체700순회는 NOT VERIFIED. 콘솔error0. 국가검진/PHR 실연계·실제 기관 결과/임상 검증·새 동의/QR/철회/전체 보안 음성 재실행·네이티브 모바일은 NOT VERIFIED. 배포 도구 browserE2E NOT VERIFIED는 도구 범위이고 별도 이번 UI 검증과 구분한다.

캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-screening-complete-desktop-20261011.png`, `patient-screening-complete-mobile-20261011.png`, `patient-screening-complete-ct-20261011.png`. 재현: 환자 웹 `https://192.168.111.149:9443/hipass/#PATIENT` → 기존 합성 계정 로그인 → 내 건강기록 → 건강검진 → 요약/신체/혈액/추가/소견. 초기 CUA 탭 조회는 browser 명시 누락으로 실패하여 inventory의 실제 탭3/browser2를 선택, 인증 우회 없음. 원문 검사결과를 생성한 것으로 주장하지 않는다. 다음 작업 한 개: 신규 후보/증적 독립 검토. 검토 DRAFT / UNASSIGNED, 전체 MVP/v3 완료 선언 없음.

## 2026-10-11 건강검진 상태·범위·쉬운 설명 — DRAFT / UNASSIGNED

현재 작업: 기존 환자 건강기록에 초록(비교 기준 안), 주황(경계), 빨강(높음/낮음), 회색(기준 없음/미등록) 배지와 문자·기호, 수치 위치 막대, 쉬운 항목 설명, 펼칠 수 있는 기준·출처를 구현했다. 요약은 먼저 살펴볼 혈압·공복혈당과 비교 불가 항목 수를 보여준다. 원래 23개 가상 값은 보존하며 기관 referenceRange/interpretation은 여전히 null이다. 실제 임상 판단 기능이 아니라 합성 홍길동·남성·56세 시나리오 전용 교육용 비교이며 다른 맥락/단위/누락/음수/비유한 값에는 적용하지 않는다. 실제 기관 판정·전체 정상·건강점수·암 진단·응급도 자동 판단 없음.

근거 확인 2026-10-11: [KDCA 당뇨병](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5305)의 공복 100~125/126 이상 기준, [NIDDK 저혈당 설명](https://www.niddk.nih.gov/health-information/professionals/diabetes-discoveries-practice/how-hypoglycemia-unawareness-affects-people-with-diabetes)의 <70 기준을 시연 비교에 사용한다(당뇨 치료 목표가 아님). [KDCA 간기능검사](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5444)의 AST/ALT 0~40, 남성 GGT 11~63 참고 예시와 [공개 NHIS 대체통보서 예시 p5](https://knpo.police.ac.kr/pds/1773965481634.pdf)의 남성 Hb 13~16.5 및 혈압 경계/상한 기준을 사용한다. ALT는 검진 통보서 35 이하와 KDCA 40 이하가 다르므로 화면에 차이를 명시했다. 기관 범위가 확보된 것처럼 주장하지 않는다. 지질 개인별 목표/크레아티닌 등 불완전한 범위/요단백 범주형 결과/AFP에는 임의 수치 경계·녹색 판정을 생성하지 않는다. 혈압은 낮은 기준 부재로 <120/<80을 무조건 녹색 처리하지 않는다.

분석/변경: 기존 DOM ESM 모듈 `public/ui/patient-health.js`, CSS, `test/patient-health.test.js`, 배포 exact-context `scripts/capstone-mobile-b-rollout.py`, `test/screening-rollout.test.py`, 이 문서만 수정. 새 프레임워크/라이브러리/서버 API/DB/FHIR/PACS 변경 없음. FR-006~009 표시와 FR-032~036 연결 영향, FR-001~005/014~025/037~041 계약 보존; NFR 번호 임의 생성 없음. frontend-design에 따라 기존 Pretendard·세이지·화이트 디자인을 유지하고 텍스트/아이콘과 색상을 조합했다. 상태 배지의 의미와 임상 한계는 UI에 직접 명시한다.

기준선: HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty 보존. B read-only `artifacts/workstation/mobile-b-rollout-20261011T013110Z/result.json` PASS, image7015bff17490ea62 healthy/암호화 활성. strict pinned SSH로 정확한 23-overlay chain을 재관측하여 wildcard 없이 기존 allowlist를 확장했다. 최초 SSH 관측 명령은 PowerShell quoting 오류로 미실행, here-string 재시도 PASS. Python unittest module 이름 실행은 hyphen import 오류 FAIL, 파일 직접 실행 재시도 1/1 PASS exit0 0.001초.

검증: focused Node6/6 PASS exit0 0.236초; 전체955/955 PASS exit0 70.885초 (`artifacts/workstation/patient-screening-colors-tests-20261011.log`). 단위 검증은 low/normal/border/high 양끝·혈압 두 수치 조합·단위/성별/연령/누락/변조 맥락을 포함하며 임상 검증이 아니다. secret scan PASS findings0; diff check PASS exit0(CRLF 경고 보존). Build PASS exit0(기존 ARG 기본값 경고). 후보 `highpass-platform-mvp:capstone-mobile-screening-colors-20261011` / `sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a`; Trivy HIGH0/CRITICAL0 PASS exit0 (`artifacts/security/container-scan/patient-screening-colors-20261011.json`).

배포 PASS exit0: `artifacts/workstation/mobile-b-rollout-20261011T013626Z/result.json`. 기준7015bff1→후보f1fdd1bd, 정확한 정적 소스 hash 검증, runtime env/mount/권한/포트 보존, 실제 rollback→재승격 및 strict TLS30경로 PASS. A/Cloud/DB/PACS 변경 없음. JS SHA-256 d5f2dc64b88538125417cab85beb2e34096b19b30f2a6225117f9bc22408f810; CSS 7bf4de504b8ebb3e10da6eee9c50e3380a88a693ae3aebb1213838d2f36b7f12. 복구 baseline 이미지7015bff1과 원본 Compose를 보존했으며 volume 삭제 없음. 명령: `python scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-screening-colors-20261011 --image-id sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a --expected-current-id sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905 --scan artifacts/security/container-scan/patient-screening-colors-20261011.json` (credential은 stdin만). 다음 배포 전에는 신규24-overlay 구성을 다시 관측해야 한다.

실제 HTTPS 브라우저 로그인→내 건강기록→건강검진 요약/혈액·소변/추가 검사 및 기준 펼치기 PASS. 12개 혈액 항목 중 초록4/주황1/회색7; 추가4항목 모두 회색 미등록, 요약 혈압/혈당 주황2와 숫자/단위/설명/출처 확인. 빨강 low/high는 focused 단위 테스트와 UI 범례로 검증했으며 가상 값을 변조해서 빨간 결과를 만들지는 않았다. 실제 환자 상태에 대한 판정은 아니다. 고정 CT 본인 Viewer 1254×1254 및 1/700→2/700 이동/닫기 PASS; 전체700장 순회 NOT VERIFIED. 1440/390px 반응형 문서폭1425/375px 각각 넘침 없음, 모바일 수치 막대3개 표시, 실제 캡처 시각 검토, 콘솔 error0. 임시 viewport 원복. 네이티브 모바일 앱이 아니라 환자 웹의 좁은 화면 검증이다.

캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-screening-colors-desktop-20261011.png`, `patient-screening-colors-mobile-20261011.png`, `patient-screening-colors-ct-20261011.png`. 재현: B `https://192.168.111.149:9443/hipass/#PATIENT` → 기존 시연 환자 로그인 → 내 건강기록 → 건강검진 → 요약/혈액·소변 → 기준과 해석 알아보기. 신규 증적은 DRAFT / UNASSIGNED. 실제 임상 해석·국가망 실연계·전체 동의/QR/철회 음성 회귀·네이티브 모바일 앱은 NOT VERIFIED. commit/push·전체 MVP/v3 완료 선언 없음. 다음 작업 한 개: 이번 범위 표시·출처·미등록 처리와 배포 후보에 대한 독립 검토.

## 2026-10-11 일반건강검진 결과 구현 — DRAFT / UNASSIGNED

기존 건강기록에 인증된 합성 시나리오 전용 `2026 건강검진`을 추가했다. 일반검진은 CT·간 초음파·AFP와 별도 기록이다. 요약/신체·감각/혈액·소변/추가 검사/기관 소견 다섯 영역, 건강검진 필터, 독립 검사 이동을 제공한다. 건강점수·임상 진단·참고범위 자동 생성 없음. eGFR/흉부/구강/C형간염/폐기능 및 기관 소견은 미등록이며 정상 결과로 대체하지 않는다. 23개 항목의 가상 수치·단위·상태만 제공하고 FHIR/DB/PACS 쓰기·동의 scope 확대는 없다. 시연 이름 홍길동·56세는 가상 설정이며 실환자 자료가 아니다.

항목 근거(2026-10-11 확인): [질병관리청 일반·연령별 국가건강검진](https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=6671), [일산병원 지질검사 항목·4년 주기](https://www.nhimc.or.kr/health/conts/104001000000000.do). 56세 C형간염/폐기능은 대상 안내이며 실제 대상자 확인 아님. 간 초음파·AFP는 별도 시연 이력이며 국가 간암검진 대상 판정을 하지 않는다. 공식 결과통보서 자체를 완전히 재현했다고 주장하지 않는다.

변경 파일: `public/ui/patient-health.js`, `public/ui/patient-health.css`, `test/patient-health.test.js`, `scripts/capstone-mobile-b-rollout.py`, 신규 `test/screening-rollout.test.py`, 이 문서. frontend-design으로 기존 Pretendard/화이트/세이지/절제 블루 및 DOM escaping을 유지했다. ui-ux-pro-max 검색은 적합한 항목 미발견으로 기존 디자인·일반 접근성 원칙 적용. 새 프레임워크/의존성/서버 API/DB/정책 변경 없음. 관련 FR-006~009/032~036, FR-001~005·014~025 기존 계약 보존; 별도 NFR 번호 추정 없음.

현재 확인: HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31 + dirty. B read-only baseline `artifacts/workstation/mobile-b-rollout-20261011T010825Z/result.json` PASS, image 1a62fa81… healthy/암호화 활성. 처음 두 trusted-baseline 시도는 요구 scope 불일치로 TRUST_BASELINE_NOT_VERIFIED/exit1, VM 변경 없이 종료; 기존 LocalVmTrust로 재확인했다. 별도 SSH labels 관측의 첫 시도는 shell quoting syntax error, 두 번째는 Docker 권한 거부로 읽기 실패; sudo 읽기 재시도로 정확한 22개 overlay를 관측하여 allowlist에 추가했다. 와일드카드 허용 없음.

검증: focused Node5/5 PASS exit0 0.197초; 전체 Node953/953 PASS exit0 61.806초 (`artifacts/workstation/patient-screening-tests-20261011.log`), Python exact-context1/1 PASS exit0 0.001초, secret scan findings0 PASS, git diff --check exit0(CRLF 경고 보존). exact-base build PASS exit0(기존 필수 ARG 기본값 경고), 후보 `highpass-platform-mvp:capstone-mobile-screening-20261011` / `sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905`, Trivy HIGH0/CRITICAL0 exit0 (`artifacts/security/container-scan/patient-screening-20261011.json`).

배포 결과: `artifacts/workstation/mobile-b-rollout-20261011T011326Z/result.json` PASS exit0. baseline 1a62fa81…→후보 7015bff1…, 정적 소스 hash·runtime 구성 보존, 실제 rollback 및 재승격·strict TLS30경로 PASS. A/Cloud/DB/PACS 변경 없음. 복구 기준 이미지/원본 Compose는 배포 증적에 보존되며 임의 `down`/volume 삭제를 하지 않는다. 명령: `python scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback --image highpass-platform-mvp:capstone-mobile-screening-20261011 --image-id sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905 --expected-current-id sha256:1a62fa81c7a91953f9b86ce040f05c93610c57a5b59e2366d02f8a3d93ee6141 --scan artifacts/security/container-scan/patient-screening-20261011.json` (인증정보는 stdin으로만 전달). 재배포 전에 현재 image/23-overlay 구성부터 다시 확인해야 하며 이번 allowlist는 다음 배포로 자동 확장되지 않는다.

실제 B HTTPS 브라우저 로그인→내 건강기록→2026 건강검진 PASS. 요약3수치·신체7항목·혈액12항목·추가4미등록·기관소견 미등록, ‘전체 결과 확인’, 검진 단독 필터·AFP24.6 연결 및 검색 `<script>` 문자열의 빈 상태/상세 숨김/복원 PASS. CT 본인 Viewer 픽셀1254×1254, 1/700→2/700 및 닫기 PASS; 전체700장 순회는 NOT VERIFIED. 1440px/문서1425px 및390px/문서375px 가로 넘침 없음, 실제 모바일 전체 캡처 시각 검토 PASS. 콘솔 error0. CT·일반검진·초음파·AFP 분리 및 고정 CT 보존. 신규 동의/QR/철회·보안 음성 전 범위 재실행, 국가서비스 실연계, 임상 판정, 네이티브 모바일 구현은 NOT VERIFIED. 배포 도구의 browserE2E NOT VERIFIED는 도구의 범위이며 이번 UI 검증과 전체 제품 E2E는 구분한다.

캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-screening-desktop-20261011.png`, `patient-screening-mobile-20261011.png`, `patient-screening-ct-slice2-20261011.png`. 재현: `https://192.168.111.149:9443/hipass/#PATIENT` → 기존 환자 로그인 → 내 건강기록 → 건강검진 → 다섯 영역 확인. 기존 건강기록 DOM 모듈만 수정했고 신규 파일은 배포 allowlist 시험 1개다. Python 추가1/1 및 기존 rollout3/3 PASS exit0; JS syntax PASS. 다음 작업 한 개: 이번 후보의 독립 검토. 신규 증적 DRAFT / UNASSIGNED, 기존 검토 승계 없음. commit/push·전체 MVP/v3 완료 선언 없음.

## 2026-10-11 내 건강기록 아이콘·합성 초음파·가상 AFP — DRAFT / UNASSIGNED

이번 항목이 아래의 ‘자료 준비 전’ 이력보다 최신이다. frontend-design으로 기존 Pretendard/화이트/세이지/절제된 블루를 보존하고 Unicode 기호 대신 접근성 텍스트와 함께 SVG 검사 아이콘을 구현했다. 인증된 합성 시나리오에만 AFP 2025-10-08 6.2, 2026-04-08 8.4, 2026-10-08 24.6 ng/mL를 표시한다. 임의 시연 수치이며 참고범위·정상/이상·간암 판정을 생성하지 않는다. 날짜별 독립 선택, 수치 표, 간 초음파 이미지·설명을 제공한다. 초음파는 세 날짜 모두 같은 예시이며 실제 검사·DICOM·판독 자료가 아니다. FHIR/DB/PACS에 저장하거나 CT 동의 scope에 추가하지 않는다.

imagegen built-in으로 생성한 프로젝트 자산: `public/images/mediq-synthetic-liver-ultrasound-v1.png`. 프롬프트: “완전 합성 비임상 간 초음파형 흑백 B-mode 정지 이미지, 검은 바탕의 곡선 부채꼴, 미세 speckle와 깊이 감쇠, 간 실질과 어두운 혈관형 구조 및 밝은 곡선 횡격막, 실환자·진단·병변 화살표·측정값·날짜·병원·개인식별자·브랜드 없음, 하단 SYNTHETIC / NOT FOR CLINICAL USE 표시.” 생성 원본은 Codex generated_images의 exec-8a7d0a59-9f59-4db0-afd8-daf93e046089.png이며 원본을 보존하고 복사했다. 화면에서도 비임상을 명시한다. 일반 이미지 생성은 이 예시 PNG에만 사용하며 고정 CT 볼륨을 수정하지 않는다.

변경 파일: `public/ui/patient-health.js`·`patient-health.css`, `public/images/mediq-synthetic-liver-ultrasound-v1.png`, `test/patient-health.test.js`·`presentation-bundle.test.js`, `Dockerfile.hcc-main-scenario`, `scripts/capstone-mobile-b-rollout.py`, 이 문서. 동일 dashboard 데이터 재수신 시 불필요한 redraw/preview 취소를 막는 signature guard를 추가했다. 기존 CT 썸네일 실패 원인은 아직 확정하지 않았으며 브라우저 확인 전 PASS로 승격하지 않는다. API/DB/인가 계약 변경 없음. 관련 FR-006~009/032~036, 동의 FR-001~005·인가 FR-014~025 보존. NFR 번호 추정 없음.

기준 read-only PASS: `artifacts/workstation/mobile-b-rollout-20261011T004453Z/result.json`, B 기준 sha256:62396d56ab6d53db2a570b014575c8601a7666ae55c14cceda8b941c0d3d0b0c. 전체 Node 952/952 PASS exit0 62.037초: `artifacts/workstation/patient-health-records-tests-20261011.log`. 이후 Dockerfile 자산 포함 검증 추가 focused4/4 PASS exit0 0.158초, Python3/3 PASS 0.004초. exact-base build exit0(기존 mandatory ARG 기본값 경고), 후보 sha256:1a62fa81c7a91953f9b86ce040f05c93610c57a5b59e2366d02f8a3d93ee6141, Trivy HIGH0/CRITICAL0 exit0: `artifacts/security/container-scan/patient-health-records-20261011.json`. 첫 배포 시도는 tag allowlist에서 INVALID_IMAGE_ARGUMENTS로 중단되어 VM 변경 없음. 동일 후보에 허용 tag capstone-mobile-health-records-20261011을 부여해 재실행한다. 신규 사람 검토 승계·commit/push·전체 MVP/v3 완료 선언 없음.

배포 결과: `artifacts/workstation/mobile-b-rollout-20261011T005021Z/result.json` PASS exit0, 동일 image ID 1a62fa81…, 정적 소스 hash 확인, runtime 설정 보존, 실제 rollback/re-promotion 및 strict TLS30경로 PASS. A/Cloud 변경 false. 복구 기준 이미지는 62396d56…이며 원본 Compose와 baseline 이미지를 보존했다. 합성 초음파 PNG SHA-256 e75f8b40901ea1ebf1ee1adce4d7173a68f18bdb5ca916c829118d944065832c. Secret scan PASS findings0, focused 최종4/4 PASS exit0 0.190초.

2026-10-11 약09:54~09:58 KST 실제 브라우저 PASS: 기존 환자 ID/PW 로그인→내 건강기록, SVG7개, 초음파 이미지 natural1448×1086/hiddenfalse, AFP24.6 및 날짜 선택8.4, 혈액 필터3건·검색 빈 상태·복원, CT 실제 DICOM 썸네일 natural1254/hiddenfalse, 기존 Viewer 실제 픽셀1/700→2/700. 이전 배포의 썸네일 FAIL 이력은 보존하며 이번 새 실행의 표시 PASS만 기록한다. 동일 데이터 redraw 취소 방지 변경 이후 표시됐으나 과거 실패 원인 확정은 아님. desktop1440/문서1425 및 mobile390/문서375로 overflow 없음, console error0. Viewer 대기 검증의 exact-text 선택자 `2 / 700`은 실제 전체 문구와 불일치하여 timeout; 새 상태에서 ‘실제 합성 DICOM 영상 2 / 700 · 승인된 Series · VIEW_ONLY’와 픽셀 이미지를 확인했다. 신규 동의·QR·철회 및 전체 보안 음성 E2E는 이번 작업에서 NOT VERIFIED.

실제 캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-health-ultrasound-20261011.png`, `patient-health-afp-20261011.png`, `patient-health-records-mobile-20261011.png`, `patient-health-records-ct-slice2-20261011.png`. 다음 작업 한 개: 이 합성 기록 UI 후보의 독립 검토. 국가 서비스 실제 연계/임상 사용은 NOT VERIFIED이며 시연 자료로만 제공한다. 신규 증적 DRAFT / UNASSIGNED, commit/push 없음.

## 2026-10-11 내 건강기록 검사별 시안 구현 — DRAFT / UNASSIGNED

PHR 메뉴를 ‘내 건강기록’으로 변경하고 날짜별 그룹 안에서 간 초음파·혈청 AFP를 독립 선택하는 목록과 세이지 상세 패널을 구현했다. frontend-design의 기존 시안·정보 계층 원칙으로 자체 호스팅 Pretendard/화이트/세이지/절제된 블루를 유지한다. 기존 FHIR 조회·매핑·동의 경로는 ‘표준 데이터 확인’ 접힘 영역에 보존했다. Node ESM/DOM 및 API/DB/서버 권한 계약은 변경하지 않는다. 관련 FR-006~009, FR-032~036, 기존 동의 연결 FR-001~005 및 인가 보존 FR-014~025. 개별 NFR 번호는 추정하지 않는다.

검진 fixture는 인증된 홍길동 합성 시나리오에서만 2025-10-08/2026-04-08/2026-10-08의 초음파·AFP를 각각 표시한다. 이 기록은 시안용 합성 자료이며 FHIR provider/DB/PACS에 등록하지 않고 CT 동의 scope에 자동 포함하지 않는다. AFP 값·참고범위·판독·초음파 영상을 만들지 않으며 준비 전으로 표시한다. 국가 서비스 실제 연계 전을 명시한다. CT는 본인 API의 실제 등록 Study/Series/count를 표시하고 기존 DPoP·암호화·감사 경로의 첫 frame만 미리보기로 조회한다. 화면 이탈/만료/검색·선택 변경 시 취소·URL 해제, 늦은 응답 폐기, 거부 시 대체 이미지 없음. 영상 보기와 공유 확인은 기존 Viewer 및 명시적 승인 화면으로 연결한다. 승인/QR/철회를 자동 실행하지 않는다. textContent로 사용자 입력을 표시하며 저장소·감사 API를 추가하지 않는다.

변경 파일: 신규 `public/ui/patient-health.js`·`patient-health.css`, `test/patient-health.test.js`, `public/app.js`·`public/index.html`, `Dockerfile.hcc-main-scenario`, `test/presentation-bundle.test.js`, `scripts/capstone-mobile-b-rollout.py`, 이 문서. 기존 미커밋 변경·합성 CT·동의 데이터를 보존한다. 신규 증적은 DRAFT / UNASSIGNED이며 과거 사람 승인을 승계하지 않는다. commit/push 및 전체 MVP/v3 완료 선언은 하지 않는다.

기준 B read-only PASS: `artifacts/workstation/mobile-b-rollout-20261011T002314Z/result.json`, 기준 이미지 `sha256:2e56b6d1043e4761576b16f7826f01e27c63f65920e1ce71148dcdb47557f155`. 최종 후보 `highpass-platform-mvp:capstone-mobile-health-final-20261011` / `sha256:62396d56ab6d53db2a570b014575c8601a7666ae55c14cceda8b941c0d3d0b0c`, exact-base build exit0(기존 필수 ARG 기본값 경고 잔존). Trivy HIGH/CRITICAL0 exit0: `artifacts/security/container-scan/patient-health-final-20261011.json`. focused10/10 PASS exit0,0.396초, Python 배포3개 PASS. 최초 전체952/952 PASS exit0,73.671초는 미리보기 연결 전 코드다. 미리보기 연결 후 전체951/952 PASS,1 FAIL exit1,82.160초: `artifacts/workstation/patient-health-final-tests-20261011.log`. 실패는 Privacy isolated HTTP의4개 시나리오이며 원인은 확정하지 않았다. 해당 시험 단독2/2 PASS exit0,7.301초이며 전체 실패를 소급 PASS 처리하지 않는다.

최종 전체 재실행952/952 PASS exit0,57.207초: `artifacts/workstation/patient-health-final-retry-tests-20261011.log`. B 배포·실제 rollback·재적용·strict TLS29경로 PASS exit0: `artifacts/workstation/mobile-b-rollout-20261011T002924Z/result.json`. runtime 설정·정적 소스 해시·readiness를 확인했고 A/Cloud 변경 false. 복구 기준은 위2e56b6d… 및 rollout에 보존한 원본 Compose다.

2026-10-11 약09:32~09:38 KST 실제 브라우저에서 기존 시연 로그인→내 건강기록→초음파/AFP 독립 상세→과거AFP2026-04-08→혈액 필터3건→검색 빈 상태 및 복원을 확인했다(PASS). CT의 기존 Viewer에서 실제 합성픽셀1/700→2/700 표시 PASS. 공유 확인 연결에서 본인 CT700장·미선택 확인란·disabled 승인 버튼을 확인했고 신규 동의/철회/QR를 실행하지 않았다. 1440×1000 문서폭1425≤1440 및390×844 문서폭375≤390 PASS, console error0. 실제 desktop/mobile/Viewer 캡처는 `artifacts/workstation/mediq-landing-browser-20261010/patient-health-desktop-20261011.png`, `patient-health-mobile-20261011.png`, `patient-health-viewer-slice2-20261011.png`다.

CT 목록 썸네일은 **FAIL / 미표시**로 남는다. visible 대기 실패 후 DOM에서 hidden=true/naturalWidth0/src없음을 확인했으며 Viewer 픽셀 성공과 별개다. 원인은 이번 확인에서 확정하지 않았고 임의 예시사진으로 대체하지 않았다. 다음 작업 한 개는 이 미리보기 표시 경로의 원인 확인·수정·재검증이다. 국가 서비스 실연계, 초음파 영상/AFP 수치, 전체700장 순회·전체 영상 E2E·실제 신규 동의/철회는 NOT VERIFIED. 배포 도구의 browserE2E NOT VERIFIED는 도구 범위이며 이번 UI/두 slice 확인으로 전체 제품 PASS를 승격하지 않는다. 재현: B `/hipass/#PATIENT` 로그인→내 건강기록→검사별 기록 선택; CT 선택→영상 보기 또는 공유 내용 확인. 신규 증적 DRAFT / UNASSIGNED, commit/push 및 전체 MVP/v3 완료 선언 없음.

## 2026-10-11 공유 이력 시안 구현 — DRAFT / UNASSIGNED

환자 공유 이력을 연결 패스·유효/종료 필터·병원/검사 검색·날짜별 기록과 세이지 상세 패널로 구현했다. frontend-design의 기존 시안·정보 계층 유지 원칙으로 Pretendard/화이트/세이지/절제된 블루를 유지했다. 기존 Node ESM/DOM·본인 동의 조회 API를 재사용하며 새 API/DB/권한 계약을 만들지 않는다. 관련 FR-001~005, FR-006~009, FR-014~020. 상세 접수·열람 이력은 기존 환자 API에 연결되지 않았으므로 ‘기록 연동 전’으로 표시한다. 관리자 감사 API·Token·직원 ID를 환자에게 노출하지 않는다. 승인시각이 없으면 validFrom을 승인시각으로 주장하지 않으며, 지난 기록의 날짜는 공유 시작일이라고 구분한다. 미래 시작 ACTIVE는 확인 필요, 기한 경과 ACTIVE는 만료로 표현하며 서버 권한은 그대로 유지한다.

변경: 신규 `public/ui/patient-history.js`·`patient-history.css`, 신규 `test/patient-history.test.js`, `public/index.html`·`public/app.js`, `Dockerfile.hcc-main-scenario`, `test/presentation-bundle.test.js`, `scripts/capstone-mobile-b-rollout.py`, 이 문서. 공유 조건·중단 관리 버튼은 기존 관리 화면으로만 이동하고 직접 철회·동의·QR를 생성하지 않는다. 사용자 입력은 textContent로 표시하고 이력을 삭제하지 않는다. 새로고침 실패는 마지막 조회 결과라고 명시한다. 기존 동의/PACS/미커밋 변경을 보존한다.

HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. B read-only baseline PASS: `artifacts/workstation/mobile-b-rollout-20261010T234803Z/result.json`, 이미지 `sha256:7031ff65358cb3c09889e6f4484ff05680420755d213a23e1f2b33f032591c22`. 후보 `highpass-platform-mvp:capstone-mobile-history-20261011`, 이미지 `sha256:1542825d8ce5fba651c8af1cc18885003a54bb753a758af04f567d4797751de0`. build exit0, 기존 필수 base ARG 기본값 경고는 남음. 최초 scan은 build 종료 전 이미지 미존재로 exit1/ENVIRONMENT_BLOCKED; build 완료 후 재실행 exit0, HIGH/CRITICAL0: `artifacts/security/container-scan/patient-history-20261011.json`.

Focused16/16 PASS exit0,0.417초. 전체949/949 PASS exit0,58.091초: `artifacts/workstation/patient-history-tests-20261011.log`. 기존 감사 receipt ID 길이 문제는 이번에 수정하지 않았으며 이번 테스트 PASS를 결함 해소로 해석하지 않는다. 최초 B 배포·실제 rollback·후보 재적용·strict TLS27경로 PASS exit0: `artifacts/workstation/mobile-b-rollout-20261010T235033Z/result.json`. 기존 runtime 설정·암호화/readiness·전체 정적 소스 해시 확인, A/Cloud 변경 false. 실제 브라우저 로그인→공유 이력에서 ACTIVE1/EXPIRED1·복부 CT700장·동의 범위 확인, 종료 필터·검색 빈 상태·서버 새로고침 성공·기존 관리 화면 연결을 확인했다. 실제 웹에서 제목이 기존CSS에 의해26px로 축소되는 것을 관측해 후속 후보에서 더 구체적인 선택자로 보완했다.

후속 후보 `highpass-platform-mvp:capstone-mobile-history-v2-20261011` / `sha256:2e56b6d1043e4761576b16f7826f01e27c63f65920e1ce71148dcdb47557f155`: 큰 제목 복원·현재 카드 조건을 가로 정렬·지난 기록 압축·상세 패널 닫힘 유지와 aria-expanded 일치 보완. build exit0, Trivy HIGH/CRITICAL0 exit0: `artifacts/security/container-scan/patient-history-v2-20261011.json`. 최종 focused11/11 PASS exit0,0.199초 및 전체949/949 PASS exit0,58.226초: `artifacts/workstation/patient-history-v2-tests-20261011.log`. 동의 경쟁조건8/8 PASS exit0, 배포 관련Python3개 PASS exit0. B 최종 배포·실제 rollback·재적용·strict TLS27경로 PASS exit0: `artifacts/workstation/mobile-b-rollout-20261010T235754Z/result.json`. 최종 실행 이미지는 위2e56b6d…이며 정적 소스·runtime 보안 설정·readiness를 확인했다. A/Cloud 변경 false.

2026-10-11 약09:00 KST 최종 배포에서 실제 브라우저 로그인→공유 이력→유효/종료 필터→검색 빈 상태→기록 상세 열기/닫기를 확인했다(PASS). ACTIVE1/EXPIRED1, CT700장과 실제 진료/열람만 조건을 표시했다. 닫힘과 aria-expanded가 일치하며 검색 빈 상태에는 상세가 숨겨진다. 1440×1000에서 제목51.84px·문서폭1425≤1440, 390×844에서 문서폭375≤390으로 가로 넘침이 없다. 신규 console error0. 실제 캡처 `artifacts/workstation/mediq-landing-browser-20261010/patient-history-v2-desktop-20261011.png`, `patient-history-v2-mobile-20261011.png`를 시각 검토했다. 접수/열람 기록은 연동 전으로 명시하고 허구 완료를 표시하지 않는다. 배포 도구의 browserE2E NOT VERIFIED는 그 도구의 범위이며 이번 수동 UI 확인을 전체 영상 E2E로 승격하지 않는다.

재현: `https://192.168.111.149:9443/hipass/#PATIENT` 로그인→공유 이력→필터/병원·검사 검색→기록 보기. 복구 기준은 이전1542825… 이미지 및 최종 rollout에 보존된 원본 Compose이며 실제 rollback을 검증했다. 전체 영상 E2E·실제 신규 철회·접수/열람 이력 연동은 NOT VERIFIED. 기존 동의·PACS 및 미커밋 변경은 보존했고 신규 승인·철회·QR 발급은 실행하지 않았다. 신규 증적 DRAFT / UNASSIGNED로 기존 사람 승인을 승계하지 않는다. commit/push 및 전체 MVP/v3 완료 선언은 하지 않는다. 다음 작업 한 개는 기존 감사 receipt ID 길이 계약 불일치 수정·회귀 검증이다.

## 2026-10-11 새 공유 초안 조건 설정 — DRAFT / UNASSIGNED

환자 동의·공유 화면의 새 공유 초안에서 검사·수신 병원·목적(진료/전원/협진)·허용 작업(열람만/열람·다운로드)·시작/종료 시각을 직접 설정한다. 변경 가능한 기본값은 전원/VIEW_ONLY/현재부터7일이며 7일은 최대 정책 한도가 아니다. 연구 공유는 이 진료용 초안에서 제공하지 않으며 별도 가명처리·반출 정책 영역으로 남긴다. 시각은 브라우저의 로컬 시간대로 입력하고 기존 승인 API에서는 ISO 시각으로 변환한다. 승인된 최대 공유기간 계약을 이번 코드에서 확인하지 못했으므로 임의 한도나 무제한 옵션을 추가하지 않는다.

초안만으로 서버 요청/동의/QR를 만들지 않는다. 유효한 초안만 기존 명시적 승인 화면에 전달하며 목적·permission·시작/종료 값을 모두 복사하고 확인란을 해제한다. 승인 화면의 이용 조건 입력은 접힌 세부 설정 밖으로 옮겼다. 빈 시각·잘못된 enum·시작 이후가 아닌 종료·이미 지난 종료·제공/수신기관 동일은 초안에서 차단하고 기존 서버 입력/접근 검증을 유지한다. 초안은 메모리에만 두며 배경 목록 갱신에서 사용자 입력을 덮어쓰지 않는다. 다운로드 허용 시 저장 자료를 공유 중단으로 회수할 수 없다는 경고를 표시한다. 병원 의료진의 실제 목적·행위도 승인 조건과 일치해야 하며 이 UI가 자동으로 병원 권한을 바꾸지 않는다.

기준 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. 변경은 `public/index.html`, `public/app.js`, `public/ui/patient-sharing.js`, `public/ui/patient-sharing.css`, `test/patient-sharing.test.js`, `scripts/capstone-mobile-b-rollout.py`, 이 상태 문서다. 기존 Node ESM/DOM과 서버 계약을 유지했다. frontend-design의 기존 시안·정보 계층 유지 원칙에 따라 Pretendard/화이트/세이지/절제된 블루와 기존 공유 패스를 유지하고 새 입력만 확장했다. 관련 FR 기능군: FR-001~005, FR-006~009, FR-014~025. 새 서버 API/DB/권한 모델/클라우드 자원은 추가하지 않으며 개별 NFR 번호를 추정하지 않는다.

기준 B read-only 확인 `artifacts/workstation/mobile-b-rollout-20261010T231309Z/result.json`: `sha256:5b86a9d33d74a7a4d273922f7b46dd24a1025b7e04954a61eb74838b7be5bde2`, readiness/암호화 PASS. 후보 `highpass-platform-mvp:capstone-mobile-sharing-draft-20261011` / `sha256:7031ff65358cb3c09889e6f4484ff05680420755d213a23e1f2b33f032591c22`. build 종료0(필수 base ARG 명시, 기존 기본값 lint 경고 잔존). Trivy HIGH/CRITICAL0, 종료0: `artifacts/security/container-scan/patient-sharing-draft-20261011.json`.

Focused20/20 PASS, 0.308초. 최종 전체 Node 회귀945/945 PASS, 종료0,66.509초: `artifacts/workstation/patient-sharing-draft-tests-20261011.log`. 이전에 관측한 감사 receipt 가변 길이와 operator16자리 계약 불일치는 이번에 수정하지 않았다. 이번 실행에서 통과했다고 그 결함이나 과거 FAIL을 소급 해소하지 않는다.

B 배포·실제 rollback·후보 재적용 PASS, 종료0: `artifacts/workstation/mobile-b-rollout-20261010T231805Z/result.json`. 정적 파일 소스 해시·runtime 설정·암호화/readiness 및 strict TLS25경로를 확인했다. A/Cloud 변경은 false다. 복구 기준은 위5b86a9… 이미지와 rollout에 보존된 원본 Compose다.

2026-10-11 약08:21 KST 이후 실제 브라우저에서 기존 시연 계정 로그인→동의·공유→B 선택→협진/다운로드 허용/2026-10-11 10:00~10-12 10:00 입력→승인 요약에 동일 조건 전달을 확인했다(PASS). 종료를2020년으로 바꾸면 오류 안내와 초안 진행 disabled를 확인했다(PASS). 승인 화면의 확인란은 미선택이며 승인 disabled였고, 확인란을 선택한 후 권한을 바꾸면 확인란이 다시 해제되고 승인이 비활성화됐다(PASS). 관리 화면으로 돌아와 입력 유지도 확인했다. 마지막에는 전원/VIEW_ONLY/초기7일 초안으로 복원했다. 기존 B ACTIVE1건/EXPIRED1건을 유지하며 최종 승인·QR 생성·철회를 실행하지 않았다.

1440×1000 desktop 및390×844 mobile 표시 PASS, mobile 문서폭375≤390, 브라우저 신규 console error0. 캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-sharing-draft-desktop-20261011.png`, `patient-sharing-draft-review-20261011.png`, `patient-sharing-draft-mobile-20261011.png`. 배포 도구 JSON의 browserE2E NOT VERIFIED는 도구 자체의 범위다. 이 수동 입력·화면 연결 검증을 실제 영상 E2E로 확대하지 않는다.

재현: B 웹 `/hipass/#PATIENT` 로그인→동의·공유→새 공유 검사/병원/목적/작업/기간 선택→‘이 초안으로 공유 내용 확인’. 실제 신규 동의/다운로드 허용/철회/새 조건의 영상 E2E는 NOT VERIFIED다. 기존 동의·PACS·A/Cloud 및 미커밋 변경은 보존했다. 신규 증적 DRAFT / UNASSIGNED, commit/push하지 않았으며 전체 MVP/v3 완료를 선언하지 않는다. 다음 작업 한 개는 이전에 관측한 감사 receipt 가변 길이와 operator 계약 불일치를 수정·회귀 검증하는 것이다.

## 2026-10-11 동의·공유 시안 구현 — DRAFT / UNASSIGNED

환자 웹의 동의·공유 메뉴를 공유 관리 화면으로 분리했다. 승인된 동의는 수신기관·목적·권한·유효기간·allowed Study/Series 범위의 읽기 전용 내역으로 표시한다. 큰 공유 패스, 세이지 우측 영역, 자체 호스팅 Pretendard와 절제된 블루를 유지하며 frontend-design의 기존 시안 충실도·정보 계층·기존 스택 유지 원칙을 적용했다. 지난 공유는 만료/중단 상태로 분리하고 자동 갱신하지 않는다.

새 공유에서는 실제 등록된 검사와 MVP 설정 병원 A/B/C를 선택한다. 제공 병원은 새 선택지에서 제외한다. 목록은 실시간 서버 병원 디렉터리가 아니며 등록/ACTIVE 여부·소속·scope는 기존 서버가 검증한다. 선택만으로 API mutation/동의/QR를 만들지 않는다. 기존 명시적 승인 화면으로 초안을 넘기고 확인란을 해제한다. 그 화면에서도 수신 병원을 직접 변경할 수 있고 변경 시 기존 동의 선택·QR 표시를 정리한다. 기존 ACTIVE 동의의 수신기관을 수정하지 않는다. 공유 중단은 확인창 뒤 정확한 consentId로 기존 서버 철회 경로를 사용하며 서버 응답 전 성공으로 표시하지 않는다.

기준 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. B 기준선 읽기 전용 확인: `artifacts/workstation/mobile-b-rollout-20261010T224936Z/result.json`, 이미지 `sha256:575ac324f495cc2d69d4dd67efd761ad73ee76794b446d5559ffe72a0e243058`. 현재 B 태그 `highpass-platform-mvp:capstone-mobile-sharing-v2-20261011`, 이미지 `sha256:5b86a9d33d74a7a4d273922f7b46dd24a1025b7e04954a61eb74838b7be5bde2`. 후보 build 종료 0, Trivy HIGH/CRITICAL 0: `artifacts/security/container-scan/patient-sharing-v2-20261011.json`. B 적용·원본 복구·후보 재적용 및 strict TLS 25경로 PASS, 종료0: `artifacts/workstation/mobile-b-rollout-20261010T230217Z/result.json`. 실행 설정·암호화/readiness·전체 정적 소스 해시를 확인했고 A/Cloud 변경은 false다. build의 필수 ARG 기본값 경고는 남아 있으나 실제 빌드에는 기존 기준 이미지 ARG를 명시했다.

실제 Codex 브라우저에서 2026-10-11 약08:05~08:09 KST 기존 시연 계정 로그인→동의·공유 메뉴→B ACTIVE 공유와 지난 EXPIRED 공유 표시→가상 병원 C 선택→C 대상 명시적 승인 화면(확인란 미선택, 승인 disabled)→확인란 선택 후 B로 변경 시 확인란 재해제→관리 화면으로 복귀를 확인했다. 기존 B ACTIVE 1건/EXPIRED 1건이 유지됐다. 읽기 전용 공유 상세의 병원·목적·기간·검사 범위를 확인했다. 1440×1000 및390×844 표시, 좁은 화면 scrollWidth375≤390, 신규 콘솔 error0을 확인했다. 카메라·새 승인·QR 발급·실제 철회·기관 C 종단 성공을 의미하지 않는다. 캡처는 `artifacts/workstation/mediq-landing-browser-20261010/patient-sharing-desktop-20261011.png`, `patient-sharing-review-20261011.png`, `patient-sharing-mobile-20261011.png`다. 배포 JSON의 browserE2E NOT VERIFIED는 배포 도구만의 범위이며 이 수동 UI 확인으로 전체 영상 E2E를 승격하지 않는다.

변경: 신규 `public/ui/patient-sharing.js`·`patient-sharing.css`, `public/app.js`·`public/index.html`, `Dockerfile.hcc-main-scenario`, `scripts/capstone-mobile-b-rollout.py`, `test/presentation-bundle.test.js`, 신규 `test/patient-sharing.test.js`, 이 문서. 관련 FR 기능군은 FR-001~005(동의 생성·철회·이력), FR-006~009(검사 메타데이터), FR-014~025(기존 서버 정책·단기 토큰 보존). 서버/API/DB 계약은 변경하지 않았고 새 NFR 번호를 추정하지 않는다. A/Cloud/PACS 데이터와 기존 미커밋 변경을 보존하며 commit/push는 수행하지 않는다.

Focused 18/18 PASS(공유 화면4·review5·동의 경쟁조건8·패키징1), 초안 보완 후 관련17/17 재실행 PASS. 전체 초기 dot 실행은 종료0이나 숫자 요약을 보존하지 않았으며 최종 spec 재실행은 **942/943 PASS, 1 FAIL**, 66.306초: `artifacts/workstation/patient-sharing-tests-20261011.log`. 실패는 기존 `test/hcc-source-operator-contract.test.js`의 감사 receipt ID 길이 계약이다. 단독 재실행 PASS지만 전체 FAIL을 승격하지 않는다. `src/domain.js` makeId는 Uint32 2개를 zero padding 없이 hex 연결하며 기존 operator는 `^audit_[a-f0-9]{16}$`만 수용한다. 로컬 비영속 1000개 생성 확인에서 14/15/16자리, 124개 거부를 관측했다. UI와 별개인 실제 계약 불일치로 남기며 이번 UI 배포가 이를 해결했다고 주장하지 않는다.

미검증: C병원 실제 등록·활성 상태 및 C 대상 승인/QR/영상 종단 흐름, 신규 동의·철회 실제 mutation 회귀, 전체 MVP/v3. 신규 증적의 사람 검토는 UNASSIGNED다. 이번 브라우저 확인에서는 기존 공유를 만들거나 철회하지 않는다.

재현: `https://192.168.111.149:9443/hipass/#PATIENT` 로그인 후 동의·공유→검사와 받는 병원 선택→공유 내용 확인. 승인 버튼은 실제 새 권한 생성 단계이므로 검토 없이 자동 실행하지 않는다. 복구 기준 이미지는 위575ac…이며 원본 Compose·이미지 보존/실제 rollback 검증 증적을 사용한다. 다음 작업 한 개는 감사 receipt ID 가변 길이와 CT 등록 검증기의 계약 불일치를 별도 수정·회귀 검증하는 것이다. 전체 MVP/v3 완료를 선언하지 않는다.

## 2026-10-11 01:30 KST 내 의료영상 시안 구현 및 B 웹 반영 — DRAFT / UNASSIGNED

현재 환자 웹의 ‘내 의료영상’은 생성된 시안의 큰 영상/검사 상세 양분 구성으로 교체했다. 흰색 상세 영역, 세이지 공유 이력 띠, 자체 호스팅 Pretendard와 절제된 블루를 유지한다. frontend-design/redesign-existing-projects의 기존 스택 보호·정보 계층 원칙과 image-to-code의 기존 생성 시안 분석을 적용했다. 시안에 그려진 CT를 복사하지 않고 등록된 합성 DICOM의 승인된 첫 rendered Instance를 사용한다. 기존 공개 예시 PNG는 이 화면의 fallback으로 사용하지 않는다.

기준 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty. B read-only inventory: `artifacts/workstation/mobile-b-rollout-20261010T161813Z/result.json`. 기준 B 이미지 `c15f391556ea23fc…`, 새 이미지 `sha256:575ac324f495cc2d69d4dd67efd761ad73ee76794b446d5559ffe72a0e243058`, 태그 `highpass-platform-mvp:capstone-mobile-library-20261011`. A/Cloud/PACS 데이터·서버 API/DB/인가 계약은 변경하지 않았으며 commit/push는 수행하지 않았다.

변경 파일: `public/app.js`, `public/index.html`, 신규 `public/ui/patient-library.js`·`patient-library.css`, `Dockerfile.hcc-main-scenario`, `scripts/capstone-mobile-b-rollout.py`, `test/presentation-bundle.test.js`, 신규 `test/patient-library.test.js`, 이 현재 상태 문서. Node ESM/DOM을 유지하고 기존 `createPatientPixelSession` 및 `openPatientPixelViewer`를 재사용한다. 관련 FR 기능군은 FR-006~009(목록·메타데이터), FR-032~036(Viewer), FR-001~005(공유 확인 연결), FR-014~025(기존 서버 인가·DPoP 경로 보존)다. 개별 FR/NFR 원문 추적 한계는 REQUIREMENTS.md에 따른다.

검사가 하나이면 큰 상세 카드로 표시한다. 여러 검사이면 실제 목록에 대한 검색·modality 필터와 선택 목록을 표시하고 선택한 Study만 상세로 연다. Study/Series/Instance 수를 구분하며 700개의 카드나 허구 MRI를 만들지 않는다. 공유 이력은 해당 Study의 allowed scope와 수신기관별 서버 동의 상태를 표시한다. 관측 시점에는 B대학병원 ACTIVE 동의와 이전 EXPIRED 동의가 함께 있었다. 과거 만료 상태를 현재 상태로 승계하지 않으며 이번 작업에서 동의를 만들거나 갱신하지 않았다.

미리보기는 화면이 활성화된 때 선택한 검사의 첫 Series 목록과 단일 frame만 요청한다. DPoP proof, 환자 본인 VIEW_ONLY 권한, 서버 감사 및 기존 암호화 경로를 그대로 사용한다. Blob URL과 권한은 RAM에만 두고 검색 변경·검사 변경·화면 이탈·pagehide·열람 만료 때 취소/해제한다. 늦은 응답은 generation guard로 폐기한다. 인증/통신 실패 시 안내와 재시도만 표시하며 임의 예시 픽셀을 사용하지 않는다. 공유 버튼은 기존 확인 화면으로 이동할 뿐 동의를 생성하지 않는다.

| 검증 | 결과 | 실행 및 범위 |
|---|---|---|
| Node 전체 회귀 | PASS | `node --test --test-concurrency=4 --test-reporter=spec`: 937/937, exit0, 63.331초. 당시 library 시험 4개 포함; 이후 시험만 2개 추가됨. live E2E는 실행하지 않는 명령 |
| 최종 library focused | PASS | `node --test test/patient-library.test.js`: 6/6, exit0, 0.172초. 필터·정확한 count·숨김 요청 부재·늦은 grant/frame 폐기·거부 시 대체 영상 부재·다중 Study/기관 선택 검증 |
| Pixel Viewer 및 bundle focused | PASS | library 4 + pixel viewer 8 + bundle 1: 13/13, exit0, 0.395초 |
| Build / syntax / diff | PASS | 명시적 exact-base Docker build, node syntax checks, git diff --check exit0. 기존 ARG default/CRLF 안내는 남음 |
| Image scan | PASS | `artifacts/security/container-scan/patient-library-20261011.json`, exact 575ac324… HIGH/CRITICAL 0, scanner exit0 |
| B 배포·rollback·strict TLS | PASS | `artifacts/workstation/mobile-b-rollout-20261010T162407Z/result.json`, exit0. 소스 bytes·runtime 유지·실제 rollback 및 re-promotion·23개 strict TLS 경로. A/Cloud 변경 false |
| 실제 로그인 → 내 의료영상 | PASS | 기존 환자 ID/PW 로그인 후 실제 고정 CT 목록, 검사일 2026-10-10, 1 Study / 1 Series / 700 Instances 확인 |
| 실제 CT preview 및 Viewer | PASS | preview 1254×1254 rendered image 표시, Viewer에서 1/700 → 2/700 실제 픽셀 표시. 전체 700장 순회나 MPR 확인은 아님 |
| 검색 빈 상태·공유 연결 | PASS | 없는 검사 검색 시 빈 안내, 검색 복원 후 실제 미리보기, 공유 확인 화면의 미선택 checkbox 및 disabled 승인 버튼. 이탈 시 preview src 제거 확인 |
| Desktop / mobile width | PASS | 1440×1000에서 문서폭1425, 390×844에서 문서폭375로 가로 넘침 없음. mobile preview 초기 locator 대기는 로딩 중 실패했으나 후속 DOM에서 정상 표시 확인; 정책 DENY로 기록하지 않음 |
| 다중 실제 PACS Study 브라우저 경로 | NOT VERIFIED | 현재 등록된 환자는 1 Study. 자동시험 fixture로만 여러 검사/기관 검증; 실서버에 허구 검사 추가 안 함 |
| 신규 동의·QR·의료진 E2E | NOT VERIFIED | 이번 UI 검증에서는 생성/철회/QR submit 또는 의료진 접수를 실행하지 않음 |

실제 브라우저 캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-library-desktop.png`, `patient-library-mobile.png`, `patient-library-viewer-slice2.png`. 브라우저 console error 기록은 없음. 위 PASS는 현재 UI 검증 범위이며 전체 MVP/v3 완료 또는 임상 CT 품질 동등성 판정이 아니다.

재현: B 웹 `/hipass/#PATIENT` → 기존 시연 계정 로그인 → 내 의료영상 → 영상 살펴보기/다음 영상/닫기 → 공유 내용 확인. 복구는 위 rollout의 검증된 기존 Compose 및 이미지 `c15f391556ea23fc…`로 B만 rollback한다. 다음 작업 한 개는 사용자가 선택한 기간·범위·권한을 명시적으로 승인하는 동일 흐름의 QR 및 의료진 접수 검증이다. 새 증적은 독립 검토 전까지 DRAFT / UNASSIGNED다. 아래는 과거 시점의 이력이다.

## 2026-10-11 00:54 KST 공유 확인 화면 구현 및 B 웹 반영 — DRAFT / UNASSIGNED

환자 홈의 ‘공유 내용 다시 확인’은 펼쳐진 진료 패스 화면으로 연결된다. 등록된 합성 홍길동 CT의 실제 검사일·시리즈·영상 수, 수신 병원, 목적, 권한, 입력한 기간을 표시한다. 현재 고정 데이터는 CT 1 Study / 1 Series / 700 Instances다. 이전 동의는 EXPIRED로 표시하며 자동 갱신하지 않는다. 자체 호스팅 Pretendard, 흰 검사 영역과 세이지 수신 병원 영역, 절제된 블루 버튼을 적용했다. frontend-design의 시안 우선·정보 계층 원칙을 적용하고 기존 CSS의 우선순위 충돌을 보정했다.

변경 파일은 `public/index.html`, `public/app.js`, 신규 `public/ui/patient-share-review.js`·`patient-share-review.css`, `Dockerfile.hcc-main-scenario`, `scripts/capstone-mobile-b-rollout.py`, 신규 `test/patient-share-review.test.js`, `test/consent-operations.test.js`, `test/presentation-bundle.test.js`다. 기존 Node ESM/DOM, 동의 POST 및 handoff-ticket 계약을 유지했다. 병원·Study·Series·목적·권한·기간 선택 컨트롤은 펼칠 수 있는 수정 패널에 보존했다. 확인란은 기본 미선택이며 선택값이 변경되면 다시 확인해야 한다. 미확인 상태의 생성 호출은 HTTP 요청 전에 거부한다. 이 검사는 UX 보완이며 서버 동의·RBAC/ABAC·scope·유효기간 검증을 대체하지 않는다. 새 사용자 입력은 textContent로 표시한다.

관련 요구사항은 FR-001~005(동의), FR-006~009(영상 목록·범위), FR-014~025(기존 인가·토큰 경로 보존) 기능군이다. 개별 원문 FR 및 해당 NFR ID는 `docs/REQUIREMENTS.md`의 추적 한계를 따른다. API/DB/보안 정책 변경과 A/Cloud/PACS 수정은 없다. 기준 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty이며 commit/push는 수행하지 않았다.

최종 B 이미지 `sha256:c15f391556ea23fc5c410a9d94f10923ee59919509a71a38a4bda04f7acdbb2f` (`highpass-platform-mvp:capstone-mobile-share-review-final-20261011`). 첫 후보 `274828c4024b9e3d…` 및 이전 홈 기준선 `d19c3f3aef605e6d…`를 보존했다. 최종 build는 첫 후보를 명시한 base로 사용했다. 배포 operator는 실제 관측된 Compose 파일과 기준 이미지가 일치할 때만 변경하며 기존 runtime 설정을 보존한다.

| 검증 | 결과 | 근거와 범위 |
|---|---|---|
| 최종 Node 회귀 | PASS | `node --test --test-concurrency=4 --test-reporter=spec`: 933/933, exit0, runner 56.983초 / shell 57.291초. 외부 live E2E는 별도이며 이 명령에서 실행되지 않음 |
| 최종 동의·선택·화면·bundle focused | PASS | `node --test test/consent-operations.test.js test/consent-selection.test.js test/patient-share-review.test.js test/presentation-bundle.test.js`: 24/24, exit0, 0.361초 |
| 초기 전체 회귀 | FAIL | 새 shareReview 의존성이 기존 VM 격리 테스트 환경에 없었음. 테스트 환경에 명시적 확인 fixture와 미확인 HTTP 부작용 부재 테스트를 추가한 뒤 재실행 PASS. 서버 정책을 완화하지 않음 |
| Build·syntax·diff | PASS | 명시적 base Docker build, `node --check public/app.js`, `node --check public/ui/patient-share-review.js`, 관련 파일 `git diff --check` exit0. Docker ARG 기본값 안내와 기존 CRLF 안내는 남음 |
| 최종 이미지 취약점 | PASS | HIGH/CRITICAL 0, exact image scan `artifacts/security/container-scan/share-review-final-20261011.json`; 중간 scan을 최종 증거로 승계하지 않음 |
| B 배포·소스·rollback | PASS | `artifacts/workstation/mobile-b-rollout-20261010T154912Z/result.json`, exit0. 현재 소스 bytes 일치, runtime 보존, 실제 rollback/re-promotion, strict TLS 21개 경로(새 CSS/JS 포함). A/Cloud 변경 false |
| 실제 로그인→홈→공유 확인 | PASS | 기존 합성 계정 ID/PW 로그인과 홈 버튼 이동. 홍길동·A→B·복부 CT·700장·실제 EXPIRED 이전 이력 표시 |
| 실제 화면 확인 및 음성 조건 | PASS | 미확인 버튼 disabled, 체크 후 enabled, DOWNLOAD_ALLOWED 변경 시 체크 해제·버튼 disabled·다운로드 안내 변경. 종료일을 과거로 설정하면 체크해도 disabled. 검증 후 VIEW_ONLY와 유효한 종료일로 복원하고 미확인 상태로 남김 |
| 반응형·콘솔 | PASS | 1440×1000 및 390×844. 모바일 document width375 ≤ viewport390; 수정 패널을 펼쳐도 동일. 최종 관측 콘솔 error 없음, 임시 viewport 복원 |
| 신규 동의·QR·Viewer 전체 종단 | NOT VERIFIED | 이번 디자인 검증에서는 새 승인 POST·Ticket 생성·철회·의료진 접수·영상 열람을 실행하지 않음. 버튼 활성화는 동의 생성 성공 증거가 아님 |

브라우저 캡처는 `artifacts/workstation/mediq-landing-browser-20261010/patient-share-review-desktop.png`, `patient-share-review-mobile.png`, `patient-share-review-invalid-period.png`다. 현재 접속: `https://192.168.111.149:9443/hipass/#PATIENT` → 환자로 시작하기 → 기존 계정 로그인 → 공유 내용 다시 확인. 복구는 B 전용 operator의 검증된 이전 Compose/이미지 rollback을 사용하며 A/Cloud/DB/PACS를 재설정하지 않는다.

다음 작업 한 개는 새 화면에서 사용자가 기간·범위·권한을 명시적으로 승인한 동일 흐름의 QR 발급 및 의료진 접수 검증이다. 신규 증적은 DRAFT / UNASSIGNED이며 전체 MVP/v3 완료를 선언하지 않는다. 아래 기록은 이전 시점의 이력이다.

## 2026-10-11 00:22 KST 환자 홈 진료 패스 구현 및 B 웹 반영 — DRAFT / UNASSIGNED

현재 환자 홈은 승인된 진료 패스·의료영상 지갑 시안 기반으로 구현·배포했다. 홍길동(합성 56세), A대학병원 → B대학병원, 등록된 복부 CT 1 Series/700 Instances를 실제 서버 목록에 연결한다. 절제된 블루, 자체 호스팅 Pretendard, 기존 로고, 가로 메뉴와 티켓형 패스를 적용했다. 상태는 동의의 유효기간·ACTIVE/REVOKED/EXPIRED 등을 구분하며 실제 전송 완료를 주장하지 않는다. 보안 인가 판단은 기존 서버에 남아 있다.

기준 코드 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty 작업 트리이며 이번 commit/push는 없다. 최종 B 이미지 `sha256:d19c3f3aef605e6daa8840d7e5f70787c7a95a29558949502e5b3dcbf22189e5` (`highpass-platform-mvp:capstone-mobile-visit-pass-v4-20261011`). 원래 B 기준선 `d506464be529e2d7…` 및 중간 후보를 보존했다. Cloud/A·DB·PACS 데이터·동의·권한·암호화 설정을 변경하지 않았다.

변경 파일: `public/ui/patient-visit-pass.css` 신규, `public/ui/patient.js`, `public/app.js`, `public/index.html`, `Dockerfile.hcc-main-scenario`, `scripts/capstone-mobile-b-rollout.py`, `test/patient-visit-pass.test.js` 신규, `test/presentation-bundle.test.js`. 기존 Node ESM·DOM UI·B 이미지 전용 rollout을 유지한다. 관련 요구사항은 FR-001~009(동의/목록 화면), FR-014~025(상태·QR 표시와 기존 인가 경로 보존), FR-032~036(Viewer 진입 버튼 보존)이다. API/DB 계약 변경은 없다.

| 검증 | 결과 | 근거와 범위 |
|---|---|---|
| Node 회귀 | PASS | `node --test --test-concurrency=4`: 927/927, exit0, 61.133초. 마지막 CSS 보정 전 실행이며 외부 live E2E는 이 명령으로 실행하지 않음 |
| 최종 focused 회귀 | PASS | 환자 홈·QR·검색·B portal·모바일 인증·navigation·bundle 8개 test 파일, 38/38, exit0, 1.151초 |
| Docker build/scan | PASS | 명시한 d506 기준선으로 v4 build exit0; 정확한 v4 scan HIGH/CRITICAL 0. `artifacts/security/container-scan/visit-pass-v4-20261011.json` |
| B 배포·소스 일치·복구 | PASS | `artifacts/workstation/mobile-b-rollout-20261010T151844Z/result.json`; exact source bytes, runtime 설정 보존, rollback 실제 실행 및 candidate 재적용, strict TLS 19개 경로 |
| 실제 브라우저 로그인·홈 | PASS | 기존 시연 계정 로그인, 홍길동·700장·실제 ACTIVE 동의 표시. 1440×900 및 390×844 반응형 확인; 모바일 document width375 ≤ viewport390 |
| 공유 설정·QR 화면 이동 | PASS | 홈 버튼으로 A→B/고정 Study/VIEW_ONLY 설정과 기존 동의 이력 확인, QR 제시 화면으로 이동. 신규 동의·Ticket 발급/철회 없이 수행 |
| 신규 홈 QR 픽셀 표시·소거 | NOT VERIFIED | 검증된 QR만 양쪽 canvas에 그리는 기존 controller 연결 및 음성 단위 테스트는 PASS. 이번 브라우저에서는 새 Ticket을 발급하지 않아 홈 QR 실표시를 확인하지 않음 |
| CT 픽셀·의료진 접수 전체 E2E | NOT VERIFIED | 이번 작업은 환자 홈 디자인과 navigation 검증이며 Viewer 종단 성공 증적이 아님 |

배포 후 실제 캡처: `artifacts/workstation/mediq-landing-browser-20261010/patient-visit-pass-desktop.jpg`, `patient-visit-pass-mobile.jpg`. 브라우저 warn/error 조회 0건, viewport override 복원. 첫 후보의 세로 메뉴 충돌, v2/v3의 모바일 메뉴/로고 충돌은 실화면에서 관측 후 CSS를 수정했으며 중간 배포 증적도 보존한다. 최종 source/scan은 v4에만 해당한다.

재현: `https://192.168.111.149:9443/hipass/#PATIENT` → 환자로 시작하기 → 기존 시연 계정 로그인 → 진료 패스 → 공유 내용 관리/확인 → 홈 → QR 연결 확인. QR가 없는 화면은 자동 재발급하지 않는다. 배포 명령은 `scripts/capstone-mobile-b-rollout.py --apply --presentation-ui --active-presentation --rehearse-rollback`에 정확한 image/image-id/expected-current-id/scan을 전달했으며 VM 암호는 stdin으로만 사용했다. 복구 기준·원래 Compose 경로는 해당 rollout 증적과 기존 release runbook을 따른다. 임의 compose down·volume 삭제는 하지 않는다.

다음 작업 한 개: 같은 최종 이미지에서 명시적 공유 승인 후 홈 QR 실표시·사용/만료 시 소거를 실제 브라우저에서 확인한다. 신규 증적은 독립 검토 전 DRAFT / UNASSIGNED이며 전체 MVP/v3 완료는 선언하지 않는다.

## 2026-10-10 23:35 KST 시연 계정·고정 CT 등록·실제 환자 로그인/공유 — DRAFT / UNASSIGNED

이번 완료 범위는 실제 B HTTPS 브라우저의 ID/PW 로그인 → 홍길동(합성 56세) 홈 → 고정 CT Series 선택 → 명시적 조회 전용 동의 → 1회용 QR 발급이다. 기존 인증/CT 등록 차단은 아래 현재 증적으로 해소했다. 전체 MVP/v3·의료진 접수·Viewer 종단 완료는 아니다. 계정은 `ycdc`; 사용자 지정 비밀번호는 서버의 root0600 파일에 salted scrypt 해시만 저장했다. 평문·해시는 이 문서/소스/Git에 넣지 않았다. Google/네이버/카카오 SSO·회원가입 완료를 주장하지 않는다.

현재 배포 기준: Control `sha256:80fac45b48f2e16b472341884372ec166e083a0e29617acf11f0f07038b09181`, A Gateway `sha256:50b1db9e1cdfdf71ac706cff09c3b11b0a0df1fd1b0ef1c66a1305c39aab43b8`, B UI `sha256:d506464be529e2d71ad0b192d4824936d8c98fdd413a779beea940cebc35d88d`。이번 작업은 이미지 교체 없이 Control 설정·감사 가능한 카탈로그/소유권 등록을 수행했다. 기존 PACS 파일/UID·다른 환자 기록·volume을 삭제하지 않았다. main HCC 설정은 기존 승인된 서버 계약을 사용한다.

고정 데이터셋 `SYNTHETIC_HONG_GILDONG_56_CT_20261010_V1`, 환자 `MEDIQ-SYN-HCC-001`, Study `2.25.259656708708993797343330994179169711072`, Series `2.25.18361638789025095699746776899955737977`, 1 Study/1 Series/700 Instances. A의 인증된 원본 파일 전체 해시 확인 → Control receipt → catalog 재등록/readback PASS(exit0,68.692초): `artifacts/workstation/hcc-source-live-integration-20261010T141812Z/result.json`. receipt `audit_a32b1b2729795c87`. 생성 볼륨은 반복/변형 기반 합성 비임상 데이터이며 진단/HU/MPR 품질은 보장하지 않는다.

서버 소유권 등록 PASS: `artifacts/workstation/hcc-ownership-activate-20261010T141601Z/result.json`. 계정 설정 PASS: `artifacts/workstation/patient-account-config-20261010T142404Z/result.json`; main 활성화 PASS: `artifacts/workstation/patient-account-config-20261010T142514Z/result.json`. Control만 유한 기한으로 재시작하며 ingress/Postgres·mount·권한·이미지를 보존했다. 중간 실패/rollback 증거는 각 디렉터리에 보존했다. 실제 receipt ID는 challenge UUID가 아닌 `audit_` hexadecimal 계약이고, receipt 응답의 미존재 count 필드를 요구하던 operator를 수정했다. 서버 검증·replay·기간·권한 정책을 완화하지 않았다. 초기 staged probe `hcc-source-readonly-diagnosis-20261010T141026Z/result.json`의 reportSubmitted:false 표시는 실행 당시 wrapper 오표기이며 실제 receipt가 발급됐다; 순수 읽기 증적으로 취급하지 않는다.

실제 브라우저 동의 `consent_7a6431d27215cf92`: A→B, TREATMENT, VIEW_ONLY, 위 Series 하나, 2026-10-10 23:27~2026-10-11 00:27 KST. Ticket `ticket_69ed39a5c5c8e6a9` 발급 확인, QR 기한 2026-10-10 23:37:37 KST. QR는 새 로그인 시 자동 재발급되지 않으며 지난 QR 캡처로 시연하지 않는다. PostgreSQL READ ONLY 확인 PASS(exit0): `artifacts/workstation/hcc-patient-live-state-20261010T143254Z/result.json`, ACTIVE/정확한 scope/ISSUED와 CONSENT_CREATED·TICKET_ISSUED 감사 연결, 실제 전체 감사 chain 7763행 검증. 검증 중 5분 로그인 세션 만료로 갱신 오류가 발생했고 재로그인 후 서버 정보/ACTIVE 홈을 다시 확인했다. 인증 시간을 연장하거나 우회하지 않았다.

브라우저 캡처: `artifacts/workstation/mediq-landing-browser-20261010/hong-gildong-login-home.jpg`, `hong-gildong-consent-before.jpg`, `hong-gildong-consent-active.jpg`, `hong-gildong-home-active.jpg`. live QR 캡처는 로컬 ignored 증적에만 보관하고 공개 전달하지 않는다. 관련 FR-001~005/006~009/014~025/037~041. 변경: `scripts/capstone-patient-account-config.py`, `scripts/capstone-hcc-ownership-activate.py`, `scripts/hcc-source-stage-check.py`, `scripts/hcc-source-live-integration.py`, `scripts/hcc-source-catalog-live-check.js`, `scripts/verify-hcc-source-gateway.js`, `scripts/verify-hcc-patient-live-state.py`, `test/hcc-source-operator-contract.test.js`. Azure diagnostics skill의 evidence-first 원칙으로 차단 원인과 실제 배포 상태를 분리했다.

Focused 테스트 명령: `node --test test/capstone-mock-idp.test.js test/capstone-hcc-catalog.test.js test/hcc-source-verification.test.js test/patient-hcc-registration.test.js test/hcc-source-operator-contract.test.js` → 28 PASS/0 FAIL/exit0/852.387ms. 잘못된 비밀번호/role/기관·소스 receipt 변조/재사용/만료·소유권 실패의 자동 시험 포함; 이 음성 결과를 이번 실제 브라우저 음성 검증으로 주장하지 않는다. `git diff --check` exit0(기존 CRLF 안내). 실제 CT 픽셀·슬라이스·의료진 접수·Key Vault 포함 전체 E2E 및 설치 PWA 캐시 갱신 NOT VERIFIED. 재현: B `/hipass/#PATIENT` → 환자로 시작하기 → 계정 로그인 → 공유 범위 확인. 복구는 operator의 기존 Compose baseline rollback을 유지; 불확실한 DB commit을 재실행하지 않고 위 읽기 전용 확인기로 먼저 대조한다. commit/push 없음.

다음 작업 한 개: 동일 동의/고정 CT 기준 새 유효 QR를 실제 의료진 화면에서 접수하여 Viewer 픽셀·슬라이스까지 연결하고 정상/거부를 확인한다. 아래 이전 FAIL/NOT VERIFIED 기록은 당시 관측 이력으로 보존한다.

## 2026-10-10 환자 지갑형 로그인 실제 웹·모바일 적용 — DRAFT / UNASSIGNED

환자로 시작하기 이후 화면에 파란 지갑 아트워크/큰 실제 HTML 제목/흰 로그인 폼의 58:42 레이아웃을 적용했다. 작은 화면은 상단 지갑과 하단 폼으로 전환한다. frontend-design 스킬의 여백·텍스트 계층·분리된 아트워크 원칙을 적용했다. imagegen으로 생성한 비임상 지갑 배경을 픽셀·해상도 유지 무손실 WebP(1122×1402, 1,464,114 bytes)로 저장했다. 이 이미지는 DICOM이나 환자 영상이 아니다. CT 사진은 새 로그인에 표시하지 않는다.

변경: `public/capstone-auth.js`, `public/ui/capstone-login.css`, `public/images/mediq-login-wallet.webp`, `public/mobile/sw.js`(v14), `src/capstone-b-portal.js`, `test/capstone-b-portal.test.js`, `scripts/capstone-mobile-b-rollout.py`. 기존 signed 인증·권한·감사 계약은 유지하고 B 정적 allowlist에 bounded WebP MIME만 추가했다. 회원가입은 계정 미생성 안내, 소셜 로그인은 disabled/연동 준비 중이다. 관련 FR-001~005/014~025 인증·동의 선행 UI, FR-006~013/032~036 사용자 영상 접근 UI 영향. API/DB 정책·PACS 데이터 변경 없음.

최종 B 이미지: `sha256:d506464be529e2d71ad0b192d4824936d8c98fdd413a779beea940cebc35d88d` (`highpass-platform-mvp:capstone-mobile-wallet-login-final-20261010`). Container scan PASS/HIGH·CRITICAL 0, `artifacts/security/container-scan/wallet-login-final-20261010.json`. 이전 중간 후보 scan은 최종 후보의 증거로 사용하지 않았다. B 배포 exit0/PASS: source bytes 일치, 기존 runtime 설정 보존, baseline rollback·candidate 재적용 및 strict TLS 18개 route(새 WebP 포함). 증적 `artifacts/workstation/mobile-b-rollout-20261010T135622Z/result.json`. A/Cloud는 이 rollout에서 수정하지 않았다.

검증: `node --check public/capstone-auth.js` exit0. `node --test test/mobile-capstone-auth.test.js test/clinical-theme-navigation.test.js test/capstone-mock-idp.test.js test/presentation-bundle.test.js test/capstone-b-portal.test.js` 35 PASS/0 FAIL/exit0/1.178초. `git diff --check` exit0(기존 CRLF 안내 있음). 실제 B HTTPS 브라우저의 진입→환자 로그인, 회원가입 안내 열기/닫기, 돌아가기→의료진 기존 키 로그인 진입 PASS. 환자 웹 1440×900, 모바일 경로 390×844 표시 확인; 모바일 scrollWidth390/viewport390. 캡처 `artifacts/workstation/mediq-landing-browser-20261010/patient-login-wallet-desktop.jpg`, `patient-login-wallet-mobile.jpg`. 임시 viewport 복원·테스트 탭 종료.

이번 결과는 로그인 디자인·정적 배포·화면 이동 범위 PASS다. 환자 ID/PW 로그인 성공은 이번에 재시험하지 않았으며 앞선 인증/고정 CT 등록 FAIL을 해결한 것으로 승격하지 않는다. 로그인 이후 홈→승인→QR→Viewer 종단, 설치된 PWA 기존 캐시 갱신은 NOT VERIFIED. 신규 증적은 DRAFT / UNASSIGNED; 전체 MVP/v3 완료·commit/push 없음. 다음 작업 한 개: 실제 Control 인증 설정과 고정 CT 등록 차단 원인을 해결하여 동일 환자의 로그인 이후 흐름을 연결한다.

## 2026-10-10 진입 화면 오른쪽 하단 안내 카드 제거 — DRAFT / UNASSIGNED

사용자 요청으로 `public/ui/demo-entry.js`의 합성 CT·승인·B병원 공유 여정 카드를 제거했다. 홍길동 인물 배경과 환자/의료진 진입 버튼은 유지한다. frontend-design의 장식 최소화 원칙을 적용했으며 관련 FR-006~013/032~036 UI 영향에 한정된다. PACS/DICOM/공개 이미지 파일 삭제, API/DB/인증 정책 변경은 없다. JS syntax/diff check exit0, 관련 회귀 테스트 16 PASS/exit0/0.532초. B 전용 후보 `capstone-mobile-landing-clean-20261010`를 준비했고 실제 배포·브라우저 결과는 후속 관측으로 기록한다. 기존 ID/PW/CT 등록 차단 상태를 해결하거나 전체 종단 PASS로 승격하는 작업이 아니다. commit/push 없음.

후속 관측: 후보 `sha256:0b384d41e87a5d621238ae6d9dc74159197aef2f8804d331414325d6df868d9b` HIGH/CRITICAL 0건. B 배포·소스 해시·설정 보존·rollback/re-promotion·strict TLS **PASS / exit0**, 증적 `artifacts/workstation/mobile-b-rollout-20261010T133603Z/result.json`. 실제 웹 새로고침 후 entry의 journey card0/img0, 역할 버튼2 확인 **PASS**. 캡처 `artifacts/workstation/mediq-landing-browser-20261010/entry-clean.jpg`. 원본 이미지/DICOM 파일은 보존했고 로그인 이후 종단은 이번에 재검증하지 않았다.

## 2026-10-10 홍길동 진입 화면 구현·B 연동 — DRAFT / UNASSIGNED

기존 `capstone-auth.js` 앞에 `public/ui/demo-entry.js`와 `demo-entry.css`를 연결했다. 가상 남성 홍길동·56세의 배경, 실제 HTML 제목/역할 버튼, 합성 CT 안내 카드, CSS 나뭇잎 움직임·정지 제어와 reduced-motion 대응을 적용했다. 환자/의료진 버튼은 기존 인증 화면을 선택할 뿐 인증·권한·동의 상태를 생성하지 않는다. 모바일에서는 환자 진입만 제공한다. 신규 공개 PNG는 완전 합성 비임상 안내 자산이며, PACS의 승인된 DICOM 조회 증거가 아니다. PWA는 정확한 공개 정적 경로만 추가하고 API/영상/토큰 cache 금지를 유지했다.

관련 요구사항: FR-001~005/014~025 인증·동의 선행 화면, FR-006~013/032~036 영상 접근 UI. API/DB 권한 계약 완화 없음. frontend-design 스킬의 실제 텍스트 계층·여백·분리된 배경 자산 방식을 적용했다. `Dockerfile.presentation-ui`와 B 전용 rollout은 현재 화면 소스 해시, image-only Compose 변경, 기존 런타임 설정 보존 및 실제 rollback/re-promotion을 확인한다.

첫 B 배포 `2f816a95229a6d6b…`: PASS. 증적 `artifacts/workstation/mobile-b-rollout-20261010T130940Z/result.json`. 앞선 두 시도는 image overlay 작성 오류로 배포 전 FAIL이었고, 정확한 대상의 빈 파일을 확인 후 수정했다. 실제 브라우저의 첫 화면→환자 로그인/의료진 로그인→돌아가기 확인. 환자 ID/PW 제출은 서버에서 거부되어 **FAIL**, 로그인 이후 홈·공유 승인·QR·CT 종단은 **NOT VERIFIED**다. 고정 700장 CT source 등록도 `artifacts/workstation/hcc-source-live-integration-20261010T131041Z/result.json`에서 `LIVE_A_SOURCE_REPORT_NOT_CONFIRMED`로 FAIL; ownership 변경·동의 발급은 수행되지 않았다.

최종 후보 v2: `sha256:16f08909fbda67fcb6a6066f965778234f61a4c230e0a8be5ccfe0b19ca9d52f`. 역할 전환의 오래된 오류 제거, 홍길동 시연 선택, 모바일 의료진 버튼 제외, SVG 승인 아이콘 및 인물 가림 보정을 포함한다. JS 문법 exit0, 관련 focused 테스트 16 PASS/exit0/0.522초, 후보 container HIGH/CRITICAL 0건. v2 배포 결과는 아래 후속 관측으로만 판정한다. 이전 scoped PASS와 사람 승인을 신규 종단 결과로 승계하지 않는다. commit/push 없음.

v2 후속 관측: B 전용 rollout **PASS / exit0**, `artifacts/workstation/mobile-b-rollout-20261010T132607Z/result.json`. 현재 이미지 위 v2 SHA, source bytes 일치·runtime 설정 보존·baseline rollback·candidate re-promotion·strict TLS 정적/health/scenario 경로 PASS. Cloud/A는 이 B rollout에서 수정하지 않았다. 실제 배포 브라우저: 1440×900 진입 화면 표시, 환자 ID/PW 화면 이동, 돌아가기, 의료진 키 화면 이동 및 홍길동 option 선택 PASS. 390×844 모바일 진입→환자 ID/PW 화면 이동 PASS, document scrollWidth390/viewport390, CT 공개 PNG naturalWidth1254. 캡처 `artifacts/workstation/mediq-landing-browser-20261010/entry-desktop-v2.jpg`, `entry-mobile-v2.jpg`. 검증용 viewport override는 복원했다. OS/browser reduced-motion 적용으로 leaf animationName `none`; 실제 움직이는 애니메이션/재생 toggle의 reduced-motion override는 **NOT VERIFIED**다. 본 결과는 로그인 성공이나 DICOM Viewer 종단 PASS가 아니다.

다음 작업 한 개: 인증 설정·고정 CT 등록 상태를 실제 Control과 대조하여 환자 ID/PW 로그인 최초 차단 원인을 해결하고 동일 환자의 홈→승인→QR→열람으로 이어간다. 인증 우회·미등록 영상 fallback으로 화면을 성공처럼 만들지 않는다.

## 2026-10-10 로그인 런타임 불일치 진단 — 해결 미완료 / DRAFT

읽기 전용 관측: 로컬 3000 listener PID5240은 2026-10-07 13:53 KST부터 실행된 `scripts/start-local.js`이다. 최신 정적 파일과 이전 서버 프로세스가 혼재한다. Strict SSH로 확인한 Cloud Control은 `11a23eea8a61` healthy이며 Mock IdP/TEST/PostgreSQL이지만 HCC catalog/main scenario 비활성, 환자 username/password hash 설정 부재다. 기존 서버를 단순 재시작하거나 401을 우회하는 것으로 ID/PW를 개통할 수 없다. 원격 DB의 특정 합성 환자 존재 확인은 연결 실패로 NOT VERIFIED(데이터 없음으로 단정하지 않음).

클라이언트 사전확인을 보완: 401/403은 인증 설정 거부, 404는 로그인 런타임 미준비, 잘못된 scenario 응답은 연결/계약 오류로 구분한다. 404를 정상 legacy capability로 간주하던 동작을 제거하고 버튼 비활성을 유지한다. API 권한 완화·개발용 인증 fallback·DB 변경 없음. 관련 인증/UI 회귀 **27 PASS / exit0 / 1.213초**, JS 문법 exit0. 실제 로그인/홈/동의/QR는 아직 NOT VERIFIED. 다음 단계는 배포 대상 확정 후 서버 후보·계정 해시 주입·신뢰 ingress·등록 상태를 함께 검증하는 것이며 기존 환자/동의 초기화는 별도 범위다. 이번 작업은 재배포·commit·push하지 않았다.

## 2026-10-10 디자인 통합 커밋 준비 — DRAFT / UNASSIGNED

환자 웹·의료진 데스크·Viewer·모바일과 공통 ID/PW 인증의 기존 변경을 한 배포 소스 묶음으로 정리했다. `Dockerfile.hcc-main-scenario`에서 누락됐던 의료진/Viewer/mobile CSS·FAQ·서비스·ingress 소스를 포함하고 후보 해시 검증 목록도 일치시켰다. 새 `test/presentation-bundle.test.js`는 각 화면과 인증 소스의 이미지 포함 여부를 검사한다. DB 등록/기존 합성 환자 보관 스크립트는 이미지 의존 파일로 보존할 뿐 이번 작업에서 실행하지 않았다. FR-001~041의 해당 UI/인증/QR/Viewer 경로를 유지하며 계약이나 보안 정책을 완화하지 않았다.

첫 전체 Node 실행: 905 중 904 PASS, FAQ의 과거 5탭 기대값 1 FAIL. 승인된 4탭 및 보조 화면 접근을 함께 검사하도록 수정 후 `node --test --test-concurrency=4`: **906 PASS, 0 FAIL, exit0, 57.655초**(현재 작업 트리 기준; 실제 외부 E2E 스크립트는 이 명령으로 실행되지 않음). 비밀정보 패턴 검사 PASS/0건, staged JS 로컬 의존 파일 누락 0건, 문법 검사 exit0. diff check는 원문 보존한 OFL LICENSE.txt의 trailing whitespace 1건을 제외하면 exit0.

커밋 대상은 디자인·인증 의존 코드/테스트/폰트와 라이선스/로컬 프로토타입/상태 문서이다. `.env`, 비밀정보, VM 설정, DICOM·영상 데이터, 스크린샷, 브라우저 프로필, 런타임 증적 및 무관한 작업은 제외하고 로컬에 보존한다. 실제 이미지 빌드·VM 재배포·새 디자인의 실제 로그인→동의→QR→CT 종단은 **NOT VERIFIED**. 로컬 기존 서버의 scenario 401도 아직 해결된 것으로 기록하지 않는다. 다음 작업은 검증된 대상 환경에서 최신 서버/정적 파일을 함께 배포하고 같은 환자 흐름을 재검증하는 것이다.

## 2026-10-10 모바일 로그인 시안 적용 — DRAFT / UNASSIGNED

모바일 HTML의 capstone 표시를 기본화하여 개발용 인증 화면 대신 기존 signed ID/PW 로그인으로 진입한다. 인증 API·DB·권한 계약은 유지한다. 모바일 전용 단일 열, 중앙 로고, 절제된 버튼, 3열 미연동 소셜 로그인, 접힌 발표자 설정을 적용했다. 웹 로그인 레이아웃은 변경하지 않았다. 관련 요구사항: FR-001~005 동의 진입 및 FR-014~020 접근정책의 인증 선행조건(UI 영향).

Node focused tests **34 PASS / exit0 / 1.071초**. 브라우저 fixture: 회원가입 미리보기 열기/닫기, 로그인 401 오류 표시·비밀번호 제거·로그인 화면 유지, 320/390/768px 가로 넘침 없음. 실제 로컬 scenario API는 401을 반환하여 로그인 차단됨(우회하지 않음). 실제 로그인 성공·VM 배포·PWA 갱신은 NOT VERIFIED. `output/playwright/mobile-login-mockup-aligned.png`는 실제 차단 상태이며, `output/playwright/mobile-login-design-ready-fixture.png`는 scenario 응답만 대체한 디자인 확인용이다. 실제 계정으로 로그인 성공을 주장하지 않는다.

## 2026-10-10 모바일 시안 우선 재정리 — DRAFT / UNASSIGNED

기존 상태 카드·인증 정보·기록 필터가 시안 위에 중첩된 것이 홈의 정보 밀도 증가 원인이었다. 홈은 진료 카드 → 간결한 검사 목록 → 도움말 순으로 정리하고 공유 현황/잠금은 내 정보로 이동했다. 긴 CSS 덧쓰기 구간을 읽을 수 있는 규칙으로 교체했다. 검사일 미확인 시 임의 날짜를 표시하지 않는다. 인증·동의·QR API 계약은 변경하지 않았다. 관련 FR-001~005, FR-006~009, FR-021~025, FR-032~036의 UI 영향 범위다.

관련 Node 시험 33 PASS, 문법 검사 exit0. 390px 실제 브라우저에서 합성 API fixture 기반 홈 렌더링 확인: `output/playwright/wallet-refined-home-fixture.png`. 실제 인증 성공 또는 서버 종단 증적이 아니다. 중간 브라우저 재연결로 한 확인 명령이 실패했고 새 세션에서 홈 캡처를 재실행했다. 로그인·승인·QR 전체 시안 일치 검증, 설치된 PWA 갱신, VM 배포는 NOT VERIFIED. 네 화면 전체 디자인 완료를 선언하지 않는다. 다음 한 작업은 실제 로그인 진입 구조를 유지하면서 로그인 → 승인 → QR의 화면별 시안 대조 검증이다.

관측일: 2026-10-10 (Asia/Seoul). 아래 명시된 검토 대상 외 신규 증적: DRAFT / UNASSIGNED.

### 최신 UI 적용: 실제 모바일 Wallet 레이아웃 — 2026-10-10 14:41 KST

독립 시안이 아닌 `public/mobile/index.html`, `public/mobile/app.js`, `public/ui/mobile.css`에 디자인을 적용했다. 홈의 다음 진료 카드에는 context 환자명과 조회한 Study 명칭/검사일/촬영 병원을 표시하며 빈 목록에서는 공유 진입 버튼을 비활성화한다. 고정 홍길동/CT/기한이나 생성 시안 이미지를 실제 데이터로 사용하지 않는다. 메뉴는 홈/영상검사/공유 내역/내 정보 네 개로 정리하고 기존 records/vault는 내 정보에서 유지했다. 선택·기관·기간 설정 단계는 유지하고 승인 요약에는 실제 선택 명칭과 요청에 사용되는 제공 기관을 표시한다. QR의 기존 발급/상태 polling/만료 제거/철회 로직은 유지하며 공유 동의 종료시각을 QR 타이머와 분리 표시했다. 기존 로그인 모듈을 유지했고 인증 조건은 변경하지 않았다. `public/mobile/sw.js`의 정적 shell 버전 v9 갱신; 민감 경로 cache 금지 유지. 신규 `test/mobile-wallet-design.test.js` 2검사 추가.

frontend-design 스킬의 정보 계층·여백·선형 아이콘을 적용했다. 관련 FR-001~009/014~025/037~041; API/DB 계약 변경 없음. 집중 명령 `node --test test/mobile-wallet-design.test.js test/mobile-capstone-auth.test.js test/mobile-ticket-status-client.test.js test/mobile-qr-local-expiry.test.js test/capstone-mock-idp.test.js`: **33 PASS/exit0/0.922초**. syntax/diff exit0, secret scan PASS/findings0.

현재 로컬 서버 `http://127.0.0.1:3000/mobile/`의 모바일 인증 receipt 확인은 실패하여 잠금을 유지했다. 이후 별도 소유 Chrome 세션에서 모든 API를 browser route 합성 응답으로 대체한 **UI fixture 시험**만 진행했다: 홈 metadata/선택→기관→승인→QR SVG, 공유 기한 구분, 내 정보/기존 진료기록 접근, 공유 내역 진입 확인. 320/390/1280px 가로 넘침 없음. 마지막 아이콘 정리 후 390px 재확인(아이콘4개). fixture의 동의/QR는 실제 서버에 생성되지 않았다. 캡처 `output/playwright/mobile-wallet-home-fixture.png`, `mobile-wallet-consent-fixture.png`, `mobile-wallet-qr-fixture.png`. 실제 로그인 이후 서버 종단, 설치된 PWA 갱신, VM 배포는 **NOT VERIFIED**. 이 결과를 전체 모바일 E2E PASS로 해석하지 않는다.

배포/서버 재시작/commit/push 없음. 기존 사용자 변경 보존. 신규 증적 DRAFT / UNASSIGNED. 다음 한 작업은 준비한 ID/PW 설정 및 최신 런타임을 정렬한 뒤 실제 인증→환자 홈→승인→QR 정상·거부 흐름을 검증하는 것이다.

### 최신 디자인 작업: 모바일 4화면 로컬 프로토타입 — 2026-10-10 14:34 KST

`public/mockups/mobile-flow/index.html`, `style.css`, `app.js`를 추가했다. 기존 프레임워크/인증/DB 수정 없이 로그인 화면 체험 → 환자 홈 → 공유 조건 확인 → QR 시안을 HTML/CSS 버튼으로 연결했다. URL: `http://127.0.0.1:3000/mockups/mobile-flow/index.html`. frontend-design 스킬의 계층·여백·일관된 타이포그래피를 적용했다. 새 의존성 없음. 합성 홍길동/검사일/기간은 고정 디자인 예시이며 실제 서버 데이터가 아니다. 입력 자격증명, API, storage, 실제 QR 토큰을 사용하지 않는다. 기존 ID/PW 후보의 실행 서버 적용은 여전히 미완료다.

Playwright 실제 Chrome 검증 exit0: 네 화면 이동, 승인 후 QR 표시, 중단창 Escape 취소 시 QR 유지, 사용됨/만료/확인실패에서 QR 숨김, 명시적 중단 및 재실행 비활성, 공유 내역 상태 반영, 처음부터 초기화 확인. 320/390/1440px 가로 넘침 없음. 해당 검증 구간 API/DICOMweb 호출0, pageerror0. 최초 favicon404는 빈 아이콘 선언으로 해소했다. JS 문법 검사 exit0. 화면 캡처 `output/playwright/mobile-flow-login.png`, `mobile-flow-home.png`, `mobile-flow-consent.png`, `mobile-flow-qr.png`.

이는 **디자인 프로토타입 동작 PASS**일 뿐 실제 인증·동의·서버 만료·DICOM/Key Vault 종단 증거가 아니다. 관련 화면 FR-001~009/014~025/032~036 참고; 요구사항 구현 완료로 승격하지 않는다. 새 증적 DRAFT / UNASSIGNED. 배포/commit/push 및 기존 데이터 변경 없음. 다음 작업은 시안 확정 후 기존 모바일 화면에 이 레이아웃을 적용하며 실제 서버 상태 계약을 유지하는 것이다.

### 최신 작업: 웹·모바일 공통 ID/PW 로그인 후보 — 2026-10-10 14:25 KST

사용자 요청에 따라 공통 `public/capstone-auth.js`에 ID/PW 로그인, 회원가입 dialog, Google/네이버/카카오 준비 중 버튼을 추가했다. 회원가입은 비활성 입력 화면이며 계정 생성·개인정보 수집을 수행하지 않는다. 실제 SSO 계약/공급자 등록은 이번 범위에 없으며 인증 성공처럼 표시하지 않는다. 로그인 전 환자명·진단 문구를 일반 안내로 교체했다. 기존 의료진/발표자 키 방식은 별도 선택으로 유지한다.

`src/capstone-mock-idp.js`와 `src/server.js`의 기존 POST `/api/capstone-demo/login`에 username/password 방식을 추가했다. scrypt 솔트 해시 검증, 기존 IP별 시도 제한, trusted ingress 및 감사 저장 후 JWT 반환을 유지한다. 새 계정은 서버의 고정 HCC 합성 환자에만 연결되고 PATIENT JWT만 발급한다. caller가 의료진/관리자 역할·다른 환자 profile을 요청하면 거부한다. 기존 발표자 키의 다중 시연 역할을 이 환자 계정에 승계하지 않았다. `public/app.js`에서도 사용 가능 역할을 넘어선 화면 전환을 안내하고 차단한다. 서버 권한검증을 대체하지 않는다.

요청된 ID는 `Ycdc`. 지정 비밀번호의 솔트 해시는 Git ignored `.env.capstone-patient.local`에 준비했고 평문 비밀번호는 코드/문서/설정 파일에 넣지 않았다. 변수는 `HIPASS_CAPSTONE_PATIENT_USERNAME`, `HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH`다. 이 파일은 일반 서버가 자동 로드하지 않는다. 기존 배포의 Mock IdP/JWT/ingress 비밀 설정과 함께 서버 런타임에 안전하게 주입해야 한다. 구성 파일만으로 새 서버를 시작하거나 실제 운영 인증으로 사용해서는 안 된다. 사용자에게 공유된 시연 자격증명이므로 합성 비운영 환경 한정이며 발표 후 폐기한다.

검증: `node --test test/capstone-mock-idp.test.js test/mobile-capstone-auth.test.js test/clinical-theme-navigation.test.js` **25 PASS/exit0/0.707초**, syntax/diff check exit0, secret scan PASS/findings0. 지정 자격증명과 로컬 해시의 직접 서비스 검증 status200/PATIENT만 발급 확인(카탈로그 준비 조건을 fixture로 주입한 범위이며 HTTP/DB/VM 증거 아님). 브라우저에서 기존 서버의 공통 컴포넌트만 명시적으로 렌더하여 1440×1000/390×844 레이아웃, 회원가입 열기/Escape 닫기 확인. 기존 서버가 새 인증 설정을 로드하지 않아 scenario 요청 실패와 로그인 비활성을 관측했으며 이를 로그인 성공으로 기록하지 않는다. 스크린샷은 `output/playwright/mediq-id-login-web.png`, `mediq-id-login-phone.png`, `mediq-signup-preview.png`.

관련 FR-001~005/014~025/037~041의 인증 경계와 감사 영향. 변경 파일은 위 JS 4개, `public/ui/capstone-login.css`, `test/capstone-mock-idp.test.js`, 이 문서 및 ignored 해시 설정이다. 배포/재시작/commit/push 없음. 실제 웹·모바일 HTTP 로그인과 로그인 후 환자 흐름은 **NOT VERIFIED**. 회원가입 저장·SSO는 **미구현**. 신규 증적 DRAFT / UNASSIGNED. 다음 작업은 기존 합성 시연 런타임에 자격증명 해시를 주입하고 trusted ingress·감사까지 포함해 웹/모바일 로그인 정상·실패를 확인하는 것이다.

### 최신 작업: 의료진 홈 — 환자 중심 Clinical Desk 재구성 — 2026-10-10 14:15 KST

환자 전원 카드와 다음 행동을 상단에 두고, 선택 검사 미리보기 → 가로 검사 목록 → 해당 검사의 최근 활동 순서로 로컬 화면을 재구성했다. 공유 세부정보는 키보드 포커스와 Escape 닫기를 지원하는 native dialog로 분리했다. 서버 context의 환자 정보만 표시하며 홍길동/간암 진단을 하드코딩하지 않는다. 자체 호스팅 폰트, 절제된 블루, 넓은 여백과 모바일 수평 메뉴를 적용했다. frontend-design의 정보 계층과 ui-ux-pro-max의 반응형·키보드 접근성 원칙을 활용했다.

동의 없음은 QR 연결, 승인 대기는 상태 확인, 철회/만료는 공유 내용 확인, 유효 동의는 기존 서버 접근 확인 경로로 연결한다. 살아 있는 동일 Study 토큰과 표시 픽셀이 함께 있을 때만 ‘Viewer로 돌아가기’로 표시한다. 동의 유효 표시를 접근 허용으로 대체하지 않는다. 최근 활동은 기존 조회 결과 중 선택 Study에 해당하는 항목만 사용하고 원문 secret이나 내부 오류를 출력하지 않는다. API/DB/권한/감사 계약 변경 없음. 관련 FR-006~013/032~036; FR-014~031/037~041의 검증 경로 유지.

이번 변경 파일: `public/index.html`, `public/app.js`, `public/ui/clinician.js`, `public/ui/clinician-desk.css`, `test/clinical-dossier.test.js`, 이 상태 문서. 기존 미커밋 변경은 보존했다.

검증 명령: `node --check public/app.js`, `node --check public/ui/clinician.js` 모두 exit0. `node --test test/clinical-dossier.test.js test/clinician-detail.test.js test/clinical-theme-navigation.test.js test/clinician-ui-preview.test.js test/consent-operations.test.js`는 **23 PASS / 0 FAIL / exit0 / 0.431초**. `node scripts/security-secret-scan.js` PASS/findings0/exit0. 변경 코드 diff check exit0(CRLF 경고만 존재).

실제 로컬 Chrome `http://127.0.0.1:3000/hipass/#doctor`: 1586×992/390×844 배치 확인, 모바일 문서 가로 넘침 없음, 상세 창 열기/포커스/Escape 닫기 확인. 동의 없는 합성 CT 선택 → ‘환자 QR 연결’ → 실제 QR 화면 이동을 확인했고 영상 hidden을 유지했다. 최신 console 오류0/경고0. 오래된 DOM 참조 클릭 2회는 실패하여 현재 accessible name으로 재선택했으며 업무 상태 변경은 없었다. 스크린샷: `output/playwright/mediq-clinical-desk-case-first.png`, `output/playwright/mediq-clinical-desk-case-phone.png`, `output/playwright/mediq-clinical-sharing-drawer.png`.

**범위 제한:** 기존 로컬 합성 데이터로 UI/분기만 검증했다. 홍길동 CT 실제 픽셀·VM 배포·Key Vault 종단·최신 전체 회귀는 NOT VERIFIED. 실제 동의/토큰/DB/PACS 변경, 배포, commit/push 없음. 신규 증적 DRAFT / UNASSIGNED. 다음 한 작업은 승인된 합성 CT를 기존 인증 흐름으로 열고 홈 → Viewer → 다음 슬라이스 → 홈 복귀를 확인하는 것이다. 아래 기록은 이전 작업 이력이다.

### 최신 작업: CT Viewer Imaging Studio 디자인 정리 — 2026-10-10 14:04 KST

사용자 요청에 따라 CT Viewer에 집중하여 얇은 검사/환자 상단 바, 차콜 패널, 자체 호스팅 Pretendard, 절제된 블루, 직접 작성한 선형 SVG 아이콘을 적용했다. 큰 홍보형 제목을 제거하고 도구를 영상 위로, 재생/슬라이스 이동을 아래로 모았다. 검사 정보는 기본 접힘이며 버튼/Escape로 열고 닫는다. 화면이 좁으면 Series 목록은 가로로 배치한다. 기존 단일 보호 영상 요소·워터마크·동의·토큰·철회·감사 경로를 유지한다. FR-032~036 중심 변경이며 FR-014~031/037~041의 서버 계약 변경은 없다.

신규 `public/ui/viewer-studio.css`, `public/ui/viewer-studio.js`; 수정 `public/index.html`, `public/app.js`, `scripts/verify-hcc-scenario-candidates.js`. 새 JS는 정보 패널, 기존 openViewer 호출/중복 클릭 방지/로딩 및 오류 표시, 승인된 표시 영상의 pointer 이동을 담당한다. 확대·대비의 기존 아이콘을 유지하고 토글에 aria-pressed, 좁은 화면의 아이콘에 접근성 이름을 붙였다. 임상 HU Window/Level과 화면 대비의 구분은 유지한다. 미구현 비교 레이아웃은 노출하지 않으며 실제 Series 명칭만 표시한다. 새 파일 두 개를 향후 이미지 hash 확인 목록에 포함했다.

실제 로컬 Chrome 확인: `http://127.0.0.1:3000/hipass/#doctor`, 1586×992에서 viewport1400×724, 정보 패널을 열면1152×724; 가로/세로 넘침 없음. 390×844에서도 넘침 없음, 정보 패널/키보드 Escape·접근성 이름 확인. 확대→scale1.5/반전→invert1을 확인하고 초기화 후 두 스타일이 비워지는 것을 관측했으며 아이콘5개 유지. 권한 확인 전 pixel hidden, slider disabled, 폰트 loaded 확인. **이 실행은 영상 대기 화면의 디자인/조작 상태 검증이며 실제 승인된 CT 픽셀 위 drag·Cine·홍길동720장/VM/Key Vault 종단은 NOT VERIFIED**다. 초기 favicon404 이후 새로고침한 앱 console 오류0. 기존 개발 서버/데이터는 유지했다.

검증: 문법 검사 exit0; Viewer/철회경합/슬라이스/요청예산/화면 계약 **25 PASS/exit0/0.620초**, secret scan PASS/findings0. 이번 변경 이후 전체 Node/Security/Container Gate는 재실행하지 않았으므로 앞선899PASS를 최신 전체 결과로 승계하지 않는다. 스크린샷 `output/playwright/mediq-studio-refined-desktop.png`, `output/playwright/mediq-studio-refined-phone.png`. 배포/commit/push 없음. 신규 증적 **DRAFT / UNASSIGNED**. 다음 작업은 실제 승인된 합성 CT로 전체 화면·Series·슬라이스·영상 이동을 확인하는 것이다.

### 최신 작업: 의료진 Clinical Desk / Imaging Studio 로컬 구현 — 2026-10-10 13:52 KST

승인된 밝은 기본 화면과 어두운 CT Viewer 시안을 기존 vanilla JS 화면에 적용했다. 구현 순서는 진료 데스크(수평 메뉴·검사 선택·환자 dossier·동의와 다음 행동) → 기존 단일 Viewer의 다크 레이아웃 → 집중 회귀 및 실제 로컬 브라우저 점검이다. 신규 프레임워크·의존성·API·DB·인증·인가 모델을 추가하지 않았다. frontend-design의 정보 계층·여백과 ui-ux-pro-max의 키보드 focus·반응형 원칙을 적용했다. 스킬 검색의 마케팅 Hero 제안은 의료진 업무 화면에 맞지 않아 채택하지 않았고, 기존 자체 호스팅 Pretendard와 절제된 #3566B8을 유지했다.

이번 수정: `public/index.html`, `public/app.js`, `public/ui/clinician.js`, 신규 `public/ui/clinician-desk.css`, 신규 `test/clinical-dossier.test.js`. 관련 FR-006~009/010~013/032~036; FR-001~005/014~031/037~041의 기존 경로와 보안 검증은 유지한다. 환자 이름·나이는 서버 context에서만 표시하며 동의가 유효해도 접근 허용/영상 전달 완료로 표시하지 않는다. 실제 승인된 blob 픽셀 하나만 기존 controller가 이동하고 생성 시안의 CT 사진은 앱에 넣지 않았다. Viewer의 CSS 밝기·대비를 임상 DICOM W/L로 오인하지 않도록 표시를 수정했다. 기존 QR/감사/관리/비상 열람 hook을 삭제하지 않았다.

검증: `node --check public/app.js` exit0; focused 21검사 PASS/exit0; 전체 `node --test --test-concurrency=4` **899 PASS/exit0/56.350초**. 전체 회귀 이후 서버 context age 표시와 표시 문구를 소폭 보완했으며 집중 회귀를 다시 실행했다. `node scripts/security-secret-scan.js` PASS/exit0/findings0, `git diff --check` exit0(기존 CRLF 경고). Security Gate 전체·container/image 검사·HTTPS 병원 종단은 이번 디자인 작업에서 실행하지 않았다.

기존 로컬 `http://127.0.0.1:3000/hipass/#doctor`를 실제 Chrome에서 확인했다. 1586×992/1280×900/390×844 가로 넘침 없음, 자체 호스팅 폰트 loaded, MRI 검색 7건→1건, 데스크→Viewer→데스크 이동과 선택 유지, 서버 검증 대기/픽셀 hidden/다운로드 disabled 확인. 로컬의 기존 개발용 합성 목록 기준이며 **홍길동720장 CT·Key Vault·A/B VM 브라우저 종단 검증이 아니다**. 초기 favicon.ico404만 관측했고 앱 console 예외는 없었다. 이미지: `output/playwright/mediq-clinical-desk-local.png`, `output/playwright/mediq-imaging-studio-local.png`, `output/playwright/mediq-clinical-desk-phone-local.png`.

VM/Cloud 배포·DB/PACS·기존 환자 초기화·commit/push/merge는 수행하지 않았다. 이전 HCC 후보 image/manifest는 이번 수정 소스의 증거가 아니다. `scripts/verify-hcc-scenario-candidates.js`의 향후 source binding 대상에 clinician renderer와 신규 CSS를 추가했으나 새 image 생성/manifest 실행은 NOT VERIFIED다. 신규 작업·증적은 **DRAFT / UNASSIGNED**. **다음 한 작업:** 새 화면의 실제 홍길동 CT 연결을 현재 배포 기준으로 확인하고, 필요 시 새 후보 이미지 검사·검토·rollback 검증 후 배포한다. 전체 MVP/v3 완료는 선언하지 않는다. 아래 최신 절은 이전 시점 이력이다.

### 최신 작업: 홍길동56세 CT·로그인·초기화 후보 — 2026-10-10 13:32 KST

환자/의료진 로그인 선택과 모바일 시연 세션 확인, 홈 전원 안내 및 기존 열람/동의 callback을 연결했다. 초기화는 삭제가 아닌 기존 계정 중지·동의/토큰/QR/소유권 철회이며 durable backup이 선행한다. 별도56세 CT복사본(4×180장/512²)은 원본 픽셀과 합성 식별자를 보존하고 새 UID를 사용한다. 간암 진단은 발표용 가상 설정이다.

Node896/896·최종 Security Gate PASS, isolated 실제 Chrome 로그인 및 tmpfs PostgreSQL 초기화/rollback/hash chain PASS. 최종 두 이미지 Trivy HIGH/CRITICAL0, 각각21개 runtime파일의 소스 해시 일치. 정확한 이미지·증적·한계·활성화/복구 순서는 [HCC 시나리오 기록](synthetic-hcc-study-transfer-2026-10-10.md#latest-hong-gildong-main-scenario-candidate--2026-10-10-1332-kst)에 있다. 검토 상태는 **DRAFT / UNASSIGNED**다.

현재 배포는 여전히 Bfa5f/Cloud11a23/A30141이며 DB/PACS/기존 환자 목록은 변경하지 않았다. **실제 초기화·Highpass A CT 적재·새 이미지 배포·홍길동 CT 공개 사이트 표시는 미실행/NOT VERIFIED**다. 다음 작업은 정확한 후보와 초기화 범위 검토 후 동일 환자의 source 등록→배포→실제 브라우저 정상·거부를 끝내는 것이다. 전체 MVP/v3 완료를 선언하지 않는다. 아래 ‘최신’ 절은 해당 시점 이력이다.

### 최신 작업: 환자 홈 concept 02 로컬 구현 — 2026-10-10 11:29 KST

사용자가 발표용 재현 검증을 직접 담당하고 디자인 개선을 우선하도록 변경했다. 이는 기존 보안·완료 기준이나 검토 범위를 축소하는 지시가 아니다. 두 번째 화이트 시안을 실제 기존 vanilla JS/Node ESM 화면에 적용했으며 VM/Cloud/A/DB/PACS/인증서/이미지 배포는 변경하지 않았다. B의 실제 배포는 아래 fa5f/Cloud11a23 조합을 유지한다. 현재 디자인은 **로컬 소스 구현/DRAFT / UNASSIGNED**, 기존 사람 승인을 승계하지 않는다.

필요 요소는 별도 프레임워크가 아닌 자체 호스팅 Pretendard Variable1.3.9(OFL1.1 원문 포함/2057688bytes/SHA9599f12f…), 환자 role에만 적용되는 `public/ui/patient-home-premium.css`, 기존 `ui/patient.js` SVG 아이콘이다. 공식 배포 원본 URL/hash는 `public/fonts/pretendard/PROVENANCE.json`에 기록했다. SF Pro/SF Symbols를 배포하지 않고 한글은 Pretendard로 유사한 인상을 구현한다. 외부 CDN 런타임 호출·npm dependency·lockfile 변경 없음. 브라우저 실측 폰트 loaded/제목650weight/primary rgb(53,102,184)=#3566B8. frontend-design의 여백·타이포 계층 및 ui-ux-pro-max의 focus/버튼/정상·오류 표시 지침을 적용했다.

기존 동의/철회/search/Viewer/공유 callback과 API 계약을 보존했다. 공유 동의 카드를 먼저 배치하고 요약은 details로 접었다. 큰 글씨 모드는 기존 쉬운 설명 동작을 유지하며 환자 화면에만18px 확대를 추가했다. 예시 요청·완료 활동을 만들지 않으며 공유 현황의 미연결 안내도 유지한다. 카드의 실제 픽셀은 기존 승인된 Viewer에서만 확인하고 임의 사진을 붙이지 않았다. 서버 변경은 `http-utils.js`의 font/woff2 MIME 및 B Portal의 **단일 exact public font 경로** 허용/MIME뿐이다. B2MiB 제한·CSP font-src self·nosniff·API/DPoP/TLS/원본 접근 차단을 유지한다. 관련 FR-001~009/032~036, 보안 요구사항은 변경 없음.

검증: 집중 UI/QR/환자 context/PHR/Viewer17검사 PASS 및 폰트 경로/정적 계약/안전 text·callback11검사 PASS(모두exit0). 추가 focused6검사 PASS. 실제 기존 로컬 `http://127.0.0.1:3000/hipass/#patient`에서1586×992/1280×900/390×844 가로 넘침 없음·폰트 loaded, MRI 검색·대표 공유 버튼의 영상 목록 진입·카드 공유하기의 선택 Study 유지/동의 설정 진입·큰 글씨18px/aria-pressed·FAQ dialog 열기/닫기를 관측했다. 동의 생성/철회 클릭·실제 Viewer/Key Vault/VM 배포 종단은 이 디자인 시험에서 실행하지 않았다. 기존 로컬 개발용 합성 목록/동의 상태를 조회했으며 원격 캡스톤 환자 데이터 검증으로 확대하지 않는다. localhost favicon.ico404만 console에 있었고 임의 서버/DB 재시작 없음. CLI 최초 설치/실행 오류는 이후 bundled Node로 복구했으며 제품 정책 DENY로 분류하지 않는다.

실제 화면 스크린샷: `output/playwright/mediq-patient-home-premium-final.png`, `output/playwright/mediq-patient-home-premium-phone-final.png`. 신규 source/evidence는 DRAFT / UNASSIGNED. **다음 한 작업:** 사용자 디자인 확인 후 실제 권한을 지키는 썸네일 표시와 동의 상세 화면의 시각적 정렬을 진행한다. 배포가 필요하면 현재 runtime 기준으로 별도 image 구성·검사·복구·검토를 수행하며 기존 fa5f 승인에 새 폰트/server 변경을 승계하지 않는다. 전체 MVP/v3 미완료, commit/push/merge 없음.

최종 source Security Gate **PASS/exit0**: `artifacts/security/patient-home-premium-final-security-gate-20261010.json`(unit63180ms/secret5587ms/dependency4654ms), 기존120초 유한 예산. 실행 pnpm11.7.0/project pin 일치/global manifest11.22 경고 보존. 이는 실제 VM image scan·배포·병원 E2E 결과가 아니다. 발표용 재현 검증은 사용자 담당이나 구현 변경의 집중 회귀·비밀정보 검사는 계속 수행한다.

### 최신 결과: fa5f 실제 인증·QR 만료 및 감사 완료 — 2026-10-10 10:57 KST

기존25011 실행은 재시작 없이 **PASS/exit0/633.299초**로 종료했다. `artifacts/workstation/b-browser-2026-10-10T01-56-13.153679+00-00/result.json`의 **5검사 PASS**: 실제 모바일 개발용 로그인·CT 동의/QR, 실제 인증 기한 후 재로그인 안내와 원래 QR 기한 유지, QR 기한 경과 후 제거, exact 서버 EXPIRED(200/동의·Ticket·expiresAt 일치/서버 시각 기한 경과), fresh DPoP 인증 API의 사용 거부. QR 관측 대기615.799초/서버 관측5.115초, owned 동의 cleanup PASS. 같은 B fa5f/Cloud11a23, `consent_d74d6fb9de2b603`/`ticket_a1bcf76f6b5cd846` 기준이다. verifier API 재인증은 실제 모바일 수동 새로고침/재로그인 성공의 증거가 아니며 Viewer 픽셀·카메라·생체인증도 이 실행 범위 밖이다.

첫 후속 감사는 **exit1/OWNED_PHANTOM_BINDING_REQUIRED**였다. 기존 `makeId`가 두 Uint32의 unpadded hex를 결합하지만 읽기 전용 도구가16자리로 고정한 계약 불일치가 원인이다. 서버 ID 생성·접근정책·DB는 변경하지 않고 Python/원격 JS 도구만 기존2~16자리 소문자 hex 계약과 맞췄다. exact receipt·소유 환자/기관·단일 Ticket·서버 결과 검증, parameterized SQL/read-only transaction은 유지했다. 회귀를 먼저 추가해 Python5PASS/1ERROR로 재현한 뒤6PASS/exit0, JS syntax exit0을 확인했다. 신규 도구/시험은 DRAFT / UNASSIGNED다.

동일 원본 receipt 재감사 **5검사 PASS/exit0**, `artifacts/workstation/phantom-audit-2026-10-10T01-57-07.958408+00-00/result.json`: exact Ticket EXPIRED/동의 REVOKED, 사용 이력 없음, token0/key release0/금지 SUCCESS0, 인증된 TICKET_EXPIRED 거부 감사1건, persisted hash chain **7633 PASS**. 첫 도구 실패를 제품 정책 DENY나 성공으로 바꾸지 않는다. 실제 감사는 cloud service log/packet capture를 대신하지 않는다.

**다음 한 작업:** 실제 모바일에서 안내대로 새로고침→명시적 재로그인→기존 동의 이력 복구/철회까지 확인한다. 설치 PWA migration·재시작 반복·전체 승인된 P0/v3 조건은 미완료다. 신규 실행 증적은 기존 후보 승인에 승계하지 않으며 DRAFT / UNASSIGNED, 전체 MVP/v3 완료·commit/push/merge 없음. 아래 RUNNING 설명은 종료 전 이력이다.

후속 JS ID 경계 시험1PASS/exit0/164.9712ms, secret scan findings0/PASS/exit0, diff check exit0(기존 CRLF 경고). owned CDP9352/9354 Chrome main process가 남지 않았음을 읽기 전용 확인했다. 이 도구 변경 후 전체 Security Gate는 재실행하지 않았으므로 이전 Gate 결과를 신규 전체 회귀로 주장하지 않는다.

### 최신 결과: fa5f 배포 MRI 공유·거부·감사 완료 — 2026-10-10 10:54 KST

기존 실행1682를 재시작하지 않고 관측했으며 **exit0/PASS/202.149초**로 종료했다. B fa5f/Cloud11a23, 합성 HP-TEST-PHANTOM-001의 MRI 동의 `consent_d3336d3884c4a41e`/Ticket `ticket_1cd8f971dde782a5` 기준이다. `artifacts/workstation/b-browser-2026-10-10T01-52-33.837967+00-00/result.json`: 실제 모바일 명시적 승인·QR 연결→의료진 로그인/접수 버튼→256×256 픽셀/다음 슬라이스→동일 동의 모바일 철회/신규 접근 거부의 **7검사 PASS**, 별도 같은 동의에 결속된 API 음성 **9조건 PASS**. 각 거부 사유 감사·token/release/consumed/SUCCESS counter 부작용 부재를 확인했다. 12 SOP metadata 확인을 12장 전체 픽셀 검증으로 확대하지 않는다. owned 동의 cleanup PASS, 카메라·네이티브 생체인증·이 실행의 실제 만료는 NOT VERIFIED다.

Exact MRI receipt의 읽기 전용 PG 감사 **6검사 PASS/exit0**, `artifacts/workstation/phantom-audit-2026-10-10T01-54-32.306918+00-00/result.json`: 동의 REVOKED, 인증/범위/권한/철회/DPoP 거부 사유, versioned Vault release **5건 모두 CONSUMED** 및 감사 연결, 전체 persisted chain **7628 PASS**. Azure Vault 서비스 자체 로그 검증은 아니다. 신규 결과는 **DRAFT / UNASSIGNED**, fa5f 후보 사람 검토를 이후 실행 증적에 승계하지 않는다.

별도 실제 인증/QR 만료 실행25011은 10:55 KST 현재 같은 handle에서 진행 중이다. 다음 한 작업은 해당 실행의 서버 EXPIRED·인증 사용 거부·owned cleanup 및 exact receipt 감사를 확인하는 것이다. 실제 모바일 수동 새로고침/재로그인·설치 PWA migration·전체 MVP/v3 완료는 아직 NOT VERIFIED/미완료다. 아래 RUNNING MRI 설명은 종료 전 이력이다.

### 최신 결과: fa5f 배포 CT 공유·감사 및 병원 패킷 재검증 — 2026-10-10 10:49 KST

10:50:53 KST 후속 실제 관측: 동일25011 owned tab에서 `시연 인증 만료 · 새로고침하여 다시 로그인하세요 · 서버 접수 여부 미확인`, QR 잔여00:04:42/QR 존재=true를 확인했다. 이는 재로그인 안내와 원래 QR 기한 유지의 실제 DOM 관측이며 전체 만료 실행 PASS/서버 EXPIRED/실제 사용자 재로그인 성공을 아직 뜻하지 않는다. 같은 handle이 계속 살아 있다.

실행 중인 B fa5f/Cloud11a23을 보존하고 별도 합성 CT 동의 `consent_3a29a35e436b0bc4`/Ticket `ticket_17fc5a809336f9f9`로 모바일 명시적 동의→실제 의료진 접수→256×256 픽셀/다음 슬라이스→모바일 철회→신규 접근 거부를 완료했다. **정상/철회7검사 및 음성9조건 PASS/exit0/94.944초**, `artifacts/workstation/b-browser-2026-10-10T01-48-58.516663+00-00/result.json`. 실제12 SOP metadata와 다음 슬라이스 관측이며12장 전체 픽셀 검증으로 확대하지 않는다. 각 음성의 정확한 reason audit·token/release/consumed/SUCCESS counter 부작용 부재 확인. 카메라/생체인증/실제 만료는 별도 범위다.

Exact CT receipt 감사 **6검사 PASS/exit0**, `artifacts/workstation/phantom-audit-2026-10-10T01-49-08.487113+00-00/result.json`: owned 동의 REVOKED, 인증·scope·권한·철회·DPoP 거부사유, versioned Vault release4건 모두 CONSUMED와 감사 연결, persisted chain **7509 PASS**. 원격 Vault 서비스 자체 log 검증이 아니다.

`capstone-hospital-packet-check.py`의 기존 default/분류/관측/timeout/cleanup을 유지하고 새 exact SESSION_PORTAL SHA만 allowlist에 추가했다. Python classifier **6PASS/exit0/0.007초**, compile PASS. 실제 `--expected-portal-image sha256:fa5f…` **PASS/exit0/13.825초**, `artifacts/workstation/hospital-packet-20261010T014807Z/result.json`: B source/A host SYN 각1·동일seq3172091127, A PACS 음성0/정상1·CONNECTED, direct ECONNREFUSED, loss0/owned capture cleanup=true. payload·firewall/서비스 변경 없음. 관련 FR-026~041, 새 host 코드/증적 DRAFT / UNASSIGNED, 기존 후보 검토 승계 없음. rollout Python3검사도 PASS/exit0/0.071초 및 secret findings0.

MRI 동일 회귀는 exec**1682**/CDP9354에서 RUNNING, 아직 최종 결과 NOT VERIFIED다. 별도 실제 인증/QR 만료 실행**25011**/CDP9352는 계속 살아 있고 owned mobile tab에서 ISSUED·잔여00:06:59·QR 존재를 안전한 상태 필드만 읽어 관측했다. TTL/clock/session/서비스를 변경하거나 두 실행을 재시작하지 않는다. **다음 한 작업:** 이 두 exact handle의 종료/owned cleanup과 감사 확인, 그 후 실제 모바일 수동 재로그인 흐름을 끝낸다. 전체 MVP/v3·최신 전체 packet/mTLS/재시작 반복·PWA 설치 migration 미완료, commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 검토된 인증 만료 UI의 B-only 적용·복구·재적용 — 2026-10-10 10:45 KST

후속 source Security Gate **PASS/exit0**, `artifacts/security/session-expiry-ui-rollout-security-gate-20261010.json`: unit54542ms/secret1255ms/dependency1497ms. 실제 pnpm11.7.0과 project pin 일치/global manifest11.22 차이 경고 유지. Node Gate는 Python3검사나 실제 배포/브라우저를 대신하지 않는다. 새 증적 DRAFT / UNASSIGNED.

승인된 B UI **sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e**를 실제 B Portal에 적용했다. 신규 `scripts/session-expiry-ui-rollout.py`는 default 읽기 전용/명시적 --apply, 기존 사람 PASS/13 SHA/HEAD·fresh exact B preflight·24시간 내 exact zero High/Critical scan·target runtime를 확인하고 strict SSH/image archive hash와 기존 bounded 운영 함수를 재사용한다. 기존 FAQ operator 파일/pins는 바꾸지 않았다. 후속 도구/증적은 후보 사람 승인 범위 밖이며 DRAFT / UNASSIGNED다. Python rollout 경계3검사 PASS/exit0/0.082초, preflight3검사 유지; compile/secret findings0.

실제 `session-expiry-ui-rollout.py --apply --preflight artifacts/workstation/faq-expiry-preflight-b-20261010T013817Z/result.json`은 **5검사 PASS/exit0/80.954초**, `artifacts/workstation/session-expiry-ui-rollout-20261010T014346Z/result.json`. dcc15 baseline strict TLS→fa5f 적용→dcc15 실제 복구→fa5f 재적용 및 readiness를 확인했고 이미지 외 runtime config 차이0이다. 활성 context는 기존 portal/encryption/patient/FAQ overlay4파일에 `session-expiry-reviewed-20261010.yml` 하나를 더한 **5파일**이다. 복구는 이 다섯 번째만 제외한 원래4파일/dcc15를 사용한다. 기존 FAQ·환자 secret mount·DB/PACS/Cloud/A·volume·TLS 검증을 보존했고 down-v/migration/TTL 변경 없음. image 전달을 위한 owned archive는 검증 artifact이며 Git 추적/secret 자료가 아니다. 실행한 operator는 교체 이전 containerId/context에 고정돼 있으므로 활성 후보를 old baseline으로 간주해 재실행하지 않는다.

실제 모바일 후속 만료 검증 **RUNNING / 최종 결과 NOT VERIFIED**: `$env:HIPASS_BROWSER_SESSION_EXPIRY_UI='1'; ./scripts/run-browser-authorization-trace.ps1 -Port 9352 -Capstone -MobileQr -MobileQrExpiry -BrowserUrl https://192.168.111.149:9443/hipass/`, exec session**25011**, Chrome154 CDP ready. 검증기 optional flag는 기존 expiry mode에서만 허용하며 server login.expiresAt과 원래 QR.expiresAt을 구분한5분 만료/재로그인 안내·QR 존속 확인 후 기존10분 QR 제거/서버 EXPIRED/인증 사용 거부 검증을 유지한다. verifier 자신의 후속 인증만 재로그인하며 모바일 TTL/clock/session은 바꾸지 않는다. 실제 사용자 수동 새로고침 후 기존 동의 복구/PWA 설치 캐시 migration은 아직 별도 NOT VERIFIED다. 새 Node verifier syntax exit0이며 기존 mode의 기대 동작은 유지했다.

**다음 한 작업:** 동일25011 handle의 종료·owned cleanup 및 exact receipt PG 감사를 확인하고 실제 모바일 재로그인 흐름을 끝낸다. 이 실행을 중복 시작하거나 기다리는 중 서비스 재시작하지 않는다. 이전 dcc15/11a23 CT/MR·packet PASS는 역사적 조합이며 새 fa5f의 전체 회귀/packet/재시작·반복 시연으로 승계하지 않는다. 전체 MVP/v3 미완료, commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 새 인증 만료 UI 후보 사람 검토 PASS — 2026-10-10

승인 후 실제 B 읽기 전용 재점검도 **PASS/exit0**로 종료했다: `artifacts/workstation/faq-expiry-preflight-b-20261010T013817Z/result.json`. 같은 dcc15 containerId/4개 Compose file hash/config digest, healthy·env·bind mounts 일치, 변경은 portal.image만 가능하고 baseline image 존재를 다시 확인했다. 새 후보 전송·배포·TLS readiness·실제 rollback은 수행하지 않았다. 이 신규 receipt는 **DRAFT / UNASSIGNED**, 후보 검토 승인에 포함하지 않는다. 최종 secret findings0/PASS, diff check exit0(기존 CRLF 경고).

사용자 직접 응답 **김범희 / 2026-10-10 / PASS / 예외 없음**을 정확한 B UI 후보 `sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e`와 검토 manifest에 결속된 기존5증적·8소스에 기록했다. 기록 전13파일 SHA를 재검증했고 변경0/PASS, HEAD4ea53 일치였다. `artifacts/workstation/session-expiry-ui-review-manifest-20261010.json`의 reviewer/date/decision을 실제 사람 판정으로 갱신했으며 기존 DRAFT/null 설명은 검토 이전 이력이다. 추가 countdown follow-up 시험·신규 배포 도구·이후 실제 배포/복구/브라우저 결과와 전체 MVP는 승인 범위 밖이며 DRAFT / UNASSIGNED를 유지한다.

승인 부재 차단은 해소됐으나 아직 새 UI 배포/복구·실제5분 만료 안내·재로그인/PWA 갱신은 NOT VERIFIED다. 현재 B dcc15/Cloud11a23을 보존한 채 exact B4파일/target runtime 읽기 전용 사전점검을 새로 실행한다. 이후 fresh receipt에 고정된 B-only image 적용·복구·재적용과 실제 사용자 흐름을 진행한다. Cloud/A/PACS/PG/DB/TTL 변경은 필요하지 않다. 전체 MVP/v3 완료·commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 작업: 인증 만료 UI 후보 검토 자료·현재 B 배포 읽기 전용 점검 — 2026-10-10 10:30 KST

후속 추가 검증: `test/mobile-qr-local-expiry.test.js`에 **인증 만료 안내→QR 기한1ms 전→정각**을 같은 Ticket/DOM/context에서 연결하는 시험을 추가했다. 실제 소스 함수로 expiry 오류가 요청 없이 polling만 정지하고 QR timer는 보존한 뒤 기한에 메모리 capability/QR 표시를 제거하는 것을 검증했다. server receipt 없이 서버 확인/사용 완료라고 표시하지 않고 countdown/polling timer를 정확히 정리한다. 관련4파일 집중 **28PASS/exit0**, `artifacts/workstation/session-expiry-countdown-followup-20261010.txt`. 이 추가 unit 증거·테스트 파일은 앞서 결속한5증적/8소스 사람 검토 범위 밖의 **DRAFT / UNASSIGNED**다. 후보 static3파일/image/SHA는 변경하지 않았으며 실제 배포·5분 브라우저 관측·재로그인 증거로 확대하지 않는다. 새 후보의 사람 판정은 여전히 null이므로 배포하지 않았다. secret findings0/PASS 및 diff check exit0(기존 CRLF 경고).

새 후보 **sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e**의 검토 packet은 `artifacts/workstation/session-expiry-ui-review-manifest-20261010.json`이다. 기존 후보 승인 승계 없이 reviewer/date/decision은 null, **DRAFT / UNASSIGNED**. 정확한 후보/base·HEAD4ea53+dirty, 기존 소스 Security Gate/후보 scan/Container Gate/선택된 정적·서버 hash delta/이번 preflight의5증적 SHA 및 코드·테스트·Dockerfile·preflight8파일 SHA를 결속했다. 제품 구현 완료·실제 배포·rollback·모바일5분 기한 안내·재로그인·기존 PWA 업데이트·후속 결과 승인 자료가 아니다.

`scripts/session-expiry-ui-preflight.py`는 역사적 operator 파일/pins를 바꾸지 않고 별도 import instance의 exact B dcc15→fa5f와 **현재4개** Compose context만 사용한다. 기존 strict VM host trust/MAC, concealed credential/stdin, bounded SSH/명령, environment/bind mount/render 비교를 재사용한다. Cloud role/3개·5개·순서 변경 파일/다른 image/mount 변경 거부 및 generated remote compile의 Python **3검사 PASS/exit0/0.005초**. 새 도구는 쓰기·image 전송·실행 변경 옵션이 없다. Node Gate를 Python 증거로 대신하지 않는다.

실제 B strict SSH 사전점검 **PASS/exit0**, `artifacts/workstation/faq-expiry-preflight-b-20261010T013010Z/result.json`: Portal dcc15 healthy·exact containerId, portal/encryption/patient/FAQ overlay4파일 및 SHA, Compose/render/runtime env·bind mounts 일치, candidate stdin render에서 **portal.image만 변경**, baseline dcc15 image 존재 확인. 원격에 새 후보가 적재됐다고 주장하지 않으며 baseline availability는 실제 rollback PASS가 아니다. target container/config hashes는 향후 적용 직전에 다시 확인해야 한다. Cloud/A/PACS/DB/secret/volume/서비스 변경·artifact 전송 없음. secret findings0/PASS, 신규 도구 py_compile exit0.

검토 요점: 기존5분 인증 기한을 유지하면서 명시적 만료 안내/수동 새로고침·재로그인, QR countdown 유지, 인증 만료≠Ticket 만료/사용 완료, 일반 장애와 구분. 대상 후보·5증적·8소스만 독립 사람 검토 요청 대상이다. **다음 한 작업:** 새 후보 검토 결과를 확인하고 현재4파일/target SHA에 고정된 B-only 적용·복구와 실제 사용자 재로그인/만료 흐름을 검증한다. 아직 미배포, 전체 MVP 미완료. 아래는 이전 이력이다.

### 최신 작업: 모바일 인증 만료 안내 최소 수정·로컬 후보 — 2026-10-10 10:28 KST

현재 실행 B dcc15/Cloud11a23은 변경하지 않았다. `public/capstone-auth.js`는 기존 동일 기한 비교에서 던지는 Error에 `CAPSTONE_SESSION_EXPIRED` 코드만 추가했다. `public/mobile/app.js`는 그 코드만 인증 만료로 구분해 `시연 인증 만료 · 새로고침하여 다시 로그인하세요 · 서버 접수 여부 미확인`을 표시하고 해당 Ticket의 상태 polling만 멈춘다. QR countdown/기한/terminal 판정은 보존하며 인증 만료를 Ticket EXPIRED/USED로 표시하지 않는다. generic 오류·잘못된 응답은 기존 조회 실패 안내를 유지한다. 자동 재로그인/role fallback/TTL 연장/secret 저장/오류 원문 표시 없음. PWA public shell은 v6→v7로 갱신했으나 기존 설치 캐시의 실제 업데이트는 NOT VERIFIED다. UI/UX 스킬의 확인된 error-recovery 지침(명확한 다음 행동)을 적용했으며 디자인 재설계 없음. 관련 FR-021~025/032~036, 서버/API/DB 계약 변경 없음.

회귀 시험을 먼저 추가해 기존 코드 **5PASS/1FAIL/exit1**(인증 만료를 generic 조회 실패로 표시)로 재현했다. 수정 후 집중 **25PASS/exit0/265.4661ms**, 실제 header 함수의 기한1ms 전/정각/1ms 후, role 거부, auth expiry의 요청0/새 polling0/QR deadline timer 유지, 코드 없는 같은 문구를 expiry로 오판하지 않음을 검증했다. 기존 terminal/late response/foreign receipt/잠금/인증 fallback 거부 시험 유지. Node syntax 및 diff check exit0(CRLF 경고 보존).

최종 Security Gate **PASS/exit0**: `artifacts/security/mobile-session-expiry-ux-final-security-gate-20261010.json`, unit56124ms/secret3787ms/dependency2957ms. pnpm11.7.0 pin 일치/global manifest11.22 경고 유지. 앞선 gate도 별도 PASS였으나 SW 변경 후 이 최종 gate를 재실행했다. `Dockerfile.session-expiry-ui`는 exact B dcc15 기반 정적3파일만 복사한다. `--pull=false --network=none` 로컬 빌드 exit0, 후보 **sha256:fa5f382a79f30bce50580c5128599a8567e32407bc4a95ea242f05888ab0dc7e**. 필수 base ARG의 InvalidDefaultArgInFrom 경고를 보존하며 명시적 base 없이 사용하지 않는다.

후보 차이 `artifacts/workstation/session-expiry-ui-delta-20261010.json` **3검사 PASS/exit0**: Config 차이0/base layer prefix, 정적3파일 exact source SHA, services/B portal source 보존. 전체 filesystem/모든 secret 부재 증거로 확대하지 않는다. 고정 Trivy0.58.2 scan은 exact 후보 ID·Critical0/High0, `artifacts/security/container-scan/session-expiry-ui-20261010.json`이다. image/container gate와 소스 시험은 실제 배포/브라우저/10분 대기/재로그인 후 동의 복구 검증을 대신하지 않는다. 신규 코드·후보·증적 **DRAFT / UNASSIGNED**, 기존 후보 PASS 승계 없음.

**다음 한 작업:** exact 새 UI 후보의 검토용 증적을 결속하고 현재 B4개 Compose context에 고정된 image-only 적용/복구를 준비한 뒤, 실제 모바일의5분 인증 만료 안내와 QR10분 서버 만료/재로그인 흐름을 끝낸다. Cloud/A/PG/PACS/TTL 변경 불필요. 이후 재시작·반복 시연·남은 승인된 P0 요구사항 감사가 남는다. 미배포/전체 MVP 미완료, commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 실제 QR 만료·사용 거부 및 감사 완료 — 2026-10-10 10:23 KST

기존 실행61057을 재시작하지 않고 끝까지 관측했으며 **exit0/PASS/632.986초**로 종료했다. B dcc15/Cloud11a23, 합성 CT 환자 HP-TEST-PHANTOM-001의 exact 동의 `consent_4c6225bd40edeb84`/Ticket `ticket_6f48706283748bc2` 기준이다. `artifacts/workstation/b-browser-2026-10-10T01-23-00.606051+00-00/result.json`: 로그인/동의·QR/실제 QR 제거/서버 EXPIRED·사용 거부의 **4검사 PASS**, 실제 expiryWait602.975초. 서버 상태200/EXPIRED와 동의·Ticket·expiresAt 일치, 서버 시각이 기한 전이 아님을 확인한 뒤 fresh DPoP를 사용하는 인증 API로 한 번 사용 시도해 TICKET_EXPIRED를 확인했다. QR 제거만으로 서버 차단을 선언하지 않았다. TTL·시계·모바일 세션 변경 없음; verifier 자신의 만료 인증만 재로그인했다. owned 동의 철회 cleanup PASS. 이 실행은 실제 의료진 UI/Viewer 픽셀·카메라·네이티브 생체인증의 증거가 아니다.

후속 `python scripts/capstone-phantom-audit-check.py --ticket-expiry <exact browser receipt>` **5검사 PASS/exit0**: `artifacts/workstation/phantom-audit-2026-10-10T01-23-15.429091+00-00/result.json`. 정확한 EXPIRED Ticket/owned 동의 REVOKED, 사용 안 됨, token0/key release0/금지 SUCCESS0, 해당 인증 사용 거부 감사1건, 전체 persisted chain **7374 PASS**. 이는 DB 감사이며 원본 PACS 조회 패킷/클라우드 서비스 audit log까지 증명하지 않는다. 신규 증적 **DRAFT / UNASSIGNED**, 후보 사람 PASS 승계 없음.

남은 실제 문제: 대기 중 모바일 상태가 일반 `서버 상태 확인 실패 · 접수 여부 미확인`으로 바뀐다. 코드상 capstone-auth의 인증 기한 경과는 headers 생성 시 요청 전에 throw되고 refreshActiveTicketStatus가 모든 오류를 동일 안내로 처리한다. owned CDP의 각15초 관측2회는 해당 상태 응답을 보지 못했으므로 HTTP401 또는 네트워크 장애로 확정하지 않는다. 관련 기존 인증/상태 시험17개 PASS/exit0/219.371ms지만 실제 오류 원인 확정이나 UX 해결 증거는 아니다. **다음 한 작업은 인증 만료와 서버 상태 장애를 구분하고 재로그인을 안내하는 최소 UX 변경·정상/음성 검증**이다. 인증/QR TTL 연장·자동 재로그인·권한 우회 없이 처리하며 그 후 최신 재시작/반복 시연을 진행한다. 아래 RUNNING 설명은 종료 전 이력이다. 전체 MVP/v3 완료·commit/push/merge 없음.

### 최신 결과: 최신 배포 CT·MRI 공유 정상/거부·감사 및 통신 경계 재검증 — 2026-10-10

추가 관측(2026-10-10 01:18 UTC): 실제10분 QR 만료 실행61057은 같은 handle에서 살아 있다. 같은 owned mobile tab의 안전한 상태 필드만 읽었으며, `서버 상태 확인 실패 · 접수 여부 미확인`, 잔여 `00:04:36`, QR 존재=true를 확인했다. 이는 서버 만료/사용 차단 판정이 아니며 원인도 미확정이다. 최초 수동 관측 명령은 PowerShell quoting 문법 오류로 exit1이었고 stdin 관측 재실행은 exit0; 제품 DENY로 분류하지 않는다. 기존 실행·TTL·시계·서비스·browser session을 변경하지 않았다. 종료 receipt의 서버 EXPIRED/사용 거부/정리·감사를 확인한 뒤 이 화면 실패를 별도 안정성 문제로 평가한다. DEMO-RUNBOOK과 Release Runbook은 최신 재현 절과 과거 상태를 분리했고 MVP-SCOPE는 학생용 실제 Key Vault 시연 증거와 미완료 운영 KMS/HSM을 구분했다. 문서 변경 후 secret scan findings0/PASS 및 diff check exit0(기존 CRLF 경고), 새 기술 검토/전체 완료 승격 없음.

HEAD4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401+dirty. 먼저 실제 strict SSH inventory `artifacts/workstation/packet-inventory-20261010T010543Z/result.json` (exit0)를 수집해 B Portal **dcc15c29…**, Cloud Control **11a23eea…**, A Gateway30141/PACS9f74/mTLS proxy853ed, ingress9c210/PG8d0e의 running/healthy 및 네트워크를 확인했다. ingress Docker health 미설정과 종료된 one-shot bootstrap/migration은 실행 서비스 healthy라고 표시하지 않았다. 재배포·DB/schema/volume/인증서 변경 없음.

같은 합성 환자 HP-TEST-PHANTOM-001, A→B, 각 Study/Series 하나, TREATMENT/VIEW_ONLY로 **모바일 명시적 동의/QR→실제 의료진 로그인/접수 버튼→A Gateway의 CT/MR Viewer→동일 동의 모바일 철회→신규 접근 거부**를 다시 끝냈다. 카메라 scan 대신 제공되는 QR 연결 버튼을 썼다. 실제256×256 픽셀/다음 슬라이스를 관측했고12개 exact instance metadata를 확인했다. 원본 검사 이름의 `12_SLICES`를 모든12장 픽셀 검증으로 해석하지 않는다. 음성 API는 정상 UI token과 별개의 verifier-key-bound token이며 같은 동의를 사용한다.

| 동일 흐름 | 정상/철회 및 음성 | 실행시간/종료 | artifacts/workstation 원본 |
|---|---|---|---|
| CT | 7검사 PASS + 아래9조건 PASS | 90.127초/exit0 | b-browser-2026-10-10T01-07-35.411092+00-00/result.json |
| MR | 7검사 PASS + 아래9조건 PASS | 202.176초/exit0 | b-browser-2026-10-10T01-11-09.333082+00-00/result.json |

각9조건은 다른 Series, 잘못된 병원, 환자 역할의 의료진 token 발급, 의료진 ID 위장, 동의 ID 누락, 존재하지 않는 동의, token 변조, DPoP 누락, DPoP 재사용이다. 각 요청 전후 read-only PG에서 token/release/consumed/SUCCESS count 및 consent scope hash 동일성과 정확한 거부 사유 audit 증가를 확인했다. 응답에 token/암호문/키 envelope 없음. 403만으로 PASS 처리하지 않았으며 Study 범위·VIEW_ONLY 다운로드·철회 거부 사유는 후속 감사와 연결했다. QR 재사용도 서버 거부를 확인했다. 카메라/생체인증/실제 만료는 이 실행 범위 밖이다.

각 exact receipt의 감사 **6검사 PASS/exit0**: CT `phantom-audit-2026-10-10T01-07-44.579274+00-00/result.json`, MR `phantom-audit-2026-10-10T01-11-55.440962+00-00/result.json`. 정확한 동의 REVOKED와 actor/Study/Series/권한/철회/DPoP 사유, CT4건·MR5건 release가 모두 CONSUMED/versioned Vault binding/audit linkage를 확인했다. 정상 prefetch 수를 고정4건이라고 주장하지 않는다. 마지막 전체 persisted hash chain **7327 PASS**. Azure Vault 서비스 자체 audit log 검증이 아니다. owned 동의 cleanup PASS; exact 두 Chrome PID/profile/해당 profile child process가 모두 사라졌음을 `latest-shared-browser-cleanup-20261010.json`에 기록했다.

최신 image pins의 통신 경계도 재검증했다. host 패킷 도구는 기존 legacy pin을 default로 보존하고 검토된 새 exact image를 명시하는 allowlist 옵션만 추가했다. 임의 image/SHA wildcard·classifier·정상 대조군·timeout·cleanup 조건 완화 없음. Cloud ingress→PG `cloud-packet-20261010T010933Z.json` **PASS/exit0**: negative source SYN3/destination0, 정상 control SYN1/CONNECTED, loss0/capture cleanup=true. B→A raw PACS `hospital-packet-20261010T011002Z/result.json` **PASS/exit0/13.475초**: source/host 동일seq1816102805 SYN 각1, PACS negative0/normal1, direct ECONNREFUSED, loss0/cleanup=true. transport 차단을 사용자 인가 DENY로 분류하지 않았다. 특정 firewall 규칙·모든 포트·운영 보안 승인으로 확대하지 않는다.

A mTLS `current-mtls-2026-10-10T01-10-41.786816+00-00/result.json` **8검사 PASS/exit0**: valid ALLOW, 무인증/wrong issuer/SAN/EKU/expired/bad DENY 및 정확한 test key cleanup. runtime cert 교체/CA private key 전송/seed/TLS 우회 없음. Python packet classifier 각6개 PASS/compile exit0, 최신 source Security Gate PASS/exit0(unit54924ms/secret1390ms/dependency1635ms), `artifacts/security/latest-shared-flow-security-gate-20261010.json`. Node gate는 Python 시험을 대신하지 않는다. pnpm11.7.0 pin 일치/global manifest 차이 경고 유지. host pins/tests만 수정했고 앱/API/DB/동의/TTL 정책은 변경하지 않았다. 관련 FR-001~005/010~041. 새 코드·10개 실행 증적 hash는 `artifacts/workstation/latest-shared-flow-manifest-20261010.json`에 결속했으며 **DRAFT / UNASSIGNED**, 이전 사람 PASS 승계 없음.

**지정한 CT·MRI 공유 사용자 흐름 — 정상·거부 종단 검증 완료.** 전체 MVP/v3 완료가 아니다. 다음 한 작업인 **최신11a23 배포에서 실제10분 QR 기한 경과→서버 EXPIRED→사용 거부→감사/부작용 부재**를 이미 착수했다: `run-browser-authorization-trace.ps1 -Port 9350 -Capstone -MobileQr -MobileQrExpiry -BrowserUrl https://192.168.111.149:9443/hipass/`, exec session61057. 동일 Chrome/tab에서 ISSUED·QR 존재·00:09:48을 01:13 UTC에 관측했다. **RUNNING / 최종 결과·정리 NOT VERIFIED**이며 재시작/TTL/clock 변경 없이 같은 handle을 관측한다. 이후 최신 재시작/반복 시연·Runbook·전체 완료 감사 및 남은 승인된 P0 요구사항이 필요하다. commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 검토 후보 실제 적용·복구와 FAQ/본인 CT·MRI 브라우저 검증 — 2026-10-10

김범희님의 exact 두 후보/기존6증적 PASS를 확인한 뒤 **B Portal UI와 Cloud Control service만 순차 교체**했다. 신규 `scripts/faq-expiry-rollout.py`는 읽기 전용 default/명시적 `--apply`, 검토된6증적 SHA·HEAD·동일 source delta·24시간 내 zero High/Critical scan·1시간 내 exact 역할 preflight·실제 target ID 및 config/file hashes를 확인한다. strict SSH, archive SHA, concealed VM credential/stdin, public CA만 사용했다. 새 host operator와 아래 실행 증적은 DRAFT / UNASSIGNED이며 후보 승인에 승계하지 않는다. A Gateway30141/PACS9f74/mTLS proxy853ed·Cloud ingress9c210/PG8d0e는 교체하지 않았다. Azure-deploy 스킬은 AZD plan 부재로 적용할 수 없어 기존 VM Compose 경로를 사용했으며 새 Azure 리소스/배포 체계는 생성하지 않았다.

| 적용/복구 | 현재 실행 exact image | 실제 결과 | 증적 (artifacts/workstation/) |
|---|---|---|---|
| B Portal | sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1 | 5검사 PASS/exit0/83.626초 | faq-expiry-rollout-b-20261010T005751Z/result.json |
| Cloud Control | sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b | 5검사 PASS/exit0/118.658초 | faq-expiry-rollout-cloud-20261010T010009Z/result.json |

각 baseline→candidate→baseline 복구→candidate 재적용에서 TLS chain/hostname readiness와 environment/mount/command/security/port/network 차이0을 확인했다. Cloud ingress/PG container ID 보존. B는 기존3개+`faq-expiry-reviewed-20261010.yml`의4개 파일, Cloud Control은 ingress overlay를 보존한 기존7개+동일 명칭 role overlay의8개 파일로 실행 중이다. 복구 시 B3개/Cloud7개를 유지한다. Cloud Control 원래6개 creation label은 복구 후7개로 바뀌었지만 기존 active ingress 구성을 유지한 image-only 복구이며 환경 차이0이다. 원본 Config/DB/volume/secret/인증서 overwrite, down-v, migration 없음. 이 operator는 **교체 이전 ID/config에 고정된 일회성 검증**이며 이미 활성화된 후보를 옛 baseline으로 간주해 재실행하지 않는다.

직접 HTTPS 공개 B ingress와 owned Chrome profile을 사용해 실제 login→Study 선택→본인 Viewer→FAQ를 4조합으로 검증했다. 동의 공유를 대신하는 self-view 증거가 아니다. 각9검사에는 정확한 patient/Study VIEW_ONLY Grant, 실제256×256 픽셀/서로 다른2슬라이스, Viewer close 픽셀 제거·초점 복원, 저장소 token 없음, FAQ 추천 답변·대화 지우기·의료 판독 요청 거절/입력 비우기·Escape close/초점 복원·가로 overflow 없음이 포함된다. 모바일375px PWA/개발용 잠금 해제이며 실제 생체인증/네이티브 앱이 아니다. 모바일 FAQ screenshot을 직접 확인했다. 링크 클릭 이동/오프라인 SW/기존 설치 캐시 업데이트/모든 개인정보 입력 패턴/스크린리더는 이번 후보 실행에서 NOT VERIFIED다.

| 실제 브라우저 | 결과/소요 | 원본 (artifacts/workstation/) |
|---|---|---|
| CT / 환자 웹 | PASS/exit0/10.408초/cleanup=true | patient-real-browser-9dd9d487a3f4/result.json |
| MR / 모바일 | PASS/exit0/12.309초/cleanup=true | patient-real-browser-e78ebcfa7110/result.json |
| MR / 환자 웹 | PASS/exit0/11.822초/cleanup=true | patient-real-browser-620e6b1f1361/result.json |
| CT / 모바일 | PASS/exit0/12.372초/cleanup=true | patient-real-browser-e004501ea686/result.json |

동일4개 exact receipt의 read-only PG 감사 **13검사 PASS/exit0**: self-view Grant scope/owner/gateway, key release 총8건 모두 CONSUMED/versioned Vault binding, Grant·wrap·release auditSession 연결, 전체 persisted hash chain **7118 PASS**. `artifacts/workstation/patient-public-audit-20261010T010350Z.json`. Azure 서비스 자체 audit log, 전체 공유 동의/철회·만료·DPoP 음성 증거로 확대하지 않는다. 감사 DB 직접 수정·영상 원본 중앙 저장 없음.

신규 host 경계 Python4+4개 PASS/compile exit0. Node FAQ/browser focused8개 PASS/212.1815ms. 배포 전 Security Gate PASS/exit0(unit55638ms/secret1315ms/dependency1777ms), `artifacts/security/faq-expiry-rollout-security-gate-20261010.json`. 실제 FAQ 검증기 보강 후 Security Gate도 PASS/exit0(unit54862ms/secret1152ms/dependency1651ms), `artifacts/security/faq-deployed-browser-tool-security-gate-20261010.json`; pin11.7.0/global manifest 차이 경고 유지. rollout Python fixture는 ignored 실제 검토 자료 없이도 synthetic tmp evidence로 실행 가능하게 했으며 마지막4개 PASS와 secret findings0을 재실행했다. 관련 FR-001~005/014~025/032~041, SEC-QR-01, API/DB/TTL/권한 계약 변경 없음.

**완료 범위: 검토된 역할별 image 적용·실제 복구·재적용 및 실제 환자 웹/모바일 CT·MRI 본인 열람과 지정 FAQ 상호작용·감사 검증.** 모든 실행 handle은 exit0로 종료했고 owned Chrome/profile cleanup=true다. 전체 MVP/v3 미완료. **다음 한 작업은 최신 dcc15 UI/11a23 Control 조합에서 모바일 명시적 동의→QR→실제 의료진 CT/MR Viewer→철회와 기존9개 음성 조건·감사를 다시 끝내는 것**이다. 신규 정확한 만료 경계의 deployed 상태/사용 거부, 최종 mTLS/packet 재검증, 재시작/반복 시연 및 Runbook/전체 완료 감사는 별도 미완료다. commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 후보 사람 검토와 실제 배포 사전점검 — 미배포 / 2026-10-10

사용자가 지정한 **김범희 / 2026-10-10 / PASS / 예외 없음**을 B UI `dcc15c29…` 및 Cloud Control `11a23eea…`의 정확한 image와 아래 후보 준비 단계의 기존6개 증적에 한정해 기록했다. `artifacts/workstation/faq-expiry-candidate-review-20261010.json`에 exact IDs·HEAD4ea53c2+dirty·증적 SHA-256을 결속했다. 신규 host 사전점검/배포 도구·이후 실행 결과·배포/복구/브라우저 E2E·전체 MVP는 승인 범위 밖이다. 이전 DRAFT 문구는 이 사람 검토 이전 이력이며 전체 코드/향후 증적 PASS를 의미하지 않는다.

신규 `scripts/faq-expiry-deployment-preflight.py --role CLOUD` 및 `--role B`를 실제 strict SSH에서 실행했다. 쓰기/전송/컨테이너 교체 없이 Docker image availability·healthy·exact project/path/file list·runtime 환경/마운트와 Compose render 일치·stdin 후보 overlay의 **대상 image 한 필드만 변경**을 검증했다. 비밀값과 전체 inspect/config는 출력하지 않는다. 별도 IPv4/hostname TLS readiness 또는 actual rollback 증적은 아니다.

| 대상 | 현재 baseline → 검토된 후보 | 현재 실제 결과 | 원본 증적 |
|---|---|---|---|
| B Portal | 27e1bd82… → dcc15c29… | PASS/exit0, portal image 외 변경0, baseline image 존재 | artifacts/workstation/faq-expiry-preflight-b-20261010T005058Z/result.json |
| Cloud Control | 30141f81… → 11a23eea… | PASS/exit0, control image 외 변경0, ingress9c210/PG8d0e 보존 | artifacts/workstation/faq-expiry-preflight-cloud-20261010T005016Z/result.json |

현재 Cloud Control은 원래6개 생성 label을 유지하고 ingress는 추가 `patient-ingress-reviewed-20261010.yml`을 포함한7개 label을 가진다. 같은 stage/앞6개 일치를 확인하고 **현재 ingress overlay를 보존한7개**로 배포 계획을 렌더링했다. 기존 Control6개 label을 전체 project의 최신7개라고 잘못 주장하지 않는다. B는 현재3개 `portal.yml/encryption.yml/patient.yml`를 유지한다. 각 receipt에 exact file hashes/target container ID/config digest/복구 image와 보호 대상 container ID를 기록했다.

최초 cloud 사전점검은 위6/7개 구분 미반영으로 BASELINE/ValueError **NOT VERIFIED**, `faq-expiry-preflight-cloud-20261010T004933Z/result.json`에 보존했다. 최초 B는 Portal runtime에 존재하지 않는 key-release 서비스 env를 읽어 CURRENT_COMPOSE/KeyError **NOT VERIFIED**, `faq-expiry-preflight-b-20261010T005022Z/result.json`에 보존했다. B의 기존 배포에 쓰인 공개 versioned Vault ID를 Compose 입력으로 사용하고 runtime에 새 env/secret을 추가하지 않았다. 두 오류는 인증/인가 DENY나 정상 배포로 분류하지 않는다. 수정 후 role/file/image/env 변경 거부 및 생성 remote 문법 **Python4개 PASS/exit0/0.007초**. 신규 host 자료는 DRAFT / UNASSIGNED다.

최종 source Security Gate도 **PASS/exit0**(unit54555ms/secret1110ms/dependency1550ms), `artifacts/security/faq-expiry-preflight-security-gate-20261010.json`. Node gate는 별도 Python4개 시험을 대신하지 않는다. Python compile/secret findings0/문서 diff check exit0, 기존 CRLF 경고 유지. 모든 SSH/PTY 검증 handle은 종료됐고 재시작/배포하지 않았다.

**다음 한 작업:** 검토 image/evidence hash와 최신 preflight baseline을 재확인하는 역할별 image-only 적용·baseline 복구·재적용 도구를 준비·시험하고 실행한 뒤, 실제 FAQ 웹/모바일 및 같은 CT/MR 정상·거부·감사를 재검증한다. 적용 시 B와 Cloud를 순차 처리하고 A/PACS/ingress/PG·DB·volume·secret mount는 교체하지 않는다. image만 복구하더라도 환자 overlay와 ingress overlay를 함께 보존하며 down-v/migration은 금지한다. **아직 후보 배포/실제 rollback/최신 후보 브라우저 E2E NOT VERIFIED, 전체 MVP/v3 미완료.** commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: FAQ·QR 만료 역할별 후보 준비 — 미배포 / 2026-10-10

HEAD `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401` + dirty. 기존 실행 환경은 교체하지 않았다. B Portal27e1의 UI overlay 후보는 `sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1`, Cloud Control30141의 service 후보는 `sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b`다. `--pull=false --network=none`으로 로컬 exact base에 기반해 빌드했고 각 exit0. A Gateway/PACS/ingress/PG는 대상이 아니다. Dockerfile의 필수 base ARG에 대한 InvalidDefaultArgInFrom 경고는 보존하며 명시적 base 없이 빌드하지 않는다.

| 검증 | 실제 결과 | 증적 (artifacts/ 아래, clone 미포함) |
|---|---|---|
| UI 정적 자산 소스 일치 | 35개 PASS / exit0 | workstation/faq-ui-candidate-manifest-20261010.json |
| 역할별 config·base layer·파일 차이 | 4검사 PASS / exit0 | workstation/faq-expiry-candidate-delta-20261010.json |
| UI Container Gate | PASS / exit0, Critical0 / High0 | security/faq-ui-container-gate-20261010.json |
| Control Container Gate | PASS / exit0, Critical0 / High0 | security/qr-expiry-control-container-gate-20261010.json |
| Control 후보 내부 만료 smoke | 4검사 PASS / exit0 | workstation/qr-expiry-candidate-smoke-20261010.json |
| FAQ·환자 context·Ticket focused | 30/30 PASS / exit0 / 3348.6455ms | 해당 Node 테스트 실행 결과 |

고정 Trivy0.58.2 scanner 결과의 실제 ImageID와 각 Gate 대상을 일치시켰으며 예외·보안 정책 완화 없음. 두 후보의 inherited Config 차이0/base layer prefix 보존을 확인했다. 35개 UI manifest 대상 중 변경은 app/index, mobile app/index/sw, FAQ js/catalog/css의 정확한8개이며 UI 서버 서비스 파일은 보존했다. Control 서비스는 기존 image와 LF 정규화 비교 시 만료 비교 `<`→`<=` 두 곳만 다르다. 이것을 전체 파일시스템/모든 secret 부재 검사로 확대하지 않는다.

최신 전체 Security Gate **PASS/exit0**: unit54798ms/secret1146ms/dependency1512ms, `artifacts/security/faq-expiry-candidate-security-gate-20261010.json`. 120초 제한은 `HIPASS_SECURITY_GATE_TIMEOUT_MS=120000`으로 설정했다. 실행 pnpm11.7.0은 project pin과 일치하며 global manifest11.22.0 차이 경고는 유지한다. Gate의 소스 Node 시험·secret scan·의존성 감사는 후보의 실제 브라우저/API/PG 회귀와 별도 검증이다.

Control smoke는 network-none/read-only/cap-drop/no-new-privileges 컨테이너와 owned tmpfs JSON store의 합성 환자만 사용했다. 기한1ms 전 ALLOWED/토큰1, 같은 시각·1ms 후·proof await 중 기한 도달 시 TICKET_EXPIRED/DENIED, 토큰 발급0·USED/usedAt 없음·거부 감사 확인. 실제 PostgreSQL·배포 API·DPoP 암호 검증은 이 smoke 범위가 아니다. `--rm`으로 컨테이너/tmpfs를 정리했고 기존 DB·volume·서비스·인증서는 변경하지 않았다. 관련 FR-001~005/014~025/032~041(FAQ는 안내 지원), SEC-QR-01. 새 검증 스크립트2개 문법 검사 exit0.

증적 SHA-256: UI manifest `ba5ff471b1abfaf23b6edd12276e8d35b44e62775e48e7daa449e8fac737b74b`; delta `c4f0aef29279adaa5098bba3c9b0868945ab5cd5837ac9c19121cd509eb8bb0f`; smoke `ebc3571c44833f8f5a819e484bf56a30d53fd46fcb1d5b003a95e572ac414683`; UI Gate `868b1f6b9b8c38c8c7866249560e5dd8608d809d6bfeb4453e98a0f4c2352f74`; Control Gate `d409c458bab36e5e70a6edeb0420d26ba0ac30d55e5ffa20c216c4b3ae72f8e5`.

**판정: 후보 준비·격리 검증 완료, DRAFT / UNASSIGNED, 미배포.** 신규 사람 검토·현재 Compose/config 기반 후보 rollback·실제 FAQ 브라우저·배포 후 동일 CT/MR 정상/거부·재시작 시연은 NOT VERIFIED다. 기존27e1 사람 승인과 과거 rollback 결과를 이 두 후보에 승계하지 않는다. 다음 한 작업은 **exact 두 후보와 증적 검토 및 역할별 현재 baseline에 고정된 적용/복구 절차 준비**다. 전체 MVP/v3 완료·법률 적합성·운영 승인 주장 없음. commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: B→A 원본 PACS 다중 VM 패킷 경계 완료 — 2026-10-10

`scripts/capstone-hospital-packet-check.py`는 실제 B portal27e1/A Orthanc9f74/mTLS proxy853ed의 exact image·running/PID·healthy, PACS host binding없음, 정상 대조군의 A PACS network 연결을 확인하고 **B portal namespace→A host192.168.111.129:8042**를 관측했다. VMware local public-host-key/MAC/strict SSH는 기존 도구를 재사용한다. 겹치는172.18.0.2를 원격 대상이라고 추정하지 않는다. B source/A host/A PACS namespace에서 임시 source port 두 개의 SYN header만 capture하며 proxy→PACS의 CONNECTED를 listener/목적지 capture positive control로 대조한다. TLS/mTLS 인증 자체의 재검증은 아니며 정상 대조군도 DICOM payload를 요청하지 않는다.

첫 실행 PASS/exit0: `artifacts/workstation/hospital-packet-20261010T003646Z/result.json`; 반복 PASS/exit0/13.773초: `hospital-packet-20261010T003800Z/result.json`. 이후 B 송신/A 수신 header의 destination/port 및 **TCP sequence 동일성**까지 classifier에 보강했고, 최종 실제 재실행 **PASS/exit0/13.215초**: `artifacts/workstation/hospital-packet-20261010T003911Z/result.json`. 마지막 host tool hash305d1bfa606662b04808995b914348373a1d88ec6f28c974e0b4d19d2eef6a21. B source SYN1/A host SYN1(동일seq2953658171), PACS 도착 음성 SYN0, 정상 control SYN1/CONNECTED, B 직접접속 ECONNREFUSED, 세 capture kernel drop0/정확한 child process cleanup=true. 원격 프로세스20초/30초 및 SSH drain/readiness/probe에 유한 기한을 두고 capture 프로세스 그룹만 종료한다. 서비스/DB/volume/방화벽/인증서 변경, 소프트웨어 추가설치, packet payload·인증정보·DICOM 수집 없음.

Classifier는 정상대조군 없음·DNS/bind/timeout 오류·missing capture·패킷손실·미정리·source/host sequence 불일치이면 NOT VERIFIED, 직접 CONNECTED이면 FAIL이다. Python5개(여러 subcases) PASS/exit0/0.003초; 기존 cloud classifier5개도 PASS/exit0/0.004초. compile PASS, 최종 secret findings0. Security Gate **PASS/exit0**(unit55143ms/secret1345ms/dependency1562ms), `artifacts/security/hospital-packet-security-gate-20261010.json`; sequence 보강 뒤 별도 Python5개/compile/secret을 재실행했다. Node gate는 Python 실행 증적을 대신하지 않는다. 관련 FR-026~031 및 의료영상 원본 분산/네트워크 최소노출 invariant.

**완료 범위: 실제 B portal→A host 원본 PACS 포트 비연결과 PACS namespace 비도달을 정상 listener 대조군·상관 패킷과 함께 검증.** 특정 firewall rule·모든 병원/포트·사용자 인가 정책 DENY나 운영망 보안 승인까지 증명한 것은 아니다. 앞선 Cloud ingress→PG packet gate와도 scope를 구분한다. 신규 host 코드/증적은 DRAFT / UNASSIGNED, 기존 사람 검토 승계 없음. 전체 MVP/v3 미완료.

다음 한 작업은 **미배포 FAQ와 정확한 QR 만료 경계 수정의 역할별 후보 이미지 준비·차이/보안 검증**이다. B는 검토된27e1 기반 UI overlay, Cloud Control은30141 기반 service 변경만 검토하며 A Gateway/PACS/ingress/PG의 불필요한 교체는 하지 않는다. 실제 적용은 후보 검토·rollback 계획을 정리한 뒤 진행하고, 현재 실행 image에 로컬 변경이 이미 포함됐다고 주장하지 않는다. 이후 동일 CT/MR 정상·거부 E2E/재시작/발표 Runbook/전체 완료 감사가 남는다. commit/push/merge 없음. 아래는 이전 이력이다.

### 최신 결과: 실제 클라우드 ingress→PostgreSQL 패킷 경계 — 2026-10-10

`capstone-packet-inventory.py`로 A/B/Cloud의 현재 image/PID/health/port binding/network 및 tcpdump/nsenter/timeout 존재를 수집했다. strict VMware-host-key/MAC 및 cloud known_hosts 경계 유지, credential은 concealed stdin/memory-only. `artifacts/workstation/packet-inventory-20261010T003047Z/result.json`, exit0. B는 승인된27e1, A Gateway/Cloud API30141, ingress9c210, PG8d0 image로 실행 중이었다. 이 inventory 자체는 packet gate PASS가 아니다. 기존 packet-boundary-check는 단일 로컬 합성 Compose prefix에 한정되므로 VM/클라우드 결과로 승계하지 않았다.

실제 Cloud에서는 새 host 검증기 `scripts/capstone-cloud-packet-check.py`가 **image3개 exact pin/running/PID·ingress/DB network 비공유·API/DB network 공유·DB host port 비노출**을 확인한 뒤, ingress와 PostgreSQL의 network namespace 양쪽에서 SYN header만 수집했다. 임시 TCP source port 두 개로 정상/음성 probe를 구분하고, API→PG 실제 CONNECTED를 positive control로 사용했다. ingress→PG는 실제 ETIMEDOUT, source SYN3개/DB 도착0개, positive SYN DB도착1개, 양쪽 kernel drop0, capture cleanup=true였다. 정상 연결 대조군/관측 SYN/무손실 capture가 없으면 NOT VERIFIED이고 예상 밖 CONNECTED이면 FAIL이다. 패킷 payload·TLS/JWT/key/영상/DB 내용 수집, DB login·SQL, 서비스 재시작·방화벽/네트워크 변경은 하지 않았다.

첫 실행은 수동 image pin의 PG digest 마지막 문자 중복으로 preflight 실패/NOT VERIFIED(exit1)였고 원본 `cloud-packet-20261010T003230Z.json`을 보존했다. inventory 원본과 맞춘 첫 실제 packet probe는 PASS(`cloud-packet-20261010T003250Z.json`). 이후 재실행은 tcpdump stderr의 TextIO/select buffering 때문에 capture readiness AssertionError/NOT VERIFIED(`cloud-packet-20261010T003333Z.json`, cleanup=true)였다. 이를 source `os.read` 기반으로 수정했으며 보안 경계나 성공조건은 완화하지 않았다. 최종 동일 코드 **2회 연속 PASS/각 exit0**, `artifacts/workstation/cloud-packet-20261010T003353Z.json` 및 `cloud-packet-20261010T003358Z.json`. classifier의 positive-control 누락/DNS·bind오류/packet loss/headers 누락/뜻밖 reachability/64자리 image pin/capture 준비 회귀 등 Python5개 **PASS/exit0/0.003초**, 문법 compile·secret findings0. 전체 Security Gate 결과는 `artifacts/security/cloud-packet-security-gate-20261010.json`에 저장한다.

**완료 범위: 현재 Cloud ingress network namespace→PG container5432의 실제 SYN 비도달 및 API 정상 연결 대조 검증.** 특정 iptables 규칙·B VM 모든 경로·병원 A 원본 PACS packet gate까지 완료했다는 주장이 아니다. A/B 도구·현재 network 준비는 확인됐으나 B→A Orthanc는 기존 host ECONNREFUSED inventory만 있고 **multi-host packet gate NOT VERIFIED**다. 다음 한 작업은 A PACS의 정상 listener 대조군과 B source/A host/PACS destination 관측을 연결하는 것이다. Docker subnet 주소가 A/B/Cloud에서 중복되므로 원격 container IP를 다른 VM에서 동일 대상이라고 추정하지 않는다. 모든 신규 host 코드/증적 DRAFT / UNASSIGNED, 배포/commit/push 없음. 전체 MVP/v3 미완료. 아래는 이전 이력이다.

Cloud packet 검증기 추가 후 Security Gate도 **PASS/exit0**로 완료했다(unit54838ms/secret1256ms/dependency1624ms). 실제 pnpm11.7.0 pin 일치/global manifest11.22.0 경고 유지. 이 gate는 Python classifier 실행을 대신하지 않으며 Python5개는 별도 위 명령으로 실행했다.

### 최신 결과: 실제 서버 QR 만료·사용 거부와 동일 Ticket 감사 연결 완료 — 2026-10-10

기존 배포에서 발급한 합성 환자 HP-TEST-PHANTOM-001/A→B/단일 CT Study·Series/VIEW_ONLY의 같은 consent/Ticket을 실제 시간 경과 후 검증했다. `scripts/run-browser-authorization-trace.ps1 -Capstone -MobileQr -MobileQrExpiry -Port 9337` **4검사 PASS/exit0/608.093초**, `artifacts/workstation/b-browser-2026-10-10T00-29-08.680676+00-00/result.json`. 만료 대기602.885초, 서버 read-only 관측2.324초; 서버 HTTP200/EXPIRED, consent·ticket·expiry binding 일치, server Date가 기한 이전이 아님. 실제 사용 요청은 TICKET_EXPIRED/DENIED/토큰없음을 확인했으며 owned consent cleanup PASS다. 클라이언트 QR 제거만으로 성공 판정하지 않았고 시계·TTL·정책 변경 없이 같은 실행을 기다렸다. 이전 ISSUED/서버 기한 이전의 FAIL 증적은 보존한다.

동일 receipt에 `capstone-phantom-audit-check.py --ticket-expiry`를 실행하여 실제 PostgreSQL **5검사 PASS/exit0**를 연결했다: exact Ticket EXPIRED·서버기한경과 및 consent cleanup REVOKED, usedAt/redeemed doctor/hospital 없음, 해당 consent의 token0/key release0/금지 SUCCESS0, 인증된 DOC-B-01의 TICKET_EXPIRED 거부 감사1건, 전체 persisted hash chain7044 PASS. `artifacts/workstation/phantom-audit-2026-10-10T00-29-16.728153+00-00/result.json`. 이는 exact fresh-flow의 저장 기록 부작용 부재이며 패킷 capture/클라우드 서비스 audit 전체 검증이 아니다. wrapper receipt 경계5개 Python test도 PASS다. 인증정보·nonce·키·영상 payload 출력 또는 DB 직접 수정 없음.

완료 범위는 **지정한 QR의 실제 만료→신규 사용 차단→감사/부작용 부재 검증**이다. 실제 camera/native 인증·Viewer 픽셀·모든 QR의 무한 안정성을 이 결과로 주장하지 않는다. 검증한 기존 Control image30141이며 FAQ 및 정확한 millisecond 만료 경계 수정은 아직 미배포다. 이번 과정에서 만든 host 감사 검증기는 신규 DRAFT / UNASSIGNED이며 기존 image에 자동 포함됐다고 주장하지 않는다. 전체 MVP/v3 미완료, 신규 증적 DRAFT / UNASSIGNED. 브라우저 wrapper가 종료됐으며 재시작 없이 끝났고 commit/push 없음. 다음 한 작업은 **최신 실행 구성의 패킷 수준 Orthanc/DB 경계를 positive control과 함께 검증하는 것**이다. FAQ·경계 수정의 후보 이미지 검사/검토/배포 및 핵심 CT/MR 회귀는 후속 미완료로 유지한다. 아래 진행 중 문구는 완료 이전 이력이다.

### 최신 작업: 실제 QR 만료 검증 착수 및 정확한 만료 경계 수정 — 2026-10-10

FAQ 로컬 구현 후 핵심 공유 흐름의 미검증 항목으로 복귀했다. 기존 `scripts/run-browser-authorization-trace.ps1 -Capstone -MobileQr -MobileQrExpiry -Port 9337`를 전용 headless browser/profile로 실행했다. 브라우저 준비 완료를 관측했고 서버 기준 실제10분 만료 대기를 포함한 실행이 진행 중이다. 시계/TTL/모바일 세션 변경, 배포 또는 policy DENY 재시도 없음. 서버 상태 조회만 유한90초 polling하며 실제 만료 확인 후 사용 요청은 한 번 수행한다. 현재 실행의 최종 결과·owned consent cleanup은 아직 NOT VERIFIED이며 이 진행 기록을 PASS로 해석하지 않는다. 최초 서버 만료 FAIL 원본(`b-browser-2026-10-09T09-53-17.776248+00-00/result.json`)은 보존한다. 해당 응답은 ISSUED였고 서버 Date가 기한 이전이었다. 이를 정책 우회/시계 오차의 확정 원인으로 판단하지 않는다.

별도 코드 점검에서 `viewPatientTicketStatus`의 `now >= expiresAt`과 redemption의 `now > expiresAt` 불일치를 발견했다. 정확히 같은 millisecond 및 proof 검증 await 중 기한 도달을 주입한 신규2개 테스트에서 **실제 ALLOWED/기대 DENIED로 FAIL**을 재현했다(exit1/317.3243ms). `src/services.js`의 사용 전·proof 후 비교 두 곳만 `<=`로 맞췄다. URI/API/DDL/권한/TTL 변경 없음. 수정 후 신규2개 **PASS/exit0/370.3455ms**; 관련 QR/UI/HTTP/계약/전송 테스트 전체 **30/30 PASS/exit0/3449.8333ms**. 기한1ms 전 정상 사용 유지, 기한과 같거나 이후 토큰 발급0·USED 전이 없음·TICKET_EXPIRED 거부 감사 확인. proof 테스트는 시간 경계용 service stub이며 실제 DPoP 암호 검증 증적이 아니다. 관련 FR-001~005/014~025/037~041, SEC-QR-01.

읽기 전용 strict SSH로 현재 클라우드 Control **30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df / healthy**, exit0을 재확인했다(00:20 UTC). 신규 경계 수정과 FAQ는 이 image에 포함되지 않는다. 따라서 현재 브라우저 검증은 기존 배포의 실시간 만료를 검증하고, 신규 정확한 경계 수정의 배포 검증으로 승계하지 않는다. HEAD4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401+dirty 유지. 현재 코드 Security Gate 재실행 결과는 `artifacts/security/qr-expiry-boundary-security-gate-20261010.json`에 저장한다. 신규 코드/증적 DRAFT / UNASSIGNED, commit/push 없음. 다음 한 작업은 실행 중인 동일 QR의 서버 만료·실제 사용 거부·정확한 cleanup 결과를 수집하는 것이다. 전체 MVP/v3 미완료.

경계 수정 후 전체 Security Gate는 **PASS/exit0**(unit54720ms/secret1424ms/dependency1527ms)로 종료했다. pnpm11.7.0 pin 일치/global manifest 차이 경고 유지. 실제 QR 만료 browser 실행은 이 gate와 별도이며 아직 최종 결과 대기 중이다.

실제 QR 만료 대기 중 기존 `workstation-automatic-ops.py boundary-check`를 재실행했다. VMware 로컬 관리 채널의 public host key/MAC 확인→strict SSH의 읽기 전용 진단으로 양쪽 VM을 확인했다. A Orthanc healthy, raw8042/4242 host binding없음, mTLS proxy healthy/127.0.0.1:18443만 bind를 관측했다. B에서 A host8042 접속은 ECONNREFUSED였다. 명령 **exit0**, `artifacts/workstation/automatic-2026-10-10T00-23-05.227798+00-00/result.json`, DRAFT / UNASSIGNED. 이는 **포트 inventory 및 실제 host TCP 직접 접속 거부** 증거이며 정책 DENY·특정 firewall rule·dual-namespace 패킷 capture·컨테이너 IP 우회 전체 검증으로 확대하지 않는다. PACS listener healthy는 Docker health 관측이며 해당 TCP probe의 내부 positive-control은 아니므로 패킷 경계 gate는 여전히 NOT VERIFIED다. 서비스/네트워크/인증서 변경 없음. QR 실행은 동일 handle로 계속 진행 중이며 재시작하지 않았다.

같은 Ticket의 만료 거부와 부작용 부재를 연결하도록 기존 strict SSH 감사 wrapper에 `--ticket-expiry` 모드를 추가했다. `scripts/ticket-expiry-audit-readonly.js`는 exact owned receipt/합성 patient/A→B binding을 확인한 뒤 READ ONLY/REPEATABLE READ 및 query timeout 안에서 EXPIRED·기한경과·USED 흔적없음·토큰/키/금지 SUCCESS 없음·인증 의료진의 TICKET_EXPIRED 감사·전체 hash chain을 확인한다. raw nonce/키/영상 payload 조회·출력 및 DB load/save/migration 없음. 이는 준비된 검증기이며 실제 실행 전 PASS가 아니다. receipt 검증 Python5개 PASS/exit0/0.001초, Node 문법/Python compile/diff check PASS, 최신 Secret Scan findings0. 전체 Security Gate PASS/exit0(unit54540ms/secret1376ms/dependency1619ms), `artifacts/security/qr-expiry-audit-security-gate-20261010.json`; 최종 receipt binding 검증 보강 뒤 Python5개와 secret scan도 재실행 PASS. 관측00:28 UTC, 실제 browser 실행은 같은 handle로 아직 진행 중이다. 신규 검증기/증적 DRAFT / UNASSIGNED. 완료된 실제 만료 receipt에만 `python scripts/capstone-phantom-audit-check.py --ticket-expiry artifacts/workstation/b-browser-<exact-run>/result.json`을 적용한다.

### 최신 작업: 환자 웹·모바일 공통 FAQ 도우미 — 로컬 구현, 미배포 / 2026-10-10

사용자가 승인한 FAQ 이용 안내 범위만 구현했다. `public/ui/faq-catalog.js`의 정적 안내 16개(버전2026-10-10.1)를 `faq-assistant.js`/`faq-assistant.css`로 두 화면에서 공유한다. 외부 AI·RAG·새 API·라이브 상태 조회·자동 승인/철회·새 권한 모델은 추가하지 않는다. 기존 디자인 토큰을 사용하며 웹의 도움말/고정 버튼과 모바일 홈의 이용 도우미에서 연다. 관련 FR-001~005, FR-032~036의 이용 안내 지원이며 해당 업무 기능 완료를 새로 주장하지 않는다. 서버·DB·동의·암호화 계약 변경 없음.

추천 질문, 160자 제한 검색, 등록된 고정 답변, 기존 영상/동의/공유 관리/보안 화면 이동, 대화 지우기·Escape 닫기·초점 복원을 제공한다. 의료 판단 요청·미등록 질문은 답변을 생성하지 않는다. 개인정보/비밀정보 형태 일부를 입력 단계에서 차단하지만 완전한 개인정보 탐지기로 주장하지 않는다. 입력 원문을 대화에 출력하거나 네트워크/로그/storage로 보내지 않고 제출·닫기 때 비운다. `textContent`만 사용하며 대화는 최대8개다. 앱 잠금·환자 변경·웹 역할 변경·pagehide에서 초기화한다. 화면 이동은 고정 allowlist이며 권한 확인이나 실제 동의/철회 처리를 대신하지 않는다. SW는 정적 FAQ 세 파일만 기존 캐시 allowlist에 추가했고 API/영상/환자정보를 캐싱하지 않는다.

검증 환경: HEAD4ea53c2+dirty, loopback 격리 JSON seed 서버8838(개발용 인증/별도 tmp DB/프로세스 내 임시 secret), 웹 정적 서버8837. A/B/클라우드 실행 이미지·기존 DB·volume은 변경하지 않았다. 실제 로컬 브라우저에서 웹 철회 안내→공유 이력 이동, HTML 입력의 안전한 미등록 안내, 의료 판독 요청 거절을 관측했다. 모바일에서 개발용 인증→FAQ→공유 관리 이동, 잠금 후 답변0·입력빈값·dialog닫힘, 재인증 후 초기화, Escape 초점 복원, 대화 지우기를 확인했다. 375×812에서 documentWidth360/dialogWidth322로 가로 넘침 없음. 최종 정적 문구를 재로드한 모바일 증적: `artifacts/workstation/faq-mobile-local-20261010.jpg`.

FAQ+기존 환자 context focused **8/8 PASS/exit0/230.1773ms**. FAQ+Viewer+QR focused **17/17 PASS/exit0/385.5867ms**. 문법 검사4파일과 범위 한정 diff check PASS/exit0(CRLF 경고 유지). 최초 전체 게이트는 기존 VM 기반 테스트의 신규 reset 의존성 누락과 합성 private-key 헤더 marker의 secret-scan 오탐으로 FAIL이었다. 실제 key는 없었다. 테스트 harness에 명시적 reset stub/호출 검증을 추가하고 합성 marker를 런타임에 구성했다. 제품 초기화나 scanner를 제거·완화하지 않았다. 수정 후 전체 Security Gate PASS/exit0(unit54712ms/secret1404ms/audit2033ms). 마지막 문구 변경 후 재실행 결과는 `artifacts/security/faq-local-security-gate-20261010.json`을 기준으로 한다.

재현: `node --test test/faq-assistant.test.js test/patient-context-display.test.js`; PowerShell에서 `$env:HIPASS_SECURITY_GATE_TIMEOUT_MS='120000'; node scripts/security-gate.js`. 120초 timeout은 CLI 인자가 아니라 환경변수로 설정한다. 로컬 이용 순서: 환자 웹 도움말 또는 모바일 개발용 인증→홈 이용 도우미→추천 질문/사용법 검색→화면 이동; 실제 동의/철회는 이동한 화면에서 직접 확인한다.

**판정: FAQ 로컬 구현·한정 브라우저 검증 완료, 신규 증적 DRAFT / UNASSIGNED.** 실제 VM 배포·후보 image 검사·배포 후 기존 CT/MR E2E/rollback·SW 오프라인 실행·실기기/스크린리더 검증은 NOT VERIFIED. AI 챗봇/RAG/네이티브 앱 완료가 아니다. 기존 전체 MVP/v3 미완료와 서버 QR 만료 후 실제 사용 거부 후속 작업을 유지한다. 다음 한 작업은 FAQ 내용·브라우저 증적 검토 후 기존 B 후보 이미지 절차로 반영하고 핵심 시연 경로에 영향이 없는지 재검증하는 것이다. commit/push/merge 없음. 아래는 이전 이력이다.

FAQ 최종 문구 수정 후 게이트도 **PASS/exit0**, unit55122ms/secret1565ms/dependency2382ms로 완료됐다. 실행 pnpm11.7.0은 pin과 일치하며 global manifest11.22.0 차이 경고는 유지한다. 임시 browser tab과 viewport override를 정리하고 이번에 띄운8837/8838 프로세스만 Ctrl-C로 종료했다(각 exit1은 요청한 종료 결과이지 정책 DENY/시험 FAIL이 아니다). 격리 tmp seed는 기존 DB와 분리된 ignored 생성물로 남겼으며 기존 서비스는 중지하지 않았다.

### 최신 상태: 승인된 B 이미지 교체·복구와 CT/MRI 실제 사용자 흐름 재검증 — 2026-10-10

검토된 후보 image **`sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a`**를 B Portal에만 적용했다. Cloud ingress9c210, Cloud Control/A Gateway30141과 기존 PostgreSQL은 교체 대상이 아니다. HEAD4ea53c2+dirty. `scripts/patient-focus-b-rollout.py --apply`는 검토 manifest7개 hash·HEAD·소스454·24시간 내 scan·실제 로컬 image를 확인하고, strict SSH/MAC pin·concealed credential/stdin·archive SHA 검증으로 같은 image를 전송했다. 정확한 B Compose **portal.yml/encryption.yml/patient.yml**와 공개 배포 환경값을 사용하며 `services.portal.image` 외 설정 변경을 거부한다. 실제 baseline→candidate→baseline rollback→candidate 재적용 **4검사 PASS/exit0/63.716초**, 각 단계 strict TLS/hostname·healthy·runtime environment/mount/command/security/port/network 차이0. 원본 `artifacts/workstation/patient-focus-b-rollout-20261009T234957Z/result.json`. operator는 안전한 읽기 전용 default/명시적 --apply이고 이미 활성화된 candidate를 기존 baseline이라고 간주해 재실행하지 않는다. DB/schema/writer/volume/secret/인증서 교체 없음.

실제 공개 B 환자 모바일 PWA 정상 흐름을 순차 반복했다. 각 실행은 server login·실제 Study 목록·256×256 합성 DICOM 서로 다른2슬라이스·정확한 VIEW_ONLY Grant binding·Viewer close 픽셀 제거와 동일 Study 초점 복구·storage token 없음의6검사 및 owned browser cleanup이 모두 PASS다. MR screenshot을 직접 관측했다. 12개 instance metadata 확인을 모든12장 pixel 검증으로 표현하지 않는다.

| 실행 | artifacts/workstation 원본 | 실제 결과 |
|---|---|---|
| 모바일 CT 1 | patient-real-browser-472a04ac1109/result.json | PASS/exit0/12.876초/cleanup=true |
| 모바일 MR 1 | patient-real-browser-ee6528e3cb05/result.json | PASS/exit0/12.765초/cleanup=true |
| 모바일 CT 2 | patient-real-browser-08c60cdb05ed/result.json | PASS/exit0/11.800초/cleanup=true |
| 모바일 MR 2 | patient-real-browser-8eda904ac9f4/result.json | PASS/exit0/15.448초/cleanup=true |

4개의 정확한 receipt에 연결한 read-only PG 감사 **13검사 PASS/exit0**, 키 발급8건 consumed·고정 Vault key version binding·각 auditSession 연결·전체 chain6778 PASS: `artifacts/workstation/patient-public-audit-20261009T235258Z.json`. 본인 열람은 별도 self-view Grant 경로이고 공유 동의 E2E로 대체하지 않는다.

동일 배포에서 **모바일 명시적 승인→QR 연결→실제 의료진 화면 접수 버튼→A Gateway CT/MRI 실제 Viewer→같은 동의 모바일 철회→신규 접근 거부**도 재실행했다. 각7검사 PASS, 합성 환자 HP-TEST-PHANTOM-001/기관 A→B/각 Study 및 Series 하나/VIEW_ONLY. CT `b-browser-2026-10-09T23-54-36.719026+00-00/result.json` **PASS/exit0/87.599초**, MR `b-browser-2026-10-09T23-58-10.306419+00-00/result.json` **PASS/exit0/200.030초**, owned 동의 cleanup PASS. 실제 camera scan/native 생체인증/만료는 이 실행 범위가 아니다.

각 흐름의 **9음성 조건**(Series 범위 밖, 잘못된 병원, 환자 역할로 의료진 토큰 발급, 의료진 ID 위장, 동의 ID 입력 누락, 존재하지 않는 동의, 토큰 변조, DPoP 누락·재사용) 모두 PASS다. 음성 호출은 의료진 UI token을 다른 key로 사용하지 않고 같은 동의의 별도 verifier-key-bound token을 사용한 API 증거다. 각 요청 전후 PG에서 consent scope hash와 token/release/consumed/success counter가 동일함을 확인하고 정확한 denial reason의 audit 증가를 확인했다. 단순403·timeout을 정책 DENY로 처리하지 않았다. 실제 다운로드·Study 범위·철회 거부 사유는 후속 read-only 감사로 연결했다. UI 정상 경로를 API로 대체한 것은 아니다.

공유 CT 감사 `phantom-audit-2026-10-09T23-54-46.823473+00-00/result.json` 및 MR 감사 `phantom-audit-2026-10-09T23-58-28.612784+00-00/result.json` 각각 **6검사 PASS/exit0**: 정확한 동의 REVOKED, 인증 actor 거부, scope/permission/revocation/DPoP 사유, release 각4건 모두 consumed/versioned Vault binding, wrap/precheck/consume linkage. 마지막 전체 persisted chain **6976 PASS**. Azure Vault 서비스 자체 audit log 검증으로 확대하지 않는다.

A병원 실제 mTLS 재검증은 첫 명령이 이름 tag 부재로 기준선 검사에서 **NOT VERIFIED/exit1**였다(`current-mtls-2026-10-09T23-55-08.912304+00-00/result.json`). 읽기 전용 `scripts/patient-current-a-inventory.py`로 실제 Gateway30141/tags=[]/healthy와 PACS·mTLS proxy healthy를 확인했다. `scripts/capstone-mtls-check.py`의 host 인자 검증만 exact immutable image ID 사용을 허용하고 서로 다른 ID는 거부하도록 수정했다(2개 focused Python test PASS). 이는 승인된 image 빌드 이후 host tool 변경이며 과거 source454 snapshot을 최신 전체 host 일치로 주장하지 않는다. 배포 image와 runtime 인증서는 그대로다. exact ID 재실행 `current-mtls-2026-10-09T23-57-33.407009+00-00/result.json`: valid ALLOW, 무인증·wrong issuer/SAN/EKU·expired·bad DENY 및 정확한 owned test key cleanup, **8검사 PASS/exit0**. CA private key 전송·seed·TLS 검증 완화 없음. 최초 미실행 증적은 보존한다.

새 host rollout 경계3개 Python test PASS/0.005초, Viewer/browser10개 Node focused PASS/224.3615ms. Security Gate120초 설정 실제 PASS/exit0(unit54.200초/secret2.469초/dependency2.556초), 실행 pnpm11.7.0/lock9.0/global manifest11.22.0 경고 유지. host tool 최종 변경 후 gate 재실행도 **PASS/exit0**(unit54.635초/secret1.126초/dependency1.527초): `artifacts/security/patient-focus-final-security-gate-20261010.json`. 마지막 Python 경계3개+image reference2개 및 diff check exit0(CRLF 경고 보존). 신규 operator/tests는 기존 image 안에 자동 포함됐다고 주장하지 않는다. 관련 FR-001~005/010~041, 인가·동의·암호화 정책 변경 없음. 신규 실행 증적 **DRAFT / UNASSIGNED**, 기존 사람 승인을 자동 승계하지 않는다. 실행 증거13개(최초 mTLS NOT VERIFIED 포함)와 빌드 이후 host tools/tests5개의 hash는 `artifacts/workstation/patient-focus-runtime-verification-manifest-20261010.json`에 결속했다. commit/push 없음.

**완료 범위:** 지정한 CT/MRI 공유 사용자 흐름의 정상·철회·위9개 API 음성 및 감사 종단 검증. 과거 mobile focus/timeout FAIL·최초 profile cleanup 미완료는 원본으로 보존하며 무한 안정성을 주장하지 않는다. **다음 한 작업: 실제 서버 기한 경과 후 QR 상태 EXPIRED와 실제 사용 거부를 같은 ticket으로 검증한다.** Orthanc 직접 접근/패킷 경계의 최신 조합, 재시작·반복 전체 시연, 전체 P0/v3·B PACS import·네이티브/카메라는 별도 미완료 또는 NOT VERIFIED다. 전체 MVP/v3 완료를 선언하지 않는다. 아래는 이전 이력이다.

### 최신 상태: 현재 검토 대상의 명시적 사람 PASS 기록 — 2026-10-10

사용자의 “모든 검토사항은 검토자 김범희 검토일 해당 날짜 판정 PASS 예외 의견 없음” 응답을 현재 제시된 검토 대상으로 한정하여 기록했다. 검토자 **김범희**, 검토일 **2026-10-10 (Asia/Seoul)**, 판정 **PASS**, 예외·의견 **없음**이다. focus 후보 `sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a`, HEAD `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401` + dirty와 `artifacts/workstation/patient-focus-review-manifest-20261010.json`에 결속된 7개 증적을 대상으로 한다. 기존 ingress 검토 manifest의 예외·의견도 NOT PROVIDED에서 NONE으로 보완했다. 결속된 원본 증적은 변경하지 않는다.

**검토 PASS는 테스트 PASS가 아니다.** 공개 모바일 안정성의 기존 FOCUS_RESTORE FAIL, focus 후보의 실제 배포·rollback·수정 후 브라우저 검증 NOT VERIFIED, 전체 MVP/v3 미완료 판정은 유지한다. 이 응답은 아직 생성되지 않은 코드·증적에 대한 사전 승인이나 과거 실패의 소급 PASS가 아니다. 신규 실행 증적은 별도 검토 전 DRAFT / UNASSIGNED로 기록한다.

이번 작업은 검토 기록 갱신이며 배포·재시작·새 테스트·commit/push를 실행하지 않았다. **다음 한 작업: 승인된 focus 후보를 B Portal에 한정하여 적용 → 실제 rollback → 재적용하고, 같은 공개 모바일 CT/MR 흐름을 반복 검증한다.** 아래 DRAFT/UNASSIGNED 및 NOT PROVIDED 문구는 승인·보완 이전 이력이다.

### 최신 작업: B병원 후보 차이·실제 활성 설정의 읽기 전용 교체/복구 계획 확인 — 2026-10-10

기존 B 기준 image30141과 focus 후보27e1의 로컬 파일 해시454개 비교에서 **14개 차이**를 확인했다. 실제 public UI 변경은 `public/patient-pixel-viewer.js` 하나지만 전체 image에는 새/수정된 host 검증·운영 scripts12개와 `src/capstone-control-ingress.js`도 포함된다. 후자는 이미 Cloud에서 별도9c210 image로 적용됐으며 B Portal의 이번 UI 요구 변경으로 설명하지 않는다. 전체 후보를 public1파일만의 image로 축소해 표현하지 않는다. 비교 증거 `artifacts/workstation/patient-focus-b-image-delta-20261010.json`; payload·credential·source 본문 없이 경로와hash만 기록한다.

`scripts/patient-focus-b-preflight.py`로 VMware guest에서 public SSH host key 확인 후 RejectPolicy·MAC pin·유한 timeout으로 **B만 읽기 전용** 점검했다. VM credential은 concealed prompt 및 원격 sudo stdin 메모리에만 사용했고 argv/file/stdout에 기록하지 않았다. 실제 `hp-capstone-b-portal-portal-1`은 image30141/Running/healthy, workdir `/home/server/.highpass-app-2026-10-08T21-31-00.357148+00-00`, config list **portal.yml/encryption.yml/patient.yml**다. 같은 operator의 공개 env 구성으로 rendered Portal environment/bind mounts가 actual과 일치함을 확인했다. candidate plan은 `services.portal.image` 한 필드만27e1로 변경·되돌렸을 때 나머지 JSON 동일, **non-image 차이0/PASS/exit0**. 원본 `artifacts/workstation/patient-focus-b-preflight-20261009T233542Z/result.json`, baseline rendered config SHA-256 `1fccfa137092364b911175510f7704e939d8d98015beda8bbdffc47e2e9536d1`.

**범위 한계:** B VM에 image/file 업로드·load·compose up·restart를 하지 않았다. 실제 rollback·수정 후 공개 mobile focus 성공은 NOT VERIFIED다. 원래3개 file list/image를 복구 기준으로 보존하며 patient overlay·key identity·secrets·A PACS·Cloud Control/DB를 변경하지 않는다. 새 host preflight는 빌드 이후 추가됐으므로 후보의 source454 snapshot 안에 포함되지 않는다. syntax/diff exit0(CRLF 경고 보존). 관련 FR-032~036의 안전한 B 배포 준비이며 제품 완료나 보안 회귀 전체 PASS가 아니다.

focus review manifest에는 위delta·actual preflight hash2개를 추가해 총7파일을 결속했다. 후보27e1의 검토는 **DRAFT / UNASSIGNED**, 김범희의 기존 ingress9c210 PASS와 별도다. 다음 한 작업은 정확한 후보·7개 증거를 독립 검토한 후 **B Portal만 적용/실제 rollback/재적용하고 모바일 CT/MR를 반복 검증**하는 것이다. 실제 공개 mobile 안정성은 마지막 FOCUS_RESTORE FAIL로 남고, 최초 profile cleanup·음성·만료·전체 MVP/v3는 미완료다. commit/push 없음. 아래는 이전 이력이다.

### 최신 작업: 모바일 반복 시연의 초점 복구 실패 재현·최소 수정 후보 — 2026-10-10

배포는 직전 조합 그대로이며 수정 후보를 활성화하지 않았다. Playwright skill의 화면 전환 후 재관측 원칙을 기존 Chrome/CDP 흐름에 적용했다. 호스트 검증기 `scripts/lib/patient-browser-integration.js`에 실제 click target hit-test·두 animation frame의 안정 좌표·3초 유한 대기, 모바일 studies 탭 준비 확인, 종료 exitCode **또는 signalCode** 관측, 안전한 lastPhase/cleanupFailure를 추가했다. 실제 signal 종료 자식 프로세스 focused test PASS. 이것이 최초 CT timeout/cleanup 실패의 확정 원인이라고 주장하지 않는다. 최초 실패 profile `342e73c4f68f`는 Chrome0/잔여true, 새 정상 `5bb0c3408abf` profile잔여false를 확인했다. 기존 profile 삭제의 정책 거부를 다른 도구로 우회하지 않았다.

반복 관측(모두 실제 공개 모바일 CT, 토큰 memory/stdin): `patient-real-browser-5bb0c3408abf` **PASS/13.352초/cleanup=true** → `1eb02f37847b` **FAIL/12.316초/VIEWER_CLOSE/cleanup=true**. 후자 screenshot을 직접 보니 Viewer는 이미 닫혀 있었다. close와 focus를 분리해 유한 관측한 뒤 `057d657d3e48` **PASS/11.959초/cleanup=true** → `d534bfead4ae` **FAIL/17.565초/FOCUS_RESTORE/cleanup=true**. 각 원본 result.json을 보존한다. fail-fast 반복 명령은 두 번째 실패 후 exit2, 세 번째 실행은 하지 않았다. 두 실패 모두 실제 256 CT2슬라이스·정확한 Grant binding까지 PASS했으나 close 이후 focus 요구사항 미충족이다. 정상 영상 PASS가 안정적인 반복 시연 전체 PASS라는 뜻이 아니다.

코드에서 모바일 비동기 `loadInitialData/loadStudies`가 목록 버튼을 교체할 수 있고, 공통 Viewer의 replacement identity가 모바일 `data-action-cine`를 포함하지 않음을 확인했다. 회귀 테스트를 먼저 추가해 **6 PASS/1 FAIL/exit1**(모바일 교체 launcher 재현), `public/patient-pixel-viewer.js` identity allowlist에 그 속성 하나 추가 후 focused **12 PASS/exit0/390.005ms**. 같은 컨테이너·같은 Study만 찾으며 다른 Study/disabled/hidden/삭제된 목록에는 focus하지 않는다. 관련 **FR-032~036**, 진료 인가·Grant·DPoP·TLS·암호화·감사 정책 변경 없음. 모든 실제 실패의 원인이 이 하나로 설명됐다고 확정하지 않는다. 수정 후보의 실제 공개 반복 검증이 필요하다.

Security Gate **PASS/exit0**(각120초): unit55.562초/secret2.728초/dependency2.635초, 실행 pnpm11.7.0/lock9.0, global manifest11.22.0 경고 유지. syntax/diff exit0(기존 CRLF 경고). 후보 `highpass-platform-mvp:capstone-patient-focus-20261010`, 실제 image ID **`sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a`**. 기존 확인 base30141로 `--pull=false --network=none` 빌드 exit0, 기본 FROM ARG 경고 유지. 소스 **454 hash 일치/0 불일치**, `artifacts/workstation/patient-focus-image-source-20261010.json`(HEAD4ea53c2+dirty); 실제 read-only/network-none/UID65532/cap-drop ALL image 검사. same exact image Trivy0.58.2 pinned scan/Container Gate **HIGH0/CRITICAL0/PASS/exit0**, `artifacts/security/container-scan/patient-focus-20261010.json`. 새로운 예외 없음.

`artifacts/workstation/patient-focus-review-manifest-20261010.json`은 source454·scan·공개 focus FAIL2·대조 PASS1의5파일 hash를 결속한다. **DRAFT / UNASSIGNED**, 신규 독립 검토 미완료. 기존 ingress9c210의 사람 PASS는 이 새 UI 후보에 승계하지 않는다. 현재 서버는 그대로이며 공개 **수정 후** 성공은 NOT VERIFIED. 다음 한 작업은 B Portal에 필요한 정확한 image 차이와 rollback context를 검증한 뒤 새 후보를 검토·배포해 같은 모바일 CT/MR 반복 흐름을 끝내는 것이다. 음성·만료·초기 실패 profile cleanup·전체 MVP/v3는 미완료로 유지한다. commit/push 없음. 아래는 이전 이력이다.

### 최신 작업: 승인 ingress 적용·실제 복구와 공개 환자 CT/MR 정상 흐름 확인 — 2026-10-10

사람 검토 범위의 source450·증거5 hash·HEAD·실제 image·24시간 이내 scan을 재확인한 후, 기존 strict SSH/Docker 방식으로 정확한 후보 image를 전송/sha256 검증/load했다. 새 Azure 리소스·비용·VM/Control/DB 변경 없음. `scripts/patient-ingress-rollout.py`의 실제 최초 실행 **PASS/exit0/85.619초**, `artifacts/workstation/patient-ingress-rollout-20261009T231956Z/result.json`: baseline TLS 403/METADATA_ROUTE_REQUIRED → ingress만 후보 교체 → 실제 baseline image와 원래 6개 Compose files 복구 → 후보 재적용, 5검사 PASS. 후보 `{}` 응답은 **400/PATIENT_DATA_PLANE_REQUEST_INVALID**로 인가 로직 도달·잘못된 입력 거부 증거이며 정상 영상 성공으로 해석하지 않는다. Control/PG container identity·환경·mount·command·security/port/network 설정 유지. 이후 operator에 안전한 default 읽기 전용/명시적 `--apply`를 추가했으며 최초 실행 명령에는 이 옵션이 없었다. 새로운 호스트 operator는 기존 후보 image source snapshot 밖이다.

현재 실제 조합: **Cloud ingress `9c210296…`**, Cloud Control/A Gateway/B Portal 기존 승인 **`30141f81…`**, PG **`8d0e686f…`**. ingress 파일목록은 원래6개 + `patient-ingress-reviewed-20261010.yml`(image 한 필드), Control은 기존6개, PG는 기존 별도2개. baseline6을 요구하는 사전검사/rollout은 이미 활성화된7개 조합을 자동 허용하거나 재배포하는 도구가 아니다. 검사 실패를 현재 서비스 장애로 추정하지 않는다.

실제 Chrome→공개 `https://192.168.111.149:9443` 환자 UI 정상 실행(로컬 proxy/API/SQLfixture 없음):

| 흐름 | 원본 result.json (artifacts/workstation 아래) | 결과·시간 |
|---|---|---|
| 환자 웹 CT | patient-real-browser-279319ff698b/result.json | PASS/exit0/11.190초/cleanup=true |
| 환자 웹 MR | patient-real-browser-46a828f0defe/result.json | PASS/exit0/9.343초/cleanup=true |
| 모바일 PWA CT 재실행 | patient-real-browser-9ee028c9c901/result.json | PASS/exit0/10.639초/cleanup=true |
| 모바일 PWA MR | patient-real-browser-3c21a65ee520/result.json | PASS/exit0/17.110초/cleanup=true |

각6검사: strict TLS/hostname, 실제 환자 login/server studies(모바일 개발용 unlock), 256×256 정확한 CT/MR 서로 다른2슬라이스, 정확한 patient/Study/Series/VIEW_ONLY/Grant binding, close 픽셀 제거·초점 복구, local/session storage token 없음. CT/MR web viewer.png를 직접 관측했다. 각12장 중2장 표시이지 모든12장 pixel 검증·native/생체/카메라·전체 MVP 성공이 아니다.

**실패 보존:** 첫 모바일 CT `patient-real-browser-342e73c4f68f/result.json` **FAIL/exit1/45.192초/PATIENT_BROWSER_TIMEOUT/cleanup=false**. 화면은 studies 단계였고 Grant receipt NOT VERIFIED, 실패 원인은 미확정이다. 이 실행은 명령 terminal·해당 profile을 사용하는 Chrome0개를 확인한 뒤 별도 새 실행으로 CT를 재검증했다. 최초 timeout을 단순 시계/정책 DENY로 단정하지 않는다. 해당 owned tmp profile은 남아 있으며, exact path·Chrome0 확인 후 수동 Remove-Item은 실행 정책에서 거부됐다. 다른 도구로 우회하지 않았고 최초 cleanup=false를 PASS로 바꾸지 않았다. 민감정보가 있을 수 있는 profile 내용은 열거나 출력하지 않았다.

읽기 전용 authority 계정·parameterized query·유한 timeout·repeatable-read/read-only transaction으로 위4 receipt를 정확히 연결: `scripts/patient-browser-audit-check.py` **PASS/exit0**, `artifacts/workstation/patient-public-audit-20261009T232514Z.json` **13검사 PASS**, release 각2개/총8개 모두 consumed·정확한 versioned Vault binding, Grant/키 발급/소비 auditSession 연결, 전체 hash chain **6642 PASS**. 원본 credential/token/receipt/DEK/ciphertext/임상자료 출력 없음. Azure 서비스 자체 audit log·실제 만료/철회/음성 실행 증거로 확대하지 않는다. PostgreSQL skill의 최소권한·짧은 transaction 원칙 적용, schema/DB writes 없음.

집중 ingress **6 PASS/exit0/720.672ms**, 배포 계획 경계 **7 PASS/exit0/0.003초**, host/remote syntax compile·review binding PASS. 최종 `$env:HIPASS_SECURITY_GATE_TIMEOUT_MS='120000'; node scripts/security-gate.js` **PASS/exit0**: unit58.514초·secret4.047초·dependency audit3.657초, 모든 하위명령 exit0. 실행 pnpm11.7.0/lock9.0, global manifest11.22.0 불일치 경고는 유지. 전체 Node 총수는 gate 출력에 없어 주장하지 않는다. host syntax와 `git diff --check` exit0(기존 CRLF 경고). 신규 실행 증적은 DRAFT / UNASSIGNED다. 기존 모바일→의료진 공유 정상·음성 PASS는 과거 조합의 범위로 보존한다. **다음 한 작업: 공개 환자 흐름의 timeout/cleanup 안정성 원인을 좁히고 같은 활성 ingress 조합에서 만료·범위 밖·위변조·DPoP 음성 및 부작용 부재를 검증한다.** 전체 MVP/v3는 아직 미완료. commit/push 없음. 아래는 이전 이력이다.

### 최신 작업: 신규 ingress 후보 독립 사람 검토 기록 — 2026-10-10

사용자 명시 응답에 따라 검토자 **김범희**, 검토일 **2026-10-10 (Asia/Seoul)**, 판정 **PASS**를 기록했다. 예외·의견은 응답에 없어 **NOT PROVIDED**로 기록하며 '없음'으로 추정하지 않는다. 범위는 HEAD `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401` + dirty 후보의 실제 image `sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb`, 기존 `patient-ingress-review-manifest-20261010.json`에 결속된 5개 증적 및 직전 ingress-only 사전검사 설명이다. 로컬 후보 image ID와 HEAD를 재확인했다. 원본 실행 증적의 DRAFT 기록은 당시 상태로 보존하고 별도 manifest에 사람 판정을 연결했다.

이 승인은 실제 신규 배포·rollback·공개 환자 CT/MR 픽셀 성공·전체 MVP/v3 완료 판정이 아니다. 공개 본인 열람의 마지막 실제 결과는 여전히 FAIL이며 다음 실행은 **ingress-only 교체/rollback 후 동일 공개 환자 종단 흐름 재검증**이다. 이후 신규 실행 증적은 별도 검토 전 DRAFT / UNASSIGNED로 유지한다. commit/push 없음. 아래 미승인 문구는 승인 이전 이력이다.

### 최신 작업: candidate-active ingress 교체 계획 사전검사 완료 — 2026-10-10

앞선 단독 Compose 렌더링 실패는 필수 배포 환경값을 제공한 재실행에서 해소됐다. 호스트 전용 `scripts/patient-ingress-plan-preflight.py`는 strict SSH·유한 timeout·읽기 전용 Docker inspect/config만 실행한다. Control/ingress의 정확한 patient 포함 6개 파일·프로젝트·workdir 및 승인 runtime image를 고정하고, 기존 operator의 공개 환경값 구성 방식으로 렌더링한다. 인증정보 값을 subprocess 환경에 복사하거나 출력하지 않는다. 렌더링된 Control/ingress 환경과 readonly bind mount를 실제 실행값과 비교한 뒤, 계획 객체에서 ingress image 한 필드만 `30141f81…`→`9c210296…`로 변경한다. Control·PostgreSQL·bootstrap·migration은 변경하지 않는 계획이다. 실제 overlay 생성·업로드·docker load/up는 없다.

최종 실제 사전검사 **PASS/exit0**, `artifacts/workstation/patient-ingress-plan-20261009T230038Z.json`: runtime environment/bind mounts 일치, non-image 차이0, baseline config SHA-256 `52d8021ab2635c00e95f04a15c267a3dcb10fb6b9881a2fe03a3093c8b2df251`. 순수 경계 테스트 `python -m unittest discover -s test -p patient_ingress_plan_test.py` **7 PASS/0.003초/exit0**: foreign project/path·누락/중복/재정렬/외부 파일·비고정 image·Control image/env/mount 변경 거부, 입력 불변, 원격 프로그램 compile. `git diff --check` exit0(기존 CRLF 경고 보존). 관련 FR-014~031/032~041 배포 보존 검증. 이 호스트 operator는 이미 빌드된 후보의 450파일 snapshot에 포함되지 않으며 그 snapshot을 최신 전체 호스트 scripts 검증으로 확대하지 않는다.

**범위 한계:** 계획 비교 PASS는 후보의 실제 적용·rollback·공개 환자 픽셀 성공이 아니다. ingress Docker healthcheck는 NOT CONFIGURED, 실제 HTTPS readiness는 별도 실행 필요. 신규 증적 DRAFT / UNASSIGNED, 신규 독립 사람 검토 미완료. 다음 작업 한 개는 새 source/image/기존 review manifest 및 이 사전검사를 독립 검토한 후 정확한 ingress-only 배포·복구와 공개 환자 CT/MR 정상·거부 흐름을 실행하는 것이다. 전체 MVP/v3 미완료, commit/push 없음.

### 배포 전 읽기 전용 복구 준비 점검 — 2026-10-10

Strict SSH의 실제 Docker inspect에서 Control·ingress는 승인된 `30141f81…` 이미지로 Running, Control은 healthy, PostgreSQL은 기존 `8d0e686f…` 이미지로 Running/healthy였다. ingress에는 Docker Health 상태가 없으므로 healthy로 주장하지 않는다. Control/ingress는 기존 workdir의 control·ingress·mock·key-release·phantom-catalog·patient 6개 Compose 파일을 사용한다. PostgreSQL은 별도 기존 workdir의 2개 파일을 유지한다. 조회 명령 종료0; 전체 환경변수·secret 내용은 출력하지 않았다.

첫 준비 검사는 ingress도 healthy라고 가정해 종료1이었다. 그 가정을 제거한 후의 rendered Compose 비교 명령도 종료1이므로 **ingress-only 배포 계획 비교 및 실제 rollback: NOT VERIFIED**다. 정확한 실패 원인은 아직 확정하지 않는다. 기존 배포 operator는 렌더링에 명시적인 환경변수를 주입하고, 구형 context 검증은 현재 patient 포함 6개 파일을 허용하지 않으므로 그대로 재사용하면 안 된다. 실제 런타임과 기존 operator의 환경 구성 방식을 대조한 candidate-active 사전검사가 필요하다. 이번 점검에서는 파일 업로드·컨테이너 교체·재시작·DB 변경을 실행하지 않았다. 새 후보의 독립 사람 검토는 여전히 미완료이며 기존 승인을 승계하지 않는다.

### 최신 작업: 공개 환자 본인 열람의 첫 차단 재현·ingress 최소 수정, 새 후보 검증 중 — 2026-10-10

공개 B URL에서 실제 환자 로그인·본인 영상 목록·DPoP self-view Grant 발급까지 성공했으나 CT 픽셀 전에 거부됐다. 브라우저 실제 UI 실패 화면을 직접 확인했다. 최초 `artifacts/workstation/patient-real-browser-7bf53411fd06/result.json` **FAIL/exit1/21.183초/owned browser cleanup=true**, 진단 재실행 `...72f9b92ed123/result.json` **FAIL/exit1/23.571초/cleanup=true**. 모두 로컬 API/프록시/SQL fixture 없이 실제 B ingress로 접속했다. 카메라/임상/native·정상 전체 본인 영상 열람을 주장하지 않는다. 기존 모바일→의료진 CT/MR 공유 PASS와 별개다.

현재 Cloud strict image `30141f81…`/healthy 확인 후 실제 private HTTPS에 자기 역할 service credential+잘못된 입력 `{}`를 보내 진단했다. `/gateway/patient-self-view/authorize`, `/ready` 모두 **403 / METADATA_ROUTE_REQUIRED**였다. TLS/hostname 검증 유지, credential은 원격 root process 안에서만 읽고 출력하지 않았다. CLI `python scripts/patient-public-browser-ops.py --ingress-preflight` 종료0은 진단 명령 성공이지 정상 경로 PASS가 아니다. read-only SQL의 첫 Grant는 ACTIVE/미만료/정확한 A/B·scope였고 해당 auditSession에는 발급1개만 있어 실제 authorization 경로에 도달하지 못했음을 확인했다. 최초 보조 원격 진단은 잘못된 CA 파일 경로로 명령 실패했으며, 실제 CA public PEM을 사용하는 검증된 재실행으로 위 결과를 확보했다. TLS 완화 없음.

`src/capstone-control-ingress.js`에 기존 환자 metadata 계약의 정확한5개 endpoint만 추가했다: authorize·ready·package wrap-authorize/prepare/authorize. service token은 이 exact route에서만 전달하고, 일반 API·query 변형·미등록 Gateway route·patient DICOM/Viewer는 그대로 차단한다. 인증·동의·scope·DPoP·Key Vault·DB 정책 변경 없음. 관련 FR-014~031/032~041. 새로운 framework/병렬 권한 모델 없음. `scripts/verify-patient-public-browser.js`, `patient-public-browser-ops.py`와 기존 browser helper의 명시적 public mode는 직접 공개 UI의 정상 검증용이며 isolated SQL 철회/거부를 공개 증거로 승격하지 못하도록 제한했다. 토큰은 RAM·stdin 안에서만 사용, 증거에는 안전한 Grant/audit/Study 식별자만 남긴다. PUBLIC normal-only는 정상·음성 전체 완료 선언이 아니다.

Focused ingress/Viewer/실제 거부 판정/public target boundary **15/15 PASS/exit0/765.902ms**, secret findings0/syntax/diff PASS. Security Gate는 ingress 수정 포함 **PASS/exit0**, unit55.948초/secret3.233초/audit2.824초(각120초); 추가 boundary test 이후 최종 재실행도 **PASS/exit0**, unit56.630초/secret1.571초/audit1.577초였다. gate stdout은 전체 테스트 수를 보존하지 않아 총수를 주장하지 않는다. pnpm11.7.0/lock9.0, global manifest11.22.0 경고 유지.

새 후보 `highpass-platform-mvp:capstone-patient-ingress-20261010`, 실제 Docker image ID **`sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb`**. 기존 승인 local base30141을 사용해 `--pull=false --network=none` 빌드/exit0, 기본 FROM ARG 미지정 경고 보존. src/public/scripts/db/config **450개 hash 일치/불일치0**, `artifacts/workstation/patient-ingress-image-source-20261010.json`(HEAD4ea53c2+dirty), network-none/read-only/UID65532/cap-drop ALL 실제 image 검사. same image Trivy Scan/Container Gate **HIGH0/CRITICAL0/PASS/exit0**, `artifacts/security/container-scan/patient-ingress-20261010.json`, 신규 예외 없음. 실제 격리 Compose 후보 **11검사 PASS/exit0/317.860초/cleanup=true**, `artifacts/workstation/hp-patient-startup-0b8b6715c473.json`. 자체 project의 컨테이너·volume 잔여0 확인. 이는 격리 Control/등록 CLI·최소권한·잘못된 입력/주체·중복 secret 거부의 증거이며 실제 public ingress·Azure·브라우저 성공을 대신하지 않는다.

실패 브라우저의 Grant2개는 실제 서버 시각 기준 모두 expiresAt 경과·effectiveActive0·release0임을 read-only SQL로 확인했다. 계정/ref/Grant/audit를 삭제하지 않았고, 이 상태 관측을 만료 토큰 사용 거부 실행 증거로 주장하지 않는다.

검토 결속 manifest `artifacts/workstation/patient-ingress-review-manifest-20261010.json`은 소스450·scan·Compose11의 동일 image ID와 공개 browser FAIL2개 원본을 확인하고 증거5개 파일의 SHA-256을 기록한다. 결속 검사 PASS는 독립 검토 PASS가 아니다. ignored 로컬 증거는 clone에 포함되지 않는다. 새 후보와 신규 실행은 계속 DRAFT / UNASSIGNED다.

**다음 작업 한 개: 검증된 새 후보의 정확한 변경·image·증적을 독립 검토한 후 Cloud ingress에 적용/rollback하고 같은 공개 환자 흐름을 재검증한다.** 기존 사람 PASS는 다른 source/image 범위이며 신규 후보에 자동 승계하지 않는다. 새 후보는 아직 실제 Cloud/A/B에 배포하지 않았다. 현재 배포의 본인 픽셀 경로는 FAIL, 모바일 본인 열람·실제 만료/음성/감사·전체 MVP/v3 NOT VERIFIED/미완료. 신규 증거 DRAFT / UNASSIGNED, commit/push 없음. 아래는 이전 이력이다.

### 최신 작업: A/B 환자 경로 배포·rollback 및 최신 모바일→의료진 CT/MR 정상·거부 검증 완료 — 2026-10-10

Cloud와 동일한 승인 runtime image `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df`를 A Gateway/B Portal에 적용했다. 각 VM에는 자기 역할의 환자 service secret만 encrypted SSH/SFTP로 연결했으며, 원래 의사 secret·TLS/mTLS 인증서·Vault certificate identity는 유지했다. Rendered config에서 image 외 A의 exact 환경값4개/B3개와 자기 역할 readonly mount1개만 달라짐을 확인했다. 기존 image+원래 Compose 파일 목록으로 실제 rollback하여 원래 runtime 설정 차이0을 확인한 뒤 후보+patient overlay로 재활성화했다. A 원본 PACS 컨테이너2개의 ID/image/config/mount/실행 상태 보존. B는 현재 Portal/Viewer만 실행하며 수신 PACS 반입 완료를 주장하지 않는다.

`artifacts/workstation/patient-edge-rollout-20261009T223222Z/result.json`: **4검사 PASS / exit0 / A·B rollback PASS**. 신규 host operator `scripts/capstone-patient-edge-rollout.py`는 기본 inventory, 명시적인 `--apply`에서만 배포하며 신뢰 host identity·기존 image·설정 pin을 확인한다. 이 host operator는 이전 승인 이미지의 COPY 내용으로 주장하지 않는다. 새 overlays는 `infra/workstation/hospital-a-patient.compose.yml`, `hospital-b-patient.compose.yml`. 관련 FR-014~031/032~041, 기존 정책/API 변경 없음. 후보 취약점 검사 image ID 결속 유지, 신규 예외 없음.

최초 배포 실행 `patient-edge-rollout-20261009T223120Z`, 진단 재실행 `...223147Z`는 **NOT VERIFIED**였다. 새 보존 점검이 B에도 PACS를 요구했으나 실제 B에는 Portal만 있었다. image/secret 변경 전에 종료했으며 정책상 DENY가 아니다. A의 원본 PACS 존재는 필수로 유지하고, B는 존재하는 PACS가 있을 때 보존하는 방식으로 실제 승인 Portal 구성에 정렬했다. 원본 결과는 보존한다.

현재 소스 Security Gate **PASS/exit0**: unit54.944초/secret1.269초/dependency audit1.696초, 단계별120초. 테스트 총수는 gate가 보존하지 않아 주장하지 않는다. 실제 pnpm11.7.0/lock9.0 일치, global manifest11.22.0 경고 유지. focused host context/secret 정책 wrapper2 PASS/exit0/448.157ms, 별도 secret scan findings0. 새 브라우저 진단 수정은 이 gate 이후이며 후속 검증이 필요하다.

최신 공개 URL의 실제 Chrome 모바일→의료진 CT 흐름 최초 실행 `artifacts/workstation/b-browser-2026-10-09T22-35-09.338598+00-00/result.json`은 **FAIL / exit1 / 6.577초**. 실제 의료진·환자 로그인2개 PASS이나 생성 동의 binding 검사에서 중단, Viewer·철회·음성 종단 NOT VERIFIED. 해당 결과는 생성 동의 receipt를 보존하지 못했고 cleanup 목록이 비어 있으므로 생성 자산 회수 완료로 주장하지 않는다. 비교 결과만 기록하고 positively owned receipt는 assertion 실패 전 회수 목록에 넣도록 host verifier를 보완했다. 과거 PASS를 최신 배포에 승계하지 않는다.

원인 확인: 실제 Cloud의 제한된 read-only SQL에서 최초 실패 시간 구간의 합성 동의1개를 확인했다. `consent_3deb3c9aef19466`은 suffix15자리이며 환자·HOSP-A→B·VIEW_ONLY·ACTIVE·정확한 CT scope·생성시각 `2026-10-09T22:35:06.504Z`가 모두 일치, token0이었다. 기존 `makeId`는 두 uint32를 0-padding 없이 hex로 연결하므로 suffix2~16자다. 검증기의 고정16자 가정이 잘못됐다. `scripts/lib/capstone-receipt-id.js`로 기존 계약을 표현하고 consent/ticket 수신 검사에 적용했다. 서버 ID·인가·동의 정책은 변경하지 않았다. 최초 실패 동의는 정확한 ID·생성시각·환자·기관·권한·Study를 인증된 환자 API로 재확인한 뒤 철회해 **PASS/exit0**로 회수했다(터미널 기록). 과거 FAIL JSON은 덮어쓰지 않았다.

| 최신 실제 공개 브라우저 흐름 | 결과 | 증적 (`artifacts/workstation/`) |
|---|---|---|
| 모바일 명시적 CT 승인→QR→실제 의료진 접수/Viewer→모바일 철회→차단 | browser7 PASS/음성9 PASS/cleanup PASS/exit0/89.591초 | `b-browser-2026-10-09T22-37-21.736012+00-00/result.json` |
| 모바일 명시적 MR 승인→같은 의료진 Viewer·철회·차단 | browser7 PASS/음성9 PASS/cleanup PASS/exit0/202.175초 | `b-browser-2026-10-09T22-40-55.500349+00-00/result.json` |
| CT 실제 PG 동의·actor·거부 사유·release·감사 chain | 6 PASS/exit0; release4/consumed4/감사결속4, persisted chain6438 | `phantom-audit-2026-10-09T22-37-29.790893+00-00/result.json` |
| MR 실제 PG 동의·actor·거부 사유·release·감사 chain | 6 PASS/exit0; release5/consumed5/감사결속5, persisted chain6552 | `phantom-audit-2026-10-09T22-41-05.535500+00-00/result.json` |

두 browser 실행 모두 같은 receipt의 환자·기관·scope 일치, 실제 256×256 픽셀/다음 슬라이스 및 정확한12개 SOP 목록을 확인했다. 모든12개 픽셀을 내려받아 검사했다는 의미는 아니다. Series·기관·환자 역할·의료진 ID·동의 입력 누락·존재하지 않는 동의·토큰 변조·DPoP 누락/재사용은 각각 실제403/정확한 audit reason 증가/토큰·키 발급·성공 행위 count 및 동의 scope 지문 불변/응답의 token·payload 부재를 확인했다. API 음성 probe는 별도 proof-key bound token이며 실제 의료진 UI 정상 경로를 대체하지 않는다. 실제 환자 철회 후 UI 픽셀 제거·기존 토큰 신규 접근 거부도 확인했다. A/B의 기존 실제 AES-GCM/Key Vault 경로를 사용한 runtime이며 PG release/audit 확인은 Azure Vault service audit log 검증을 의미하지 않는다. 카메라 scan·native 생체·이번 실행의 실제 만료·수신 PACS 반입은 **NOT VERIFIED**다.

ID 검사 최종 수정 후 focused3 PASS/exit0/538.611ms, syntax/diff PASS. 최종 Security Gate **PASS/exit0**, unit55.703초/secret1.465초/audit2.103초(단계별120초). 브라우저 CT/MR은 고정길이 진단 수정 이후·최종 가변길이 helper 적용 전 실행이며, 짧은 ID 허용 helper는 focused로 검증했다. helper 적용 후 전체 browser 재실행 결과로 승계하지 않는다.

**이번 한정 결과: 최신 배포의 모바일 환자 승인·QR→의료진 CT/MR Viewer→철회 — 정상·거부 종단 검증 완료.** 신규 증적은 **DRAFT / UNASSIGNED**이며 기존 사람 PASS의 자동 승계나 전체 MVP/v3 완료가 아니다. **다음 작업 한 개: 같은 공개 배포에서 환자 웹·모바일 본인 self-view CT/MR의 실제 암호화 열람·차단·감사를 연결해 검증한다.** 실제 만료·최종 mTLS/경계·반복 리허설·독립 검토와 기타 필수 P0도 남는다. 별도 commit/push 없음. 아래 기록은 이전 이력이다.

### 최신 작업: Cloud 환자 기능 활성화·실제 설정 rollback 완료 — 2026-10-10 (Asia/Seoul)

Cloud Control/ingress를 승인된 candidate `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df`로 적용하고 기존 Compose context에 `patient.yml`을 명시적으로 추가했다. rendered config 비교에서 image 변경 외 Control의 정확한 환자 환경값8개·readonly secret mount3개만 달라짐을 확인했다. 기존 ingress 공개 범위·TLS·네트워크·DB volume·Vault identity 배치 변경 없음. 실제 파일 읽기·전용 authority 연결·환자 flags3개 활성 상태에서 Control healthy 확인, 기존 PG container/image/mount/healthy 및 감사 count/지문 전후 일치.

**4개 검사 PASS / exit0 / rollback PASS**, `artifacts/workstation/patient-cloud-activation-20261009T222250Z/result.json`. 이전 image `a548790…`와 원래5개 Compose 파일 목록으로 실제 rollback해 환경값·mount·runtime 보안 설정 불변과 patient feature-off readiness를 검증한 다음 후보+patient overlay로 재활성화했다. DB/schema/account/ref/audit 삭제나 downgrade 없음. 최종 상태는 후보 활성 상태다. 새 증적 **DRAFT / UNASSIGNED**이며 A/B 환자 인증 연결·실제 공개 환자 Viewer E2E·전체 MVP 성공을 뜻하지 않는다.

A/B 실제 VM inventory는4 PASS/exit0, `artifacts/workstation/patient-key-inventory-20261009T222028Z/result.json`: A image `2c7b366…`, B `940806…` healthy, NTP synchronized, 별도 Entra certificate auth HTTP200/등록 identity 일치. 이번 turn에 A/B image·identity·secret은 변경하지 않았다. 새 `hospital-a-patient.compose.yml`과 `hospital-b-patient.compose.yml`을 실제 Compose 해석기로 기존 Gateway/Portal+encryption 구성과 비교해 각 exact patient 환경값·자기 역할 readonly secret mount1개 외 변경0을 확인했다(A/B각 PASS/exit0). 실제 VM에는 아직 적용하지 않았다.

기존 `patient-deployment-preflight.py` 기본 실행은 이전 image/context에 고정된 baseline 점검이다. 현재 활성 candidate/6개 config를 이 기본 모드에서 검사하면 기존 pin과 불일치하므로, 이를 실제 서비스 장애나 활성화 실패로 오인하지 않는다. 활성 상태의 권위 증거는 위 실제 rollout/readiness/rollback 결과다. 후속 점검에는 명시적인 candidate-active 검사 모드 정렬이 필요하다.

**다음 작업 한 개: A/B에 자기 역할의 환자 service secret과 최소 overlay·승인 image를 연결하고 기관별 readiness/원래 설정 rollback을 검증한다.** 기존 의사 경로·A PACS·mTLS·각 VM의 Vault 개인키를 보존하고 A secret을 B에 배포하지 않는다. 이후 실제 발표 URL의 환자 웹/모바일→암호화 CT/MR→감사→철회/만료 거부와 기존 의료진 공유 흐름 회귀가 남는다. 아래는 이전 이력이다.

### 최신 작업: 실제 cloud DB 준비·합성 소유권 등록 완료 — 2026-10-10 (Asia/Seoul)

승인된 runtime/operator image `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df`와 승인 당시 Node 준비/등록 파일 hash 일치를 확인한 뒤 실제 기존 DB에 적용했다. 보호된 전용 파일3개를 기존 root:GID65532/0750 디렉터리에 root:GID65532/0640으로 신규 생성했다. 기존 파일 덮어쓰기·secret 내용 출력·다른 CA/개인키 전송 없음. 기존 Control을 명시적으로 정지하고 app/authority/bootstrap의 다른 DB 연결0을 확인한 유지보수 구간에 준비 CLI preflight→명시적 apply(migration033~036/4개)→등록 CLI preflight→명시적 apply→재등록 거부를 실행했다. 새 역할은 LOGIN이지만 superuser/bypassRLS/role 생성/DB 생성/replication 권한이 없고, account/ref INSERT와 audit DELETE 불가·release INSERT 허용을 실제 SQL로 확인했다.

결과 **7개 검사 PASS / exit0**, `artifacts/workstation/patient-cloud-preparation-20261009T221828Z-5e32ce67/result.json`: 고정 합성 account1/ref2/grant0/release0, 감사 이벤트1개 증가, 신규 감사 ID를 제외한 기존 count/지문 불변, persisted 전체 hash chain 유효, 재등록 거부 시 추가 감사 부작용0. 기존 DB container/volume·원본 합성 PACS 보존. Control을 원래 container ID/image/config/mount로 재시작해 healthy 복귀를 확인했다. ingress/PG의 ID/image/config/mount도 보존했다. 임시 operator overlay·컨테이너는 회수했고, 실제 DB 계정에 사용한 보호된 파일은 후속 활성화를 위해 보존했다. 이는 schema downgrade/DB 삭제 rollback이 아니다.

후속 read-only 점검 `artifacts/workstation/patient-deployment-preflight-20261009T221914Z/result.json`은 보호된 파일3개·전용 table4개/role·기존 서비스 baseline·합성 최소 메타데이터 **PASS**다. 환자 feature3개는 여전히 off이므로 전체 **NOT VERIFIED / exit2**. 기능 활성화·실제 공개 환자 self-view·A/B 신규 서비스 인증·전체 시연·전체 MVP 완료로 승격하지 않는다. 신규 실행 증적 **DRAFT / UNASSIGNED**, 과거 사람 판정은 원래 검토 범위에만 유지한다.

**다음 작업 한 개: 승인된 runtime 후보에 맞춰 cloud 환자 활성화 overlay 및 A/B 서비스 인증의 배포 계약을 실제 구성과 대조하고, 동일 경로의 활성화·readiness·원래 설정 rollback 검증을 진행한다.** 기존 image-only rollout으로 환자 활성화를 대체하지 않으며 DB/계정/ref/감사 삭제를 복구 명령으로 사용하지 않는다. 이후 실제 발표 URL에서 환자 웹/모바일·의료진 정상/거부 종단과 반복 리허설이 남는다. 아래는 이전 이력이다.

### 최신 작업: 비루트 secret 사전점검 정렬 완료 — 2026-10-10 (Asia/Seoul)

기존 host 사전점검의 secret metadata 판정을 `scripts/lib/patient_secret_permissions.py`로 분리했다. root 소유·GID65532·mode0440/0640의 일반 파일만 허용하고, parent는 root 소유0700 또는 root:GID65532/0750만 허용한다. root0600/0400은 비루트 읽기 불가로 거부, world-readable/group-write/special bit/다른 소유자·그룹/파일·parent symlink도 거부한다. secret 내용은 읽거나 출력하지 않는다. 이는 metadata 확인이며 실제 readonly mount·기동 시 읽기·secret 유효성 검사를 대신하지 않는다. 기존 인증·동의·권한·TLS·Vault·DB 정책 변경 없음. 관련 FR-014~020/037~041.

Node focused wrapper1 PASS/exit0/383.9242ms이며 실제 Python unittest3개(정상·파일 음성·parent 음성의 subcase) 실행을 확인한다. 실제 cloud Linux의 고립된 metadata fixture **8개 PASS/exit0/cleanup=true**, `artifacts/workstation/patient-secret-permissions-20261009T214904Z.json`. 해당 fixture는 인증 secret이 아닌 고정 표식이며 실제 DB·기존 파일·서비스에 연결하지 않았다. 실제 cloud 수정된 read-only preflight는 **NOT VERIFIED/exit2**, `artifacts/workstation/patient-deployment-preflight-20261009T214837Z/result.json`: 기존 런타임/합성 최소 메타데이터 PASS, 환자 flags off/준비 객체·파일 미완료를 그대로 표시했다.

현재 소스 Security Gate **PASS/exit0**: unit55.591초/secret1.201초/dependency audit1.646초, 각120초 제한. gate stdout의 테스트 전체 개수는 보존되지 않아 주장하지 않는다. pnpm11.7.0/lock9.0 일치와 global manifest11.22.0 경고 유지. diff 검사 PASS. 새 증적 **DRAFT / UNASSIGNED**. `30141f81…` 후보의 runtime src/public은 바꾸지 않았지만, 새 host 검사 파일은 그 이미지에 포함됐다고 주장하지 않으며 이전445개 attestation을 현재 변경된 scripts 전체에 승계하지 않는다. 별도 commit/push/배포/DB apply/기능 활성화 없음.

**다음 작업 한 개: 승인된 runtime 후보와 기존 Compose context를 유지하며 실제 보호된 전용 파일 준비 및 유지보수 구간의 DB 준비·합성 소유권 등록을 수행한다.** 기존 writer 정지/재로드·최소권한·기존 계정/ref 보존·감사/rollback 조건을 함께 확인한다. 이후 A/B 서비스 인증 및 웹/모바일 배포 정렬과 실제 발표 URL의 정상·거부·복구 검증이 남는다. 아래는 이전 작업 이력이다.

### 검토 후 실제 cloud 준비 CLI 사전검사 — 2026-10-10 (Asia/Seoul)

승인된 후보 image ID `30141f8128a2…`를 cloud에 전송하고 archive SHA-256과 실제 import image ID를 확인했다. 기존 Control/ingress/PG를 교체하지 않았다. 기존 Compose context에 임시 operator 서비스만 추가한 rendered config에서 기존 서비스/네트워크/볼륨 구성 불변을 확인했다. **실제 CLI 사전검사5개 PASS / exit0 / cleanup=true**, `artifacts/workstation/patient-cloud-prepare-preflight-20261009T214214Z-e4897f78/result.json`. 기본 UID65532에서 admin/임시 authority secret 읽기 가능(내용 출력 없음), 준비 CLI **READY / applied:false**, DB table count·authority role 부재·감사 count/지문·기존 컨테이너 ID/image/config/mount/healthy 전후 일치를 확인했다. 기존 원격 서비스·DB·volume 보존. 후보 image는 후속 준비를 위해 cloud에 보관했고, 임시 archive/secret/overlay/일회성 컨테이너는 제거했다. 이는 DB 적용·소유권 등록·기능 활성화·공개 E2E의 증거가 아니다. 새 실행 증적은 **DRAFT / UNASSIGNED**이며 이전 사람 PASS를 자동 승계하지 않는다.

최초 실행 `patient-cloud-prepare-preflight-20261009T214006Z-653ef602/result.json`은 실제 CLI exit1로 **NOT VERIFIED / wrapper exit2 / cleanup=true**였다. root:root0600으로 만든 임시 secret은 UID65532에 맞지 않았다. 기존 admin은 root:GID65532/0640임을 metadata로 확인했고, 새 임시 secret도 이 제한된 그룹 읽기 방식·readonly mount를 사용한 재실행이 통과했다. 최초 CLI는 generic 오류만 반환했으므로 그 실행의 정확한 내부 예외를 확정하지 않는다. 최초 결과의 `importedImageRetained:false`는 전체 PASS 여부에서 계산된 잘못된 요약이다. 실제 image는 load됐으며 후속 `docker image inspect`와 최신 검사로 존재를 확인했다. 원본 FAIL/NOT VERIFIED JSON은 수정하지 않는다.

후속 준비의 발견된 공백: 기존 `patient-deployment-preflight.py`의 root 소유/no-group-bit 메타데이터 조건은 비루트 이미지가 읽는 root:GID65532/0640 파일까지 부적합으로 표시한다. 파일 권한을 world-readable로 완화하거나 operator 컨테이너를 root로 실행하지 않았다. 실제 보호된 secret 준비 전에 이 메타데이터 검사와 비루트 읽기 요건을 일치시키고 focused 정상/음성 검증이 필요하다. **다음 작업 한 개: 보호된 secret 파일의 root 소유·전용 그룹·others 접근 금지 및 비루트 read 조건을 기존 사전점검에 정렬한다.** 이후 유지보수 구간의 명시적 DB 준비/소유권 등록·활성화·공개 정상/거부·rollback이 남는다.

검토 후 실제 cloud 읽기 전용 재확인: `python scripts/patient-deployment-preflight.py`, **exit2 / NOT VERIFIED**, `artifacts/workstation/patient-deployment-preflight-20261009T213747Z/result.json` (UTC 파일명, 관측일 KST 2026-10-10). strict SSH host identity·기존 Control/ingress `a548790…`·PostgreSQL `8d0e686…` 및 기존 Compose context 확인 PASS. SQL readOnly=on/5초 제한, 고정 합성 환자·ACTIVE HOSP-A·CT/MR Study-Series2개 최소 메타데이터 확인 PASS. 환자 feature3개는 false, 보호된 patient secret 파일3개는 미확인, authority4개 table과 전용 LOGIN role은 부재다. 이는 정책상 DENY나 서비스 장애가 아니라 아직 적용하지 않은 배포 준비 공백이다. DB·서비스·파일 변경 없음.

이 읽기 전용 확인 직후의 계획은 후보 전달과 실제 preparation CLI 사전검사였으며, 맨 위 최신 기록에서 완료 결과와 첫 실패를 확인할 수 있다. 활성화·재시작·DB 적용은 아직 수행하지 않았다. 이미지 교체만으로 준비 완료를 선언하지 않는다. Azure 스킬의 `.azure/deployment-plan.md` 전제가 없어 해당 azd workflow는 사용하지 않았으며, 기존 저장소 도구 결과를 Azure skill validation PASS로 표시하지 않는다.

### 최신 사람 검토 판정 — 2026-10-10 (Asia/Seoul)

사용자가 이 채팅에서 직접 제공한 판정: **검토자 김범희 / 검토일 2026-10-10 / PASS / 예외 없음**. 검토 대상은 커밋 `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401`, 후보 image ID `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df` 및 아래 11개 파일 review manifest로 특정한 합성 환자 등록·환자 self-view 배포 준비의 한정 증적이다. 이전 승인 자동 승계가 아니라 이번 검토 요청에 대한 새 사람 판정이다. 실제 공개 배포·cloud DB 적용·환자 동의 철회 UI·수신 의료진 공유 종단·전체 MVP/v3·운영/법률 적합성은 판정 범위가 아니다.

검토 당시 생성된 원본 JSON의 `DRAFT / UNASSIGNED` 표기는 덮어쓰지 않고 이 문서에 후속 사람 판정을 연결한다. 이후 변경 코드·이미지·신규 실행 증적에는 이 판정을 자동 적용하지 않는다. 독립 검토 대기는 해소됐으며 실제 cloud 사전검사 후의 다음 작업은 문서 맨 위 최신 기록을 따른다. 실제 적용 전 상태 불일치 또는 새 정책 결정이 발견되면 중단하고 보고한다.

### 최신 관측: 실제 컨테이너 등록 CLI 검증 완료 — 2026-10-10 (Asia/Seoul)

후보 `highpass-platform-mvp:capstone-patient-registration-cli-20261010`, image ID `sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df`의 격리 Compose 검증은 **11개 검사 PASS / exit0 / 297.103초 / cleanup=true**다. 증적: `artifacts/workstation/hp-patient-startup-e96e6d364eed.json` (ignored 로컬 생성물; clone에 포함되지 않음). 고정 합성 카탈로그는 기존 등록 함수를 non-superuser 앱 계정으로 실행한 시험 준비이며 HTTP 인증 증거가 아니다. 실제 operator CLI의 기본 사전검사에서 account/ref/audit 변경0, 명시적 적용에서 account1/ref2/audit1 및 hash chain 유효, 재적용 거부에서 부작용0을 확인했다. 기존 Control 준비·readiness·잘못된 입력/주체 거부·중복 secret 시작 거부 검사도 유지했다. 관련 FR-006~009/014~020/032~041.

이 후보는 기존 검증된 local base에서 `--pull=false --network=none`으로 빌드했고 base image ID 전후 일치、build exit0다. 2026-10-10 신규 검사에서 HEAD `4ea53c28b6eb1b59e15b8ee02a3e9cdf37ddc401`의 src/public/db/config/scripts **445개 일치 / 불일치0 / exit0**를 확인했다. 증적 `artifacts/workstation/patient-registration-cli-image-source-20261010.json`. 실제 image ID를 지정해 nonroot/network-none/read-only/cap-drop ALL로 검사했으며 임상 payload·생성물은 제외, docs/test는 COPY 대상이 아니다. 같은 image ID의 새 Trivy Scan과 Container Gate는 **HIGH0 / CRITICAL0 / PASS / exit0**, 증적 `artifacts/security/container-scan/patient-registration-cli-20261010.json`. 취약점 예외 추가·수정 없음. 이전 후보 결과의 승계가 아니라 새 image ID에 대해 직접 실행한 결과다.

검토 증적 결속: `artifacts/workstation/patient-registration-cli-review-manifest-20261010.json`은 위 동일 image ID의 소스/Compose/scan과 웹·모바일 CT/MR wrapper 및 browser 결과 **11개 파일의 SHA-256**을 기록한다. manifest 생성 시 image ID 3곳 일치·Compose11/cleanup·HIGH/CRITICAL0·4개 browser의 실제403/PATIENT_ACCESS_DENIED·wrapper에 포함된 browser 결과와 별도 원본 JSON의 일치를 직접 확인했다. **증적 일치 검사 PASS**이지 독립 검토 PASS나 후보 공개 브라우저 E2E PASS가 아니다. 생성물은 ignored/DRAFT이며 clone에 포함되지 않는다. 커밋 전 Security Gate는 터미널 관측이고 이 manifest에 존재하지 않는 원본 파일을 추가하지 않았다.

**독립 검토 요청 당시 범위:** 위 커밋·image ID의 합성 환자 등록 및 환자 self-view 배포 준비。Compose11·소스445·Container Gate·아래 Security Gate와 웹/모바일 CT·MR의 한정 브라우저 증거를 대상으로 요청했다. 요청 당시 UNASSIGNED/미검토였으며, 최신 판정은 맨 위 김범희의 2026-10-10 PASS/예외 없음 기록을 따른다. 기존 release Runbook의 오래된 baseline/rollback은 역사로 분리했으며, image-only rollout을 환자 준비/활성화로 오인하지 않도록 수정했다.

실제 cloud DB 등록·기능 활성화·공개 배포·정상/음성·rollback은 여전히 **NOT VERIFIED**이며 위 시험이나 사람 검토 PASS로 대체하지 않는다. 공개 브라우저 흐름·환자 동의 철회 UI·원래 환자 동의/QR→수신 의료진 공유 흐름은 별도 검증이 남는다. 후속 신규 증적 **DRAFT / UNASSIGNED**, 전체 MVP/v3 미완료. 아래 기록은 이전 이력이다.

커밋 전 현재 소스의 Security Gate는 PASS/exit0: Node 테스트54.502초·secret scan1.161초·dependency audit1.606초, 단계별120초 제한. 직접 focused 등록/정책 거부 테스트6/6 PASS/637.8787ms/exit0 및 staged diff 검사 PASS. 전체 Node 개수는 gate가 보존하지 않아 주장하지 않는다. pnpm 실제11.7.0/lock9.0 일치, global manifest11.22.0 차이 경고 유지. 이 결과는 새 이미지 Container Gate나 배포 승인으로 승계하지 않는다.

### 최신 관측: 정상·거부 응답 결속 보강 및 후보 재검증 — 2026-10-10 (Asia/Seoul)

HEAD `6f00e2d54e28d695d4c4054184b5668580fb29ac` + dirty source. 정상 브라우저 영상과 철회 후 UI 오류/PACS read 불변만으로는503 장애를 정책 DENY로 오인할 수 있음을 확인했다. 실제 full-app의 forward 경계에서 철회 이후 rendered 응답의 status와 whitelist 오류 코드만 관측하고 **403 + PATIENT_ACCESS_DENIED**를 요구하도록 보강했다. body/token/key를 증적에 출력하지 않는다. `requirePatientPolicyDenial`은 미응답·503·500·401·다른403을 모두 거부한다. 기존 권한·암호화·TLS/mTLS·DPoP 정책과 Viewer 동작은 변경하지 않았다. 신규 테스트2 PASS, 등록/Viewer 포함 focused12/12 PASS/558.7037ms/exit0. 관련 FR-014~020/026~041.

| 최신 실행 | 결과와 시간 | 증적 |
|---|---|---|
| 환자 웹 CT, 강화된 응답 검사 | wrapper7/SQL4/Chrome8 PASS/exit0; SQL64.058초/browser46.661초; policyDenial403/PATIENT_ACCESS_DENIED | `patient-vault-20261009T162247Z-ab1a67d7929e/result.json`; browser `patient-real-browser-63b93f6f5c05/result.json`·`viewer.png` |
| 환자 웹 MR, 강화된 응답 검사 | wrapper7/SQL4/Chrome8 PASS/exit0; SQL64.432초/browser48.218초; policyDenial403/PATIENT_ACCESS_DENIED | `patient-vault-20261009T162114Z-6922c2f340a7/result.json`; browser `patient-real-browser-0c746a042b43/result.json`·`viewer.png` |
| 모바일 MR, 강화된 응답 검사 | wrapper7/SQL4/Chrome8 PASS/exit0; SQL31.817초/browser18.320초; policyDenial403/PATIENT_ACCESS_DENIED | `patient-vault-20261009T161847Z-ff2ac490d7ec/result.json`; browser `patient-real-browser-7eb6e50429dc/result.json`·`viewer.png` |
| 모바일 CT, 강화된 응답 검사 | wrapper7/SQL4/Chrome8 PASS/exit0; SQL35.671초/browser19.247초; policyDenial403/PATIENT_ACCESS_DENIED | `patient-vault-20261009T162004Z-89e1e3cb4041/result.json`; browser `patient-real-browser-33bef31a4d1d/result.json`·`viewer.png` |

위 실행은 명시적 합성 소유권 등록→실제 서명 Mock IdP 로그인·검사 선택(모바일은 개발 unlock 포함)→현재 Control API·최소권한 SQL→A 실제 합성 PACS256×256 두 SOP→A 실제 Azure wrap/AES-GCM/B unwrap→SQL Grant 철회 후 실제403와 PACS read2 유지→hash chain/release2 CONSUMED→자체 SQL/브라우저/VM stage cleanup=true와 기존 A/B 이미지/healthy 보존을 확인했다. screenshot 직접 확인. 이번 모바일 및 웹 MR에서는 Page.navigate 응답 관측 timeout 후 같은 탭 URL/로그인 DOM 확인으로 진행한 분기가 실제 실행됐다. navigation 재발행·새 프로세스 재시작·TLS 완화 없음. Page.enable timeout 진단 분기의 효과는 여전히 NOT VERIFIED다.

강화 이전의 이 turn MRI 웹 `patient-vault-20261009T161449Z-070d9bff3279`는 wrapper7/SQL4/Chrome6 PASS/exit0, SQL63.203초/browser45.459초, browser `3c65430f6548`였다. 모바일 CT `patient-vault-20261009T161639Z-da97666eb7f3`는7/4/7 PASS/exit0, SQL34.373초/browser19.185초, browser `cc2111cea957`였다. 이 이전 결과는 exact403를 보존하지 않았으므로 아래 강화된 결과로 승계하지 않는다. 모든 경로는 격리 합성 SQL/신뢰된 로컬 HTTPS/VM-local crypto이며 공개 배포·네이티브 기기/생체·환자 동의 철회 UI·전체12 SOP·수신 의료진 공유 E2E의 증거가 아니다.

모바일 시험의 relay `ConnectionResetError / WinError10054` thread 경고2개는 지속 관측되었고 최종 웹 CT도 경고1개가 있었다. HTTP/crypto/SQL 결과와 cleanup은 PASS였지만 reset 원인/시점 분류는 NOT VERIFIED로 남긴다. 경고를 숨기거나 정책 DENY로 바꾸지 않는다. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료.

통합 후보 `highpass-platform-mvp:capstone-patient-registration-20261010`를 기존 local base `fedbae566527…`와 `--pull=false --network=none`로 빌드/exit0 했다. Docker image ID **`sha256:2cce5a642ab287efa3396b92958e5418df73a6a11d253e7a6fd3654ca18e8a8f`**, BuildKit config digest `89714df…`와 구분한다. base ID 전후 일치 PASS. 최초 raw image ID를 FROM ARG로 전달한 빌드는 Docker가 `docker.io/library/sha256:…`로 해석해 registry insufficient_scope/exit1이었고 후보를 만들지 못했다. 검증된 기존 local tag를 사용한 재실행은 성공했다. ARG 기본값 없음 경고는 유지하며 registry/TLS 인증 검증을 완화하지 않았다. 의존성/lockfile 변경 없음.

현재 src/public/db/config/scripts **445개**(미추적 등록 helper/CLI/SQL verifier와 read-only preflight 포함)의 로컬→이미지 해시 일치/불일치0/exit0, `artifacts/workstation/patient-registration-image-source-20261010.json`. Dockerignored 임상 payload/생성물은 제외했다. nonroot/network-none/read-only/cap-drop ALL의 실제 image ID 기반 조회다. docs/test는 이미지 COPY 대상이 아니다. Trivy Scan/Gate는 같은 image ID **HIGH0/CRITICAL0/exit0/PASS**, `artifacts/security/container-scan/patient-registration-20261010.json`; 기존 예외 추가/수정 없음. Security Gate **PASS/exit0**, unit-tests58.294초/secret1.080초/dependency audit1.517초, 단계별120초, `artifacts/workstation/patient-registration-security-gate-20261010.json`. gate는 test count를 보존하지 않아 전체 개수는 주장하지 않는다. pnpm11.7.0/lock9.0, global manifest11.22.0 경고 유지.

이 image ID의 격리 Compose는 **7개 검사 PASS/exit0/197.550초/cleanup=true**, `artifacts/workstation/hp-patient-startup-b0d9f37ffb2d.json`: 실제 readonly secret mount·Control baseline ready·준비 CLI preflight/apply·재적용 거부·전용 authority LOGIN과 Control 시작·잘못된 입력400/잘못된 B 주체403·중복 서비스 secret 시작 거부·기존 격리 Control readiness를 확인했다. 생성한 project의 container/volume 잔여0을 별도 Docker 조회했다. 각 Docker 명령60초/Compose readiness45초, 외부 요청별 timeout 유지. 도중 일시적인 Dead prepare-run 상태가 조회되었으나 이후 같은 자산은 없어졌고 원래 실행은 종료0으로 완료했다. 이 관측만으로 daemon 장애나 작업 중단을 확정하지 않고 재시작하지 않았다.

이미지 해시 일치는 host 브라우저 결과를 image public E2E로 승격시키지 않는다. 등록 helper는 실제 격리 SQL에서 검증했으나 **operator 등록 CLI의 실제 container 명령 성공**은 아직 NOT VERIFIED(위 preparation CLI와 다른 명령)다. 실제 cloud DB 등록/기능 활성화/public 정상·음성·rollback도 NOT VERIFIED이다. 실제 적용은 최신 사람 검토 전 수행하지 않는다. **다음 작업 한 개: 기존 격리 Compose fixture에 고정 합성 카탈로그와 등록 CLI preflight/apply/재등록 거부·감사 검증을 연결한다.** 이는 새 정책 모듈이 아니라 동일 사용자 흐름의 배포 준비 공백을 채우는 작업이다. 이후 최신 후보의 독립 검토→공개 배포 정상/음성/rollback→원래 환자 동의·QR·수신 의료진 공유 종단 흐름이 남는다. 문법/diff/민감정보 검사 PASS, 기존 변경/DB/VM/PACS 보존, 이번 turn commit/push/deploy 없음. 아래 관측은 이전 이력이다.

### 최신 관측: 명시적 합성 환자 소유권 등록 준비 — 2026-10-10 (Asia/Seoul)

기준 HEAD `6f00e2d54e28d695d4c4054184b5668580fb29ac` + 신규 dirty 변경. 기존 전체 앱 verifier의 직접 account/ref INSERT를 고정 카탈로그 기반 `registerPatientPhantom`의 기본 preflight→명시적 적용→재적용 거부로 교체했다. operator CLI는 서버 startup/HTTP에 연결하지 않는다. 기존 writer 정지·유지보수·재로드 전제가 있으며 외부 병원 소유권 검증/법률 판정을 대신하지 않는다. 기존 최소권한·동의·DPoP·mTLS·Vault 정책 변경 없음. 관련 FR-006~009/014~020/032~041.

`node scripts/verify-patient-phantom-registration.js`의 최신 실제 격리 SQL 결과는 **6개 검사 PASS/exit0/13.561초/cleanup=true**, `artifacts/workstation/hp-patient-registration-a0be8cb69d3c/result.json`. 다른 app 연결이 살아 있으면 거부, 기본 preflight 변경0, Series 카탈로그 불일치 거부/계정·ref·감사 부작용0, 감사 INSERT 장애 시 account/ref rollback, 명시적 account1/ref2/audit1 commit와 재등록 거부, 기존 persisted hash chain 유효성을 확인했다. SQL schema bootstrap은 생성한 tmpfs DB에서만 수행했다. 원래 VM/cloud DB·PACS·volume 보존. 단위4/4 PASS/334.977ms/exit0, 문법/diff 검사 PASS.

최종 parent Study 결속 보완 이후의 실제 SQL은 **7개 PASS/exit0/13.931초/cleanup=true**, `artifacts/workstation/hp-patient-registration-84d7cc611488/result.json`. 격리 DB의 CT Series를 MR Study에 잘못 결속한 음성 fixture도 거부하며 계정/ref/audit count 불변을 확인했다. 중간 `3e6915b1aa3a`는 parent 비교 포함/음성 fixture 추가 전6 PASS/20.831초였다. 최종 focused 등록/Viewer **10/10 PASS/375.4697ms/exit0**, Node/Python 문법·secret findings0·diff PASS. 아래 Security Gate는 parent 비교/추가 CDP 진단 이전 실행으로, 최종 전체 gate 재실행은 NOT VERIFIED이며 이 focused/SQL 결과로 대체하지 않는다.

최초 `hp-patient-registration-498772faee61`은 업무5개 검사 후 cleanup 확인 FAIL/20.481초/exit1이었다. 이후 실제 Docker 조회에서는 해당 자산이 없어 삭제 완료를 확인했지만 최초 결과는 수정하지 않았다. `docker stop` 후 동일 owned 자산의 auto-remove 완료를10초 안에 관측하도록 보완했다. 중간 `3719d4e26ce5`는5개 PASS/15.311초/exit0/cleanup=true, 최신 실행은 app-writer 음성도 포함한다. 정리 이력은 제품 보안 거부로 분류하지 않는다.

클라우드는 read-only 재조회했다: `artifacts/workstation/patient-deployment-preflight-20261009T160452Z/result.json`, **NOT VERIFIED**. Control/ingress a548790… 및 PostgreSQL8d0e686… baseline PASS, readOnly=on/5초 제한. 기존 schema와 합성 환자·ACTIVE HOSP-A·고정 CT/MR Study-Series2개 최소 메타데이터 존재 PASS. 이는 helper의 전체 필드 비교나 PACS 실물 검사/실제 migration preflight 실행이 아니다. 환자 flags=false, authority tables/role 없음, protected secret file3개 미확인 상태는 그대로다. Python 도구의 정의된 종료 코드는2이며 이번 PowerShell wrapper의 관측 종료 코드는1이었다. 실제 등록/활성화는 수행하지 않았다.

Security Gate는 **PASS/exit0**, unit-tests58.709초/secret-scan1.486초/dependency-audit1.829초, 단계별120초 상한. stdout는 이번 터미널 출력이며 gate 자체는 테스트 count를 반환하지 않는다. pnpm11.7.0/lock9.0 일치, global manifest11.22.0 경고 보존; 서명/TLS 우회 없음. 새 unit 조건 보완은 직접4개 검사로 별도 확인했다.

새 등록 경로를 사용하는 첫 실제 웹 CT 시험 `patient-vault-20261009T160523Z-9482a04802dc`는 **FAIL/exit1**: 등록·전용 SQL·Control readiness 성공 이후 로그인 전 `PATIENT_BROWSER_CDP_TIMEOUT_PAGE_ENABLE`, browser `patient-real-browser-9459bd122483`/15.579초, SQL harness33.788초. 두 번째 `patient-vault-20261009T160710Z-b503314c9ac7`도 같은 관측 timeout/FAIL/exit1, browser `aa237b2e5da6`/12.579초·SQL28.461초다. PACS/Vault 업무 호출은 없었다. SQL/브라우저/VM stage cleanup=true, 기존 A/B 보존 PASS. 권한 DENY나 암호화 실패로 해석하지 않는다. 독립 fresh Chrome154.0.8037.98 진단에서는 root CDP/REST 새 탭 양쪽의 Page.enable과 Runtime.evaluate가 응답해 원인을 확정하지 못했다. 검증기에는 Page.enable timeout 시 동일 탭 Page.getFrameTree만 확인한 뒤 원래 FAIL을 유지하는 진단을 추가했다. Chrome/TLS 정책이나 timeout을 늘려 PASS로 바꾸지 않았다.

최종 CT `patient-vault-20261009T161039Z-39b144448742`는 **wrapper7/SQL4/Chrome6 PASS/exit0**, SQL64.713초/browser46.210초, browser `patient-real-browser-c503357a0828/result.json`·`viewer.png` 직접 확인. 명시적 등록 preflight/apply/reapply-deny→실제 PHANTOM 웹 로그인/검사 선택→Grant/DPoP→A mTLS PACS→실제 Azure wrap/AES-GCM/B unwrap→두256×256 SOP decode→격리 SQL Grant 철회 후 거부/read2 불변→화면 제거/focus/storage0→persisted hash chain/release2 CONSUMED→생성 SQL/브라우저/VM stage cleanup과 기존 A/B 보존까지 확인했다. 일반 동의 철회 UI·공개 배포·native mobile·전체12 SOP 검증은 아니다. 최종 실행은 Page.enable timeout 없이 통과했으므로 신규 진단 분기의 응답/원인은 NOT VERIFIED이다. 이후 추가한 Series의 parent Study 비교는 별도 단위·실제 SQL로 검증하며, 이 브라우저 기록에 소급 포함하지 않는다. 최신 소스 MR/모바일 재검증은 남아 있다.

이전 후보 이미지 `a287821…`는 신규 등록 helper/CLI를 포함하지 않으므로 최신 배포 후보로 승계하지 않는다. 신규 증적 **DRAFT / UNASSIGNED**, ignored artifacts는 clone에 포함되지 않는다. **다음 작업 한 개: 새 등록 절차를 사용하는 웹·모바일의 실제 PACS/Vault 흐름을 끝내고 동일 소스의 후보 이미지·gate를 다시 고정한다.** 그 이후 최신 사람 검토/실제 cloud 적용·공개 정상/거부·rollback이 남으며 전체 공유 흐름/MVP/v3 미완료다.

### 최신 관측: 웹·모바일 통합 후보 검사 PASS / 실제 배포 준비 미완료 — 2026-10-10 (Asia/Seoul)

HEAD `55d49a454ee956849ce70abefbbff33af9f03cfd` + 현재 dirty source. `Dockerfile.patient-capstone`로 기존 `fedbae566527…` base에서 `--pull=false --network=none` 빌드/exit0. 의존성·lockfile 변경 없이 기존 runtime을 사용했고 base ID 전후 일치를 확인했다. 후보 `highpass-platform-mvp:capstone-patient-web-mobile-20261010`, 정확한 Docker image ID **`sha256:a287821b32b8a834429c7c2c645059394fe5ecdeed341bf2f77a8ae9d1c4ef56`**. BuildKit config digest `6b7f29…`와 image ID를 혼동하지 않는다. base ARG 기본값 없음 경고는 남지만 빌드는 명시적 base로 성공했다. 별도 소스/hash attestation을 이미지의 nonroot Node·network-none/read-only/cap-drop ALL로 실행해 tracked src/public/db/config/scripts **441개 일치/불일치0/exit0**, `artifacts/workstation/patient-web-mobile-image-source-20261010.json`. clinical payload 제외. 이후 추가한 host-only `patient-deployment-preflight.py`와 docs는 이 이미지에 포함되었다고 주장하지 않는다.

| 검사 | 최신 결과 | 증적 |
|---|---|---|
| Container Scan/Gate | HIGH0/CRITICAL0, scan 및 gate exit0/PASS; 정확한 image ID 일치 | `artifacts/security/container-scan/patient-web-mobile-20261010.json` |
| 실제 격리 Compose 시작 | 7 PASS/165.542초/exit0, cleanup=true | `artifacts/workstation/hp-patient-startup-46bf8dd856e6.json` |
| Security Gate | unit-tests/secret-scan/dependency-audit 모두 PASS/exit0; 단계별120초 상한 | `artifacts/workstation/patient-web-mobile-security-gate-20261010.json` |
| 선택 설정·준비 회귀 | 9/9 PASS/185.7244ms/exit0 | 이번 터미널 출력 |
| A/B 현재 런타임·Entra 신원 | 4 PASS/exit0; A2c7b366…/B940806… healthy 보존, 별도 A/B 인증 HTTP200 | `artifacts/workstation/patient-key-inventory-20261009T155013Z/result.json` |
| 클라우드 환자 배포 준비 | NOT VERIFIED/exit2, 기능 미활성·준비 객체/파일 부재 | `artifacts/workstation/patient-deployment-preflight-20261009T155238Z/result.json` |

Compose는 실제 readonly secret mount·DB preparation preflight/apply·재적용 거부·전용 LOGIN/Control entrypoint ready·잘못된 본문과 B 주체의 A wrap 거부·중복 secret 시작 거부·기존 격리 Control health를 확인했다. 자체 project/volume만 회수했고 남은 자체 container가 없음을 확인했다. 최초 `hp-patient-startup-f8e7fe571e48`은 postgres-and-bootstrap 단계 FAIL/134.946초/exit1, cleanup=true였고 원인은 NOT VERIFIED이다. Docker 검사 동시 실행을 멈춘 뒤 동일 시험의 순차 실행이 통과했지만 이것만으로 리소스 경합이나 daemon 결함을 확정하지 않는다. 과거 FAIL은 소급 변경하지 않는다.

Security Gate의 Node 단계 exit0/58.649초, secret 단계 exit0/1.068초, audit 단계 exit0/1.615초다. gate는 테스트 stdout/count를 보존하지 않으므로849개를 이번 gate의 직접 관측 수라고 주장하지 않는다(직전 전체 Node849/849는 아래 기록). 실제 실행 pnpm11.7.0/lockfile9.0 일치 PASS, global manifest11.22.0 차이 경고 유지; signature/TLS 검증 우회나 lockfile 재생성 없음. 새 Python 문법·secret findings0·diff PASS.

새 read-only `scripts/patient-deployment-preflight.py`는 고정 cloud host key와 기존 Control/ingress a548790…/PostgreSQL8d0e686…·healthy·Compose context를 확인했다. VM 안에서 whitelist flag boolean만 반환하고 전체 env/secret 값은 출력하지 않는다. root-owned regular-file lstat만 확인하며 값은 읽지 않는다. SQL은 `BEGIN READ ONLY`/5초 statement 제한으로 역할/관계 존재 metadata만 조회했다. **patient grants/release/single-writer flags=false, authority table4개·전용 role 없음, patient secret3개가 보호된 regular file로 확인되지 않음**이다. 기존 배포를 변경하지 않았다. 소유 ref 내용·실제 mount·권한 세부·public E2E readiness는 NOT VERIFIED. 스크립트 자체는 모든 metadata가 있어도 전체 배포 준비 PASS를 내리지 않는다.

Azure Validate 스킬은 승인된 `.azure/deployment-plan.md`를 선행 요구하지만 이 프로젝트는 기존 VM/Compose 방식이며 해당 파일/azure.yaml 기반 azd 체계가 없다. azure-prepare의 azd 전용 적용 범위와 맞지 않아 새 IaC/승인 체계를 도입하지 않고 기존 도구로 위 검사만 수행했다. **스킬 workflow의 Validated 상태는 선언하지 않는다.** Azure 비용·리소스·역할·구독 설정 변경 없음.

신규 증적 **DRAFT / UNASSIGNED**. 이번 image/Compose 검사는 앞선 host 브라우저 CT/MR 결과와 서로 다른 실행 환경이며 image 내부 public browser 종단 검증으로 합산하지 않는다. 전체 MVP/v3 미완료, 독립 검토 승인 승계 없음. 관련 FR-006~013/014~041. 이번 작업은 미커밋/미배포이며 기존 코드·DB·PACS·volume 보존.

**다음 작업 한 개: 실제 cloud 환자 준비의 rollback-only preflight와 명시적 합성 계정/소유 ref 등록을 동일 흐름의 배포 준비 작업으로 연결한다.** 준비가 끝나도 최신 증적 사람 검토 전 활성화하지 않으며, 실제 공개 환경 정상/음성·rollback 및 전체 환자 동의→수신 의료진 공유 흐름은 남아 있다. SSH relay 종료 reset 경고의 원인 분류도 미완료다.

### 최신 관측: 모바일 전체 PWA CT·MR 본인 열람·Grant 거부 검증 — 2026-10-10 (Asia/Seoul)

HEAD `55d49a454ee956849ce70abefbbff33af9f03cfd` + 현재 미커밋 변경. `--phantom CT|MR --browser --full-app --mobile` 모드를 기존 격리 verifier에 추가했다. 실제 `/mobile/`·375px Chrome viewport → PHANTOM 서명 Mock IdP 로그인 → 서버 확인 PIN 화면 체험(실제 PIN/생체/TEE 아님) → 서버 검사 목록·영상 탭·정확한 Study 선택 → 공통 Viewer의 Grant/DPoP·A mTLS QIDO → A 실제 Azure wrap/AES-GCM/B unwrap → 실제256×256 두 SOP decode → 격리 SQL Grant 철회 후 거부·PACS read2 유지 → 영상 제거/focus 복귀·localStorage/sessionStorage0을 검증했다. 실제 full Control API 및 최소권한 SQL을 사용했으며 raw DEK·개인키를 브라우저나 증적에 반환하지 않았다. 브라우저 스킬의 fresh DOM/실제 pointer 입력 원칙을 유지했다.

| 실행 | 결과 | 증적 |
|---|---|---|
| 모바일 CT | wrapper7/SQL harness4/Chrome6 PASS, exit0; SQL29.360초/browser14.400초 | `artifacts/workstation/patient-vault-20261009T153745Z-2b032e691355/result.json`; browser `patient-real-browser-49321341b6a4/result.json`·`viewer.png` |
| 모바일 MR | wrapper7/SQL harness4/Chrome6 PASS, exit0; SQL35.448초/browser19.588초 | `artifacts/workstation/patient-vault-20261009T154024Z-404ac13c0221/result.json`; browser `patient-real-browser-676f91e0e790/result.json`·`viewer.png` |

각 실행은 DB 재로드 후 기존 감사 hash chain·철회된 Grant의 release2 CONSUMED·PACS read2 유지 PASS, SQL/Chrome/VM stage cleanup=true, 기존 A/B healthy·이미지 유지. CT/MR screenshot을 직접 확인했다. 두 영상은 목록의 서로 다른 SOP이지 해부학적 인접·전체12개 pixel 검증이 아니다. Grant 철회는 시험용 SQL 조작이며 환자 화면의 동의 철회/만료 완료로 주장하지 않는다. native Android/iOS·실제 PIN/생체·Secure Vault offline·카메라 QR·public 배포 ingress·전체 MVP/v3는 미검증/미완료다.

실패는 보존한다: 모바일 CT `…T153622Z-5f7112f674f3`/browser`ee617f1c66a6` 및 MR `…T153855Z-b19594724930`/browser`1ffa966a7097`은 로그인 전 CDP timeout/전체 FAIL, cleanup=true. MR에서는 `PAGE_NAVIGATE` 관측 timeout을 식별했다. 명령 응답 timeout 이후 같은 tab의 정확한 URL와 실제 로그인 DOM를20초 안에 재확인하고 navigation 재발행·TLS 완화 없이 계속 관측하도록 보완했다. 최종 MR은 timeout 없이 정상 종료됐으므로 이 recovery 분기의 실제 성공은 NOT VERIFIED다. MR 종료 중 relay thread WinError10054 연결 reset 경고2개가 관측됐다. 업무 HTTP/crypto 결과와 자산 정리는 PASS였지만 경고의 정확한 원인/시점 분류는 NOT VERIFIED로 남기며 숨기지 않는다.

전체 Node **849/849 PASS/59.2903219초/exit0**, `artifacts/workstation/patient-mobile-full-app-node-regression-20261010.log`는 mobile mode 추가 기준이며 이후 CDP 진단·동일 tab 관측 변경은 문법 및 최종 MR 실제 실행 범위로 확인했다. focused6/6 PASS/224.5932ms/exit0, Node/Python 문법·secret findings0·diff PASS. 잘못된 `--mobile` 단독 요청은 CLI exit2로 시작 전 거부했다. 관련 FR-006~013/014~041. 신규 증적 **DRAFT / UNASSIGNED**, ignored artifact는 Git clone에 포함되지 않는다. 배포·커밋·푸시는 이번 작업에서 수행하지 않았다.

**다음 작업 한 개: 이 웹·모바일 소스를 포함하는 통합 후보 이미지의 source hash·보안 검사와 기존 공개 배포의 읽기 전용 준비 점검을 수행한다.** relay 경고 분류, 배포 DB 계정/소유 ref 준비, 최신 독립 검토가 남아 있으므로 아직 기능 활성화부터 하지 않는다. 실제 public 환경의 정상·음성·rollback 검증 및 원래 공유/동의 핵심 흐름 전체 완료도 남아 있다. 아래 관측은 이전 이력이다.

### 최신 관측: 환자 웹 CT·MR 종단 정상·Grant 철회 거부 — 2026-10-10 (Asia/Seoul)

기준 HEAD `55d49a454ee956849ce70abefbbff33af9f03cfd` + Viewer focus 복귀·검증기 종료 판정 변경. UI/UX Pro Max 스킬의 기본 keyboard/focus 지침을 적용했다(검색은 core 모듈 누락으로2회 실패). 주기적인 검사 목록 DOM 교체 이후에도 동일 container·동일 Study의 표시되고 활성화된 launcher만 찾아 focus를 복귀한다. 다른 Study/숨김/disabled/inert 버튼을 선택하지 않는다. 환자 권한·암호화·TLS 정책은 변경하지 않았다.

`python scripts/patient-vault-integration-ops.py --phantom CT --browser --full-app` 최종 **wrapper7 PASS / full Control SQL harness4 PASS / Chrome6 PASS / exit0**, `artifacts/workstation/patient-vault-20261009T152938Z-daf4f4702c39/result.json`. SQL harness55.245초, browser39.372초(`patient-real-browser-467027e8b54f/result.json`·`viewer.png`). 실제 환자 웹의 Mock IdP PHANTOM 로그인 → 서버 검사 목록 → CT 선택 → 본인 Grant/DPoP → A 합성 PACS mTLS → 실제 Azure wrap/AES-GCM/B unwrap → 서로 다른256×256 SOP2개 decode·다음 영상 → 격리 SQL Grant REVOKED 후 신규 fetch 거부·A PACS read2 유지 → 닫기/영상 제거/focus 복귀·browser storage0을 확인했다. 재로드한 SQL의 기존 audit hash chain·해당 Grant release2개 CONSUMED 검증도 PASS. 원본 합성 PACS는 A, 시험 SQL은 독립 tmpfs, 클라우드 원본 지속 저장 없음. A/B 기존 이미지와 healthy 상태 보존, 생성 SQL·브라우저·VM stage cleanup=true. CT 캡처를 직접 확인했다.

실패 이력은 유지한다. `…T152626Z-7b6b1dbd4d86`은 Chrome6 PASS 후 자식 process의 signal 종료를 exitCode만으로 관측해 final-audit timeout/전체 FAIL이었다. exitCode 또는 signalCode의 terminal 상태를 확인하도록 수정했다. `…T152823Z-e858460a7e9a`는 로그인 전 CDP timeout/전체 FAIL로, TLS/권한 DENY로 분류하지 않는다. 두 실행 모두 정확한 생성 자산 cleanup=true이며 최종 PASS로 소급 변경하지 않는다. 신규 focused test 최초5/6 FAIL은 fake DOM fixture options가 덮어써진 시험 오류였으며 수정 후6/6 PASS/182.6858ms/exit0.

전체 Node **849/849 PASS / 60.4504575초 / exit0**, `artifacts/workstation/patient-focus-node-regression-20261010.log`는 focus 변경 기준 실행이다. 이후 검증기 signal 종료 판정은 문법 및 최종 CT 실제 실행으로 확인했다. Secret patterns findings0/diff PASS. 관련 FR-006~013/014~041. 신규 증적 **DRAFT / UNASSIGNED**, ignored artifact는 clone에 포함되지 않는다. 공개 배포 public ingress·모바일 전체 앱·환자 화면의 동의 철회/만료·전체12 SOP pixel·전체 MVP/v3 완료 증거가 아니다. Grant 상태 변경은 격리 SQL 시험 조작이며 UI 동의 철회 완료로 주장하지 않는다.

MR도 동일 전체 웹 경로를 실행했다. 최초 `…T153112Z-304bf90317e4` / browser `0fe07ea75a12`은 로그인·검사 목록 이후 timeout/전체 FAIL: 캡처에서 MR launcher가 viewport 밖에 있었고 VM metadata/pixel 호출은 발생하지 않았다. 자동화 도구가 대상 버튼을 instant scrollIntoView 후 새 DOM/좌표를 읽어 실제 마우스 클릭하도록 수정했다. 정책 거부나 제품 Viewer 실패로 단정하지 않는다. 최종 MR `artifacts/workstation/patient-vault-20261009T153258Z-2adc9a030eca/result.json` **wrapper7 PASS / SQL harness4 PASS / Chrome6 PASS / exit0**, SQL65.662초/browser47.491초(`patient-real-browser-43ff1d0a4a46/result.json`·`viewer.png`). 서로 다른 두256×256 MR SOP 표시, SQL Grant 철회 후 read2 유지, focus 복귀/storage0, SQL hash chain/release2 CONSUMED, 모든 생성 자산 cleanup=true·원래 A/B 보존을 확인했다. MR 캡처도 직접 확인했다. 두 목록 항목은 해부학적 인접 슬라이스라는 의미가 아니다.

wrapper의 scope 설명도 `--full-app`/공통 launcher 시험을 구분하도록 보완했다. 최종 MR은 새 설명 기준이며 앞선 CT 원문 wrapper의 보수적인 'not full app' 설명은 당시 기록으로 보존하고 nested browser/SQL scope에서 실제 시험 범위를 확인한다. 검증기 수정의 Node/Python 문법·focused6/6 PASS/220.7326ms/exit0·secret findings0/diff PASS; 전체 Node849 결과 이후 검증기 변경은 최종 실제 CT/MR 및 문법 검증 범위이다. 이번 소스 변경은 미커밋/미배포이다.

**다음 작업 한 개: 모바일 전체 앱의 로그인·검사 선택·Viewer 정상/거부를 동일 격리 실제 PACS/Vault 흐름에 연결한다.** 공개 배포 활성화/rollback과 최종 독립 검토는 그 뒤에 남는다. 아래 FAIL 및 과거 다음 작업은 각각 당시 이력이다.

### 최신 체크포인트: 실제 환자 웹 종단 검증은 FAIL — 2026-10-10 (Asia/Seoul)

커밋·푸시 요청에 따라 현재 검증 도구를 저장한다. 기준은 `c13c903c94a33a2822d4ac90b419ab93acfa048b` 이후 변경이며 공개 배포는 변경하지 않았다. `--phantom CT --browser --full-app`은 별도 tmpfs PostgreSQL·최소권한 LOGIN·실제 Control entrypoint·Mock IdP 환자 로그인·검사 선택·기존 환자 웹·공통 Viewer를 사용했다. 로컬 신뢰 HTTPS 및 VM-local 합성 PACS/Azure 경로이며 실제 배포 public ingress나 모바일 전체 앱 시험은 아니다.

실행 `artifacts/workstation/patient-vault-20261009T151840Z-5a0659305a01/result.json`은 **전체 FAIL / exit1**이다. 브라우저 `patient-real-browser-4a0cb65f4f60/result.json`에서 TLS 검증, 실제 환자 웹 로그인·서버 검사 목록, 서로 다른 두256×256 SOP decode, 격리 SQL Grant 철회 후 거부·PACS 추가 읽기 없음까지 확인했으나 닫기 후 launcher focus 복귀 assertion에서 실패했다. 주기적인 목록 DOM 교체와 관련된 것으로 추정하며 수정 효과는 아직 미검증이다. 마지막 SQL 감사 검증 단계는 미실행이다. 브라우저50.048초/SQL harness72.857초, 각각 cleanup=true; VM 원래 서비스와 source staging 정리 확인. 이전 syntax 실패 실행 `…T151714Z-a9f45185b15d`도 삭제하거나 PASS로 바꾸지 않는다.

해당 코드 기준 전체 Node **848/848 PASS / 55.8662834초 / exit0**, `artifacts/workstation/patient-full-app-node-regression-20261010.log`는 기존 실행 결과이며 이번 커밋 작업에서 다시 실행한 결과가 아니다. 실행 artifact는 ignored 로컬 자료로 커밋하지 않는다. 신규 증적은 **DRAFT / UNASSIGNED**이며 전체 MVP/v3 미완료. 관련 FR-006~013/014~041.

**다음 작업 한 개: 실제 환자 웹에서 Viewer 닫기 후 focus 복귀 실패를 최소 수정하고 동일 CT 종단 시험을 재실행한다.** MR 전체 웹·모바일·공개 배포 활성화/rollback·최종 사람 검토는 남아 있다. 아래의 공통 Viewer PASS는 자체 launcher 범위의 이전 성공이며 이번 전체 앱 FAIL을 대체하지 않는다.

### 최신 관측: 실제 PACS·Vault·SQL·Chrome 공통 Viewer 연결 — 2026-10-10 (Asia/Seoul)

기준 HEAD `c13c903c94a33a2822d4ac90b419ab93acfa048b` + 이번 미커밋 검증 도구 변경. 기존 공개 배포 이미지는 유지했다. A `2c7b366483f1…`, B `940806f602ec…` healthy 및 원래 이미지 보존을 각 실행 후 확인했다. 원본 영상은 A 합성 PACS, 시험 권한·Grant·release·감사는 별도 tmpfs SQL, Azure wrap/unwrap은 기존 VM-local A/B 신원이다. PostgreSQL 스킬의 최소권한·bound query·기존 감사 chain을 유지했다.

`patient-vault-integration-ops.py --phantom CT|MR --browser`로 현재 공통 `patient-pixel-viewer.js`를 실제 Chrome에 로드했다. 개발 CA/hostname 검증을 유지한 로컬 HTTPS → signed PATIENT 시험 인증·신뢰 ingress 서명 → SQL 본인 Grant/DPoP → A 실제 mTLS QIDO12 SOP → 선택 WADO pixel → actual Azure wrap/AES-GCM → B actual unwrap/release consume → 브라우저 256×256 decode·다음 영상까지 연결했다. UI 시험 화면의 launcher는 격리 adapter이며 **환자 포털/모바일 전체 앱의 로그인·메뉴 상호작용을 대체하지 않는다**. 임의 픽셀 응답으로 정상 표시하지 않는다. 선택한 두 목록 항목은 서로 다른 실제 SOP이며, 정렬·해부학적으로 인접한 슬라이스 또는12개 전체 pixel 검증으로 주장하지 않는다.

| 실행 | 최신 결과 | 증적 |
|---|---|---|
| CT | wrapper7 PASS / SQL19 PASS, 32.115초 / Chrome5 PASS, 15.547초 / exit0 | `artifacts/workstation/patient-vault-20261009T150724Z-6ee23a7fc25d/result.json`, browser `patient-real-browser-00ed0068a506/result.json`·`viewer.png` |
| MR | wrapper7 PASS / SQL19 PASS, 40.377초 / Chrome5 PASS, 17.174초 / exit0 | `artifacts/workstation/patient-vault-20261009T150852Z-bc5ce3db3f0a/result.json`, browser `patient-real-browser-80703b9fad84/result.json`·`viewer.png` |

각 실행 grants5/audits75/proofs10, 브라우저 Grant의 release2개 CONSUMED·그 Grant REVOKED 확인, SQL hash chain PASS. 브라우저 재조회403 후 실제 A PACS rendered read는4 유지(앞선 API2 + 브라우저2), 닫기 후 이미지 제거·focus 복귀·storage0 확인. Grant 철회는 **격리 시험 DB에서의 명시적 상태 변경**이며 환자 화면의 동의 철회 버튼/업무 API 검증으로 승계하지 않는다. SQL·Chrome·remote stage cleanup=true, 기존 VM 서비스/DB/volume 변경 없음. raw DEK·identity 개인키는 VM 밖에 반환하지 않았으며 원문 토큰은 증적에 기록하지 않았다.

실패 이력도 유지한다. 최초 로컬 RSA/CT 시도의 Docker 동기 호출15초 timeout은 이후 생성 자산 확인과 구분했다. 시작/정리를 비동기·30초 제한으로 바꾸고, 정확한 자체 이름·라벨·AutoRemove·비영구 mount 확인 후 회수 및 제거 완료 polling을 추가했다. 원인을 Docker Engine 결함으로 확정하지 않는다. `…T150449Z-72d71fe3d4da` 실행은 첫 브라우저 pixel 후 다음 SOP가 시험용1·2 whitelist 밖이어서 전체 FAIL; worker를 고정 합성 Series의12 SOP 범위로 정렬했다. 서버 권한/Study/Series/receipt 검증을 완화하지 않았다. 해당 실행의 cleanup=false는 당시 기록이며 이후 컨테이너 부재 확인으로 소급 PASS 처리하지 않는다. 잔여로 확인된 시험용 컨테이너3개(실행 중2·Created1)는 이름/라벨/생성시각을 확인해 삭제했고 tmpfs 이외 기존 데이터는 삭제하지 않았다.

최종 전체 Node **848/848 PASS / 43.9685922초 / exit0**, `artifacts/workstation/patient-browser-pacs-node-regression-final-20261010.log`. 앞선 중간 회귀도848 PASS/50.3917379초이나 최종 결과와 구분한다. Node/Python 문법·secret 패턴 findings0·diff PASS. 관련 FR-006~013/014~031/032~041. 증적은 ignored 로컬 자료라 clone에 포함되지 않는다. 신규 증적 **DRAFT / UNASSIGNED**, 전체 MVP/v3 미완료.

**다음 작업 한 개: 검증된 공통 Viewer를 실제 환자 포털·모바일 전체 앱의 로그인/검사 선택과 연결한 동일 격리 환경을 검증하고, 그 결과를 바탕으로 발표 배포 활성화·rollback을 준비한다.** 실 배포용 소유 ref/계정 등록, public ingress/A/B 활성화, patient UI 동의 철회·만료, 최종 독립 검토는 아직 미완료다. 아래 관측은 과거 이력이다.

### 커밋·푸시 체크포인트 — 2026-10-09

사용자의 커밋·푸시 지시에 따라 환자 Viewer·DB 준비 도구·Compose overlay·검증 스크립트·테스트·문서를 기록한다. 이번 선택 회귀26/26 PASS, exit0, 765.2852ms 및 secret 패턴 검사 findings0, diff 검사 PASS. 전체848/848은 아래의 이전 실행 결과이며 이번에 재실행한 결과가 아니다. VM 설정·배경 이미지·secret·인증서·영상 payload·실행 artifact는 제외한다. 커밋·푸시는 배포나 전체 MVP 완료를 의미하지 않는다.

보존된 실제 Chrome 검증 결과 `artifacts/workstation/patient-pixel-browser-1704528fdb99/result.json`: 11항목 PASS, 9.964초, cleanup=true, browserStopConfirmed=true. 신뢰된 로컬 HTTPS에서 2×2 PNG 두 영상의 실제 decode/다음 영상·닫기/Escape·거부/범위 불일치/손상/만료·늦은 응답 차단·브라우저 storage 미사용을 확인했다. 종료된 자체 Chrome의 exit1은 강제 종료 확인 결과이며 스크립트 PASS와 구분한다. ERR_ABORTED2건은 중단된 요청 기록이지 정책 DENY 증거가 아니다. 기존 실패 기록은 보존한다. 최초 실패의 임시 프로필 잔여 디렉터리와 fixture HTML의 UTF-8 표시 보완은 남아 있다.

이 브라우저 시험은 합성 protocol fixture이며 실제 PACS·Azure·SQL authority·환자 웹/모바일 전체 앱·현재 배포의 종단 성공이 아니다. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료. **다음 작업 한 개: 동일 공통 Viewer를 실제 PACS/Vault와 격리 SQL 사용자 흐름에 연결해 브라우저 정상·거부를 검증한다.** 아래의 미커밋/다음 작업 표현은 각 관측 당시 이력이다.

### 환자 웹·모바일 실제 pixel 경로 연결 구현 — 2026-10-09

`public/patient-pixel-viewer.js`에 공통 환자 전용 Viewer를 구현하고 웹 `openPatientStudyViewer`·모바일 `openCineViewer`에서 연결했다. 현재 검사 목록의 첫 Series 하나만 선택해 signed PATIENT 인증·메모리 P-256 DPoP로 `self-view-grants` 발급 → 정확한 Study/Series/SOP 목록 검증 → 선택 SOP의 `/patient-dicomweb/.../rendered`를 lazy fetch한다. B의 기존 환자 전용 Azure decrypt 경로를 사용하도록 요청하며 브라우저는 provider key/DEK를 받지 않는다. 서버 Grant lifetime≤300초와 절대 만료 확인, 새 proof jti/ath, no-store/no-referrer·유한 요청/decode timeout, 닫기/실패/만료 시 object URL 해제·영상 제거, 다운로드 버튼 없음. 실제 PNG/JPEG decode 전에는 성공 표시하지 않는다. 요청 거부 시 예시 canvas/의료진 token으로 대체하지 않는다. 기존 illustrative controller는 역사적 코드로만 보존했고 새 열람 entrypoint에서는 호출하지 않는다.

PWA shell-v5는 공통 JS만 public allowlist에 추가했고 API·환자 DICOMweb·Authorization 요청의 Cache Storage 우회는 유지했다. UI/UX Pro Max 스킬의 로딩·상태 문구·native dialog/Escape·focus 복귀·버튼 비활성 지침을 적용했다. 스킬 검색은 `core` 누락으로2회 실패했으므로 검색 결과를 적용했다고 주장하지 않는다. 기존 디자인을 전면 재설계하지 않았다.

신규 모델5/5 PASS/197.7273ms, 선택21/21 PASS/973.2457ms/exit0. 테스트는 mock HTTP/3바이트 blob·Node WebCrypto·entrypoint delegation 기준이며 실제 PNG decode/브라우저/DB/Key Vault의 정상 pixel 표시 증거는 아니다. 최초 전체 Node **845/847, 2 FAIL, 42.0676195초/exit1** (`patient-pixel-ui-node-regression-20261009.log`)을 보존했다: 이전 VM 테스트에 새 `capstoneAuth` 의존성이 없고, 모바일 테스트가 단일 예시 프레임 상태를 기대했다. 새 인증 거부→Viewer 미시작 및 signed context delegation을 검증하도록 갱신했다. 최종 전체 Node **848/848 PASS/42.4650079초/exit0** (`patient-pixel-ui-node-regression-final-20261009.log`), secret findings0·문법/diff PASS.

이번 변경은 미배포/미커밋이며 기존 `fedbae566…` 이미지에는 새 UI가 없다. 실제 합성 환자 authority/ref 등록·patient ingress/A/B 활성화·실제 CT/MRI pixel/다음 slice 브라우저 검증·만료/철회 UI·최종 독립 검토는 아직 남아 있다. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료. 관련 FR-006~013/021~025/026~036/037~041.

**다음 작업 한 개: 실제 브라우저에서 이 공통 Viewer의 정상·거부·만료·닫기/late response를 격리 HTTPS 환경으로 검증하고, 동일 코드를 실제 PACS/Vault 흐름에 연결.** 모델 PASS를 브라우저 종단 PASS로 승계하지 않는다.

### 실제 secret mount·Control entrypoint 격리 종단 시작 — 2026-10-09

`scripts/verify-patient-compose-startup.js`를 구현하고 실행했다. 별도 무작위 Compose project·volume·임시 독립 secret 파일만 생성, base/preparation/patient overlay를 실제 Docker Compose로 조합했다. 기존 Control 파일 mount/start → stop → preparation preflight/apply → 재적용 거부 → 환자 Control 전체 entrypoint/전용 DB LOGIN/health ready → A 정상 주체의 잘못된 본문400/B 주체의 A wrap 호출403 → 중복 A/B secret 시작 거부 → 기존 격리 Control health200을 확인했다. **7항목 PASS/193.687초/exit0**, artifact `artifacts/workstation/hp-patient-startup-3b15db4ee33b.json`, cleanup=true. Docker label 및 volume project prefix 확인 후 생성한 자산만 제거했고 secret 파일도 개별 삭제했다. 각 Docker/Compose 명령60초, Compose wait45초, HTTP3~5초 제한; command timeout을 정책 DENY로 판정하지 않는다.

후보 `highpass-platform-mvp:capstone-patient-startup-20261009` / `sha256:fedbae566527f479bda3498114a45b7878b5019c490959347d90e33f2752ec28`, 기존 a548 base ID 전후 일치·network-none build exit0. preparation helper/entrypoint/Control entrypoint/secret loader4개 source SHA 일치 PASS. Trivy HIGH0/CRITICAL0·Container Gate PASS/exit0 (`artifacts/security/container-scan/patient-startup-20261009.json`, 2026-10-09T14:24:23Z). 이미지는 preparation/runtime 코드 기준이며 이후 추가한 host verifier·문서 자체를 포함한다고 주장하지 않는다. 실행 후 verifier의 secret cleanup 실패 표시를 보강했고, 이 미실행 실패 분기는 문법 검증 범위로만 남긴다.

선택10/10 PASS/192.117ms/exit0, secret findings0·문법/diff PASS. 이번에는 전체 Node를 다시 실행하지 않았고 이전843/843 결과는 당시 회귀로 유지한다. 이번 실제 시작은 격리 Compose·실제 파일·SQL·Control 기준이지만 **public TLS·실제 Azure·환자/ref 등록·환자 브라우저 정상 열람·실제 배포 DB·rollback** 증거가 아니다. 발표용 A/B/Cloud 서비스는 변경하지 않았다. 신규 증적 DRAFT / UNASSIGNED, 변경 미커밋, 전체 MVP/v3 미완료.

**다음 작업 한 개: 환자 웹/모바일의 기존 예시 canvas를 승인된 본인 Grant→암호화 Gateway→실제 CT/MRI Viewer 경로로 연결하고 같은 UI에서 정상·거부 검증.** 실제 배포 활성화 전에는 소유 ref의 명시적 등록과 최신 증적 독립 검토를 유지한다.

### 환자 DB 준비 도구와 동일 전용 LOGIN 검증 — 2026-10-09

`prepare-capstone-patient-database.js`와 공유 preparation helper, operator-only `capstone-patient-preparation.compose.yml`을 구현했다. 기본 rollback-only preflight, 명시적 `--apply`에서만 migration033~036·`hipass_patient_authority` LOGIN/최소권한 생성. 고정 객체명·bound password format·transaction advisory lock·lock2초/statement5초, 기존 계정/부분 객체는 수정하지 않고 중단한다. admin 파일은 준비 컨테이너에만 readonly mount하며 Control에는 추가하지 않는다. 환자/소유 ref 자동 seed·실제 DB 실행·배포는 없음. PostgreSQL 최소권한 스킬에 따라 선택된 column/table 권한만 부여한다.

실제 격리 PostgreSQL verifier가 이제 이 preparation helper를 사용한다. preflight 무변경 → migration 두번째 단계의 의도된 실패/rollback → fresh 적용 → 다른 password 재적용 거부/기존 상태 보존 → **바로 이 전용 LOGIN으로 runtime 시작·metadata UPDATE/superuser 거부·복구**를 검증했다. `node scripts/verify-patient-self-view-postgres.js`: **17항목 PASS/12.390초/exit0**, grants4/audits53/proofs5·cleanup=true. 실제 파일 mount·전체 Control entrypoint·배포 DB·public TLS·브라우저 성공 증거는 아직 아니다. 암호화 LOCAL_RSA_FIXTURE / ONE_PIXEL_PNG_FIXTURE.

선택5/5 PASS/151.7233ms, preparation profile Compose JSON 검사(default preflight/admin 미전달/비공개 네트워크/readonly) PASS/exit0. 전체 Node **843/843 PASS/42.0272789초/exit0**, `artifacts/workstation/patient-preparation-node-regression-20261009.log`; Secret findings0·문법/diff PASS. 새 scripts는 기존 `6953a827…` image에 없으므로 재빌드 전 준비 container를 실행하면 안 된다. 변경 미커밋, 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료.

**다음 작업 한 개: 새 소스 이미지와 실제 readonly secret mount로 격리 Compose의 preparation→Control 시작을 검증하고 환자 Viewer 연결을 진행.** 실제 활성화·rollback·합성 계정/ref 등록·브라우저 정상/거부·독립 검토는 남아 있다.

### 환자 배포 overlay 및 격리 시작 재검증 — 2026-10-09

명시적 `infra/azure/capstone-control-patient.compose.yml`을 추가하고 `.env.example`에 외부 secret 파일 경로를 명시했다. 기존 base Compose 기본 비활성 유지, 환자 전용 LOGIN 이름·독립3개 readonly 파일·versioned Vault key 설정이며 Control에 Vault identity/DB admin key/새 공개 포트를 넣지 않는다. PostgreSQL 최소권한 스킬을 적용했으며 실제 운영 DB/권한/환자 ref는 수정하지 않았다.

선택6/6 PASS/224.917ms/exit0. 실제 `docker compose config --format json`에서3개 readonly mount·Control/DB 무공개 포트·필수 key 누락 거부 PASS/exit0; 합성 URL과 validation-only 경로를 사용했고 서비스 시작 없음. `node scripts/verify-patient-self-view-postgres.js` **16항목 PASS/17.788초/exit0**, grants4/audits53/proofs5·cleanup=true. 실제 격리 SQL의 최소권한 LOGIN runtime, metadata UPDATE/superuser 시작 거부 및 복구 포함. 이 결과는 기존 verifier의 localhost 전용 LOGIN 기준으로, 새 overlay의 `hipass_patient_authority` 계정/파일 mount를 사용한 실제 서비스 시작 검증은 아니다. 암호화 LOCAL_RSA_FIXTURE / ONE_PIXEL_PNG_FIXTURE, public TLS/Azure/브라우저 증거로 승계하지 않는다.

전체 Node **839/839 PASS/42.1160627초/exit0**, `artifacts/workstation/patient-compose-node-regression-20261009.log`. Secret findings0/diff 검사 PASS. 앞선 후보 `6953a827…`의 런타임 JS는 그대로지만 이번 overlay·env example·test·문서는 이미지 빌드 이후 추가이며 포장 완료 주장과 구분한다. 변경 미커밋, 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료.

**다음 작업 한 개: migration033~036·전용 LOGIN 최소권한의 명시적 배포 준비 도구와 격리 파일-mount 시작 검증.** 자동 계정/소유 ref seed와 실제 활성화는 아직 없으며, 신규 증적 독립 검토 및 실제 배포·rollback·환자 Viewer 종단검증이 남아 있다.

### 최신 커밋 소스 후보 이미지 검사 — 2026-10-09

소스 HEAD `30de0b39701fd4088d6a1bc740f8bd6e64b7879d` 기준 후보 `highpass-platform-mvp:capstone-patient-config-30de0b3` / `sha256:6953a8273f67d63cf4cf143fe04ec638827cbf54b3c371a51aa2cf7f5ad4f76f`를 빌드했다. 기존 base `a5487906…` 태그의 빌드 전후 ID 일치, `--pull=false --network=none`, 120초 상한, exit0. 최초 bare image ID FROM 시도는 레지스트리 이름으로 해석돼 exit1이었으며 성공으로 기록하지 않는다.

환자 런타임 설정·entrypoint·암호화·인가·Grant runtime·release·worker·SQL verifier·모바일 JS·migration036의 **선택10개 파일 local/image SHA 일치 PASS/exit0**. 최초 검증은 잘못 지정한 migration 파일명으로 exit1, 다음은 distroless PATH에 `node`가 없어 exit127이었다. 실제 이미지 entrypoint `/nodejs/bin/node` 확인 후 network-none/read-only/cap-drop/no-new-privileges 컨테이너에서 성공했다. 전체 파일 트리 일치 또는 실제 서비스 시작 증거는 아니다.

고정 Trivy 0.58.2 digest로 정확한 후보 이미지 스캔 **HIGH0/CRITICAL0, Container Gate PASS/exit0**, 증적 `artifacts/security/container-scan/patient-config-30de0b3.json` (2026-10-09T14:09:25Z). 이전 후보 `3fdee566…`는 이력으로만 유지한다. 이미지 빌드·검사만 수행했으며 A/B/Cloud 서비스·DB·volume·환자 런타임 활성화는 변경하지 않았다. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료.

**다음 작업 한 개: 전용 환자 DB 계정·migration·외부 secret mount의 기존 배포 계약 정렬 및 시작 검증.** 실제 환자 브라우저 Viewer 연결과 정상·거부 종단검증은 그 뒤에 같은 흐름으로 완료해야 한다.

### 최신 커밋 전 회귀 및 런타임 설정 — 2026-10-09

환자 런타임은 기본 비활성을 유지한다. 활성화 시 전용 `hipass_patient_authority` DB 연결과 외부 파일의 환자 A/B 서비스 자격증명을 읽으며, 기존 의료진·DB·발표 키 재사용과 잘못된 프로필은 시작 전에 거부한다. 실제 배포 DB 계정 생성·migration·서비스 활성화는 수행하지 않았다.

`node --test --test-concurrency=4 --test-reporter=spec --test-reporter-destination=artifacts/workstation/patient-config-node-regression-20261009.log`: **838/838 PASS, 41.9254432초, exit0**. Secret 패턴 검사 findings0 및 staged diff 검사 exit0. 증적은 로컬 ignored artifact이며 clone에 포함되지 않는다. 아래 `3fdee566…` 후보 이미지는 이 런타임 설정 추가 이전 빌드이므로 최신 소스 이미지로 승계하지 않는다. 신규 증적 DRAFT / UNASSIGNED.

사용자의 커밋·푸시 지시에 따라 소스·테스트·문서를 기록한다. VM 설정·배경 이미지·인증정보·영상 payload·실행 artifact는 이번 커밋에서 제외한다. **다음 작업: 최신 소스 후보 재빌드·검사 후 전용 계정/내부 자격증명 배포 준비와 환자 웹·모바일 실제 Viewer 연결.** 실제 배포 환자 브라우저 종단 검증과 전체 MVP/v3는 미완료다.

### 최신 실제 합성 CT/MRI 환자 암호화 전달 — 2026-10-09

실행 명령 `patient-vault-integration-ops.py --phantom CT`와 `--phantom MR` 각각 exit0. 격리 SQL의 Study/Series/owner ref를 실제 합성 PHANTOM UID에 바인딩했으며 실행 Cloud DB/환자 매핑을 수정하지 않았다. A VM은 현재 Docker private PACS proxy 주소를 inspect로 확인하고 기존 CA·gateway client cert/key·고정 servername을 유지해 QIDO/WADO를 mTLS로 조회했다. 개인키/DEK는 각 VM에 유지, A에서 실제 pixel 암호화 후 B에서 실제 Azure unwrap·AES-GCM 복호화. QIDO의 정확한12 SOP 목록, 첫째·둘째 SOP의256×256 및 서로 다른 pixel 확인. 12장 전체 pixel/브라우저는 시험하지 않았다.

CT: SQL17항목 PASS/22.163초, `artifacts/workstation/patient-vault-20261009T135220Z-faa981f36441/result.json`. MR: SQL17항목 PASS/28.106초, `…T135356Z-cf2d98b82bf3/result.json`. 각각 grants4/audits59/proofs6, hash chain/cleanup PASS. 재사용 B authorize403, 변조·DPoP 재사용·철회 후 신규 접근 거부 및 **VM actual PACS rendered read counter가1→두번째 정상에서2→철회 후2 유지**. 기존 A/B image/healthy 보존, owned source stage 제거 PASS. worker source127개 aggregate `f883cba35d094b078a0e9f78fdf6af14e899164d3d9818780e08532f6cc53cdb`. 초기 CT FAIL `…T134945Z-671daef3f66e`도 보존: 당시 loopback PACS 주소 사용, raw transport code 미포착; current private proxy 주소 적용 후 PASS이며 최초 하위 오류를 connection refused 등으로 확정하지 않는다.

최신 후보 `highpass-platform-mvp:capstone-patient-pacs-20261009` / `sha256:3fdee566d545839ad4f5cb31070d3820c32f5ae9008c32a66ca4bb5079318c54`, 빌드exit0, source10개 local/image SHA 일치 PASS. 정확한 digest Trivy HIGH/CRITICAL0 및 Container Gate PASS. 전체 Node **833/833 PASS/45.373618초/exit0**, `patient-pacs-node-regression-20261009.log`. 중간 image d4b220f3은 당시 후보 이력이지 최신 source 전체 증거가 아니다. PostgreSQL 스킬의 bound query·기존 최소권한 적용, 운영 DB/권한/VM 서비스 재배포 없음. 신규 증적 DRAFT / UNASSIGNED, 변경 미커밋.

**다음 작업 한 개: 검증된 후보의 capstone patient runtime/전용 계정·내부 credential 활성화와 환자 웹·모바일 actual Viewer 연결**. 현재 시험은 실제 PACS/Vault이지만 격리 SQL·loopback A/B handler·SSH tunnel이며, 실제 public edge·환자 로그인/브라우저 Viewer·최종 전체 MVP/v3 완료가 아니다. Windows 시간서비스 복구와 최종 독립 검토는 계속 미완료다.

### 최신 실제 환자 Key Vault·격리 SQL 연결 — 2026-10-09

실제 VM-local patient 암호화 adapter → 기존 Azure RSA-OAEP-256 → 격리 SQL release precheck/consume → B AES-GCM 복호화·원본 1픽셀 PNG 무결성 PASS. `patient-vault-integration-ops.py` exit0, 전체 wrapper7항목 PASS 및 SQL16항목 PASS/21.806초(grants4/audits53/proofs5, cleanup=true). source127개 SHA aggregate `a2615801660d5c14a9603579b5fc3f60fe802764839bad0ac9a1702996420f19`; A/B 신원·소스 일치, 기존2c7b3664/940806f6 image/running/healthy 보존, 신규 owned source stage 정리 PASS. 재사용은 B Control authorize403/KV_POLICY_DENIED, DPoP 재사용·토큰 변조·SQL 철회 후 신규 조회의 PACS fixture 증가 없음 및 기존 감사 chain 확인. 기존 서비스/DB/volume/권한은 변경하지 않았다. 증적 `artifacts/workstation/patient-vault-20261009T134121Z-8d5e2b463965/result.json` — DRAFT / UNASSIGNED.

초기 실행3건 FAIL을 삭제하지 않았다: `patient-vault-20261009T133234Z-dc75f7d55a43`, `…T133415Z-98767e1591e2`, `…T133544Z-ebd479ab540e`. 마지막 진단의 모든 scope 비교 true, A VM 잔여32552ms/관측 clock delta약-2.6초였다. 준비 영수증에 issuedAt를 서명 결속해 **deadline-issuedAt≤30초**를 검증하도록 수정했다. Gateway absolute expiry, Control의 MAC/현재시간/철회/권한 및 pre/post unwrap 검사 유지. 선택19/19 PASS/585.3222ms, 공식 동시성4 전체 Node **833/833 PASS/44.491868초/exit0** (`patient-vault-node-regression-20261009.log`). 발급시각 누락·30초 초과 거부, receiver clock뒤처짐에도 Control 만료 거부 테스트 포함. Windows w32time은 stopped이며 일반 권한의 Start-Service는 실패; A/B는 NTP=yes/NTPSynchronized=yes. Windows 시간서비스 복구는 발표 사전점검 미완료 항목으로 남기고 관리자 실행 결과를 요청했다.

이 결과는 실제 Vault지만 **PACS가 아닌1픽셀 PNG·loopback A/B HTTP handler·격리 SQL·SSH tunnel** 범위다. 실제 환자 CT/MRI/browser/public TLS/배포/전체 MVP 완료 주장이 아니다. 후보 image56405f81은 이번 issuedAt 변경 이전으로 이 소스의 배포 증거로 승계하지 않는다. **다음 작업 한 개: 최신 소스로 후보 이미지 재빌드·스캔하고 실제 합성 CT/MRI를 patient Grant/Viewer 경로에 연결**한다. 신규 증적 독립 검토 미완료, 이번 변경 미커밋이다.

### 최신 실제 병원 인증·Azure 역할 사전확인 — 2026-10-09

`scripts/patient-key-identity-inventory.py`는 VMware 관리 채널의 공개 host key로 SSH를 pin하고 concealed stdin만으로 인증한다. 서비스/DB/인증서/권한을 변경하지 않는다. 실제 A runtime `2c7b366483f1…`와 B `940806f602ec…` running/healthy, 각 VM에서 실제 인증서 Entra HTTP200 및 등록 tenant/clientId 일치 **4항목 PASS/exit0**. 이전 batch public-key 거부를 VM 불능이나 자격증명 만료로 해석하지 않는다. 최종 증적 `artifacts/workstation/patient-key-inventory-20261009T132615Z/result.json`, DRAFT / UNASSIGNED. 초기 동일 실행의 신원 결속 미확인 결과는 `…T132447Z/result.json` 이력으로 보존한다. private key/assertion/access token/VM 암호를 결과 파일에 저장하지 않는다.

Azure CLI 읽기 전용 조회 exit0: 지정 Key scope에서 A/B principal의 등록 custom-role 할당 확인. A role dataActions는 keys/read + keys/wrap/action, B는 keys/read + keys/unwrap/action이며 관리 actions는 비어 있다. 이는 이 두 직접 역할의 구성 확인이지 모든 group/inherited 유효 권한 부재나 실제 역방향 호출 DENY의 신규 증거는 아니다. Python 문법·secret scan(findings0)·diff 검사 PASS. 신규 inventory 도구는 기존 candidate 이미지의 런타임 검증 범위에 자동 포함시키지 않는다.

**다음 작업 한 개: 격리 SQL 환자 authority/HTTP release를 실제 VM-local patient 암호화 adapter와 연결하는 검증 harness.** A/B identity key는 각 VM 안에 유지하고 raw DEK를 host/Control에 반환하지 않는다. 새 후보를 운영 서비스로 교체하기 전에 실제 wrap/unwrap·환자 release consume·무결성·철회·감사 실패를 함께 검증한다. 현재 actual patient Vault/배포/환자 CT-MRI Viewer는 NOT VERIFIED, 전체 MVP/v3 미완료다. 기존 의료진 crypto PASS를 승계하지 않는다.

### 최신 환자 통합 후보 이미지 — 2026-10-09

`Dockerfile.patient-capstone`으로 기존 a5487906 런타임에 src/scripts/db/public/config를 함께 복사했다. dependency 재설치·서비스 재배포·DB migration 없이 candidate `sha256:56405f81e58551a2651af078869ce550231b09abe0f35997e3e4f479dc9462c9` 빌드 exit0, 핵심 소스7개 local/container 해시 일치 PASS, 포장검사1/1 PASS. 정확한 image digest의 Trivy HIGH/CRITICAL 0 및 Container Gate exit0/PASS. 공식 package 테스트 설정과 동일한 `node --test --test-concurrency=4` **831/831 PASS/42.6667936초/exit0**. 앞선 기본 동시성 실행은830/831, Privacy HTTP 1개 FAIL(46.825211초)이었고 단독2/2 PASS(7.047745초); 최초 FAIL을 보존하며 원인은 NOT VERIFIED다. timeout/정책/fixture 변경 없음. 증적 `artifacts/workstation/patient-candidate-20261009.json` DRAFT / UNASSIGNED.

실제 읽기 전용 Cloud 조회는 기존 auth-denial image의 Control·PG healthy를 확인했다. A SSH는 strict host 검증 후 비대화형 public-key 인증 거부여서 VM/Vault 재검증으로 승계하지 않는다. **다음 작업: 기존 concealed VM 인증 경로로 A/B를 재확인하고 이 후보의 실제 patient Azure wrap/unwrap 검증을 실행한다.** 후보는 미배포·flags 미활성이고 신규 코드/문서는 미커밋이다. 환자 브라우저 CT/MRI·전체 MVP/v3는 미완료다.

### 최신 로컬 환자 런타임 시작 검증 — 2026-10-09

코드 기준 `d0b979e15feb725572a5e895bb6577f4a332eced` + 이번 verifier/document dirty. 커밋·푸시는 직전 단계에서 완료했으며 이번 변경은 미커밋이다. `node scripts/verify-patient-self-view-postgres.js` exit0, **16개 확인 항목 PASS/20.542초**, grants4/audits53/proofs5, cleanup=true. 기존 SQL/HTTP/A/B AES-GCM·로컬 RSA·1픽셀 PNG fixture 흐름에 실제 별도 LOGIN을 추가하여 runtime 시작, metadata UPDATE 권한 부여 시 거부, superuser 시 거부, 권한 회수 후 시작 복구를 검증했다. PostgreSQL 스킬의 최소권한 지침에 따라 임시 DB 안에서만 권한을 변경하고 종료 시 제거했다. 경로의 공백 인코딩은 `fileURLToPath`로 처리했다. Secret findings0, 문법/diff 검사 exit0. 증적: `artifacts/workstation/patient-runtime-startup-20261009.json` — DRAFT / UNASSIGNED.

**다음 작업 한 개: 기존 A/B 인증서를 그대로 안전하게 사용하는 실제 Azure patient wrap/unwrap 검증과 후보 배포 준비.** 실제 Vault·public TLS·실행 DB startup·환자 CT/MRI 브라우저는 NOT VERIFIED다. 이번 시험은 VM/Cloud/실행 DB를 변경하지 않았고 전체 MVP/v3 완료가 아니다. 아래 “다음 작업”은 해당 단계 당시 이력이다.

### 커밋 전 로컬 통합 확인 — 2026-10-09

`node scripts/verify-patient-self-view-postgres.js` exit0, 15개 확인 항목 PASS, 20.528초, grants4/audits53/proofs5, cleanup=true. 실제 격리 PostgreSQL·JWT/DPoP·Control HTTP·A/B handler와 AES-GCM/로컬 RSA fixture를 연결하고 재사용·변조·철회 후 PACS fixture 조회 증가 없음 및 감사 chain을 확인했다. PACS 응답은 1픽셀 합성 PNG이며 실제 Azure Key Vault·TLS·배포·CT/MRI·브라우저 종단 증거가 아니다. 신규 증적은 DRAFT / UNASSIGNED이며 전체 MVP/v3 완료로 승격하지 않는다.

## 현재 상태 — 단일 사용자 흐름 우선 / 2026-10-09 환자 capability 최종 회귀 반영

이 절이 발표 환경의 현재 상태 권위 위치다. 아래 `과거 이력`의 현재·미배포·실행 중 설명은 당시 기록이며 현재 상태로 해석하지 않는다. 기존 v3 Acceptance/P0 조건은 축소하지 않는다.

- 코드 HEAD: `089eecb5cd479a12aab28f4c92804e23dd101be0` + dirty. HEAD만으로 재현 불가. 로컬 환자 self-view policy는 런타임 비활성이다.
- B: 실제 읽기 전용 inventory `mobile-b-rollout-20261009T101501Z/result.json`으로 image `sha256:940806f602ec282d6d03a9da6948b6a8453bb47ff9f71fdadb8aa40fa5521aea`, healthy·암호화 필수 모드 확인. HTTPS 정적 자산 11/11 로컬 해시 일치: `presentation-ui-inventory-1791540594369/result.json`.
- Cloud: 현재 `highpass-platform-mvp:capstone-auth-denial-20261009` / `sha256:a54879068331c235fbd9636b899717fd06b5682ccf07ea9605a0a87ee1178783`. `cloud-app-rollout-2026-10-09T11-03-10.202598+00-00/result.json`에서 실제 image pin/소스8개/healthy/기존 환경·mount·port 보존과 4315941d rollback·재적용 확인. 앞선 `phantom-catalog-live-1791540950869/result.json`은 이전4315941d에서 합성 catalog 멱등 등록 addedStudies=0 시험이며 현재 이미지의 새 등록 시험은 아니다.
- A: `phantom-source-2026-10-09T10-15-45.968073+00-00/result.json`의 verify-only로 Gateway `2c7b3664…`, PACS `9f74f2db…`, private network·proxy health와 합성 CT12/MR12의 mTLS WADO 무결성·256×256 확인. 원래 28 Instances 유지, added/deleted=0.
- 개발용 CA/server/client 로컬 인증서 만료: 2026-12-07 08:18:39 KST. 실서비스 peer 전체 인증서 inventory는 별도 미검증; 실제 HTTPS와 A mTLS 경로는 검증을 완화하지 않고 실행했다.

### 최신 MRI 결과 — 같은 Cloud/B 조합의 정상·거부 종단 검증 완료

제품 코드·이미지·권한·TTL·TLS는 변경하지 않았다. 기존 mobile verifier의 고정 CT UID를 명시적인 CT/MR 합성 두 Study 선택으로 보강하고, wrapper의 VerticalFlow에서만 `-PhantomModality MR`을 허용했다. MRI 승인 시험에서는 CT를 범위 밖 Study로 시험하며 임의 UID/실환자는 허용하지 않는다. 기본 CT 모드는 유지한다.

- 명령: `powershell -NoProfile -File scripts/run-browser-authorization-trace.ps1 -Port 9228 -Capstone -MobileQr -VerticalFlow -PhantomModality MR -BrowserUrl https://192.168.111.149:9443/hipass/`, exit0, **169.684초**. `artifacts/workstation/b-browser-2026-10-09T11-14-01.907942+00-00/result.json`: 같은 합성 환자의 새 MRI 동의·Ticket → 실제 의료진 버튼 → 정확한 MR12 SOP/256×256/다음 슬라이스 → 모바일 철회·서버 거부·픽셀 제거 PASS. 9개 추가 음성 조건의403·감사 증가·token111/releases279/소비192·동의/scope 불변·영상/토큰 반환 없음 PASS. 의도된 DPoP 최초 정상 QIDO 이후 성공 기록 기준1735에서 재사용 증가0을 확인했다.
- 기존 Azure CLI Python의 `scripts/capstone-phantom-audit-check.py <위 MRI receipt>`, exit0: `artifacts/workstation/phantom-audit-2026-10-09T11-14-10.090603+00-00/result.json`. 같은 동의/인증 actor의 세 identity 거부 각1, bound probe session의 Study/Series/permission/철회/DPoP 거부 확인. UI token Vault 발급5/소비5·wrap/precheck/consume 연결·hash chain6328 PASS. Cloud 원본 저장이나 Azure provider 서비스 로그 검사 증거는 아니다.
- 선택 Node3/3 PASS/exit0(150.048ms), JS 문법·diff check·secret scan findings0 PASS. 이번에는 전체 Node를 다시 실행하지 않았다. 바로 앞 제품 코드 기준775/775 PASS는 아래43.332초 실행으로 구분한다. 생성 동의 정확한 cleanup과 wrapper 소유 Chrome 종료 PASS; 시작한 명령은 모두 종료했다.

이제 최신 Cloud a5487906/B940806f6 조합에서 **CT와 MRI 각각의 지정 사용자 흐름 정상·거부 검증** 증적이 있다. 두 실행은 각자 새 consent/Ticket이며 하나의 다중 Study 동의·v3 Grant 시험이 아니다. 카메라 스캔·네이티브 생체인증·환자 본인 실제 픽셀·영상 토큰 실시간 만료·패킷 경계·최종 재시작·전체 security gate·독립 사람 검토·전체 v3는 아직 미완료/미검증이다. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP 완료 아님. 관련 FR-001~005/010~036/037~041의 해당 기술 시험 범위에만 대응한다.

다음 작업 한 개: **환자 본인 CT Grant 저장을 기존 감사 hash chain/saveQueue와 안전하게 연결하고 DPoP 발급까지 검증**한다. 사용자 “권고안 실행”으로 S1 방향을 채택했다. 현재 환자 웹/모바일 canvas는 모의 그림이며 의료진 성공을 본인 열람 성공으로 승계하지 않는다. 새 의료진 권한 주입/가짜 병원 간 동의/암호화 우회 없이 authority·소유권·키 발급 분리를 유지한다.

### 이번 로컬 하위 작업 — Grant 저장 경계 / DRAFT · UNASSIGNED

환자 crypto adapter 추가 후 최종 전체 Node **830/830 PASS/exit0/42.1112171초**. 최신 소스 SHA·명령·fixture 한계: `artifacts/workstation/patient-crypto-local-20261009.json`. Secret findings0(2026-10-09T13:07:54.601Z), 문법/diff 검사 exit0. 아래826/826 이하는 이전 단계 이력이다.

**최신 환자 crypto A/B adapter 로컬 구현**: patient-encrypted-transfer.js의 별도 PATIENT_IMAGE manifest와 AES-GCM AAD를 만들고 기존 Azure RSA-OAEP-256 protocol client를 재사용했다. consentId surrogate 없이 Grant/actor hash/기관/Gateway/감사 세션/path/SOP/deadline·원본 hash와 cipher/manifest/wrapped-key hash를 결속한다. B는 원래 요청 token hash도 비교하며 별도 patient HTTP release의 pre/post unwrap·원자적 consume을 요구한다. explicit A/B crypto profile에 연결했으나 flags는0/실행 VM 변경 없음. 선택17/17 PASS/exit0/458.1245ms: 실제 로컬 RSA/AES 연산 왕복·변조·다른 token/SOP/type·재사용·unwrap 중 철회·audit 장애·B 전용 pixel branch/transient output 정리. **RSA fixture는 Azure 서비스가 아니고 auth/ledger는 doubles, body는 합성 bytes여서 실제 SQL+crypto 종단/PACS pixel/VM/브라우저 증거가 아니다**. 다음 작업 하나는 실제 SQL/HTTP/crypto를 한 흐름으로 연결하고 실제 Key Vault 및 후보 A/B 배포 검증으로 넘어가는 것이다. 관련 FR-014~036/037~041. 신규 증적 DRAFT / UNASSIGNED, 전체 MVP/v3 미완료. 이번 변경 commit/push/배포 안 함.

환자 release HTTP 추가 후 최종 전체 Node **826/826 PASS/exit0/42.5657779초**. 최신 source SHA·시험 경계: `artifacts/workstation/patient-release-http-20261009.json`. 아래824/824 이하와 “HTTP 미연결”은 이전 단계 이력이며, 위 handler의 loopback 범위만 해소됐다. public edge/실제 runtime/crypto 완료로 승계하지 않는다.

**최신 환자 KeyRelease A/B HTTP 인증 경계**: 새 B internal service key는 patient-package-key-release scope와 고정 hospital-b-portal 신원만 제공한다. A/doctor/generic/다른 key와 동일값을 거부한다. patient release handler는 A wrap/prepare와 B authorize를 분리하고 body 추가 신원·권한 속성을400으로 거부한다. server/runtime에 default-off 연결했고 opt-in에는 versioned key·036 ledger와 SELECT/INSERT/상태 column UPDATE, metadata UPDATE/DELETE 부재를 확인한다. PostgreSQL skill의 최소권한 기준을 사용했다. 실제 DB+loopback HTTP14항목 PASS/exit0/23.774초(grants4/audits42/proofs4, cleanup=true), 선택16/16 PASS/exit0/453.1231ms. no-store·32KiB·strict UTF8·5초 body deadline·서비스 scope/subject/authMethod/source·403/503 구분을 구현했다. 실제 dedicated login startup·public TLS edge·patient Key Vault/암호화 pixel·VM 배포는 아직 미완료/미검증이다. Secret findings0(2026-10-09T13:01:17.873Z), JS문법/diff 검사 exit0. 기존 실행 DB/VM/Cloud 변경 없음. 다음 작업 한 개: **patient Azure encrypt/decrypt adapter를 이 release 계약에 연결하고 실제 pixel 전달을 검증**한다. 신규 증적 DRAFT / UNASSIGNED. 전체 MVP/v3 완료 아님.

환자 KeyRelease ledger 추가 후 최종 전체 Node **824/824 PASS/exit0/42.6108249초**. 최신 source SHA와 증거 한계: `artifacts/workstation/patient-key-release-ledger-20261009.json`. 아래819/819 이하의 실행은 이전 코드 이력이다.

**최신 환자 KeyRelease policy/실제 SQL 경계**: HEAD `b53ee06e6a93ed4da7716cc5c5d14dc48cee3abd` + 이번 변경 dirty. Git fetch의 자동 maintenance는 종료 exit0, 직전 체크포인트 push 완료를 확인했다. `PatientBoundKeyRelease`·별도 ledger migration036·bound repository를 구현했다. 영수증과 current patient authority·SOP·Gateway·3개 package hash를 결속하며 PENDING은 감사 저장과 live 재검증 후에만 PREPARED로 활성화한다. PRECHECKED 이후 atomic consume은 한 번만 성공하고 감사 실패 후 상태를 되돌리지 않는다. 별도 PG 역할은 SELECT/INSERT와 status/consumed_at UPDATE만 부여했다(격리 시험 역할; 실행 DB 변경 없음). 선택14/14 PASS/exit0/179.4697ms, 최종 실제 격리 PG13항목 PASS/exit0/15.652초(grants4/audits39/proofs4, cleanup=true). 먼저16.046초 PASS 후 중앙 감사 enum 적용 기준으로 재실행했다. DB 재조회 hash chain 확인, SQL 합성 철회·hash 변조·precheck 전 소비 거부·동시 consume 한 건·감사 장애 PENDING 확인이다. 실제 Azure patient wrap/unwrap·HTTP release 인증 경계·A/B listener·환자 Viewer는 아직 미완료/미검증이다. 준비 감사와 상태 변경은 단일 transaction이 아니고 fail-closed orphan 상태를 허용하며 전체 HA/정확히 한 번 전달 주장을 하지 않는다. 관련 FR-014~025/026~036/037~041. Secret findings0(2026-10-09T12:56:13.858Z), 문법 검사 exit0. 다음 작업 한 개: **전용 A/B release 인증 경계와 patient Key Vault adapter를 연결해 실제 암호화 pixel 전달**. 신규 증적 DRAFT / UNASSIGNED, 이번 추가 변경 commit/push/배포 안 함.

환자 A/B transport 추가 후 최종 전체 Node **819/819 PASS/exit0/42.6429015초**. 소스 hash·시험 경계·미완료 범위: `artifacts/workstation/patient-transport-local-20261009.json`. 아래811/811 및808/808은 이전 구현 상태의 회귀 이력이다.

**최신 환자 A/B transport 로컬 구현**: A 전용 handler와 default-off listener 분기를 연결했다. 별도 credential/type/source/Study/Series의 authorize 결과와 patient ready 영수증을 사용하며 PACS에 browser token/proof를 전달하지 않는다. metadata에서 정확한 UID 행·허용 tag/VR/Value만 남겨 이름·생년월일·private tag·BulkDataURI를 제외한다. 환자 encryption adapter 없는 픽셀은 PACS 조회 전에503이고 doctor encryptor로 대체하지 않는다. B portal도 default-off patient metadata proxy를 추가했으나 실제 listener flag 활성화는 아직 없다. 환자 픽셀은 별도 KeyRelease 미준비로503, 기존 doctor decryptor를 사용하지 않는다. 최대25초 crypto deadline/abort와 transient input buffer 정리, 준비/audit 실패 시 bytes 미반환을 시험했다. 선택22/22 PASS/exit0/473.3861ms, secret findings0(2026-10-09T12:45:52.578Z), JS문법/diff 검사 exit0. 시험은 injected transport/PACS/crypto doubles 및 B loopback HTTP이며 **실제 A PACS·patient Key Vault·VM/TLS 활성화·브라우저 환자 CT/MR 증거가 아니다**. Cloud/A/B 배포·DB/volume 변경 없음. 관련 FR-026~036/014~025/037~041. 다음 작업 한 개는 **환자 authority에 결속된 Key Vault package/release를 연결하여 A/B pixel 경로를 완성**하는 것이다. 신규 증적 DRAFT / UNASSIGNED.

준비 영수증 추가 후 최종 전체 Node **811/811 PASS/exit0/42.2133832초**. 실행 범위·소스 SHA-256·미검증 항목은 `artifacts/workstation/patient-preparation-receipt-20261009.json`에 기록했다. 아래808/808은 이전 metadata gate 상태의 이력이다.

**최신 환자 준비 영수증 경계**: `/gateway/patient-self-view/ready`를 default-off runtime에 연결했다. 별도 process-local HMAC·path/token-hash/claims/kid·최대30초 deadline 결속, 내부 전용 caller 확인, live ledger/소유권/키 상태 확인 및 감사 저장 후 재확인을 구현했다. raw token/proof를 영수증에 포함하지 않으며 재시작에는 진행 중 영수증이 무효다. 준비 확인은 전달 완료·암호문 hash 결속·Key Vault consume·API HA 증거가 아니다. 선택9/9 PASS/exit0/211.0178ms, 실제 격리 PG12항목 PASS/exit0/21.015초(grants4/audits27/proofs3, cleanup=true). SQL 상태 주입을 환자 철회 UI로 해석하지 않는다. Secret 검사 findings0(2026-10-09T12:39:36.074Z), 문법 검사 exit0. 이번 skill 적용은 기존 SQL bound 조회·최소권한을 유지한 것이며 운영 DB 권한을 확대하지 않았다. Cloud/A/B 배포·기존 데이터 변경 없음. 다음 작업은 이 준비 영수증을 실제 A/B patient transport와 별도 암호화/Key Vault release 경계에 연결하는 것 하나다. 신규 증적 DRAFT / UNASSIGNED.

**환자 metadata gate 최종 결과**: 전용 호출자는 scope뿐 아니라 실제 `INTERNAL_SERVICE_TOKEN` 인증 방식과 `patient-self-view-gateway` subject도 요구한다. TEST JWT로 내부 service를 위장한 호출은 거부한다. 최종 선택11/11 PASS/exit0/211.4929ms, 실제 격리 PG 시험11항목 PASS/exit0/10.667초(grants4/audits23/proofs3, cleanup=true), 최종 전체 Node **808/808 PASS/exit0/43.5658232초**. 아래12.992초·164.521ms는 이 마지막 guard 이전 실행 이력이다. 소스 SHA-256와 미검증 범위는 `artifacts/workstation/patient-gateway-authorization-20261009.json`에 고정했다. 관련 FR-014~025/026~031/037~041의 metadata 인가 범위만 검증했으며, 환자 실제 영상·Key Vault·배포·전체 MVP 완료가 아니다. 기존 PostgreSQL 최소권한 지침을 적용해 별도 service scope와 bound live query를 유지했다. 신규 증적 DRAFT / UNASSIGNED.

**환자 capability 재검증 / metadata-only Control 경로 구현**: `patient-self-view-authorization.js`와 default-off `/gateway/patient-self-view/authorize`를 연결했다. 전용 patient service key는 own scope/source만 가지며 doctor/data-plane/key-release/privacy/internal 키와 동일 값이면 거부한다. 기존 reader에 default-false allowIssuedGrant를 명시적으로 추가해 **실제로 signature와 ledger 검증을 통과한 PATIENT_SELF_VIEW_GRANT 주체**를 원래 TEST JWT로 위장하지 않고 current account/ref/Study/Series/source에 대조한다. token hash·subject·source·Gateway·Study·단일Series·permission·auditSession·issued/expiry·ownership revision을 live SQL로 비교하고 DPoP htu/htm/ath/key/replay를 검증한다. proof·audit 저장 후 권한을 다시 읽으며 inactive/ref 변경은 거부, DB/key/replay 장애는503으로 분리한다. 기존parser 재사용·raw Instance/download/broad Study/encoded invalidUID 차단; Cloud patient-dicomweb 직접 prefix도 명시적으로 차단했다. 이 응답은 최소 scope만 반환하고 raw token이나 영상은 반환하지 않는다.

선택11/11 PASS(164.521ms). 실제 독립 PG/tmpfs 시험도11항목 PASS/exit0/12.992초: 앞선 JWT/HTTP 발급 토큰을 실제 patient reader/nonce ledger에서 재검증하고 GET metadata authorization, 같은proof 재사용, 다른Series, **합성 SQL 상태 주입**의 REVOKED·ownership version 변경 거부 및 DB 재조회 hash chain을 확인했다. 최종 grants4/audits23/proofs3, cleanup=true. 이 상태 주입을 환자 철회 UI/API 검증으로 주장하지 않는다. 내부 authorize HTTP의 실제 production bootstrap/credential activation, A/B clinical transport·환자 Key Vault release·실제 픽셀은 아직 NOT VERIFIED/미완료다. 의료진 기존 Gate를 우회하거나 raw plaintext 경로를 활성화하지 않았고 Cloud/A/B 배포·실행DB는 변경하지 않았다. Secret scan findings0(2026-10-09T12:25:31.083Z), JS문법PASS. 신규 증적 DRAFT / UNASSIGNED.

다음 작업 한 개: **patient-specific A/B metadata·암호화 전송 경로와 readiness/감사 receipt를 연결**한다. 암호화/Key Vault 환자 권한 경로가 준비되기 전 pixel 경로를 공개하거나 doctor release credential을 재사용하지 않는다. 아래 “Gateway 검증 다음”은 이전 상태이며 이번 metadata gate를 전체 영상 Gateway 완료로 승격하지 않는다.

**HTTP 경로 로컬 연결 완료 / 배포 아님**: 새 `patient-self-view-grant-http-handler.js`를 server.js의 기존 API 인증 전 분기에서 연결했다. 기능 off에는404, 활성 상태는 기존 JWT authenticateRequest→server requestMeta/ingressMeta→issuer다. 반환 no-store/no-referrer/no-cache/nosniff·redirect 없음, JSON/UTF-8 2048byte 제한·body5초 deadline, 내부 오류/토큰/proof/private key 진단 비노출, 무인증 거부 감사 실패에는503이다. 별도 `patient-self-view-grant-runtime.js`는 explicit capstone/TEST/strict-DPoP/Postgres/singleWriter profile와 전용 DB URL을 요구하고 관리자·테이블 owner·우회/cluster 특권 role 및 migration 미준비를 startup에서 거부한다. .env.example의 신규 flag는0, 실제 환경변수/DB 역할/등록/Cloud/A/B 배포는 변경하지 않았다. 활성 startup의 실제 dedicated login role 권한·credential/TLS 준비는 아직 NOT VERIFIED다.

실제 독립 PG/tmpfs와 loopback HTTP를 signed ingress 시뮬레이션으로 연결해 **기존 JWT 인증·201발급·무인증401·ingress 누락403·DOCTOR/다른 환자403·body privilege 추가400·grant 불변·DB 감사hash 검증**을 실행했다. `node scripts/verify-patient-self-view-postgres.js` 최종10항목 PASS/exit0/21.867초, grants4/audits17/proofs2, 컨테이너·HTTP listener cleanup=true. 첫21.422초 결과는 인증 거부 감사 callback 추가 전이므로 최종 결과로 구분한다. public HTTPS/실제 edge proxy·배포 결과나 Gateway 소비 증거가 아니다. HTTP 단위5/5 PASS, 기존 Ticket 포함 선택6/6 PASS(661.086ms), 전체802/802 PASS/41.866초는 server close hook 추가 전 실행이다. close hook을 포함한 현재 코드에서 선택6/6 PASS이며 기능 flag는 기본 비활성이다. YAML은 Node parser dependency 부재(MODULE_NOT_FOUND)를 보존하고 기존 Python PyYAML로 parse PASS; 의존성을 새로 설치하지 않았다. Secret scan findings0(2026-10-09T12:11:58.451Z), diff/JS 문법 PASS.

다음 작업 한 개는 **환자 전용 Gateway 토큰 검증·live ledger/소유권 재확인과 제한된 patient-dicomweb 경로를 연결**하는 것이다. 이번 HTTP는 발급까지이며 실제 영상·patient Key Vault release·브라우저 CT/MR·철회/만료 후 pixel 제거·배포·전체 v3는 여전히 미완료다. 기존 의료진 audience/credential·원본 A 보관·Cloud clinical 차단을 유지한다. 아래21:03의 “HTTP 연결 다음”은 이전 이력이다.

최종 close hook/현재 코드 전체 회귀 재실행도802/802 PASS/exit0/41.570초다. `artifacts/workstation/patient-grant-http-20261009.json`에 실제 HTTP SQL 시험과 구현 source hash·검증 범위를 보존했고 hash 대조 PASS다. 해당 source 목록의 server/runtime hash는 구현 식별이며 실제 production bootstrap 성공 증거로 주장하지 않는다. 검증용 컨테이너 label inventory0·cleanup 확인. 최종 상태 신규 DRAFT / UNASSIGNED.

**환자 전용 내부 Grant 발급 구현**: `patient-self-view-grant-service.js`가 엄격한 단일-Series body·추가 속성 거부·POST/HTTPS/고정 origin/path/trusted ingress·현 소유권 reader를 확인한 뒤 기존 HipassService DPoP verifier와 persistent replay 저장소를 호출한다. 별도 `mediq-patient-self-view-gateway` audience, PATIENT_SELF_VIEW authority, VIEW_ONLY, 서버 source/Gateway/scope, cnf.jkt, 최대300초 및 인증 expiry 이하로 내림한 TTL, 감사 세션과 token hash ledger에 결속한다. 서명한 raw token은 RAM에서만 보관하고 기존 atomic persistence COMMIT 뒤에만 반환한다. body/proof/key/store 장애·timeout·기한 경과에는 토큰 미반환. 이 내부 클래스는 HTTP route를 mount하거나 Viewer 권한을 활성화하지 않으며 default-off다. HS256 서명은 기존 development KeyProvider 기반으로, 실제 Azure Key Vault 영상 암호화/환자 key release 성공 주장과 구분한다.

새 단위5/5 PASS(241.990ms): TTL/signature/hash binding·body/ingress 주입 거부·nonpersistent replay/key/proof 거부·저장실패/기한·지연 proof 후 미발급. 실제 독립 PG에서는 EC proof 서명 검증/nonce SQL claim·signed grant/hash ledger·재사용/누락/위조 거부 감사, replay adapter 재생성 후 재사용 거부 및 저장소 장애503까지 확장9항목 PASS(16.712초). HTTP 인증 middleware·실제 브라우저·Gateway token 소비·key release는 아직 NOT VERIFIED다. 확장 첫 시험의 검증기 DB 재조회 값을 live memory에 덮어쓴 오류 FAIL(24.240초)은 DB 읽기 검증 후 원래 memory를 복원해 해소했으며 제품 정책을 완화하지 않았다.

전체 Node 첫 동시 실행은 개인정보 filter fixture 일부 FAIL이었다. Docker SQL 시험 종료 뒤 같은 전체 명령을 재실행해 **797/797 PASS/exit0/43.486초**를 확인했다. 최초 실패의 기술 원인을 자원 경합으로 확정하지 않는다. 최종 stdout은 `artifacts/workstation/patient-grant-node-regression-20261009.log`. secret scan findings0(2026-10-09T12:01:33.060Z). 신규 증적 DRAFT / UNASSIGNED, 기존 사람 승인을 승계하지 않는다. 다음 작업 한 개는 **신규 발급 서비스를 기존 인증·trusted ingress HTTP 경로에 default-off로 연결해 실제 요청의 정상·거부·응답 secret 비노출 계약을 검증**하는 것이다. 영상/Key Vault/웹 실픽셀 전체 흐름은 계속 미완료다.

아래20:52 이전의 “DPoP 발급 다음” 설명은 당시 이력이며 위 내부 발급 구현이 현재 상태다. 로컬 scoped PASS를 최신 Cloud/B 배포나 전체 MVP/v3 완료로 승격하지 않는다.

최종 enum 중앙화와 현재 소스 기준 실제 SQL 발급 재실행도9항목 PASS/exit0/15.587초, grants3/audits11/proofs1 및 DB 재조회 hash integrity 확인·cleanup=true다. `artifacts/workstation/patient-grant-issuance-20261009.json`에 범위·실패 이력·핵심 소스 hash·회귀 결과를 보존한다. Secret scan findings0(2026-10-09T12:03:41.298Z). 현재 Cloud/A/B image나 DB schema는 교체하지 않았다. 이전 `patient-self-view-postgres-20261009.json`은 발급 전6항목의 당시 소스 hash 이력으로, 지금의 변경된 verifier source와 같은 hash라고 주장하지 않는다.

**실제 격리 PostgreSQL 통합 검증 완료(신규 DRAFT / UNASSIGNED)**: `node scripts/verify-patient-self-view-postgres.js`, exit0/PASS/21.156초. 현행 legacy schema의 필요한5개 테이블과033~035를 원문에서 적용한 별도 pinned postgres:16-alpine 컨테이너(tmpfs)에서 실제 nonowner/비superuser 역할로 실행했다. 정상 Grant+기존 감사 커밋, 감사 SQL 실제 실패 시 Grant/감사 모두 rollback, ownership version 변경 거부, 기존 service.writeAudit/save와 동시 처리 후 DB에서 다시 읽은3건의 기존 hash 내용·chain 검증, 타 Series/DOCTOR 거부 후 grants2/audits3 불변, 감사 UPDATE 권한 부재까지6항목 PASS다. 이는 논리적 SQL 트랜잭션 시험이며 디스크 crash 내구성·실제 인증/DPoP·발급 API·클라우드 DB/배포 증거가 아니다. role의 row-lock용 제한 column privilege는 임시 합성 시험 전용이며 production role 승인으로 승계하지 않는다.

첫 실행의 단계 정보 부족 FAIL과 후속 schema/readiness FAIL은 보존한다. 단계 진단·유한 timeout 및 tmpfs 격리를 보강한 뒤 grant-and-audit에서42501 권한 오류를 실제 재현했다. 테이블 lock에는 SELECT/INSERT만으로 부족하므로 **감사 UPDATE 권한을 추가하지 않고**, public.audit_logs의 fixed lock만 수행하는 migration035 SECURITY DEFINER 함수·고정 pg_catalog search_path·PUBLIC 실행 REVOKE·별도 writer EXECUTE를 적용해 해소했다. 정상 이전15.712초 PASS는4항목, 최종21.156초 PASS는6항목으로 구분한다. 모든 실행에서 그 실행이 생성한 컨테이너만 종료했고 최종cleanup=true; 기존 DB/PACS/Cloud/A/B·volume에 migration/등록/배포하지 않았다.

다음 작업 한 개는 **기존 persistent DPoP issuance verifier와 별도 patient audience/TTL signer를 연결하여 Grant 발급 정상·거부를 끝내는 것**이다. 영상/Key Vault/웹 실픽셀 전체 흐름은 아직 미완료다. 기존 의료진 token/동의 경로를 우회하지 않는다.

최종 전체 Node792/792 PASS/exit0/41.556초, secret scan findings0(2026-10-09T11:53:48.157Z), 문법/diff check exit0. 실제 SQL 시험의 결과·이전 실패·3개 핵심 소스 SHA-256은 `artifacts/workstation/patient-self-view-postgres-20261009.json`에 보존했다. 이 artifact는 로컬 생성 증적이며 독립 사람 검토 승인이 아니다.

아래20:42/20:37의 구현 설명과 당시 NOT VERIFIED 상태는 **이전 하위 작업 이력**이다. 위6항목 SQL 시험은 해당 격리 통합 미검증만 해소하며, 실제 발급/DPoP/운영 배포·전체 MVP 상태를 승격하지 않는다.

후속 구현: `patient-self-view-audit-adapter.js`가 기존 감사 builder/hash 형식·PostgresStore saveQueue를 재사용한다. 기존 `writeAudit`의 메모리 append도 같은 큐에서 직렬화한다(이상행위 후속 처리는 큐 밖에서 기존 방식 유지). adapter는 이전 변경을 flush하고 Grant 트랜잭션 안에서 audit_logs 쓰기 lock·DB chain head와 메모리 head 비교·bound audit INSERT를 수행한다. 확인된 COMMIT 뒤에만 메모리/committed baseline에 새 감사를 넣는다. commit outcome unknown에는 저장 큐를 fail closed해 재시작/reload 전 stale full save를 금지한다. default-off·명시적 singleWriter 조건이며 API HA 구현이 아니다. 실제 DB repository/adapter 통합·runtime 연결·DPoP 발급·배포는 아직 NOT VERIFIED/미완료다. mocks의 원자성 결과를 실제 DB 증거로 승계하지 않는다.

adapter 선택4/4 PASS(235.013ms), 저장/adapter 선택18/18 PASS(최종 commit-unknown 방어 포함,888.484ms). 최종 전체 `node --test` **791/791 PASS/exit0/42.255초**, 마지막 commit-unknown 방어를 포함한 현 코드 기준이다. JS 문법/diff check exit0, Secret scan findings0(2026-10-09T11:42:22.792Z). 라이브 E2E/staging smoke·Cloud/VM 배포는 이번 실행에 포함되지 않는다. 변경 영향 FR-021~025/037~041이며 기존 감사 기록의 hash를 재서명하지 않았다. 다음 작업은 **실제 격리 PostgreSQL에서 Grant+감사 원자성·기존 save 동시성 확인 후 DPoP 발급 연결**이다.

`src/patient-self-view-grant-repository.js`와 migration034를 추가했다. default-off 내부 저장 기능이며 발급 API/서명/DPoP verifier/영상 권한이 아니다. 같은 DB 트랜잭션에서 live authority row lock·ownership revision 확인·token hash ledger INSERT·주입된 감사 writer·영수증/만료 검사·COMMIT 순서를 강제한다. 기존 global 감사 chain에 연결하는 실제 writer는 아직 없다. 테스트 writer가 제공한 영수증을 실제 PostgreSQL 감사 성공으로 보고하지 않는다. 실패·expiry·timeout에서는 성공 영수증과 raw token이 반환되지 않는다.

033은 legacy snapshot 테이블을 향한 외래키를 제거해 기존 full save의 TRUNCATE CASCADE가 신규 authority를 삭제하지 않도록 보완했다. missing/remapped legacy 행은 reader의 live JOIN에서 계속 거부한다. 로컬 `hipass-postgres`에 격리 schema를 만든 트랜잭션에서 033+034 DDL, 합성 ledger INSERT, TTL/DPoP check와 legacy TRUNCATE 후 ledger 보존을 실행하고 **전부 ROLLBACK/exit0**했다. 기존 실행 DB/PACS 데이터·volume·Cloud/A/B 배포는 변경하지 않았다. reader/repository의 실제 DB·감사 통합과 Cloud migration은 NOT VERIFIED.

관련 FR-006~013/021~025/037~041. 최종 선택16/16 PASS/exit0/246.482ms(소켓 오류 추가 포함), JS 문법·secret scan findings0·diff check exit0. 전체 `node --test`786/786 PASS/exit0/42.296초는 마지막 소켓 테스트 추가 전에 시작한 실행이며, 추가 테스트는 최종 선택 실행에서 PASS했다. 라이브 E2E와 staging smoke는 node 전체 실행에 포함되지 않으며 이 작업에서 재실행하지 않았다. 다음에는 기존 감사 head 직렬화·원자성 adapter를 연결해 실제 DB 실패·중첩 legacy save·DPoP 발급 정상/거부를 확인한다. 이 하위 작업의 PASS는 지정 사용자 흐름 종단 완료나 전체 MVP/v3 완료가 아니다.

### 환자 본인 열람 — S1 채택 후 구현 진행

사용자의 “권고안 실행”으로 S1의 별도 환자 authority/ledger/audience·명시적인 합성 계정/ref·실제 Key Vault 경로를 채택했다. 이전 승인 대기 상태는 해소됐으며 신규 독립 검토나 전체 기능 완료를 뜻하지 않는다. 이 채택을 S1 계약/구현계획에 기록했다.

첫 차단 지점인 trusted authority read를 로컬 구현: `src/patient-self-view-authority.js`는 기본 비활성, 서명 검증된 capstone TEST principal의 정확한 subject/profile·issuer/audience·session expiry와 DB의 명시적인 계정/ref 상태·현 소유 Study/Series·원본 기관을 바인딩된 단일 bounded query로 읽는다. 조회 전후 세션 만료를 확인하고 계정/ref UUID/version 변경을 scope revision에 결속한다. legacy 행 존재만으로 ACTIVE를 만들거나 browser body의 ownership/status를 채택하지 않는다. `src/auth.js`의 내부 principal에 서명 검증된 issuer/audience/exp를 유지하도록 보강했다.

`db/migrations/033_capstone_patient_self_view_authority.sql`은 계정/ref 두 projection의 명시적 status/revision·FK·PUBLIC 접근 차단만 정의한다. 자동 seed/기본ACTIVE/runtime write 권한은 없다. 실제 로컬 PostgreSQL의 격리 schema transaction에서 DDL 실행 후 전부 ROLLBACK한 probe exit0/PASS; Cloud migration·등록·reader DB 종단 성공 증거는 아니다. 원본 DB/PACS volume·실행 이미지를 교체하지 않았다.

`test/patient-self-view-authority.test.js` 및 기존policy 선택9/9 PASS(135.576ms), 전체Node780/780 PASS/exit0(42.237초), secret scan findings0·문법/diff check PASS. 최종 inherited-property 방어는 같은 정상 profile 선택 조건에 명시적인 own-property 확인만 추가했다. 관련 FR-006~013/021~025/037~041. 기능 완료가 아니라 실제 본인 CT 흐름의 첫 하위 작업이다. 신규 증적 DRAFT / UNASSIGNED.

다음 실행 작업은 같은 CT 본인 열람 흐름의 **명시적 합성 계정/ref 등록과 durable grant ledger·DPoP 발급을 기존 감사 원자성에 연결**하는 것이다. 그 뒤 A/B patient data plane·Key Vault release·실제 픽셀·정상/음성·후보 배포까지 끝내야 한다. 현재 발급 API·영상/키 권한은 활성화하지 않았으며 의료진 token/가짜 consent로 우회하지 않는다. 아래20:19 승인 대기 설명은 당시 이력이다.

### S1 채택 전 점검 이력 — 20:19 KST

20:19 KST 안전한 독립 점검: `node scripts/operations-expiry-check.js` exit0/PASS, `node scripts/cert-fixture-check.js` exit0/PASS. 로컬 runtime4개 유효·잔여58일, bad fixture는 실제 expired/예상 expired 일치. 여기서 출력한 vulnerability exception image8ebb9d63은 기존 로컬 정책 범위이며 실제 Cloud a5487906 취약점 승인으로 승계하지 않는다. 별도10초 bounded strict TLS `GET https://192.168.111.149:9443/api/health`에서 HTTP200/status UP/database UP 확인(exit0). B 실제 peer는 CN=highpass-hospital-b-portal-development-only, issuer=hipass-dev-root-ca, 유효2026-10-08T16:06:42Z~2026-11-08T16:06:42Z(종료2026-11-09 01:06:42 KST), SHA25694:3B:64:83:3B:7B:D4:AE:9A:31:90:98:97:DD:59:48:B1:86:9C:3B:1E:6E:EC:A5:5C:CB:01:89:6B:76:91:3F다. 로컬 localhost 인증서와 실제 B peer 만료일을 구분한다. 이는 전체 A/Cloud peer certificate inventory나 mTLS 음성/패킷 경계 검증이 아니다.

기존 `workstation-automatic-ops.py verify-a-existing/boundary-check`는 VM password를 숨겨진 stdin으로 받아야 한다. 이 분석에서는 credential을 argv/파일/로그에 넣거나 자동 생성·신뢰 완화하지 않았고, 해당 새 VM 검증은 NOT VERIFIED다. S1 계약 채택 확인은 계속 필요하며, 자동 continuation이나 이전 사람 승인을 신규 계약 승인으로 해석하지 않는다. 독립적으로 가능한 Security Gate·로컬 인증서/fixture·공개 health 점검은 종료했다. 다음 본인 실영상 구현은 사용자 계약 선택 전 착수하지 않는다.

S1 계약 채택 여부는 사용자에게 확인 요청했고 아직 답변이 없다. 자동 goal continuation은 신규 계약 승인으로 해석하지 않았다. 대기 중 안전한 기존 회귀로 `$env:HIPASS_SECURITY_GATE_TIMEOUT_MS='120000'; node scripts/security-gate.js`를 실행했고20:17 KST exit0/PASS다. 실제 stdout을 보존한 `artifacts/security/security-gate-20261009T111726Z.json`: unit-tests42.680초, secret-scan1.236초, dependency-audit1.527초 모두exit0. pnpm 실행11.7.0/project pin11.7.0/lock9.0 일치; global manifest11.22.0 차이 경고는 유지한다. 서명/TLS 검증을 완화하거나 lockfile을 재생성하지 않았다. 의존성 audit은 기존 `--prod --audit-level critical` 범위이며 모든 HIGH 취약점 부재나 실제 운영 승인 증거가 아니다. artifact는 DRAFT / UNASSIGNED이며 사람이 검토한 것으로 표시하지 않는다. 이 게이트는 본인 영상 Grant 미구현을 해소하지 않는다.

기존 `docs/api/MEDI-Q-PATIENT-SELF-VIEW-GRANT-CONTRACT.md`는 S1 DESIGN CONTRACT / NOT IMPLEMENTED / DRAFT / UNASSIGNED다. 현재 `recordPatientSelfView`는 최소 study 메타데이터·감사만 반환하며 웹/모바일은 명시적인 모의 canvas 한 프레임을 표시한다. 순수 `evaluatePatientSelfViewPolicy`는 기초 판단만 있고 trusted authority reader·grant ledger·DPoP 발급·A/B patient data plane·환자 key release·실제 UI 픽셀 연결은 없다. 문서와 코드 대조로 확인한 첫 차단 지점은 승인되지 않은 authority 계약이며, 의료진 토큰 주입이나 가짜 동의로 우회하지 않는다.

권고 선택은 S1의 별도 PATIENT_SELF_VIEW authority/audience·별도 ledger·원본 A 유지·환자 전용 제한 경로·실제 Key Vault 결속을 채택하고, legacy patient 행의 존재를 ACTIVE로 간주하지 않는 명시적 capstone Mock IdP account/ref evidence adapter를 구현하는 것이다. 실제 IdP 완료 주장은 하지 않는다. 신규 구현·DB migration·ingress 활성화·클라우드 자원 변경은 이 분석에서 수행하지 않았다. 사용자의 계약 선택 확인 후 같은 CT 본인 열람 흐름의 하위 작업으로 reader→durable grant→영상/키→화면→타인/범위/만료 거부와 배포까지 이어간다. 이전 검토자 승인은 이 새 계약에 승계하지 않는다. CT/MRI 의료진 흐름 PASS는 유지하며 환자 본인 열람은 NOT VERIFIED/미완료다.

### 앞선 CT 결과 — 정상·거부·초기 인증 감사 검증 완료

- 두 파일만 교체한 `Dockerfile.auth-denial-control`로 기존4315941d Cloud runtime을 기반으로 후보를 생성했다. 서버·auth 이외의 dependency/schema/UI는 교체하지 않았다. `artifacts/security/container-scan/capstone-auth-denial-20261009.json`의 정확한 후보 a5487906 HIGH0/CRITICAL0 및 Container Gate PASS/exit0. 배포 guard Python7/7 PASS.
- Cloud-only 배포·이전4315941d rollback·후보 재적용·readiness PASS/exit0: `artifacts/workstation/cloud-app-rollout-2026-10-09T11-03-10.202598+00-00/result.json`. PostgreSQL 컨테이너와 이전 감사6119건 fingerprint가 전후 동일하다. Compose 기존 설정·Key Vault·A/B·DB migration·PACS volume을 변경하지 않았다.
- 동일 모바일 동의·Ticket→실제 의료진 접수 버튼→CT12 SOP/256×256/다음 슬라이스→철회·픽셀 제거 PASS/exit0: `artifacts/workstation/b-browser-2026-10-09T11-07-48.387937+00-00/result.json`, 92.322초. 새 verifier의 **9개 음성 조건 모두403/denialAudit PASS**: Series, 다른 기관, 환자 역할, 의료진 ID 위조, consentId 누락, 존재하지 않는 동의, 서명 변조, DPoP 누락/재사용. 같은 동의의 별도 bound API probe이며 정상 의료진 브라우저 단계를 대체하지 않는다.
- 각 음성 요청 직렬 창에서 tokens109/releases274/consumed187 및 consent/scope SHA-256 불변, 성공 audit1702 불변(의도된 DPoP 최초 정상 QIDO 이후 재사용 기준1703 불변), 영상/token/key-envelope 반환 없음. 물리적인 PACS 요청·패킷 부재나 모든 DB 테이블 불변을 증명한 것은 아니다.
- 같은 실행 PG 감사: `artifacts/workstation/phantom-audit-2026-10-09T11-07-55.652273+00-00/result.json`, exit0. **이번 consent와 실제 인증 actor/hospital에 연결된** 기관·역할·의료진 ID 거부 각1, probe session의 Series·DPoP 및 기존Study/다운로드/철회 거부 확인. UI token의 Vault 발급4/소비4·wrap/precheck/consume 연결·전체 hash chain6218 PASS. 변조/입력 누락/존재하지 않는 동의의 사유는 직렬 창 감사 증가로 확인하며 이 정확한 session 조회 범위와 구분한다. Azure provider 서비스 로그 조회가 아니다.
- 새 조합의 B HTTPS 자산11/11 hash PASS: `presentation-ui-inventory-1791543983443/result.json`. 최종 Node775/775 PASS/exit0/43.332초, 선택10/10 및 Python guard7/7 PASS. secret scan findings0, JS 문법/diff check PASS. 모든 시작 명령은 종료했고 생성 consent/브라우저 cleanup PASS. 신규 증적 DRAFT / UNASSIGNED, 신규 사람 승인 아님.

이번 완료 선언은 **지정한 CT 사용자 흐름 — 정상·거부 종단 검증 완료**로 한정한다. 초기 인증 거부 감사 FAIL은 이 새 실행으로 해당 endpoint/세 조건에서 해소됐으며 아래 과거 FAIL/미배포 설명은 당시 이력이다. Cloud 감사 저장 장애의 실제 주입은 수행하지 않았고 로컬 HTTP fixture로만503을 시험했다. 다른 endpoint의 초기 인증 거부 전체를 검증하거나 고쳤다고 주장하지 않는다.

실행 명령과 결과: `docker build --network=none --pull=false -f Dockerfile.auth-denial-control --build-arg CAPSTONE_BASE_IMAGE=highpass-platform-mvp:capstone-phantom-control-fix-20261009 -t highpass-platform-mvp:capstone-auth-denial-20261009 .` exit0 → 기존 container-scan/Container Gate(정확한 새 scan 경로) exit0 → `capstone-cloud-app-rollout.py --image highpass-platform-mvp:capstone-auth-denial-20261009 --image-id sha256:a54879068331c235fbd9636b899717fd06b5682ccf07ea9605a0a87ee1178783 --expected-current-id sha256:4315941d000e93ffb7adda63f423b0c336662cff761d9aa7b0219db56ef0f6fa --scan artifacts/security/container-scan/capstone-auth-denial-20261009.json --verify-rollback` exit0 → 기존9228 VerticalFlow wrapper exit0 → `capstone-phantom-audit-check.py <11-07-48 browser receipt>` exit0. 복구는 기존 operator가 보존한 Compose context·이전 image로 실행하며, 이번에 실제 rollback 후 readiness를 확인하고 후보를 재적용했다. 기존 data/volume 삭제는 없다.

20:09 당시 다음 작업은 동일 최신 Cloud/B 조합의 MRI 흐름이었다. 위20:15 결과에서 별도 새 MRI consent/Ticket의 실제 브라우저·PG 검증을 완료했다. 카메라/네이티브 생체인증/환자 본인 실제 픽셀, 영상 token 실시간 만료, 패킷 수준 경계, 최종 재시작, 전체 security gate, 독립 사람 검토 및 전체 v3는 NOT VERIFIED/미완료다.

### 초기 인증 거부 감사 로컬 구현 이력 — 20:00 KST

`src/auth.js`에 기존 doctor assertion을 그대로 호출하는 `assertDoctorPrincipalAudited`를 추가하고 `src/server.js`의 POST `/api/dicom-access/request` 초기 assertion만 연결했다. 기관·역할·의료진 ID 거부는 TOKEN_DENIED/FAIL/원래 reasonCode로 기존 writeAudit → store.save에 영속화한 뒤 원래403을 반환한다. authenticated principal의 actor/hospital과 형식 검증한 attempted consent reference만 기록하고 본문·token·proof·사용자 위조 ID는 복사하지 않는다. 감사 저장 실패는 안전한503 AUTHORIZATION_AUDIT_UNAVAILABLE이며 토큰 발급으로 진행하지 않는다. 다른 API의 초기 AuthError 처리를 전역 교체한 작업은 아니다.

`test/doctor-assertion-audit.test.js`: helper 정상·3가지 거부·저장 실패·입력 최소화 및 실제 격리 HTTP에서 3건 영속 hash/session/사유·발급/동의 불변, 생성 fixture 파일의 쓰기 실패503을 확인했다. 선택5/5 PASS(6.598초), 전체 Node775/775 PASS(42.001초), exit0. 최초 격리 HTTP 시험은 3초 요청 timeout으로 기존 반복 거부 tarpit을 기다리지 못해 FAIL이었다. 보안 지연을 끄지 않고 요청10초/시험30초 유한 기한으로 재검증했다. 기존 임시 fixture와 테스트 소유 서버는 정리했다.

기존 mobile browser verifier는 다음 실행부터 각 음성 조건의 감사 증가를 필수로 요구하며 `denialAudit`를 별도 출력한다. 아래 과거 receipt는 변경하지 않았다. 기존 배포에서 차단만 성공해도 감사 증가0이면 새 verifier 전체는 FAIL이어야 한다. 문법·secret scan findings0·diff check PASS. 변경 관련 FR-014~025/037~041 및 V3-SR-AUD-001/003, V3-SR-API-003. DB schema·정상 토큰 계약·TLS·TTL은 변경하지 않았다. 신규 로컬 결과는 DRAFT / UNASSIGNED이며 Cloud/B/A에는 아직 이 변경을 배포하지 않았다.

다음 작업 한 개: **현재 Cloud image/source baseline 재확인 → server/auth 두 파일만 담은 후보 이미지 검사 → 기존 이미지로 rollback 가능한 Cloud-only 배포 → 동일 브라우저9건·PG 감사 연결 재검증**. 아래 최신 live 인증 거부 감사 FAIL은 로컬 시험 PASS로 승계하거나 해결 완료로 표시하지 않는다.

### 앞선 추가 음성 검증 — 차단 PASS / 초기 인증 거부 감사 FAIL

동일 B 배포에서 모바일 동의·Ticket → 실제 의료진 버튼 → CT12/256×256/다음 슬라이스 → 철회·픽셀 제거를 다시 실행했다. 신규 증적은 DRAFT / UNASSIGNED이며 전체 MVP/v3 완료가 아니다. 이번에는 제품 서버·API·DB schema·배포를 변경하지 않고 기존 검증기 3개만 보강했다.

- 실제 브라우저: `artifacts/workstation/b-browser-2026-10-09T10-53-05.967153+00-00/result.json`, wrapper exit0, 196.982초. 음성 요청은 같은 동의의 별도 검증기 키에 결속된 토큰/API로 실행했으며 정상 화면 경로를 API로 대체하지 않았다.
- PG 연결: `artifacts/workstation/phantom-audit-2026-10-09T10-53-19.637926+00-00/result.json`, exit0. 같은 probe auditSessionId의 Series·DPoP 누락·재사용·기존 Study/다운로드/철회 거부 사유 확인, 실제 UI 토큰 Vault 발급4/소비4 및 wrap/precheck/consume 연결, hash chain6119 PASS. 토큰 변조는 직렬 요청 창의 TOKEN_INVALID 감사 증가로 확인했으며 이 PG 연결기의 정확한 probe-session 목록에는 포함되지 않는다.
- HTTPS 정적 자산11/11 동일 해시: `presentation-ui-inventory-1791542864992/result.json`, exit0. 전체 Node770/770 PASS, exit0, 42.237초; 선택 회귀5/5 PASS, exit0. JS 문법·diff check·secret scan findings0 PASS. Node 결과는 별도 live 보안 게이트를 대체하지 않는다.

| 음성 조건 | HTTP / 안전한 공개 사유 | 정책 사유 | 차단·측정한 부작용 부재 | 거부 감사 |
|---|---|---|---|---|
| 다른 Series | 403 / ACCESS_DENIED | TOKEN_SERIES_MISMATCH | PASS | PASS, 동일 probe session |
| 다른 기관 | 403 / HOSPITAL_IDENTITY_MISMATCH | 동일 | PASS | FAIL, 증가0 |
| 환자 역할로 의료진 토큰 발급 | 403 / ROLE_NOT_ALLOWED | 동일 | PASS | FAIL, 증가0 |
| 의료진 ID 위조 | 403 / DOCTOR_IDENTITY_MISMATCH | 동일 | PASS | FAIL, 증가0 |
| consentId 입력 누락 | 403 / INVALID_REQUEST | 동일 | PASS | 요청 창 증가2 |
| 존재하지 않는 동의 | 403 / ACCESS_DENIED_NO_CONSENT | 동일 | PASS | 요청 창 증가2 |
| 토큰 서명 변조 | 403 / ACCESS_DENIED | TOKEN_INVALID | PASS | 요청 창 증가1 |
| DPoP 누락 | 403 / ACCESS_DENIED | DPOP_PROOF_REQUIRED | PASS | PASS, 동일 probe session |
| 동일 DPoP 재사용 | 403 / ACCESS_DENIED | DPOP_NONCE_REPLAYED | PASS | PASS, 동일 probe session |

각 요청 전후 읽기 전용 REPEATABLE READ snapshot을 비교했다. 전역 token 발급107 / key release270 / 소비183은 9개 요청 모두 불변; 관련 성공 audit1675도 불변이었다. 재사용 검증의 최초 정상 QIDO200은 의도된 성공이므로 그 후 새 기준1676에서 재사용의 성공 증가0을 비교했다. 동의·scope row SHA-256도 동일하고 JSON 거부 응답에 영상·토큰·키 envelope·ciphertext가 없었다. 이 관측은 직렬 시험 창의 DB 상태·응답 비교이며 PACS 요청/패킷의 물리적 부재나 모든 가능한 DB 테이블의 불변 증거는 아니다. 전역 감사 증가는 동시 트래픽에 영향을 받을 수 있으며 정확한 session 연결 결과와 구분한다. raw token/개인키/동의 row 내용은 증적에 출력하지 않았다.

초기 인증 거부 3건은 `src/server.js`의 AuthError 처리에서 안전한 403 응답만 반환하고 감사 저장을 하지 않는 경로와 일치한다. 따라서 browser receipt의 PASS는 화면 흐름·차단·측정 부작용 범위이며 **전체 거부 감사 PASS가 아니다**. 관련 FR-014~025/026~036/037~041, V3-SR-AUTH-002/004, V3-SR-AUD-001/003, V3-SR-API-003의 전체 충족으로 승격하지 않는다.

최초 실행 `b-browser-2026-10-09T10-48-52.230883+00-00/result.json` exit1/51.525초는 입력 누락에 ACCESS_DENIED_NO_CONSENT를 기대한 검증기 계약 오류로 FAIL이었다. 실제 응답 INVALID_REQUEST를 보존하고, 입력 누락과 존재하지 않는 동의를 분리한 새 실행으로 검증했다. 기존 FAIL 증적을 수정하거나 제품의 허용 우회로 단정하지 않았다. 생성 동의의 정확한 철회 cleanup 및 wrapper 소유 브라우저 종료 PASS; 이번 실행 명령은 모두 종료했다.

재현: `powershell -NoProfile -File scripts/run-browser-authorization-trace.ps1 -Port 9228 -Capstone -MobileQr -VerticalFlow -BrowserUrl https://192.168.111.149:9443/hipass/`, 이어 기존 Azure CLI Python으로 `scripts/capstone-phantom-audit-check.py <위 browser receipt>` 실행. 기존 presenter 인증을 안전하게 읽으며 원본 PACS/volume을 삭제하지 않는다. 유한 요청·snapshot35초·전역300초/부모315초 제한을 유지한다.

### 앞선 사용자 흐름과 범위별 검증 이력

`HP-TEST-PHANTOM-001` → 모바일 PHANTOM 개발 로그인·PIN 모의 인증 → CT 한 Study/VIEW_ONLY/HOSP-B/1h 동의 검토 → 일회용 Ticket → 실제 의료진 웹 로그인·동일 Ticket 수신·QR 인식 시뮬레이션 버튼 → A DICOM/암호화 Viewer → 다음 슬라이스 → 모바일 명시적 철회 → 서버 거부·의료진 픽셀 제거.

- 최신 브라우저 증적: `b-browser-2026-10-09T10-25-47.000555+00-00/result.json`, exit0. 정확한 CT SOP12/256×256/다음 슬라이스, 같은 동의·Ticket·UI 토큰 연결과 실제 모바일 철회·의료진 픽셀 제거 확인. USED 재사용 거부도 확인. 다른 Study·DOWNLOAD·철회 후 rendered 음성 요청은 같은 동의의 **별도 검증기 키에 결속된 API 토큰**을 사용하며 UI 접수를 대체하지 않는다. 정상 QIDO control200 후 generic ACCESS_DENIED403을 확인하고 원인은 PG 감사로 확인한다. 카메라 스캔/네이티브 생체인증/환자 본인 실제 픽셀/MRI 종단/전체 v3는 NOT VERIFIED.
- 동일 실행 PG 증적: `phantom-audit-2026-10-09T10-26-16.821006+00-00/result.json`, exit0. 음성 probe의 정확한 auditSessionId에서 TOKEN_STUDY_MISMATCH/TOKEN_PERMISSION_MISMATCH/TOKEN_CONSENT_INACTIVE 각1 확인. UI token의 Key Vault binding5/소비5 및 각 소비 wrap/precheck/consume PASS, 전체 hash chain5936 PASS. Azure Key Vault provider 서비스 로그를 검증한 것은 아니다.
- 이전 `10-14-21`의 scope/철회403은 다른 DPoP 키를 사용해 정책 원인 증거로 불충분했다. 강화한 `10-23-14` 실행은 안전한 generic403에 내부 reason을 요구해 FAIL이었다. 실패·부분 성공 기록은 보존하고 위 최신 실제 실행+PG 증거로 판정한다.
- 이번 최종 코드 기준 전체 Node: 770/770 PASS, exit0, 42.208초. 별도 HTTPS/staging/모든 live 보안 게이트를 포함한 결과가 아니다. 선택 회귀16/16 PASS 및 secret scan findings0/exit0.
- 추가 mTLS: `automatic-2026-10-09T10-17-10.055970+00-00/result.json`의 정상 ALLOW, 무인증·wrong issuer/SAN/EKU·expired/bad DENY 모두 PASS. 그러나 결합 verify-a는 QIDO expected3/actual5 때문에 FAIL/exit1이다. 기존 시험이 합성 기본 영상4개를 재적재했으며 순수 read-only 시험은 아니다. 이 FAIL을 전체 PASS로 덮지 않는다.
- 보완 재검증 `automatic-2026-10-09T10-20-48.232212+00-00/result.json`: 기존 runner의 `verify-a-existing` 모드는 seed를 실행하지 않고 명시적인 기존 CT/MR UID2개+원래3개를 정확히 비교한다. 7개 mTLS 경로·QIDO5·임시 검증 인증서 정리 모두 PASS/exit0. 일반 verify-a의 원래3개 기대 조건은 유지한다.
- 네트워크 inventory 및 B→A raw Orthanc 접속 거부: `automatic-2026-10-09T10-17-51.099571+00-00/result.json`, exit0. 비노출 binding과 ECONNREFUSED 범위이며 패킷 수준 경계 검증을 대신하지 않는다.
- 최초 직접 runner는 CDP 미기동으로 실패했다(`10-10-59` 기록). 기존 wrapper로 독립 headless Chrome을 시작한 후 실행했다. 정책 DENY나 제품 결함 증거가 아니다.

### 남은 사항과 다음 작업 한 개

QR 실제 만료 재검증: `b-browser-2026-10-09T10-27-58.933011+00-00/result.json`, wrapper exit0. 클라이언트 QR 제거→본인/의료진 검증 identity 재로그인→동일 consent/Ticket/expiresAt 서버 EXPIRED→fresh DPoP redemption DENIED/TICKET_EXPIRED/no accessToken→정확한 동의 정리 PASS. 실제 대기615.439초, 서버 상태 읽기 관찰5.097초, 최종 HTTP Date도 기한 이후였다. 앱 session·TTL·시계를 조작하지 않았다. 만료 시험은 별도 새 동의이며 같은 CT Viewer 실행에서 토큰 만료를 기다린 증거가 아니다. 기존 `09-40`, `09-53` FAIL을 보존한다. 단일 즉시 조회로 만료를 결론내리던 검증기를 보완했으며 실제 시계 차이의 근본 원인을 확정하지 않는다.

앞선 19:54 기준 다음 작업은 초기 기관·역할·의료진 ID 거부 감사 보완이었다. 위20:09 최신 결과에서 해당 수정·Cloud-only 배포·rollback·동일 CT 브라우저 및 PG 감사 검증을 완료했다. QR 실시간 만료 PASS를 영상 토큰 만료 PASS로 승계하지 않는다. 환자 본인 실영상·MRI 동일 흐름·패킷 수준 경계·최종 재시작·전체 security gate 및 독립 검토는 이번 작업으로 완료 처리하지 않는다.

19:28 당시 변경은 기존 browser runner 연결/검증 보강, 기존 데이터용 mTLS/QIDO 검사, 상태 문서 정리였으며 당시 제품 API/DB/권한/TTL/TLS 또는 배포 변경·commit·push는 하지 않았다. 이후 감사 수정·Cloud 배포는 위20:09 결과로 구분한다. 관련 FR 기능군: FR-001~005,006~009,010~013,014~020,021~025,026~031,032~036,037~041; 관련 보안 요구 V3-SR-AUTH-002/004, V3-SR-CRY-001~003, V3-SR-AUD-001/003, V3-SR-API-003 및 Acceptance V3-AT-ACC-001~004/007. 이 요구 전체의 완료가 아니라 기술시험의 해당 부분에만 대응한다. v3 Grant/다중 Study/STOW/Provenance 완료가 아니다.

### 이번 실행 명령·종료 코드

| 명령 | exit | 범위 |
|---|---|---|
| `node scripts/presentation-ui-live-check.js` | 0 | B 정적 자산11 해시/TLS |
| `capstone-mobile-b-rollout.py --trusted-baseline <기존 pin> --presentation-ui` (apply 없음) | 0 | B 실제 image/health/암호화 모드 |
| `capstone-b-login-check.py` | 0 | 실제 인증 정상/위조 및 PG hash chain |
| `capstone-phantom-catalog-live-check.py --expected-image-id <4315941d…>` | 0 | Cloud image pin/합성 catalog 멱등 등록, added0 |
| `capstone-phantom-source-ops.py <기존 dataset> --verify-only` | 0 | A 실제 image pin/24개 합성 WADO/hash, 추가·삭제0 |
| `run-browser-authorization-trace.ps1 -Port 9228 -Capstone -MobileQr -VerticalFlow -BrowserUrl https://192.168.111.149:9443/hipass/` | 0 | 실제 모바일→의료진 버튼→CT Viewer→철회 |
| `capstone-phantom-audit-check.py <10-25-47 실제 receipt>` | 0 | 동일 UI token Vault/감사, 별도 probe 거부 원인 |
| `run-browser-authorization-trace.ps1 -Port 9227 -Capstone -MobileQr -MobileQrExpiry -BrowserUrl https://192.168.111.149:9443/hipass/` | 0 | 실제 QR 기한/서버 EXPIRED/사용 거부 |
| `workstation-automatic-ops.py verify-a` | 1 | mTLS7 PASS, 구형 QIDO expected3/actual5 FAIL 보존 |
| `workstation-automatic-ops.py verify-a-existing` | 0 | mTLS7·정확한 QIDO5·정리, 재seed 없음 |
| `workstation-automatic-ops.py boundary-check` | 0 | network inventory/raw Orthanc 비노출 범위 |
| `node --test --test-concurrency=4` | 0 | 최종770,42.208초; live scripts 별도 |
| 선택 Node 회귀 | 0 |16개 |
| `node scripts/security-secret-scan.js` | 0 | findings0 |
| 수정 JS `node --check`, `git -c core.safecrlf=false diff --check` | 0 | 문법/공백 |

Python은 기존 `C:/Program Files/Microsoft SDKs/Azure/CLI2/python.exe`를 사용했다. VM 암호는 stdin/메모리만 사용하며 위 표에 기재하지 않는다. 제품 흐름 전 과정의 정확한 wall-clock duration은 이번 runner가 저장하지 않아 미기록이다; QR 대기와 Node 시간을 전체 E2E 시간으로 대신 표시하지 않는다.

## 과거 이력 — 아래 설명은 당시 관측 상태

## 실시간 만료 결과·후속 기초 정책 — 09:40 UTC

최초 실제 만료 실행 `b-browser-2026-10-09T09-40-19.472435+00-00/result.json` FAIL/exit 1: 모바일 EXPIRED·QR 제거 대기 이후 서버 상태 확인 복합 조건 실패. 원인 미확정, 해당 생성 동의 정확한 철회 정리 PASS. 안전한 receipt 진단을 추가한 별도 새 실행이 현재 진행 중이다. 만료 전체 PASS를 선언하지 않는다.

환자 본인 실영상 S1 계약과 순수 기초 policy를 로컬 작성했다. `MEDI-Q-PATIENT-SELF-VIEW-GRANT-CONTRACT.md`, `src/patient-self-view-policy.js`, 선택 테스트 4/4 PASS, 전체 Node 770/770 PASS. 실제 authority reader·ledger·DPoP/token·영상·key release·웹/모바일 연결은 아직 미구현이며 정책 ALLOWED 자체를 영상 허용으로 사용하지 않는다. VM 이미지에는 이 로컬 서버 policy를 배포하지 않았다.

## 최신 현재 B — 모바일 만료 수정 배포 09:30 UTC

현재 image `sha256:940806f602ec282d6d03a9da6948b6a8453bb47ff9f71fdadb8aa40fa5521aea` (capstone-mobile-qr-expiry-20261009). 전체 Node 766/766 PASS, 새 image scan HIGH/CRITICAL 0, 정적 파일 31개 일치 PASS. `mobile-b-rollout-20261009T092728Z/result.json`: B-only 배포·이전 b61b4b84 rollback·재적용·설정 보존 PASS. HTTPS 자산 11/11 일치 (`presentation-ui-inventory-1791538223788/result.json`). A/Cloud/DB 변경 없음.

실시간 QR 만료 모드 실행 중이며 QR 표시·서버 ISSUED 대기를 관측했다. 만료 결과는 아직 NOT VERIFIED다. 상세 `mediq-mobile-qr-browser-2026-10-09.md`. 아래 이전 사용·철회 PASS는 이전 b61b4b84 기준이며 최신 이미지 회귀로 자동 승계하지 않는다. 다음은 같은 실행의 결과 확인·정확한 생성 동의 정리, 이후 환자 본인 실영상 계약 구현이다.

## 모바일 QR 발급·사용·철회 실제 Chrome — 09:21 UTC

현재 B b61b4b84 이미지에서 모바일 팬텀 CT 한 항목 동의/QR 생성, 의료진 실제 인증 API 사용, 모바일 USED polling·QR 제거, 같은 nonce 재사용 차단, 별도 동의의 확인 대화상자 철회·QR 제거·서버 거부 PASS. `b-browser-2026-10-09T09-21-12.032132+00-00/result.json`, 새 생성 두 동의 정확한 정리 PASS. 카메라·의료진 접수 화면·Viewer·실시간 만료 검증은 아니다.

만료 시 QR을 남기는 countdown 경로와 늦은 ISSUED 상태 덮어쓰기를 로컬 수정했다. 현재 B에는 이 만료 수정이 아직 없다. 관련 단위 테스트 6/6 PASS이나 실제 서버 기한 경과 증적을 대신하지 않는다. 상세 `mediq-mobile-qr-browser-2026-10-09.md`. 다음은 만료 수정 회귀·배포와 실제 만료 확인, 이후 환자 본인 실영상 연결이다.

## 최신 현재 B — 환자 표시 정렬 배포·CT 검증 09:14 UTC

현재 B image `sha256:b61b4b84889cd83364a2a837f570eb72a3a795d71ed8705c47c20e9aa479ec62` (capstone-mobile-patient-context-20261009). 후보 파일 31개 일치·새 scan HIGH/CRITICAL 0·Container Gate PASS. `mobile-b-rollout-20261009T091148Z/result.json`: 기존 7cbee1c7 실제 rollback·후보 재적용·원래 환경 보존·HTTPS 11개 PASS. HTTPS 자산 11개 hash 일치 PASS (`presentation-ui-inventory-1791537248442/result.json`). A/Cloud/DB 변경 없음.

새 이미지 CT 브라우저 PASS (`b-browser-2026-10-09T09-14-24.874925+00-00/result.json`): 환자 프로필/Viewer 표시 일치, 정확한 12 SOP/256×256/다음 슬라이스, 인증·DPoP 음성·철회 픽셀 제거. 해당 PG 감사 4/4 release·전체 chain 5414개 PASS (`phantom-audit-2026-10-09T09-14-34.530875+00-00/result.json`). 이전 MRI 3회 결과를 새 배포 MRI 검증으로 승계하지 않는다.

다음은 환자·모바일 화면 시각 확인과 모바일 QR 실제 브라우저 발급·사용·철회·만료 검증이다. 환자 본인 실영상은 별도 소유권·단기 접근 계약 구현이 필요하다. 아래 로컬 미배포 설명은 과거 이력이다. 전체 MVP/v3 미완료.

## 환자 컨텍스트 로컬 정렬 — 후속 작업

고정 환자 표시를 선택 컨텍스트로 정렬하고, 환자 웹·모바일 canvas를 실제 DICOM이 아닌 단일 모의 프레임으로 명시했다. 임의 50장 표시·모의 cine를 제거했으며 의료진 실제 Viewer는 유지한다. 전체 Node 763/763 PASS, exit 0, 42.270초. 선택 회귀 29/29 PASS. 상세: `mediq-patient-context-alignment-2026-10-09.md`.

이 변경은 B VM에 아직 배포하지 않았다. 아래 7cbee1c7 이미지·CT/MRI 6회 성공은 이전 배포 기준으로 유지하며 새 변경의 실제 브라우저 증적으로 승계하지 않는다. 다음은 로컬 화면 검토·후보 이미지 검사·B 배포 후 모바일 실제 QR 흐름 검증과 환자 본인 실영상 연결이다.

## 현재 B 영상 timeout 수정 배포 — 08:47 UTC

- 현재 B 이미지: `sha256:7cbee1c7532733a78e0742d005fda2b17c527dbc895f709e60de96f56075e215`, tag `highpass-platform-mvp:capstone-mobile-viewer-budget-20261009`.
- displaySlice/prefetch의 별도 10초 timer를 제거해 기존 proofFetch의 capstone 영상 35초 제한을 사용한다. token/receipt/package 만료와 서버 정책은 그대로다. 브라우저 팬텀 다음 슬라이스 관찰 기한은 요청 완료를 포함하도록 45초로 설정했다.
- 후보 31개 UI 파일 hash 일치 PASS. 새 Trivy scan HIGH/CRITICAL 0, Container Gate PASS: `artifacts/security/container-scan/capstone-mobile-viewer-budget-20261009.json`.
- `mobile-b-rollout-20261009T084506Z/result.json`: B-only 배포, 기존 a495ae00 이미지 rollback, 후보 재전환, 원래 환경/마운트/포트/보안 설정 보존, HTTPS 경로 11개 PASS. Cloud/A/DB 변경 없음.
- HTTPS 주요 자산 11/11 hash 일치: `presentation-ui-inventory-1791535640041/result.json` PASS.
- 앱 변경 기준 Node 758/758 PASS는 앞선 로컬 결과다. 이번 배포 안전성 Python 7/7 및 timeout/진단 선택 Node 5/5 PASS. 실제 CT/MR 반복 결과는 별도로 확인해야 한다.

### 배포 후 CT 반복·감사 확인

**최종 08:56 UTC:** CT 3/3, MRI 3/3 진단 없는 새 브라우저 반복 PASS. CT 총 200.219초, MRI 총 322.146초. MRI repeat: `browser-repeat-2026-10-09T08-50-53.947225+00-00/result.json`. 전체 Node 760/760 PASS, exit 0, 42.947초.

6개 브라우저 영수증 각각의 읽기 전용 감사 연결 PASS. CT 감사 증적: `phantom-audit-2026-10-09T08-55-24.480058+00-00`, `08-55-26.028237+00-00`, `08-53-40.884698+00-00`; MRI: `08-56-38.230011+00-00`, `08-56-39.778494+00-00`, `08-56-41.287564+00-00`의 result.json. 최종 전체 감사체인 5336개 PASS. 일부 미리 읽기의 미소비 발급은 만료와 명시적 거부를 별도로 확인했으며 성공 소비로 세지 않았다.

다음: 환자/Viewer 고정 P-1001 표시 정렬 → 모바일 실제 QR 발급·사용·철회/만료 화면 검증 → 환자 본인 실영상 연결 계약·구현 → 최종 네트워크/mTLS/재시작/시연 문서·독립 검토. 전체 MVP/v3 완료 판정은 아직 미완료다.

`browser-repeat-2026-10-09T08-47-20.969900+00-00/result.json`: 디버거·자동 재시도 없이 세 새 브라우저 CT 실행 3/3 PASS, 총 200.219초. 각 실행은 정확한 12 SOP/256×256/다음 슬라이스/무인증·DPoP 누락·재사용 거부/철회 후 픽셀 제거/단일 동의·토큰 연결을 확인했다. 2회차 실제 WADO 10.349초, 3회차 최대 18.975초 성공은 기존 10초 중단을 해소한 근거다. 부하·HA 검증은 아니다.

3회차 감사의 최초 `phantom-audit-2026-10-09T08-51-05.480773+00-00/result.json`은 발급 5/소비 4를 모두 소비돼야 한다는 조건으로 FAIL 처리했다. 후속 조회 `08-52-15.124891+00-00`에서 미소비 1건의 만료 및 같은 release_id의 KEY_RELEASE_DENIED를 확인했다. 이력은 보존한다.

검증을 실제 키 발급 계약에 맞춰 소비/거부 결과로 구분했다. 소비된 **각** release의 wrap/precheck/consume 연결을 요구하며, 미소비는 해당 동의 REVOKED·만료·동일 release 명시적 거부가 모두 있어야 확인 완료다. 하나라도 미확인이면 NOT VERIFIED, Vault/소비 감사 불일치는 FAIL이다. DB와 서버 정책 수정 없음. 판정 단위 테스트 2/2 PASS.

`phantom-audit-2026-10-09T08-53-40.884698+00-00/result.json`: CT 감사 4/4 PASS, 5건 중 4건 소비 및 1건 만료·거부, 전체 hash chain 5189개 PASS. allPreparedConsumed=false를 증적에 유지한다. Azure Key Vault 서비스 로그 자체를 확인한 것은 아니다.

## 브라우저 검증 안정화 — 08:26 UTC

아래 08:11 UTC의 새 팬텀 브라우저 미검증 기록 이후 실제 실행 결과다. 이전 실패는 삭제하지 않는다.

- CT 초기 성공 후 강화 검증에서 FAIL했던 기록을 보존한다: `b-browser-2026-10-09T08-16-49.401434+00-00/result.json`. 검증기의 Series/Instance 중복 로딩을 제거하고 자동 토큰 로딩 완료 후 슬라이스를 조작하도록 변경했다. 서버·TLS·DPoP·요청 timeout 변경 없음.
- 수정 후 CT PASS: `b-browser-2026-10-09T08-24-40.417179+00-00/result.json`. 정확한 12 SOP, 256×256 표시, 다음 슬라이스, 무인증 401·DPoP 누락/재사용 403, 철회 후 픽셀 제거, 한 동의/토큰/철회 연결 확인. 이 실행의 감사 참조에는 tokenId가 누락되어 감사 연결 증적으로 사용하지 않는다.
- MRI PASS: `b-browser-2026-10-09T08-26-24.656337+00-00/result.json`. 같은 정상/음성/철회 항목 및 JWT jti 기반 감사 참조 확인.
- MRI 읽기 전용 PostgreSQL 검증 4/4 PASS: `phantom-audit-2026-10-09T08-26-42.766426+00-00/result.json`. 해당 동의 REVOKED, 해당 토큰의 Key Vault-bound release 4개 모두 consumed, wrap/precheck/consume 감사 연결, 전체 저장 감사체인 4519개 무결성 확인. Azure Key Vault 서비스 로그 자체를 조회한 증적은 아니다.
- 전체 Node 754/754 PASS, exit 0, 41.416초. 동의 정리/팬텀 증적 선택 테스트 10/10 및 SSH 출력 제한·stderr 비노출·timeout 테스트 3/3 PASS.
- 실패 정리 도구는 명시적인 고정 팬텀 프로필과 단일 생성 영수증을 요구한다. 과거 실패의 동의를 최신 행 추정으로 철회하지 않았다. 과거 실패 동의 정리는 NOT VERIFIED로 유지한다. 팬텀 실패 정리의 실제 서버 검증은 아직 미실행이다.
- 모바일 QR, 환자 본인 실영상, 사람이 사용하는 화면 흐름·접근성, 복구·최종 독립 검토 및 전체 MVP/v3 완료는 미검증/미완료다.

### 최신 CT 반복 — 08:29 UTC

아래 'rendered 영상 요청이 없어' 설명은 후속 실패 이벤트 조사로 정정한다. 08:29 WADO_RENDERED는 ERR_ABORTED/10007ms이며, 08:38 진단 없는 repeat도 ERR_ABORTED/10003ms다. 두 슬라이스 로더의 명시적 10초 timer가 기존 capstone proofFetch의 35초 영상 제한을 덮어썼다. 로컬 중복 timer 제거 및 선택 회귀 12/12 PASS. B 미배포이므로 실제 반복 안정성 해결은 미검증이다. 상세: `mediq-verifier-stabilization-2026-10-09.md`.

`b-browser-2026-10-09T08-29-08.443530+00-00/result.json`은 FAIL, exit 1이다. 토큰·Study/Series/Instance QIDO는 200이며 정확한 12 SOP를 확인했으나 rendered 영상 요청이 없어 자동 영상 표시 대기에서 실패했다. 중복 검증기 조작 제거만으로 반복 안정성을 해결했다고 주장하지 않는다. 다음 작업은 애플리케이션 displaySlice 진입 전 상태 변경/토큰 정리 경로를 추적해 재현 테스트로 고정하는 것이다. timeout 증가·자동 재시도로 실패를 숨기지 않는다.

이번 실패의 `ownedConsentCleanup`은 PASS: 해당 브라우저 생성 영수증의 동의만 GET 200 → revoke 200 → GET 200, REVOKED 재확인. 레코드 삭제 0. 이 결과는 앞 절의 팬텀 실패 정리 실제 서버 미실행 상태를 대체하지만, 과거 다른 실패 동의 정리를 증명하지 않는다. MRI 감사 PASS와 앞선 CT PASS는 각 실행 범위에만 적용한다.

## 최신 팬텀 연동 배포 — 08:11 UTC

이 절은 아래 최초/이전 실행 기록보다 최신이다. 과거 실패/미배포 설명은 이력으로 보존한다.

- Cloud 수정 이미지 4315941d... 배포/실제 rollback/재승격 PASS, PG/기존 감사 4149개 hash 보존. `artifacts/workstation/cloud-app-rollout-2026-10-09T08-05-02.064365+00-00/result.json`.
- 고정 팬텀 환자/CT·MR Study 2개 카탈로그는 실제 API로 등록 완료. 신규 동의/토큰/v3 Mapping 승인 없음. B HTTPS 등록 검증 8개 PASS: 본인 목록, 무인증·환자·의료진 관리자 작업 거부, 중복 추가 0, 임의 dataset 400. `phantom-catalog-live-1791533289688/result.json`. 과거 500 FAIL 증적 보존.
- 최신 Node 전체 751/751 PASS, exit 0, 44.668초. Cloud/B 후보 모두 정확한 ID 기준 새 스캔 HIGH/CRITICAL 0 및 Container Gate PASS.
- B 현재 이미지 `sha256:a495ae00fa15a12a5001ef46e463f843f94add39e37f0c476d3a85e810420913`, tag highpass-platform-mvp:capstone-mobile-phantom-ui-20261009. 기존 d94f740...에서 웹/모바일 시연 환자 컨텍스트·프로필 선택 반영.
- `artifacts/workstation/mobile-b-rollout-20261009T080850Z/result.json`: B-only 배포 PASS, 이전 이미지 실제 rollback/후보 재승격 PASS. portal와 31개 UI 파일 SHA 확인. 기존 환경/암호화·진단 필수 설정/mount/포트/보안 구성 보존. A/Cloud/DB는 이 B operator에서 변경하지 않음.
- B HTTPS 최신 자산 11/11 hash 일치 PASS, exit 0. 로그인 capstone-auth.js를 실제 비교 목록에 추가했다. `artifacts/workstation/presentation-ui-inventory-1791533466763/result.json`.
- **새 B 이미지에서 브라우저 로그인·256×256 Viewer·12장 이동·QR·철회/감사 종단검증은 아직 NOT VERIFIED**. 아래 이전 2×2 브라우저 PASS를 새 기능에 승계하지 않는다. 정적 자산 배포는 환자 실영상 연결 완료의 증명이 아니다.

다음 착수는 PHANTOM 프로필을 명시적으로 선택하는 실제 브라우저 흐름 검증이다. UI가 새 환자/Study를 일관되게 사용하는지 확인하고 명시적 Series 동의→의료진 단기 토큰/DPoP→실제 Key Vault→B 256×256 Viewer→철회 후 픽셀 제거 및 재접근 차단을 같은 시나리오로 확인한다. CT/MR 각각의 실제 슬라이스/감사 연결이 필요하다.

## 최신 실행 결과 — B 포털 UI 배포 완료

아래 결과는 최초 조사보다 최신이다. 최초 불일치와 실패한 빌드는 그대로 보존한다.

- Docker Engine 직접 조회 PASS: Engine 29.8.0. 최초 PowerShell Job 관측 timeout 원인은 확정하지 않았으며 Engine 미기동/재시작 해결로 보고하지 않는다. 재시작하지 않았다.
- 최초 bare `sha256:<ID>` FROM 빌드 FAIL: BuildKit이 registry 이름으로 해석. 기존 로컬 이미지를 전용 태그로 연결해 정확한 ID를 재확인한 뒤 빌드 PASS.
- 새 이미지: `highpass-platform-mvp:capstone-mobile-presentation-20261009`, ID `sha256:d94f740a1a6109d64bf23265e8dbcbd51d0207291947f8cdc10fb3716264ffcc`.
- 이미지 내부 정적 자산 31개 해시 일치 PASS. Trivy 새 이미지 검사 0 HIGH / 0 CRITICAL 및 Container Gate PASS. 증적 `artifacts/security/container-scan/capstone-presentation-ui-20261009.json`.
- 실제 B baseline 조회 PASS: `sha256:debcfb290bb104c5a6de38955d0c7dbb2708f078a628874be63929dae7d9024a`, healthy, 암호화·진단 필수 설정 활성. 증적 `artifacts/workstation/mobile-b-rollout-20261009T071935Z/result.json`.
- B app-only 적용 PASS: portal source와 정적 자산 32개 확인, 기존 Compose·마운트·환경변수·사용자·포트·보안 설정 유지. baseline rollback과 candidate repromotion 실제 실행 PASS. HTTPS health/웹/모바일/공통 UI/로고 11개 route PASS. A/Cloud/DB 변경 없음. 증적 `artifacts/workstation/mobile-b-rollout-20261009T072041Z/result.json`.
- 적용 후 B HTTPS 자산 10/10 현재 소스 해시 일치 PASS. 최초 503 자산 모두 HTTP 200. 증적 `artifacts/workstation/presentation-ui-inventory-1791530576087/result.json`.
- 현재 소스 Node 전체 742/742 PASS, exit 0, 43.336초. Python 배포 안전성 7/7 PASS. 새 안전성 검사는 누락·중복·범위 밖 정적 파일을 거부한다.
- 실제 Chrome HTTPS 브라우저 E2E PASS: 시연 로그인, 동의 201, DPoP 토큰·QIDO·WADO·픽셀 표시, 무인증 401·proof 누락/재사용 403, 토큰 UI/storage/URL/history 노출 없음, 동의 철회 후 픽셀 제거. 한 동의·토큰·철회 연결 확인. 증적 `artifacts/workstation/b-browser-2026-10-09T07-23-25.144652+00-00/result.json`.
- 브라우저 영상은 기존 **2×2 합성 영상**이다. 256×256 신규 팬텀 연결·전체 감사체인 재검증·모바일 실제 QR 브라우저·전체 MVP/v3 완료는 아직 미검증이다. 자동 브라우저의 DOM 조작은 전체 사람이 사용하는 화면 흐름의 접근성/사용성 검증을 대체하지 않는다.

다음 착수: 새 팬텀의 환자 소유권·기관 매핑·Control 메타데이터 등록 계약을 확인하고, 별도 동의 scope로 256×256/12-slice Viewer 연결을 구현·검증한다. C 환자 실영상 연결도 별도 본인 인증 계약으로 진행한다.

## 현재 관측

- Cloud Control: SSH strict host verification으로 실제 컨테이너 확인. 이미지 `sha256:7f0901aa0e7e8f6b70a07ee980dcb5c0cf480c6e4ea4fa17b28231ffd3d7009a`, healthy. PostgreSQL healthy. 최신 QR 상태 API 배포 기록과 이미지 일치. 업무 API E2E 성공을 의미하지 않는다.
- B HTTPS: 프로젝트 CA와 hostname 검증을 유지한 공개 자산 10개 비교. 일치 1, 불일치/비정상 HTTP 9. app.js·mobile app/sw/manifest는 HTTP 200이나 소스와 다름. ui/workspace.css·tokens.css·clinician.js·patient.js·로고는 HTTP 503. 없는 파일인지 라우팅 오류인지는 컨테이너 내부 조사 필요.
- 증적: `artifacts/workstation/presentation-ui-inventory-1791530068848/result.json`. 비교 FAIL은 최신 소스 미반영 판정이며 기존 업무 전체 장애 판정은 아니다.
- 로컬 Docker ps/image 조회: 15초 관측 제한 초과. Desktop/backend 프로세스는 존재. Engine 정상 여부와 timeout 원인은 NOT VERIFIED.
- A PACS 팬텀 24장 적재는 Runbook 기록이며 이번에는 재확인하지 않았다. 새 환자 매핑/Control 메타데이터/동의 scope 연결이 다음 데이터 작업이다.

## 화면과 API 연결

| 화면 행동 | 코드상 경로 | 구현 상태 / 다음 확인 |
|---|---|---|
| 환자·모바일 검사 목록 | GET /api/imaging-studies | 환자 principal 검사 존재; 새 팬텀 소유권·목록 연결 필요 |
| 환자 본인 영상 | POST /api/patients/{patient}/studies/{study}/self-view | 서버 소유권·감사 경로. 응답은 영상 바이트 API가 아니며 웹은 canvas 합성 그림 표시. 실제 영상 연결 계약 필요 |
| 동의 생성·철회 | POST /api/consents, POST /api/consents/{id}/revoke | 기존 흐름 유지. 최신 배포 브라우저 재검증 필요 |
| 모바일 QR | POST /api/consents/{id}/handoff-ticket, GET /api/consents/{id}/handoff-tickets/{ticket} | 클라우드 QR 상태 코드 배포 기록 확인. 최신 화면과 함께 사용/만료/철회 검증 필요 |
| 의료진 QR 사용 | POST /api/transfers/tickets/redeem-viewer | 기존 인증/DPoP/정책 흐름. 최신 영상 범위 재검증 필요 |
| 의료진 영상 | POST /api/dicom-access/request → /dicomweb/* | B에서 A Gateway로 전달·암호화 복호화. 새 팬텀 다중 슬라이스 E2E 미검증 |
| 감사·관리 | /api/audit-logs 등 | 관리자 역할 경계 유지; 발표 흐름 correlation/hash chain 확인 필요 |

관련 FR: 001~005, 006~013, 014~031, 032~041. 현재 작업은 API/DB 정책 변경 없이 배포 자산 정렬을 준비한다.

## 준비한 배포 구성

`Dockerfile.presentation-ui`는 역할별 검증된 기반 이미지 위에 웹 루트 JS/CSS/HTML, ui, mobile, brand, images, assets를 복사한다. 서버 코드·ENTRYPOINT·설정은 기반 이미지에서 상속한다. `.dockerignore`의 clinical 제외를 유지하고 mockups는 복사하지 않는다. 기존 이미지에 이미 있는 파일의 삭제를 보장하지 않으므로 기반 이미지 검증은 별도로 필요하다.

`scripts/presentation-ui-manifest.js`는 현재 복사 대상 31개 자산의 해시를 출력한다. `--image sha256:<ID>`는 네트워크·포트·mount 없이 이미지 파일을 비교한다. 이 검사는 정적 자산 일치만 검증하며 취약점 검사·API 계약·브라우저 E2E를 대체하지 않는다.

```powershell
node scripts/presentation-ui-manifest.js
# B 현재 이미지 ID를 SSH Docker inspect로 재확인한 뒤 사용한다.
docker tag sha256:<verified-B-image-ID> mediq-presentation-base:<unique-tag>
docker image inspect mediq-presentation-base:<unique-tag> --format '{{.Id}}'
docker build --pull=false -f Dockerfile.presentation-ui --build-arg CAPSTONE_BASE_IMAGE=mediq-presentation-base:<unique-tag> -t mediq-presentation-ui:<unique-tag> .
docker image inspect mediq-presentation-ui:<unique-tag> --format '{{.Id}}'
node scripts/presentation-ui-manifest.js --image sha256:<candidate-image-ID>
# 기존 Container Security Gate를 새 image ID 대상으로 실행한다.
# 원본 Compose 구성·mount·environment를 유지하는 기존 app-only 배포 절차로 적용한다.
node scripts/presentation-ui-live-check.js
```

## 다음 작업

1. 로컬 Docker Engine 응답 회복 또는 승인된 기존 빌드 환경 사용. 원인 확인 후 불필요한 재시작과 데이터 삭제 없이 처리한다.
2. A/B 실제 이미지 ID·mount·Compose context 조사. B 소스 자산 HTTP 503의 원인 확인.
3. UI 후보 이미지 생성, 31개 파일 일치 확인, Container Gate, B 포털 배포·rollback·브라우저 정상/거부 경로 검증.
4. 신규 합성 환자·Study/Series 정식 등록과 scope 동의; 환자 실제 영상 접근은 의료진 토큰 재사용 대신 본인 인증 계약으로 설계·검증.
5. Key Vault·mTLS·QR·Viewer·감사·철회 단일 E2E, 재시작/반복 시연, 문서 동결·독립 검토.

## 이번 검증

- manifest 스크립트 문법 및 로컬 자산 열거 PASS.
- A/B 이동·환자 검색·QR 상태 관련 Node 10/10 PASS, exit 0.
- B 배포 자산 비교 FAIL, exit 1. HTTPS 연결 검증 완화 없음.
- 이미지 빌드·이미지 내부 파일 검사·새 Container Gate·배포·rollback: NOT VERIFIED.
- 전체 MVP 달성: 미완료.
# 2026-10-12 시나리오 의학 RAG 첫 분석 단위 — DRAFT / UNASSIGNED

현재 질문 범위 매핑: [26개 검사 주제·근거 공백](health-helper-scenario-scope-20261012-v2.md). HEAD c1040c8439a0bdb78c68a7a83a73d84bc2704f31, 작업 시작 시 dirty 255개 상태를 보존했다. 건강검진 23항목과 AFP·간 초음파·복부 CT를 추출했고 HbA1c를 실제 기록으로 새로 만들지 않았다. 312개 평가 정의를 생성했으며 312개 모델 시험 PASS가 아니다. 등록 1,017 / 검색 후보 910 / 보류 107은 로컬 v3 corpus 기준이며 의료 콘텐츠 승인이나 실제 배포 증거가 아니다.

제목 부분 문자열이 양극성장애/제왕절개를 오연결하는 것을 발견해 v2에서 보정했다. v1은 이력으로 보존하며 현재 근거 선정에 사용하지 않는다. 기존 검사 화면의 출처 링크는 AI 재서술 이용허락으로 승계하지 않는다. 환자 기록 수치는 공용 corpus에 추가하지 않았고 HOLD 본문은 답변 입력에서 제외한다. 번역 중지 유지. 기존 수치 판정·인증·동의·API·DB·PACS 변경 없음. 관련 FR-006~009의 기록 목록 연계 분석 및 FR-037~041의 기존 감사 경로 확인이며 신규 의료 설명 기능의 요구사항 ID는 승인 문서에 추가 확인이 필요하다.

검증 명령: `node scripts/build-health-helper-scenario-scope.js` exit0, 모델 호출0. `node --test test/health-helper-scenario-scope.test.js test/medlineplus-upload.test.js test/synthetic-health.test.js test/patient-helper.test.js` exit0, 24/24 PASS, 723.0767ms. 검사 목록·보류 제외·해시·수치 비교·환자 기록 인증 거부·질문 메모 회귀 범위다. 실제 Qwen 응답·환자 브라우저·최신 B/Cloud 배포는 이번 단위에서 NOT VERIFIED. 최초 명령의 존재하지 않는 health-comparison.test.js는 검증 증거로 제외하고 실제 synthetic-health.test.js를 재실행했다.

다음 작업 한 개: CT 일반 개념 질문 → 출처 카드 → 원문 → 질문 담기·수정의 로컬 모델/브라우저 정상·거부 흐름 검증. 이후 실제 인증 API의 설명형 relay 계약을 별도 검토한다. AFP·간 초음파와 개별 검사 목적/한계/준비 근거 공백은 미완료로 남긴다. 커밋·푸시·등록·배포 없음, 전체 RAG/MVP/v3 완료 아님.
# 2026-10-12 26검사 일반 개념 근거 보완 — DRAFT / UNASSIGNED

현행 세부 기록: [시나리오 RAG 근거 보완](health-helper-scenario-evidence-20261012.md). 이전 v2 매핑의 기본 검색 후보4/보류4/부족18에 대해 별도 원문22개(정책 포함) 확인·snapshot/hash 및 한국어 개념 요약26개를 작성했다. 기존 HOLD107 보존/생성 제외, 사용자 자료 재번역·환자 수치/픽셀 사용 없음. **26개 일반 개념 후보 보완이며 전체8질문 차원의 상세 근거 확보 완료가 아니다.**

신규 로컬 candidate 127.0.0.1:11440 opt-in만 연결, 실제 인증 서비스/private visit relay/DB/PACS/배포 변경 없음. 관련 FR-006~009 연계 및 FR-037~046의 감사/개인 데이터 경계 유지; 신규 의학 설명 부가기능 FR/NFR 승인 ID 미확인. 기존 구현·미커밋 변경 보존. 번역 중지·커밋/푸시 금지 유지.

33/33 focused/regression PASS(exit0,818.2223ms). 로컬 Qwen/HTTP 최신 v3 7조건 PASS(exit0): AFP·간 초음파·CT extractive 설명, 근거 부족·임상 거부·개인입력 거부·보류 안내. `data/health-helper-scenario-check-20261012-v3/result.json`. 312개 routing 확인은 312개의 모델 품질 평가가 아니다. 최초 초음파 자유 재서술에서 unsupported 준비/기능 설명 발견: 품질 FAIL 이력 보존; 새 CONCEPT에서 공백 외 원문 요약 동일성 검증으로 차단했다. v2 CT whitespace-only assertion FAIL도 보존하고 런타임과 테스트 계약을 정렬했다.

의료전문가 검토·26개 전체 모델 응답·모든 상세 intent·최신 실제 배포·실제 환자 API 및 설치형 PWA는 NOT VERIFIED. 다음 작업 한 개: AFP 목적·한계·검사 간 역할·비교 조건의 별도 청크 보완/검토 후 동일 흐름 검증. 전체 RAG/MVP/v3 완료를 선언하지 않는다.
## 2026-10-12 간기능 상세근거 후보 — DRAFT / UNASSIGNED / 로컬 전용

현재 세부 기록: [간기능 검사 근거 후보](health-helper-liver-evidence-20261012.md). 간기능 패널·AST·ALT·GGT 목적·한계·준비 및 공통 비교조건 13개 프로젝트 작성 요약과 6개 원문 SHA snapshot. 자동 근거·입력/출력 제한은 focused 3/3 및 AFP·환자 helper 회귀 총 71/71 PASS.

전용 로컬 preview 11442에서 데스크톱과 모바일 helper surface의 정상/근거부족/진단거부, source drawer, 질문 담기·수정을 확인. 390px viewport 및 설치 PWA NOT VERIFIED. 공개 근거 후보는 고정·extractive 답변이며 Qwen 미사용. 새 MedlinePlus 링크/근거는 기존 KDCA 전용 source UI 및 인증 API에 연결하지 않음. 의료전문가 검토 `UNASSIGNED`; 실제 인증·감사 경로 연결·배포·복구 검증은 NOT VERIFIED. 전체 RAG/MVP/v3 미완료.

## 2026-10-12 초음파·CT 상세근거 후보 — DRAFT / UNASSIGNED

현재 세부 기록: [초음파·CT 근거 후보](health-helper-imaging-evidence-20261012.md). 두 검사 각각 목적·한계·준비·비교 준비 8개 고정 요약과 공개 원문/이용정책 5개 snapshot의 v6 SHA 검증을 추가했다. 초음파 결과 의미가 검사 부위에 따라 다름, 간 초음파 준비를 일반 안내에서 일괄 추정하지 않는 경계, CT 판독 전달·검사 준비, 이전 영상의 날짜·종류·기관 기록을 원문에 맞춰 보완했다. FDA 비교 카드 출처 제목을 실제 상위 페이지의 하위 섹션으로 명확히 했다. 개인 영상·픽셀·환자 기록 없이 고정 요약 후보로만 둔다.

75/75 focused/regression PASS(exit 0, 980.639ms). 상세 라우팅 8개, 원문 snapshot hash·이용정책·출처 링크, 개인정보/다중 질문/근거 부족/진단 거부 계약을 검증했다. v4 Playwright 로컬 화면 확인은 과거 버전 증거이며 v6 화면에서는 재확인하지 않았다. 설치형 PWA·인증 환자 API·실제 배포/rollback은 NOT VERIFIED. 의료전문가 검토 `UNASSIGNED`; 등록/배포/commit/push 없음.

다음 작업 한 개: 나머지 건강검진 상세 근거 공백을 같은 출처·저작권·임상 검토 분리 기준으로 보완하고, 근거 부족/거부를 자동시험한다. 건강 전문가 승인과 기존 인증·권한·감사 API 계약 검토 전 서비스 연결은 하지 않는다. 전체 RAG/MVP/v3 완료가 아니다.

## 2026-10-12 영상공유 지갑 v2 — 로컬 구현 / DRAFT / UNASSIGNED

기준 HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`, dirty 상태 및 기존 변경 보존. 사용자 승인 시안을 기준으로 frontend-design 지침에 따라 기존 블루/화이트/블루그레이, 기존 폰트와 실제 입력 컨트롤을 유지했다. 신규 SVG 외피/중앙 접힘/봉제선/포켓을 직접 구성한 2D 레이어 모델이며 3D mesh 제작으로 주장하지 않는다. 카드 모양은 별도 CSS 컴포넌트로 구성했다. 웹의 검사 미리보기·검사 변경·기관별 요약·1/3/7일 초안 입력, 모바일 기존 단계별 공유 카드에 적용하고 PWA 공개 자산 캐시를 v36으로 갱신했다. 빠른 기간 선택은 서버가 승인한 권한을 뜻하지 않으며 최종 서버 검증을 유지한다.

생성: `public/images/mediq-sharing-wallet-v2.svg`, `public/images/mediq-sharing-pocket-v2.svg`, `public/ui/sharing-wallet-v2.css`, `scripts/sharing-wallet-preview.js`. 수정: `public/ui/patient-sharing.js`, `public/index.html`, `public/mobile/index.html`, `public/mobile/sw.js`, `test/patient-sharing.test.js`, 이 상태 기록. 관련 FR 기능군: FR-001~005 동의 UI, FR-006~009 검사 선택; FR-014~025 권한/토큰 계약은 변경하지 않았다. 개별 요구사항 원문 미확보로 새 ID 부여 없음. DB/API/인증/감사/영상 경로 변경 없음, 개인정보·비밀정보 추가 없음.

검증: `node --test test/patient-sharing.test.js test/patient-share-review.test.js test/mobile-health-helper.test.js test/wallet-open.test.js test/wallet-home.test.js test/patient-helper.test.js test/mobile-capstone-auth.test.js` 48/48 PASS, exit 0, 398.3235ms. `node --check scripts/sharing-wallet-preview.js` 및 `git diff --check` PASS. Playwright 로컬 합성 UI fixture에서 웹 1440/1024/768/390/320px, 모바일 390/360/320px 가로 넘침 없음, 웹 3일 선택/종료일 공란 차단 PASS. 모바일 fixture 이동은 시각 검증용 핸들러로 실제 서버 승인 검증이 아니다. 캡처: `output/playwright/sharing-wallet-v2-desktop.png`, `output/playwright/sharing-wallet-v2-mobile.png`. 서버 API를 mock하여 종단 성공으로 보고하지 않는다. 초기 preview의 HTML 인라인 script 종료 문제 수정 후 재검증했다.

원격: B 포털 Node HTTPS 연결의 프로젝트 CA 검증 PASS (`tlsAuthorized=true`), HEAD 응답 405는 readiness PASS가 아니다. Windows curl은 인증서 폐기상태 확인 실패로 종료했으며 검증 해제 옵션을 쓰지 않았다. 기존 배포 스크립트는 B VM credential 비공개 입력 및 정확한 이미지/scan/rollback 검증을 요구한다. 현재 인증수단 미제공으로 실행 이미지 확인·후보 배포·rollback·인증 브라우저 E2E는 NOT VERIFIED. 사용자에게 승인된 SSH 키/보안 입력 경로를 요청했다. 기존 배포본·DB·PACS 변경 및 commit/push 없음. 다음 작업: B VM 인증 후 실제 baseline 확인 → 한정 UI 후보 검증/배포/rollback → 웹/PWA 동일 흐름 확인. 전체 RAG/MVP/v3 완료가 아니다.

재현: `node scripts/sharing-wallet-preview.js` 실행 후 `http://127.0.0.1:11447/preview` 또는 `/preview?mobile=1`. loopback 공개 UI 자산만 제공하며 실제 환자 API/승인/영상 접근 없음. 배포하지 않았으므로 서비스 복구 작업은 해당 없음.

## 2026-10-12 질문 담기 상호작용 — DRAFT / UNASSIGNED

웹/PWA 공통 `public/ui/patient-helper.js`에서 추천을 담으면 220ms 위쪽 페이드 후 목록에서 제거한다. 동작 줄이기는 즉시 제거한다. 담은 질문의 수정과 추천 원문 식별을 분리하여 새 대화에서도 재등장하지 않게 하고, 마지막 담기의 실행 취소·원래 순서 복원, 전체 담기 빈 상태, 중복 클릭 차단, 12개 한도 실패 시 추천/직접 입력 유지, reset 이후 늦은 애니메이션 무효화를 구현했다. 서버 저장이 아닌 기존 페이지 세션 메모이며 새로고침 시 사라진다. 기존 색감/폰트 유지, frontend-design 지침에 따라 사용자 동작에만 전환을 적용했다.

변경: 공통 렌더러, `test/patient-helper.test.js`, 이 기록. 신규 파일 없음. 관련 요구사항: 사용자 승인 질문 카드 UX; 기존 정의서에서 전용 FR/NFR ID 확인되지 않아 신규 ID를 만들지 않았다. 인증/권한/감사 API 및 DB 계약 변경 없음, 민감정보 전송/지속 저장 추가 없음.

검증 명령: `node --test test/patient-helper.test.js test/mobile-health-helper.test.js test/health-helper-http.test.js test/helper-extracted-design.test.js` — 28/28 PASS, exit 0, 332.3311ms. 최초 기존 테스트는 제거된 카드 대신 다음 카드를 눌러 중복으로 오인하여 FAIL; 동일 버튼 재클릭을 검증하도록 수정했고 별도 제거/수정/취소/한도/동작 줄이기/reset 시험을 추가했다. DOM 모형/계약 시험이며 실제 브라우저 시각 검증은 NOT VERIFIED. `git diff --check` exit 0. 배포·rollback·commit·push는 하지 않았다. 다음 작업: 실제 웹/모바일 브라우저에서 포커스와 전환 확인. 전체 RAG/MVP/v3 완료가 아니다.

## 2026-10-12 잔여 건강검진 주제 상세 근거 — DRAFT / UNASSIGNED

현재 세부 기록: [건강검진 상세 근거 후보](health-helper-screening-evidence-20261012.md). AFP·간기능·초음파·CT 다음으로 건강검진 20개 주제의 목적·한계·준비·비교 80개 고정 한국어 요약을 작성했다. MedlinePlus/FDA 출처·이용정책 19개 snapshot 및 해시를 별도 v1 경로에 저장했고, source notes와 manifest SHA를 검증했다. 환자 수치·영상·임상 진단을 근거로 사용하지 않으며, 일반 정상범위/진단 기준 숫자 답변은 하지 않는다. 일부 비검사실 비교 체크리스트는 프로젝트 작성 사항으로 공식 권고와 구분한다.

신규 focused·거부·출처 검증 및 AFP/간기능/영상/RAG/HTTP/환자 웹·모바일 회귀 79/79 PASS(exit 0, 1.214초). 이는 코드 라우팅·입출력·해시 검증이며 의료전문가 콘텐츠 검토 PASS가 아니다. 현재 screening 후보 코드는 생성 스크립트·테스트에서만 import되고 인증 HTTP API, 화면, DB, 감사 경로에 연결되지 않았다. 기존 KDCA-only 사용자 경로는 변경하지 않았다. 의료전문가 원문 대조 검토, 승인 후 인증·권한·감사 연결, 실제 웹/모바일 정상·거부·근거 부족·질문 카드 E2E, 배포·rollback 재검증은 `NOT VERIFIED`. 신규 FR/NFR ID는 만들지 않았고 기존 FR-006~009 및 FR-037~046 경계를 유지한다. PACS 변경·등록·배포·commit·push 없음. 전체 RAG/MVP/v3 완료가 아니다.
