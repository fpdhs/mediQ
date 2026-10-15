// Public source snapshots only. No linked vendor content, images or patient records.
import {mkdir,writeFile} from 'node:fs/promises';
import {scenarioEntries,POLICY} from '../src/health-helper-scenario-evidence.js';
import {sha256} from '../src/health-helper-medlineplus.js';
const folder=new URL('../data/health-helper-scenario-evidence-20261012/',import.meta.url);
await mkdir(folder);await mkdir(new URL('sources/',folder));
const urls=[...new Set([POLICY,...scenarioEntries.map(e=>e.url)])],sources=[];
for(let offset=0;offset<urls.length;offset+=4){
 await Promise.all(urls.slice(offset,offset+4).map(async url=>{
  const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
  if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('SOURCE_FETCH_FAILED');
  let bytes=0,parts=[];for await(const part of response.body){bytes+=part.length;if(bytes>2000000)throw Error('SOURCE_TOO_LARGE');parts.push(part);}
  const body=Buffer.concat(parts),name=sha256(url).slice(7)+'.html';
  await writeFile(new URL('sources/'+name,folder),body,{flag:'wx'});
  sources.push({url,file:'sources/'+name,sha256:sha256(body),fetchedAt:new Date().toISOString(),scope:'Snapshot provenance only; HTML/nav/linked references/images not indexed'});
 }));
}
const notes=JSON.stringify(scenarioEntries,null,2)+'\n';await writeFile(new URL('notes.json',folder),notes,{flag:'wx'});
await writeFile(new URL('manifest.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',clinicalUse:false,serviceDeployment:false,
 notesSha256:sha256(notes),sourceCode:'src/health-helper-scenario-evidence.js',topics:26,policy:POLICY,
 sources:sources.sort((a,b)=>a.url.localeCompare(b.url)),medicalReview:'UNASSIGNED',supportedIntents:['CONCEPT'],
 excluded:'Numerical thresholds, diagnosis, treatment, blanket full-document translation and unsupported purposes/preparation/individual comparisons'},null,2),{flag:'wx'});
console.log(JSON.stringify({sources:sources.length,conceptTopics:26,status:'DRAFT / UNASSIGNED',modelCalls:0}));
