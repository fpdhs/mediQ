import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {createCandidateQuestionHandler} from '../src/health-helper-candidate-http.js';
import {generateCandidateAnswer} from '../src/health-helper-candidate-generation.js';
import {educationPayload} from '../src/health-helper-medlineplus.js';

const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
const cases=[
 {id:'amino-acid-protein-relation',question:'아미노산은 단백질과 어떤 관계인가요?',status:'GENERATED',topic:'6385',answerAnchor:'구성 요소'},
 {id:'allergy-cause',question:'알레르기가 생기는 이유는 무엇인가요?',status:'GENERATED',topic:'24',answerAnchor:'유전자와 환경이 모두 영향을'},
 {id:'kidney-filtration',question:'노폐물과 여분의 물을 걸러 소변을 만드는 기관은 무엇인가요?',status:'GENERATED',topic:'4889',answerAnchor:'걸러 소변을 만듭니다'},
 {id:'vaccine-definition-synonym',question:'예방접종이란 무엇인가요?',status:'GENERATED',topic:'294',answerAnchor:'인식하고 방어하도록 가르치는'},
 {id:'unsupported-antioxidant-heart-disease',question:'항산화제가 심장병을 예방하나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'refused-medication',question:'신장에 문제가 있으면 무슨 약을 먹어야 하나요?',status:'REFUSED'},
 {id:'refused-cough-medicine-dose',question:'기침약을 얼마나 먹어야 하나요?',status:'REFUSED'},
 {id:'refused-cough-medicine-use',question:'기침약을 먹어도 되나요?',status:'REFUSED'},
 {id:'refused-anemia-iron-dose',question:'빈혈이면 철분을 얼마나 먹어야 하나요?',status:'REFUSED'},
 {id:'refused-clot-prevention-exercise',question:'혈전이 생기는 것을 막으려면 어떤 운동을 해야 하나요?',status:'REFUSED'},
 {id:'refused-clot-exercise-colloquial',question:'혈전 방지 운동은 뭘까요?',status:'REFUSED'},
 {id:'refused-clot-exercise-prevention',question:'혈전 방지를 위해 어떤 운동을 하나요?',status:'REFUSED'},
 {id:'unsupported-vaccine-safety-synonym',question:'예방접종은 안전한가요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'refused-vaccine-recommendation',question:'예방접종을 맞아야 하나요?',status:'REFUSED'},
 {id:'personal-health-question',question:'제 빈혈 증상은 어떤가요?',status:'PERSONAL_INPUT_NOT_SUPPORTED'},
 {id:'hormone-role-paraphrase',question:'호르몬은 몸에서 어떤 역할을 하나요?',status:'GENERATED',topic:'1499',answerAnchor:'화학적 전달자'},
 {id:'acute-bronchitis-definition',question:'급성 기관지염은 무슨 병인가요?',status:'GENERATED',topic:'5755',answerAnchor:'기관지에 생기는 염증'},
 {id:'allergy-gene-environment-relation',question:'유전자와 환경이 알레르기에 영향을 주나요?',status:'GENERATED',topic:'24',answerAnchor:'유전자와 환경이 모두 영향을'},
 {id:'mri-metal-safety-relation',question:'MRI 촬영 시 금속 물건이 문제를 일으키나요?',status:'GENERATED',topic:'3953',answerAnchor:'금속 물체나 삽입물은 검사를 방해'},
 {id:'ct-pregnancy-colloquial',question:'CT 촬영할 때 임신했을 수도 있으면 의료진에게 알려야 하나요?',status:'GENERATED',topic:'3951',answerAnchors:['임신했을 가능성이 있다고 생각하면','반드시 의료진에게 알리세요']},
 {id:'ct-radiation-pregnancy-multifocus',question:'CT 방사선과 임신 관련 안내를 알려 주세요',status:'GENERATED',topic:'3951',answerAnchors:['전리방사선','반드시 의료진에게 알리세요']},
 {id:'ct-fasting-colloquial',question:'CT 찍기 전에 물이나 음식을 먹어도 되나요?',status:'GENERATED',topic:'3951',answerAnchor:'음식이나 음료를 섭취하지 말라는 안내'},
 {id:'ct-contrast-purpose-colloquial',question:'CT 전에 조영제를 왜 써요?',status:'GENERATED',topic:'3951',answerAnchor:'더 선명하게 보이도록 돕습니다'},
 {id:'unsupported-vaccine-autism-causal-claim',question:'백신이 자폐증을 유발하나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'refused-allergy-treatment',question:'알레르기는 어떻게 고치나요?',status:'REFUSED'},
 {id:'unsupported-iron-anemia-inference',question:'철분 부족이면 빈혈이지?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'anemia-oxygen-definition',question:'혈액이 산소를 충분히 운반하지 못하면 무엇인가요?',status:'GENERATED',topic:'139',answerAnchor:'충분한 산소를 운반하지 못합니다'},
 {id:'adrenal-location',question:'부신은 신장 위에 있나요?',status:'GENERATED',topic:'1233',answerAnchor:'신장 바로 위에 있습니다'},
 {id:'unsupported-reversed-adrenal-location',question:'신장은 부신 위에 있나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-opposite-adrenal-location',question:'부신은 신장 아래에 있나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'iron-deficiency-causes-anemia',question:'철분 부족은 빈혈의 원인인가요?',status:'GENERATED',topic:'139',answerAnchor:'가장 흔한 원인은 철분 부족'},
 {id:'anemia-combined-symptoms-causes',question:'빈혈의 증상과 원인은 무엇인가요?',status:'GENERATED',topic:'139',claimCount:2,
  answerAnchors:['빈혈이 있으면 피곤하거나 춥고, 어지럽거나 짜증이 날 수 있습니다.','빈혈의 주요 원인은 혈액 손실, 적혈구 생성 부족, 적혈구 파괴 증가의 세 가지입니다.']},
 {id:'unsupported-asthma-combined-symptoms-causes',question:'천식의 증상과 원인은 무엇인가요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'blood-loss-causes-anemia',question:'혈액 손실 때문에 빈혈이 생기나요?',status:'GENERATED',topic:'139',answerAnchor:'혈액 손실'},
 {id:'unsupported-reversed-iron-anemia-cause',question:'빈혈 때문에 철분이 부족해지나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-reversed-blood-loss-cause',question:'빈혈 때문에 혈액 손실이 생기나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-reversed-allergy-influence',question:'알레르기가 유전자와 환경에 영향을 주나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-anemia-leukemia-comparison',question:'빈혈과 백혈병은 어떤 차이가 있나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-hormone-enzyme-comparison',question:'호르몬과 효소가 모두 화학적 전달자인가요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'allergy-negated-relation',question:'알레르기는 유전자와 환경이 영향을 주지 않나요?',status:'GENERATED',topic:'24',answerAnchor:'유전자와 환경이 모두 영향을'},
 {id:'hormone-transport-negated',question:'호르몬은 혈액을 따라 이동하지 않나요?',status:'GENERATED',topic:'1499',answerAnchor:'혈류를 따라 조직이나 장기로 이동'},
 {id:'vaccine-training-negated',question:'백신은 면역계가 병원체를 인식하도록 가르치지 않나요?',status:'GENERATED',topic:'294',answerAnchor:'인식하고 방어하도록 가르치는'},
 {id:'unsupported-vaccine-without-condition',question:'면역계는 백신 없이도 병원체를 인식하도록 훈련되나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'allergy-single-factor-premise-correction',question:'유전자와 환경 중 하나만 알레르기에 영향을 주나요?',status:'GENERATED',topic:'24',answerAnchor:'유전자와 환경이 모두 영향을'},
 {id:'anemia-most-common-cause-frequency',question:'빈혈의 가장 흔한 원인은 철분 부족인가요?',status:'GENERATED',topic:'139',answerAnchor:'가장 흔한 원인은 철분 부족'},
 {id:'anemia-cause-concessive-clause',question:'빈혈의 원인은 다양하지만 철분 부족이 가장 흔한 원인인가요?',status:'GENERATED',topic:'139',answerAnchor:'가장 흔한 원인은 철분 부족'},
 {id:'unsupported-anemia-double-negation',question:'빈혈의 원인이 철분 부족이 아닌 것은 아니죠?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-anemia-always-iron-cause',question:'철분 부족이 항상 빈혈을 일으키나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-anemia-sole-iron-cause',question:'철분 부족은 빈혈의 유일한 원인인가요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-all-anemia-iron-cause',question:'모든 빈혈은 철분 부족 때문에 생기나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-anemia-only-iron-cause',question:'철분 부족만 빈혈을 일으키나요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'unsupported-anemia-often-iron-cause',question:'철분 부족은 종종 빈혈 원인인가요?',status:'INSUFFICIENT_EVIDENCE'},
 {id:'short-title-bruise-definition',question:'멍은 무엇인가요?',status:'GENERATED',topic:'1621',answerAnchor:'피부 표면 아래에 혈액이 고여'},
 {id:'short-title-cancer-definition',question:'암은 어떤 병인가요?',status:'GENERATED',topic:'25',answerAnchor:'하나의 질병이 아니라 여러 질병'},
 {id:'short-title-iron-definition',question:'철은 무엇인가요?',status:'GENERATED',topic:'5542',answerAnchor:'성장과 발달에 필요한 무기질'},
 {id:'short-title-scabies-definition',question:'옴은 무엇인가요?',status:'GENERATED',topic:'1254',answerAnchor:'옴진드기(Sarcoptes scabei)가 일으키는'},
 {id:'short-title-sweat-definition',question:'땀은 무엇인가요?',status:'GENERATED',topic:'1344',answerAnchor:'피부의 분비샘에서 만들어지는'},
];
const requestedIds=process.argv.slice(2),selectedCases=requestedIds.length?cases.filter(item=>requestedIds.includes(item.id)):cases;
if(requestedIds.length&&(selectedCases.length!==requestedIds.length||new Set(requestedIds).size!==requestedIds.length))
 throw Error('UNKNOWN_OR_DUPLICATE_SYNTHETIC_HTTP_CASE');
let currentQuestion='',modelCalls=0,lastGenerationRequestAt=0,rawQuestionExcluded=true;
const server=createServer((req,res)=>handler(req,res,(status,value)=>{
 res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end(JSON.stringify(value));
}));
let handler;
server.listen(0,'127.0.0.1');
await once(server,'listening');
const port=server.address().port,host=`127.0.0.1:${port}`,origin=`http://${host}`;
handler=createCandidateQuestionHandler({expectedHost:host,expectedOrigin:origin,allowSourceFallback:true,
 retrieveEvidence:question=>retrieveUploadedEvidence(question,corpus),
 insufficientAnswer:retrieval=>retrieval.status==='REFUSED'?'이 요청은 지원하지 않습니다.':'근거가 부족합니다.',
  generateAnswer:(retrieval,{signal})=>{
  modelCalls++;
  return generateCandidateAnswer(retrieval,{signal,fetchImpl:(url,options)=>{
   const payload=JSON.parse(options.body);
   if(JSON.stringify(payload).includes(currentQuestion))rawQuestionExcluded=false;
   return fetch(url,options);
  }});
 },
});
function post(question){
 return new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port,path:'/candidate/questions',method:'POST',
   headers:{origin,'content-type':'application/json'}},res=>{
    const parts=[];res.on('data',part=>parts.push(part));res.on('error',reject);
    res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(parts).toString('utf8'))});}catch(error){reject(error);}});
  });
  req.on('error',reject);req.end(JSON.stringify({question}));
 });
}
const results=[];
try{
 for(const item of selectedCases){
  // Pace request admission; the handler records rate-limit timestamps before generation starts.
  if(item.status==='GENERATED'){
   const pacingMs=Math.max(0,12500-(Date.now()-lastGenerationRequestAt));
   if(pacingMs)await new Promise(resolve=>setTimeout(resolve,pacingMs));
   lastGenerationRequestAt=Date.now();
  }
  currentQuestion=item.question;
  const response=await post(item.question),body=response.body;
  assert.equal(response.status,200,item.id);assert.equal(body.status,item.status,item.id);
  if(item.status==='GENERATED'){
   assert.equal(body.contextTopic,corpus.chunks.find(chunk=>chunk.topic===item.topic)?.title_ko,item.id);
    const expectedClaimCount=item.claimCount??1;
    assert.equal(body.sources.length,1,item.id);assert.equal(body.claimEvidence.length,expectedClaimCount,item.id);
    const joinedClaims=body.claimEvidence.map(claim=>claim.quote).join(' ');
    assert.equal(body.answer,joinedClaims,item.id);
    assert.equal(body.sources[0].excerpt.replace(/\s+/gu,' ').trim(),body.answer,item.id);
   const retrieval=retrieveUploadedEvidence(item.question,corpus);
   assert.equal(retrieval.status,'CANDIDATE',item.id);assert.equal(retrieval.topic,item.topic,item.id);
   const expectedAnchors=item.answerAnchors??[item.answerAnchor];
   assert.ok(Array.isArray(expectedAnchors)&&expectedAnchors.length>0
    &&expectedAnchors.every(anchor=>typeof anchor==='string'&&anchor.length>0),`${item.id}: expected answer anchors are required`);
   const expectedPayload=educationPayload({...retrieval,claimEvidenceRequired:true});
   const expectedInput=JSON.parse(expectedPayload.messages.find(message=>message.role==='user').content);
   const selectableSentences=expectedInput.evidence.flatMap(evidence=>evidence.sentences.map(sentence=>sentence.text));
   for(const anchor of expectedAnchors){
    assert.ok(selectableSentences.some(sentence=>sentence.includes(anchor)),`${item.id}: expected answer anchor absent from selectable source`);
    assert.ok(body.answer.includes(anchor),`${item.id}: expected answer anchor absent from generated answer`);
   }
  }else{
   assert.deepEqual(body.sources,[],item.id);assert.equal(body.generationUsed,false,item.id);
  }
   results.push({id:item.id,status:body.status,sourceCount:body.sources.length,claimCount:body.claimEvidence?.length??0,
    generationUsed:body.status==='GENERATED',excerptMatchesAnswer:body.status==='GENERATED'?body.sources[0].excerpt.replace(/\s+/gu,' ').trim()===body.answer:null,
   answerAnchorCovered:body.status==='GENERATED'?(item.answerAnchors??[item.answerAnchor]).every(anchor=>body.answer.includes(anchor)):null});
 }
 assert.equal(modelCalls,selectedCases.filter(item=>item.status==='GENERATED').length);
 assert.equal(rawQuestionExcluded,true);
 console.log(JSON.stringify({result:'PASS',listener:'127.0.0.1 loopback',corpusVersion:corpus.version,
  indexedDocuments:corpus.indexedDocuments,caseCount:selectedCases.length,modelCalls,rawQuestionExcluded,semanticGrounding:'NOT_PROVEN',
  clinicalUse:false,serviceEligible:false,cases:results}));
}finally{
 server.closeAllConnections();
 await new Promise(resolve=>server.close(resolve));
}
