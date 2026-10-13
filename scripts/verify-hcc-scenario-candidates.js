// Pin source-to-image contents; no network, mounts, VM or DB writes.
import {execFileSync} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const files=['src/capstone-hcc-catalog.js','src/capstone-mock-idp.js','src/patient-self-view-authority.js','src/server.js','src/capstone-b-portal.js','src/http-utils.js','public/capstone-auth.js','public/app.js','public/patient-pixel-viewer.js','public/index.html','public/ui/patient.js','public/ui/capstone-login.css','public/ui/patient-home-premium.css','public/fonts/pretendard/PretendardVariable.woff2','public/mobile/app.js','public/mobile/sw.js','public/mobile/index.html','scripts/register-capstone-patient-hcc.js','scripts/reset-capstone-patient-scenario.js','scripts/lib/patient-hcc-registration.js','scripts/lib/retire-capstone-patients.js'];
files.push('public/ui/clinician.js','public/ui/clinician-desk.css');
files.push('src/auth.js','src/hcc-source-contract.js','src/hcc-source-verification.js','src/hcc-source-probe.js',
  'src/postgres-store.js','scripts/start-capstone-control.js','scripts/verify-hcc-source-gateway.js');
files.push('public/ui/viewer-studio.js','public/ui/viewer-studio.css');
files.push('public/ui/mobile.css','public/ui/faq-assistant.js','public/ui/faq-assistant.css','public/ui/faq-catalog.js','src/services.js','src/capstone-control-ingress.js');
const sources=[];for(const file of files)sources.push({path:file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const rawArguments=process.argv.slice(2), exportImages=rawArguments.includes('--export-images');
if(rawArguments.filter(value=>value==='--export-images').length>1)throw new Error('DUPLICATE_EXPORT_FLAG');
const argumentsList=rawArguments.filter(value=>value!=='--export-images');
if(exportImages&&!argumentsList.length)throw new Error('EXPLICIT_SOURCE_ROLES_REQUIRED_FOR_EXPORT');
const candidates=argumentsList.length?argumentsList.map(value=>{
  const match=value.match(/^(control|a|ingress)=(highpass-platform-mvp:capstone-hcc-source-[a-z0-9-]{1,70})$/);
  if(!match)throw new Error('EXACT_ROLE_LOCAL_CANDIDATE_REQUIRED');return {role:match[1],image:match[2]};
}):[{role:'legacy',image:'highpass-hcc-main-ui:20261010'},{role:'legacy',image:'highpass-hcc-main-control:20261010'}];
if(argumentsList.length && (candidates.length!==3 || new Set(candidates.map(row=>row.role)).size!==3))throw new Error('THREE_DISTINCT_SOURCE_ROLES_REQUIRED');
const bases={control:'sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b',
  a:'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df',
  ingress:'sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb'};
const scoped={control:files,a:['src/auth.js','src/capstone-hcc-catalog.js','src/hcc-source-contract.js','src/hcc-source-verification.js','src/hcc-source-probe.js','scripts/verify-hcc-source-gateway.js'],
  ingress:['src/capstone-control-ingress.js','src/hcc-source-contract.js']};
const images=[];
for(const {role,image} of candidates){
  const inspected=JSON.parse(execFileSync('docker',['image','inspect',image],{encoding:'utf8',timeout:15000}))[0];
  if(bases[role]){
    const base=JSON.parse(execFileSync('docker',['image','inspect',bases[role]],{encoding:'utf8',timeout:15000}))[0];
    assert.deepEqual(inspected.Config,base.Config);
    assert.deepEqual(inspected.RootFS.Layers.slice(0,base.RootFS.Layers.length),base.RootFS.Layers);
    assert.match(inspected.Config.User,/^65532(?::65532)?$/);
  }
  const selected=scoped[role]??files,expected=selected.map(file=>sources.find(row=>row.path===file));
  const code=`const fs=require('node:fs'),crypto=require('node:crypto');const files=${JSON.stringify(selected)};console.log(JSON.stringify(files.map(path=>({path,sha256:crypto.createHash('sha256').update(fs.readFileSync('/app/'+path)).digest('hex')}))))`;
  const actual=JSON.parse(execFileSync('docker',['run','--rm','--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',inspected.Id,'-e',code],{encoding:'utf8',timeout:30000}));
  assert.deepEqual(actual,expected);images.push({role,image,id:inspected.Id,base:bases[role]??null,sourceMatch:'PASS',files:actual.length});
}
const result={status:'PASS',scope:'EXACT_LOCAL_CANDIDATE_SOURCE_HASH_ONLY_NOT_DEPLOYMENT_OR_CLINICAL_FLOW',review:'DRAFT / UNASSIGNED',head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',timeout:30000}).trim(),dirty:true,images,sources};
const directory=path.resolve('artifacts/workstation/hcc-source-candidates-'+new Date().toISOString().replaceAll(':','-'));await mkdir(directory,{recursive:false});
if(exportImages){
  // Role-separated, Docker-generated archives only. No secrets, data mounts, SSH or activation.
  result.exports=[];
  for(const image of images){
    const filename=image.role+'.tar', target=path.join(directory,filename);
    const before=JSON.parse(execFileSync('docker',['image','inspect',image.image],{encoding:'utf8',timeout:15000}))[0];
    assert.equal(before.Id,image.id);
    execFileSync('docker',['image','save','--output',target,image.image],{timeout:180000,stdio:'pipe'});
    const after=JSON.parse(execFileSync('docker',['image','inspect',image.image],{encoding:'utf8',timeout:15000}))[0];
    assert.equal(after.Id,image.id,'CANDIDATE_TAG_CHANGED_DURING_EXPORT');
    const digest=createHash('sha256');let bytes=0;
    for await(const chunk of createReadStream(target)){digest.update(chunk);bytes+=chunk.length;}
    assert.ok(bytes>0);
    result.exports.push({role:image.role,path:filename,bytes,sha256:digest.digest('hex'),
      imageId:image.id,destination:image.role==='a'?'HIGH_PASS_HOSPITAL_A':'HIGH_PASS_CLOUD',
      transferred:false,loaded:false});
  }
  result.exportScope='LOCAL_DOCKER_SAVE_WITH_HASH_NOT_REMOTE_LOAD_OR_DEPLOYMENT';
}
await writeFile(path.join(directory,'manifest.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify({...result,sources:sources.length,evidence:path.join(directory,'manifest.json')}));
