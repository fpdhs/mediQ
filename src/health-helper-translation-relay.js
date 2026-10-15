import {educationPayload} from './health-helper-medlineplus.js';

export function validateTranslationRelayPayload(payload){
 const invalid=()=>{throw Error('TRANSLATION_RELAY_INPUT_INVALID');};
 if(!payload||Object.keys(payload).sort().join(',')!=='format,keep_alive,messages,model,options,stream,think'
  ||payload.model!=='qwen3.5:4b'||payload.stream!==false||payload.think!==false||payload.keep_alive!=='30m'
  ||!Array.isArray(payload.messages)||payload.messages.length!==2
  ||payload.messages[0].role!=='system'||payload.messages[1].role!=='user')invalid();
 let input;try{input=JSON.parse(payload.messages[1].content);}catch{invalid();}
 if(!input||Object.keys(input).sort().join(',')!=='evidence,focus,focusEvidence,intent,topic'
  ||typeof input.topic!=='string'||input.topic.length>160||!['UNDERSTAND','PREPARE','COMPARE','MULTI_INTENT','PURPOSE','LIMITATIONS','SYMPTOMS','CAUSES'].includes(input.intent)
  ||!Array.isArray(input.evidence)||input.evidence.length<1||input.evidence.length>3)invalid();
 for(const [i,e] of input.evidence.entries()){
  if(Object.keys(e).sort().join(',')!=='id,sentences'||e.id!==`E${i+1}`||!Array.isArray(e.sentences)||!e.sentences.length||e.sentences.length>12)invalid();
  for(const [index,s] of e.sentences.entries())if(Object.keys(s).sort().join(',')!=='index,text'||s.index!==index
   ||typeof s.text!=='string'||s.text.length>3000||!/[가-힣]/u.test(s.text)||/[<>\u0000-\u0008]/u.test(s.text))invalid();
 }
 if(!Array.isArray(input.focus)||input.focus.some(f=>typeof f!=='string')||input.focus.length>8
  ||!input.focusEvidence||typeof input.focusEvidence!=='object'||Array.isArray(input.focusEvidence))invalid();
 for(const [focus,refs] of Object.entries(input.focusEvidence)){
  if(!/^[A-Z_]{1,60}$/u.test(focus)||!Array.isArray(refs))invalid();
  for(const ref of refs){const e=input.evidence.find(e=>e.id===ref.evidenceId);
   if(Object.keys(ref).sort().join(',')!=='evidenceId,sentenceIndex'||!e||!Number.isInteger(ref.sentenceIndex)||!e.sentences[ref.sentenceIndex])invalid();}
 }
 const expected=educationPayload({status:'CANDIDATE',intent:input.intent,claimEvidenceRequired:true,focus:[],evidence:[{title_ko:input.topic,text_ko:'합성 검증 문장입니다.'}]});
 if(payload.messages[0].content!==expected.messages[0].content||JSON.stringify(payload.format)!==JSON.stringify(expected.format)
  ||JSON.stringify(payload.options)!==JSON.stringify(expected.options))invalid();
 return payload;
}
