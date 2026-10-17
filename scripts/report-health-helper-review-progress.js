import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildHealthHelperClaimReviewProgressV2} from '../src/health-helper-claim-review.js';

const locatorUrl=new URL('../docs/implementation/health-helper-cross-test-source-locators-2026-10-13-v4.json',import.meta.url);
const templateUrl=new URL('../docs/implementation/health-helper-claim-review-template-2026-10-13-v2.json',import.meta.url);
const sha256=bytes=>`sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export async function loadHealthHelperReviewProgress(){
 const [locatorBytes,templateBytes]=await Promise.all([readFile(locatorUrl),readFile(templateUrl)]);
 const locator=JSON.parse(locatorBytes.toString('utf8'));
 const template=JSON.parse(templateBytes.toString('utf8'));
 return buildHealthHelperClaimReviewProgressV2(template,locator,sha256(locatorBytes));
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 process.stdout.write(`${JSON.stringify(await loadHealthHelperReviewProgress(),null,2)}\n`);
}
