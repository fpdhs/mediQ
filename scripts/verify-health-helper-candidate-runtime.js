import {isIP} from 'node:net';
import {candidateSourceFingerprint,compareCandidateRuntime} from '../src/health-helper-candidate-runtime.js';
import {SCHOOL_DEMO_LAN_PORTS} from '../src/health-helper-school-demo-runtime-config.js';

const target=new URL(process.argv[2]??'http://10.10.70.151:11445');
const octets=target.hostname.split('.').map(Number);
const privateHost=isIP(target.hostname)===4&&(octets[0]===127||octets[0]===10
 ||octets[0]===192&&octets[1]===168||octets[0]===172&&octets[1]>=16&&octets[1]<=31);
if(target.protocol!=='http:'||!privateHost||target.username||target.password||target.search||target.hash
 ||target.pathname!=='/'||!['11438','11439','11440','11441','11442','11443','11444','11445','11446'].includes(target.port))
 throw Error('CANDIDATE_RUNTIME_TARGET_INVALID');
let report;
try{
 const response=await fetch(new URL('/candidate/status',target),{redirect:'error',signal:AbortSignal.timeout(5000)});
 if(!response.ok)report={result:'FAIL',issues:[response.status===404?'RUNTIME_STATUS_NOT_IMPLEMENTED':'RUNTIME_STATUS_HTTP_ERROR'],httpStatus:response.status};
 else{
  let text='',bytes=0;const decoder=new TextDecoder('utf-8',{fatal:true});
  if(!response.body)throw Error('RUNTIME_STATUS_INVALID');
  for await(const part of response.body){bytes+=part.byteLength;if(bytes>8192)throw Error('RUNTIME_STATUS_INVALID');text+=decoder.decode(part,{stream:true});}
  text+=decoder.decode();
  report=compareCandidateRuntime(JSON.parse(text),{sourceFingerprint:await candidateSourceFingerprint(),schoolDemo:SCHOOL_DEMO_LAN_PORTS.includes(target.port)});
 }
}catch{report={result:'FAIL',issues:['RUNTIME_STATUS_UNAVAILABLE_OR_INVALID']};}
process.stdout.write(`${JSON.stringify(report)}\n`);
if(report.result!=='PASS')process.exitCode=1;
