# 🏥 하이패스 (Hi-Pass) Platform
> **환자 동의 기반 의료영상(DICOM) 안전 교류 및 프라이버시 보호 AI 건강도우미 플랫폼**  
> *CD 없는 병원 간 진료 연속성 확보 · Zero Cloud Storage · Security by Design*

<p align="center">
  <img src="https://img.shields.io/badge/Platform-HiPass_v3-0052CC?style=for-the-badge&logo=mediamonkey&logoColor=white" alt="HiPass Platform" />
  <img src="https://img.shields.io/badge/Node.js-v24_ESM-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Cloud-Azure_VM-0078D4?style=for-the-badge&logo=microsoftazure&logoColor=white" alt="Azure" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Medical_Standard-DICOMweb_/_HL7_FHIR-E11D48?style=for-the-badge" alt="DICOMweb / FHIR" />
  <img src="https://img.shields.io/badge/Database-PostgreSQL_16_RLS-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL RLS" />
  <img src="https://img.shields.io/badge/Local_LLM-Ollama_Qwen_3.5_4B-7C3AED?style=for-the-badge" alt="Ollama LLM" />
</p>

---

## 📌 Executive Summary
**하이패스(Hi-Pass) Platform**은 기존 의료 현장의 고질적인 문제인 **CT·MRI·X-ray 의료영상 CD 발급·직접 운반·병원 등록 절차를 혁신**하기 위해 개발된 클라우드 기반 의료영상 및 진료정보 교류 플랫폼(MVP/PoC)입니다.

환자의 **명시적 동의(Consent)**를 바탕으로 타 병원 의료진에게 필요한 기간 동안만 안전하게 영상을 스트리밍하며, **Zero Cloud Storage(클라우드 원본 지속 저장 금지)** 원칙과 **RBAC + ABAC 기반 5분 만료 단기 토큰** 기술을 통해 강력한 보안성과 개인정보 보호를 달성합니다. 나아가 환자가 자신의 검사 결과와 질환을 쉽게 이해할 수 있도록 **개인정보 격리형(Prompt Isolation) 2-Layer 한국어 AI 건강도우미**를 탑재했습니다.

---

## 🌐 Live Demo & Environments

