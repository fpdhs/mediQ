import {mkdir,writeFile} from 'node:fs/promises';
import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {buildScenarioScope} from '../src/health-helper-scenario-scope.js';
const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url));
const scope=buildScenarioScope(corpus),folder=new URL('../data/health-helper-scenario-scope-20261012-v2/',import.meta.url);
await mkdir(folder);await writeFile(new URL('scope.json',folder),JSON.stringify(scope,null,2),{flag:'wx'});
await writeFile(new URL('evaluation.jsonl',folder),scope.evaluation.map(x=>JSON.stringify(x)).join('\n')+'\n',{flag:'wx'});
const lines=['# 시나리오 건강도우미 질문 범위·근거 공백 매핑','', '2026-10-12 · DRAFT / UNASSIGNED · 첫 분석 작업 단위. 의료 콘텐츠 승인 아님.','',
 '실제 건강검진 23항목 + AFP·간 초음파·복부 CT = 26개 주제. HbA1c 기록 없음. 등록1,017 / 후보910 / HOLD107. 아래 검색 상태는 로컬 후보의 기본 질문 검색 결과이며 의학 답변 품질·배포 PASS가 아니다. 관련 문서 제목 목록은 탐색 후보일 뿐 검사별 충분성의 증거가 아니다.','',
 '| 검사/주제 | 단위 | 기본 질문 검색 상태 | 관련 후보/보류 문서 | 남은 공백 |','|---|---|---|---|---|'];
for(const r of scope.rows)lines.push(`| ${r.label} | ${r.unit||'정성'} | ${r.actualRetrieval.status} | ${r.relatedDocuments.slice(0,5).map(d=>`${d.title} (${d.state})`).join(' · ')||'없음'} | 검사 목적·한계·준비·비교 조건의 본문 근거 및 권리/내용 검토 |`);
lines.push('','각 주제별 정의·목적·한계·참고범위·비교·검사 간 연결·준비·진료 질문 8개와 음성/부정확 비교 4개: 총312개 평가 후보. 평가 정의 생성이며 실제312개 모델 시험을 수행한 것이 아니다.',
 '','기존 domestic 화면 출처는 scope.json의 existingScreenLinks에 기록했다. 현재 RAG 재서술 허락으로 승계하지 않는다. AFP/간기능 기존 corpus는 NOT_CLEARED_FOR_RAG, 지자체 검사 목록은 범위가 좁고 내용 검토 미승인. HOLD107 등록과 본문 보존은 유지하며 답변 입력에서 제외한다.',
 '','수치 비교는 기존 compareHealthPoints가 날짜·단위·method·숫자 여부를 확인하며 이전값>0일 때만 percent를 계산한다. 다른 기관은 산술 차이라고 표시한다. 혈압은 문자열, 시력/청력/소변/간염/폐기능/방사선/구강은 수치 자동 해석하지 않는다. 개인 기록은 공용 corpus에 넣지 않았다.',
 '','현행 실제 API는 인증·trusted ingress·감사와 방문질문 전용 socket relay를 유지한다. 로컬 의학 설명 후보가 실제 서버에 연결됐다고 해석하지 않는다. 최신 실제 배포 상태는 이번에 재확인하지 않았으므로 NOT VERIFIED.',
 '','다음 작업 한 개: CT 일반 개념 흐름을 새 매핑 기준으로 실제 Qwen·브라우저에서 정상·거부·근거 부족·출처·질문 메모까지 검증. 이후 private relay의 설명형 계약·인증·감사 영향을 따로 검토한다. 전체 MVP 완료 아님.');
await writeFile(new URL('../docs/implementation/health-helper-scenario-scope-20261012-v2.md',import.meta.url),lines.join('\n')+'\n',{flag:'wx'});
console.log(JSON.stringify({topics:scope.rows.length,evaluation:scope.evaluation.length,firstFlow:scope.firstFlow,modelCalls:0}));
