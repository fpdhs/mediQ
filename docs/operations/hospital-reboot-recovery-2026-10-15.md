# A/B 병원 VM 재부팅 후 영상 경로 복구 — 2026-10-15

## 작업 목적

워크스테이션 재부팅 후 발생한 영상 연결 중단의 원인을 확인하고 기존 데이터·이미지·권한을 유지하면서 복구한다.
2026-10-15 21:20 KST 기준 인프라 복구 및 읽기 전용 영상 확인을 수행했다.
검토 상태는 **DRAFT / UNASSIGNED**다. 실제 로그인 계정의 브라우저 영상 표시를 완료했다고 주장하지 않는다.

## 관련 요구사항

- FR-006~009: 고정 검사 목록·메타데이터 보존 확인.
- FR-010~013, FR-026~031, FR-032~036: 의료진/환자 영상 진입점·Gateway·PACS 가용성.
- FR-014~025: 기존 인증·접근정책·단기 토큰 및 DPoP 거부 경로 보존.
- FR-037~041: 진단·복구 증적 보존. 기존 앱 감사로그 삭제/수정 없음.
- 암호화 저장소·최소권한·복구 관련 NFR. 개별 NFR 번호는 이번 작업에서 임의 부여하지 않음.

## 확인된 원인

1. A/B VMware 게스트는 모두 실행 중이었다. MAC과 기존 SSH 호스트키로 역할을 확인했다.
2. A PACS·mTLS·Gateway는 정상이고 Azure Control·PostgreSQL·공개 웹도 정상이다.
3. B Docker는 부팅 중 containerd 소켓 연결 시간 초과로 실패했다가 재시도 후 정상화됐다.
4. B `hp-patient-public-tls.service`는 Docker 의존 작업 실패로 inactive 상태에 남았다.
   이 서비스가 관리하는 TLS 컨테이너는 `restart: no`이므로 Docker 단독 복구만으로 재시작되지 않았다.
5. B LUKS 저장소는 재부팅 후 잠겨 있었다. 수신 PACS의 `restart: no`와 수동 잠금해제는 기존 보호 정책이다.
   일반 디렉터리로 PACS를 시작하거나 평문 키로 자동 해제하지 않았다.

게스트의 기존 설정·컨테이너·소스 영상이 초기화됐다는 증거는 없었다.
containerd의 부팅 지연이 발생한 더 낮은 수준의 원인은 확정하지 않았다.

## 복구·재발 완화

- 실행 중인 Docker/WireGuard를 확인하고 기존 B TLS systemd 서비스를 시작했다.
- 기존 이미지·컨테이너 ID·마운트 및 Caddy/Compose 파일 해시를 유지했다.
- 기존 `b-pacs-storage-provision.py --recover`로 승인된 저장 키 버전을 사용해 LUKS를 복구했다.
  개인 운영자에게 해당 키의 임시 unwrap 권한만 부여했으며 완료 후 해당 임시 assignment 제거를 확인했다.
  Vault의 private network/RBAC/purge protection 및 7일 soft-delete 설정을 유지했다.
- 기존 수신 PACS 시작 가드로 암호화 마운트·UUID·소유권·설정 검증을 통과한 뒤 **기존 두 컨테이너**를 순서대로 시작했다.
- B Docker에 `Wants=hp-patient-public-tls.service`를 추가했다.
  TLS 서비스에는 Docker/WireGuard의 stop/restart를 따르는 `PartOf`를 추가했다.
  기존 TLS의 `Requires`, `After`, 방화벽 준비 단계와 접근 제한은 유지했다.
- TLS만 중지한 뒤 이미 실행 중인 Docker에 `start`를 요청하여 TLS 의존 서비스가 다시 시작되는 것을 검증했다.
  Docker·VM 자체를 재시작하지 않았고, 다른 컨테이너는 재생성하지 않았다.

