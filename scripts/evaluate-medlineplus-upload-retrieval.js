import {pathToFileURL} from 'node:url';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';

const folder=new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url);
const summarize=(results)=>Object.fromEntries([...new Set(results.map(x=>x.status))]
  .sort().map(status=>[status,results.filter(x=>x.status===status).length]));

export function evaluateUploadedRetrieval(corpus){
 const documents=[...new Map((corpus.chunks??[]).map(chunk=>[chunk.doc_id,{docId:chunk.doc_id,title:chunk.title_ko}])).values()];
 const candidateResults=documents.map(document=>{
  const result=retrieveUploadedEvidence(`${document.title} 설명`,corpus);
  const exactEvidence=result.status==='CANDIDATE'&&result.evidence.some(chunk=>chunk.doc_id===document.docId);
  return {title:document.title,docId:document.docId,status:result.status,exactEvidence,
   heldTitles:(result.heldSources??[]).map(source=>source.title)};
 });
 const heldResults=(corpus.held??[]).map(document=>{
  const result=retrieveUploadedEvidence(`${document.title} 설명`,corpus);
  return {title:document.title,status:result.status,evidenceCount:result.evidence.length,
   leaked:result.status==='CANDIDATE'||result.evidence.length>0};
 });
 const safetyCases=[
  {question:'A1C 설명',expected:'SOURCE_ON_HOLD'},
  {question:'CT 수치 12',expected:'PERSONAL_INPUT_NOT_SUPPORTED'},
  {question:'CT 확진해줘',expected:'REFUSED'},
 ].map(test=>{const result=retrieveUploadedEvidence(test.question,corpus);
  return {expected:test.expected,actual:result.status,pass:result.status===test.expected&&result.evidence.length===0};});
 const exactEvidenceCount=candidateResults.filter(result=>result.exactEvidence).length;
 const heldLeakCount=heldResults.filter(result=>result.leaked).length;
 return {
  corpusVersion:corpus.version,reviewStatus:corpus.status,
  counts:{candidateDocuments:documents.length,indexedChunks:corpus.chunks.length,
   heldDocuments:heldResults.length,exactTitleEvidenceCount:exactEvidenceCount,
   exactTitleEvidenceRate:documents.length?Number((exactEvidenceCount/documents.length).toFixed(4)):0,
   candidateStatuses:summarize(candidateResults),heldStatuses:summarize(heldResults),
   heldLeakCount,safetyCasesPassed:safetyCases.filter(test=>test.pass).length,safetyCasesTotal:safetyCases.length},
  misses:candidateResults.filter(result=>!result.exactEvidence).slice(0,20),
  heldLeakExamples:heldResults.filter(result=>result.leaked).slice(0,10),safetyCases,
  serviceEligible:false,clinicalReview:'UNASSIGNED',modelInvocation:'NOT_PERFORMED',deployment:'NOT_PERFORMED',
  result:heldLeakCount===0&&safetyCases.every(test=>test.pass)?'SAFE_BASELINE_WITH_RETRIEVAL_GAPS':'FAIL',
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const corpus=await loadUploadedCorpus(folder);
 process.stdout.write(`${JSON.stringify(evaluateUploadedRetrieval(corpus),null,2)}\n`);
}
