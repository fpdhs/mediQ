# Azure 환자웹 한국어 번역 RAG 연결

2026-10-14 KST. 학교 발표용 합성 환자 MVP에 한정한다. 별도 검토자는 배정하지 않는다.

환자웹: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/

## 실제 연결

- 기존 `POST /api/v1/me/health-helper/questions` API와 Entra 환자 인증·신뢰된 ingress를 유지한다.
- 기존 진료 질문 추천 경로 앞에 한국어 번역 RAG를 연결했다. Health Topics 1,017개 문서와 AFP·초음파 Medical Tests 2개 문서의 총 20,347개 청크를 서버에서 검색한다.
- 학교 데모 후보 PASS는 검색 코퍼스 채택을 뜻한다. 콘텐츠 QA HOLD 109건은 출처 메타데이터에 유지하며 임상 승인으로 표시하지 않는다.
- 검색된 한국어 근거 문장과 정리된 의도만 기존 SSH Unix 소켓을 통해 Qwen에 전달한다. Qwen은 근거 문장 인덱스를 선택하고 서버가 인덱스·출처·초점·인용을 검증한 후 답변을 구성한다. 원 질문, 개인 기록값, 식별정보는 모델에 보내지 않는다.
- Qwen은 기존 로컬 PC의 `qwen3.5:4b`를 계속 사용한다. Azure에는 번역 코퍼스와 검색·인증·출력 검증을 배포했다. 새 Azure 리소스나 공개 모델 포트를 만들지 않았다.
- 모델 연결 또는 출력 검증이 실패하면 검증된 검색 근거를 `RETRIEVED`로 표시한다. QA HOLD 자료는 모델 실패 시 본문 대신 출처 상태만 표시한다. 구조화 번역 목록은 모델 없이 원래 항목을 표시한다.
- 생성 선택은 30초, Control 요청은 40초로 제한한다. 기존 공개 웹 프록시의 45초 제한 안에 응답하며, 환자별 분당 5회와 전역 동시 4회 제한을 적용한다.

## 메인 합성 시나리오

`홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?`

이 질문은 등록된 HCC 합성 카탈로그와 해당 인증 환자 매핑을 확인한 후 고정 출처 설명을 반환한다. 건강검진 간 관련 항목, AFP 3개 시점, 초음파 3개 기록, 별도 간암 전원 발표 설정을 구분한다. 근거 패널은 7개 레코드의 종류·날짜·ID와 자료 버전 및 발표 설정 ID를 표시한다. 이 응답은 모델 생성·임상 수치 해석이 아니다.

## API 변화와 보안

- 요청·주소·인증 계약은 그대로다. 일반 질문 응답에 `profile=SCHOOL_DEMO_TRANSLATION_RAG`, 코퍼스 버전, `generationUsed`, `clinicalUse=false`를 추가했다.
- `GENERATED`: 실제 Qwen 선택과 서버 근거 검증을 통과했다. `RETRIEVED`: 모델 없이 검색 근거에서 구성했다. `SYNTHETIC_SCENARIO`: 합성 기록의 고정 출처 설명이다.
- 환자 역할을 서버에서 확인하며 body의 patientId·records 추가는 거부한다. 개인정보 질의와 진단·치료 요청은 공개 근거를 붙이지 않는다.
- 감사로그에는 actor·결과·고정 reason code만 기록한다. 새 reason code는 `HELPER_TRANSLATION_RAG_STARTED`, `HELPER_TRANSLATION_ANSWER_GENERATED`, `HELPER_TRANSLATION_EVIDENCE_DELIVERED`다.
- 브라우저는 AI 키나 모델 주소를 받지 않는다. 기존 TLS, Entra, ingress 서명, DB·PACS·WAF의 접근 범위를 유지했다.
- FR-001~FR-046 동의·의료영상 교류 계약의 변경은 없다. 기존 서버 인증·최소수집·감사 가능성 및 비밀정보 외부 파일 보관 원칙을 적용했다.

