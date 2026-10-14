import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer,request} from 'node:http';
import {once} from 'node:events';
import {setImmediate as nextTick} from 'node:timers/promises';
import {createCandidateQuestionHandler} from '../src/health-helper-candidate-http.js';
import {generateCandidateAnswer} from '../src/health-helper-candidate-generation.js';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {sha256} from '../src/health-helper-medlineplus.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function evidence(held=false){
 const text='CT 검사 전에 검사 준비에 관해 의료진에게 물어보세요.';
 return {status:'CANDIDATE',topic:'3951',intent:'PREPARE',evidence:[{
  chunk_id:'synthetic-ct-1',doc_id:'synthetic-ct',title_ko:'컴퓨터 단층촬영',text_ko:text,
  textSha256:sha256(text),source_url:'https://medlineplus.gov/ctscans.html',section_path:['준비'],
  demoIndexStatus:'PASS',contentReview:'UNASSIGNED',ai_qa_status:held?'HOLD':'PASS',unresolvedIssueCount:held?1:0,
 }]};
}
const validModel=()=>new Response(JSON.stringify({done:true,done_reason:'stop',message:{content:JSON.stringify({
 evidenceIds:['E1'],claimEvidence:[{evidenceId:'E1',sentenceIndexes:[0]}],
})}}));
const actualGeneration=fetchImpl=>(retrieval,options)=>generateCandidateAnswer(retrieval,{...options,fetchImpl});
async function serve(t,options={}){
 let handler;
 const server=createServer((req,res)=>handler(req,res,(status,value)=>{
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));
 }));
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const host=`127.0.0.1:${server.address().port}`,origin=`http://${host}`;
 handler=createCandidateQuestionHandler({expectedHost:host,expectedOrigin:origin,allowSourceFallback:true,
  retrieveEvidence:async()=>evidence(),insufficientAnswer:()=> '근거가 부족합니다.',
  generateAnswer:actualGeneration(async()=>validModel()),...options});
 t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));});
 return (body={question:'CT 검사 준비'},extra={})=>new Promise((resolve,reject)=>{
  const req=request(`${origin}/candidate/questions`,{method:'POST',
   headers:{origin,'content-type':'application/json',...extra.headers},signal:extra.signal},res=>{
    const parts=[];res.on('data',part=>parts.push(part));res.on('error',reject);
    res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(parts).toString('utf8'))}));
   });
  req.on('error',reject);req.end(typeof body==='string'?body:JSON.stringify(body));
 });
}

test('school candidate HTTP returns an exact evidence-derived answer',async t=>{
 const ask=await serve(t),result=await ask();
 assert.equal(result.status,200);assert.equal(result.body.status,'GENERATED');
 assert.equal(result.body.answer,evidence().evidence[0].text_ko);
 assert.equal(result.body.contextTopic,'컴퓨터 단층촬영');
});

test('HCC AFP and liver-ultrasound questions abstain when those exam sources are absent',async t=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url));
 let invocations=0;
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  generateAnswer:async()=>{invocations++;throw Error('unsupported exam questions must not reach the model');}});
 const questions=[
  'AFP와 간 초음파 자료는 간암 시나리오와 어떻게 연결되나요?',
  'AFP 검사는 무엇을 확인하나요?',
  '간 초음파 검사는 무엇을 확인하나요?',
 ];
 for(const question of questions){
  const retrieval=retrieveUploadedEvidence(question,corpus);
  assert.equal(retrieval.status,'INSUFFICIENT_EVIDENCE',question);assert.deepEqual(retrieval.evidence,[],question);
  const response=await ask({question}),body=response.body;
  assert.equal(response.status,200,question);assert.equal(body.status,'INSUFFICIENT_EVIDENCE',question);
  assert.equal(body.generationUsed,false,question);assert.deepEqual(body.sources,[],question);
  assert.doesNotMatch(JSON.stringify(body),/간암|단핵구증|AFP/u,question);
 }
 assert.equal(retrieveUploadedEvidence('간암 설명',corpus).status,'CANDIDATE','the guard must not disable grounded liver-cancer concept retrieval');
 assert.equal(invocations,0);
});

