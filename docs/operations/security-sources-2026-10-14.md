# WAF · Entra 관제 출처 연결 — 2026-10-14

## 작업 목적 · 관련 요구사항

FR-037–FR-041 감사·이상행위 관제, FR-014–FR-020 접근정책, FR-021–FR-025 토큰 관련 사건 검색을 확장했다. 신규 NFR 번호는 임의로 부여하지 않았다.

확인 경로: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/?loginIntent=security → 보안관리자 Microsoft 인증 → 보안 관제실.

## 분석한 기존 구조

기존 앱 감사 저장소·Key Vault 조회기·보안관리자 역할 확인·검색 API·인쇄 보고서를 유지했다. Control은 기존 내부 네트워크에 그대로 있으며 인터넷이나 IMDS로 직접 접속하지 않는다. 외부 로그 조회는 기존 관리 ID 및 지정 작업 공간의 Log Analytics Reader를 가진 내부 Unix 소켓 조회기에서 수행한다.

실제 WAF는 Caddy/Coraza이며 관련 원본 로그는 Docker의 기존 json-file 회전 로그이다. 네이티브 감사 파트는 A/Z이고, Caddy JSON의 `http.handlers.waf` 메시지에서 숫자 규칙 ID를 확인했다. error 수준 메시지 및 Warning은 차단 성공 증거가 아니다.

## 생성한 파일

- `src/waf-audit.js`: 고정 내부 파일 읽기, 크기·형식·신선도·필드 최소화 검증.
- `src/entra-audit.js`: 지정 프로젝트 앱 2개의 고정 SigninLogs 검색, 민감 필드 제외, 고정 Unix 경로.
- `scripts/collect-waf-audit.py`: 고정 컨테이너 로그의 메모리 내 제한 수집, 원자적 정제 파일 갱신.
- `scripts/security-log-sources-inspect.py`: 실제 라이선스·진단 접근·로그 형식·지정 앱 테이블 조회 확인.
- `scripts/security-sources-release.py`: 현재 이미지에 최소 오버레이, 보호된 복구 설정 보존.
- `scripts/security-sources-preview.js`: 루프백 전용 합성 UI 검증 도구. Azure 배포 대상 아님.
- `test/waf-audit.test.js`, `test/waf-collector.test.py`, `test/entra-audit.test.js`.

## 수정한 파일 · 기능

- `src/server.js`: 기존 서버 역할 검증 후 3개 외부 출처 조회, WAF/Entra 실제 이벤트 검토 대상 확인.
- `src/security-console.js`: 출처별 검색·필터·집계·실제 참조 확인·보고서 확장.
- `scripts/start-security-audit-relay.js`: 정확한 `/entra-audit` 경로 추가, 출처별 중복 호출 제한·15초 캐시.
- `public/ui/security-console.js`: WAF·Entra 출처 카드 및 별도 막대 그래프, 이벤트 담기·검토·보고서 연결.
- `public/ui/security-report.js`: WAF/Entra 이름·조회 한계·탐지와 차단 구분을 인쇄 보고서에 포함.

API URL·인증 계약은 바꾸지 않았다. 기존 `/api/security/events`, `/api/security/reviews`, `/api/security/reports`의 source 선택지에 WAF/ENTRA를 추가했다. 영향 화면은 보안 관제실·검토 보고서다. 환자·의료진에게 관제 권한을 추가하지 않았다.

## 실제 수집 범위

| 출처 | 연결 | 조회 한계 |
|---|---|---|
| 앱 감사 | 기존 유지 | 저장된 선택 기간 전체 집계 |
| Key Vault | 유지 | 지정 Vault 2개, 최근 24시간 최신 최대 100건 |
| WAF | 추가 | 최근 24시간 로그의 최대 3,000줄·2MiB에서 추출한 최신 최대 500개 규칙 이벤트 |
| Entra | 추가 | 지정 프로젝트 앱 2개, SigninLogs 최근 24시간 최신 최대 100건 |

WAF 수집 주기는 60초이며 180초가 지나면 `stale`로 표시한다. 제한된 표본이므로 전체 공격 횟수·전체 요청 대비 차단률은 제공하지 않는다. 한 요청에 여러 규칙이 매칭될 수 있다. `Access denied with code 403/406`가 명시된 메시지만 DENIED로 분류하고 나머지 규칙 매칭은 DETECTED다. 이는 모든 실제 차단을 포괄하는 집계가 아니다.

Entra 응답이 0건이어도 조회 성공과 수집 완전성은 별개다. 앱 로그인 감사 기록을 Entra 원본으로 대체하거나, 서로 다른 출처의 이벤트를 시간만으로 동일 사건으로 합치지 않는다.

## Entra 라이선스·진단 설정 확인

실제 구독 SKU 조회에서 AAD_BASIC_EDU를 확인했으며 P1/P2 서비스 계획은 확인되지 않았다. 테넌트 진단 설정 GET은 AuthorizationFailed/Forbidden으로 실패해 설정 유무·카테고리·현재 목적지는 NOT VERIFIED다. 그와 별개로 기존 작업 공간의 SigninLogs 고정 검색은 실제 HTTP 200으로 응답했다.

새 테넌트 역할, Graph AuditLog.Read.All, 유료 라이선스, 새 Azure 리소스는 추가하지 않았다. 진단 설정을 변경하려면 테넌트 보안 관리자의 확인이 필요하다. 임의 업그레이드·설정 덮어쓰기는 하지 않았다.