호스트 또는 B VM의 다음 재부팅에도 **암호화 수신 저장소는 운영자 복구가 필요**하다.
이번 변경은 저장소 자동 잠금해제나 수신 PACS 무조건 자동 시작을 도입하지 않는다.

## 생성 파일

- `scripts/hospital-reboot-recovery.py`: 기존 호스트키를 고정한 진단·TLS/수신 PACS 복구·영상 읽기 검사.
- `scripts/hospital-reboot-verify-images.js`: 기존 Gateway/수신 서비스 내부의 합성 UID·표본 원본 해시 확인.
- `scripts/hospital-reboot-boundary-check.py`: 계정·토큰 없이 공개 TLS/거부/CORS 경계 검사.
- `infra/workstation/docker-b-public-tls-recovery.conf`.
- `infra/workstation/b-public-tls-lifecycle.conf`.
- 본 문서.

B에 실제 추가한 파일:

- `/etc/systemd/system/docker.service.d/95-highpass-b-public-tls.conf`
- `/etc/systemd/system/hp-patient-public-tls.service.d/20-highpass-lifecycle.conf`

기존 앱 코드·API 계약·DB 스키마·Entra 역할 매핑·공개 접근 범위는 변경하지 않았다.
작업 전 존재하던 미커밋 UI/보안관제 변경은 보존했다. 커밋·푸시하지 않았다.

## 테스트 결과

| 확인 | 결과 | 범위·근거 |
|---|---|---|
| A/B/Cloud 최종 런타임 | PASS | 필요한 컨테이너 실행, healthcheck가 있는 컨테이너 healthy, 실패 systemd unit 없음 |
| 사설 WireGuard 연결 | PASS | 기존 인터페이스·라우트·최근 handshake 확인 |
| A 고정 CT 목록 | PASS | strict mTLS QIDO, SOP UID 집합 700개가 로컬 고정 manifest와 일치 |
| A 원본 표본 | PASS | 1·350·700번 DICOM 바이트 길이·SHA-256 일치 |
| B 저장소 복구 | PASS | 기존 LUKS UUID·AES-XTS·Argon2id·보존 probe 해시·마운트 옵션 검증 |
| B 수신 PACS 시작 | PASS | 기존 이미지/ID/마운트 보존, 공개 PACS 포트 없음, 암호화 시작 가드 통과 |
| B 기존 수신본 | PASS | 고정 Study 2개 instance의 UID·바이트 길이·SHA-256이 원본 manifest와 일치 |
| 공개 웹·모바일·영상 보안 경계 | PASS | 11/11. 웹·모바일 200, 미인증 401, 잘못된 증명·Origin·쿼리 토큰·관리 경로 403, 승인 preflight 204 |
| Docker→TLS 의존 재기동 | PASS | TLS 중지 후 Docker start 요청이 TLS를 재시작. Docker 재시작 없음 |
| 저장소 관련 기존 단위시험 | PASS | `python -m unittest discover -s test -p 'b_pacs_*test.py'`: 51개 |
| 새 Python/JS 구문 | PASS | AST parse 및 node --check |
| 원본 700개 전체 재해시 | NOT VERIFIED | 이번 복구에서는 목록 전체와 원본 3개 표본 확인 |
| B 전체 700장 수신 | NOT VERIFIED | 현재 저장된 고정 Study는 2장. 별도 700장 전송은 수행하지 않음 |
| 실제 Entra 환자/의료진 CT 표시 | NOT VERIFIED | 연결된 브라우저에 로그인 세션 없음. 인증을 우회하지 않음 |
| 변경 후 실제 PC/게스트 재부팅 | NOT VERIFIED | 의존 재기동만 검증. 다시 잠금해제해야 하는 실제 재부팅은 수행하지 않음 |

