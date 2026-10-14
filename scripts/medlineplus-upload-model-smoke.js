import {performance} from 'node:perf_hooks';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {educationPayload,sourceGuidanceFromEvidence} from '../src/health-helper-medlineplus.js';
import {generateCandidateAnswer} from '../src/health-helper-candidate-generation.js';

const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
const cases={
 'candidate-held-a1c-concept':{question:'A1C는 무엇인가요?',topic:'6308',intent:'UNDERSTAND',focus:'DEFINITION',sourceQa:'HOLD',answerAnchors:['혈액검사입니다']},
 'candidate-held-a1c-definition-colloquial':{question:'당화혈색소 검사 뜻이 뭐예요?',topic:'6308',intent:'UNDERSTAND',focus:'DEFINITION',sourceQa:'HOLD',answerAnchors:['혈액검사입니다']},
 'candidate-held-arthritis-concept':{question:'관절염이란 무엇인가요?',topic:'23',intent:'UNDERSTAND',focus:'DEFINITION',sourceQa:'HOLD',answerAnchors:['관절에 영향을 미치는 모든 장애']},
 'candidate-anemia-symptoms':{question:'빈혈 증상은 어떤가요?',topic:'139',intent:'SYMPTOMS',answerAnchors:['피곤하거나 춥고']},
 'candidate-anemia-fatigue-colloquial':{question:'빈혈이면 쉽게 피곤해지나요?',topic:'139',intent:'SYMPTOMS',answerAnchors:['피곤하거나 춥고']},
 'candidate-anemia-dizziness-colloquial':{question:'빈혈 때문에 어지러울 수 있나요?',topic:'139',intent:'SYMPTOMS',answerAnchors:['어지럽거나 짜증이 날 수 있습니다']},
 'candidate-anemia-cause-colloquial':{question:'빈혈은 왜 생겨요?',topic:'139',intent:'CAUSES',answerAnchors:['가장 흔한 원인은 철분 부족']},
 'candidate-anemia-cause-reason-colloquial':{question:'빈혈이 생기는 이유가 뭐예요?',topic:'139',intent:'CAUSES',answerAnchors:['가장 흔한 원인은 철분 부족']},
 'candidate-ct-preparation':{question:'CT 검사 전에 의료진에게 질문할 내용을 준비하고 싶어요',topic:'3951',intent:'PREPARE',answerAnchors:['의료진에게 물어보세요']},
 'candidate-ct-fasting':{question:'CT 검사 전에 금식해야 하나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-contrast-purpose':{question:'CT 전에 조영제를 왜 써요?',topic:'3951',intent:'CAUSES',focus:'CONTRAST',answerAnchors:['더 선명하게 보이도록 돕습니다']},
 'candidate-ct-fasting-colloquial':{question:'CT 찍기 전에 물이나 음식을 먹어도 되나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-water-colloquial':{question:'CT 찍기 전에 물 마셔도 되나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-before-water-colloquial':{question:'CT 전에 물을 마셔도 되나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-before-meal-colloquial':{question:'CT 전에 밥 먹어도 되나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-pregnancy':{question:'CT 검사 전에 임신 사실을 의료진에게 알려야 하나요?',topic:'3951',intent:'PREPARE',focus:'PREGNANCY',answerAnchors:['임신했을 가능성이 있다고 생각하면 반드시 의료진에게 알리세요']},
 'candidate-ct-pregnancy-colloquial':{question:'CT 촬영할 때 임신했을 수도 있으면 의료진에게 알려야 하나요?',topic:'3951',intent:'PREPARE',focus:'PREGNANCY',answerAnchors:['임신했을 가능성이 있다고 생각하면 반드시 의료진에게 알리세요']},
 'candidate-ct-radiation':{question:'CT는 방사선을 사용하나요?',topic:'3951',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['전리방사선']},
 'candidate-ct-cross-section-lexical':{question:'몸을 얇은 단면 영상으로 보여주는 검사는 무엇인가요?',topic:'3951',intent:'UNDERSTAND',answerAnchors:['CT 검사는 몸을 얇게 잘라 놓은 것과 같은 단면 영상을 만듭니다.']},
 'candidate-ct-radiation-pregnancy':{question:'CT 방사선과 임신 관련 안내를 알려 주세요',topic:'3951',intent:'UNDERSTAND',focuses:['RADIATION','PREGNANCY'],answerAnchors:['전리방사선','임신']},
 'candidate-mri-metal':{question:'MRI 장비의 강한 자석과 금속 물체는 어떤 영향을 줄 수 있나요?',topic:'3953',intent:'UNDERSTAND',focus:'MRI_METAL_SAFETY',answerAnchors:['금속 물체나 삽입물은 검사를 방해']},
 'candidate-mri-metal-safety-paraphrase':{question:'MRI 촬영 시 금속 물건이 문제를 일으키나요?',topic:'3953',intent:'UNDERSTAND',focus:'MRI_METAL_SAFETY',answerAnchors:['금속 물체나 삽입물은 검사를 방해']},
 'candidate-mri-jewelry-removal':{question:'MRI 전에 장신구를 제거해야 하나요?',topic:'3953',intent:'PREPARE',focus:'MRI_JEWELRY_REMOVAL'},
 'candidate-mri-earring-removal':{question:'MRI 촬영 때 귀걸이는 빼야 해요?',topic:'3953',intent:'PREPARE',focus:'MRI_JEWELRY_REMOVAL'},
 'candidate-mri-device-disclosure':{question:'MRI 전에 심박조율기가 있으면 의료진에게 알려야 하나요?',topic:'3953',intent:'PREPARE',focus:'MRI_DEVICE_DISCLOSURE'},
 'candidate-mri-radiation':{question:'MRI는 방사선을 사용하나요?',topic:'3953',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['MRI는 엑스선이나 다른 방사선을 사용하지 않습니다']},
 'candidate-mri-magnets-radio-lexical':{question:'몸속의 상세한 영상을 만들 때 자석과 전파를 이용하는 검사는 무엇인가요?',topic:'3953',intent:'UNDERSTAND',answerAnchors:['자석, 전파, 컴퓨터를 이용해 몸속의 상세한 영상을 만드는 영상검사입니다.']},
 'candidate-xray-radiation':{question:'X선 검사는 방사선을 사용하나요?',topic:'3949',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['소량의 방사선을 몸에 통과시켜']},
 'candidate-xray-low-radiation-lexical':{question:'적은 양의 방사선을 몸에 통과시켜 뼈 영상을 만드는 검사는 무엇인가요?',topic:'3949',intent:'UNDERSTAND',answerAnchors:['소량의 방사선을 몸에 통과시켜 뼈와 장기의 영상을 만듭니다.']},
 'candidate-kidney-filtration-lexical':{question:'노폐물과 여분의 물을 걸러 소변을 만드는 기관은 무엇인가요?',topic:'4889',intent:'UNDERSTAND',answerAnchors:['신장은 혈액에서 노폐물과 여분의 물을 걸러 소변을 만듭니다.']},
 'candidate-adenoid-location-lexical':{question:'코 바로 뒤 목 위쪽에 있는 조직 덩어리는 무엇인가요?',topic:'1515',intent:'UNDERSTAND',answerAnchors:['아데노이드는 코 바로 뒤, 목의 위쪽에 있는 조직 덩어리입니다.']},
 'candidate-pus-composition-lexical':{question:'백혈구와 병원체, 죽은 조직이 함께 섞인 것은 무엇인가요?',topic:'3063',intent:'UNDERSTAND',answerAnchors:['고름은 살아 있는 백혈구와 죽은 백혈구, 병원체, 죽은 조직이 섞인 것입니다.']},
 'candidate-amino-acid-building-block-lexical':{question:'단백질을 형성하는 기본 구성 요소는 무엇인가요?',topic:'6385',intent:'UNDERSTAND',answerAnchors:['아미노산은 서로 결합해 단백질을 형성하는 ‘구성 요소’입니다.']},
 'candidate-allergy-immune-response-lexical':{question:'대부분 사람에게 문제가 되지 않는 것에 면역계가 반응하는 현상을 무엇이라 하나요?',topic:'24',intent:'UNDERSTAND',answerAnchors:['알레르기는 다른 사람 대부분에게는 문제가 되지 않는 것에 면역계가 반응하는 것입니다.']},
 'candidate-antioxidant-description-lexical':{question:'세포 손상을 예방하거나 늦출 수 있는 천연 또는 인공 물질은 무엇인가요?',topic:'1590',intent:'UNDERSTAND',answerAnchors:['항산화제는 일부 유형의 세포 손상을 예방하거나 늦출 수 있는 인공 또는 천연 물질입니다.']},
 'candidate-allergy-cause-paraphrase':{question:'알레르기가 생기는 이유는 무엇인가요?',topic:'24',intent:'CAUSES',focus:'ALLERGY_CAUSE',answerAnchors:['유전자와 환경이 모두 영향을 줄 것으로 여겨집니다.']},
};
const queryCase=process.argv[2]??'candidate-anemia-symptoms',selected=cases[queryCase];
if(!selected)throw Error('UNKNOWN_SYNTHETIC_QUERY_CASE');
const retrieval=retrieveUploadedEvidence(selected.question,corpus);
if(retrieval.status!=='CANDIDATE'||retrieval.topic!==selected.topic||retrieval.intent!==selected.intent
 ||selected.focus&&!retrieval.focus?.includes(selected.focus)
 ||selected.focuses&&!selected.focuses.every(focus=>retrieval.focus?.includes(focus)))
 throw Error('SYNTHETIC_RETRIEVAL_PRECONDITION_FAILED');
if(selected.sourceQa&&!retrieval.evidence.every(chunk=>chunk.ai_qa_status===selected.sourceQa))throw Error('SYNTHETIC_SOURCE_QA_PRECONDITION_FAILED');
if(retrieval.extractiveOnly){
 const guidance=sourceGuidanceFromEvidence(retrieval),components=retrieval.evidence[0].sourceComponents??[];
 const structuredListMatches=guidance.sources.length===1&&components.length===2
  &&guidance.sources[0].listContexts?.some(context=>context.heading===components[0].text_ko
   &&context.items.includes(components[1].text_ko))===true&&!Object.hasOwn(guidance.sources[0],'excerpt');
 if(guidance.status!=='SOURCE_GUIDANCE'||guidance.generationUsed!==false||!structuredListMatches)
  throw Error('SYNTHETIC_SOURCE_GUIDANCE_PRECONDITION_FAILED');
 process.stdout.write(`${JSON.stringify({result:'PASS',corpusVersion:corpus.version,indexScope:corpus.indexScope,indexedDocuments:corpus.indexedDocuments,queryCase,
  responseMode:'SOURCE_GUIDANCE_LIST_CONTEXT',modelInvocation:'NOT_PERFORMED',sourceCount:guidance.sources.length,
  structuredListMatches:true,composedExcerptReturned:false,focus:selected.focus??selected.focuses??null,clinicalUse:false,serviceEligible:false})}\n`);
 process.exit(0);
}
const groundedRetrieval={...retrieval,claimEvidenceRequired:true};
const payload=educationPayload(groundedRetrieval);
const userContent=JSON.parse(payload.messages.find(message=>message.role==='user').content);
if(Object.keys(userContent).sort().join(',')!=='evidence,focus,focusEvidence,intent,topic')throw Error('RAW_QUESTION_FIELD_PRESENT');

const started=performance.now();
let outputDiagnostic=null;
try{
 const output=await generateCandidateAnswer(groundedRetrieval,{signal:AbortSignal.timeout(120000)});
 const missingAnswerAnchors=(selected.answerAnchors??[]).filter(anchor=>!output.answer.includes(anchor));
 outputDiagnostic={answerAnchorCoverage:{required:selected.answerAnchors??[],missing:missingAnswerAnchors}};
 if(missingAnswerAnchors.length){const error=new Error('SYNTHETIC_ANSWER_ANCHOR_MISSING');error.validationFailureCodes=['ANSWER_ANCHOR_MISSING'];throw error;}
 const sourceExcerptMatchesClaim=output.sources.length===1&&output.sources[0].excerpt===output.answer;
 if(!sourceExcerptMatchesClaim)throw Error('SOURCE_EXCERPT_NOT_CLAIM_MAPPED');
 if(selected.sourceQa&&!output.sources.every(source=>source.contextNote?.includes('QA HOLD')))throw Error('SOURCE_QA_STATE_NOT_DISPLAYED');
 process.stdout.write(`${JSON.stringify({result:'PASS',corpusVersion:corpus.version,indexScope:corpus.indexScope,indexedDocuments:corpus.indexedDocuments,queryCase,sourceQa:selected.sourceQa??null,
  generatedClaimCount:output.claimEvidence.length,serverDerivedFromEvidence:true,sourceCount:output.sources.length,
  focus:selected.focus??selected.focuses??null,answerAnchorCoverage:true,sourceExcerptMatchesClaim,rawQuestionFieldExcluded:true,elapsedMs:Math.round(performance.now()-started),
  semanticGrounding:'NOT_PROVEN',clinicalUse:false,serviceEligible:false})}\n`);
}catch(error){
 process.stdout.write(`${JSON.stringify({result:'FAIL',reason:error.message,validationFailureCodes:error.validationFailureCodes??(error.reasonCode?[error.reasonCode]:[]),outputDiagnostic,elapsedMs:Math.round(performance.now()-started),
  modelInvocation:'ATTEMPTED',clinicalUse:false,serviceEligible:false})}\n`);
 process.exitCode=1;
}
