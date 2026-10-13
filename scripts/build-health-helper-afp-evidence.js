// Bounded, exclusive candidate creation. Does not overwrite the concept corpus.
import {mkdir,writeFile} from 'node:fs/promises';
import {afpEntries} from '../src/health-helper-afp-evidence.js';
import {POLICY} from '../src/health-helper-scenario-evidence.js';
import {sha256} from '../src/health-helper-medlineplus.js';
const folder=new URL('../data/health-helper-afp-evidence-20261012-v2/',import.meta.url);
await mkdir(folder);await mkdir(new URL('sources/',folder));
const sources=[];
for(const url of [...new Set([POLICY,...afpEntries.map(e=>e.url)])]){
 const r=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!r.ok||!r.headers.get('content-type')?.includes('text/html'))throw Error('SOURCE_FETCH_FAILED');
 let count=0;const parts=[];
 for await(const part of r.body){count+=part.length;if(count>2000000)throw Error('SOURCE_TOO_LARGE');parts.push(part);}
 const body=Buffer.concat(parts),file='sources/'+sha256(url).slice(7)+'.html';
 await writeFile(new URL(file,folder),body,{flag:'wx'});
 sources.push({url,file,sha256:sha256(body),fetchedAt:new Date().toISOString(),scope:'Provenance only; linked references/images not indexed'});
}
const notes=JSON.stringify(afpEntries,null,2)+'\n';
await writeFile(new URL('notes.json',folder),notes,{flag:'wx'});
await writeFile(new URL('manifest.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',
 clinicalUse:false,serviceDeployment:false,notesSha256:sha256(notes),sources,
 sourceCode:'src/health-helper-afp-evidence.js',supportedIntents:afpEntries.map(e=>e.intent)},null,2),{flag:'wx'});
console.log(JSON.stringify({notes:afpEntries.length,sources:sources.length,status:'DRAFT / UNASSIGNED'}));
