# 학교 발표용 건강도우미 번역 RAG MVP

작성일: 2026-10-13 (Asia/Seoul)
상태: **학교 발표용 비임상 데모 · DRAFT · 환자 서비스 아님**

## 범위 결정

사용자 지시에 따라 출처·제품, 한국어 원문 대조·번역, 적격 임상, 편집 검토 담당자를 별도로 배정하는 작업과 고정 문장/출처 버전을 검토하는 작업을 이 MVP에서 제외했다. 기존 검토용 파일은 과거 작업 흔적으로 남아 있을 수 있으나, 이 데모의 시작 조건이나 승인 근거로 사용하지 않는다.

검색 지식베이스는 사용자 제공 MedlinePlus 한국어 번역 필드만으로 구성한다. 학교 데모 색인 무결성 검사를 통과한 1,017개 자료를 모두 검색에 포함한다. 색인 `PASS`는 한글 번역 텍스트·해시·자료 출처가 적재 조건을 통과했다는 뜻뿐이며, 콘텐츠·번역 의미·의학적 정확성 승인과 다르다. 원래 자동 QA `HOLD` 107건과 미해결 이슈 111건(중대 7, 주요 87, 경미 17)은 상태를 그대로 유지하고 응답 출처 카드에 표시한다. 한글이 없는 30개 청크는 인덱스에서 제외했다. 제목·별칭·섹션 경로도 번역본에서 만들고 영어 원문 제목·본문·해시는 모델 투영본에서 제거한다.

여기서 “RAG 학습”은 번역문을 색인해 질문 때 검색하고 검색 문맥을 모델에 제공한다는 뜻이다. Qwen 가중치 파인튜닝, 임베딩 생성, 외부 벡터DB는 사용하지 않는다. 별도 검토자가 없으므로 임상적으로 검증되었다고 표시하거나 환자 진료에 사용하지 않는다. 합성 질문만 입력하고 환자 식별정보·개인 검사결과는 입력하지 않는다.

## 실행

같은 컴퓨터에서 로컬로 실행하려면 프로젝트 루트에서 다음 명령을 사용한다.

```powershell
node scripts/start-health-helper-school-demo.js
```

브라우저 주소는 `http://127.0.0.1:11445/`다. 종료는 실행한 터미널에서 `Ctrl+C`다.

같은 사설망의 다른 컴퓨터에서도 열려야 하면 서버 컴퓨터에서 사용할 사설 IPv4 주소를 확인하고 다음처럼 실행한다. `10.0.0.25`는 실제 서버 컴퓨터 주소로 바꾼다.

```powershell
$env:HIPASS_HEALTH_HELPER_SCHOOL_BIND_ADDRESS='10.0.0.25'
$env:HIPASS_HEALTH_HELPER_SCHOOL_PUBLIC_HOST='10.0.0.25'
node scripts/start-health-helper-school-demo.js
```

다른 컴퓨터 브라우저에서 `http://10.0.0.25:11445/`를 연다. 두 환경변수에 서버 컴퓨터의 같은 사설 IPv4를 넣으면 해당 인터페이스 하나에만 바인딩하며, 데모는 지정한 Host/Origin만 허용한다. Windows 방화벽이 연결을 막으면 관리자 PowerShell에서 아래 규칙을 추가할 수 있다. `10.0.0.25`와 `LocalSubnet` 간 TCP 11445만 허용하며, 사용 후 제거할 수 있다.

```powershell
$ip='10.0.0.25' # 서버 컴퓨터의 실제 사설 IPv4로 변경
New-NetFirewallRule -Name 'HiPass-School-RAG-11445' -DisplayName 'HiPass School RAG Demo (Local Subnet)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11445 -LocalAddress $ip -RemoteAddress LocalSubnet -Profile Public
```

```powershell
Remove-NetFirewallRule -Name 'HiPass-School-RAG-11445'
```

Wi-Fi 클라이언트 격리, VPN, 서로 다른 VLAN, 방화벽 정책에 따라 같은 Wi-Fi 이름이어도 연결되지 않을 수 있다. 이 MVP 실행 스크립트는 방화벽 규칙이나 공유기 설정을 자동 변경하지 않는다.

## 경계와 보안

