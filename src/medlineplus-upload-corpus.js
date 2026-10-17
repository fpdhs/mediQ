// Uploaded translations are development evidence, never clinical/content approval.
import {readFile} from 'node:fs/promises';
import {sha256} from './health-helper-medlineplus.js';
import {morphoAnalyze} from './health-helper-korean-morpho.js';
import {classifyTopicAndIntent, INTENTS} from './health-helper-intent-classifier.js';

export {morphoAnalyze} from './health-helper-korean-morpho.js';
export {classifyTopicAndIntent, INTENTS} from './health-helper-intent-classifier.js';
const POLICY='https://medlineplus.gov/about/using/usingcontent/';
const RIGHTS=new Set(['public_domain_us_confirmed_scope','Health topic summaries identified as public domain by the source policy; not a blanket license for all linked content.']);
const hasKorean=text=>typeof text==='string'&&/[\uac00-\ud7a3]/u.test(text);
const normalizeAlias=text=>text.toLowerCase().replace(/\s+/gu,'');
const sentenceListForListItem=text=>{const sentences=text.match(/[^.!?。！？]+[.!?。！？]+/gu)??[];return sentences.length===1&&sentences[0].trim()===text;};
const symptomMentionPattern=/(?:통증|분비물|메스꺼움|구토|발열|발진|부기|부종|출혈|설사|기침|숨참|숨이\s*(?:참|차|가쁨)|호흡곤란|숨쉬기\s*어려움|깊이\s*숨쉬기\s*어려움|피로|피곤|체중\s*(?:감소|증가)|식욕|갈증|목마름|허기|배고픔|소변.{0,12}(?:자주|잦|샘)|배뇨.{0,12}(?:잦|빈번)|급하게\s*(?:또는\s*)?자주\s*소변|빈뇨|요로감염이\s*자주|방광.{0,12}(?:비우기|잔뇨).{0,8}어렵|소변을\s*(?:보기\s*시작|볼\s*때|급하게|자주)|소변이\s*샘|대변이\s*샘|방귀.{0,8}(?:조절|어렵)|변비|화장실에\s*제때\s*도착|질에서.{0,20}(?:무겁|꽉\s*찬|당기|쑤시|불룩|나오는)|질.{0,10}돌출|불룩\s*튀어나온|잠(?:들기|을\s*(?:계속\s*)?유지|을\s*(?:이루|자지|못)|들지\s*못)|깨어\s*있|일찍\s*깸|수면\s*(?:문제|장애)|불면|평평하게\s*누워서\s*자기\s*어려|목정맥|정맥.{0,8}부풀|간이나\s*비장.{0,8}(?:커지|비대)|황달|쌕쌕거림|열을\s*견디기\s*어려움|더위를\s*견디기\s*어려움|근력\s*약화|빠르고?\s*불규칙한\s*심장\s*박동|심장\s*박동.{0,10}(?:빠르|불규칙)|기분\s*변화|짜증|과민|월경.{0,12}(?:량이?\s*많|불규칙|변화)|흐릿한\s*(?:시야|시력)|흐린\s*(?:시야|시력)|시력\s*(?:저하|문제|변화)|감각(?:이)?\s*(?:없어지|저하|상실)|무감각|저림|따끔거림|낫지\s*않는\s*상처|두통|어지럼증|어지러움|현기증|실신|경련|마비|가려움|발한|땀|심계항진|두근거림|저혈압|시야\s*변화|관절(?:의\s*)?통증|관절통|근육통|뻣뻣함|림프절\s*부종|점상출혈|떨림|경직|발달\s*지연|근긴장도|기운이\s*없)/u;
const concreteSymptomMentions=text=>text.match(new RegExp(symptomMentionPattern.source,'gu'))??[];
const koreanDefinitionLookupCache=new WeakMap();
const koreanSearchStopTerms=new Set(['무엇','무엇이라고','뭐','어떤','무슨','어디','어느','기관','장기','부위','곳','병','질환','질병','장애','역할','기능','이란','뜻','개념','관계','현상','부르','이들','검사','검사법','검사란','영상','영상검사','설명','설명해','알려','주세요','주세',
  '만들','만드','보여','보여주','이용','이용하','사용','사용하','몸','피','건강','수','것','상태']);
export const isNonAnswerListLead=sentence=>/(?:다음과\s*같습니다|다음은.{0,30}(?:입니다|있습니다|있어요)|아래와\s*같습니다|다음에\s*해당합니다|다음이\s*포함됩니다|포함될\s*수\s*있습니다|포함할\s*수\s*있습니다|다음에\s*해당하면.{0,20}(?:알리|문의|상담)[가-힣]*|다음과\s*같은\s*(?:증상|요인|항목|것|문제|종류)|(?:증상|징후|요인|원인|종류|문제)(?:은|는|이|가)\s*다음과\s*같습니다)[.:：]?\s*$/u.test(sentence?.trim()??'');
const isCauseListQuestion=question=>/(?:원인|이유).{0,22}(?:어떤\s*(?:것들|종류|원인)|몇\s*(?:가지|종류)|무엇들|무엇이\s*있|뭐가\s*있|나열|목록|종류|유형|각각|전부|전체)|(?:어떤|무슨)\s*(?:원인|이유)(?:들|들이|들은)|(?:주요|대표적)\s*(?:원인|이유)(?:들|들은|은|는).{0,18}(?:어떤|무엇|뭐|몇)/u.test(question);
const isEnumeratedCauseSentence=sentence=>/(?:원인|이유).{0,140}(?:두\s*가지|세\s*가지|몇\s*가지|다음과\s*같|여러\s*가지)/u.test(sentence);
const isSymptomListQuestion=question=>/(?:증상|징후)(?:은|는|에는|을|를)?\s*(?:어떤\s*(?:것들|게|종류|항목|목록)|무엇(?:이|들)?|뭐(?:가|든)?|목록|나열|종류|몇\s*가지)|(?:어떤|무슨)\s*(?:증상|징후)/u.test(question);
const isRiskFactorListQuestion=question=>/(?:위험\s*(?:요인|인자|요소)).{0,22}(?:어떤|무엇|목록|나열|종류|몇\s*가지)|(?:어떤|무슨)\s*위험\s*(?:요인|인자|요소)/u.test(question);
const asksForListCount=question=>/몇\s*(?:가지|개|항목)/u.test(question);
const koreanSearchSuffixes=['으로부터','에게서는','에게서','에게는','에서는','으로는','이라는','이라고','이라면','라면','이란','란','인가요','일까요','습니까','합니다','됩니다',
 '해줘요','해주세요','시켜서','시켜','이에요','예요','에요','나요','까요','으로','에서','에게','한테','에는','이랑','하고','이라','라는',
 '입니다','습니다','하는','하면','하며','했던','되면','지만','처럼','까지','부터','보다','은','는','이','가','을','를','와','과','의','에','로','도','만','게','한','히','지','하'];
export function normalizeKoreanQuery(text){
 if(typeof text!=='string')return '';
 let cleaned=text.normalize('NFC').trim();
 cleaned=cleaned.replace(/^[?!\s.,~]+|[?!\s.,~]+$/gu,'');
 let prev;
 do{
  prev=cleaned;
  cleaned=cleaned
   .replace(/\s*(?:에\s*대해(?:서(?:는)?)?|에\s*관해(?:서(?:는)?)?|에\s*대하여|에\s*관하여|이라는\s*(?:것|건)|라는\s*(?:것|건)|에\s*대해)\s*$/u,'')
   .replace(/\s*(?:알려\s*(?:주세요|줘요|줘|주실래요|주시기\s*바랍니다|달라)|설명\s*(?:해주세요|해줘요|해줘|부탁드려요)|궁금\s*(?:해요|합니다|해))\s*$/u,'')
   .replace(/\s*(?:무엇인가요|무엇입니까|무엇인가|무엇인지|뭐인가요|뭔가요|뭔지|뭐예요|무엇인지\s*알려줘|어떤\s*것인가요|어떤\s*건가요)\s*$/u,'')
   .replace(/(?:란|이란|이라는|라는|은|는|이|가|을|를|의|에|과|와|도|만|으로|로)\s*$/u,'')
   .trim();
 }while(cleaned!==prev&&cleaned.length>1);
 return cleaned;
}

