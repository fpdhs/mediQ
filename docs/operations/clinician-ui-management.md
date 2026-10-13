# 의료진 화면 단일 소스 관리

관리 결정일: 2026-10-13. 사용자 지시: 의료진 로컬 화면과 B 웹 화면을 하나로 통일하여 관리한다.

## 단일 기준

의료진 화면의 수정 원본은 `public/index.html`의 `#hospital-saas-app`과 해당 화면이 사용하는 `public/app.js`, `public/ui/*`, 공용 스타일·이미지·폰트다. 로컬/VM 전용 의료진 화면을 따로 작성하지 않는다. 의료진 기본 메뉴는 진료 준비 / 환자 기록 / 환자 영상 / 공유 접수 / 병원 보관함이며 설명·운영 도구는 기존 시연도구에서 연다.

`scripts/clinician-bundle-stage.py`가 현재 원본을 읽어 의료진 root 전체, 원본 stylesheet 순서, 진입 스크립트와 import/CSS/이미지 의존 파일을 하나의 묶음으로 만든다. `scripts/clinician-ui.py`가 이 묶음의 검사·이미지 빌드·배포를 담당한다. 생성된 `artifacts/workstation/clinician-bundle-*/build-context`는 수정 원본이 아니다. 변경할 때 원본에서 다시 stage한다.

B의 로그인과 환자 HTML은 캡처한 호스트 shell에서 보존한다. 의료진 root는 로컬 원본과 일치하며, 공용 CSS 및 JS도 같은 바이트를 복사한다. 인증·API 주소와 데이터는 실행 환경의 차이다. UI의 단일 소스 결정은 요구사항 baseline이나 서버 권한 정책 변경을 승인하는 결정이 아니다. 관련 기능군은 FR-010~013 / FR-032~036이며 공용 모듈의 환자 동의·공유 회귀도 확인한다.

홈만 배포하던 `clinician-preparation-release.py`와 설명 화면만 배포하던 `security-journey-release.py`의 직접 실행은 종료되었다. 과거 증적·overlay helper는 이력/시험을 위해 보존한다. 새로운 화면 변경은 전체 의료진 묶음으로 적용한다. 환자 또는 다른 기능 작업에서 공용 `app.js`/CSS를 변경한 경우에도 의료진 묶음을 재생성해야 한다.

## 변경과 검증 순서

1. 원본 화면·모듈을 수정하고 관련 의료진 및 환자 회귀시험을 실행한다.
2. B의 현재 기준선을 pinned SSH로 읽어 통합 묶음을 stage한다. B 비밀번호는 기존 터미널 숨김 입력으로 전달하며 명령행·파일·채팅에 넣지 않는다.
3. `check`로 원본과 묶음의 root·파일·순서 일치를 확인한다. 원본이 바뀌거나 파일이 추가/변조되면 재생성을 요구한다.
4. 묶음을 한 번 빌드하고 이미지 바이트·보호 파일·기존 layer 일치를 확인한다. 같은 이미지를 후보 검증 및 실제 배포에 사용한다.
5. 실제 후보 인증 환경에서 의료진 로그인·전체 메뉴 API 정상·정책 거부·환자 로그인·공유 회귀를 실행한다. 화면 전환 단위시험으로 이 결과를 대체하지 않는다.
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

인증 회귀 report는 실제 candidate image ID, `sourceRevision`, 다음 checks와 원본 증적 경로·SHA-256을 담는다. 각 check는 실제 실행 결과가 `PASS`일 때만 기록한다. `clinician_login`, `clinician_menu_apis`, `policy_denials`, `patient_login`, `patient_sharing`. 오래된 이미지의 증적, 누락/NOT VERIFIED check, 변조된 증적은 배포를 차단한다. 이 report를 자동으로 PASS로 생성하지 않는다.

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

2026-10-13 이번 작업에서 로컬 제공 파일과 통합 묶음은 일치했다. B 웹 GET 검사에서는 `SERVED_WORKSPACE_DIFFERS`가 관측됐다. 아직 B 배포본이 통합 묶음으로 교체되지 않았으므로 웹의 화면 일치를 PASS로 표시하지 않는다. B VM 인증 정보와 실제 후보 인증 회귀가 후속 실행의 선행조건이다.
