// Owned tmpfs PostgreSQL only. No VM/cloud/source PACS writes.
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import pg from 'pg';
import {PostgresStore} from '../src/postgres-store.js';
import {HipassService} from '../src/services.js';
import {hccCatalog,HCC_DATASET_ID,HCC_PATIENT_ID} from '../src/capstone-hcc-catalog.js';
import {preparePatientDatabase} from './lib/patient-database-preparation.js';
import {registerPatientHcc} from './lib/patient-hcc-registration.js';
import {retireCapstonePatients} from './lib/retire-capstone-patients.js';
const name='hp-hcc-reset-'+randomBytes(6).toString('hex'),password=randomBytes(32).toString('hex'),checks=[],start=Date.now();
let admin,store,ownedId,cleanup=false,phase='OWNED_DATABASE';
const docker=args=>new Promise((resolve,reject)=>{
  const child=spawn('docker',args,{env:{...process.env,POSTGRES_PASSWORD:password},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',done=false;
  const finish=error=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(output.trim());};
  const timer=setTimeout(()=>{child.kill();finish(new Error('DOCKER_TIMEOUT'));},30000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>1048576){child.kill();finish(new Error('DOCKER_OUTPUT_LIMIT'));}});
  child.stderr.resume();child.on('error',finish);child.on('close',code=>finish(code===0?undefined:new Error('DOCKER_FAILED')));
});
try{
  const image=await docker(['inspect','hipass-postgres','--format','{{.Image}}']);assert.match(image,/^sha256:[a-f0-9]{64}$/);
  ownedId=await docker(['run','--rm','-d','--name',name,'--label','highpass.purpose=isolated-hcc-reset','--tmpfs','/var/lib/postgresql/data:rw,size=256m','-e','POSTGRES_PASSWORD','-p','127.0.0.1::5432',image]);
  const port=Number(await docker(['inspect',ownedId,'--format','{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}']));
  const deadline=Date.now()+45000;
  while(!admin&&Date.now()<deadline){
    const c=new pg.Client({host:'127.0.0.1',port,user:'postgres',password,database:'postgres',connectionTimeoutMillis:1500,statement_timeout:5000,query_timeout:6000});c.on('error',()=>{});
    try{await c.connect();await c.query('SELECT 1');admin=c;}catch{await c.end().catch(()=>{});await new Promise(r=>setTimeout(r,200));}
  }
  assert.ok(admin,'DATABASE_READINESS_TIMEOUT');
  store=new PostgresStore(`postgresql://postgres:${password}@127.0.0.1:${port}/postgres`);await store.load();
  // Explicit metadata fixture in a disposable database, not source PACS proof.
  const catalog=hccCatalog('2026-10-10T00:00:00.000Z');
  store.set('patients',[...store.get('patients'),catalog.patient]);
  store.set('imagingStudies',[...store.get('imagingStudies'),...catalog.studies]);
  await store.saveNow();await store.close();store=undefined;
  await preparePatientDatabase(admin,{password:randomBytes(32).toString('hex'),apply:true});
  phase='REGISTRATION';
  assert.equal((await registerPatientHcc(admin,{datasetId:HCC_DATASET_ID})).applied,false);
  assert.equal((await registerPatientHcc(admin,{datasetId:HCC_DATASET_ID,apply:true})).applied,true);
  checks.push('REAL_SQL_FIXED_MAIN_PATIENT_OWNERSHIP_REGISTERED');
  await admin.query("INSERT INTO capstone_patient_accounts(subject,patient_id,evidence_kind,status,revision) VALUES($1,$2,'CAPSTONE_MOCK_IDP','ACTIVE',$3)",['synthetic-account-a','P-1001',randomUUID()]);
  await admin.query("INSERT INTO capstone_patient_ownership_refs(ref_id,subject,patient_id,study_instance_uid,source_hospital_id,status,version) VALUES($1,$2,$3,$4,'HOSP-A','ACTIVE',1)",[randomUUID(),'synthetic-account-a','P-1001','1.2.410.100.1.20260620.001']);
  const counts=async()=> (await admin.query('SELECT (SELECT count(*)::int FROM patients) AS patients,(SELECT count(*)::int FROM imaging_studies) AS studies,(SELECT count(*)::int FROM audit_logs) AS audit')).rows[0];
  const baseline=await counts();
  phase='PREFLIGHT';const preflight=await retireCapstonePatients(admin);assert.equal(preflight.applied,false);assert.deepEqual(await counts(),baseline);
  checks.push('REAL_SQL_PREFLIGHT_ROLLBACK_NO_ROW_OR_AUDIT_CHANGE');
  phase='BACKUP_FAILURE';await assert.rejects(retireCapstonePatients(admin,{apply:true,backup:async()=>{throw new Error('BACKUP_FAILED');}}),/BACKUP_FAILED/);
  assert.equal((await admin.query("SELECT status FROM capstone_patient_accounts WHERE patient_id='P-1001'")).rows[0].status,'ACTIVE');assert.deepEqual(await counts(),baseline);
  checks.push('REAL_SQL_BACKUP_FAILURE_ROLLBACK');
  phase='APPLY';let backupContents;
  const applied=await retireCapstonePatients(admin,{apply:true,backup:async snapshot=>{backupContents=JSON.stringify(snapshot);return{sha256:createHash('sha256').update(backupContents).digest('hex')};}});
  assert.equal(applied.applied,true);
  assert.equal((await admin.query("SELECT status FROM capstone_patient_accounts WHERE patient_id='P-1001'")).rows[0].status,'SUSPENDED');
  assert.equal((await admin.query('SELECT status FROM capstone_patient_accounts WHERE patient_id=$1',[HCC_PATIENT_ID])).rows[0].status,'ACTIVE');
  assert.equal((await admin.query("SELECT status FROM capstone_patient_ownership_refs WHERE patient_id='P-1001'")).rows[0].status,'REVOKED');
  assert.equal((await admin.query("SELECT count(*)::int AS n FROM consents WHERE patient_id='P-1001' AND status IN ('ACTIVE','PENDING')")).rows[0].n,0);
  const after=await counts();assert.equal(after.patients,baseline.patients);assert.equal(after.studies,baseline.studies);assert.ok(after.audit>baseline.audit);
  assert.ok(!/token_hash|nonce_hash|Bearer /.test(backupContents));
  checks.push('REAL_SQL_RETIREMENT_MAIN_ACTIVE_LEGACY_SUSPENDED_HISTORY_PRESERVED');
  phase='AUDIT';const audit=await PostgresStore.prototype.readTable.call({client:admin},'auditLogs');
  assert.equal(HipassService.prototype.verifyAuditIntegrity.call({store:{get:()=>audit}}).ok,true);checks.push('REAL_SQL_AUDIT_HASH_CHAIN_VALID');
}catch(error){process.exitCode=1;checks.push('FAIL:'+phase+':'+(/^[A-Z_]+$/.test(error.message)?error.message:error.code??error.name));}
finally{
  await store?.close().catch(()=>{process.exitCode=1;});await admin?.end().catch(()=>{process.exitCode=1;});
  if(ownedId)try{
    const row=JSON.parse(await docker(['inspect',ownedId]))[0];assert.equal(row.Name,'/'+name);assert.equal(row.Config.Labels['highpass.purpose'],'isolated-hcc-reset');assert.equal(row.Mounts.length,0);assert.equal(row.HostConfig.AutoRemove,true);
    await docker(['stop','--timeout','3',ownedId]);const end=Date.now()+10000;
    while(Date.now()<end){if(await docker(['ps','-aq','--filter','name=^'+name+'$'])===''){cleanup=true;break;}await new Promise(r=>setTimeout(r,200));}assert.equal(cleanup,true);
  }catch{process.exitCode=1;checks.push('OWNED_CLEANUP_NOT_VERIFIED');}
  const result={status:process.exitCode?'FAIL':'PASS',review:'DRAFT / UNASSIGNED',scope:'ISOLATED_REAL_SQL_MAIN_REGISTRATION_RETIREMENT_NOT_LIVE_RESET_PACS_OR_VAULT',checks,cleanup,elapsedMs:Date.now()-start};
  const directory='artifacts/workstation/'+name;await mkdir(directory,{recursive:true});await writeFile(directory+'/result.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,evidence:directory+'/result.json'}));
}