test('exact high-risk topic title returns metadata-only source lookup without model generation',async t=>{
 let invocations=0;
 const chunk={...evidence().evidence[0],chunk_id:'synthetic-surgery-1',doc_id:'synthetic-surgery',topic:'5419',
  title_ko:'수술 후 관리',text_ko:'수술 후 관리에 관한 안내 자료입니다.',source_url:'https://medlineplus.gov/surgeryaftercare.html'};
 chunk.textSha256=sha256(chunk.text_ko);
 const lookupCorpus={chunks:[chunk],indexScope:'SCHOOL_DEMO_ALL_TRANSLATIONS',held:[]};
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,lookupCorpus),
  generateAnswer:async()=>{invocations++;throw Error('must not run');}});
 const result=await ask({question:'수술 후 관리 설명'});
 assert.equal(result.status,200);assert.equal(result.body.status,'SOURCE_GUIDANCE');
 assert.equal(result.body.responseMode,'SOURCE_LOOKUP_ONLY');assert.equal(result.body.generationUsed,false);
 assert.equal(result.body.contextTopic,'수술 후 관리');assert.deepEqual(result.body.questions,[]);
 assert.equal(Object.hasOwn(result.body.sources[0],'excerpt'),false);
 assert.equal(Object.hasOwn(result.body.sources[0],'listContexts'),false);
 assert.equal(invocations,0);
});

