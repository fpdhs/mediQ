"""Exact helper alignment; only approved model env/socket additions on Control."""
import argparse
import copy
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shlex
import subprocess
import time
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('helper_check',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec);spec.loader.exec_module(check)
BASE={'CLOUD':'sha256:39d2ceec42a64f72887df63d6c140374ce644be65bf247a7d70fce1e412a06d7',
      'B':'sha256:3034c26ed8afec060c33283acf306acd2a85bf574c3967977fc47235771fb543'}
FILES={'CLOUD':['src/server.js','src/health-helper-rag.js','src/health-helper-http.js','src/health-helper-corpus.js','src/health-helper-azure.js','src/health-helper-visit.js','src/health-helper-ollama.js','src/synthetic-health-http.js','src/synthetic-health-records.js'],
       'B':['public/ui/patient-helper.js','public/ui/patient-helper.css','src/capstone-b-portal.js','src/data-plane-gateway.js',
            'public/mobile/app.js','public/mobile/index.html','public/mobile/sw.js','public/mobile/health-helper.js','public/mobile/health-helper.css',
            'public/app.js','public/ui/patient-health.js','public/ui/health-comparison.js','public/ui/health-comparison.css','public/ui/health-record-client.js']}

def local(args,timeout=60):
    return subprocess.run(args,cwd=ROOT,capture_output=True,check=True,timeout=timeout).stdout

