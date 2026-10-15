"""Read-only confirmation of the browser-created synthetic consent and audit chain."""
import json
import pathlib
import shlex
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = r'''
import { readFileSync } from 'node:fs';
import pg from 'pg';
import { PostgresStore } from '/app/src/postgres-store.js';
import { HipassService } from '/app/src/services.js';
const client = new pg.Client({host:'postgres',database:'hipass',user:'hipass_app',password:readFileSync(process.env.POSTGRES_PASSWORD_FILE,'utf8').trim(),connectionTimeoutMillis:5000,query_timeout:6000,statement_timeout:5000});
await client.connect();
try {
 await client.query('BEGIN READ ONLY');
 const {rows:[consent]} = await client.query("SELECT consent_id,status,permission,purpose,valid_from,valid_until FROM consents WHERE patient_id=$1 AND source_hospital_id=$2 AND target_hospital_id=$3 ORDER BY created_at DESC LIMIT 1",['MEDIQ-SYN-HCC-001','HOSP-A','HOSP-B']);
 if (!consent || consent.status!=='ACTIVE' || consent.permission!=='VIEW_ONLY' || consent.purpose!=='TREATMENT') throw Error('CONSENT_STATE_MISMATCH');
 const {rows:scopes}=await client.query('SELECT study_instance_uid,series_instance_uid,allowed FROM consent_scopes WHERE consent_id=$1',[consent.consent_id]);
 if(scopes.length!==1 || scopes[0].study_instance_uid!=='2.25.259656708708993797343330994179169711072' || scopes[0].series_instance_uid!=='2.25.18361638789025095699746776899955737977' || !scopes[0].allowed) throw Error('CONSENT_SCOPE_MISMATCH');
 const {rows:[ticket]}=await client.query('SELECT ticket_id,status,expires_at,audit_session_id FROM transfer_tickets WHERE consent_id=$1 ORDER BY issued_at DESC LIMIT 1',[consent.consent_id]);
 if(!ticket) throw Error('TICKET_MISSING');
 const audit=await PostgresStore.prototype.readTable.call({client},'auditLogs');
 const chain=HipassService.prototype.verifyAuditIntegrity.call({store:{get:()=>audit}});
 const linked=audit.filter(row=>row.consentId===consent.consent_id).map(({auditId,action,result,createdAt})=>({auditId,action,result,createdAt}));
 if(!chain.ok || !linked.some(row=>row.action==='CONSENT_CREATED') || !linked.some(row=>row.action==='TICKET_ISSUED')) throw Error('AUDIT_LINK_MISSING');
 await client.query('COMMIT');
 console.log(JSON.stringify({status:'PASS',readOnly:true,observedAt:new Date().toISOString(),patientId:'MEDIQ-SYN-HCC-001',consent,scopes,ticket,auditChain:chain,linkedAudit:linked,viewer:'NOT VERIFIED',review:'DRAFT / UNASSIGNED'}));
} finally {await client.end();}
'''

def main():
    directory=ROOT/'artifacts/workstation'/('hcc-patient-live-state-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    identity=pathlib.Path.home()/'.ssh/highpass-capstone-cloud'
    client=paramiko.SSHClient()
    client.load_host_keys(str(identity/'known_hosts'))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10)
        command='sudo -n timeout 45s docker exec hp-capstone-control-control-1 /nodejs/bin/node --input-type=module -e '+shlex.quote(JS)
        _,out,err=client.exec_command(command,timeout=50)
        payload=out.read().decode()
        code=out.channel.recv_exit_status()
        if code:
            raise RuntimeError('READ_ONLY_STATE_CHECK_FAILED')
        result=json.loads(payload)
        (directory/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'result':str(directory/'result.json'),**result},ensure_ascii=False))
    finally:
        client.close()

if __name__=='__main__':
    main()
