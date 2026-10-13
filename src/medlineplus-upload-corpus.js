// Uploaded translations are development evidence, never clinical/content approval.
import {readFile} from 'node:fs/promises';
import {sha256} from './health-helper-medlineplus.js';
const POLICY='https://medlineplus.gov/about/using/usingcontent/';
const RIGHTS=new Set(['public_domain_us_confirmed_scope','Health topic summaries identified as public domain by the source policy; not a blanket license for all linked content.']);
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
  const aliases=[d.title_ko,d.title_en,d.title_ko.replace(/\([^)]*\)/g,''),...(d.title_ko.match(/\([A-Za-z0-9]{2,8}\)/g)??[]).map(t=>t.slice(1,-1)),
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
export async function loadUploadedCorpus(folder){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',folder),'utf8'));
 const bytes=await readFile(new URL('corpus.json',folder));
 if(sha256(bytes)!==manifest.corpusSha256)throw Error('UPLOAD_CORPUS_HASH_MISMATCH');
 const corpus=JSON.parse(bytes);
 if(corpus.status!=='DRAFT / UNASSIGNED'||corpus.clinicalUse!==false||corpus.serviceDeployment!==false)throw Error('UPLOAD_REVIEW_STATE_REJECTED');
 return corpus;
}
const normalize=s=>s.toLowerCase().replace(/\s+/g,'');
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
export function retrieveUploadedEvidence(question,corpus){
 if(typeof question!=='string'||!question.trim()||question.length>600)return {status:'INVALID_INPUT',evidence:[]};
 const safe=question.replaceAll('제2형','제이형').replace(/A1C/gi,'당화혈색소');
 if(hasUnscopedNumber(safe,corpus)||/@|https?:|홍길동|주민|전화|주소|이름|성명/u.test(safe))return {status:'PERSONAL_INPUT_NOT_SUPPORTED',evidence:[]};
 if(/처방|복용|치료|수술|진단해|확진|응급|숨.*(?:차|막)|가슴.*(?:아프|통증)/u.test(question))return {status:'REFUSED',evidence:[]};
 const q=normalize(question),scores=new Map();
 const matchingHeld=(corpus.held??[]).map(document=>({...document,matchScore:Math.max(0,...(document.aliases??[])
  .filter(alias=>typeof alias==='string').map(alias=>q.includes(normalize(alias))?normalize(alias).length:0))}))
  .filter(document=>document.matchScore>0);
 const heldScore=Math.max(0,...matchingHeld.map(document=>document.matchScore));
 for(const c of corpus.chunks)for(const term of c.aliases){const t=normalize(term);if(q.includes(t))scores.set(c.topic,Math.max(scores.get(c.topic)||0,t.length));}
 const candidateScore=Math.max(0,...scores.values());
 // A specific non-HOLD topic may outrank a shorter generic HOLD alias. Ties remain fail-closed.
 if(heldScore>0&&heldScore>=candidateScore)return {status:'SOURCE_ON_HOLD',evidence:[],heldSources:matchingHeld
  .filter(document=>document.matchScore===heldScore).slice(0,3).map(({id,title,url,source_url,reason})=>({id,title,url:url??source_url,reason}))};
 const ranked=[...scores].sort((a,b)=>b[1]-a[1]);
 if(!ranked.length||ranked[1]?.[1]===ranked[0][1])return {status:'INSUFFICIENT_EVIDENCE',evidence:[]};
 const topic=ranked[0][0],intent=/증상/.test(q)?'SYMPTOMS':/원인/.test(q)?'CAUSES':/진료|질문/.test(q)?'PREPARE':'UNDERSTAND';
 const evidence=corpus.chunks.filter(c=>c.topic===topic&&c.contentReview==='UNASSIGNED'&&c.ai_qa_status==='PASS'&&sha256(c.text_ko)===c.textSha256)
  .map(c=>({...c,score:(c.section_path.join(' ').includes(intent==='SYMPTOMS'?'증상':intent==='CAUSES'?'원인':'무엇')?2:0)}))
  .sort((a,b)=>b.score-a.score).slice(0,3);
 return {status:evidence.length?'CANDIDATE':'INSUFFICIENT_EVIDENCE',topic,intent,evidence};
}