test('structured symptom lists return the complete translated items without model generation',async t=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 let invocations=0;
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  generateAnswer:async()=>{invocations++;throw Error('structured translation lists must not invoke generation');}});
 const cases=[
  {question:'천식의 증상에는 어떤 것들이 있나요?',topic:'2',heading:'천식의 증상은 다음과 같습니다:',items:[
   '가슴이 조이는 느낌','기침, 특히 밤이나 이른 아침에 하는 기침','숨참','숨을 내쉴 때 휘파람 같은 소리가 나는 쌕쌕거림']},
  {question:'천식 증상을 나열해 주세요',topic:'2',heading:'천식의 증상은 다음과 같습니다:',items:[
   '가슴이 조이는 느낌','기침, 특히 밤이나 이른 아침에 하는 기침','숨참','숨을 내쉴 때 휘파람 같은 소리가 나는 쌕쌕거림']},
  {question:'위식도역류질환 증상 목록',topic:'512',heading:'위식도역류질환의 가장 흔한 증상은 가슴쓰림입니다. 가슴이나 목이 타는 듯한 느낌을 말합니다. 가슴쓰림 없이 위식도역류질환이 있을 수도 있습니다. 다른 증상으로 다음과 같은 것들이 나타날 수 있습니다:',items:[
   '입 안 뒤쪽에서 위산이나 음식의 맛이 느껴짐','마른기침 또는 쉰목소리','천식과 비슷한 증상','삼키기 어려움']},
  {question:'심방세동의 증상에는 어떤 것들이 있나요?',topic:'4964',heading:'심방세동의 증상에는 다음이 포함될 수 있습니다.',items:[
   '극심한 피로. 가장 흔한 증상입니다.','심계항진(심장이 한 박자 건너뛰거나, 파르르 떨리거나, 두근거리거나, 너무 세게 또는 너무 빨리 뛰는 느낌)',
   '호흡곤란, 특히 누워 있거나 운동할 때','가슴 통증','어지럼증 또는 실신','저혈압']},
  {question:'강직성 척추염의 증상 목록',topic:'143',heading:'강직성 척추염의 다른 증상에는 다음이 포함될 수 있습니다.',items:[
   '관절의 통증, 뻣뻣함, 염증.','깊이 숨쉬기 어려움. 갈비뼈를 연결하는 관절이 영향을 받으면 나타날 수 있습니다.',
   '시력 변화.','피로.','식욕 저하.','체중 감소.','건선과 같은 피부 발진.','복부(배) 통증과 묽은 변(대변).']},
  {question:'독감(인플루엔자) 증상 목록',topic:'299',heading:'독감 증상은 갑자기 시작되며, 다음과 같은 증상이 나타날 수 있습니다:',items:[
   '발열 또는 열이 나는 느낌/오한','기침','인후통','콧물 또는 코막힘','근육통 또는 몸의 통증','두통','피로(피곤함)',
   '일부 사람에게는 구토와 설사도 나타날 수 있습니다. 이는 어린이에게 더 흔합니다.']},
  {question:'제2형 당뇨병의 증상에는 어떤 것들이 있나요?',topic:'5930',heading:'제2형 당뇨병이 있어도 아무 증상이 없는 사람이 많습니다. 증상이 있는 경우에도 몇 년에 걸쳐 서서히 나타납니다. 증상이 매우 가벼워서 알아차리지 못할 수도 있습니다. 다음과 같은 증상이 나타날 수 있습니다.',items:[
   '갈증이 심해지고 배뇨가 늘어남','배고픔이 심해짐','피로감','흐릿한 시야','발이나 손의 감각 저하 또는 저림','낫지 않는 상처','이유를 알 수 없는 체중 감소']},
  {question:'갑상선 기능 저하증 증상은 몇 가지인가요?',topic:'6175',heading:'갑상선기능저하증의 증상은 사람마다 다를 수 있으며, 다음과 같은 증상이 나타날 수 있습니다.',items:[
   '피로','체중 증가','얼굴 부기','추위를 견디기 어려움','관절통과 근육통','변비','피부 건조','건조해지고 가늘어지는 머리카락','땀이 줄어듦',
   '월경량이 많거나 월경이 불규칙함','여성의 임신 능력에 문제가 생김','우울증','심박수 저하',
   '갑상선종: 갑상선이 커져 목이 부어 보일 수 있습니다. 때로는 숨을 쉬거나 삼키기 어려워질 수 있습니다.']},
  {question:'제1형 당뇨병의 증상 목록',topic:'1339',heading:'증상은 특히 어린이에서 빠르게 시작되는 경우가 많습니다. 성인에서는 더 천천히 나타날 수 있습니다. 다음 증상이 포함될 수 있습니다.',items:[
   '매우 심한 갈증','매우 심한 허기','밤을 포함하여 소변을 더 자주 봄','피로','흐릿한 시야','발의 감각이 없어지거나 발 또는 손이 저림','낫지 않는 상처','의도하지 않은 체중 감소']},
  {question:'심부전의 증상 목록',topic:'199',heading:'심부전 증상에는 다음이 포함될 수 있습니다.',items:[
   '계단 오르기 같은 활동을 할 때 숨이 참(공기를 충분히 들이마시지 못하는 느낌). 처음 알아차리는 증상 중 하나일 수 있습니다.','휴식 후에도 지속되는 피로 또는 쇠약.','기침.',
   '발목, 종아리 또는 복부의 체액으로 인한 부기와 체중 증가.','평평하게 누워서 자기 어려움.','메스꺼움과 식욕 저하.','목정맥이 부풀어 오름.','소변을 자주 보아야 함.']},
  {question:'골반저 질환 증상 목록',topic:'1677',heading:'흔한 증상은 다음과 같습니다.',items:[
   '질에서 무겁거나 꽉 찬 느낌, 당기는 느낌 또는 쑤시는 느낌이 듦. 하루가 끝날 무렵이나 배변 중에 심해집니다.','질에서 “불룩 튀어나온 것”이나 “무언가 나오는 것”을 보거나 느낌',
   '소변을 보기 시작하거나 방광을 완전히 비우기 어려움','요로감염이 자주 발생함','기침하거나 웃거나 운동할 때 소변이 샘','급하게 또는 자주 소변을 봐야 한다는 느낌',
   '소변을 볼 때 통증이 있음','대변이 새거나 방귀를 조절하기 어려움','변비가 있음','화장실에 제때 도착하기 어려움']},
 ];
 for(const item of cases){
  const result=await ask({question:item.question}),body=result.body;
  assert.equal(result.status,200,item.question);assert.equal(body.status,'SOURCE_GUIDANCE',item.question);
  assert.equal(body.responseMode,'SOURCE_GUIDANCE_LIST_CONTEXT',item.question);
  assert.equal(body.generationUsed,false,item.question);assert.equal(body.sources.length,1,item.question);
  assert.equal(body.sources[0].id,corpus.chunks.find(chunk=>chunk.topic===item.topic).doc_id,item.question);
  assert.equal(Object.hasOwn(body.sources[0],'excerpt'),false,item.question);
  assert.deepEqual(body.sources[0].listContexts,[{heading:item.heading,items:item.items}],item.question);
  assert.match(body.sources[0].contextNote,/원문 조각별로 나누어 표시/u,item.question);
 }
 const groupedCases=[
  {question:'주의력결핍 과잉행동장애 증상 목록',topic:'152',contexts:[
   {heading:'주의력 문제의 증상이 있는 사람은 다음과 같은 모습을 자주 보일 수 있습니다.',count:8},
   {heading:'과잉행동·충동성 증상이 있는 사람은 다음과 같은 모습을 자주 보일 수 있습니다.',count:9}]},
  {question:'클라미디아 감염 증상 목록',topic:'1307',contexts:[
   {heading:'여성의 증상은 다음과 같습니다.',count:3},{heading:'남성의 증상은 다음과 같습니다.',count:3}]},
  {question:'수막구균 감염증 증상 목록',topic:'5651',contexts:[
   {heading:'수막구균성 수막염은 뇌와 척수를 둘러싼 막에 생기는 수막구균 감염입니다. 가장 흔한 증상은 다음과 같습니다.',count:3},
   {heading:'다음과 같은 증상도 유발할 수 있습니다.',count:3},
   {heading:'신생아와 아기에게서는 이러한 증상을 알아차리기 어려울 수 있습니다. 다른 증상이 나타날 수도 있습니다. 다음과 같은 모습을 보일 수 있습니다.',count:5},
   {heading:'수막구균성 패혈증은 혈류의 수막구균 감염입니다. 수막구균혈증(meningococcemia)이라고도 합니다. 이 질병이 있으면 세균이 혈류로 들어가 증식합니다. 이로 인해 혈관벽이 손상되고 피부와 장기 안으로 출혈이 발생합니다. 증상에는 다음이 포함될 수 있습니다.',count:8}]},
 ];
 for(const item of groupedCases){
  const result=await ask({question:item.question}),body=result.body;
  assert.equal(body.status,'SOURCE_GUIDANCE',item.question);assert.equal(body.responseMode,'SOURCE_GUIDANCE_LIST_CONTEXT',item.question);
  assert.equal(body.generationUsed,false,item.question);assert.equal(body.sources[0].id,corpus.chunks.find(chunk=>chunk.topic===item.topic).doc_id,item.question);
  assert.deepEqual(body.sources[0].listContexts.map(context=>({heading:context.heading,count:context.items.length})),item.contexts,item.question);
  assert.equal(Object.hasOwn(body.sources[0],'excerpt'),false,item.question);
 }
 const heldItem=corpus.chunks.find(chunk=>chunk.topic==='2'&&chunk.chunk_id.endsWith('S033-0'));
 heldItem.ai_qa_status='HOLD';heldItem.unresolvedIssueCount=1;
 const heldResult=await ask({question:'천식의 증상에는 어떤 것들이 있나요?'});
 assert.equal(heldResult.body.status,'SOURCE_GUIDANCE');assert.equal(heldResult.body.generationUsed,false);
 assert.match(heldResult.body.answer,/콘텐츠 QA HOLD/u);
 assert.equal(Object.hasOwn(heldResult.body.sources[0],'listContexts'),false);
 assert.equal(Object.hasOwn(heldResult.body.sources[0],'excerpt'),false);
 for(const [topic,question] of [['6055','불면증의 증상 목록'],['6177','갑상샘기능항진증의 증상 목록']]){
  const sourceChunks=corpus.chunks.filter(chunk=>chunk.topic===topic);
  assert.ok(sourceChunks.length>0,question);
  assert.ok(sourceChunks.every(chunk=>chunk.demoIndexStatus==='PASS'&&chunk.ai_qa_status==='HOLD'&&chunk.unresolvedIssueCount>0),question);
  const heldTopic=await ask({question});
  assert.equal(heldTopic.body.status,'INSUFFICIENT_EVIDENCE',question);
  assert.equal(heldTopic.body.generationUsed,false,question);
  assert.deepEqual(heldTopic.body.sources,[],question);
 }
 assert.equal(invocations,0);
});

