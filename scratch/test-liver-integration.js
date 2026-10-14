import {retrieveLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {createPatientTranslationRag} from '../src/health-helper-patient-translation.js';

process.env.HIPASS_HEALTH_HELPER_TRANSLATION_RAG = 'school-demo';
process.env.HIPASS_CAPSTONE_MAIN_SCENARIO = 'HCC';

const rag = await createPatientTranslationRag();

console.log('--- Testing Current Rag for AST ---');
const resCurrent = await rag('AST: 이 검사는 무엇을 확인하나요?', {});
console.log('Current status:', resCurrent.status);
console.log('Current answer:', resCurrent.answer);

console.log('\n--- Testing retrieveLiverFunctionEvidence ---');
const liverRes = retrieveLiverFunctionEvidence('AST: 이 검사는 무엇을 확인하나요?');
console.log('Liver evidence status:', liverRes.status);
console.log('Liver evidence text:', liverRes.evidence?.[0]?.text_ko);
console.log('Liver evidence question template:', liverRes.questionTemplate);
