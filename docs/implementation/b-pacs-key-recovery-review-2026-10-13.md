# B 저장 키 보호·복구 검토 — purge protection 적용 권고

검토 시각: 2026-10-13 10:51 Asia/Seoul. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty. **DRAFT / UNASSIGNED; 기술 검토 완료, 비가역 변경 승인 대기**. 의료진 UI의 병행 변경을 포함한 기존 작업은 보존했다. 요구사항 영향: V3-SR-CRY-002/004/005, V3-SR-AUD-001/003, V3-SR-OPS-003. 요구사항 완료 판정은 아니다.

## 결론

**현재 공유 Vault의 7일 보존 기간을 유지하면서 purge protection을 활성화하는 것을 권고한다.** 실제 활성화는 사용자에게 아래 영향을 설명하고 확인받은 후 수행한다. 이번 검토에서 Vault 설정·권한·키·서비스·디스크는 변경하지 않았다.

- 대상: `kv-hp-demo-4869edd9`, Japan East, 기존 project resource group/subscription.
- 변경: `enablePurgeProtection=true` 한 항목. PublicNetworkAccess Disabled·RBAC·soft-delete·기존 role assignment와 키 버전은 그대로 유지한다.
- 범위: B 저장 키 한 개가 아니라 **공유 Vault 전체**다. 기존 A/B 영상 전송 키에도 적용된다.
- 비가역성: 활성화 후 관리자를 포함하여 비활성화하거나 강제로 우회할 수 없다. 삭제된 Vault/객체의 영구 삭제는 보존 기간이 끝날 때까지 차단된다. [Microsoft 복구 개요](https://learn.microsoft.com/en-us/azure/key-vault/general/key-vault-recovery)
- 기존 보존 기간7일은 생성 후 변경할 수 없다. 90일이 필요하면 새 Vault 생성·이관·별도 승인·비용 검토가 필요하며 이번에 만들지 않는다. [Microsoft soft-delete 설명](https://learn.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview)
- 키의 일반 삭제·disable·만료에 의한 접근 중단까지 purge protection이 방지하는 것은 아니다. 서비스 연속성을 보장하는 기능으로 표현하지 않는다.

현재 PoC에서 영상을 적재하기 전 보호를 강화한다는 권고이며, 운영에 적합한 보존 기간·법적 보관 정책을 승인했다는 뜻이 아니다.

## 새로 확인한 결과

명령 `python scripts/b-pacs-key-recovery-review.py`, exit0, 7,591ms. **읽기 전용 검토 실행 성공**이지 보안 Gate 전체 PASS가 아니다.
증적: `artifacts/azure/b-key-recovery-review-20261013T015144Z/result.json`.

| 확인 항목 | 결과 | 근거·한계 |
|---|---|---|
| private network / RBAC / soft-delete | PASS | 실제 ARM readback; Disabled / true / true |
| soft-delete retention | 확인됨:7일 | 실제 ARM readback |
| purge protection | FAIL | enablePurgeProtection=null; 미설정 |
| Key Vault AuditEvent 진단 설정 | FAIL | 실제 diagnostic settings 목록0개 |
| 저장 키의 잔여 임시 assignment | PASS | 실제 role assignment 목록에서 저장 키 scope0개 |
| 기존 A wrap/B unwrap 권한 분리 | 확인됨 | 영상 전송 키 scope의 기존 두 assignment 보존; 저장 키 권한 추가 없음 |
| 두 복구 자료 사본의 SHA-256·KEK binding·LUKS header | PASS | 기존 receipt hash와 일치; 원시 key/blob 내용 출력 없음 |
| 현재 private Data Plane key metadata | NOT VERIFIED | workstation의 ARM keys list조차 ForbiddenByConnection. 공용 네트워크·bypass·추가 역할로 우회하지 않음 |
| 새 Vault로 KEK backup restore | NOT VERIFIED | 대상 Vault 없음, 복원 안 함 |
| 실제 B 재부팅 recovery | NOT VERIFIED | VM 재부팅 안 함 |
| 전체 ciphertext volume backup/restore | NOT VERIFIED | wrapped key와 header 백업은 전체 영상 백업이 아님 |
| 실제 Vault crypto/backup 감사 event | NOT VERIFIED | 현재 진단 설정 부재; 과거 event 보존 여부 별도 확인 필요 |

`azure-compliance` 스킬의 점검·변경 분리와 키 수명주기 검토를 적용했다. 신규 azqr 설치/전체 subscription scan/secret 값 조회는 이 범위를 벗어나 수행하지 않았다. 저장 KEK의 자동 만료 미설정은 기존 생성 이력이며 현재 private key metadata를 새로 읽어 입증한 것은 아니다. 복구·rotation 준비 없이 일괄 만료일을 부여하여 기존 volume을 못 열게 하지 않는다.

## 복구 검토 결정

1. **평문 fallback 금지 유지.** 원시 key는 디스크/env/argv/Control DB에 보관하지 않는다. 운영자 인증과 저장 키 한 개의 임시 read/unwrap-only 권한으로 수동 복구한다. 이미 mount된 volume은 Vault 장애만으로 자동 잠기지 않는다.
2. **재부팅은 별도 maintenance 시험.** 현재 Portal 가용성에 영향을 주므로 실행 전 시점·중단 범위를 승인받는다. B container/image와 UUID·backing/hash 기준선 → 안전 lock → 재부팅 → boot ID 변경 확인 → unlock 전 mount/mapper 부재와 서비스 fail-closed 확인 → Key Vault recover → 동일 probe/hash·mount 경계·Portal readiness 확인 순서다. root 디스크 포맷, crypttab 평문 key, busy mount 강제 종료는 금지한다.
3. **별도 Vault 복원은 새 자산 승인이 필요.** 동일 subscription/geography의 별도 private RBAC Vault·private endpoint·DNS·restore-only 운영자 권한을 준비하고 기존 key를 삭제하지 않은 채 encrypted backup을 복원한다. 공개 endpoint로 임시 노출하지 않는다. 기존 B volume은 건드리지 않고 복제/읽기전용 검증 대상에서 wrapped key unwrap 및 정확한 UUID·probe로 복구를 검증한다. [Microsoft 백업·복원 조건](https://learn.microsoft.com/en-us/azure/key-vault/general/backup)
4. **복구 Vault는 현재 코드에 자동 연결되지 않는다.** 현재 guest는 원본 Vault/key namespace를 고정한다. 대체 Vault URI를 무조건 허용하는 우회는 만들지 않는다. 복구 대상·원본 버전·백업 binding 검증을 명시적으로 구현·검토한 후 시험한다. 복원본은 독립 키라 원본 disable로 함께 폐기되지 않는 점도 관리해야 한다.
5. **볼륨 데이터 백업을 별도로 마련한다.** 향후 PACS를 정지/일관된 snapshot 상태로 만든 후 ciphertext volume을 백업하고 hash·보관 위치·복구 권한을 기록한다. 현재 key/header 자료만으로 700장 복구를 주장하지 않는다.
6. **AuditEvent 수집을 배포 gate에 추가한다.** 기존 승인된 로그 수집처를 확인하고 retention·권한·비용을 정한 후 별도 설정한다. 미래 wrap/unwrap/backup event와 운영자·key version·시간을 실제 조회하여 연계한다. 로컬 JSON을 Azure 감사로그로 대체하지 않는다.

## 승인 후 적용·검증 범위

승인된 경우 정확한 Vault/tenant/subscription과 직전 properties를 다시 확인하고 purge protection 한 항목만 활성화한다. 직후 enabled=true readback, 기존7일/private/RBAC 설정·assignment 보존 확인 및 변경 event를 기록한다. **rollback으로 purge protection=false를 제시하지 않는다.** 변경을 되돌릴 수 없다는 점 자체가 승인 조건이다.

공유 Vault 설정 변경 승인은 재부팅·신규 복구 Vault 생성·PACS 배포·700장 전송·로그 저장소 신설까지 자동 승인하지 않는다. 각 시험과 비용·가용성 영향을 해당 작업 단위에서 확인한다. 기존 검토자 PASS를 이번 자료에 승계하지 않는다. commit/push 없음.

다음 사용자 결정 한 개: **공유 Vault 전체에 현재7일 보존 기간의 purge protection을 활성화할지 승인**.
