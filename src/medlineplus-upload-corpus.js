// Uploaded translations are development evidence, never clinical/content approval.
import {readFile} from 'node:fs/promises';
import {sha256} from './health-helper-medlineplus.js';
const POLICY='https://medlineplus.gov/about/using/usingcontent/';
const RIGHTS=new Set(['public_domain_us_confirmed_scope','Health topic summaries identified as public domain by the source policy; not a blanket license for all linked content.']);
const hasKorean=text=>typeof text==='string'&&/[\uac00-\ud7a3]/u.test(text);
const normalizeAlias=text=>text.toLowerCase().replace(/\s+/gu,'');
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
function koreanTitleAliases(title){
 return typeof title==='string'?(title.match(/\([^()]{2,16}\)/g)??[]).map(value=>value.slice(1,-1)):[];
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
     demoIndexStatus:'PASS',attribution:'Source: MedlinePlus, National Library of Medicine.',
     rights_policy_url:document.rights_policy_url??POLICY,
     translation_notice:document.translation_notice??'사용자 제공 AI 한국어 번역 · 공식 번역 아님 · 의료전문가 검수 미실시 · 학교 발표용 비임상 데모.'});
   }
  }
 }
 chunks.push(...heldChunks);
 const heldDocuments=(corpus.heldDocuments??[]).map(document=>({id:document.id,doc_id:document.doc_id,title:document.title,source_url:document.source_url,
  status:'HOLD',reason:document.reason,aiQaStatus:document.aiQaStatus??'HOLD',
  sourceContentReview:document.sourceContentReview??'HOLD',unresolvedIssueCount:Array.isArray(document.unresolvedIssues)?document.unresolvedIssues.length:0,
  schoolDemoRetrievable:includeQaHolds,clinicalUse:false,
  segments:(document.segments??[]).map(segment=>({source_segment_id:segment.source_segment_id,text_ko:segment.text_ko}))}));
 const indexedDocuments=new Set(chunks.map(chunk=>chunk.doc_id)).size;
 return {version:corpus.version,status:corpus.status,language:'ko',retrievalCorpus:'TRANSLATION_ONLY',clinicalUse:false,
  serviceDeployment:false,indexScope:includeQaHolds?'SCHOOL_DEMO_ALL_TRANSLATIONS':'QA_PASS_TRANSLATIONS_ONLY',demoIndexStatus:'PASS',
  demoIndexStatusMeaning:'Korean translated text integrity and indexing only; not content, medical, rights, or clinical approval.',
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
export function retrieveUploadedEvidence(question,corpus){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const safe=question.replaceAll('제2형','제이형').replace(/A1C/gi,'당화혈색소');
 if(hasUnscopedNumber(safe,corpus)||/@|https?:|홍길동|주민|전화|주소|이름|성명/u.test(safe))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[]};
 if(/처방|복용|치료|수술|진단해|확진|응급|숨.*(?:차|막)|가슴.*(?:아프|통증)/u.test(question))return {status:'REFUSED',evidence:[]};
 const mriListItemDetailQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:장신구|시계|머리핀|보청기|심박\s*조율기|인공관절|삽입물|탄환|파편|금속\s*조각|문신|반영구)|(?:장신구|시계|머리핀|보청기|심박\s*조율기|인공관절|삽입물|탄환|파편|금속\s*조각|문신|반영구).{0,40}(?:\bMRI\b|자기공명)/iu;
 const mriDeviceCompatibilityQuestion=/(?:\bMRI\b|자기공명).{0,50}(?:심박\s*조율기|인공관절|삽입물).{0,30}(?:가능|괜찮|받을 수|해도 되|있어도 되)|(?:심박\s*조율기|인공관절|삽입물).{0,50}(?:\bMRI\b|자기공명).{0,30}(?:가능|괜찮|받을 수|해도 되|있어도 되)/iu;
 const mriMetalRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:금속|자석|삽입물).{0,24}(?:제거|빼|치워)|(?:금속|자석|삽입물).{0,40}(?:\bMRI\b|자기공명).{0,24}(?:제거|빼|치워)/iu;
 if(mriDeviceCompatibilityQuestion.test(question)||mriMetalRemovalQuestion.test(question))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const q=normalize(question);
 const contrastSafetyQuestion=/(?:조영제|조영).{0,12}(?:부작용|알레르기|위험|반응)|(?:부작용|알레르기|위험|반응).{0,12}(?:조영제|조영)/u;
 const radiationSafetyQuestion=/(?:방사선|전리).{0,12}(?:위험|부작용|영향|암|문제)|(?:위험|부작용|영향|암|문제).{0,12}(?:방사선|전리)/u;
 const mriMetalSafetyQuestion=/(?:\bMRI\b|자기공명).{0,20}(?:금속|자석|삽입물)|(?:금속|자석|삽입물).{0,20}(?:\bMRI\b|자기공명)/iu;
 const mriJewelryRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}(?:장신구|시계).{0,20}(?:제거|빼|치워)|(?:장신구|시계).{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
 const mriHairpinRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}머리핀.{0,20}(?:제거|빼|치워)|머리핀.{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
 const mriHearingAidRemovalQuestion=/(?:\bMRI\b|자기공명).{0,40}보청기.{0,20}(?:제거|빼|치워)|보청기.{0,40}(?:\bMRI\b|자기공명).{0,20}(?:제거|빼|치워)/iu;
 const mriDeviceDisclosureQuestion=/(?:\bMRI\b|자기공명).{0,50}(?:심박\s*조율기|인공관절|삽입물).{0,24}(?:알리|알려|말하|고지)|(?:심박\s*조율기|인공관절|삽입물).{0,50}(?:\bMRI\b|자기공명).{0,24}(?:알리|알려|말하|고지)/iu;
 const focusRules=[
  {id:'FASTING',question:/금식|공복|식사|음식|음료|먹|마시/u,evidence:/금식|공복|식사|음식|음료|먹|마시/u,
   topicTerms:['금식','공복','식사','음식','음료','먹','마시']},
  {id:'CONTRAST_SAFETY',question:contrastSafetyQuestion,evidence:/(?:조영제|조영).{0,12}(?:부작용|알레르기|위험|반응)|(?:부작용|알레르기|위험|반응).{0,12}(?:조영제|조영)/u,
   topicTerms:['조영제','조영','부작용','알레르기','위험','반응']},
  {id:'CONTRAST',question:/조영제|조영/u,evidence:/조영제|조영/u,topicTerms:['조영제','조영']},
  {id:'RADIATION_SAFETY',question:radiationSafetyQuestion,evidence:/(?:방사선|전리).{0,12}(?:위험|부작용|영향|암|문제)|(?:위험|부작용|영향|암|문제).{0,12}(?:방사선|전리)/u,
   topicTerms:['방사선','전리','위험','부작용','영향']},
  {id:'RADIATION',question:/방사선|전리/u,evidence:/방사선|전리/u,topicTerms:['방사선','전리']},
  {id:'MRI_METAL_SAFETY',question:mriMetalSafetyQuestion,evidence:/금속.{0,8}(?:물체|삽입물)|(?:물체|삽입물).{0,8}금속|금속.{0,12}(?:검사|안전|방해)|(?:검사|안전|방해).{0,12}금속|삽입물/u,
   topicTerms:['금속','자석','삽입물']},
  {id:'MRI_JEWELRY_REMOVAL',question:mriJewelryRemovalQuestion,evidence:/MRI 전에는 다음과 같은 물품을 제거해야 합니다: 장신구와 시계\.$/u,
   topicTerms:['장신구','시계']},
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
 const supportedMriListFocus=new Set(['MRI_JEWELRY_REMOVAL','MRI_HAIRPIN_REMOVAL','MRI_HEARING_AID_REMOVAL','MRI_DEVICE_DISCLOSURE']);
 if(mriListItemDetailQuestion.test(question)&&!focusRules.some(rule=>supportedMriListFocus.has(rule.id)))
  return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
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
 if(mriListItemDetailQuestion.test(question)&&focusRules.some(rule=>supportedMriListFocus.has(rule.id))){
  const canonicalMriTopic=corpus.chunks.find(chunk=>/자기공명영상\(MRI\)/u.test(chunk.title_ko??''))?.topic;
  if(!canonicalMriTopic)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
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
 if(!ranked.length||ranked[1]?.[1]===ranked[0][1])return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const topic=ranked[0][0];
  if(topic==='3953'&&mriListItemDetailQuestion.test(question)){
   const listFocusRules=focusRules.filter(rule=>supportedMriListFocus.has(rule.id));
  if(listFocusRules.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  const allListPassages=mriListContextChunks(corpus.chunks,topic);
  const passages=allListPassages.filter(chunk=>listFocusRules[0].evidence.test(chunk.text_ko));
  if(passages.length!==1)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
  return {status:'CANDIDATE',topic,intent:'PREPARE',focus:[listFocusRules[0].id],evidence:passages,
   extractiveOnly:true,questionTemplate:'이 준비 항목이 본인에게 해당하는지 의료진에게 확인해 주실 수 있나요?'};
 }
 // Small, auditable Korean paraphrase rules improve intent routing without
 // adding generated facts or changing which source documents are eligible.
 const intent=mriDeviceDisclosureQuestion.test(question)?'PREPARE':/증상|징후|어떤 느낌|어떻게 느|몸(?:이|에).*(?:어떻게|어떤)|느껴|어떤 변화/u.test(question)?'SYMPTOMS'
  :/원인|무엇 때문에|왜.*(?:생기|발생|일어나)|무엇.*(?:원인|일으키)|어떻게.*(?:생기|발생)/u.test(question)?'CAUSES'
   :/준비|검사\s*전|(?:검사|촬영)\s*전에|\bMRI\b\s*전에|질문|물어보|확인할.*(?:내용|사항)|어떻게 해야|제거|빼야|치워|벗|옷|장신구|머리핀|보청기|갈아입/u.test(question)?'PREPARE':'UNDERSTAND';
 const intentPatterns={
  SYMPTOMS:[/증상|징후/u,/피곤|피로|쇠약|약해/u,/통증|아프|두통|가슴|복통/u,/숨이 차|숨참|호흡곤란|기침/u,
   /어지럽|메스껍|구토|설사|발진|가렵/u,/열|발열|오한|춥/u],
  CAUSES:[/원인|때문|일으키|유발/u,/부족|결핍|손실|감염/u,/유전|유전자|노출|발생/u],
   PREPARE:[/준비|검사 전/u,/질문|물어보|확인하/u,/의료진|의사|검사자/u,/금식|음식|음료|복용/u,/알리|임신|조영/u,/옷|장신구|머리핀|보청기|갈아입|금속/u],
 }[intent]??[];
 // Composed MRI list contexts are limited to the exact list-item route above;
 // they must not leak into general model-selected evidence.
 const sourceChunks=corpus.chunks;
 const matchingChunks=sourceChunks.filter(c=>c.topic===topic&&c.demoIndexStatus==='PASS'&&hasKorean(c.text_ko)&&sha256(c.text_ko)===c.textSha256)
  .map(c=>{const searchable=`${(c.section_path??[]).join(' ')} ${c.text_ko}`.toLowerCase();
   const sentences=completeSentences(c.text_ko);
   const focusSentenceIndexes=Object.fromEntries(focusRules.map(rule=>[rule.id,sentences.flatMap((sentence,index)=>
    rule.evidence.test(sentence)?[index]:[])]));
   const score=intentPatterns.filter(pattern=>pattern.test(searchable)).length
    +focusRules.filter(rule=>sentences.some(sentence=>rule.evidence.test(sentence))).length;
   const allowedSentenceIndexes=sentences.flatMap((sentence,index)=>
    (intentPatterns.length&&!intentPatterns.some(pattern=>pattern.test(sentence.toLowerCase()))
      ||focusRules.length&&!focusRules.some(rule=>rule.evidence.test(sentence)))?[]:[index]);
   return {...c,score,allowedSentenceIndexes,focusSentenceIndexes};});
 const relevanceRequired=intentPatterns.length>0||focusRules.length>0;
 const relevantChunks=relevanceRequired?matchingChunks.filter(c=>c.score>0&&c.allowedSentenceIndexes.length>0)
  :matchingChunks.filter(c=>c.allowedSentenceIndexes.length>0);
 if(intentPatterns.length&&!relevantChunks.length)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 if(focusRules.length&&!relevantChunks.length)return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const evidence=relevantChunks.sort((a,b)=>b.score-a.score||a.chunk_id.localeCompare(b.chunk_id)).slice(0,3);
 if(focusRules.length>1&&!evidence.some(chunk=>{
  const allowed=new Set(chunk.allowedSentenceIndexes);
  for(const start of allowed){
   const selected=new Set([start]);if(allowed.has(start+1))selected.add(start+1);
   if(focusRules.every(rule=>(chunk.focusSentenceIndexes[rule.id]??[]).some(index=>selected.has(index))))return true;
  }
  return false;
 }))return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 return {status:evidence.length?'CANDIDATE':'INSUFFICIENT_EVIDENCE',topic,intent,focus:focusRules.map(rule=>rule.id),evidence};
}
