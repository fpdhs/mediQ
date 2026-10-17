# 동의된 합성 DICOM 한 건의 실제 A→B 전송

작성일: 2026-10-14 Asia/Seoul
상태: 실제 단건 A→B 전송·B 독립 재조회·감사 상관 PASS / 전체 batch 및 운영 승인 아님

## 목적 및 요구사항

기존 환자 승인 DOWNLOAD_ALLOWED 동의로 합성 CT 영상 한 장만 A Gateway에서 B 암호화 PACS로 반입한다. 실제 환자 데이터·전체 700장 자동 전송·Control 원본 저장·인증 우회는 범위 밖이다.

관련 요구사항: FR-010~013, FR-014~025, FR-026~031, FR-037~041. 저장 암호화와 비밀정보 관리는 AGENTS.md 14.3~14.5. NFR 번호는 새로 추정하지 않는다.

## 기존 구조 및 변경 범위

- A Gateway, B Portal, Azure Control은 실행 중이고 기존 이미지 암호화·Key Vault·단기 토큰·DPoP·PostgreSQL release ledger를 사용한다.
- 실제 사전점검 `artifacts/workstation/capstone-a-sender-preflight-20261013T225303Z/result.json` PASS. A/B Docker·WireGuard, A PACS 전용망 및 B→A TLS 1.3 확인.
- 배포 소스 증적 `artifacts/workstation/a-b-import-runtime-20261013T225543Z/result.json`에는 단건 import 경로가 없었다. 기존 기능 플래그만 켜는 방식으로는 동작하지 않는다.
- 현재 각 서버 이미지에서 파생한 서버 코드 전용 overlay를 적용했다. Azure Control의 최신 Entra·환자 웹·건강기록·도우미 코드는 통째로 교체하지 않고 반입 인가 플래그 두 지점만 추가했다. 웹 원본 앱 번들은 유지했다.
- API 변경 전: POST `/dicomweb/studies/{study}/series/{series}/instances/{sop}/import` 미연결. 변경 후: 빈 body, DOWNLOAD_ALLOWED, 목적·병원·의료진·Study/Series·토큰·DPoP 검증 후 단건 반입. GET import, 무인증 및 body 전송은 허용하지 않는다.
- B의 `/gateway/data-plane/package/import-authorize`는 기존 별도 B 서비스 인증을 요구하고 BEFORE_IMPORT·PACS_VERIFIED를 구분한다. Control에는 원시 DICOM·키를 저장하지 않는다.
- Entra 모드의 의료진 토큰 발급 DPoP URL을 명시적으로 설정된 Azure issuance origin과 대조하도록 보완했다. legacy TEST 모드 및 임의 origin/query 입력은 변경하지 않는다.

## 실제 배포 증적

`artifacts/workstation/a-b-single-import-rollout-e0ce3b14a8364ec98a25f5890d695e33/result.json`: A·B·Control 배포 PASS, 세 서비스 healthy, 게시 포트 및 컨테이너 보안 설정 유지. 각 원격 release에 root-only baseline/before/after 설정이 있으며 실패 시 해당 서버만 이전 설정으로 복귀한다. 데이터 볼륨·키·기존 감사로그는 삭제하지 않는다.

별도 검증 화면은 `https://highpass-demo.japaneast.cloudapp.azure.com/single-import-check.html`이다. 현재 앱 기능을 대체하지 않는다. 정상 환자 인증으로 기존 승인 동의를 선택하고 정상 B 의료진 인증·DPoP로 단건 요청한다. 팝업 대신 기존 MSAL redirect 패턴을 사용하며 access token은 화면 메모리, 임시 인증 cache는 기존 클라이언트의 처리 후 삭제 정책을 따른다. sessionStorage에는 선택 동의 ID·검증 역할 metadata만 저장한다.

