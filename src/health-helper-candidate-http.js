import {generateCandidateAnswer} from './health-helper-candidate-generation.js';
import {sourceGuidanceFromEvidence} from './health-helper-medlineplus.js';

// Each preview owns its admission state; injection is for tests, never an HTTP option.
export function createCandidateQuestionHandler({expectedHost,expectedOrigin,retrieveEvidence,
  allowSourceFallback=false,modelTimeoutMs=120000,insufficientAnswer,
  generateAnswer=generateCandidateAnswer,now=Date.now}){
 let active=false,calls=[];
 return async(req,res,sendResponse)=>{
  const send=(...args)=>{if(!res.destroyed&&!res.writableEnded)sendResponse(...args);};
  if(req.headers.host!==expectedHost)return send(403,{error:'HOST_REJECTED'});
  if(req.headers.origin!==expectedOrigin||req.headers['content-type']!=='application/json')
   return send(403,{error:'ORIGIN_REJECTED'});
  if(active)return send(429,{error:'BUSY'});
  try{
   let bytes=0;const parts=[];
   for await(const part of req.iterator({destroyOnReturn:false})){
    bytes+=part.length;if(bytes>4096)throw Error('INPUT_TOO_LARGE');parts.push(part);
   }
   const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts)));
   if(!body||Object.keys(body).join(',')!=='question')throw Error('INVALID_BODY');
   const retrieval=await retrieveEvidence(body.question);
   if(allowSourceFallback&&retrieval.status==='CANDIDATE'&&!retrieval.extractiveOnly)retrieval.claimEvidenceRequired=true;
   if(retrieval.status==='SOURCE_ON_HOLD')return send(200,{status:'SOURCE_GUIDANCE',generationUsed:false,
    answer:'이 주제의 자료는 등록되어 있지만 내용 검토가 보류되어 AI 설명 근거로 사용하지 않습니다. 아래 원문을 직접 확인하거나 의료진에게 문의해 주세요.',questions:[],
    sources:retrieval.heldSources.map(d=>({id:d.id,url:d.url,title:d.title,institution:'MedlinePlus · 미국 국립의학도서관',section:'Health Topics 요약 · HOLD',
     contextNote:'등록된 보류 자료 · AI 답변 근거로 사용 안 함',licenseLabel:'Source: MedlinePlus, National Library of Medicine.',licenseUrl:'https://medlineplus.gov/about/using/usingcontent/'}))});
   if(retrieval.status!=='CANDIDATE')return send(200,{status:retrieval.status,answer:insufficientAnswer({...retrieval,question:body.question}),
    sources:[],questions:[],generationUsed:false,recordContext:'NOT_CONNECTED'});
   if(retrieval.extractiveOnly){
   const result=sourceGuidanceFromEvidence(retrieval),hasListContext=result.sources.some(source=>source.listContexts?.length>0);
    return send(200,{...result,contextTopic:retrieval.evidence[0].title_ko,questionOrigin:'PROJECT_TEMPLATE',
     ...(hasListContext?{answer:'질문과 관련된 목록 안내와 항목을 번역 후보로 나누어 표시합니다. 본인에게 적용되는지는 의료진에게 확인해 주세요.'}:{}),
     questions:retrieval.sourceLookupOnly?[]:retrieval.questionTemplate?[retrieval.questionTemplate]:result.questions,
     responseMode:retrieval.sourceLookupOnly?'SOURCE_LOOKUP_ONLY':hasListContext?'SOURCE_GUIDANCE_LIST_CONTEXT':'SOURCE_GUIDANCE',
     recordContext:'NOT_CONNECTED'});
   }
   if(res.destroyed)return;
   // Recheck after asynchronous body reading/retrieval before acquiring the slot.
   if(active)return send(429,{error:'BUSY'});
   calls=calls.filter(time=>now()-time<60000);
   if(calls.length>=5)return send(429,{error:'RATE_LIMITED'});
   active=true;calls.push(now());
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(new DOMException('Model deadline exceeded','TimeoutError')),modelTimeoutMs);
   const onClose=()=>controller.abort();res.once('close',onClose);
   try{
    const answer=await generateAnswer(retrieval,{signal:controller.signal});
    send(200,{...answer,contextTopic:retrieval.evidence[0].title_ko});
   }catch{
    if(res.destroyed)return;
    if(allowSourceFallback&&retrieval.claimEvidenceRequired){
     try{return send(200,{...sourceGuidanceFromEvidence(retrieval),contextTopic:retrieval.evidence[0].title_ko});}catch{/* Fail closed below. */}
    }
    send(503,{error:'MODEL_UNAVAILABLE_OR_OUTPUT_REJECTED'});
   }finally{clearTimeout(timer);res.off('close',onClose);active=false;}
  }catch{req.resume();send(400,{error:'INVALID_INPUT'});}
 };
}
