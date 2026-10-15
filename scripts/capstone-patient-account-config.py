"""Configure one synthetic patient credential on the existing pinned cloud.

Password arrives via concealed stdin and is scrypt-hashed in remote memory.
Only a root-protected hash env file is persisted. No image/DB/PACS mutation.
Main-scenario activation is separate and requires audited catalog + ownership.
"""
import argparse
import getpass
import json
import pathlib
import shlex
import textwrap
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGE = 'sha256:80fac45b48f2e16b472341884372ec166e083a0e29617acf11f0f07038b09181'
REMOTE = r'''
import subprocess,json,pathlib,os,hashlib,secrets,copy,re,time,sys
mode=MODE
name='hp-capstone-control-control-1'
def run(args,**kw):
 p=subprocess.run(args,capture_output=True,timeout=60,**kw)
 if p.returncode:raise RuntimeError('BOUNDED_OPERATION_FAILED')
 return p.stdout
def inspect():return json.loads(run(['docker','inspect',name]))[0]
assert run(['hostname']).decode().strip()=='highpass-cloud'
before=inspect(); assert before['Image']==IMAGE and before['State']['Health']['Status']=='healthy'
labels=before['Config']['Labels']; stage=labels['com.docker.compose.project.working_dir']
assert labels['com.docker.compose.project']=='hp-capstone-control'
assert re.fullmatch(r'/home/highpassadmin/\.highpass-app-[0-9T.+-]{20,60}',stage)
files=labels['com.docker.compose.project.config_files'].split(',')
assert len(files) in [10,11] and all(pathlib.Path(f).parent==pathlib.Path(stage) for f in files)
assert pathlib.Path(files[-1]).name in ['hcc-source-upgrade-80fac45b48f2e16b.yml','patient-account-raw-20261010.yml']
runtime=dict(v.split('=',1) for v in before['Config']['Env'])
assert runtime['HIPASS_CAPSTONE_MOCK_IDP']=='1' and runtime['HIPASS_CAPSTONE_HCC_CATALOG']=='1'
env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':IMAGE,'HIPASS_POSTGRES_IMAGE':json.loads(run(['docker','inspect','hp-capstone-control-postgres-1']))[0]['Image'],
 'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
for k in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:env[k]=runtime[k]
command=['docker','compose','--project-directory',stage,'-p','hp-capstone-control']
for f in files:command+=['-f',f]
base=json.loads(run(command+['config','--format','json'],env=env))
account_file=pathlib.Path('/opt/highpass/capstone-control-secrets/patient-account-raw-20261010.env')
overlay=pathlib.Path(stage)/('patient-account-raw-20261010.yml' if mode=='account' else 'patient-main-20261010.yml')
assert not overlay.is_symlink()
if mode=='account':
 assert len(files)==10 and not runtime.get('HIPASS_CAPSTONE_PATIENT_USERNAME') and not runtime.get('HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH')
 password=sys.stdin.buffer.readline().rstrip(b'\r\n')
 assert 8<=len(password)<=128 and b'\0' not in password
 if account_file.exists():
  assert account_file.is_file() and not account_file.is_symlink() and account_file.stat().st_uid==0 and account_file.stat().st_mode&0o777==0o600
  lines=account_file.read_text().splitlines(); assert len(lines)==2 and lines[0]=='HIPASS_CAPSTONE_PATIENT_USERNAME=ycdc'
  encoded=lines[1].split('=',1)[1].strip("'")
  assert re.fullmatch(r'scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}',encoded)
  _,salt,digest=encoded.split('$')
  assert secrets.compare_digest(hashlib.scrypt(password,salt=bytes.fromhex(salt),n=16384,r=8,p=1,dklen=64).hex(),digest)
 else:
  salt=secrets.token_bytes(16); digest=hashlib.scrypt(password,salt=salt,n=16384,r=8,p=1,dklen=64).hex()
  encoded='scrypt$'+salt.hex()+'$'+digest
  text="HIPASS_CAPSTONE_PATIENT_USERNAME=ycdc\nHIPASS_CAPSTONE_PATIENT_PASSWORD_HASH="+encoded+"\n"
  fd=os.open(account_file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as stream:stream.write(text)
 password=None
 assert account_file.stat().st_uid==0 and account_file.stat().st_mode&0o777==0o600
 contents={'services':{'control':{'env_file':[{'path':str(account_file),'format':'raw'}]}}}
 expected={'HIPASS_CAPSTONE_PATIENT_USERNAME':'ycdc','HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH':encoded}
else:
 assert len(files)==11 and runtime.get('HIPASS_CAPSTONE_PATIENT_USERNAME')=='ycdc' and runtime.get('HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH')
 # Database read-only reconciliation: exact fixed catalog, active account/ref and intact audit.
 js="""import {readFileSync} from 'node:fs';import pg from 'pg';import {HCC_PATIENT_SUBJECT,HCC_PATIENT_ID,HCC_STUDY_UID} from '/app/src/capstone-hcc-catalog.js';
 const client=new pg.Client({host:'postgres',database:'hipass',user:'hipass_app',password:readFileSync(process.env.POSTGRES_PASSWORD_FILE,'utf8').trim(),connectionTimeoutMillis:5000,query_timeout:5000});await client.connect();
 const r=await client.query('SELECT EXISTS(SELECT 1 FROM patients WHERE patient_id=$1) AS patient,EXISTS(SELECT 1 FROM imaging_studies WHERE patient_id=$1 AND study_instance_uid=$2) AS study',[HCC_PATIENT_ID,HCC_STUDY_UID]);if(!r.rows[0].patient||!r.rows[0].study)throw Error('CATALOG_REQUIRED');await client.end();console.log('CATALOG_PRESENT');"""
 assert run(['docker','exec',name,'/nodejs/bin/node','--input-type=module','-e',js]).decode().strip()=='CATALOG_PRESENT'
 receipt=pathlib.Path('/opt/highpass/capstone-control-secrets/hcc-ownership-registered-20261010.json')
 assert receipt.is_file() and not receipt.is_symlink() and receipt.stat().st_uid==0 and receipt.stat().st_mode&0o777==0o600
 proof=json.loads(receipt.read_text())
 assert proof.get('status')=='PASS' and proof.get('applied') is True and proof.get('patientId')=='MEDIQ-SYN-HCC-001'
 ownership_js="""import {readFileSync} from 'node:fs';import pg from 'pg';
 const c=new pg.Client({host:'postgres',database:'hipass',user:'hipass_bootstrap',password:readFileSync('/run/secrets/admin-password','utf8').trim(),connectionTimeoutMillis:5000,query_timeout:5000});await c.connect();
 const r=await c.query('SELECT a.status AS account_status,r.status AS ref_status FROM capstone_patient_accounts a JOIN capstone_patient_ownership_refs r ON r.subject=a.subject AND r.patient_id=a.patient_id WHERE a.subject=$1 AND a.patient_id=$2 AND r.study_instance_uid=$3 AND r.source_hospital_id=$4',['synthetic-hcc-account','MEDIQ-SYN-HCC-001','2.25.259656708708993797343330994179169711072','HOSP-A']);
 if(r.rows.length!==1||r.rows[0].account_status!=='ACTIVE'||r.rows[0].ref_status!=='ACTIVE')throw Error('OWNERSHIP_REQUIRED');await c.end();console.log('OWNERSHIP_ACTIVE');"""
 assert run(['docker','run','--rm','--read-only','--user','65532:65532','--cap-drop','ALL','--security-opt','no-new-privileges:true','--network','hp-capstone-control_db_private',
 '--mount','type=bind,src=/opt/highpass/capstone-control-secrets/admin-password,dst=/run/secrets/admin-password,readonly',IMAGE,'--input-type=module','-e',ownership_js]).decode().strip()=='OWNERSHIP_ACTIVE'
 contents={'services':{'control':{'environment':{'HIPASS_CAPSTONE_MAIN_SCENARIO':'HCC'}}}}
 expected={'HIPASS_CAPSTONE_MAIN_SCENARIO':'HCC'}
raw=json.dumps(contents)+'\n'
candidate=json.loads(run(command+['-f','-','config','--format','json'],env=env,input=raw.encode()))
normalized=copy.deepcopy(candidate)
if mode=='account' and 'env_file' in normalized['services']['control']:
 added=normalized['services']['control'].pop('env_file')
 assert added==[{'path':str(account_file),'required':True,'format':'raw'}]
for k,v in expected.items():
 actual_value=normalized['services']['control']['environment'].pop(k)
 # Compose config serialization escapes literal dollar signs in env-file values.
 assert (actual_value.replace('$$','$') if k=='HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH' else actual_value)==v
assert normalized==base
if overlay.exists():
 assert overlay.is_file() and overlay.stat().st_uid==0 and overlay.stat().st_mode&0o777==0o600 and overlay.read_text()==raw
else:
 fd=os.open(overlay,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
 with os.fdopen(fd,'w') as stream:stream.write(raw)
promote=command+['-f',str(overlay)]
protected=json.loads(run(['docker','inspect','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']))
def healthy():
 end=time.monotonic()+90
 while time.monotonic()<end:
  item=inspect()
  if item['State'].get('Health',{}).get('Status')=='healthy':return item
  time.sleep(2)
 raise RuntimeError('READINESS_DEADLINE')
try:
 run(promote+['up','-d','--no-deps','--force-recreate','--pull','never','control'],env=env)
 after=healthy();actual=dict(v.split('=',1) for v in after['Config']['Env'])
 for k,v in expected.items():assert actual.pop(k)==v
 assert actual==runtime
 assert after['Image']==before['Image'] and after['Mounts']==before['Mounts']
 for k in ['User','Cmd','Entrypoint','ExposedPorts']:assert after['Config'].get(k)==before['Config'].get(k)
 # Docker may reorder the identical bind list during recreation. Actual mounts
 # above and sorted exact bind strings must both match (including read-only).
 assert sorted(after['HostConfig'].get('Binds') or [])==sorted(before['HostConfig'].get('Binds') or [])
 for k in ['ReadonlyRootfs','CapDrop','SecurityOpt','PortBindings','NetworkMode']:assert after['HostConfig'].get(k)==before['HostConfig'].get(k)
 for old in protected:
  new=json.loads(run(['docker','inspect',old['Name']]))[0];assert old['Id']==new['Id'] and old['State']['StartedAt']==new['State']['StartedAt']
 print(json.dumps({'status':'PASS','scope':'SYNTHETIC_PATIENT_ACCOUNT_CONFIGURATION' if mode=='account' else 'FIXED_HCC_MAIN_SCENARIO_ACTIVATION','username':'ycdc','passwordStoredAs':'SCRYPT_HASH_ONLY','image':IMAGE,'protectedRuntimePreserved':True,'overlay':str(overlay),'review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 import traceback
 original_line=traceback.extract_tb(error.__traceback__)[-1].lineno
 run(command+['up','-d','--no-deps','--force-recreate','--pull','never','control'],env=env);healthy()
 differences={k:{'before':before['HostConfig'].get(k),'after':after['HostConfig'].get(k)} for k in ['ReadonlyRootfs','CapDrop','SecurityOpt','Binds','PortBindings','NetworkMode'] if before['HostConfig'].get(k)!=after['HostConfig'].get(k)} if 'after' in locals() else {}
 print(json.dumps({'status':'NOT VERIFIED','reason':'PROMOTION_FAILED_ROLLBACK_EXECUTED','originalLine':original_line,'hostConfigDifferences':differences}));sys.exit(2)
'''

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode',choices=['account','main'],required=True)
    args=parser.parse_args()
    secret=getpass.getpass('Patient password (concealed): ') if args.mode=='account' else None
    identity=pathlib.Path.home()/'.ssh/highpass-capstone-cloud'
    client=paramiko.SSHClient();client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
    directory=ROOT/'artifacts/workstation'/('patient-account-config-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    result={'status':'NOT VERIFIED','mode':args.mode,'review':'DRAFT / UNASSIGNED'}
    try:
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10)
        program='MODE='+repr(args.mode)+'\nIMAGE='+repr(IMAGE)+'\ntry:\n'+textwrap.indent(REMOTE,' ')+'\nexcept Exception as error:\n import traceback\n print(json.dumps({"status":"NOT VERIFIED","reason":"CONFIGURATION_OR_RUNTIME_RECONCILIATION_REQUIRED","errorType":type(error).__name__,"operatorLine":traceback.extract_tb(error.__traceback__)[-1].lineno}))\n sys.exit(2)\n'
        stdin,stdout,stderr=client.exec_command('sudo -n timeout 180s python3 -c '+shlex.quote(program),timeout=190)
        if secret is not None:stdin.write(secret+'\n');stdin.flush()
        secret=None;stdin.channel.shutdown_write()
        output=stdout.read().decode();code=stdout.channel.recv_exit_status()
        if output.strip():result=json.loads(output)
        else:result['reason']='CONFIGURATION_OR_RUNTIME_RECONCILIATION_REQUIRED'
    finally:client.close();secret=None
    (directory/'result.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(directory/'result.json'),**result}))
    return 0 if result['status']=='PASS' else 2

if __name__=='__main__':raise SystemExit(main())
