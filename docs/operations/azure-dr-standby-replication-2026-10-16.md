# East Asia 대기 서버·DB 복제 구성 — 2026-10-16

검토 상태: **DRAFT / UNASSIGNED**.
완료 범위: **별도 대기 VM + 필터링된 초기 복제본 + 읽기 전용 비동기 streaming replication**.
실제 장애 전환, 애플리케이션 DR, 독립 키 DR, 운영 승인 완료가 아니다.

## 1. 목적·승인·요구사항

사용자 요청: “대기 서버의 리전·키 복구 범위를 확정하고, 서버와 DB 복제 구성을 진행한다.
기존 서비스에는 영향을 주지 않도록 한다.” 이전에 추가 비용과 시연 기간(20일까지) 가동을 승인했다.

- 확인된 요구사항: 기존 공개 주소, Entra 로그인, 환자/의료진 서비스와 영상 경로 유지.
- 합리적 가정: 종료는 앞서 안내한 **2026-10-20 23:59 KST**. 정확한 시각은 사용자 원문에 없었다.
- 구현 결정: Japan East primary → East Asia DB standby. 원본 DB 재시작/스키마 변경 없이
  복제 계정·해당 계정 전용 HBA 규칙·새 outbound tunnel만 추가한다.
- 남은 불확실성: 원본 서비스 승격/fencing, 독립 키 복구, 병원 경로, 실제 사용자 DR 검증.

영향 검토: FR-014~025(동의/정책/토큰), FR-026~036(영상 경로/뷰어), FR-037~041(감사).
관련 v3: V3-NFR-REL-001(유한 timeout), V3-NFR-TST-001(증거),
V3-SR-OPS-002(공급망), V3-SR-OPS-003(키 분리와 복구).
이 일부 준비/시험이 해당 요구사항 전체 수용을 뜻하지 않는다. DR 전용 ID는 아직 배정되지 않았다.
업무 API·DB 테이블·기존 UI·기존 인증 계약 변경은 없다.

## 2. 리전·키 복구 범위 결정

| 영역 | 결정 및 한계 |
|---|---|
| 대기 리전 | East Asia. 학생 구독의 허용 리전이며 배포 시 quota 및 ARM 검증 통과 |
| Japan West | 구독 정책상 미허용; 정책 예외를 만들지 않음 |
| 기존 Key Vault | Japan의 기존 Vault/키/버전/보호/권한 설정 유지 |
| 대기 VM의 Vault 권한 | 추가하지 않음. 원본 KEK/서명키/토큰키를 복사하지 않음 |
| 실제 키 사용 경로 | 기존 병원/기존 Vault 경로 유지. 대기 앱의 키 접근 경로는 이번에 열지 않음 |
| 지리 간 키 복구 | Japan Vault 백업을 East Asia Vault에 복원하지 않음. 독립 복구 미구현 |
| 원본 DB TLS 개인키 | 초기 복제 전송 스트림에서 디스크 추출 전에 제외 |
| 대기 DB TLS 개인키 | 새로 생성, PGDATA 밖 root 보호 secret mount에 저장; 기존 개인키 재사용 안 함 |
| 디스크 암호화 | Azure managed OS disk의 platform-managed at-rest encryption. LUKS/CMK라고 표현하지 않음 |
| 관리 ID | 대기 VM 자신에 대한 deallocate/action만 부여; Key Vault/DB/네트워크/RBAC 권한 없음 |

따라서 이번 결정은 **기존 키 의존성을 유지하는 DB 대기 기반**이다.
Japan Key Vault 장애와 실제 애플리케이션 키 복구까지 독립적으로 해결한 전체 DR이 아니다.
미복구·미검증 키로 토큰을 새로 발급하는 우회 경로는 만들지 않았다.

## 3. 실제 구성

