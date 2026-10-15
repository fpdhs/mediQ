# 의료진 접수 홈·공유 자료 연결 배포

## 작업 목적
기존 의료진 메뉴를 유지하면서 QR 중심 접수 홈을 구현하고 접수→환자 기록→CT 열람의 서버·화면 연결 누락을 수정한다.

## 관련 요구사항
FR-001~005 동의, FR-006~009 목록, FR-010~013 의료진 접근, FR-014~020 정책, FR-021~031 토큰/Gateway, FR-032~036 Viewer, FR-037~041 감사. 개별 NFR 번호는 확정하지 않았다.

## 분석한 기존 구조
Node.js Control/Web, PostgreSQL, B Gateway와 기존 HTTPS 진입점. Azure 배포에는 공유 건강기록 핸들러가 없었고 공개 API 허용 목록에도 빠져 있었다. 저장된 의료진 역할은 `Doctor`인데 건강기록 검증은 `DOCTOR`로 비교했다. 영상 호출은 Azure 동일 출처로 향해 차단됐으며 Viewer 진입이 기존 접수 선택을 초기화했다.

## 생성한 파일
`scripts/clinician-connected-release.py`, `scripts/clinician-connected-style-release.py`, `scripts/clinician-connected-final-release.py`, `scripts/clinician-connected-diagnose.py`, `scripts/clinician-image-entry-session.py`, `scripts/verify-clinician-connected.py`, `scripts/verify-clinician-connected-store.py`, `test/clinician-public-connection.test.js`, 이 문서. 증적은 `artifacts/azure/clinician-connected*-20261014`, `artifacts/azure/clinician-image-entry-20261014`에 저장.

## 수정한 파일
`public/app.js`, `public/ui/clinician-reception.js`, `public/ui/clinician-reception.css`, `scripts/start-public-web.js`, `src/shared-health-records.js`, `src/data-plane-authorization.js`, `src/server.js`, 관련 테스트. 배포 후보에서는 기존 `src/services.js`, `src/postgres-store.js`에 명시적 건강기록 범위 저장/조회 부분만 선별 반영했다. 작업 이전의 관련 없는 변경은 배포하지 않았다.

## 구현한 기능
- 네이비 스캐너 영역과 실제 검증 응답으로만 채워지는 접수 확인 카드. 카메라 및 이미지/연결 코드 입력 기능 유지.
- 선택한 접수의 동의·환자·검사·목적 유지. 다른 접수의 기록으로 자동 전환하지 않음.
- 인증된 공유 건강기록 조회 API와 명시적 범위 저장 연결.
- CT 목록/시리즈/인스턴스/렌더링 요청은 B HTTPS 경로로 직접 연결. 실제 URL로 DPoP 서명.

## API 변경 전/후 및 영향
이전: 공개 Web에서 `GET /api/v1/clinician/health-records`, `POST /api/dicom-access/request` 차단. 이후: 기존 인증·신뢰된 ingress 검증을 거쳐 Control에 전달. 기존 API 스키마는 유지하며 nullable `consents.health_record_scope`를 추가한다. 영향 화면: 의료진 홈·접수·기록·Viewer. 영향 테스트: 공유 기록, 접수, DPoP, 환자 동의 선택, Entra 회귀.

## 보안 검토
환자 원본 영상은 Control을 통과하지 않는다. B 외부 경로는 지정된 Origin 및 제한된 GET 메타데이터/렌더링만 허용한다. 실제 토큰·DPoP 서명·재사용·동의·병원·Study·Series 검증 유지. 원본 다운로드/임의 쿼리/관리자 API는 공개하지 않는다. QR 접수 성공을 권한 우회로 취급하지 않는다. 기존 동의의 NULL 건강기록 범위를 자동 확장하지 않는다. 계정 비밀번호나 토큰을 증적에 기록하지 않았다.

## 테스트 결과
| 테스트 | 결과 | 근거 |
|---|---|---|
| 공유 기록·접수·정책·DPoP·뷰어 상태 | PASS | Node 테스트 33/33 |
| 환자 선택·Entra·QR 회귀 | PASS | 최종 재실행 29/29; 초기 VM 테스트의 location 의존 실패를 가드 수정으로 해결 |
| 공개 배포 파일·인증/Origin/원본 차단 | PASS | 최종 공개 검증 13개; public-verification.json |
| DB 범위 컬럼·의료진 역할 | PASS | 범위 컬럼 존재, 등록 의료진 3명 모두 Doctor; store-verification.json |
| 배포 실행 상태 | PASS | Control healthy, Web running; verify.json |
| 홈 데스크톱 시각 배치 | PASS | 로컬 합성 화면 screenshot; 실제 접수 없음 표시 |
| 실제 Entra 로그인→QR→공유 건강기록→CT 표시 | NOT VERIFIED | 사용자가 직접 검증하기로 지정 |
| 실제 휴대폰/390px 화면 | NOT VERIFIED | 브라우저 viewport 변경이 적용되지 않아 실기기 검증 필요 |
| 복구 실제 실행 | NOT VERIFIED | 이전 이미지·구성 및 복구 스크립트 보존; 복구 실행하지 않음 |

최종 코드 기준 통합 재실행: 62/62 PASS. 최종 공개 파일·차단 재검증: 13/13 PASS. 최종 Control 이미지 `sha256:4c863a86eb7f9cdc1b37281a8b0b19194907faaddb8050aa49711743aacff5e8`, Web 이미지 `sha256:2dd39c9ec03e39aaf5aa755d8799ec4529bb22fbf8b608995b65e55fe66122df`.

## 남아 있는 위험·미검증 사항
이 배포로 실제 계정의 끝단 열람 성공을 주장하지 않는다. 기존 영상 전용 동의에는 건강기록이 없으므로 환자가 기록을 명시적으로 선택한 새 공유가 필요하다. 실제 CT 표시·슬라이스 전환·네트워크 지연 및 서버 감사 결과는 직접 검증해야 한다. 공개 원본 다운로드는 여전히 닫혀 있다. 의료 콘텐츠 검토나 전체 MVP 완료 증적이 아니다. 신규 검토 상태 DRAFT / UNASSIGNED, 커밋·푸시 없음.

## 사용자 확인 순서
1. Azure 의료진 웹 새로고침 후 의료진 로그인.
2. 홈의 QR 불러오기 또는 카메라 스캔으로 새 티켓 접수.
3. 접수 확인 카드→접수 데스크에서 해당 접수 선택.
4. 환자 기록에서 동의에 포함된 기록만 표시되는지 확인.
5. 환자 영상에서 복부 CT 열기 및 슬라이스 이동 확인.
6. 동의 철회/만료/다른 병원 요청 시 자료가 열리지 않는지 확인.
