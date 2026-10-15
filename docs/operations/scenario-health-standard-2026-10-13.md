# 내 건강기록 확인 — 홍길동 시나리오 정렬

상태: DRAFT / UNASSIGNED. 전체 RAG/MVP/v3 완료 또는 임상 사용 승인 아님.

## 작업 목적과 요구사항

Azure 환자 웹의 `내 건강기록 → 내 건강기록 확인 → 내 기록 다시 불러오기`가
인증된 홍길동 합성 시나리오의 건강기록과 등록 CT 메타데이터를 조회하도록 연결한다.
기능군: FR-006~009(목록/메타데이터), FR-014~020(서버 접근통제),
FR-032~036(기존 Viewer 진입 유지), FR-037~041(감사). 개별 원문이 없는 ID의 세부 요건을 새로 추정하지 않는다.

## 기존 구조와 확인된 원인

- 기존 PHR drawer는 `/api/v1/me/phr/summary`, `/imaging-studies`의 P-1001 등 옛 FHIR fixture를 조회했다.
- 홍길동 검진/AFP/초음파는 `syntheticHealthRecords()`와 `/api/v1/me/health-records/synthetic`에 있었다.
- Azure Control 배포본의 synthetic handler는 비동기 Entra authenticator를 await하지 않았다.
- 기존 eligibility는 `synthetic-hcc-account`만 허용했다. 실제 Entra actor map은
  `synthetic-patient-hcc`와 `MEDIQ-SYN-HCC-001`을 사용한다.
- Azure의 공개 영상 원본 경로는 별도 제한 상태다. 이번 작업은 이를 개방하지 않는다.

## 구현 결정 / API 계약

기존 PHR API와 개발용 FHIR fixture는 유지한다. Capstone 웹 drawer만 새 서버 투영으로 전환하며
실패 시 옛 fixture로 fallback하지 않는다.

신규: `GET /api/v1/me/health-records/standard`.

- 환자 ID나 UID를 요청 입력으로 받지 않음. query/body는 거부한다.
- 검증된 인증 주체, PATIENT 역할, 고정 환자 매핑, HCC 모드, 커밋된 등록 카탈로그,
  기존 trusted ingress를 모두 확인한다.
- Entra는 authMode/authMethod와 고정 서버 actor subject를 함께 확인한다.
- 기존 legacy synthetic 주체도 그대로 지원한다. 브라우저가 보낸 역할·이름·이메일로 결정하지 않는다.
- 응답: `synthetic:true`, `clinicalUse:false`, version, records, studies, counts,
  refreshedAt, patient.displayName, fhirVersion, fhirBundle.
- 건강기록 8건: 건강검진 2025/2026 각 1건, AFP 3건, 초음파 3건.
- FHIR: Patient 1개, Observation 49개, DiagnosticReport 8개,
  등록된 ImagingStudy 1개(1 series / 700 instances). 수치는 기존 서버 함수에서 가져온다.
- 실제 진료 Encounter, 진단, 새 정상범위, 임의 LOINC 코드는 만들지 않는다.
- 초음파 PNG는 실제 DICOM ImagingStudy로 표시하지 않는다.
- FHIR Bundle은 합성 시연 투영이며 완전한 FHIR 서버/국가망 연계가 아니다.
  Bundle fullUrl의 example.org 주소는 식별용 예시 namespace이며 조회 endpoint가 아니다.
- CT Study/Series UID는 등록 카탈로그의 값을 사용한다. Pixel Data, 원본 파일,
  영구 열람 URL, 자동 다운로드, PACS 재등록은 포함하지 않는다.
- `ImagingStudy.status=registered`는 메타데이터 등록 상태이지 현재 PACS 원본 열람 성공이 아니다.
- 기존 synthetic API에도 async 인증 대기 및 Entra eligibility 수정을 적용한다.
- 성공 전 감사 저장을 기다린다. 감사 실패는 503, 응답에 기록을 포함하지 않는다.
- `SYNTHETIC_HEALTH_RECORDS_READ / SCENARIO_HEALTH_STANDARD_DELIVERED` 증적을 남긴다.