```text
기존 사용자 → 기존 HTTPS/Entra → 기존 Control → 기존 PostgreSQL (Japan East)
                                                    |
                                   전용 REPLICATION 계정 + hostssl + SCRAM
                                                    |
                         원본에서 시작한 strict-pinned reverse SSH tunnel
                                                    |
                         대기 loopback 127.0.0.1:15432 (인터넷 미공개)
                                                    |
                              PostgreSQL TLS verify-full + 공개 CA
                                                    |
                         읽기 전용 PostgreSQL standby (East Asia)
                              DB listen: 127.0.0.1:15433

별도 Traffic Manager: Disabled 유지, standby 앱 endpoint는 연결하지 않음
```

- 전용 RG: `rg-highpass-dr-standby-20261016`.
- VM: `vm-highpass-dr-standby`, Standard_B2als_v2, Ubuntu 24.04 고정 이미지,
  Trusted Launch/Secure Boot/vTPM, 32GiB StandardSSD_LRS OS disk.
- 전용 VNet: `10.91.0.0/24`; 기존 `10.89.0.0/16`과 peering/경로 변경 없음.
- 새 NSG: 운영자 및 원본 서버의 정확한 공인 IPv4 /32에서 SSH 22만 허용;
  다른 inbound는 명시적으로 거부한다. 웹 443·PACS·DB 5432/15432/15433 공개 안 함.
- 대기 SSH host key는 Azure 관리 채널에서 받아 VM resource ID와 함께 고정했다.
  SSH RejectPolicy/StrictHostKeyChecking을 사용하고 자동 신뢰하지 않는다.
- tunnel 전용 SSH 계정은 원본 IP 및 지정 remote loopback 포트만 허용,
  MaxSessions=0, shell nologin, 일반 shell/SFTP·local forward를 허용하지 않는다.
- 원본 VM의 SSH/NSG를 열지 않는다. outbound reverse tunnel은 새 systemd unit으로 관리한다.
- PostgreSQL은 원본과 같은 16.15, 같은 pinned base/보안 보완 Dockerfile로 대기 서버에서 빌드했다.
  실제 image ID는 configure/verify 증거에 기록했다. 신규 빌드 CVE scan은 아직 NOT VERIFIED다.
- 대기 서버에 Control, 웹 로그인, 토큰 발급 또는 실제 영상 파일은 적재하지 않았다.

## 4. DB 계정·부하·무결성

- 전용 계정 `hp_dr_repl_20261016`: LOGIN/REPLICATION만, NOSUPERUSER,
  NOCREATEDB/NOCREATEROLE/NOINHERIT, connection limit 2, 유효기간 종료 10월 20일 23:59 KST.
- 해당 계정에만 TLS/SCRAM과 원본 Docker bridge의 정확한 /32를 허용했다.
  해당 계정의 일반 DB 접속, 다른 주소, local replication은 명시적 reject다.
  기존 사용자 규칙은 원문 그대로 유지했다. HBA parse 오류 0, reload만 실행했다.
- 관리 DDL의 동적 비밀번호는 바인딩으로 session-local 값에 전달하고 서버 format quoting을 사용한다.
  비밀번호·토큰을 argv/일반 로그/로컬 증거에 남기지 않는다.
- 복제 비밀번호는 원본 VM에서 난수로 생성한다. 두 VM의 root 보호 파일 외에는
  SSH→작업 프로세스 메모리→SSH로만 전달한다. 메모리 복사 전체 zeroization을 보장하지는 않는다.
- 동기 복제가 아니며 기존 commit 경로를 standby 응답에 묶지 않았다.
- permanent/temporary replication slot을 만들지 않았다. 기존 WAL 보존 설정도 변경하지 않았다.
  이 선택은 원본 디스크/WAL 보존 영향 최소화용이다. 장기 단절 시 WAL이 재사용되면 재초기화가 필요하다.
- `pg_basebackup -Ft -Xfetch --checkpoint=spread --max-rate=1M --no-slot` 사용.
  백업 900초, 명령/연결 별 timeout, 전체 추출 크기 상한을 적용했다.
