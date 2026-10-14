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

같은 사설망의 다른 컴퓨터에서도 열려야 하면 서버 컴퓨터의 사설 IPv4 주소를 확인하고 전용 LAN 실행 스크립트를 사용한다. 이 스크립트는 RFC1918 사설 IPv4 하나에만 바인딩하고 `11446` 포트를 사용한다. `10.0.0.25`는 실제 서버 컴퓨터 주소로 바꾼다.

```powershell
$env:HIPASS_HEALTH_HELPER_SCHOOL_LAN_HOST='10.0.0.25'
node scripts/start-health-helper-school-demo-lan.js
```

다른 컴퓨터 브라우저에서 `http://10.0.0.25:11446/`를 연다. 데모는 지정한 Host/Origin만 허용한다. Windows 방화벽이 연결을 막고 서버의 네트워크 프로필이 Private이면 관리자 PowerShell에서 아래 규칙을 추가할 수 있다. `10.0.0.25`와 `LocalSubnet` 간 TCP 11446만 허용하며, 사용 후 제거할 수 있다. 실행 스크립트는 방화벽 규칙을 자동 변경하지 않는다.

```powershell
$ip='10.0.0.25' # 서버 컴퓨터의 실제 사설 IPv4로 변경
New-NetFirewallRule -Name 'HiPass-School-RAG-11446' -DisplayName 'HiPass School RAG Demo (Local Subnet)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11446 -LocalAddress $ip -RemoteAddress LocalSubnet -Profile Private
```

