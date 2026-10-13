// Builds a versioned reviewer worksheet with an explicit claim-to-source support axis.
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHealthHelperClaimReviewTemplateV2,validateHealthHelperClaimReviewTemplateV2} from '../src/health-helper-claim-review.js';

const locatorUrl=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);
const outputUrl=new URL('../docs/implementation/health-helper-claim-review-template-2026-10-13-v2.json',import.meta.url);

export async function buildHealthHelperClaimReviewTemplateV2(){
 const bytes=await readFile(locatorUrl),locator=JSON.parse(bytes.toString('utf8'));
 const digest=`sha256:${createHash('sha256').update(bytes).digest('hex')}`;
 const template=createHealthHelperClaimReviewTemplateV2(locator,digest);
 validateHealthHelperClaimReviewTemplateV2(template,locator,digest);
 return template;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const template=await buildHealthHelperClaimReviewTemplateV2();
 const output=Buffer.from(`${JSON.stringify(template,null,2)}\n`);
 let created=true;
 try{await writeFile(outputUrl,output,{flag:'wx'});}
 catch(error){
  if(error.code!=='EEXIST')throw error;
  if(!output.equals(await readFile(outputUrl)))throw Error('CLAIM_REVIEW_TEMPLATE_V2_IMMUTABLE_ARTIFACT_MISMATCH');
  created=false;
 }
 process.stdout.write(JSON.stringify({output:outputUrl.pathname,sources:template.sourceCount,claims:template.claimCount,
  status:template.status,schemaVersion:template.schemaVersion,sourceSupport:'ALL_UNASSESSED',created,byteIdenticalExisting:!created})+'\n');
}