- raw tar를 저장하지 않고 안전한 tar 스트림 추출기를 사용한다. 경로 탈출·링크·장치·기존 파일 덮어쓰기를 거부한다.
- 기존 개발용 `server.key`는 RAM의 전송 스트림에서 버려 PGDATA/백업 파일로 저장하지 않았다.
  원본 PostgreSQL이 보내는 암호화 스트림 안에는 해당 파일이 포함될 수 있으므로,
  “개인키 바이트가 전혀 전송되지 않았다”는 주장은 하지 않는다.
- SHA-256 manifest와 WAL에 대해 `pg_verifybackup`을 수행하되,
  저장하지 않은 개인키 경로 1개는 명시적으로 `--ignore` 처리했다.
  검증 후에만 standby 전용 설정/HBA와 standby.signal을 만들었다.
- 물리 복제는 전체 PostgreSQL cluster 대상이다. 기존 격리 v3 시험 DB와 role verifier도 포함될 수 있다.
  선택 테이블만 복제한 것으로 표현하지 않으며, 복제본 자체를 민감한 보호 대상으로 취급한다.
- standby의 recovery=true, transaction_read_only=on, SQLSTATE 25006 쓰기 거부를 실제 확인했다.

## 5. 실패와 보존 조치

첫 두 초기화는 실패했다. 성공으로 처리하거나 실패 자료를 삭제하지 않았다.
실제 원인은 과거 v3 배포에서 남은 root 전용 `.pending` HBA 임시파일을
PostgreSQL 프로세스가 읽을 수 없었던 것이다. 스트림 EOF 처리도 방어적으로 보완하고 시험을 추가했다.

정확한 파일:
`pg_hba.conf.highpass-v3-10b44bf92ef1439e87c967fa12f8a694.pending`.
원본 SHA-256:
`495acf651412a19494e70dff8187d0b4c0f2ccf98d6d1399bd760ff5fe124ec7`.

활성 HBA 경로가 아니고, 현재 설정에서 참조되지 않으며, 오래된 파일/예상 hash/uid/mode임을 확인했다.
내용·권한은 변경하지 않고 `/opt/highpass/dr-source/preserved-inactive-hba/`로 이동해 보존했다.
활성 HBA hash는 이동 전후 동일하며 PostgreSQL reload/재시작은 이 이동에 필요하지 않았다.
필요하면 원래 위치로 복구할 수 있지만, 다시 두면 같은 백업 읽기 실패가 재발할 수 있다.

실패 데이터는 대기 VM의 `pgdata.failed-004208`, `pgdata.failed-004549`로 보존했다.
실패 결과·기존 worker 사본·stderr는 root 보호 디렉터리에 유지한다. 어떤 자료도 삭제하지 않았다.

## 6. 기간·비용·종료

- 원본 tunnel worker는 승인된 종료 시각 이후 tunnel을 닫는다. 복제 계정 로그인도 같은 시각 만료한다.
- 대기 VM의 one-shot systemd timer: `2026-10-20 14:59:00 UTC` = **10월 20일 23:59 KST**.
- 게스트는 IMDS로 자기 resource ID를 대조하고, 자기 관리 ID의 단일
  `Microsoft.Compute/virtualMachines/deallocate/action`을 사용한다.
  RBAC assignment scope는 해당 VM 1개다. 기존 VM/Key Vault를 중단하거나 변경할 수 없다.
- 예약 active, 다음 실행 시각, metadata identity, 아직 실행하지 않는 dry-run을 확인했다.
  실제 미래 실행과 Azure deallocated 상태는 **NOT VERIFIED**다.
- 이는 guest timer이므로 OS/네트워크 장애, 할당 상태에서 guest 정지, ARM/RBAC 문제 등으로 실패할 수 있다.
  예약을 절대적인 비용 상한 또는 청구 중단 보장으로 표현하지 않는다. 실제 Azure 상태 확인이 필요하다.