```powershell
Remove-NetFirewallRule -Name 'HiPass-School-RAG-11446'
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
- `scripts/start-health-helper-school-demo.js`, `scripts/start-health-helper-school-demo-lan.js`, `package.json`: 로컬 및 사설 IPv4 전용 LAN 시작 명령.
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
- 학교 발표용 MVP에서는 사용자 지시에 따라 별도 검토자 배정 작업을 수행하지 않는다. 번역 후보는 모두 데모 색인 PASS로 포함하며 `clinicalUse=false`, `serviceEligible=false`를 유지한다. 위 패킷의 검토 상태는 과거 기록이고 학교 데모 구현의 선행 승인 조건이 아니다.


### 2026-10-13 인증 환자 API와 후보 RAG 격리 회귀

- `src/server.js`의 실제 구성 분기를 조사했다. Ollama 연결 시 환자 helper는 `VISIT_PREPARATION`, 그렇지 않으면 `SOURCE_GUIDANCE`로 실행된다. 업로드 MedlinePlus 코퍼스 검색은 local candidate preview에서만 사용되고, 현재 `HealthHelperRag`의 승인된 서비스 코퍼스와 합쳐져 있지 않다.
- 환자 API와 같은 `createHealthHelperHandler`에 합성 인증 주체를 주입한 loopback HTTP 통합시험을 추가했다. 테스트는 동일한 MRI 질의를 후보 코퍼스에서 먼저 검색해 `CANDIDATE`임을 확인한 뒤, 환자 handler의 `SOURCE_GUIDANCE`/`VISIT_PREPARATION`/`GENERATION` 모드를 각각 호출한다. 모두 `INSUFFICIENT_EVIDENCE`, 출처 0, 생성모델 호출 0이어야 하며 응답에 MRI 후보 근거나 URL이 없어야 한다.
- 환자 웹 UI 회귀도 보강해 `INSUFFICIENT_EVIDENCE`를 명시하고 후보 미검토 근거에 대한 출처 카드나 인용 drawer를 만들지 않는 것을 확인했다. `node --test test/patient-helper.test.js`: **16/16 PASS**.
- `node --test test/health-helper-http.test.js`: **11/11 PASS**. 이어서 HTTP·RAG·코퍼스·업로드 RAG·MRI review packet·patient helper 여섯 test file을 묶은 회귀 **77/77 PASS**. 이는 handler·서비스 경계에 대한 합성 loopback/DOM 시험이며 production 인증/ingress, 브라우저 로그인 세션, 현재 LAN preview의 동작을 확인하지 않는다.
- 이 분리는 최종 연결 기능이 완료됐다는 뜻이 아니다. 인간 검토와 권리 확인 후 승인된 불변 코퍼스 버전을 만들어 명시적 서비스 promotion을 해야 한다. 현재 RAG integration readiness는 `NOT READY — REVIEW/PROMOTION REQUIRED`다.

### 2026-10-13 후보 MRI 검토 입력·진행률 보완

후보자료를 RAG에 계속 반영하는 방식은 모델 가중치의 자동 학습이 아니라 버전이 고정된 retrieval corpus를 반복 큐레이션하는 방식으로 권고한다. 매 반복은 출처/원문 segment 고정, 번역과 claim 근거 검증, 독립 검토, 회귀·안전 평가, 승인된 버전의 명시적 promotion으로 구성하며, 검토 중 후보는 환자용 RAG에서 격리한다.

기존 MRI 검토 패킷 검증기가 미평가 상태만 허용하여 reviewer 결과를 기록할 수 없던 연결 공백을 수정했다. 기존 v1 packet은 변경하지 않고 SHA-256에 묶인 `health-helper-mri-list-review-overlay-2026-10-13-v2.json`를 별도로 만들었다. 기존 claim-review decision enum 및 필수 역할·reviewer ID 형식·날짜·근거·claim별 출처 segment 제약을 검사한다. 권리 설명 맥락은 overlay의 `rightsReviewContext`로 분리했고 실제 권리 판정은 계속 `UNASSESSED`다. 유효한 주석도 서비스 승인으로 승격되지 않으며 `clinicalUse=false`, `serviceEligible=false`가 유지된다.

현재 v2 overlay에 사람의 판정은 기입하지 않았다. 진행률 CLI `npm run rag:mri-review-progress`는 **0/17 review cells**(4 claims × 4 axes + source rights), 4개 claim 미평가, 서비스 부적격을 보고한다. 관련 MRI packet 시험 **7/7 PASS**, HTTP·RAG·코퍼스·업로드·MRI packet·patient UI 6개 파일 회귀 **80/80 PASS**. 이는 구조 검증이며 reviewer 신원·자격, 번역 의미, 임상 적합성, 권리 허가를 증명하지 않는다.

다음 작업은 새 후보를 무검토로 계속 색인하는 것이 아니라, 조직 검토자 배정 후 해당 고정 packet에 출처·번역·임상·편집·권리 판정을 각각 기록하는 것이다. 합성 annotation만으로 현재 packet의 미평가 상태를 바꾸지 않는다.


### 2026-10-13 출처 UI 구조와 답변 anchor 최종 회귀

- MRI 목록 검색에 쓰는 내부 조합 근거는 sourceComponents 해시·segment ID로 검증하되, 사용자 응답에서는 조합 excerpt를 제거한다. source guidance의 listContexts로 번역 heading과 선택된 항목을 별도로 전달하고 UI는 이를 목록 구조로 표시한다. 문장부호를 추가한 합성 문장을 원문 인용인 것처럼 노출하지 않는다.
- Qwen 생성 스모크는 질문별 고정 번역 문구 anchor를 포함해 9/9 PASS했다. 각 응답은 검증된 claim 1개·출처 1개이며, 고정 anchor coverage와 초점 커버리지를 통과했다. MRI 장신구 및 기기 고지 source guidance는 모델 호출 없이 structuredListMatches 2/2 PASS다.
- 최신 focused regression 35/35 PASS, 검색 golden 37/37 PASS, safety 3/3 PASS. anchor 검증은 한국어 번역 의미나 임상 정확성을 보증하지 않는다.
- 번역 색인 PASS 1,017/1,017, 콘텐츠 QA HOLD 107건, 미해결 111건은 그대로다. 현재 11445 PID 21448에 최신 코드가 반영되지는 않았으며 다른 PC LAN 접속은 NOT VERIFIED다.

### 2026-10-13 전체 번역 후보 PASS 재확인 및 답변 검증 진단

- 사용자 지시: 학교 발표용 MVP에서 별도 검토자 없이 한국어 번역문을 사용한다. 모든 번역 후보 1,017건을 demoIndexStatus=PASS로 검색 색인에 포함한다. 원래 자동 QA HOLD 107건/미해결 111건은 이력으로 보존하고 데모 색인에서 제외하지 않는다. PASS의 범위는 번역문 무결성·색인 가능 여부이며 임상 승인을 뜻하지 않는다.
- 기존 구조: Node.js 업로드 후보 preview, 한국어 검색 조각 20,338개, Ollama/Qwen 근거 문장 선택, 서버 측 인용 검증. 모델 가중치 학습이나 외부 벡터DB는 추가하지 않았다.
- 변경: src/health-helper-medlineplus.js의 답변 검증 오류에 reasonCode를 추가했다. 인용 집합 불일치, 문장 범위/허용 범위 오류, 연속 문장 규칙 위반, 초점 누락 등을 구분한다. 외부 오류 메시지는 EDUCATION_OUTPUT_REJECTED로 유지하고 진단에 모델 원문을 포함하지 않는다.
- scripts/medlineplus-upload-model-smoke.js의 중복 판정 로직을 제거하고 실제 서버 validator의 reasonCode를 기록한다. test/health-helper-medlineplus.test.js에 여섯 실패 조건과 정상 결과 회귀를 추가했다. 생성 파일 없음.
- 관련 요구사항: 학교 데모용 별도 RAG FR 미배정. FR-014~025 접근정책, FR-037~041 감사, FR-042~046 개인정보 경계에 대한 기존 구현과 API 계약은 변경하지 않는다.

| 검사 | 결과 | 근거 |
|---|---|---|
| 업로드 RAG·근거 검증·환자 UI 회귀 | PASS | node --test 3개 파일, 37/37 |
| 전체 번역 후보 색인 | PASS | 1,017/1,017 PASS, 한국어 조각 20,338개 |
| 검색 golden / 안전성 | PASS | 37/37 및 3/3 |
| 실제 로컬 Qwen CT 준비·방사선/임신 | PASS | 2/2, 근거 문장 및 답변 anchor 일치 |
| MRI 장신구 목록 출처 응답 | PASS | 원문 heading/item 일치, 모델 호출 없음 |
| 스크립트 구문·diff 공백 검사 | PASS | node --check 및 git diff --check 종료 0 |
| 임상 정확성·번역 의미 정확성 | NOT VERIFIED | 이번 검사는 검색·인용·응답 구조 검사 |
| 최신 코드의 11445 반영·다른 PC 접속 | NOT VERIFIED | 기존 PID 21448이 10.10.70.151:11445 점유, 이번 작업에서 재시작하지 않음 |

### 2026-10-13 모델 통신 실패 경로와 평가 일치

- 기존 preview와 스모크 평가가 서로 다른 HTTP/JSON 처리 코드를 사용하던 부분을 공통 generateCandidateAnswer로 묶었다. 학교 데모의 근거 검색, 인용 검증, 오류 시 출처 안내 경로는 유지한다. 환자 서비스 API는 변경하지 않았다.
- 생성 파일: src/health-helper-candidate-generation.js, test/health-helper-candidate-generation.test.js. 수정 파일: scripts/medlineplus-local-preview.js, scripts/medlineplus-upload-model-smoke.js, 이 문서.
- 모델 연결 실패, HTTP 실패, 빈 응답, 외부/내부 JSON 오류, 미완료 생성, UTF-8/스트림 오류, 64 KiB 응답 초과, 시간 초과와 클라이언트 취소를 고정 reasonCode로 구분한다. 오류에 모델 답변이나 upstream 상세 내용을 첨부하지 않는다. 기본 시간 제한은 120초이며 preview는 기존 모드별 제한을 전달한다.
- 원문 질문을 모델에 보내지 않는 동작과 서버 측 근거 문장 선택 검증을 재확인했다. 응답 한도는 문자열 글자 수가 아닌 실제 바이트 수로 적용한다. 잘못된 생성 문장은 표시하지 않고, 검증된 후보 출처 안내를 사용할 수 있다. QA HOLD 자료의 fallback은 기존대로 링크·상태만 제공한다.
- 관련 요구사항: 데모 RAG 별도 FR 미배정. FR-014~025/FR-037~041/FR-042~046에 해당하는 환자 접근정책·감사·개인정보 경계의 변경은 없다. 비밀정보 추가 및 라이브러리 추가 없음.

| 검사 | 결과 | 근거 |
|---|---|---|
| 모델 통신·근거·업로드 검색·UI 회귀 | PASS | 4개 test file, 42/42 |
| 최종 통신 전용 회귀 | PASS | 기본 timeout 및 한국어 바이트 분할 수정 후 5/5 |
| 실제 Qwen CT 금식 | PASS | 공통 서버 통신 사용, 근거 문장/anchor 일치 |
| 실제 Qwen CT 방사선·임신 | PASS | 모든 초점 및 고정 anchor 포함 |
| 실제 Qwen MRI 방사선 | PASS | 근거 문장/anchor 일치 |
| preview·스모크 구문 및 diff 검사 | PASS | node --check, git diff --check 종료 0 |
| 임상적 의미·번역 품질 | NOT VERIFIED | 모델의 선택 및 인용 검증 범위 |
| HTTP fallback 전체 경로·최신 LAN 실행 | NOT VERIFIED | 이번 검사는 통신 모듈과 출처 함수이며 실행 서버 재시작 미수행 |

- 다음 우선 작업: 학교 데모 HTTP 경로의 모델 실패·취소·대체 응답을 통합 검증하고, 실행 중인 서버와 최신 코드의 일치 여부를 확인한다. 모든 번역 후보의 학교 색인 PASS 정책과 별도 검토자 없이 진행하는 사용자 범위는 유지한다.
### 2026-10-13 학교 데모 HTTP 실패·취소·동시 요청 회귀

- 작업 목적: 실제 HTTP 요청에서 모델 오류 후 출처 안내가 유지되고, 취소/시간 초과 이후 다음 질문을 처리할 수 있도록 검증했다. 기존 preview의 질문 처리 코드를 createCandidateQuestionHandler로 분리해 실행 코드 자체를 ephemeral loopback HTTP 서버로 시험했다.
- 확인된 결함: 이전 코드는 본문 읽기 전 active만 검사해 비동기 본문 읽기/검색 중 두 요청이 동시에 통과할 수 있었다. 모델 호출 직전에 active와 최근 호출 수를 다시 확인하고 즉시 슬롯을 획득한다. 제한은 모델 호출 5회/분이며 모델 호출 없이 표시하는 출처·거부 응답은 횟수를 소비하지 않는다.
- 큰 본문을 읽다가 예외를 던질 때 기존 for-await가 요청 스트림을 파괴해 400 대신 연결 종료가 발생할 수 있었다. destroyOnReturn=false와 남은 본문 drain을 적용해 4,096 byte 초과를 INVALID_INPUT 400으로 안내한다.
- 모델 실패 시 학교 프로필은 기존 SOURCE_GUIDANCE 200 응답을 유지한다. QA HOLD는 출처 링크·상태만 제공한다. 일반 후보 프로필은 MODEL_UNAVAILABLE_OR_OUTPUT_REJECTED 503을 유지한다. 취소된 연결에는 응답하지 않고 finally에서 타이머·이벤트 리스너·모델 슬롯을 정리한다.
- 생성 파일: src/health-helper-candidate-http.js, test/health-helper-candidate-http.test.js. 수정 파일: scripts/medlineplus-local-preview.js 및 이 문서.
- API 계약: POST /candidate/questions 경로와 정상/실패 JSON 구조 유지. 동시 실행 허용 결함은 BUSY 429로 차단하며 초과 본문은 명시적 400 응답으로 처리한다. 영향 화면: 후보 preview 건강도우미. 영향 테스트: 후보 HTTP/모델 통신/코퍼스/UI 회귀. 환자 서비스 API와 DB 변경 없음.
- 관련 요구사항: 데모 RAG 별도 FR 미배정. 기존 FR-014~025/FR-037~041/FR-042~046 의료영상 접근통제·감사·개인정보 경계 변경 없음. 새로운 인증 우회·외부 모델 endpoint·실제 환자 데이터 없음.

| 검사 | 결과 | 근거 |
|---|---|---|
| 후보 HTTP 통합 | PASS | 8/8, 정상 생성·모델 오류·HOLD fallback·deadline·동시 요청·클라이언트 취소·입력/Host/Origin·rate window |
| 통신·HTTP·검색·근거·UI 전체 focused 회귀 | PASS | 5개 test file, 50/50 |
| 최신 preview 11444 loopback 접속 | PASS | GET / 200, QA 보류 목록 107개, MRI 목록 출처 응답, 호환성 근거 부족, 잘못된 Origin 403, 초과 본문 400 |
| preview 구문 및 diff 검사 | PASS | node --check 및 git diff --check 종료 0 |
| 학교 LAN 11445 최신 반영·다른 PC 접속 | NOT VERIFIED | 기존 프로세스는 재시작하지 않음 |
| 임상 정확성·번역 의미 정확성 | NOT VERIFIED | 이번 HTTP 회귀 범위 밖 |

- HTTP 통합 테스트의 모델 응답은 주입된 합성 fetch이며, 실제 Qwen의 정답률 증거로 사용하지 않는다. 실제 preview 확인은 QA_PASS_TRANSLATIONS_ONLY 11444 프로필이다. 모든 번역 1,017건을 사용하는 학교 프로필의 HTTP 분기는 공통 handler에 allowSourceFallback=true를 주입해 검증했다. 테스트용 별도 preview 프로세스는 확인 후 종료했다.
- 다음 우선 작업: 질문 표현 변형과 대화 문맥이 올바른 주제/근거로 연결되는지 평가하고 개선한다. 학교 색인 PASS 정책과 별도 검토자 없이 진행하는 범위는 유지한다.
### 2026-10-13 후속 질문과 명시적 주제 변경 분리

- 확인된 문제: preview의 고정 주제 차단 목록에 MRI, A1C, 엑스선 등 다수의 후보 주제가 없었다. '그럼 MRI는?' 앞에 이전 CT 제목을 붙이면 두 주제가 섞여 잘못된 검색 또는 근거 부족 응답이 발생할 수 있었다.
- 구현: 번역 코퍼스에서 확인한 주제명·약어 1,139개를 중복 제거해 preview에 전달한다. resolveCandidateQuestion은 명시적인 후속 표현에만 이전 주제를 붙이며, 코퍼스 주제가 등장하면 원문 질문을 유지한다. Latin 약어는 다른 Latin 단어 내부에서 매칭하지 않는다. 결합 후에도 기존 600자 제한을 지킨다. unknown topic/모든 자연어 표현을 해결한다고 주장하지 않는다.
- MRI 목록 안내와 모델 실패의 출처 안내에도 서버가 검증된 evidence의 title_ko를 contextTopic으로 반환한다. 새 대화와 기록 변경 시 기존 context reset은 유지한다. 오류/취소된 응답은 기존 동작대로 문맥을 갱신하지 않는다.
- 생성 파일: public/ui/candidate-question-context.js, test/candidate-question-context.test.js. 수정 파일: scripts/medlineplus-local-preview.js, src/health-helper-candidate-http.js, test/health-helper-candidate-http.test.js 및 이 문서.
- API 변경 전: 정상 모델 생성 응답만 contextTopic 제공. 변경 후: POST /candidate/questions의 목록/생성 실패 source guidance에도 contextTopic을 추가한다. 요청 body는 question 단일 필드 그대로다. 영향 화면: 학교·후보 preview 후속 질문. 영향 테스트: 후보 문맥/HTTP 및 기존 검색·UI 회귀. 환자 서비스 API 변경 없음.
- 관련 요구사항: 학교 데모 RAG 별도 FR 미배정. 기존 FR-014~025/FR-037~041/FR-042~046 환자 접근정책·감사·개인정보 경계 변경 없음. 모델에는 기존대로 canonical intent와 검색 근거만 전달한다. 새 DB·라이브러리·비밀정보 없음.

| 검사 | 결과 | 근거 |
|---|---|---|
| 후보 문맥·HTTP·통신·검색·근거·UI 회귀 | PASS | 6개 파일, 52/52 |
| 전체 학교 코퍼스 문맥 검색 | PASS | CT 준비/금식, 빈혈 원인, MRI/A1C/엑스선 전환 및 개인 수치/호환성 차단 |
| 최신 preview 모듈 제공 | PASS | 11444의 /preview.js 및 새 JS 모듈 HTTP 200 |
| 제공된 preview 스크립트 문맥 연결 | PASS | VM DOM/fetch 대역: 새 주제 보존·후속 문맥 연결·새 대화/기록 reset |
| 실제 목록 HTTP contextTopic | PASS | MRI source guidance의 contextTopic=source title |
| 구문·diff 검사 | PASS | node --check 및 git diff --check 종료 0 |
| 실제 브라우저 UI·11445 최신 반영·다른 PC 접속 | NOT VERIFIED | 이번 VM 대역/loopback 검증 범위 밖 |
| 임상 정확성·번역 의미 정확성 | NOT VERIFIED | 검색 경로 검증과 별개 |

- 확인용 11444 preview는 QA_PASS_TRANSLATIONS_ONLY 프로필이며 테스트 후 종료했다. 전체 1,017건 색인 PASS 정책은 그대로다. 별도 검토자 배정 없이 학교 데모 구현을 이어간다.
### 2026-10-13 실제 브라우저 대화·출처 회귀

- playwright 스킬의 CLI로 별도 health-context-1013 브라우저를 열고 최신 코드의 11444 QA_PASS_TRANSLATIONS_ONLY preview를 시험했다. 기존 학교 LAN 11445 프로세스는 변경하지 않았다.
- 데스크톱: MRI 장신구 질문 전송, 출처 서랍 개방, 목록 안내/장신구와 시계가 별도 요소로 표시되는 것을 확인했다. '그러면 머리핀도 제거해야 하나요?' 후속 질문도 MRI 출처와 머리핀 항목으로 연결됐다. 새 대화 뒤 같은 후속 질문은 이전 MRI 문맥을 사용하지 않고 근거 부족으로 응답했다. MRI 대화에서 '그럼 A1C는 무엇인가요?'는 A1C 출처로 전환됐다. 이 일반 후보 profile의 A1C는 QA HOLD 링크 안내이며 전체 번역 학교 profile의 생성 결과를 증명하는 것은 아니다.
- 모바일: ?surface=mobile, 390x844 viewport에서 질문 전송과 목록 서랍 표시를 확인했다. document.body.scrollWidth=390, innerWidth=390으로 가로 overflow가 없었다. 목록 안내와 장신구와 시계가 화면에 표시됐다.
- 수정 파일: scripts/medlineplus-local-preview.js. 일반 업로드 preview가 모델 답변을 제공할 수 있는데 'Qwen 생성 답변이 아닙니다'라고 표시하던 disclaimer를 번역 근거 검색/모델 답변·출처 안내 구분으로 바로잡았다. 학교 profile의 disclaimer는 그대로다. 새 라이브러리·API 변경 없음.
- 생성한 증거: output/playwright/candidate-mri-list-browser-20261013.png, output/playwright/candidate-mri-list-mobile-20261013.png. 두 이미지를 실제로 열어 확인했다. 브라우저와 테스트 preview는 확인 후 종료했다.
- 관련 요구사항: RAG 별도 FR 미배정. FR-014~025/FR-037~041/FR-042~046 환자 접근정책·감사·개인정보 경계 변경 없음. 합성 질문만 사용했고 기존 escaping/근거 검증을 유지했다.

| 검사 | 결과 | 근거 |
|---|---|---|
| 실제 desktop 질문·목록 출처·머리핀 후속 질문 | PASS | Playwright UI 조작 및 source drawer snapshot |
| 실제 새 대화 문맥 초기화·A1C 주제 전환 | PASS | 근거 부족 응답 / A1C 출처 링크 확인 |
| 실제 mobile 출처 표시·가로 overflow | PASS | 목록 항목 표시, scrollWidth=viewport=390 |
| desktop/mobile 콘솔 | PASS | Errors 0, Warnings 0 |
| 수정 후 UI·문맥 회귀 | PASS | 18/18 |
| preview 구문·diff 공백 | PASS | 종료 0 |
| 전체 번역 학교 profile의 실제 브라우저·최신 11445·LAN | NOT VERIFIED | 이번 실제 브라우저는 별도 11444 일반 업로드 profile |
| 의료/번역 의미 정확성 | NOT VERIFIED | 브라우저 사용 흐름과 별도 |

- 다음 우선 작업: 실제 실행 버전·코퍼스 profile을 구분할 수 있는 상태 정보를 보강해, 11445에서 최신 코드가 동작하는지를 명확히 확인한다. 모든 1,017건의 학교 색인 PASS와 검토자 없는 MVP 범위는 유지한다.
### 2026-10-13 실행 프로필·시작 시점 소스 지문 확인

- 작업 목적: 파일 수정과 실행 서버 반영을 구분하기 위해 GET /candidate/status를 추가했다. 기존 Host 검사와 no-store/security headers를 적용한다. runtimeContract, startedAt, startupSourceFingerprint, profile 및 코퍼스 버전/색인 범위/문서·조각 수를 반환한다. PID, 로컬 경로, 환경변수, 질문, 본문, 비밀정보는 포함하지 않는다.
- 모델 준비 상태는 modelAvailability=NOT_CHECKED로 표시한다. RUNNING은 이 상태 응답을 제공하는 프로세스가 동작한다는 뜻이며 Ollama 연결/정답/임상 검증 PASS가 아니다. 소스 지문은 시작 시점 지정 파일들의 snapshot이다. 이미 캐시된 모든 모듈의 실행 바이트와 일치한다는 보증으로 사용하지 않는다.
- 생성 파일: src/health-helper-candidate-runtime.js, scripts/verify-health-helper-candidate-runtime.js, test/health-helper-candidate-runtime.test.js. 수정 파일: scripts/medlineplus-local-preview.js 및 이 문서.
- 비교 명령은 기본 학교 URL의 실제 HTTP 상태를 검사한다. 로컬/사설 IPv4의 지정 후보 port만 허용하며 redirect를 따라가지 않고 5초 timeout/8 KiB 응답 제한/엄격한 UTF-8을 적용한다. 11445에서는 전체 번역 학교 profile, 코퍼스 v3, 문서/색인 PASS 1,017, 조각 20,338, 보존 QA HOLD 107을 검사한다. 코드가 바뀌면 현재 파일 지문과 startupSourceFingerprint 불일치를 보고한다.
- API 변경 전: 상태 endpoint 없음. 변경 후: GET /candidate/status 추가, 질문 API는 유지. 영향 화면: 없음(검증 도구용). 영향 테스트: runtime 상태·비교 및 기존 후보 회귀. RAG FR 미배정, 기존 FR-014~025/FR-037~041/FR-042~046 환자 경계 변경 없음.

학교 서버 검증 명령:

```powershell
node scripts/verify-health-helper-candidate-runtime.js
```

별도 일반 업로드 preview 검증 명령:

```powershell
node scripts/verify-health-helper-candidate-runtime.js http://127.0.0.1:11444
```

| 검사 | 결과 | 근거 |
|---|---|---|
| runtime·문맥·HTTP·통신·검색·UI 전체 회귀 | PASS | 7개 test file, 55/55 |
| 최신 11444 상태 API·현재 소스 snapshot 비교 | PASS | HTTP 200, verifier result PASS |
| 상태 API 경계·캐시 정책 | PASS | 잘못된 Host 403, cache-control=no-store, patientService=false |
| 기존 학교 10.10.70.151:11445 상태 API | FAIL | HTTP 404, RUNTIME_STATUS_NOT_IMPLEMENTED |
| 최신 학교 프로세스·다른 PC 접속 | NOT VERIFIED | 기존 실행 프로세스 재시작하지 않음 |
| 모델 준비·의료/번역 의미 정확성 | NOT VERIFIED | runtime metadata 검증 범위 밖 |

- 별도 11444 preview는 QA_PASS_TRANSLATIONS_ONLY 910건 상태를 정확히 반환했고, 확인 후 종료했다. 이 결과를 전체 번역 학교 profile의 실행 증거로 사용하지 않는다. 모든 학교 번역 후보 색인 PASS 정책은 그대로 유지한다.
### 2026-10-13 QA HOLD 답변 생성·개념 정의 근거 보강

- 작업 목적: 학교 데모에 색인된 번역 QA HOLD 문서에서 답변이 가능한지 확인하고, 개념 질문의 직접 근거 누락을 줄였다. RAG 평가는 전체 QA HOLD 포함 코퍼스 `SCHOOL_DEMO_ALL_TRANSLATIONS`를 사용하도록 스모크 프로필을 맞췄다.
- 기존 회귀 문제가 드러남: A1C의 본문에 검사 설명과 임계 수치가 있으나 일반 안전 regex가 출처에서 그대로 인용한 A1C/3개월 같은 숫자까지 거부했다. 학교의 extractive 경로에 한해 demoIndexStatus=PASS·원문 hash 일치 근거의 서버 선택 문장에서 숫자를 표시할 수 있게 했다. 모델은 문장 selector의 정수 index만 제시하고 문장과 후속질문은 서버가 만들며 수치 판단/새 숫자는 계속 금지한다. 자유 생성 경로와 후속 질문의 숫자는 계속 거부한다. 개인 수치 질의는 검색 단계에서 기존대로 거부한다.
- QA HOLD A1C를 실제 Qwen으로 시험: 출력 1건/출처 1건, 고정 번역 anchor 및 QA HOLD 출처 표시 통과. 시험 중 `semanticGrounding=NOT_PROVEN`, `clinicalUse=false`, `serviceEligible=false`.
- 두 번째 실제 실패: `관절염이란 무엇인가요?`에서 retrieval은 HOLD 문서의 제목 질문을 답변 후보로 제공했다. 첫 모델 응답은 정의 anchor를 놓쳐 실패했다. 선택적으로 새 사실을 넣는 대신 제목형 질문 문장/끝에 물음표가 있는 완전 문장을 검색 답변 후보에서 제외했고, 명시적 개념 질문에서 주제 자체를 가리키는 정의 문장이 있으면 검색 초점 `DEFINITION`으로 요구하도록 했다. 검사 준비 같은 PREPARE 질문은 정의 요구에서 제외된다.
- 재실행한 실제 Qwen 관절염/HOLD와 A1C/HOLD 스모크는 둘 다 1개 claim·1개 출처·answer anchor PASS, 출처 QA HOLD 표시 PASS. 관절염은 DEFINITION focus를 실제 커버했다. 의미적/임상적 정확성이 증명됐다는 뜻은 아니다.
- 생성/수정: 수정 `src/medlineplus-upload-corpus.js`, `src/health-helper-medlineplus.js`, `scripts/medlineplus-upload-model-smoke.js`, `test/medlineplus-upload.test.js`. 새 DB, 외부 인덱스/라이브러리/API 변화 없음.
- 관련 요구사항: 학교 데모 RAG FR 미배정. 모델에는 기존대로 검색 evidence sentence 목록과 허용 index/focus를 보낸다. source QA/임상 리뷰 상태를 덮어쓰지 않는다. FR-014~025/FR-037~041/FR-042~046 의료영상·환자 개인정보 경계 변경 없음.

| 검사 | 결과 | 근거 |
|---|---|---|
| A1C QA HOLD 실제 Qwen 답변 | PASS | 학교 전체 번역 코퍼스 1,017건, 1 claim·1 출처, 검사명 숫자 인용, QA HOLD 보존 |
| 관절염 QA HOLD 실제 Qwen 개념 답변 | PASS | DEFINITION focus, 1 claim·1 출처, 정의 anchor 충족 |
| 학교 검색 golden / safety | PASS | 현재 로직으로 37/37 및 3/3; 993 exact title /1,017 (0.9764) |
| 검색 코퍼스 색인·QA hold 보존 | PASS | 1,017 문서, 20,338 chunk, PASS 1,017, HOLD 107, 미해결 이슈 111 그대로 보존 |
| RAG HTTP·모델·runtime·문맥·코퍼스·UI 회귀 | PASS | 7개 test file, 58/58 |
| 구문·diff 공백 | PASS | node --check 및 git diff --check 종료 0 |
| 임상 정확성/번역 의미 | NOT VERIFIED | 합성 질문/앵커는 테스트 증거이지 임상 판단이 아님 |
| 최신 11445 실행 반영·다른 PC 접근 | NOT VERIFIED | 수정 코드를 기존 학교 LAN 프로세스에서 재시작/브라우저 확인하지 않음 |

- 다음 최선 작업: HTTP QA HOLD fallback/학교 프로필을 포함한 브라우저 질문 흐름을 확인하고, 11445의 상태 API로 실행 버전과 profile을 재검사한다. 색인 PASS 정책, 비임상 표시, 사용자 지시의 검토자 미배정 범위를 유지한다.
### 2026-10-13 전체 학교 코퍼스 서버·실제 브라우저 답변

- 별도 학교 프로필 `start-health-helper-school-demo.js`를 127.0.0.1:11445에 실행했다. 기존 10.10.70.151:11445 PID 21448은 다른 IPv4 주소를 사용 중임을 확인하고 그대로 두었다. 별도 브라우저와 서버도 검사 직후 종료했다.
- 상태 API: `SCHOOL_DEMO_ALL_TRANSLATIONS`, 코퍼스 v3, 1,017 문서, 20,338 조각, 번역 색인 PASS 1,017, source QA HOLD 107. 현재 파일 시작 snapshot fingerprint와 verifier 비교 PASS. 모델Availability=`NOT_CHECKED`은 별도다.
- 실제 학교 profile HTTP: MRI 장신구 질문은 SOURCE_GUIDANCE/구조화 목록, A1C 개인 수치 질문은 PERSONAL_INPUT_NOT_SUPPORTED/출처 없음. A1C 기본 개념 질문은 QA HOLD 문서에서 Qwen 생성 답변과 MedlinePlus 출처를 반환했고 답변과 출처 모두 QA HOLD 표시를 유지했다.
- 실제 Playwright 브라우저: `건강도우미 · 학교 발표용 RAG MVP` 페이지에서 A1C 생성 답변 `A1C는 제2형 당뇨병과 당뇨병 전단계를 확인하는 혈액검사입니다.`와 당화혈색소(A1C) 출처 카드, `자동 QA HOLD · 콘텐츠 검토 HOLD · 미해결 이슈 1건 · 임상 정확성 미검증` 표기를 확인했다. 이어 MRI 질문은 모델 생성 없이 원문 링크와 별도 목록 안내를 표시했다. browser console errors/warnings=0.
- 생성한 증거: `output/playwright/health-school-a1c-held-browser-20261013.png`, `output/playwright/health-school-mri-list-browser-20261013.png`. 실제 파일을 화면으로 열어 확인했다.
- 실행 진위 대조: 최신 127.0.0.1:11445 status/runtime verifier PASS. 사용 중이던 기존 10.10.70.151:11445에는 GET /candidate/status가 여전히 404이고 runtime verifier 결과는 `RUNTIME_STATUS_NOT_IMPLEMENTED`다. 두 프로세스와 profile을 혼동하지 않는다.
- 기존 프로세스를 종료/재시작하지 않았다. 바뀐 소스가 사용자가 접속하는 실제 LAN 서비스에 반영됐다는 결론은 내리지 않는다. 다른 컴퓨터 접속은 이번에도 확인하지 않았다.

| 검사 | 결과 | 근거 |
|---|---|---|
| 최신 학교 코퍼스 실행 profile | PASS | startup fingerprint 비교, status corpus 1,017/20,338/107 |
| 실제 Qwen A1C QA HOLD 생성 답변 | PASS | 1 claim/1 출처, 화면의 문장 및 QA HOLD 확인 |
| MRI structured source guidance | PASS | 실제 학교 브라우저의 원문 링크/목록 안내 |
| 개인 수치 차단·status 경계 | PASS | HTTP status 및 no source, clinicalUse=false, patientService=false |
| 브라우저 화면·콘솔 | PASS | 학교 profile desktop, console error/warnings=0 |
| 검색 golden/안전성/focused 회귀 | PASS | 37/37, 3/3, 58/58 (위 이전 실행 증거) |
| 기존 LAN 서버 최신 코드 반영 | NOT VERIFIED | 현재 status endpoint 404, 실행 프로세스는 그대로 |
| 다른 컴퓨터 접속 | NOT VERIFIED | 127.0.0.1 브라우저 시험만 수행 |
| 임상·번역 의미 검증 | NOT VERIFIED | 비임상 MVP, automated/model excerpt tests only |

- 다음 우선 작업: 사용 중인 10.10.70.151:11445의 기존 프로세스에 최신 서버 코드가 반영될 운영 경로를 확정하고, 그 다음 실제 다른 기기의 학교 profile 접속을 확인한다. 재시작이나 LAN 방화벽 변경은 현 task에서 하지 않았다. 번역 후보 1,017건 PASS 색인과 사용자의 검토자 없는 학교 발표용 MVP 범위는 유지한다.

### 2026-10-13 전체 번역 후보 PASS 및 실행 상태 재확인

- 사용자 지시를 재확인했다. 학교 발표용 후보 1,017건 모두 `demoIndexStatus=PASS`로 검색 인덱스에 포함한다. 이 색인 상태는 번역 무결성·적재 가능 여부만 뜻한다. 자동 QA `HOLD` 107건과 미해결 이슈 111건은 그대로 보존하며 별도의 임상·편집 승인을 부여하지 않는다.
- 전체 코퍼스 평가: 1,017문서, 20,338개 한국어 청크, 색인 PASS 1,017/1,017, 비한국어 청크 30개 제외. 제목+설명 합성 질의에서 993건은 해당 문서 근거를 찾았고, 5건은 짧거나 모호해 `INSUFFICIENT_EVIDENCE`, 19건은 치료·수술·응급 관련 fail-closed 규칙으로 `REFUSED`였다. 이 24건은 인덱스 실패가 아니며 응답 허용을 위해 안전 규칙을 완화하지 않았다.
- 검색 golden 37/37, 안전 사례 3/3, RAG 코퍼스·근거 검증·모델 전송·HTTP·runtime·문맥·UI 관련 회귀 58/58 통과. 임상 정확성 및 번역 의미 정확성은 검증하지 않았다.
- 실행 중인 `10.10.70.151:11445`는 프로젝트 학교 데모 프로세스 PID 21448이지만 `/candidate/status`에 404를 반환해 최신 runtime 상태 API가 없는 구버전으로 확인됐다. 최신 프로세스 반영을 위한 종료 명령은 실행 도구가 `blocked by policy`로 거부하여 재시작하지 않았다. 같은 사설망 인바운드 규칙 `HiPass-School-RAG-11445`도 현재 없으며, 앞선 규칙 추가 시도는 Windows에서 `액세스가 거부되었습니다`로 실패했다.
- 따라서 최신 RAG 코드와 새 상태 API의 LAN 서버 반영 및 다른 컴퓨터 접속은 `NOT VERIFIED`다. 최신 학교 데모 코드는 프로젝트 루트에서 기존 실행 문서의 사설 IP 바인딩 명령으로 시작하고, Windows 관리자 PowerShell에서 문서의 로컬 서브넷 전용 방화벽 규칙을 적용한 뒤 다른 기기 브라우저에서 확인해야 한다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 후보 데모 색인 | PASS | 1,017/1,017, 20,338 chunks; QA HOLD 107건 유지 |
| 검색 golden / 안전 사례 | PASS | 37/37 및 3/3 |
| RAG 관련 회귀 | PASS | 7개 파일, 58/58 |
| 제목 질의 범위 | PASS WITH SAFE ABSTENTIONS | 993 문서 근거 일치; 5 보류, 19 안전 거부 |
| 최신 LAN 프로세스 runtime API | NOT VERIFIED | 현재 PID 21448의 상태 경로 HTTP 404 |
| 다른 컴퓨터 접속 | NOT VERIFIED | 방화벽 규칙 없음; 원격 클라이언트 시험 안 함 |
| 번역 의미 및 임상 정확성 | NOT VERIFIED | 본 작업은 무결성·검색·안전 경계 시험 |

### 2026-10-13 정확한 제목 출처 전용 검색 경로

- 제목+설명 합성 평가에서 발견한 24개 누락(고위험 표현으로 기존 거부된 19개, 모호한 짧은 제목 5개)을 모두 다시 분석했다. 고유한 번역 제목과 설명 요청이 정확히 일치할 때만 `SOURCE_LOOKUP_ONLY` 경로로 보낸다. 제목 및 번역 청크가 색인 PASS이고 해시가 일치해야 한다.
- 이 경로는 Qwen 호출, 번역 본문 발췌, 목록 문맥, 후속 질문을 모두 반환하지 않고 고정된 원문 링크·출처·QA 상태만 표시한다. 답변 상태는 `SOURCE_GUIDANCE`, `responseMode`는 `SOURCE_LOOKUP_ONLY`다. 예를 들어 `수술 후 관리 설명`은 링크만 제공하고, `수술 후 관리는 어떻게 해야 하나요?`는 기존대로 `REFUSED`이며 출처를 반환하지 않는다. 중복/불일치 제목은 exact-title lookup 조건을 통과하지 못한다.
- 추가 paraphrase 평가에서 `CT 찍기 전에 물이나 음식을 먹어도 되나요?`가 초점 `FASTING`은 찾으면서 의도는 `UNDERSTAND`로 분류되는 것을 확인했다. `찍기 전`을 영상검사 준비 문맥으로 인식하도록 분류 규칙을 보완했다. A1C 정의와 MRI 금속 안전 구어체 표현도 회귀·실제 Qwen 스모크에 추가했다.
- 수정: `src/medlineplus-upload-corpus.js`, `src/health-helper-medlineplus.js`, `src/health-helper-candidate-http.js`, `scripts/evaluate-medlineplus-upload-retrieval.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, 관련 업로드·HTTP 테스트.
- 관련 기능요구사항: 별도 학교 데모 RAG FR은 배정하지 않았다. 환자 서비스 API·상태는 수정하지 않고 FR-014~025 접근통제, FR-037~041 감사, FR-042~046 개인정보 경계에 연결하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 모든 정확한 제목+설명 질의 | PASS | 1,017/1,017 문서의 정확한 근거 회수; 24개는 출처 전용 |
| 검색 golden / 안전 사례 | PASS | 40/40 및 3/3 |
| RAG 전체 집중 회귀 | PASS | 7개 파일, 59/59 |
| HTTP 출처 전용/행동 질의 분리 | PASS | 실제 loopback 학교 서버에서 SOURCE_LOOKUP_ONLY/no excerpt, 행동 질의 REFUSED/no source |
| 실제 로컬 Qwen 답변 스모크 | PASS | 9/9: 빈혈 증상, CT 금식(기본·구어체), CT 임신, CT 방사선+임신 복합 초점, MRI 금속(기본·구어체), X선 방사선, A1C 정의(QA HOLD); 각 1 claim·1 출처, anchor 일치, 원문 질문 제외; semantic grounding NOT PROVEN |
| 색인 및 원래 QA 상태 | PASS | 1,017/1,017 색인 PASS, QA HOLD 107건·미해결 이슈 111건 유지 |
| LAN 프로세스 업데이트/다른 기기 접속 | NOT VERIFIED | 기존 PID 21448은 runtime API 404; 방화벽 규칙 없음 및 원격 기기 시험 안 함 |
| 번역 의미 및 임상 정확성 | NOT VERIFIED | 학교 MVP 검사는 의미·임상 검증을 수행하지 않음 |

