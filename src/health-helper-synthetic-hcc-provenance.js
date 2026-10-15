import { isScenarioHealthPatient } from './scenario-health-standard.js';
import { HCC_PRESENTATION } from './capstone-hcc-catalog.js';
import { syntheticHealthRecords, SYNTHETIC_HEALTH_VERSION } from './synthetic-health-records.js';

const AFP = /(?:\bAFP\b|알파태아단백)/iu;
const ULTRASOUND = /초음파/u;
const LIVER_CANCER = /(?:간암|간세포암|\bHCC\b)/iu;
const RELATION = /(?:관계|관련(?:성)?|연결|어떻게|어떤.*(?:의미|자료|근거|관계)|출처|사례|시나리오|설정)/u;
const CHECKUP_FIELDS = Object.freeze(['간 효소 AST', '간 효소 ALT', '간 효소 γ-GTP', 'C형간염 항체']);

function isCompositeProvenanceQuestion(question) {
  return AFP.test(question) && ULTRASOUND.test(question)
    && LIVER_CANCER.test(question) && RELATION.test(question);
}

function findCheckup(records) {
  const candidates = records.filter(record => record.kind === 'CHECKUP' && record.synthetic === true
    && record.age === HCC_PRESENTATION.age && Array.isArray(record.fields));
  if (candidates.length !== 1) return null;
  const [record] = candidates;
  const fields = CHECKUP_FIELDS.map(label => record.fields.find(field => field.label === label));
  if (fields.some(field => !field || field.referenceRange !== null || field.interpretation !== null
    || !(typeof field.value === 'string' || Number.isFinite(field.value)))) return null;
  return { record, fields };
}

function formatCheckupField(field) {
  return `${field.label} ${field.value}${field.unit ? ` ${field.unit}` : ''}`;
}

// Fixed, source-linked provenance for one committed presentation fixture. The
// original question and synthetic record values never reach a language model.
export function createSyntheticHccProvenanceAnswer({ principal, question, enabled, catalogCommitted }) {
  if (enabled !== true || catalogCommitted !== true || !isScenarioHealthPatient(principal)
    || typeof question !== 'string' || !isCompositeProvenanceQuestion(question)) return null;

  const records = syntheticHealthRecords();
  const checkup = findCheckup(records);
  const afp = records.filter(record => record.kind === 'AFP').sort((a, b) => a.date.localeCompare(b.date));
  const ultrasound = records.filter(record => record.kind === 'ULTRASOUND').sort((a, b) => a.date.localeCompare(b.date));
  if (!checkup || checkup.record.date !== '2026-10-08' || afp.length !== 3
    || afp.some(record => record.synthetic !== true || !Number.isFinite(record.value)
      || record.referenceRange !== null || record.unit !== 'ng/mL')
    || ultrasound.length !== 3 || ultrasound.some(record => record.synthetic !== true
      || record.image !== '/images/mediq-synthetic-liver-ultrasound-v1.png')
    || new Set(ultrasound.map(record => record.image)).size !== 1
    || typeof HCC_PRESENTATION.referralSummary !== 'string' || !/간암/u.test(HCC_PRESENTATION.referralSummary)
    || !HCC_PRESENTATION.referralSummary.includes(HCC_PRESENTATION.sourceHospitalName)
    || !HCC_PRESENTATION.referralSummary.includes(HCC_PRESENTATION.targetHospitalName)
    || typeof HCC_PRESENTATION.diagnosisOrigin !== 'string' || !HCC_PRESENTATION.synthetic) return null;

  const checkupValues = checkup.fields.map(formatCheckupField).join(', ');
  const afpValues = afp.map(record => `${record.date} ${record.value.toFixed(1)} ${record.unit}`).join(' → ');
  const ultrasoundDates = ultrasound.map(record => record.date).join(', ');
  const patientName = HCC_PRESENTATION.patientName;
  const age = checkup.record.age;
  return {
    status: 'SYNTHETIC_SCENARIO',
    answer: `이 답변은 ${patientName} ${age}세 발표용 합성 기록의 출처를 정리합니다.\n\n간 관련 건강검진 항목(${checkup.record.date}): ${checkupValues}. 이 합성 기록에는 기관 참고범위와 판정이 없습니다.\n\n혈청 AFP: ${afpValues}. 모두 합성값이며 참고범위가 등록되지 않아 수치 의미를 판정하지 않습니다.\n\n간 초음파: ${ultrasoundDates}의 세 기록이 같은 합성 예시 이미지를 가리킵니다. 실제 촬영 영상이나 판독문은 아닙니다.\n\n간암과의 관계: 발표 설정에는 ${HCC_PRESENTATION.sourceHospitalName}에서 간암 진단 후 ${HCC_PRESENTATION.targetHospitalName}으로 전원한다고 적혀 있습니다. 진단 출처는 “${HCC_PRESENTATION.diagnosisOrigin}”으로 기록돼 있습니다. 이 설정은 건강검진 수치, AFP 값 또는 초음파 이미지에서 도출한 것이 아닙니다. 이 자료로 실제 환자의 진단이나 위험도를 판단할 수 없습니다.`,
    sources: [], questions: [], questionOrigin: 'PROJECT_TEMPLATE',
    scenarioEvidence: {
      version: SYNTHETIC_HEALTH_VERSION,
      recordIds: [checkup.record.id, ...afp.map(record => record.id), ...ultrasound.map(record => record.id)],
      records: [
        { id: checkup.record.id, kind: 'CHECKUP', date: checkup.record.date },
        ...afp.map(record => ({ id: record.id, kind: 'AFP', date: record.date })),
        ...ultrasound.map(record => ({ id: record.id, kind: 'ULTRASOUND', date: record.date })),
      ],
      presentationId: HCC_PRESENTATION.id,
      diagnosisOrigin: 'PRESENTATION_SETUP',
    },
    recordContext: 'SYNTHETIC_SCENARIO_ONLY', scenarioVersion: SYNTHETIC_HEALTH_VERSION,
    scenarioDiagnosisOrigin: HCC_PRESENTATION.diagnosisOrigin,
    synthetic: true, generationUsed: false, medicalContentGeneration: false, clinicalUse: false,
  };
}
