# Azure 합성 데이터 웹 시연 준비안

상태: PREPARATION / DRAFT / UNASSIGNED
기준일: 2026-10-13 KST
범위: 제한된 사용자 대상의 비운영 합성 데이터 웹 시연

## 목표와 경계

기존 Azure 기반 Control Plane을 활용해 HTTPS 웹 진입을 준비한다. 1차 시연은 합성 계정·합성 동의·최소 메타데이터에 한정한다. 원본 DICOM 업로드·저장·다운로드, 공개 DICOMweb, 실제 PACS 연결, 임상 판단 기능은 포함하지 않는다.

Azure는 웹 정적 자산과 동의·정책 메타데이터 API를 제공한다. 영상 열람은 병원 B의 승인된 Data Plane 경로가 별도로 검증될 때까지 시연 범위 밖이다. 웹 화면이 열리는 것만으로 영상 공유 흐름이 검증됐다고 표시하지 않는다.

## 확인된 기준선

| 항목 | 확인 내용 | 상태 |
|---|---|---|
| Azure 구독 | 명시된 Azure for Students 구독 `Enabled`; Compute·Network·Key Vault provider 등록 | PASS — 2026-10-13 읽기 전용 preflight |
| 예산 설정 | 사전 점검에 USD 100 상한 입력 | PASS — 입력값 확인만 수행, 실제 지출 제한 아님 |
| Cloud 호스트 기반 | `highpass-cloud`, Docker 29.8.2, Compose v5.6.0 확인; private Key Vault DNS/TLS 확인 및 비인증 요청 401 거부 | PASS — 기반 환경만 확인, 앱 배포·public ingress·NSG 현황은 미검증 |
| 실제 Azure NIC/NSG | 로컬 PowerShell에서 `az` CLI를 찾지 못해 NIC, NSG, effective rules 조회 불가 | NOT VERIFIED |
| 잔여 크레딧·현 비용·VM quota | 이번 preflight에서 확인하지 않음 | NOT VERIFIED |
| Control API 인증 | Cloud Compose가 `AUTH_MODE=TEST`, `HIPASS_CONTROL_PLANE_ONLY=1`, `HIPASS_DPOP_REQUIRED=1`로 설정; 브라우저 로그인은 Mock IdP 경로 | 합성 capstone 프로필; 인터넷 공개용 인증 아님 |
| Control API·DB 네트워크 | Cloud Compose에서 API 및 DB 포트 미게시, 내부 Docker 네트워크 사용 | 확인됨 |
| Cloud HTTPS 진입 | 현재 Compose는 `10.90.88.1:443`에만 바인딩하며 overlay 전용 주석이 있음 | 공인 웹 진입 아님 |
| 네트워크 정책 | VM 템플릿은 지정된 source CIDR만 443 허용하고 나머지 inbound를 거부 | public 443 전체 허용 상태로 변경하지 않음 |
| 병원 B 수신 경로 | 2026-10-13 점검에서 B Portal은 healthy였으나 수신 PACS 컨테이너와 등록된 반입 경로는 확인되지 않음 | 실제 영상 수신·열람 NOT VERIFIED |
| 배포 후보 | 현재 checkout `codex/wbs-12-key-release-20260912` / HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31`; `git status --short` 540개(486 staged additions, 54 staged modifications) | HEAD는 현재 변경을 포함하지 않음. clean/reviewed release SHA로 고정할 수 없음 |

기준 설정은 `infra/azure/capstone-control.compose.yml`, `infra/azure/capstone-control-ingress.compose.yml`, `infra/azure/capstone-cloud-vm.json`에서 확인했다. B와 Cloud의 실제 실행 상태 관련 기록은 [통합 상태 문서](../implementation/mediq-presentation-integration-status-2026-10-09.md)를 따른다.

읽기 전용 `node scripts/azure-demo-preflight.js` 실행 결과는 전체 `NOT VERIFIED`였다. CLI, 정확한 구독 접근, 구독 활성화, 세 Resource Provider, 입력된 USD 100 계획 상한은 확인했다. 잔여 학생 크레딧, 현재 비용, quota, 새 웹 진입, 브라우저의 전체 Viewer 경로는 미확인으로 남았다. 리소스 생성·NSG 수정·서비스 재시작은 수행하지 않았다.

추가로 `node scripts/azure-cloud-host-check.js`의 Cloud 호스트 기반 점검은 PASS였다. 관찰값과 체크별 결과는 [호스트 기반 점검 기록](../../artifacts/azure/cloud-host-2026-10-13T01-10-50-615Z.json)에 남겼다. 이 검사는 Docker/Compose와 private Key Vault의 TLS·비인증 거부까지만 확인하며, 실제 애플리케이션 컨테이너·현재 NSG/공개 경로·웹 로그인·병원 VPN/Gateway·분산 영상 흐름의 배포 또는 보안 검증을 뜻하지 않는다. 해당 항목은 계속 NOT VERIFIED다.

현지 셸에서 `az` CLI가 인식되지 않아 이번 턴에는 Azure NIC/NSG의 실제 유효 규칙을 조회하지 못했다. [Entra 합성 actor 계약](entra-oidc-synthetic-actor-contract.md) 및 [Edge·NSG·복구 계획](../operations/azure-synthetic-web-edge-plan-2026-10-13.md)에 상세 관문을 분리해 두었다.

## 목표 요청 경로

```text
합성 시연 사용자
       │ HTTPS / 제한된 접근
       ▼