- 포트 11445의 별도 미인증 발표 데모다. 환자 로그인/동의/의료진 RBAC·ABAC/감사·DICOM 경로를 대체하거나 통과하지 않는다.
- Qwen은 기존 로컬 Ollama(127.0.0.1:11434)를 사용한다. 모델에 원문 질문이나 영어 원문을 별도 필드로 보내지 않고, 한국어 번역 제목·분류된 의도·검색된 한국어 번역 근거만 보낸다. 학교 데모 schema에는 자유 형식 `answer` 필드가 없다. 모델은 검색 근거에서 연속된 완전 문장 1~2개를 그대로 선택하고, 서버가 evidence ID와 문장 일치를 확인한 뒤 그 인용문으로 답변을 구성한다. 콘텐츠 QA HOLD 출처를 사용하면 자동 QA·미해결 이슈 상태를 응답 출처 카드에 함께 보여준다.
- 개인 진료기록·검사값·식별정보, 진단·치료·처방 및 응급 판단을 지원하지 않는다. 의료전문가 검토를 마쳤다고 주장하지 않는다.
- QA HOLD 107건도 학교 데모 검색에는 포함되지만 `ai_qa_status`와 콘텐츠 검토 상태는 변경하지 않는다. 화면과 응답 출처에 HOLD 및 미해결 이슈 건수를 표시하고, 임상·환자용 사용은 금지한다. 색인 PASS를 콘텐츠 PASS처럼 표시하지 않는다.
- 사용자 제공 번역은 MedlinePlus의 공식 번역이 아니다. 화면에 출처·번역 안내를 표시한다.
- 환자 서비스의 `SOURCE_GUIDANCE`/`VISIT_PREPARATION` 모드, API, DB, 환자 데이터 및 운영 배포 설정은 이 작업으로 변경하지 않는다.

## 구현 파일과 요구사항 영향

- `src/medlineplus-upload-corpus.js`: 한국어 번역 전체의 학교 데모 색인 무결성 PASS를 계산하고 검색에 연결한다. 원래 QA HOLD·미해결 건수는 보존하며 한글 없는 청크는 제외한다.
- `src/health-helper-medlineplus.js`: 학교 데모에서만 쓰는 evidence ID·문장 인덱스 선택 schema, intent/focus 허용 문장만 전달, 근거에서 답변을 파생하는 서버 검증, source-only fallback.
- `scripts/medlineplus-local-preview.js`: 학교 데모 프로필, 포트/Host/Origin 검사 및 지정 바인딩.
- `scripts/medlineplus-upload-model-smoke.js`: 고정 합성 질문 1건으로 로컬 Ollama 응답 schema를 확인하는 별도 스모크.
- `fixtures/health-helper-school-demo-retrieval-golden.json`, `scripts/evaluate-medlineplus-upload-retrieval.js`: corpus 버전에 묶인 합성 질의, 전체 문서 색인, QA 상태 보존, 안전 거부 평가.
- `public/ui/patient-helper.js`: 서버 검증 결과의 claim과 원문 인용을 `textContent`로 표시하며, 다른 API 응답은 변경하지 않는다.
- `scripts/start-health-helper-school-demo.js`, `package.json`: 전용 시작 명령.
- `test/medlineplus-upload.test.js`, `test/health-helper-medlineplus.test.js`, `test/patient-helper.test.js`: 번역 전용 코퍼스·QA HOLD 메타데이터 전용 fallback·문장/초점 인덱스 경계·XSS 안전 렌더 확인.

관련 요구사항은 의료진·접근정책 FR-014~025, 감사 FR-037~041, 개인정보 최소화 FR-042~046의 보안 경계를 보존하는 데 한정된다. 별도의 RAG 환자용 FR은 배정하지 않았고, FR을 충족했다고 주장하지 않는다. 환자 API 계약 변경은 없다.

## 후보자료 기반 지속 개선 권고

이 데모의 “계속 학습”은 Qwen 가중치 파인튜닝이 아니라 **버전이 고정된 후보 코퍼스와 검색기 회귀개선**으로 운영한다. 후보자료를 무조건 늘리기보다 다음 루프를 반복한다.

