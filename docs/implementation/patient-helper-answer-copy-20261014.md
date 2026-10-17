# 환자 건강도우미 답변 문구 개선 — 2026-10-14

## 작업 목적

Azure 환자 건강도우미가 `QA HOLD`, 색인 PASS, UNASSIGNED, 미해결 이슈 등 내부 상태를 답변과 출처 설명으로 표시하는 문제를 수정한다. 학교 발표용 번역 RAG의 검증 결과를 임상 승인으로 바꾸지 않는다.

## 관련 요구사항

- VNFR-USA-001: 사용자에게 이해할 수 있는 상태 안내.
- VNFR-AVL-001: 기존 유한 모델 timeout 유지.
- FR-037~041: 기존 감사 기능군 보존. 이번 변경은 감사 정책을 변경하지 않는다.
- RAG 교육 정보 기능은 기존 FR-001~046 의료영상 기능의 신규 구현 완료로 집계하지 않는다.

## 분석한 기존 구조

`health-helper-medlineplus.js`가 내부 검수 정보가 포함된 대체 답변과 `contextNote`를 생성하고, `health-helper-patient-translation.js`가 그대로 전달했다. 환자 UI는 해당 필드를 직접 텍스트로 표시했다. 모델은 한국어 근거 문장을 선택하며, 서버가 문장·출처를 검증해 재구성한다.

## 생성한 파일

- `scripts/patient-helper-presentation-release.py`: 현재 Azure 이미지 기준으로 정확히 일치하는 모듈만 교체하고, 현재 웹 코드의 안내 한 줄과 서비스 워커 캐시 버전만 수정한다.
- 이 구현 기록.

## 수정한 파일

- `src/health-helper-patient-translation.js`: 환자용 표현 변환. 내부 원래 출처 설명은 `reviewNote`에 보존하고 환자 표시용 `contextNote`는 자연스러운 한국어로 제공.
- `public/ui/patient-helper.js`: 번역 RAG 원문 안내 상태 문구.
- `test/health-helper-patient-translation.test.js`: 정상 생성·장애 대체 답변에서 내부 용어 비노출 및 HOLD 자료 본문 제한 검증.
- `scripts/patient-rag-azure-release.py`: 최소 문구 배포 지원 및 실제 후보 웹 전체를 격리 테스트에 연결.
- `scripts/verify-patient-rag-azure.py`: 설치된 서버에서 표시 문구, 내부 상태 보존, 모델 장애 동작 검증.

## 구현한 기능

- 검증된 생성 답변은 기존 한국어 근거 문장을 그대로 제공.
- 원문 안내 대체 답변: “이 질문에 대해 충분히 확인된 설명을 제공하기 어려워요. 아래 관련 원문 자료를 참고하고, 개인 검사 결과는 의료진과 확인해 주세요.”
- 출처 안내: “MedlinePlus 원문을 한국어로 옮긴 참고 자료입니다. 개인 검사 결과는 의료진과 확인해 주세요.”
- 환자 표시 영역에서 내부 QA 용어를 제거. `reviewStatus`, `reviewNote`, 출처 버전 및 임상 사용 제외 정보는 보존.

API endpoint와 요청 본문은 변경하지 않았다. 응답의 출처 객체에 비표시용 `reviewNote`가 추가되고 표시용 `contextNote`와 대체 답변 문구가 바뀌었다. 영향 화면은 환자 건강도우미이며 의료영상·동의·토큰 API는 변경하지 않았다.

## 보안 검토

환자 인증·서버 역할 검사·환자 지정 override 차단·감사 최소수집을 유지한다. 모델에 원 질문이나 개인 기록을 전달하지 않는다. HOLD 자료의 장애 시 본문·목록 노출 제한을 유지한다. 출처의 임상 정확성을 승인하지 않았으며 실제 임상 판단을 제공하지 않는다. 새 유료 리소스나 공개 접근을 추가하지 않았다.

## 테스트 결과

| 테스트 | 결과 | 근거 |
|---|---|---|
| 로컬 RAG·HTTP·환자 UI 회귀 | PASS | 52/52, node --test 4개 파일 |
| Azure 배포 전 검사 | PASS | 후보 이미지 구문 검사 및 격리 RAG·HTTP·UI 검사 |
| Azure 실제 모델 최초 확인 | FAIL | GENERATED 대신 SOURCE_GUIDANCE 반환. 연결 GET 확인은 404 정상 도달. 원인은 확정하지 못함 |
| 로컬 동일 relay 실제 모델 확인 | PASS | GENERATED, 약 4.7초 |
| Azure 실제 모델 재검증 | PASS | Qwen GENERATED 및 출처 문장 일치 |
| 생성 답변·장애 안내 내부 용어 비노출 | PASS | answer/contextNote에 QA·HOLD·UNASSIGNED·색인 PASS·미해결 이슈 없음 |
| HOLD 장애 대체 답변의 본문 제한 | PASS | 출처만 제공, excerpt/listContexts 없음 |
| 개인 진단 거절·역할/본문 override 차단·감사 최소화 | PASS | 설치된 서비스에 합성 테스트 principal 사용 |
| 공개 JS/SW 배포 일치 | PASS | HTTPS 제공 파일의 SHA256 일치 |
| 인증 없음·변조 토큰 | PASS | 공개 API 각각 HTTP 401 |
| DB·WAF·ingress 컨테이너 보존 | PASS | 기존 ID 및 이미지 일치 |
| 실제 Entra 환자 로그인 후 브라우저 사용 | NOT VERIFIED | 사용자가 직접 로그인은 나중에 진행한다고 지정 |

## 배포 증적

- URL: https://highpass-demo.japaneast.cloudapp.azure.com/hipass/
- 증적: `artifacts/azure/entra-web-20261013T222847Z-65805c/`
- Control: `sha256:cd06d119b2643c3eb33b4fc1443a3ca79d0fdf219e633e6f828e13a73950f178`
- Web: `sha256:848b5350b382b03121a3c19b14638eeb6319f9bdde7aff78443e061f220203a9`
- 기존 이미지·실행 설정으로 되돌리는 기록을 보존. 최신 이미지가 이번 배포 이미지와 일치할 때만 rollback 가능.

## 남아 있는 위험 및 미검증 사항

문구 수정은 모든 답변 품질 문제의 해결을 의미하지 않는다. 처음 실제 모델 확인은 실패했고, 이후 동일 경로 재검증은 통과했다. 지속 가용성·부하·지연 원인은 미검증이다. 현재 Azure 모델 호출은 로컬 PC/Ollama/relay/SSH 연결에 의존한다.

다음 품질 개선 우선순위는 (1) 질문 의도별 근거 검색 평가와 누락 개선, (2) 검사 목적·준비·한계를 구분한 답변 구성, (3) 모델 실패 이유의 구조화된 내부 관측과 지속 가용성 개선이다. 현재 모델은 검증 가능한 번역 문장 선택 방식이며 자유로운 설명 생성은 구현하지 않았다.
