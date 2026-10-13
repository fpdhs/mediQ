import {performance} from 'node:perf_hooks';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {educationPayload,sourceGuidanceFromEvidence,validateEducationOutput} from '../src/health-helper-medlineplus.js';

const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url));
const cases={
 'candidate-anemia-symptoms':{question:'빈혈 증상은 어떤가요?',topic:'139',intent:'SYMPTOMS',answerAnchors:['피곤하거나 춥고']},
 'candidate-ct-preparation':{question:'CT 검사 전에 의료진에게 질문할 내용을 준비하고 싶어요',topic:'3951',intent:'PREPARE',answerAnchors:['의료진에게 물어보세요']},
 'candidate-ct-fasting':{question:'CT 검사 전에 금식해야 하나요?',topic:'3951',intent:'PREPARE',focus:'FASTING',answerAnchors:['음식이나 음료를 섭취하지 말라는 안내']},
 'candidate-ct-pregnancy':{question:'CT 검사 전에 임신 사실을 의료진에게 알려야 하나요?',topic:'3951',intent:'PREPARE',focus:'PREGNANCY',answerAnchors:['임신했을 가능성이 있다고 생각하면 반드시 의료진에게 알리세요']},
 'candidate-ct-radiation':{question:'CT는 방사선을 사용하나요?',topic:'3951',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['전리방사선']},
 'candidate-ct-radiation-pregnancy':{question:'CT 방사선과 임신 관련 안내를 알려 주세요',topic:'3951',intent:'UNDERSTAND',focuses:['RADIATION','PREGNANCY'],answerAnchors:['전리방사선','임신']},
 'candidate-mri-metal':{question:'MRI 장비의 강한 자석과 금속 물체는 어떤 영향을 줄 수 있나요?',topic:'3953',intent:'UNDERSTAND',focus:'MRI_METAL_SAFETY',answerAnchors:['금속 물체나 삽입물은 검사를 방해']},
 'candidate-mri-jewelry-removal':{question:'MRI 전에 장신구를 제거해야 하나요?',topic:'3953',intent:'PREPARE',focus:'MRI_JEWELRY_REMOVAL'},
 'candidate-mri-device-disclosure':{question:'MRI 전에 심박조율기가 있으면 의료진에게 알려야 하나요?',topic:'3953',intent:'PREPARE',focus:'MRI_DEVICE_DISCLOSURE'},
 'candidate-mri-radiation':{question:'MRI는 방사선을 사용하나요?',topic:'3953',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['MRI는 엑스선이나 다른 방사선을 사용하지 않습니다']},
 'candidate-xray-radiation':{question:'X선 검사는 방사선을 사용하나요?',topic:'3949',intent:'UNDERSTAND',focus:'RADIATION',answerAnchors:['소량의 방사선을 몸에 통과시켜']},
};
const queryCase=process.argv[2]??'candidate-anemia-symptoms',selected=cases[queryCase];
if(!selected)throw Error('UNKNOWN_SYNTHETIC_QUERY_CASE');
const retrieval=retrieveUploadedEvidence(selected.question,corpus);
if(retrieval.status!=='CANDIDATE'||retrieval.topic!==selected.topic||retrieval.intent!==selected.intent
 ||selected.focus&&!retrieval.focus?.includes(selected.focus)
 ||selected.focuses&&!selected.focuses.every(focus=>retrieval.focus?.includes(focus)))
 throw Error('SYNTHETIC_RETRIEVAL_PRECONDITION_FAILED');