1. 새 후보의 출처·이용범위·언어·원본 및 번역 해시를 등록한다. 출처·해시·한글 번역 텍스트의 적재 검사는 독립적으로 수행한다. 실패 자료는 색인하지 않는다.
2. 후보를 불변 버전으로 고정하고, 이 데모에서는 한국어 번역 필드만 색인·검색 projection으로 만든다. 영어 원문·외부 URL이 검색/모델 입력 경로가 되지 않게 한다.
3. 원래 자동 QA·콘텐츠 검토 상태는 별도 메타데이터로 보존한다. 이 학교 프로필은 QA HOLD 자료도 검색하지만, 출처 표시에서 HOLD 상태와 미해결 수를 알려주며 의료 내용 검증 PASS라고 부르지 않는다.
4. 합성 질문의 고정 평가셋으로 주제·의도·초점(intent/focus)·기대 상태, QA 상태 보존, 개인정보·수치 입력, 임상 조언 거부, 프롬프트 인젝션 격리를 각각 측정한다. 검색 누락은 별칭/토큰화/검색 규칙을 검토하고, 의도·초점 오분류는 작은 규칙과 회귀질의로 보정한다. 복합 질의는 초점어를 독립 주제로 중복 계산하지 않되, 선택된 주제 원문이 해당 초점 문장을 실제 포함할 때만 연결하고 아니면 보류한다.
5. 변경 후 같은 corpus·golden set·검색기 버전으로 전체 평가를 재실행하고 결과를 기록한다. 통과해도 임상 정확성·번역 검수·권리 승인을 뜻하지 않으며 환자 서비스로 자동 승격하지 않는다.

실사용 질문이나 진료기록을 학습자료·평가 정답으로 모으지 않는다. 학교 시연 입력은 합성 질문만 허용한다. Qwen에는 사용자 질문이 아닌 선택된 한국어 근거만 보낸다는 현 계약을 유지한다. 색인 PASS는 원래 QA HOLD를 해제하지 않는다. 실제 임상/환자 서비스 연결은 별도 승인·검증 없이는 금지한다.

### 2026-10-13 전체 번역 후보 데모 색인

