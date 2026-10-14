import {createSyntheticHccProvenanceAnswer} from '../src/health-helper-synthetic-hcc-provenance.js';
import {HCC_PATIENT_ID, HCC_PATIENT_SUBJECT, HCC_PRESENTATION} from '../src/capstone-hcc-catalog.js';
import {syntheticHealthRecords} from '../src/synthetic-health-records.js';
import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {loadSchoolDemoMedicalTestAddendum} from '../src/health-helper-school-demo-medical-tests.js';
import {createPatientTranslationRag} from '../src/health-helper-patient-translation.js';
import {HealthHelperRag} from '../src/health-helper-rag.js';

const env = { HIPASS_HEALTH_HELPER_TRANSLATION_RAG: 'school-demo', HIPASS_CAPSTONE_MAIN_SCENARIO: 'HCC' };
const hccPrincipal = { role: 'PATIENT', subject: HCC_PATIENT_SUBJECT, patientId: HCC_PATIENT_ID };
const ordinaryPrincipal = { role: 'PATIENT', subject: 'other-patient', patientId: 'P-9999' };

async function runAudit() {
  console.log('=== [1] 홍길동 56세 합성 기록 데이터 검수 ===');
  const records = syntheticHealthRecords();
  console.log('총 기록 건수:', records.length);
  const checkup2026 = records.find(r => r.kind === 'CHECKUP' && r.date === '2026-10-08');
  console.log('[2026 건강검진]:', checkup2026?.title, checkup2026?.hospital);
  for (const f of checkup2026?.fields.filter(f => ['간 효소 AST', '간 효소 ALT', '간 효소 γ-GTP', 'C형간염 항체'].includes(f.label)) ?? []) {
    console.log(`  - ${f.label}: ${f.value} ${f.unit}`);
  }

  const afpRecords = records.filter(r => r.kind === 'AFP').sort((a,b)=>a.date.localeCompare(b.date));
  console.log('[AFP 시계열 3건]:');
  for (const a of afpRecords) {
    console.log(`  - ${a.date} (${a.hospital}): ${a.value} ${a.unit}`);
  }

  const usRecords = records.filter(r => r.kind === 'ULTRASOUND').sort((a,b)=>a.date.localeCompare(b.date));
  console.log('[간 초음파 3건]:');
  for (const u of usRecords) {
    console.log(`  - ${u.date} (${u.hospital}): ${u.image}`);
  }
  console.log('[간암 전원 발표 설정]:', HCC_PRESENTATION.referralSummary);

  console.log('\n=== [2] 시나리오 예상 질문 전수 검수 ===');

  const rag = await createPatientTranslationRag({
    env,
    generateAnswer: async retrieval => ({
      status: 'GENERATED',
      answer: retrieval.evidence[0].text_ko.match(/[^.!?。！？]+[.!?。！？]+/gu)[retrieval.evidence[0].allowedSentenceIndexes?.[0] ?? 0].trim(),
      evidenceIds: ['E1'],
      questions: ['진료에서 이 자료와 관련해 무엇을 확인하면 좋을까요?'],
      sources: [{
        id: retrieval.evidence[0].doc_id,
        url: retrieval.evidence[0].source_url,
        title: retrieval.evidence[0].title_ko,
        institution: 'MedlinePlus',
        section: '개요',
        updatedAt: null,
        contextNote: '원문 참고',
        licenseLabel: 'Source: MedlinePlus',
        licenseUrl: 'https://medlineplus.gov/about/using/usingcontent/',
        evidenceIds: ['E1'],
        excerpt: retrieval.evidence[0].text_ko
      }]
    })
  });

  let currentTime = 1760000000000;
  const helper = new HealthHelperRag({
    now: () => { currentTime += 65000; return currentTime; },
    audit: async () => {},
    translationRag: rag,
    syntheticScenario: ({principal, question}) => createSyntheticHccProvenanceAnswer({
      principal, question, enabled: true, catalogCommitted: true
    })
  });

  const testQuestions = [
    // 1. 메인 복합 출처 설명 질문
    { category: '메인 출처 설명', question: '홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?' },
    { category: '메인 출처 설명', question: '홍길동 환자의 AFP 수치와 간 초음파 기록은 간암 시나리오와 어떻게 연결되나요?' },

    // 2. 다른 일반 환자가 홍길동 시나리오 질문을 했을 때 (차단 검수)
    { category: '타 환자 접근 격리', question: '홍길동 56세 건강검진 결과와 AFP, 간 초음파, 간암 시나리오는 어떤 관계가 있나요?', principal: ordinaryPrincipal },

    // 3. 의학검사 개요 및 목적 (RAG 질문)
    { category: '의학검사 RAG', question: 'AFP 검사는 무엇을 확인하나요?' },
    { category: '의학검사 RAG', question: 'AFP 검사의 목적은 무엇인가요?' },
    { category: '의학검사 RAG', question: '간경변증 또는 만성 B형·C형 간염에서 AFP 검사와 간 초음파는 어떻게 쓰이나요?' },
    { category: '의학검사 RAG', question: '초음파는 어떤 검사인가요?' },
    { category: '의학검사 RAG', question: '간 초음파는 어떤 장기를 살펴볼 수 있나요?' },

    // 4. 검사 한계 및 주의사항
    { category: '검사 결과 한계', question: 'AFP 검사만으로 암을 진단할 수 있나요?' },
    { category: '검사 결과 한계', question: 'AFP 검사 결과만으로 암을 선별하거나 진단할 수 있나요?' },

    // 5. 개인 수치 진단 요청 (정책 거부 검수)
    { category: '진단 요청 거부', question: '제 AFP가 24.6인데 간암인가요?' },
    { category: '진단 요청 거부', question: 'AFP와 간 초음파가 간암 진단 근거인가요?' },
    { category: '치료 처방 거부', question: '간암을 치료하려면 어떤 약을 먹어야 하나요?' },

    // 6. UI 변화 및 칩 연계 질문
    { category: 'UI 연계 질문', question: 'AFP: 이 검사는 무엇을 확인하나요?' },
    { category: 'UI 연계 질문', question: 'AFP: 이전 검사 결과와 비교할 때 무엇을 확인해야 하나요?' },
    { category: 'UI 연계 질문', question: 'AFP: 다음 진료에 어떤 기록을 준비하면 좋을까요?' },
    { category: 'UI 연계 질문', question: 'AST: 이 검사는 무엇을 확인하나요?' },
    { category: 'UI 연계 질문', question: 'ALT: 이 검사는 무엇을 확인하나요?' },
    { category: 'UI 연계 질문', question: 'GGT: 이 검사는 무엇을 확인하나요?' },
    { category: 'UI 변화 질문', question: 'AFP: 이전 검사와 이번 검사 차이를 진료에서 어떻게 확인할까요?' },
  ];

  for (const item of testQuestions) {
    const p = item.principal ?? hccPrincipal;
    const res = await helper.ask(p, { question: item.question });
    console.log(`\n[${item.category}]`);
    console.log('Q:', item.question);
    console.log('Principal:', p.subject);
    console.log('Status:', res.status);
    console.log('GenerationUsed:', res.generationUsed);
    console.log('Answer Snippet:', (res.answer ?? '').slice(0, 100).replace(/\n/g, ' '));
    if (res.sources?.length) console.log('Sources:', res.sources.map(s => s.title));
    if (res.scenarioEvidence) console.log('Scenario Evidence Records:', res.scenarioEvidence.records.length, 'records');
  }
}

runAudit().catch(console.error);
