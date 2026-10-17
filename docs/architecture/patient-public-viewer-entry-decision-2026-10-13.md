# B 외부 영상 접속 경로·도메인·TLS 결정

2026-10-13 KST · 설계 기준 확정 / 외부 적용 전 · DRAFT / UNASSIGNED

후속 적용: 사용자가 추가 비용·공개 경로를 승인했고, 신규 IPv4 `20.89.43.127`·DNS·B TLS 진입점이 배포됐다. 아래는 결정 당시 기록이며 최신 결과는 [배포 기록](../operations/patient-public-entry-rollout-2026-10-13.md)을 따른다. Cloud L4 구현은 기존 systemd-socket-proxyd를 사용했고, 임상 경로는 전부 차단 상태다.

## 작업 목적과 범위

사용자의 “B 외부 접속 경로와 도메인/TLS 구성을 확정” 요청에 따른 결정이다. 새 비용·공개 경로를 실제 적용하는 작업과 구분한다. 이번에는 Azure GET/list, DNS 이름·사설 IP 가용성 확인, Cloud SSH 읽기 전용 상태 확인, 공식 문서/가격 조회만 수행했다. 인증서·리소스·포트·서비스·소유권 DB는 변경하지 않았다.

관련 기능군: FR-006~009, FR-014~025, FR-026~036, FR-037~041. 개별 FR 원문 미확보, NFR 번호 임의 지정 없음. 기존 구조 및 보안 기준은 [선행 설계](patient-public-viewer-entry-2026-10-13.md)를 유지한다. 앱 API 변경은 이번 작업에 없다.

## 확정할 구현 기준

| 항목 | 선택한 값 / 방식 |
|---|---|
| 환자가 사용하는 웹 주소 | 기존 `https://highpass-demo.japaneast.cloudapp.azure.com` 유지 |
| B 영상 전용 origin | `https://highpass-images-b.japaneast.cloudapp.azure.com` |
| DNS 상태 | Japan East `CheckDnsNameAvailability`에서 available=true. **미예약·미생성**; 실제 생성 시 재확인 |
| 공인 진입점 | 별도 Regional Standard Static IPv4 1개. 계획 리소스명 `pip-highpass-images-b` |
| 기존 VM 연결 | `nic-highpass-capstone`에 secondary IP configuration `patient-images-b`, 사설 주소 `10.89.0.5` 계획 |
| 기존 웹 | primary `10.89.0.4:443` / 기존 DNS·인증서·WAF·Entra callback 유지 |
| 외부 포트 | 새 IP의 TCP 443만. 80/UDP443/9443/Orthanc/SSH 새 공개 없음 |
| Cloud 역할 | 별도 제한된 L4 TCP relay → WireGuard. TLS 비종료, 영상 HTTP/복호화/저장/캐시 없음 |
| B 도착점 | `10.90.88.3:9444`의 환자 전용 TLS ingress 계획. 기존 B portal 9443과 분리 |
| TLS 종료·인증서 개인키 | B VM 전용 Caddy ingress. 기존 웹 인증서 개인키를 복사하지 않음 |
| 인증서 발급 | Let's Encrypt ACME TLS-ALPN-01, 자동 갱신. 외부443의 TLS handshake를 그대로 B로 전달 |
| 앱 로그인 | 기존 Microsoft 로그인 유지, 영상 도메인에 Entra redirect 추가하지 않음 |

```text
브라우저: 기존 Azure 화면 + RAM의 환자 Grant/DPoP
     │ HTTPS (B 영상 hostname)
     ▼
새 공인 IPv4:443 → 기존 VM secondary 10.89.0.5:443
     │ L4 TCP relay: TLS를 열지 않음
     ▼ WireGuard
B 10.90.88.3:9444 → 환자 전용 TLS ingress
     │ 여기서 TLS 종료, exact 경로/CORS/제한 검사
     ▼ 검증된 내부 HTTPS
B patient Gateway → 기존 권한·감사·키 release 경로 → A Gateway/PACS
```

Azure NIC에 여러 사설/공인 IP를 구성하는 방식은 [Microsoft 공식 문서](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/virtual-network-multiple-ip-addresses-portal)를 기준으로 한다. secondary 주소는 게스트 OS에도 정확히 반영해야 하며, 기존 primary/DHCP/default route를 바꾸지 않는다. 현재 확인은 할당 가능성이지 실제 secondary 연결 성공 증거가 아니다.

## Cloud 경계의 명확한 정의

이 선택은 기존 `docs/ARCHITECTURE.md`의 “Cloud host는 암호화 패킷 라우터이며 Control API 영상 프록시가 아니다”를 따른다. **영상이 포함된 TLS 암호문은 Azure 네트워크를 통과한다.** Azure를 전혀 통과하지 않는다고 표현하지 않는다.

