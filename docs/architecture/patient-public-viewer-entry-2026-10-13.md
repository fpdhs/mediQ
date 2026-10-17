# B병원 전용 HTTPS 환자 영상 진입점 설계

2026-10-13 · DRAFT / UNASSIGNED · 신규 네트워크·인증 변경 미적용

후속 요청에 따라 주소·경로·TLS 구현 기준을 [B 외부 진입점 결정](patient-public-viewer-entry-decision-2026-10-13.md)으로 구체화했다. 아래 대안 비교는 검토 이력이다. 선택한 구현 기준은 별도 Standard 공인 IPv4 + 기존 VM의 L4 중계 + B에서 TLS 종료이며, 리소스 생성·도메인 예약·외부 공개는 아직 하지 않았다.

## 요구사항과 확인된 현재 상태

사용자 승인 범위는 B병원 전용 HTTPS 영상 진입점의 **설계부터** 진행하는 것이다. 기존 Azure 환자 웹/모바일 로그인은 유지하며, 자신의 고정 합성 CT를 별도 환자 권한으로 열람한다. B 의료진의 공유 동의나 다운로드 권한을 대신 부여하지 않는다.

관련 기능군: FR-006~009, FR-014~025, FR-026~036, FR-037~041. FR 개별 원문 부재로 기능군 수준 추적이며 NFR 번호를 임의 생성하지 않는다.

- 공개 앱 주소: `https://highpass-demo.japaneast.cloudapp.azure.com`.
- B portal Compose 공개 바인딩은 사설 `192.168.111.149:9443`. 외부 휴대폰에 전달할 주소가 아니다.
- 기존 네트워크 문서에는 WireGuard Cloud `.1`, A `.2`, B `.3` 및 B→A Gateway 9443의 좁은 라우팅이 기록되어 있다. 현재 B 재접속·외부 도달성은 이번 설계에서 재검증하지 않았다.
- 공개 웹은 patient clinical 경로를 차단한다. Azure Control은 정책·메타데이터·감사만 담당한다.
- 확인한 서버 Entra actor는 `synthetic-patient-hcc`→`MEDIQ-SYN-HCC-001`. 기존 self-view authority는 TEST 인증과 `synthetic-hcc-account` 소유권 매핑을 요구한다. 주소만 열어서는 해결되지 않는다. 실제 소유권 DB 행의 활성 상태는 미검증이다.
- 기존 DPoP 설정은 사설 B 주소 하나에 결속한다. 전역 base URL 치환은 기존 의료진/내부 경로를 깨뜨릴 수 있다.

기준: `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/api/MEDI-Q-PATIENT-SELF-VIEW-GRANT-CONTRACT.md`, `infra/azure/README.md`, `infra/workstation/hospital-b-portal.compose.yml`.

## 권장 사용자 흐름

사용자는 기존 주소에서 Microsoft로 로그인하고 **내 건강기록 → 영상 보기**를 누른다. 별도 사이트 로그인이나 IP 입력은 요구하지 않는다. 화면은 기존 Azure 웹의 어두운 전용 뷰어를 그대로 사용한다.

```text
웹·모바일 브라우저
 ├─ Microsoft 인증 → Azure Control: 본인·검사 소유권 확인, 5분 이하 Grant
 └─ Grant + 매 요청 DPoP → B 전용 HTTPS: 허용된 Series의 목록/한 장씩 요청
                                  ├─ Control: 현재 권한·철회·감사 재검증
                                  └─ A Gateway → A PACS: 범위 내 조회
                                      A 암호화 → B 검증·복호화 → 브라우저
```

원본은 A PACS에 남는다. 이 열람은 B PACS 저장·반입·환자 다운로드 동의가 아니다. 본인 열람과 병원 간 공유 승인은 별도 정책이다.

## 외부 접속 경로: 선택과 보안 경계

논리 주소는 `B_VIDEO_ORIGIN=https://<확정할-B-영상-호스트>`로 둔다. 새 도메인 확보, 인증서 발급, 공인 IP/포트 추가는 아직 하지 않았다.

