# Patient Web Sharing Baseline

2026-10-13 사용자 지정 기준: `https://192.168.111.149:9443/hipass/#PATIENT`의 영상 공유 화면.

## 화면 기준

- 제목: 내 영상을, 필요한 병원에.
- 왼쪽 영상 전달 카드: 검사, 받는 병원, 공유 목적, 허용 작업, 시작과 종료 시각.
- 오른쪽 요약: 이렇게 공유해요. 검사, 목적, 허용 작업, 다운로드 여부와 기간을 승인 전에 표시.
- 공유 내용 확인하기 이후 별도 확인 화면에서 승인.
- 아래 현재 공유 및 지난 공유 내역.

`public/index.html`의 `.sharing-page`가 환자 웹의 단일 구현 기준이다. `createSharingSurface`의 웹 호출은 이 폼을 유지하며 모바일용 `sharing-wallet-v2` 셸을 적용하지 않는다. 전용 모바일 PWA는 `/mobile/`의 단계별 흐름을 사용한다.

공통 타이포그래피는 선택된 공유 화면을 덮어쓰지 않는다. 공유 화면은 기존 `patient-sharing.css`와 `wallet-home.css`의 표현을 사용한다.

## 확인 범위

배포 서버의 HTML 및 정적 자산을 프로젝트 CA로 TLS 검증하여 비교했다. 배포된 공유 폼은 위 구성이고, 배포된 `patient-sharing.js`에는 새 지갑 셸 생성 함수가 없다. 로컬의 새 지갑 셸이 화면 차이의 원인이었다.

관련 요구사항: FR-001~FR-005. 변경 범위는 공유 폼과 요약 표시이며 API, 서버 접근정책, 토큰 계약은 유지한다. 항목 선택은 초안만 변경하며 동의 승인은 별도 단계이다.

로그인 후 실제 사용자 세션의 영상 조회는 이 UI 변경의 검증 범위에 포함하지 않는다.

## 검증 결과

| 항목 | 결과 | 근거 |
|---|---|---|
| 배포 기준 조회 | PASS | 프로젝트 CA로 검증한 HTTPS에서 폼과 공유 모듈 비교 |
| 공유 및 승인 확인 회귀 | PASS | `patient-sharing.test.js`, `patient-share-review.test.js`의 18개 테스트 |
| 모바일 및 지갑 회귀 | PASS | `mobile-wallet-design.test.js`, `wallet-open.test.js`, `wallet-home.test.js`의 7개 테스트 |
| 웹 화면 렌더링 | PASS | 합성 미리보기에서 기준 제목·Pretendard·폼·요약 확인 |
| 작은 화면 | PASS | 폭 390px에서 한 열 배치, 입력 필드와 문서의 가로 넘침 없음 |
| 실제 로그인 및 영상 접근 | NOT VERIFIED | 실서비스 세션으로 동의·접근·영상 조회를 수행하지 않음 |

캡처: `artifacts/ui/patient-sharing-reference-20261013/desktop.png`, `narrow-web.png`. 로컬 미리보기는 동의를 생성하거나 PACS에 접근하지 않는다. 배포 서버 재배포는 수행하지 않았다.
