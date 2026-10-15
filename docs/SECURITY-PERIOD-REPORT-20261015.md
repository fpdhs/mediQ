# 보안관제실 기간 보고서 — 2026-10-15

## 작업 목적

기존 이벤트별 보고서를 보존하면서 기간·검색 조건 단위의 보고서 범위 담기와
집계·그래프·주요 근거 출력을 추가한다. 공유·감사 이력 초기화는 수행하지 않았다.

## 관련 요구사항

FR-037~041 감사로그·관제 및 FR-014~020 접근통제 원칙을 따른다.
기존 SECURITY_ADMIN 서버 인증·인가 경로를 유지한다.
새 유료 리소스, 공개 포트, 역할, 원본 영상 저장, DB 스키마 변경은 없다.

## 분석한 기존 구조

- `src/security-console.js`: 보안 이벤트 정규화·검색·집계, 이벤트 최대 50개 보고서.
- `src/server.js`: 관제실 서버 권한 검사, 조회·생성 감사 이벤트, no-store 응답.
- `public/ui/security-console.js`: 검색·이벤트 바구니·CSV/JSON/인쇄 진입점.
- `public/ui/security-report.js`: A4 보고서 미리보기·SVG 원형/막대 그래프.
- 외부 로그 수집기는 기존의 제한된 범위로 유지한다. 기간 선택이 외부 수집기의 조회 기간을 늘리는 것은 아니다.

## 생성한 파일

- `src/security-period-report.js`: 필터 일치 전체 집계, 상세 범위 검증, 고정 스냅샷.
- `public/ui/security-period-panel.js`: 기간 적용·범위 담기·고정 초안 재출력.
- `test/security-period-report.test.js`: 기간·집계·권한·소유자·감사 회귀 테스트.
- `scripts/security-period-release.py`, `scripts/verify-security-period-public.js`: 좁은 배포·확인.
- `scripts/security-period-preview.js`: loopback 전용 합성 디자인 검증 fixture. Azure 미배포.

## 수정한 파일

- `src/security-console.js`, `src/server.js`.
- `public/ui/security-console.js`, `public/ui/security-console.css`, `public/ui/security-report.js`.

## 구현한 기능

1. 최근 24시간·오늘·최근 7일·이번 달·직접 선택, 한국시간 입력/표시.
2. 서버는 한 범위를 최대 31일로 제한한다. 종료 시점은 최근 366일 이내이며 미래 조회는 거부한다.
3. `기간 적용` 후 기존 검색을 수행하면 같은 기간의 필터 일치 결과를 볼 수 있다.
4. `이 기간을 보고서에 담기`는 현재 성공한 조회의 기간·필터·대표 이벤트 참조를 고정한다.
5. `기간 보고서 초안 만들기`에서 서버가 다시 조회해 생성 시점의 집계를 고정한다.
6. 집계는 화면 페이지나 상세 50건이 아닌, 기간·필터 일치 수집 이벤트 전체를 사용한다.
7. 담긴 이벤트 중 해당 조건에 맞는 항목을 대표 근거로 사용한다. 없으면 최신 최대 50건을 선택한다.
8. 기존 개별 이벤트 바구니는 유지한다. 기간 보고서의 분모·상세 개수·필터·시간대·출처 한계를 구분한다.
9. 그래프는 숫자·표·설명을 함께 제공한다. 시각 스킬의 접근성 원칙에 따라 색상만으로 결과를 전달하지 않는다.
10. JSON·CSV·인쇄 미리보기 경로를 제공한다. CSV에는 집계와 시간별 수치 및 상세 목록을 함께 포함한다.

## API 변경 전 / 후

- 기존 `GET /api/security/events`: hours 1/6/24 기반 검색.
- 추가: 명시적인 `from`과 `until` 또는 168/744시간 조회. from과 hours 동시 지정은 거부한다.
- 기존 `POST /api/security/reports`: `{events, format}` 유지.
- 추가: `{mode:'PERIOD', events:[], format}` + 쿼리의 from/until/검색 조건.
- 재출력: `{snapshotId, format}`. 다시 집계하지 않고 같은 지문의 생성본을 돌려준다.
- 내부 `allEvents`와 `filteredEvents`는 일반 조회 API 응답에서 제거한다.
- 영향 화면: 보안관제실과 보고서 미리보기. 환자·의료진 동의/뷰어 API 계약은 변경하지 않았다.

## 보안 검토

