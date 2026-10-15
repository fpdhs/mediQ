# 의료진 화면 단일 소스 관리

관리 결정일: 2026-10-13. 사용자 지시: 의료진 로컬 화면과 B 웹 화면을 하나로 통일하여 관리한다.

## 단일 기준

의료진 홈은 요청 큐와 선택한 검사 상세를 배치한 단일 화면으로 고정한다. 구현은 `public/ui/clinician-home.js`와 `clinician-home.css`, 진입점은 `public/index.html#clinical-home`이다. 과거 `output/design` 시안과 캡처는 이력일 뿐 선택 가능한 제품 버전이 아니다. 홈은 현재 로그인 시나리오의 환자 이름, 실제 검사 목록, 선택된 동의와 Series 메타데이터를 사용하며 예시 환자·건수를 추가하지 않는다. 홍길동 합성 시나리오도 같은 컨트롤러의 검사 선택 → 기존 `openViewer` → 서버 정책·토큰 → Gateway 흐름을 사용한다. 홈에서 픽셀을 자동 조회하지 않으며 동의 유효와 접근 허용을 구분한다. 기본 메뉴 명칭은 진료 홈 / 환자 기록 / 환자 영상 / 공유 접수 / 병원 보관함이다.

의료진 화면의 수정 원본은 `public/index.html`의 `#hospital-saas-app`과 해당 화면이 사용하는 `public/app.js`, `public/ui/*`, 공용 스타일·이미지·폰트다. 로컬/VM 전용 의료진 화면을 따로 작성하지 않는다. 의료진 기본 메뉴는 진료 홈 / 환자 기록 / 환자 영상 / 공유 접수 / 병원 보관함이며 설명·운영 도구는 기존 시연도구에서 연다.

`scripts/clinician-bundle-stage.py`가 현재 원본을 읽어 의료진 root 전체, 원본 stylesheet 순서, 진입 스크립트와 import/CSS/이미지 의존 파일을 하나의 묶음으로 만든다. `scripts/clinician-ui.py`가 이 묶음의 검사·이미지 빌드·배포를 담당한다. 생성된 `artifacts/workstation/clinician-bundle-*/build-context`는 수정 원본이 아니다. 변경할 때 원본에서 다시 stage한다.

B의 로그인과 환자 HTML은 캡처한 호스트 shell에서 보존한다. 의료진 root는 로컬 원본과 일치하며, 공용 CSS 및 JS도 같은 바이트를 복사한다. 인증·API 주소와 데이터는 실행 환경의 차이다. UI의 단일 소스 결정은 요구사항 baseline이나 서버 권한 정책 변경을 승인하는 결정이 아니다. 관련 기능군은 FR-010~013 / FR-032~036이며 공용 모듈의 환자 동의·공유 회귀도 확인한다.

홈만 배포하던 `clinician-preparation-release.py`와 설명 화면만 배포하던 `security-journey-release.py`의 직접 실행은 종료되었다. 과거 증적·overlay helper는 이력/시험을 위해 보존한다. 새로운 화면 변경은 전체 의료진 묶음으로 적용한다. 환자 또는 다른 기능 작업에서 공용 `app.js`/CSS를 변경한 경우에도 의료진 묶음을 재생성해야 한다.

## 변경과 검증 순서

1. 원본 화면·모듈을 수정하고 관련 의료진 및 환자 회귀시험을 실행한다.
2. B의 현재 기준선을 pinned SSH로 읽어 통합 묶음을 stage한다. B 비밀번호는 기존 터미널 숨김 입력으로 전달하며 명령행·파일·채팅에 넣지 않는다.
3. `check`로 원본과 묶음의 root·파일·순서 일치를 확인한다. 원본이 바뀌거나 파일이 추가/변조되면 재생성을 요구한다.
4. 묶음을 한 번 빌드하고 이미지 바이트·보호 파일·기존 layer 일치를 확인한다. 같은 이미지를 후보 검증 및 실제 배포에 사용한다.
5. 실제 후보 인증 환경에서 의료진 로그인·전체 메뉴/API 응답·정책 거부·환자 로그인·공유 UI 회귀를 실행한다. 화면 전환 단위시험으로 이 결과를 대체하지 않는다. 신규 API가 미배포된 경우 오류 화면에 보호 데이터가 남지 않는지 확인하고 해당 API 기능은 NOT VERIFIED로 기록한다.
6. 같은 이미지의 최신 HIGH/CRITICAL 취약점 검사를 실행한다.
7. `release`가 현재 B 기준선과 설정을 재확인하고 이미지만 변경한다. 기존 복구 시험 후 재적용하며 제공 파일의 해시를 확인한다. 제공 화면이 다르면 기존 Compose 파일 목록으로 복구를 시도하고 실제 결과를 남긴다.

