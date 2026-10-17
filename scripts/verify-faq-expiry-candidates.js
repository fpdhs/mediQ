import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [ui,control]=process.argv.slice(2);
if(![ui,control].every(id=>/^sha256:[a-f0-9]{64}$/.test(id??'')) || process.argv.length!==4) throw new Error('EXACT_CANDIDATE_IDS_REQUIRED');
const bases={ui:'sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a',control:'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'};
const run=args=>{const r=spawnSync('docker',args,{encoding:'utf8',timeout:30000,maxBuffer:1048576,windowsHide:true});if(r.status!==0)throw new Error('BOUNDED_DOCKER_CHECK_FAILED');return JSON.parse(r.stdout);};
const inspect=id=>run(['image','inspect',id])[0];
const fileHashes=(id,files)=>run(['run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--entrypoint=/nodejs/bin/node',id,'-e',
 "const fs=require('node:fs'),c=require('node:crypto');let out={};for(const f of JSON.parse(process.argv[1])){try{const b=fs.readFileSync('/app/'+f);out[f]={raw:c.createHash('sha256').update(b).digest('hex'),lf:c.createHash('sha256').update(b.toString('utf8').replace(/\\r\\n/g,'\\n')).digest('hex')};}catch(e){if(e.code!=='ENOENT')throw e;out[f]=null;}}console.log(JSON.stringify(out));",JSON.stringify(files)]);
const hash=value=>createHash('sha256').update(value).digest('hex');
const checks=[];
try {
 for(const [role,id] of Object.entries({ui,control})) {
  const before=inspect(bases[role]),after=inspect(id);
  const fields=[...new Set([...Object.keys(before.Config),...Object.keys(after.Config)])];
  const differences=fields.filter(key=>JSON.stringify(before.Config[key])!==JSON.stringify(after.Config[key]));
  const prefix=before.RootFS.Layers.every((value,i)=>after.RootFS.Layers[i]===value);
  checks.push({test:role+'_INHERITED_CONFIG_AND_BASE_LAYERS',status:differences.length===0&&prefix?'PASS':'FAIL',changedConfigFields:differences,baseLayerPrefixPreserved:prefix,addedLayers:after.RootFS.Layers.length-before.RootFS.Layers.length});
 }
 const source=readFileSync('src/services.js','utf8').replace(/\r\n/g,'\n');
 const expression='new Date(ticket.expiresAt).getTime() <= new Date(this.clock()).getTime()';
 if(source.split(expression).length!==3)throw new Error('TWO_EXPIRY_COMPARISONS_REQUIRED');
 const original=source.replaceAll(expression,'new Date(ticket.expiresAt).getTime() < new Date(this.clock()).getTime()');
 const old=fileHashes(bases.control,['src/services.js']),next=fileHashes(control,['src/services.js']);
 checks.push({test:'CONTROL_EXACT_TWO_COMPARISON_DELTA',status:old['src/services.js']?.lf===hash(original)&&next['src/services.js']?.lf===hash(source)?'PASS':'FAIL',baselineLfSha256:old['src/services.js']?.lf,candidateLfSha256:next['src/services.js']?.lf});
 const manifest=JSON.parse(readFileSync('artifacts/workstation/faq-ui-candidate-manifest-20261010.json','utf8'));
 if(manifest.image!==ui || manifest.verification.status!=='PASS')throw new Error('EXACT_VERIFIED_UI_MANIFEST_REQUIRED');
 const files=manifest.assets.map(row=>row.file);
 if(files.some(f=>!/^public\/[A-Za-z0-9_./-]+$/.test(f)||f.includes('..')))throw new Error('SAFE_STATIC_FILE_REQUIRED');
 const before=fileHashes(bases.ui,[...files,'src/services.js']),after=fileHashes(ui,[...files,'src/services.js']);
 const changed=files.filter(f=>before[f]?.raw!==after[f]?.raw);
 const expected=['public/app.js','public/index.html','public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','public/ui/faq-assistant.js','public/ui/faq-catalog.js','public/ui/faq-assistant.css'].sort();
 checks.push({test:'UI_EXACT_FAQ_ASSET_DELTA_ONLY',status:JSON.stringify(changed.sort())===JSON.stringify(expected)&&before['src/services.js']?.raw===after['src/services.js']?.raw?'PASS':'FAIL',changedFiles:changed,serverPreserved:before['src/services.js']?.raw===after['src/services.js']?.raw});
} catch(error) {checks.push({test:'CANDIDATE_VERIFICATION',status:'NOT VERIFIED',reason:/^[A-Z_]+$/.test(error.message)?error.message:'CANDIDATE_CHECK_FAILED'});}
const status=checks.every(c=>c.status==='PASS')?'PASS':checks.some(c=>c.status==='FAIL')?'FAIL':'NOT VERIFIED';
console.log(JSON.stringify({status,scope:'LOCAL_ROLE_CANDIDATES_NOT_DEPLOYMENT_OR_BROWSER_E2E',review:'DRAFT / UNASSIGNED',bases,candidates:{ui,control},checks},null,2));
process.exitCode=status==='PASS'?0:1;
