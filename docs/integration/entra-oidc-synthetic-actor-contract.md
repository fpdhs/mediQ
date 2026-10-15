# Entra OIDC 및 합성 Actor 매핑 계약

## 현재 상태 — 2026-10-13 앱·매핑 후보 정렬 / 실행 배포 미완료

관측: 2026-10-13 13:47 이후 KST. HEAD `9f27b85ab349ea5e5e5b6dc2da659825047a6d25`, dirty. 신규 증적 **DRAFT / UNASSIGNED**이며 과거 검토 PASS는 이번 후보에 승계하지 않는다. 아래 수락 완료·미설정 표시는 과거 관측으로 구분한다.

- 전용 단일 tenant API/SPA 앱 `highpass-synthetic-web-api-20261013`, `highpass-synthetic-web-spa-20261013` 등록 완료. 기존 병원 Gateway 키 보호 앱은 변경하지 않았다. SPA의 HTTPS redirect는 현재 내부 B origin의 `/entra-redirect.html` 하나뿐이다. 외부망 HTTPS 서비스·도메인 연결은 이 작업의 범위가 아니다.
- API access token v2, 전용 delegated `access_as_user`, 정확 SPA preauthorization·required resource 연결, 양쪽 enterprise app의 assignment-required 및 지정된 Accepted Guest 두 명만의 기본 접근 배정을 Graph 개별 GET으로 재확인 PASS. Graph 권한·Azure RBAC·관리자 역할·client secret은 생성하지 않았다.
- 서버용 `(tid, oid)` → PATIENT/DOCTOR 합성 actor map과 실행 설정을 ACL 보호·Git 제외 경로에 생성했다. 실제 서버 적용은 **NOT VERIFIED**이며 적용했다고 표현하지 않는다. 이메일이나 browser 역할을 서버 권한으로 사용하지 않는다.
- `scripts/entra-web-config.py --users-receipt <보호된 수락 확인 receipt> --apply` exit0: `artifacts/azure/entra-web-20261013T044732Z-bb4171/result.json`. 후속 동일 명령에서 `--apply`를 뺀 읽기 전용 재조회 exit0: `artifacts/azure/entra-web-20261013T045424Z-130b4c/result.json`. 실제 GUID·개인 ID는 이 문서나 bundle에 넣지 않는다.
- 후보 구현: Control 시작 검증은 완전한 Entra 설정에서만 ENTRA_OIDC를 허용하며 Mock IdP 동시 사용을 거부한다. 환자 전용 서비스·DB credential 분리 및 DPoP/Control-only 경계는 유지한다. B portal의 Entra 통신 CSP는 명시 opt-in으로 고정 Microsoft authority만 추가한다. 동일 origin MSAL/redirect bundle 생성 exit0.
- 후보 overlay `infra/azure/capstone-control-entra.compose.yml`, `infra/workstation/hospital-b-entra.compose.yml` 준비. Compose 정적 검증에서 API/DB 비공개·기존 private network 유지·map read-only mount PASS. 추가 outbound bridge는 JWKS 접근을 위한 **검토 후보**이며 전용 목적지 egress 제약과 실제 경계 회귀는 아직 미검증이다. Docker config 결과만으로 네트워크 보안 완료라고 선언하지 않는다.
- `scripts/entra-deployment-preflight.py` 읽기 전용 Cloud 점검 exit0, 1.120초: `artifacts/azure/entra-web-20261013T045237Z-3a575d/preflight.json`. 현재 Control 이미지 `sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436`, AUTH_MODE=TEST, Mock IdP=1, DPoP=1, Control-only=1. 현재 컨테이너의 Microsoft JWKS GET은 5초 제한에서 `JWKS_FETCH_FAILED`, exit2 **FAIL**. 원인을 DNS/방화벽/라우팅 중 하나로 단정하지 않는다. 서버 소스 hash는 후보와 다르고 MSAL/redirect 자산 및 새 시작 validator가 없다.
- B 보안 입력창을 통한 인증 후 양쪽 읽기 전용 재점검 exit0, 19.384초: `artifacts/azure/entra-web-20261013T045522Z-011d23/preflight.json`. B 이미지 `sha256:2c09773d13276396ba5d2a6084293aec16809ce17c09b59a263b0cb2603931e0`, healthy, Entra CSP opt-in 미적용. 비밀번호는 저장하지 않았다. B/Cloud 실행 이미지와 인증 후보 정렬은 아직 완료되지 않았다.

