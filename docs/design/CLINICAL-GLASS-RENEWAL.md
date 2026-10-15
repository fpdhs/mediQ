# 의료진 글라스 UI 리뉴얼

## 작업 목적
의료진 메뉴를 일관된 글자 크기, 간격, 상태 표시로 정리하고 탐색 영역과 도구 패널에만 절제된 글라스 효과를 적용한다. 임상 데이터 영역과 영상은 불투명하게 유지한다.

## 요구사항과 범위
- FR-010~013, FR-032~036: 의료진 탐색 및 Viewer 표현. 접근 정책 변경 없음.
- FR-014~025, FR-037~041: 보안 여정의 교육용 설명. 실제 정책, 토큰, 감사 API 변경 없음.
- NFR: 접근성, 반응형, 보안 상태 식별. 승인 문서의 개별 NFR 번호는 이 작업에서 재확인하지 않았다.
- 기존 vanilla JS 모듈, clinician CSS, 본문 내 persona 구성을 유지한다.
- Azure에서 가져온 현재 HTML과 기존 실행 이미지에 변경 파일만 덧붙인다. 로컬의 병행 작업 전체를 배포하지 않는다.

## 변경 파일
- `public/ui/clinical-glass.css`: 의료진 전용 메뉴, 타이포그래피, 도구 패널, 불투명 Viewer.
- `public/ui/journey-glass.css`: 이미지 주석, 단계 탐색, 조건 비교 레이아웃.
- `public/ui/journey-lens.js`: 8개 관문별 3개 설명 지점과 설명용 상태 비교.
- `public/ui/image-journey.js`: 설명 모듈 연결 3곳.
- `public/index.html`: 스타일시트 2개 연결.
- `test/journey-lens.test.js`: 상태 분리, 범위 정규화, 안전한 DOM 처리, CSS 경계 테스트.
- `scripts/clinical-workspace-release.py`: 변경 파일 한정 배포, 원본 보존, 정확한 이미지 스캔 및 배포 검증.

## 디자인 결정
- 헤더, 단계 탐색, 도구 패널만 반투명 처리한다. 본문, 표, 상세 기록은 흰색 불투명 영역으로 유지한다.
- 청색 주요 동작, 녹색 기록, 황색 보관 상태를 구분하고 상태 문구와 함께 표시한다.
- `prefers-reduced-motion`, `prefers-reduced-transparency`, blur 미지원 fallback을 제공한다.
- 기존 8개 보안 이미지를 유지하며 공유 결정에는 기존 Azure의 `consent-v2.png`를 사용한다.
- 설명용 조건 비교는 실제 접근 허용을 선언하거나 토큰을 발급하지 않는다.

## 보안 검토
- 새 설명 모듈은 네트워크, storage, 토큰, 감사 쓰기를 사용하지 않는다.
- 사용자 설명은 `textContent`로 처리하며 새로운 HTML 삽입 경로를 만들지 않는다.
- 환자 CSS, 인증, 서버 권한, DICOM 원본 저장 정책은 변경하지 않는다.
- 공개 환경에서 제한된 시연 도구의 권한을 확대하지 않는다.
- 기존 Azure VM의 web 컨테이너만 교체하며 Control, PostgreSQL, WAF를 재시작하지 않는다.