- 다음 최선 작업: 실제 사용자 표현을 흉내 낸 합성 paraphrase 평가를 확장하고, 자연어 질의에서 주제·초점 분류 누락을 보정한다. 제목 exact-match 결과를 임상/번역 정확도나 일반 질문 재현율로 확대 해석하지 않는다.

### 2026-10-13 개인 건강 질의의 fail-closed 처리

- 합성 검증에서 `제 빈혈 증상은 어떤가요?`, `내 A1C 결과는 정상인가요?`, `임신 중인데 CT를 받아도 되나요?`, `우리 아이 CT 전에 금식해야 하나요?`가 일반 교육 후보로 검색되는 것을 확인했다. 개인 관점이 증상·검사·치료 문맥과 함께 있거나 임신 중 CT 적합성을 묻는 경우 `PERSONAL_INPUT_NOT_SUPPORTED`로 거부하고 검색 근거·출처·모델 답변을 반환하지 않도록 했다.
- 거부 안내도 개인 건강상태·증상·검사결과 상담을 지원하지 않는다고 명확히 바꿨다. “CT 찍기 전에 물이나 음식을 먹어도 되나요?” 같은 일반 학교 질문은 계속 `PREPARE`/`FASTING`으로 분류되어 답변 경로를 유지한다.
- 수정: `src/medlineplus-upload-corpus.js`, `scripts/medlineplus-local-preview.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, 업로드 RAG 및 HTTP 회귀 테스트. 환자 API 계약은 변경하지 않았다.
- 관련 요구사항: 별도 학교 데모 RAG FR은 배정하지 않았다. 실제 환자 정보 금지와 개인별 진단·치료 제한을 보강하며, FR-014~025/FR-037~041/FR-042~046 환자 접근정책·감사·개인정보 API의 동작은 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 개인 증상·검사결과·임신 CT 질의 차단 | PASS | 4개 합성 golden 사례, 개인 질의에 근거 0건·HTTP 모델 미호출 |
| 일반 CT 구어체 금식 질의 | PASS | `PREPARE`/`FASTING`; 실제 Qwen 답변 1 claim·1 출처, anchor 일치 |
| RAG 전체 집중 회귀 | PASS | 7개 파일, 60/60 |
| 전체 코퍼스 / golden / 안전 | PASS | 1,017/1,017 색인, 정확 제목 1,017/1,017, golden 44/44, 안전 3/3 |
| 실제 HTTP 학교 profile | PASS | 개인 빈혈·임신 CT 질의는 SOURCE 0 / generation false; 일반 CT 질의는 GENERATED·SOURCE 1 |
| 기존 QA 상태 | PASS | QA HOLD 107건 및 미해결 이슈 111건 유지 |
| LAN 프로세스·다른 컴퓨터 접속 | NOT VERIFIED | PID 21448의 `/candidate/status`는 여전히 404; 방화벽 규칙 없음, 원격 시험 안 함 |
| 의미·임상 정확성 | NOT VERIFIED | anchor·인용 검사는 임상적 해석을 입증하지 않음 |

- 다음 우선 작업: 합성 자연어 질의셋을 증상·원인·검사 준비·개념 설명의 여러 표현으로 넓히고, 각 후보가 의도된 문서·초점으로 연결되는지 실제 근거 문장 수준에서 측정한다. 개인·응급 질의는 별도 fail-closed 집합으로 계속 검증한다.

### 2026-10-13 자연어 변형의 근거 범위 및 학교 RAG HTTP 확인

- paraphrase 점검에서 빈혈 피로·어지럼, 구어체 원인 질문, `CT 전에 밥/물을 먹어도 되나요?`, 임신 가능성을 의료진에게 알리는 질문의 intent/focus 누락을 찾아 보정했다. `MRI 촬영 때 귀걸이는 빼야 해요?`는 일반 MRI 문맥 대신 기존 번역 목록의 장신구 안내로 라우팅하며, 모델을 부르지 않고 출처 원문 목록 문맥만 제공한다.
- `CT는 엑스레이랑 뭐가 달라요?`, `MRI랑 X선 중 어느 게 나아요?`도 단일 영상 주제의 근거로 답변이 시작되는 것을 찾아, 서로 다른 영상 방식의 비교 요청은 근거가 충분하지 않으면 출처 없이 `INSUFFICIENT_EVIDENCE`로 닫도록 했다. 한국어 비교 표현과 조사에 붙은 `X선` 표기를 회귀 사례로 고정했다.
- `왜/이유` 질의는 원인·목적 근거가 실제로 있을 때만 답변 후보로 둔다. 빈혈 증상의 개별 원인, CT 금식 이유, CT 방사선 사용 이유는 문서가 해당 이유를 입증하지 않아 보류하고, CT 조영제가 영상을 더 선명하게 돕는다는 문장은 초점에 맞춰 허용한다.
- 허용 문장이 청크의 0번이 아닌 위치에 있을 때 Qwen이 보이는 첫 문장의 index 0을 고르는 사례도 재현했다. 모델에는 허용 문장만 0부터 연속 번호로 전달하고, 검증기가 그 번호를 원문 문장 인덱스로 매핑해 citation/focus/연속 문장 검증 후 원문 텍스트를 구성하도록 바꿨다.
- 변경 파일: `src/medlineplus-upload-corpus.js`, `src/health-helper-medlineplus.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, `scripts/medlineplus-upload-model-smoke.js`, `test/medlineplus-upload.test.js`, `test/health-helper-medlineplus.test.js`. 기존 문서·원문은 수정하지 않았다.
- 별도 학교 발표 RAG 요구사항 ID는 배정되지 않았다. 개인별 진단·치료나 영상 접근정책/API 계약은 변경하지 않아 FR-014~025, FR-037~041, FR-042~046과 무관하다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 번역 후보 데모 색인 | PASS | 1,017/1,017 문서, 20,338 한국어 청크; 원래 QA HOLD 107건·미해결 이슈 111건은 보존 |
| golden 검색 / 안전 사례 | PASS | 59/59 및 3/3; 정확한 제목 근거 1,017/1,017, 비한국어 청크 30개 제외 |
| RAG·HTTP·runtime 연결 회귀 | PASS | 7개 테스트 파일, 70/70 |
| 실제 Qwen 구어체 증상·원인·검사 준비·설명 | PASS | 8개 모델 스모크에서 각 1 claim·1 source 및 고정 evidence anchor; 인덱스 변환 후 CT 조영제 목적 질의도 통과. 의미·임상 정확도는 증명하지 않음 |
| MRI 귀걸이 출처 안내 | PASS | 모델 미호출, 구조화된 번역 목록/출처 1건 |
| 최신 loopback 학교 HTTP | PASS | `127.0.0.1:11445`: CT 조영제 목적 GENERATED/source 1; CT 금식 이유 INSUFFICIENT_EVIDENCE/source 0 |
| runtime fingerprint·코드 검사 | PASS | 실행 시작 fingerprint `sha256:33128e7ead1ada261ab43f70544cd722d31a332ebc94764d8fd63f85937822b8`와 현재 소스 일치; `node --check`, `git diff --check` 종료 0 |
| 임상 정확성·번역 원문 의미 | NOT VERIFIED | 합성 질문, 문장 anchor 및 모델 스모크로 임상 판단을 입증할 수 없음 |
| 기존 LAN 프로세스·다른 PC | NOT VERIFIED | 최신 loopback 프로세스는 검사 후 종료; `10.10.70.151:11445` PID 21448 그대로이며 상태 API는 404, 다른 기기 시험 미수행 |

