import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {validateMedlineplusBatch,sha256} from '../src/health-helper-medlineplus.js';
const [documentsPath,chunksPath,outputPath] = process.argv.slice(2);
if (!documentsPath || !chunksPath || !outputPath) throw new Error('Usage: node scripts/import-medlineplus-candidate.js documents.jsonl chunks.jsonl NEW_OUTPUT_DIRECTORY');
const inputs = await Promise.all([documentsPath,chunksPath].map(p => readFile(p)));
const parse = buffer => buffer.toString('utf8').replace(/^\uFEFF/u,'').trim().split(/\r?\n/u).map(line => JSON.parse(line));
const corpus = validateMedlineplusBatch(...inputs.map(parse));
const destination = resolve(outputPath);
// Exclusive directory creation: never overwrite an existing imported candidate.
await mkdir(destination);
try {
  const content=JSON.stringify(corpus,null,2)+'\n';
  await writeFile(join(destination,'corpus.json'),content,{flag:'wx'});
  await writeFile(join(destination,'manifest.json'),JSON.stringify({version:corpus.version,status:corpus.status,createdAt:new Date().toISOString(),
    inputs:[documentsPath,chunksPath].map((p,i)=>({path:resolve(p),sha256:sha256(inputs[i])})),corpusSha256:sha256(content),
    documents:corpus.documents.length,eligibleDocuments:new Set(corpus.chunks.map(c=>c.doc_id)).size,chunks:corpus.chunks.length,
    originalZipVerification:'NOT VERIFIED',humanReview:'UNASSIGNED',serviceDeployment:false},null,2)+'\n',{flag:'wx'});
} catch (error) { /* Leave partial output for inspection, never silently delete material. */ throw error; }
console.log(JSON.stringify({destination,documents:corpus.documents.length,chunks:corpus.chunks.length,status:corpus.status}));
