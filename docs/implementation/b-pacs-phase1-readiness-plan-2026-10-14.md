# 1단계 계획: B 암호화 저장소와 수신 PACS 준비

작성일: 2026-10-14 Asia/Seoul
상태: B VM 수동 키 복구·수신 PACS 기동·합성 DICOM mTLS 저장/재조회 PASS / 환자 동의 A→B 및 재부팅 복구 미검증 / 운영 승인 아님

## 목적과 범위

B 병원이 환자의 다운로드 동의를 받은 영상을 보관할 수 있도록, B VM 내부에 암호화 저장소와 수신 Orthanc의 안전한 실행 기반을 마련한다. 이번 단계의 완료는 다운로드 기능 전체 완료가 아니다.

포함: 기존 B 저장소 재확인, 키 보호·복구, 수신 PACS와 제한된 mTLS 경계, 수동 안전 기동, 로컬 합성 DICOM 등록·재조회, 장애·거부 시험 및 복구 기록.

제외: A 원본 저장 암호화 변경, A→B 실제 전송 활성화, 웹 다운로드 버튼 연결, 전체 700장 작업, 실제 환자 데이터, 공개 PACS 포트, 신규 유료 Azure 리소스, 자동 키 해제.

관련 요구사항: FR-026~031, FR-037~041. 후속 동의·인가 통합은 FR-001~005, FR-014~025의 영향을 받지만 이번 단계에서 충족을 주장하지 않는다. 저장 암호화·최소 권한·복구는 AGENTS.md 14.3~14.5 및 docs/SECURITY.md 기준으로 검증한다. 신규 NFR 번호를 임의 부여하지 않는다.

## 확인된 요구사항·가정·결정·불확실성

- 확인된 요구사항: 원본은 병원 측에 보관하고 Control에는 지속 저장하지 않는다. 외부 PACS 직접 접근을 허용하지 않으며 실패 시 접근을 차단한다.
- 확인된 기존 기록: B 전용 8GiB LUKS2 저장소 생성·수동 잠금/복구 시험 기록이 있다. 저장 암호는 AES-XTS이며 전송용 AES-256-GCM과 별개다. 수신 PACS는 구현 후보로 기록되어 있다.
- 합리적 가정: 기존 B VM·저장소·Key Vault를 재사용할 수 있다. 이는 실행 직전 읽기 전용 점검으로 재확인해야 한다.
- 구현 결정: 기존 후보를 최소 변경으로 사용하고 PACS 및 mTLS 서비스는 별도 컨테이너로 구성한다. 저장소를 확인한 후 수동 기동하며 자동 재시작은 사용하지 않는다.
- 남은 불확실성: 재부팅 복구, 전체 암호문 볼륨 백업·복원, Key Vault 감사 수집, 환자 동의 A→B 전송, 실제 용량 한계. 현재 B 마운트·컨테이너 UID·수동 복구는 아래 최신 실행 기록으로 확인됨.

## 기존 구성과 재사용 대상

- `infra/workstation/hospital-b-pacs-receiver.compose.yml`: 암호화 경로 bind, 자동 경로 생성 금지, 내부 네트워크, 공개 ports 없음, restart=no.
- `orthanc/hospital-b-receiver.json`: 저장·인덱스 동일 경로, OverwriteInstances=false, DICOM TCP 서버 비활성.
- `src/b-pacs-storage-boundary.js`, `scripts/start-b-pacs-mtls.js`: 저장 경계 및 제한된 PACS 접근 후보.
- `docs/implementation/b-pacs-receiver-2026-10-13.md`: 단일 인스턴스 등록·재조회 후보와 미검증 사항.
- `docs/implementation/b-pacs-encrypted-storage-2026-10-13.md`: 저장소·키 보호·수동 복구 기록.

기존 Orthanc 후보의 내부 HTTP 인증은 비활성이다. 전용 네트워크와 mTLS 경계가 실제로 직접 접근을 차단하는지 배포 관문으로 검증한다. 이 격리가 입증되지 않으면 배포하지 않으며, 내부 인증 보강을 검토한다. Portal을 raw PACS 네트워크에 직접 연결하지 않는다.

## 실행 순서와 관문

### 1. 현재 상태 읽기 전용 확인

B 이미지·컨테이너·Compose·마운트·호스트 디스크·여유 용량·키 참조를 기록한다. 기존 Portal과 A/Control 기준선을 보존하고 병행 변경 여부를 확인한다. 저장소가 없거나 예상 UUID와 다르면 자동 재생성하지 않고 중단한다. 기존 재부팅/전송 중단 지시가 있다면 해소 전 유지한다.

통과 조건: 기존 데이터 및 서비스 위치가 식별되고 이번 작업의 대상 경로·이전 설정·복구 방법이 확정됨.

### 2. 암호화 저장소와 키 보호 확인

`/opt/highpass/b-pacs-encrypted`의 실제 mount와 전용 dm-crypt/LUKS 장치 연결을 확인한다. 디렉터리 존재나 과거 PASS JSON으로 대체하지 않는다. 저장·인덱스·임시 파일·컨테이너 writable layer에 원본이 새지 않는지 확인한다. 실제 UID에 필요한 하위 경로만 허용하고 chmod777은 금지한다.

Key Vault version-pinned wrapped key·복구 자료·purge protection·최소 권한 및 실제 감사 수집 상태를 확인한다. 원시 키는 소스·env·argv·일반 파일·Control DB에 저장하지 않는다. 기존 실행 역할의 권한을 넓히지 않는다.

통과 조건: 실제 암호화 장치 및 컨테이너 경계 확인, 잘못된 키·마운트 부재 거부, 저장 키 작업의 감사 증적 확보. 미해결 항목은 NOT VERIFIED로 남기고 지속 수신 활성화 금지.

### 3. 복구·안전 기동 시험

먼저 비의료 probe로 서비스 정지→정상 잠금→새 운영자 인증→수동 재열기→해시 일치를 확인한다. busy mount 강제 해제는 금지한다. PACS는 마운트 검증을 통과한 후에만 기동한다. Vault 장애 시 신규 unlock을 거부하며 평문 키 fallback을 금지한다. 이미 열린 볼륨이 Vault 장애만으로 닫힌다고 주장하지 않는다.

재부팅 시험은 별도 유지보수 시점과 기존 중단 지시 해소를 확인한 후 진행한다. 재부팅 후 닫힌 저장소에서 PACS가 자동 기동하지 않아야 한다. 원본 볼륨을 덮어쓰지 않는 별도 복제 대상에서 암호문 백업·키 복구 자료의 복원 시험을 수행한다. 복제 공간이 없으면 새 리소스를 자동 생성하지 않고 해당 관문을 미검증으로 유지한다.

통과 조건: 안전 기동·수동 복구·재부팅 후 차단 및 별도 복원 확인. 단순 재열기를 재해 복구 완료로 취급하지 않음.

### 4. 수신 PACS 후보 준비·배포

최신 B 기준 이미지에서 서버 전용 후보를 만들고 이미지 digest를 고정한다. 취약점·비밀정보 검사 후 전용 서버/클라이언트 인증서의 CA·SAN·EKU·만료를 검증한다. 비밀 파일은 VM 보호 경로에서 읽기 전용으로 연결한다.

수신 Orthanc와 제한된 mTLS 경계만 추가한다. 외부 포트, DICOM TCP, 삭제·수정 API, 다른 병원 데이터 접근을 열지 않는다. 실제 컨테이너가 같은 암호화 저장소를 사용하고 dm 장치를 확인할 수 있는지 검사한다. 기존 B Portal 화면·A Gateway·Azure Control은 이 단계에서 교체하지 않는다. import feature flag는 비활성 유지한다.

`infra/workstation/hospital-b-pacs-portal.compose.yml`은 `CAPSTONE_B_PACS_IMPORT_ENABLED=1`을 설정한다. 이 overlay는 **1단계에서 배포하지 않는다.** A 송신, Control 측 인가 및 B 수신 계약이 정렬되고 다음 단계의 승인 관문을 통과하기 전까지 사용하지 않는다. 수신 PACS Compose만 배포하는 것으로 Portal 버튼이나 Import를 활성화하지 않는다.

통과 조건: 후보 보안 검사 통과, PACS readiness 정상, 인증된 경계 접근만 허용, 기존 서비스 정상, A/Control 및 공개 네트워크 불변.

### 5. 단일 합성 DICOM 저장·재조회 검증

전용 인증된 내부 시험 경로로 합성 DICOM 1개를 등록한다. SOP/Study/Series UID, 파일 크기, 원시 SHA-256을 기록하고 재조회 결과와 비교한다. 같은 파일의 중복 등록은 기존 데이터가 바뀌지 않아야 하며 같은 UID·다른 내용은 보존하고 거부해야 한다. 서비스 재시작 후 동일 결과를 확인한다.

이 시험은 저장 기반 확인일 뿐 환자 동의·A→B 종단 성공이 아니다. 외부 import와 웹 버튼을 활성화하거나 감사·권한 경계를 우회하는 시험 endpoint를 추가하지 않는다. 등록/거부/검증 결과는 상관관계 ID로 기록하고 민감한 파일 내용·키·토큰은 로그에 넣지 않는다.

통과 조건: 파일·UID 무결성, 중복/충돌 방어, 서비스 재시작 후 보존, 감사 확인.

## 예정 시험 표

아래는 계획이며 이번 문서 작성에서 시험을 실행하지 않았다.

| 시험 | 현재 결과 | 통과 기준 |
|---|---|---|
| 현재 B 암호화 mount·UUID·컨테이너 경계 | NOT VERIFIED | 10/13 runtime artifact는 당시 mount·암호화 매핑·Portal health를 기록했으나, 당시 컨테이너 probe는 LUKS UUID를 provisioning manifest와 정확히 비교하지 않았다. 최신 상태를 다시 읽어야 함 |
| mount 부재·일반 디렉터리 대체 | NOT VERIFIED | 기동/요청 거부, 평문 쓰기 없음 |
| 정상 인증서 및 누락/잘못된 인증서 | NOT VERIFIED | 정상만 허용, 나머지 거부 |
| 외부/Portal의 raw PACS 접근 | NOT VERIFIED | 직접 접근 차단 |
| 삭제·수정·허용 범위 밖 요청 | NOT VERIFIED | 거부 및 기록 |
| 합성 DICOM 등록·재조회 | NOT VERIFIED | UID·원시 해시 일치 |
| 중복·동일 UID 충돌 | NOT VERIFIED | 덮어쓰기 없음, 충돌 거부 |
| 서비스 재시작·수동 잠금/복구 | NOT VERIFIED | 데이터 일치 및 안전 기동 |
| 재부팅·Vault 장애·별도 복원 | NOT VERIFIED | 자동 평문 fallback 없음, 복구 증명 |
| 여유 공간 부족 | NOT VERIFIED | 명확한 실패, 성공 오표시·기존 영상 자동 삭제 없음 |
| 키 작업 및 PACS 행위 감사 | NOT VERIFIED | 비밀 미포함, 추적 가능 |
| 기존 Portal·A·Control 회귀 | NOT VERIFIED | 기존 기능·배포 기준선 보존 |

