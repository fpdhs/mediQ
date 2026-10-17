# 의료진 QR 접수 홈 — 2026-10-13

## 작업 목적
의료진 첫 화면을 QR 접수의 시작점으로 변경. 홈 → 접수 데스크 → 환자 기록 → 환자 영상 순으로 정렬.

## 관련 요구사항
FR-010~013 의료진 접근, FR-014~020 정책 검증, FR-021~025 단기 토큰, FR-037~041 감사 그룹에 영향. 기존 서버 계약은 변경하지 않음. 별도 NFR 세부 ID는 이번 변경에서 확정하지 않음.

## 분석한 기존 구조
Vanilla JS public/app.js의 QR 카메라·수동 입력 및 redeemScannedNonce 경로를 재사용. 기존 clinician-home 검사 큐와 세부 정보는 접수 데스크로 이동. Azure 공개 접수 API /api/demo/qr/redeem 및 기존 DPoP·동의 검증 유지.

## 생성한 파일
- public/ui/clinician-reception.js, .css
- test/clinician-reception.test.js
- scripts/clinician-reception-release.py
- scripts/verify-clinician-reception-release.py
- scripts/preview-clinician-reception.js (루프백 전용, API 없음)

## 수정한 파일
- public/index.html: 메뉴 순서 및 dashboard/qr 화면 매핑
- public/app.js: 홈 초기화, 카메라 정지 조건, 공개 QR 접수 후 홈 유지, 시연 코드 입력 이동, 입력 중복 방지
- test/clinical-theme-navigation.test.js: 변경한 화면 계약

## 구현한 기능
- 홈의 카메라 스캐너와 QR 불러오기(이미지·코드) 펼침
- PNG/JPEG/WebP 8MB 이하 이미지의 로컬 해독, 2,500만 픽셀 제한 및 1,600px 축소
- 이미지 인식 후 명시적 접수 버튼으로 기존 서버 요청
- 이번 접수 결과·동의·단기 권한 표시 및 접수 데스크/기록/영상 이동
- 390px 단일 열 배치, 포커스 표시, 과도한 스캐너 애니메이션 제거

## 보안 검토
이미지를 서버에 업로드하거나 브라우저 영구 저장하지 않음. 이미지 해독은 권한 부여가 아님. 기존 폼의 동일 출처 링크·코드 검증 및 서버 정책을 그대로 사용. 입력 파일 형식·크기 제한, 비동기 결과의 화면 이탈/역할 전환 보호. 서버의 인증·동의·토큰·감사 로직 변경 없음. 접수를 영상 수신·보관 성공으로 표시하지 않음.

## 배포
현재 Azure 웹 컨테이너에서 해당 코드 블록만 교체. Control, B Gateway, PACS, 포트·인증 설정 변경 없음. start-public-web.js 바인드 파일은 기존 내용을 유지. 후보 이미지 및 복구 정보는 artifacts/azure/clinician-reception-20261013에 기록. 커밋·푸시하지 않음.

## 테스트 결과
| 테스트 | 결과 | 근거 |
|---|---|---|
| 모듈 문법 및 관련 자동 테스트 | PASS | 21 + 39 = 60개 통과 |
| 로컬 브라우저 화면·불러오기 펼침 | PASS | AX 및 screenshot, 오류 로그 없음 |
| 모바일 390px 가로 넘침 | PASS | viewport 390 / documentWidth 375 |
| Azure 제공 파일 및 화면 매핑 | PASS | public-verification.json 4항목 |
| 비인증 QR 접수·직접 DICOM 접근 차단 | PASS | 401 / 403 |
| 웹 이미지 복구·재배포 | PASS | rollback.json 이전 이미지 복구, deploy.json 새 이미지 복원 및 외부 파일 재확인 |
| 실제 Entra 의료진 QR 접수·영상 연결 | NOT VERIFIED | 브라우저에 로그인 세션 없음 |
| 실기기 카메라·이미지 파일 업로드 UI 전체 흐름 | NOT VERIFIED | 실제 카메라 권한·티켓 소진 미실행 |

## 남아 있는 위험·미검증
실제 QR를 소진한 접수 및 후속 영상 열람은 의료진 로그인 후 확인 필요. 로컬 화면 fixture는 실제 인증 성공의 증거가 아님. 기존 공개 영상 제한은 이 UI 작업에서 해제하지 않음. 접수 데스크의 검사 목록은 기존 공유 검사 조회이며 별도의 영속 접수 대장 신설은 아님. 전체 프로젝트 테스트를 실행한 결과가 아니라 관련 회귀 테스트 결과임.