- 다음 최선 작업: 기존 LAN 데모 프로세스에 최신 코드를 안전하게 반영할 실행 경로와 로컬 서브넷 접근 설정을 확정한 뒤, 다른 컴퓨터에서 상태 API·질의·출처 응답을 확인한다. 이전 재시작 시도는 도구 정책에서 `blocked by policy`로 거부됐고 방화벽 규칙 추가는 Windows `액세스가 거부되었습니다`로 실패했다. 같은 프로세스를 우회 종료하거나 권한을 우회하지 않는다. 그 전까지 최신 코드는 loopback 검증까지만 완료된 것으로 기록한다.

### 2026-10-13 다중 영상 질문 차단 및 MRI 장신구 자연어 확장

- 비교 표현을 정확히 적지 않은 `MRI랑 CT 중 뭐가 더 좋아요?`, `MRI와 CT 모두 방사선을 사용하나요?` 등이 한 검사 자료만으로 후보 처리되는 검색 누락을 재현했다. 단일 문서 검색 경로는 여러 영상 검사 방식을 함께 답하지 못하므로, 질문에 둘 이상의 검사 방식이 나오면 비교/선택/공통점 표현과 무관하게 `INSUFFICIENT_EVIDENCE`로 닫는다.
- MRI 준비 질문의 `귀금속` 표현은 기존 장신구 목록과 의미상 대응하지만 `금속` 안전 거부 규칙에 걸려 있었다. 귀금속을 금속 안전 질문과 분리해 기존 번역의 장신구·시계 목록으로만 연결하고 모델 생성은 사용하지 않는다.
- 변경 파일: `src/medlineplus-upload-corpus.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, `test/medlineplus-upload.test.js`. 환자 API 및 환자 동의·영상 접근 정책은 변경하지 않았다. 학교 발표 RAG 전용 FR은 별도 ID가 없다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 번역 후보 데모 색인 | PASS | 1,017/1,017 문서, 20,338 한국어 청크; QA HOLD 107건·미해결 이슈 111건 유지 |
| 자연어 retrieval golden / 안전 거부 | PASS | 65/65 golden 및 3/3 안전 사례; 정확 제목 근거 1,017/1,017, 비한국어 청크 30개 제외 |
| RAG·HTTP·runtime 집중 회귀 | PASS | 7개 테스트 파일, 70/70 |
| 다중 영상 방식 질문 | PASS | 새 비교·선호·안전·공통점 표현 5건 모두 근거 0건으로 보류 |
| MRI 귀금속 안내 | PASS | 번역 목록 문맥과 출처를 반환; 모델 미호출 |
| 빌드 전 문법·diff 공백 검사 | PASS | `node --check`, `git diff --check` 종료 코드 0 |
| 원문 번역 의미·임상 정확성 | NOT VERIFIED | 합성 검색 회귀는 번역 의미나 임상 판단을 승인하지 않음 |
| LAN 최신 코드·다른 PC 접속 | NOT VERIFIED | 기존 PID 21448 및 방화벽 상태는 이번 작업에서 변경하지 않음 |

- 다음 최선 작업: 번역 본문에서 자주 쓰이는 한국어 표현과 문서 제목 별칭 사이의 검색 누락을 더 측정하고, 새 표현마다 정확한 번역 근거·부정 사례를 함께 고정한다. 제목 기반 1,017건 sweep은 일반 질문 재현율을 의미하지 않는다.

### 2026-10-13 한국어 본문 설명형 검색 및 HTTP 근거 검증

- 제목 별칭이 없는 설명형 질문을 위해 한국어 번역 본문에서 제한된 문장 단위 검색을 추가했다. PASS 해시를 확인한 번역 청크만 대상으로 하고, 질문 핵심어 두 개 이상과 희소어, 최소 점수·포괄률, 단일 주제 우위를 모두 요구한다. 질문이나 제목 문장은 검색 근거에서 제외하며 원인·증상·치료·위험·개인별·다중 영상 질문은 이 검색 경로로 보내지 않는다.
- CT 단면, MRI 자석·전파, X선 소량 방사선 설명 질의는 각 번역의 해당 문장 하나만 근거로 선택한다. 검사명을 묻는 경우 문장 또는 제목이 검사명을 직접 특정해야 한다. 평균 혈당 검사, 빈혈 원인 추론, 산소 운반 문제 질문 등 잘못된 짧은 제목 일치는 `INSUFFICIENT_EVIDENCE`로 차단한다. 모델에는 원 질문을 보내지 않고, 검증된 선택으로 서버가 번역 원문 답변을 구성한다.
- 학교 데모 전체 번역 코퍼스(검토 HOLD 포함)로 HTTP loopback 경로를 실행했다. CT 자연어 질의는 출처 1건을 붙인 GENERATED 응답을 반환했고, 영상 비교 및 평균 혈당의 검사명 추론 질의는 출처 0건·모델 호출 없이 보류됐다. HTTP 스모크의 모델 응답은 구조 검증용 test double이며 실제 Qwen 호출은 별도 모델 스모크 결과로 기록한다.
- 수정 파일: `src/medlineplus-upload-corpus.js`, `test/medlineplus-upload.test.js`, `scripts/medlineplus-upload-model-smoke.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, 본 문서. 학교 발표 RAG 전용 FR ID는 배정되지 않았다. 환자 서비스 API와 동의·접근 정책은 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 후보 데모 색인 | PASS | 1,017/1,017 문서, 20,338개 한국어 청크; 비한국어 30개 제외; QA HOLD 107건·미해결 이슈 111건 유지 |
| 자연어 검색 golden / 안전 사례 | PASS | 71/71 golden 및 3/3 안전 사례; exact-title sweep 1,017/1,017은 일반 질문 재현율 지표가 아님 |
| RAG·HTTP·runtime 집중 회귀 | PASS | 7개 테스트 파일, 70/70 |
| 학교 HTTP loopback 근거·보류 처리 | PASS | 전체 1,017문서 코퍼스 사용; CT 설명 1개 출처; 비교·검사 추론 질의는 출처 0, 모델 미호출 |
| 실제 로컬 Qwen 자연어 검색 답변 | PASS | CT 단면, MRI 자석·전파, X선 저선량 설명 3/3; 각 1 claim·1 출처·정확 문장 anchor, 원 질문 제외 |
| 문법·공백 검사 | PASS | 관련 JavaScript `node --check` 및 `git diff --check` 종료 코드 0 |
| 번역 의미·임상 정확성 | NOT VERIFIED | 문장 일치·모델 스모크는 번역 의미나 임상 정확성을 승인하지 않음 |
| 실제 운영 서버·LAN의 최신 코드 및 다른 PC 접속 | NOT VERIFIED | 이번 HTTP 검사는 loopback이며 기존 LAN PID 21448과 방화벽은 변경하지 않음 |

- 다음 최선 작업: 영상검사 외 건강 주제에서도 번역 본문 설명형 paraphrase의 회수율과 오탐률을 균형 있게 측정하고, 문장 근거가 약하거나 주제가 겹치면 계속 보류한다. `demoIndexStatus=PASS`는 색인 무결성 상태이며 별도 임상·편집 검토 완료를 뜻하지 않는다.

### 2026-10-13 공통 별칭 오탐 차단 및 신장 설명형 질의 추가

- 영상검사 외 20개 설명형 자연어 질의를 탐색 점검하면서 `혈액을 걸러서 노폐물을 소변으로 내보내는 기관은 어디인가요?`가 짧은 별칭 `혈액` 때문에 `혈액` 문서의 액체·고형 성분 문장들을 반환하는 오탐을 찾았다. 강한 단일 번역 문장 일치가 있으면 일반 별칭 순위보다 우선하고, 구체 표현이 근거 문장과 충분히 맞지 않으면 별칭 결과도 반환하지 않도록 보완했다.
- 같은 번역 문장이 여러 주제에 반복될 때는 중복을 하나의 사실 문장으로 취급한다. 동점 문장이면 번역 문장 자체가 동일한 경우에 한해 QA PASS 출처를 우선 선택한다. 제목+설명 exact-title 경로와 금식·금속 안전·증상·원인 등의 focus 경로는 이 변경이 덮어쓰지 않도록 유지했다.
- 새로운 자연어 질의 `노폐물과 여분의 물을 걸러 소변을 만드는 기관은 무엇인가요?`는 `소변과 배뇨`의 문장 하나로 연결한다. 근거가 약한 혈액 별칭 표현과 기간을 특정하지 않은 평균 혈당 검사 표현은 계속 `INSUFFICIENT_EVIDENCE`로 보류한다.
- 수정 파일: `src/medlineplus-upload-corpus.js`, `test/medlineplus-upload.test.js`, `scripts/medlineplus-upload-model-smoke.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, 본 문서. 학교 RAG 전용 FR ID는 없으며 환자 서비스 API 계약은 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 데모 인덱스 | PASS | 1,017/1,017 문서, 20,338 한국어 청크; HOLD 107건·미해결 이슈 111건 유지 |
| 검색 golden / 안전 사례 | PASS | 73/73 및 3/3 |
| 업로드 코퍼스 테스트 | PASS | 18/18 |
| RAG·HTTP·runtime 집중 회귀 | PASS | 7개 파일, 71/71 |
| 실제 로컬 Qwen paraphrase smoke | PASS | CT 단면·MRI 자석/전파·X선·신장 여과 4/4; 각 답변 1 claim·1 출처·정확 anchor; 원 질문 제외 |
| 실제 loopback HTTP + Qwen | PASS | 신장 질의는 GENERATED·출처 1; 약한 `혈액` 별칭 변형은 INSUFFICIENT_EVIDENCE·출처 0·모델 미호출 |
| 문법·diff 검사 | PASS | `node --check`, `git diff --check` 종료 코드 0 |
| 의미·임상 정확성 | NOT VERIFIED | Qwen 출력은 정확 문장 선택만 확인; 번역 의미나 임상 적합성을 증명하지 않음 |
| LAN 최신 프로세스·다른 PC | NOT VERIFIED | loopback 시험만 수행; 기존 PID 21448과 방화벽 상태 미변경 |

- 다음 최선 작업: 개념·기관·검사·질환 설명형을 포함한 다주제 holdout 질의셋을 확장하고, 정답이 있는 질의의 회수율과 출처 문장 오탐률을 함께 집계한다. 검토 상태를 바꾸지 않고 `demoIndexStatus=PASS`와 원 QA HOLD를 계속 분리한다.

### 2026-10-13 다주제 설명형 회수율 표본 확장

- 영상검사·신장 외의 PASS 번역 문장에서도 제목 별칭 없이 직접 검색 가능한 예를 골랐다. 아데노이드 위치, 고름 구성, 아미노산과 단백질 관계, 알레르기의 면역 반응, 항산화제 정의 질의를 추가하고, 각 질의가 번역된 정답 문장을 포함하는 주제로 연결되는지 고정했다.
- 새로운 다섯 질문 모두 실제 로컬 Qwen 스모크에서 claim 하나와 출처 하나로 답했다. 답변은 서버가 선택한 한 문장을 그대로 구성했고 모델 payload에는 원 질문이 포함되지 않았다. 모델의 의미 추론이 정확한지 또는 번역 자체가 맞는지는 이 검증으로 입증되지 않는다.
- 수정 파일: `fixtures/health-helper-school-demo-retrieval-golden.json`, `scripts/medlineplus-upload-model-smoke.js`, 본 문서. 구현 코드는 앞선 별칭 오탐 수정과 동일하며 환자 API 계약은 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 데모 색인 | PASS | 1,017/1,017 문서, 20,338 한국어 청크; 비한국어 30개 제외; 원 QA HOLD 107건·미해결 이슈 111건 유지 |
| 다주제 자연어 golden / 안전 사례 | PASS | 78/78 및 3/3 |
| RAG·HTTP·runtime 집중 회귀 | PASS | 7개 파일, 71/71 |
| 업로드 코퍼스 테스트 | PASS | 18/18 |
| 실제 로컬 Qwen 설명형 스모크 | PASS | CT·MRI·X선·신장·아데노이드·고름·아미노산·알레르기·항산화제 9/9; 모두 claim 1, source 1, anchor 일치 |
| 실제 loopback 학교 HTTP + Qwen | PASS | 신장 질의 GENERATED·출처 1; 약한 혈액 별칭 변형은 출처 0·generation 미사용 |
| 문법·diff 검사 | PASS | `node --check`, `git diff --check` 종료 코드 0 |
| 임상·번역 의미 정확성 | NOT VERIFIED | 문장 인용 일치와 모델 응답은 번역 의미나 임상 정확성을 보증하지 않음 |
| LAN 최신 코드·다른 컴퓨터 접근 | NOT VERIFIED | 검증은 loopback 전용; 기존 LAN 프로세스와 방화벽 미변경 |

- 다음 최선 작업: 위치·기능·원인 표현을 포함한 별도 다주제 holdout 세트를 더 만들고, 이 중 문서가 직접 답하는 예와 의도적으로 비슷하지만 답하지 못하는 예를 짝지어 검색 재현율 및 잘못된 출처 연결률을 계량한다. exact-title 전수평가를 자연어 전체 성능으로 해석하지 않는다.

### 2026-10-13 다주제 한국어 근거 선택 및 서버 경로 재검증

- 별도 23문항 평가를 고정 회귀셋으로 추가하고 본문 어휘·관계 질문의 검색 순위를 다듬었다. “아미노산과 단백질의 관계”는 일반 정의 문장을 우선하고, 동맥류는 질문에 없는 해부학적 하위 유형을 경쟁 근거에서 제외한다. 답변이 특정 질환에 미치는 영향인지 묻는 경우 출처 문장에 그 질환명이 함께 있어야 후보를 낸다. 목록 도입 문장만으로 답을 만들지 않고, 약 복용 지시는 `REFUSED` 처리한다.
- 근거를 대조해 두 사례의 기대 분류를 바로잡았다. 알레르기 원인 질문은 출처의 “유전자와 환경” 문장으로 제한되고, 빈혈 질문은 출처가 혈액의 산소 운반 저하를 직접 정의하므로 supported 사례로 이동했다. 항산화제-심장병 예방 주장은 해당 질환명이 출처 문장에 없어 `INSUFFICIENT_EVIDENCE`로 남는다. 라벨 수정 이유는 새 임상 판단이 아니라 고정된 번역 문장과 질문의 직접 대응이다.
- 수정 파일: `src/medlineplus-upload-corpus.js`, `fixtures/health-helper-school-demo-retrieval-golden.json`, `fixtures/health-helper-school-demo-retrieval-holdout-2026-10-13.json`, `scripts/evaluate-medlineplus-upload-holdout.js`, `scripts/medlineplus-upload-model-smoke.js`, `test/medlineplus-upload.test.js`, 본 문서. 환자 API 계약은 변경하지 않았다. 이 학교 RAG 경로는 하이패스 환자 영상 FR-001~FR-046에 매핑되지 않으며 환자 서비스에 연결되지 않는다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 데모 색인 | PASS | 1,017/1,017 문서, 20,338 한국어 청크; 비한국어 30개 제외; 원 QA HOLD 107건·미해결 이슈 111건 유지 |
| 기존 golden / 안전 평가 | PASS | 78/78 및 3/3; 정확 제목 sweep 1,017/1,017은 자연어 전체 재현율을 뜻하지 않음 |
| 다주제 한국어 회귀셋 | PASS | 23/23; 직접 근거 지원 14/14, 보류·거부 9/9, 오탐 0건. 두 문항은 위 사유로 분류를 수정함 |
| RAG·HTTP·runtime·업로드 집중 회귀 | PASS | 관련 6개 파일 54/54 |
| 실제 로컬 Qwen 근거 선택 | PASS | 아미노산 관계·알레르기 원인 각 1 claim·1 source, 고정 번역 anchor 일치, 원 질문 payload 제외 |
| 실제 loopback HTTP handler + Qwen | PASS | 알레르기 원인 `GENERATED`·출처 1; 항산화제-심장병 주장은 출처 0·생성 미사용 |
| 문법·diff 검사 | PASS | 변경 JavaScript `node --check`, 대상 파일 `git diff --check` 종료 코드 0 |
| 임상·번역 의미 정확성 | NOT VERIFIED | 문장 인용 일치와 Qwen 응답은 임상 정확성이나 번역 품질을 입증하지 않음 |
| LAN·다른 컴퓨터 접근 | NOT VERIFIED | loopback만 시험했으며 기존 LAN 프로세스·방화벽은 변경하지 않음 |

- 다음 최선 작업: 번역 의미를 검수로 승인하지 않고도 재현할 수 있는 안전 평가를 넓히기 위해, 직접 답을 찾는 정의·기능 질문과 유사어만 공유하는 오답 질문을 추가해 `INSUFFICIENT_EVIDENCE` 경계를 측정한다. 학교 데모 색인 PASS와 원 QA HOLD는 계속 별도로 표시한다.

### 2026-10-13 답변과 출처 발췌 범위 일치

- 실제 HTTP 응답을 다시 확인하니 모델 답변은 허용된 한 문장만 인용했지만 출처 카드에는 그 청크의 주변 문장도 함께 보였다. 생성 답변의 출처 `excerpt`를 검증된 claim quote로 제한했고, 모델 실패 시 출처 안내도 검색기가 허용한 문장 인덱스만 표시하도록 했다. 인덱스가 비어 있거나 중복·역순·범위 밖이면 출처 발췌를 거부한다. QA HOLD와 exact-title source-only 경로의 metadata-only 동작은 유지한다.
- 수정 파일: `src/health-helper-medlineplus.js`, `test/health-helper-candidate-generation.test.js`, `scripts/medlineplus-upload-model-smoke.js`, 본 문서.

| 확인 | 결과 | 근거 |
|---|---|---|
| 생성·실패안내 발췌 테스트 | PASS | 생성 답변과 출처 excerpt가 허용 문장과 같고, 주변 문장·잘못된 인덱스는 제외 |
| Qwen 답변/출처 일치 스모크 | PASS | 알레르기 원인 질문의 실제 답과 출처 excerpt가 같은 문장 1개 |
| 실제 loopback HTTP + Qwen | PASS | 근거 답변 1개와 출처 1개가 일치; 항산화제-심장병 질문은 모델 호출 없이 보류 |
| 범위·임상 정확성 | NOT VERIFIED | excerpt 일치는 인용 범위만 입증하며 문장 의미·번역·임상 정확성은 증명하지 않음 |

- 다음 최선 작업: 기존 모델 스모크 질문 여러 개를 실제 로컬 HTTP handler에 순차 주입해, 답변의 모든 문장이 출처 excerpt 안에 있고 개인·진단·치료 질문은 모델 미호출로 끝나는지 묶음 확인한다. 이 단계도 loopback으로 한정하고 LAN 설정은 별도 실행 상태가 준비되기 전까지 변경하지 않는다.

### 2026-10-13 전체 번역 색인 PASS와 실제 화면 질의 확인

- 사용자가 요청한 번역 후보 전체 PASS는 이미 학교 데모 색인 상태로 적용되어 있었다. 런타임과 UI에서 한국어 번역 1,017/1,017 문서·20,338 청크의 `demoIndexStatus=PASS`를 확인했다. 번역되지 않은 30개 비한국어 문서는 검색에 포함하지 않는다. 원 콘텐츠 QA HOLD 107건은 계속 검색 대상에 포함하되 원래 QA 상태를 유지한다. 색인 PASS는 한글 텍스트 무결성·색인 적재만 뜻하며 번역 의미, 원문 대조, 권리 또는 임상 승인을 뜻하지 않는다. 별도 검토자는 지정하지 않았다.
- 최신 학교 RAG 서버를 `127.0.0.1:11445`에서 실행하고 실제 Playwright 브라우저 화면에서 질문 흐름을 확인했다. 아미노산-단백질 질문은 답변·claim·출처 발췌가 같은 한 문장으로 나타났다. 항산화제-심장병 질문은 “질문에 답할 근거가 부족해요”로 끝났으며 새 출처 카드는 반환하지 않았다.
- 수정 파일: 본 문서. 서버·환자 API 계약은 변경하지 않았다. 이 학교 RAG 경로는 환자 서비스가 아니며 하이패스 환자 영상 FR-001~FR-046에 매핑되지 않는다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전체 번역 데모 색인 | PASS | 런타임 `SCHOOL_DEMO_ALL_TRANSLATIONS`; 1,017/1,017 문서·20,338 청크; QA HOLD 107건 보존 |
| 학교 서버 시작 profile | PASS | `GET /candidate/status`; runtime contract 및 코퍼스 snapshot 확인 |
| 현재 소스 snapshot | PASS | `node scripts/verify-health-helper-candidate-runtime.js http://127.0.0.1:11445/`; `issues=[]` |
| 실제 브라우저 양성 질의 | PASS | 아미노산-단백질 답변과 답변 발췌·근거 발췌가 동일 문장 |
| 실제 브라우저 근거 부족 질의 | PASS | 항산화제-심장병 질문은 근거 부족 상태, 추가 출처 없음 |
| 실제 loopback HTTP + 로컬 Qwen | PASS | 6건: 생성 3건은 출처 1개·answer/excerpt 일치; REFUSED·개인 질문·근거 부족 3건은 출처 0·모델 호출 없음; 원 질문 payload 제외 |
| 관련 회귀 테스트 | PASS | 6개 테스트 파일, 55/55 |
| 문법·공백 검사 | PASS | 대상 JavaScript `node --check`; `git diff --check` 종료 코드 0 |
| 번역 의미·원문 대조·임상 정확성 | NOT VERIFIED | 검색, 발췌 일치, Qwen 실행은 콘텐츠 승인이나 의료 타당성을 입증하지 않음 |
| 다른 컴퓨터/LAN 접속 | NOT VERIFIED | 최신 서버는 loopback 전용; NIC 주소의 기존 PID 21448 및 방화벽은 변경하지 않음 |

