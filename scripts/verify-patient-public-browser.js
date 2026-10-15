// Direct approved HTTPS ingress: no local app, proxy, SQL mutation or API substitute for UI.
import {createPatientBrowserProbe} from './lib/patient-browser-integration.js';
let loginKey='';
for await(const chunk of process.stdin){loginKey+=chunk;if(loginKey.length>129)throw new Error('CREDENTIAL_LIMIT');}
const modality=process.argv[2],mobile=process.argv[3]==='mobile';
if(!['CT','MR'].includes(modality)||!['web','mobile'].includes(process.argv[3])||process.argv.slice(4).some(arg=>arg!=='--faq')||process.argv.length>5)throw new Error('FIXED_PUBLIC_PROBE_REQUIRED');
const studyInstanceUid='1.2.826.0.1.3680043.10.5432.20261009.'+(modality==='CT'?'1':'2');
const probe=await createPatientBrowserProbe({publicOrigin:'https://192.168.111.149:9443'});
const result=await probe.verify({patientId:'HP-TEST-PHANTOM-001',study:{studyInstanceUid},fullApp:true,normalOnly:true,mobile,loginKey:loginKey.trim(),faq:process.argv[4]==='--faq'});
loginKey='';console.log(JSON.stringify(result));process.exitCode=result.status==='PASS'?0:1;
