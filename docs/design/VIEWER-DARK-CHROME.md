# 영상 조회 다크 테마

## 작업 목적
의료진의 환자 영상 / 영상 조회 화면에서 밝은 헤더를 없애고 상단부터 이어지는 차콜 테마를 적용한다. 이 화면의 긴 공개 시연 공지와 작은 시연 배지, 반복 시연 안내를 제거한다.

## 관련 요구사항
- FR-032~036: Viewer 표시 및 탐색.
- FR-010~013: 의료진 화면 진입과 접근 실패 안내 유지.
- 보안 정책, 동의, 토큰, 감사 API 변경 없음. 별도 NFR 번호는 재확인하지 않음.

## 분석한 기존 구조
기존 viewer-studio.css 위에 clinical-workspace.css와 clinical-glass.css가 흰색 헤더를 덮어쓰고 있었다. 상단 공지는 Azure의 별도 read-only 마운트 서버가 HTML 응답에 삽입한다. 이 서버와 마운트는 변경하지 않고, 알려진 공지의 스타일 속성과 직계 body 자식 구조에 한정한 CSS로 의료진 Viewer 활성 시에만 숨긴다. 다른 메뉴에서는 공지를 유지한다.

## 생성한 파일
- test/viewer-dark.test.js
- test/viewer_dark_release_test.py
- docs/design/VIEWER-DARK-CHROME.md

## 수정한 파일
- public/ui/clinical-glass.css: #192225 상단/도구 색상, 글자 및 버튼 대비, Viewer 전용 공지 숨김, 모바일 여백.
- public/index.html: Viewer의 시연 배지, 초기 반복 워터마크 문구, placeholder 안내, footer 시연 문구 제거.
- scripts/clinical-workspace-release.py: 현재 Azure HTML의 Viewer 영역만 한정 수정하는 배포 모드.
- test/clinical-theme-navigation.test.js: 이전 리뉴얼 전 제목을 검사하던 낡은 기대값을 현재 진료 데스크 제목으로 정정. 접근 상태 및 탐색 검증은 유지.

## 구현한 기능
두 진입 경로의 공통 다크 Viewer, 뒤로 가기 시 밝은 화면 복원, 시연 장식 제거. 환자 식별자, 접근 대기, 만료, 오류, 검사 정보, 다운로드 권한 표시를 유지한다.

## 보안 검토
실제 접근 후 생성하는 감사용 워터마크 요소 및 updateWatermark 코드는 보존한다. 서버 정책과 의료영상 픽셀, 인증, API, DB, WAF, 실행 설정은 변경하지 않는다. 공개 화면의 제한된 기능을 활성화하지 않는다. PoC 안내는 진입 및 다른 메뉴에 남아 있으며 실제 의료 운영 시스템으로 전환한 것이 아니다.

## 테스트 결과
| 테스트 | 결과 | 근거 |
|---|---|---|
| Node UI / 상태 / 접근 관련 테스트 | PASS | 24개 |
| Python 배포 변환 및 통합 목록 테스트 | PASS | 10개 |
| 두 진입 버튼 | PASS | 로컬 브라우저에서 같은 Viewer 및 동일 상단/도구 배경 rgb(25,34,37) |
| 데스크톱 / 모바일 | PASS | 1280px / 390px, 상단 위치 0, 가로 넘침 없음 |
| 검사 정보 패널 | PASS | 모바일에서 열기/닫기 |
| 밝은 진료 화면 복귀 | PASS | focus-viewer 해제 및 rgb(237,242,242) 복원 |
| 로컬 콘솔 | PASS | error 0 |
| Azure 배포 및 제공 파일 | PASS | 배포 receipt, HTTPS HTML/CSS 해시 일치 |
| 배포 후보 취약점 | PASS | Critical 0, High 0 |
| Azure 공개 브라우저 | PASS | 시연 배지 0, placeholder 안내 없음, 초기 워터마크 비어 있음, 공지 선택자 일치. 인증 전 숨겨진 의료진 DOM으로 확인 |
| 실제 DICOM 및 Azure 로그인 이후 전체 흐름 | NOT VERIFIED | UI 작업 범위, 인증 우회 없음 |

브라우저 근거: artifacts/ui/viewer-dark-20261013/.

## Azure 배포
2026-10-13 배포 완료. https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR

- 이미지: `sha256:c009cb47e25300c8b383192279a11c7501e8f6553f1bf6cc672939336e53c20b`
- 증빙: `artifacts/azure/clinical-workspace-20261013T094406230205Z/deployment.json`
- 스캔: `artifacts/security/container-scan/viewer-dark-20261013.json`
- 실제 배포 파일: public/index.html, public/ui/clinical-glass.css 두 개.
- Control API, DB, WAF, 환경변수, 포트, read-only 및 마운트 보존. 롤백 불필요.
- 공개 브라우저 로그인 이후 실제 Viewer 흐름은 NOT VERIFIED. 로컬 합성 환경의 정상 탐색으로 화면을 검증했고 Azure에서는 파일 일치, 삭제된 장식 DOM, 공지 선택자 일치를 확인했다.

## 남아 있는 위험 및 미검증 사항
공개 공지의 서버 HTML 구조가 변경되면 CSS 선택자도 함께 갱신해야 한다. 배포 검증에 해당 구조 검사를 추가했다. 실제 임상 판단 및 실제 환자 데이터 검증은 범위 밖이다.
