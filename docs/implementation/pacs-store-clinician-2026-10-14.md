# 의료진 B PACS 보관과 영속 작업 이력

## 작업 목적과 결정

- 확인된 요구사항: PC 다운로드는 차단하고 B병원 PACS 보관만 제공한다.
- 합리적 가정: 기존 DOWNLOAD_ALLOWED 동의를 병원 간 보관 권한으로 사용한다. 새로운 연구·AI 반출 권한을 만들지 않는다.
- 구현 결정: 선택한 Instance 한 건을 기본으로 담고, 최종 확인 후 서버의 영속 작업을 생성한다. Series 추가는 별도 명시적 행동이다.
- 남아 있는 불확실성: 기존 B PACS 저장본의 보존기간·철회 후 삭제는 별도 정책과 검증이 필요하다. 공유 만료를 저장본 자동 삭제 완료로 표현하지 않는다.

관련 요구사항은 FR-001~005(동의), FR-010~013(의료진 접근), FR-014~020(정책), FR-021~025(토큰), FR-026~031(Gateway), FR-032~036(Viewer), FR-037~041(감사) 기능군이다. 개별 원문과 NFR 번호는 docs/REQUIREMENTS.md의 미확정 상태를 유지한다.

## 분석한 기존 구조

Azure의 실행 중 웹은 로컬의 영속 전송 작업 코드보다 이전 버전이었다. 기존 병원 보관함은 로컬 모의 반입 API를 호출했으며, 인터넷 웹에서는 해당 경로가 차단되어 있었다. Control에는 작업 런타임과 전용 DB 권한 설정이 없었다. 기존 A Gateway, B 수신 PACS, Entra 인증, DPoP, mTLS, 키 릴리스 검증을 재사용한다.

## 구현과 파일

수정: public/app.js, public/index.html, src/pacs-transfer-jobs.js, src/pacs-transfer-job-http.js, src/pacs-transfer-job-runtime.js.

재배포 경계 정렬: scripts/start-public-web.js, infra/azure/patient-images-b.Caddyfile, scripts/patient-viewer-rollout-remote.py. 실제 VM 설정을 덮어쓴 것이 아니라 작업 API 및 CORS의 동일한 허용 범위를 저장소 템플릿에도 반영했다.

추가: public/ui/transfer-actions.js, public/ui/transfer-actions.css, test/transfer-actions.test.js, scripts/pacs-store-cloud-release.py, scripts/pacs-store-b-session.py, scripts/pacs-store-b-edge-guest.py, scripts/pacs-store-live-verify.py, scripts/pacs-store-runtime-inspect.py.

기존 db/migrations/039_capstone_pacs_transfer_jobs.sql과 src/capstone-b-portal.js, src/capstone-encrypted-transfer.js, src/consent-bound-key-release.js, src/key-release-http-handler.js의 작업 바인딩 구현을 배포에 포함했다. 원본 DICOM은 Control DB에 저장하지 않는다.

## API 변경

| 변경 전 | 변경 후 | 영향 |
|---|---|---|
| 인터넷에서 모의 POST /api/transfers/pacs-import 호출 | POST /api/pacs-transfer-jobs → POST /{jobId}/claim → B Gateway의 단일 Instance /import | 보관 확인·실행·재개 |
| 진행 중 작업만 조회 | GET /api/pacs-transfer-jobs/history 추가 | 완료·실패·미완료 이력, 최근 50건 |
| PC 다운로드 핸들러 존재 | 숨김·비활성화, 핸들러도 바이트/토큰 요청 없이 차단 | PC 다운로드 제공하지 않음 |

history는 인증된 의료진과 수신 병원으로 SQL을 바인딩한다. 사용자 지정 조회 필터는 받지 않으며 no-store와 감사 저장을 적용한다. 작업 상세 조회 역시 동일한 소유자·병원 제한을 유지한다.

## 보안 검토

생성·claim마다 현재 동의·기관·Study/Series·목적·DOWNLOAD_ALLOWED를 서버가 다시 확인한다. B가 인증된 키 릴리스 채널로 작업/항목/lease와 PACS 재조회 영수증을 보고해야 검증 건수가 증가한다. 프론트엔드는 자체 성공 기록을 만들지 않는다. VIEW_ONLY, 철회, 만료, 범위·병원 불일치, 원본 해시·목적지 UID 불일치는 자동시험에서 거부된다.

