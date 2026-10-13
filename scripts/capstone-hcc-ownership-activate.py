"""Register only fixed audited HCC ownership with runtime writers stopped."""
import importlib.util
import json
import pathlib
import shlex
from datetime import datetime,timezone
import paramiko

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('account_config',ROOT/'scripts/capstone-patient-account-config.py')
config=importlib.util.module_from_spec(spec);spec.loader.exec_module(config)
REMOTE=r'''
import subprocess,json,time,pathlib,os,sys
name='hp-capstone-control-control-1'
def run(args,seconds=30):
 p=subprocess.run(args,capture_output=True,timeout=seconds)
 if p.returncode:
  reason=p.stderr.decode().strip()
  raise RuntimeError(reason if reason.startswith('PATIENT_REGISTRATION_') and len(reason)<100 else 'OWNERSHIP_OPERATOR_FAILED')
 return p.stdout
def inspect(n):return json.loads(run(['docker','inspect',n]))[0]
assert run(['hostname']).decode().strip()=='highpass-cloud'
before=inspect(name);assert before['Image']==IMAGE and before['State']['Health']['Status']=='healthy'
protected=[inspect(n) for n in ['hp-capstone-control-postgres-1','hp-capstone-control-ingress-1']]
receipt=pathlib.Path('/opt/highpass/capstone-control-secrets/hcc-ownership-registered-20261010.json')
assert not receipt.exists()
admin=pathlib.Path('/opt/highpass/capstone-control-secrets/admin-password')
assert admin.is_file() and not admin.is_symlink() and admin.stat().st_uid==0
command=['docker','run','--rm','--name','hp-capstone-hcc-ownership-20261010','--read-only','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges:true',
 '--network','hp-capstone-control_db_private','--mount','type=bind,src='+str(admin)+',dst=/run/secrets/admin-password,readonly',
 '-e','AUTH_MODE=TEST','-e','HIPASS_CONTROL_PLANE_ONLY=1','-e','CAPSTONE_ADMIN_PASSWORD_FILE=/run/secrets/admin-password',IMAGE,'scripts/register-capstone-patient-hcc.js']
run(['docker','stop','--time','20',name])
try:
 ready=json.loads(run(command,seconds=45));assert ready.get('status')=='READY' and ready.get('applied') is False
 result=json.loads(run(command+['--apply'],seconds=45));assert result.get('status')=='PASS' and result.get('applied') is True and result.get('patientId')=='MEDIQ-SYN-HCC-001'
 fd=os.open(receipt,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as stream:stream.write(json.dumps(result)+'\n')
finally:
 run(['docker','start',name]);end=time.monotonic()+90
 while time.monotonic()<end:
  if inspect(name)['State'].get('Health',{}).get('Status')=='healthy':break
  time.sleep(2)
 else:raise RuntimeError('CONTROL_READINESS_DEADLINE')
after=inspect(name);assert before['Image']==after['Image'] and before['Config']==after['Config'] and before['Mounts']==after['Mounts']
for old in protected:
 new=inspect(old['Name']);assert old['Id']==new['Id'] and old['State']['StartedAt']==new['State']['StartedAt']
print(json.dumps({**result,'controlRestarted':True,'protectedRuntimePreserved':True,'consentIssued':False}))
'''

def main():
    directory=ROOT/'artifacts/workstation'/('hcc-ownership-activate-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'));directory.mkdir(parents=True,exist_ok=False)
    identity=pathlib.Path.home()/'.ssh/highpass-capstone-cloud'
    client=paramiko.SSHClient();client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10)
        _,out,err=client.exec_command('sudo -n timeout 220s python3 -c '+shlex.quote('IMAGE='+repr(config.IMAGE)+'\n'+REMOTE),timeout=230)
        output=out.read().decode();code=out.channel.recv_exit_status()
        result=json.loads(output) if code==0 else {'status':'NOT VERIFIED','reason':'FIXED_OWNERSHIP_REGISTRATION_RECONCILIATION_REQUIRED'}
        if code:
            lines=err.read().decode().splitlines();result['reason']=next((x.split('RuntimeError: ',1)[1] for x in lines if x.startswith('RuntimeError: PATIENT_REGISTRATION_')) ,result['reason'])
    finally:client.close()
    (directory/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(directory/'result.json'),**result}))
    return 0 if result['status']=='PASS' else 2

if __name__=='__main__':raise SystemExit(main())
