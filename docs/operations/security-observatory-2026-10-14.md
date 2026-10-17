# 보안 관제실 구현 메모 — 2026-10-14

상황판·검색·보고서의 후속 Azure 배포 결과는 [보안 관제실 상황판 적용 기록](security-console-dashboard-2026-10-14.md)에 기록했다. 기존 로그인·Key Vault 연결 이후의 최신 실행 이미지는 해당 문서를 기준으로 확인한다.

## 최신 Azure 적용 결과 — 2026-10-14 KST

아래의 초기 미배포 기록 이후, 기존 실행 이미지 위에 이번 변경만 추가하여 Azure Control/Web을 전환했다.

- 수락된 지정 보안관리자 게스트의 Entra Object ID를 서버 `SECURITY_ADMIN`으로 적용했다. 기존 PATIENT/DOCTOR 항목은 그대로 보존했다. 실행 컨테이너의 actor-map 해시와 승인된 후보의 해시가 일치한다.
- 기존 Medi Q 지갑 로그인 톤의 보안 운영자 진입 화면과 Microsoft 인증을 연결했다. 고정된 같은 출처 `loginIntent=security`는 화면 이동에만 사용한다. 역할은 매 요청 서버에서 확인한다.
- `GET /api/security/overview`, `POST /api/security/reviews`만 기존 공개 웹 엣지에 추가했다. 미인증·변조 토큰·역할 위조 헤더 요청은 거부한다.
- 관제 조회는 `SECURITY_OVERVIEW_READ`, 역할 거부는 `SECURITY_CONSOLE_DENIED`, 검토 메모는 `SECURITY_REVIEW_RECORDED`로 기존 append-only 감사 저장소에 기록한다.
- Control의 기존 세 개 내부 Docker 네트워크는 그대로 유지했다. 인터넷·IMDS 직접 접근을 열지 않았다. 전용 감사 reader는 공개 포트 없이 고정된 Unix 소켓의 `/keyvault-audit` 조회만 제공한다. 지정 workspace의 Key Vault 24시간/100건 제한 조회만 실행하며 MI 토큰·임의 URL·임의 KQL API를 제공하지 않는다.
- Azure 관리 ID를 통한 실제 Log Analytics 조회: **PASS**, 최종 확인 시 Key Vault 기록 **62건**, 24시간 범위. 이 수치는 확인 시점의 결과이며 고정된 시연 수치가 아니다.
- 이전 이미지 위 배포 후보의 인증/관제 테스트 **29/29 PASS**, 소켓 연결 추가의 Azure reader 테스트 **4/4 PASS**. 관리자 검토 저장, 환자/의료진 거부는 격리 시험에서 확인했다. 실제 세 계정의 Microsoft 브라우저 로그인 및 운영 API 호출은 **NOT VERIFIED**.
- 최종 Control 소스 5개 및 공개 웹 소스 10개 해시 대조, 환자 웹/모바일 셸 HTTP 200, 공개 관제 미인증/변조 토큰 HTTP 401: **PASS**. PostgreSQL/WAF/사설 ingress 컨테이너는 유지했다.
- 최종 로컬 인증·관제 관련 테스트 **30/30 PASS**. 실제 Azure 로그인 화면의 기존 지갑 이미지·Medi Q 색감, 보안 운영자 문구·세 단계·Microsoft 버튼을 확인하고 Microsoft 계정 선택 화면까지 진입했다. 화면 증적: `docs/implementation/security-operator-login-azure-20261014.jpg`.
- 지정 계정으로 Microsoft 이메일 인증의 코드 입력 화면까지 도달했다. 코드는 사용자 본인이 해당 화면에서 입력해야 하므로 실제 보안관리자 세션의 관제실 진입·운영 검토 저장은 **NOT VERIFIED**다. 코드·토큰·인증 응답은 증적이나 채팅에 저장하지 않았다.
- 복구용 이전 Compose 설정과 이미지 ID는 보호된 서버 release에 보존했다. 실제 운영 복구 전환 리허설은 **NOT VERIFIED**. 새 유료 Azure 리소스, Azure RBAC 확장, PACS·DICOM 변경은 없었다.

접속: `https://highpass-demo.japaneast.cloudapp.azure.com/hipass/?loginIntent=security`

근거: Git 제외·ACL 보호 폴더 `artifacts/azure/entra-web-20261014T044203Z-c8be5a/`의 `stage.json`, `build.json`, `deploy.json`, `audit-relay.json`, `verify.json`, `final-manifest.json`. 계정 식별자·실행 설정 원문은 공개 증적으로 복사하지 않는다.

관련 소스: `src/auth.js`, `src/server.js`, `src/azure-keyvault-audit.js`, `src/security-observatory-view.js`, `scripts/start-security-audit-relay.js`, 로그인/관제 UI. 재현 경로: `scripts/security-observatory-release.py`, `scripts/security-observatory-remote.py`, `scripts/security-audit-relay-release.py`. 기존 실행 상태가 달라지면 기준 이미지 검증이 중단되므로 과거 배포 후보를 그대로 재실행하지 않는다.

## 초기 구현 범위 (아래 미배포 상태는 초기 관측 기록)

