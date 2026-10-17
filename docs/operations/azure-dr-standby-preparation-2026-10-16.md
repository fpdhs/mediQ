# Azure 단기 DR 대기 환경 준비 — 2026-10-16

상태: **DRAFT / UNASSIGNED · 배포 및 DR 전환 NOT VERIFIED**

후속 업데이트: 사용자 승인에 따라 별도 **비활성 Traffic Manager 검증 프로필**은 생성했다.
아래 내용은 생성 전 준비 시점의 기록이다. 실제 생성 범위와 검증은
[별도 검증 환경 기록](azure-dr-traffic-manager-validation-2026-10-16.md)을 참조한다.
대기 서버·DB 복제·실제 DR 전환은 여전히 NOT VERIFIED다.

추가 후속: [East Asia 대기 DB 복제 구성](azure-dr-standby-replication-2026-10-16.md)에서
별도 대기 VM과 읽기 전용 streaming replication을 검증했다. 실제 사용자 DR 전환 및
독립 키 복구는 여전히 NOT VERIFIED다. 아래 표는 최초 준비 시점의 기록을 보존한 것이다.

## 범위와 변경 경계

사용자가 승인한 방향은 시연 기간에만 가동하는 타 리전 대기 서버,
Traffic Manager Priority, DB 복제, 승인 기반 승격이다.
이번 작업은 읽기 전용 현황 조사와 로컬 준비 파일 작성까지만 수행했다.
Azure 리소스 생성, DNS 변경, Key Vault 변경, DB 복제·승격 및 애플리케이션 배포는 수행하지 않았다.
기존 미커밋 변경은 작업 시작 시 없었다. 커밋·푸시는 수행하지 않는다.

관련 요구사항 영향: FR-014~FR-025 정책·토큰, FR-026~FR-036 영상 경로·뷰어,
FR-037~FR-041 감사·탐지. 기존 동의·권한·Control/Data Plane 분리 기준을 유지한다.
DR 전용 승인 요구사항 ID는 아직 배정되지 않았다.

## 확인된 요구사항과 가정

- 사용자 답변: 대기 서버 가동은 “20일까지”.
- 종료 시각은 **2026-10-20 23:59 KST**로 가정했다. 종료 자동화는 아직 없다.
- 사용자가 제시한 주소는 `highpass-demo.japaneast.cloudapp.azure.com`이다.
  이는 VM 공인 IP용 Azure DNS 이름이며, 사용자가 관리하는 일반 CNAME 영역으로 확인되지 않았다.
- 새 주소·인증서·Entra redirect URI 검증 전 기존 주소 및 사용자 트래픽을 전환하지 않는다.

## 읽기 전용 확인 결과

증거: `artifacts/azure/dr-preflight-20261016T000118Z/inventory.json` 및 `plan.json`.
증거는 로컬 artifacts에 보관하며 저장소 추적 대상이 아니다.

| 항목 | 확인 내용 |
|---|---|
| 기본 환경 | Azure for Students, Japan East, Standard_B2als_v2 |
| 현 DB/Control | 두 컨테이너 running, healthy; DB 호스트 포트 공개 없음 |
| PostgreSQL | 16.15, primary, wal_level=replica, TLS 켜짐, 최소 TLS 1.2 |
| 복제 | 접속 중인 streaming replica 0개 — DB 복제는 아직 없음 |
| WAL 설정 | max_replication_slots=10, max_wal_senders=10, max_slot_wal_keep_size=-1 |
| 기존 네트워크 | 10.89.0.0/16; 대기 후보 10.91.0.0/24와 충돌 없음 |
| 기존 Traffic Manager | 구독 리소스 조회에서 프로필 없음 |
| 허용 리전 | japaneast, centralindia, malaysiawest, southeastasia, eastasia |
| Japan West | 할당량 여유와 별개로 구독 정책에서 허용되지 않음 |
| East Asia | 후보 SKU 제한 없음 확인, 전체 vCPU 0/6, Basv2 0/10 |
| 학생 크레딧 | 잔액 API 조회 404; 잔액 미확인이지 0이라는 뜻이 아님 |

현 컨테이너 상태 확인은 사용자 로그인, 병원 경로, 실제 영상 조회 및 DR 성공의 증거가 아니다.

## 확정 전에 필요한 선택

1. **공통 HTTPS 도메인**: 실제 관리 가능한 도메인과 DNS 관리 서비스가 필요하다.
   현재 cloudapp 주소를 임의로 Traffic Manager CNAME으로 변경할 수 있다고 가정하지 않는다.
   별도 도메인이 없다면 기존 서비스와 분리한 라우팅 검증부터 진행할지 결정한다.
2. **리전과 키 복구 범위**: East Asia는 배포 후보지만 Japan과 geography가 다르다.
   Japan Key Vault 백업을 East Asia Vault에 그대로 복원하는 방안은 사용하지 않는다.
   기존 Vault 공유 의존성을 남기는 제한적 Control DR과 독립 키 복구 설계를 구분해 승인받아야 한다.
   Japan West 정책 우회나 공유 Vault 변경은 하지 않는다.
3. **비용과 종료**: 실제 잔여 크레딧·요금과 종료 시각을 확인한 뒤 가동한다.
   VM 할당 해제 후에도 디스크·공인 IP·스토리지·모니터링 비용이 남을 수 있다.
   같은 학생 구독의 크레딧 소진은 주/대기 환경 모두에 영향을 줄 수 있다.