## 실패·복구 원칙

후보 서비스만 정지하고 보존한 이전 설정·이미지로 복구한다. 원본 데이터·볼륨·키·기존 컨테이너는 삭제하지 않는다. down -v, 호스트 디스크 포맷, 강제 unmount는 금지한다. 등록 후 검증 실패는 성공으로 반환하지 않으며 이미 저장됐을 수 있는 파일을 보존하고 재조정한다. 저장소 기동 실패·감사 실패·이미지 기준선 변경은 다음 단계 진행을 차단한다.

## 완료 산출물과 다음 단계

산출물: 실제 상태 inventory, 고정 이미지/스캔 증적, 비밀 없는 실행 구성, 인증서 검증 결과, 저장·거부·복구 시험 결과, 감사 증적, 운영자 기동/잠금/복구 Runbook, 롤백 기록.

위 관문을 통과해야 **B 수신 기반 준비 PASS**로 판정한다. 통과하지 않은 항목은 FAIL 또는 NOT VERIFIED로 명시한다. 웹 다운로드·전체 700장·환자 동의 종단·운영 의료기관 연동 완료로 승격하지 않는다.

다음 단계는 새 다운로드 허용 동의와 단기 토큰을 사용한 **A→B 합성 DICOM 1개 전송**이다. A Gateway는 A VM에 유지하며, 이 계획에서는 해당 VM이나 원본 저장소를 변경하지 않는다.

## A 송신 측 실행 관문

A가 영상 원본의 소유자이므로 B 수신 기반과 함께 별도 준비가 필요하다. 전송은 B 의료진의 요청으로 시작하되 A Data Plane이 Control 정책을 확인하고 승인된 SOP Instance만 읽어 B로 암호화 응답한다. PACS 자체에 인터넷 접근을 열거나 Control Plane에 DICOM 본문을 저장하는 방식은 사용하지 않는다.

| A 측 조건 | 확인·통과 기준 | 현재 상태 |
|---|---|---|
| A Gateway 경계 | 기존 A VM Gateway의 서버 인증서·서비스 신원·실행 이미지와 수신 포트를 읽기 전용 확인. PACS는 공개하지 않음 | 코드 후보 확인, 실제 VM 최신 상태 NOT VERIFIED |
| A PACS 연결 | A Gateway에서 A Orthanc mTLS 경계로만 연결; CA·SAN·EKU·인증서 유효기간 검증; PACS 조회 권한은 최소화 | 코드/Compose 후보 확인, 실서비스 인증서·경로 NOT VERIFIED |
| B 요청의 A 도달 경로 | B Gateway가 승인된 사설 VPN/전용 연결을 통해 A Gateway에만 연결. 방화벽은 고정된 B 송신 주체와 포트만 허용하고 PACS 포트는 차단 | 주소·라우팅·방화벽 최신 상태 NOT VERIFIED |
| 환자 정책 검증 | ACTIVE·유효기간 내 DOWNLOAD_ALLOWED 동의, 수신 병원·의료진 소속·목적·Study/Series/SOP 범위와 DPoP 결속 단기 토큰을 Control에서 검증 | 로컬 정책 회귀 PASS, 실제 병원 계정·동의 NOT VERIFIED |
| 단건 전송 보호 | 빈 POST만 허용, A는 승인된 Instance를 조회하고 AES-256-GCM 패키지로 응답. DEK는 Azure Key Vault RSA-OAEP-256 키 버전으로 감싸며 평문 fallback 금지 | 로컬 RSA/AES 테스트 double 통합 PASS, 실제 Vault 자격증명·호출 NOT VERIFIED |
| 철회·감사 | 키 wrap 전후와 B unwrap/import 시점에 현재 권한을 재검증. A 응답 준비와 B의 저장·재조회 성공/실패를 같은 consent/audit session으로 상관 가능하게 기록 | 로컬 정책·감사 회귀 PASS, 실제 Control DB와 A/B 원격 감사 NOT VERIFIED |

A/B 배포는 같은 Study·Series·SOP·패키지·수신 보고 계약을 사용하는 릴리스 후보로 맞춘다. 위 관문을 읽기 전용 점검으로 확인하고, B 저장소·PACS 게이트가 먼저 PASS하지 않으면 A의 `pacsImportEnabled`를 켜지 않는다. 기능 활성화는 해당 B 저장 경로에 대해서만 제한하며 VIEW_ONLY 동의나 일반 VIEW 토큰을 다운로드로 승격하지 않는다.

코드 검토에서 B Portal의 A Import 요청 제한시간 10초가 A 측 동의 확인·PACS 조회·키 패키지 생성의 제한시간 합보다 짧을 수 있음을 확인했다. 그래서 전용 Import HTTPS 전송만 최대 55초, 암호화 프로필의 A Gateway와 B Portal 응답 소켓은 60초로 맞췄다. 일반 Gateway 요청의 10초 transport 예산과 B Portal의 일반 경로는 그대로다. 전용 transport는 A Import origin, 빈 DPoP POST, CA, 응답 크기 상한에만 허용된다. 이는 로컬 코드 보완이며 원격 A VM의 설정·연결 확인은 아니다.

## 기존 의료진 버튼의 실제 동작

현재 로컬 후보의 의료진 버튼은 선택된 SOP Instance 한 건에 대해 새 `DOWNLOAD` DPoP 토큰을 요청한 뒤, 빈 본문으로 B의 `/dicomweb/.../import` 경로를 호출한다. 선택 UID·동의 범위·토큰 권한을 확인하고, B PACS의 재조회 영수증에서 Study/Series/SOP UID와 SHA-256이 확인될 때만 성공으로 표시한다. 응답이 불명확하면 자동 재시도하지 않는다. `public/app.js`에서 이 버튼은 기존 로컬 시뮬레이터 API `/api/transfers/pacs-import`를 더 이상 호출하지 않는다.

이는 **단건 UI/API 연결의 로컬 후보**이지 배포되거나 실제 A→B 전송이 검증된 상태는 아니다. B Portal은 정확히 허용된 Azure 의료진 Origin만 받도록 후보가 보완됐고, 이미지 ingress에는 선택 Instance의 import만 허용하는 Caddy 경로가 추가됐지만 모두 로컬 변경이며 Azure/A/B VM에 배포하지 않았다. import feature flag는 기본 비활성이다. 내구성 있는 다중 Instance 작업 원장·재개 조정자는 로컬 시험을 통과했으나 현재 버튼/실제 작업 API·B 측 worker에 연결되지 않았다. B 저장소·키 복구와 A/B 정책·키·감사 계약이 실환경에서 검증되기 전에는 이 후보를 운영 전송으로 표시하지 않는다.

## 2026-10-14 실행 현황

계획 수립 뒤 로컬 검증을 수행했다. 실제 B VM 접속 점검은 concealed password 입력이 필요한 상태로 보류 중이며, 현재 원격 상태를 PASS로 추정하지 않는다.

