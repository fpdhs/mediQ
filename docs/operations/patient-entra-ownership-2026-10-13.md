# Entra 환자와 고정 CT 소유권 연결 — 2026-10-13

후속 갱신: 본 문서는 당시 로컬 시험 기록이다. 이후 배포 및 제한 경로 개방 결과는
[patient-viewer-public-rollout-2026-10-13.md](patient-viewer-public-rollout-2026-10-13.md)를 참조한다.

당시 상태: **로컬 구현 및 격리 시험 / DRAFT · UNASSIGNED / 미배포**.
외부 B TLS 진입점의 deny-all 설정은 변경하지 않았다. 본 문서는 환자 CT 인터넷 열람 완료 증적이 아니다.

## 작업 목적과 관련 요구사항

검증된 Entra 환자 principal을 기존 고정 합성 CT 소유권에 연결하고,
허용된 Study/Series의 VIEW_ONLY 요청만 기존 단기 Grant·DPoP·감사 경로로 처리한다.
관련 FR: FR-014~020 접근정책, FR-021~025 단기 토큰, FR-026~031 Gateway,
FR-037~041 감사. 환자 본인 열람은 의료진의 병원 간 공유 동의와 별도 권한이며,
의료진 동의 정책을 대체하거나 다운로드를 허용하지 않는다.

## 확인된 기존 구조

실행 명령: `python scripts/patient-entra-ownership-preflight.py`.
배포된 Control의 전용 authority DB 자격증명으로 `BEGIN READ ONLY`를 사용했다.
비밀번호·Entra object ID·JWT는 출력하지 않았다. 원본 영상은 읽지 않았다.

- 인증 모드: ENTRA_OIDC.
- 서버 환자 actor: `synthetic-patient-hcc`, 환자 `MEDIQ-SYN-HCC-001`.
- 기존 소유권 subject: `synthetic-hcc-account`.
- 계정 ACTIVE, 소유권 ACTIVE, ref version 1.
- Study `2.25.259656708708993797343330994179169711072`.
- Series `2.25.18361638789025095699746776899955737977`, 등록 instance_count 700.
- 새 migration 038은 실서버에 미적용.

이는 등록 메타데이터의 대조이며 700개 DICOM 재해시·PACS 재조회 증적은 아니다.

## 구현 결정

1. Entra 서명/tenant/client/scope 검증 뒤 생성하는 principal에 검증된 object ID를 보존한다.
2. 서버 보호 actor-map을 정책 평가마다 다시 읽는다. 이메일/화면 이름/요청 body를 매핑 근거로 사용하지 않는다.
3. 고정 합성 환자의 정확한 actor·patient 쌍만 기존 ownership subject에 연결한다.
4. 원래 account/ref/Study/Series/hospital JOIN과 ACTIVE 검증은 유지한다.
5. 매핑의 object ID·issuer·audience·actor·patient·ownership subject를 해시하여 ownership revision에 포함한다.
6. Grant 토큰의 sub와 감사 actor는 실제 Entra actor를 유지한다.
   DB subject는 기존 소유권 FK를 유지하고, authenticated_subject를 별도 저장한다.
7. 발급 전, 트랜잭션 내부, 사용 시점에 재검증한다. 매핑 변경 또는 소유권 정지는 기존 Grant를 거부한다.
8. 기존 5분 이하 TTL, VIEW_ONLY, 단일 Series, DPoP, persistent replay, 토큰 해시 저장, 감사 실패 차단을 유지한다.

PostgreSQL 스킬의 무결성·최소 권한 기준에 따라 FK를 제거하지 않고 nullable 열만 추가했다.
등록 데이터/소유권을 재작성하지 않으며 기존 테이블 SELECT/INSERT 권한 외 새 권한은 필요하지 않다.

## 생성 파일

