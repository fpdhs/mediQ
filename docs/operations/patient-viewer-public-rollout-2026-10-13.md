# 환자 CT 발급·영상 주소 분리 배포

상태: **제한 경로 배포 / DRAFT · UNASSIGNED**. 실제 Entra 환자 CT 표시 완료 증적은 아직 아니다.

## 작업 목적

검증된 Entra 환자 계정과 고정 합성 CT의 소유권을 연결하고, 발급 API와 B 영상 주소를 분리한다.
기존 의료진 정책·공유 동의·다운로드 권한은 변경하지 않는다.

## 관련 요구사항

- FR-014~020 서버 접근정책
- FR-021~025 단기 토큰
- FR-026~031 Gateway
- FR-032~036 Viewer
- FR-037~041 감사
- TLS·최소권한·Control/Data Plane 분리 (해당 NFR 번호는 별도 확정하지 않음)

## 분석한 기존 구조

실행 중인 Control/web/B 이미지를 캡처해 좁은 오버레이를 만들었다. 작업 폴더의 관련 없는
PACS·RAG·UI 변경은 배포하지 않았다. 원본은 A에 있고, 기존 환자용 암호화·키 해제 경로를 유지한다.
공개 클라우드 소켓은 TLS 바이트 전달만 하며, B에서 TLS를 종료한다. Control 애플리케이션은 원본 영상 프록시가 아니다.

## 구현한 기능 / API 영향

| 항목 | 변경 전 | 변경 후 |
|---|---|---|
| Grant 발급 origin | 영상과 동일 기준 | highpass-demo.japaneast.cloudapp.azure.com |
| 환자 영상 origin | 내부 B 주소 | highpass-images-b.japaneast.cloudapp.azure.com |
| 브라우저 인증 전달 | 단일 origin | Entra는 발급 API에만, B에는 단기 Grant + DPoP |
| 외부 B 경로 | 전체 403 | 정확한 GET instances / instance rendered + OPTIONS만 전달 |
| 모바일 정적 캐시 | v45 | v46 |

발급 POST JSON 계약과 영상 GET 경로는 유지한다. 각 요청 DPoP htu를 실제 목적지에 맞춘다.
두 공개 origin은 정확한 승인 쌍만 허용한다. 의료진용 origin은 유지한다.
브라우저는 credentials omit, redirect error, no-store를 사용한다.
Origin/CORS는 인증 수단이 아니며, 하위 Gateway/Control이 토큰·증명·소유권·범위를 검증한다.

## 생성한 파일

- src/patient-public-origins.js
- test/patient-public-origins.test.js
- infra/azure/patient-images-b.Caddyfile
- scripts/patient-viewer-rollout.py
- scripts/patient-viewer-rollout-remote.py
- scripts/prepare-patient-viewer-rollout.py
- scripts/verify-patient-public-routes.py
- 본 문서

## 수정한 파일

- src/server.js — 발급 경로만 origin 정렬
- src/patient-self-view-grant-runtime.js — 발급/영상 origin 분리
- src/capstone-b-portal.js, scripts/start-capstone-b-portal.js — 환자 origin 별도 적용
- public/patient-pixel-viewer.js, public/mobile/sw.js
- scripts/start-public-web.js — 정확한 발급 POST와 CSP 영상 origin
- test/patient-pixel-viewer.test.js
- scripts/patient-entra-ownership-preflight.py — 비밀정보 없는 감사 집계

앞선 Entra ownership 변경 및 migration 038도 이번 후보에 포함했다.
상세 목록은 patient-entra-ownership-2026-10-13.md 참조.

## 배포·복구

