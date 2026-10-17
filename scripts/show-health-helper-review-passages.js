// Read-only, local reviewer aid. Accepts a fixed claim ID, never a URL or file path.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sourceParagraphTextAt,sourceSectionParagraphLocators} from '../src/health-helper-source-sections.js';
import {validateHealthHelperClaimReviewTemplateV2} from '../src/health-helper-claim-review.js';

const locatorUrl=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);
const reviewTemplateUrl=new URL('../docs/implementation/health-helper-claim-review-template-2026-10-13-v2.json',import.meta.url);
const sha256=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export async function loadHealthHelperReviewPassages(claimId){
 if(typeof claimId!=='string'||!/^[-a-z0-9]+-claim-\d+$/u.test(claimId))throw Error('REVIEW_CLAIM_ID_INVALID');
 const [locatorBytes,templateBytes]=await Promise.all([readFile(locatorUrl),readFile(reviewTemplateUrl)]);
 const locator=JSON.parse(locatorBytes.toString()),template=JSON.parse(templateBytes.toString()),locatorDigest=sha256(locatorBytes);
 if(!validateHealthHelperClaimReviewTemplateV2(template,locator,locatorDigest))throw Error('REVIEW_TEMPLATE_REJECTED');
 const claimRecord=template.claims.find(item=>item.claimId===claimId);
 const candidate=locator.candidates.find(item=>item.chunkId===claimRecord?.chunkId&&item.sourceUrl===claimRecord?.sourceUrl);
 if(!claimRecord||!candidate)throw Error('REVIEW_CLAIM_NOT_FOUND');
 const sourceBytes=await readFile(new URL(`../${candidate.sourceSnapshotPath}`,import.meta.url));
 if(sha256(sourceBytes)!==candidate.sourcePageSha256)throw Error('REVIEW_SOURCE_HASH_MISMATCH');
 const html=sourceBytes.toString(),paragraphs=sourceSectionParagraphLocators(html,candidate.sectionPath.join(' · '));
 if(!paragraphs?.length)throw Error('REVIEW_SOURCE_SECTION_MISMATCH');
 const selected=claimRecord.candidateSourceParagraphIds.map(paragraphId=>{
  const locatorRow=paragraphs.find(row=>row.paragraphId===paragraphId);
  if(!locatorRow)throw Error('REVIEW_PARAGRAPH_ID_MISMATCH');
  const text=sourceParagraphTextAt(html,locatorRow.paragraphOrdinal);
  if(!text||sha256(Buffer.from(text))!==locatorRow.paragraphSha256)throw Error('REVIEW_PARAGRAPH_HASH_MISMATCH');
  return {...locatorRow,text};
 });
 return {status:'REVIEW_ONLY_NOT_SERVICE_APPROVED',claimId,claimText:claimRecord.claimText,claimSha256:claimRecord.claimSha256,
  sourceUrl:candidate.sourceUrl,sourceUpdatedAt:candidate.sourceUpdatedAt,sourcePageSha256:candidate.sourcePageSha256,
  supportAssessment:claimRecord.review.sourceSupport.decision,assessedSourceParagraphIds:claimRecord.review.sourceSupport.assessedParagraphIds,paragraphs:selected,
  warning:'Listed paragraphs are unranked locations within the declared heading path. Any supportAssessment is reviewer-entered input; validation does not authenticate reviewer qualifications or approve patient-service use.'};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await loadHealthHelperReviewPassages(process.argv[2]);
 process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
}