- 다음 최선 작업: LAN 공유가 계속 필요하면 현재 loopback 서버와 구분된 포트·bind 설정을 정하고, 기존 NIC listener와 충돌하지 않는지 검증한다. 브라우저·RAG 평가에서는 직접 답변 가능한 다주제 holdout과 안전 거부 사례를 더해 회수율과 잘못된 출처 연결률을 함께 측정한다.

### 2026-10-13 실제 HTTP handler 다중 질문 회귀

- 반복 가능한 6문항 loopback HTTP 스모크를 `scripts/verify-health-helper-school-demo-http.js`로 추가했다. 전체 번역 학교 profile, 실제 로컬 Qwen, 요청 본문, 후보 응답 및 source excerpt를 함께 검증하며 원 질문이 모델 payload에 섞이는지도 확인한다.
- 수정 파일: `scripts/verify-health-helper-school-demo-http.js`, 본 문서.

| 확인 | 결과 | 근거 |
|---|---|---|
| 실제 loopback HTTP + Qwen | PASS | 지원 질의 3건 GENERATED, 각 출처 1개, 답·claim quote·source excerpt 일치 |
| 안전 경계 | PASS | 항산화제-심장병은 INSUFFICIENT_EVIDENCE, 약 복용은 REFUSED, 개인 증상은 PERSONAL_INPUT_NOT_SUPPORTED; 세 건 모두 모델 호출 0 |
| 질문 격리·코퍼스 profile | PASS | 원 질문 payload 제외; 전체 번역 1,017문서 profile |
| RAG·HTTP·runtime·환자 API 회귀 | PASS | 6개 테스트 파일, 55/55 |
| 실행 중인 LAN endpoint | NOT VERIFIED | NIC root는 200·학교 RAG 제목으로 응답하지만 PID 21448의 `/candidate/status`는 404라 최신 runtime과 불일치; loopback 주소 연결 거부, `HiPass-School-RAG-11445` 방화벽 규칙 없음. 다른 기기 접속은 미시험이며 기존 프로세스·방화벽은 변경하지 않음 |
| 의미·임상 정확성 | NOT VERIFIED | extractive answer와 인용 일치만 검증; 의미·번역·임상 적합성은 검증하지 않음 |

- 다음 최선 작업: 별도 서버를 중단하지 않고 최신 학교 profile을 시연할 실행 경로를 정리하고, loopback 브라우저의 화면·질의·출처 카드를 확인한다. 다른 컴퓨터 접속은 기존 PID와 방화벽 변경 없이 검증할 수 있는 상태가 생길 때까지 미검증으로 둔다.

### 2026-10-13 사설 IPv4 LAN 실행 경로 추가

- 기존 NIC 주소의 11445 listener는 최신 코드와 다르고 실행 중인 다른 PID여서 그대로 두었다. 대신 기존 loopback 서버와 별개인 11446 포트 LAN launcher를 추가했다. `scripts/start-health-helper-school-demo-lan.js`는 RFC1918 사설 IPv4 주소를 필수로 받아 그 NIC 하나에만 바인딩하고, 비사설·누락 주소와 다른 preview mode는 fail-closed로 거부한다. 일반 학교 실행기는 기본 11445 동작을 유지하면서 명시된 포트 환경변수를 존중한다. preview와 runtime verifier는 11446 학교 profile을 확인하도록 갱신했다.
- `HIPASS_HEALTH_HELPER_SCHOOL_LAN_HOST=10.10.70.151`로 실행해 `10.10.70.151:11446` listener만 새로 열었다. `GET /candidate/status`와 runtime verifier가 1,017문서·20,338청크·QA HOLD 107건을 확인했고, 브라우저에서 NIC 주소 화면을 연 뒤 실제 아미노산 질문을 보내 한 출처와 답변 일치 발췌를 받았다.
- 수정 파일: `scripts/start-health-helper-school-demo-lan.js`, `scripts/start-health-helper-school-demo.js`, `scripts/medlineplus-local-preview.js`, `scripts/verify-health-helper-candidate-runtime.js`, 본 문서. 기존 PID 21448과 방화벽 규칙은 변경하지 않았고 환자 API 계약도 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전용 LAN launcher의 안전한 주소 검사 | PASS | 주소 누락 시 `SCHOOL_LAN_PRIVATE_IPV4_REQUIRED`; 실제 RFC1918 NIC에만 bind |
| LAN listener 범위 | PASS | `10.10.70.151:11446`에만 LISTEN; loopback 11445 및 기존 NIC 11445와 구분 |
| LAN 주소 runtime | PASS | `node scripts/verify-health-helper-candidate-runtime.js http://10.10.70.151:11446/`; `issues=[]` |
| 실제 NIC 주소 RAG 요청 | PASS | 브라우저에서 페이지 로드, GENERATED 답변 1개와 동일 문장 출처 발췌 확인 |
| 전체 RAG·HTTP·runtime·환자 API 회귀 | PASS | 6개 테스트 파일, 55/55 |
| JavaScript 구문 및 diff 공백 | PASS | 관련 `node --check` 통과, `git diff --check` 종료 코드 0 |
| 다른 컴퓨터에서 접속 | NOT VERIFIED | 이 호스트의 사설 NIC 응답까지만 확인; 두 번째 기기와 네트워크 방화벽 통과는 시험하지 않음 |
| 번역 의미·임상 정확성 | NOT VERIFIED | 모델 실행·발췌 일치·색인 PASS는 번역/임상 검수를 뜻하지 않음 |

- 다른 컴퓨터에서는 `http://10.10.70.151:11446/`로 접속을 확인할 수 있다. 차단되면 문서의 제한된 Private-profile/LocalSubnet 방화벽 규칙을 관리자에게 적용 요청해야 한다. 런처는 방화벽을 수정하지 않는다. 다음 작업은 실제 별도 기기에서 연결을 확인하고, 막힐 경우 네트워크 프로필·클라이언트 격리·방화벽 중 원인을 구분하는 것이다.

### 2026-10-13 약물 용량·예방 조언의 근거 없는 후보 차단

- 10개 합성 안전 질의를 탐색하던 중 “기침약을 얼마나 먹어야 하나요?”와 “혈전 예방에 어떤 운동을 해야 하나요?”가 질문에 답하지 않는 정의 문장이나 다른 운동 문서의 출처 후보로 연결될 수 있음을 확인했다. 이 데모는 용량·치료·질환 관련 운동·식단·보충제 권고를 지원하지 않으므로, 약물 용량 질문과 건강 주제+개입 권고 질문은 모델 생성 전에 `REFUSED`로 처리하고 출처를 비운다.
- 첫 규칙은 “비약물적 통증 관리 설명”을 제목만으로 과잉 차단했다. 현재는 명시적 정확 제목 설명은 그 설명 경로로 유지하고, 처방·용량 질문은 제목 일치와 무관하게 거부한다. 추가로 “혈전 방지 운동은 뭘까요?”와 “혈전 방지를 위해 어떤 운동을 하나요?” 같은 표현 변형도 거부 회귀에 넣었다.
- 거부 상태 안내 문구를 개인 진단·암 확정에 한정하지 않고 데모의 미지원 범위인 진단·치료·약물 용량·운동/예방 권고로 바로잡았다. 수정 파일: `src/medlineplus-upload-corpus.js`, `fixtures/health-helper-school-demo-retrieval-holdout-2026-10-13.json`, `scripts/verify-health-helper-school-demo-http.js`, `test/medlineplus-upload.test.js`, `public/ui/patient-helper.js`, 본 문서.

| 확인 | 결과 | 근거 |
|---|---|---|
| 전 문서 정확 제목 회수 | PASS | 1,017/1,017; 이는 제목 회수 지표이며 일반 자연어 재현율은 아님 |
| feature golden 및 안전 기본 사례 | PASS | 78/78 및 3/3 |
| 다주제 번역문 회귀셋 | PASS | 28/28; 직접 근거 14/14, 보류·거부 14/14, 관찰된 오탐 0. 미독립 임상 검증셋은 아님 |
| 업로드 색인·안전 회귀 | PASS | 18/18; 1,017문서·20,338청크·QA HOLD 107건 보존 |
| 후보 HTTP·생성·runtime 회귀 | PASS | 26/26 |
| 실제 HTTP handler + 로컬 Qwen | PASS | 11문항: 생성 3건은 각 출처 1개·답/발췌 일치; 미지원 8건은 출처 0·모델 미호출; 원 질문 payload 제외 |
| 브라우저에서의 새 거부 문구 | PASS | 최신 NIC 서버의 운동 권고 질의가 명확한 미지원 안내를 표시 |
| loopback/NIC runtime snapshot | PASS | 127.0.0.1:11445 및 10.10.70.151:11446 모두 최신 source fingerprint 일치 |
| 번역·임상 의미 정확성 | NOT VERIFIED | 거부 경계·인용 일치·Qwen 실행은 번역 의미나 임상 타당성을 검증하지 않음 |
| 두 번째 컴퓨터에서의 연결 | NOT VERIFIED | 현재 호스트의 NIC 요청만 확인; 외부 기기에서의 네트워크 경로는 미시험 |

- Windows 네트워크 프로필은 현재 `Public`이고 `C:\Program Files\nodejs\node.exe`의 기존 인바운드 허용 규칙은 Public 프로필의 TCP 전체 포트·원격 주소 전체로 확인됐다. 이 규칙은 이번 작업에서 만들거나 수정하지 않았다. 학교용 합성 데모 외 자료는 입력하지 말고, 원격 접속 확인 전에는 실제 환자 서비스로 취급하지 않는다.
- 다음 최선 작업: 실제 다른 기기에서 `http://10.10.70.151:11446/` 연결을 확인하고, 실패하면 네트워크 격리·라우팅·Windows 방화벽을 구분한다. RAG 평가는 질환별 개입 질문과 제목 단어가 겹치는 일반 설명을 계속 짝지어 거부율과 과잉 차단을 함께 회귀한다.

### 2026-10-13 한국어 동의어·안전 경계 추가 검증

- “예방접종이란 무엇인가요?”를 번역 코퍼스의 “백신” 정의로 연결하는 한국어 검색 별칭을 추가했다. 이 별칭이 안전성이나 개인별 접종 권고까지 답하게 하지 않도록, “예방접종은 안전한가요?”는 근거 부족, “예방접종을 맞아야 하나요?”는 거부로 고정했다. 약 복용 허용 여부와 용량, 질환 예방을 위한 운동도 생성 전에 거부한다.
- LAN HTTP 확인에서 백신 정의 응답은 번역 근거 문장·답변·출처 발췌가 모두 동일했다. 거부/근거 부족 답변의 오래된 암 검사 문구와 빈혈 전용 예시를 현재 학교 데모의 범위 안내로 고쳤다.
- 변경 파일: `src/medlineplus-upload-corpus.js`, `scripts/medlineplus-local-preview.js`, `fixtures/health-helper-school-demo-retrieval-holdout-2026-10-13.json`, `scripts/verify-health-helper-school-demo-http.js`, 관련 테스트 및 본 문서. 환자용 API와 영상 공유 흐름은 변경하지 않았다. 이 독립 학교 RAG 데모는 환자 서비스 FR-001~FR-046에 매핑되지 않는다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 번역 데모 색인 | PASS | 한국어 번역 1,017/1,017 문서·20,338 청크; 비한국어 30개 청크 제외; 원 QA HOLD 107건과 미해결 이슈 111건 유지 |
| 정확 제목/golden/안전 기본 평가 | PASS | 제목 회수 1,017/1,017, golden 79/79, 안전 기본 사례 3/3; 임상 답변 정확도 지표는 아님 |
| 합성 표현 변형·기권 holdout | PASS | 32/32; 지원 질문 15/15, 보류·거부 17/17, 오탐 0. 독립 또는 임상 검증셋은 아님 |
| 검색·HTTP·생성·런타임·UI 회귀 | PASS | 60/60 |
| 실제 HTTP handler 및 로컬 Qwen 연기 | PASS | 15문항; 생성 4건은 각각 출처 1개와 답/발췌 일치, 그 외 11건은 출처 0개·모델 미호출; 원 질문은 모델 입력에서 제외 |
| 실제 LAN 주소 질의 | PASS | 백신 정의 1건은 정확 문장 인용; 백신 안전성은 `INSUFFICIENT_EVIDENCE`; 접종 권고·기침약 복용은 `REFUSED`; 비생성 응답은 모두 출처 0개 |
| 최신 런타임 snapshot | PASS | 127.0.0.1:11445와 10.10.70.151:11446의 runtime verifier 모두 최신 source snapshot/profile 일치 |
| 원 번역 대조·임상 의미·권리 검토 | NOT VERIFIED | 색인 PASS는 번역/임상 품질 승인이나 이용권리 승인을 뜻하지 않음; 별도 검토자 미배정; QA HOLD 보존 |
| 다른 컴퓨터에서의 연결 | NOT VERIFIED | 이 컴퓨터에서 NIC 주소 API까지 시험; 다른 기기와 네트워크 정책 통과는 미시험 |