- 이전 기준선은 910개 자동 QA 통과 자료만 검색하고 107개 QA HOLD를 제외했다. 이번 변경은 학교 발표 프로필에 한해 검색 색인 상태를 콘텐츠 QA와 분리했다. 자료 내용의 QA 값을 덮어쓰지 않는다.
- 현재 로컬 v3: 1,017개 등록 문서 중 1,017개가 데모 색인 `PASS`다. 이 `PASS`는 한글 번역 텍스트가 있고 색인 투영을 구성할 수 있음을 뜻한다. 20,338개 한국어 청크를 검색하고, 한글이 없는 30개 청크는 제외했다.
- 원래 QA `HOLD`는 107개 문서에서 유지된다. 해당 문서에는 미해결 이슈 111개(중대 7, 주요 87, 경미 17)가 있으며, 출처 카드에 자동 QA·콘텐츠 검토 상태와 이슈 수를 표시한다. 107개 HOLD도 데모 검색에는 포함된다. 이 숫자는 콘텐츠나 의학 내용 검증 통과 건수가 아니다.
- 전체 제목 질의는 993/1,017에서 정확한 자료 근거를 반환했다. 19건은 금지 키워드로 `REFUSED`, 5건은 짧거나 모호해 `INSUFFICIENT_EVIDENCE`였다. 이전보다 104/107 QA HOLD가 제목 질의로 검색됐고, 나머지 3건은 안전 거부 규칙에 걸렸다.
- 현재 합성 golden 29/29와 안전 사례 3/3을 통과했다. 평가에는 금식·조영제·장신구·임신·방사선 초점 제한, 복수 초점 문장 전체 충족, 근거가 없는 방사선 위험·조영제 부작용 및 단일 claim으로 묶을 수 없는 초점 조합의 보류가 포함된다. A1C QA HOLD 사례도 데모 색인 PASS 및 원래 QA HOLD가 함께 남는지 검사한다. 이 결과는 색인·검색·거부 경계만 확인하며 번역 의미, 임상 정확성, 환자 서비스 적격성을 검증하지 않는다.
- 금식 질의가 조영제 후 일반 수분 섭취 문장을 선택할 수 있던 검색 누출을 확인해 초점 허용문장을 제한했다. 현재 모델에는 원문 질문 대신 분류된 초점 라벨과 `focusEvidence` 인덱스 대응표, 그 초점에 맞는 완전 문장만 전달한다. 복수 초점은 한 근거 안에서 연속된 최대 두 문장으로 모든 라벨을 뒷받침할 때만 생성한다. 서버는 `allowedSentenceIndexes`·모든 초점 커버·연속성·1~2문장 상한·근거 ID를 검증한 뒤 선택된 원문 문장으로 답변을 구성한다. 모델의 quote 재작성·띄어쓰기 차이를 없애며 자유 형식 답변과 모델 생성 후속 질문은 허용하지 않는다. 후속 질문은 서버 고정 템플릿이다. QA HOLD 모델 검증 실패 시에는 원문 발췌를 숨긴 출처·HOLD 메타데이터 안내만 반환한다.
- 복합 질의 `CT 검사 전에 임신 사실을 의료진에게 알려야 하나요?`에서 `임신`은 질문 초점으로 처리하고 독립 주제 충돌을 제거했다. 이후 실제 CT 문단의 임신 관련 문장이 허용되는지 검증해 단일 출처 후보를 얻었다. 단독 `임신 설명`도 `임신` 주제로 유지되는 것을 확인했다. 이 규칙은 의미상 충분한 독립 토픽 인식 모델이 아니라, 소수의 감사 가능한 초점 어휘와 근거 문장 게이트다.
- CT 본문에 방사선 사용을 설명하는 문장은 있지만 방사선 위험도나 조영제 부작용을 설명하는 대응 문장은 없다. 따라서 `CT는 방사선을 사용하나요?`는 방사선 문장만 후보로 반환하고, `CT 방사선은 위험한가요?`와 `CT 조영제 부작용은 무엇인가요?`는 `INSUFFICIENT_EVIDENCE`가 된다. 일반 초점 단어를 민감한 세부 질문에 잘못 재사용하지 않도록 별도 세부 초점과 보류 케이스를 추가했다.
- 최신 로컬 Qwen 스모크 9개가 모두 **PASS**다: 금식(11.7초), 빈혈 증상(13.1초), CT 준비(14.4초), CT 임신(14.2초), CT 방사선(14.4초), CT 방사선+임신(18.8초), MRI 금속(15.5초), MRI 방사선(14.2초), X선 방사선(25.3초). 각 응답은 claim 1개·출처 1개이고, 원문 질문은 모델에 전달하지 않는다. 의미적 근거성은 `NOT PROVEN`이다.
- 최신 변경 후 학교 데모 서버를 `10.10.70.151:11445`에 다시 실행해 해당 NIC 주소로 직접 확인했다. GET 200, HOLD 자료 107건 확인, `A1C 설명` POST 200 / `SOURCE_GUIDANCE` (excerpt 없음, QA HOLD·미해결 이슈·출처 링크 표시), `CT 검사 전에 금식해야 하나요?` POST 200 / `GENERATED` (출처 1개, 서버가 근거 문장 선택)였다. 합성 금식 모델 스모크도 PASS(13.5초)다. 이는 같은 PC에서 NIC 주소로 확인한 결과이고, 다른 컴퓨터의 접속은 아직 검증하지 않았다.
- 별도 검토자는 두지 않는다. QA HOLD를 실제 콘텐츠 `PASS`로 승격하지 않으며, 학교 데모 색인 PASS와 구분한다. `GENERATED`는 번역 자료에서 문장을 추출했다는 뜻이지 임상 정확도 PASS가 아니다.
- LAN 원격 접속, 번역문 의미 정확성, 임상 정확성, 실제 환자 서비스 적격성은 계속 별도 미검증이다.

## 검증