| 환경 | 엔드포인트 / URL | 설명 | 상태 |
|---|---|---|---|
| **Azure Live 환자웹** | [https://highpass-demo.japaneast.cloudapp.azure.com/hipass/](https://highpass-demo.japaneast.cloudapp.azure.com/hipass/) | Azure VM 멀티 컨테이너 실배포 환경 | **LIVE OPERATIONAL** |
| **로컬 워크벤치 프리뷰** | `http://127.0.0.1:3099/` | 개발용 인터랙티브 RAG 및 UI 검증 워크벤치 | **LOCAL ACTIVE** |
| **OHIF DICOM Viewer** | `https://localhost:3443/` (로컬 Compose) | DICOMweb 연동 웹 의료영상 뷰어 | **DOCKER VERIFIED** |
| **Control Plane API** | `https://localhost:3443/api/` | 환자 동의, 접근통제, 단기 토큰 발급 API | **DOCKER VERIFIED** |

> ⚠️ **공지**: 본 플랫폼은 합성 데이터(Synthetic Data) 기반 기술 검증 PoC이며, 실제 환자 개인정보나 실제 병원 망에는 연결되지 않습니다. 실제 Microsoft Entra ID 환자 브라우저 로그인은 시뮬레이션 상태(`NOT VERIFIED`)입니다.

---

## 🖼️ Service Preview & Key UI Screens

<table width="100%">
  <tr>
    <td width="50%" align="center">
      <b>1. 환자 포털 홈 & 검사 기록</b><br/>
      <img src="docs/assets/images/01_patient_portal_home.png" alt="환자 포털 홈" width="100%"/><br/>
      <sub>자신의 영상검사 목록 및 실시간 상태 확인</sub>
    </td>
    <td width="50%" align="center">
      <b>2. 환자 동의 생성 & 여정 관리</b><br/>
      <img src="docs/assets/images/02_patient_consent_journey.png" alt="동의 여정" width="100%"/><br/>
      <sub>수신 병원, 열람 목적, 유효기간, Study 범위 지정</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>3. 프롬프트 격리 AI 건강도우미</b><br/>
      <img src="docs/assets/images/03_health_helper_rag_drawer.png" alt="건강도우미 질의응답 서랍" width="100%"/><br/>
      <sub>2-Layer 의도 분류 기반 의료 지식 설명 서랍</sub>
    </td>
    <td width="50%" align="center">
      <b>4. 검사 결과 및 수치 추이 비교</b><br/>
      <img src="docs/assets/images/04_health_record_comparison.png" alt="건강 기록 비교" width="100%"/><br/>
      <sub>검사일자별 수치 비교 및 이상 소견 안내</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <b>5. 의료진 OHIF DICOM 뷰어</b><br/>
      <img src="docs/assets/images/05_clinician_dicom_viewer_ct.jpg" alt="의료진 CT 뷰어" width="100%"/><br/>
      <sub>5분 단기 토큰을 통한 WADO-RS 프레임 Lazy Loading</sub>
    </td>
    <td width="50%" align="center">
      <b>6. 보안 관제 콘솔 & 불변 감사로그</b><br/>
      <img src="docs/assets/images/06_security_audit_console.png" alt="보안 콘솔 및 감사로그" width="100%"/><br/>
      <sub>토큰 발급, 접근 거부, 열람 이력 실시간 감사 추적</sub>
    </td>
  </tr>
</table>

---

## 💡 Problem & Solution

```
[ 기존 방식 (Traditional) ]
병원 A 방문 ──> CD 발급 비용/대기 ──> 환자가 CD 직접 운반 ──> 병원 B 등록 ──> CD 분실 위험 / 중복 방사선 검사

[ 하이패스 플랫폼 (Hi-Pass Solution) ]
환자 모바일/웹 ──> 명시적 동의(병원 B, 기간, 검사 선택) ──> 의료진 ABAC 검증 ──> 5분 단기 토큰 ──> 병원 A PACS 스트리밍(Zero Cloud Storage)
```

1. **CD 발급·운반·등록 비용 절감**: 불필요한 행정 소요와 대기 시간을 없애고 진료 연속성을 확보합니다.
2. **중복 검사 및 불필요한 방사선 피폭 방지**: 이전 병원의 정밀 영상을 즉시 안전하게 참조합니다.
3. **환자 중심의 데이터 주권 실현**: 환자가 직접 누구에게, 어떤 목적으로, 언제까지 보여줄지 결정하며 언제든 철회할 수 있습니다.
4. **쉬운 검사 결과 이해**: 어려운 의학 용어와 수치를 환자 눈높이에 맞춘 안전한 AI 건강도우미로 안내합니다.

---

## 🏗️ System Architecture

### 1. Control Plane & Data Plane의 물리적/논리적 분리
의료영상 원본의 영구 보관은 병원 내부 PACS(Orthanc)에만 두며, 중앙 클라우드 DB에는 DICOM 원본을 지속 저장하지 않는 **Zero Cloud Storage (Architecture Invariant)**를 엄격히 준수합니다.

```mermaid
flowchart TB
    subgraph ClientLayer["🖥️ 사용자 인터페이스 (Client Tier)"]
        PatientUI["환자 포털 웹 (동의 생성 / RAG 도우미)"]
        DoctorUI["의료진 포털 (조회 요청 / OHIF Viewer)"]
    end

    subgraph ControlPlane["☁️ Cloud Control Plane (Azure)"]
        API["Control Plane API Engine (Node.js ESM)"]
        AuthDB[("PostgreSQL 16 (RLS / Audit / Consent)")]
        TokenEngine["단기 접근토큰 발급기 (HMAC-SHA256, 5~10분)"]
        RAGEngine["2-Layer 한국어 RAG Engine (자모 분해 / 형태소 분석)"]
    end

    subgraph DataPlane["🏥 Hospital Data Plane (On-Prem / Edge Gateway)"]
        Gateway["DICOMweb Gateway (Reverse Proxy / Auth Check)"]
        PACS[("Orthanc 가상 PACS (DICOM 원본 분산 보관)")]
    end

    PatientUI -->|"1. 동의 생성 / 철회"| API
    PatientUI -->|"Q. 검사/질환 질문"| RAGEngine
    DoctorUI -->|"2. 영상 접근 요청"| API
    API -->|"동의/권한 검증 (ABAC)"| AuthDB
    API -->|"3. 조건 충족 시 단기 토큰 서명"| TokenEngine
    TokenEngine -.->|"토큰 반환"| DoctorUI
    DoctorUI -->|"4. WADO-RS 프레임 스트리밍 요청"| Gateway
    Gateway -->|"5. 토큰 유효성/범위 검증"| TokenEngine
    Gateway -->|"6. 인스턴스 조회 (Lazy Loading)"| PACS
    PACS -->|"7. 프레임 직접 렌더링"| DoctorUI
```

<p align="center">
  <img src="docs/assets/images/highpass_architecture_full.png" alt="하이패스 시스템 상세 설계도" width="90%"/><br/>
  <sub><b>[시스템 상세 설계도]</b> Cloud Control Plane(Azure)과 On-Premises PACS Gateway 간 mTLS 및 암호화 토큰 연동 구조</sub>
</p>

---

### 2. 환자 동의 기반 ABAC 접근제어 시퀀스 (Fail-Closed)
모든 접근 요청은 **Fail-Closed** 원칙을 따르며, 11가지 검증 항목(동의 상태, 시간, 병원 일치, 의사 소속, Study/Series 범위, 목적 일치 등) 중 단 하나라도 불일치하면 즉시 명확한 거부 코드(`HOSPITAL_MISMATCH`, `CONSENT_EXPIRED` 등)와 함께 차단됩니다.

```mermaid
sequenceDiagram
    autonumber
    actor Patient as 🧑‍🦰 환자
    actor Doctor as 👨‍⚕️ 의료진 (병원 B)
    participant CP as ☁️ Control Plane API
    participant DB as 🗄️ PostgreSQL (RLS)
    participant GW as 🛡️ DICOMweb Gateway (병원 A)
    participant PACS as 🏥 Orthanc PACS (병원 A)

    Patient->>CP: 동의 생성 (수신: 병원 B, 목적: 진료, 기간: 7일, 범위: 간 CT)
    CP->>DB: 동의 객체(ACTIVE) 저장 및 감사로그 기록
    
    Doctor->>CP: 의료영상 열람 요청 (환자 ID, Study UID, 접근 목적)
    CP->>DB: 동의 상태, 유효기간, 허용 범위, 의사 소속 병원 검증
    Note over CP: 11개 ABAC 정책 평가 (Fail-Closed)
    CP-->>Doctor: 5분 유효 단기 DICOMweb Token 발급
    
    Doctor->>GW: WADO-RS 영상 프레임 요청 (Bearer Token)
    GW->>CP: 토큰 서명, 만료시간, Study/Series 인트로스펙션
    GW->>PACS: 허용된 DICOM Instance만 쿼리
    PACS-->>Doctor: 브라우저 OHIF 뷰어로 스트리밍 (Lazy Loading)
    CP->>DB: 영상 접근 및 열람 감사로그(Immutable Audit Log) 기록
```

---

## 🚀 Key Engineering Differentiators (핵심 기술적 강점)

### 1. 순수 JS 경량 한국어 형태소 분석기 & 2-Layer Intent Classification
외부 C++ 네이티브 바인딩(Mecab 등)에 의존하지 않고, Node.js 환경에서 완전히 독립 동작하는 **초경량 유니코드 자모 분석기 및 계층형 의도 분류기**를 자체 구현했습니다.
* **유니코드 자모 산술 분해 ([`src/health-helper-korean-morpho.js`](file:///C:/Users/user/Documents/New%20project/src/health-helper-korean-morpho.js))**:
  * 한글 음절 코드를 초성·중성·종성(받침)으로 수학적 분해하여 받침 유무(`hasBatchim`) 및 음운 조화(은/는, 이/가, 을/를, 과/와)를 정확히 판별.
  * 3-Pass 복합 조사/어미 분리 및 N-gram 명사 체언 후보군 추출.
* **2-Layer 계층형 분류 ([`src/health-helper-intent-classifier.js`](file:///C:/Users/user/Documents/New%20project/src/health-helper-intent-classifier.js))**:
  * **1차 레이어 (Entity Topic)**: 1,019개 MedlinePlus 질환·검사 토픽 사전 및 동의어/별칭 매칭.
  * **2차 레이어 (Intent Category)**: `DEFINITION`(정의), `CAUSE`(원인), `SYMPTOM`(증상), `PREPARATION`(검사준비), `LIMITATION`(한계)의 5대 의도 판별. 의도 미지정 시 안전한 기본 개념 설명으로 fallback.
* **프롬프트 격리 (Prompt Isolation)**:
  * 환자의 원문 질문, 환자 식별자, 개인 진료 수치를 외부 LLM에 절대 전송하지 않음.
  * 서버에서 엄격히 검증된 한국어 지식 청크만 LLM 문장 선택 모델(Qwen 3.5:4B)에 전달하여 **환각(Hallucination) 및 개인정보 유출을 원천 방지**.
  * 진단, 확진, 약물 처방 질의는 모델 호출 전 사전 필터링되어 즉각 거부(`REFUSED`).

---

### 2. 표준 DICOMweb & Lazy Loading 스트리밍
* **의료 표준 준수**: DICOM PS3.18 / DICOMweb 표준(QIDO-RS, WADO-RS) 및 HL7 FHIR `ImagingStudy` 리소스 모델 연동.
* **트래픽 및 메모리 최적화**: 수백 MB에 달하는 전체 Study를 일괄 다운로드하지 않고, 브라우저 스크롤 및 뷰어 조작에 맞춰 `Study → Series → Instance → Frame` 단위로 **Lazy Loading 전송**.

---

### 3. 심층 방어(Defense-in-Depth) 및 보안 내재화 (Security by Design)
* **PostgreSQL Row-Level Security (RLS)**: 데이터베이스 수준에서 테넌트 및 환자 소유권 격리를 강제하여 SQL Injection이나 애플리케이션 버그로 인한 권한 상승 차단.
* **불변 감사로그 (Immutable Audit Log)**: 로그인, 동의 생성/철회, 정책 검증 실패, 영상 열람, 토큰 인트로스펙션 등 모든 이벤트를 위변조 불가능한 감사 레코드로 기록.
* **비밀정보 하드코딩 배제**: 모든 JWT Secret, DB Credential, mTLS 인증서는 환경변수 및 보안 스크립트로만 주입.

---

## 📂 Project Directory Structure

```text
├── public/                               # 웹 프론트엔드 정적 자산
│   ├── ui/                               # 환자 포털 & 건강도우미 UI 컴포넌트
│   │   ├── patient-helper.js             # 건강도우미 대화 인터페이스 & RAG 클라이언트
│   │   └── health-comparison.js          # 건강 기록 비교 및 질문 연결
│   └── viewer/                           # OHIF 기반 DICOMweb 의료영상 뷰어
│
├── src/                                  # 백엔드 핵심 비즈니스 로직 (Node.js ESM)
│   ├── health-helper-korean-morpho.js    # [RAG] 순수 JS 한글 자모 분해 & 형태소/조사 분석기
│   ├── health-helper-intent-classifier.js# [RAG] 1,019개 토픽 매칭 & 2-Layer 의도 분류기
│   ├── health-helper-patient-translation.js # [RAG] 프롬프트 격리 RAG 파이프라인 & Fallback
│   ├── health-helper-medlineplus.js      # 의료 지식 청크 페이로드 구성 및 근거 검증
│   ├── dicom-token.js                    # 5분 유효 단기 DICOMweb Access Token 서명/검증
│   ├── audit-logger.js                   # 불변 감사로그 기록 및 이상행위 탐지
│   └── server.js                         # Control Plane Express 서버 메인 엔트리포인트
│
├── data/                                 # 의료 지식 베이스 코퍼스
│   └── medlineplus-upload-ko-20261012-v3/# 1,019개 질환·검사 토픽, 20,338개 한국어 청크
│
├── docker/                               # 컨테이너화 구성
│   ├── docker-compose.yml                # 전체 스택 (Control, Web, Orthanc, DB) 정의
│   └── Dockerfile                        # Node.js 24 기반 경량 보안 컨테이너 이미지
│
├── scripts/                              # 운영·배포·검증 자동화 스크립트
│   ├── patient-rag-quality-release.py    # Azure 컨테이너 무중단 안전 핫픽스 배포 스크립트
│   ├── start-health-helper-preview.js    # 로컬 인터랙티브 RAG 워크벤치 프리뷰 서버
│   └── mvp-verify.js                     # 전체 캡스톤 MVP 엔드투엔드 무결성 검증기
│
├── test/                                 # 단위 / 통합 / E2E 테스트 슈트
│   ├── health-helper-korean-morpho.test.js # 자모 분해 및 형태소 분석 단위 테스트 (전수 통과)
│   └── health-helper-cirrhosis-retrieval.test.js # 11개 질환·검사 질의응답 시나리오 검증
│
└── docs/                                 # 프로젝트 기술 문서 & 감사 증적
    ├── ARCHITECTURE.md                   # 상세 시스템 아키텍처 및 Invariant 정의서
    ├── SECURITY.md                       # 개인정보보호, 암호화, RLS 및 위협 모델
    ├── REQUIREMENTS.md                   # 기능(FR) 및 비기능(NFR) 요구사항 추적표
    └── governance/                       # 이전 스프린트 검증 이력 및 감사 로그 아카이브
```

---

## ⚡ Getting Started (로컬 실행 가이드)

### 1. 요구 환경
* **Node.js**: `>= 20.0.0` (권장: Node 24.x)
* **Package Manager**: `pnpm` 또는 `npm`
* **Docker & Docker Compose**: 컨테이너 환경 실행 시 필요

### 2. 환경 설정
```bash
# 환경 설정 파일 복사
cp .env.development .env
```

### 3. Docker Compose로 전체 스택 실행 (권장)
PostgreSQL, Control Plane, Web Portal, Orthanc 가상 PACS가 한 번에 구동됩니다.
```powershell
# 전체 스택 빌드 및 백그라운드 시작
pnpm run mvp:start

# 서비스 헬스체크 및 준비상태 확인
pnpm run mvp:readiness
```
* **환자 포털 웹**: `https://localhost:3443/hipass/`
* **OHIF DICOM Viewer**: `https://localhost:3443/`
* **Health Check**: `https://localhost:3443/api/health`

### 4. 건강도우미 RAG 로컬 인터랙티브 프리뷰 워크벤치 실행
실제 브라우저에서 건강도우미 질문 의도 분석 및 근거 검색을 즉시 테스트할 수 있습니다.
```powershell
node scripts/start-health-helper-preview.js
```
* 접속 주소: `http://127.0.0.1:3099/`

---

## 🧪 Testing & Verification Matrix

구현된 모든 기능은 실제 테스트 스크립트를 통해 검증되었습니다:

| 테스트 영역 | 검증 항목 | 결과 | 근거 |
|---|---|:---:|---|
| **한국어 형태소 분석** | 자모 분해, 받침 판정, 3-pass 복합 조사/어미 분리 | **PASS** | [`test/health-helper-korean-morpho.test.js`](file:///C:/Users/user/Documents/New%20project/test/health-helper-korean-morpho.test.js) 전수 통과 |
| **질문 의도 분류** | 1,019개 토픽 매칭, 5대 의도 분류, 단독 표제어 매핑 | **PASS** | AFP, 초음파, 간경변 등 질환/검사 68/68 케이스 통과 |
| **임상 진단/처방 차단** | 진단명 확진 요구, 약물 용량 처방 질의 원천 차단 | **PASS** | 사전 필터링 단계에서 `REFUSED` 반환 검증 |
| **Azure 라이브 실컨테이너** | 실서버 배포 및 11개 핵심 시나리오(HCC, AFP, 간경화 등) | **PASS** | Azure VM 컨테이너(`control-1`, `web-1`) 라이브 검증 |
| **ABAC 토큰 보안** | 5분 유효시간 만료, 허용 범위 외 접근 거부 | **PASS** | 토큰 만료 후 401/403 Fail-Closed 확인 |
| **PostgreSQL RLS** | 테넌트/환자 격리 RLS 양성/음성 보안 게이트 | **PASS** | `pnpm run privacy:db-gate` 통과 |
| **실제 Entra ID 로그인** | 실 브라우저 Microsoft 계정 인증 E2E | **NOT VERIFIED** | MVP 범위에 따른 모의 계정 시뮬레이션 상태 |

---

## 🔒 Security, Compliance & Disclaimer

> ### ⚠️ CAPSTONE MVP / SYNTHETIC DATA NOTICE
> 본 프로젝트는 **의료영상 교류 및 개인정보보호 기술을 실증하기 위한 캡스톤 MVP/PoC**입니다.
> 1. **가상 데이터 사용**: 시스템에 등록된 모든 환자 정보, 병원 데이터, DICOM 의료영상은 연구·개발용 합성 데이터(Synthetic Data)이며, 실제 개인정보를 일체 포함하지 않습니다.
> 2. **비운영 환경**: 본 시스템은 실제 의료기관 내부망 또는 운영 PACS와 직접 연결되어 있지 않습니다.
> 3. **법률 및 인증 고지**: 본 PoC는 개인정보보호법(PIPA) 법률 자문 완료 또는 ISMS-P 인증을 획득한 상용 의료 시스템이 아닙니다. 실제 상용 배포 전에는 법률 검토 및 규제 샌드박스, 공인 보안 감사가 선행되어야 합니다.

---

## 📚 Technical Documentation Index

더 자세한 설계 및 보안 정책은 프로젝트 내 공식 문서를 참조하십시오:
* [시스템 아키텍처 정의서 (ARCHITECTURE.md)](docs/ARCHITECTURE.md)
* [보안 아키텍처 및 Security by Design (SECURITY.md)](docs/SECURITY.md)
* [기능 및 비기능 요구사항 추적표 (REQUIREMENTS.md)](docs/REQUIREMENTS.md)
* [데모 시연 런북 (DEMO-RUNBOOK.md)](docs/DEMO-RUNBOOK.md)
* [이전 스프린트 내부 실행 검증 로그 아카이브](docs/governance/legacy-readme-sprint-log-20261013.md)
