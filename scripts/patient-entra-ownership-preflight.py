"""Read-only deployed authority snapshot. Never outputs credentials/object IDs."""
import importlib.util
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    spec = importlib.util.spec_from_file_location('patient_preflight_runtime', ROOT / 'scripts/health-helper-runtime-check.py')
    runtime = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runtime)
    program = r'''
import subprocess,json
js=r"""
import pg from 'pg'; import fs from 'node:fs';
import {loadCapstonePatientRuntimeSecrets} from './src/capstone-patient-runtime-config.js';
loadCapstonePatientRuntimeSecrets(process.env);
const map=JSON.parse(fs.readFileSync(process.env.HIPASS_ENTRA_ACTOR_MAP_FILE,'utf8'));
const p=new pg.Client({connectionString:process.env.HIPASS_PATIENT_AUTHORITY_DATABASE_URL,statement_timeout:4000});
try {await p.connect();await p.query('BEGIN READ ONLY');
const rows=(await p.query(`SELECT a.subject,a.patient_id,a.status AS account_status,r.status AS ref_status,r.version,s.study_instance_uid,se.series_instance_uid,se.instance_count
FROM capstone_patient_accounts a JOIN capstone_patient_ownership_refs r ON r.subject=a.subject AND r.patient_id=a.patient_id
JOIN imaging_studies s ON s.study_instance_uid=r.study_instance_uid AND s.patient_id=r.patient_id AND s.source_hospital_id=r.source_hospital_id
JOIN imaging_series se ON se.study_instance_uid=s.study_instance_uid WHERE a.patient_id=$1 LIMIT 4`,['MEDIQ-SYN-HCC-001'])).rows;
const column=(await p.query(`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public'
AND table_name='capstone_patient_self_view_grants' AND column_name='authenticated_subject') AS present`)).rows[0];
const audit=(await p.query(`SELECT action,result,reason_code,count(*)::int AS count FROM audit_logs
WHERE created_at > now()-interval '30 minutes' AND (reason_code LIKE 'PATIENT_%' OR action LIKE 'PATIENT_%')
GROUP BY action,result,reason_code ORDER BY action,result,reason_code LIMIT 20`)).rows;
await p.query('ROLLBACK');console.log(JSON.stringify({authMode:process.env.AUTH_MODE,
patientActors:map.actors.filter(a=>a.role==='PATIENT').map(a=>({actorId:a.actorId,patientId:a.patientId})),
ownership:rows,migration038:column.present,recentPatientAudit:audit}));
} catch {console.log(JSON.stringify({error:'READ_ONLY_CHECK_FAILED'}));} finally {await p.end();}
"""
p=subprocess.run(['docker','exec','-w','/app','hp-capstone-control-control-1','/nodejs/bin/node','--input-type=module','-e',js],capture_output=True,timeout=15)
print(p.stdout.decode() if p.returncode==0 else json.dumps({'error':'READ_ONLY_CHECK_FAILED'}))
'''
    client = runtime.connect('CLOUD', None)
    try:
        result = runtime.remote(client, 'CLOUD', None, program, 25)
    finally:
        client.close()
    print(json.dumps(result))
    return 1 if 'error' in result else 0

if __name__ == '__main__':
    raise SystemExit(main())