test('single-sentence symptom enumerations return only the named source sentence',async t=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 let invocations=0;
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  generateAnswer:async()=>{invocations++;throw Error('extractive symptom sentences must not invoke generation');}});
 const cases=[
  {question:'눈 감염의 증상에는 어떤 것들이 있나요?',topic:'4398',excerpt:'눈 감염의 증상에는 충혈, 가려움, 부기, 분비물, 통증 또는 시력 문제가 포함될 수 있습니다.'},
  {question:'담석의 징후에는 어떤 것들이 있나요?',topic:'4643',excerpt:'담석 발작의 징후에는 메스꺼움, 구토, 복부·등 또는 오른팔 바로 아래의 통증이 포함될 수 있습니다.'},
  {question:'라임병의 증상 목록',topic:'84',excerpt:'처음에는 보통 발진, 발열, 두통, 피로 같은 증상이 나타납니다.'},
 ];
 for(const item of cases){
  const result=await ask({question:item.question}),body=result.body;
  assert.equal(result.status,200,item.question);assert.equal(body.status,'SOURCE_GUIDANCE',item.question);
  assert.equal(body.responseMode,'SOURCE_GUIDANCE',item.question);assert.equal(body.generationUsed,false,item.question);
  assert.equal(body.sources.length,1,item.question);assert.equal(body.sources[0].id,corpus.chunks.find(chunk=>chunk.topic===item.topic).doc_id,item.question);
  assert.equal(body.sources[0].excerpt,item.excerpt,item.question);
 }
 assert.equal(invocations,0);
 for(const question of ['눈 감염 증상은 몇 가지인가요?','암 면역요법 부작용 증상 목록']){
  const result=await ask({question});assert.equal(result.body.status,'INSUFFICIENT_EVIDENCE',question);
  assert.deepEqual(result.body.sources,[],question);
 }
 const source=corpus.chunks.find(chunk=>chunk.topic==='4398'&&chunk.chunk_id.endsWith('S0004-0'));
 const heldCorpus={...corpus,chunks:[{...source,ai_qa_status:'HOLD',sourceContentReview:'HOLD',contentReview:'HOLD',unresolvedIssueCount:1}]};
 const askHeld=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,heldCorpus),
  generateAnswer:async()=>{invocations++;throw Error('held sentence must not invoke generation');}});
 const heldResult=await askHeld({question:'눈 감염의 증상에는 어떤 것들이 있나요?'});
 assert.equal(heldResult.body.status,'SOURCE_GUIDANCE');assert.equal(heldResult.body.generationUsed,false);
 assert.match(heldResult.body.answer,/콘텐츠 QA HOLD/u);assert.equal(Object.hasOwn(heldResult.body.sources[0],'excerpt'),false);
 assert.equal(Object.hasOwn(heldResult.body.sources[0],'listContexts'),false);assert.equal(invocations,0);
});