function koreanSearchTerms(text){
 const normalizedText=text.replace(/많은\s*(?:이들|사람)(?:에게|한테)?/gu,'대부분에게')
  .replace(/별(?:다른)?\s*문제가\s*없(?:는|어요|습니다)/gu,'문제가 되지 않는')
  .replace(/윗부분/gu,'위쪽');
 return [...new Set((normalizedText.match(/[가-힣]+/gu)??[]).map(value=>{
  let term=value.normalize('NFC');
  for(const suffix of koreanSearchSuffixes){if(term.length>suffix.length&&term.endsWith(suffix)){term=term.slice(0,-suffix.length);break;}}
  if(term.length>2&&term.endsWith('하'))term=term.slice(0,-1);
  return term;
 }).filter(term=>term.length>0&&!koreanSearchStopTerms.has(term)))];
}
function koreanDefinitionLookupIndex(corpus){
 const cached=koreanDefinitionLookupCache.get(corpus);if(cached)return cached;
 const postings=new Map(),termsByTopic=new Map(),topicIds=new Set();
 for(const chunk of corpus.chunks??[]){
  if(chunk.demoIndexStatus!=='PASS'||typeof chunk.text_ko!=='string'||sha256(chunk.text_ko)!==chunk.textSha256)continue;
  topicIds.add(chunk.topic);const topicTerms=termsByTopic.get(chunk.topic)??new Set();termsByTopic.set(chunk.topic,topicTerms);
  const sentences=completeSentences(chunk.text_ko);
  for(let sentenceIndex=0;sentenceIndex<sentences.length;sentenceIndex++){
    const sentence=sentences[sentenceIndex];if(/[?？]\s*$/u.test(sentence)||isNonAnswerListLead(sentence)||/증상|진단|확진|치료|처방|복용|위험|부작용|응급/u.test(sentence))continue;
   const terms=koreanSearchTerms(sentence);if(!terms.length)continue;
   const entry={chunk,sentenceIndex,terms:new Set(terms)};
   for(const term of terms){topicTerms.add(term);const entries=postings.get(term)??[];entries.push(entry);postings.set(term,entries);}
  }
 }
 const documentFrequency=new Map();
 for(const terms of termsByTopic.values())for(const term of terms)documentFrequency.set(term,(documentFrequency.get(term)??0)+1);
 const index={postings,documentFrequency,topicCount:topicIds.size};koreanDefinitionLookupCache.set(corpus,index);return index;
}
function retrieveKoreanMatchedEvidence(question,corpus){
 const asksDefinition=/(?:무엇|뭐|뜻|정의|목적|왜|어떤|알려|궁금|설명|뭔|어디|어느|무슨)/u.test(question);
 const asksDiseaseDefinition=/(?:어떤|무슨).{0,12}(?:질환|질병|병)/u.test(question)
  ||/혈액.{0,24}산소.{0,16}(?:운반|전달).{0,12}(?:못|않).{0,12}(?:무엇|뭐)/u.test(question);
 const asksCause=/(?:원인|이유|왜|어째서|때문|유발|일으키|초래)/u.test(question);
 const asksCauseList=isCauseListQuestion(question);
 const asksLocation=/(?:위에|위쪽|아래|뒤에|앞에|위치)/u.test(question);
 const asksRelation=/(?:관계|연관|영향|분비|나오|이동|운반|형성|구성|포함|조절)/u.test(question);
 if(!(asksDefinition||asksCause||asksLocation||asksRelation)
  ||/증상|징후|어지럽|피곤|피로|지치|통증|아프|숨.*차|위험|부작용|안전|진단|확진|치료|처방|복용|임신|응급|정상|수치|결과|금식|준비/u.test(question))return null;
 if(/(?:평균.{0,12}혈당|혈당.{0,12}평균)/u.test(question)&&!/(?:3\s*개월|세\s*달)/u.test(question))return null;
 const normalizedQuestion=normalize(question),namedChunks=(corpus.chunks??[]).filter(chunk=>chunk.demoIndexStatus==='PASS'
   &&(chunk.aliases??[]).some(alias=>normalize(alias).length>=2&&normalizedQuestion.includes(normalize(alias))));
  const namedTopics=new Set(namedChunks.map(chunk=>chunk.topic));
  if(asksCauseList){
   if(namedTopics.size!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
   const topic=[...namedTopics][0],namedAliases=[...new Set(namedChunks.filter(chunk=>chunk.topic===topic)
    .flatMap(chunk=>[chunk.title_ko,...(chunk.aliases??[])])
    .filter(alias=>typeof alias==='string'&&normalize(alias).length>=2&&normalizedQuestion.includes(normalize(alias))))];
   const matches=[];
   for(const chunk of corpus.chunks??[]){
    if(chunk.topic!==topic||chunk.demoIndexStatus!=='PASS'||typeof chunk.text_ko!=='string'
     ||sha256(chunk.text_ko)!==chunk.textSha256)continue;
    const sentences=completeSentences(chunk.text_ko);
    for(let sentenceIndex=0;sentenceIndex<sentences.length;sentenceIndex++){
     const sentence=sentences[sentenceIndex],normalizedSentence=normalize(sentence.replace(/\([^)]*\)/gu,''));
     if(!isEnumeratedCauseSentence(sentence)||!namedAliases.some(alias=>{
      const term=normalize(alias);return normalizedSentence.startsWith(term)&&/^(?:의|은|는|이|가)/u.test(normalizedSentence.slice(term.length));
     }))continue;
     matches.push({chunk,sentenceIndex,sentence});
    }
   }
   const uniqueSentences=new Map(matches.map(match=>[normalize(match.sentence),match]));
   if(uniqueSentences.size!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
   const selected=[...uniqueSentences.values()].sort((a,b)=>Number(b.chunk.ai_qa_status==='PASS')-Number(a.chunk.ai_qa_status==='PASS')
    ||a.chunk.chunk_id.localeCompare(b.chunk.chunk_id))[0];
   return {status:'CANDIDATE',topic,intent:'CAUSES',focus:['CAUSE_LIST'],claimEvidenceRequired:true,
    evidence:[{...selected.chunk,allowedSentenceIndexes:[selected.sentenceIndex],
     focusSentenceIndexes:{CAUSE_LIST:[selected.sentenceIndex]}}]};
  }
  const normalizedQuestionTerms=koreanSearchTerms(question),namedAliasTerms=new Set(namedChunks.flatMap(chunk=>chunk.aliases??[]).flatMap(koreanSearchTerms));
  const genericQuestionTerms=new Set(['원인','이유','왜','어째서','때문','궁금해요','궁금','설명','알려','무엇','무슨','어떤']);
  if(namedTopics.size===1&&normalizedQuestionTerms.every(term=>namedAliasTerms.has(term)||genericQuestionTerms.has(term)))return null;
 const relationQuestion=asksCause||asksLocation||asksRelation||asksDiseaseDefinition;
 const index=koreanDefinitionLookupIndex(corpus),queryTerms=koreanSearchTerms(question)
  .filter(term=>relationQuestion||(index.documentFrequency.get(term)??0)<=index.topicCount*.3);
 if(queryTerms.length<2)return null;
 const idf=term=>Math.log(1+index.topicCount/(1+(index.documentFrequency.get(term)??0)));
 const totalWeight=queryTerms.reduce((sum,term)=>sum+idf(term),0),matches=new Map();
 for(const term of queryTerms)for(const entry of index.postings.get(term)??[]){
  const found=matches.get(entry)??new Set();found.add(term);matches.set(entry,found);
 }
  const bestByTopic=new Map();
  for(const [entry,matched]of matches){
   if(matched.size<2||![...matched].some(term=>(index.documentFrequency.get(term)??0)<=index.topicCount*.1))continue;
   const sentence=completeSentences(entry.chunk.text_ko)[entry.sentenceIndex]??'';
    if(asksForNamedTest(question)&&!sourceNamesSpecificTest(entry.chunk.title_ko,sentence))continue;
    if(asksDiseaseDefinition){
     const sentenceWithoutParenthetical=normalize(sentence.replace(/\([^)]*\)/gu,''));
     const startsWithNamedDisease=(entry.chunk.aliases??[]).some(alias=>{
      if(!hasKorean(alias))return false;
      const normalizedAlias=normalize(alias);
      return sentenceWithoutParenthetical.startsWith(normalizedAlias)
       &&/^(?:은|는|이|가)/u.test(sentenceWithoutParenthetical.slice(normalizedAlias.length));
     });
     if(!startsWithNamedDisease||matched.size<Math.min(4,queryTerms.length))continue;
    }
    if(asksCause&&!/(?:원인|이유|일으키|유발|때문|발생|형성|도움)/u.test(sentence))continue;
    if(asksCauseList&&!isEnumeratedCauseSentence(sentence))continue;
    if(asksLocation&&!/(?:위|아래|뒤|앞|위쪽|아래쪽|위치)/u.test(sentence))continue;
    if(asksRelation&&!/(?:영향|분비|이동|운반|형성|구성|포함|조절|관계|연관)/u.test(sentence))continue;
   const sentenceSubject=sentence.match(/^([가-힣]+?)(?:은|는|이|가)\s/u)?.[1]??'';
   if(!/(?:뇌|대동맥|복부|흉부|심장|폐|간|신장|척수|유방|전립선)/u.test(question)
    &&/(?:뇌|대동맥|복부|흉부|심장|폐|간|신장|척수|유방|전립선)/u.test(sentenceSubject))continue;
    const explicitRelation=asksCause?/(?:원인|이유|일으키|유발|때문|발생|형성|도움)/u.test(sentence)
     :asksLocation?/(?:위|아래|뒤|앞|위쪽|아래쪽|위치)/u.test(sentence)
      :/(?:영향|분비|이동|운반|형성|구성\s*요소|이루는|구성하는|조절|포함)/u.test(sentence);
    const firstEntity=queryTerms[0];
     const startsWithFirstEntity=firstEntity&&sentence.trimStart().startsWith(firstEntity);
   const score=[...matched].reduce((sum,term)=>sum+idf(term),0)+(relationQuestion&&explicitRelation?2:0)
    +(relationQuestion&&explicitRelation&&startsWithFirstEntity?3:0),coverage=totalWeight?score/totalWeight:0;
  if(score<5||coverage<.3)continue;
  const topic=entry.chunk.topic,previous=bestByTopic.get(topic);
  if(!previous||score>previous.score||score===previous.score&&coverage>previous.coverage)
   bestByTopic.set(topic,{...entry,score,coverage});
 }
 const ranked=[...bestByTopic.values()].sort((a,b)=>b.score-a.score||String(a.chunk.topic).localeCompare(String(b.chunk.topic)));
 const best=ranked[0];
 if(!best||best.chunk.demoIndexStatus!=='PASS'
  ||sha256(best.chunk.text_ko)!==best.chunk.textSha256)return null;
  const sentenceFor=entry=>completeSentences(entry.chunk.text_ko)[entry.sentenceIndex]??'';
  const sentenceKey=sentence=>sentence.normalize('NFC').toLowerCase().replace(/[\s.!?。！？]/gu,'');
  const definitionEquivalent=(left,right)=>{
   const subject=sentence=>sentence.replace(/\([^)]*\)/gu,'').match(/^([^,，]+?)(?:은|는|이란)\s/u)?.[1]??'';
   const leftSubject=subject(left),rightSubject=subject(right);
   if(!leftSubject||leftSubject!==rightSubject||!/입니다|것입니다|습니다/u.test(left)||!/입니다|것입니다|습니다/u.test(right))return false;
   if(/아니|못|않|없|부족|증가|감소|위험|안전|예방|유발|양성|음성/u.test(`${left} ${right}`))return false;
   const leftTerms=new Set(koreanSearchTerms(left)),rightTerms=new Set(koreanSearchTerms(right));
   const union=new Set([...leftTerms,...rightTerms]),intersection=[...leftTerms].filter(term=>rightTerms.has(term)).length;
   return union.size>0&&intersection/union.size>=.65;
  };
  const bestSentenceKey=sentenceKey(sentenceFor(best)),sameSentence=ranked.filter(candidate=>sentenceKey(sentenceFor(candidate))===bestSentenceKey);
  const sameLocationClaim=(left,right)=>{
   if(!asksLocation)return false;
   const requestedSubject=question.match(/^([가-힣]+?)(?:은|는|이|가)\s/u)?.[1]??'';
   const subject=sentence=>sentence.trim().replace(/\([^)]*\)/gu,'').match(/^([가-힣]+?)(?:은|는|이|가)\s/u)?.[1]??'';
   const directionTerms=new Set(['위','위쪽','아래','아래쪽','뒤','뒤쪽','앞','앞쪽','위치']);
   const requiredTerms=queryTerms.filter(term=>(index.documentFrequency.get(term)??0)<=index.topicCount*.3&&!directionTerms.has(term));
   const locationDirection=sentence=>/(?:아래|아래쪽)/u.test(sentence)?'BELOW':/(?:위|위쪽)/u.test(sentence)?'ABOVE'
    :/(?:뒤|뒤쪽)/u.test(sentence)?'BEHIND':/(?:앞|앞쪽)/u.test(sentence)?'IN_FRONT':null;
   const supported=sentence=>normalize(subject(sentence))===normalize(requestedSubject)&&requiredTerms.every(term=>koreanSearchTerms(sentence).includes(term))
    &&locationDirection(sentence)===locationDirection(question)&&!/아니|못|않|없/u.test(sentence);
   return Boolean(requestedSubject&&supported(sentenceFor(left))&&supported(sentenceFor(right)));
  };
  const equivalentSentences=ranked.filter(candidate=>definitionEquivalent(sentenceFor(best),sentenceFor(candidate))
   ||sameLocationClaim(best,candidate));
  for(const candidate of equivalentSentences)if(!sameSentence.includes(candidate))sameSentence.push(candidate);
  const competingSentence=ranked.find(candidate=>!sameSentence.includes(candidate));
  if(competingSentence&&competingSentence.score>=best.score*.83)return null;
 const selected=sameSentence.sort((a,b)=>Number(b.chunk.ai_qa_status==='PASS')-Number(a.chunk.ai_qa_status==='PASS')
  ||String(a.chunk.topic).localeCompare(String(b.chunk.topic)))[0];
  return {status:'CANDIDATE',topic:selected.chunk.topic,intent:asksCause?'CAUSES':'UNDERSTAND',focus:[],evidence:[{...selected.chunk,
  allowedSentenceIndexes:[selected.sentenceIndex],focusSentenceIndexes:{}}],claimEvidenceRequired:true};
}
function asksForNamedTest(question){
 return /(?:어떤|무슨).{0,12}검사|(?:무엇|뭐).{0,12}검사|검사(?:는|가)?\s*(?:무엇|어떤|무슨)/u.test(question);
}
function sourceNamesSpecificTest(title,sentence){
 return /(?:\b(?:CT|MRI|A1C|CBC|PCR|PET|SPECT|ECG|EKG)\b|컴퓨터단층촬영|자기공명영상|엑스선|엑스레이|당화혈색소|[가-힣]{2,}검사)/iu.test(`${title??''} ${sentence??''}`);
}
function translationAliases(values,translatedText){
 const unique=new Map();
 for(const value of values){
  if(typeof value!=='string'||value.length<2||value.length>100)continue;
  const compact=normalizeAlias(value);
  const translatedAbbreviation=/^[a-z][a-z0-9.+-]{1,15}$/iu.test(value)&&normalizeAlias(translatedText).includes(compact);
  if(!hasKorean(value)&&!translatedAbbreviation)continue;
  unique.set(compact,value);
 }
 return [...unique.values()];
}
const CLINICAL_COLLOQUIAL_ALIASES=Object.freeze({
 '간경변증':['간경화','복수','간이 굳음','배에 물이 참','간섬유화'],
 '간 질환':['간질환','간 수치','간수치','피검사 간 수치','간기능 이상','간 손상'],
 '간암':['간의 암','간 종양','간세포암'],
 '황달':['눈이 노람','피부가 노람','눈 흰자위 노란색','노란 피부','노란 소변','몸이 노람'],
 '지방간질환':['지방간','비알코올성 지방간'],
 'B형 간염':['B형간염','만성 B형간염'],
 'C형 간염':['C형간염','만성 C형간염'],
 '고혈압':['혈압이 높음','높은 혈압'],
 '천식':['숨이 참','숨이 차요','쌕쌕거림','천명음','숨쉬기 힘듦'],
 '위식도역류질환':['역류성 식도염','식도염','위산 역류','속쓰림','신물 올라옴'],
 '제2형 당뇨병':['제2형 당뇨','제이형 당뇨병','2형 당뇨병','2형 당뇨','혈당 높음','공복혈당'],
 '빈혈':['철분 부족','어지럼증','헤모글로빈 낮음','피가 부족'],
 '소변검사':['요검사','소변 검사','소변 색','단백뇨','혈뇨'],
});