전용 PostgreSQL 역할은 작업 메타데이터 두 테이블의 SELECT/INSERT/UPDATE만 허용한다. 비밀 URI는 VM의 읽기 전용 파일 마운트로 전달한다. 실패한 초기 배포의 미사용 역할은 NOLOGIN 처리했다. 새 유료 Azure 리소스나 포트는 생성하지 않았다. 공용 원본 DICOM GET 및 /download는 계속 차단한다.

## 배포와 검증

Azure 확인 주소: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/

실행 중 이미지와 소스를 해시로 고정하고, 현재 버전에 필요한 부분만 덧씌웠다. 다른 디자인·인증 변경과 포트·마운트는 보존했다. 롤백 설정 및 원본 Caddy 설정은 VM의 제한된 배포 디렉터리에 남긴다.

| 테스트 | 결과 | 근거 |
|---|---|---|
| 전송·정책·암호화·UI 관련 자동시험 | PASS | 14개 파일, 93개 시험 통과 |
| 실제 배포 후보의 B import 라우팅 | PASS | PACS_STORE_CANDIDATE_APP로 후보 소스를 시험, 3개 통과 |
| 공용 JS/CSS와 최종 후보 해시 | PASS | pacs-store-live-verify.py |
| 비로그인 작업 조회 / 외부 Origin 반입 / 무증명 반입 | PASS | 각각 401 / 403 / 401 |
| 공용 PC 다운로드 / 원본 DICOM | PASS | 각각 403 |
| 작업 헤더 포함 OPTIONS | PASS | 지정 Azure Origin에 204 |
| 실제 합성 CT 조회 | PASS | 정상 의료진 로그인 → 단기 토큰 → 700개 Instance → 실제 Slice 1 표시 |
| 새 영속 작업 생성 및 미완료 이력 | PASS | 선택 CT 한 건으로 작업 생성, 0/1 미완료 표시 |
| 새 작업의 실제 B PACS 보관 완료 | PASS | 동일 작업 재개 후 서버 COMPLETED, 1/1 검증 완료, B 저장본 해시 일치 영수증 |
| 실제 감사·DB 영속 기록 | PASS | 작업 1개/검증 완료 1개, PACS_IMPORT_AUTHORIZED·PACS_INSTANCE_VERIFIED 및 이력 조회 감사 확인 |
| 데스크톱·모바일 표시 | PASS | 1536px/390px 뷰포트, 페이지 가로 넘침 없음, 완료 영수증 표시 |
| 실제 의료기관 운영 / 전체 700개 전송 / 철회 후 B 저장본 삭제 | NOT VERIFIED | 이번 검증 범위 제외 |

## 남아 있는 위험

브라우저가 작업을 순차 구동하므로 페이지가 닫히면 남은 작업은 자동 백그라운드 실행되지 않는다. 서버 작업 이력에서 선택 후 재개한다. 불명확한 수신 응답은 성공으로 표시하거나 즉시 자동 재전송하지 않는다. 실패·철회·만료 표시는 서버 상태를 따른다. 공용 웹에는 검증된 내 보관 작업 이력을 표시하고, 별도 로컬 모의 PACS 전체 목록은 숨긴다.

초기 실제 시도에서는 상위 Gateway 응답 중단(UPSTREAM_ABORTED)이 있었으며 완료 건수를 올리지 않았다. 응답 불확실성과 서버 저장 작업을 유지하고, 최종 정상 인증 재개에서 동일 작업이 1/1 완료되었다. 이번 검증은 합성 CT Instance 한 건이며 전체 Study 자동 다운로드가 아니다.

최종 웹 배포: artifacts/workstation/pacs-store-cloud-25b35d5e08ce447c9c3a0088b217e048/result.json.
최종 공용 경계·DB·감사 검증: artifacts/workstation/pacs-store-verify-ed43bab2a9b84ac9ac3acbc72d692912/result.json.
화면 증적: pacs-store-azure-desktop-20261014.jpg, pacs-store-azure-mobile-20261014.jpg.