- 화면 진입은 `SECURITY_ADMIN` / `PLATFORM_ADMIN`에 한정한다. 일반 의료진과 환자에게 전역 감사 화면을 노출하지 않는다.
- 앱 감사기록은 최근 조회 범위 내 타임라인과 접근 거부·실패 신호로 표시한다. 기존 원본 감사기록은 append-only로 유지한다.
- Azure Key Vault는 서버에서만 Log Analytics Query API를 호출한다. 브라우저에 Azure 자격 증명이나 쿼리 토큰을 전달하지 않는다.
- Key Vault 로그 결과는 24시간, 지정된 두 Key Vault, 최대 100건으로 제한한다. 요청 URI·원시 상관 ID·작업자 클레임은 관제 API 응답에 포함하지 않는다. 화면의 이벤트 참조값은 제한된 필드의 SHA-256 지문이다. 결과 서명은 허용된 짧은 상태만 노출하며, 앱 감사사유는 정형 코드 또는 `DETAILS_REDACTED`로 축약한다.
- 검토 상태·사건 참조·운영 메모는 `SECURITY_REVIEW_RECORDED` 이벤트로 추가한다. 원본 앱 로그 또는 Azure 로그를 변경·삭제하지 않는다.

## 연결 계약

- `GET /api/security/overview` — Security/Platform Admin 전용. 앱 감사기록, 실패·거부 신호, 해시 체인 점검, Azure Key Vault AuditEvent, 검토 이력을 반환한다.
- `POST /api/security/reviews` — 동일 관리자 전용. 최근 조회 범위에서 실제로 확인되는 앱 경보 또는 Key Vault 이벤트에만 검토 기록을 추가한다.
- 공개 웹 엣지에는 위 두 경로만 추가 허용하며, 기존 세션의 Bearer 인증을 Control Plane으로 전달한다.
- `HIPASS_AZURE_AUDIT_MI_ENABLED=1` 및 유효한 `HIPASS_AUDIT_WORKSPACE_ID`가 모두 없으면 Azure 출처는 `not_configured`로 표시된다. 조회 실패·권한 부족은 0건과 구분한다.

## Entra 및 Azure 준비 경계

- 사용자가 초대 수락을 완료했다. Entra 게스트 `Accepted` 상태와 기존 합성 API·SPA 앱의 보안관리자 앱 할당을 확인했다. 환자·의료진 매핑을 보존한 `PATIENT,DOCTOR,SECURITY_ADMIN` actor map과 공개 리디렉션 구성을 보호된 로컬 증적으로 생성했지만, 해당 매핑은 아직 Control VM에 배포되지 않았다.
- Azure VM `vm-highpass-capstone`의 시스템 할당 관리 ID를 활성화했다. 해당 principal에는 `law-highpass-key-audit-20261013` workspace 리소스 범위에만 `Log Analytics Reader`를 할당했으며, 할당 scope/principal readback을 확인했다.
- Key Vault `AuditEvent` 진단 설정은 이미 위 지정 workspace로 전송하도록 구성되어 있다. 런타임 API 배포 후 실제 IMDS 토큰 취득·Log Analytics 조회까지는 별도 확인이 필요하다.
- 이 연결에는 기존 VM과 기존 workspace만 사용했다. 새 Azure 리소스는 만들지 않았다.

## 상태 및 한계

- 로컬 코드·화면·역할 경계: 구현 및 선택 테스트 **PASS**. 실제 Azure Control/Web 반영과 브라우저 시연은 **NOT VERIFIED**.
- Azure Key Vault AuditEvent 수집 설정은 기존에 확인되어 있다. 이는 앱 로그인·환자 동의·토큰 거부 이벤트 전체를 대신하지 않는다.
- VM 관리 ID와 지정 workspace의 `Log Analytics Reader` RBAC 설정: Azure 구성 readback **PASS**. Entra 게스트 수락·API/SPA 앱 할당·보호된 actor-map 생성: **PASS**. 운영 배포 경로의 기존 배포 스크립트가 이전 candidate를 고정 참조하고 현재 Control/Web 이미지와 맞지 않아 실행하지 않았다. Control VM 적용, 앱 배포, 실제 MI 토큰 사용, workspace 쿼리, SECURITY_ADMIN 로그인/권한검사, 앱·Azure 이벤트 연결, 검토 메모의 영속 저장은 **NOT VERIFIED**.
- 라이브 컨테이너를 읽기 전용으로 확인했을 때 관제 모듈·API 경로·UI·workspace 환경변수가 없는 것으로 확인됐다. 전체 작업트리에는 본 요청과 무관한 미배포 변경이 있어 전체 이미지 교체를 안전한 최소 변경으로 판단하지 않았다.
- 앱 해시 체인 점검은 저장소 기록의 연결 오류를 찾는 범위이며, Azure 불변 보관·외부 백업·누락 방지·전체 보안 상태를 증명하지 않는다.
- 진료정보, 환자 이름/ID, DICOM UID, 토큰, 요청 URI를 운영 메모에 넣지 않는다.

## 요구사항 연계

- FR-037~FR-041: 감사로그·접근 거부·이상행위 검토
- FR-014~FR-025: 접근 정책 및 단기 토큰 거부 근거
- NFR: 최소 권한, 서버 측 역할 검증, append-only 감사, 비밀정보 비노출