test('structured risk factor lists preserve nested headings and fail closed on held topics',async t=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 let invocations=0;
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  insufficientAnswer:()=> '근거가 부족합니다.',generateAnswer:async()=>{invocations++;throw Error('structured risk lists must not invoke generation');}});
 const cases=[
  {question:'골다공증 위험 요인 목록',topic:'37',count:22,contains:['성별. 골다공증은 여성에게 더 흔하며, 특히 폐경 후에 그렇습니다.',
   '인종: 백인과 아시아계 여성이 위험이 가장 높습니다.','가족력. 부모 중 한 명이 골다공증이 있거나 고관절 부위 골절을 겪었다면 골다공증 위험이 더 높을 수 있습니다.',
   '다음과 같은 특정 약물의 장기 사용: 코르티코스테로이드','생활습관. 다음과 같은 특정 생활습관 요인은 뼈 손실에 기여할 수 있습니다.']},
  {question:'갑상선기능저하증 위험 요인 몇 가지',topic:'6175',count:13,contains:['여성인 경우','만성 자가면역질환인 루푸스가 있는 경우']},
  {question:'제2형 당뇨병의 위험 요인은 무엇인가요?',topic:'5930',count:9,contains:['45세보다 나이가 많은 경우. 어린이, 청소년, 젊은 성인에게도 제2형 당뇨병이 생길 수 있지만, 중년층과 노년층에서 더 흔합니다.',
   'HDL(좋은) 콜레스테롤 수치가 낮으면서 중성지방 수치가 높은 경우']},
 ];
 for(const item of cases){
  const result=await ask({question:item.question}),body=result.body;
  assert.equal(result.status,200,item.question);assert.equal(body.status,'SOURCE_GUIDANCE',item.question);
  assert.equal(body.responseMode,'SOURCE_GUIDANCE_LIST_CONTEXT',item.question);assert.equal(body.generationUsed,false,item.question);
  assert.equal(body.sources.length,1,item.question);assert.equal(body.sources[0].id,corpus.chunks.find(chunk=>chunk.topic===item.topic).doc_id,item.question);
  assert.equal(body.sources[0].listContexts[0].items.length,item.count,item.question);
  for(const expected of item.contains)assert.ok(body.sources[0].listContexts[0].items.includes(expected),`${item.question}: ${expected}`);
  assert.equal(Object.hasOwn(body.sources[0],'excerpt'),false,item.question);
 }
 const osteoporosis= (await ask({question:'골다공증 위험 요인 목록'})).body.sources[0].listContexts[0].items;
 assert.equal(osteoporosis.includes('인종:'),false);assert.ok(osteoporosis.some(item=>item.startsWith('다음과 같은 다른 질환이 있음:')));
 assert.ok(osteoporosis.some(item=>item.startsWith('생활습관.')));
 const heldItem=corpus.chunks.find(chunk=>chunk.topic==='5930'&&chunk.chunk_id.endsWith('S012-0'));
 heldItem.ai_qa_status='HOLD';heldItem.unresolvedIssueCount=1;
 const heldResult=await ask({question:'제2형 당뇨병의 위험 요인은 무엇인가요?'});
 assert.equal(heldResult.body.status,'SOURCE_GUIDANCE');assert.equal(heldResult.body.generationUsed,false);
 assert.match(heldResult.body.answer,/콘텐츠 QA HOLD/u);
 assert.equal(Object.hasOwn(heldResult.body.sources[0],'listContexts'),false);
 assert.equal(Object.hasOwn(heldResult.body.sources[0],'excerpt'),false);assert.equal(invocations,0);
 const heldTopic=await ask({question:'고혈압 위험 요인 몇 가지'});
 assert.equal(heldTopic.body.status,'INSUFFICIENT_EVIDENCE');assert.equal(heldTopic.body.generationUsed,false);
 assert.deepEqual(heldTopic.body.sources,[]);assert.equal(invocations,0);
 const ambiguousTopic=await ask({question:'당뇨병 위험 요인 목록'});
 assert.equal(ambiguousTopic.body.status,'INSUFFICIENT_EVIDENCE');assert.equal(ambiguousTopic.body.generationUsed,false);
 assert.deepEqual(ambiguousTopic.body.sources,[]);assert.equal(invocations,0);
});