| 확인 항목 | 결과 | 증적·범위 |
|---|---|---|
| B PACS 관련 소스의 후보 회귀 | PASS 104/104 | 최신 재검증 `artifacts/workstation/b-pacs-candidate-2026-10-13T16-42-36-975Z/result.json`; 현재 dirty worktree의 실행 결과, B VM 배포 검증 아님 |
| 샘플 원본 파일 고정 해시 | PASS 700/700 | 동일 결과; 2,202,766,342 bytes, 로컬 후보 데이터셋이며 live A PACS 재조회 아님 |
| 단일 합성 DICOM B Portal→A Gateway→B 수신 경로 통합 회귀 | PASS 1 instance | `node --test test/b-pacs-a-to-b-flow.test.js`; 실제 B Portal import handler·Gateway handler·동의/DPoP 정책·암호화 패키지·복호화·수신 검증·감사 연결. B→A HTTPS+DPoP transport, A→Orthanc mTLS 응답, Key Vault RSA, Control durable repository, B PACS/storage는 test double이며 실서비스 종단 증거 아님 |
| A→B·B Portal·수신·암호화 관련 회귀 | PASS 56/56 | `node --test test/capstone-b-portal.test.js test/data-plane-gateway.test.js test/b-pacs-a-to-b-flow.test.js test/capstone-encrypted-transfer.test.js test/b-pacs-authority.test.js test/b-pacs-receiver.test.js`; 정책 거부·철회·만료·중복, 전용 55초 Import transport 범위, A 전송 중단·B 저장 실패 및 평문 정리 포함 |
| 로컬 Orthanc 등록·재조회·중복 보존 | PASS 1 instance | `artifacts/workstation/hp-b-pacs-local-smoke-cbbcc2a6/result.json`; 루프백·임시 컨테이너·tmpfs, 인증/감사 test double 사용. 원시 DICOM 해시·UID 확인 및 중복 보존, 지속/암호화 저장소는 아님 |
| 수신 Compose 렌더링 및 네트워크·볼륨 경계 | PASS | Docker Compose config JSON: 서비스 2개, 외부 포트 없음, 두 네트워크 internal, Orthanc 전용 PACS망, 마운트 자동 생성 금지, 자동 재시작 없음. 임시 digest/path를 사용한 정적 검사이며 배포 아님 |
| B 저장 경계·수동 기동 가드·복구 안전 회귀 | PASS 31/31 | `python -m unittest test.b_pacs_maintenance_safety_test test.b_pacs_storage_runtime_test test.b_pacs_storage_provision_test test.b_pacs_recovery_network_test test.b_pacs_purge_protection_test test.b_pacs_vault_restore_safety_test`; offline 계약 시험이며 실제 B VM 관측은 아님 |
| UUID 고정 저장 경계·Compose 기동 게이트 회귀 | PASS 8/8 | 위 Python 시험 중 storage maintenance/runtime 테스트; 저장 manifest UUID 불일치, 비내부망, 게시 포트, writable boundary bind 등을 거부. Docker/VM 기동 없음 |
| B 수신 Compose 실제 렌더링+기동 게이트 | PASS | Docker Compose v5.5.1, 임시 digest/경로/합성 UUID로 렌더링 후 `validate_compose_config` 통과. 두 서비스·두 internal network, 미게시 포트, Orthanc writable/Boundary readonly 동일 암호화 경로, UUID 전달. VM 배포 아님 |
| 최소 B mTLS receiver image candidate | PASS, workstation only | `Dockerfile.b-pacs-receiver`; pinned Distroless Node base, boundary + mTLS listener만 복사, UID/GID 65532. Build digest `sha256:9240121590bf034c916e4d1d9196aa87d240631518e312398b230a82263f69e4`; 214,340,520 bytes. Registry push·B VM load/deploy 아님 |
| receiver image runtime syntax/sandbox check | PASS | Candidate image에서 Node 구문 검사, network none·readonly rootfs·capability drop·UID 65532 |
| receiver image Trivy + vulnerability policy | PASS | `artifacts/security/b-pacs-receiver-20261014.json`; pinned Trivy 0.58.2, Critical 0 / High 0, vulnerability policy gate PASS. 후보 이미지 digest만 스캔 |
| mTLS 요청별 저장소 검증의 manifest UUID 일치 | PASS 9/9 | `node --test test/b-pacs-storage-boundary.test.js`; 정확한 LUKS2 UUID만 허용, 다른 암호화 볼륨·UUID 누락/오류 거부. actual B container에는 미배포 |
| B PACS authority/portal/receiver/storage 및 합성 단건 회귀 | PASS 43/43 | `node --test test/b-pacs-authority.test.js test/b-pacs-portal.test.js test/b-pacs-receiver.test.js test/b-pacs-storage-boundary.test.js test/b-pacs-a-to-b-flow.test.js`; 로컬/test double 범위 |
| A 송신 Gateway의 Import 본문·암호화 계약 | PASS 7/7 | `node --test test/data-plane-gateway.test.js`; 본문 있는 POST는 PACS 접근 전에 거부, 빈 POST는 선택 WADO 인스턴스 조회 후 암호화. Key Vault/PACS 원격 종단은 아님 |
| B VM 암호 입력 UI 변경 구문 확인 | PASS | `python -m py_compile scripts/b-pacs-storage-preflight.py`; `--gui`는 기존 로컬 마스킹 입력기를 재사용 |
| B VM 최신 암호화 mount·PACS 현황 | NOT VERIFIED | `scripts/b-pacs-storage-preflight.py` 실행은 B VM 비밀번호를 요구함; 원격 관측 미실행 |
| B Orthanc 실제 컨테이너 암호화 mount 런타임 검증기 회귀 | PASS 39/39 (offline) | `python -m unittest discover -s test -p 'b_pacs_*_test.py'`; live `b-orthanc`의 Compose identity, digest 참조와 실행 image ID 일치, health, nonroot UID, read-only rootfs, 미게시 포트, config/data bind mount 및 암호화 호스트 경로 검증 후보. 잘못된 이미지·mount·권한·포트·상태는 fail closed. 실제 B 컨테이너 관측은 NOT VERIFIED |
| B VM PACS 배포·인증서·실제 mTLS | NOT VERIFIED | 이 실행에서 원격 구성이나 서비스를 변경하지 않음 |
| B 재부팅 복구·별도 볼륨 복원 | NOT VERIFIED | 앞선 10월 13일 증적도 이 항목을 다루지 않음 |

이번 실행에서 B VM의 저장소·서비스, Azure 설정, 기존 앱 컨테이너는 변경하지 않았고 유료 Azure 자원도 만들지 않았다. workstation에는 비루트 B receiver 후보 image와 Trivy cache volume을 만들고 스캔했다. 마스킹 암호 입력이 없어 원격 증적은 새로 생성하지 않았다. A Data Plane Gateway는 Import 본문이 비어 있는지 확인하고, 콘텐츠가 있거나 Transfer-Encoding이 지정되면 A PACS·Control 호출 전에 거부하도록 보강했다. 이번 통합 테스트는 B Portal이 HTTPS+DPoP 요청으로 A Gateway에서 선택된 합성 DICOM 1개를 암호문 응답으로 받고, B 복호화·UID/바이트 수/원시 SHA-256 검증·수신 PACS adapter 등록·Control 감사까지 이어지는 로컬 회귀를 검증한다. TLS, Orthanc, Control, Key Vault는 test double이며, 10월 8일의 실제 A 증거도 Orthanc mTLS QIDO와 무인증 거부까지만 포함한다. 현재 승인된 import/key-wrap 왕복, 현재 A/B VM·B VM LUKS 저장소·실제 Orthanc 종단은 증명하지 않는다. 다음 동작은 B VM의 현재 상태를 읽기 전용으로 수집하는 것이다. 암호는 채팅에 붙여넣지 말고 로컬 마스킹 입력 창에서 입력한다. 사전점검을 통과한 뒤에만 저장 경계 probe, 복구 관문, PACS 배포를 순서대로 진행한다.

추가 실행 요약(최신): B Portal 포함 합성 단건 통합 회귀 1/1, A/B Gateway·암호화·수신 회귀 81/81, B storage/receiver offline safety 39/39 PASS. launch gate는 mTLS 인증서·키·CA의 정확한 read-only bind와 root:65532 소유권·0750 디렉터리·0440 파일 권한까지 검증한다. B mTLS receiver image Trivy/policy PASS (Critical 0, High 0). 새 Orthanc 후보는 정책 게이트 PASS (scanner Critical 1, High 0; 기술적 non-runtime reconciliation 적용, confirmed runtime Critical 0). UID 10001로 격리 Orthanc에 합성 단건 등록·UID/원시 해시 재조회·중복 보존 PASS. 전부 workstation 범위이며 실제 A→B TLS/DPoP, Key Vault 왕복, B VM 영구 암호화 저장, 실제 B PACS 등록은 NOT VERIFIED다.

## B Orthanc 저장·실행 경계 보강 (2026-10-14)

현재 root-only encrypted mount를 Orthanc에 그대로 넘기면 upstream Orthanc의 기본 root 실행에 의존하고, container가 root filesystem에 쓸 수 있다. 그래서 encrypted filesystem 아래 전용 `/opt/highpass/b-pacs-encrypted/orthanc-db`만 Orthanc UID/GID `10001:10001`, mode `0700`으로 준비한다. storage create/recovery 경로는 verified LUKS mount 뒤에서만 디렉터리를 만들며, 기존 경로가 symlink·다른 filesystem·다른 owner/group·넓은 mode이면 수정하지 않고 fail closed 한다. Runtime check와 launch gate 모두 실제 `st_dev`, UID/GID, mode를 확인한다.

B 전용 Orthanc 설정을 `infra/workstation/orthanc/hospital-b-receiver.json`에 추가했다. 서비스 이름은 합성 전용 표기를 사용하고 DICOM TCP listener와 filesystem export를 끈다. 8GiB LUKS volume에 6144MiB 저장 상한과 `MaximumStorageMode: Reject`를 적용해 volume을 전부 채우거나 오래된 영상이 자동 삭제되는 일을 막는다. REST API의 HTTP 인증은 끄지만, Orthanc는 `b_pacs_private` internal network에만 연결되고 published port가 없으며, 외부 B 요청은 mTLS/DPoP 및 정책 검증을 하는 전용 boundary service만 받는다. 기본 예시 config로 실행했을 때 `/system`이 401이어서 compose healthcheck와 불일치했으며, B 전용 설정에서는 200이다. Orthanc 로그는 unauthenticated remote access를 POSSIBLY INSECURE로 경고하므로 internal network 구성과 no-published-port 검증은 배포 불변조건이다. Host/Docker 관리자 및 네트워크 설정 오류는 여전히 신뢰 경계 위험이다.

