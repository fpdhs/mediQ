# Entra OIDC 및 합성 Actor 매핑 계약

상태: BACKEND IMPLEMENTED / ENTRA NOT CONFIGURED / BROWSER NOT CONNECTED / DRAFT
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
- 브라우저 UI는 아직 `public/capstone-auth.js`의 TEST Mock IdP 로그인 경로를 사용한다. 같은 출처로 제공되는 MSAL Browser 패키지/redirect bridge와 실제 SPA token 처리·합성 identity 조회가 연결되기 전에는 public Edge에서 로그인 경로를 열지 않는다. CDN script나 browser storage에 token을 저장하는 대안은 사용하지 않는다.
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

필요한 외부 설정값: tenant GUID, SPA client ID, API client ID 및 delegated scope, 최종 HTTPS demo origin/redirect URI, 두 개의 시연 사용자 object ID. 이 값이 결정되기 전까지 실제 Entra 등록·브라우저 로그인·API token validation은 **NOT VERIFIED**다. 추가로 MSAL Browser를 same-origin 정적 asset으로 제공하고 popup redirect bridge 또는 승인된 redirect 경로를 구현·시험해야 한다.

## 참고 (Microsoft 공식 문서)

- [Authorization Code flow와 PKCE](https://learn.microsoft.com/en-us/azure/active-directory/develop/v1-protocols-oauth-code)
- [MSAL Browser](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
- [MSAL Browser cache 설정](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/configuration)
- [Access token claims (`aud`, `iss`, `scp`, `oid`, `tid`)](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference)
- [ID token은 API 호출에 사용하지 않음](https://learn.microsoft.com/en-us/entra/identity-platform/id-tokens)