test('all 51 source-only title lookups return metadata over HTTP without model calls or excerpts',async t=>{
 const corpus=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url),{includeQaHolds:true});
 const documents=[...new Map(corpus.chunks.map(chunk=>[chunk.doc_id,{docId:chunk.doc_id,title:chunk.title_ko}])).values()];
 const sourceOnly=documents.map(document=>{
  const question=`${document.title} 설명`,retrieval=retrieveUploadedEvidence(question,corpus);
  const exactChunk=retrieval.evidence?.find(chunk=>chunk.doc_id===document.docId);
  return retrieval.sourceLookupOnly?{document,question,retrieval,exactChunk}:null;
 }).filter(Boolean);
 assert.equal(sourceOnly.length,51);
 assert.ok(sourceOnly.every(item=>item.exactChunk?.demoIndexStatus==='PASS'&&item.exactChunk.source_url));
 assert.deepEqual(sourceOnly.reduce((counts,item)=>{
  const quality=item.exactChunk.ai_qa_status;counts[quality]=(counts[quality]??0)+1;return counts;
 },{}),{HOLD:4,PASS:47});

 let invocations=0;
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  generateAnswer:async()=>{invocations++;throw Error('source-only lookup must not invoke generation');}});
 for(const item of sourceOnly){
  const result=await ask({question:item.question}),body=result.body;
  assert.equal(result.status,200,item.document.title);
  assert.equal(body.status,'SOURCE_GUIDANCE',item.document.title);
  assert.equal(body.responseMode,'SOURCE_LOOKUP_ONLY',item.document.title);
  assert.equal(body.generationUsed,false,item.document.title);
  assert.equal(body.contextTopic,item.document.title,item.document.title);
  assert.deepEqual(body.questions,[],item.document.title);
  assert.equal(body.sources.length,1,item.document.title);
  assert.equal(body.sources[0].id,item.document.docId,item.document.title);
  assert.equal(body.sources[0].url,item.exactChunk.source_url,item.document.title);
  assert.equal(Object.hasOwn(body.sources[0],'excerpt'),false,item.document.title);
  assert.equal(Object.hasOwn(body.sources[0],'listContexts'),false,item.document.title);
 }
 assert.equal(invocations,0);
});