- 실행 주소는 loopback `http://127.0.0.1:11445/`와 사설 NIC `http://10.10.70.151:11446/`이다. LAN 런처는 지정된 사설 IPv4 주소에만 bind하며 `0.0.0.0`에 열지 않는다. 이전에 기록한 Windows `Public` 네트워크 프로필과 기존 `node.exe` 광범위 인바운드 허용 규칙은 그대로이며 변경하지 않았다.

### 2026-10-13 질문 의도·관계 근거 검색 개선

- 새 자연어 질의 점검에서 “호르몬은 몸에서 어떤 역할을 하나요?”가 `몸에서`를 `몸에`로 오인해 증상 검색으로 빠지는 것을 확인했다. 증상 의도 정규식을 좁히고, 호르몬 역할 질의는 번역 근거의 화학적 전달·혈류 이동·작용 문장만 허용하도록 초점을 추가했다.
- 정의 질의는 단어 겹침이 많은 비정의 문장을 앞세울 수 있었다. 명시한 고유 주제명 질의는 일반 어휘 점수 결과가 먼저 반환되지 않도록 했고, 별칭 핵심어로 시작하는 완전한 정의문도 허용했다. 이로써 “급성 기관지염은 무슨 병인가요?”가 염증 정의 한 문장으로 연결된다.
- “알레르기는 어떻게 고치나요?”는 `고치다`를 치료 요청으로 처리해 답변 생성 없이 거부한다. 백신·자폐 인과 주장은 결과 개념, 출처의 인과 표현, 주제 별칭이 같은 근거 문장에 잡혀야 통과하도록 바꿨다. “철분 부족이면 빈혈” 추론은 원문이 역방향 진단을 지지하지 않아 기권시킨다. 근거가 명시된 MRI 금속 방해 질의는 전용 초점 규칙을 유지해 차단되지 않는지도 회귀한다.
- 변경 파일: `src/medlineplus-upload-corpus.js`, `fixtures/health-helper-school-demo-retrieval-holdout-2026-10-13.json`, `scripts/verify-health-helper-school-demo-http.js`, `test/medlineplus-upload.test.js`, 본 문서. 검색·답변 후보를 개선했으며 환자 API, 영상 데이터 흐름, QA HOLD 상태는 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 학교 데모 번역 색인 | PASS | 한국어 1,017/1,017 문서·20,338 청크; QA HOLD 107건·미해결 111건 유지 |
| 제목/golden/안전 회귀 | PASS | 제목 회수 1,017/1,017, golden 79/79, 안전 사례 3/3 |
| 표현 변형·기권 회귀 | PASS | 38/38; 지원 18/18, 기권 20/20, 오탐 0. 합성 개발 회귀셋이며 독립·임상 검증셋은 아님 |
| 코퍼스·후보 HTTP·답변·런타임·UI 회귀 | PASS | 60/60; 업로드/검색 회귀 파일 18/18 |
| HTTP handler + 로컬 Qwen | PASS | 22문항: 생성 8건의 답변과 인용 발췌 일치, 나머지 14건은 출처 0·모델 미호출; 원 질문 payload 제외 |
| 최신 LAN 앱 질의 | PASS | 호르몬 역할과 급성 기관지염 정의 생성 답변이 각 출처 발췌와 일치; 백신 인과는 근거 부족, 알레르기 치료 요청은 거부 |
| 실행 코드 snapshot | PASS | 127.0.0.1:11445 및 10.10.70.151:11446의 최신 runtime verifier 통과; 두 학교 데모 리스너 최신 코드로 재기동 |
| 번역 의미·임상 정확도·이용권리 | NOT VERIFIED | 원문 대조나 별도 검토를 수행하지 않았고, 색인 PASS를 콘텐츠 승인으로 취급하지 않음 |
| 두 번째 컴퓨터 접속 | NOT VERIFIED | 현재 컴퓨터의 사설 NIC까지만 확인 |

- 이어서 우선 확인할 항목은 부정 표현, 원인·결과 방향, 조건문, 여러 주제를 한 문장에 넣은 질의를 양성·기권 쌍으로 늘려 검색 오탐과 과잉 기권을 함께 측정하는 것이다. 이 작업도 합성 학교 데모 경계에서 진행하며 QA HOLD의 승격이나 환자 서비스 연결은 하지 않는다.

### 2026-10-13 번역 후보 색인 PASS 확인 및 관계 검색 후속

- 요청된 번역 후보 전체 `PASS`는 학교 데모 색인 기준으로 확인했다. 한국어 번역 1,017/1,017 문서와 20,338 청크가 `demoIndexStatus=PASS`이고, 비한국어 청크 30개는 제외된다. 이는 번역 텍스트 해시·색인 적재 상태다. 콘텐츠 QA HOLD 107건과 미해결 이슈 111건은 그대로 보존하며 번역 의미·원문 대조·임상 적합성·이용권리 승인을 뜻하지 않는다. 별도 검토자는 배정하지 않았고, Qwen 가중치 학습은 하지 않는다.
- 자연어 회귀에서 혈액 산소 운반 정의가 일반 “혈액” 문서의 무관한 문장으로 연결될 수 있음을 차단했다. “어떤 질환/병” 정의 질의는 답을 제시하는 주제명 문장과 질의의 주요 세부 용어가 함께 일치할 때만 검색 후보를 반환한다. 부신 위치 검색은 괄호의 영문 동의어 및 “위/위쪽” 표기를 정규화해 같은 방향의 번역 근거를 연결하고, 역방향·반대 위치 질의는 기권한다. 철분 부족만으로 빈혈을 역진단하는 질의도 계속 기권한다.
- 다주제 질의에는 각 개념이 허용 근거에 함께 나타나는지 검사한다. “빈혈과 백혈병의 차이”와 “호르몬과 효소가 모두 화학적 전달자인가”는 한 주제 문장만으로 답하지 않고 기권한다. “아미노산-단백질 관계”처럼 한 문장이 두 개념을 직접 연결하면 지원하며, 별도 안내 요청은 같은 출처 안의 인접한 두 문장까지 허용한다. MRI 자석·금속 및 CT 방사선·임신 복합 안내도 두 문장 근거 경로를 유지한다.
- 추출 답변 검증의 최소 길이를 20자에서 8자로 낮췄다. 발췌는 여전히 최소 8자의 완전 문장이어야 하고, 허용된 문장 인덱스·evidence ID·원문 문장 일치를 모두 통과해야 한다. 짧은 출처 문장을 생성 모델이 정확히 선택할 수 있도록 한 변경이며, 자유 답변 길이 기준은 바꾸지 않았다.
- 검증: 전체 제목 회수 1,017/1,017, golden 79/79, 안전 3/3; 제목+설명 회귀에서 metadata-only 출처안내가 51건으로 늘었고 다주제 근거가 함께 검증되지 않으면 생성 답변 대신 출처만 안내한다. 합성 표현 변형·기권 회귀 48/48(지원 21/21, 기권 27/27, 오탐 0); 관련 코퍼스·HTTP·생성·런타임·UI 테스트 60/60. 로컬 Qwen HTTP 스모크는 33/33이며 생성 12건의 답변·인용 발췌가 일치하고, 나머지 21건은 근거 부족·거부·개인 입력 경계에서 출처 없이 끝났다. 원 질문 payload는 모델로 보내지 않았다.
- 최신 소스로 loopback `127.0.0.1:11445` 및 사설 NIC `10.10.70.151:11446` 학교 데모를 재기동했다. 두 런타임 지문 검증 PASS. 각 주소에서 아미노산·단백질 관계 질의는 `GENERATED`와 답/발췌 일치, 빈혈·백혈병 비교 및 호르몬·효소 비교는 `INSUFFICIENT_EVIDENCE`와 출처 0으로 응답해 실제 HTTP 6/6 PASS했다. 다른 컴퓨터의 연결은 `NOT VERIFIED`다.
- 다음 작업은 같은 한국어 번역 코퍼스에서 부정 표현과 조건문 역추론을 양성/기권 쌍으로 늘리고, source-only로 전환된 제목의 근거 회수율도 점검하는 것이다. QA HOLD와 환자 서비스 분리는 유지한다.

### 2026-10-13 이중 부정·양보절과 source-only 회수율 보강

- 양보 연결어 `-지만`의 끝 글자 `만`을 배타 한정으로 오인해 지원 가능한 빈혈 원인 질의를 기권하던 오류를 고쳤다. 같은 양보절의 근거 없는 보편 주장(“모든 빈혈”)은 계속 기권한다. 한 절 안에 부정 표지가 겹치는 질문은 이중 부정의 범위를 해석하지 않고 근거 부족으로 닫는다.
- 부정·조건·배타·빈도 한정은 근거에 직접 나타나야 한다. 조사로 떨어진 주어와 한정 표현은 동일 문장 안에서 대조하며, 질문에 없는 “없이” 조건을 근거에서 추론하지 않는다.
- 명시적 정의 질문인 한 글자 주제명(예: “멍은 무엇인가요?”)은 QA PASS·미보류·미해결 0건인 출처의 직접 정의문 한 문장만 후보로 반환한다. 비슷한 제목 질의(“철분은 무엇인가요?”)나 정의 의도가 없는 짧은 검색어는 기존 source-only 또는 근거 부족 경계를 유지한다.
- metadata-only source-only 제목 51건을 별도로 점검했다. 51/51 모두 정확 제목 문서·데모 색인 PASS·출처 URL을 가리키며, 그중 콘텐츠 QA PASS 47건과 HOLD 4건은 분리되어 있다. source-only 응답은 발췌를 생성하지 않고 모델 선택 경로에 들어가지 않는다.
- 번역 코퍼스 회귀 72/72 PASS(지원 34/34, 기권 38/38, 오탐 0), 관련 테스트 63/63 PASS, 고정 golden 79/79 및 안전 사례 3/3 PASS.
- loopback HTTP handler + 로컬 Qwen 검증 51/51 PASS: 생성 23건은 각각 답변·인용 발췌가 일치했고, 나머지 28건(거부 9, 근거 부족 18, 개인 입력 1)은 모델 미호출; 질문 원문 payload 제외. 이는 기계적 검색·인용 점검으로 번역 의미나 임상 정확성을 증명하지 않는다.
- 별도 HTTP 회귀로 source-only 제목 51/51을 실제 핸들러에 전송해 문서 ID·URL만 반환되고 발췌·목록 문맥·모델 호출이 없는지 확인했다. Qwen 생성 스모크와 이 51개 순회를 한 프로세스로 결합한 장시간 실행은 `ECONNRESET`으로 끝나 PASS로 세지 않았다. 각각의 독립 검증은 통과했다.
- 한국어 데모 인덱스는 1,017/1,017 문서 PASS, QA HOLD 107건과 미해결 이슈 111건은 그대로다. 이 작업은 임시 loopback HTTP handler에서 현재 코드를 검증했으며 실행 중인 LAN 프로세스에 배포하거나 다른 컴퓨터 접속을 검증하지 않았다. 번역 의미·임상 적합성·이용권리도 검증하지 않았다.
- 최신 LAN 상태 검증은 `10.10.70.151:11445`의 `/candidate/status` 404 및 `:11446` 소스 지문 불일치로 실패했다. 두 실행본의 최신 코드 반영, 다른 컴퓨터 접속, 번역 원문 대조, 임상 적합성, 이용권리는 `NOT VERIFIED`다.
- 다음 작업은 긴 문장 안에 조건·양보·수량 한정이 흩어진 near-miss 쌍을 늘리고, source-only 51개 응답이 HTTP 화면에서도 출처 메타데이터만 표시하고 모델 호출을 피하는지 통합 검증한다. QA HOLD와 환자 서비스 분리는 유지한다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 번역 데모 색인 | PASS | 한국어 번역 1,017/1,017 문서·20,338 청크; 비한국어 청크 30개 제외; QA HOLD 107건·미해결 111건 유지 |
| 제목·source-only·golden·안전 회귀 | PASS | 제목 근거 1,017/1,017, metadata-only 제목 51건, golden 79/79, 안전 3/3 |
| 부정·조건·배타·빈도·이중부정·양보절 holdout | PASS | 72/72: 지원 34/34, 기권 38/38, 오탐 0 |
| 관련 코퍼스·후보 HTTP·생성·런타임·UI 테스트 | PASS | 63/63 |
| source-only 제목 근거 및 HTTP 응답 | PASS | 51/51 정확 제목·색인 상태·출처 URL; 응답에는 문서 ID·URL만 있고 발췌·목록 문맥·모델 호출 없음; QA PASS 47건과 HOLD 4건 분리 |
| loopback HTTP handler + 로컬 Qwen | PASS | 51/51; 생성 23건의 답·인용 일치; 거부 9건·근거 부족 18건·개인 입력 1건은 모델 미호출; 질문 원문 payload 제외 |
| 실행 중 LAN 코드 지문·다른 컴퓨터 접속 | NOT VERIFIED | `:11445/candidate/status`는 404, `:11446`은 소스 지문 불일치; 다른 기기 접속 미시험 |
| 원문 대조·번역 의미·임상 적합성·이용권리 | NOT VERIFIED | 색인 무결성 PASS와 인용 일치가 의미·임상·권리 승인을 뜻하지 않음; 별도 검토자는 배정하지 않음 |

### 2026-10-13 긴 양보절 및 `언제나` 오분류 회귀

- 긴 양보절의 빈혈 원인 질문에서 `언제나`가 `언제` 복용 시점 질문으로 잘못 분류되어 `REFUSED`되는 오류를 확인했다. 복용 시점 거부 조건을 `언제` 뒤에 구체적인 복용·투여 동사가 있는 경우로 좁혔다. `철분은 언제 복용해야 하나요?`는 계속 `REFUSED`, “철분 부족이 언제나 가장 흔한가요?” 형태의 보편·빈도 주장은 `INSUFFICIENT_EVIDENCE`다.
- 이 회귀와 긴 조건·양보절 사례를 합성 holdout에 추가했다. 현재 holdout은 79/79 PASS(지원 근거 36/36, 기권 43/43, false positive 0)이며, 고정 golden 79/79와 안전 사례 3/3도 통과했다.
- 새 긴 빈혈 양보절 사례를 임시 loopback HTTP handler와 로컬 Qwen으로 한 번 생성했다. 결과 `GENERATED`, 모델 호출 1회, 답변·출처 발췌·claim quote 동일, 원 질문은 모델 입력에서 제외됐다. 이는 문장 일치 확인이며 의미적 근거성과 임상 정확도는 `NOT VERIFIED`다.
- 이번 코드 변경 후 관련 6개 테스트 파일의 재실행 결과는 아래 최신 검증 표에 기록한다. 번역 색인 1,017/1,017 `demoIndexStatus=PASS`; 원래 QA HOLD 107건 및 미해결 이슈 111건은 유지된다. PASS는 색인 무결성일 뿐 번역·콘텐츠·임상·권리 승인이 아니다.
- 실행 중 LAN 프로세스는 재시작하지 않았다. 직전 상태 확인의 `:11445/candidate/status` 404와 `:11446` source fingerprint mismatch는 그대로이며, 최신 코드의 LAN 반영과 두 번째 컴퓨터 접속은 `NOT VERIFIED`다.

| 최신 확인 | 결과 | 근거 |
|---|---|---|
| 번역 후보 학교 데모 색인 | PASS | 한국어 문서 1,017/1,017 및 20,338 청크; 비한국어 청크 30개 제외; QA HOLD 107건·미해결 111건 보존 |
| 긴 조건·양보절 합성 holdout | PASS | 79/79: 지원 36/36, 기권 43/43, false positive 0 |
| source-only 제목 HTTP 회귀 | PASS | 51/51 메타데이터 전용, 정확 문서·URL, 발췌/모델 호출 없음; QA PASS 47건과 HOLD 4건 구분 |
| 새 양보절 Qwen HTTP 확인 | PASS | 단일 합성 질문, 1회 생성, 답·발췌·claim quote 일치, raw question 제외 |
| 관련 테스트 6개 파일 | PASS | 변경 후 `node --test`로 63/63 통과 |
| 최신 LAN 코드 반영·원격 접속 | NOT VERIFIED | `:11445/candidate/status` 404, `:11446` 지문 불일치; 다른 컴퓨터 미시험 |
| 번역 의미·임상 정확성·권리 | NOT VERIFIED | 별도 검토자 배정 없음, 콘텐츠 QA HOLD 유지 |