```powershell
# 기존 로컬 API/개발 화면 실행
npm run start:local

# B 현재 shell을 읽어 묶음 생성 (비밀번호 숨김 입력)
npm run ui:clinician:stage

# 출력된 folder와 고유 이미지 tag를 사용
$clinicianFolder = 'artifacts/workstation/clinician-bundle-<stage-output>'
$clinicianImage = 'highpass-clinician:unified-<source-revision>'
npm run ui:clinician:check -- --folder $clinicianFolder
npm run ui:clinician:check -- --folder $clinicianFolder --url http://127.0.0.1:3000
npm run ui:clinician:build -- --folder $clinicianFolder --image $clinicianImage

$env:HIPASS_CONTAINER_SCAN_IMAGE = $clinicianImage
$env:HIPASS_TRIVY_RESULT = 'artifacts/security/container-scan/clinician-unified-current.json'
npm run security:container:scan

# 실제 후보 인증 회귀 증적이 준비된 후 실행
npm run ui:clinician:release -- --folder $clinicianFolder --image $clinicianImage --scan artifacts/security/container-scan/clinician-unified-current.json --validation artifacts/workstation/<actual-flow-report>.json --apply

# 배포 제공 파일 재확인: strict CA, GET만 실행
npm run ui:clinician:check -- --folder $clinicianFolder --url https://192.168.111.149:9443/hipass --ca tmp/certs/mtls/ca.crt
```

`release`의 `--apply`를 생략하면 배포 사전검사만 수행한다. `--credential-gui`는 기존 숨김 입력 창을 사용할 때 지정한다. commit/push/merge는 수행하지 않는다.

인증 회귀 report는 실제 candidate image ID, `sourceRevision`, 다음 checks와 원본 증적 경로·SHA-256을 담는다. 각 check는 실제 실행 결과가 `PASS`일 때만 기록한다. `clinician_login`, `clinician_menu_apis`, `policy_denials`, `patient_login`, `patient_sharing`. 오래된 이미지의 증적, 누락/NOT VERIFIED check, 변조된 증적은 배포를 차단한다. 실제 실행 없이 PASS report를 생성하지 않는다.

별도 Staging의 인증 report가 없다면 `--apply --live-check --playwright <설치된 playwright/index.mjs 경로>`로 B에서 일시적으로 후보를 활성화하고 실제 브라우저 검증을 실행한다. 실패하면 원래 Compose 파일 목록/이미지로 복구한다. `clinician-ui-live-check.js`의 scope는 합성 시연 키 로그인, 메뉴 전환/API 응답과 오류 표시, 무인증·잘못된 토큰의 기존 영상 API 거부, 환자 로그인 및 공유 승인 화면 진입이다. 새로운 동의 제출·실제 영상 전송·새 건강기록 API 성공·전체 ABAC 음성시험을 포함하지 않으며 report의 `apiResponses`와 `limitations`에 구분한다. 키·토큰은 메모리에서만 사용하고 trace/header dump를 생성하지 않는다.

## 오프라인 준비

```powershell
python scripts/clinician-bundle-stage.py --baseline-folder artifacts/workstation/clinician-bundle-20261013T003107Z
```

이미 확보한 B snapshot으로 묶음을 준비할 수 있다. manifest의 `captureMode=snapshot`은 현재 원격 기준선을 다시 확인했다는 뜻이 아니다. 실제 배포 시에는 현재 container ID/image 및 설정이 캡처 기준선과 일치해야 한다. 다르면 live stage부터 다시 실행한다.

## 증적의 의미

- `source-parity.json`: 원본과 stage 파일 일치. API/인증 검증 아님.
- `served-parity-local.json`: 실행 중인 로컬 웹이 동일 root·stylesheet 순서·의존 파일을 제공하는지 확인.
- `served-parity-web.json` 또는 배포 후 `served-parity.json`: B 웹이 같은 UI를 제공하는지 확인. 영상 전송/PACS 등록 검증 아님.
- `verification.json`: 이미지의 UI 바이트와 보존된 서버·스크립트·정적 파일 확인. 인증 기능 검증 아님.
- `release-result.json`: 실제 배포/복구 결과. 실패나 미배포를 그대로 기록한다.
- `public/clinician-ui-version.js`: 민감정보 없는 관리용 sourceRevision/파일 hash. 제품 화면에 별도 운영 정보 표시를 추가하지 않는다.

## 이전 후보 실행 이력: B 유지 BLOCKED

아래는 앞선 후보의 실패·복구 이력이다. 현재 배포 상태는 다음 최신 결과를 따른다.