## 배포 증거

기준 실행 이미지가 작업 도중 바뀐 것을 감지해 최신 컨테이너를 다시 캡처한 후 배포했다. 그 실행본의 서버 시작 코드에 RAG 초기화만 추가하고, 기능 모듈·번역 데이터·건강도우미 화면만 새 레이어로 덮었다. 다른 최신 화면·서버 기능을 전체 작업트리로 교체하지 않았다.

- Control: `sha256:1656186d76b3b6b8c74c3a9f9858a33806baf5bcadd8e3bd919c2a4019405c5a`
- Web: `sha256:4d0a69a495bae9c90a7c5b01d6db39fec67c500fdca6b0e7dc1ab78d305d9370`
- 증거: `artifacts/azure/entra-web-20261013T155832Z-667103/`
- 롤백은 해당 폴더의 `manifest.json`과 원격 `control-before.json`, `web-before.json`에 바인딩한다. 이후 다른 배포가 있으면 후보 이미지 동일성 확인 없이 롤백하지 않는다.
- 컨테이너 환경변수·볼륨·보안 옵션·포트는 동일하다. WAF·PostgreSQL·기존 ingress 컨테이너 ID와 이미지가 유지됐다. 웹 제공 파일 4개의 해시가 후보와 일치한다.

| 테스트 | 결과 | 근거 |
|---|---|---|
| 로컬 인증·RAG·출력·UI 회귀 | PASS | 51/51 |
| Azure 후보 이미지 내부 회귀 | PASS | 33/33, 실제 후보 이미지에서 실행 |
| 웹 JS/CSS/PWA 제공 해시 | PASS | 공개 HTTPS에서 4개 파일 확인 |
| 미인증·변조 토큰 공개 API | PASS | 모두 HTTP 401 |
| 설치된 HCC 메인 질문 | PASS | 실제 등록 카탈로그와 합성 테스트 principal, 근거 7건 |
| Azure→기존 SSH 소켓→실제 Qwen | PASS | AFP 번역 근거 응답 GENERATED, generationUsed=true, 출처 1개 |
| 개인 진단·역할·body override 거부 | PASS | 설치된 서비스 수준 테스트 및 로컬 HTTP 회귀 |
| 실제 Entra 로그인 후 질문 제출 | NOT VERIFIED | 사용자가 로그인 검증을 나중에 진행하도록 선택 |
| 실제 환자·임상 정확성·번역 의미 검증 | NOT VERIFIED | 학교 발표용 합성 MVP 범위 |

설치 검증은 합성 principal을 사용한 서비스 수준 검사다. 실제 Entra 로그인으로 공개 API에 정상 질문을 제출한 검증과 혼동하지 않는다. 서비스 수준 검증의 감사 callback은 메모리 대역이며 운영 DB 감사로그 생성 증명으로 사용하지 않는다.

## 사용과 운영 제한

환자웹에서 `환자로 시작하기`→Microsoft 합성 환자 로그인→`건강도우미`로 이동한다. 일반 질문 예시는 `AFP 검사는 무엇을 확인하나요?`, `CT 검사 전에 금식해야 하나요?`다.

기존 로컬 PC와 Ollama 및 SSH 연결이 유지돼야 실제 Qwen 선택이 동작한다. 연결이 끊겨도 Azure의 번역 검색·근거 안내는 가능하다. 로그인 후 화면 확인과 장시간 모델 연결 안정성은 후속 검증 항목이다.
# 2026-10-14 환자 답변 문구 후속 수정

환자 답변과 출처 설명의 QA HOLD 등 내부 용어를 제거한 후속 배포가 적용됐다. 내부 검수 상태와 장애 시 HOLD 자료 본문 제한은 유지한다. 최신 이미지·검증·최초 모델 확인 실패 및 재검증 통과 기록은 [문구 개선 기록](patient-helper-answer-copy-20261014.md)을 참조한다. 아래 기록의 이미지는 이전 배포 증적이다.
