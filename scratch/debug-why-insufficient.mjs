import { loadUploadedCorpus } from '../src/medlineplus-upload-corpus.js';

async function main() {
  const corpus = await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/', import.meta.url), { includeQaHolds: true });
  const question = "간경화란 무엇인가요?";

  const normalize = text => typeof text === 'string' ? text.toLowerCase().replace(/\s+/gu, '') : '';
  const completeSentences = text => (typeof text === 'string' ? text.match(/[^.!?。！？]+[.!?。！？]+/gu) : null) ?? [];
  const koreanSearchSuffixes=['이라고','이라면','라면','이란','에서는','으로는','에게는','에게서','으로부터','인가요','일까요','습니까','합니다','됩니다',
   '해줘요','해주세요','시켜서','시켜','이에요','예요','에요','나요','까요','으로','에서','에게','한테','에는','이랑','하고','이라',
   '입니다','습니다','하는','하면','하며','했던','되면','지만','처럼','까지','부터','보다','은','는','이','가','을','를','와','과','의','에','로','도','만','게','한','히','지','하'];
  const koreanSearchStopTerms = new Set(['무엇','무엇이라고','뭐','어떤','무슨','어디','어느','기관','장기','부위','곳','병','질환','질병','장애','역할','기능','이란','뜻','개념','관계','현상','부르','이들','검사','검사법','검사란','영상','영상검사','설명','설명해','알려','주세요','주세',
   '만들','만드','보여','보여주','이용','이용하','사용','사용하','몸','피','건강','수','것','상태']);
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

  const topic = '190';
  const topicChunks = corpus.chunks.filter(c => c.topic === topic);
  console.log('topicChunks length:', topicChunks.length);

  const definitionQuestionText=question.replace(/(?:이전\s*지시|시스템\s*프롬프트|프롬프트|지시).{0,40}(?:무시|따르|변경|공개|노출|출력)[^.!?。！？]*/gu,' ');
  const asksDefinition=/이란|개념|무엇(?:이라고|인가|이|인|을 의미)|뭐(?:가|예요|인가요)|어디|어느|어떤.{0,12}(?:검사|성분|세포|상태|것|병|질환|질병|장애)|무슨.{0,12}(?:검사|성분|세포|상태|것|병|질환|질병|장애)|혈액.{0,24}산소.{0,16}(?:운반|전달).{0,12}(?:못|않).{0,12}(?:무엇|뭐)|설명해/u.test(definitionQuestionText);
  console.log('asksDefinition:', asksDefinition);

  const shortDefinition = null; // let's see
  const topicAliasTerms=new Set(topicChunks.flatMap(chunk=>[
   ...(chunk.aliases??[]),...(shortDefinition?.topic===chunk.topic?[shortDefinition.title]:[])]).flatMap(koreanSearchTerms));
  console.log('topicAliasTerms:', [...topicAliasTerms]);

  const questionDetailTerms=asksDefinition?koreanSearchTerms(definitionQuestionText).filter(term=>term.length>=2&&!topicAliasTerms.has(term)):[];
  console.log('questionDetailTerms:', questionDetailTerms);

  const asksForNamedTest = q => false;
  const sourceNamesSpecificTest = () => true;

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

  const focusRules = [];
  const intent = 'UNDERSTAND';
  if(intent==='UNDERSTAND'&&!focusRules.length&&asksDefinition){
   const hasDef = topicChunks.some(chunk=>completeSentences(chunk.text_ko).some(definitionEvidence));
   console.log('hasDef evidence:', hasDef);
   if(hasDef)
    focusRules.push({id:'DEFINITION',evidence:{test:definitionEvidence}});
   else if(questionDetailTerms.length||asksForNamedTest(question)) {
     console.log('STOPPED at else if(questionDetailTerms.length||asksForNamedTest(question))!');
   }
  }

  console.log('focusRules length:', focusRules.length);

  // Now check matchingChunks
  const intentPatterns = [];
  const matchingChunks=topicChunks
   .map(c=>{const searchable=`${(c.section_path??[]).join(' ')} ${c.text_ko}`.toLowerCase();
    const sentences=completeSentences(c.text_ko);
    const focusSentenceIndexes=Object.fromEntries(focusRules.map(rule=>[rule.id,sentences.flatMap((sentence,index)=>
     !/[?？]\s*$/u.test(sentence)&&rule.evidence.test(sentence)?[index]:[])]));
    const score=intentPatterns.filter(pattern=>pattern.test(searchable)).length
     +focusRules.filter(rule=>sentences.some(sentence=>rule.evidence.test(sentence))).length;
    const allowedSentenceIndexes=sentences.flatMap((sentence,index)=>
     (/[?？]\s*$/u.test(sentence)||intentPatterns.length&&!intentPatterns.some(pattern=>pattern.test(sentence.toLowerCase()))
      ||focusRules.length&&!focusRules.some(rule=>rule.evidence.test(sentence)))?[]:[index]);
    return {...c,score,allowedSentenceIndexes,focusSentenceIndexes};});

  console.log('matchingChunks scores:', matchingChunks.map(c=>({ id: c.chunk_id, score: c.score, allowed: c.allowedSentenceIndexes, focus: c.focusSentenceIndexes })));
}

main().catch(console.error);