Azure Web Edge ── 허용된 메타데이터 경로만 ──> 사설 Control API ──> 사설 PostgreSQL
       │                                         │
       └── /dicomweb, WADO, frame, import 차단    └── 동의·정책·감사만

실제 영상 경로는 별도 단계:
사용자 사설 연결 ──> B Gateway ──> A Gateway ──mTLS──> Orthanc
```

Web Edge는 기존 overlay Control ingress와 별도 서비스·별도 listener로 구성한다. 기존 `10.90.88.1:443`을 공인 interface에 재바인딩하거나 wildcard `0.0.0.0`으로 바꾸지 않는다. Azure NIC의 현재 private IP와 NSG를 배포 직전에 재확인한 뒤, 시연자 source CIDR allowlist가 가능한 제한된 443 ingress를 검토한다. 3000, 5432, 8042 및 Gateway 포트를 공인 노출하지 않는다.

## 인증·권한 준비 관문

공개 웹 진입 전에는 다음이 필요하다.

1. 단일 Entra tenant의 OIDC 로그인과 초대된 시연자만 허용하는 사용자 정책을 정한다.
2. 신뢰할 수 있는 issuer·audience·서명키와 키 회전 절차를 서버에서 검증한다. 현재 `AUTH_MODE=OIDC` 경로는 `JWT_PUBLIC_KEY`를 이용한 RS256 검증이다. Entra 로그인 연결, JWKS 키 회전, 사용자와 합성 PATIENT/DOCTOR·병원 간 매핑은 이번 준비에서 확인되지 않았다.
3. 서버가 검증된 identity를 고정된 합성 계정에 매핑한다. 브라우저가 보낸 role, patientId, doctorId, hospitalId 또는 `X-MS-CLIENT-PRINCIPAL` 유사 헤더를 권한 근거로 직접 신뢰하지 않는다.
4. 기존 RBAC·ABAC·동의·Study/Series 검증과 DPoP를 유지한다. 웹 로그인 성공은 리소스 접근 허용을 뜻하지 않는다.
5. 인증 쿠키와 API 응답은 HTTPS·짧은 만료·CSRF 고려·`Cache-Control: no-store`를 적용하고, 토큰이나 키를 URL·브라우저 저장소·로그에 남기지 않는다.

현 Cloud `AUTH_MODE=TEST` 프로필이나 공용 발표자 비밀키를 인터넷에 바로 노출하지 않는다. 인증 연동과 claim mapping이 검증될 때까지 public ingress는 닫아 둔다.

## 준비 단계와 완료 조건

### 0. 배포 기준선 고정 — 차단 상태

- 구독·지역·비용·VM/NIC/NSG/DNS·현재 compose context·이미지 digest·DB volume/감사 fingerprint를 읽기 전용으로 inventory한다.
- 현재 작업 트리 변경을 검토 가능한 release SHA와 분리한다. 사용자 수정분을 포함한 dirty checkout을 그대로 빌드하거나 배포하지 않는다.
- USD 100 범위에서 잔여 크레딧과 월별 비용 추정을 재확인한다. Cost Management budget 알림은 그 자체로 리소스 사용을 중지하지 않으므로 별도의 종료 절차를 준비한다. [Azure budget 동작](https://learn.microsoft.com/en-us/azure/cost-management-billing/costs/tutorial-acm-create-budgets)

### 1. 합성 웹 시연 인증 — 백엔드 부분 구현 / 공개 진입 차단

- Entra OIDC 서버 검증과 `tid`+`oid` 기반 환자/의료진 합성 actor mapping 코드 및 RSA/JWKS mock 테스트를 추가했다.
- 현재 테스트는 PASS 68/68(Entra 인증·기존 동의/정책/DPoP/API 경계). 실제 tenant token, 키 회전, 브라우저 로그인과 Entra-to-DICOM DPoP end-to-end는 NOT VERIFIED다.
- 브라우저는 아직 TEST Mock IdP를 사용한다. MSAL Browser same-origin 공급/redirect 경로와 실제 Entra 사용자 설정 전까지 Edge route allowlist와 NSG를 적용하지 않는다.

### 현재 로컬 검증 기록

| 검증 | 결과 | 근거 / 제한 |
|---|---|---|
| Entra OIDC + 합성 actor map 및 동의/정책/Control 경계 회귀 | PASS | `node --test test/entra-oidc-auth.test.js test/hipass-service.test.js test/privacy-service-identity.test.js test/capstone-control-ingress.test.js` — 68/68 |
| 전체 Node 테스트 suite | FAIL | 직렬 실행 1,192개 중 1,189 PASS / 3 FAIL. AFP 교차검사 검색 기대값 불일치 1건은 단독 재현됨. 전체 run의 liver/screening source snapshot 2건은 파일 누락으로 실패했지만 같은 테스트를 단독 재실행했을 때는 PASS; clean runner 재검증 필요. |
| 실제 Entra SPA 로그인/토큰 및 합성 사용자 할당 | NOT VERIFIED | tenant/app/scope/object ID 및 MSAL UI 연결이 아직 없음 |
| 현재 Azure NIC/NSG/effective rules | NOT VERIFIED | 로컬 `az` 실행 파일 없음 |
| 배포 가능한 release SHA | BLOCKED | 현재 staged 변경 파일 540개, 전체 suite FAIL, browser authentication gap |

### 2. 격리된 웹 Edge 후보 — 미착수

- 기존 VM을 재사용하는 독립 Web Edge Compose service 후보를 준비한다. 새 VM이나 managed ingress는 현 예산·기존 네트워크에서 비용/라우팅을 비교한 후 선택한다.
- 도메인과 신뢰 가능한 TLS 인증서를 정하고, 현재 overlay ingress와 독립된 NIC listener 및 source 제한을 적용한다.
- 정적 UI와 검토된 메타데이터 API만 경로 allowlist로 연다. 일반 `/api/*` catch-all은 허용하지 않는다.
- Cloud 프로필의 Control Plane only 제한은 유지한다. `/dicomweb/*`, WADO, frame, PACS import/export, Key Release, 원본 파일 URL은 공인 Edge에서 fail-closed로 차단한다.
- 시연용 합성 상태와 감사 변경이 현재 Cloud 데이터에 섞이지 않도록 격리 방법을 정하고, 기존 DB volume을 지우거나 초기화하지 않는다.

### 3. 후보 검증·제한 배포 — 미착수

- 이미지 한 번 빌드 후 digest 고정, 취약점 scan/SBOM, 설정 diff, 기존 컨테이너·volume 기준선과 복구 계획을 연결한다.
- 무인증·잘못된 issuer/audience·만료/변조 토큰·잘못된 역할/병원·동의 없음/철회·scope 초과를 각각 거부한다.
- 공개 주소에서 DICOM/WADO/frame/import 경로가 열리지 않고, 영상 payload가 Azure Control·Edge 로그/저장소에 기록되지 않는지 확인한다.
- 승인된 시연 source에서만 HTTPS 접근, 보안 헤더, no-store, audit 기록, rollback 후 기준선 복원까지 확인한다.
- 이 단계의 public NSG/route 변경과 실제 후보 배포는 별도 사용자 지시 이후에만 수행한다.

### 4. Viewer/Data Plane — 보류

B Gateway의 인터넷 사용자 접근 모델, 사용자 장치 인증, 환자 동의 기반 키 release, 영상 수신·임시 복호화·감사·철회 후 제거를 설계하고 별도 검증한다. 이 완료 전에는 Azure 웹 시연의 범위를 합성 메타데이터와 동의·정책 흐름으로 제한한다.

## 완료 판정과 요구사항

1차 준비 범위는 FR-001~005(동의), FR-006~009(메타데이터), FR-010~025(의료진 접근·정책·토큰), FR-037~041(감사)에 영향을 준다. FR-026~036의 실제 Gateway/Viewer 및 영상 전달은 후속 단계다. 개인정보/연구 반출 FR-042~046을 public web 시연으로 활성화하지 않는다.

이번 준비의 완료 조건은 공개 배포가 아니다. 검토 가능한 release SHA, 인증·claim mapping 계약, edge 경로/NSG 계획, 비용·복구 계획, 정상·거부 검증표가 준비되고 모든 blocker가 명시되면 제한 배포 후보로 검토할 수 있다. 실제 리소스 변경·public ingress·웹 공개·실 PACS 연동은 이번 문서 작성 범위에서 실행하지 않았다.