기존 환자 계약의 “Cloud는 임상 영상 바이트를 전달하지 않는다”는 문구는 배포 전에 “Control/API/웹 응용 계층에서 영상 본문을 전달·복호화·저장하지 않는다. 별도 네트워크 L4 암호문 중계는 허용한다”로 경계를 정렬해야 한다. 이를 넘어 Azure 영상 TLS 종료나 HTTP 프록시로 변경하지 않는다. 조직 기준이 암호문 네트워크 통과까지 금지한다면 이 결정은 적용하지 않고 B 공인 회선 직접 연결안을 다시 검토한다.

## 실제 읽기 전용 확인 결과

| 확인 항목 | 결과 | 관측 내용 |
|---|---|---|
| Azure VM | PASS | `vm-highpass-capstone`, Standard_B2als_v2, VM running, provisioning Succeeded |
| 기존 공인 IP/DNS | PASS | Standard Static `138.91.2.60`, highpass-demo hostname. 공인 IP 1개/primary IP configuration 1개 |
| 새 DNS 이름 가용성 | PASS | highpass-images-b / japaneast / available=true. 예약 아님 |
| 계획 사설 IP 가용성 | PASS | 10.89.0.5 available=true, isPlatformReserved=false. 할당 아님 |
| NIC IP forwarding | PASS | enableIPForwarding=true. 첫 조회의 잘못된 필드 대소문자로 나온 null은 이 정확한 필드 조회로 정정 |
| 기존 ingress | PASS | 공개 웹 WAF 10.89.0.4:443→8443. 웹/WAF 실행·restart0, Control healthy |
| B 목적지 라우트 | PASS | 10.90.88.3은 hp-capstone interface, source10.90.88.1 |
| 터널 상태 | PASS | 기존 두 peer handshake 경과13초/120초 관측. 신규 B 서비스 접근 성공 의미 아님 |
| B 새 listener/TLS/실제 모바일 CT | NOT VERIFIED | 신규 포트·인증서·서비스 미생성 |

NSG 현재 public HTTPS 규칙은 priority130, Internet→10.89.0.4:443이다. 계획 규칙은 사용 전 충돌 재확인 후 priority140, Internet→10.89.0.5:443만 허용한다. 기존 admin/source 제한·deny 규칙을 보존한다. 관리망에서 모든 목적지443을 허용하는 기존 규칙도 새 IP에 적용된다는 사실을 변경 검토에 포함한다. 기존 public IP의443을 새 B로 우회시키지 않는다.

## TLS·중계·B ingress 상세