- 다음 작업은 양보절·빈도 표현과 실제 약 복용 시점 질문의 합성 near-miss를 늘리고, 최신 코드가 반영된 로컬 데모 런타임을 별도로 확인하는 것이다. 환자 API와 데모 검색은 계속 분리한다.

### 2026-10-13 원인 목록 질문의 답변 완전성 개선

- 합성 질문 점검 중 `빈혈의 원인에는 어떤 것들이 있나요?`가 “가장 흔한 원인은 철분 부족” 한 문장만 후보로 선택하는 품질 누락을 확인했다. 번역 자료에는 혈액 손실·적혈구 생성 부족·적혈구 파괴 증가를 세 가지 주요 원인으로 열거한 정확한 문장이 있었다.
- 질문이 원인 목록·나열·주요 원인·복수 원인을 요구하면, 검색기가 질문에 명시된 단일 주제의 번역 문장 가운데 같은 주제를 주어로 삼고 실제 열거 표지가 있는 문장만 허용한다. 일치하는 단일 근거가 없거나 서로 다른 목록이 여럿이면 기권한다. “철분 부족의 원인 목록”처럼 주제 범위가 근거 문장과 다르면 해당 문장을 빌려 답하지 않는다.
- 표현 변형 3개(“원인에는 어떤 것들”, “나열”, “일으키는 원인은 어떤 것들”) 모두 같은 세 가지 목록 문장을 반환한다. `모두 철분 부족`이라는 과잉 일반화와 근거 없는 철분 부족 원인 목록은 계속 `INSUFFICIENT_EVIDENCE`다. 가장 흔한 원인을 묻는 단수 질문은 종전의 철분 부족 문장을 유지한다.
- `빈혈을 일으키는 원인은 어떤 것들이 있나요?`를 실제 loopback HTTP handler와 로컬 Qwen으로 확인했다. `GENERATED`, 모델 호출 1회, 답변·출처 발췌·claim quote가 정확히 일치했고 원 질문은 모델 payload에서 제외됐다. 의미적·임상적 사실성은 `NOT VERIFIED`다.
- 최신 holdout은 84/84 PASS(지원 39/39, 기권 45/45, false positive 0), 고정 golden 79/79, 안전 3/3, 관련 테스트 63/63이다. 번역 색인은 1,017/1,017, QA HOLD 107건과 미해결 이슈 111건 유지다.
- LAN 프로세스는 재시작하지 않았다. 최신 코드의 실행본 반영·다른 컴퓨터 접속, 번역 의미·임상 적합성·이용권리는 `NOT VERIFIED`다.

### 2026-10-13 증상·위험요인 목록의 근거 완전성

- 증상 목록 질문에서 모델이 무관한 치료 문장을 선택하거나 첫 안내 문장만 반환할 수 있는 사례를 확인했다. 이제 원문 조각에 명시적 목록 안내가 있고 질문 주제가 같은 문서 안에서 확인될 때만 해당 목록을 반환한다. 위험요인 목록도 동일한 조건을 적용하며, `인종:` 같은 하위 제목은 뒤따르는 원문 항목과 묶어 표시한다.
- 조합된 각 항목은 원래 번역 조각 ID와 SHA-256을 모두 보존하고 서버가 조합 형식·세그먼트 순서를 재검증한다. 이 구조화 목록 경로는 모델 생성을 호출하지 않고, 원문 항목을 출처 안내 UI에 표시한다. 목록 안내가 없거나 QA가 `HOLD`인 내용은 목록 본문을 숨기며, 주제·목록 근거를 확정할 수 없으면 기권한다.
- 증상 HTTP 회귀는 천식 4개, 제2형 당뇨병 7개, 갑상선기능저하증 14개 항목의 완전 반환을 확인했다. 위험요인 회귀는 골다공증 22개, 갑상선기능저하증 13개, 제2형 당뇨병 9개 항목과 하위 제목 결합을 확인했다. QA `HOLD` 조각은 메타데이터만 반환했고, 콘텐츠가 `HOLD`인 고혈압 위험 목록은 `INSUFFICIENT_EVIDENCE`로 종료했다.
- 전체 관련 테스트 65/65, 고정 retrieval golden 79/79, safety 3/3, 별도 holdout 90/90(지원 43/43, 기권 47/47, 오탐 0)이 통과했다. holdout에 조사가 붙은 증상 나열, 증상 개수, 위험요인 목록 양성 4건과 구조 부재·QA HOLD 기권 2건을 추가했다. 색인은 한국어 번역 1,017개 문서와 20,338개 청크 모두 `demoIndexStatus=PASS`다. 콘텐츠 QA `HOLD` 107건 및 미해결 이슈 111건은 변경하지 않았다.
- 여기서 `PASS`는 번역 텍스트·색인 무결성 상태다. 목록 번역의 의미·임상 정확성·출처 이용권리는 검증되지 않았고 검토자도 배정하지 않았다. 최신 LAN 코드 반영과 다른 컴퓨터 접속은 계속 `NOT VERIFIED`다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 구조화 증상 목록 | PASS | 천식 4, 제2형 당뇨병 7, 갑상선기능저하증 14개 원문 항목을 HTTP에서 완전 반환; 모델 호출 0회 |
| 구조화 위험요인 목록 | PASS | 골다공증 22, 갑상선기능저하증 13, 제2형 당뇨병 9개 항목; 하위 제목·원문 조각·해시 보존 |
| HOLD 및 근거 부족 경계 | PASS | QA HOLD 조각은 메타데이터만 반환; HOLD 주제 목록은 기권 |
| 회귀 및 색인 평가 | PASS | 관련 테스트 65/65, retrieval golden 79/79, safety 3/3, 합성 holdout 90/90(43 supported, 47 abstain, 0 false positive) |
| 번역 의미·임상 정확성·권리 | NOT VERIFIED | 별도 번역·임상·권리 검토 없음 |
| 최신 LAN 코드 및 다른 PC 접속 | NOT VERIFIED | `10.10.70.151:11446`은 응답하지만 시작 지문이 현재 코드와 다름; 11445 LAN 주소는 404; 다른 PC 미시험 |

- 포트 소유권과 명령줄을 읽기 전용으로 확인한 뒤 11446 학교 데모만 갱신하려 했으나, 로컬 실행 정책이 프로세스 중지·재기동 명령을 실행 전에 거부했다. 기존 실행본은 계속 이전 지문으로 응답한다. 11445 프로세스는 변경하지 않았다.
- 다음 작업은 지원되는 터미널에서 11446 학교 데모를 최신 코드로 다시 띄운 뒤 시작 지문과 합성 목록 질문을 확인하는 것이다. 다른 PC 접속은 별도 미검증 상태다.

### 2026-10-13 번역 후보 PASS 색인 및 목록 경계 회귀

- 단일 문장으로 된 증상 설명을 목록 끝에 무조건 붙이지 않도록 경계를 보강했다. 열거형 목록 안의 완전한 문장은 구체적인 증상 표현이 둘 이상 있을 때만 항목으로 인정한다. 갑상선기능저하증의 목록 뒤 설명, ADHD 항목 뒤 복합형 설명, 수막구균 패혈증 목록 뒤의 즉시 진료 안내는 목록 항목 수에 포함하지 않는다.
- 문서 제목으로 특정 자료가 명시된 경우 그 문서 안의 복수 목록 안내를 각각 제목과 함께 반환한다. 검증된 예는 ADHD 주의력 8개·과잉행동/충동성 9개, 클라미디아 여성 3개·남성 3개, 수막구균 감염증의 네 목록 3/3/5/8개, 위식도역류질환 4개다. 증상·위험요인 목록은 모델 생성을 호출하지 않으며, 출처 조각 해시와 세그먼트 순서를 계속 검증한다.
- 관련 6개 테스트 파일은 65/65 PASS, 고정 retrieval golden은 79/79, 안전 회귀는 3/3, 합성 holdout은 95/95 PASS(지원 47/47, 올바른 기권 48/48, 오탐 0)다. holdout은 합성 회귀 모음이며 번역·임상 정확도의 독립 평가가 아니다.
- 번역 후보 1,017/1,017문서는 학교 데모 색인 `demoIndexStatus=PASS`, 한국어 색인 청크 20,338개다. 비한국어 청크 30개는 제외했고 QA `HOLD` 107건과 미해결 이슈 111건은 보존했다. `PASS`는 번역·출처·색인 무결성만 뜻하며 별도 번역/임상/권리 검토를 통과했다는 의미가 아니다.
- 이번 변경은 학교 발표용 후보 RAG 검색·응답 경로에만 적용한다. 인증 환자 API 및 의료영상 공유 흐름은 수정하지 않았으며 환자 영상 요구사항 FR-001~FR-046의 구현으로 간주하지 않는다.

| 최신 확인 | 결과 | 근거 |
|---|---|---|
| 번역 후보 색인 | PASS | 1,017/1,017문서, 20,338개 한국어 청크; QA HOLD 107건·미해결 111건 유지 |
| 구조화 목록 경계 | PASS | 다중 목록 그룹·설명 문장 제외를 HTTP 통합 검증; 생성 호출 0회 |
| 관련 테스트 | PASS | 지정 6개 파일 65/65 |
| 고정 검색·안전 회귀 | PASS | retrieval golden 79/79, safety 3/3 |
| 합성 검색 holdout | PASS | 95/95: 지원 47/47, 기권 48/48, 오탐 0 |
| 최신 LAN 코드 및 다른 PC 접속 | NOT VERIFIED | 11446 실행본 source fingerprint 불일치; 다른 컴퓨터에서 미시험 |
| 번역 의미·임상 정확성·권리 | NOT VERIFIED | 별도 검토자 없음; 콘텐츠 QA HOLD 유지 |

- 다음 작업은 허용된 실행 환경에서 11446 학교 데모를 최신 코드로 시작하고 source fingerprint·목록 HTTP 요청을 확인한 뒤, 같은 네트워크의 다른 컴퓨터에서 접속하는 것이다.

### 2026-10-13 목록 경계 전수 점검 보강

- 코퍼스에서 증상 목록 안내 후보가 있는 182개 문서를 제목 지정 자연어 질문으로 읽기 전용 평가했다. 128개는 구조화 후보를 반환했고, 54개는 `INSUFFICIENT_EVIDENCE`로 닫혔다. 이 수치는 후보 헤더를 정규식으로 찾은 탐색 점검이지 대표성 있는 검색 재현율 평가가 아니다. 모호한 짧은 제목이나 목록 경계를 확인할 수 없는 문서는 계속 자동 추정하지 않는다.
- 점검에서 문장부호가 있는 실제 항목(심방세동 6개, 강직성 척추염의 추가 증상 8개)이 이전 파서에서 누락되는 것을 확인해 보존 규칙을 추가했다. 독감의 8개 증상은 유지하면서 뒤따르는 감기·독감 비교 전환과 Markdown 표를 항목에서 제외했다. 즉시 진료 안내 문장도 증상 목록에 끼워 넣지 않는다. 다중 제목 목록은 각 헤더별로 분리한다.
- 새 HTTP 회귀와 합성 holdout에 이 사례를 고정했다. 관련 테스트 65/65, holdout 98/98(지원 50/50, 기권 48/48, 오탐 0), golden 79/79, safety 3/3이다. 전체 holdout 결과도 독립 임상 정답 평가가 아니라 고정된 합성 회귀다.
- 번역 후보 색인은 1,017/1,017 문서와 20,338 청크 PASS를 유지하며 QA HOLD 107건 및 미해결 111건을 보존한다. 사용자 지시에 따라 번역·임상·권리 검토자를 별도로 배정하지 않았고, 후보 PASS는 그 검토를 대신하지 않는다.

| 최신 확인 | 결과 | 근거 |
|---|---|---|
| 증상 목록 문서 스캔 | PASS | 후보 182개 중 128개 구조 후보, 54개 기권; 비교 표·즉시 진료 안내 누출 0; 비대표 탐색 지표 |
| 회귀·색인 평가 | PASS | 관련 테스트 65/65, holdout 98/98(50/48, 오탐 0), golden 79/79, safety 3/3; 색인 PASS 1,017/1,017 |
| LAN 런타임 지문 | FAIL | `10.10.70.151:11446` 검증기 `SOURCE_SNAPSHOT_MISMATCH`; 최신 코드 실행본 아님 |
| 다른 PC 접속 | NOT VERIFIED | 원격 클라이언트 접속 시험 안 함 |
| 번역 의미·임상 정확성·재사용 권리 | NOT VERIFIED | 별도 검토 없이 색인 무결성만 확인 |

### 2026-10-13 실제 모델 답변 계약 스모크

- `node scripts/medlineplus-upload-model-smoke.js candidate-amino-acid-building-block-lexical` 실행 결과 `PASS`: 합성 일반 지식 질문 1건, claim 1개, 출처 1개, 답변과 출처 발췌 동일, raw question 미전송, 모델 생성 54.4초.
- `node scripts/medlineplus-upload-model-smoke.js candidate-held-arthritis-concept`도 `PASS`: QA `HOLD` 자료를 사용한 합성 질문에서 claim/source 일치 및 QA HOLD 경고 보존을 확인했고, 모델 생성은 14.4초였다.
- 두 결과는 서버 응답 검증·인용 계약 테스트다. 답이 원문 인용과 같다는 사실만 확인하며 인용 내용의 의미적 타당성, 임상 정확성, 재사용 권리를 입증하지 않는다. 실제 환자 데이터는 사용하지 않았다.
- loopback `127.0.0.1:11445`와 사설 NIC `10.10.70.151:11446` 모두 runtime verifier가 `SOURCE_SNAPSHOT_MISMATCH`를 반환한다. 실행 중 서버에 최신 코드가 반영되었거나 다른 컴퓨터에서 접근 가능하다고 주장할 수 없다.

### 2026-10-13 단일 문장 증상 근거 검색 보강

- 기존 증상 목록 검색이 `증상에는 ... 포함될 수 있습니다` 형태의 완성된 번역 문장을 목록 제목으로 오인해 기권하는 경우를 보완했다. 질문이 단일 문서를 명시하고, 번역·색인 해시가 유효하며, 증상 어휘가 둘 이상 포함된 열거 문장이 하나만 확인될 때 그 문장의 문장 인덱스만 허용한다. 기존 구조화 목록이 있으면 기존 경로를 우선한다.
- 목록 개수 질의, 여러 문서가 후보인 경우, 약물·치료·면역요법·예방접종 부작용 문맥은 이 단일 문장 경로에서 기권한다. HTTP는 눈 감염과 담석의 완전한 증상 문장만 출처 발췌로 표시했고 모델 호출은 0회였다. 눈 감염 개수와 면역요법 부작용 증상 질의는 `INSUFFICIENT_EVIDENCE`로 닫혔다.
- 문서 제목으로 만든 탐색 질문 185건 가운데 131건이 검색 후보(구조 목록 125건, 단일 문장 6건), 54건은 기권했다. 이 정규식 기반 문서 탐색은 후보 경계 점검이며 일반 질문의 검색 재현율이나 임상 정답률이 아니다. 단일 문장 양성 4건과 개수·부작용 기권 2건을 고정 holdout에 더했다.
- 관련 6개 테스트 파일 59/59, holdout 106/106(지원 56/56, 기권 50/50, 오탐 0), golden 79/79, 안전 회귀 3/3이 통과했다. 색인은 한국어 번역 1,017/1,017 문서와 20,338 청크 `PASS`; QA `HOLD` 107건과 미해결 이슈 111건을 그대로 보존했다.
- 여기서 `PASS`는 학교 MVP용 번역·출처·색인 무결성을 뜻한다. 원문 대조, 번역 의미, 임상 적합성, 재사용 권리는 검토하지 않았고 별도 검토자도 배정하지 않았다. 변경은 비임상 학교 발표 후보 RAG에 한정되며 FR-001~FR-046 환자 동의·의료영상 흐름은 수정하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 단일 문장 증상 검색 | PASS | 단일 문서·해시 유효·증상 표현 2개 이상·문장 1개 조건, 전체 문장 인덱스만 선택 |
| HTTP 표시 및 안전 경계 | PASS | 눈 감염·담석 원문 문장만 발췌, 모델 호출 0; 개수·면역요법 부작용 질의 기권 |
| 회귀 평가 | PASS | 지정 6개 파일 59/59, holdout 106/106(지원 56, 기권 50, FP 0), golden 79/79, safety 3/3 |
| 번역 색인 및 QA HOLD | PASS | 문서 1,017/1,017, 청크 20,338, QA HOLD 107, 미해결 111 유지 |
| 최신 LAN 실행본·다른 컴퓨터 접속 | NOT VERIFIED | 이 변경 뒤 실행 서버를 갱신하거나 다른 컴퓨터에서 시험하지 않음 |
| 번역 의미·임상 정확성·권리 | NOT VERIFIED | 별도 대조·임상·권리 검토 없음 |

