# 보안 관제실 상황판·검색·보고서 Azure 적용

보고서 그래프·A4 출력 양식의 후속 배포는 [출력 양식 적용 기록](security-report-print-2026-10-14.md)을 참고한다. 후속 Web 이미지에는 아래 관제실 기능이 보존되어 있다.

## 작업 목적

기존 앱 감사 및 Azure Key Vault 감사 연결을 유지하며, 운영자가 사건을 탐색하고 근거를 모아 보고서를 생성하는 화면을 구현했다. 디자인은 frontend-design 스킬의 주제 중심 구성에 따라 Medi Q 네이비 상황판과 밝은 이벤트 탐색 영역을 사용했다.

## 관련 요구사항

- FR-037~FR-041: 감사로그, 접근 거부, 이상행위 확인 및 운영 검토.
- FR-014~FR-025: 정책·토큰 관련 감사 결과를 조회하며 기존 접근 검증을 유지.
- NFR: 서버 역할 확인, 최소 정보 표시, append-only 감사, 출처 실패와 0건 구분.

## 분석한 기존 구조

Node.js Control, PostgreSQL/기존 store, 정적 ES 모듈 웹, 기존 Docker Compose 배포를 사용한다. 기존 `/api/security/overview`는 앱 최근 64건과 경보, 무결성, Key Vault 최근 24시간 최대 100건을 반환한다. 일반 서비스의 앱 목록은 최대 200건이라 전체 통계에 재사용하지 않았다. 기존 관리 ID 기반 Key Vault reader는 Unix 소켓으로만 Control에 연결된다.

## 생성한 파일

- `src/security-console.js`: 제한된 검색 계약, 저장된 앱 기록의 기간 전체 집계, 안전한 이벤트 인덱스, 보고서 생성.
- `public/ui/security-console.js`, `public/ui/security-console.css`: 상황판, 그래프, 검색, 상세, 검토, 보고서 바구니, 미리보기 및 내보내기.
- `test/security-console.test.js`: 권한·필터·집계·보고서 참조·CSV 검증.
- `scripts/security-console-release.py`: 실제 현재 이미지 위 변경만 적용하고 복구 설정을 보존하는 배포 경로.
- `public/mockups/security-console-preview.html`, `.js`, `.css`: 로컬 합성 확인용. Azure 변경 파일에는 포함하지 않았다.

## 수정한 파일

- `src/server.js`: 이벤트 검색·보고서 API와 감사 기록 추가. 기존 검토 기록을 읽을 때 입력 계약 재확인.
- `public/app.js`: 보안 역할의 관제 화면을 새 모듈로 연결.
- `public/index.html`: 전용 스타일 연결.
- `scripts/start-public-web.js`: 새 두 API 경로 허용. 실제 배포에서는 캡처한 현재 시작 파일의 동일 허용 목록만 수정.

## 구현한 기능

- 네이비 상황판, 확인할 거부·실패 수, 출처 상태, 결과 원형그래프, 거부 사유 막대그래프, 시간별 막대그래프, 행위 분류.
- 그래프의 결과·사유·분류 클릭을 검색 필터로 연결.
- 서버 검색: 키워드, 출처, 결과, 기관·자원, 검토 상태, 최근 1/6/24시간, 30건 단위 페이지.
- 집계는 선택한 기간에 저장된 앱 기록 전체를 사용하고 상세 페이지/검색 결과와 구분. 페이지 이동은 고정된 조회 종료 시각을 사용.
- 같은 감사 세션의 관련 기록을 상세에 표시. 공통 세션 없는 이벤트는 자동으로 연결하지 않음. 최신 30건 제한 명시.
- 기존 검토 API로 접근 거부·실패 및 Key Vault 이벤트의 검토 메모 추가.
- 보고서 바구니 최대 50건. 서버가 실제 이벤트를 다시 찾고 JSON 보고서 생성. `DRAFT`, 조회 범위, 선택 근거, 검토 기록, 출처 한계와 보고서 데이터 SHA-256 포함.
- 같은 화면의 보고서 미리보기와 브라우저 PDF 저장/인쇄, CSV·JSON 다운로드. PDF는 브라우저 인쇄 기능이며 서버 PDF 파일 생성 기능은 아님.
- `SECURITY_EVENTS_SEARCHED`, `SECURITY_REPORT_GENERATED`를 기존 저장소에 기록. 생성 감사는 다운로드 완료나 인쇄 완료를 증명하지 않음.

## API 변경

| 변경 전 | 변경 후 | 영향 화면 |
|---|---|---|
| 최근 제한된 `/api/security/overview` 목록 | 기존 유지 + `GET /api/security/events` | 보안 관제실 집계·검색·관련 실행 |
| 보고서 API 없음 | `POST /api/security/reports` | 보고서 바구니·미리보기·CSV/JSON |

두 신규 API는 기존 Entra 인증 후 SECURITY_ADMIN/PLATFORM_ADMIN을 서버에서 확인한다. 검색 기간은 최대 24시간, 과거 종료 시각은 최대 7일 이내로 제한한다. Azure 자료는 현재 reader의 24시간 최신 100건만 사용하므로 과거 선택 기간의 Azure 전체 건수를 보증하지 않는다.

