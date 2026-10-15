// Fetch a fixed allowlist into an exclusive candidate directory; never rewrites prior evidence.
import {mkdir,writeFile} from 'node:fs/promises';
import {liverFunctionEntries} from '../src/health-helper-liver-evidence.js';
import {POLICY} from '../src/health-helper-scenario-evidence.js';
import {sha256} from '../src/health-helper-medlineplus.js';

const folder=new URL('../data/health-helper-liver-evidence-20261013-v4/',import.meta.url);
await mkdir(folder);await mkdir(new URL('sources/',folder));
const urls=[...new Set([POLICY,...liverFunctionEntries.map(e=>e.url)])],sources=[];
for(const url of urls){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('SOURCE_FETCH_FAILED');
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>2000000)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks),file=`sources/${sha256(url).slice(7)}.html`;
 await writeFile(new URL(file,folder),bytes,{flag:'wx'});
 sources.push({url,file,sha256:sha256(bytes),fetchedAt:new Date().toISOString(),scope:'MedlinePlus Medical Test information or use policy only; linked third-party content is not included'});
}
const notes=JSON.stringify(liverFunctionEntries,null,2)+'\n';
await writeFile(new URL('notes.json',folder),notes,{flag:'wx'});
await writeFile(new URL('manifest.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',clinicalUse:false,
 serviceDeployment:false,notesSha256:sha256(notes),sources,sourceCode:'src/health-helper-liver-evidence.js',entryCount:liverFunctionEntries.length},null,2),{flag:'wx'});
console.log(JSON.stringify({notes:liverFunctionEntries.length,sources:sources.length,status:'DRAFT / UNASSIGNED'}));