구현 후 실행한 빌드·테스트·HTTP 확인 결과를 아래 표에 기록한다. 로컬 코퍼스는 Git에서 제외된 데이터이므로 해당 업로드 자료가 없는 환경에서 재현되는지는 별도 확인이 필요하다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 번역 전용 색인·프롬프트 및 관련 회귀 | PASS | `node --test test/health-helper-medlineplus.test.js test/medlineplus-upload.test.js test/patient-helper.test.js` · 34/34; QA HOLD 메타데이터 전용 fallback, 동일 출처 안에 PASS/HOLD 청크가 섞인 경우에도 발췌 숨김, intent/focus별 문장 제한 포함 |
| 전체 후보 검색·QA 상태 보존 및 합성 golden 회귀 | PASS WITH GAPS | 993/1,017 exact-title evidence; 데모 색인 PASS 1,017/1,017; QA HOLD 107/107 보존; golden 31/31; safety 3/3; 복수 초점, MRI 목록 조각 오탐 및 unsupported-risk 보류 포함 |
| 모델 인용 검증 | PASS (의도·초점 제한 문장 선택) | 금식·빈혈·CT·MRI·X선 합성 사례 9건 PASS; claim 1개·출처 1개, 서버가 근거 문장으로 답변 구성; 의미 정확성 `NOT PROVEN` |
| 일반 합성 질문 HTTP 경로 | PASS (loopback) | 최신 코드에서 복수 초점 CT·임신은 `GENERATED`; 근거 없는 금식+장신구 복합 질의는 출처 없이 `INSUFFICIENT_EVIDENCE` |
| 콘텐츠 QA HOLD 응답 제한 | PASS (metadata-only fallback) | 합성 `A1C 설명`의 생성 실패 경로는 `SOURCE_GUIDANCE`; HOLD 상태·출처 링크만, 원문 excerpt 없음 |
| 생성문 의미 근거성 | NOT VERIFIED | 추출 구조는 새 주장을 막지만, 한국어 번역의 의미·의학적 정확성은 증명하지 않음 |
| 스크립트 문법/공백 검증 | PASS | 변경 JavaScript 파일 `node --check`; `git diff --check` 확인 |
| 갱신된 학교 데모 HTTP 경로 | PASS (서버 NIC 주소) | `10.10.70.151:11445`에서 GET 200, A1C QA HOLD metadata-only `SOURCE_GUIDANCE` 200, CT 금식 `GENERATED` 200 확인; 허용되지 않은 Host와 Origin은 각각 403 |
| 다른 컴퓨터에서의 LAN 접속 | NOT VERIFIED | 원격 컴퓨터 접속 검증 전 |
| 임상 정확성·환자 서비스 적격성 | NOT VERIFIED | 별도 임상 검토/승인 범위 밖 |

현재 개발 PC의 Ethernet IPv4는 `10.10.70.151/25`이며 최신 데모 서버가 `10.10.70.151:11445`에 실행 중이다. 이 PC의 네트워크 프로필은 Public이고 현재 셸은 관리자 권한이 아니므로 방화벽 규칙은 적용하지 않았다. 같은 PC에서 NIC 주소를 통한 HTTP는 확인했지만 다른 컴퓨터의 접속은 `NOT VERIFIED`다. 연결이 막히면 관리자 PowerShell에서 위 규칙을 적용할 수 있다. 의존성 설치 없이 기존 시작 스크립트를 사용했다. A1C QA HOLD의 생성 실패 시에는 번역 본문 발췌 없이 상태·링크만 제공하는 것을 확인했다.

### 2026-10-13 MRI/X선 focus 회귀 및 loopback 재확인

기존 LAN preview 프로세스에는 연결하거나 재시작하지 않고, 임시 학교 데모 서버를 `127.0.0.1:11445`에 따로 시작해 검증 후 종료했다. MRI 목록 오탐 차단 전 focused tests는 **34/34 PASS**, 후보 검색 평가는 제목 근거 **993/1,017**, golden **29/29**, safety **3/3**이었다. 새 MRI 금속·MRI 방사선·X선 방사선 모델 스모크와 CT 금식·복합 방사선+임신 스모크는 **5/5 PASS**했다. HTTP는 GET 200, QA HOLD 목록 107건 확인, MRI 금속·X선 방사선 `GENERATED`/출처 1개, MRI 조영제 부작용 `INSUFFICIENT_EVIDENCE`/출처 없음, A1C `SOURCE_GUIDANCE`/본문 발췌 없음이었다. 이어 MRI 목록형 오탐을 fail-closed로 막고 focused tests **34/34**, golden **31/31**, safety **3/3**을 재확인했다. 최종 loopback HTTP에서 장신구·심박조율기는 `INSUFFICIENT_EVIDENCE`/출처 0/모델 미호출, 금속 물체는 `GENERATED`/출처 1을 확인했다. 합성 로컬 데모 경로 확인이며 다른 컴퓨터 LAN 접속, 번역 의미·임상 정확성, 환자 서비스 적격성은 `NOT VERIFIED`다.