- `src/patient-entra-ownership-binding.js`
- `db/migrations/038_patient_entra_grant_actor.sql`
- `test/patient-entra-ownership.test.js`
- `scripts/patient-entra-ownership-preflight.py`
- `scripts/verify-patient-entra-ownership-postgres.js`
- 본 문서

## 수정 파일

- `src/auth.js`
- `src/patient-self-view-authority.js`
- `src/patient-self-view-grant-repository.js`
- `src/patient-self-view-audit-adapter.js`
- `src/patient-self-view-authorization.js`
- `src/patient-self-view-grant-runtime.js` — 기존 미커밋 ENTRA_OIDC 지원 변경을 유지했다.
- `test/entra-oidc-auth.test.js`

## API 영향

- 요청/응답 URL과 JSON 계약 변경 없음.
- 변경 전: Entra 환자는 TEST_JWT 전용 authority 검사에서 거부.
- 변경 후: 검증된 Entra principal + 현재 서버 매핑 + 등록된 소유권이 일치해야 허용.
- 영향 화면: 환자 본인 CT viewer의 Grant 발급/사용 경로. 현재 배포 화면은 미변경.
- 미변경: 의료진 공유 동의, 다운로드 정책, 일반 DICOMweb, 공개 ingress.

## 시험 결과

| 시험 | 결과 | 근거 |
|---|---|---|
| 실제 서버 계정·등록 소유권 대조 | PASS | 읽기 전용 preflight, ACTIVE / 700 metadata |
| 인증·소유권·Grant·HTTP·감사 단위 시험 | PASS | 초기 집중 시험 52/52 |
| Gateway·키 해제·암호화·DPoP 포함 회귀 시험 | PASS | 최종 집중 시험 96/96, 위 52개 포함 |
| PostgreSQL 신규 열·기존 FK·실제 INSERT | PASS | 별도 PostgreSQL 16, 제한된 시험 역할 |
| Entra actor 감사 / 변경된 매핑 거부 / 정지 거부 | PASS | 격리 DB 시험 |
| 매핑 변경 후 발급 트랜잭션 rollback | PASS | 추가 Grant/audit 미생성 확인 |
| 전체 감사 hash chain 실DB 검증 | NOT VERIFIED | 격리 시험은 트랜잭션 감사 fixture 사용 |
| Azure/B 배포·실제 환자 브라우저 CT | NOT VERIFIED | 미배포, 외부 경로 차단 유지 |

DB 시험 최초 두 실행은 readiness 단계 FAIL이었다. 네트워크 SQL 연결을 확인하는
45초 제한 준비 확인으로 수정 후 PASS. 시험 종료 때 생성한 컨테이너/볼륨만 제거했다.
회귀 시험의 `DPOP_STORE_FAILURE_AUDIT_NOT_RECORDED` 두 출력은 저장소·감사 실패를
주입한 거부 테스트에서 발생했으며, 해당 테스트는 503 차단을 확인하고 통과했다.

## 남은 작업 / 안전한 적용 순서

1. 공개 웹 Grant 발급 origin과 B 영상 DPoP origin을 별도 설정으로 정렬.
2. 기존 배포 이미지 기준의 좁은 후보 구성, migration 038 적용·복구 검증.
   런타임은 ENTRA_OIDC에서 새 열이 없으면 시작을 거부한다.
3. B 내부 Gateway 연결과 정확한 GET metadata/rendered 경로만 허용하는 TLS 설정,
   웹 origin 전용 CORS/CSP, 토큰·proof 전달 및 redirect 차단 검증.
4. 원본·관리·다운로드·범위 밖 요청은 차단한 채 승인된 열람 경로만 개방.
5. 실제 Entra 환자 웹·모바일에서 Grant → 범위 내 프레임 → 감사,
   타 계정·만료·재사용·소유권 정지 거부를 검증.

전체 MVP 또는 인터넷 CT 열람 완료로 보고하지 않는다. 신규 배포·공개는 이 시험 결과만으로 수행하지 않았다.