test('personal health questions fail closed without evidence or model generation',async t=>{
 let invocations=0;
 const corpus={chunks:evidence().evidence,indexScope:'SCHOOL_DEMO_ALL_TRANSLATIONS',held:[]};
 const ask=await serve(t,{retrieveEvidence:async question=>retrieveUploadedEvidence(question,corpus),
  insufficientAnswer:()=> '개인 건강상태에 대한 상담은 지원하지 않습니다.',
  generateAnswer:async()=>{invocations++;throw Error('must not run');}});
 for(const question of ['제 빈혈 증상은 어떤가요?','임신 중인데 CT를 받아도 되나요?']){
  const result=await ask({question});
  assert.equal(result.status,200);assert.equal(result.body.status,'PERSONAL_INPUT_NOT_SUPPORTED');
  assert.equal(result.body.generationUsed,false);assert.deepEqual(result.body.sources,[]);assert.equal(invocations,0);
 }
});

test('model HTTP, JSON and citation failures become safe HTTP source guidance',async t=>{
 for(const fetchImpl of [async()=>new Response('private model failure',{status:503}),
  async()=>new Response('invalid JSON'),async()=>new Response(JSON.stringify({done:true,done_reason:'stop',
   message:{content:JSON.stringify({evidenceIds:['E1'],claimEvidence:[{evidenceId:'E1',sentenceIndexes:[99]}]})}}))]){
  const ask=await serve(t,{generateAnswer:actualGeneration(fetchImpl)}),result=await ask();
  assert.equal(result.status,200);assert.equal(result.body.status,'SOURCE_GUIDANCE');
  assert.equal(result.body.generationUsed,false);assert.equal(result.body.sources[0].excerpt,evidence().evidence[0].text_ko);
  assert.equal(result.body.contextTopic,'컴퓨터 단층촬영');
  assert.doesNotMatch(JSON.stringify(result.body),/private model failure|sentenceIndexes|MODEL_/u);
 }
});

