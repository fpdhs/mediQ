# 의료진 QR → 접수 → 기록·영상 흐름 정렬

## 작업 목적
상단의 과거 화면 별칭으로 ‘검사 선택’이 QR 홈에 연결되던 오류를 수정. QR 입력은 홈에만 두고 접수 데스크는 저장된 QR 사용 기록을 조회한다.

## 관련 요구사항
FR-006~009(검사 메타데이터), FR-010~013(의료진 접근), FR-014~020(정책), FR-021~025(토큰), FR-037~041(감사) 기능군. 개별 원문 FR 및 NFR 번호는 미확정이므로 임의 번호 부여하지 않음.

## 분석한 기존 구조
- public/app.js의 dashboard가 QR 홈으로 변경됐지만 index.html의 clinical-flow가 이전 별칭을 유지했다.
- 기존 clinician-home은 일반 공유 검사 목록이며 QR 접수 대장이 아니었다.
- transferTickets의 USED, usedAt, redeemedDoctorId, redeemedHospitalId는 PostgreSQL 매핑에 이미 존재한다. 새 저장 스키마 없이 이 기록을 투영한다.
- 환자 기록은 기존 clinician-health.js와 서버의 공유 건강기록 권한 검증을 재사용한다.

## 생성한 파일
- src/clinician-receptions.js
- public/ui/clinician-reception-desk.js
- test/clinician-receptions.test.js
- scripts/clinician-flow-release.py / clinician-flow-context-release.py
- scripts/verify-clinician-flow-release.py / preview-clinician-flow.js

## 수정한 파일
- public/index.html, app.js
- public/ui/clinician-reception.js, clinician-reception.css, clinician-health.js
- src/server.js, scripts/start-public-web.js
- test/clinician-reception.test.js, clinical-theme-navigation.test.js, patient-ticket-status-http.test.js

## 구현한 기능
1. 상단 순서를 QR 접수 → 접수 내용 확인 → 환자 기록 → 검사 선택·영상 열기로 정렬.
2. 영상 메뉴는 검사 선택 화면으로 진입하고, 검사 선택의 메뉴 강조도 환자 영상으로 정렬.
3. 홈의 다음 행동은 접수 내용 보기로 통일. QR 성공 후 자동으로 뷰어로 넘어가지 않는다.
4. 접수 데스크: 현재 의료진이 현재 소속 병원에서 소비한 QR 최대 최근 100건, 목록·상세·새 QR 접수·새로고침.
5. 접수에서 고른 동의와 검사를 다음 화면에 전달. 선택한 동의에 건강기록이 없으면 다른 동의로 자동 대체하지 않는다.
6. 기존 검사 컨트롤러는 호환을 위해 숨겨서 유지. 일반 검사 목록을 접수 완료 목록으로 표시하지 않는다.

## API 변경
변경 전: 의료진 본인의 QR 사용 목록 전용 API 없음.
변경 후: GET /api/clinician/receptions → {receptions:[...]}, no-store.
반환: 티켓 ID·환자 대체 ID·기관·사용 시각·현재 동의 가용 상태 및 허용 검사 최소 메타데이터.
영향: 의료진 접수 데스크, 공개 웹 GET allowlist, HTTP 권한 테스트. 기존 발급·접수 POST 및 영상 API 계약 변경 없음.

## 보안 검토
- 서버 principal의 DOCTOR 역할, 등록 의료진 및 병원 일치 필수.
- 티켓의 사용 의료진·사용 병원·수신 병원 모두 일치해야 조회.
- 현재 동의의 환자·제공/수신 병원·상태·시각·Study/Series 범위와 교집합 적용.
- 철회·만료·미래·누락 동의는 검사·동의 상세를 반환하지 않음.
- nonce/hash/token/내부 Gateway URL/감사 원문 미반환.
- 조회 허용·거부를 감사 기록하며 저장 성공 전 결과를 공개하지 않음.
- QR 사용 기록은 당시 토큰 발급 성공이나 현재 영상 열람 성공을 뜻하지 않는다. 기존 구현은 티켓을 소비한 뒤 토큰 발급이 거부될 수 있으므로 UI에서 별도 권한 검증임을 안내.
- 원본 영상 경로, PACS, TLS, Entra 정책, 포트 변경 없음.

## 테스트 결과
| 테스트 | 결과 | 근거 |
|---|---|---|
| 관련 자동 회귀 | PASS | 10개 테스트 파일, 71개 통과 |
| 격리 HTTP 정상 QR 사용 → 목록 | PASS | 등록 의료진 200, 사용된 항목 조회 |
| 환자·비로그인·다른 의료진 | PASS | 역할 거부/401/다른 의료진 목록 제외 |
| 철회·만료·미래·범위·환자·병원 | PASS | 상세 제외 및 교집합 단위 테스트 |
| 공개 배포 제공 파일·화면 경로 | PASS | 6항목 일치 |
| 공개 비인증 접수 목록·QR 접수·DICOM | PASS | 401/401/403 |
| 로컬 화면 흐름·모바일 | PASS | 검사 선택에 QR 없음, 390px에서 documentWidth 375, 브라우저 오류 없음 |
| Azure Control/Web 상태 | PASS | Control healthy / Web running |
| 실제 Entra 의료진 QR→기록→영상 | NOT VERIFIED | 의료진 로그인 요청, 세션 미확보 |
| 이번 후보 실제 롤백 실행 | NOT VERIFIED | 이전 이미지·compose 복구 파일 보존, 이번 작업에서 실행하지 않음 |

## 배포 증적
artifacts/azure/clinician-flow-20261014 및 clinician-flow-context-20261014.
Control image: 8b8aedbb34b610675337568aab7f3a007683ced9e120915f99a74f786f31f8c0.
최종 Web image: 763636ea63ac932f48e33c0712ade7e6687df4511398d16b32adc912e6f1c2c1.
기존 VM overlay 배포 유지. azd용 Azure 스킬의 새 프로젝트 준비 경로는 적용하지 않음. UI/UX 스킬은 단계 표시·명확한 피드백·반응형 역할 분리에 적용.

## 남아 있는 위험·미검증 사항
- 실제 기기 카메라와 Entra 양성 흐름 미검증. 로컬 fixture 이미지는 실제 접수 성공 증적이 아니다.
- 현재 고정 합성 환자와 다른 환자 컨텍스트로의 전환은 UI에서 거부하며 다환자 진료 시스템 구현을 주장하지 않는다.
- 접수는 USED 티켓의 기록으로, 별도 진료 접수번호/방문 대장/병원 보관 완료를 생성하지 않는다.
- 최근 100건 제한, 페이지네이션 미구현.
- 커밋·푸시하지 않음. 기존 사용자 변경 보존.
