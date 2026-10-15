import {readFile} from 'node:fs/promises';
import {loadTranslationDrafts} from '../src/medlineplus-draft-corpus.js';
const folder=new URL('../data/medlineplus-full-ko-20261011-v2/',import.meta.url);
const state=JSON.parse(await readFile(new URL('state.json',folder),'utf8'));
let processAlive=true;try{process.kill(state.pid,0);}catch(e){if(e.code==='ESRCH')processAlive=false;else throw e;}
const chunks=await loadTranslationDrafts(folder);
console.log(JSON.stringify({observedAt:new Date().toISOString(),jobStatus:state.status,processAlive,pid:state.pid,
 additionalDocuments:state.plan.pending,generatedDraftDocuments:state.completed.length+state.held.length,
 storedAutomaticHolds:state.held.length,failedDocuments:state.failed.length,current:state.current,
 localCandidateDocuments:new Set(chunks.map(c=>c.doc_id)).size,localCandidateChunks:chunks.length,
 clinicalApprovedDocuments:0,productionDeployment:false},null,2));