경로 경계 확인: 인증 환자 API `/api/v1/me/health-helper/questions`는 `src/health-helper-rag.js`의 별도 승인 코퍼스와 `VISIT_PREPARATION`/`SOURCE_GUIDANCE` 모드를 사용하며, 이 후보 MedlinePlus 검색은 학교 데모 경로 `/candidate/questions`에 한정된다. 따라서 이번 결과는 환자 포털의 RAG 통합이나 환자 서비스 검증을 뜻하지 않는다.

### 2026-10-13 후속: MRI 후보 목록 근거의 출처 안내 경로

위 MRI 목록 fail-closed 결과 이후, 후보 자료 안에서 제목·항목의 출처 관계를 확인할 수 있도록 학교 데모 검색기만 후속 조정했다. 목록 제목과 각 허용 항목을 `sourceComponents`로 보존하고 해시·segment ID·출처 일치 여부를 검증한다. 사용자는 이를 자동 생성된 의료 조언이 아닌 목록 출처 안내로 받으며, 모델은 호출하지 않는다. 출처 카드에는 번역 조각을 읽기 쉬운 문장 형태로 연결했다는 안내를 표시한다. 이 후속 구현은 학교 데모 전용이며 임상 또는 환자 서비스 사용 승인이 아니다.

- MRI 장신구·머리핀·보청기 목록과 심박조율기/삽입물 고지 목록: `SOURCE_GUIDANCE`, `generationUsed=false`.
- 기기 안전성 여부, 금속 제거 지시, 미지원 목록 또는 부정확한 매핑: 계속 `INSUFFICIENT_EVIDENCE`.
- 최신 focused tests: **35/35 PASS**; 전체 retrieval golden: **37/37 PASS**; safety: **3/3 PASS**. 원문 구성요소 변조 차단 및 UI의 목록 출처/비생성 고지 표시 회귀를 포함한다.
- 별도 비환자 uploaded-corpus 후보 API를 임시 `127.0.0.1:11444`에 띄워 HTTP 응답을 확인했다. 장신구·심박조율기 고지는 `SOURCE_GUIDANCE_LIST_CONTEXT`/`generationUsed=false`/출처 1개, 심박조율기 MRI 적합성은 `INSUFFICIENT_EVIDENCE`/출처 0개였다. 이 응답 경로는 코드상 Ollama 호출 이전에 반환한다. 임시 서버는 종료했고 포트가 닫힌 것을 확인했다. 기존 LAN preview `10.10.70.151:11445`에는 연결하거나 재시작하지 않았다. 환자 API·UI 경로의 모델호출 동작은 이번 확인 범위가 아니다.
- 1,017개 후보문서, 20,338개 색인 청크, 993개 exact-title 근거, 원래 QA HOLD 107개 및 미해결 이슈 111개는 변경되지 않았다.

### 2026-10-13 구조화 MRI 목록 출처 계약

이전 후속안의 합성 `excerpt` 표시는 더 이상 외부 응답/UI에 쓰지 않는다. 비환자 후보 API `SOURCE_GUIDANCE_LIST_CONTEXT`는 출처 검증 후 `listContexts: [{ heading, items }]`로 원문 번역 조각을 분리 반환한다. 모델 payload builder는 이 구성형 근거를 받으면 `SOURCE_CONTEXT_REQUIRES_GUIDANCE`로 거부한다. UI는 출처 drawer 안에서 안내 문장과 목록 항목을 각각 구조화된 텍스트로 표시하고, 문장부호를 새로 연결하지 않는다. QA HOLD면 목록 본문을 응답에서 숨긴다.

- focused tests: **35/35 PASS**. retrieval golden: **37/37 PASS**; safety probes: **3/3 PASS**.
- MRI 장신구·심박조율기 고지 스모크: **2/2 PASS**, `SOURCE_GUIDANCE_LIST_CONTEXT`, model invocation `NOT_PERFORMED`, structured list match.
- `127.0.0.1:11444` 임시 HTTP: 허용 목록 2종 `listContexts`와 `generationUsed=false`; 합성 excerpt 필드 없음. 심박조율기 적합성 질의 `INSUFFICIENT_EVIDENCE`, 출처 0. 임시 서버 종료 및 포트 닫힘 확인.
- 인덱스 통계는 1,017 docs / 20,338 chunks / 993 exact-title / QA HOLD 107 / unresolved 111로 유지. 이는 학교 데모 검색 무결성만 증명하며 임상·번역 정확성이나 환자 서비스 승인은 아니다.

