"""Bounded live helper diagnosis. Credentials on stdin, never in evidence."""
import base64
import argparse
import hashlib
import getpass
import http.client
import importlib.util
import json
import os
import pathlib
import re
import shlex
import ssl
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIN = ROOT / 'artifacts/workstation/hospital-app-rollout-2026-10-08T20-18-57.600800+00-00'
spec = importlib.util.spec_from_file_location('helper_ops', ROOT/'scripts/workstation-automatic-ops.py')
ops = importlib.util.module_from_spec(spec); spec.loader.exec_module(ops)

def connect(role, password):
    client = paramiko.SSHClient(); client.set_missing_host_key_policy(paramiko.RejectPolicy())
    if role == 'B':
        receipt = json.loads((PIN/'result.json').read_text())
        assert receipt['status'] == 'PASS' and receipt['scope'] == 'A_B_APP_ONLY_PROMOTION'
        assert any(x['test']=='B_PINNED_RUNTIME_BASELINE' and x['status']=='PASS' for x in receipt['checks'])
        parts = (PIN/'B-public-host.key').read_text().split()
        key = paramiko.Ed25519Key(data=base64.b64decode(parts[1], validate=True))
        client.get_host_keys().add('192.168.111.149', key.get_name(), key)
        client.connect('192.168.111.149', username='server', password=password, look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
    else:
        identity = pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity/'known_hosts'))
        client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity/'id_ed25519'), look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
    return client

def read_vm_credential(gui=False):
    """Explicit operator input only. Never cached, logged or put in argv."""
    if not gui:
        value = getpass.getpass('B VM server password (concealed; not saved): ')
    else:
        spec = importlib.util.spec_from_file_location('deployment_credential_prompt', ROOT/'scripts/deployment-auth-preflight.py')
        prompt = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(prompt)
        value = prompt.ask_password_gui()
    if not value:
        raise SystemExit('B_CREDENTIAL_INPUT_CANCELLED')
    return value

def remote(client, role, password, program, seconds=30):
    prefix = "sudo -S -p '' " if role == 'B' else 'sudo -n '
    code, output = ops.run(client, prefix+'timeout '+str(seconds)+'s python3 -c '+shlex.quote(program), credential=password if role=='B' else None, seconds=seconds+5)
    if code:
        lines=re.findall(r'File "<string>", line (\d+)',output)
        kind=re.findall(r'(?m)^(AssertionError|KeyError|RuntimeError|FileNotFoundError|ValueError|TypeError)',output)
        raise RuntimeError('REMOTE_FAILED_'+str(code)+'_LINES_'+','.join(lines)+'_TYPE_'+','.join(kind))
    return json.loads(output)