검증 기록:

| 검증 | 결과 | 근거 |
|---|---|---|
| 인증·브라우저·환자 secret·B portal·ingress·정책 회귀 | PASS | 지정 Node 8개 test 파일, 91/91, exit0, 2.037초 |
| 최종 관련 회귀 재실행 | PASS | Control profile 포함 Node 9개 test 파일, 95/95, exit0, 2.267초; 실제 Entra 로그인은 아님 |
| Control Entra overlay 정적 merge와 fail-closed 검증 | PASS | `node --test test/capstone-control-runtime-config.test.js`, 4/4, exit0, 8.069초 |
| mapping 생성 안전 검사 | PASS | `python -m unittest discover -s test -p entra_web_config_test.py`, 3/3, exit0, 0.002초 |
| 실제 생성한 설정·actor map 서버 validator | PASS | 로컬 validator, 2 actor/PATIENT·DOCTOR; 실제 로그인 아님 |
| 전체 security gate 첫 실행 | FAIL | unit-tests 60초 제한 SIGTERM; secret scan 및 dependency audit PASS. timeout 결과를 삭제하지 않음 |
| 전체 security gate 180초 제한 재실행 | FAIL | unit-tests exit1, 95.230초; secret scan exit0/4.927초, dependency audit exit0/1.686초. 정상 종료된 시험 실패로 timeout과 구분 |
| 전체 Node 테스트 실패 진단 | FAIL | `node --test --test-concurrency=4 --test-reporter=tap`, exit1, 1245개 중 1240 PASS/5 FAIL. 아래 후속 수정과 구분 |
| 시작 검증 이동에 따른 테스트 수정 후 재검증 | PASS | Control profile + runtime config 7/7, exit0, 2.384초. 최초 test assertion 불일치 및 중간 수정 syntax error를 해결; 전체 gate 재통과를 의미하지 않음 |
| 신규 서버 배포·복구·이미지 gate/SBOM | NOT VERIFIED | 변경된 실행 이미지를 아직 만들거나 승격하지 않음 |
| 실제 Entra 환자/의료진 로그인·역할 교차 거부·감사 | NOT VERIFIED | 실행 배포는 아직 TEST 기준선 |

배포·복구 계약: 먼저 B/Cloud 현재 이미지·source hash·compose 목록과 mount 권한을 재확인하고, 해당 baseline에서 이번 인증 변경만 후보에 포함한다. 기존 환자·의료진·PWA는 동일 frontend bytes로 정렬한다. server map은 root 보호 디렉터리에 두되 실제 nonroot 컨테이너 UID가 읽을 수 있는 제한된 group/read 권한을 검증한다(무조건 root-only 0600이면 컨테이너 시작 실패). actor map/browser token을 로그·Git·URL·이미지에 넣지 않는다. 신규 후보의 security/container/SBOM·검토 승인·복구 근거가 갖춰지기 전 live switch를 하지 않는다. 복구는 캡처한 이전 이미지와 정확 Compose 설정으로 수행하며 DB/volume 삭제·과거 데이터 변경은 금지한다.

전체 진단의 남은 실패 항목은 `medlineplus-upload.test.js:126`의 `SOURCE_CONTEXT_REQUIRES_GUIDANCE`, `patient-helper.test.js:32`의 `getAttribute` fixture 오류, `privacy-filter.test.js:280`와 `privacy-isolated-http.test.js:5`의 응답 assertion 불일치다. 이번 인증 변경과 무관하다고 단정하거나 기존 실패로 소급 처리하지 않는다. 이 항목들을 해결하거나 관측 baseline에서 인증 변경만 분리한 후보의 전체 관문을 검증하기 전에는 security gate PASS가 아니다. 종료된 MediQ 재개·임의 commit/push·서비스 재배포·public ingress 변경은 하지 않았다.

다음 작업 한 개: **B/Cloud 인증 후보의 정확 이미지·제한된 JWKS egress·배포/복구 증적을 마련하고 새 후보 검토 후 동시 적용**, 이어서 환자와 의료진 실제 로그인·교차 접근 거부·감사를 같은 배포에서 확인한다. 앱 등록 PASS를 서비스 로그인 PASS나 MVP/v3 완료로 확대하지 않는다.