function koreanTitleAliases(title){
 if(typeof title!=='string')return [];
 const parenthetical=(title.match(/\([^()]{2,16}\)/g)??[]).map(value=>value.slice(1,-1));
 const base=title.replace(/\([^)]*\)/g,'').trim();
 const colloquial=CLINICAL_COLLOQUIAL_ALIASES[title]??CLINICAL_COLLOQUIAL_ALIASES[base]??[];
 const translatedSynonyms=title==='백신'?['예방접종']:[];
 return [...parenthetical,...colloquial,...translatedSynonyms];
}
function coordinatedConceptPairs(question){
 const atom='(?:[A-Za-z][A-Za-z0-9.+-]*[가-힣]+|[A-Za-z][A-Za-z0-9.+-]{1,}|[가-힣]{2,})';
 const pairs=[],seen=new Set(),stop=new Set(['무엇','뭐','어떤','무슨','어느','어디','관계','차이','차이점','비교','모두','둘다','같은','다른']);
 const patterns=[new RegExp(`(${atom})(?:은|는)\\s+(${atom})(?:과|와)`,'gu'),
  new RegExp(`(${atom})(?:과|와|및|그리고)\\s*(${atom})`,'gu')];
 for(const [patternIndex,pattern] of patterns.entries())for(const match of question.matchAll(pattern)){
  // In "allergy is influenced by genes and environment", the first clause
  // relates the topic to the first conjunct; only genes and environment are
  // the coordinated pair. The second pattern captures that pair below.
  if(patternIndex===0&&/^\s*[가-힣]{2,}(?:은|는|이|가|을|를|의|에|에서|으로|로)(?:\s|$)/u
   .test(question.slice(match.index+match[0].length)))continue;
  const stripParticle=value=>value.replace(/(?:은|는|이|가|을|를|의|에|와|과|으로|로)$/u,'');
  const left=stripParticle(match[1]),right=stripParticle(match[2]),key=`${normalize(left)}|${normalize(right)}`;
  if(left.length<2||right.length<2||stop.has(left)||stop.has(right)||seen.has(key))continue;
  seen.add(key);pairs.push([left,right]);
 }
 return pairs;
}
function coordinatedConceptsAreSupported(question,evidence){
 const pairs=coordinatedConceptPairs(question);if(!pairs.length)return true;
 const requiresSingleSentence=/차이|차이점|비교|둘\s*다|모두|같은|동일|중\s*(?:어떤|무엇|어느|더)/u.test(question);
 const evidenceSentenceGroups=evidence.map(chunk=>{
  const sentences=completeSentences(chunk.text_ko);
  return {sentences,indexes:chunk.allowedSentenceIndexes??[]};
 });
 return pairs.every(([left,right])=>{
  const leftTerm=normalize(left),rightTerm=normalize(right);
  const sameSentence=evidenceSentenceGroups.some(({sentences,indexes})=>indexes.some(index=>{
   const sentence=normalize(sentences[index]??'');return sentence.includes(leftTerm)&&sentence.includes(rightTerm);
  }));
  if(sameSentence||requiresSingleSentence)return sameSentence;
  return evidenceSentenceGroups.some(({sentences,indexes})=>indexes.some(index=>{
   if(!indexes.includes(index+1))return false;
   const combined=`${normalize(sentences[index]??'')}${normalize(sentences[index+1]??'')}`;
   return combined.includes(leftTerm)&&combined.includes(rightTerm);
  }));
 });
}

function hasUnsupportedScopeQualifier(question,evidence){
 const scopePatterns=[/(?<!관계)(?<!상관)(?<!무관)없이|없어도|없는데|없는\s*(?:상태|경우|사람|동안|때)/gu,
  /중\s*하나만|하나만|한\s*가지만|단독으로|유일(?:한|하게)|오직|뿐(?!만\s*아니라)|(?<!하나)(?<!뿐)(?<!지)만(?=(?:이|은|는|을|를|으로|도)?\s)/gu,
  /모든|모두|전부|항상|언제나|늘|절대|무조건|대부분|주로|흔히|자주|종종|드물게|가끔|일반적으로|대개|가장\s*흔한|가장\s*많은|보통/gu];
 const questions=[...scopePatterns.flatMap(pattern=>[...question.matchAll(pattern)])].filter(scope=>{
  if(scope[0]!=='만')return true;
  const preceding=question.slice(Math.max(0,scope.index-2),scope.index+1).replace(/\s+/gu,'');
  return !/^(?:비만|분만|미만|수만|백만|천만)$/u.test(preceding);
 });
 if(!questions.length)return false;
 const sentences=evidence.flatMap(chunk=>{
  const all=completeSentences(chunk.text_ko);
  return (chunk.allowedSentenceIndexes??[]).map(index=>all[index]??'');
 });
 return questions.some(scope=>{
  const before=question.slice(0,scope.index);
  const particle=/(?:들에게|에게|한테|께서|으로|에서|께|은|는|이|가|을|를|의|에|와|과|로|도|만)$/u;
  const beforeMatch=before.match(/([가-힣]{2,}|[A-Za-z][A-Za-z0-9.+-]*)\s*$/u);
  const afterMatch=question.slice(scope.index+scope[0].length).match(/^\s*([가-힣]{2,}|[A-Za-z][A-Za-z0-9.+-]*)/u);
  const anchor=(beforeMatch?.[1]??afterMatch?.[1]??'').replace(particle,'');
  if(!anchor)return true;
  const token=scope[0].replace(/\s+/gu,'');
  const absenceScope=/^(?:없이|없어도|없는데|없는)/u.test(token);
  const exclusiveScope=/^(?:중하나만|하나만|한가지만|단독으로|유일한|유일하게|오직|뿐|만)$/u.test(token);
  const directlySupported=sentence=>{
   const normalizedSentence=normalize(sentence);
   if(absenceScope){
    const marker=token.startsWith('없이')?/없이/u:token.startsWith('없어도')?/없어도|없더라도/u
     :token.startsWith('없는데')?/없는데/u:/없는\s*(?:상태|경우|사람|동안|때)/u;
    return marker.test(sentence);
   }
   if(exclusiveScope)return normalizedSentence.includes(token)
    ||/(?:모두|둘\s*다|각각|여러|복수|세\s*가지|다양|그\s*외|이외|또\s*다른|나머지)/u.test(sentence);
   return normalizedSentence.includes(token);
  };
  return !sentences.some(sentence=>normalize(sentence).includes(normalize(anchor))&&directlySupported(sentence));
 });
}

function hasAmbiguousNestedNegation(question){
 const clauses=question.split(/[.!?。！？,，;；]|그러나|하지만|그렇지만|반면|다만|지만/gu);
 return clauses.some(clause=>[...clause.matchAll(/아닌|아닙|아니|않|못|없/gu)].length>=2);
}

// The school demo receives a projection with Korean translation text only.
// English source text remains available in the ignored import artifact for provenance,
// but is removed before retrieval and before any model payload is constructed.
export function translationOnlyDemoCorpus(corpus,{includeQaHolds=false}={}){
 if(!corpus||corpus.status!=='DRAFT / UNASSIGNED'||!Array.isArray(corpus.chunks)||!Array.isArray(corpus.held))
  throw Error('TRANSLATION_CORPUS_INVALID');
 const translatedByDocument=new Map();
 for(const chunk of corpus.chunks){
  if(typeof chunk.doc_id!=='string'||typeof chunk.text_ko!=='string'||sha256(chunk.text_ko)!==chunk.textSha256)
   throw Error('UPLOAD_CORPUS_TEXT_HASH_MISMATCH');
  if(hasKorean(chunk.text_ko))translatedByDocument.set(chunk.doc_id,`${translatedByDocument.get(chunk.doc_id)??''}\n${chunk.title_ko??''}\n${chunk.text_ko}`);
 }
 const heldDocumentById=new Map((corpus.heldDocuments??[]).map(document=>[document.id,document]));
 const held=corpus.held.map(document=>{
  const full=heldDocumentById.get(document.id);
  const translatedText=(full?.segments??[]).map(segment=>segment.text_ko??'').join('\n');
  return {id:document.id,title:document.title,source_url:document.source_url,status:'HOLD',reason:document.reason,
   aiQaStatus:full?.aiQaStatus??document.aiQaStatus??'HOLD',
   sourceContentReview:full?.sourceContentReview??document.sourceContentReview??'HOLD',
   unresolvedIssueCount:Array.isArray(full?.unresolvedIssues)?full.unresolvedIssues.length:Array.isArray(document.unresolvedIssues)?document.unresolvedIssues.length:0,
   aliases:translationAliases([document.title,...koreanTitleAliases(document.title),...(document.aliases??[])],translatedText)};
 });
 let excludedNonKoreanChunks=corpus.chunks.filter(chunk=>!hasKorean(chunk.text_ko)).length;
 const chunks=corpus.chunks.map(chunk=>{
  const translatedText=translatedByDocument.get(chunk.doc_id)??chunk.text_ko;
  return {chunk_id:chunk.chunk_id,doc_id:chunk.doc_id,topic:chunk.topic,title_ko:chunk.title_ko,text_ko:chunk.text_ko,
   textSha256:chunk.textSha256,source_url:chunk.source_url,source_updated_at:chunk.source_updated_at??null,
   source_segment_ids:chunk.source_segment_ids??[],segmentOffset:chunk.segmentOffset??0,
   section_path:(chunk.section_path??[]).filter(hasKorean),
   aliases:translationAliases([chunk.title_ko,...koreanTitleAliases(chunk.title_ko),...(chunk.aliases??[])],translatedText),
   ai_qa_status:chunk.ai_qa_status,contentReview:chunk.contentReview,sourceContentReview:'UNASSIGNED',
   unresolvedIssueCount:0,demoIndexStatus:hasKorean(chunk.text_ko)?'PASS':'NOT_TRANSLATED',
   schoolDemoCandidateStatus:includeQaHolds&&hasKorean(chunk.text_ko)?'PASS':'NOT_APPLICABLE',
   attribution:chunk.attribution,rights_policy_url:chunk.rights_policy_url,translation_notice:chunk.translation_notice};
 }).filter(chunk=>chunk.demoIndexStatus==='PASS');
 const heldChunks=[];
 for(const document of includeQaHolds?(corpus.heldDocuments??[]):[]){
  const translatedText=(document.segments??[]).map(segment=>segment.text_ko??'').join('\n');
  const aliases=translationAliases([document.title,...(document.aliases??[])],translatedText);
  for(const segment of document.segments??[]){
   if(typeof segment.source_segment_id!=='string'||typeof segment.text_ko!=='string'||!segment.text_ko.trim())
    throw Error('UPLOAD_TRANSLATION_SEGMENT_INVALID');
   const chars=Array.from(segment.text_ko);
   for(let offset=0;offset<chars.length;offset+=1200){
    const text=chars.slice(offset,offset+1200).join('');
    if(!hasKorean(text)){excludedNonKoreanChunks++;continue;}
    heldChunks.push({chunk_id:`upload-${document.id}-${segment.source_segment_id}-${offset}`,
     doc_id:document.doc_id,topic:document.id,title_ko:document.title,text_ko:text,textSha256:sha256(text),
     source_url:document.source_url,source_updated_at:document.source_updated_at??null,
     section_path:[],aliases,ai_qa_status:document.aiQaStatus??'HOLD',
     contentReview:document.contentReview??'UNASSIGNED',sourceContentReview:document.sourceContentReview??'HOLD',
     unresolvedIssueCount:Array.isArray(document.unresolvedIssues)?document.unresolvedIssues.length:0,
     demoIndexStatus:'PASS',schoolDemoCandidateStatus:includeQaHolds?'PASS':'NOT_APPLICABLE',attribution:'Source: MedlinePlus, National Library of Medicine.',
     rights_policy_url:document.rights_policy_url??POLICY,
     translation_notice:document.translation_notice??'사용자 제공 AI 한국어 번역 · 공식 번역 아님 · 의료전문가 검수 미실시 · 학교 발표용 비임상 데모.'});
   }
  }
 }
 chunks.push(...heldChunks);
 const heldDocuments=(corpus.heldDocuments??[]).map(document=>({id:document.id,doc_id:document.doc_id,title:document.title,source_url:document.source_url,
  status:'HOLD',schoolDemoCandidateStatus:includeQaHolds?'PASS':'NOT_APPLICABLE',reason:document.reason,aiQaStatus:document.aiQaStatus??'HOLD',
  sourceContentReview:document.sourceContentReview??'HOLD',unresolvedIssueCount:Array.isArray(document.unresolvedIssues)?document.unresolvedIssues.length:0,
  schoolDemoRetrievable:includeQaHolds,clinicalUse:false,
  segments:(document.segments??[]).map(segment=>({source_segment_id:segment.source_segment_id,text_ko:segment.text_ko}))}));
 const indexedDocuments=new Set(chunks.map(chunk=>chunk.doc_id)).size;
 return {version:corpus.version,status:corpus.status,language:'ko',retrievalCorpus:'TRANSLATION_ONLY',clinicalUse:false,
  serviceDeployment:false,indexScope:includeQaHolds?'SCHOOL_DEMO_ALL_TRANSLATIONS':'QA_PASS_TRANSLATIONS_ONLY',demoIndexStatus:'PASS',
  demoIndexStatusMeaning:'Korean translated text integrity and indexing only; not content, medical, rights, or clinical approval.',
  schoolDemoCandidateStatus:includeQaHolds?'PASS':'NOT_APPLICABLE',
  schoolDemoCandidateStatusMeaning:'Accepted into the school-demo RAG candidate corpus only; this is not translation accuracy, content QA, rights, medical, or clinical approval.',
  totalDocuments:corpus.totalDocuments,registeredDocuments:corpus.registeredDocuments,indexedDocuments,
  demoIndexPassDocuments:indexedDocuments,excludedNonKoreanChunks,held,heldDocuments,chunks};
}

