import {readFile} from 'node:fs/promises';
import {digest,translationChecks} from './medlineplus-translation.js';
import {sha256} from './health-helper-medlineplus.js';
const aliases={'6308':['당화혈색소','A1C'],'3951':['CT','컴퓨터단층촬영'],'6382':['신장검사','신장 검사'],
 '310':['간질환','간 질환'],'309':['간암']};
export async function loadTranslationDrafts(folder){
 let state;try{state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}
 const chunks=[];
 for(const entry of [...state.completed,...state.held]){
  if(!/^\d{1,8}$/u.test(entry.id))throw new Error('DRAFT_DOCUMENT_ID_REJECTED');
  const bytes=await readFile(new URL(`documents/${entry.id}.json`,folder));if(digest(bytes)!==entry.sha256)throw new Error('DRAFT_DOCUMENT_HASH_MISMATCH');
  const d=JSON.parse(bytes);const u=new URL(d.source_url);
  if(!['TRANSLATED_DRAFT','HOLD'].includes(d.translationStatus)||d.ai_qa_status!=='UNASSIGNED'||d.human_review_status!=='UNASSIGNED'
   ||u.protocol!=='https:'||u.hostname!=='medlineplus.gov'||u.username||u.password||u.port||u.search||u.hash
   ||!/^\/[a-z0-9]+\.html$/u.test(u.pathname)||['34','6055'].includes(d.id))throw new Error('DRAFT_DOCUMENT_REJECTED');
  // Recheck automatic HOLDs against the current checker; never inherit clinical/historical PASS.
  if(translationChecks(d.title_en,d.title_ko).status!=='AUTOMATED_CHECKS_PASS'
    ||d.parts.some(p=>translationChecks(p.sourceText,p.text_ko).status!=='AUTOMATED_CHECKS_PASS'))continue;
  for(const p of d.parts){
   if(digest(p.text_ko)!==p.textSha256||digest(p.sourceText)!==p.sourceSha256)throw new Error('DRAFT_PART_REJECTED');
   if(p.text_ko.length>1400)continue; // No truncation or assertion of full document indexing.
   chunks.push({chunk_id:`medlineplus-full-${d.id}-part-${p.part}`,doc_id:d.doc_id,topic:d.id,
    title_ko:d.title_ko,text_ko:p.text_ko,textSha256:sha256(p.text_ko),source_url:d.source_url,
    source_updated_at:d.source_updated_at,section_path:[`번역 초안 · 원문 구간 ${p.start}–${p.end}`],
    ai_qa_status:'UNASSIGNED',contentReview:'UNASSIGNED',clinicalUse:false,candidateOrigin:'LOCAL_TRANSLATION_DRAFT',
    aliases:[d.title_ko,...(aliases[d.id]??[])],attribution:d.attribution,rights_policy_url:d.rights_policy_url,
    translation_notice:'로컬 Qwen 한국어 번역 초안 · 자동 수치/부정문 점검만 수행 · 원문 대조 및 의료전문가 검수 미실시 · NLM 공식 한국어 자료 아님.'});
  }
 }
 return chunks;
}
