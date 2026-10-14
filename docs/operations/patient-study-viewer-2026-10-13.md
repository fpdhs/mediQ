# 환자 검사 목록 연결·전용 뷰어 변경 기록

2026-10-13 · DRAFT / UNASSIGNED · 커밋·푸시 없음

## 목적과 요구사항

빈 공유 검사 선택과 본인 CT 열람 실패를 분리하고, 목록 연결 및 웹/모바일 공용 어두운 뷰어를 반영한다. 관련 기능군 FR-001~009, FR-014~025, FR-032~041. 신규 영상 공개 진입점은 별도 설계이며 아직 활성화하지 않았다.

## 분석한 기존 구조

환자 dashboard의 묶음 조회에 공개 차단된 health/consent 경로가 포함되면서 Study 목록 적용도 실패했다. 건강기록 별도 새로고침은 공유 Study 선택기에 반영되지 않았다. 공개 clinical 경로 거부를 UI가 계정 거부로 단정했다. backend 본인 권한은 TEST authority/사설 DPoP origin 기반으로, Entra 인터넷 열람까지 연결된 상태가 아니었다.

## 변경

- `public/app.js`: 공개 환자 dashboard를 본인 검사·동의 두 조회로 축소. 공유 선택과 건강기록 새로고침에 동일 Study snapshot 적용. 비어 있거나 실패하면 선택/승인 fail-closed, 기존 유효 공유 초안은 보존.
- `scripts/start-public-web.js`: 정확한 `GET /api/patients/{id}/consents`만 allowlist 추가. 인증 및 backend 본인 검증 유지. health/admin/clinical 경로는 계속 차단.
- `public/index.html`, `public/ui/patient-share-review.js`: 검사 선택 이동·목록 상태·다시 불러오기 제공.
- `public/patient-pixel-viewer.js`, 신규 `public/ui/patient-pixel-viewer.css`: 공용 어두운 전용 뷰어, 슬라이더·이전/다음·확대·전체화면·닫기, 만료/늦은 응답 정리. 경로 미연결과 계정 거부 메시지 분리. 원본 다운로드나 권한 우회 없음.
- `public/mobile/sw.js`: 정적 CSS 캐시 버전 갱신. 임상 응답 캐시 추가 없음.
- 신규 `test/patient-study-connection.test.js`; pixel/share-review/consent-selection/mobile-capstone-auth 테스트 보완. 관련 VM fixture 누락을 수정했으며 테스트 밖 기존 변경은 보존.
- `scripts/verify-patient-pixel-browser.js`: 공용 뷰어의 390/1440px 및 권한/만료/닫기 브라우저 회귀.
- 신규 `scripts/patient-study-viewer-release.py`: 운영 파일 해시를 기준으로 제한된 overlay 생성·배포·검증·복구. 기존 dirty tree 전체를 배포하지 않음.

frontend-design의 기존 디자인 유지·가독성 원칙으로 검정 영상 영역과 네이비/슬레이트 조작부를 적용했다. Azure 스킬 검토 후 azd 전환 대신 이 프로젝트의 기존 VM Compose 배포 경로를 유지했다.

## 배포

증적 폴더: `artifacts/azure/entra-web-20261013T113159Z-381794`.

stage/build/deploy/verify 명령 exit 0. 웹 컨테이너만 교체했고 Control/DB/WAF/ingress는 보존했다. 신규 웹 이미지:
`sha256:e81435683b4469be912c7ac1ebb9dc87a9d4b98c6ce29d020f9b607e1c0aba7e`.

복구 명령(이번 턴 실제 복구 실행은 NOT VERIFIED):

```powershell
python scripts/patient-study-viewer-release.py rollback --folder artifacts/azure/entra-web-20261013T113159Z-381794
```

활성 배포의 bind source/복구 자료가 있으므로 증적 stage를 임의 삭제하지 않는다.

## 검증

| 시험 | 결과 | 근거/한계 |
|---|---|---|
| 관련 선택·권한·Grant·뷰어 단위 시험 | PASS | 65/65 |
| 선택 상태·모바일 인증 VM 회귀 | PASS | 추가 26/26 |
| 신뢰된 로컬 HTTPS Chrome 뷰어 | PASS | 13항목, `output/playwright/patient-pixel-browser-358f9c316a30/result.json` |
| 공개 배포 파일 해시 및 거부 경계 | PASS | verify.json 9항목: 6파일, 미인증 동의401, health/clinical403 |
| 전체 테스트 | FAIL | 1335개 중1332 PASS/3 FAIL. A1C 근거 상태, OPF adapter, privacy-isolated |
| 위 실패 3파일 순차 재실행 | FAIL | 28개 중26 PASS/2 FAIL. OPF adapter PASS, A1C와 privacy-isolated는 지속 실패. 해당 구현 범위 밖으로 미수정 |
| secret scanner | FAIL | 기존 작업 문서 경로의 task- 문자열 일부가 sk- 패턴에 걸린 1건. 실제 비밀 값이 아닌 경로 오탐으로 확인, scanner/기존 문서 미수정 |
| 실제 Azure 환자 로그인 후 선택·공유 승인 | NOT VERIFIED | 연결된 브라우저가 로그인 화면 상태. 인증 성공으로 추정하지 않음 |
| 인터넷 본인 CT 700장/실제 PACS/실제 휴대폰 | NOT VERIFIED | 신규 B HTTPS·Entra authority·origin 분리 필요 |

Chrome 검증은 2×2 합성 PNG 프로토콜 fixture이며 CT/PACS 성공 증적이 아니다. 테스트가 종료한 소유 브라우저 exit code와 late-request ERR_ABORTED는 정리 과정 결과이며 scriptErrors는 없었다. 실제 환자 동의 생성이나 의료진 권한은 임의 변경하지 않았다.

## 남은 위험과 후속

UI 배포가 본인 CT 열람 완료를 뜻하지 않는다. 신규 B 영상 HTTPS 설계는 `docs/architecture/patient-public-viewer-entry-2026-10-13.md`를 따른다. Entra actor와 권위 소유권 연결, 실제 DB ref, 별도 origin/DPoP, 공개 TLS/CORS, 실계정 웹/휴대폰 정상·거부·감사·복구 검증이 남았다. 전체 회귀 실패도 별도 해결 전 전체 PASS로 보고하지 않는다.
