# Azure 합성 웹 Edge·NSG 및 복구 계획

## 현재 로그인 화면 — 2026-10-13 15:29 KST

기존 진입 화면의 **환자로 시작하기 / 의료진으로 시작하기 → 지갑 로그인 화면 → Microsoft 계정으로 로그인** 흐름을 공개 웹/PWA에 반영했다. 기존 디자인 자산을 유지하는 방향으로 화면 전환과 인증 동작만 변경했다. 관련 요구사항 FR-001~025, FR-037~041(기존 서버 인증/권한/감사 경로 유지).

원인: 배포된 `public/ui/demo-entry.js`는 `isOpen()`만 반환했으나 새 로그인 버튼이 `landing.open()`을 호출했다. 배포본에 해당 기능을 포함하고 기존 역할 버튼을 복원했다. Entra 화면에서는 ID/PW·발표자 키 입력을 숨기고 required/disabled 상태도 함께 정리했다. 역할 선택은 안내이며 실제 역할은 서버 매핑으로 결정한다.

인증은 MSAL 5.25.0의 `loginRedirect`/`handleRedirectPromise`를 사용한다. SDK는 memoryStorage에서 redirect를 거부하므로 탭 단위 sessionStorage를 사용하고 응답 처리의 finally에서 `clearCache()`를 실행한다. 인증 결과는 서버 identity 검증 후 메모리의 세션으로 제공한다. localStorage/사용자 비밀번호 저장 없음. 기존 redirect bridge/등록 URI를 유지한다. [Microsoft redirect bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge).

- 최종 Web/PWA 이미지: `sha256:e977863303f17943f626c1fde4070f5a8fc3e4312f6a92319f8699a9781b4b53`
- 증적: `artifacts/azure/entra-web-20261013T062042Z-a70610/result.json`, **DRAFT / UNASSIGNED**. HEAD `049aa44bfd11c9db286ff890e72d2edb613fc86d`, dirty; HEAD 전체가 아닌 로그인 파일 3개만 배포.
- 변경: `public/capstone-auth.js`, `public/entra-auth.js`. 배포에 `public/ui/demo-entry.js`의 현재 open 기능도 포함했다. 추가: `scripts/public-login-release.py`, `test/entra-redirect-login.test.js`.
- Control 컨테이너 ID 유지 확인. DB·DICOM·NSG·Entra 등록 변경 없음. 커밋·푸시 없음.

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| 웹 환자 진입 → 지갑 로그인 → Microsoft 입력 화면 | PASS | 실제 브라우저에서 버튼 순차 클릭, 현재 탭의 Microsoft 로그인 입력창 확인 |
| 의료진 진입과 시작 화면으로 돌아가기 | PASS | 실제 브라우저에서 역할 제목 및 돌아가기 확인 |
| 모바일 경로 → 지갑 로그인 → Microsoft 입력 화면 | PASS | `/mobile/`에서 실제 순차 클릭 및 Microsoft 입력창 확인; 실기기 시험과 구분 |
| 설정/세션/서버 거부 및 redirect 집중 시험 | PASS | `node --test test/entra-browser-auth.test.js test/entra-redirect-login.test.js`, 5/5, exit 0, 최종 167.0235ms |
| 기존 로그인 사전확인·모바일 인증 회귀 | PASS | `node --test test/capstone-login-preflight.test.js test/mobile-capstone-auth.test.js`, 15/15, exit 0, 1050.4583ms |
| 계정 인증 후 복귀·홈·동의 종단 | NOT VERIFIED | 실제 계정 자격증명을 입력하지 않았으며 Microsoft 로그인 입력창까지만 확인 |

첫 UI 후보는 기존 로그인 창 연결에 성공했지만 SDK memoryStorage 조건 때문에 Microsoft 이동에 실패했다. 최종 후보는 위 조건 수정 후 이동 성공. 초기 후보 receipt `artifacts/azure/entra-web-20261013T061400Z-980822` 보존. 전체 보안 스캔/전체 MVP 시험을 새로 수행했다는 판정은 하지 않는다.

배포 명령 `python scripts/public-login-release.py`, 두 후보 각각 exit 0. 빌드/업로드/배포 전체 경과는 별도 계측하지 않았다. 최종 파일 SHA-256은 result.json에 기록했다. 공개 페이지/API/비밀번호의 범위는 이전 공개 계약과 동일하다.

