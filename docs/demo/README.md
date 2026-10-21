# Medi Q 포트폴리오 체험판

Azure 종료 후 GitHub Pages `/demo/`에서 실행하는 독립 정적 체험판이다.
실제 로그인·토큰 발급·서버 접근통제·DICOM 전송·모델 호출·감사 수집은 실행하지 않는다.
기존 서버/API/DB/인증 코드는 변경하지 않는다. 실제 서비스의 보안 통제와 동일하다고 주장하지 않는다.

## 디자인
- 기존 Medi Q의 건강지갑·접수데스크·관제실을 역할별로 유지한다.
- 잉크 #193454, 블루 #3264bd, 배경 #f3f7fc, 종이 #ffffff, 허용 #286953, 거부 #a73839.
- Pretendard Variable 한 계열, 제목 30–49px / 본문 16px / 보조 13px.
- 지갑은 기존 모델링 WebP를 사용하고 카드와 버튼은 실제 DOM으로 구성한다.
- 역할 선택 → 환자 공유 → QR 접수 → 열람 → 관제 → 철회/접근 차단.
- 모바일 단일 열, 키보드 포커스, reduced motion, 인쇄 전용 보고서.

## 범위
환자: 합성 기록, 조건 선택, QR 티켓, 철회, 고정 질문 카드.
의료진: 동일 탭의 티켓 접수, 선택 검사만 조회, 5분 체험 열람권한 갱신, 만료/거부.
관리자: 현재 탭 이벤트 집계, 코드 설명, 검색·기간 필터, 필터 결과 인쇄/PDF 저장.
이미지는 합성 예시 한 장으로 확대/밝기만 지원한다. 700장 CT 또는 DICOM Viewer로 가장하지 않는다.
QR 문자열은 `MEDIQ-PORTFOLIO-ONLY:DEMO-n`이며 URL/환자정보/실제 접근 권한을 포함하지 않는다.
카메라·클립보드·실제 QR 업로드는 요구하지 않는다. 별도 기기/탭의 체험 상태는 연동하지 않는다.
페이지를 새로고침하거나 초기화하면 체험 기록만 사라진다. 실제 감사로그 삭제 기능이 아니다.
상황판의 분모는 이벤트 건수다. 요청 한 번이 여러 이벤트를 만들 수 있다.

## 관련 요구사항
FR-001~005 동의, FR-006~013 기록/열람, FR-014~025 정책/단기권한,
FR-032~041 뷰어/감사 기능군을 설명하기 위한 UI 시뮬레이션이다. 해당 FR의 운영 구현 완료 근거는 아니다.

## 자산
기존 public/images/mediq-wallet-model-{front,back}.webp를 동일 복사.
기존 public/images/mediq-synthetic-abdominal-ct.png를 합성 예시로 표시.
PretendardVariable.woff2 및 동봉 라이선스는 public/fonts/pretendard에서 복사.
QR 라이브러리는 기존 public/qrcode.js (Kazuhiko Arase, MIT)를 그대로 사용한다.
역할 미리보기는 이미 공개된 assets/portfolio-20261017 화면을 재사용하며 구축 당시 캡처라고 표시한다.

## 검증 / 배포
`node --test test/portfolio-demo.test.js`로 상태 전이·거부·외부 연결 금지를 확인한다.
정적 HTTP 서버로 docs를 제공하면 별도 빌드 없이 실행된다. CSP connect-src none으로 API 통신을 차단한다.
GitHub Pages의 기존 master /docs 배포를 사용한다. Azure를 다시 생성하거나 배포하지 않는다.
