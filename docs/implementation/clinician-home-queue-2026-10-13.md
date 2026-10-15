# 의료진 단일 홈 구현 및 배포

## 목적과 범위

요청 큐와 선택 검사 상세를 단일 의료진 홈으로 구현했다. 관련 요구사항은 FR-010~013, FR-032~036이다. 기존 인증·동의·정책·토큰·Gateway API와 Control/Data Plane 분리는 유지한다. 실제 환자 또는 병원 PACS는 사용하지 않는다.

## 구현

- `public/ui/clinician-home.js`, `clinician-home.css`: 실제 검사·동의 기반 검색, 상태 필터, 선택 상세, 범위·권한·기간, 영상 열기.
- `public/index.html`, `public/app.js`: 단일 홈 진입점과 기존 Viewer 연결. 홈에서 픽셀 자동 조회 없음.
- 실제 시험에서 확인한 목적 불일치를 수정했다. 선택 동의의 표시 목적을 접근 요청에 사용하고 이전 토큰·픽셀을 비운 뒤 기존 서버 정책을 다시 실행한다. 서버 PURPOSE_MISMATCH 판정은 유지한다.
- `scripts/clinician-bundle-stage.py`, `clinician-ui-live-check.js`: 단일 소스 배포와 실제 홈→정책→토큰→영상 시험.
- `test/clinician-home.test.js` 신설 및 관련 홈·배포 회귀시험 갱신.

## 실행 결과

증적 폴더: `artifacts/workstation/clinician-bundle-20261013T031858095793Z`.

| 검증 | 결과 | 근거 |
|---|---|---|
| 선택 Node 회귀 | PASS | 63건, 실패 0 |
| Python 관리 회귀 | PASS | 13건, 실패 0 |
| B 배포·복구 재적용 | PASS | release-result.json |
| 제공 UI 파일 일치 | PASS | 75개, served-parity.json |
| 의료진·환자 브라우저 회귀 | PASS | browser-regression.json |
| 반응형·콘솔 | PASS | 1440/390/320px 넘침 없음, pageErrors 없음 |
| 홈 픽셀 선조회 없음 | PASS | home_no_pixel_prefetch |
| 홍길동 합성 CT 표시 | PASS | hong-viewer-regression.json: ALLOWED·토큰·픽셀 |
| 이미지 취약점 검사 | PASS | clinician-queue-release-20261013.json: HIGH/CRITICAL 0 |
| 새 동의·전송 생성 | NOT VERIFIED | 이번 시험 범위 제외 |
| 건강기록·PACS 보관함 기능 | NOT VERIFIED | 기존 API 404 / ingress 403, 오류 UI만 검증 |

## 배포와 보안

주소: `https://192.168.111.149:9443/hipass/#DOCTOR` (접근 가능한 LAN/VM 환경).

배포 이미지: `sha256:2c09773d13276396ba5d2a6084293aec16809ce17c09b59a263b0cb2603931e0`.

의료진 홈은 한 버전으로 유지한다. 과거 시안·후보·복구 이미지는 이력이며 제품 선택 화면이 아니다. 인증정보는 숨김 입력과 시험 메모리에서만 사용했으며 보고서에 토큰·비밀번호를 기록하지 않는다. 동의 유효 표시만으로 접근을 허용하지 않고 기존 서버 검증을 실행한다. 실제 임상·운영환경 검증은 포함하지 않는다.