사용자가 제공한 B 인증 정보는 숨김 입력으로만 사용했다. 최신 시험 후보는 `artifacts/workstation/clinician-bundle-20261013T025001556100Z`, sourceRevision `4e3c6f7f22a694b6d28002b9e0ada2729c498c1441020c80a338c03936ba614b`, 이미지 `sha256:76d2ddfc2db11953a64c3d6c04f0fdfc590ad3df0228ec32df4c2b827ea8eb39`다. 로컬 GET 정적 일치 PASS, 이미지 UI 파일73개·보호 파일471개 보존 PASS, Trivy HIGH/CRITICAL 0건 PASS. Python 관리 시험15/15, 선택 Node 회귀36/36 PASS. 이는 그 후보/원본 시점의 결과이며 이후 변경된 원본의 검증 완료를 뜻하지 않는다.

실제 B 적용→기준 이미지 복구→후보 재적용은 PASS였다. `browser-regression.json`의 의료진 로그인·5개 메뉴/API 응답 및 오류 처리·정책 거부·환자 로그인·영상 공유 설정 폼 진입도 PASS, 1440/390/320px 가로 넘침 없음, page error0개였다. 공유 승인·새 동의 생성·전송·PACS 등록은 실행하지 않았다. 보관함 API는 기존 metadata-only ingress에서403 `METADATA_ROUTE_REQUIRED`, 새 건강기록 API는404였다. 각각 오류 표시와 이전 데이터 제거만 검증했고 기능 완료는 NOT VERIFIED다. 환자 UI 검증은 현재 `data-route="sharing"`의 설정 폼이며 숨겨진 구형 승인 버튼의 강제 클릭을 사용하지 않는다.

하지만 마지막 제공 파일 검사 직전에 원본이 `44feb5d8096c4e6e7e7704a24a1e46bc4d272a5fe5510ee2be67a15200cb87fc`로 변경됐다. 변경된 파일은 `public/app.js`, `public/ui/clinician-home.css`, `public/ui/clinician-home.js`, `public/ui/patient-helper.js`이며 의료진 root도 달라졌다. 버전 Gate는 `SOURCE_CHANGED_RESTAGE_REQUIRED`로 차단했다. `release-result.json`은 `status=FAIL`, `deployed=false`, `rollback=PASS`, `detail=SOURCE_CHANGED_RESTAGE_REQUIRED`다. B는 원래 `sha256:5af80fd19b6a7f49ea68f20bb64f3c1f6f9d6c5c62b5f72c680345eef1069fa3`의 healthy 상태로 복구됐다. 최종 최신 원본↔B 파일 일치는 NOT VERIFIED이며 화면 통합 배포 완료로 표현하지 않는다.

다음 Gate: 공용 원본을 변경 중인 작업을 조율하여 실제 수정 중단을 확인한 뒤 live stage→build→새 이미지 scan→인증 브라우저 시험→로컬/B 제공 파일 대조를 다시 수행한다. 원본 불일치 Gate를 우회하거나 다른 작업 변경을 되돌리지 않는다. 이 작업에서 commit/push/merge는 수행하지 않았다. 앞선 후보별 실패·복구 증적도 삭제하지 않았다.

## 최신 결과: 2026-10-13 단일 홈 배포 PASS

`artifacts/workstation/clinician-bundle-20261013T031858095793Z` 후보를 B 웹에 배포했다. 이미지 ID는 `sha256:2c09773d13276396ba5d2a6084293aec16809ce17c09b59a263b0cb2603931e0`, sourceRevision은 `5ed05082ef9bc79d1adbd6efa531be19bddff40be6c5207e5b246a533b5596e4`다. 제공 파일 75개 일치, 기존 보호 컨테이너 유지, 실제 복구 후 재적용 모두 PASS다. 해당 이미지 Trivy HIGH/CRITICAL은 각각 0건이다.

Node 선택 회귀 63건과 Python 관리 회귀 13건이 PASS다. 배포 브라우저 시험은 의료진·환자 로그인, 메뉴/API 오류 처리, 정책 거부, 환자 공유 설정 진입, 1440/390/320px 가로 넘침 없음, page error 없음으로 PASS다. 별도 `hong-viewer-regression.json`은 홈에서 TRANSFER 목적의 서버 ALLOWED·토큰 발급과 홍길동 합성 CT 픽셀 표시까지 PASS다. `--viewer-check yes`는 이 추가 시험을 실행하며 키·토큰 원문을 저장하지 않는다.

접속 주소: `https://192.168.111.149:9443/hipass/#DOCTOR`. 홈의 유효 동의 표시는 서버 접근 승인과 별개이며 기존 RBAC/ABAC·Gateway 검증을 우회하지 않는다. 새 동의 제출·전송 생성은 이번 시험에서 실행하지 않았다. 건강기록 API 404와 보관함 metadata-only ingress 403은 오류 화면만 검증했으며 해당 기능은 NOT VERIFIED다. 전체 운영 적합성이나 실제 병원 연동 완료를 의미하지 않는다.
