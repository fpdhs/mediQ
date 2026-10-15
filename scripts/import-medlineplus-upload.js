import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {buildUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {sha256} from '../src/health-helper-medlineplus.js';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/import-medlineplus-upload.js INPUT_JSONL NEW_OUTPUT_DIRECTORY');
const bytes=await readFile(input);if(bytes.length>100*1024*1024)throw Error('UPLOAD_TOO_LARGE');
const docs=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,'').trim().split(/\r?\n/).map(JSON.parse);
const corpus=buildUploadedCorpus(docs),text=JSON.stringify(corpus)+'\n',destination=resolve(output);
await mkdir(destination); // Exclusive creation: never overwrite previous data.
await writeFile(join(destination,'corpus.json'),text,{flag:'wx'});
await writeFile(join(destination,'manifest.json'),JSON.stringify({version:corpus.version,status:corpus.status,input:resolve(input),inputSha256:sha256(bytes),
 corpusSha256:sha256(text),totalDocuments:corpus.totalDocuments,registeredDocuments:corpus.registeredDocuments,indexedDocuments:corpus.indexedDocuments,held:corpus.held,chunks:corpus.chunks.length,
 humanReview:'UNASSIGNED',clinicalUse:false,serviceDeployment:false,rightsCheckedAt:'2026-10-12',rightsPolicy:'https://medlineplus.gov/about/using/usingcontent/'},null,2),{flag:'wx'});
console.log(JSON.stringify({destination,total:corpus.totalDocuments,indexed:corpus.indexedDocuments,held:corpus.held.length,chunks:corpus.chunks.length}));