### 2026-10-13 목록 표현 확장 및 HOLD 경계 확인

- 번역 목록에서 실제로 쓰인 증상 표현을 보강하고 `다음 증상이 포함될 수 있습니다` 형태의 명시적 목록 제목을 인식하도록 했다. 제1형 당뇨병 8개, 심부전 8개, 골반저 질환 10개 목록을 HTTP 회귀로 고정했다. 세 질의 모두 출처 조각을 그대로 구성하고 생성 모델 호출은 0회다.
- 문맥을 함께 확인해 미치료 상태에서 나타날 수 있는 합병증 목록이 일반 증상 목록으로 오인되지 않도록 했다. 라임병 질의는 원래의 초기 증상 한 문장만 반환한다. 불면증과 갑상샘기능항진증은 전체 문서가 QA `HOLD`이고 미해결 이슈가 있어 `INSUFFICIENT_EVIDENCE`로 유지되며, `demoIndexStatus=PASS`가 내용 QA HOLD를 우회하지 않는다.
- 6개 관련 테스트 파일 59/59, 합성 holdout 111/111(지원 59/59, 기권 52/52, 오탐 0), retrieval golden 79/79, 안전 회귀 3/3을 통과했다. 색인은 1,017/1,017개 번역 문서와 20,338개 청크 `PASS`; QA `HOLD` 107건, 미해결 이슈 111건, 비한국어 제외 청크 30개를 유지한다.
- 사용자가 지정한 PASS는 학교 발표 후보용 번역·출처·색인 무결성 상태로 적용한다. 원문 대조, 번역 의미, 임상 정확성, 이용권리는 검토하지 않았고 별도 검토자도 두지 않았다. FR-001~FR-046 동의·의료영상 교류 흐름은 변경하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 새 증상 목록 HTTP 회귀 | PASS | 제1형 당뇨병 8개, 심부전 8개, 골반저 질환 10개; 모델 호출 0 |
| HOLD·문맥 경계 | PASS | 불면증·갑상샘기능항진증 기권; 라임병은 초기 증상 문장만 반환 |
| 관련 테스트 | PASS | 6개 파일 59/59; holdout 111/111(지원 59, 기권 52, FP 0); golden 79/79; safety 3/3 |
| 번역 후보 색인 | PASS | 1,017 문서·20,338 청크; QA HOLD 107, 미해결 111 보존 |
| 최신 LAN 실행본·다른 컴퓨터 접속 | NOT VERIFIED | 이번 변경 뒤 실행본 지문 및 원격 접속을 확인하지 않음 |
| 번역 의미·임상 정확성·권리 | NOT VERIFIED | 대조·임상·이용권리 검토 없음 |

### 2026-10-13 loopback HTTP와 실제 Qwen 통합 확인

- `node scripts/verify-health-helper-school-demo-http.js`를 실행했다. 검증기는 임시 포트를 사용한 `127.0.0.1` HTTP 서버와 합성 질문만 사용하며 기존 LAN 서비스는 변경하지 않는다.
- 생성 질의마다 기대 핵심 표현을 고정하고 그 표현이 허용된 원문 문장 및 실제 답변에 모두 있는지 확인하도록 검증기를 강화했다. CT 구어체 임신·금식·조영제 질의와 방사선+임신 복합 초점도 추가해 55/55 HTTP 질의가 통과했다. 생성 27/27은 답변 anchor, claim quote, 출처 발췌가 맞고 원 질문 문자열이 모델 payload에서 제외됐다. 나머지 28건(근거 부족·거부·개인 질문)은 출처 없이 모델 호출 0회였다.
- 방사선+임신 복합 질의는 두 핵심 anchor 모두 허용된 근거와 실제 답변에 있는지 검사했다. 개별 focus가 retrieval에서 잡히는 데 그치지 않고 실제로 선택된 답변 문장에도 둘 다 나타나는지 확인한다.
- retrieval holdout 평가기도 필수 근거 문장 전체, 예상 intent, 예상 focus를 확인하도록 확장했다. 네 CT 표현을 추가했고 복합 초점 질의는 방사선 안내와 임신 안내 두 문장을 모두 반환해야 통과한다. 검색 holdout은 115/115(지원 63, 기권 52, 오탐 0)였다.
- 별도 직접 모델 스모크 4건(빈혈 어지럼, 알레르기 원인, CT 조영제 목적, MRI 금속 안전)도 각 1 claim·1 출처와 고정 근거 anchor 검사를 통과했다. 이는 답변/인용 계약 증거이지, 문장의 의미적 함의나 임상 정답성을 판정한 결과는 아니다. `semanticGrounding=NOT_PROVEN`을 유지한다.
- loopback HTTP 경로는 현재 구현으로 검증했지만 기존 LAN 서버의 실행 지문과 다른 컴퓨터 접속은 확인하지 않았다. 답변 의미·번역 검수·임상 정확성·이용권리 또한 미검증이다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 합성 HTTP 질문 통합 | PASS | 55/55; 27 생성, 28 모델 미호출 |
| 생성 답변 인용·anchor | PASS | 27/27에서 핵심 표현이 허용 근거와 답변에 존재; 복합 초점 2개 모두 포함; 답변=claim quote=출처 발췌; 원 질문 payload 제외 |
| 검색 holdout 의도·초점·전체 근거 | PASS | 115/115; 지원 63/63, 기권 52/52, 오탐 0; 복합 질의의 필수 근거 2문장 확인 |
| 지원·거부 경계 | PASS | 개인·거부·근거부족 28건 모두 출처 0, 생성 미호출 |
| 별도 실제 Qwen 스모크 | PASS | 지정 paraphrase 4/4; semantic grounding은 미검증 |
| LAN·다른 컴퓨터 | NOT VERIFIED | 기존 서비스 지문·원격 클라이언트 미확인 |

### 2026-10-13 증상·원인 복합 질의와 번역 색인 재확인

- 한국어 번역 코퍼스 집계 결과 1,017/1,017 문서와 20,338/20,338 한국어 청크가 `demoIndexStatus=PASS`다. 비한국어 청크 30개는 제외했다. QA `HOLD` 107건과 미해결 111건은 그대로 보존했다. 이 `PASS`는 번역문 해시·색인 무결성으로만 사용한다.
- “빈혈의 증상과 원인”은 QA `PASS`, 미해결 0인 같은 문서의 별도 증상·주요 원인 문장이 모두 존재할 때만 두 claim으로 답한다. claim마다 focus 하나와 완전한 원문 문장 하나를 요구하고, 질문 순서대로 두 focus를 모두 포함해야 검증된다. 천식 결합 질의, 주제가 명시되지 않은 개인 증상 원인 질문, 근거 누락은 계속 기권한다.
- 실제 합성 loopback HTTP 2건에서 빈혈은 Qwen 2 claim·출처 1개로 생성되고, 천식은 생성 없이 기권했다. 사용자 원 질문은 모델 payload에서 제외됐다. 답변과 claim/source 인용 형식은 통과했으나 semantic grounding은 `NOT_PROVEN`이다.
- 회귀 결과는 관련 Node 테스트 48/48, retrieval holdout 117/117(지원 64/64, 기권 53/53, 오탐 0), golden 79/79, safety 3/3이다. 환자 동의와 영상교류 FR-001~FR-046은 변경하지 않았다. 학교 발표용 비임상 후보이며 LAN 서버 갱신과 다른 컴퓨터 접속은 이번 변경에서 미검증이다.

### 2026-10-13 메인 HCC 질문의 근거 완전성

- 코퍼스 실측에서 AFP 종양표지자 검사 자료는 검색 색인에 없고, 간 초음파 주제를 설명하는 문서도 없었다. 따라서 `AFP와 간 초음파 자료는 간암 시나리오와 어떻게 연결되나요?`가 간암 일반 문장으로 잘못 회수되고, `간 초음파 검사는 무엇을 확인하나요?`가 다른 질환 문서로 잘못 회수되는 것을 재현했다.
- 특정 AFP 검사 또는 간 초음파 자료가 색인·HOLD 문서에 없는 동안에는 해당 질의가 다른 질환/검사 문서로 대체되지 않도록 `INSUFFICIENT_EVIDENCE`로 닫는다. 간암 일반 개념 검색은 그대로 유지한다. 합성 환자의 발표 설정 설명은 별도 인증 환자 경로에서만 제공하며 학교 후보 서버에는 환자 기록을 연결하지 않는다.
- A1C 후속 질문도 원문 코퍼스의 QA `HOLD`를 컨텍스트로 우회하지 않는지 회귀로 고정했다. 보류 문서는 색인 `PASS` 상태여도 답변 후보로 승격하지 않는다.

| 검증 | 결과 | 근거 |
|---|---|---|
| 후보 RAG 회귀 | PASS | 관련 5개 테스트 파일 47/47 |
| HCC 복합·AFP·간 초음파 질문 | PASS | retrieval holdout 120/120; 세 질문 모두 기권; HTTP 출처 0·모델 호출 0 |
| 기존 간암 개념 질문 | PASS | `간암 설명`은 기존 주제 후보 유지 |
| 검색 golden·safety | PASS | retrieval golden 79/79, safety 3/3 |
| 번역·임상 의미·권리 검토 | NOT VERIFIED | 색인 무결성과 기권 동작만 검증; QA HOLD 107건·미해결 111건 유지 |
| 현재 LAN 실행본·다른 컴퓨터 접속 | NOT VERIFIED | 기존 listener를 재시작하거나 원격 접속하지 않음 |

### 2026-10-13 Medical Tests 번역 부록과 AFP·간 초음파 검색

- 학교 발표 코퍼스의 전체 Health Topics 1,017개 문서·20,338개 한국어 청크와 MedlinePlus Medical Tests의 AFP 종양표지자 검사·초음파 2개 자료·9개 번역 청크를 학교 데모 번역 후보 `PASS`로 처리했다. 통합 검색 뷰는 1,019개 문서·20,347개 청크다. 후보 `PASS`는 사용자 결정에 따른 학교 데모 코퍼스 채택 상태다. 한글 텍스트 해시·적재 무결성은 검사했지만 번역 의미 정확성, 콘텐츠 QA, 원문 대조, 권리 또는 임상 승인을 뜻하지 않는다.
- 별도 `medlineplus-full-ko-20261011-v2` Qwen 번역 초안 묶음(완료 134건·자동 HOLD 45건)은 이번 학교 데모 입력 코퍼스가 아니다. 해당 초안은 이번 1,019건 PASS 집계와 검색에 포함하지 않았다.
- 출처는 [AFP Tumor Marker Test](https://medlineplus.gov/lab-tests/alpha-fetoprotein-afp-tumor-marker-test/)와 [Ultrasound](https://medlineplus.gov/lab-tests/sonogram/)다. MedlinePlus는 Medical Test 정보를 공개 도메인 범위로 안내하고 출처 표기를 요청한다([이용 안내](https://medlineplus.gov/about/using/usingcontent/)). 부록은 원문 문장과 번역을 출처 대조용으로 기록하지만 런타임 검색 및 모델 입력에는 선택된 한국어 문장만 투영한다.
- AFP와 간 초음파의 관계 질의는 간경변증 또는 만성 B형·C형 간염 상황과 6개월 주기를 명시한 출처 문장에만 연결한다. AFP의 검사 정의와 단독 선별·진단 한계, 초음파 정의 및 복부 장기 범위도 각각 고정 문장으로 제한했다. 개인 AFP 결과, 수치 해석, 검사 조합의 진단력, 증례·시나리오 판정, 번역 근거가 없는 간 초음파 이상 소견은 기권한다.
- 두 새 자료와 기존 자료의 콘텐츠 QA 상태는 별도 필드로 보존한다. 새 자료는 자동 QA `HOLD`, 콘텐츠·원문 검토 `UNASSIGNED`, 번역 독립 검토 미실시다. UI는 데모 후보 `PASS`와 콘텐츠 QA `HOLD`를 함께 표시한다. 원래 Health Topics QA HOLD 107건과 미해결 이슈 111건도 그대로이며, 학교 데모 전체의 콘텐츠 QA HOLD는 109건이다.
- `node scripts/evaluate-health-helper-school-demo-medical-tests.js`는 지원 5/5, 기권 5/5, 오탐 0, 전체 10/10을 통과했다. HTTP 통합 테스트는 고정 생성기 대역을 사용해 번역 문장·출처 URL·QA HOLD 경고·모델 payload의 원 질문 제외를 확인했다. 관련 테스트 묶음은 46/46 PASS다. 실제 Qwen 의미 생성과 번역 의미 검증은 이번 작업에서 실행하지 않아 `NOT VERIFIED`다. `pnpm run`은 비대화형 환경에서 모듈 디렉터리 정리를 요청해 중단됐으며, 패키지 스크립트 경유 실행은 `NOT VERIFIED`다.
- 변경은 학교 발표용 미인증 후보 preview와 RAG 검색에 한정된다. FR-001~FR-046 환자 동의·권한·감사·DICOM/FHIR API는 변경하지 않았다. 기존 LAN listener를 재시작하지 않았으므로 현재 실행본 반영 및 다른 컴퓨터 연결은 `NOT VERIFIED`다.

| 검증 | 결과 | 근거 |
|---|---|---|
| 학교 데모 번역 후보 채택 | PASS | 1,019개 문서; Health Topics 1,017개와 Medical Tests 2개 |
| 한글 번역 색인 무결성 | PASS | 20,347개 청크; Medical Tests 9개 원문/번역 조각 해시 일치 |
| 콘텐츠 QA 상태 | HOLD 보존 | 기존 107건+추가 2건; QA HOLD를 후보 채택 상태와 별도로 유지 |
| AFP·초음파 합성 holdout | PASS | 지원 5/5, 기권 5/5, 오탐 0, 10/10 |
| 관련 HTTP·런타임·검색 테스트 | PASS | 46/46 |
| 임상·번역 의미 검증 및 실제 Qwen 생성 | NOT VERIFIED | 별도 전문가/번역자 검토 없음; 현재 작업은 고정 모델 대역 검증 |
| LAN 실행본·외부 클라이언트 | NOT VERIFIED | 실행 중 프로세스에 배포하거나 다른 PC에서 확인하지 않음 |

### 2026-10-14 학교 데모 LAN 대체 포트 및 최신 코드 확인

- 현재 LAN 인터페이스는 `10.10.70.151`이다. `11445`와 `11446`은 이전 후보 런타임이 점유 중이며, `11446` 응답은 구 런타임 계약과 Health Topics 단독 코퍼스(1,017개 문서)를 보고해 최신 Medical Tests 부록 2개가 반영되지 않은 상태다.
- 기존 프로세스에 영향 없이 최신 코드를 별도 실행할 수 있도록 학교 데모 런처의 명시적 허용 포트 `11444`를 추가했다. 기본 포트 `11446`은 유지하며, `HIPASS_HEALTH_HELPER_SCHOOL_LAN_PORT=11444`로 선택할 수 있다. 시작 코드와 허용 포트 설정도 런타임 source fingerprint에 포함한다.
- 관련 회귀는 27/27 PASS다. 검색 holdout은 120/120(지원 64, 기권 56, 오탐 0), AFP·초음파 부록 평가는 10/10 PASS이며, 코퍼스는 1,019개 문서·20,347개 청크·데모 번역 후보 1,019/1,019 PASS다. 콘텐츠 QA HOLD 109건은 별도 상태로 보존한다.
- 11444 최신 LAN 프로세스 시작은 실행 정책 검토에 의해 거부되어 실제 서버 상태는 `NOT VERIFIED`다. 11446 구 프로세스는 그대로 실행 중이며 업데이트했다고 보지 않는다. 다른 컴퓨터의 접속도 아직 시험하지 않았다.

| 확인 | 결과 | 근거 |
|---|---|---|
| 학교 데모 LAN 포트 설정 회귀 | PASS | `node --test test/health-helper-school-demo-runtime-config.test.js test/health-helper-candidate-runtime.test.js test/health-helper-candidate-http.test.js test/health-helper-school-demo-medical-tests.test.js` · 27/27 |
| 번역 검색 holdout | PASS | 지원 64/64, 기권 56/56, 오탐 0, 총 120/120 |
| Medical Tests 부록 검색 | PASS | 지원 5/5, 기권 5/5, 오탐 0, 총 10/10 |
| 11444 최신 런타임 시작 | NOT VERIFIED | 실행 정책 검토가 서버 시작 명령을 거부함; 11444는 새로 열리지 않음 |
| 11446 구 런타임 | RUNNING · STALE | `candidate-runtime-20261013-v1`, 부록 미포함, source fingerprint 불일치 |
| 다른 PC 접속 | NOT VERIFIED | 원격 클라이언트 미시험 |
