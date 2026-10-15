# B 공개 TLS 진입점 배포 결과

2026-10-13 KST · DRAFT / UNASSIGNED · 합성 MVP · 커밋/푸시 없음

## 작업 목적 / 사용자 승인

사용자가 “공인 IP 생성, 제한된 방화벽 규칙, B TLS 진입점 구성”과 추가 비용·외부 경로를 명시적으로 승인했다. 실제 구현 범위는 전용 TLS 진입점이며 본인 CT 권한/Entra 매핑/clinical 경로는 활성화하지 않았다.

관련 기능군: FR-006~009, FR-014~025, FR-026~036, FR-037~041. 개별 FR 원문 부재로 기능군 추적, NFR 번호 미추정.

## 분석한 기존 구조와 결과

기존 Azure 웹·WAF는 primary10.89.0.4:443, A/B는 기존 WireGuard overlay, B portal은192.168.111.149:9443이다. 기존 웹443이나 Entra callback을 변경하지 않았다. Azure 스킬을 검토했지만 azd 전용 준비 절차는 이 기존 VM 배포에 맞지 않아 기존 pinned SSH/Compose/Azure CLI 흐름과 승인된 별도 설계 기준을 사용했다.

| 항목 | 적용 값 |
|---|---|
| 공개 영상 주소 | https://highpass-images-b.japaneast.cloudapp.azure.com |
| 새 공인 IP | 20.89.43.127 / pip-highpass-images-b / Regional Standard Static IPv4 |
| NIC secondary | nic-highpass-capstone / patient-images-b /10.89.0.5 |
| 추가 NSG 규칙 | Allow-Highpass-B-Video-HTTPS / priority140 / Internet→10.89.0.5 / TCP443 |
| Cloud 중계 | systemd socket10.89.0.5:443 → fixed10.90.88.3:9444. TLS 비종료 |
| B TLS 종료 | 전용 Caddy, bind10.90.88.3:9444, user1000:1000, readonly, cap_drop ALL |
| 인증서 | Let's Encrypt YE2 / 정확한 hostname / TLS1.3 실제 확인 |
| 인증서 만료 | 2027-01-11 11:22:56 UTC (20:22:56 KST), 자동 갱신 설정 |
| 영상/관리 API | 전부403 PATIENT_IMAGE_ENTRY_NOT_ENABLED / no-store |

비용: 앞선2026-10-13 공식 Retail Prices 조회의 공인 IP 단가US$0.005/시간, 730시간 예시US$3.65. 트래픽/세금/환율 별도, 기존 VM 비용 제외. 리소스가 생성되어 추가 비용 발생 대상이다. 신규 VM/관리형 LB/Front Door는 만들지 않았다.

## 생성·수정 파일

신규:

- `scripts/patient-public-entry-session.py`: 마스킹 입력·메모리 전용 B credential, pinned SSH, 고정 단계, 15분 제한, 세션 종료 시 연결 정리.
- `scripts/patient-public-entry-remote.py`: B 설정·digest 고정 Caddy·Cloud systemd TCP relay·범위 제한 방화벽·단계별 검증/중단.
- `scripts/patient-public-entry-azure.py`: exact 구독/리소스·할당량·DNS/IP 확인, 생성·secondary 연결·443 규칙·기존 규칙 검증·공개 규칙 닫기.
- `test/patient_public_entry_test.py`: 설정 회귀5개.
- 이 배포 기록.

수정: `docs/api/MEDI-Q-PATIENT-SELF-VIEW-GRANT-CONTRACT.md`의 승인된 L4 경계 설명과 설계 결정 문서의 적용 상태. 앱/Control 인증·DB·PACS 코드는 수정하지 않았다.

원격 추가 경로는 양 VM의 `/opt/highpass/patient-public-entry`와 이름이 `hp-patient-entry*` 또는 `hp-patient-public-tls`인 전용 systemd unit이다. 기존 서비스 설정을 전면 재작성하지 않았다. Cloud는 별도 로그인 불가 서비스 사용자 `hp-b-video-relay`를 사용한다. B의 서버 비밀번호는 GUI 입력 후 한 프로세스에서만 사용했고 세션 종료를 확인했다. SSH 키를 새로 등록하지 않았다.

## 보안 검토

- Cloud에는 TLS 개인키·Caddy 인증서 storage를 두지 않는다. B에만 ACME key/certificate 영속 디렉터리와 제한 권한을 둔다. 기존 웹 개인키를 복사하지 않았다.
- B 입력은 overlay10.90.88.1에서10.90.88.3:9444로 오는 통신만 허용한다. Cloud relay UID의 신규 출력은10.90.88.3:9444로 제한한다. 기존 전역 체인을 flush하지 않고 전용 HP-PVIEW-IN/OUT chain을 추가했다.
- Cloud proxy는64 connection 제한, no capabilities, no new privileges, readonly system, fixed IP upstream이다. B Caddy는 HTTP1/2만 사용하며 HTTP80/QUIC443을 추가 공개하지 않았다.
- B Caddy 응답은 모든 경로403이고 upstream/임상 byte 경로가 없다. 따라서 이 단계에서 token/UID/영상 HTTP body를 처리하거나 로그에 넣지 않는다. CORS/환자 Grant 연결은 추후 별도 검증 후 활성화한다.
- 새 공인 IP에도 기존 관리자 source限定 SSH/HTTPS 규칙이 적용된다. 일반 인터넷에 SSH를 허용하는 새 규칙은 없다. “모든 출처에서 SSH 차단”으로 표현하지 않는다.
- pinned 원본 Caddy digest: `sha256:d8542f48d34a9cf4e4c11a478865229840e87e4c96ea3f439101f31a5d35f75f`.
- 최소 파생 이미지: `sha256:ea793fa2c13401928e1a975e0d59c864d1f3060615a5d31ac6252b2f84d7a60c`. Caddy 실행 파일의 불필요한 file capability 제거와 USER1000만 적용. 이미지 취약점 전수 스캔은 NOT VERIFIED.

