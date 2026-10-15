// Run via bounded stdin inside existing Control; no load/save/migration.
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {orderStoredAuditChain} from '/app/src/audit-chain-order.js';
import {HipassService} from '/app/src/services.js';
const refs=JSON.parse(process.argv[2]);
if(!Array.isArray(refs)||refs.length!==4||refs.some(r=>!['grantId','auditSessionId'].every(k=>/^[a-f0-9-]{36}$/.test(r[k]??''))||r.patientId!=='HP-TEST-PHANTOM-001'||!/^1\.2\.826\.0\.1\.3680043\.10\.5432\.20261009\.[12]$/.test(r.studyInstanceUid??'')))throw new Error('OWNED_SYNTHETIC_REFERENCES_REQUIRED');
const db=new Client({host:process.env.POSTGRES_HOST,database:process.env.POSTGRES_DB,user:process.env.HIPASS_PATIENT_AUTHORITY_DATABASE_USER,
  password:readFileSync(process.env.HIPASS_PATIENT_AUTHORITY_PASSWORD_FILE,'utf8').trim(),connectionTimeoutMillis:5000,
  statement_timeout:5000,query_timeout:6000,options:'-c lock_timeout=2000'});
const checks=[];
try{
 await db.connect();await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 for(const r of refs){
  const grants=await db.query(`SELECT grant_id FROM capstone_patient_self_view_grants WHERE grant_id=$1 AND audit_session_id=$2
   AND patient_id=$3 AND study_instance_uid=$4 AND series_instance_uid=$4||'.1'
   AND source_hospital_id='HOSP-A' AND viewing_gateway_id='hospital-b-portal' AND permission='VIEW_ONLY' AND authority_type='PATIENT_SELF_VIEW'`,[r.grantId,r.auditSessionId,r.patientId,r.studyInstanceUid]);
  checks.push({test:'EXACT_BROWSER_PATIENT_GRANT_SCOPE',grantId:r.grantId,status:grants.rowCount===1?'PASS':'FAIL'});
  const release=await db.query(`SELECT count(*)::int AS total,count(*) FILTER(WHERE status='CONSUMED' AND consumed_at IS NOT NULL)::int AS consumed,
   count(*) FILTER(WHERE metadata->>'auditSessionId'=$2 AND metadata->>'patientId'=$3 AND metadata->'binding'->>'keyId'=$4)::int AS bound
   FROM capstone_patient_key_releases WHERE grant_id=$1`,[r.grantId,r.auditSessionId,r.patientId,'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/9c03b2560a3240418d33d92a165b6806']);
  const counts=release.rows[0];
  checks.push({test:'EXACT_PATIENT_RELEASE_CONSUMED_VERSIONED_VAULT_BINDING',grantId:r.grantId,status:counts.total>=2&&counts.total===counts.consumed&&counts.total===counts.bound?'PASS':'FAIL',counts});
  const audit=await db.query(`SELECT action,count(*)::int AS count FROM audit_logs WHERE audit_session_id=$1 AND patient_id=$2 AND study_instance_uid=$3 AND result='SUCCESS' GROUP BY action`,[r.auditSessionId,r.patientId,r.studyInstanceUid]);
  const actions=Object.fromEntries(audit.rows.map(v=>[v.action,v.count]));
  const expected=['PATIENT_SELF_VIEW_GRANT_ISSUED','PATIENT_KEY_WRAP_AUTHORIZED','PATIENT_KEY_RELEASE_PREPARED','PATIENT_KEY_RELEASE_PRECHECKED','PATIENT_KEY_RELEASE_CONSUMED'];
  checks.push({test:'EXACT_PATIENT_GRANT_AND_KEY_RELEASE_AUDIT_SESSION',grantId:r.grantId,status:expected.every(a=>actions[a]>0)?'PASS':'FAIL',actions});
 }
 const stored=await db.query('SELECT * FROM audit_logs');
 const rows=stored.rows.map(row=>Object.fromEntries([
  ['auditId','audit_id'],['auditSessionId','audit_session_id'],['actorType','actor_type'],['actorId','actor_id'],
  ['hospitalId','hospital_id'],['patientId','patient_id'],['consentId','consent_id'],['ticketId','ticket_id'],
  ['sourceHospitalId','source_hospital_id'],['targetHospitalId','target_hospital_id'],['action','action'],
  ['studyInstanceUid','study_instance_uid'],['seriesInstanceUid','series_instance_uid'],['sopInstanceUid','sop_instance_uid'],
  ['ipAddress','ip_address'],['userAgent','user_agent'],['result','result'],['reason','reason'],['previousHash','previous_hash'],['recordHash','record_hash']
 ].map(([field,column])=>[field,row[column]]).concat([['createdAt',new Date(row.created_at).toISOString()],['reasonCode',row.reason_code??row.reason]])));
 const integrity=HipassService.prototype.verifyAuditIntegrity.call({store:{get:()=>orderStoredAuditChain(rows)}});
 checks.push({test:'WHOLE_PERSISTED_AUDIT_CHAIN',status:integrity.ok?'PASS':'FAIL',checked:integrity.checked??0});
 await db.query('ROLLBACK');
}catch(error){checks.push({test:'READ_ONLY_PATIENT_AUDIT',status:'NOT VERIFIED',reason:/^[A-Z0-9_]{1,40}$/.test(error.code??'')?error.code:'READ_ONLY_CHECK_FAILED'});}
finally{await db.end();}
const status=checks.every(c=>c.status==='PASS')?'PASS':checks.some(c=>c.status==='FAIL')?'FAIL':'NOT VERIFIED';
console.log(JSON.stringify({status,checks,scope:'ACTUAL_READ_ONLY_PG_PUBLIC_BROWSER_GRANT_RELEASE_AUDIT_CHAIN_NOT_AZURE_SERVICE_AUDIT_LOG_OR_DENIAL_E2E',review:'DRAFT / UNASSIGNED'}));
process.exitCode=status==='PASS'?0:1;