def remote_program(role,expected,candidate,ca,apply):
    return ('import subprocess,json,os,pathlib,hashlib,ssl,http.client,time,copy\n'
      +'ROLE='+repr(role)+'\nEXPECTED='+repr(expected)+'\nCANDIDATE='+repr(candidate)+'\nCA='+repr(ca)+'\nAPPLY='+repr(apply)+'\n'+r'''
def run(args,**kw):
 r=subprocess.run(args,capture_output=True,timeout=60,**kw)
 if r.returncode:raise RuntimeError('COMMAND_FAILED')
 return r.stdout
names=[i['name'].lstrip('/') for i in EXPECTED]
def inventory():return json.loads(run(['docker','inspect',*names]))
before=inventory();base=before[0]['Image'];service='portal' if ROLE=='B' else 'control'
assert all(a['Id']==b['id'] and a['Image']==b['image'] for a,b in zip(before,EXPECTED))
assert before[0]['State']['Health']['Status']=='healthy'
if ROLE=='B':assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()=='00:0c:29:a3:9e:1b'
else:assert run(['hostname']).decode().strip()=='highpass-cloud'
labels=before[0]['Config']['Labels'];stage=labels['com.docker.compose.project.working_dir'];project=labels['com.docker.compose.project']
assert project==('hp-capstone-b-portal' if ROLE=='B' else 'hp-capstone-control')
files=labels['com.docker.compose.project.config_files'].split(',')
assert files==EXPECTED[0]['labels']['com.docker.compose.project.config_files'].split(',')
assert all(pathlib.Path(f).parent==pathlib.Path(stage) and pathlib.Path(f).is_file() and not pathlib.Path(f).is_symlink() for f in files)
hashes=[{'path':f,'sha256':hashlib.sha256(pathlib.Path(f).read_bytes()).hexdigest()} for f in files]
runtime=dict(v.split('=',1) for v in before[0]['Config']['Env'])
env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':base}
if ROLE=='B':env.update(HIPASS_B_PORTAL_SECRET_DIR='/opt/highpass/capstone-b-portal-secrets',HIPASS_KEY_RELEASE_VAULT_KEY_ID=runtime['CAPSTONE_VAULT_KEY_ID'])
else:
 env.update(HIPASS_POSTGRES_IMAGE=before[2]['Image'],HIPASS_CLOUD_SECRET_DIR='/opt/highpass/capstone-control-secrets',HIPASS_CAPSTONE_PUBLIC_ORIGIN='https://192.168.111.149:9443')
 for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:env[key]=runtime[key]
def compose(selected):
 c=['docker','compose','--project-directory',stage,'-p',project]
 for f in selected:c+=['-f',f]
 return c
cfg=json.loads(run(compose(files)+['config','--format','json'],env=env));assert cfg['services'][service]['image']==base
different=[k for k,v in cfg['services'][service]['environment'].items() if runtime.get(k)!=(str(v).replace('$$','$') if k=='HIPASS_CAPSTONE_PATIENT_PASSWORD_HASH' else str(v))]
if different:
 print(json.dumps({'status':'FAIL','reason':'BASELINE_ENVIRONMENT_MISMATCH','keys':different}));raise SystemExit(0)
overlay=stage+'/helper-'+CANDIDATE[7:23]+'.yml'
changes={'image':CANDIDATE}
socket_source='/home/highpassadmin/.highpass-helper'
if ROLE=='CLOUD':
 assert pathlib.Path(socket_source+'/ollama.sock').is_socket()
 assert runtime['HIPASS_HEALTH_HELPER_MODEL']=='ollama' and runtime['HIPASS_HELPER_SOCKET']=='/run/helper/ollama.sock'
content=json.dumps({'services':{service:changes}})+'\n'
proposed=json.loads(run(compose(files)+['-f','-','config','--format','json'],env=env,input=content.encode()))
assert proposed['services'][service]['image']==CANDIDATE
proposed['services'][service]['image']=base
assert proposed==cfg
def unchanged(items):
 for i,(old,new) in enumerate(zip(before,items)):
  if i:assert old==new or all(old[k]==new[k] for k in ['Id','Image','Config','HostConfig','Mounts'])
  newenv=dict(x.split('=',1) for x in new['Config']['Env'])
  assert dict(x.split('=',1) for x in old['Config']['Env'])==newenv
  for key in ['Cmd','Entrypoint','User','WorkingDir']:assert old['Config'].get(key)==new['Config'].get(key)
  newbinds=new['HostConfig'].get('Binds') or []
  newmounts=new['Mounts']
  assert sorted(old['HostConfig'].get('Binds') or [])==sorted(newbinds)
  for key in ['PortBindings','ReadonlyRootfs','Privileged','CapAdd','CapDrop','SecurityOpt','NetworkMode']:assert old['HostConfig'].get(key)==new['HostConfig'].get(key)
  assert old['Mounts']==newmounts
  assert set(old['NetworkSettings']['Networks'])==set(new['NetworkSettings']['Networks'])
  assert new['State']['Running']
def ready(image,selected):
 end=time.monotonic()+55
 while True:
  items=inventory();unchanged(items);assert items[0]['Image']==image
  assert items[0]['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==selected
  if items[0]['State'].get('Health',{}).get('Status')=='healthy':
   host,port=('192.168.111.149',9443) if ROLE=='B' else ('10.90.88.1',443)
   conn=http.client.HTTPSConnection(host,port,context=ssl.create_default_context(cadata=CA),timeout=5)
   try:
    conn.request('GET','/api/health');resp=conn.getresponse();body=json.loads(resp.read(131072))
    if resp.status==200 and body.get('status')=='UP':return items
   except OSError:pass
   finally:conn.close()
  if time.monotonic()>end:raise RuntimeError('READINESS_DEADLINE')
  time.sleep(1)
ready(base,files)
result={'status':'PASS','role':ROLE,'base':base,'candidate':CANDIDATE,'composeFileHashes':hashes,
 'allowedConfigChanges':[],
 'unexpectedConfigDifferences':0,'review':'DRAFT / UNASSIGNED','rollback':'NOT REQUIRED'}
if not APPLY:print(json.dumps(result));raise SystemExit(0)
assert json.loads(run(['docker','image','inspect',CANDIDATE]))[0]['Id']==CANDIDATE
target=pathlib.Path(overlay)
if target.exists():
 assert not target.is_symlink() and target.is_file() and target.read_text()==content
 assert target.stat().st_mode & 0o777==0o600
else:
 fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w') as f:f.write(content)
def activate(image,selected):
 run(compose(selected)+['up','-d','--no-deps','--pull','never','--force-recreate',service],env=env)
 return ready(image,selected)
try:
 activate(CANDIDATE,files+[overlay])
 activate(base,files);result['rollback']='PASS'
 final=activate(CANDIDATE,files+[overlay]);result.update(containerId=final[0]['Id'],files=files+[overlay],rollbackFiles=files,protectedContainersUnchanged=True)
except Exception as e:
 result.update(status='FAIL',reason=type(e).__name__)
 if isinstance(e,subprocess.TimeoutExpired):result['timedOutCommand']=e.cmd[:3]
 try:activate(base,files);result['rollback']='PASS'
 except Exception:result['rollback']='NOT VERIFIED'
print(json.dumps(result))
''')

