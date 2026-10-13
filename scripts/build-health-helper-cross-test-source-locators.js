// Builds a local reviewer aid from fixed, non-deployable candidate snapshots.
// It records provenance and section locators; it does not judge clinical support.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {retrieveHealthEducationEvidence} from '../src/health-helper-education-retrieval.js';
import {scenarioEntries} from '../src/health-helper-scenario-evidence.js';
import {verifyAfpEvidence} from '../src/health-helper-afp-evidence.js';
import {verifyLiverFunctionEvidence} from '../src/health-helper-liver-evidence.js';
import {verifyScenarioEvidence} from '../src/health-helper-scenario-evidence.js';
import {verifyScreeningEvidence} from '../src/health-helper-screening-evidence.js';
import {extractSourceUpdatedAt,sourceSectionFingerprints,sourceSectionParagraphLocators,sourceSectionsExist} from '../src/health-helper-source-sections.js';
import {sourceUpdatedAtForUrl} from '../src/health-helper-source-freshness.js';

const outputUrl=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);
const expectedByLabel=new Map([
 ['시력 · 좌 / 우','screening-vision-purpose'],['청력 · 좌 / 우','screening-hearing-limits'],
 ['혈색소','screening-hemoglobin-purpose'],['간 효소 AST','liver-ast-purpose'],['간 효소 ALT','liver-alt-purpose'],
 ['간 효소 γ-GTP','liver-ggt-purpose'],['신장기능 eGFR','screening-egfr-purpose'],['요단백','screening-urine-protein-purpose'],
 ['총콜레스테롤','screening-total-cholesterol-purpose'],['HDL 콜레스테롤','screening-hdl-purpose'],
 ['LDL 콜레스테롤','screening-ldl-purpose'],['중성지방','screening-triglycerides-limits'],
 ['C형간염 항체','screening-hcv-antibody-limits'],['폐기능검사','scenario-21'],
 ['구강검진','screening-dental-purpose'],['혈청 AFP','afp-detail-purpose'],
]);
const snapshotDefinitions=[
 {name:'AFP v2',path:'data/health-helper-afp-evidence-20261012-v2',folder:new URL('../data/health-helper-afp-evidence-20261012-v2/',import.meta.url),verify:verifyAfpEvidence},
 {name:'Liver v4',path:'data/health-helper-liver-evidence-20261013-v4',folder:new URL('../data/health-helper-liver-evidence-20261013-v4/',import.meta.url),verify:verifyLiverFunctionEvidence},
 {name:'Scenario 20261012',path:'data/health-helper-scenario-evidence-20261012',folder:new URL('../data/health-helper-scenario-evidence-20261012/',import.meta.url),verify:verifyScenarioEvidence},
 {name:'Screening v3',path:'data/health-helper-screening-evidence-20261013-v3',folder:new URL('../data/health-helper-screening-evidence-20261013-v3/',import.meta.url),verify:verifyScreeningEvidence},
];
const hash=value=>createHash('sha256').update(value).digest('hex');