## 준비한 파일과 실행

- `scripts/azure-dr-plan.py`: 승인 구독·테넌트, 리전 정책, 할당량, 네트워크,
  종료 시각, DNS·키·크레딧 미확인 조건을 출력하는 **읽기 전용** 도구.
  `--apply` 옵션은 없고 리소스 생성 및 DB 변경 기능도 없다.
- `infra/azure/dr-traffic-manager.candidate.json`: Priority 1/2, TTL 30초의
  **프로필/엔드포인트 모두 Disabled**인 ARM 후보. DNS 레코드 변경은 포함하지 않는다.
  `/health/dr-route`는 설계 후보이며 실제 애플리케이션에 구현되지 않았다.
- `test/azure_dr_plan_test.py`: 로컬 계획 및 조건 평가기 단위시험.

```powershell
python -m unittest discover -s test -p azure_dr_plan_test.py -v
python scripts/azure-dr-plan.py
```

ARM JSON 파싱과 단위시험은 Azure ARM validation/what-if, 실제 배포 검증을 대신하지 않는다.

## 후속 구현 설계 — 아직 구현 아님

- PostgreSQL 물리 비동기 복제는 전용 REPLICATION 계정, 비공개 암호화 경로,
  pg_hba 최소 범위 및 인증서 검증을 전제로 한다. 5432를 인터넷에 공개하지 않는다.
- 복제 슬롯의 WAL 무제한 보존을 피하도록 상한·디스크 경고·재시드 절차를 정한다.
  현재 -1 설정을 변경하지 않았으며, 1GiB는 용량 검토 전 후보값이다.
- replica에서 기존 Control 부팅/마이그레이션을 자동 실행하지 않는다.
- 비동기 복제는 RPO 0을 보장하지 않는다. 수신 WAL=재생 WAL만으로
  원본의 마지막 커밋까지 받았다는 증거가 되지 않으므로 별도 대조가 필요하다.
- 승인자 인증, primary fencing, 단일 writer 잠금, 마지막 커밋,
  동의 철회·QR 소비·재전송 방지 원장·감사 무결성 대조를 승격 조건으로 한다.
  최신 상태를 입증하지 못하면 토큰 발급과 영상 접근은 거부한다.
- 조건 평가기는 입력된 증거를 검사할 뿐 실제 승인자 인증·fencing·잠금 획득이나
  pg_promote를 수행하지 않는다. 별도 승격 실행기와 실제 장애시험이 필요하다.
- 대기 환경이 기동됐다는 이유만으로 라우팅 준비 상태를 200으로 응답하지 않는다.
  승인·DB writer 상태·키 접근·병원 연결 검증 전에는 사용자 쓰기/발급을 열지 않는다.
- Traffic Manager는 DNS 라우팅이며 TLS 종료·DB 승격을 수행하지 않는다.
  TTL·클라이언트 캐시로 전환이 지연될 수 있고, 전부 비정상일 때도 DNS 응답이
  가능하므로 서버 측 fail-closed를 별도로 유지한다. 인증서 유효성도 별도 검사한다.
- 원본 DICOM은 A/B 가상 병원에 유지한다. Control DR을 PACS 또는 병원 전체 DR로 표현하지 않는다.
- 자동 failback은 하지 않고 복귀 시 역복제·무결성·단일 writer 확인을 다시 수행한다.

## 검증 경계

| 검사 | 결과 | 증거/제약 |
|---|---|---|
| Azure 구독·정책·할당량 조회 | PASS | 로컬 inventory.json |
| 기존 DB/Control 상태 조회 | PASS | 컨테이너 및 읽기 전용 SQL |
| 로컬 계획·승격 조건 검사 | PASS | unittest 20/20; 누락 시각 처리 오류 수정 후 재실행 |
| ARM 후보 JSON·Disabled 설정 | PASS | 로컬 파싱/단위시험만 수행; Azure 배포 검증 아님 |
| 실제 standby, DB 복제, 승격 | NOT VERIFIED | 미생성·미구현 |
| 공통 HTTPS·Entra·사용자 흐름 | NOT VERIFIED | 도메인 미확정, 기존 설정 유지 |
| 복구 시간·데이터 유실량 | NOT VERIFIED | 실제 장애시험 없음 |
| Key Vault 독립 복구 | NOT VERIFIED | geography 제약, 설계 결정 필요 |
| 종료 자동화·총비용 | NOT VERIFIED | 잔액·요금·종료 시각 확정 필요 |

## 공식 참고

- [Traffic Manager 동작](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-how-it-works)
- [엔드포인트 감시와 장애 응답](https://learn.microsoft.com/en-us/azure/traffic-manager/traffic-manager-monitoring)
- [공인 IP DNS 이름](https://learn.microsoft.com/en-us/azure/virtual-network/ip-services/public-ip-addresses)
- [Key Vault 복원력과 geography 제한](https://learn.microsoft.com/en-us/azure/reliability/reliability-key-vault)
- [PostgreSQL 16 warm standby](https://www.postgresql.org/docs/16/warm-standby.html)
- [VM 상태와 청구](https://learn.microsoft.com/en-us/azure/virtual-machines/states-billing)
- [Azure for Students 조건](https://azure.microsoft.com/en-us/free/students/)

이 문서는 배포 승인서나 의료 콘텐츠 검토 완료 증적이 아니다.
