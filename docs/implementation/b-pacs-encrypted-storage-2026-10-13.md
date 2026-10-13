# B 전용 8GiB 암호화 저장소와 Key Vault 보호·복구

상태: **저장소 생성·수동 잠금/재열기 scoped PASS / PACS 배포 NOT VERIFIED / DRAFT · UNASSIGNED**.
관측: 2026-10-13 10:30–10:42 Asia/Seoul. HEAD `c1040c8439a0bdb78c68a7a83a73d84bc2704f31` + dirty. 기존 변경 보존, commit/push 없음. 현재 상태의 권위 위치는 [통합 상태](mediq-presentation-integration-status-2026-10-09.md)이다.

## 작업 목적과 확인된 구조

사용자가 승인한 **새 B 전용 8GiB 저장소**를 기존 root 디스크·PACS 데이터와 분리하여 생성했다. A/B/Control 기존 이미지와 동의·DB·고정 CT는 교체하지 않았다. B에는 기존 Portal 하나만 계속 실행 중이다. 수신 PACS를 이번에 배포하거나 영상 700장을 등록하지 않았다.

원본은 B 파일 기반 LUKS2에 저장될 예정이며 Control DB에 영상·원시 저장 키를 넣지 않는다. 기존 영상 전송용 Key Vault key/서비스 identity의 권한을 늘리지 않았다. 보안 영향: FR-026~031, FR-037~041, V3-SR-CRY-002/004/005/006, DATA-001, OPS-001/003. 요구사항 영향 표기이며 전 범위 충족 판정은 아니다.

## 실제 생성 자산

| 자산 | 확인 값 |
|---|---|
| B backing file | `/opt/highpass/b-pacs-storage/volume-8g.luks` |
| backing 크기 | 8,589,934,592 bytes = 8GiB |
| mapper | `/dev/mapper/highpass-b-pacs` |
| LUKS UUID | `627df927-a317-4950-88d1-3293a3b261b0` |
| 암호·KDF | LUKS2, AES-XTS plain64, 512-bit XTS key, Argon2id |
| mount | `/opt/highpass/b-pacs-encrypted`, ext4, nodev/nosuid/noexec |
| ext4 총 용량 / 관측 가용 | 8,333,856,768 / 7,888,396,288 bytes |
| storage KEK | `highpass-b-storage-kek-20261013`, RSA2048, version `eb914d9add804b808d0f03caad9eb126` |
| KEK 위치 | 기존 private RBAC Vault, RSA-OAEP-256 wrap/unwrap |

8GiB는 **파일 전체 크기**다. LUKS header·filesystem·reserved blocks 때문에 영상에 쓰는 용량은 더 작다. 현재 mount에는 `lost+found`와 64-byte 무작위 **비의료 복구 시험 데이터**만 존재한다. DICOM은 없다. 새 `cryptsetup-bin`을 설치했으며 OS 업그레이드·재부팅·기존 디스크 포맷은 하지 않았다.

루프 `/dev/loop7`은 생성 시 관측값일 뿐 재부팅 후 고정 주소가 아니다. 모든 포맷·잠금은 canonical 파일, root 소유권, 정확한 loop backing, mapper, UUID를 확인한다. `/dev/sda`·기존 partition은 포맷 대상으로 사용하지 않는다. 존재하는 경로·mapping·key를 재사용하여 덮어쓰지 않고 중단한다. 부분 실패 시 자산을 보존하여 별도 조정한다.

## 저장 키 보호 및 권한

1. B root 프로세스가 CSPRNG 32-byte LUKS keyfile 비밀을 메모리에서 생성한다. 이는 LUKS 내부 XTS volume key와 구분된다.
2. core dump를 차단하고 프로세스 메모리를 `mlockall`로 잠근다. 실패하면 키를 생성하거나 저장소를 포맷하지 않는다.
3. 전용 버전 KEK로 wrap하고 다시 unwrap하여 일치 여부를 확인한다. 키 백업 blob 생성까지 성공한 뒤 새 파일을 할당·포맷한다.
4. 원시 비밀은 `cryptsetup --key-file -`의 stdin으로만 전달한다. 파일/env/argv/API/Control DB/실행 증적에 쓰지 않는다. 가변 buffer는 처리 후 비운다. Python/base64/library 일시 복사본의 완벽한 메모리 소거를 주장하지 않는다.
5. `storage.json`은 B 경로·역할·UUID·크기·version-pinned KEK·wrapped key를 기록한다. root-only directory 0700, 파일0600이다. wrapper를 바꿔도 실제 UUID·LUKS keyslot이 맞지 않으면 unlock에 실패한다. root 관리자 자체의 악성 변경 방어로 주장하지 않는다.
6. 인증된 Azure 운영자에게만 **임시** 권한을 부여한다. 초기 key 생성은 기존 create/read-only 역할의 임시 Vault 범위이고 즉시 제거한다. crypto/backup 권한은 **전용 저장 키 한 개의 scope**로 한정한다. 수동 복구는 read/unwrap-only다. A/B 앱 principal에는 새 권한을 부여하지 않았다.
7. 작업 후 정확히 이번에 만든 assignment만 삭제하고 ARM에서 부재를 확인한다. Azure 권한 캐시의 즉시 무효화까지 시험한 것은 아니다. 인증 실패·Vault 오류·timeout은 로컬 평문 fallback 없이 실패한다.