다음 작업은 기존 claim-review 패킷에 이 MRI 목록의 원문 locator와 번역·의미·임상·권리 검토 필드를 정확히 연결하는 것이다. 검토 완료 전 비임상 후보 경계와 `serviceEligible=false`를 유지한다.


### 2026-10-13 MRI 목록 출처 안내 구현 스냅샷

- MRI 목록형 질의의 번역 제목과 해당 항목을 각각 원본 세그먼트 ID·해시와 연결한 뒤, 출처 문구를 읽을 수 있는 한 문장으로 구성한다. 장신구·시계, 머리핀, 보청기, 심박조율기 고지 질의는 정확한 항목 하나만 발췌하는 extractive source guidance 경로를 사용하며 모델을 호출하지 않는다. 심박조율기 안전성 판단이나 일반 금속 제거 지시는 근거가 없어 계속 보류한다.
- 해당 구현 시점 focused regression은 34/34 PASS, 고정 검색 golden은 37/37 PASS, safety probes는 3/3 PASS다. 1,017개 제목 sweep은 정확 근거 993개, 안전 거부 19개, 짧거나 모호한 질문 5개다.
- 로컬 Qwen 금식 초점 스모크 1/1 PASS(10.7초): claim 하나를 서버가 허용한 증거 문장에서 구성했고 출처는 하나다. 원문 질문 필드는 모델 입력에서 제외됐다. 앞서 기록된 9개 스모크는 기존 실행 기록이며 이 수정 이후의 전체 9개 재실행으로 해석하지 않는다.
- 번역 인덱스 PASS 1,017/1,017은 한글 텍스트·해시·색인 무결성 상태다. 원래 콘텐츠 QA HOLD 107건과 미해결 이슈 111건은 그대로 남아 있다. 번역 의미, 출처 권리 세부 범위, 임상 정확성은 검증되지 않았다.
- 코드 및 테스트는 갱신했지만, 수정 코드를 반영하려는 실행 중인 11445 서버 재시작은 자동 검토 정책에 의해 거부됐다. 따라서 현재 10.10.70.151:11445 HTTP 화면이 최신 MRI 목록 구현을 제공하는지는 NOT VERIFIED이며, 이전 PID 21448은 기존 포트 리스너로 확인된 상태였다. 최신 서버 HTTP 응답, Host/Origin 거부는 재시작 후 확인해야 한다. 다른 컴퓨터 LAN 접속도 NOT VERIFIED다.
- 이 구현 시점 기록은 위의 29/29 및 31/31 golden 결과보다 최신이며, 그 뒤 답변 생성·인용 검증 후속 기록이 현재 결과를 갱신한다. 별도 검토자는 두지 않으며 자동 QA HOLD를 콘텐츠 PASS로 승격하지 않는다.


### 2026-10-13 답변 생성·인용 검증 후속

- Qwen 생성 스모크 9/9 PASS: 빈혈 증상, CT 준비·금식·임신·방사선·방사선+임신, MRI 금속·방사선, X선 방사선. 각각 서버가 만든 claim 1개와 출처 1개를 확인했고 원문 질문은 모델 입력에서 제외했다.
- MRI 장신구 및 심박조율기 고지 2/2는 SOURCE_GUIDANCE_LIST_CONTEXT와 원문 구성요소 발췌 일치를 확인했으며 모델은 호출하지 않았다. 스모크 스크립트가 이 결정형 경로를 잘못 모델 호출 대상으로 보던 점도 바로잡았다.
- CT 준비 스모크에서 모델이 답 claim은 E1 문장에서 선택하면서 evidenceIds에는 사용하지 않은 E2·E3도 포함하는 문제가 발견됐다. 서버 검증을 느슨하게 하지 않고, 프롬프트가 evidenceIds를 claimEvidence와 정확히 같은 집합으로 반환하도록 명시한 뒤 9개 생성 스모크를 모두 다시 통과했다.
- 출처 구성 MRI 문맥이 일반 MRI 설명의 모델 선택 후보에 섞이지 않도록, 조합 문맥은 해당 목록 항목 상세 라우트에서만 사용한다. 최신 집중 테스트 **35/35**, 검색 golden **37/37**, 안전 probe **3/3** PASS다.
- 전체 데모 색인은 1,017/1,017 PASS, 원래 QA HOLD 107건과 미해결 이슈 111건을 유지한다. 이는 번역·색인 무결성 상태이며 번역 의미나 임상 정확성 검증이 아니다.
- HTTP 런타임은 여전히 이전 PID 21448이 10.10.70.151:11445를 점유한다. 이 코드 반복 후에도 해당 프로세스 재시작은 자동 검토 정책에 의해 거부됐으므로 최신 코드의 HTTP 반영, Host/Origin 응답 및 다른 컴퓨터 LAN 접속은 NOT VERIFIED다.


