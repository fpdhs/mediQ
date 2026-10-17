# 환자 작업 화면 통일 및 상단 안내 제거

상태: DRAFT / UNASSIGNED · 2026-10-13 (Asia/Seoul)

## 목적과 요구사항

- 공유 내용 확인(activity), 영상 공유(sharing), 공유 승인 전 확인(consent)을 기존 건강기록·건강도우미의 펼쳐진 카드와 통일.
- 메뉴명과 화면 제목 일치. 웹 32px / 650px 이하 26px, 본문 16px, 공통 여백과 반환 버튼.
- 요청한 상단 `인터넷 합성 시연 · CT 열람/전송 및 일부 내부 기능은 연결 준비 중입니다.` 제거.
- FR-001~005 동의 관리, FR-006~009 검사 목록, FR-014~020 접근정책, FR-037~041 감사 기능군에 영향 검토. 개별 FR 원문 부재로 기능군 수준 추적.

## 분석한 구조 및 구현 결정

기존 JavaScript DOM 기반 UI와 지갑 모델링 자산을 유지한다. 전용 화면의 상이한 큰 제목,
공유 화면을 제외하던 typography 예외, 공유 이력의 분리된 제목 배경을 정리했다.
공유·승인·이력의 기존 요소를 static `.patient-task-card`로 감싸고 하단 지갑은 형제 요소로 유지한다.
건강기록·건강도우미 제목은 메뉴명으로, 친근한 문구는 보조 설명으로 이동했다.

기존 입력 ID, 이벤트 핸들러, 명시적 승인 체크, 승인 전 disabled, 인증·범위·기간·철회·감사는 유지.
API 계약 변경 없음. 새로운 동의나 PACS 전송을 생성하지 않음.
합성·비임상 표시와 원본 접근 제한은 화면 내부 및 로그인에 남아 있다.
frontend-design 스킬은 기존 시각 언어와 공통 글자 체계 유지에 활용했다.
Azure azd 스킬은 기존 VM overlay 방식에 맞지 않아 기존 이미지/Compose 방식과 pinned SSH를 사용했다.

## 파일

수정:
- public/index.html
- public/ui/patient-health.js
- public/ui/patient-helper.js
- public/ui/patient-typography.css
- public/ui/patient-wallet-experience.css
- scripts/start-public-web.js
- test/patient-sharing.test.js (이전 홍보성 제목 단언 갱신)

생성:
- scripts/patient-task-ui-release.py
- scripts/preview-patient-task-ui.js (loopback:3098 전용, API 없는 합성 UI fixture)
- test/patient-task-ui.test.js
- 본 문서

## 검증

| 항목 | 결과 | 근거 |
|---|---|---|
| 관련 자동 테스트 | PASS | patient-task-ui, patient-sharing, patient-history, wallet-home, patient-health, patient-helper: 53/53 |
| 실제 후보 이미지 JS 문법 | PASS | network=none, read-only, cap-drop=ALL 컨테이너 node --check |
| 로컬 1280px 공유·이력 | PASS | CUA 브라우저: h1 32px, document scrollWidth 1265 <= viewport 1280 |
| 로컬 390px 5개 작업 화면 | PASS | 공유·이력·승인 전 확인·건강기록·건강도우미 h1 26px, scrollWidth 375 <= 390 |
| 초안 상호작용 | PASS | 병원 미선택 버튼 disabled → B 선택 후 요약 변경·버튼 활성. 실제 동의 생성 없음 |
| 카드/지갑 구조 | PASS | 승인 화면 task-card 1개, 하단 dock 형제 요소 확인 |
| 로컬 브라우저 콘솔 | PASS | error 로그 없음 |
| Azure 제공 HTML/JS/CSS | PASS | 배포 receipt SHA-256 대조, HTML의 기존 인증 marker 삽입만 정규화 |
| Azure 안내 제거 | PASS | /hipass/ 실제 시작 화면 스크린샷·DOM, /mobile/ HTTP 응답에서 문구 없음 |
| Azure 인증 후 공유 승인·철회 종단 흐름 | NOT VERIFIED | 연결된 브라우저에 인증 세션 없음. 로컬 fixture는 인증 검증 대체 아님 |
| 실제 휴대폰/PWA 캐시 전환 | NOT VERIFIED | 반응형 웹 검증이며 전용 PWA 전체 화면 변경은 범위 밖 |
| 복구 실행 | NOT VERIFIED | 이전 이미지·Compose 보존, 실제 rollback 실행 안 함 |

## 배포 및 복구

Receipt: `artifacts/azure/entra-web-20261013T105046Z-315108/`

- 기존 웹: sha256:b237f986bfed2956cf7a4254ce50d31d0ba594fdbc809af6bafa03da5168591a
- 후보/현재 웹: sha256:57e48b02498d71052a8f09cdc04aeb2a665cdcb4b6f370874cf321602cc3c411
- Control·DB·WAF·ingress 컨테이너 ID 보존. 런타임 환경·사용자·포트·보안 옵션 보존.
- 첫 배포 후 상단 안내 잔존 검증 FAIL: 실행 스크립트가 별도 read-only bind mount여서 이미지 파일보다 우선 적용됨.
- 원본 bind 파일을 덮어쓰지 않고 새 버전 스크립트로 source 경로만 교체. mount 대상·read-only 속성 유지. 재검증 PASS.
- 새 bind: `/home/highpassadmin/.highpass-task-ui-entra-web-20261013T105046Z-315108/scripts/start-public-web.js`
- 이전 전체 설정: 동일 폴더 `web-before.json`; 중간 배너 교체 전 설정 `web-banner-before.json`.
- 전체 복구: `python scripts/patient-task-ui-release.py rollback --folder artifacts/azure/entra-web-20261013T105046Z-315108`
- 해당 원격 release 폴더는 실행 bind를 포함하므로 삭제 금지.

배포는 현재 운영 중인 파일을 캡처한 뒤 정확한 구간만 변환했다. unrelated dirty worktree 파일, 의료 데이터,
인증·RAG 서버 코드는 배포하지 않았다. 새 자원·네트워크 공개·비용 변경 없음. 커밋·푸시하지 않았다.

확인: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/
