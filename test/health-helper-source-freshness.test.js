import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractSourceUpdatedAt} from '../src/health-helper-source-sections.js';
import {sourceUpdatedAtByUrl,sourceUpdatedAtForUrl} from '../src/health-helper-source-freshness.js';
import {scenarioEntries,verifyScenarioEvidence} from '../src/health-helper-scenario-evidence.js';
import {afpEntries,verifyAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {liverFunctionEntries,verifyLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {screeningEvidenceEntries,verifyScreeningEvidence} from '../src/health-helper-screening-evidence.js';
import {imagingEvidenceEntries,verifyImagingEvidence} from '../src/health-helper-imaging-evidence.js';

const snapshots=[
 {folder:new URL('../data/health-helper-scenario-evidence-20261012/',import.meta.url),verify:verifyScenarioEvidence},
 {folder:new URL('../data/health-helper-afp-evidence-20261012-v2/',import.meta.url),verify:verifyAfpEvidence},
 {folder:new URL('../data/health-helper-liver-evidence-20261013-v4/',import.meta.url),verify:verifyLiverFunctionEvidence},
 {folder:new URL('../data/health-helper-screening-evidence-20261013-v3/',import.meta.url),verify:verifyScreeningEvidence},
 {folder:new URL('../data/health-helper-imaging-evidence-20261012-v6/',import.meta.url),verify:verifyImagingEvidence},
];

test('all current MedlinePlus candidate pages match freshness metadata in hash-verified snapshots',async()=>{
 const entries=[...scenarioEntries,...afpEntries,...liverFunctionEntries,...screeningEvidenceEntries,...imagingEvidenceEntries];
 const contentUrls=new Set(entries.map(entry=>entry.url).filter(url=>url.startsWith('https://medlineplus.gov/')));
 const snapshotsByUrl=new Map();
 for(const definition of snapshots){
  const manifest=await definition.verify(definition.folder);
  for(const source of manifest.sources){
   if(contentUrls.has(source.url)){
    const html=await readFile(new URL(source.file,definition.folder),'utf8');
    assert.equal(sourceUpdatedAtForUrl(source.url),extractSourceUpdatedAt(html),source.url);
    snapshotsByUrl.set(source.url,{source,folder:definition.folder});
   }
  }
 }
 assert.deepEqual([...snapshotsByUrl.keys()].sort(),[...contentUrls].sort(),'every current MedlinePlus candidate URL has a verified snapshot');
 for(const url of Object.keys(sourceUpdatedAtByUrl))assert.ok(contentUrls.has(url),`stale or unrelated freshness-map key: ${url}`);
 for(const url of contentUrls){
  const pageDate=sourceUpdatedAtForUrl(url);
  assert.equal(pageDate===null,extractSourceUpdatedAt(await readFile(new URL(snapshotsByUrl.get(url).source.file,snapshotsByUrl.get(url).folder),'utf8'))===null,url);
 }
 assert.equal(contentUrls.size,Object.keys(sourceUpdatedAtByUrl).length);
});

test('unknown and non-source URLs have no editorial update metadata',()=>{
 assert.equal(sourceUpdatedAtForUrl('https://example.invalid/page/'),null);
 assert.equal(sourceUpdatedAtForUrl('https://medlineplus.gov/about/using/usingcontent/'),null);
});