새 Orthanc candidate image (`newproject-orthanc-secured:b-pacs-candidate-20261014`) digest는 `sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368`이다. 기존 `newproject-orthanc-secured:latest` (`sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a`)는 그대로 뒀다. Debian security 저장소에서 PCRE2 수정 버전 `10.42-1+deb12u2`를 적용했다; Debian advisory/tracker는 [DLA-4816-1](https://lists.debian.org/debian-lts-announce/2026/10/msg00008.html) 및 [CVE tracker](https://security-tracker.debian.org/tracker/CVE-2026-103111) 참조.

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| Orthanc candidate Trivy 0.58.2 scan | PASS | `artifacts/security/b-pacs-orthanc-candidate-20261014.json`; Critical 1 (`zlib1g`, existing technical non-runtime reconciliation), High 0 |
| Vulnerability policy gate | PASS | `confirmedRuntimeCritical=0`, unapproved/expired High 0; no new exception added |
| Nonroot/read-only Orthanc start | PASS | candidate image + B config; UID 10001, read-only rootfs, all capabilities dropped, no-new-privileges, no network / published ports |
| DICOMweb plugin + internal readiness | PASS | Orthanc 1.12.11, DICOMweb 1.23 loads; DICOM listener disabled; `/system` returned HTTP 200 |
| Candidate PACS write/re-read | PASS 1 synthetic instance | `artifacts/workstation/hp-b-pacs-local-smoke-49f48d71/result.json`; UID + raw SHA-256 match, duplicate preserved; tmpfs, test-double consent/audit, localhost-only published port, cleanup confirmed |
| B VM persistent encrypted mount/config/certificates | NOT VERIFIED | no remote credential entry or deployment in this run; image/config remain workstation candidates |

This candidate verification does not change the B VM, existing running containers, Azure resources, or import feature flags. The candidate's internal Orthanc API intentionally has no Basic Auth because its only Docker peer is the authenticated mTLS boundary; never attach a Portal or host-published port directly to `b_pacs_private`.

## 재시작 가능한 전송 원장 구현 현황

### 최신 후속 구현 결과 (2026-10-14)

아래의 기존 서술과 표는 이번 후속 변경 전 상태를 보존한 기록이다. 현재 구현·검증 상태는 다음과 같다.

| 확인 항목 | 결과 | 근거·범위 |
|---|---|---|
| 다중 SOP 작업 UI, 서버 주도 복구, active 작업 API, A/B lease 상관관계 및 암호화 경로 | PASS 76/76 | 전송 job·UI·Control handler·DPoP·Portal·암호화 test double 집중 회귀. 환자·의료진 브라우저 저장소에 job ID나 UID를 저장하지 않음 |
| PostgreSQL 17 migration·active job actor/hospital 격리·claim·lease·재시작·영수증 | PASS 1/1 | 새 일회성 loopback 컨테이너에서 migration 적용 후 실제 DB 통합. 테스트 종료 후 컨테이너와 임시 볼륨 제거 |
| 전체 테스트 트리 | FAIL | `node --test --test-concurrency=4 'test/**/*.test.js'`: PASS 1429, FAIL 10, SKIP 1. 실패는 consent-operations 2, mobile-capstone-auth 1, patient-context-display 1, patient-wallet-dock 1, share-reception 3, viewer-request-budget 2이며 전송 경로 집중 테스트와 별개 |
| 비밀정보 스캔 | FAIL (false positive) | `docs/operations/patient-task-ui-2026-10-13.md` 경로 문자열의 `highpass-task-ui`를 key 패턴으로 탐지. 해당 줄은 파일 경로이며 key 값은 없음; 문서 내용은 변경하지 않음 |
| 실제 Azure·A/B VM·Orthanc mTLS·Key Vault·영구 암호화 저장 검증 | NOT VERIFIED | 원격 변경·배포 없음, 관련 기능 flag 기본 비활성 |

브라우저 새로고침 후 작업 복구는 `GET /api/pacs-transfer-jobs/active`에서 인증 의료진·수신 병원 기준으로 남은 항목이 있는 작업을 찾는다. 목록 응답에는 UID와 consent ID를 포함하지 않고 상태·진행 수치만 반환하며 조회를 감사 기록한다. 재개 동작은 새 lease를 claim하고 현재 동의 및 DOWNLOAD 정책을 다시 검증한다. B Portal은 job/item/lease 상관관계를 B측 Control 완료 보고에만 전달하고, A Gateway에는 authorization/DPoP만 전달한다. 불확실한 Import 응답을 자동 재전송하지 않는다. PostgreSQL `Date` 만료시각의 밀리초 비교 및 완료 receipt의 DICOM UID 검증 결함도 실제 DB 실행에서 발견 후 수정했다.

수신 후보는 HCC 합성 CT manifest의 단일 Instance 검증으로 제한된다. 임의의 환자 MRI/CT Study 전송이나 실제 A→B 운영 연결을 검증했다고 보지 않는다. 이 변경은 FR-001~005, FR-014~025, FR-026~031, FR-037~041 및 V2 `VR-TRANSFER-001~004`, V3 `V3-FR-PKG-006`, `V3-FR-ACC-007`에 연결된다.

2026-10-14에 작업 4단계의 기반 구성요소를 로컬에 추가했다. `db/migrations/039_capstone_pacs_transfer_jobs.sql`은 작업과 SOP별 상태·시도 횟수·해시·UID·제한된 lease 메타데이터만 저장하며 DICOM 바이트, access token, DPoP proof, DEK, PACS 자격증명을 보관하지 않는다. `src/pacs-transfer-jobs.js`는 PostgreSQL 저장소와 객체 단위 조정자를 제공한다. 제한된 `runBatch`는 일정 개수만 순차 처리하고 영속 항목상태에서 진행률을 반환하며, 중단 신호가 오면 현재 SOP를 마친 뒤 다음 SOP를 claim하지 않는다. 재개할 때마다 정책 adapter를 호출하고, 반환된 권한 범위의 사용자·양 병원·동의·목적·권한·Study/Series/SOP UID·만료시각이 작업 항목과 정확히 일치하는지 확인한다. 문맥 누락·불일치나 정책 거부 시 fail closed하고 남은 객체 처리를 중단한다. 재시도는 영속 attempt count로 제한하며, PACS의 `PACS_INSTANCE_VERIFIED` 영수증이 작업 항목의 Study·Series·SOP UID와 원본 SHA-256 모두에 일치하지 않으면 성공으로 집계하지 않는다.

추가 정합성 보강: 런타임과 SQL 모두 DICOM UID에 최소 두 개의 숫자 구성요소를 요구하고, 병원 ID 최대 길이를 `varchar(64)`와 맞췄다. migration은 일회성 로컬 테스트 DB에서만 검증했으며 운영 DB에는 적용하지 않았다.

| 확인 항목 | 결과 | 증적·범위 |
|---|---|---|
| 전송 작업 저장소·정책 오케스트레이터 단위시험 | PASS 15/15 | 최신 `node --test test/pacs-transfer-jobs.test.js`; 제한된 진행률·중단/재개, 재개 권한 재검증, 동시 worker lease 대기, 권한 범위·UID·해시 영수증 거부, caller-provided source hash 완전 거부 및 PACS 영수증에 의한 hash 확정 포함 |
| 초기 격리 PostgreSQL 16 전송 작업 통합시험 | HISTORICAL PASS 1/1 | 2026-10-14의 이전 실행 기록. 이번 turn의 최신 결과와 상세는 아래 PostgreSQL batch 행을 기준으로 한다. |
| PostgreSQL DDL·멱등성·동시 claim·재시도·거부 중단·영수증 검증 | PASS 9/9 | 일회성 PostgreSQL 17 컨테이너와 합성 데이터. migration 적용, 동일 Idempotency 재호출, 충돌 거부, 병렬 claim 1개 제한, per-SOP 결과·재개 attempt 수, 범위거부 후 전체 중단, 정확한 PACS 영수증 검사 |
| PostgreSQL 영속 batch 진행률·새 coordinator 재개·PACS 영수증 검증 | PASS 1/1 | 2026-10-14 재실행: 실제 PostgreSQL 16, 무작위 loopback 포트, tmpfs-only 일회성 컨테이너. migration·멱등성·동시 claim·lease 복구, 2/3 SOP 진행 후 새 coordinator로 재개, 각 SOP 재인가 및 UID/SHA-256 영수증 통과. 첫 실행에서 `finishItem` 상태 파라미터의 PostgreSQL text/varchar 타입 충돌을 발견해 명시적 cast를 적용한 뒤 재실행 통과. 컨테이너 제거 |
| Control 전송 작업 POST/GET handler 권한·동의·입력 검증 | PASS 7/7 | `node --test test/pacs-transfer-job-http.test.js`; actor/hospital/purpose/permission/validUntil 서버 결정, 동의 재검증, 원본 해시 입력 거부, idempotency replay 감사세션 유지, 상태 조회 actor/hospital 격리, 정책 fanout 상한 |
| 전송 작업 런타임 역할·기능 flag 게이트 | PASS 5/5 | `node --test test/pacs-transfer-job-runtime.test.js`; 기본 비활성, Control Plane+PostgreSQL+전용 DB URL, superuser/BYPASSRLS/DDL 불가, migration 존재, SELECT/INSERT/UPDATE만 허용 |
| 전용 DB 역할의 실제 PostgreSQL 런타임 연결 | PASS | 일회성 PostgreSQL 16 + tmpfs에서 별도 비소유 login 역할을 만들고 두 전송 테이블에 SELECT/INSERT/UPDATE만 grant한 뒤 런타임 startup 검증 통과. 컨테이너·역할·DB 삭제, 운영 DB 변경 없음 |
| A Gateway/B Portal·암호화·수신·작업원장 회귀 | PASS 71/71 | `node --test test/data-plane-gateway.test.js test/capstone-encrypted-transfer.test.js test/b-pacs-a-to-b-flow.test.js test/capstone-b-portal.test.js test/b-pacs-receiver.test.js test/b-pacs-authority.test.js test/pacs-transfer-jobs.test.js`; 현재 로컬 변경 범위, 원격 TLS/Orthanc/Control/Key Vault/PACS 아님 |
| 단건 의료진 Import UI·Origin/경로 제한 후보 회귀 | PASS 57/57 | `test/b-pacs-portal.test.js`, `test/import-preflight.test.js`, `test/import-workbench.test.js`, `test/pacs-import-browser-routing.test.js`, A/B Gateway·Portal 관련 시험. 로컬 test double만 사용 |
| A Gateway→B 수신 합성 DICOM 단건·장애복구 통합 | PASS 1/1 | `test/b-pacs-a-to-b-flow.test.js`: 저장 후 완료 감사 중단은 503/미완료, 재요청은 UID·해시 재검증으로 중복 쓰기 없이 복구, 철회·만료 뒤 A 전송 거부. Orthanc·Key Vault·Control·B PACS는 test double |
| B 수신·A/B 전송·작업원장 회귀 묶음 | NOT RE-RUN AS A FULL SUITE | 위의 71/71은 이번에 실행한 7개 핵심 파일만 포함한다. 이전 88/SKIP 결과는 과거 기록이며 이번 변경 전체의 회귀 근거로 재사용하지 않음 |
| 단건 버튼 및 B ingress Azure 배포 | NOT VERIFIED | 코드 변경은 로컬 후보에만 반영. Azure/A/B VM 미배포, import feature flag 비활성 |
| 다중 Instance 작업 API·환자 동의 흐름·B worker 연결 | PARTIAL | Control의 job 생성/상태 조회 handler와 별도 DB role 런타임 게이트를 구현·단위검증했다. 기존 ACTIVE DOWNLOAD_ALLOWED 동의를 서버가 확인하지만 환자 동의 UI와 연결되지 않았고, B claim/transfer worker·진행률 UI·새로고침 후 재개 UI는 미구현 |
| 원장 migration의 운영 DB 적용 및 최소 권한 grant | NOT VERIFIED | 일회성 로컬 테스트 DB에서만 적용. migration은 PUBLIC 권한을 revoke하며 애플리케이션 계정에 grant하지 않음. 운영 migration bundle·role 검토·배포 없음 |
| A VM Gateway 사설 TLS·정책 연결·Orthanc mTLS·합성 QIDO | HISTORICAL PASS / CURRENT NOT VERIFIED | `artifacts/workstation/a-gateway-2026-10-08T15-26-36.323026+00-00/result.json`: 당시 Control TLS, 최소권한 정책 호출, A Orthanc mTLS QIDO 3개 합성 Study, B의 무인증 거부, 이미지 digest PASS. 10/08 스냅샷이므로 현재 VM 상태 증명은 아님 |
| B Portal→A Gateway의 승인된 암호화 영상 Import 및 실제 Key Vault wrap | NOT VERIFIED | 코드상 HTTPS+DPoP 요청, A에서 Orthanc mTLS 조회 후 Key Vault RSA-OAEP-256 wrapping/AES-GCM package 응답 구조. 현재 로컬 종단 회귀는 TLS·Key Vault·PACS test double 사용; 과거 QIDO/ledger 증거는 이 경로를 증명하지 않음 |
| B VM 암호화 영구저장·수신 PACS·키 복구 | NOT VERIFIED | 로컬 handler/test double 증적을 실제 B VM·Key Vault·지속 암호화 저장소 증적으로 간주하지 않음 |

연결 요구사항은 V2 `VR-TRANSFER-001~004`, V3 `V3-FR-PKG-006`, `V3-FR-ACC-007`, 동의·정책 `FR-001~005`, `FR-014~025`, Gateway `FR-026~031`, 감사 `FR-037~041`이다. 현재 단건 경로는 **B Portal→A Gateway HTTPS+DPoP**, A Gateway→Control Plane TLS, A Gateway→A Orthanc mTLS, A Gateway→Azure Key Vault TLS/RSA-OAEP-256 wrapping이며, B PACS 수신 adapter는 B Portal 내부에서 B mTLS service로 연결한다. 작업 원장 `job_id`는 transfer ID 역할을 하고 `audit_session_id`를 보존한다. job 생성은 활성 다운로드 동의에서 Study/Series 정책을 확인하며, source hash는 클라이언트 입력을 거부하고 검증된 B PACS 영수증을 받은 뒤에만 확정한다. Control의 job 생성/상태 조회 API는 기본 비활성 기능 flag와 별도 최소권한 DB role 게이트 뒤에 연결했지만, 아직 B worker가 claim하고 영상 전송 결과를 인증해 보고하는 API·실행 루프, 의료진 진행률/재개 UI는 없다. 다음 구현 관문은 B 전용 worker service identity와 claim/report 계약, worker 키에 결속된 짧은 다운로드 토큰, B PACS의 인증된 완료 영수증을 작업 원장에 반영하는 것이다. 현재 코드는 chunk offset resume이나 실제 전송을 증명하지 않는다. 기존 Azure/VM/운영 DB는 변경하지 않았고 유료 자원도 만들지 않았다.

## 2026-10-14 후속 재검증

아래는 위의 과거 상태 요약 이후 현재 워크트리에서 다시 실행한 범위다. 역사 기록의 상태와 충돌하는 항목은 이 표의 더 최근 증거를 기준으로 읽되, 실제 VM·Azure 완료로 확대 해석하지 않는다.

| 확인 항목 | 결과 | 최신 근거·범위 |
|---|---|---|
| A Gateway·암호화·B Portal·B receiver·전송 작업 회귀 | PASS 76/76 | `node --test --test-concurrency=4 test/data-plane-gateway.test.js test/capstone-encrypted-transfer.test.js test/b-pacs-a-to-b-flow.test.js test/capstone-b-portal.test.js test/b-pacs-receiver.test.js test/b-pacs-authority.test.js test/pacs-transfer-jobs.test.js`; live TLS, Orthanc, Control, Key Vault, B PACS는 test double |
| 환자 DOWNLOAD 동의부터 의료진 PACS Import·작업 재개 UI/API | PASS 61, SKIP 1 | `node --test --test-concurrency=4 test/patient-sharing.test.js test/patient-share-review.test.js test/import-preflight.test.js test/import-workbench.test.js test/pacs-import-browser-routing.test.js test/pacs-transfer-job-http.test.js test/pacs-transfer-job-runtime.test.js test/pacs-transfer-jobs.test.js test/pacs-transfer-jobs.postgres.test.js`; 동의 확인, DPoP, 서버 권한 파생, 다중 항목 작업, 새로고침 복구, 불명확 응답 자동 재전송 금지. PostgreSQL 통합시험은 이번 실행에서 전용 loopback 테스트 DB URL이 없어 skip |
| B PACS source candidate 회귀 | PASS 117/117 | `artifacts/workstation/b-pacs-candidate-2026-10-13T19-59-52-686Z/result.json`; 700개 로컬 합성 DICOM 원시 파일 SHA-256도 PASS, 2,202,766,342 bytes. live A PACS 조회는 아님 |
| 격리 Orthanc 단건 저장·재조회 | PASS 1 instance | `artifacts/workstation/hp-b-pacs-local-smoke-e2c3fb3a/result.json`; tmpfs 전용 임시 컨테이너에서 Study/Series/SOP UID와 원시 SHA-256 확인, 동일 UID 중복은 기존 데이터를 변경하지 않음. 컨테이너 제거 확인 |
| B 저장 프로비저닝·실행 경계·복구 가드 회귀 | PASS 39/39 | `python -m unittest test.b_pacs_maintenance_safety_test test.b_pacs_storage_runtime_test test.b_pacs_storage_provision_test test.b_pacs_recovery_network_test test.b_pacs_purge_protection_test test.b_pacs_vault_restore_safety_test`; 오프라인 안전 계약만 검증, VM·Azure 자원 변경 없음 |
| B VM의 8 GiB LUKS2 저장소 생성 | HISTORICAL PASS / CURRENT NOT VERIFIED | `artifacts/workstation/b-storage-provision-20261013T013045Z/result.json`: 원격 `KEY_PROTECTION_AND_STORAGE_CREATE` 단계 PASS, 전체 실행은 임시 RBAC 회수 응답 2건 FAIL로 NOT VERIFIED. 이후 복구 실행에서 기존 저장소·마운트가 확인됨 |
| B VM 수동 키 언랩·LUKS 복구 | HISTORICAL PASS / CURRENT NOT VERIFIED | `artifacts/workstation/b-storage-provision-20261013T013712Z/result.json`: recovery PASS, 기존 컨테이너 목록 불변, 자동 부팅 해제 없음. 재부팅 후 최신 마운트 상태 및 별도 vault 복원은 미검증 |
| Azure Key Vault 관리 설정 | PASS, live read-only | 2026-10-14 현재 PublicNetworkAccess Disabled, RBAC·soft-delete·purge protection 활성, 보존기간 7일 |
| 임시 B 저장 키 운영자 RBAC 할당 | PASS, live read-only | 정확한 운영자 principal의 Vault/전용 B storage key scope 할당 0건. 과거 회수 실패 항목은 현재 잔존하지 않음 |
| B 저장 키의 현재 버전·데이터 평면 조회 | NOT VERIFIED | 워크스테이션 key-version 조회는 `ForbiddenByConnection`으로 거부됨. Vault private-link 경계와 PublicNetworkAccess를 우회하지 않았으며, B VM 내부 확인 필요 |
| B VM의 현재 LUKS 마운트·수신 PACS 서비스 | NOT VERIFIED | 과거 생성·수동 복구 결과는 현재 상태 증명이 아님. B 수신 Orthanc/mTLS 서비스는 배포되지 않은 것으로 최신 저장 작업 증적에 기록됨. 읽기 전용 최신 사전점검은 숨김 입력 UI가 노출되지 않아 SSH 연결 전 취소 |
| A VM의 현재 Import 배포·Key Vault wrap | NOT VERIFIED | A 송신 로컬 회귀는 통과했지만 현재 A VM 점검/배포는 하지 않음. 기존 배포 절차는 이미지·인증서·비밀 파일·컨테이너를 변경하므로 B 저장/수신 게이트 PASS 전에 실행하지 않음 |
| A 송신 측 읽기 전용 사전점검기 | PASS, local tests only | `scripts/capstone-a-sender-preflight.py`와 `test/capstone_a_sender_preflight_test.py`; A/B VM 자격증명을 개별 숨김 입력하고 각 credential을 해당 host에만 전달하도록 개선. 두 번째 입력 취소 시 부분 자격증명을 반환하지 않음. VM 호스트 지문·Docker/WireGuard·A Gateway/PACS 경계·B→A TLS를 읽기 전용 확인할 뿐, 실제 VM 실행 및 Import·DICOM·Key Vault 호출은 미검증 |
| 유료 자원·기존 컨테이너 변경 | 변경 없음 | 검증은 기존 workstation 런타임을 건드리지 않는 단기 테스트 컨테이너만 사용했고 제거함. Azure 생성·배포 없음 |

다음 단계는 운영자가 자신의 로컬 PowerShell에서 순서대로 `python scripts/b-pacs-storage-preflight.py --gui`, `python scripts/b-pacs-storage-runtime-check.py --gui`, `python scripts/capstone-a-sender-preflight.py --gui`를 실행하는 것이다. 두 번째 도구는 pinned 과거 LUKS/recovery identity를 현재 mount·Orthanc container와 대조하고, 네트워크가 없는 disposable container로 경계를 probe한다. A 도구는 A/B VM credential을 서로 다른 마스킹 창에서 입력받는다. 암호를 채팅에 입력하지 않는다. 이 사전점검 결과만으로 실제 영상 전송이 검증되는 것은 아니다. B 저장·수신·복구 게이트 PASS 전에 디스크 포맷, Key Vault 키/RBAC 변경, PACS 배포나 Gateway rollout을 수행하지 않는다. 두 기반이 준비되면 승인된 합성 동의로 단건 전송을 진행하고, 실제 Key Vault wrap, A PACS mTLS 요청, B의 암호화 저장·재조회 및 감사 상관관계를 별도로 입증한다.

## A 송신 사전점검 도구의 경계

`python scripts/capstone-a-sender-preflight.py`는 실행 시 로컬에서 A/B VM 자격증명을 **각각** 숨김 입력받고, `--gui`를 사용하면 역할과 IP가 표시된 마스킹 창을 VM별로 연다. 각 credential은 해당 VM SSH와 sudo에만 사용한다. VMware에서 각 VM의 SSH 공개 호스트키를 확인한 뒤 지문 고정 SSH 연결을 사용한다. 원격 동작은 `docker inspect`, 서비스 상태 조회, 그리고 B VM에서 CA·IP SAN을 검증하는 TLS handshake뿐이다. HTTP 요청을 보내지 않으므로 의도적으로 Import endpoint, 동의/토큰, 감사, Key Vault 또는 DICOM 데이터를 건드리지 않는다. 로컬 증적에는 이미지 ID·컨테이너 상태·포트·네트워크·mount 경계와 판정만 기록하며 secret 파일 내용은 읽거나 출력하지 않는다.

이 도구 결과의 `PASS`는 **현재 A/B 호스트·컨테이너 기준선과 B→A TLS 경로만** 뜻한다. A Gateway 이미지가 새 Import 코드를 포함하는지, Control의 Import feature flag·정책 설정, 실제 A→Orthanc mTLS 요청, Key Vault wrap 및 환자 동의 전송은 계속 `NOT VERIFIED`다. A 변경을 수행하는 `scripts/capstone-a-gateway-ops.py`와 B 배포 스크립트는 이 사전점검의 대체가 아니며, 승인된 저장·수신 게이트 전에는 실행하지 않는다.

## A 송신 측 준비 항목과 현재 상태

현재 전송은 A가 B에 임의로 push하는 방식이 아니다. 환자 `DOWNLOAD_ALLOWED` 동의와 정책 검증 뒤 B 의료진이 작업을 시작하면, B Portal이 A Gateway의 제한된 HTTPS Import 경로를 호출한다. A Gateway는 요청 범위를 다시 검증하고 A Orthanc에서 허용된 Instance만 mTLS로 읽어 AES-256-GCM 전송 패키지로 응답한다. B 측은 패키지를 검증·복호화한 뒤 별도 B mTLS 수신 경계를 통해 암호화 PACS 저장소에 반입한다.

A 측에서 실제 활성화 전에 준비·입증할 항목:

1. **A Gateway 배포본:** Import 경로를 포함하는 승인된 이미지 digest, 정확한 B Portal 요청만 허용하는 경로·메서드·크기·시간 제한, 기본 OFF인 기능 flag 유지. B 저장소와 receiver 관문이 통과하기 전에는 flag를 켜지 않는다.
2. **원본 PACS 연결:** A Gateway 전용 최소권한 읽기 인증서와 신뢰 CA/SAN 검증, A Orthanc mTLS의 QIDO/WADO 범위 확인. PACS 관리·삭제 API와 외부 직접 접근은 열지 않는다.
3. **정책 재검증:** 요청마다 ACTIVE 동의, 수신 병원 B, 의료진 병원, 목적, 다운로드 권한, Study/Series/Instance 범위, 만료, DPoP 및 재생 방지를 서버 측에서 확인한다. 브라우저가 보낸 식별자나 원본 해시를 권한 근거로 신뢰하지 않는다.
4. **전송 키 처리:** A에서 Key Vault의 버전 고정 키를 사용해 패키지 키를 감싸고, AES-GCM 인증 태그·패키지 식별자·범위 결속을 검증한다. 원시 키와 평문 DICOM을 로그·디스크·Control DB에 남기지 않는다.
5. **사설 전송 경계:** B Portal에서 A Gateway로 가는 승인된 HTTPS 경로만 사용한다. 응답은 암호문이어야 하며 B PACS 저장은 B 내부의 별도 mTLS 수신 경계가 담당한다. A Orthanc나 PACS 포트를 인터넷에 공개하지 않는다.
6. **감사·장애 처리:** consent/job/audit session을 A·Control·B에서 상관시킨다. 정책 거부, Key Vault/PACS 장애, 전송 중단은 실패로 기록하고 성공으로 오표시하거나 평문 fallback·무검증 자동 재시도를 하지 않는다.

현재 코드는 A의 범위검증·Orthanc mTLS 조회·Key Vault 패키징을 로컬 test double로 검증한 상태다. 읽기 전용 A 사전점검은 A 컨테이너 경계와 B→A TLS만 확인하며, A Import 이미지·실제 A→Orthanc 요청·실제 Key Vault wrap·승인된 동의의 종단 전송은 검증하지 않는다. 따라서 A 측 준비는 **설계·로컬 후보 일부 완료, 실제 VM 배포 및 종단 증명은 NOT VERIFIED**이며, B 저장·수신 관문 이후 A Gateway를 별도 승인 절차로 점검해야 한다.

## 2026-10-14 PostgreSQL 영속 작업 원장 재검증

| 확인 항목 | 결과 | 증적·범위 |
|---|---|---|
| 작업 migration·멱등성·동시 claim·lease 만료 복구·재시도·batch 재개·영수증 | PASS 1/1 | `node --test test/pacs-transfer-jobs.postgres.test.js`; digest 고정 PostgreSQL 16, loopback 임시 포트, `/var/lib/postgresql/data` tmpfs의 일회성 DB. 2/3 SOP 완료 후 새 coordinator에서 재개하고 남은 SOP를 재인가, 전체 source/destination SHA-256 영수증 일치 확인 |
| 시험 DB 컨테이너·데이터 정리 | PASS | 오직 이번 시험에서 생성한 컨테이너를 중지·제거하고 ID 조회 결과 없음 확인. 기존 DB 컨테이너·볼륨은 변경하지 않음 |

이 결과는 다중 영상 작업 원장의 PostgreSQL 동작을 검증하지만, 운영 Control DB migration 배포나 B PACS 실제 수신·A→B 실영상 전송을 의미하지 않는다.

## 2026-10-14 B PACS mTLS 인증서 프로파일

receiver의 실제 TLS 계약에 맞춰 B receiver 서버 인증서(`DNS:b-pacs-mtls`, `serverAuth`)와 B Portal 전용 client 인증서(`URI:spiffe://highpass.local/hospital-b/pacs-receiver`, `clientAuth`)의 OpenSSL 확장 프로파일을 `config/b-pacs-mtls-server.ext` 및 `config/b-pacs-mtls-client.ext`로 고정했다. `node --test test/b-pacs-cert-profiles.test.js`는 일회성 임시 CA로 정상 목적·SAN 검증과 교차 목적·잘못된 hostname 거부를 확인한다. 해당 시험용 CA와 개인키는 임시 디렉터리에서 생성 후 삭제되며 실제 개발 CA는 사용하지 않는다.

프로파일 회귀는 PASS지만 B VM leaf key/CSR 생성, 실제 CA 서명, 인증서 설치·권한, live mTLS handshake는 아직 NOT VERIFIED다. 실제 준비 시 개인키는 B VM에서 생성해 외부로 반출하지 않고 CSR만 승인된 signer에 전달하며, CA 개인키는 B VM에 복사하지 않는다. 인증서가 준비되고 B 암호화 저장소 관문을 통과하기 전에는 receiver를 기동하지 않는다.

## 2026-10-14 최신 전송 후보 회귀

| 확인 항목 | 결과 | 증적·범위 |
|---|---|---|
| 환자 동의·A Gateway 암호화·B 수신·장애 복구·작업 원장·의료진 UI·B mTLS 인증서 프로파일 | PASS 107/107 | `node --test test/b-pacs-cert-profiles.test.js test/capstone-b-portal.test.js test/data-plane-gateway.test.js test/b-pacs-a-to-b-flow.test.js test/capstone-encrypted-transfer.test.js test/b-pacs-authority.test.js test/b-pacs-receiver.test.js test/pacs-transfer-job-http.test.js test/pacs-transfer-job-runtime.test.js test/pacs-transfer-jobs.test.js test/pacs-import-browser-routing.test.js test/patient-share-review.test.js test/import-workbench.test.js`; 단건 E2E는 로컬 test double, 인증서 시험은 임시 CA. 실제 A/B VM·Key Vault·PACS 증거 아님 |
| PostgreSQL 전송 원장 통합 | PASS 1/1 | 위의 `2026-10-14 PostgreSQL 영속 작업 원장 재검증`; 일회성 loopback/tmpfs PostgreSQL 16, 컨테이너 제거 확인 |
| B 저장소/A 송신 최신 live inventory | NOT VERIFIED | 새 `b-pacs-storage-*` 또는 `capstone-a-sender-preflight-*` 증적 없음 |

현 상태는 구현 후보와 로컬 검증까지다. 다운로드 허용 feature flag는 live 배포에서 활성화하지 않았고, B receiver 인증서는 발급·설치되지 않았으며, 실제 동의로 PACS에 영상을 반입했다고 표시할 수 없다.

## 2026-10-14 B mTLS listener 경계와 최신 검증

| 확인 항목 | 결과 | 증적·범위 |
|---|---|---|
| A/B 전송 후보 핵심 회귀 | PASS 107/107 | `node --test --test-concurrency=4 --test-reporter=dot` 및 전송·동의·암호화·Portal·작업원장 13개 파일; 로컬 테스트 더블과 임시 인증서 사용 |
| B PACS mTLS 실제 loopback HTTPS listener | PASS 1/1 | `node --test test/b-pacs-cert-profiles.test.js`; 정상 mTLS QIDO/Instance 요청, 잘못된 client SAN·인증서 누락·허용 외 경로·잘못된 QIDO 입력·저장소 gate 실패 거부 확인. 임시 CA로 loopback만 시험, VM/PACS 미접속 |
| B receiver 후보 이미지 | PASS, local candidate only | `highpass-b-pacs-receiver:mtls-candidate-20261014`, image ID `sha256:70bc089ef17cb84a2a9daa40fa5f9e3c7d801971b08499b5ee748f8109773a65`; 배포 또는 VM pull 하지 않음 |
| 후보 이미지 취약점 검사 | PASS, local scan | 고정 Trivy 0.58.2 스캔 `artifacts/security/b-pacs-mtls-candidate-20261014.json`; Critical 0, High 0. 이 결과는 이미지의 실제 VM 배포·구성 검증이 아님 |
| 전체 저장소 Node 테스트 자동 검색 | FAIL | 종료 코드 1. 과거 Azure 릴리스 snapshot의 누락된 소스 참조 및 현재 변경 범위 밖의 기존 UI/예산 테스트 실패가 포함됨. 위의 13개 전송 회귀 통과를 전체 저장소 통과로 확대하지 않음 |
| `pnpm test` 실행 경로 | NOT RUN | pnpm이 테스트 전 `node_modules` 재설치를 요구했으나 비대화형 실행에서 중단. 의존성 폴더를 교체하지 않도록 Node 테스트 러너를 직접 실행함 |

새 listener 시험은 TLS 정책을 실제 loopback 왕복으로 확인하지만 B VM leaf 인증서 설치, 현재 LUKS mount, Orthanc 연결, Key Vault, A→B 실제 동의 전송은 계속 `NOT VERIFIED`다. Azure 배포·feature flag 활성화·유료 자원 생성은 하지 않았다.

## 2026-10-14 B receiver 시작 거부 로그와 후보 재검증

| 확인 항목 | 결과 | 최신 증적·범위 |
|---|---|---|
| 시작 시 mount UUID·TLS secret 및 mTLS forwarding 경계 | PASS 2/2 test cases | `test/b-pacs-cert-profiles.test.js`; 설정 오류 fail-closed, 정상/잘못된 SAN·client cert·route, upstream interruption 502, 8 MiB 초과 413, 요청별 저장소 gate, 요청·응답 버퍼 zeroization을 검증 |
| 수정 후보의 무설정 기동 | PASS, expected denial | `docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges --pids-limit 16 --memory 64m --cpus 0.5 ...`; listener를 열지 않고 `PACS_ENCRYPTED_MOUNT_REQUIRED`만 출력 후 종료. 외부 네트워크·host mount·port publish 없음 |
| B receiver 후보 이미지 재빌드 | PASS, local candidate only | `highpass-b-pacs-receiver:mtls-candidate-20261014d`; image ID `sha256:eeba3f5d44b4830b91b9ed35dd19b5bf58d4b03b0332bcb22b4eff34a7443421`, 실행 UID/GID `65532:65532`. 로컬 `docker image inspect`와 일치; 이 시점에는 배포·VM pull 안 함 |
| 수정 후보 취약점 스캔 | PASS, local scan | `artifacts/security/b-pacs-mtls-candidate-20261014d.json`; 고정 Trivy `aquasec/trivy:0.58.2@sha256:665030f4d33a82c1e8d9d5e0453365842236723c1ee5cc3becca698268e66a56`; Critical 0, High 0 |
| 실제 격리 Orthanc까지 loopback mTLS 단건 반입·재조회 | PASS, local synthetic only | `artifacts/workstation/hp-b-pacs-local-smoke-356a322b/result.json`; 임시 CA/client cert와 tmpfs Orthanc, SOP UID 및 원시 SHA-256 일치, 중복 무변경, mTLS 응답 plaintext buffer 10개 zeroization, owned container 제거 확인. Storage gate·audit는 test double이며 B VM·live consent·Key Vault는 NOT VERIFIED |
| B VM 네트워크 및 읽기 전용 저장소 사전점검 | PARTIAL / 내부 상태 NOT VERIFIED | 현재 워크스테이션에서 `Test-NetConnection 192.168.111.149 -Port 22` PASS. 이번 로컬 `--gui` 실행은 3분 입력 대기 후 `B_CREDENTIAL_INPUT_CANCELLED`로 SSH 전 종료; 원격 조회·변경 및 결과 artifact 생성 없음. SSH 인증·host-key 대조·mount·LUKS UUID·서비스 상태는 여전히 미확인. 강화된 `b-pacs-storage-runtime-check.py --gui`도 실제 VM에서 미실행 |
| A Gateway/Orthanc 경계 읽기 전용 사전점검 | PARTIAL / 내부 상태 NOT VERIFIED | 현재 워크스테이션에서 `Test-NetConnection 192.168.111.129 -Port 22` PASS. 자격증명 분리 로직은 46개 로컬 Python 테스트 중 검증됐으나, SSH 인증·host-key 대조·컨테이너 경계·B→A TLS는 미확인. 실제 Import·PACS 요청·Key Vault 호출은 수행하지 않음 |
| 변경 후 회귀 | PASS 108/108 Node, 46/46 Python | A/B transfer 핵심 13개 Node test 파일 108/108. 이번 실행에서 B 저장 경계·복구/A 사전점검 Python 46/46; 로컬 단위시험이며 실제 VM·Azure·Key Vault·실제 A→B 동의 전송은 아님 |
| 환자 동의 UI·의료진 반입/재개 화면 | PASS 26/26 | `node --test test/patient-sharing.test.js test/patient-share-review.test.js test/import-workbench.test.js test/pacs-import-browser-routing.test.js`; 동의 범위·기간 확인, 환자 검토, DPoP, 버튼 경로, 작업 재개, 자동 재전송 금지, edge allowlist |
| PostgreSQL 영속 작업 원장 재실행 | PASS 1/1 | 합성 데이터 전용 PostgreSQL 16 컨테이너, DB 데이터 tmpfs, 무작위 loopback 포트. 멱등성·동시 claim·lease 만료 재개·batch 재개 시 항목별 재인가·UID/SHA-256 영수증 통과, 시험 컨테이너 제거 확인 |

이번 변경은 B 런타임 점검의 로컬 마스킹 입력 경로와 A/B별 자격증명 분리를 보강한다. receiver가 실제 B 저장소에 연결되었거나, 저장소 복구가 현재 성공한다는 의미는 아니다. B VM 최신 읽기 전용 점검과 승인된 저장소 게이트가 여전히 다음 필수 관문이다.

## 사용자 목표 단계별 현재 판정

| 목표 단계 | 현재 판정 | 확인된 근거와 남은 관문 |
|---|---|---|
| 1. B 암호화 저장소와 수신 PACS | 핵심 수동 복구·수신 PASS / 추가 복구 관문 미검증 | 실제 Key Vault unwrap, LUKS 잠금/재개방, 임시 권한 회수, 안전 기동, mTLS 합성 DICOM 저장·중복·재조회 및 서비스 재시작 보존 PASS. VM 재부팅·별도 백업 복원·Key Vault 감사 수집은 미검증 |
| 2. 동의된 DICOM 1개 A→B 전송 | 실제 A/B PASS | 2026-10-14 08:38 KST 정상 환자/B 의료진 Entra 인증과 기존 DOWNLOAD_ALLOWED 동의로 영상 2번 새 등록. B VM mTLS 독립 재조회 UID·원시 SHA-256 일치, 동일 감사 세션의 토큰/키 래핑·해제/A 응답 준비/B 저장 확인 대조. `a-b-single-instance-live-2026-10-14.md` 최신 실측 참조 |
| 3. 중단·중복·철회·만료 검증 | 로컬 시나리오 PASS / 실제 VM NOT VERIFIED | `test/b-pacs-a-to-b-flow.test.js`, `test/b-pacs-receiver.test.js`, `test/b-pacs-authority.test.js`, `test/pacs-transfer-jobs.test.js`, `test/import-workbench.test.js`에서 전송 중단/거부, UID 충돌·중복, 철회·만료, 재개 차단, 불명확 응답 자동 재전송 금지를 다룸. 운영 연결에서 실패가 성공으로 기록되지 않는지는 미검증 |
| 4. 다중 영상 작업·진행·재개 | 로컬 구현 PASS / 실제 운영 NOT VERIFIED | `test/pacs-transfer-jobs.test.js`, `test/pacs-transfer-jobs.postgres.test.js`, `test/import-workbench.test.js`에서 영속 원장, lease, 영상별 재인가, batch 재개, UI 진행·재개 확인. 운영 Control DB/A/B worker 배포는 미검증 |
| 5. 환자 웹과 의료진 버튼 연결 | 로컬 구현 PASS / Azure 배포 NOT VERIFIED | `test/patient-share-review.test.js`, `test/pacs-import-browser-routing.test.js`, `test/import-workbench.test.js`에서 환자 동의 검토, DPoP, 의료진 **B병원 PACS로 가져오기** 경로 확인. Azure에서 동일 최신 번들이 제공되는지는 미검증 |

## 2026-10-14 실제 LUKS 증적 형식 회귀 수정

현재 상태 재분석에서 B 런타임 검증기가 정상 저장소도 거부할 수 있는 오류를 확인했다. `artifacts/workstation/b-storage-runtime-20261013T014128Z/result.json`의 실제 `luksSegments`는 `{"0": {...}}` 객체지만 기존 validator와 테스트는 배열을 가정했다. 또한 UUID를 metadata JSON에서 추정하던 수집 경로를, 기존 저장 프로비저닝과 동일한 `cryptsetup luksUUID` 읽기 전용 조회로 수정했다.

검증기는 정확히 한 개의 `0` crypt segment와 `aes-xts-plain64`, pinned LUKS UUID를 대조한다. 배열·추가 segment·잘못된 번호·잘못된 암호 방식은 거부한다. UUID 또는 metadata 조회 실패도 고정 오류 `LUKS_READ_ONLY_PROBE_FAILED`로 중단한다.

| 확인 항목 | 결과 | 근거·범위 |
|---|---|---|
| 실제 증적 형식 및 UUID 수집 회귀 | PASS 5/5 | `python -m unittest test.b_pacs_storage_runtime_test`; 생성된 원격 수집 함수 자체를 실행해 별도 UUID 조회, 실제 과거 segments 형식, 두 조회의 실패 거부를 확인. subprocess는 대역이며 VM 접속 없음 |
| B 저장·복구·A 송신 점검 회귀 | PASS 47/47 | maintenance/runtime/provision/recovery-network/purge/vault-restore/A-sender 7개 Python 모듈 |
| 현재 B 저장소·Key Vault 복구·실제 PACS 연결 | NOT VERIFIED | 과거 증적은 JSON 형식 회귀에만 사용. 현재 VM 인증 및 실제 읽기 전용 점검은 미실행 |

관련 요구사항: FR-026~031, FR-037~041 및 AGENTS.md 14.3~14.5. 변경은 로컬 검증기·테스트·이 문서에 한정하며 PACS 기동이나 Import 활성화를 수행하지 않았다. 다음 실제 실행 관문은 `python scripts/b-pacs-storage-runtime-check.py --gui`로 현재 저장소와 컨테이너를 확인하는 것이다.

## 2026-10-14 07:23 KST 실제 B VM 런타임 점검

수정된 검증기로 B VM 인증 및 원격 조회를 수행했다. 최신 증거는 `artifacts/workstation/b-storage-runtime-20261013T222324Z/result.json`이다. 파일명의 시간은 UTC이며 실제 관측 시각은 2026-10-14 07:23:27 KST다. 이 결과가 앞선 현재 B VM 미검증 기록을 갱신한다.

| 확인 항목 | 결과 | 실제 관측 |
|---|---|---|
| 암호화 mount 및 pinned UUID | PASS | `/dev/mapper/highpass-b-pacs` → `/opt/highpass/b-pacs-encrypted`, ext4, rw/nodev/nosuid/noexec. 8 GiB backing, UUID가 기존 승인된 provisioning/recovery identity와 일치 |
| 암호화 및 manifest | PASS | 단일 crypt segment, aes-xts-plain64, argon2id, root-owned protected manifest 검증 성공 |
| 격리 container 저장 경계 probe | PASS | 네트워크 없음·read-only mount의 disposable probe exit 0. `--rm` 정상 종료 |
| 기존 복구 probe 무결성 | PASS | 확인용 파일 존재 및 원시 SHA-256이 기존 creation/recovery 증적과 일치. 새 복구 시험은 아님 |
| 기존 B Portal | PASS | 실제 health healthy |
| Orthanc 저장 디렉터리 | FAIL | `/opt/highpass/b-pacs-encrypted/orthanc-db` 없음 |
| 수신 Orthanc | FAIL | receiver project/service로 식별되는 컨테이너 없음 |
| 현재 Key Vault unwrap·재부팅·별도 복원 | NOT VERIFIED | 이번 읽기 전용 점검 범위 밖 |
| 전체 B 수신 준비 gate | FAIL | Orthanc 데이터 경로 및 수신 서비스가 아직 준비되지 않음 |

이번 실제 증거의 Portal image reference는 직접 고정된 `sha256:...` image ID다. 기존 검증기의 registry `@sha256:...` 전용 형식 제한을 보완해 직접 image ID도 running/probe ID와 정확히 같을 때 허용한다. 잘못된 ID는 계속 거부한다. `python -m unittest test.b_pacs_storage_runtime_test` 6/6 PASS이며, 수정 후 원격 증적을 다시 판정해도 전체 FAIL이 유지됨을 확인했다.

PACS 설치, 저장소 디렉터리 생성, 키 변경 및 Import 활성화는 수행하지 않았다. 다음 작업은 현재 암호화 mount를 유지한 상태에서 Orthanc 전용 경로와 수신 서비스의 배포 준비를 완료하고, 필요한 인증서·복구 관문을 검증하는 것이다. 관련 요구사항: FR-026~031, FR-037~041.

## 2026-10-14 실제 B 데이터 경로와 수신 서비스 준비

사용자가 요청한 B 준비를 실행했다. 최신 결과는 `artifacts/workstation/b-pacs-receiver-prepare-1ee2564f78cb4a1aaeb2b01671b0f627/result.json`이며 정지된 receiver 준비 범위 PASS다. 이 기록은 위의 디렉터리·컨테이너 부재 상태를 갱신한다.

| 준비 항목 | 결과 | 실제 확인 |
|---|---|---|
| 저장소 경계 | PASS | manifest UUID, 실제 dm-crypt UUID, loop backing, mount 옵션 및 기존 recovery probe hash 재확인 후 디렉터리 생성 |
| Orthanc 데이터 경로 | PASS | `/opt/highpass/b-pacs-encrypted/orthanc-db`, 동일 암호화 filesystem, UID/GID 10001:10001, mode 0700 |
| 전용 B 인증서·키 | PASS | serverAuth/DNS:b-pacs-mtls 및 clientAuth/전용 URI SAN; 기존 개발 CA 서명·chain·key match 검증. 개인키는 B VM에서 생성하고 외부로 반출하지 않음 |
| 이미지 및 파일 | PASS | 기존 두 후보의 정책 gate 통과, archive 및 설정 파일 hash 대조, B에 로드한 image ID 일치. image pull 없음 |
| 기동 전 gate | PASS | `b-pacs-receiver-start.py --check-only`; mount, config, permissions, immutable image ID, Compose 내부망·볼륨·secret 경계 확인 |
| 수신 컨테이너 준비 | PASS | `b-orthanc`, `b-pacs-mtls` 두 서비스가 created 상태. 외부 게시 포트 없음, 두 internal network, restart=no |
| 기존 B Portal | PASS | 준비 전후 같은 container ID와 image ID, health healthy |
| 실제 수신·live mTLS·키 복구 | NOT VERIFIED | 서비스를 시작하지 않았고 Import는 비활성. 신규 복구·재부팅 및 실제 DICOM 등록은 후속 관문 |

VM release 경로는 `/opt/highpass/b-pacs-receiver-1ee2564f78cb4a1aaeb2b01671b0f627`다. `receiver.compose.yml`, root-only `receiver.env`, 보호된 `secrets`, 검증된 guest/launch scripts를 포함한다. 전송용 image archive는 로드 후 양쪽에서 제거했다. 의료영상은 반입하지 않았다.

이번 준비에는 `scripts/b-pacs-receiver-prepare.py`를 추가하고, 오프라인 전송을 위해 정확한 `sha256:` image ID와 `pull_policy: never` 조합도 launch gate가 허용하도록 보강했다. 실제 Docker image ID를 별도로 확인하며 mutable tag는 계속 거부한다. 런타임 검증기도 Orthanc의 실제 image ID를 수집·대조한다. prepare/maintenance/runtime/provision 관련 Python 테스트 33/33 PASS, diff whitespace 검사 PASS.

다음 단계는 키 복구 관문을 확인한 뒤 수동 기동과 live mTLS, 합성 DICOM 저장·재조회를 검증하는 것이다. 이번 정지 상태 준비 PASS를 전체 다운로드 흐름 완료로 표시하지 않는다. 관련 요구사항: FR-026~031, FR-037~041.

## 2026-10-14 07:49~07:51 KST 실제 키 복구·수동 기동·합성 수신 검증

사용자 요청에 따라 실제 B VM에서 실행했다. 최신 증적은 `artifacts/workstation/b-pacs-live-verify-6b2697baf79046c58d27ec9fc56f7ea9/result.json`, 암호화 런타임 증적은 같은 폴더의 `runtime.json`이다. 앞선 Azure 권한 조회 옵션 충돌 두 번은 저장소 변경 전 FAIL이며, 이를 수정한 이번 실행은 PASS다.

| 시험 | 결과 | 실제 근거 |
|---|---|---|
| 현재 Key Vault 키 검증 | PASS | version-pinned wrapped key unwrap 후 실제 LUKS `--test-passphrase` 성공; 잘못된 키 exit 2 거부 |
| 잠금과 기동 거부 | PASS | mount 해제·dm-crypt mapping 제거 확인; 잠긴 상태 launch check 비정상 종료 |
| 키 복구·무결성 | PASS | 같은 Key Vault 키로 실제 재개방·마운트, 동일 UUID 및 기존 probe SHA-256 보존 |
| 임시 권한 회수 | PASS | 전용 저장 키 범위의 unwrap-only 임시 operator assignment만 삭제; 해당 assignment 부재 확인 후 서비스 기동 |
| 수동 기동·저장 경계 | PASS | 고정된 두 receiver 컨테이너 running, Orthanc healthy, 저장 경로 동일 암호화 filesystem, UID/GID 10001:10001, 0700 |
| 실제 mTLS·거부 시험 | PASS | B 내부 전용 client cert로 TLS 왕복; client cert 누락·잘못된 server hostname 거부, DELETE route 403 |
| 합성 DICOM 저장·재조회 | PASS | 승인된 synthetic manifest의 단일 3,146,808-byte DICOM 등록, SOP UID와 원시 파일 SHA-256 일치 |
| 중복 등록 | PASS | 두 번째 POST AlreadyStored, 같은 SOP UID 검색 결과 정확히 1개 |
| 서비스 재시작 후 보존 | PASS | B receiver만 stop 후 guarded start, 동일 Orthanc ID·SOP UID·파일 SHA-256 재조회 |
| 기존 Portal 보존 | PASS | 전후 container ID·image ID 동일, health healthy |
| 로컬 회귀 | PASS 40/40 | live-verify/prepare/maintenance/runtime/provision 5개 Python 테스트 모듈; 생성 원격 프로그램 컴파일 포함 |
| VM 재부팅·백업 복원 | NOT VERIFIED | 이번 시험은 서비스 재시작과 동일 Key Vault 키 수동 재개방이며 재부팅·별도 Vault 복원 시험 아님 |
| live 환자 동의·실제 A→B·플랫폼 감사 상관 | NOT VERIFIED | 이번은 사용자 승인 B 유지보수 합성 저장 시험. 환자 동의/토큰 흐름과 A 전송·양측 감사는 수행하지 않음 |

저장된 SOPInstanceUID는 `2.25.121709258683375476993981943589921084761`, 파일 SHA-256은 `b4ce01cdfbbdc3d1850f90d404d3c3486b968c20f97b4688c40b080059378d22`다. Study/Series UID는 pinned synthetic contract와 원시 DICOM hash에 바인딩되며, 별도의 DICOM 태그 parser 검증으로 확대 해석하지 않는다.

원시 키·token·VM 비밀번호를 argv/env/증적에 기록하지 않았다. 합성 원시 파일은 B 암호화 경로로만 staging한 뒤 제거했으며 Orthanc 등록본은 암호화 DB에 유지한다. root-only `synthetic-maintenance-audit.jsonl`에 유지보수 저장·재조회 영수증을 기록했다. 이 로그는 플랫폼/환자 동의 감사로그 또는 Key Vault 진단 감사 수집을 대체하지 않는다.

B receiver는 현재 running이며 restart=no, 외부 게시 포트 없음, 기존 internal network 유지다. Import 기능은 활성화하지 않았고 신규 유료 자원·공개 접근 확대·자동 키 해제도 하지 않았다. 내부 Orthanc HTTP 무인증은 전용 내부망 뒤에 한정되며 호스트 root/내부망 접근 주체의 위험까지 제거했다는 주장은 하지 않는다.

생성: `scripts/b-pacs-live-verify.py`, `test/b_pacs_live_verify_test.py`. 수정: `scripts/b-pacs-storage-guest.py`의 비파괴 키 precheck, `test/b_pacs_storage_provision_test.py`, 이 문서. 새 검증기는 기동 중인 receiver나 다른 encrypted mount 소비자가 있으면 재잠금 시험을 거부한다. 관련 요구사항: FR-026~031, FR-037~041 및 AGENTS.md 14.3~14.5. 다음 관문은 환자 동의 기반 실제 A→B 단건 전송과 양측 UID/hash/감사 상관 검증이다.