def main():
    p=argparse.ArgumentParser();p.add_argument('--role',choices=['CLOUD','B'],required=True);p.add_argument('--baseline',required=True);p.add_argument('--apply',action='store_true');p.add_argument('--credential-gui',action='store_true');args=p.parse_args()
    baseline=json.loads((ROOT/args.baseline).read_text(encoding='utf8'))[args.role]
    assert baseline[0]['image']==BASE[args.role]
    revision='compare-v1'
    image='highpass-helper:'+('control' if args.role=='CLOUD' else 'ui')+'-qwen-'+revision+'-20261011'
    candidate=local(['docker','image','inspect',image,'--format','{{.Id}}']).decode().strip();assert re.fullmatch('sha256:[a-f0-9]{64}',candidate)
    # Attest actual image bytes without starting the application or exposing a network.
    js="const fs=require('node:fs'),c=require('node:crypto');console.log(JSON.stringify(Object.fromEntries(JSON.parse(process.argv[1]).map(f=>[f,c.createHash('sha256').update(fs.readFileSync('/app/'+f)).digest('hex')]))))"
    actual=json.loads(local(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint','/nodejs/bin/node',image,'-e',js,json.dumps(FILES[args.role])]))
    assert actual=={f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in FILES[args.role]}
    scan_suffix=''
    scan=json.loads((ROOT/'artifacts/security/container-scan'/('helper-'+args.role.lower()+'-qwen-'+revision+scan_suffix+'-20261011.json')).read_text())
    assert scan['Metadata']['ImageID']==candidate and isinstance(scan.get('Results'),list)
    assert (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()<86400
    assert not any(v['Severity'] in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[]))
    password=check.read_vm_credential(args.credential_gui) if args.role=='B' else None
    client=check.connect(args.role,password);stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder=ROOT/'artifacts/workstation'/('helper-align-'+args.role.lower()+'-'+stamp);folder.mkdir(parents=True,exist_ok=False)
    try:
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        preflight=check.remote(client,args.role,password,remote_program(args.role,baseline,candidate,ca,False),90)
        (folder/'preflight.json').write_text(json.dumps(preflight,indent=2))
        if preflight['status']!='PASS':raise RuntimeError('PREFLIGHT_FAILED_'+json.dumps(preflight))
        print(json.dumps({'phase':'PREFLIGHT','role':args.role,'status':preflight['status']}),flush=True)
        result=preflight
        if args.apply:
            archive=folder/'candidate.tar';local(['docker','save','-o',str(archive),image],180)
            digest=hashlib.sha256(archive.read_bytes()).hexdigest()
            remote='/home/'+('server' if args.role=='B' else 'highpassadmin')+'/.helper-image-'+stamp+'.tar'
            with client.open_sftp() as sftp:
                sftp.get_channel().settimeout(20);started=time.monotonic()
                def deadline(done,total):
                    if time.monotonic()-started>240:raise TimeoutError('TRANSFER_TIMEOUT')
                sftp.put(str(archive),remote,callback=deadline);sftp.chmod(remote,0o600)
            program='import hashlib,pathlib,subprocess,json; p=pathlib.Path('+repr(remote)+'); assert hashlib.sha256(p.read_bytes()).hexdigest()=='+repr(digest)+'; subprocess.run(["docker","load","-i",str(p)],check=True,capture_output=True,timeout=90); print(json.dumps({"status":"PASS"}))'
            check.remote(client,args.role,password,program,100)
            print(json.dumps({'phase':'IMAGE_TRANSFER','role':args.role,'status':'PASS'}),flush=True)
            result=check.remote(client,args.role,password,remote_program(args.role,baseline,candidate,ca,True),260)
        result.update(sourceHashes=actual,observedAt=datetime.now(timezone.utc).isoformat())
        (folder/'result.json').write_text(json.dumps(result,indent=2))
        print(json.dumps({'evidence':str(folder/'result.json'),'status':result['status'],'candidate':candidate,'rollback':result['rollback']}))
        if result['status']!='PASS':raise SystemExit(2)
    finally:client.close()

if __name__=='__main__':main()