Web만 이전 후보로 복구할 때 승인된 Cloud SSH에서 다음을 사용한다(DB/volume 변경 없음). 이 최종 복구 명령은 실행하지 않았다.
```sh
sudo -n docker compose -p hp-public-web -f /home/highpassadmin/.highpass-login-entra-web-20261013T062042Z-a70610/before.json up -d --no-deps --pull never web
```
이 복구 파일은 최초 구형 UI가 아니라 직전 UI 후보를 복원한다. 최초 공개 Web 기준선은 `sha256:1b780bf49fb603e196f5b6a860aeed2937fb9beee56e12f42d921b7d13498c9f`이며 최초 공개 서비스 전체 복구 절차는 아래 이력을 참고한다.

다음 작업 한 개: 허용 환자 계정으로 **Microsoft 인증 완료 → 원래 웹/PWA 경로 복귀 → 홈** 확인. 전체 MVP/v3 완료 판정 없음.

## 현재 상태 — 2026-10-13 15:05 KST 기존 VM 인터넷 웹 공개

사용자가 기존 Azure VM + HTTPS + 웹 방화벽 + Entra 방식을 선택하여 배포했다. 아래의 미배포/승인 대기 문구는 이전 이력이다. 이번 범위는 **공개 로그인 진입 화면과 제한된 메타데이터 API**이며 전체 앱/영상 종단 서비스 완료가 아니다. 신규 증적은 **DRAFT / UNASSIGNED**.

- 웹: <https://highpass-demo.japaneast.cloudapp.azure.com/>
- 모바일 PWA 진입: <https://highpass-demo.japaneast.cloudapp.azure.com/mobile/>
- 관측 HEAD `049aa44bfd11c9db286ff890e72d2edb613fc86d`, dirty. 작업 트리의 다른 RAG 변경은 배포에 포함하지 않았다. 배포 식별자는 아래 이미지/파일이며 HEAD 전체 배포가 아니다.
- 기존 Cloud VM의 NIC `10.89.0.4:443`에 별도 Edge. 기존 overlay ingress와 PostgreSQL 컨테이너는 재생성하지 않았다. 새 VM/Front Door/관리형 WAF를 만들지 않았으며 기존 VM·저장·트래픽 비용은 계속 발생한다.
- Caddy + Coraza/OWASP CRS를 사용한다. 인터넷 inbound 추가는 `Allow-Highpass-Public-HTTPS`, priority 130, Internet → `10.89.0.4` TCP 443 하나다. SSH·VPN·DB·PACS 포트를 추가 공개하지 않았다. HTTP 80 미개방, TLS-ALPN 인증서 발급 방식이다.
- Let's Encrypt 정상 신뢰 인증서, TLS 1.3 접속 관측. 만료 `2027-01-11 05:04:10 UTC`. 자동 갱신 설정은 있으나 갱신 주기 실제 수행은 NOT VERIFIED.
- Entra SPA에 공개 `/entra-redirect.html`을 추가하고 기존 사설 redirect를 보존했다. 허용 환자·의료진 매핑만 사용하며 공개 개발용 ID/PW·발표자 키 경로는 차단한다.

### 배포 식별자와 변경 범위

- Control: `sha256:0bdae4ad431840879d6f44a7f9bad2f2f480405a8fdad46f2efcd8e90a434928`
- Web/PWA: `sha256:1b780bf49fb603e196f5b6a860aeed2937fb9beee56e12f42d921b7d13498c9f`
- WAF: `sha256:627229dd936934d773cf1a8de77ec9ae89d547b1a891e6da3b46b0282bb694cc`
- 인증 전용 기존 후보에 환자 grant 런타임의 `TEST / ENTRA_OIDC` 허용 조건을 추가했다. 동의·DPoP·키 발급·DB 최소권한 조건은 유지했다. 이전 후보의 시험/스캔을 이 최종 이미지의 재검증 결과로 승계하지 않는다.
- 별도 공개 서버 `scripts/start-public-web.js`, `infra/azure/public-web.Caddyfile`, 배포/복구 도구 `scripts/public-web-deploy.py`, `scripts/public-web-remote.py`. 공개 서버는 허용 API만 프록시하며 Bearer 인증과 기존 서버 정책을 사용한다. 메타데이터 요청의 내부 ingress 서명을 생성하고 외부 service-token을 전달하지 않는다. HTML에는 기존 capstone 인증 표시를 유지한다.
- 관련 FR: FR-001~025(인증/동의/범위), FR-037~041(감사/접근 경계). 신규 전체 NFR 준수 판정을 하지 않는다.