- VM 할당 해제 후에도 디스크·공인 IP·보관 로그 등 비용은 남을 수 있다. 리소스를 자동 삭제하지 않는다.
- 읽어온 East Asia Linux VM retail meter는 USD 0.0526/hour (VM compute만).
  초기 조회에 Cloud Services 별도 meter도 있었으나 이 VM의 계산에 혼용하지 않는다.
  남은 기간 compute 예상 약 USD 5.8이며 디스크·IP·전송·세금 등은 별도다.
  학생 잔여 크레딧과 최종 청구 금액은 NOT VERIFIED다.

## 7. 생성/수정 파일

생성:

- `infra/azure/dr-standby.json`: 전용 신규 네트워크/VM ARM template.
- `scripts/azure-dr-standby.py`: account/policy/quota/network/부하 확인, validate, Create-only what-if, 비동기 배포.
- `scripts/azure-dr-primary-inspect.py`: 원본 읽기 전용 진단.
- `scripts/azure-dr-primary-configure.py`: root-only credential, 전용 role/HBA, outbound tunnel.
- `scripts/azure-dr-replica.py`: 빌드, 개인키 필터링, manifest 검증, 읽기 전용 replica.
- `scripts/azure-dr-replication.py`: 단계별 실행/증적, 원본 staging 보존, 상태/권한/기존 서비스 비교.
- `infra/azure/dr-source-tunnel.service`, `infra/azure/dr-standby-backup.service`.
- `scripts/azure-dr-self-deallocate.py`, `infra/azure/dr-self-deallocate-role.json`,
  `infra/azure/dr-self-deallocate.service`, `infra/azure/dr-self-deallocate.timer`.
- `test/azure_dr_standby_test.py`, `test/azure_dr_replication_test.py`, 본 작업 기록.

기존 준비/별도 TM 문서에는 후속 링크만 추가했다. 앱 코드·UI·인증 파일은 변경하지 않았다.
기존 작업 파일을 보존했고 커밋·푸시는 수행하지 않았다.

## 8. 검증 결과와 증거

증거: `artifacts/azure/dr-standby-20261016T002757Z/`.
초기 inventory/what-if/구성, 모든 실패·재시도·예약·검증 결과를 함께 보관한다.
관측된 원본 DB 시작 시각은 작업 전후 동일하다: `2026-10-08T15:09:40.746195Z`.
관측된 Control 컨테이너 시작은 2026-10-15이며 작업 중 재시작되지 않았다.
직접 실행한 최초 완전 복제 검증은 2026-10-16 09:48 KST, 추가 확인은 09:50 KST다.
09:53 KST 재확인에서는 WAL이 `0/78000148`로 진전했고 원본·수신·재생 위치가 다시 일치했다.
새 managed disk의 platform encryption/32GiB, 실제 SSH-only NSG,
자기 VM 한정 deallocate 권한을 Azure에서 재조회했다. 기존 TM은 Disabled 유지다.

