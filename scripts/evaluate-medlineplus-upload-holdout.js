import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {loadUploadedCorpus,retrieveUploadedEvidence} from '../src/medlineplus-upload-corpus.js';
import {educationPayload,sha256} from '../src/health-helper-medlineplus.js';

const corpusFolder=new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url);
const fixtureUrl=new URL('../fixtures/health-helper-school-demo-retrieval-holdout-2026-10-13.json',import.meta.url);
const sentenceList=text=>text.match(/[^.!?。！？]+[.!?。！？]+/gu)??[];
function verifiedListItem(chunk){
 if(chunk.sourceComposition!=='KOREAN_LIST_CONTEXT'||!Array.isArray(chunk.sourceComponents)
  ||![2,3].includes(chunk.sourceComponents.length))return null;
 const [heading,...tail]=chunk.sourceComponents,item=tail.at(-1),subheading=tail.length===2?tail[0]:null,
  components=[heading,...(subheading?[subheading]:[]),item];
 if(components.some(component=>!component||typeof component.text_ko!=='string'
  ||sha256(component.text_ko)!==component.textSha256||!Array.isArray(component.segmentIds)||!component.segmentIds.length
  ||component.docId!==chunk.doc_id||component.topic!==chunk.topic||component.sourceUrl!==chunk.source_url))return null;
 const stripTerminal=text=>text.replace(/[.:：]$/u,'');
 const expected=`${stripTerminal(heading.text_ko)}: ${subheading?`${stripTerminal(subheading.text_ko)}: `:''}${stripTerminal(item.text_ko)}.`;
 const segments=components.flatMap(component=>component.segmentIds);
 return chunk.text_ko===expected&&sha256(expected)===chunk.textSha256
  &&JSON.stringify(segments)===JSON.stringify(chunk.source_segment_ids)?item.text_ko:null;
}

export function loadParaphraseHoldout(){
 const fixture=JSON.parse(readFileSync(fixtureUrl,'utf8'));
 if(fixture.schemaVersion!==1||fixture.corpusVersion!=='medlineplus-upload-ko-20261012-v3'
  ||!Array.isArray(fixture.cases)||new Set(fixture.cases.map(test=>test.id)).size!==fixture.cases.length)
  throw Error('PARAPHRASE_HOLDOUT_INVALID');
 return fixture;
}