| 경로 | 장점 | 선행 조건 / 제한 |
|---|---|---|
| B 측 직접 HTTPS 진입 | Azure에 영상 패킷도 통과시키지 않음 | B 외부 공인 주소·NAT/방화벽·인증서 발급 경로 확인 필요. 사설 VM 주소만으로 불가 |
| 별도 L4 진입 → 기존 암호화 overlay → B TLS 종료 | 기존 분산 시연 구성 활용 가능 | Azure는 TLS를 복호화하지 않는 네트워크 중계만 수행. 앱 HTTP proxy/CDN/cache 금지. 외부→B 규칙은 새 승인·검증 필요 |

**현 구성에서는 L4 중계안을 우선 검토하되 아직 확정하지 않는다.** 기존 `docs/ARCHITECTURE.md`의 암호화 패킷 라우터와 일관되지만, 환자 계약의 “Cloud는 임상 영상 바이트를 전달하지 않는다”를 응용 계층 금지로 해석하는지 문서 정렬이 필요하다. 모든 네트워크 패킷 통과까지 금지한다면 B 직접 진입안만 채택한다.

기존 웹 443 리스너를 변경해 SNI 중계를 끼워 넣지 않는다. 별도 공인 진입점의 IP/DNS/포트·비용·할당 가능성을 확인한 뒤 선택한다. 임의의 `cloudapp.azure.com` 이름이 사용 가능하다고 가정하지 않는다. B 측 TLS 종료용 전용 ingress는 patient 경로만 허용하며 기존 portal 전체를 공개하지 않는다. Orthanc 8042, 관리 API, 내부 key release, SSH는 공개하지 않는다.

## 인증·소유권과 URL 결속

1. Azure의 기존 Entra 검증(서명, issuer, tenant, audience, 만료, 허용 계정)을 유지한다.
2. 검증된 `(tenantId, objectId)`와 기존 서버 actor를 활성 환자 authority에 연결하는 명시적 서버 매핑을 추가한다. 이메일·화면의 홍길동·클라이언트 patientId만으로 연결하지 않는다. TEST 인증으로 위장하지 않는다.
3. 기존 권위 소유권 subject를 별칭으로 연결할 경우 실제 Entra actor와 authority subject, 매핑 버전을 감사에 구분 기록한다. 기존 계정/ref를 무조건 UPDATE하거나 동일 이름 전체 환자에게 권한을 주지 않는다. 중복·미확인·비활성 매핑은 거부한다.
4. Grant 발급 URL과 영상 URL의 origin을 분리한다. 발급 POST DPoP `htu`는 Azure 앱 주소, 영상 GET `htu`는 확정된 B 영상 주소다. 기존 의료진 URL을 전역 교체하지 않는다.
5. 환자 Grant audience `mediq-patient-self-view-gateway`, `PATIENT_SELF_VIEW`, `VIEW_ONLY`, 단일 Study/Series, `cnf.jkt`, 최대 300초 및 로그인 잔여시간 제한을 유지한다. B는 Entra access token을 직접 영상 권한으로 받지 않는다.
6. B origin은 검토된 서버 설정/allowlist에서만 선택한다. 사용자 URL 입력, 임의 Host/Forwarded 헤더, 응답 리다이렉트로 DPoP 대상이나 토큰 전달 위치를 바꾸지 않는다. 클라이언트 fetch는 redirect를 거부해야 한다.

## API 변경안 (아직 미구현)

| 변경 전 | 변경 후 제안 | 영향 |
|---|---|---|
| 공개 self-view Grant POST 차단 | 기존 정확한 환자/Study Grant POST만 인증·DPoP·소유권 검증 후 허용 | 웹/모바일 영상 보기, authority/HTTP 테스트 |
| 브라우저 발급·영상 origin 하나 | 명시적인 controlOrigin / gatewayOrigin 분리 | 공용 patient-pixel-viewer, DPoP 테스트 |
| 사설 B portal 주소로 DPoP 검증 | 환자 외부 origin 별도 설정; 내부·의료진 계약 보존 | B ingress, Control patient authorizer, 회귀 테스트 |
| Azure patient-dicomweb 차단 | **그대로 차단**, B 전용 ingress만 범위 내 GET 제공 | 부정 접근 시험 |