### 실행 결과와 한계

| 관측 | 결과 | 근거 |
|---|---|---|
| HTTPS 웹·모바일 진입 | PASS | 정상 CA 검증 GET 각각 200, 두 실제 브라우저에 Microsoft Entra 로그인 버튼 표시 |
| 공개 auth-config | PASS | 200, ENTRA_OIDC 및 공개 redirect 일치 |
| 미인증 identity | PASS | 401 |
| 공개 DICOM·감사 경로 | PASS | `/dicomweb/studies`, `/api/audit-logs` 403 |
| Control·Web·WAF 기동 | PASS | running, restart 0, Control healthy |
| 실제 Microsoft 계정 로그인 후 홈·동의 | NOT VERIFIED | 이번에는 로그인 화면까지 확인 |
| 휴대폰 LTE/5G 실제 접속 | NOT VERIFIED | 인터넷 허용 설정과 데스크톱 공개 접속 확인만 수행 |
| 인터넷 CT·700장 전송·B PACS 수신 | NOT VERIFIED | 사설 Data Plane 경로 미연결, 공개 경로 차단 유지 |
| 기존 B 사설 포털 인증 UI 정렬 | NOT VERIFIED | B 포털 이미지는 이번에 변경하지 않음; Control은 Entra로 전환되어 이전 TEST 로그인 호환을 보장하지 않음 |
| 전체 보안 회귀·최종 이미지 재스캔 | NOT VERIFIED | 사용자 지시에 따라 반복 전체 검증을 재개하지 않음 |

최초 후보 기동은 `PATIENT_GRANT_PROFILE_REQUIRED`로 실패하여 기존 Control 이미지로 자동 복구했다. 해당 시작 조건 수정 후 위 최종 후보 기동에 성공했다. 첫 인증서 발급은 NSG 개방 전 연결 timeout으로 실패했고, 개방 후 자동 재시도에서 정상 발급됐다. 실패 이력을 정책 DENY나 PASS로 변경하지 않는다. 존재하지 않는 추정 경로 `/ui/patient-wallet-home.css`를 진단 조회한 404는 실제 HTML의 `/ui/wallet-home.css`와 다르며 페이지 자산 실패로 해석하지 않는다.

실행 명령: `python scripts/entra-candidate.py --build-capture artifacts/azure/entra-web-20261013T051144Z-e56d9a`, 이후 `python scripts/public-web-deploy.py stage`, `activate`, `open`, `status` (후속 명령에는 아래 receipt 사용). 최종 각 명령 exit 0. 초기 activate 두 번은 exit 2/도구상 실패였으며 복구됨. 전체 경과 시간은 별도 계측하지 않았다. `node --check scripts/start-public-web.js` exit 0. 실제 공개 URL 최소 접속 확인은 exit 0이며 전체 종단 시험이 아니다.

증적: `artifacts/azure/entra-web-20261013T055820Z-c7711a/{stage,activate,open,status}-result.json`. 초기 실패 receipt `artifacts/azure/entra-web-20261013T054821Z-958bd7` 보존. 비밀정보 포함 가능 운영 원본은 artifacts 내부에 두고 Git/채팅으로 내보내지 않는다.

### 재현 및 복구

상태 조회:
```powershell
python scripts/public-web-deploy.py status --receipt artifacts/azure/entra-web-20261013T055820Z-c7711a
```

필요 시 복구(이번 공개 NSG 규칙만 제거 → 공개 서비스 정지 → 기존 Control 복원, DB/volume 삭제 없음):
```powershell
python scripts/public-web-deploy.py rollback --receipt artifacts/azure/entra-web-20261013T055820Z-c7711a
```

최종 공개 배포의 이 복구 명령은 **아직 실행하지 않았다**. 초기 실패의 Control 자동 복구와 구분한다. Entra 공개 redirect 등록과 TLS 파일은 복구 시 보존된다. 서버 배포 파일 위치는 `/home/highpassadmin/.highpass-public-20261013T055820Z-c7711a`; TLS private key와 기존 ingress secret은 공개 정적 경로가 아니다.

다음 작업 한 개: **허용 환자 계정으로 공개 주소 로그인 → 홈 진입**. 영상 Data Plane 인터넷 연결과 B 인증 화면 정렬은 별도 미완료로 남긴다. CAPSTONE MVP/v3 완료를 선언하지 않는다. 커밋·푸시 없음.