관련 요구사항: FR-010~FR-025(인증 주체·정책·토큰), FR-037~FR-041(인증 감사), FR-001~FR-005(환자 동의 회귀). 기존 동의/API/DB 계약과 전체 완료 조건은 변경하지 않는다.

## 2026-10-13 사용자 지정 시연 계정 — 수락 완료 / 서비스 로그인 미검증

최신 로그인 검증 시도: 2026-10-13 13:40 KST, DRAFT / UNASSIGNED. 읽기 전용 `scripts/entra-demo-users.py` 실행 exit0, 7.023초에서 지정 PATIENT/DOCTOR Guest 모두 `externalUserState=Accepted` 확인 PASS. 증적 `artifacts/azure/entra-demo-users-20261013T043952Z-ff6d04/result.json`. 초대 수락 완료는 앱 권한 부여나 서비스 로그인 성공을 의미하지 않는다.

현재 B병원 `https://192.168.111.149:9443/hipass/#DOCTOR`에서 실제 브라우저의 의료진 시작 버튼을 눌렀으나 시연 접근 키 로그인 화면이 표시되었다. 배포 서비스의 `/api/capstone-demo/auth-config`는 신뢰 CA를 사용한 Node HTTPS 조회(10초 timeout)에서 `401 AUTHENTICATION_REQUIRED`를 반환했다. Entra 로그인 설정 조회 연결 FAIL; 실제 Entra 환자·의료진 로그인 및 역할 교차 접근 거부는 NOT VERIFIED. 최초 curl 조회는 Windows Schannel 인증서 폐기 상태 조회 실패로 HTTP 000/exit1이었고, TLS 검증을 끄지 않고 신뢰 CA 기반 Node HTTPS로 확인했다. 화면 증적 `artifacts/azure/entra-mail-receipt-20261013/service-login-blocked.jpg`. 코드 기준 HEAD `9f27b85ab349ea5e5e5b6dc2da659825047a6d25`, dirty; 실행 이미지와 서버 소스 동일성은 이번에 NOT VERIFIED. 재배포·app assignment·actor map 적용·네트워크 공개 변경은 하지 않았다.

다음 작업 한 개: 실제 SPA/API 등록·scope·redirect·assignment 및 서버 actor map 설정 상태를 확인하고, 승인된 인증 설정 조회 경로와 배포 버전을 정렬한 뒤 동일 브라우저 로그인 흐름을 재검증한다. 아래 수락 대기 및 메일 미수신 표시는 과거 관측이다.

최신 관측: 2026-10-13 13:30 KST, 메일 실제 수신 PASS / 사용자 수락 NOT VERIFIED / DRAFT / UNASSIGNED. 두 지정 Gmail 브라우저에서 초대가 스팸함에 수신된 것을 확인했다. Gmail은 이전에 스팸으로 확인된 메일과 유사하다는 이유를 표시했다. 두 대화의 스팸 해제를 수행했고 받은편지함 이동 확인 PASS. 환자 계정은 스팸 해제 이후 13:25 재발송분의 받은편지함 수신 PASS, 의료진 계정은 13:26 재발송분이 스팸으로 수신된 뒤 해제·이동 PASS. 의료진 계정의 해제 이후 추가 신규 발송 수신은 NOT VERIFIED이며 불필요한 추가 발송은 하지 않았다.

이번 재발송: `scripts/entra-demo-users.py --apply --resend`, exit0. 증적 `artifacts/azure/entra-demo-users-20261013T042541Z-262976/result.json`. 기존 Guest ID 유지 및 `resetRedemption=false` 확인 PASS, 신규 게스트 생성 없음. 브라우저 증적은 `artifacts/azure/entra-mail-receipt-20261013/patient-spam-cleared.jpg`, `doctor-spam-cleared.jpg`의 보호된 Git 제외 경로에 저장했다. 실제 표시 발신자는 테넌트의 Microsoft Invitations 발신 주소였으며 이 문서에는 사용자 이메일·초대 URL을 저장하지 않는다. 서비스 인증 우회, 역할 부여, app assignment, public ingress 변경은 수행하지 않았다. 아래 이전의 수신 NOT VERIFIED 표시는 당시 결과이며 최신 수신 판정을 대체하지 않는다.