- 서버는 기존 보안관리자 권한을 확인한다. 보고서 ID만으로 열람할 수 없다.
- 스냅샷은 생성한 actor에 묶이며, JSON 직렬화본을 보관해 사후 객체 변경으로 내용이 바뀌지 않는다.
- 메모리 캐시는 최대 32개, 재출력 가능 시간은 15분이다. 재시작·캐시 퇴출 후에는 새로 생성해야 한다.
  영구 보고서 보관함이 아니며 다운로드한 파일은 사용자 측에서 별도로 관리해야 한다.
- 생성과 출력 요청은 각각 `SECURITY_REPORT_GENERATED`, `SECURITY_REPORT_EXPORTED`로 기록한다.
  출력 요청 기록은 실제 프린터 출력 성공을 증명하지 않는다.
- raw token·QR·추가 원문 로그를 저장하거나 반환하지 않는다. 기존 안전 DTO를 재사용한다.
- DOM은 textContent를 사용하고 CSV formula injection 방어를 유지한다.
- 미연결/조회 실패와 0건을 구분한다. 외부 표본을 전체 공격·차단 통계로 표현하지 않는다.
- fingerprint는 데이터 비교용 SHA-256이며 전자서명·원본성 인증이라고 표시하지 않는다.

## 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| 관련 단위·HTTP·보안 회귀 | PASS | 7개 파일, 24개 테스트; artifacts/azure/security-period-20261015/tests.txt |
| 전체 필터 집계 vs 상세 cap | PASS | 125건 집계/50건 상세, 대표 이벤트 1건에도 분모 125 유지 |
| 0건·연결 실패 구분 | PASS | unavailable 출처 유지, 빈 보고서 허용 |
| 범위 제한·중복 조건·미래/역전 기간 거부 | PASS | 서버·KST preset 테스트 |
| 소유자·만료·다른 역할·미인증 거부 및 감사 | PASS | 신규 HTTP/스냅샷 테스트 |
| 합성 브라우저 7일·직접 선택·거부 필터·보고서 그래프 | PASS | 163건 집계/50건 상세; JPG 캡처 |
| 375px 화면/보고서 가로 넘침 | PASS | 페이지 scrollWidth 360 <= viewport 375, dialog clientWidth=scrollWidth 345 |
| Azure 배포·실제 복구 후 재배포 | PASS | deploy.json, rollback.json |
| Control 정상 상태·기존 DB/reader/기타 컨테이너 보존 | PASS | verify.json: healthy, protectedContainers PASS |
| 실행 중 후보 소스와 공개 웹 파일 SHA-256 | PASS | verify.json runtimeHashes, public-verification.json 4개 파일 |
| 공개 API 미인증·위조 역할 헤더 거부 | PASS | 두 요청 모두 HTTP 403 |
| 브라우저 실제 JSON 파일 다운로드 완료 | NOT VERIFIED | 다운로드 이벤트 대기 시간 초과. 화면은 생성 완료 표시; 파일 수신 완료 증거 없음 |
| 실제 Entra 보안관리자 계정으로 Azure 보고서 생성·출력 | NOT VERIFIED | 연결된 브라우저에 인증된 관제실 세션 없음 |
| 실제 A4/PDF 최종 페이지 분할·물리 인쇄 | NOT VERIFIED | 화면 미리보기와 기존 인쇄 CSS를 확인했으나 최종 PDF 파일 렌더링은 수행하지 않음 |

## 배포 및 남은 위험

현재 Azure Control/Web의 파일을 캡처해 HEAD 대비 이번 변경만 정확한 문맥으로 덧붙였다.
기존 뷰어 갱신·로고 수정 및 현재 서버의 다른 변경을 덮어쓰지 않았다.
환경변수·인증·네트워크·포트·마운트·읽기 전용 설정은 기존 배포 절차로 보존했다.

- Control: sha256:940e57d5e7c767b144789f61643c5dcd99fa4395d54ddd3950b1b8c36db98d15
- Web: sha256:ae14ecd9cd5636df3d86a4ca4047fb1baed29b465698d5807f2e043648c1c14a

Key Vault·Entra는 최근 24시간 최대 100건 표본, WAF는 제한된 규칙 이벤트 표본이라는
기존 한계가 남는다. 7일·월간 보고서는 이 출처들의 해당 기간 전체 수집을 보증하지 않는다.
완전한 장기 외부 집계는 별도 수집·보존·조회 설계와 검증이 필요하다.

확인: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/
→ 보안관리자 로그인 → 보안관제실 → REPORT BUILDER → 기간 적용 → 보고서에 담기 → 초안 만들기.