| 검사 | 결과 | 근거/한계 |
|---|---|---|
| 관련 로컬 시험 | PASS | 44/44; 소스 범위·NSG·Create-only·추출·개인키 제외·시각/자기 VM 제한 포함 |
| ARM validate/what-if | PASS | 새 전용 RG의 5개 리소스 Create만 허용 |
| VM 부팅/Docker/PG16.15 | PASS | Azure Succeeded, cloud-init 완료, image-result |
| 원본 공개 설정/시작 화면 보존 | PASS | DNS/VM/NSG/Entra 및 웹·모바일 응답 hash 동일 |
| 원본 DB·Control 계속 실행 | PASS | DB postmaster 시각 동일, 컨테이너 healthy |
| 복제 계정 최소권한 | PASS | 비슈퍼유저·replication·limit 2·만료, 일반 DB 접속 거부 |
| 초기 필터링/무결성 | PASS | 77,416,343 stream bytes, exit 0; 제외 경로 1개 명시한 manifest/WAL 검증 |
| 실제 비동기 replication | PASS | primary sender와 standby receiver streaming, sync_state=async |
| 수신·재생 WAL | PASS | 최초 확인 시 원본/수신/재생 모두 0/78000060; 이는 RPO 0 보장이 아님 |
| standby 쓰기 거부 | PASS | recovery=true/readOnly=on, SQLSTATE 25006 |
| DB/tunnel loopback | PASS | 127.0.0.1:15432/15433; 외부 앱 미기동 |
| 종료 예약/최소권한 | PASS | VM 자체 deallocate 한 action, exact VM scope, active timer/dry-run |
| 실제 20일 종료 | NOT VERIFIED | 미래 실행·클라우드 최종 상태 확인 필요 |
| 신규 이미지 CVE/SBOM gate | NOT VERIFIED | pinned base/버전/image ID와는 별개 |
| 사용자 로그인·공유·CT 전체 회귀 | NOT VERIFIED | 공개 화면/컨테이너 상태 확인과 구분 |
| 장애 승격/복구/기존 토큰·QR/동의 대조 | NOT VERIFIED | 실제 장애·승격을 실행하지 않음 |
| 독립 Key Vault·병원 장애 DR | NOT VERIFIED | 이번 범위 제외, 원본/KEK 미복사 |

이 결과는 primary 중단, 최신 커밋 유실 0, tenant 전 범위 복구 인증,
성능 영향 절대 0, 모든 FR/NFR 완료 또는 전체 MVP/v3 완료를 뜻하지 않는다.
비동기/무슬롯 구성이므로 부하·단절·WAL 재사용에 따라 lag/재초기화가 필요하다.

## 9. 재확인·복구·후속

```powershell
python -m unittest discover -s test -p 'azure_dr_*test.py'
python scripts/azure-dr-replication.py progress
python scripts/azure-dr-replication.py verify
```

대기 VM은 읽기 전용이고 사용자 경로에 없으므로, 문제가 생겨도 기존 서비스 DNS를 변경하지 않는다.
중단이 필요하면 해당 신규 DB 컨테이너/터널만 중단하고 증거를 보존한다.
HBA 복구 시 현재 파일 hash와 우리 전용 블록을 확인한 뒤 **해당 블록만** 제거한다.
이전 파일 전체를 무조건 덮어쓰면 이후의 다른 변경을 잃을 수 있으므로 금지한다.
전용 role은 먼저 NOLOGIN 처리하고 접속/의존성을 확인한다. 감사자료/원본 키를 삭제하지 않는다.

승격은 별도 승인·primary fencing·단일 writer·최신 동의 철회·QR 소비·DPoP replay·감사 무결성·키 접근·병원 경로 검증 후에만 가능하다.
현재는 standby 앱 및 readiness endpoint, 공통 HTTPS/Entra 주소, 승격 실행기가 없으므로
Traffic Manager를 켜거나 실제 사용자 접속을 이 서버로 보내지 않는다. 자동 failback도 구현하지 않았다.

## 공식 근거

- [PostgreSQL 16 pg_basebackup](https://www.postgresql.org/docs/16/app-pgbasebackup.html)
- [PostgreSQL streaming/slot trade-off](https://www.postgresql.org/docs/16/warm-standby.html)
- [Azure Key Vault geography와 복구 제약](https://learn.microsoft.com/en-us/azure/reliability/reliability-key-vault)
- [VM 상태·할당 해제와 청구](https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing)
- [Azure Retail Prices API](https://learn.microsoft.com/en-us/rest/api/cost-management/retail-prices/azure-retail-prices)

본 문서/시험은 합성 데이터 MVP 기술 증적이며 운영·보안 인증 또는 법률 판단이 아니다.
