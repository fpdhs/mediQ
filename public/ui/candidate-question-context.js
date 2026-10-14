const compact=value=>value.normalize('NFC').toLowerCase().replace(/\s+/gu,'');

// Preview-only topic context. It never changes a question naming another topic.
export function resolveCandidateQuestion(question,{contextTopic,topicAliases=[]}={}){
 if(typeof question!=='string'||!question.trim()||question.length>600
  ||typeof contextTopic!=='string'||!contextTopic.trim()||contextTopic.length>160)return question;
 const trimmed=question.trim();
 if(!/^(?:그럼|그러면|그(?:\s*검사|건|것)|이(?:\s*검사|건|것)|다음|어떤|원인|증상|좀\s*더)|^(?:준비|금식|방사선|조영제)(?:은|는|이|가|도|을|를|[?？])/u.test(trimmed))return question;
 const normalized=compact(question);
 if(topicAliases.some(alias=>{
  if(typeof alias!=='string'||!alias.trim())return false;
  const term=compact(alias);
  let start=normalized.indexOf(term);
  while(start>=0){
   // Latin abbreviations are tokens; CT inside an unrelated Latin word is not a topic.
   if(!/^[a-z0-9.+-]+$/u.test(term)
    ||!/[a-z]/u.test(normalized[start-1]??'')&&!/[a-z]/u.test(normalized[start+term.length]??''))return true;
   start=normalized.indexOf(term,start+1);
  }
  return false;
 }))return question;
 const resolved=`${contextTopic}: ${question}`;
 return resolved.length<=600?resolved:question;
}