## 검증 결과
| 테스트 | 결과 | 근거 |
|---|---|---|
| UI 모듈 단위 테스트 | PASS | Node 37개 통과 |
| 의료진 배포 목록 관리 | PASS | Python unittest 8개 통과 |
| 5개 메뉴 1280px / 390px | PASS | 실제 브라우저에서 화면 전환 및 가로 넘침 없음 |
| 8개 관문 이미지와 주석 | PASS | 8개 이미지 로딩 및 3개 주석 확인 |
| 불일치 / 응답 없음 | PASS | 서로 다른 결과, 다음 진행 차단 |
| 모바일 주석 타깃 | PASS | 390px에서 44x44, 페이지 넘침 없음 |
| 도구 Escape 종료 | PASS | 모달 닫힘 확인 |
| 환자 persona 스타일 격리 | PASS | 의료진 root hidden, 도구 blur none |
| Viewer 불투명 유지 | PASS | computed background rgb(8,12,13), backdrop-filter none |
| 브라우저 콘솔 | PASS | 해당 로컬 검증 세션 error 0 |
| Azure 후보 취약점 검사 | PASS | 정확한 배포 이미지 기준 Critical 0, High 0 |
| Azure 배포 및 제공 파일 | PASS | 배포 receipt와 HTTPS HTML/CSS/JS 해시 일치 |
| Azure 브라우저 스타일 및 모듈 | PASS | 헤더 blur(18px), 배경 rgb(237,242,242), 비교 영역 1개 및 주석 3개. 인증 전 숨겨진 의료진 영역의 DOM/계산 스타일만 확인 |
| Azure 공유 결정 이미지 | PASS | consent-v2.png SHA-256이 로컬 파일과 동일 |
| 후속 통합 배포 의존성 | PASS | 새 CSS 2개와 journey-lens.js가 bundle.dependencies()에 포함 |
| Azure 로그인 후 모든 메뉴 | NOT VERIFIED | 기존 인증이 필요한 공개 환경이며 인증 우회 없음 |
| 실제 DICOM 및 신규 접근 토큰 | NOT VERIFIED | 디자인 작업 범위 밖. 로컬 합성 데이터로 UI만 검증 |

브라우저 근거: `artifacts/ui/clinical-glass-20261013/`.

## 배포 상태
2026-10-13 Azure 배포 완료. 공개 진입 주소:
https://highpass-demo.japaneast.cloudapp.azure.com/hipass/#DOCTOR

- 기준 이미지: `sha256:2b4268121014b9e1968d2c11bf2c68dca185325898faa7b4504d7b84cad3dba6`
- 배포 이미지: `sha256:d4a9041b0634ab2fdc0e320a838af83349459d0401a4a1cf2456e34c1a7ccf64`
- 증빙: `artifacts/azure/clinical-workspace-20261013T090600220923Z/deployment.json`
- 스캔: `artifacts/security/container-scan/clinical-glass-20261013-latest.json`
- 배포 범위: 웹 파일 5개. 실행 Config, 환경변수, 마운트, 포트, read-only 설정 보존.
- Control API, PostgreSQL, WAF 컨테이너 변경 없음. 롤백 불필요.
- 초기 후보는 누적 레이어 한계와 이후 병행 배포 감지로 배포하지 않았다. 최신 이미지를 다시 캡처한 최종 후보를 별도로 검사했다. 최종 후보는 별도 레이어 재구성 없이 기준 이미지에 UI 레이어만 추가했다.
- 공개 브라우저 진입 정상, 새 스타일의 계산 결과와 설명 모듈 DOM 확인. 의료진 영역을 강제로 표시하거나 인증을 우회하지 않았다.

## 생성한 파일
`clinical-glass.css`, `journey-glass.css`, `journey-lens.js`, `journey-lens.test.js`, 이 보고서.

## 수정한 파일
`public/index.html`, `public/ui/image-journey.js`, 기존 작업 중인 `scripts/clinical-workspace-release.py`.

## 구현한 기능
의료진 메뉴의 공통 타이포그래피, 제한적 글라스 탐색 및 도구 패널, 불투명 임상 본문, 영상 보호 배경, 보안 이미지 설명 지점, 상태별 조건 비교, 모바일 배치.

## 남아 있는 위험
공개 환경의 영상 보안 여정 등 내부 시연 도구는 기존 역할 및 환경 정책에 따라 제한될 수 있다. 교육용 설명 화면과 실제 배포 보안 검증 결과는 다르다. 이 작업은 실제 의료기관 운영 적합성을 보증하지 않는다.