초기 B 검사에서 700장 전체 보관을 기대해 FAIL이 나왔으나, 이는 현재 수신 범위를 잘못 가정한 검사였다.
기존 전송 이력의 완료 건은 total_items=1이다. 검사는 기존 수신본의 manifest 부분집합·원본 해시 검증으로 수정했고,
700장 수신 완료는 별도로 NOT VERIFIED로 남겼다. 재부팅으로 698장이 유실됐다고 판단하지 않는다.
이번 진단 중 관측된 다른 IN_PROGRESS 1장 작업은 수정·재시도·취소하지 않았다.

첫 TLS 복구 시도는 잘못 옮긴 설정 해시 상수로 실행 전에 거부됐다. 상수를 수정한 뒤 서비스는 시작했지만,
즉시 컨테이너 상태를 읽는 검사에서 준비 전 상태를 FAIL로 기록했다. 이후 준비 대기를 추가했고,
최종 의존 재기동·공개 경계 검사로 정상화를 확인했다. 초기 실패 영수증도 보존했다.

## 주요 증적

- 최초 상태: `artifacts/workstation/reboot-recovery-20261015T120453Z/result.json`.
- 실제 부팅 오류: `artifacts/workstation/reboot-recovery-20261015T121220Z/result.json`.
- Key Vault/LUKS 복구: `artifacts/workstation/b-storage-provision-20261015T120759Z/result.json`.
  이 기존 스크립트의 `remaining` 배열에는 오래된 고정 문구가 있으므로 현재 상태 판정에는 실제 checks와 후속 runtime 증거를 사용한다.
- 수신 PACS 재시작: `artifacts/workstation/reboot-recovery-20261015T121158Z/result.json`.
- 재기동 설정·실제 의존 재기동: `artifacts/workstation/reboot-recovery-20261015T121611Z/result.json`.
- A 700 목록·표본 해시: `artifacts/workstation/reboot-recovery-20261015T121704961641Z/result.json`.
- B 기존 2장 해시: `artifacts/workstation/reboot-recovery-20261015T121956944045Z/result.json`.
- 암호화 런타임: `artifacts/workstation/b-storage-runtime-20261015T121850Z/result.json`.
- 공개 경계 11개: `artifacts/workstation/reboot-public-check-20261015T121856300323Z/result.json`.
- 전송 이력 읽기: `artifacts/workstation/reboot-recovery-20261015T121850884835Z/result.json`.
- 최종 런타임: `artifacts/workstation/reboot-recovery-20261015T122024939288Z/result.json`.

## 다음 재부팅 후 운영 순서

1. VMware에서 기존 A/B VM을 시작한다. Docker·WireGuard가 활성화될 때까지 기다린다.
2. `python scripts/hospital-reboot-recovery.py`로 상태를 확인한다. 암호는 숨김 입력이며 저장하지 않는다.
3. B 공개 TLS가 inactive이면 `python scripts/hospital-reboot-recovery.py --role B --action restore-tls`.
4. B 암호화 저장소가 잠겨 있으면 승인된 Azure 운영자 로그인 상태에서 `python scripts/b-pacs-storage-provision.py --recover`.
5. `python scripts/hospital-reboot-recovery.py --role B --action restore-receiver`.
6. `python scripts/hospital-reboot-boundary-check.py` 및 `python scripts/b-pacs-storage-runtime-check.py`.
7. 실제 계정으로 로그인하고 새 단기 권한을 발급받아 CT를 연다. 기존 만료 토큰 재사용은 허용하지 않는다.

`restore-receiver`는 암호화 마운트가 확인되지 않으면 시작을 거부한다. `--recover`를 이미 열린 저장소에 반복 실행하지 않는다.

## 재기동 설정 복구 방법

기존 이미지·Caddy·Compose 설정은 그대로다. 재기동 동작만 되돌릴 때는 위 두 신규 drop-in의 내용과 SHA-256을
증적과 대조한 뒤 해당 파일 두 개만 제거하고 `systemctl daemon-reload`한다. 서비스/볼륨/키/영상은 삭제하지 않는다.
이번 작업에서 해당 rollback 삭제를 실제 실행하지 않았다.
