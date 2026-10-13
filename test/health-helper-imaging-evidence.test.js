import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {imagingEvidenceEntries,retrieveImagingEvidence,verifyImagingEvidence} from '../src/health-helper-imaging-evidence.js';
import {validateEducationOutput} from '../src/health-helper-medlineplus.js';
import {helperSourceUrl} from '../public/ui/patient-helper.js';
import {sourceUpdatedAtForUrl} from '../src/health-helper-source-freshness.js';

test('ultrasound and CT purpose, limits, preparation, and comparison are isolated extractive candidates',()=>{
 const cases=[
  ['간 초음파 목적은 무엇인가요?','imaging-ultrasound-purpose'],
  ['초음파 결과의 한계는 무엇인가요?','imaging-ultrasound-limits'],
  ['간 초음파 준비는 어떻게 하나요?','imaging-ultrasound-preparation'],
  ['이전 초음파와 비교하려면 무엇을 챙기나요?','imaging-ultrasound-comparison'],
  ['복부 CT 목적은 무엇인가요?','imaging-ct-purpose'],
  ['CT 영상만 보고 제 결과를 판단할 수 있나요?','imaging-ct-limits'],
  ['CT 검사 전에는 무엇을 준비하나요?','imaging-ct-preparation'],
  ['이전 CT와 비교하려면 무엇을 확인하나요?','imaging-ct-comparison'],
 ];
 for(const [question,id] of cases){
  const result=retrieveImagingEvidence(question);assert.equal(result.status,'CANDIDATE',question);
  const entry=result.evidence[0];assert.equal(entry.chunk_id,id);assert.equal(entry.contentReview,'UNASSIGNED');
  assert.equal(entry.source_updated_at,sourceUpdatedAtForUrl(entry.source_url));
  assert.equal(result.extractiveOnly,true);assert.equal(entry.clinicalUse,false);
  assert.ok(helperSourceUrl(entry.source_url),`approved source link: ${entry.source_url}`);
  assert.ok(helperSourceUrl(entry.rights_policy_url),`approved rights link: ${entry.rights_policy_url}`);
  const output={answer:entry.text_ko,evidenceIds:['E1'],questions:[result.questionTemplate]};
  assert.equal(validateEducationOutput(output,result).status,'GENERATED');
  assert.throws(()=>validateEducationOutput({...output,answer:output.answer+' 개인 결과는 안전합니다.'},result),/REJECTED/);
  assert.throws(()=>validateEducationOutput({...output,questions:['간암이 맞나요?']},result),/REJECTED/);
 }
 assert.equal(imagingEvidenceEntries.length,8);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ultrasound-limits').text,/이온화 방사선을 사용하지 않으며/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ultrasound-limits').text,/결과의 의미가 살펴본 부위에 따라 달라진다/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ultrasound-preparation').text,/간 초음파에 일괄 적용할 수는 없습니다/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ct-limits').text,/이온화 방사선을 사용하며/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ct-limits').text,/영상의학과 전문의가 검토/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ct-preparation').text,/장신구를 빼도록 안내/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ultrasound-comparison').text,/날짜·종류·촬영 기관/u);
 assert.match(imagingEvidenceEntries.find(entry=>entry.id==='imaging-ct-comparison').text,/조영제 투여 여부/u);
 const fda=retrieveImagingEvidence(cases[3][0]).evidence[0];
 const validated=validateEducationOutput({answer:fda.text_ko,evidenceIds:['E1'],questions:[retrieveImagingEvidence(cases[3][0]).questionTemplate]},retrieveImagingEvidence(cases[3][0]));
 assert.equal(validated.sources[0].institution,'U.S. Food and Drug Administration');
 assert.equal(validated.sources[0].title,'Education and Communication · Patient Medical Imaging Record Card section');
 assert.equal(validated.sources[0].licenseUrl,'https://www.fda.gov/about-fda/about-website/website-policies');
});

test('imaging evidence refuses diagnosis and personal input; unsupported comparisons and mixed requests fail closed',()=>{
 for(const q of ['홍길동 CT 목적','CT 82 결과를 해석해줘','초음파 1.2cm 결과 비교'])assert.equal(retrieveImagingEvidence(q).status,'PERSONAL_INPUT_NOT_SUPPORTED',q);
 for(const q of ['CT로 간암을 확진해줘','내 CT 결과가 암인가요?']){
  const result=retrieveImagingEvidence(q);assert.equal(result.status,'REFUSED',q);assert.deepEqual(result.evidence,[]);
 }
 for(const q of ['CT와 초음파 중 어떤 검사가 더 정확한가요?','CT 목적과 준비는?','CT 정상범위는?','초음파와 이전 CT를 비교해줘']){
  const result=retrieveImagingEvidence(q);assert.equal(result.status,'INSUFFICIENT_EVIDENCE',q);assert.deepEqual(result.evidence,[]);
 }
 assert.equal(retrieveImagingEvidence('CT가 뭐예요?').intent,'CONCEPT','existing concept routing remains available');
});

test('imaging evidence snapshots are fixed, source-hashed, and not deployable',async()=>{
 const historical=await verifyImagingEvidence(new URL('../data/health-helper-imaging-evidence-20261012-v4/',import.meta.url));
 assert.equal(historical.entryCount,8);
 const manifest=await verifyImagingEvidence(new URL('../data/health-helper-imaging-evidence-20261012-v6/',import.meta.url));
 assert.equal(manifest.entryCount,8);assert.equal(manifest.serviceDeployment,false);assert.equal(manifest.sources.length,5);
 assert.ok(manifest.sources.some(source=>source.url==='https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication'));
});

test('imaging-only local preview verifies the current v6 candidate, not historical v4',async()=>{
 const preview=await readFile(new URL('../scripts/medlineplus-local-preview.js',import.meta.url),'utf8');
 assert.match(preview,/if\(imaging\)await verifyImagingEvidence\(new URL\('\.\.\/data\/health-helper-imaging-evidence-20261012-v6\//u);
 assert.doesNotMatch(preview,/if\(imaging\)[^\n]*health-helper-imaging-evidence-20261012-v4/u);
});

test('only the exact FDA patient-record and website-policy URLs pass the UI external-link allowlist',()=>{
 assert.equal(helperSourceUrl('https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication'),
  'https://www.fda.gov/radiation-emitting-products/initiative-reduce-unnecessary-radiation-exposure-medical-imaging/education-and-communication');
 assert.equal(helperSourceUrl('https://www.fda.gov/about-fda/about-website/website-policies?x=1'),null);
 assert.equal(helperSourceUrl('http://www.fda.gov/about-fda/about-website/website-policies'),null);
 assert.equal(helperSourceUrl('https://medlineplus.gov/about/using/usingcontent/'),'https://medlineplus.gov/about/using/usingcontent/');
});
