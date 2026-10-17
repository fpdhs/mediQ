# 공유 QR 티켓 구현·Azure 배포

## 작업 목적

환자 지갑의 ‘공유 내용 확인’을 QR 아이콘이 있는 ‘공유 QR’ 카드로 전환한다. 클릭 시 기존 지갑 아래 연결을 유지하며 QR과 해당 동의 내용을 함께 보여준다.

## 관련 요구사항

- FR-001~005: 본인 동의·기간·철회 보존
- FR-014~025: 병원·범위·권한 검증 및 단기 티켓
- FR-037~041: 기존 티켓 무효화·신규 발급 감사
- NFR: 인증 유지, 개인정보 최소화, 접근성·반응형. 개별 NFR 번호는 이번 작업에서 확정하지 않음.

## 분석한 기존 구조

Vanilla JS 웹과 별도 모바일 PWA, 공유 wallet-home 컴포넌트, 서버 확인 영수증에 묶인 QR 컨트롤러. Azure Control은 원본 영상을 저장하지 않는다. 티켓 원문은 브라우저 메모리에만 있고 서버에는 nonce hash만 저장하므로 새로고침 시 원문 복원이 불가능하다.

## 생성한 파일

- public/ui/patient-qr-ticket.js, public/ui/patient-qr-ticket.css
- test/patient-qr-ticket.test.js
- scripts/qr-ticket-release.py, scripts/verify-qr-ticket-release.py
- 본 보고서

## 수정한 파일

- public/app.js, public/index.html, public/ui/wallet-home.js
- public/mobile/app.js, public/mobile/index.html, public/mobile/sw.js
- src/server.js, src/services.js
- test/transfer-ticket.test.js, test/patient-ticket-status-http.test.js
- scripts/preview-patient-task-ui.js (loopback 합성 화면 전용)

## 구현한 기능

- 공유 QR 카드·QR 벡터 아이콘, 병원에 보여줄 QR 티켓 화면
- 여러 동의의 티켓 선택, QR 아래 수신 병원·제공 병원·검사·범위·목적·권한·시작/종료 표시
- QR 사용 기한과 공유 동의 기간 분리, 공유 내역·관리 연결
- 명시적 확인 후 새 QR 발급. 카드 진입만으로 자동 발급하지 않음
- 모바일 같은 컴포넌트 연결, PWA shell v48

## API 변경

변경 전: POST /api/consents/{id}/handoff-ticket, 기존 ISSUED 티켓 있으면 충돌.

변경 후: 선택적 boolean `replaceExisting:true`일 때만 기존 미사용 티켓을 REVOKED로 전환하고 새 티켓 발급. 생략 시 기존 충돌 계약 유지. 본인 인증, 동의 상태/시간/범위 검증 후 실행. 응답 no-store. 공유 동의 자체의 권한·기간 변경 없음.

영향 화면: 웹·모바일 공유 QR. 영향 시험: ticket service, HTTP ownership/status, QR controller, wallet/sharing regression.

## 보안 검토

QR은 기존 opaque nonce이고 PHI·원본 영상·복호화 키를 포함하지 않는다. 서버의 exact ticket/consent/expiry 영수증을 확인해야 표시한다. 이전 QR 무효화·새 발급을 감사하고, 만료/철회/네트워크 오류 시 QR를 숨긴다. 인증·DPoP·영상 경로·PACS·방화벽·비밀정보 구성은 변경하지 않았다. UI/UX 스킬의 상태 안내·44px 조작 영역·반응형 기준을 적용했다. azd 전제 스킬은 기존 VM overlay 배포에 맞지 않아 기존 좁은 파일 배포 경로 사용.

## 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| 관련 자동 테스트 | PASS | 9개 test 파일, 61/61 |
| 본인만 재발급, 잘못된 입력 거부 | PASS | 격리 DEVELOPMENT_MOCK HTTP 시험 |
| 기존 nonce 거부·새 nonce 접수·철회 차단 | PASS | service 시험; 실제 Entra와 구분 |
| 서버 영수증 불일치·만료·철회·사용됨·연결 실패 | PASS | QR controller 시험 |
| 로컬 티켓 화면·375px/812px 가로 넘침 | PASS | CUA DOM: 360<=375, 797<=812; 합성 미발급 화면 |
| Azure 정적 파일·스타일·401/403 경계 | PASS | public-verification.json 12/12 |
| 이전 이미지 복구 | PASS | rollback 결과 및 healthy 확인 |
| 실제 Entra 환자 발급→의료진 QR 접수 | NOT VERIFIED | 실제 로그인 세션 확인 필요 |
| 실기기 카메라·PWA 재설치/업데이트 | NOT VERIFIED | 물리 기기 시험 미실행 |

## 배포·복구

현재 실행 파일에서 필요한 부분만 추출·대조한 overlay. artifacts/azure/qr-ticket-20261013/review.diff 및 phase JSON이 증적이다. 기존 dirty worktree 전체를 배포하지 않았다. 복구: `python scripts/qr-ticket-release.py rollback`. 재적용: `python scripts/qr-ticket-release.py deploy`. 확인: `python scripts/verify-qr-ticket-release.py`.

## 남아 있는 위험·미검증 사항

- 재발급은 기존 단일 Control writer/저장소 구조를 이용한다. 다중 writer/HA 원자성·장애 주입·실제 Azure PostgreSQL 재발급 영속성은 NOT VERIFIED. 운영 수준의 분산 트랜잭션 완료로 해석하지 않는다.
- 실제 계정에서 QR 발급, 재발급 후 이전 QR 거부, 새 QR 의료진 접수는 사용자 로그인 후 확인 필요.
- 실제 모바일 기기, 확대 글꼴·고대비·스크린리더 전체 검증은 NOT VERIFIED.
- 검증된 QR 티켓이 영상 전송·PACS 저장 완료를 의미하지 않는다. 원본 전송 경로 변경 없음.
- 커밋·푸시하지 않음. 전체 MVP/v3 완료 아님.