## 보안 검토

정형 검색 계약, 검색 입력 길이/중복/기간 검증, 서버에서 실제 참조 검증, 최대 50건 보고서, CSV 수식 시작 문자 방어, DOM textContent 사용, no-store 응답을 적용했다. 원시 토큰·DICOM UID·요청 URI·Azure 원시 claims를 추가로 반환하지 않았다. 사용자 검색 문자열은 감사 사유에 저장하지 않는다. 기존 환자/의료진 역할, Control 내부 네트워크, reader, WAF, DB, 사설 ingress와 외부 포트를 보존했다. Azure 리소스·RBAC는 추가하지 않았다.

## 테스트 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| 최종 Azure 후보 이미지 검사 | PASS | 12/12, `console-build.json` |
| 250건 전체 집계·필터·페이지 | PASS | UI 페이지 30건과 전체 250건/거부 125건을 별도 확인 |
| 익명·환자·의료진 신규 API 접근 | PASS | 격리 API 401/403 |
| 위조/중복 보고서 이벤트, 잘못된 검색 | PASS | 400/409, 테스트 참조 |
| 보고서 생성 감사·기존 근거 유지·CSV 수식 방어 | PASS | API 재조회 및 CSV 검사 |
| 로컬 브라우저 검색·담기·초안 미리보기 | PASS | 검색 결과 1건, 보고서 생성 화면 확인 |
| 390px 로컬 배치 | PASS | viewport 390, document scrollWidth 375(스크롤바 제외), 화면 확인 |
| 첫 Azure 전환 | FAIL (복구 후 해결) | 시작 파일 읽기 권한 변경으로 Web 전환 실패 |
| 첫 전환의 이전 이미지 복구 | PASS | `console-recover.json`, 이전 Control/Web 이미지 및 정상 상태 확인 |
| 수정 후 Azure 재배포 | PASS | `console-deploy.json`, 설정·마운트·네트워크·reader 보존 |
| 실행 소스·공개 JS/CSS 해시 | PASS | `console-verify.json` |
| Azure 새 경로 익명·위조 역할·변조 토큰 | PASS | 4개 요청 401, 공개 경로 미설정 오류 아님 |
| 실제 Key Vault reader 조회 | PASS | 확인 시 최근 24시간 62건, 고정 시연 수치 아님 |
| 기존 환자 웹·모바일 셸 | PASS | HTTP 200 |
| Azure 보안관리자 로그인 후 새 화면·보고서 다운로드 | NOT VERIFIED | Microsoft 사용자 인증 세션 미완료 |
| 실제 PDF 파일 저장·실제 모바일 단말 | NOT VERIFIED | 미리보기/390px 브라우저 배치까지만 확인 |
| 최종 후보의 별도 계획된 복구 리허설 | NOT VERIFIED | 첫 전환 실패 복구는 확인, 최종 후보 재복구 시험은 별도로 수행하지 않음 |

로컬 화면 증적: `docs/implementation/security-console-desktop-local-20261014.png`, `security-console-mobile-local-20261014.png`, `security-console-report-local-20261014.png`. 로컬 합성 확인 화면이며 Azure 운영 로그 화면으로 오인하지 않는다.

## Azure 적용 및 증적

주소: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/?loginIntent=security

- 최종 Control: `sha256:a5b7dc5fa6af1553110c6b3790445d716b1195155de8c439d82722eb8aba7a36`
- 최종 Web: `sha256:cb8958bc691523b8c1a097ec8a292eacb7d4f1d2f65eb9b871eef151a719296d`
- 보호된 증적: `artifacts/azure/entra-web-20261014T080422Z-f4fb35/`의 baseline, console-manifest/build/recover/deploy/verify JSON.
- 복구 Compose: `/opt/highpass/security-release-1e607105fc7243f99465041dbaba684b/control-before.json`, `web-before.json`. 이전 이미지와 소스/설정은 보존.
- 시작 파일은 비루트 Web에서 읽을 수 있는 0644로 복구했고 재배포 스크립트는 이후 파일 모드를 임의로 변경하지 않는다. 첫 실패의 자동 복구는 Web 재시작에서 중단됐고, 명시적 recover 단계로 Web과 Control을 모두 복구했다.

## 남아 있는 위험·미검증

Entra 로그인 원본 및 WAF 원본 로그는 별도 미연결이다. Gateway 분류는 앱 감사 경로에 기록된 이벤트의 관측이며 Gateway 실시간 정상 상태를 증명하지 않는다. Key Vault는 최신 100건 조회 제한을 표시한다. 앱 저장소 집계는 실제 수집 누락 여부를 증명하지 않는다. 기존 해시 체인 검증 오류가 있으면 화면에 그대로 표시하며 원본 기록은 수정하지 않는다. 보고서 지문은 JSON 보고서 데이터의 내용 비교용이며 PDF/CSV 파일 바이트 해시나 전자서명이 아니다.

증적 상태는 DRAFT / 검토자 미지정이다. 커밋·푸시는 수행하지 않았다.