def inventory(client, role, password):
    names = ['hp-capstone-b-portal-portal-1'] if role=='B' else ['hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
    return remote(client, role, password, '''import subprocess,json,hashlib
names='''+repr(names)+'''
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15));out=[]
for i in items:
 files=['src/server.js','src/health-helper-rag.js','src/health-helper-http.js','src/health-helper-corpus.js','src/synthetic-health-http.js','src/synthetic-health-records.js','public/app.js','public/ui/patient-helper.js','public/ui/patient-helper.css','public/ui/patient-health.js','public/ui/health-comparison.js','public/ui/health-comparison.css','public/ui/health-record-client.js']
 if i['Name'].endswith('portal-1'):files+=['public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','public/mobile/health-helper.js','public/mobile/health-helper.css']
 hashes={}
 if not i['Name'].endswith('postgres-1'):
  for f in files:
   js="const fs=require('node:fs'),c=require('node:crypto');try{console.log(c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex'))}catch{process.exit(2)}"
   r=subprocess.run(['docker','exec',i['Id'],'/nodejs/bin/node','-e',js,'/app/'+f],capture_output=True,timeout=4)
   hashes[f]=r.stdout.decode().strip() if r.returncode==0 else None
 out.append({'name':i['Name'],'id':i['Id'],'image':i['Image'],'health':i['State'].get('Health',{}).get('Status'),'labels':i['Config']['Labels'],'sourceHashes':hashes})
print(json.dumps(out))
''',60)

def request(path, body=None, token=None):
    headers={'origin':'https://192.168.111.149:9443','content-type':'application/json'}
    if token: headers['authorization']='Bearer '+token
    req=urllib.request.Request('https://192.168.111.149:9443'+path, data=json.dumps(body).encode() if body is not None else None, headers=headers)
    try: res=urllib.request.urlopen(req, context=ssl.create_default_context(cafile=str(ROOT/'tmp/certs/mtls/ca.crt')),timeout=70 if path=='/api/v1/me/health-helper/questions' else 20)
    except urllib.error.HTTPError as e: res=e
    except (urllib.error.URLError,OSError,http.client.RemoteDisconnected): return 0,{'error':'HTTP_TRANSPORT_FAILED'}
    data=res.read(131073);assert len(data)<=131072
    return res.status,json.loads(data)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');parser.add_argument('--qwen',action='store_true');parser.add_argument('--inventory-only',action='store_true');args=parser.parse_args()
    credentials=json.loads(getpass.getpass('Test credentials JSON (concealed): '))
    out={'observedAt':datetime.now(timezone.utc).isoformat(),'review':'DRAFT / UNASSIGNED'}
    for role in ['CLOUD','B']:
        c=connect(role, credentials['vm'])
        try: out[role]=inventory(c,role,credentials['vm'])
        finally:c.close()
    if args.inventory_only:
        folder=ROOT/'artifacts/workstation'/('health-helper-runtime-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
        folder.mkdir(parents=True,exist_ok=False);(folder/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
        print(json.dumps({'evidence':str(folder/'result.json'),'scope':'INVENTORY_ONLY','health':{role:[x['health'] for x in out[role]] for role in ['B','CLOUD']}}))
        return
    status,login=request('/api/capstone-demo/login',{'username':credentials['username'],'password':credentials['password'],'entryRole':'PATIENT','patientProfile':'HCC_SYNTHETIC'})
    out['login']={'status':status,'error':login.get('error')}
    if status==200:
        status,body=request('/api/v1/me/health-helper/questions',{'question':'AFP는 어떤 검사인가요?'},login['profiles']['PATIENT'])
        out['question']={'httpStatus':status,**{k:body.get(k) for k in ['error','status','requestId','corpusVersion','generationUsed','sources','questions','questionOrigin','recordContext','medicalContentGeneration']}}
        if args.verify:
            token=login['profiles']['PATIENT'];out['probes']=[]
            code,records=request('/api/v1/me/health-records/synthetic',token=token)
            out['healthRecords']={'httpStatus':code,'error':records.get('error'),'version':records.get('version'),'synthetic':records.get('synthetic'),'clinicalUse':records.get('clinicalUse'),'count':len(records.get('records',[])),
              'sha256':hashlib.sha256(json.dumps(records.get('records',[]),sort_keys=True,ensure_ascii=False).encode()).hexdigest()}
            out['healthProbes']=[]
            for label,path,body,auth,expected in [('HEALTH_NO_AUTH','/api/v1/me/health-records/synthetic',None,None,401),('HEALTH_TAMPERED_TOKEN','/api/v1/me/health-records/synthetic',None,token[:-8]+'XXXXXXXX',401),('HEALTH_QUERY_OVERRIDE','/api/v1/me/health-records/synthetic?patientId=other',None,token,422),('HEALTH_POST','/api/v1/me/health-records/synthetic',{},token,405)]:
                code,value=request(path,body,auth);out['healthProbes'].append({'test':label,'httpStatus':code,'expectedHttpStatus':expected,'error':value.get('error')})
            for label,question,auth,expected in [
                ('ALT_SOURCE',{'question':'ALT 검사 자료를 알려주세요'},token,200),
                ('NO_AUTH',{'question':'AFP 설명'},None,401),
                ('TAMPERED_TOKEN',{'question':'AFP 설명'},token[:-8]+'XXXXXXXX',401),
                ('BODY_PATIENT_OVERRIDE',{'question':'AFP 설명','patientId':'someone-else'},token,422),
                ('CLINICAL_REFUSAL',{'question':'암인지 진단해주세요'},token,200),
                ('UNREGISTERED_TOPIC',{'question':'비타민 검사 자료'},token,200)]:
                code,value=request('/api/v1/me/health-helper/questions',question,auth)
                out['probes'].append({'test':label,'httpStatus':code,'expectedHttpStatus':expected,
                    **{k:value.get(k) for k in ['status','error','generationUsed','requestId']}})
            c=connect('CLOUD',credentials['vm'])
            try:
                sql="BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(json_agg(t),'[]') FROM (SELECT audit_session_id,action,result,reason_code,created_at,(record_hash IS NOT NULL) AS hashed FROM audit_logs WHERE action IN ('HEALTH_HELPER_REQUEST','SYNTHETIC_HEALTH_RECORDS_READ') ORDER BY created_at DESC LIMIT 24) t; ROLLBACK;"
                out['audit']=remote(c,'CLOUD',None,'import subprocess,json; r=subprocess.run(["docker","exec","hp-capstone-control-postgres-1","psql","-X","-qAt","-U","hipass_bootstrap","-d","hipass","-c",'+repr(sql)+'],capture_output=True,check=True,timeout=10); print(r.stdout.decode())')
            finally:c.close()
    folder=ROOT/'artifacts/workstation'/('health-helper-runtime-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False);(folder/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
    if args.qwen:
        out['status']='PASS' if (out['login']['status']==200 and out.get('question',{}).get('status')=='VISIT_PREPARATION'
          and out['question']['generationUsed'] is True and out['question']['medicalContentGeneration'] is False
          and all(x['httpStatus']==x['expectedHttpStatus'] for x in out.get('probes',[])+out.get('healthProbes',[]))
          and out.get('healthRecords',{}).get('httpStatus')==200 and out['healthRecords']['count']==8 and out['healthRecords']['synthetic'] is True and out['healthRecords']['clinicalUse'] is False
          and any(x['audit_session_id']==out['question']['requestId'] and x['reason_code']=='HELPER_VISIT_QUESTIONS_GENERATED' and x['hashed'] for x in out.get('audit',[]))
          and any(x['action']=='SYNTHETIC_HEALTH_RECORDS_READ' and x['reason_code']=='SYNTHETIC_HEALTH_RECORDS_DELIVERED' and x['hashed'] for x in out.get('audit',[]))) else 'FAIL'
        (folder/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'evidence':str(folder/'result.json'),'status':out.get('status'),'login':out['login'],'question':out.get('question'),'probes':out.get('probes'),'images':{role:[x['image'] for x in out[role]] for role in ['B','CLOUD']}},ensure_ascii=True))
    if args.qwen and out['status']!='PASS':raise SystemExit(2)

if __name__=='__main__':main()