if(retrieval.extractiveOnly){
 const guidance=sourceGuidanceFromEvidence(retrieval),components=retrieval.evidence[0].sourceComponents??[];
 const structuredListMatches=guidance.sources.length===1&&components.length===2
  &&guidance.sources[0].listContexts?.some(context=>context.heading===components[0].text_ko
   &&context.items.includes(components[1].text_ko))===true&&!Object.hasOwn(guidance.sources[0],'excerpt');
 if(guidance.status!=='SOURCE_GUIDANCE'||guidance.generationUsed!==false||!structuredListMatches)
  throw Error('SYNTHETIC_SOURCE_GUIDANCE_PRECONDITION_FAILED');
 process.stdout.write(`${JSON.stringify({result:'PASS',corpusVersion:corpus.version,queryCase,
  responseMode:'SOURCE_GUIDANCE_LIST_CONTEXT',modelInvocation:'NOT_PERFORMED',sourceCount:guidance.sources.length,
  structuredListMatches:true,composedExcerptReturned:false,focus:selected.focus??selected.focuses??null,clinicalUse:false,serviceEligible:false})}\n`);
 process.exit(0);
}
const groundedRetrieval={...retrieval,claimEvidenceRequired:true};
const payload=educationPayload(groundedRetrieval);
const userContent=JSON.parse(payload.messages.find(message=>message.role==='user').content);
if(Object.keys(userContent).sort().join(',')!=='evidence,focus,focusEvidence,intent,topic')throw Error('RAW_QUESTION_FIELD_PRESENT');

function validationFailureCodes(value){
 const codes=[];
 if(!value||Object.keys(value).sort().join(',')!=='claimEvidence,evidenceIds')codes.push('ROOT_SCHEMA');
 if(!Array.isArray(value?.evidenceIds)||!value.evidenceIds.length||value.evidenceIds.length>3)codes.push('EVIDENCE_ID_LIST');
 if(Object.hasOwn(value??{},'questions'))codes.push('UNEXPECTED_MODEL_QUESTION');
 if(!Array.isArray(value?.claimEvidence)||value.claimEvidence.length!==1)codes.push('CLAIM_EVIDENCE_LIST');
 const selectedSentenceCount=Array.isArray(value?.claimEvidence)?value.claimEvidence.reduce((count,claim)=>
  count+(Array.isArray(claim?.sentenceIndexes)?claim.sentenceIndexes.length:0),0):0;
 if(selectedSentenceCount>2)codes.push('ANSWER_SENTENCE_LIMIT');
 const derivedSentences=[];
 if(Array.isArray(value?.claimEvidence)){
  for(const claim of value.claimEvidence){
   if(!claim||Object.keys(claim).sort().join(',')!=='evidenceId,sentenceIndexes'
    ||typeof claim.evidenceId!=='string'||!/^E[1-3]$/u.test(claim.evidenceId)
    ||!Array.isArray(claim.sentenceIndexes)||claim.sentenceIndexes.length<1||claim.sentenceIndexes.length>2
    ||claim.sentenceIndexes.some(index=>!Number.isInteger(index)||index<0)){codes.push('CLAIM_SCHEMA');continue;}
   const index=Number(claim.evidenceId.slice(1))-1,source=groundedRetrieval.evidence[index];
   const sourceSentences=source?.text_ko.match(/[^.!?。！？]+[.!?。！？]+/gu)??[];
   if(!source||claim.sentenceIndexes.some(sentenceIndex=>sentenceIndex>=sourceSentences.length))codes.push('SENTENCE_INDEX_OUT_OF_RANGE');
   if(Array.isArray(source?.allowedSentenceIndexes)&&claim.sentenceIndexes.some(sentenceIndex=>!source.allowedSentenceIndexes.includes(sentenceIndex)))
    codes.push('SENTENCE_INDEX_NOT_ALLOWED_FOR_RETRIEVAL');
   if(claim.sentenceIndexes.some((sentenceIndex,offset)=>offset>0&&sentenceIndex!==claim.sentenceIndexes[offset-1]+1))
    codes.push('SENTENCE_INDEX_NOT_CONSECUTIVE');
   if(!value.evidenceIds?.includes(claim.evidenceId))codes.push('CLAIM_EVIDENCE_ID_NOT_CITED');
   if(source&&claim.sentenceIndexes.every(sentenceIndex=>sentenceIndex<sourceSentences.length))
    derivedSentences.push(...claim.sentenceIndexes.map(sentenceIndex=>sourceSentences[sentenceIndex].trim()));
  }
 }
 for(const focus of groundedRetrieval.focus??[]){
  const covered=Array.isArray(value?.claimEvidence)&&value.claimEvidence.some(claim=>{
   const index=Number(String(claim?.evidenceId??'').slice(1))-1,source=groundedRetrieval.evidence[index];
   return Array.isArray(claim?.sentenceIndexes)&&claim.sentenceIndexes.some(sentenceIndex=>source?.focusSentenceIndexes?.[focus]?.includes(sentenceIndex));
  });
  if(!covered)codes.push('FOCUS_NOT_COVERED');
 }
 const answer=derivedSentences.join(' ');
 if(answer.length<20||answer.length>1000)codes.push('DERIVED_ANSWER_LENGTH');
 if(/[<>\d\u0000-\u001f]|https?:|www\.|복용하세요|처방|확진|암입니다|수술하세요|치료하세요|대비\s*물질/u.test(answer))codes.push('DERIVED_ANSWER_UNSAFE');
 return [...new Set(codes)];
}