## 2026-10-13 12:19 KST DNS 적용 — 외부 로그인 서비스는 미배포

사용자가 `highpass-demo` 이름 및 휴대폰 외부망에서 로그인 후 접속하는 방향을 선택했다. 기존 Public IP에 DNS label만 설정했고 독립 GET에서 `highpass-demo.japaneast.cloudapp.azure.com`을 확인했다. **DNS 설정 PASS / 웹 HTTPS·외부 로그인 NOT VERIFIED**. 초기 CLI `check-dns-name`은 미지원으로 FAIL(변경 없음), 공식 ARM `checkDnsNameAvailability` GET으로 대체해 성공했다. 기존 지정망 /32 제한을 아직 유지하고 있으며 일반 인터넷 허용으로 변경하지 않았다.

- 명령 `python scripts/azure-web-dns.py --apply`, exit 0; 증적 `artifacts/azure/web-dns-20261013T031954Z/result.json`, DRAFT / UNASSIGNED. 초기 실패 증적 `artifacts/azure/web-dns-20261013T031830Z/result.json` 보존.
- Public IP 주소/할당/SKU/NIC 연결/idle timeout/tags 전후 동일 확인. DNS 외 NSG·VM·Control·DB·PACS·Key Vault 변경 및 서비스 재시작 없음. DNS 전파 및 실제 TLS 브라우저 연결은 ARM readback과 구분한다.
- 안전성 정적 계약 `python -m unittest discover -s test -p azure_web_*_test.py`, exit 0, 4/4 PASS, unittest reported 0.025초. 전체 보안·배포 회귀가 아니다.
- 후속 `Resolve-DnsName highpass-demo.japaneast.cloudapp.azure.com -Type A -DnsOnly -QuickTimeout`, exit 0: 워크스테이션 resolver에서 A=138.91.2.60 PASS. 모든 외부 DNS resolver의 전파 완료 또는 HTTPS 접속을 뜻하지 않는다. DNS operator receipt elapsedSeconds=35.502.

### 외부망 공개 방향과 남은 결정

확인된 요구사항: 인터넷 어디서나 HTTPS 진입, 인증된 시연 사용자만 합성 환자·의료진 권한으로 접근. 전체 신규 회원에게 홍길동 기록을 자동 할당하거나 공유 발표자 키로 인터넷 로그인을 대체하지 않는다. 기존 OIDC/동의/DPoP/감사 계약을 유지한다.

현재 TEST 인증 때문에 인터넷 개방은 차단한다. 실제 허용 계정(환자/의료진 Microsoft 또는 Entra 계정)을 사용자에게 지정받고, 서버 관리형 object ID 매핑과 actual tenant/app/scope/redirect를 설정·검증해야 한다. 사용자 비밀번호·client secret·private key를 채팅이나 Git으로 받지 않는다.

