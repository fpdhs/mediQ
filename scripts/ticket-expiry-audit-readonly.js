// Executed through the existing strict SSH wrapper, never through application APIs.
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
import {orderStoredAuditChain} from '/app/src/audit-chain-order.js';
import {HipassService} from '/app/src/services.js';
const ref=JSON.parse(process.argv[2]);
// Match existing makeId: two unpadded Uint32 hex values, not a new ID format.
const ownedId=(prefix,value)=>typeof value==='string'&&new RegExp(`^${prefix}_[a-f0-9]{2,16}$`).test(value)&&!/[\r\n]/.test(value);
if(!ownedId('consent',ref.consentId) || !ownedId('ticket',ref.ticketId) || ref.patientId!=='HP-TEST-PHANTOM-001') throw new Error('SAFE_OWNED_REFERENCE_REQUIRED');
const db=new Client({host:process.env.POSTGRES_HOST,database:process.env.POSTGRES_DB,user:process.env.POSTGRES_USER,
 password:readFileSync(process.env.POSTGRES_PASSWORD_FILE,'utf8').trim(),connectionTimeoutMillis:5000,
 statement_timeout:5000,query_timeout:6000,options:'-c lock_timeout=2000'});
const checks=[];
try {
 await db.connect();await db.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const ticket=await db.query(`SELECT t.status,t.used_at,t.redeemed_doctor_id,t.redeemed_hospital_id,
  t.expires_at <= transaction_timestamp() AS deadline_elapsed,c.status AS consent_status
  FROM transfer_tickets t JOIN consents c USING(consent_id) WHERE t.ticket_id=$1 AND t.consent_id=$2
  AND t.patient_id=$3 AND c.patient_id=$3 AND t.source_hospital_id='HOSP-A' AND t.target_hospital_id='HOSP-B'`,[ref.ticketId,ref.consentId,ref.patientId]);
 const row=ticket.rows[0];
 checks.push({test:'EXACT_EXPIRED_TICKET_AND_OWNED_CLEANUP',status:ticket.rowCount===1&&row.status==='EXPIRED'&&row.deadline_elapsed&&row.consent_status==='REVOKED'?'PASS':'FAIL'});
 checks.push({test:'EXPIRED_TICKET_NEVER_CONSUMED',status:ticket.rowCount===1&&row.used_at===null&&row.redeemed_doctor_id===null&&row.redeemed_hospital_id===null?'PASS':'FAIL'});
 const counts=await db.query(`SELECT
  (SELECT count(*)::int FROM dicom_access_token_logs WHERE consent_id=$1) AS tokens,
  (SELECT count(*)::int FROM capstone_key_releases WHERE metadata->>'consentId'=$1) AS releases,
  (SELECT count(*)::int FROM audit_logs WHERE consent_id=$1 AND result='SUCCESS'
   AND action IN ('TICKET_REDEEMED','TOKEN_ISSUED','DATA_PLANE_RESPONSE_PREPARED','KEY_WRAP_AUTHORIZED','KEY_RELEASE_PREPARED','KEY_RELEASE_CONSUMED')) AS forbidden_success,
  (SELECT count(*)::int FROM audit_logs WHERE consent_id=$1 AND ticket_id=$2 AND action='TICKET_DENIED'
   AND result='FAIL' AND coalesce(reason_code,reason)='TICKET_EXPIRED' AND actor_id='DOC-B-01' AND actor_type='DOCTOR') AS expiry_denials`,[ref.consentId,ref.ticketId]);
 const c=counts.rows[0];
 checks.push({test:'NO_TOKEN_KEY_OR_REDEMPTION_SUCCESS_FOR_EXPIRED_FLOW',status:c.tokens===0&&c.releases===0&&c.forbidden_success===0?'PASS':'FAIL',counts:{tokens:c.tokens,releases:c.releases,forbiddenSuccess:c.forbidden_success}});
 checks.push({test:'EXACT_TICKET_AUTHENTICATED_EXPIRY_DENIAL_AUDIT',status:c.expiry_denials>0?'PASS':'FAIL',count:c.expiry_denials});
 const stored=await db.query('SELECT * FROM audit_logs');
 const fields=[['auditId','audit_id'],['auditSessionId','audit_session_id'],['actorType','actor_type'],['actorId','actor_id'],
  ['hospitalId','hospital_id'],['patientId','patient_id'],['consentId','consent_id'],['ticketId','ticket_id'],
  ['sourceHospitalId','source_hospital_id'],['targetHospitalId','target_hospital_id'],['action','action'],
  ['studyInstanceUid','study_instance_uid'],['seriesInstanceUid','series_instance_uid'],['sopInstanceUid','sop_instance_uid'],
  ['ipAddress','ip_address'],['userAgent','user_agent'],['result','result'],['reason','reason'],['previousHash','previous_hash'],['recordHash','record_hash']];
 const rows=stored.rows.map(r=>Object.fromEntries(fields.map(([f,col])=>[f,r[col]]).concat([['createdAt',new Date(r.created_at).toISOString()],['reasonCode',r.reason_code??r.reason]])));
 const integrity=HipassService.prototype.verifyAuditIntegrity.call({store:{get:()=>orderStoredAuditChain(rows)}});
 checks.push({test:'WHOLE_PERSISTED_AUDIT_CHAIN',status:integrity.ok?'PASS':'FAIL',checked:integrity.checked??0});
 await db.query('ROLLBACK');
} catch(error) {checks.push({test:'READ_ONLY_EXPIRY_AUDIT',status:'NOT VERIFIED',reason:/^[A-Z0-9_]{1,40}$/.test(error.code??'')?error.code:'READ_ONLY_CHECK_FAILED'});}
finally {await db.end();}
const status=checks.every(c=>c.status==='PASS')?'PASS':checks.some(c=>c.status==='FAIL')?'FAIL':'NOT VERIFIED';
console.log(JSON.stringify({status,checks,scope:'EXACT_OWNED_QR_EXPIRY_PG_AUDIT_NOT_PACKET_CAPTURE',review:'DRAFT / UNASSIGNED'}));
process.exitCode=status==='PASS'?0:1;
