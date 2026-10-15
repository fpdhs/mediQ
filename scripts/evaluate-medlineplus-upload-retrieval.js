import {pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {educationPayload} from '../src/health-helper-medlineplus.js';

const folder=new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url);
const goldenFile=new URL('../fixtures/health-helper-school-demo-retrieval-golden.json',import.meta.url);
const summarize=(results)=>Object.fromEntries([...new Set(results.map(x=>x.status))]
  .sort().map(status=>[status,results.filter(x=>x.status===status).length]));

export function loadSchoolDemoGoldenCases(){
 const benchmark=JSON.parse(readFileSync(goldenFile,'utf8'));
 if(benchmark.schemaVersion!==1||!Array.isArray(benchmark.cases))throw Error('GOLDEN_RETRIEVAL_FIXTURE_INVALID');
 return benchmark;
}

export function evaluateUploadedRetrieval(corpus,benchmark=null){
 const documents=[...new Map((corpus.chunks??[]).map(chunk=>[chunk.doc_id,{docId:chunk.doc_id,title:chunk.title_ko}])).values()];
 const candidateResults=documents.map(document=>{
  const result=retrieveUploadedEvidence(`${document.title} 설명`,corpus);
  const exactChunk=result.status==='CANDIDATE'&&result.evidence.find(chunk=>chunk.doc_id===document.docId);
  const exactEvidence=Boolean(exactChunk);
  return {title:document.title,docId:document.docId,status:result.status,exactEvidence,
   responseMode:result.sourceLookupOnly?'SOURCE_LOOKUP_ONLY':result.extractiveOnly?'SOURCE_GUIDANCE':result.status==='CANDIDATE'?'MODEL_SELECTION':result.status,
   sourceQuality:exactChunk?.ai_qa_status??null,demoIndexStatus:exactChunk?.demoIndexStatus??null,
   schoolDemoCandidateStatus:exactChunk?.schoolDemoCandidateStatus??null,
   sourceUrlPresent:Boolean(exactChunk?.source_url)};
 });
 const heldDocIds=new Map((corpus.heldDocuments??[]).map(document=>[document.id,document.doc_id]));
 const heldResults=(corpus.held??[]).map(document=>{
  const result=retrieveUploadedEvidence(`${document.title} 설명`,corpus);
  const docId=heldDocIds.get(document.id)??document.id;
  const exactChunks=result.evidence.filter(chunk=>chunk.doc_id===docId);
  const indexedChunks=(corpus.chunks??[]).filter(chunk=>chunk.doc_id===docId);
  return {title:document.title,docId,status:result.status,evidenceCount:exactChunks.length,
   indexedForDemo:indexedChunks.length>0&&indexedChunks.every(chunk=>chunk.demoIndexStatus==='PASS'
    &&chunk.schoolDemoCandidateStatus==='PASS'),
   retrievedByTitle:exactChunks.length>0,
   sourceQaStatus:document.aiQaStatus,sourceContentReview:document.sourceContentReview,
   unresolvedIssueCount:document.unresolvedIssueCount??0};
 });
 const a1cHold=(corpus.held??[]).find(document=>document.aliases?.some(alias=>/A1C/iu.test(alias)));
 const safetyCases=[
  {question:'A1C 설명',expected:'CANDIDATE',expectedTopic:a1cHold?.id??'6308',expectedSourceQuality:'HOLD'},
  {question:'CT 수치 12',expected:'PERSONAL_INPUT_NOT_SUPPORTED'},
  {question:'CT 확진해줘',expected:'REFUSED'},
 ].map(test=>{const result=retrieveUploadedEvidence(test.question,corpus);
  const selected=result.evidence.find(chunk=>chunk.topic===test.expectedTopic);
  return {expected:test.expected,actual:result.status,expectedTopic:test.expectedTopic??null,
   actualTopic:result.topic??null,expectedSourceQuality:test.expectedSourceQuality??null,
   actualSourceQuality:selected?.ai_qa_status??null,
   demoIndexStatus:selected?.demoIndexStatus??null,
   pass:result.status===test.expected&&(!test.expectedTopic||result.topic===test.expectedTopic)
    &&(!test.expectedSourceQuality||selected?.ai_qa_status===test.expectedSourceQuality&&selected?.demoIndexStatus==='PASS')
    &&(Boolean(test.expectedTopic)||result.evidence.length===0)};});
 const golden=benchmark?(()=>{
  if(benchmark.corpusVersion!==corpus.version)throw Error('GOLDEN_CORPUS_VERSION_MISMATCH');
  return benchmark.cases.map(test=>{
   const result=retrieveUploadedEvidence(test.question,corpus),candidate=result.status==='CANDIDATE';
   const modelSelectionExpected=candidate&&!result.extractiveOnly;
   const expectedResponseMode=candidate?(result.sourceLookupOnly?'SOURCE_LOOKUP_ONLY':result.extractiveOnly?'SOURCE_GUIDANCE':'MODEL_SELECTION'):result.status;
   const evidenceMatches=!candidate?result.evidence.length===0:
    result.evidence.length>0&&result.evidence.every(chunk=>chunk.topic===test.expectedTopic)
     &&(!test.expectedEvidenceText||result.evidence.some(chunk=>chunk.text_ko.includes(test.expectedEvidenceText)));
   const payload=modelSelectionExpected?educationPayload({...result,claimEvidenceRequired:true}):null;
   let rawQuestionFieldExcluded=true;
   if(modelSelectionExpected){
    const userMessage=payload.messages.find(message=>message.role==='user');
    const userContent=JSON.parse(userMessage.content);
    rawQuestionFieldExcluded=Object.keys(userContent).sort().join(',')==='evidence,focus,focusEvidence,intent,topic';
   }
   const claimEvidenceSchemaRequired=!modelSelectionExpected||payload.format.required.includes('claimEvidence')
    &&!payload.format.required.includes('questions')&&payload.format.properties.claimEvidence.items.properties.sentenceIndexes.items.type==='integer';
   const pass=result.status===test.expectedStatus&&(!test.expectedTopic||result.topic===test.expectedTopic)
    &&(!test.expectedIntent||result.intent===test.expectedIntent)
    &&(!test.expectedFocus||result.focus?.includes(test.expectedFocus))
    &&(!test.expectedFocuses||test.expectedFocuses.every(focus=>result.focus?.includes(focus)))&&(!test.expectedSourceQuality
     ||result.evidence.some(chunk=>chunk.ai_qa_status===test.expectedSourceQuality&&chunk.demoIndexStatus==='PASS'))
    &&(!test.expectedResponseMode||expectedResponseMode===test.expectedResponseMode)
    &&evidenceMatches&&rawQuestionFieldExcluded&&claimEvidenceSchemaRequired;
   return {id:test.id,expectedStatus:test.expectedStatus,actualStatus:result.status,
    expectedTopic:test.expectedTopic??null,actualTopic:result.topic??null,expectedIntent:test.expectedIntent??null,
    expectedEvidenceText:test.expectedEvidenceText??null,
    expectedResponseMode:test.expectedResponseMode??null,actualResponseMode:expectedResponseMode,
    expectedSourceQuality:test.expectedSourceQuality??null,
    expectedFocus:test.expectedFocus??null,expectedFocuses:test.expectedFocuses??null,actualFocus:result.focus??[],
    actualIntent:result.intent??null,evidenceCount:result.evidence.length,evidenceMatches,rawQuestionFieldExcluded,
    claimEvidenceSchemaRequired,pass};
  });
 })():[];
 const exactEvidenceCount=candidateResults.filter(result=>result.exactEvidence).length;
 const sourceLookupOnlyResults=candidateResults.filter(result=>result.responseMode==='SOURCE_LOOKUP_ONLY');
 const allHeldDemoIndexed=heldResults.length===0||heldResults.every(result=>result.indexedForDemo&&result.sourceQaStatus==='HOLD');
 const unresolvedIssueCount=heldResults.reduce((sum,result)=>sum+result.unresolvedIssueCount,0);
 return {
  corpusVersion:corpus.version,reviewStatus:corpus.status,
  counts:{indexedDocuments:documents.length,indexedChunks:corpus.chunks.length,
   demoIndexPassDocuments:corpus.demoIndexPassDocuments??0,excludedNonKoreanChunks:corpus.excludedNonKoreanChunks??0,
   schoolDemoCandidatePassDocuments:corpus.schoolDemoCandidateStatus==='PASS'?corpus.indexedDocuments:0,
   heldDocuments:heldResults.length,heldDocumentsIndexedForDemo:heldResults.filter(result=>result.indexedForDemo).length,
   sourceQaHoldsPreserved:heldResults.filter(result=>result.sourceQaStatus==='HOLD').length,
   unresolvedIssueCount,exactTitleEvidenceCount:exactEvidenceCount,
   exactTitleEvidenceRate:documents.length?Number((exactEvidenceCount/documents.length).toFixed(4)):0,
   candidateStatuses:summarize(candidateResults),heldStatuses:summarize(heldResults),
   titleQueryNonCandidateCount:candidateResults.length-exactEvidenceCount,
   sourceLookupOnlyTitleQueries:sourceLookupOnlyResults.length,
   sourceLookupOnlyTitleEvidenceCount:sourceLookupOnlyResults.filter(result=>result.exactEvidence
    &&result.demoIndexStatus==='PASS'&&result.sourceUrlPresent).length,
   sourceLookupOnlySourceQualityCounts:summarize(sourceLookupOnlyResults.map(result=>({status:result.sourceQuality??'MISSING'}))),
   goldenCasesPassed:golden.filter(test=>test.pass).length,goldenCasesTotal:golden.length,
   goldenCasePassRate:golden.length?Number((golden.filter(test=>test.pass).length/golden.length).toFixed(4)):null,
   safetyCasesPassed:safetyCases.filter(test=>test.pass).length,safetyCasesTotal:safetyCases.length},
  titleQueryInterpretation:'Exact-title-plus-explanation sweep; ambiguous, high-risk, or multi-concept titles without jointly supported evidence may return metadata-only source lookup. This measures retrieval behavior, not clinical answer accuracy.',
  misses:candidateResults.filter(result=>!result.exactEvidence).slice(0,20),
  sourceQualityHolds:heldResults.slice(0,20),safetyCases,goldenCases:golden,
  serviceEligible:false,clinicalReview:'UNASSIGNED',modelInvocation:'NOT_PERFORMED',
  answerGeneration:'NOT_EVALUATED',semanticGrounding:'NOT_ASSESSED',deployment:'NOT_PERFORMED',
  demoIndexStatus:allHeldDemoIndexed&&corpus.demoIndexPassDocuments===documents.length?'PASS':'FAIL',
  schoolDemoCandidateStatus:corpus.schoolDemoCandidateStatus==='PASS'&&corpus.indexedDocuments===documents.length?'PASS':'FAIL',
  contentQaStatus:'UNASSIGNED / SOURCE HOLDS PRESERVED',
  result:allHeldDemoIndexed&&corpus.demoIndexPassDocuments===documents.length
   &&corpus.schoolDemoCandidateStatus==='PASS'&&corpus.indexedDocuments===documents.length
   &&safetyCases.every(test=>test.pass)&&golden.every(test=>test.pass)
   ?'SCHOOL_DEMO_INDEX_PASS_WITH_UNREVIEWED_CONTENT_HOLDS':'FAIL',
 };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const corpus=await loadUploadedCorpus(folder,{includeQaHolds:true});
 const benchmark=loadSchoolDemoGoldenCases();
 process.stdout.write(`${JSON.stringify(evaluateUploadedRetrieval(corpus,benchmark),null,2)}\n`);
}