- Cloud는 고정 목적지 `10.90.88.3:9444`로만 연결하는 TCP 모드 중계(HAProxy 후보)로 구성한다. HTTP 모드, TLS 인증서 mount, 동적 upstream, 파일 response cache를 사용하지 않는다. 정확한 이미지 digest와 제한된 실행권한은 후보 빌드 때 확정한다.
- 게스트 방화벽·relay egress를 위 목적지로만 제한한다. B 새9444는 overlay source10.90.88.1에서만 받는다. userland TCP relay이므로 B에는 원래 인터넷 client IP 대신 relay IP가 보인다. 감사에는 이를 transport peer로 정직하게 기록하고 사용자 정체성은 검증된 Grant/actor로 구분한다. 위조 가능한 X-Forwarded-For를 본인 확인에 사용하지 않는다.
- Cloud relay는 연결 수·timeout·바이트 통계만 기록하며 요청 본문/토큰/UID는 읽거나 기록하지 않는다. B ingress가 hostname·strict route·크기·rate/concurrency 제한을 적용한다. 기존 Azure HTTP WAF가 이 경로까지 검사한다고 주장하지 않는다.
- B Caddy가 유일한 공개 TLS 종료점이다. TLS1.2/1.3과 고정 hostname만 허용하고, on-demand 인증서·wildcard·사설 인증서 fallback은 사용하지 않는다.
- 공개443→relay→B9444→Caddy HTTPS 리스너까지 ALPN `acme-tls/1`을 변조 없이 전달한다. HTTP-01은 끄고 포트80은 열지 않는다. [Let's Encrypt](https://letsencrypt.org/docs/challenge-types/#tls-alpn-01)와 [Caddy](https://caddyserver.com/docs/automatic-https#tls-alpn-challenge)는 이443 검증/포워딩을 지원한다.
- TLS staging 발급 시험 후 production CA로 전환한다. staging 인증서를 브라우저 신뢰 성공으로 취급하지 않는다. 자동 갱신 시 B/터널/공인443이 계속 접근 가능해야 한다. 만료 감시는 별도로 구현하며 이번에 자동화/알림을 생성하지 않았다.
- 인증서/ACME account key는 B의 root 관리 영속 디렉터리에서 전용 프로세스만 읽는다. Git/로그/Cloud/Control로 개인키 복사 금지. 갱신·재시작 때 재발급 폭주가 없도록 디렉터리를 보존한다.
- B ingress→기존 patient Gateway는 사설 TLS와 기존 신뢰 CA/hostname 검증을 유지한다. upstream 현재 인증서 SAN·주소·포트는 B 점검 후 핀한다. TLS skip verify로 연결하지 않는다. 기존 B TLS 종단까지의 내부 경로를 무검증 평문으로 바꾸지 않는다.
- 인증서 발급 전 B ingress의 임상 경로는 default-deny이며 ACME만 수행한다. CA challenge 성공이 영상 접근 허용을 의미하지 않는다.

## 권한·브라우저 계약

기존 Entra 계정 매핑을 실제 authority 소유권에 연결하는 작업은 별도 구현이다. 새 hostname만 열어도 본인 CT가 바로 보이는 상태는 아니다.

`controlOrigin`은 기존 웹, `gatewayOrigin`은 새 영상 주소로 고정한다. 발급 proof는 Control POST URL, 열람 proof는 B GET URL에 결속한다. audience/VIEW_ONLY/단일 Study·Series/최대5분·현재 소유권·철회·감사·DPoP 재사용 차단을 유지한다. 실제 Entra 토큰은 B로 전달하지 않는다.

브라우저는 기존 앱 origin만 허용하는 CORS, credentials omit, redirect error, RAM token, nonextractable DPoP key를 사용한다. CSP connect-src에 정확한 새 origin만 추가한다. 허용 경로는 UID 검증된 instances 목록 및 단일 rendered GET와 그 preflight뿐이다. raw DICOM, 다운로드, STOW, admin, internal key release는 외부에서 차단한다. CORS는 인증을 대신하지 않는다. 본인 영상 열람은 B PACS 저장/반입 동의를 대신하지 않는다.

## 비용과 리소스 승인 범위

공식 Azure Retail Prices API를 아래 조건으로 조회했다: serviceName=Virtual Network, armRegionName=japaneast, priceType=Consumption. IP Addresses / Standard / Standard IPv4 Static Public IP / 1 Hour / USD 항목은 **0.005**이며 응답 effectiveStartDate는2018-06-01, 조회일은2026-10-13이다. 현재 조회 결과이지 미래 단가 보장이 아니다.

- 공인 IPv4 1개: 730시간 예시 **US$3.65**. 기존 VM 요금 외 추가분이며, 총 운영비 또는 지출 상한이 아니다.
- 네트워크 송신 비용, 세금, 환율, 계약 할인은 별도. 큰 CT 전송량에 대한 트래픽 비용은 아직 산정하지 않았다.
- 새 VM, Application Gateway, Front Door, 관리형 Load Balancer, 별도 구매 도메인은 이 설계에 포함하지 않는다. 기존 VM의 자원 여유/동시 접속 한도는 실제 부하 시험이 필요하다.
- static public IP는 VM 중지로 요금이 없어지지 않으므로 미사용 비용을 별도로 관리한다. [공식 IP 요금 설명](https://azure.microsoft.com/en-us/pricing/details/ip-addresses/), [Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices).

실제 적용 전에 **공인 IP 1개 비용 및 secondary IP/NSG/relay/B listener 변경**을 한 배포 범위로 승인받는다. 이번 작업에는 리소스 생성이나 DNS 예약이 없었다. 이름이 선점되면 임의로 다른 이름을 배포하지 않고 설정·증적을 함께 갱신한다.

## 적용·복구 순서

1. 배포 범위 승인 및 region quota/NIC·VM 지원, DNS/IP 가용성 재확인. 기존 이미지/설정/NSG/인증서 경로를 캡처한다.
2. B 접근 인증·listener 사용 가능·SAN/CA·리소스 상태 확인. 전용 ingress를 deny-default로 구성한다.
3. 새 공인 IP/DNS·NIC secondary/게스트 주소·좁은 NSG·TCP relay를 추가한다. 기존 웹/SSH/overlay default route는 보존한다.
4. ACME staging→production, hostname/chain/갱신 시험. 실제 웹과 휴대폰 외부망 TLS를 확인한다.
5. Entra authority 매핑·origin 분리·B 정책·감사 후보를 검증한 뒤 정확한 Grant/영상 경로만 활성화한다.
6. 자기 CT 첫/중간/마지막 프레임·거부·만료·철회·audit·기존 의료진 회귀·복구를 시험한다.

실패하면 새 Grant 기능/새 영상 ingress를 닫고 기존 웹/Control을 유지한다. 기존 DB/ref/감사/PACS를 삭제하지 않는다. 공인 IP를 비용 절감을 위해 반환할 때는 먼저 앱/CSP/CORS/DPoP 허용 주소를 제거하고 기존 Grant를 차단하여 도메인 재사용 위험을 막는다. 인증서 비밀키와 감사 증적의 안전한 보존/폐기는 별도 관리한다.

## 결과

설계 주소·경로·TLS 기준 확정: PASS. 실제 등록·발급·공개·본인 CT 열람·갱신·복구: NOT VERIFIED. 신규 코드/서비스/인증 DB 변경 없음. 기존 회귀 실패를 이 설계 작업으로 해결했다고 주장하지 않는다.
