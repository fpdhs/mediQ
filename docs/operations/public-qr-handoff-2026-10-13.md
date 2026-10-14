# 공개 웹 QR 발급·시연 접수

## 작업 목적

환자 동의 후 QR 미표시 경로를 수정하고, 의료진은 QR 촬영 대신 환자에게 받은 코드를 입력하여
동일한 일회용 티켓·권한 검증을 수행한다. **DRAFT / UNASSIGNED**, 실제 Entra 양쪽 계정 E2E는 미검증.

## 관련 요구사항

FR-001~005 동의, FR-010~020 인증·정책, FR-021~025 단기 토큰, FR-037~041 감사.

## 분석한 기존 구조

Node.js Control + 별도 공개 웹 edge + 정적 JS 화면. 기존 patient QR controller는
서버 티켓 상태 확인 후에만 QR을 표시한다. 기존 QR 생성기/스캐너를 재사용했다.
공개 edge에는 발급 POST와 상태 GET이 빠져 있었다. 기존 시뮬레이션은 의료진이 환자 발급까지
시도하는 복합 역할 방식이어서 실제 Entra 분리 계정에 부적합했다.

## 구현한 기능

- 환자 소유권을 검증하는 기존 발급·상태 API만 edge 허용 목록에 추가.
- 발급 QR의 불투명 nonce 경로는 유지하고 공개 앱 origin으로 정렬.
- 새 동의 시작 시 이전 nonce 제거, QR 실패 안내, 승인 후 QR 화면 진입.
- 서버가 ISSUED로 확인한 QR에서만 `시연용 연결 코드 복사` 제공. 만료 시 복사 차단.
- 의료진 시연도구 `시연 QR 불러오기`: 입력칸만 열며 발급/소진/허용 상태를 만들지 않는다.
- `공유 확인하고 접수`를 눌러야 서버 검증 및 실제 일회용 소진 수행.
- 공개 접수 성공을 영상 픽셀 표시 성공으로 오인하지 않도록 별도 표시.
- 기존 지갑/의료진 디자인과 폼을 유지. UI 스킬의 오류 복구·상태 피드백 기준을 적용.

## API 변경 / 보안 검토

| API | 변경 | 통제 |
|---|---|---|
| POST /api/consents/{id}/handoff-ticket | 공개 edge 허용, QR origin 정렬 | 환자 인증·소유권·유효 동의 |
| GET /api/consents/{id}/handoff-tickets/{ticketId} | 공개 edge 허용 | 환자 소유권, 최소 상태, no-store |
| POST /api/demo/qr/redeem | 신규 공개 전용 별칭 | Entra 합성 환경 + DOC-B-01/HOSP-B + 기존 redeemViewerHandoff |
| POST /api/transfers/tickets/redeem-viewer | 내부 경로 유지 | 기존 origin/DPoP 유지, 공개 edge 차단 |

추가 body 필드 inputMethod는 CAMERA/MANUAL/DEMO_IMPORT/UNSPECIFIED만 허용한다.
이는 사용자 입력 출처 표기이지 촬영의 증거나 권한이 아니다. 감사 userAgent에 QR_INPUT 태그를 남긴다.
실제 권한은 인증된 의료진, 대상 병원, 현재 동의, 기간, 범위, DPoP, 일회용 상태로 검증한다.
시연 API는 고정 합성 환경/의료진만 허용한다. 일반 의료진 계정에 환자 역할을 부여하지 않는다.
QR 원문/nonce를 서버 로그에 추가하거나 저장소에 저장하지 않았다. DB 변경 없음.
QR 입력 전용 화면을 여는 행위에는 서버 권한이 생기지 않는다.
환자용 영상 진입점/B/PACS/Key Vault/Entra 역할 매핑은 이번 배포에서 변경하지 않았다.

## 생성한 파일

- src/public-qr-handoff.js
- test/public-qr-handoff.test.js
- scripts/qr-public-release.py
- scripts/verify-qr-public-release.py
- 본 문서

## 수정한 파일

- src/server.js, src/patient-public-origins.js
- scripts/start-public-web.js
- public/app.js, public/ui/patient.js, public/ui/demo-tools.js, public/mobile/sw.js (v47)
- test/demo-tools.test.js, test/patient-ticket-status-http.test.js

실행 중인 파일을 캡처한 뒤 정확한 함수/구문만 패치했다. 기타 dirty UI/RAG 변경을 포함하지 않았다.
Azure azd 스킬은 기존 비-azd VM 배포와 맞지 않아 기존 immutable image overlay 방식 사용.

## 배포·복구

Control: sha256:34c18b6ea122f941c9ddaa4ec21211fa1598379993e39eeca0bd7dae10b5bb07

web: sha256:e486d24da9afc3dde2bf3ddaf0b44e29181d0ebc307cde36d8b7e9ea6ea63562

초기 후보 배포 후 기존 Control/web 이미지로 복구하여 healthy 확인. 이후 내부 B QR origin
호환성을 위해 공개 접수 경로를 분리한 최종 후보를 배포했다.
원래 포트·마운트·권한·네트워크·관련 없는 환경변수 불변을 검사했다.
복구: `python scripts/qr-public-release.py rollback` (승인된 Cloud SSH 키 필요).
서버 보호 설정: /opt/highpass/qr-public-rollout-20261013.
증적: artifacts/azure/qr-public-20261013.

## 테스트 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| QR·동의·메뉴 회귀 | PASS | 최종 동일 묶음 58/58 |
| 공개/내부 origin 분리 및 HTTP 후속 | PASS | 12/12 재시험 |
| 실제 QR encoder→pixel→scanner | PASS | 동일 공개 nonce 링크 복원 |
| 격리 HTTP 정상 접수 및 재사용 거부 | PASS | MANUAL ALLOWED → DENIED |
| mock에서 공개 시연 입력 거부 | PASS | 403 |
| 무인증·환자 계정의 의료진 접수 거부 | PASS | 격리 HTTP 401/403 |
| Azure 배포 파일·경로 | PASS | 최종 12/12, 무인증 QR API 401, 내부 API/영상 403 |
| 서비스 상태 및 이전 이미지 복구 | PASS | Control healthy, web running |
| 실제 Entra 환자 QR 화면·의료진 접수·감사 | NOT VERIFIED | 브라우저 로그인 입력 대기 |
| 모바일 실기기·카메라 촬영 | NOT VERIFIED | 정적 캐시와 API 배포 검증과 구분 |
| 의료진 외부 영상 픽셀 표시 | NOT VERIFIED | 이번 QR 접수 배포와 별도 |

메뉴 시험 최초 1개는 공개 QR 메뉴 변경에 따른 기대값 불일치로 FAIL했고,
새 정책(입력만 허용, 서버 검증 유지)에 맞춰 고친 뒤 PASS.

## 남아 있는 위험 / 미검증 사항

기발급 QR 원문은 서버에서 복원하지 않는다. 페이지를 잃었거나 이미 발급된 티켓이 있는 경우
자동으로 새 nonce를 만들거나 기존 티켓을 몰래 무효화하지 않는다. 명시적인 재발급 정책은 별도 작업이다.
실제 Entra 두 계정과 실기기에서 최종 검증이 필요하다. 전체 MVP 완료로 보고하지 않는다.
커밋·푸시하지 않았다.
