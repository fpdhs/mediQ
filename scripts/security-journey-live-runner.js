import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const modulePath=process.argv[2];
if(!modulePath)throw Error('PLAYWRIGHT_MODULE_REQUIRED');
const {chromium}=await import(pathToFileURL(modulePath));
const browser=await chromium.launch({channel:'chrome',headless:false});
try{
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://192.168.111.149:9443/hipass/#DOCTOR',{timeout:30000});
  await page.getByRole('button',{name:'의료진으로 시작하기',exact:true}).click();
  const source=await readFile('scripts/security-journey-live-browser.js','utf8');
  const {default:verify}=await import('data:text/javascript;base64,'+Buffer.from('export default '+source).toString('base64'));
  const result=await verify(page);
  result.pageErrors=errors;
  if(errors.length)throw Error('LIVE_PAGE_ERRORS');
  result.observedAt=new Date().toISOString();result.review='DRAFT / UNASSIGNED';
  await writeFile('artifacts/workstation/security-journey-20261013T001052Z/browser.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}finally{await browser.close();}
