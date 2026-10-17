"""Independent B PACS re-query and read-only correlated Control audit evidence."""
import json
import pathlib
import uuid
import importlib.util
import argparse

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('single_check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
SOP='2.25.41201726628454317744442406717668675255'
HASH='6053ea5f2a01c0327fd7243f01d9f843bee0f6de6f7c958503227fdfefdc0087'

def validate_evidence(pacs,events):
    if pacs.get('status')!='PASS' or pacs.get('sopInstanceUid')!=SOP or pacs.get('sha256')!=HASH or pacs.get('bytes')!=3146808:
        raise RuntimeError('B_INDEPENDENT_RECEIPT_MISMATCH')
    sessions={row['audit_session_id'] for row in events if row['action']=='PACS_INSTANCE_VERIFIED'
              and row['result']=='SUCCESS' and row['sop_instance_uid']==SOP}
    if len(sessions)!=1:raise RuntimeError('A_B_CORRELATED_AUDIT_NOT_VERIFIED')
    session=next(iter(sessions));rows=[row for row in events if row['audit_session_id']==session and row['result']=='SUCCESS']
    required={'TOKEN_ISSUED','KEY_WRAP_AUTHORIZED','KEY_RELEASE_PREPARED','DATA_PLANE_RESPONSE_PREPARED',
              'KEY_RELEASE_PRECHECKED','KEY_RELEASE_CONSUMED','PACS_IMPORT_AUTHORIZED','PACS_INSTANCE_VERIFIED'}
    if not required.issubset({row['action'] for row in rows}) or len({row['consent_id'] for row in rows})!=1:
        raise RuntimeError('A_B_CORRELATED_AUDIT_NOT_VERIFIED')
    if any(row['source_hospital_id']!='HOSP-A' or row['target_hospital_id']!='HOSP-B' for row in rows):
        raise RuntimeError('A_B_AUDIT_HOSPITAL_MISMATCH')
    final=[row for row in rows if row['action']=='PACS_INSTANCE_VERIFIED'][0]
    receipt=json.loads(final['reason'])
    if receipt.get('verification')!='AUTHENTICATED_B_REPORT' or any(receipt.get(key)!=pacs.get(key) for key in ['sha256','bytes','orthancId']):
        raise RuntimeError('B_FINAL_AUDIT_RECEIPT_MISMATCH')
    return {'auditSessionId':session,'consentId':rows[0]['consent_id']}

B_QUERY=r'''
import hashlib,http.client,json,pathlib,socket,ssl,subprocess
root=pathlib.Path('/opt/highpass/b-pacs-receiver-1ee2564f78cb4a1aaeb2b01671b0f627/secrets')
c=json.loads(subprocess.check_output(['docker','inspect','hp-b-pacs-receiver-b-pacs-mtls-1']))[0]
ip=c['NetworkSettings']['Networks']['highpass_b_pacs_receiver']['IPAddress']
ctx=ssl.create_default_context(cafile=str(root/'ca.crt'));ctx.load_cert_chain(str(root/'b-pacs-client.crt'),str(root/'b-pacs-client.key'))
class Connection(http.client.HTTPSConnection):
 def connect(self):self.sock=self._context.wrap_socket(socket.create_connection((ip,8443),timeout=8),server_hostname=self.host)
def call(path,body=None):
 peer=Connection('b-pacs-mtls',8443,context=ctx,timeout=8)
 try:
  peer.request('POST' if body else 'GET',path,body=body,headers={'content-type':'application/json'})
  response=peer.getresponse();data=response.read(8388609)
  if response.status!=200 or len(data)>8388608:raise RuntimeError('B_PACS_REQUERY_FAILED')
  return data
 finally:peer.close()
matches=json.loads(call('/tools/find',json.dumps({'Level':'Instance','Query':{'SOPInstanceUID':request['sop']}}).encode()))
if len(matches)!=1:raise RuntimeError('B_SELECTED_SOP_NOT_FOUND_OR_DUPLICATED')
metadata=json.loads(call('/instances/'+matches[0]));body=call('/instances/'+matches[0]+'/file')
if metadata['MainDicomTags']['SOPInstanceUID']!=request['sop'] or len(body)!=3146808 or hashlib.sha256(body).hexdigest()!=request['sha256']:raise RuntimeError('B_PACS_UID_HASH_MISMATCH')
print(json.dumps({'status':'PASS','sopInstanceUid':request['sop'],'sha256':request['sha256'],'bytes':len(body),'orthancId':matches[0],'transport':'B_INTERNAL_MTLS','destinationRequery':True}))
'''

AUDIT_JS=r'''
import {readFileSync} from 'node:fs';import {Client} from 'pg';
const request=JSON.parse(process.argv[1]);
const client=new Client({host:process.env.POSTGRES_HOST,port:Number(process.env.POSTGRES_PORT||5432),
 user:process.env.POSTGRES_USER,database:process.env.POSTGRES_DB,
 password:readFileSync(process.env.POSTGRES_PASSWORD_FILE,'utf8').trim(),
 connectionTimeoutMillis:5000,statement_timeout:5000,query_timeout:5000});
try{
 await client.connect();await client.query('BEGIN READ ONLY');
 const rows=await client.query('SELECT audit_id, audit_session_id, consent_id, action, result, source_hospital_id, target_hospital_id, sop_instance_uid, created_at, reason FROM audit_logs WHERE (sop_instance_uid=$1 OR study_instance_uid=$3) AND created_at >= $2 ORDER BY created_at LIMIT 100',[request.sop,request.since,'2.25.259656708708993797343330994179169711072']);
 await client.query('COMMIT');console.log(JSON.stringify({events:rows.rows}));
}finally{await client.end();}
'''

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--audit-only',action='store_true');parser.add_argument('--b-readiness',action='store_true');args=parser.parse_args()
    operation=uuid.uuid4().hex;folder=ROOT/'artifacts/workstation'/('a-b-single-import-evidence-'+operation);folder.mkdir(parents=True)
    result={'status':'NOT VERIFIED','operation':operation,'scope':'ONE_AUTHENTICATED_SYNTHETIC_INSTANCE','checks':[]};password=None
    try:
        if not args.audit_only:
            password=check.read_vm_credential(gui=True);client=check.connect('B',password)
            try:
                if args.b_readiness:
                    js="""import{readFileSync}from'node:fs';import{boundedHttps}from'/app/src/data-plane-gateway.js';try{let r=await boundedHttps('https://b-pacs-mtls:8443','/system',{tls:{ca:readFileSync(process.env.CAPSTONE_B_PACS_CA_FILE),cert:readFileSync(process.env.CAPSTONE_B_PACS_CLIENT_CERT_FILE),key:readFileSync(process.env.CAPSTONE_B_PACS_CLIENT_KEY_FILE)},maxBytes:32768,timeoutMs:4000});console.log(JSON.stringify({status:r.status,name:JSON.parse(r.body.toString()).Name}));}catch(e){console.log(JSON.stringify({failure:/^[A-Z0-9_]+$/.test(e.code||e.message)?e.code||e.message:e.name}));}"""
                    program='import subprocess,json\np=subprocess.run('+repr(['docker','exec','hp-capstone-b-portal-portal-1','/nodejs/bin/node','--input-type=module','-e',js])+',capture_output=True,text=True,timeout=15)\nlogs=subprocess.run(["docker","logs","--tail","500","hp-capstone-b-portal-portal-1"],capture_output=True,text=True,timeout=10)\nevents=[]\nfor line in (logs.stdout+logs.stderr).splitlines():\n try:\n  row=json.loads(line)\n  if row.get("event")=="CAPSTONE_RUNTIME_DIAGNOSTIC" and row.get("httpStatus",200)>=400:events.append(row)\n except ValueError:pass\nprint(json.dumps({"portalPacs":json.loads(p.stdout) if p.returncode==0 else {"failure":"PROBE_FAILED"},"diagnostics":events[-5:]}))'
                    result['bReadiness']=check.remote(client,'B',password,program,30)
                else:result['bPacs']=check.remote(client,'B',password,'request='+repr({'sop':SOP,'sha256':HASH})+'\n'+B_QUERY,40)
            finally:client.close();password=None
        client=check.connect('CLOUD',None)
        try:
            program='import json,subprocess\np=subprocess.run('+repr(['docker','exec','hp-capstone-control-control-1','/nodejs/bin/node','--input-type=module','-e',AUDIT_JS,json.dumps({'sop':SOP,'since':'2026-10-13T22:58:00Z'})])+',capture_output=True,text=True,timeout=20)\nif p.returncode:raise RuntimeError("CONTROL_READ_ONLY_AUDIT_FAILED")\nprint(p.stdout)'
            result['controlAudit']=check.remote(client,'CLOUD',None,program,25)
        finally:client.close()
        events=result['controlAudit']['events'];sessions={row['audit_session_id'] for row in events if row['action']=='PACS_INSTANCE_VERIFIED' and row['result']=='SUCCESS' and row['sop_instance_uid']==SOP}
        correlated=[row for row in events if row['audit_session_id'] in sessions and row['result']=='SUCCESS']
        if args.audit_only or args.b_readiness:
            result.update(status='NOT VERIFIED',reason='READ_ONLY_AUDIT_DIAGNOSTICS_ONLY')
            return_result=True
        else:return_result=False
        if not return_result:
            result.update(status='PASS',**validate_evidence(result['bPacs'],events),actualAtoBTransfer='PASS')
    except BaseException as error:result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:password=None
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8');print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