test('held-source fallback shows metadata only; non-school profile retains 503',async t=>{
 const failing=actualGeneration(async()=>{throw Error('private connection detail');});
 const held=await serve(t,{retrieveEvidence:async()=>evidence(true),generateAnswer:failing});
 const result=await held();assert.equal(result.status,200);assert.equal(result.body.status,'SOURCE_GUIDANCE');
 assert.equal(result.body.sources.length,1);assert.equal(Object.hasOwn(result.body.sources[0],'excerpt'),false);
 const ordinary=await serve(t,{allowSourceFallback:false,generateAnswer:failing});
 assert.deepEqual(await ordinary(),{status:503,body:{error:'MODEL_UNAVAILABLE_OR_OUTPUT_REJECTED'}});
});

test('deadline aborts the model and releases admission for the next request',async t=>{
 let invocation=0,aborted=false;
 const ask=await serve(t,{modelTimeoutMs:30,generateAnswer:async(retrieval,{signal})=>{
  if(++invocation>1)return generateCandidateAnswer(retrieval,{fetchImpl:async()=>validModel(),signal});
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{
   aborted=true;assert.equal(signal.reason.name,'TimeoutError');reject(signal.reason);
  },{once:true}));
 }});
 assert.equal((await ask()).body.status,'SOURCE_GUIDANCE');assert.equal(aborted,true);
 assert.equal((await ask()).body.status,'GENERATED');
});

test('two requests finishing asynchronous retrieval together invoke the model once',async t=>{
 const ready=deferred(),releaseRetrieval=deferred(),releaseModel=deferred();let retrieved=0,invocations=0;
 const ask=await serve(t,{retrieveEvidence:async()=>{
  if(++retrieved===2)ready.resolve();await releaseRetrieval.promise;return evidence();
 },generateAnswer:async retrieval=>{
  invocations++;await releaseModel.promise;
  return generateCandidateAnswer(retrieval,{fetchImpl:async()=>validModel()});
 }});
 const first=ask(),second=ask();await ready.promise;releaseRetrieval.resolve();
 const denied=await Promise.race([first,second]);assert.deepEqual(denied,{status:429,body:{error:'BUSY'}});
 assert.equal(invocations,1);releaseModel.resolve();
 const results=await Promise.all([first,second]);assert.ok(results.some(result=>result.body.status==='GENERATED'));
});

test('client cancellation aborts generation and permits a subsequent question',async t=>{
 const started=deferred(),canceled=deferred();let invocation=0;
 const ask=await serve(t,{generateAnswer:async(retrieval,{signal})=>{
  if(++invocation>1)return generateCandidateAnswer(retrieval,{fetchImpl:async()=>validModel(),signal});
  started.resolve();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{
   canceled.resolve();reject(signal.reason);
  },{once:true}));
 }});
 const controller=new AbortController(),pending=ask(undefined,{signal:controller.signal});
 const rejected=assert.rejects(pending,{name:'AbortError'});
 await started.promise;controller.abort();await rejected;await canceled.promise;await nextTick();
 assert.equal((await ask()).body.status,'GENERATED');
});

test('host, origin, JSON shape and byte limit failures never invoke the model',async t=>{
 let invocations=0;
 const ask=await serve(t,{generateAnswer:async()=>{invocations++;throw Error();}});
 assert.equal((await ask(undefined,{headers:{host:'invalid.example'}})).status,403);
 assert.equal((await ask(undefined,{headers:{origin:'http://invalid.example'}})).status,403);
 for(const body of ['{','null',{}, {question:'CT',extra:'not allowed'}, {question:'가'.repeat(1500)}])
  assert.equal((await ask(body)).status,400);
 assert.equal(invocations,0);
});

test('rate limit blocks the sixth model call and recovers after the rolling window',async t=>{
 let time=100000,invocations=0;
 const ask=await serve(t,{now:()=>time,generateAnswer:actualGeneration(async()=>{invocations++;return validModel();})});
 for(let index=0;index<5;index++)assert.equal((await ask()).body.status,'GENERATED');
 assert.deepEqual(await ask(),{status:429,body:{error:'RATE_LIMITED'}});assert.equal(invocations,5);
 time+=60001;assert.equal((await ask()).body.status,'GENERATED');assert.equal(invocations,6);
});