후속 사용자 승인 재발송: `scripts/entra-demo-users.py --apply --resend` exit0, 두 기존 PendingAcceptance Guest에 sendInvitationMessage=true, resetRedemption=false 적용 후 반환 ID와 기존 ID 일치 및 개별 GET 확인 PASS. 신규 계정 생성 없음. 증적 `artifacts/azure/entra-demo-users-20261013T040151Z-80a2dd/result.json` (보호된 Git 제외 경로), DRAFT / UNASSIGNED. 메일 실제 수신·사용자 수락은 계속 NOT VERIFIED. offline invitation safety 3/3 PASS (`python -m unittest discover -s test -p entra_demo_users_test.py`, exit0, 0.005초); 실제 로그인/권한 시험이 아니다.

사용자가 이메일 두 개를 환자/의료진 시연 주체로 명시 지정했다. 정확 이메일 Graph 조회로 중복을 확인하고 기존 계정이 없을 때만 Guest 초대를 생성했다. Microsoft Graph가 반환한 두 object ID는 Git 제외·사용자/System/Administrators ACL로 보호된 로컬 증적에만 저장했다. 사용자 이메일·object ID·초대 수락 URL·비밀번호는 이 문서와 코드에 넣지 않는다.

- `python scripts/entra-demo-users.py --patient-email <지정 환자 이메일> --doctor-email <지정 의료진 이메일> --apply`, exit 0, 디렉터리 등록 PASS. 증적 `artifacts/azure/entra-demo-users-20261013T035605Z-a8a379/result.json`, DRAFT / UNASSIGNED.
- PATIENT/DOCTOR 지정 주체 모두 `Guest`, `PendingAcceptance`; 초대 API의 `sendInvitationMessage=true` 성공. 메일 도착·초대 수락·실제 Microsoft 계정 로그인·app assignment·서버 actor map 배포는 NOT VERIFIED. 디렉터리 guest 생성이 앱의 의료진 권한 부여를 뜻하지 않는다.
- redirect는 아직 배포하지 않은 demo HTTPS가 아닌 `https://myapps.microsoft.com/`으로 설정했다. 최초 초대 실패의 자동 재시도·중복 생성·redemption reset·비밀번호 설정·Azure/관리자 RBAC 부여는 수행하지 않았다.
- 개인 Microsoft 계정/다른 조직의 계정은 직접 임의 issuer를 허용하지 않는다. **이번에 지정한 두 계정을 리소스 tenant에 게스트로 초대하고 그 tenant가 발행한 access token의 고정 tid+oid를 검증하는 경우만 허용할 후보**다. 아래 기본 거부 원칙에서의 유일한 명시적 시연 예외이며 모든 guest 허용이나 이메일 기반 권한 부여가 아니다. 실제 앱 assignment-required와 oid map을 완료하기 전 서비스 접근은 열지 않는다.

