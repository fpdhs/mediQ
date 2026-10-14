# 보안 사건 검토 보고서 출력 양식 Azure 반영

## 작업 목적·관련 요구사항

선택한 감사 이벤트의 출력 양식을 사건 요약, 그래프, 시간순 기록, 검토 기록, 상세 근거로 정돈했다. FR-037~FR-041, NFR의 감사 가능성·최소 정보 표시·초안과 실제 검토 구분에 해당한다. frontend-design 스킬의 기존 주제·색감 유지 원칙을 적용하여 흰 A4 용지와 Medi Q 블루를 사용했다.

## 분석한 기존 구조

기존 서버 `/api/security/reports`는 권한 확인 후 실제 이벤트 참조를 다시 조회하여 DRAFT JSON을 반환한다. 기존 웹 `printReport`는 간단한 문단을 dialog에 표시했다. 이번 변경은 해당 출력 renderer에 제한하고 서버 API·인증·보고서 생성 감사 기록은 변경하지 않았다.

## 생성·수정 파일

- 생성: `public/ui/security-report.js` — 선택 이벤트 통계, SVG 그래프, 요약·타임라인·검토 양식·근거 표 렌더링.
- 생성: `public/ui/security-report.css` — 흰 문서, A4 세로 여백·페이지 분리, 표 머리글 반복, 행 잘림 방지, 모바일 배치.
- 수정: `public/ui/security-console.js` — 기존 인쇄 진입점을 새 renderer에 연결.
- 생성: `test/security-report.test.js`, `scripts/security-report-release.py`.
- 생성: `public/mockups/security-report-preview.html`, `.js` — 로컬 합성 출력 양식 확인용이며 Azure 이미지에 포함하지 않음.

## 구현 내용

첫 구획은 보고서 번호·생성 시각·조회 기간·생성 주체, 선택 이벤트·거부/실패·검토 기록 수, 관측 사실 요약, 출처 제한이다. 원형그래프는 3건 이상에서 표시하고 1~2건은 결과 요약 표를 사용한다. 거부 사유는 상위 5개 SVG 가로 막대, 서로 다른 발생 시간대가 있는 경우 SVG 시간대 막대를 표시한다. 모든 그래프의 분모는 보고서에 선택한 이벤트이며 전체 조회 집계와 혼합하지 않는다.

다음 구획은 시간순 기록과 실제 저장된 검토자·검토일·상태·메모다. 추가 검토 의견·조치·후속 확인·서명 칸은 미작성으로 표시한다. 이 칸은 출력 후 추가 작성용이며 웹에서 수정·저장하는 새 기능은 아니다. 검토 전 초안 상태를 유지한다.

상세 근거 표와 출처 제한·데이터 SHA-256은 뒤에 둔다. SHA-256은 기존 JSON 보고서 데이터 지문이며 PDF 파일 해시나 전자서명이 아니다. 보고서 CSS가 로드되기 전에는 인쇄 버튼을 비활성화한다.

인쇄 CSS는 A4 세로, 14mm/16mm 여백, 요약·기록·근거 구획의 페이지 분리, 표 행/그래프 잘림 방지를 지정한다. 실제 페이지 수는 선택 이벤트 수와 메모 길이에 따라 늘어날 수 있다. SVG와 건수·비율 문자를 함께 사용해 색상만으로 결과를 해석하지 않도록 했다. PDF 저장은 브라우저 인쇄 기능이다.

## 보안 검토

서버가 제공하는 제한된 보고서 데이터를 DOM textContent와 SVG 속성으로 표시한다. 자유 HTML이나 새로운 AI 판정을 추가하지 않았다. 출처 제한·미연결 상태·DRAFT를 표시한다. Control, reader, 기존 역할 매핑, 외부 API 범위와 Azure 권한은 유지했다. 웹 시작 파일·인증 설정을 변경하지 않았고 새로운 Azure 리소스도 생성하지 않았다.

## 테스트 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| 선택 이벤트 통계·미확인/빈 결과·기존 보고서 API | PASS | 로컬 8/8 |
| 실제 Azure Web 후보 및 현재 Control의 격리 검사 | PASS | 8/8, report-build.json |
| 요약·원형/사유/시간대 그래프·타임라인 웹 미리보기 | PASS | 로컬 합성 8건, 거부 5건/성공 3건, 62.5%/37.5% 확인 |
| 390px 보고서 가로 넘침 | PASS | dialogWidth=359, dialogScrollWidth=359 |
| Azure 배포·원래 컨테이너 보존 | PASS | report-deploy.json, Control/reader/WAF/DB/ingress 유지 |
| 실행/공개 웹 파일 3개 해시 | PASS | report-verify.json |
| 기존 환자 웹·모바일 셸 | PASS | HTTP 200 |
| Azure 로그인 후 출력 흐름 | NOT VERIFIED | Microsoft 사용자 인증 세션 미완료 |
| PDF 파일 저장·실제 프린터 출력·실제 인쇄 페이지 수 | NOT VERIFIED | 웹 미리보기/CSS 확인까지. 로컬 인쇄 호출 중 브라우저 제어 응답이 완료되지 않아 Escape로 종료, PDF/출력물 미확인 |

## Azure 및 증적

주소: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/?loginIntent=security

보안 관제실 → 이벤트의 ＋ 보고서 → PDF / 인쇄 → 새 보고서 미리보기 → PDF로 저장 / 인쇄.

- Web 이미지: `sha256:9d183c0739ef3b7dbb68276616abe1d15ef0a27baef8a38867d2dea2a54223e7`
- 보호된 증적: `artifacts/azure/entra-web-20261014T083920Z-c8ab92/`의 report-manifest/build/deploy/verify JSON.
- 이전 Web 복구 설정: `/opt/highpass/security-release-8ecfcec87855481b974c19b128555c50/web-before.json`.
- 로컬 화면: `docs/implementation/security-report-summary-local-20261014.png`, `security-report-charts-local-20261014.png`, `security-report-mobile-local-20261014.png`.

화면 증적의 데이터는 합성 양식 확인 예시이며 Azure 운영 사건의 보고서가 아니다. 증적 상태 DRAFT / 검토자 미지정. 커밋·푸시는 하지 않았다.

## 남아 있는 위험·미검증

장문의 메모와 많은 이벤트는 인쇄 페이지 수를 늘릴 수 있다. 실제 프린터별 글꼴·배경색·용지 설정은 확인하지 않았다. 기존 Azure Key Vault 최신 100건 제한과 Entra·WAF 원본 미연결 상태는 유지된다. 기본 보고서가 검토 전 초안이므로 출력 형태가 정돈되어도 사건 판정 승인이나 원본 무결성 인증으로 해석하지 않는다.
