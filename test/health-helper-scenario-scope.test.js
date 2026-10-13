import test from 'node:test';
import assert from 'node:assert/strict';
import {loadUploadedCorpus} from '../src/medlineplus-upload-corpus.js';
import {buildScenarioScope} from '../src/health-helper-scenario-scope.js';
import {screeningFields} from '../src/synthetic-health-records.js';
test('scope covers actual screening fields and three scenario exams without inventing HbA1c or patient values',async()=>{
 const c=await loadUploadedCorpus(new URL('../data/medlineplus-upload-ko-20261012-v3/',import.meta.url)),s=buildScenarioScope(c);
 assert.equal(s.rows.length,26);assert.equal(screeningFields().length,23);
 for(const f of screeningFields())assert.equal(s.rows.filter(r=>r.label===f.label).length,1);
 assert.equal(s.evaluation.length,312);assert.ok(s.rows.every(r=>r.questions.length===8&&!Object.hasOwn(r,'value')));
 assert.ok(s.rows.every(r=>r.gaps.includes('의료전문가 검수 미실시')));assert.equal(s.status,'DRAFT / UNASSIGNED');
 assert.deepEqual(s.missingFromRecords,['HbA1c']);assert.equal(s.firstFlow.status,'NOT VERIFIED');
 assert.equal(s.rows.find(r=>r.label==='혈청 AFP').actualRetrieval.status,'INSUFFICIENT_EVIDENCE');
 assert.ok(s.rows.flatMap(r=>r.relatedDocuments).some(d=>d.state==='HOLD'));
 assert.ok(!s.rows.find(r=>r.label==='키').relatedDocuments.some(d=>d.title==='양극성장애'));
 assert.ok(!s.rows.find(r=>r.label==='간 효소 AST').relatedDocuments.some(d=>d.title==='제왕절개 분만'));
});
