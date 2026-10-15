import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder='artifacts/azure/viewer-access-polish-20261015';
const origin='https://highpass-demo.japaneast.cloudapp.azure.com';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const checks=[];
for(const name of ['app.js','ui/viewer-studio.js','ui/viewer-studio.css','ui/brand.css','ui/patient-share-review.css','brand/mediq-dark.svg']){
  const res=await fetch(`${origin}/${name}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  const actual=Buffer.from(await res.arrayBuffer());
  const expected=await readFile(name.endsWith('.svg')?'public/'+name:folder+'/public/'+name);
  checks.push({path:'/'+name,status:res.status,result:res.ok&&digest(actual)===digest(expected)?'PASS':'FAIL',sha256:digest(actual)});
}
const htmlResponse=await fetch(origin+'/hipass/',{cache:'no-store'}),html=await htmlResponse.text();
checks.push({path:'/hipass/',status:htmlResponse.status,result:html.includes('id="studio-renew-access"')&&html.includes('viewBox="0 0 32 32"')?'PASS':'FAIL'});
const denied=await fetch(origin+'/api/dicom-access/request',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
checks.push({path:'/api/dicom-access/request (unauthenticated)',status:denied.status,result:[401,403].includes(denied.status)?'PASS':'FAIL'});
const result={at:new Date().toISOString(),checks,authenticatedEntraViewer:'NOT VERIFIED'};
await writeFile(folder+'/public-verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));if(checks.some(c=>c.result==='FAIL'))process.exitCode=1;