선택 합성 원본: InstanceNumber 2, SOPInstanceUID `2.25.41201726628454317744442406717668675255`, 3,146,808 bytes, SHA-256 `6053ea5f2a01c0327fd7243f01d9f843bee0f6de6f7c958503227fdfefdc0087`. 이전 B 유지보수 시험의 영상 1번을 재사용하지 않는다. Study/Series는 고정 synthetic manifest 계약에 따른다. 사용자 승인 동의 자체는 CT 시리즈 범위이고 이번 실제 요청만 한 장으로 제한한다.

## 검증 및 미확인

| 항목 | 결과 | 근거 |
|---|---|---|
| A/B 및 B→A TLS 사전점검 | PASS | 실제 VM 점검 증적 |
| 서버 코드 한정 배포 및 정상 기동 | PASS | 세 역할 rollout 증적 |
| 로컬 인가·반입·암호화·로그인 URL·진단 회귀 | PASS 55/55 | 9개 Node test 파일 |
| 배포 source preservation·독립 영수증 상관·검증 프로그램 compile | PASS 13/13 | Python rollout/live verification/evidence guard tests |
| 환자·B 의료진 Entra 인증 | PASS | 실제 브라우저 로그인, 환자 계정 승인 동의 선택 및 의료진 role 확인 |
| 최초 인터넷 반입 요청 | FAIL | 공개 B 진입점 OPTIONS 403 PATIENT_ROUTE_NOT_ALLOWED; 자동 재시도·반입 성공 처리 안 함 |
| 실제 저장·재조회·양측 감사 상관 | PASS | 아래 최신 실측 및 독립 B PACS 재조회 증적 |
| 실제 700장 batch·중단/철회/만료 | NOT VERIFIED | 이번 작업 범위 밖 |

## 생성·수정 파일

생성: `scripts/a-b-import-runtime-check.py`, `scripts/a-b-import-rollout.py`, `scripts/single-import-check-deploy.py`, `scripts/single-import-edge-open.py`, `scripts/a-b-single-import-evidence.py`, `scripts/b-import-diagnostic-deploy.py`, `scripts/control-import-ingress-deploy.py`, `public/single-import-check.html`, `public/single-import-check.js`, `test/a_b_import_rollout_test.py`, `test/a_b_single_import_evidence_test.py`, 이 문서.

수정: `src/patient-public-origins.js`, `src/capstone-runtime-diagnostics.js`, `public/login-navigation.js`, 관련 두 Node 테스트 및 phase1 readiness 문서. 기존 dirty 파일은 보존했다. 신규 DB schema/migration·유료 리소스·원본의 공개 업로드는 없다.

남은 위험: legacy Orthanc 내부 HTTP는 전용 내부망 뒤에 한정된다. 호스트 root 권한의 위험을 제거하지 않는다. 반입 후 최종 audit 실패는 미확인 상태이며 임의 삭제·거짓 rollback을 하지 않는다. 이 실행은 bounded Capstone download/import 흐름이며 별도의 완전한 v3 import Grant 수락 검증으로 확대하지 않는다.

## 08:38 KST 실제 전송 완료 및 독립 검증

기존 동의 `consent_98160dfe183cf4b1`을 그대로 사용했다. 정상 환자 인증으로 DOWNLOAD_ALLOWED·진료 목적 동의를 읽고 정상 B 의료진 인증으로 DPoP-bound 단기 토큰을 발급했다. 새 동의 임의 삽입이나 기존 동의 권한 변경은 하지 않았다.

실제 최종 전송은 2026-10-14 08:38:39~08:38:46 KST에 완료됐다. 브라우저 응답 `PACS_INSTANCE_VERIFIED`, `simulation:false`, `destinationVerification:true`, `alreadyStored:false`. B Orthanc ID는 `9535d697-929123d8-7497eaba-364a99c6-1f847354`다. 이는 유지보수 시험의 기존 영상 재사용이 아니라 선택한 영상 2번의 새 등록이다.