외부 B 허용 경로는 기존 파서가 지원하는 UID 검증된 Series의 `instances` 목록과 단일 Instance의 `rendered` GET로 제한한다. 무범위 Study 검색, 원본 DICOM/ZIP, bulk download, STOW, 임의 upstream proxy는 허용하지 않는다.

### 브라우저 경계

- CORS는 정확한 Azure 앱 origin만 허용. `/mobile/`과 `/hipass/`는 같은 origin이다. `*`, `null`, 로컬 개발 origin을 공개 allowlist에 넣지 않는다.
- 필요한 GET/OPTIONS와 Authorization/DPoP 헤더만 허용. OPTIONS는 픽셀이나 권한을 반환하지 않으며 모든 실제 GET은 서버 검증을 거친다. CORS는 접근통제를 대체하지 않는다.
- 이미지 요청은 cookies 없이 `credentials: omit`, RAM의 환자 Grant/비추출 DPoP 개인키만 사용한다. Entra 토큰은 B로 보내지 않는다. URL·로그·localStorage·sessionStorage에 Grant를 넣지 않는다.
- 앱 CSP connect-src에 확정 B origin만 추가한다. 현재 viewport의 한 장만 lazy loading하고, service worker/API/영상 캐시는 no-store로 유지한다.
- 만료·로그아웃·계정 전환·소유권 변경·닫기 시 요청 중단, blob URL 회수, 화면 삭제. 모바일 백그라운드 전환 시 숨김/복귀 권한 재확인도 시험한다. 기기에 이미 표시된 화면의 스크린샷까지 막는다는 주장은 하지 않는다.

## 운영·감사·복구

B TLS 인증서는 모바일 브라우저가 신뢰하는 공개 체인과 일치 hostname이 필요하다. 사설 인증서 우회/ignore-certificate-errors를 쓰지 않는다. DNS 소유권, 자동 갱신 수단, 만료 알림과 비밀키 파일 권한을 확정한다.

외부 B ingress에 크기/동시 연결/요청 속도/timeout 제한을 두고 request/response body와 토큰을 로그에서 제외한다. UID 포함 원시 URL 로그도 최소화한다. L4 장비 로그와 B 권한 감사는 별도 보관하며 기존 auditSessionId로 발급→권한검증→A 조회→B release→응답을 연결한다. 브라우저 디코딩 여부와 서버 응답 완료를 구분한다.

독립 feature flag와 정확한 이미지/설정 해시를 가진 후보로 배포한다. 실패 시 외부 B 기능·Grant 발급을 닫고 이전 앱/설정을 복구한다. 기존 DB, 감사, 소유권, 원본 영상은 삭제하지 않는다. 진행 중 Grant는 정책상 철회/만료를 처리하며 유효기간 연장으로 복구하지 않는다.

## 다음 구현 순서와 수용 시험

1. B 직접 접속과 L4 중계 중 승인할 경계를 확정하고 공인 주소·도메인·TLS·추가 비용을 확인한다.
2. 읽기 전용으로 실제 Entra 매핑과 고정 CT의 DB 계정/ref·Study/Series/700 SOP 등록 증적을 대조한다.
3. 별도 환자 authority 매핑, origin 분리, exact route/CORS/CSP, B ingress 후보를 구현한다.
4. 정상 본인 Grant, 타인/의료진/미등록 계정, 잘못된 origin/UID/Series/SOP, replay/만료/철회, Vault/감사 장애를 시험한다. 거부 시 A PACS read와 B 평문 전달이 증가하지 않아야 한다.
5. 실제 인터넷 웹과 휴대폰에서 로그인→선택→첫/중간/끝 슬라이스→닫기/로그아웃을 검증한다. 첫 로딩에 700장 일괄 다운로드가 없어야 한다. 전체 700장 전송 무결성 시험과 화면 lazy loading 시험은 분리한다.
6. Azure Control 영상 경로 차단, 기존 의료진 공유/다운로드 정책 회귀, 배포·복구 후 같은 흐름과 감사 연계를 검증한다.

현재 결과: 설계 작성 PASS. 신규 endpoint/DNS/TLS/Entra authority 통합/인터넷 본인 CT/실제 휴대폰/신규 경로 복구는 모두 NOT VERIFIED. 이 문서는 배포 승인이나 전체 MVP 완료 증거가 아니다.