## 테스트 결과와 증거

증적 폴더: `artifacts/azure/patient-public-entry-20261013T120821Z`.

| 시험 | 결과 | 근거 |
|---|---|---|
| Azure 계정·DNS·사설IP·할당량 | PASS | azure-preflight.json. Standard IPv4 사용1/한도3에서 생성 |
| 공인 IP 생성·NIC 연결·NSG | PASS | azure-create/attach/open/verify.json |
| 기존 primary/NSG 규칙 보존 | PASS | 기존 의미 있는 속성 대조; 갱신 etag 제외 |
| Caddy 설정·systemd unit 검증 | PASS | B-stage/CLOUD-stage.json, 실제 validate/verify exit0 |
| ACME staging 발급 | PASS | B에서 staging 인증서 확인. 공개 신뢰 성공으로 취급하지 않음 |
| Production TLS chain/hostname | PASS | external-verify.json, default trust store로 TLS1.3 연결 |
| 영상·관리 등6경로 거부 | PASS | /, /patient-dicomweb/studies, /api/health, /gateway/patient-self-view/authorize, /instances, /system 모두403 |
| 기존 웹 유지 | PASS | /hipass/ HTTP200, 기존 B portal healthy·image2c09773d… 보존 |
| 새 B TLS 중단/복원 | PASS | stop-isolation.json: 새 endpoint 실패, 기존 웹200. restore-verify.json: 복원 후 신뢰 TLS403 |
| LAN IP의9444 비공개 | PASS | 192.168.111.149:9444 TCP 접속 거부 |
| 설정 회귀 | PASS | Python unittest5/5 |
| 실제 휴대폰/CT/권한 정상 시나리오 | NOT VERIFIED | 이 단계는 임상 경로 전부 차단 |
| VM 재부팅/자동 갱신 시점/부하 시험 | NOT VERIFIED | 서비스 재시작과 인증서 보존만 확인 |

최종 B-verify의 초기 docker ps 관측에서 재시작 직후 containerState null이 기록됐으나, 같은 검증의 inspect에서 현재 이미지·권한·기존 portal healthy를 확인했고 이후 외부 복원 검증에서 실제 TLS403을 확인했다. 검증기는 후속 실행에서 docker inspect의 상태를 직접 기록하도록 보완했다. 일부 단계별 latest JSON은 재실행으로 덮어써졌고, 최초 B inventory는 대화 도구 출력에 남아 있다. 후속 운영 도구는 번호별 이력을 추가 보존하도록 수정했다.

## 발견·수정한 배포 문제

1. 할당량 검증이 사용하지 않는 Basic/Global quota0까지 검사해 중단했다. Standard IPv4/전체 PublicIP 두 실제 적용 quota만 정수 비교하도록 수정 후 PASS.
2. Caddy 한 줄 log 블록 문법 오류를 시작 전 validate에서 발견·수정했다.
3. secondary 추가 시 primary의 etag가 갱신되어 보호 검사 중단. 주소·연결 등 실질 필드는 모두 동일한지 검사하고 etag/provisioningState만 제외했다.
4. Caddy 바이너리 file capability와 cap_drop ALL 충돌로 시작 실패. 권한을 늘리지 않고 최소 파생 이미지에서 capability를 제거했다. 첫 파생 빌드의 FROM image ID 참조 실패도 registry digest로 수정했다. 최종 실행은 nonroot/cap_drop ALL/readonly/restartCount0 확인.

## 복구 / 남은 위험

새 진입점 중단·재개 시험은 기존 웹과 별도로 수행했다. 전체 Azure 리소스 철거·VM 재부팅 복구 시험은 하지 않았다.

긴급 공개 규칙 닫기:

```powershell
python scripts/patient-public-entry-azure.py close --folder artifacts/azure/patient-public-entry-20261013T120821Z
```

B 서비스 중단은 인증된 운영 세션의 `B:rollback`, Cloud relay 중단은 `CLOUD:rollback`이다. 이 명령은 영속 파일/DB/인증서/공인 IP를 삭제하지 않으므로 IP 비용은 남는다. 부팅 자동 시작 등록도 유지하므로 장기 철수는 enable 상태/NSG와 함께 별도 처리해야 한다. 재공개는 기존 close/open receipt·규칙 상태를 검토한 뒤 진행한다.

공인 IP 제거는 아직 수행하지 않았다. 추후 제거 시 앱/CSP/CORS/DPoP 허용 주소와 Grant를 먼저 정리해야 DNS 이름 재사용 위험을 줄일 수 있다.

남은 핵심 작업은 Entra 환자 actor→실제 소유권 연결, controlOrigin/gatewayOrigin별 DPoP, exact CORS/CSP/환자 경로, CT 첫·중간·마지막 프레임 및 거부·감사 검증이다. “TLS 개통”과 “환자 CT 열람 완료”를 구분한다. 기존 전체 회귀 실패나 전체 MVP 완료 여부는 이 배포로 해결됐다고 주장하지 않는다.