export async function buildCrossTestSourceLocators(){
 const verifiedManifests=new Map();
 for(const definition of snapshotDefinitions){
  const manifest=await definition.verify(definition.folder);
  verifiedManifests.set(definition.name,manifest);
 }
 const rows=[];
 for(const topic of scenarioEntries){
  const expectedChunk=expectedByLabel.get(topic.label);
  if(!expectedChunk)continue;
  const question=`${topic.label} 다른 검사와 함께 보는 이유는 무엇인가요?`;
  const retrieval=retrieveHealthEducationEvidence(question),evidence=retrieval.evidence?.[0];
  if(retrieval.status!=='CANDIDATE'||evidence?.chunk_id!==expectedChunk||retrieval.serviceEligible!==false
   ||evidence.contentReview!=='UNASSIGNED'||evidence.clinicalUse!==false)throw Error('SOURCE_LOCATOR_CANDIDATE_REJECTED');
  const snapshotName=expectedChunk.startsWith('afp-')?'AFP v2':expectedChunk.startsWith('liver-')?'Liver v4':expectedChunk.startsWith('scenario-')?'Scenario 20261012':'Screening v3';
  const definition=snapshotDefinitions.find(item=>item.name===snapshotName),manifest=verifiedManifests.get(snapshotName);
  const source=manifest?.sources.find(item=>item.url===evidence.source_url);
  if(!definition||!source)throw Error('SOURCE_LOCATOR_SNAPSHOT_MISSING');
  const html=await readFile(new URL(source.file,definition.folder),'utf8');
  if(!sourceSectionsExist(html,evidence.section_path.join(' · ')))throw Error('SOURCE_LOCATOR_SECTION_MISMATCH');
  const sourceUpdatedAt=extractSourceUpdatedAt(html);
  if(!sourceUpdatedAt||sourceUpdatedAt!==sourceUpdatedAtForUrl(evidence.source_url)||evidence.source_updated_at!==sourceUpdatedAt)
   throw Error('SOURCE_LOCATOR_FRESHNESS_MISMATCH');
  const sourceSectionFingerprintsForEntry=sourceSectionFingerprints(html,evidence.section_path.join(' · '));
  if(!sourceSectionFingerprintsForEntry)throw Error('SOURCE_LOCATOR_SECTION_FINGERPRINT_MISSING');
  const sourceParagraphLocators=sourceSectionParagraphLocators(html,evidence.section_path.join(' · '));
  if(!sourceParagraphLocators?.length)throw Error('SOURCE_LOCATOR_PARAGRAPH_MISSING');
  const sentences=evidence.text_ko.split(/(?<=[.!?。])\s*/u).map(value=>value.trim()).filter(Boolean);
  if(!sentences.length)throw Error('SOURCE_LOCATOR_CLAIM_MISSING');
  rows.push({topic:topic.label,question,chunkId:evidence.chunk_id,reviewStatus:'DRAFT / UNASSIGNED',
   clinicalUse:false,serviceEligible:false,candidateTextSha256:hash(evidence.text_ko),sourceUrl:evidence.source_url,
   sourceUpdatedAt,
   snapshot:snapshotName,sourceSnapshotPath:`${definition.path}/${source.file}`,
   sourcePageSha256:source.sha256,sectionPath:evidence.section_path,sourceSectionFingerprints:sourceSectionFingerprintsForEntry,
   sourceParagraphLocators,locatorMethod:'Heading-bounded H1-H6 sections plus global <p> ordinals and visible-text SHA-256 in hashed local HTML snapshot',
   supportAssessment:'UNASSESSED',claims:sentences.map((claim,index)=>({claimId:`${evidence.chunk_id}-claim-${index+1}`,
    claimText:claim,claimSha256:hash(claim),sourceSections:evidence.section_path,
    candidateSourceParagraphIds:sourceParagraphLocators.map(paragraph=>paragraph.paragraphId),supportStatus:'UNASSESSED'}))});
 }
 if(rows.length!==expectedByLabel.size)throw Error('SOURCE_LOCATOR_COVERAGE_MISMATCH');
 return {title:'Health Helper cross-test candidate source locators',createdAt:'2026-10-13',status:'DRAFT / UNASSIGNED',
  purpose:'Reviewer aid for locating candidate sections and recording explicit editorial update dates from the fixed hashed page snapshots.',
  limitations:['Section and paragraph locators identify review locations only; they do not establish semantic or clinical support.',
   'Each claim lists all paragraph IDs in its declared section path, unranked; no paragraph is claimed as a one-to-one supporting passage.',
   'All claim-to-source judgments remain UNASSESSED until independent human review.',
   'Paragraph text is not copied into this artifact; ordinal references are valid only for the recorded snapshot hash.',
   'Candidate text is not eligible for patient service, and no model weights were trained.'],
  snapshots:snapshotDefinitions.map(item=>item.name),candidateCount:rows.length,claimCount:rows.reduce((n,row)=>n+row.claims.length,0),candidates:rows};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await buildCrossTestSourceLocators();
 const output=Buffer.from(`${JSON.stringify(report,null,2)}\n`);
 let created=true;
 try{await writeFile(outputUrl,output,{flag:'wx'});}
 catch(error){
  if(error.code!=='EEXIST')throw error;
  if(!output.equals(await readFile(outputUrl)))throw Error('SOURCE_LOCATOR_IMMUTABLE_ARTIFACT_MISMATCH');
  created=false;
 }
 process.stdout.write(JSON.stringify({output:outputUrl.pathname,candidates:report.candidateCount,claims:report.claimCount,
  status:report.status,supportAssessment:'UNASSESSED',created,byteIdenticalExisting:!created})+'\n');
}
