// Fixed-source, exclusive candidate snapshot. Never replaces prior evidence.
import {mkdir,writeFile} from 'node:fs/promises';
import {imagingEvidenceEntries} from '../src/health-helper-imaging-evidence.js';
import {sha256} from '../src/health-helper-medlineplus.js';

const folder=new URL('../data/health-helper-imaging-evidence-20261012-v6/',import.meta.url);
await mkdir(folder);await mkdir(new URL('sources/',folder));
const urls=[...new Set(imagingEvidenceEntries.flatMap(entry=>[entry.url,entry.rightsPolicy]))],sources=[];
for(const url of urls){
 const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error'});
 if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))throw Error('SOURCE_FETCH_FAILED');
 let size=0;const chunks=[];
 for await(const chunk of response.body){size+=chunk.length;if(size>2000000)throw Error('SOURCE_TOO_LARGE');chunks.push(chunk);}
 const bytes=Buffer.concat(chunks),file=`sources/${sha256(url).slice(7)}.html`;
 await writeFile(new URL(file,folder),bytes,{flag:'wx'});
 sources.push({url,file,sha256:sha256(bytes),fetchedAt:new Date().toISOString(),scope:url.includes('fda.gov')
  ?'FDA.gov public-domain page; snapshot for provenance and hash only; FDA attribution retained'
  :'MedlinePlus public-domain Medical Test or use-policy page; snapshot for provenance and hash only; linked third-party material excluded'});
}
const notes=JSON.stringify(imagingEvidenceEntries,null,2)+'\n';
await writeFile(new URL('notes.json',folder),notes,{flag:'wx'});
await writeFile(new URL('manifest.json',folder),JSON.stringify({status:'DRAFT / UNASSIGNED',medicalReview:'UNASSIGNED',
 clinicalUse:false,serviceDeployment:false,notesSha256:sha256(notes),sources,sourceCode:'src/health-helper-imaging-evidence.js',
 entryCount:imagingEvidenceEntries.length,supportedModalities:['ULTRASOUND','CT'],supportedIntents:['PURPOSE','LIMITS','PREPARATION','COMPARISON']},null,2),{flag:'wx'});
console.log(JSON.stringify({notes:imagingEvidenceEntries.length,sources:sources.length,status:'DRAFT / UNASSIGNED'}));