기존 계획의 일반 인터넷 공개 관문인 WAF·비용 검토도 미완료다. Front Door는 시간별 기본 요금과 요청/전송 비용이 있으며 Standard/Premium과 managed rule 지원이 다르다. 비용 승인 없이 새 자원을 생성하지 않는다. Front Door를 채택하면 공개 사용자 주소는 해당 frontend이고 `highpass-demo`는 보호된 origin으로 활용할 수 있으므로, 현재 이름을 유지한 직접 VM 접속 요구와 구분해 확정해야 한다. 직접 VM Edge와 관리형 WAF는 서로 대체 가능한 완료 증거가 아니다. [Microsoft 비용 구조](https://learn.microsoft.com/en-us/azure/frontdoor/billing), [요금 비교](https://learn.microsoft.com/en-us/azure/frontdoor/compare-cdn-front-door-price).

다음 작업 한 개: **허용 환자·의료진 시연 계정을 지정하고 실제 OIDC 연결 계약 확정**. 이후 WAF/예산·TLS 발급 갱신·경로 allowlist·clean reviewed image·외부망 정상/거부/rollback을 완료한 후에만 공개한다. DNS 등록만으로 공개 시연 또는 전체 MVP/v3 완료라고 표현하지 않는다. `azure-compliance` 스킬의 진단/변경 분리 원칙을 적용했고 전체 azqr audit를 실행한 것으로 주장하지 않는다.

## 2026-10-13 12:12 KST 실제 VM 재점검 — 공개 배포 전 관문 유지

사용자 요청에 따라 기존 VM의 별도 안전한 웹 진입점을 검토했다. 이번 범위는 읽기 전용 inventory와 계획 보완이며 DNS/NSG/인증/서비스 배포 변경은 없다. 이전 B 저장소 재부팅·전송 작업의 중단은 유지한다. 아래 예전의 CLI/NIC 미확인 기록은 이력이며 네트워크 관측은 이번 결과를 우선한다.

- 실행: `python scripts/azure-web-edge-inventory.py`, exit 0, 22.440초. VM/NIC/Public IP/NSG/subnet/effective NSG/routes/pinned SSH host 8개 조회 PASS. 조회 성공은 보안 적합성 또는 공개 로그인 PASS가 아니다.
- 증적: `artifacts/azure/web-edge-inventory-20261013T031231Z/result.json`; DRAFT / UNASSIGNED. HEAD `9f27b85ab349ea5e5e5b6dc2da659825047a6d25` + dirty. 다른 작업의 파일은 보존하고 commit/push하지 않았다.
- 실제 VM `vm-highpass-capstone`, Japan East, Standard_B2als_v2. NIC `10.89.0.4` (Dynamic), 연결된 Standard Static Public IP `138.91.2.60`, `dnsSettings=null`. 서브넷 별도 NSG/route table 없음; NIC NSG와 effective routes 조회 증적 보존.
- effective inbound: source `112.76.111.121/32`의 SSH 22/TCP, VPN 51820/UDP, HTTPS 443/TCP만 priority 100/110/120 허용; priority 200에서 나머지 inbound 거부. 외부 허용/거부 source의 실제 probe는 NOT VERIFIED.
- 호스트 `ss -lnt`: HTTPS는 `10.90.88.1:443`만 존재. `10.89.0.4:443` listener는 없다. 현재 Control/PostgreSQL healthy, API/DB published port 없음. ingress 자체 healthcheck는 null이므로 healthy라고 승격하지 않는다.
- 실제 Control `AUTH_MODE=TEST`, `HIPASS_CONTROL_PLANE_ONLY=1`, `HIPASS_DPOP_REQUIRED=1`. 기존 테스트 인증 공개 금지. 실제 Entra 로그인은 NOT VERIFIED.
- 실행 이미지: Control `sha256:3d1cb6c2d7dfcaf33d1cefd13b89055ac58e6a5ab349808352862fbe08895436`, ingress `sha256:ac29dc9d739bb1fd6fa6caebd2ee001dbbbf551a51d982b8d69b7df6dda10eb5`, PostgreSQL `sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568`.

### 구현 결정과 다음 작업 한 개

기존 overlay listener는 유지하고, 후보 Edge는 관측된 NIC private IP에만 별도로 bind한다. NIC IP가 Dynamic이므로 매 적용 전 재조회·일치 검사하며 임의 static 전환하지 않는다. 정확 경로 allowlist, 정상 TLS, 실제 OIDC actor mapping, 기존 동의/DPoP/감사를 통과하기 전 Edge를 띄우지 않는다. PACS·DB·키 발급·DICOM/Viewer 픽셀 경로는 이번 공개 메타데이터 단계에서 제외하고 미완료로 남긴다.

DNS 후보 prefix는 `highpass-demo`로 제안하지만 미확정/미예약이다. `*.japaneast.cloudapp.azure.com`의 정확 FQDN은 Azure availability 조회와 적용 후 반환값으로 확인한다. DNS 이름만 설정해도 TLS 인증서가 자동 설치되지는 않는다. source 제한을 전 세계로 확대하거나 인증서 발급을 위해 port 80을 자동 개방하지 않는다. 발급 방식과 갱신은 별도 검증해야 한다. [Microsoft VM FQDN](https://learn.microsoft.com/en-us/azure/virtual-machines/create-fqdn), [Public IP DNS label](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses/).

다음 작업은 **공개 접속 계약 확정**이다: DNS prefix, 기존 지정망만/추가 시연망/일반 인터넷 접속 중 대상, 실제 Entra SPA/API app 및 허용 환자·의료진 object ID, TLS 발급·갱신 방식을 확정한다. 일반 인터넷 공개는 기존 /32 제한의 확장이고 WAF·비용 검토가 필요한 별도 결정이다. 인증서는 private key를 채팅·Git에 받지 않는다. 입력 전에는 공개 배포를 진행하지 않는다.

검증: `python -m unittest discover -s test -p azure_web_edge_inventory_test.py`, exit 0, 2/2 PASS (unittest reported 0.010초). 읽기 전용 명령·tenant/subscription guard·환경값 최소화의 offline 확인이며 Azure 인증/차단/rollback 시험을 대체하지 않는다. 관련 FR-001~025, FR-037~041; 기존 Gate/승인 요구를 변경하지 않는다. `azure-validate` 스킬은 승인된 azd 계획이 없어 적용 중단했고, 기존 non-azd VM/Compose workflow를 유지했으며 Validated 상태를 선언하지 않는다.

상태: PREPARATION / DRAFT / UNASSIGNED / NO CHANGE APPLIED
기준일: 2026-10-13 KST
범위: 제한된 합성 데이터 웹 시연의 Edge와 네트워크. 영상 Data Plane 공개는 제외한다.

## 현재 기준선 및 release 상태

- Cloud Control은 `infra/azure/capstone-control.compose.yml`에서 API/DB 포트를 publish하지 않고 내부 Docker network에 둔다. 현재 TLS ingress는 `infra/azure/capstone-control-ingress.compose.yml`의 `10.90.88.1:443:8443` binding뿐이며, 주석상 overlay 전용이다.
- VM template `infra/azure/capstone-cloud-vm.json`은 management source CIDR에서 SSH/VPN/HTTPS를 제한하고 나머지 inbound를 거부하도록 선언한다. 템플릿은 실제 Azure NIC/서브넷 effective rules의 증거가 아니다.
- 이 셸에서 `az` 실행파일을 찾지 못해 실제 NIC private IP, 연결된 NIC·subnet NSG, route table, effective security rules 및 public IP mapping은 조회하지 못했다. 현재 Azure network state는 **NOT VERIFIED**.
- 현재 checkout: branch `codex/wbs-12-key-release-20260912`; HEAD `9f27b85ab349ea5e5e5b6dc2da659825047a6d25` (2026-10-13 10:55 KST). 2026-10-13 11시대 점검에서 `git status --short`는 여러 변경 경로를 보여 dirty였고 staged 경로는 없었다. 공유 작업 트리의 다른 변경과 이번 준비 작업을 섞어 stage/commit하지 않았다. 따라서 HEAD는 immutable identifier일 뿐 현재 변경을 포함하지 않으며 이번 demo의 deployable release SHA로 선언할 수 없다.
- `docs/governance/release-approval.md`의 release gate는 exact source/hosted SHA 일치, security/container gate, SBOM, digest-bound exceptions, rollback evidence 및 approver를 요구한다. 이 문서의 새 기능/배포는 현재 없음. 기존 [`rollback.md`](rollback.md)는 이전 PoC application container 복구 기록이며 이번 Azure listener/NSG 복구를 증명하지 않는다.

## Edge 경로 결정안

```text
허용된 demo source CIDR
       │ TCP 443 / HTTPS
       ▼
Azure Public IP → VM NIC private IP:443 → 별도 Web Edge (정확 경로 allowlist)
                                                   │ private Compose network
                                                   ▼
                                    Control API → private PostgreSQL

10.90.88.1:443 overlay ingress는 유지. DICOM/WADO/frames/PACS/Gateway는 public path에서 거부.
```

1. 기존 `10.90.88.1:443`를 재사용·재바인딩하지 않는다. public IP 자체에 직접 bind하지 않고 Azure NIC의 **현재 확인된 private IP**에 별도 Edge listener를 bind한다. 해당 주소를 확인하고 port collision/effective route 검증하기 전 Compose overlay를 만들거나 띄우지 않는다. wildcard `0.0.0.0` bind도 금지한다.
2. 한정 시연은 미리 승인된 demo 출구 IP/CIDR만 TCP 443 allowlist에 넣는다. `Internet`, `Any`, `0.0.0.0/0` 허용은 금지한다. 현재 template의 management `/32` 및 VPN 제한은 보존한다. 일반 공개 대상이 반드시 필요하면 별도 WAF/Front Door 비용·구성 검토를 먼저 하고 현재 USD 100 입력 상한에 대한 최신 가격/비용 검증 후 별도 승인한다.
3. NIC와 subnet 양쪽 NSG, effective rules/priority, host firewall, Docker published ports를 함께 점검한다. 명시적 demo 443 allow는 검증된 CIDR·TCP·443에만 한정하고, 나머지 inbound deny를 그대로 유지한다. 적용 후 allowed/denied source 양쪽에서 IP flow 및 실제 TLS probe를 확인한다.
4. Edge는 별도 서비스/Compose override로 분리하고 Control API의 내부 route policy를 그대로 전제하지 않는다. 현재 Control ingress는 일반 `/api/*` 다수를 허용하므로, public Edge는 승인된 demo에 실제 필요한 경로를 조사해 **정확 path allowlist**를 만든다. 최소한 `/entra-redirect.html`, `/vendor/msal-browser.js`, `/vendor/entra-redirect.js` 및 합성 auth-config 경로를 검토하고, `connect-src https://login.microsoftonline.com`을 반영한다. redirect bridge 응답에는 COOP를 적용하지 않는다. unknown route, `/dicomweb`, WADO, frame, Viewer image, import/export, PACS, Gateway, key release 및 일반 admin API는 기본 거부한다.
5. TLS는 demo DNS와 일치하는 유효 인증서 및 정상 chain을 사용한다. API/DB/Orthanc/Gateway port는 publish하지 않는다. `HIPASS_CONTROL_PLANE_ONLY=1`, 동의·RBAC/ABAC·감사·DPoP fail-closed 조건을 유지한다. 인증·actor mapping readiness 전까지 listener/NSG 변경은 적용하지 않는다.

## 적용 전 수집·승인 게이트

| 게이트 | 필요한 증거 | 현 상태 |
|---|---|---|
| Entra 로그인 및 합성 actor mapping | tenant/app/scope/redirect, 허용 사용자 `oid`, actual browser token exchange, API+DPoP negative tests | BLOCKED — backend and same-origin MSAL popup/bridge implemented; local mock browser flow through `/identity` returns a synthetic mapped actor; tenant values and real sign-in absent; [계약](../integration/entra-oidc-synthetic-actor-contract.md) 참조 |
| clean release | 승인된 source SHA, clean tree/PR, hosted SHA match, security·container scans, SBOM/digest | BLOCKED — shared worktree remains dirty (no staged paths at last check); full suite has 3 failures; no reviewed release commit or image digest |
| 실제 Azure network inventory | VM/NIC/private IP/public IP, subnet/NIC NSG, route table, effective rules, host firewall | BLOCKED — local `az` unavailable |
| exact Edge path set | 정적 자산 목록 및 UI가 실제 호출하는 metadata routes; 모든 DICOM/관리 경로 denial | IN PROGRESS — auth bootstrap candidate is `/`, `/entra-redirect.html`, `/vendor/msal-browser.js`, `/vendor/entra-redirect.js`, `GET /api/capstone-demo/auth-config`, and bearer-protected `GET /api/capstone-demo/identity`; full app/API route trace is still required before publishing any allowlist |
| audience/CIDR/TLS | 승인된 demo DNS, TLS certificate chain, 모든 허용 출구 CIDR | INPUT REQUIRED |
| 비용·운영 창 | 실제 현재 비용/quota, 제한된 시험 시간과 종료 책임자 | NOT VERIFIED |

## 변경 전 복구 지점

변경 명령을 실행하기 전에 operator는 protected evidence directory에 다음을 기록한다. 비밀값·private key/token은 기록하지 않고 경로·소유권·권한·fingerprint만 남긴다.

- 현재 release commit, 이미지별 immutable digest, 전체 Compose file list와 `docker compose config`의 redacted/hash 형태
- container ID, 상태, network, mounts, PostgreSQL volume identity 및 health; 어떠한 DB/schema change도 계획하지 않는다
- NIC/subnet NSG의 전체 현재 규칙과 effective rules, NIC private/public IP mapping, route table/UDR, host firewall/listener 상태
- 기존 overlay `10.90.88.1:443` TLS 인증서 fingerprint/만료일, API/DB reachability와 health, A/B overlay control probes
- DNS 이전값/TTL, 신규 allowlist rule의 이름·priority·source·target·deployment ID, 담당자·시간·승인 참조

기준선의 일부라도 수집할 수 없으면 적용을 중지한다. NSG 전체를 템플릿으로 덮어쓰거나 현재 규칙을 추정해 다시 만들지 않는다.

## 배포·검증 시나리오 (후속 승인 필요)

1. release SHA와 image digest를 고정하고 정적 보안·취약점·SBOM gate를 통과한다. 동일 digest를 promote한다.
2. private IP bind와 exact route allowlist를 compose config에서 검사한다. 새 Edge만 시작하고 Control, PostgreSQL, overlay listener를 재시작·재생성하지 않는다.
3. 기존 NSG baseline을 보존한 채 source allowlist HTTPS rule 하나만 적용한다. 전체 접근 허용/다른 규칙 변경을 하지 않는다.
4. 허용 source에서 Entra 로그인, synthetic patient/doctor mapping, consent/policy API, no-store/audit를 검증한다. 미허용 source는 TCP/TLS에 도달할 수 없어야 하며, 허용 source라도 DICOM/WADO/frame/import/export/Gateway/admin/unknown path는 거부되어야 한다.
5. `5432`, `3000`, `8042`, Gateway 및 DB에 public reachability가 없고 overlay endpoint·A/B 사설 client가 영향받지 않았음을 재검증한다.
6. 승인된 demo window에서만 열고 종료 시 exact Edge/NSG rollback을 실행한다. 시험 중 actual PACS 또는 실제 환자 데이터는 절대 연결하지 않는다.

## Edge/NSG rollback

Rollback trigger: OIDC/actor-map 또는 DPoP denial test 실패, unknown/public DICOM path 허용, unapproved CIDR 접근, TLS/certificate 오류, Control/API/DB/overlay health 변화, audit 누락/PII leak, 비용 한도 경보.

1. 공지된 demo 중단 페이지/응답으로 먼저 신규 유입을 끊는다.
2. 새 Web Edge service/listener만 정지한다. Cloud Control, PostgreSQL, 기존 overlay ingress는 변경하지 않는다.
3. 이번 change ID의 443 NSG allow rule만 제거하고 변경 전 captured rules와 effective state를 비교한다. 동시 타 팀/운영 변경을 덮어쓰지 않는다. DNS를 바꿨다면 이전 값으로 되돌리되 TTL을 고려한다.
4. 기존 private `10.90.88.1:443` overlay ingress가 동일한 image/config/cert로 health를 통과하고 A/B client TLS/control probes가 복구됐는지 확인한다.
5. 전/후 NSG, route, listener, container/image digest, probe result 및 audit integrity를 남긴다. DB volume 삭제, `docker compose down -v`, schema downgrade, audit deletion은 금지한다.
6. 복구 확인 전 재시도하지 않는다. 원인 분석 및 새 release SHA/변경 승인이 필요하다.

이번 단계에서는 Entra app registration, Azure NSG/NIC, DNS, TLS, VM, Compose runtime을 변경하지 않았다. 실제 공개 배포 및 적용은 clean release SHA, 필수 입력, network inventory 및 별도 change approval 이후 작업이다.

로컬 준비 검증: `node --test test/entra-browser-auth.test.js test/entra-oidc-auth.test.js test/capstone-login-preflight.test.js` PASS 13/13; 테스트 전용 mock browser flow는 합성 `/identity` actor 반환까지 PASS. `node scripts/build-entra-client.js`, `docker build --progress=plain --target entra-client .` 및 두 Compose 파일의 `config --no-interpolate --quiet`는 PASS다. Docker build는 dependency install script를 실행하지 않도록 `--ignore-scripts`로 고정한 build-only stage이며 최종 app image는 아직 만들지 않았다. 실제 Compose 변수 보간은 `HIPASS_APP_IMAGE`, `HIPASS_CAPSTONE_PUBLIC_ORIGIN`, `HIPASS_POSTGRES_IMAGE`, `HIPASS_CLOUD_SECRET_DIR`가 없어 검증되지 않았다. 전체 suite는 1,210건 중 1,207 PASS / 3 FAIL (`test/hcc-source-operator-contract.test.js` 1건, `test/medlineplus-upload.test.js` 2건)이다. 실패를 분리해 재실행했을 때 HCC 실패는 재현됐고 MedlinePlus 2건은 재현되지 않았다. 모두 이번 Entra 변경과 무관한 현재 worktree 테스트이며 release gate를 계속 막는다.

## 참고 (Microsoft 공식 문서)

- [Azure NSG 유효 규칙 및 source CIDR 확인](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-network/virtual-network-troubleshoot-nsg-blocking-traffic)
- [MSAL Browser Authorization Code + PKCE](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