const started=performance.now();
let outputDiagnostic=null;
try{
 const response=await fetch('http://127.0.0.1:11434/api/chat',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(120000),redirect:'error'});
 if(!response.ok)throw Error('MODEL_HTTP_ERROR');
 const result=await response.json();
 if(result.done!==true||result.done_reason!=='stop'||typeof result.message?.content!=='string')throw Error('MODEL_RESPONSE_INCOMPLETE');
 const value=JSON.parse(result.message.content);
 outputDiagnostic={unexpectedAnswerField:Object.hasOwn(value,'answer'),claimEvidenceCount:Array.isArray(value.claimEvidence)?value.claimEvidence.length:null,
  unexpectedModelQuestion:Object.hasOwn(value,'questions'),
  selectedSentenceCount:Array.isArray(value.claimEvidence)?value.claimEvidence.reduce((count,claim)=>count+(Array.isArray(claim.sentenceIndexes)?claim.sentenceIndexes.length:0),0):null,
  selectorShapeValid:Array.isArray(value.claimEvidence)&&value.claimEvidence.every(claim=>Array.isArray(claim.sentenceIndexes)),
  evidenceIds:value.evidenceIds??null,claimEvidence:value.claimEvidence??null,evidenceCount:groundedRetrieval.evidence.length};
 let output;
 try{output=validateEducationOutput(value,groundedRetrieval);}
 catch(error){error.validationFailureCodes=validationFailureCodes(value);throw error;}
 const missingAnswerAnchors=(selected.answerAnchors??[]).filter(anchor=>!output.answer.includes(anchor));
 outputDiagnostic.answerAnchorCoverage={required:selected.answerAnchors??[],missing:missingAnswerAnchors};
 if(missingAnswerAnchors.length){const error=new Error('SYNTHETIC_ANSWER_ANCHOR_MISSING');error.validationFailureCodes=['ANSWER_ANCHOR_MISSING'];throw error;}
 process.stdout.write(`${JSON.stringify({result:'PASS',corpusVersion:corpus.version,queryCase,
  generatedClaimCount:output.claimEvidence.length,serverDerivedFromEvidence:true,sourceCount:output.sources.length,
  focus:selected.focus??selected.focuses??null,answerAnchorCoverage:true,rawQuestionFieldExcluded:true,elapsedMs:Math.round(performance.now()-started),
  semanticGrounding:'NOT_PROVEN',clinicalUse:false,serviceEligible:false})}\n`);
}catch(error){
 process.stdout.write(`${JSON.stringify({result:'FAIL',reason:error.message,validationFailureCodes:error.validationFailureCodes??[],outputDiagnostic,elapsedMs:Math.round(performance.now()-started),
  modelInvocation:'ATTEMPTED',clinicalUse:false,serviceEligible:false})}\n`);
 process.exitCode=1;
}