`/etc/crypttab`, fstab 자동 mount, systemd 자동 unlock, 고정 bearer token 저장은 추가하지 않았다. 재부팅 후에는 닫힌 상태에서 인증된 운영자의 복구가 필요하다. Portal에는 디스크 unlock API가 없다.

## 복구 설계와 한계

- B와 별도 workstation에 **wrapped key manifest + LUKS header backup + Azure encrypted KEK backup blob**을 보존한다. workstation 두 복구 폴더 ACL은 사용자·SYSTEM·Administrators만 허용하도록 제한했다. Git ignored이며 원시 키가 아니다.
- 이 자료만으로 영상 복구가 되는 것은 아니다. 이후 DICOM을 저장하면 일관된 **ciphertext volume backup/snapshot**도 필요하다. 현재 전체 8GiB 볼륨 백업과 별도 머신 복원은 미검증이다.
- Key Vault 장애: 신규 unlock 실패, 자동 평문 키 fallback 금지. 이미 mount된 디스크가 Vault 장애만으로 자동 잠기는 것은 아니다. 서비스 fail-closed와 안전한 shutdown은 수신 서비스 적용 단계에서 검증해야 한다.
- 실제 Vault 설정은 soft-delete=true, retention7일, purge protection 미설정이다. 공유 Vault 전체에 영향을 주는 purge-protection 변경은 실행하지 않았다. 적용 여부를 별도 승인하고, 장기 데이터 보관 전에 백업·삭제·복구 정책을 검토해야 한다.
- 잘못 삭제한 KEK의 soft-delete 복구와 암호화 backup의 복원은 다른 절차다. Azure encrypted blob은 Azure 외부에서 풀 수 없고 동일 subscription/geography의 Vault로 복원해야 한다. 복원된 key copy는 원래 key와 독립적으로 관리되므로 원본 disable만으로 모든 복원본을 무효화하지 못한다. [Microsoft 백업·복원](https://learn.microsoft.com/en-us/azure/key-vault/general/backup)
- Vault 복구 시 RBAC 등 연계 구성이 자동 복구되는 것으로 가정하지 않는다. [Microsoft soft-delete](https://learn.microsoft.com/en-us/azure/key-vault/general/soft-delete-overview)
- KEK rotation은 새 key/version 준비 → 메모리에서 기존 비밀 unwrap → 새 KEK wrap → 회복 시험 → 원자적 manifest 교체 → 새 backup 확인 → 구 버전 보존정책 판단 순서로 **설계만** 했다. volume key 변경·reencrypt와 다르며 자동 rotation은 미구현이다. 현재 저장 KEK에는 자동 만료를 넣지 않았고 영구 무관리 승인을 뜻하지 않는다.

AES-XTS는 저장 기밀성이지 AEAD·파일 무결성 증명이 아니다. 임상 파일 등록/재조회에서 기존 SHA-256·UID 검증을 별도로 수행해야 한다. mount된 상태의 root/하이퍼바이저 공격이나 모든 v3 tenant 통제를 충족했다고 주장하지 않는다. [cryptsetup 문서](https://man7.org/linux/man-pages/man8/cryptsetup.8.html)

## 파일 변경과 보안 검토

생성: `scripts/b-pacs-storage-{guest,provision,lock,runtime-check,cleanup-check}.py`, `infra/azure/b-pacs-storage-operator-role.json`, `test/b_pacs_storage_provision_test.py`, 이 문서. 현재 상태 문서 갱신. 기존 production API/UI·DB migration은 변경하지 않았다.

독립 검토 전 신규 자료는 DRAFT/UNASSIGNED. VM root 작업 기록·로컬 hash 증적과 Azure RBAC readback은 남겼으나 Key Vault 진단로그의 실제 wrap/unwrap/backup event와 Control 감사 chain 연결은 미검증이다. 로컬 결과 JSON만으로 모든 감사 요구사항 PASS를 선언하지 않는다.

## 실행과 결과

| 시험 | 결과 | 증적·한계 |
|---|---|---|
| 보호 키·새 8GiB LUKS2·ext4 생성 | PASS | `artifacts/workstation/b-storage-provision-20261013T013045Z/result.json` 내 scoped 생성 결과 |
| 잘못된 key 거부·Vault unwrap 후 재열기·시험 데이터 보존 | PASS | 같은 receipt; 반복 crypto/실제 disk 시험 |
| 초기 provisioning 전체 실행 | NOT VERIFIED, exit1 / 104,389ms | 임시 assignment 삭제 후 **조회 옵션 오류** 때문에 초기 cleanup 판정 FAIL. 원문 보존 |
| 두 임시 assignment 실제 부재 재확인 | PASS, exit0 | 같은 폴더 `cleanup-recheck.json`; read-only ARM 재확인. 제거를 재수행하거나 다른 권한을 삭제하지 않음 |
| 안전한 수동 lock | PASS, exit0 | `artifacts/workstation/b-storage-lock-20261013T013616Z/result.json` |
| 새 운영자 인증·read/unwrap-only 수동 recover·임시 권한 제거 | PASS, exit0 / 57,147ms | `artifacts/workstation/b-storage-provision-20261013T013712Z/result.json` |
| 실제 B Docker 내 암호화 mount 경계 검사 | PASS | `artifacts/workstation/b-storage-runtime-20261013T013452Z/result.json`; 기존 Portal pinned image의 임시 network-none/read-only/unprivileged probe, 자동 제거 |
| 수동 복구 후 실제 boundary·내용 해시 재검증 | PASS, exit0 | `artifacts/workstation/b-storage-runtime-20261013T014128Z/result.json`; 동일 probe SHA-256, 전용 mapper, 기존 Portal healthy |
| offline provisioning 안전 계약 | PASS 12/12, exit0 | `python -m unittest discover -s test -p b_pacs_storage_provision_test.py -v` |
| 기존 mount 경계 focused 회귀 | PASS 6/6, exit0 | `node --test test/b-pacs-storage-boundary.test.js`; 전체 회귀 아님 |
| 실제 B Portal 보존 | PASS | 동일 image `sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3`, healthy; container 목록 동일 |
| 재부팅·Vault backup restore·key 삭제/rotation·감사 event | NOT VERIFIED | 이번 작업 범위 미완료 |
| B PACS·700장·브라우저 다운로드/수신 | NOT VERIFIED | 적재·수신 서비스 배포 없음 |

최초 Windows unit import는 Linux `resource` import 문제로 실패했고 Linux-only memory guard 안으로 이동한 후 재실행 PASS했다. 초기 cleanup 조회는 Azure CLI에서 `--all`과 scope 옵션을 함께 사용한 문제가 있어 all-assignment 정확한 ID 조회로 수정했다. 두 최초 실패를 숨기지 않는다. 후속 수동 복구 전체 실행은 exit0이다.

## 재현·안전 복구

저장소가 없는 상태에서만 `python scripts/b-pacs-storage-provision.py`를 사용한다. **현재 이미 생성되어 있으므로 재생성하지 않는다.** 다음은 승인된 수동 maintenance 때만 수행한다. PACS가 사용하는 경우 서비스 정지·정합성 확인을 먼저 한다; busy filesystem을 강제 unmount하지 않는다.

```powershell
python scripts/b-pacs-storage-runtime-check.py
python scripts/b-pacs-storage-lock.py
python scripts/b-pacs-storage-provision.py --recover
python scripts/b-pacs-storage-runtime-check.py
```

VM 비밀번호는 concealed stdin, Azure token은 로그인된 운영자 CLI에서 받아 guest stdin으로만 전달한다. pinned SSH 및 private IP TLS/SNI/CA 검증, 유한 command/network timeout을 사용한다. 실패 시 새 file/key/header/manifest를 삭제하지 말고 정확한 UUID·loop·assignment·증적을 확인하여 조정한다. backup header restore는 실제 disk header를 덮어쓰므로 별도 승인/복제 환경 없이는 수행하지 않는다.

현재 mount는 root0700이다. Orthanc의 실제 UID에 전용 data subdirectory 최소 권한을 부여하고 동일 encrypted filesystem bind를 확인하는 절차가 아직 필요하다. 넓은 chmod777 또는 Portal에게 raw filesystem 권한을 주는 해결책은 사용하지 않는다.

## 다음 작업 한 개

2026-10-13 10:51 KST 후속: [공유 Vault 보호·복구 검토](b-pacs-key-recovery-review-2026-10-13.md)에서 실제 read-only 설정/권한/복구 자료를 재확인했다. purge protection 활성화/현재7일 유지 권고, 비가역 Vault 전체 변경의 실제 승인은 대기 중이다. AuditEvent 진단 설정 부재도 신규 FAIL로 기록했다. 재부팅·별도 Vault 복원은 실행하지 않았다.

**저장 키의 공유 Vault purge-protection 적용 여부와 복구 검토를 확정하고 B 수신 PACS 배포 gate를 준비한다.** 이후 전용 mTLS, 고정·스캔된 이미지, DB directory 최소권한, audit/retention/rollback을 연결해야 한다. 저장소 생성 성공을 PACS 수신 완료·700장 종단 완료·MVP/v3 완료로 승격하지 않는다.