다음 작업 한 개: 지정된 두 이메일에서 초대 수락 후 `externalUserState=Accepted`와 정확 object ID를 재조회한다. 이후 SPA/API app·scope·redirect·서버 mapping 및 실제 정상/거부 로그인을 별도로 검증한다. Microsoft 계정으로 등록하지 않은 Gmail 주소가 email OTP로 초대를 수락하더라도 이를 Microsoft 계정 인증과 동일하게 주장하지 않고 인증 방식 요구를 재확인한다. [Microsoft guest invitation](https://learn.microsoft.com/en-us/graph/api/invitation-post?view=graph-rest-1.0), [Microsoft account B2B](https://learn.microsoft.com/azure/active-directory/external-identities/microsoft-account).

상태: BACKEND + SPA CLIENT IMPLEMENTED / MOCK AUTH FLOW PASS / ENTRA NOT CONFIGURED / DRAFT
기준일: 2026-10-13 KST
범위: 제한된 합성 데이터 웹 시연 인증. 실제 환자·병원 계정은 대상이 아니다.

## 결정할 설계

- 단일 Microsoft Entra workforce tenant만 허용한다. personal Microsoft account와 다른 tenant의 guest 계정은 기본 거부한다.
- 현재 브라우저 SPA에는 MSAL Browser의 OIDC Authorization Code + PKCE 흐름을 적용한다. SPA에는 client secret을 두지 않고, MSAL cache는 `memoryStorage`로 제한해 새로고침 시 재인증을 허용한다. Entra 인증 성공과 플랫폼 권한 승인은 별개다.
- API에는 ID token이 아니라 해당 Control API의 전용 delegated `access_token`만 제출한다. API는 token signature, `iss`, `aud`, `tid`, `exp`, `nbf`, `iat`, token version 및 요구 `scp`를 서버에서 검증한다. tenant discovery URL은 설정된 tenant GUID로부터 고정 생성하고 TLS 검증을 유지한다.
- 승인 주체는 검증된 `(tid, oid)`와 서버 관리형 allowlist의 일치로만 결정한다. `role`, `doctorId`, `patientId`, `hospitalId`, email, UPN, display name, 그룹·브라우저 헤더는 권한 근거로 신뢰하지 않는다. 미등록 또는 중복 identity는 fail closed로 거부한다.
- 시연 계정은 환자 1개(`PATIENT`, `MEDIQ-SYN-HCC-001`)와 의료진 1개(`DOCTOR`, `DOC-B-01`, `HOSP-B`)로 제한한다. 관리자 역할 매핑은 만들지 않는다. `(tid, oid)`는 매핑·인증에만 사용하고 앱 감사로그에는 합성 actor ID를 남긴다.
- Entra API access token은 Control Plane 사용자 인증 bearer로 사용하되, API의 audience/scope/tenant/actor map 검증을 매 요청 서버에서 수행한다. `HIPASS_DPOP_REQUIRED=1`은 기존대로 DICOM 접근토큰 발급·검증의 DPoP proof/key binding에 적용한다. Entra 로그인 때문에 이 영상 접근 보호를 약화하지 않는다. Entra 자체 PoP는 별도 필요가 확인되지 않는 한 전제로 두지 않는다.

## 매핑 형식 (예시일 뿐이며 실행 설정 아님)

```json
{
  "schemaVersion": 1,
  "tenantId": "<ENTRA_TENANT_GUID>",
  "actors": [
    {
      "objectId": "<ASSIGNED_PATIENT_OBJECT_GUID>",
      "actorId": "synthetic-patient-hcc",
      "role": "PATIENT",
      "patientId": "MEDIQ-SYN-HCC-001"
    },
    {
      "objectId": "<ASSIGNED_DOCTOR_OBJECT_GUID>",
      "actorId": "synthetic-doctor-b",
      "role": "DOCTOR",
      "doctorId": "DOC-B-01",
      "hospitalId": "HOSP-B"
    }
  ]
}
```

실제 tenant/object GUID를 받기 전에는 이 예시를 mount하거나 배포하지 않는다. 매핑은 Control API가 읽는 root-only config 파일로 주입하고 Git, browser bundle, URL, audit payload에 실제 identity/secret을 넣지 않는다. Entra app은 assignment-required로 구성하고 허용된 합성 사용자만 할당하되, 이 설정은 서버측 allowlist 검증을 대체하지 않는다.

## 구현 상태와 남은 선행조건

- `src/capstone-mock-idp.js`와 `public/capstone-auth.js`는 현재 `AUTH_MODE=TEST`의 Mock IdP 로그인·합성 HS256 token 흐름이다. public Edge에서 그대로 사용하면 안 된다.
- 선택형 `AUTH_MODE=ENTRA_OIDC` 서버 경로가 구현되었다. `src/auth.js`는 tenant 고정 issuer의 Microsoft JWKS 기반 RS256 검증 후 `iss`/`aud`/`tid`/`azp`/`oid`/`exp`/`nbf`/`iat`/`ver`/delegated `scp`를 확인하고, 검증된 `oid`만 서버 측 합성 actor map에 연결한다. Entra 역할은 `PATIENT` 1개와 `DOCTOR` 1개로 한정되며 map에 admin 역할, email/UPN, 임의 claims/필드는 허용하지 않는다.
- actor map은 절대 경로의 서버 파일로만 읽는다. 운영 시 비밀/개인 키와 분리된 서버 전용 read-only 설정 mount를 사용하고 Git/browser/audit에 실제 object ID를 넣지 않아야 한다. 실제 tenant/client/scope/redirect URI/두 사용자 object ID가 아직 제공되지 않아 Entra 연결은 설정되지 않았다.
- `/api/capstone-demo/auth-config`는 공개용 tenant/client/redirect/scope 값만 `no-store`로 반환하고, `/api/capstone-demo/identity`는 API access token을 다시 검증한 뒤 서버 매핑 결과만 반환하며 로그인 성공 감사 이벤트를 기록한다. 인증 실패 감사 저장이 불가능하면 요청은 fail closed한다.
- 서버의 해당 인증 handler는 비동기 JWKS 검증을 await 하도록 연결했다. `node --test test/entra-oidc-auth.test.js test/hipass-service.test.js test/privacy-service-identity.test.js test/capstone-control-ingress.test.js`는 PASS 68/68이다. RSA/JWKS mock 테스트는 실제 Entra tenant나 브라우저 로그인을 증명하지 않는다.
- `/api/capstone-demo/auth-config`가 `ENTRA_OIDC`일 때 `public/capstone-auth.js`는 MSAL Browser popup 경로를 선택한다. token은 memory cache와 함수 closure에만 두며, same-origin `/vendor/msal-browser.js` 및 `/vendor/entra-redirect.js` 번들을 사용한다. `public/entra-redirect.html`은 MSAL v5 redirect bridge만 실행한다. TEST 서버의 auth-config `404`에서만 기존 Mock IdP 흐름으로 진행한다. `scripts/build-entra-client.js`가 번들을 만들고 Dockerfile build stage가 정적 자산을 포함한다.
- 로컬 전용 fixture로 화면 진입 → Entra 대체 mock popup → 가짜 bearer를 이용한 `/api/capstone-demo/identity` 응답 → 서버형 합성 actor 세션 반환까지 Playwright로 확인했다. 환자 actor와 합성 ID가 반환되고 local/session storage는 비어 있었다. fixture는 테스트 전용이며 실제 Entra authority·토큰 교환·API 서명 검증·감사 저장을 대체하지 않는다. 실제 Entra/browser authentication은 **NOT VERIFIED**이며 public Edge는 미승인이다.
- DICOM access-token 발급/사용의 `HIPASS_DPOP_REQUIRED=1` 경로는 기존 서비스 테스트에서 회귀 검증됐지만, Entra 로그인부터 DICOM 요청까지의 통합 흐름은 실제 Entra token, browser, DPoP proof를 포함해 end-to-end 검증되지 않았다. API 사용자 token 인증과 DICOM access-token DPoP 검증은 분리해 시험한다.

## 검증 관문

| 시나리오 | 기대 결과 |
|---|---|
| 정상 tenant의 허용 patient/doctor access token, API audience·scope 일치 | 해당 서버 관리형 합성 actor만 반환 |
| 다른 `tid`, issuer, audience, API scope, token version | 거부, `401` |
| ID token을 API에 제출, app-only token, 만료/미래 token, 잘못된 서명/`kid` | 거부, `401` |
| 정상 서명이나 actor map에 없는 `oid`, 중복 map, 잘못된 역할/불완전 매핑 | 거부, fail closed; role/병원 임의 할당 금지 |
| browser가 role/patient/hospital 헤더·body를 위조 | 매핑 결과에 영향 없음; 정책 거부 및 audit |
| DICOM 접근토큰 발급·조회 때 DPoP proof 누락·변조·다른 URI/method 또는 token key와 불일치 | 거부; `HIPASS_DPOP_REQUIRED` 유지 |
| 동의 없음/철회/기간·Study·Series 범위 밖, VIEW_ONLY 다운로드 | 기존 거부 코드·감사 경로 유지 |

필요한 외부 설정값: tenant GUID, SPA client ID, API client ID 및 delegated scope, 최종 HTTPS demo origin/redirect URI, 두 개의 시연 사용자 object ID. 이 값이 결정되기 전까지 실제 Entra 등록·브라우저 로그인·API token validation은 **NOT VERIFIED**다. public Edge CSP의 `connect-src`에는 `https://login.microsoftonline.com`이 필요하고, `/entra-redirect.html`에는 MSAL v5 bridge 통신을 끊는 COOP 헤더를 적용하면 안 된다. 등록된 redirect URI는 실제 값과 정확히 일치해야 한다.

## 참고 (Microsoft 공식 문서)

- [Authorization Code flow와 PKCE](https://learn.microsoft.com/en-us/azure/active-directory/develop/v1-protocols-oauth-code)
- [MSAL Browser](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
- [MSAL Browser cache 설정](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/configuration)
- [Access token claims (`aud`, `iss`, `scp`, `oid`, `tid`)](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference)
- [ID token은 API 호출에 사용하지 않음](https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens)