### 2026-10-13 격리 HTTP 응답 확인

- 최신 코드를 읽는 임시 non-patient 업로드 후보 preview를 127.0.0.1:11444에서 확인했다. GET /는 200, HOLD 목록은 107건이었다. MRI 장신구 질의는 SOURCE_GUIDANCE_LIST_CONTEXT·generationUsed=false·출처 1개이며 한국어 번역 heading과 선택 항목이 구조화되어 반환됐다. 심박조율기 적합성은 INSUFFICIENT_EVIDENCE·출처 0개, A1C는 본문 excerpt 없는 SOURCE_GUIDANCE였다.
- 잘못된 Origin과 Host는 각각 403이었다. 임시 프로세스를 종료한 뒤 11444 listener가 사라진 것을 확인했다.
- 이는 공통 업로드 후보 라우트의 loopback 확인이며, 현재 학교 데모 프로필의 10.10.70.151:11445 반영이나 다른 컴퓨터 LAN 접속을 증명하지 않는다. 기존 PID 21448은 계속 11445를 점유하고 있고 최신 프로세스 재시작은 미완료다.


### 2026-10-13 MRI 목록 claim 검토 패킷

- 장신구·시계, 머리핀, 보청기 제거 목록과 심박조율기/삽입물이 있으면 의료진에게 알리라는 안내를 네 개의 claim으로 분리해 `health-helper-mri-list-review-packet-2026-10-13-v1.json`에 기록했다. 원본 후보 record의 segment ID·HTML locator·영문 문구·한국어 번역과 8개 corpus chunk의 SHA-256을 고정하고, 원본 JSONL 파일 SHA-256이 manifest 입력 해시와 일치하는 것도 확인했다. 각 응답은 `LIST_GUIDANCE`의 heading + 단일 item 구조로 표현했다.
- 사용한 출처는 [MedlinePlus MRI Scans](https://medlineplus.gov/mriscans.html)이며, 준비 섹션의 원문 위치와 page update 표기를 확인했다(확인일 2026-10-13, page last updated 2026-06-01). HTML 스냅샷은 저장하지 않아 page hash 기반 재현은 아직 불가하다.
- 검토 상태는 의도적으로 전부 `UNASSESSED`/미배정이다. 기존 MedlinePlus 권리 메모는 `/lab-tests/` 후보 범위여서 이 Health Topic 페이지에 재사용 권한을 부여하지 않는다. 특히 연결된 hearing-aids 정보의 본문은 후보 자료에 포함·승인된 것으로 보지 않는다.
- 패킷 validator: **3/3 PASS**(정상 원문/번역·코퍼스 hash 매핑, hash 변조 거부, 임상 승인 상태를 임의 기입한 패킷 거부). 독립 검토·임상 승인·권리 승인·환자 서비스 적격성을 검증한 결과는 아니다.
- 이 작업은 검토용 데이터 큐레이션이다. Qwen 파인튜닝, 환자 API·웹 UI, DB migration, RAG 운영 인덱스, 10.10.70.151:11445를 변경하지 않았다. 기존 학교 데모 및 환자 경로의 전체 런타임 상태는 이전 기록 그대로이며 최신 코드의 LAN HTTP 반영은 계속 `NOT VERIFIED`다.
- 다음 작업: 독립 검토 역할을 지정하고 각 claim의 source support, 번역, 임상 범위 및 권리·표시 방식을 판정한다. 그 전까지 `clinicalUse=false`, `serviceEligible=false`, `DRAFT / UNASSIGNED`를 유지한다.
