import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin='https://highpass-demo.japaneast.cloudapp.azure.com',folder='artifacts/azure/security-period-20261015';
const sha=b=>createHash('sha256').update(b).digest('hex'),checks=[];
for(const name of ['ui/security-console.js','ui/security-console.css','ui/security-report.js','ui/security-period-panel.js']){
  const r=await fetch(origin+'/'+name,{cache:'no-store',signal:AbortSignal.timeout(20000)}),actual=Buffer.from(await r.arrayBuffer()),expected=await readFile(folder+'/web/public/'+name);
  checks.push({path:'/'+name,status:r.status,sha256:sha(actual),result:r.ok&&sha(actual)===sha(expected)?'PASS':'FAIL'});
}
for(const headers of [{},{'x-hipass-role':'SECURITY_ADMIN','x-hipass-user-id':'synthetic-untrusted-header'}]){
 const r=await fetch(origin+'/api/security/reports',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({mode:'PERIOD',format:'JSON',events:[]})});
 checks.push({path:'/api/security/reports',test:Object.keys(headers).length?'spoofed-role':'anonymous',status:r.status,result:[401,403].includes(r.status)?'PASS':'FAIL'});
}
const result={at:new Date().toISOString(),checks,authenticatedAzureReport:'NOT VERIFIED'};
await writeFile(folder+'/public-verification.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(checks.some(c=>c.result==='FAIL'))process.exitCode=1;
