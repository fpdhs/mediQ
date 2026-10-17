"""Strict cloud inventory + presenter-key stdin transfer to public browser probe."""
import argparse
import importlib.util
import json
import os
import pathlib
import shlex
import subprocess
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGE = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
FAQ_CONTROL = 'sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b'

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--modality',choices=['CT','MR'],default='CT')
    parser.add_argument('--surface',choices=['web','mobile'],default='web')
    parser.add_argument('--ingress-preflight',action='store_true')
    parser.add_argument('--faq',action='store_true',help='Exact deployed FAQ candidate plus public UI checks')
    args=parser.parse_args()
    spec=importlib.util.spec_from_file_location('gateway',ROOT/'scripts/capstone-a-gateway-ops.py')
    gateway=importlib.util.module_from_spec(spec);spec.loader.exec_module(gateway)
    client=paramiko.SSHClient()
    try:
        identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        code,output=gateway.base.ops.run(client,"sudo -n timeout 10s docker inspect hp-capstone-control-control-1 --format '{{.Image}}|{{.State.Health.Status}}'",seconds=15)
        assert code==0 and output.strip()==(FAQ_CONTROL if args.faq else IMAGE)+'|healthy'
        if args.ingress_preflight:
            # CA is public. Patient service credential remains exclusively in
            # the remote root process, never in command arguments or stdout.
            ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
            program='ca='+repr(ca)+'''\nimport pathlib,ssl,http.client,json
token=pathlib.Path('/opt/highpass/capstone-control-secrets/patient-a-service-secret').read_text().strip()
checks=[]
for path in ['/gateway/patient-self-view/authorize','/gateway/patient-self-view/ready']:
 connection=http.client.HTTPSConnection('10.90.88.1',context=ssl.create_default_context(cadata=ca),timeout=5)
 try:
  connection.request('POST',path,body='{}',headers={'content-type':'application/json','x-hipass-service-token':token})
  response=connection.getresponse();body=json.loads(response.read(32769))
  checks.append({'route':path,'httpStatus':response.status,'error':body.get('error'),'reason':body.get('reason')})
 finally:connection.close()
print(json.dumps({'scope':'ACTUAL_PRIVATE_PATIENT_INGRESS_DIAGNOSTIC_INVALID_INPUT_NOT_NORMAL_E2E','checks':checks,'review':'DRAFT / UNASSIGNED'}))
'''
            code,output=gateway.base.ops.run(client,'sudo -n timeout 15s python3 -c '+shlex.quote(program),seconds=20)
            assert code==0
            print(json.dumps(json.loads(output)),flush=True)
            return 0
        with gateway.root_sftp(client) as sftp,sftp.open('/opt/highpass/capstone-control-secrets/capstone-login-key','rb') as stream:
            key=stream.read(129)
        command=['node','scripts/verify-patient-public-browser.js',args.modality,args.surface]+(['--faq'] if args.faq else [])
        process=subprocess.run(command,cwd=ROOT,input=key,capture_output=True,timeout=180)
        key=None
        result=json.loads(process.stdout.decode('utf8'))
        if process.returncode!=0 and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
        print(json.dumps(result),flush=True)
        return 0 if result.get('status')=='PASS' else 2
    except Exception as error:
        print(json.dumps({'status':'NOT VERIFIED','reason':type(error).__name__,'review':'DRAFT / UNASSIGNED'}),flush=True)
        return 2
    finally:client.close()

if __name__=='__main__':raise SystemExit(main())
