# Azure 합성 웹 Edge·NSG 및 복구 계획

상태: PREPARATION / DRAFT / UNASSIGNED / NO CHANGE APPLIED
기준일: 2026-10-13 KST
범위: 제한된 합성 데이터 웹 시연의 Edge와 네트워크. 영상 Data Plane 공개는 제외한다.

## 현재 기준선 및 release 상태

- Cloud Control은 `infra/azure/capstone-control.compose.yml`에서 API/DB 포트를 publish하지 않고 내부 Docker network에 둔다. 현재 TLS ingress는 `infra/azure/capstone-control-ingress.compose.yml`의 `10.90.88.1:443:8443` binding뿐이며, 주석상 overlay 전용이다.
- VM template `infra/azure/capstone-cloud-vm.json`은 management source CIDR에서 SSH/VPN/HTTPS를 제한하고 나머지 inbound를 거부하도록 선언한다. 템플릿은 실제 Azure NIC/서브넷 effective rules의 증거가 아니다.
- 이 셸에서 `az` 실행파일을 찾지 못해 실제 NIC private IP, 연결된 NIC·subnet NSG, route table, effective security rules 및 public IP mapping은 조회하지 못했다. 현재 Azure network state는 **NOT VERIFIED**.
- 현재 checkout: branch `codex/wbs-12-key-release-20260912`; HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` (2026-10-10). 현재 `git status --short`는 540개 변경 파일(486 staged additions, 54 staged modifications)이며 clean하지 않다. 기존 변경과 이번 준비 작업을 섞어 commit하지 않았다. 따라서 HEAD는 immutable identifier일 뿐 staged working tree를 포함하지 않으며 이번 demo의 deployable release SHA로 선언할 수 없다.
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
4. Edge는 별도 서비스/Compose override로 분리하고 Control API의 내부 route policy를 그대로 전제하지 않는다. 현재 Control ingress는 일반 `/api/*` 다수를 허용하므로, public Edge는 승인된 demo에 실제 필요한 경로를 조사해 **정확 path allowlist**를 만든다. unknown route, `/dicomweb`, WADO, frame, Viewer image, import/export, PACS, Gateway, key release 및 일반 admin API는 기본 거부한다.
5. TLS는 demo DNS와 일치하는 유효 인증서 및 정상 chain을 사용한다. API/DB/Orthanc/Gateway port는 publish하지 않는다. `HIPASS_CONTROL_PLANE_ONLY=1`, 동의·RBAC/ABAC·감사·DPoP fail-closed 조건을 유지한다. 인증·actor mapping readiness 전까지 listener/NSG 변경은 적용하지 않는다.

## 적용 전 수집·승인 게이트

| 게이트 | 필요한 증거 | 현 상태 |
|---|---|---|
| Entra 로그인 및 합성 actor mapping | tenant/app/scope/redirect, 허용 사용자 `oid`, browser/MSAL flow, actual API+DPoP negative tests | BLOCKED — backend code/tests ready; Entra values and browser integration absent; [계약](../integration/entra-oidc-synthetic-actor-contract.md) 참조 |
| clean release | 승인된 source SHA, clean tree/PR, hosted SHA match, security·container scans, SBOM/digest | BLOCKED — 540 staged changed files (486 additions, 54 modifications) |
| 실제 Azure network inventory | VM/NIC/private IP/public IP, subnet/NIC NSG, route table, effective rules, host firewall | BLOCKED — local `az` unavailable |
| exact Edge path set | 정적 자산 목록 및 UI가 실제 호출하는 metadata routes; 모든 DICOM/관리 경로 denial | NOT STARTED |
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

## 참고 (Microsoft 공식 문서)

- [Azure NSG 유효 규칙 및 source CIDR 확인](https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-network/virtual-network-troubleshoot-nsg-blocking-traffic)
- [MSAL Browser Authorization Code + PKCE](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/about-msal-browser)