FHIR 모델 근거: [HL7 R4 ImagingStudy](https://hl7.org/fhir/R4/imagingstudy.html),
[HL7 R4 DiagnosticReport](https://hl7.org/fhir/R4/diagnosticreport.html).
공식 validator에 의한 전체 적합성 검증은 NOT VERIFIED.

## 화면 및 파일

명칭을 `내 건강기록 확인`, `내 기록 다시 불러오기`로 변경했다.
검진 상세 수치, AFP 날짜별 수치, 합성 초음파 예시와 등록 CT 건수/영상 수를 표시한다.
FHIR JSON은 별도 접힌 영역에 둔다. 값은 textContent로 출력하며 이미지 경로는 고정 허용 경로만 사용한다.
새로고침 중 중복 요청을 막고, 실패/세션 초기화 시 기존 상세 값과 JSON을 비운다.
기존 Viewer 진입 함수는 그대로 사용하며 열람 권한을 추가하지 않는다.

생성: src/scenario-health-standard.js, public/ui/scenario-health-standard.js,
public/ui/scenario-health-standard.css, test/scenario-health-standard.test.js,
scripts/scenario-health-release.py, scripts/scenario-health-remote.py,
scripts/preview-scenario-health.js 및 본 문서.

수정: src/server.js, src/synthetic-health-http.js, src/synthetic-health-records.js,
public/app.js, public/index.html, public/ui/health-record-client.js.

## 검증

| 검증 | 결과 | 근거 |
|---|---|---|
| 관련 Node 테스트 | PASS | scenario-health-standard, synthetic-health, phr-ui-contract, entra-oidc-auth, phr-service, phr-api: 41/41 |
| 후보 이미지 격리 테스트 | PASS | 실제 후보 Control + 해당 웹 파일을 network=none 컨테이너에서 검증 |
| 로컬 fixture 화면 | PASS | 8건/49항목/CT 700장, AFP 24.6 ng/mL 표시 |
| 390px 레이아웃 | PASS | viewport 390 / document scrollWidth 390 |
| 실패 시 stale 데이터 제거 | PASS | state=fail, 상세 카드 0개, FHIR JSON 0자, 재시도 버튼 활성 |
| Azure 파일 정렬 | PASS | 신규 JS/CSS·공통 client/app SHA-256 일치, HTML 변경 문구 확인 |
| Azure 인증 없음/변조 토큰 | PASS | 신규 경로 모두 HTTP 401 |
| Azure 인증 후 정상 조회 | NOT VERIFIED | 연결된 브라우저가 로그인 화면. 사용자 로그인 요청 |
| Azure CT 원본 열람·전송 | NOT VERIFIED | 원본 경로 개방/전송 작업을 하지 않음 |
| 실제 모바일 기기 | NOT VERIFIED | 390px 로컬 브라우저는 실제 휴대폰 종단 시험이 아님 |

로컬 fixture preview의 favicon.ico 404 외 치명적 UI 오류는 관찰되지 않았다.
로컬 미리보기는 loopback:3097 전용이며 인증 시험의 대체가 아니다.

## Azure 배포 및 복구

기존 VM과 네트워크를 유지한 이미지 overlay. 다른 작업의 최신 UI를 기준으로
정확한 코드 구간만 교체했다. DB·PACS·WAF·내부 ingress 컨테이너는 변경하지 않았다.
실행 환경변수·마운트·포트·권한 옵션의 동일성을 확인했다.
Compose의 `$` 재해석을 막기 위해 현재 컨테이너 환경을 보호된 파일에 정확히 보존했다.
비밀 값은 출력하거나 소스에 저장하지 않는다.

Receipt: `artifacts/azure/entra-web-20261013T101013Z-c9d99f/`

- Control: `sha256:c742db66e33f54c22846e149ae39b700161171fc94078c5e45bedd1158619e2e`
- Web: `sha256:b237f986bfed2956cf7a4254ce50d31d0ba594fdbc809af6bafa03da5168591a`
- 복구 파일: VM의 `/home/highpassadmin/.highpass-records-entra-web-20261013T101013Z-c9d99f/control-before.json`, `web-before.json`
- 복구 명령: `python scripts/scenario-health-release.py rollback --folder artifacts/azure/entra-web-20261013T101013Z-c9d99f`
- 복구 파일 준비됨. 실제 rollback 재실행은 NOT VERIFIED.

확인 주소: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/

배포 준비 중 base image tag와 파일 권한 문제를 발견해 수정했으며, 실패 후보는 서비스에 적용하지 않았다.
전용 PWA에 새 drawer는 추가하지 않았지만 공통 서버의 Entra 건강기록 조회 수정은 적용된다.
의료 콘텐츠를 새로 작성하거나 검토 PASS로 확정하지 않았으며 커밋·푸시하지 않았다.