독립 검증 증적: `artifacts/workstation/a-b-single-import-evidence-26cb474e9c6540e7813edc8a0e4ca3eb/result.json` PASS. B VM에서 전용 mTLS로 SOP 검색 결과 1건 및 등록 파일을 직접 재조회했고 SOP UID·3,146,808 bytes·원시 SHA-256·Orthanc ID가 브라우저/원본 계약과 일치했다. 원본 파일을 워크스테이션 증적이나 Control에 저장하지 않았다.

감사 세션 `audit-session_860d3cac87330233`에서 다음 성공 행위를 대조했다:

- TOKEN_ISSUED
- KEY_WRAP_AUTHORIZED
- KEY_RELEASE_PREPARED
- DATA_PLANE_RESPONSE_PREPARED
- KEY_RELEASE_PRECHECKED
- KEY_RELEASE_CONSUMED
- PACS_IMPORT_AUTHORIZED (저장 직전 재확인 포함)
- PACS_INSTANCE_VERIFIED

같은 consentId·source HOSP-A·target HOSP-B이며 최종 B 감사 영수증의 SHA-256/bytes/Orthanc ID를 독립 B 재조회 결과와 대조했다. Control 감사는 인증된 A/B 서비스의 보고이며 Control이 원본 pixel을 직접 수집한 것으로 표시하지 않는다. 보강된 영수증 validator로 방금 수집한 실제 증적도 다시 판정해 PASS를 확인했다.

## 보완한 진입점 및 실제 실패 기록

1. 공개 B 진입점은 기존 query 거부·허용 origin·TLS 검증을 유지한 채 위 SOP 2번의 정확한 import 경로에만 POST/OPTIONS를 연결했다. 무인증 POST는 401, 올바른 origin의 preflight는 204. 중복 CORS 응답 헤더를 제거했다. 최신 증적 `artifacts/workstation/single-import-edge-13ec6abf4ba1449988e92d179774f5ce/result.json` PASS.
2. Caddy 관리 API가 비활성이라 reload가 거부됐다. 관리 API를 열지 않았으며 source 복원 후 정상화하고 검증된 설정으로 stop/짧은 안정화 대기/start를 수행했다. 중간 exited 상태와 복귀 기록은 보존했다. 최종 공개 진입점 정상 응답과 실제 반입으로 확인했다.
3. B의 복호화 후 저장 전 요청은 Azure 내부 ingress의 이전 `keyReleasePaths` 목록에 import-authorize가 빠져 거부됐다. 고정 진단 코드 PACS_IMPORT_AUTHORIZATION_UNAVAILABLE 및 감사 기록으로 확인했다. DICOM 파서나 권한 조건을 완화하지 않았다.
4. 내부 ingress의 기존 모듈에서 `keyReleasePaths` 상수에 정확한 service-only import-authorize 경로만 추가했다. 원래 B 별도 서비스 토큰·Control 권한/동의 검증은 유지했다. 최신 증적 `artifacts/workstation/control-import-ingress-a372b413baa341e0b32b168fcd374ecc/result.json` PASS. 이전 Compose 필수 변수 및 health 확인 실패는 적용 전 또는 해당 서비스 rollback 후 보완했다.

최신 검증 화면 배포 `artifacts/workstation/single-import-check-deploy-f7ef2e5d1fba46efa50929e8fdbabdbb/result.json` PASS. 검증 단계가 재로그인을 거칠 때 기본 option으로 동의 ID를 덮어쓰지 않게 보완했고, 증명용 개인키는 export 불가·메모리 전용이며 성공 후 선택 metadata를 지운다. 의료진에게 환자 전용 GET consent API 권한을 추가하지 않고 서버 토큰/반입 정책으로 동의를 재검증한다.

미검증: 실제 중단·철회·만료·충돌/중복 재전송 시험, 700장 영속 작업 및 원장·진행/재개 배포, 메인 의료진 메뉴의 동일 흐름 연동, VM 재부팅 복구, 별도 backup 복원, Key Vault 진단 감사 수집 및 전체 저장소 회귀. 이번 단건 성공을 전체 작업 완료로 확대하지 않는다.