export function evaluateParaphraseHoldout(corpus,fixture=loadParaphraseHoldout()){
 if(fixture.corpusVersion!==corpus.version)throw Error('HOLDOUT_CORPUS_VERSION_MISMATCH');
 const cases=fixture.cases.map(test=>{
  const result=retrieveUploadedEvidence(test.question,corpus),candidate=result.status==='CANDIDATE';
  const topic=result.topic??result.evidence?.[0]?.topic??null;
  const selectedSentences=(result.evidence??[]).flatMap(chunk=>{
   if(chunk.sourceComposition==='KOREAN_LIST_CONTEXT'){
    const item=verifiedListItem(chunk);if(item===null)return [];
    const sentences=sentenceList(item).map(sentence=>sentence.trim()).filter(Boolean);
    return sentences.length?sentences:[item.trim()];
   }
   const all=sentenceList(chunk.text_ko),indexes=chunk.allowedSentenceIndexes;
   return Array.isArray(indexes)?indexes.map(index=>all[index]?.trim()).filter(Boolean):[];
  });
  const matchedEvidence=(test.expectedEvidence??[]).find(expected=>selectedSentences.includes(expected))??null;
  const expectedEvidenceAll=test.expectedEvidenceAll??[];
  const matchedEvidenceAll=expectedEvidenceAll.filter(expected=>selectedSentences.includes(expected));
  const requiredEvidenceAllCovered=matchedEvidenceAll.length===expectedEvidenceAll.length;
  const expectedIntentMatch=!test.expectedIntent||result.intent===test.expectedIntent;
  const expectedFocuses=test.expectedFocuses??(test.expectedFocus?[test.expectedFocus]:[]);
  const expectedFocusesCovered=expectedFocuses.every(focus=>result.focus?.includes(focus));
  const hashAndIndexIntegrity=candidate&&result.evidence.length>0&&result.evidence.every(chunk=>
   chunk.demoIndexStatus==='PASS'&&chunk.schoolDemoCandidateStatus==='PASS'&&sha256(chunk.text_ko)===chunk.textSha256);
  let rawQuestionFieldExcluded=true,claimEvidenceSchemaRequired=true;
  if(candidate&&!result.extractiveOnly){
   const payload=educationPayload({...result,claimEvidenceRequired:true});
   const userMessage=payload.messages.find(message=>message.role==='user');
   const userContent=JSON.parse(userMessage.content);
   rawQuestionFieldExcluded=Object.keys(userContent).sort().join(',')==='evidence,focus,focusEvidence,intent,topic'
    &&!JSON.stringify(payload).includes(test.question);
   claimEvidenceSchemaRequired=payload.format.required.includes('claimEvidence')
    &&!payload.format.required.includes('questions')
    &&payload.format.properties.claimEvidence.items.properties.sentenceIndexes.items.type==='integer';
  }
  const groundedSupportedHit=test.class!=='SUPPORTED'||candidate&&(test.expectedTopics??[]).includes(topic)
   &&Boolean(matchedEvidence)&&requiredEvidenceAllCovered&&expectedIntentMatch&&expectedFocusesCovered
   &&hashAndIndexIntegrity&&rawQuestionFieldExcluded&&claimEvidenceSchemaRequired;
  const expectedAbstention=test.class!=='ABSTAIN'||result.status===test.expectedStatus
   &&(result.evidence?.length??0)===0;
  return {id:test.id,class:test.class,question:test.question,expectedStatus:test.expectedStatus??'CANDIDATE',
   actualStatus:result.status,expectedTopics:test.expectedTopics??[],actualTopic:topic,
   expectedIntent:test.expectedIntent??null,actualIntent:result.intent??null,expectedFocuses,actualFocuses:result.focus??[],
   matchedEvidence,expectedEvidenceAll,matchedEvidenceAll,requiredEvidenceAllCovered,expectedIntentMatch,expectedFocusesCovered,
   selectedSentenceCount:selectedSentences.length,sourceCount:result.evidence?.length??0,
   hashAndIndexIntegrity,rawQuestionFieldExcluded,claimEvidenceSchemaRequired,
   groundedSupportedHit,expectedAbstention,pass:groundedSupportedHit&&expectedAbstention};
 });
 const supported=cases.filter(test=>test.class==='SUPPORTED'),abstain=cases.filter(test=>test.class==='ABSTAIN');
 const supportedHits=supported.filter(test=>test.groundedSupportedHit).length;
 const correctAbstentions=abstain.filter(test=>test.expectedAbstention).length;
 const falsePositives=abstain.filter(test=>test.actualStatus==='CANDIDATE').length;
 return {corpusVersion:corpus.version,indexScope:corpus.indexScope,
  counts:{indexedDocuments:corpus.indexedDocuments,indexedChunks:corpus.chunks.length,
   demoIndexPassDocuments:corpus.demoIndexPassDocuments,heldDocuments:corpus.held?.length??0,
   schoolDemoCandidatePassDocuments:corpus.schoolDemoCandidateStatus==='PASS'?corpus.indexedDocuments:0,
   supportedCases:supported.length,supportedGroundedHits:supportedHits,
   supportedGroundedHitRate:supported.length?Number((supportedHits/supported.length).toFixed(4)):0,
   abstainCases:abstain.length,correctAbstentions,falsePositives,
   falsePositiveRate:abstain.length?Number((falsePositives/abstain.length).toFixed(4)):0,
   totalCases:cases.length,passed:cases.filter(test=>test.pass).length},
  result:cases.every(test=>test.pass)?'PASS':'FAIL',cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const corpus=await loadUploadedCorpus(corpusFolder,{includeQaHolds:true});
 const report=evaluateParaphraseHoldout(corpus);
 process.stdout.write(`${JSON.stringify(report,null,2)}\n`);
 if(report.result!=='PASS')process.exitCode=1;
}
