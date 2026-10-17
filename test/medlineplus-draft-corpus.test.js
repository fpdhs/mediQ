import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadTranslationDrafts} from '../src/medlineplus-draft-corpus.js';
import {digest} from '../src/medlineplus-translation.js';
import {retrieveMedlineplus,educationPayload,validateEducationOutput} from '../src/health-helper-medlineplus.js';
test('only hash-verified translated drafts enter local retrieval, never clinical approval or held documents',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'medlineplus-draft-test-'));const folder=pathToFileURL(directory+'/');
 try{
  await mkdir(new URL('documents/',folder));const text='CT 검사는 인체 내부의 영상을 얻는 검사입니다.';
  const source='Test fixture CT description.';
  const doc={id:'3951',doc_id:'test-ct',title_en:'CT Scans',title_ko:'컴퓨터 단층촬영',source_url:'https://medlineplus.gov/ctscans.html',
   translationStatus:'TRANSLATED_DRAFT',ai_qa_status:'UNASSIGNED',human_review_status:'UNASSIGNED',
   parts:[{part:1,start:0,end:source.length,sourceText:source,sourceSha256:digest(source),text_ko:text,textSha256:digest(text),checks:{status:'AUTOMATED_CHECKS_PASS'}}]};
  const bytes=JSON.stringify(doc);await writeFile(new URL('documents/3951.json',folder),bytes);
  await writeFile(new URL('state.json',folder),JSON.stringify({completed:[{id:'3951',sha256:digest(bytes)}],held:[]}));
  const chunks=await loadTranslationDrafts(folder);assert.equal(chunks.length,1);assert.equal(chunks[0].ai_qa_status,'UNASSIGNED');
  const r=retrieveMedlineplus('CT는 무엇인가요?',{chunks});assert.equal(r.status,'CANDIDATE');
  assert.match(JSON.stringify(educationPayload(r)),/검사입니다/);
  const result=validateEducationOutput({answer:text,evidenceIds:['E1'],questions:['CT 검사 전에 무엇을 확인할까요?']},r);
  assert.equal(result.sources[0].url,doc.source_url);assert.match(result.sources[0].contextNote,/검수 미실시/);
  await writeFile(new URL('documents/3951.json',folder),bytes+'changed');await assert.rejects(loadTranslationDrafts(folder),/HASH_MISMATCH/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