공식 참고:

- [Microsoft: Entra와 Azure Monitor 통합, Security Administrator 등 선행 조건](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/howto-integrate-activity-logs-with-azure-monitor-logs)
- [Microsoft: Log Analytics 분석 라이선스·역할 안내](https://learn.microsoft.com/en-us/entra/identity/monitoring-health/howto-analyze-activity-logs-log-analytics)
- [Coraza: SecAuditEngine·감사 파트](https://www.coraza.io/docs/seclang/directives/)

## 보안 검토

로그 원문·요청 URL·IP·UPN·요청 본문·매칭된 입력·토큰은 추가 정제 저장소나 웹 응답으로 복사하지 않는다. WAF 로그 원문은 기존 Docker 보관 방식만 유지하며, 수집기가 새 원문 파일을 만들지 않는다. 고정 파일 읽기는 심볼릭 링크·비정상 크기를 거부하고 실패·지연은 0건 성공으로 표현하지 않는다.

Control·웹·조회기에 Docker 소켓을 마운트하지 않았다. 새 공개 포트를 열지 않았으며 WAF·DB·ingress 컨테이너는 변경하지 않았다. WAF 읽기 권한은 호스트의 고정 oneshot 작업에만 있다. 기존 최소 범위 관리 ID 권한을 유지했다.

보고서와 검토는 서버가 실제 출처·이벤트 참조를 재확인한다. 출력은 기본 escaping/textContent를 사용하고 CSV 수식 삽입을 방어한다. 로그 삭제 API는 추가하지 않았다. 정제 스냅샷은 장기 감사 원본이나 전자서명된 증적이 아니다.

## 테스트 결과

| 검증 | 결과 | 근거 |
|---|---|---|
| 로컬 Node 테스트 | PASS | 관련 13개 테스트 통과 |
| WAF Python 분류·민감 필드 제외 | PASS | 2개 테스트 통과 |
| 실제 Azure 이미지 후보 테스트 | PASS | 18/18, 역할 거부·실제 참조·보고서 포함 |
| Azure 실제 출처 조회 | PASS | 확인 시 Key Vault 68건, WAF 규칙 이벤트 298개/명시 차단 0개, Entra 지정 앱 로그인 0건 |
| 정제 수집 주기·활성 상태 | PASS | systemd timer enabled, fresh snapshot 읽기 성공 |
| Azure 웹 소스 해시 | PASS | 배포 UI 파일과 후보 해시 일치 |
| 비인증·위조 역할 헤더 | PASS | WAF/Entra events 조회 각 401 |
| 로컬 합성 UI WAF·Entra 검색 | PASS | 각 출처 필터에서 해당 이벤트 1개 표시 |
| 로컬 합성 WAF 인쇄 보고서 | PASS | 이벤트 담기 → 보고서 미리보기 → 출처·DETECTED·한계 확인 |
| 로컬 합성 375px 모바일 | PASS | 수평 넘침 없음, Entra 필터 동작 |
| 실제 Azure 보안관리자 로그인 후 검색·출력 | NOT VERIFIED | 연결 브라우저는 보안 운영 로그인 화면, 인증 우회하지 않음 |
| Entra 진단 설정 | NOT VERIFIED | AuthorizationFailed/Forbidden |
| Entra 신규 로그인 로그 도착 | NOT VERIFIED | 지정 앱 최근 조회 0건, 수집 지연·설정 확인 필요 |
| 이번 후보 실제 복구 재연습·VM 재부팅 | NOT VERIFIED | 복구 설정 저장, 실제 복구·재부팅 미실행 |
| 실제 프린터·PDF 출력 | NOT VERIFIED | 화면 보고서까지만 확인 |

## 배포 및 복구

현재 이미지는 Control `c0071c2fafac…`, Web `bd711e8e686f…`, 내부 조회기 `f6f7ec94ba47…`이다. 배포 후보·검증 영수증·복구 설정은 Gitignored/ACL 보호된 `artifacts/azure/entra-web-20261014T093111Z-efc639`에 있다.

복구 명령: `security-sources-release.py recover --folder artifacts/azure/entra-web-20261014T093111Z-efc639`. 이는 새 WAF timer를 중지하고 기존 조회기·Control·웹 이미지를 복원한다. 실제 실행은 미검증이다. 원본 로그를 삭제하지 않는다.

## 남아 있는 위험 · 미검증 사항

Entra 조회 경로의 연결은 진단 설정/라이선스 계약/전체 테넌트 수집 확인을 의미하지 않는다. 프로젝트 앱 로그인만 조회하며 비대화형·서비스 주체 로그인과 디렉터리 전체 변경 감사는 포함하지 않는다. WAF 표본·Key Vault/Entra 최대 건수에 따른 누락 가능성을 모든 그래프·보고서에서 유지해야 한다. 수집기 호스트 장애·회전 로그 소실 후 과거 원본 복구는 보장하지 않는다.

UI/UX 스킬은 출처·분모·실패 상태를 분명히 구분하고 기존 톤을 유지하는 데 적용했다. 보조 검색은 설치 모듈 누락으로 사용하지 못했다. 새 의존성·유료 리소스·권한 확장은 없으며 커밋/푸시하지 않았다.