export function buildUploadedCorpus(documents){
 const seen=new Set(),urls=new Set(),chunks=[],held=[],heldDocuments=[];
 for(const d of documents){
  const id=String(d.source_topic_id),url=new URL(d.source_url);
  if(!/^\d{1,8}$/.test(id)||seen.has(id)||urls.has(url.href)||url.protocol!=='https:'||url.hostname!=='medlineplus.gov'
   ||url.port||url.username||url.password||url.search||url.hash||!/^\/[a-z0-9]+\.html$/.test(url.pathname)
   ||d.collection!=='MedlinePlus Health Topics'||!(d.language==='Korean'&&d.source_language==='English'
     ||d.language==='English'&&d.source_language===undefined&&d.rights_status==='public_domain_us_confirmed_scope')
   ||!RIGHTS.has(d.rights_status)||d.rights_policy_url!==POLICY||typeof d.full_summary_html_en!=='string'
   ||typeof d.title_en!=='string'||typeof d.title_ko!=='string'||!d.title_ko.trim()||!Array.isArray(d.segments))throw Error('UPLOAD_DOCUMENT_REJECTED');
  seen.add(id);urls.add(url.href);
  const expected=d.source_hash_scope?.startsWith('SHA-256 of UTF-8 title_en')
   ?sha256(d.title_en+'\n'+d.full_summary_html_en):sha256(JSON.stringify({full_summary_html:d.full_summary_html_en,title:d.title_en}));
  if(expected!==d.source_hash)throw Error('UPLOAD_SOURCE_HASH_MISMATCH');
  const isHeld=d.ai_qa_status!=='PASS'||!Array.isArray(d.unresolved_issues)||d.unresolved_issues.length
   ||['HOLD','FAIL'].includes(d.source_content_review_status)||['/highbloodpressure.html','/insomnia.html'].includes(url.pathname);
  const aliases=[d.title_ko,d.title_ko.replace(/\([^)]*\)/g,''),...(d.title_ko.match(/\([^()]{2,16}\)/g)??[]).map(t=>t.slice(1,-1)),
   ...(Array.isArray(d.generated_search_synonyms_ko)?d.generated_search_synonyms_ko:[])].filter(t=>typeof t==='string'&&t.length>=2&&t.length<=100);
  if(isHeld){
   const reason={id,title:d.title_ko,title_en:d.title_en,source_url:url.href,status:'HOLD',reason:'CONTENT_OR_TRANSLATION_HOLD',
    aiQaStatus:d.ai_qa_status,sourceContentReview:d.source_content_review_status??'UNASSIGNED',unresolvedIssues:d.unresolved_issues??[],aliases};
   held.push(reason);heldDocuments.push({...reason,doc_id:d.doc_id,source_hash:d.source_hash,contentReview:'UNASSIGNED',clinicalUse:false,
    answerEligible:false,translation_notice:d.translation_notice,segments:d.segments.map(s=>({source_segment_id:s.source_segment_id,text_en:s.text_en,text_ko:s.text_ko}))});
  }
  const segmentIds=new Set();
  for(const s of d.segments){
   if(typeof s.source_segment_id!=='string'||segmentIds.has(s.source_segment_id)||typeof s.text_ko!=='string'||!s.text_ko.trim()
    ||typeof s.text_en!=='string'||/[<>\u0000-\u0008]/u.test(s.text_ko))throw Error('UPLOAD_SEGMENT_REJECTED');
   segmentIds.add(s.source_segment_id);
   if(isHeld)continue; // Retained in registry, never indexed as answer evidence.
   const chars=Array.from(s.text_ko);
   for(let offset=0;offset<chars.length;offset+=1200){
    const text=chars.slice(offset,offset+1200).join('');
    chunks.push({chunk_id:`upload-${id}-${s.source_segment_id}-${offset}`,doc_id:d.doc_id,topic:id,title_ko:d.title_ko,
     text_ko:text,textSha256:sha256(text),source_hash:d.source_hash,source_url:url.href,source_updated_at:d.source_updated_at??null,
     source_segment_ids:[s.source_segment_id],segmentOffset:offset,section_path:s.section_path_ko??s.section_path_en??[],
     aliases,
     ai_qa_status:'PASS',contentReview:'UNASSIGNED',candidateOrigin:'UPLOADED_TRANSLATION',clinicalUse:false,
     attribution:'Source: MedlinePlus, National Library of Medicine.',rights_policy_url:POLICY,
     translation_notice:'사용자 제공 AI 한국어 번역 · NLM 공식 번역 아님 · 의료전문가 검수 미실시 · 개발 검토용.'});
   }
  }
 }
 return {version:'medlineplus-upload-ko-20261012-v3',status:'DRAFT / UNASSIGNED',clinicalUse:false,serviceDeployment:false,
  totalDocuments:documents.length,registeredDocuments:documents.length,indexedDocuments:new Set(chunks.map(c=>c.doc_id)).size,held,heldDocuments,chunks};
}
export async function loadUploadedCorpus(folder,{includeQaHolds=false}={}){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const bytes=await readFile(new URL('corpus.json',folder));
 if(sha256(bytes)!==manifest.corpusSha256)throw Error('UPLOAD_CORPUS_HASH_MISMATCH');
 const corpus=JSON.parse(bytes);
 if(corpus.status!=='DRAFT / UNASSIGNED'||corpus.clinicalUse!==false||corpus.serviceDeployment!==false)throw Error('UPLOAD_REVIEW_STATE_REJECTED');
 return translationOnlyDemoCorpus(corpus,{includeQaHolds});
}
const normalize=s=>s.toLowerCase().replace(/\s+/g,'');
const completeSentences=text=>text.match(/[^.!?。！？]+[.!?。！？]+/gu)??[];
function exactTitleExplanation(question,chunks){
 const normalized=normalize(question).replace(/[.!?？。]+$/gu,'');
 const suffixes=['에대해서설명해주세요','에대해설명해주세요','에대해서설명해줘','에대해설명해줘',
  '에대한설명','설명해주시겠어요','설명해주세요','설명해줘','설명',
  '에대해서알려주세요','에대해알려주세요','에대해서알려줘','에대해알려줘','에대해서알려달라','에대해알려달라',
  '알려주세요','알려줘요','알려줘','알려달라',
  '에대해서궁금해요','에대해궁금해요','궁금해요','궁금합니다','궁금해'];
 const suffix=suffixes.find(value=>normalized.endsWith(value));
 const requestedTitle=suffix?normalized.slice(0,-suffix.length):normalize(normalizeKoreanQuery(question));
 if(!requestedTitle)return null;
 const isComplexQuery=/(?:차이|비교|증상|원인|이유|기관|어디|누구|몇|어떻게|수치|확진|판정)/u.test(question);
 if(isComplexQuery)return null;
 const matches=(chunks??[]).filter(chunk=>chunk.demoIndexStatus==='PASS'
  &&normalize(chunk.title_ko??'')===requestedTitle
  &&typeof chunk.text_ko==='string'&&sha256(chunk.text_ko)===chunk.textSha256&&hasKorean(chunk.text_ko));
 const identities=new Set(matches.map(chunk=>`${chunk.doc_id}:${chunk.topic}`));
 if(identities.size!==1)return null;
 return matches.sort((a,b)=>a.chunk_id.localeCompare(b.chunk_id))[0];
}
function explicitShortTitleDefinition(question,chunks){
 const normalizedQuestion=normalize(question).replace(/[.!?？。]+$/gu,'');
 if(!/(?:무엇|뭐|뜻|정의|설명|어떤)/u.test(normalizedQuestion))return null;
 const matches=(chunks??[]).filter(chunk=>{
  const title=chunk.title_ko??'';
  if(Array.from(title).length!==1||chunk.demoIndexStatus!=='PASS'||chunk.ai_qa_status!=='PASS'
   ||chunk.sourceContentReview==='HOLD'||chunk.unresolvedIssueCount>0||sha256(chunk.text_ko)!==chunk.textSha256)return false;
  const normalizedTitle=normalize(title);
  if(!normalizedQuestion.startsWith(normalizedTitle))return false;
  return /^(?:은|는|이란|란|이|가)(?:무엇|뭐|뜻|정의|설명|어떤)/u.test(normalizedQuestion.slice(normalizedTitle.length));
 });
 const identities=new Set(matches.map(chunk=>`${chunk.doc_id}:${chunk.topic}`));
 return identities.size===1?{title:matches[0].title_ko,topic:matches[0].topic}:null;
}
function isPersonalHealthQuestion(question){
 const personal=/(?:^|[\s,])(?:내(?=\s)|내가|나는|나의|제(?=\s)|제가|제는|저는|저의|저(?=\s)|저희|우리\s*(?:아이|아기|엄마|아빠|어머니|아버지))(?=\s|[가-힣])/u.test(question);
 const healthContext=/(?:증상|결과|수치|정상|진단|질환|병력|치료|복용|약(?:을|은|는|이|도)|검사|임신|\bCT\b|\bMRI\b|X\s*선|엑스선)/iu.test(question);
 const pregnancyState=/임신\s*(?:중|중인데|했는데|한\s*상태)/u.test(question);
 const imagingCompatibility=/(?:\bCT\b|컴퓨터\s*단층촬영).{0,30}(?:받아도|받을\s*수|가능|괜찮|해도\s*되)|(?:받아도|받을\s*수|가능|괜찮|해도\s*되).{0,30}(?:\bCT\b|컴퓨터\s*단층촬영)/iu.test(question);
 return personal&&healthContext||pregnancyState&&imagingCompatibility;
}
function isUnsupportedModalityComparison(question){
 const modalities=[/\bCT\b|컴퓨터\s*단층촬영/iu,/\bMRI\b|자기공명/iu,
  /\bX\s*-?\s*ray\b|\bX\s*선|엑스레이|엑스선/iu,/초음파/u];
 // A single-source retrieval cannot safely answer questions that name multiple
 // imaging modalities, even when the user omits an explicit comparison word.
 return modalities.filter(pattern=>pattern.test(question)).length>1;
}
function hasUnindexedNamedExam(question,corpus){
 const references=[
  {question:/\bAFP\b|알파\s*태아단백|태아단백/iu,source:/\bAFP\b|알파\s*태아단백|태아단백/iu},
  {question:/간\s*초음파/u,source:/간.{0,12}초음파|초음파.{0,12}간/u},
 ];
 return references.some(reference=>reference.question.test(question)
  &&!corpus.chunks.some(chunk=>reference.source.test(`${chunk.title_ko??''} ${(chunk.aliases??[]).join(' ')}`))
  &&!(corpus.held??[]).some(document=>reference.source.test(`${document.title??''} ${(document.aliases??[]).join(' ')}`)));
}
function isMedicationUseQuestion(question){
 const medication=/(?:(?<![가-힣])약(?:[은는이가을를도과와에]|이나|으로)?(?![가-힣])|약물|의약품|기침약|항생제|진통제|철분|인슐린|주사|백신|예방접종)/u.test(question);
 const doseOrUse=/(?:얼마나|얼마(?:를|만큼)?|몇\s*(?:mg|g|ml|알|정|회|번|차)|용량|복용량|하루에?\s*몇|횟수|언제.{0,12}(?:먹|복용|투여|사용|맞|접종|주사)|먹(?:어도|으면|어야|나요)|복용|투여|사용해도|맞아도|맞아야|접종해야)/u.test(question);
 return medication&&doseOrUse;
}
function isMedicalInterventionRecommendation(question){
 const healthTopic=/(?:[가-힣]{2,}(?:병|질환|질병|장애|암|감염|증후군)|증상|혈압|혈당|혈전|빈혈|알레르기|천식|기침|감기|간|신장|심장|통증|뇌졸중)/u.test(question);
 const intervention=/(?:(?<![가-힣])약(?:[은는이가을를도과와에]|이나|으로)?(?![가-힣])|약물|의약품|철분|비타민|인슐린|항생제|진통제|운동|식단|음식|식품|영양제|보충제|요법|치료법|예방접종|백신|고치|낫|없애)/u.test(question);
 const asksForRecommendation=/(?:해야|하려면|먹어야|복용해야|투여해야|맞아야|접종해야|추천|권장|예방|방지|치료|고치|낫|낮추|높이|조절|관리|개선|도움.{0,6}(?:되|될|있)|효과.{0,6}(?:있|좋)|좋(?:은|을까요|나요)|막|생기지\s*않|발생하지\s*않|줄이|없애)/u.test(question);
 return healthTopic&&intervention&&asksForRecommendation;
}
function isVaccineSafetyQuestion(question){
 return /(?:백신|예방접종)/u.test(question)&&/(?:안전|위험|부작용|알레르기|반응)/u.test(question);
}
function isVaccineRecommendationQuestion(question){
 return /(?:백신|예방접종)/u.test(question)&&/(?:맞아야|접종해야|추천|권장|맞는\s*게\s*좋|받는\s*게\s*좋|해도\s*되)/u.test(question);
}
function isUnsupportedIronAnemiaInference(question){
 const mentionsPair=/(?:철분.{0,12}부족.{0,20}빈혈|빈혈.{0,20}철분.{0,12}부족)/u.test(question);
 const asksIronConditionName=/철분.{0,16}(?:부족|결핍).{0,20}(?:무엇이라고|무엇으로|어떻게).{0,12}(?:부르|말하)/u.test(question);
 return mentionsPair&&/(?:이면|라면|같(?:은|나요)|동일|이지|뜻|의미)/u.test(question)||asksIronConditionName;
}
function isUnsupportedReverseCauseInference(question){
 const anemiaAsCauseOfItsKnownCauses=/빈혈.{0,24}(?:때문에|로\s*인해|탓에).{0,28}(?:철분.{0,8}(?:부족|결핍)|혈액\s*손실)/u.test(question)
  ||/빈혈.{0,24}(?:철분.{0,8}(?:부족|결핍)|혈액\s*손실).{0,12}(?:의\s*원인|을\s*(?:유발|일으키|초래))/u.test(question);
 return anemiaAsCauseOfItsKnownCauses;
}
function isUnsupportedReverseAllergyRelation(question){
 return /알레르기(?:가|는)\s*(?:유전자(?:와|과)?\s*)?(?:환경|유전자)(?:에|을).{0,8}영향/u.test(question);
}
function sourceLookupCandidate(chunk){
 return {status:'CANDIDATE',topic:chunk.topic,intent:'UNDERSTAND',focus:[],evidence:[chunk],
  extractiveOnly:true,sourceLookupOnly:true};
}
function hasUnscopedNumber(question,corpus){
 if(!/\d/u.test(question))return false;
 const normalized=normalize(question),aliases=[...(corpus.chunks??[]).flatMap(c=>c.aliases??[]),
  ...(corpus.held??[]).flatMap(d=>d.aliases??[])];
 return !aliases.some(alias=>{
  if(typeof alias!=='string'||!/[a-z가-힣]/iu.test(alias)||!/[0-9]/u.test(alias))return false;
  const topic=normalize(alias),index=normalized.indexOf(topic);if(index<0)return false;
  const remainder=normalized.slice(0,index)+normalized.slice(index+topic.length);
  return !/\d/u.test(remainder);
 });
}
function mriListContextChunks(chunks,topic){
 const source=chunks.filter(chunk=>chunk.topic===topic&&Array.isArray(chunk.source_segment_ids)),derived=[];
 for(let index=0;index<source.length;index++){
  const header=source[index],removalHeader=/^MRI 전에는 다음과 같은 물품을 제거해야 합니다\.$/u.test(header.text_ko),
   disclosureHeader=/^MRI 전에 다음에 해당하면 의료진에게 알리세요\.$/u.test(header.text_ko);
  if(!removalHeader&&!disclosureHeader)continue;
  for(let next=index+1;next<source.length;next++){
   const item=source[next];if(item.doc_id!==header.doc_id)break;
   if(/^(?:MRI|자기공명)/u.test(item.text_ko)&&completeSentences(item.text_ko).length)break;
   const itemText=item.text_ko.trim(),isListedItem=removalHeader
    ?/^(?:장신구와 시계|머리핀|보청기)$/u.test(itemText)
    :/^(?:탄환, 파편 또는 다른 금속 조각 같은 금속이 몸속에 있는 경우|심박조율기, 인공관절 또는 다른 삽입물처럼 금속이나 전자장치가 몸속에 있는 경우|문신이나 반영구 화장을 한 경우\. 일부 짙은 색 잉크에는 금속이 들어 있을 수 있기 때문입니다\.)$/u.test(itemText);
   if(!isListedItem)continue;
    const heading=header.text_ko.replace(/\.$/u,'');
    const listItem=item.text_ko.replace(/\.$/u,'');
    const composed=`${heading}: ${listItem}.`;
   derived.push({...header,chunk_id:`${header.chunk_id}::${item.chunk_id}`,text_ko:composed,textSha256:sha256(composed),
    source_segment_ids:[...header.source_segment_ids,...item.source_segment_ids],sourceComposition:'KOREAN_LIST_CONTEXT',
    sourceComponents:[header,item].map(chunk=>({chunkId:chunk.chunk_id,docId:chunk.doc_id,topic:chunk.topic,sourceUrl:chunk.source_url,
     segmentIds:[...(chunk.source_segment_ids??[])],text_ko:chunk.text_ko,textSha256:chunk.textSha256}))});
  }
 }
 return derived;
}
const stripListTerminal=text=>text.replace(/[.:：]$/u,'');
function composedListContextText(components){
 const [heading,...tail]=components,item=tail.at(-1),subheading=tail.length===2?tail[0]:null;
 return `${stripListTerminal(heading.text_ko)}: ${subheading?`${stripListTerminal(subheading.text_ko)}: `:''}${stripListTerminal(item.text_ko)}.`;
}
function translatedListContextChunks(chunks,topic,namedDocumentIds,listType,question){
 const source=chunks.filter(chunk=>chunk.topic===topic&&namedDocumentIds.has(chunk.doc_id)&&chunk.demoIndexStatus==='PASS'
  &&Array.isArray(chunk.source_segment_ids)&&typeof chunk.text_ko==='string'&&sha256(chunk.text_ko)===chunk.textSha256);
 const isSymptomHeader=text=>{
  if(!/(?:증상|징후)/u.test(text))return false;
  const hasListCue=/(?:증상|징후)[^.!?。！？]{0,40}(?:다음과\s*(?:같|같은)|다음이\s*포함)|다음\s*(?:증상|징후)(?:이|가)?\s*(?:포함|나타|있)|다음과\s*같은\s*(?:증상|징후)(?:도|이)?\s*(?:유발|나타|있|포함)|다음과\s*같은\s*모습을\s*(?:보|나타)|증상이\s*있는\s*사람은\s*다음/u.test(text);
  if(!hasListCue)return false;
  const lastCue=text.lastIndexOf('다음'),before=lastCue<0?'':text.slice(Math.max(0,lastCue-28),lastCue),after=lastCue<0?'':text.slice(lastCue,lastCue+48);
  return !/(?:검사|치료|관리|예방|원인|요인|검진|진단|유형|군집|범주)\s*(?:은|는|이|가|을|를)?\s*$/u.test(before)
   &&!/^(?:다음과\s*같은\s*)?(?:검사|치료|관리|예방|원인|요인|진단|유형|군집|범주|내용|항목|방법)/u.test(after)
   &&!/(?:치료\s*계획|치료\s*방법|증상\s*관리|증상을\s*예방|관리하는\s*방법).{0,80}다음/u.test(text)
   // Conditional complications are not the ordinary symptom list for a named topic.
   &&!/(?:치료하지\s*않으면|치료받지\s*않으면|치료를\s*받지\s*않으면)/u.test(text);
 };
 const headingPattern=listType==='SYMPTOM_LIST'?isSymptomHeader
  :text=>/(?:다음\s*위험요인\s*중|다음에\s*해당하면.{0,80}위험(?:이|가)\s*(?:더\s*)?높)/u.test(text);
 const headerIndexes=source.flatMap((chunk,index)=>headingPattern(chunk.text_ko)?[index]:[]),headerIndexSet=new Set(headerIndexes);
 if(!headerIndexes.length){
  if(listType!=='SYMPTOM_LIST'||asksForListCount(question)||namedDocumentIds.size!==1)return null;
  const symptomEnumeration=/^(?=.{1,260}$)(?=.*(?:증상|징후))(?=.*(?:포함될\s*수|포함됩니다|포함합니다|나타날\s*수|나타납니다|증상은\s*다음))(?=.*(?:,| 또는 | 및 )).+$/u;
  const unsafeEnumeration=/(?:부작용|치료|약물|약제|복용|면역요법|항암제|예방접종|백신|진단|검사|위험\s*요인|즉시.{0,20}(?:진료|응급)|의료진.{0,20}(?:상담|연락))/u;
  const inline=[];
  for(const chunk of source){
   if(!namedDocumentIds.has(chunk.doc_id)||chunk.demoIndexStatus!=='PASS'||typeof chunk.text_ko!=='string'
    ||!Array.isArray(chunk.source_segment_ids)||sha256(chunk.text_ko)!==chunk.textSha256)continue;
   const sentences=completeSentences(chunk.text_ko);
   for(let sentenceIndex=0;sentenceIndex<sentences.length;sentenceIndex++){
    const sentence=sentences[sentenceIndex].trim();
    if(!symptomEnumeration.test(sentence)||unsafeEnumeration.test(sentence)||concreteSymptomMentions(sentence).length<2)continue;
    inline.push({chunk,sentenceIndex});
   }
  }
  if(inline.length!==1)return null;
  const [{chunk,sentenceIndex}]=inline;
  return {chunks:[{...chunk,allowedSentenceIndexes:[sentenceIndex]}],inlineSymptomSentence:true};
 }
 const component=chunk=>({chunkId:chunk.chunk_id,docId:chunk.doc_id,topic:chunk.topic,sourceUrl:chunk.source_url,
  segmentIds:[...(chunk.source_segment_ids??[])],text_ko:chunk.text_ko,textSha256:chunk.textSha256});
 const derived=[];
 for(const headerIndex of headerIndexes){
  const header=source[headerIndex],headerItems=[];let pendingSubheading=null;
  for(let index=headerIndex+1;index<source.length;index++){
   const item=source[index];if(item.doc_id!==header.doc_id||headerIndexSet.has(index))break;
   const text=item.text_ko.trim();
   if(/[?？]/u.test(text))break;
   if(listType==='SYMPTOM_LIST'&&(/(?:^|\n)\s*\|/u.test(text)||/(?:구분하기\s*어렵|둘\s*사이.{0,20}차이|차이점|차이가\s*있습니다)/u.test(text)))break;
   if(listType==='RISK_FACTOR_LIST'&&/^[^.!?。！？]{1,60}[:：]$/u.test(text)){
    pendingSubheading=item;continue;
   }
   const startsOwnRiskCategory=listType==='RISK_FACTOR_LIST'&&/^[^.!?。！？:：]{1,18}\.\s+\S/u.test(text);
   if(startsOwnRiskCategory)pendingSubheading=null;
   const labeled=/^[^.!?。！？:：]{1,28}[:：]/u.test(text)||listType==='RISK_FACTOR_LIST'&&startsOwnRiskCategory;
   const explanatoryRiskItem=listType==='RISK_FACTOR_LIST'&&/(?:위험|가능성이\s*높|발생.{0,12}높)/u.test(text);
   const symptomSafetyAdvice=listType==='SYMPTOM_LIST'&&/(?:즉시.{0,24}(?:진료|의료진|응급)|의료진.{0,24}(?:상담|연락)|진료를\s*받)/u.test(text);
   if(symptomSafetyAdvice)break;
   const symptomSentenceItem=listType==='SYMPTOM_LIST'&&sentenceListForListItem(text)
    &&concreteSymptomMentions(text).length>=2
    &&!/(?:증상을\s*알아차리지|증상은\s*사람마다)/u.test(text)
    &&!(header.text_ko.match(/남성|여성/u)&&/(?:남성이나\s*여성|여성이나\s*남성|남성과\s*여성)/u.test(text));
   const symptomLabeledItem=listType==='SYMPTOM_LIST'&&text.length<=240&&symptomMentionPattern.test(text)
    &&(text.search(symptomMentionPattern)<=20)
    &&!(header.text_ko.match(/남성|여성/u)&&/(?:남성이나\s*여성|여성이나\s*남성|남성과\s*여성)/u.test(text));
   if(text.length>300||/[.!?。！？:：]\s*$/u.test(text)&&!labeled&&!explanatoryRiskItem&&!symptomSentenceItem&&!symptomLabeledItem)break;
   if(!text)break;
   headerItems.push({item,subheading:pendingSubheading});
   if(headerItems.length>25||derived.length+headerItems.length>25)return {invalid:true};
  }
  if(!headerItems.length)return {invalid:true};
  derived.push(...headerItems.map(({item,subheading})=>{
   const group=[header,...(subheading?[subheading]:[]),item];
   const sourceComponents=group.map(component),text_ko=composedListContextText(group);
   return {...header,chunk_id:`${header.chunk_id}::${item.chunk_id}`,text_ko,textSha256:sha256(text_ko),
    source_segment_ids:group.flatMap(chunk=>chunk.source_segment_ids),sourceComposition:'KOREAN_LIST_CONTEXT',sourceComponents,
    ai_qa_status:group.every(chunk=>chunk.ai_qa_status==='PASS')?'PASS':'HOLD',
    contentReview:group.some(chunk=>['HOLD','FAIL'].includes(chunk.contentReview))?'HOLD':header.contentReview,
    sourceContentReview:group.some(chunk=>['HOLD','FAIL'].includes(chunk.sourceContentReview))?'HOLD':header.sourceContentReview,
    unresolvedIssueCount:Math.max(...group.map(chunk=>chunk.unresolvedIssueCount??0))};
  }));
 }
 return derived.length>=2?{chunks:derived}:{invalid:true};
}
export function retrieveUploadedEvidence(question,corpus){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const safe=question.replaceAll('제2형','제이형').replace(/A1C/gi,'당화혈색소');
 if(hasUnscopedNumber(safe,corpus)||/@|https?:|홍길동|주민|전화|주소|이름|성명/u.test(safe))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[]};
 if(isPersonalHealthQuestion(question))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[]};
 // Multiple negative operators in one clause require scope resolution this demo does not perform.
 if(hasAmbiguousNestedNegation(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 // The corpus says iron deficiency is one cause of anemia, not that every low-iron state is anemia.
 if(isUnsupportedIronAnemiaInference(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 if(isUnsupportedReverseCauseInference(question)||isUnsupportedReverseAllergyRelation(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 if(isUnsupportedModalityComparison(question)||/(?:차이|비교)/u.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const exactTitle=exactTitleExplanation(question,corpus.chunks),shortDefinition=explicitShortTitleDefinition(question,corpus.chunks),
  insufficientEvidence=()=>exactTitle?sourceLookupCandidate(exactTitle):{status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 if(!exactTitle&&hasUnindexedNamedExam(question,corpus))return insufficientEvidence();
 if(isMedicationUseQuestion(question)||isVaccineRecommendationQuestion(question)||!exactTitle&&isMedicalInterventionRecommendation(question))return {status:'REFUSED',evidence:[]};
 if(isVaccineSafetyQuestion(question)&&!exactTitle)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const reasonQuestion=/왜|이유|원인|어째서/u.test(question);
 const symptomCauseCombination=/(?:증상.{0,12}(?:과|및)\s*원인|원인.{0,12}(?:과|및)\s*증상)/u.test(question);
 if(reasonQuestion&&/(?:증상|피곤|피로|쇠약|약해|어지럽|어지러|메스껍|구토|설사|발진|가렵|통증|아프|두통|숨이 차|숨참)/u.test(question)
  &&!symptomCauseCombination)
  return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  if(/처방|복용|치료|수술|진단해|확진|응급|숨.*(?:차|막)|가슴.*(?:아프|통증)|(?:어떤|무슨)[^.!?]{0,20}(?:(?<![가-힣])약(?:[은는이가을를도과와에]|이나|으로)?(?![가-힣])|약물)[^.!?]{0,20}(?:먹|복용|처방)/u.test(question))
  return exactTitle?sourceLookupCandidate(exactTitle):{status:'REFUSED',evidence:[]};
 const mriListItemDetailQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:장신구|귀금속|시계|귀걸이|반지|목걸이|피어싱|머리핀|보청기|심박\s*조율기|인공관절|삽입물|탄환|파편|금속\s*조각|문신|반영구)|(?:장신구|귀금속|시계|귀걸이|반지|목걸이|피어싱|머리핀|보청기|심박\s*조율기|인공관절|삽입물|탄환|파편|금속\s*조각|문신|반영구).{0,40}(?:\bMRI\b|자기공명)/iu;
 const mriDeviceCompatibilityQuestion=/(?:\bMRI\b|자기공명).{0,50}(?:심박\s*조율기|인공관절|삽입물).{0,30}(?:가능|괜찮|받을 수|해도 되|있어도 되)|(?:심박\s*조율기|인공관절|삽입물).{0,50}(?:\bMRI\b|자기공명).{0,30}(?:가능|괜찮|받을 수|해도 되|있어도 되)/iu;
 const mriMetalRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:(?<!귀)금속|자석|삽입물).{0,24}(?:제거|빼|치워)|(?:(?<!귀)금속|자석|삽입물).{0,40}(?:\bMRI\b|자기공명).{0,24}(?:제거|빼|치워)/iu;
 if(mriDeviceCompatibilityQuestion.test(question)||mriMetalRemovalQuestion.test(question))return insufficientEvidence();
 const q=normalize(question);
 const contrastSafetyQuestion=/(?:조영제|조영).{0,12}(?:부작용|알레르기|위험|반응)|(?:부작용|알레르기|위험|반응).{0,12}(?:조영제|조영)/u;
 const radiationSafetyQuestion=/(?:방사선|전리).{0,12}(?:위험|부작용|영향|암|문제)|(?:위험|부작용|영향|암|문제).{0,12}(?:방사선|전리)/u;
 const mriMetalSafetyQuestion=/(?:\bMRI\b|자기공명).{0,20}(?:금속|자석|삽입물)|(?:금속|자석|삽입물).{0,20}(?:\bMRI\b|자기공명)/iu;
 const mriJewelryRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:장신구|귀금속|시계|귀걸이|반지|목걸이|피어싱).{0,20}(?:제거|빼|치워)|(?:장신구|귀금속|시계|귀걸이|반지|목걸이|피어싱).{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
 const mriHairpinRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}머리핀.{0,20}(?:제거|빼|치워)|머리핀.{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
 const mriHearingAidRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}보청기.{0,20}(?:제거|빼|치워)|보청기.{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
  const mriDeviceDisclosureQuestion=/(?:\bMRI\b|자기공명).{0,50}(?:심박\s*조율기|인공관절|삽입물).{0,24}(?:알리|알려|말하|고지)|(?:심박\s*조율기|인공관절|삽입물).{0,50}(?:\bMRI\b|자기공명).{0,24}(?:알리|알려|말하|고지)/iu;
  const allergyCauseQuestion=/(?:알레르기.{0,20}(?:원인|이유|왜|생기|유전자|환경|영향)|(?:원인|이유|왜|유전자|환경|영향).{0,20}알레르기)/u;
  const causeListRequest=isCauseListQuestion(question);
  const relationAssertionQuestion=!causeListRequest&&/(?:유발|일으키|초래)/u.test(question);
  const namedOutcomeTerms=!causeListRequest&&/(?:예방|방지|원인|유발|일으키|치료|위험|영향|감소|낮추|높이|증가|악화|개선)/u.test(question)
   ?[...new Set((question.match(/[가-힣]{2,}(?:병|증|질환|질병|암|감염|장애|증후군)/gu)??[]).map(normalize))]:[];
 const focusRules=[
  {id:'FASTING',question:/금식|공복|식사|음식|음료|먹|마시|마셔|드셔/u,evidence:/금식|공복|식사|음식|음료|먹|마시/u,
   topicTerms:['금식','공복','식사','음식','음료','먹','마시','마셔','드셔']},
  {id:'CONTRAST_SAFETY',question:contrastSafetyQuestion,evidence:/(?:조영제|조영).{0,12}(?:부작용|알레르기|위험|반응)|(?:부작용|알레르기|위험|반응).{0,12}(?:조영제|조영)/u,
   topicTerms:['조영제','조영','부작용','알레르기','위험','반응']},
  {id:'CONTRAST',question:/조영제|조영/u,evidence:/조영제|조영/u,topicTerms:['조영제','조영']},
  {id:'RADIATION_SAFETY',question:radiationSafetyQuestion,evidence:/(?:방사선|전리).{0,12}(?:위험|부작용|영향|암|문제)|(?:위험|부작용|영향|암|문제).{0,12}(?:방사선|전리)/u,
   topicTerms:['방사선','전리','위험','부작용','영향']},
  {id:'RADIATION',question:/방사선|전리/u,evidence:/방사선|전리/u,topicTerms:['방사선','전리']},
  {id:'MRI_METAL_SAFETY',question:mriMetalSafetyQuestion,evidence:/MRI 장비는 강력한 자석을 사용합니다|금속.{0,8}(?:물체|삽입물)|(?:물체|삽입물).{0,8}금속|금속.{0,12}(?:검사|안전|방해)|(?:검사|안전|방해).{0,12}금속|삽입물/u,
   topicTerms:['금속','자석','삽입물']},
  {id:'MRI_JEWELRY_REMOVAL',question:mriJewelryRemovalQuestion,evidence:/MRI 전에는 다음과 같은 물품을 제거해야 합니다: 장신구와 시계\.$/u,
   topicTerms:['장신구','귀금속','시계','귀걸이','반지','목걸이','피어싱']},
  {id:'MRI_HAIRPIN_REMOVAL',question:mriHairpinRemovalQuestion,evidence:/MRI 전에는 다음과 같은 물품을 제거해야 합니다: 머리핀\.$/u,
   topicTerms:['머리핀']},
  {id:'MRI_HEARING_AID_REMOVAL',question:mriHearingAidRemovalQuestion,evidence:/MRI 전에는 다음과 같은 물품을 제거해야 합니다: 보청기\.$/u,
   topicTerms:['보청기']},
  {id:'MRI_DEVICE_DISCLOSURE',question:mriDeviceDisclosureQuestion,
   evidence:/MRI 전에 다음에 해당하면 의료진에게 알리세요: 심박조율기, 인공관절 또는 다른 삽입물처럼 금속이나 전자장치가 몸속에 있는 경우\.$/u,
   topicTerms:['심박조율기','인공관절','삽입물']},
  {id:'PREGNANCY',question:/임신/u,evidence:/임신|알리/u,topicTerms:['임신']},
   {id:'CLOTHING',question:/옷|장신구|갈아입/u,evidence:/옷|장신구|갈아입/u,
   topicTerms:['옷','장신구','갈아입']},
   ].filter(rule=>rule.question.test(question))
  .filter(rule=>!(contrastSafetyQuestion.test(question)&&rule.id==='CONTRAST'))
  .filter(rule=>!(radiationSafetyQuestion.test(question)&&rule.id==='RADIATION'))
  .filter(rule=>!((mriMetalSafetyQuestion.test(question)||mriListItemDetailQuestion.test(question))&&rule.id==='CLOTHING'));
  if(!symptomCauseCombination&&isCauseListQuestion(question))focusRules.push({id:'CAUSE_LIST',
   evidence:{test:isEnumeratedCauseSentence},topicTerms:['원인','세 가지']});
  if(allergyCauseQuestion.test(question))focusRules.push({id:'ALLERGY_CAUSE',evidence:/유전자와 환경이 모두 영향을 줄 것으로 여겨집니다/u,topicTerms:['알레르기','유전자','환경']});
  const hormoneFunctionQuestion=/(?:호르몬.{0,20}(?:역할|기능)|(?:역할|기능).{0,20}호르몬)/u;
  if(hormoneFunctionQuestion.test(question))focusRules.push({id:'HORMONE_FUNCTION',
   evidence:/^\s*(?:호르몬은 몸의 화학적 전달자입니다|혈류를 따라 조직이나 장기로 이동합니다|시간이 지나면서 천천히 작용하며 다음을 포함한 여러 과정에 영향을 줍니다)[.!?。！？]?$/u,
   topicTerms:['호르몬','역할','기능']});
  else{
   const hormoneIdentityQuestion=/(?:호르몬.{0,24}(?:화학적 전달자|화학 전달물질)|(?:화학적 전달자|화학 전달물질).{0,24}호르몬)/u;
   const hormoneTransportQuestion=/(?:호르몬.{0,24}(?:혈액|혈류|이동|운반)|(?:혈액|혈류|이동|운반).{0,24}호르몬)/u;
   const hormoneProcessQuestion=/(?:호르몬.{0,24}(?:작용|조절|영향|과정)|(?:작용|조절|영향|과정).{0,24}호르몬)/u;
   const hormoneDefinitionEvidence=/^\s*(?:호르몬은 몸의 화학적 전달자입니다|혈류를 따라 조직이나 장기로 이동합니다|시간이 지나면서 천천히 작용하며 다음을 포함한 여러 과정에 영향을 줍니다|호르몬은 특정 세포나 기관의 작용을 조절하는 혈류 속 화학 전달물질입니다)[.!?。！？]?$/u;
   if(hormoneTransportQuestion.test(question))focusRules.push({id:'HORMONE_TRANSPORT',
    evidence:/^\s*(?:호르몬은 몸의 화학적 전달자입니다|혈류를 따라 조직이나 장기로 이동합니다)[.!?。！？]?$/u,
    topicTerms:['호르몬','혈액','혈류','이동','운반']});
   else if(hormoneIdentityQuestion.test(question))focusRules.push({id:'HORMONE_IDENTITY',
    evidence:/^\s*호르몬은 몸의 화학적 전달자입니다[.!?。！？]?$/u,
    topicTerms:['호르몬','화학적','전달자']});
   else if(hormoneProcessQuestion.test(question))focusRules.push({id:'HORMONE_PROCESS',evidence:hormoneDefinitionEvidence,
    topicTerms:['호르몬','작용','조절','영향','과정']});
  }
  const vaccineFunctionQuestion=/(?:백신|예방접종).{0,30}(?:면역계|병원체|인식|방어|가르치|훈련)|(?:면역계|병원체|인식|방어|가르치|훈련).{0,30}(?:백신|예방접종)/u;
  if(vaccineFunctionQuestion.test(question))focusRules.push({id:'VACCINE_FUNCTION',
   evidence:/^\s*백신은 몸의 면역계가 해로운 병원체를 인식하고 방어하도록 가르치는 주사, 액체, 알약 또는 코분무제입니다[.!?。！？]?$/u,
   topicTerms:['백신','예방접종','면역계','병원체','인식','방어','가르치','훈련']});
  if(namedOutcomeTerms.length)focusRules.push({id:'CLAIM_TARGET',evidence:{test:sentence=>namedOutcomeTerms.every(term=>normalize(sentence).includes(term))
   &&(!relationAssertionQuestion||/(?:유발|일으키|초래)/u.test(sentence))},topicTerms:namedOutcomeTerms});
 const supportedMriListFocus=new Set(['MRI_JEWELRY_REMOVAL','MRI_HAIRPIN_REMOVAL','MRI_HEARING_AID_REMOVAL','MRI_DEVICE_DISCLOSURE']);
 if(mriListItemDetailQuestion.test(question)&&!focusRules.some(rule=>supportedMriListFocus.has(rule.id)))
  return insufficientEvidence();
 const focusTerms=new Set(focusRules.flatMap(rule=>rule.topicTerms).map(normalize));
 const hits=[];
 for(const c of corpus.chunks)for(const term of c.aliases){
  if(!hasKorean(term)&&!( /^[a-z][a-z0-9.+-]{1,15}$/iu.test(term)&&normalize(c.text_ko).includes(normalize(term))))continue;
  const t=normalize(term);if(q.includes(t))hits.push({topic:c.topic,score:t.length,focusOnly:focusTerms.has(t)});
 }
 // A detected query focus (for example 임신) should refine an explicit topic
 // rather than tie with it as a second topic. Preserve focus-only lookup when
 // no separate topic alias matched; evidence filtering below still must prove
 // that the selected topic contains a sentence for that focus.
 const nonFocusHits=hits.filter(hit=>!hit.focusOnly),topicHits=nonFocusHits.length?nonFocusHits:hits,scores=new Map();
 for(const hit of topicHits)scores.set(hit.topic,Math.max(scores.get(hit.topic)||0,hit.score));
 if(shortDefinition){scores.clear();scores.set(shortDefinition.topic,4);}
 if(mriListItemDetailQuestion.test(question)&&focusRules.some(rule=>supportedMriListFocus.has(rule.id))){
  const canonicalMriTopic=corpus.chunks.find(chunk=>/자기공명영상\(MRI\)/u.test(chunk.title_ko??''))?.topic;
  if(!canonicalMriTopic)return insufficientEvidence();
  const explicitScore=Math.max(3,...scores.values());scores.clear();scores.set(canonicalMriTopic,explicitScore);
 }
 const candidateScore=Math.max(0,...scores.values());
 if(corpus.indexScope!=='SCHOOL_DEMO_ALL_TRANSLATIONS'){
  const matchingHeld=(corpus.held??[]).map(document=>({...document,matchScore:Math.max(0,...(document.aliases??[])
   .filter(alias=>typeof alias==='string').map(alias=>q.includes(normalize(alias))?normalize(alias).length:0))}))
   .filter(document=>document.matchScore>0);
  const heldScore=Math.max(0,...matchingHeld.map(document=>document.matchScore));
   if(heldScore>0&&heldScore>=candidateScore){return {status:'SOURCE_ON_HOLD',evidence:[],heldSources:matchingHeld
    .filter(document=>document.matchScore===heldScore).slice(0,3).map(({id,title,url,source_url,reason})=>({id,title,url:url??source_url,reason}))};
  }
 }
 const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
 // Exact title lookup remains authoritative. Otherwise, a strong translated
 // sentence match should outrank a weak common-word alias such as "blood".
 const requestedListType=isSymptomListQuestion(question)?'SYMPTOM_LIST':isRiskFactorListQuestion(question)?'RISK_FACTOR_LIST':null;
 if(!exactTitle&&!shortDefinition&&!requestedListType&&!focusRules.some(rule=>!['RADIATION','CAUSE_LIST'].includes(rule.id))){
  const lexicalEvidence=retrieveKoreanMatchedEvidence(question,corpus);
  if(lexicalEvidence)return hasUnsupportedScopeQualifier(question,lexicalEvidence.evidence)
   ?insufficientEvidence():lexicalEvidence;
 }
 if(!ranked.length){
  return insufficientEvidence();
 }
 if(ranked[1]?.[1]===ranked[0][1])return insufficientEvidence();
 const topic=ranked[0][0];
 if(requestedListType){
  if(requestedListType==='SYMPTOM_LIST'&&isCauseListQuestion(question))return insufficientEvidence();
  const normalizedQuestion=normalize(question),namedDocumentIds=new Set(corpus.chunks.filter(chunk=>chunk.topic===topic)
   .filter(chunk=>[chunk.title_ko,...(chunk.aliases??[])].some(alias=>typeof alias==='string'
    &&normalize(alias).length>=2&&normalizedQuestion.includes(normalize(alias))))
   .map(chunk=>chunk.doc_id));
  if(!namedDocumentIds.size)return insufficientEvidence();
  const translatedList=translatedListContextChunks(corpus.chunks,topic,namedDocumentIds,requestedListType,question);
  if(translatedList?.invalid)return insufficientEvidence();
  if(translatedList)return {status:'CANDIDATE',topic,intent:requestedListType==='SYMPTOM_LIST'?'SYMPTOMS':'UNDERSTAND',focus:[],evidence:translatedList.chunks,
   extractiveOnly:true,listContextType:requestedListType};
  return insufficientEvidence();
 }
 if(exactTitle&&topic!==exactTitle.topic)return sourceLookupCandidate(exactTitle);
  if(topic==='3953'&&mriListItemDetailQuestion.test(question)){
   const listFocusRules=focusRules.filter(rule=>supportedMriListFocus.has(rule.id));
  if(listFocusRules.length!==1)return insufficientEvidence();
  const allListPassages=mriListContextChunks(corpus.chunks,topic);
  const passages=allListPassages.filter(chunk=>listFocusRules[0].evidence.test(chunk.text_ko));
  if(passages.length!==1)return insufficientEvidence();
  return {status:'CANDIDATE',topic,intent:'PREPARE',focus:[listFocusRules[0].id],evidence:passages,
   extractiveOnly:true,questionTemplate:'이 준비 항목이 본인에게 해당하는지 의료진에게 확인해 주실 수 있나요?'};
 }
 // Small, auditable Korean paraphrase rules improve intent routing without
 // adding generated facts or changing which source documents are eligible.
 const shortImagingFastingQuestion=/(?:\bCT\b|컴퓨터\s*단층촬영)\s*전(?:에|엔)?/iu.test(question)
  &&/금식|공복|식사|음식|음료|먹|마시|마셔|드셔/u.test(question);
 const pregnancyDisclosureQuestion=/임신.{0,40}(?:의료진|의사|검사자).{0,12}(?:알리|알려|말하|고지)|(?:의료진|의사|검사자).{0,30}임신.{0,12}(?:알리|알려|말하|고지)/u.test(question);
  const intent=symptomCauseCombination?'MULTI_INTENT':mriDeviceDisclosureQuestion.test(question)?'PREPARE':/증상|징후|어떤 느낌|어떻게 느|몸(?:이|에)(?!서).*(?:어떻게|어떤)|느껴|어떤 변화|피곤|피로|쇠약|약해|어지럽|어지러|메스껍|구토|설사|발진|가렵|발열|오한|춥/u.test(question)?'SYMPTOMS'
  :reasonQuestion||/원인|무엇 때문에|왜.*(?:생기|생겨|생겼|생긴|발생|일어나)|무엇.*(?:원인|일으키)|어떻게.*(?:생기|생겨|발생)/u.test(question)?'CAUSES'
   :shortImagingFastingQuestion||pregnancyDisclosureQuestion||/준비|검사\s*전|(?:검사|촬영)\s*전에|찍기\s*전|\bMRI\b\s*전에|질문|물어보|확인할.*(?:내용|사항)|어떻게 해야|제거|빼야|치워|벗|옷|장신구|머리핀|보청기|갈아입/u.test(question)?'PREPARE':'UNDERSTAND';
  const intentPatterns=intent==='MULTI_INTENT'?[]:({
  SYMPTOMS:[/증상|징후/u,/피곤|피로|쇠약|약해/u,/통증|아프|두통|가슴|복통/u,/숨이 차|숨참|호흡곤란|기침/u,
   /어지럽|어지러|메스껍|구토|설사|발진|가렵/u,/열|발열|오한|춥/u],
  CAUSES:[/원인|때문|일으키|유발/u,/부족|결핍|손실|감염/u,/유전|유전자|노출|발생/u,/돕|목적|위해/u],
   PREPARE:[/준비|검사 전/u,/질문|물어보|확인하/u,/의료진|의사|검사자/u,/금식|음식|음료|복용/u,/알리|임신|조영/u,/옷|장신구|머리핀|보청기|갈아입|금속/u],
  }[intent]??[]);
 // Composed MRI list contexts are limited to the exact list-item route above;
 // they must not leak into general model-selected evidence.
 const sourceChunks=corpus.chunks;
 const topicChunks=sourceChunks.filter(c=>c.topic===topic&&c.demoIndexStatus==='PASS'&&hasKorean(c.text_ko)&&sha256(c.text_ko)===c.textSha256);
 if(intent==='MULTI_INTENT'){
  // Keep the first combined intent deliberately narrow: it is enabled only for
  // the anemia source whose complete symptom and cause statements are both present.
  // Other named topics continue to abstain until their paired evidence is specified.
  if(topic!=='139')return insufficientEvidence();
  const namedTopicAliases=[...new Set(topicChunks.flatMap(chunk=>[chunk.title_ko,...(chunk.aliases??[])])
   .filter(alias=>typeof alias==='string').map(normalize).filter(alias=>alias.length>=2&&q.includes(alias)))];
  if(!namedTopicAliases.length)return insufficientEvidence();
  const namesTopic=sentence=>namedTopicAliases.some(alias=>normalize(sentence).includes(alias));
  focusRules.push({id:'SYMPTOMS',evidence:{test:sentence=>namesTopic(sentence)
   &&/(?:피곤|피로|쇠약|약해|어지럽|어지러|메스껍|구토|설사|발진|가렵|발열|오한|춥|통증|아프|두통|숨이 차|숨참|호흡곤란)/u.test(sentence)},topicTerms:['증상']});
  focusRules.push({id:'CAUSES',evidence:{test:sentence=>namesTopic(sentence)&&isEnumeratedCauseSentence(sentence)
   &&!/[?？]\s*$/u.test(sentence)},topicTerms:['원인']});
 }
 if(relationAssertionQuestion){
  const claimRule=focusRules.find(rule=>rule.id==='CLAIM_TARGET');
  if(!claimRule){
   const focusedRelationRules=new Set(['ALLERGY_CAUSE','CONTRAST_SAFETY','RADIATION_SAFETY','MRI_METAL_SAFETY']);
   if(!focusRules.some(rule=>focusedRelationRules.has(rule.id)))return insufficientEvidence();
  }else{
   const queriedTopicAliases=[...new Set(topicChunks.flatMap(chunk=>chunk.aliases??[]).map(normalize)
    .filter(alias=>alias.length>=2&&q.includes(alias)))];
   if(!queriedTopicAliases.length)return insufficientEvidence();
   const targetEvidence=claimRule.evidence.test;
   claimRule.evidence={test:sentence=>targetEvidence(sentence)&&queriedTopicAliases.some(alias=>normalize(sentence).includes(alias))};
  }
 }
 const definitionQuestionText=question.replace(/(?:이전\s*지시|시스템\s*프롬프트|프롬프트|지시).{0,40}(?:무시|따르|변경|공개|노출|출력)[^.!?。！？]*/gu,' ');
 const asksDefinition=/이란|개념|무엇(?:이라고|인가|이|인|을 의미)|뭐(?:가|예요|인가요)|어디|어느|어떤.{0,12}(?:검사|성분|세포|상태|것|병|질환|질병|장애)|무슨.{0,12}(?:검사|성분|세포|상태|것|병|질환|질병|장애)|혈액.{0,24}산소.{0,16}(?:운반|전달).{0,12}(?:못|않).{0,12}(?:무엇|뭐)|설명해/u.test(definitionQuestionText);
 const topicAliasTerms=new Set(topicChunks.flatMap(chunk=>[
  ...(chunk.aliases??[]),...(shortDefinition?.topic===chunk.topic?[shortDefinition.title]:[])]).flatMap(koreanSearchTerms));
 const questionDetailTerms=asksDefinition?koreanSearchTerms(definitionQuestionText).filter(term=>term.length>=2&&!topicAliasTerms.has(term)):[];
 const definitionEvidence=sentence=>{
  const definition=topicChunks.some(chunk=>completeSentences(chunk.text_ko).includes(sentence)
   &&(!asksForNamedTest(question)||sourceNamesSpecificTest(chunk.title_ko,sentence))
   &&[...(chunk.aliases??[]),...(shortDefinition?.topic===chunk.topic?[shortDefinition.title]:[])].some(alias=>{
    const normalizedSentence=normalize(sentence),normalizedAlias=normalize(alias);
    const aliasTerms=koreanSearchTerms(alias),aliasSubject=[normalizedAlias,...aliasTerms].some(term=>normalizedSentence.startsWith(term)
     &&/^(?:은|는|이|가)/u.test(normalizedSentence.slice(term.length)));
    const declarative=/(?:이라고|라고|라)\s*(?:합니다|말합니다|부릅니다)|(?:검사|질환|질병|장애|상태|방법|감염|염증|증상|문제|부족|결핍|반응|영상)[^.?!]{0,50}입니다/u.test(sentence)
     ||aliasSubject&&/(?:입니다|것입니다|됩니다|이라고합니다|라고합니다)[.!?。！？]?$/u.test(normalizedSentence);
    return declarative&&([normalizedAlias,...aliasTerms].some(term=>normalizedSentence.includes(term)));
   }));
  if(!definition)return false;
  if(!questionDetailTerms.length)return true;
  const sentenceTerms=new Set(koreanSearchTerms(sentence));
  return questionDetailTerms.filter(term=>sentenceTerms.has(term)).length>=Math.min(2,questionDetailTerms.length);
 };
 if(shortDefinition&&intent==='UNDERSTAND'&&!focusRules.length){
  const title=normalize(shortDefinition.title);
  let directDefinition='';
  for(const chunk of topicChunks){
   if(chunk.ai_qa_status!=='PASS'||chunk.sourceContentReview==='HOLD'||chunk.unresolvedIssueCount>0)continue;
   const sentence=(completeSentences(chunk.text_ko).map(value=>value.trim()).find(value=>{
    if(/[?？]\s*$/u.test(value)||isNonAnswerListLead(value))return false;
    const normalizedSentence=normalize(value),afterTitle=normalizedSentence.slice(title.length);
    const namesTopic=normalizedSentence.startsWith(title)&&/^(?:은|는|이란|란|이|가)/u.test(afterTitle);
    return namesTopic&&/(?:입니다|것입니다|됩니다|이라고합니다|라고합니다)[.!?。！？]?$/u.test(normalizedSentence);
   })??'');
   if(sentence){directDefinition=sentence;break;}
  }
  if(!directDefinition)return insufficientEvidence();
  focusRules.push({id:'SHORT_TITLE_DEFINITION',evidence:{test:sentence=>sentence.trim()===directDefinition},
   topicTerms:[shortDefinition.title]});
 }
 if(intent==='UNDERSTAND'&&!focusRules.length&&asksDefinition){
  if(topicChunks.some(chunk=>completeSentences(chunk.text_ko).some(definitionEvidence)))
   focusRules.push({id:'DEFINITION',evidence:{test:definitionEvidence}});
  else if(questionDetailTerms.length||asksForNamedTest(question))return insufficientEvidence();
 }
  const intentTopicChunks=intent==='MULTI_INTENT'?topicChunks.filter(c=>c.ai_qa_status==='PASS'
   &&!['HOLD','FAIL'].includes(c.sourceContentReview)&&!['HOLD','FAIL'].includes(c.contentReview)
   &&c.unresolvedIssueCount===0):topicChunks;
  const matchingChunks=intentTopicChunks
  .map(c=>{const searchable=`${(c.section_path??[]).join(' ')} ${c.text_ko}`.toLowerCase();
   const sentences=completeSentences(c.text_ko);
   const focusSentenceIndexes=Object.fromEntries(focusRules.map(rule=>[rule.id,sentences.flatMap((sentence,index)=>
    !/[?？]\s*$/u.test(sentence)&&rule.evidence.test(sentence)?[index]:[])]));
   const score=intentPatterns.filter(pattern=>pattern.test(searchable)).length
    +focusRules.filter(rule=>sentences.some(sentence=>rule.evidence.test(sentence))).length;
    const allowedSentenceIndexes=sentences.flatMap((sentence,index)=>
     (/[?？]\s*$/u.test(sentence)||isNonAnswerListLead(sentence)||intentPatterns.length&&!intentPatterns.some(pattern=>pattern.test(sentence.toLowerCase()))
      ||focusRules.length&&!focusRules.some(rule=>rule.evidence.test(sentence)))?[]:[index]);
   return {...c,score,allowedSentenceIndexes,focusSentenceIndexes};});
 const relevanceRequired=intentPatterns.length>0||focusRules.length>0;
 const relevantChunks=relevanceRequired?matchingChunks.filter(c=>c.score>0&&c.allowedSentenceIndexes.length>0)
  :matchingChunks.filter(c=>c.allowedSentenceIndexes.length>0);
 if(intentPatterns.length&&!relevantChunks.length)return insufficientEvidence();
 if(focusRules.length&&!relevantChunks.length)return insufficientEvidence();
  let evidence=relevantChunks.sort((a,b)=>b.score-a.score||a.chunk_id.localeCompare(b.chunk_id)).slice(0,3);
  if(intent==='MULTI_INTENT'){
   const candidates=focusRules.map(rule=>relevantChunks.filter(chunk=>(chunk.focusSentenceIndexes[rule.id]??[])
    .some(index=>chunk.allowedSentenceIndexes.includes(index))));
   if(candidates.some(matches=>!matches.length))return insufficientEvidence();
   const selected=candidates.map(matches=>matches[0]);
   if(new Set(selected.map(chunk=>chunk.doc_id)).size!==1)return insufficientEvidence();
   evidence=selected[0].chunk_id===selected[1].chunk_id?[selected[0]]:[...selected];
  }
  if(intent!=='MULTI_INTENT'&&focusRules.length>1&&!evidence.some(chunk=>{
  const allowed=new Set(chunk.allowedSentenceIndexes);
  for(const start of allowed){
   const selected=new Set([start]);if(allowed.has(start+1))selected.add(start+1);
   if(focusRules.every(rule=>(chunk.focusSentenceIndexes[rule.id]??[]).some(index=>selected.has(index))))return true;
  }
  return false;
 }))return insufficientEvidence();
 if(hasUnsupportedScopeQualifier(question,evidence))return insufficientEvidence();
  return evidence.length&&(intent==='MULTI_INTENT'||coordinatedConceptsAreSupported(question,evidence))
  ?{status:'CANDIDATE',topic,intent,focus:focusRules.map(rule=>rule.id),evidence}:insufficientEvidence();
}