- Migration 038: nullable authenticated_subject 추가. 기존 ownership/FK/행을 유지한다.
- 애플리케이션 롤백은 additive 열을 남기고 기존 이미지를 복원한다.
- Control/web/B 후보 배포 → healthy 확인 → 기존 이미지 복구 → healthy 확인 → 수정 후보 재배포.
- 네트워크 이름, 포트 바인딩, 마운트, readonly, cap-drop, security options 및 관련 없는 환경변수 불변 확인.
- B TLS 설정 validate 후 개방 → deny-all 복구 및 외부 403 확인 → 제한 경로 재개방.
- 원래 compose/inspect/후보 설정은 각 서버 /opt/highpass/patient-viewer-rollout-20261013 아래 0600로 보관.
- 서버 비밀번호는 마스킹 입력 후 세션 메모리에서만 사용한다. 비밀정보를 소스나 증적에 출력하지 않았다.

최종 이미지:

- Control: sha256:be7a38e1d6a77e5d6a0ea29e122d4db0aa91d0246b8c657ae179397d349fb770
- web: sha256:0c247416865aed725680026af187f906091bdb3d1b18cb16c454542261fdbb44
- B portal: sha256:9655c0d88cd96e686fc713c022c1ebc3e839efac6f4566a0209411336aea9a99

복구 도구: 운영자 인증 후 CLOUD:rollback / B:rollback. 영상 즉시 차단: B:tls-close.
인증 세션은 시간 제한이 있으며, 새 세션은 새 마스킹 입력이 필요하다.

## 보안 검토

원본 DICOM·다운로드·관리 API·쿼리 토큰·다른 Origin은 외부 진입점에서 차단한다.
B upstream TLS는 전용 CA를 검증하며 skip-verify를 쓰지 않는다.
CA 읽기 권한 문제는 공개 인증서만 별도 0644 복사하여 해결했다. 기존 비밀파일 권한은 완화하지 않았다.
설정 문법은 [Caddy reverse_proxy 공식 문서](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy)를 대조했다.
등록된 합성 환자 소유권 ACTIVE, Series 메타데이터 700건은 읽기 전용으로 재확인했다.

## 테스트 결과

| 시험 | 결과 | 근거 |
|---|---|---|
| 최초 집중 회귀 | FAIL | 96개 중 설정 거부 오류 순서 1건 |
| 오류 순서 수정 후 동일 회귀 | PASS | 96/96 |
| 후보 빌드·JS 구문 검사 | PASS | 3개 서비스 후보 |
| Control/B 상태·기존 이미지 복구 | PASS | healthy → rollback → healthy |
| 신규 열 및 기존 ownership | PASS | migration038=true, ACTIVE/version1 유지 |
| B TLS 설정 검증 | PASS | 실제 Caddy 이미지 validate |
| 외부 경로·정적 배포 해시 | PASS | 13/13, routes-open.json |
| 인증 없음 | PASS | 401 PATIENT_PROOF_REQUIRED |
| 무효 proof/token | PASS | 403 PATIENT_ACCESS_DENIED |
| 거부 감사 | PASS | ACCESS_DENIED / PATIENT_TOKEN_INVALID 실제 DB 집계 |
| 원본·관리·쿼리·타 Origin | PASS | 403 |
| 제한 경로 OPTIONS | PASS | 204, 승인 Origin만 응답 |
| 전체 차단 복구 후 재개방 | PASS | deny-all 403 후 위 행렬 재통과 |
| 실제 Entra 환자 발급→700 목록→프레임 | NOT VERIFIED | Microsoft 로그인 사용자 입력 필요 |
| 실제 모바일 로그인·프레임 표시 | NOT VERIFIED | 서버 자산 해시 검증과 구분 |
| 실제 계정 만료·재사용·소유권 정지 | NOT VERIFIED | 단위시험은 통과, 실계정 시나리오 미수행 |
| 700개 원본 재해시·PACS 전송 | NOT VERIFIED | 이번 작업 범위 아님 |

## 증적 / 남아 있는 위험

artifacts/azure/patient-viewer-20261013T125850Z 에 단계별 배포·복구 결과와 공개 경로 행렬이 있다.
최종 사용자 열람 성공 및 전체 감사 hash chain은 미검증이다. 로그인 성공으로 열람 성공을 대체하지 않는다.
전체 MVP 완료나 운영 의료서비스 준비 완료로 보고하지 않는다. 커밋·푸시하지 않았다.
