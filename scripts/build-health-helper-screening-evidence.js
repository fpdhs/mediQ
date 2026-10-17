// Fetch only fixed public-source URLs into a new candidate snapshot; this never deploys content.
import {mkdir,writeFile} from 'node:fs/promises';
import {screeningEvidenceEntries} from '../src/health-helper-screening-evidence.js';
import {sha256} from '../src/health-helper-medlineplus.js';

const folder=new URL('../data/health-helper-screening-evidence-20261013-v3/',import.meta.url);
await mkdir(folder);await mkdir(new URL('sources/',folder));
const urls=[...new Set(screeningEvidenceEntries.flatMap(entry=>[entry.url,entry.rightsPolicy]))],sources=[];
for(const url of urls){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('SOURCE_FETCH_FAILED');
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>2000000)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks),file=`sources/${sha256(url).slice(7)}.html`;
 await writeFile(new URL(file,folder),bytes,{flag:'wx'});
 sources.push({url,file,sha256:sha256(bytes),fetchedAt:new Date().toISOString(),
  scope:url.includes('fda.gov')
   ?'FDA.gov page snapshot retained for provenance/hash only; only selected public guidance summarized; FDA attribution retained'
   :'MedlinePlus Medical Test or Health Topic page snapshot retained for provenance/hash only; linked third-party material not used in candidate summaries'});
}
const notes=JSON.stringify(screeningEvidenceEntries,null,2)+'\n';
await writeFile(new URL('notes.json',folder),notes,{flag:'wx'});
await writeFile(new URL('manifest.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',clinicalUse:false,
 serviceDeployment:false,notesSha256:sha256(notes),sources,sourceCode:'src/health-helper-screening-evidence.js',
 entryCount:screeningEvidenceEntries.length,topicCount:new Set(screeningEvidenceEntries.map(entry=>entry.key)).size,
 supportedIntents:['PURPOSE','LIMITS','PREPARATION','COMPARISON'],sourceReview:'PROJECT_SOURCE_CHECK_ONLY',
 medicalContentReview:'UNASSIGNED',patientDataIncluded:false,sourceSnapshotsAreRetrievalCorpus:false},null,2),{flag:'wx'});
console.log(JSON.stringify({entries:screeningEvidenceEntries.length,topics:new Set(screeningEvidenceEntries.map(entry=>entry.key)).size,
 sources:sources.length,status:'DRAFT / UNASSIGNED',clinicalUse:false,serviceDeployment:false}));
