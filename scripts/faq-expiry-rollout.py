"""Exact reviewed role image promotion/rollback. Default is read-only preflight."""
import argparse
import getpass
import hashlib
import importlib.util
import inspect
import json
import os
import pathlib
import shlex
import subprocess
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT/relative)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


plan = load('faq_deployment_plan', 'scripts/faq-expiry-deployment-preflight.py')
prior = load('faq_prior_runtime', 'scripts/capstone-cloud-app-rollout.py')
EVIDENCE = {
    'artifacts/workstation/faq-ui-candidate-manifest-20261010.json',
    'artifacts/workstation/faq-expiry-candidate-delta-20261010.json',
    'artifacts/workstation/qr-expiry-candidate-smoke-20261010.json',
    'artifacts/security/faq-ui-container-gate-20261010.json',
    'artifacts/security/qr-expiry-control-container-gate-20261010.json',
    'artifacts/security/faq-expiry-candidate-security-gate-20261010.json'}


def validate_review(manifest):
    if manifest.get('review') != 'PASS' or not manifest.get('reviewer') or not manifest.get('reviewDate') or manifest.get('exceptions') != []:
        raise ValueError('EXPLICIT_EXACT_CANDIDATE_REVIEW_REQUIRED')
    if manifest.get('candidates') != {'ui':plan.UI,'control':plan.CONTROL}:
        raise ValueError('REVIEW_IMAGE_MISMATCH')
    entries = manifest.get('files', [])
    if len(entries) != 6 or {e['path'] for e in entries} != EVIDENCE:
        raise ValueError('EXACT_REVIEW_EVIDENCE_SET_REQUIRED')
    for entry in entries:
        path = (ROOT/entry['path']).resolve()
        if not path.is_relative_to(ROOT/'artifacts') or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('REVIEW_EVIDENCE_CHANGED')


def validate_preflight(role, value):
    old,new = (plan.UI_BASE,plan.UI) if role=='B' else (plan.CONTROL_BASE,plan.CONTROL)
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(value['observedAt'])).total_seconds()
    if role not in ['B','CLOUD'] or value.get('status')!='PASS' or value.get('role')!=role or value.get('baselineImage')!=old or value.get('candidateImage')!=new or not 0<=age<3600:
        raise ValueError('FRESH_EXACT_ROLE_PREFLIGHT_REQUIRED')
    if value.get('nonImageConfigDifferences')!=0 or value.get('runtimeEnvironmentAndBindMountsMatch') is not True or value.get('rollbackImageAvailable') is not True:
        raise ValueError('PRESERVED_CONFIG_ROLLBACK_PREREQUISITES_REQUIRED')


def promotion_program(role, expected, ca, mac=None):
    return ('import subprocess,json,os,pathlib,hashlib,re,ssl,http.client,time,copy\n'
            + 'ROLE='+repr(role)+'\nEXPECTED='+repr(expected)+'\nCA='+repr(ca)+'\nMAC='+repr(mac)+'\n'
            + '\n'.join(name+'='+repr(getattr(plan,name)) for name in ['UI_BASE','CONTROL_BASE','UI','CONTROL','INGRESS','PG'])+'\n'
            + inspect.getsource(plan.image_only)+'\n'+inspect.getsource(prior.runtime_differences)+'\n'+r'''
checks=[];attempted=False;rollback='NOT REQUIRED';phase='BASELINE'
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=45,**kw)
 if result.returncode:raise RuntimeError('BOUNDED_COMMAND_FAILED')
 return result.stdout
def inventory():return json.loads(run(['docker','inspect',*names]))
def compose(selected):
 args=['docker','compose','--project-directory',stage,'-p',project]
 for path in selected:args+=['-f',path]
 return args
def fingerprint(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def unchanged(items):
 assert items[0]['Config']['Labels']['com.docker.compose.project.working_dir']==stage
 for old,current in zip(before,items):
  assert not runtime_differences(old,current) and current['State']['Running']
  if old['Name']!=before[0]['Name']:assert old['Id']==current['Id'] and old['Image']==current['Image']
 if ROLE=='CLOUD':assert items[2]['State']['Health']['Status']=='healthy'
def readiness(image,selected):
 deadline=time.monotonic()+40
 while True:
  current=inventory();assert current[0]['Image']==image;unchanged(current)
  assert current[0]['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==selected
  if current[0]['State'].get('Health',{}).get('Status')=='healthy':
   host,port,path=('192.168.111.149',9443,'/hipass/') if ROLE=='B' else ('10.90.88.1',443,'/api/health')
   connection=http.client.HTTPSConnection(host,port,context=ssl.create_default_context(cadata=CA),timeout=4)
   try:
    connection.request('GET',path);response=connection.getresponse();body=response.read(131073)
    if response.status==200 and len(body)<=131072:
     if ROLE=='CLOUD':
      data=json.loads(body);assert data.get('status')=='UP' and data.get('database')=='UP'
     return current
   except (OSError,ValueError):pass
   finally:connection.close()
  if time.monotonic()>=deadline:raise RuntimeError('STRICT_TLS_READINESS_TIMEOUT')
  time.sleep(1)
def activate(image,selected):
 run(compose(selected)+['up','-d','--no-deps','--pull','never','--force-recreate',service],env=env)
 return readiness(image,selected)
try:
 if ROLE=='B':assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 else:assert run(['hostname']).decode().strip()=='highpass-cloud'
 service='portal' if ROLE=='B' else 'control';base=UI_BASE if ROLE=='B' else CONTROL_BASE;new=UI if ROLE=='B' else CONTROL
 project=EXPECTED['project'];stage=EXPECTED['workingDirectory'];files=EXPECTED['files'];names=[project+'-'+service+'-1']
 if ROLE=='CLOUD':names+=['hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
 before=inventory();assert before[0]['Id']==EXPECTED['containerId'] and before[0]['Image']==base and before[0]['State']['Health']['Status']=='healthy'
 assert before[0]['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==EXPECTED['originalTargetFiles']
 for item,expected in zip(before[1:],EXPECTED['protectedContainers']):assert item['Name']==expected['name'] and item['Id']==expected['id'] and item['Image']==expected['image']
 for entry in EXPECTED['composeFileHashes']:assert hashlib.sha256(pathlib.Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
 assert json.loads(run(['docker','image','inspect',base]))[0]['Id']==base
 assert json.loads(run(['docker','image','inspect',new]))[0]['Id']==new
 runtime=dict(v.split('=',1) for v in before[0]['Config']['Env']);env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':base}
 if ROLE=='B':env.update({'HIPASS_B_PORTAL_SECRET_DIR':'/opt/highpass/capstone-b-portal-secrets','HIPASS_KEY_RELEASE_VAULT_KEY_ID':'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/9c03b2560a3240418d33d92a165b6806'})
 else:
  env.update({'HIPASS_POSTGRES_IMAGE':PG,'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'})
  for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:env[key]=runtime[key]
 baseline=json.loads(run(compose(files)+['config','--format','json'],env=env));assert fingerprint(baseline)==EXPECTED['baselineConfigSha256']
 # Creation labels may be older than the active project context; readiness before change uses original labels.
 readiness(base,EXPECTED['originalTargetFiles']);checks.append({'test':'EXACT_CAPTURED_BASELINE_STRICT_TLS','status':'PASS'})
 phase='OVERLAY';overlay=stage+'/faq-expiry-reviewed-20261010.yml';content='services:\n  '+service+':\n    image: '+new+'\n';target=pathlib.Path(overlay)
 if target.exists():assert target.is_file() and not target.is_symlink() and target.read_text()==content
 else:
  with target.open('x') as stream:stream.write(content)
  target.chmod(0o600)
 selected=files+[overlay];candidate=json.loads(run(compose(selected)+['config','--format','json'],env=env))
 image_only(ROLE,baseline,candidate);assert fingerprint(candidate)==EXPECTED['candidateConfigSha256']
 checks.append({'test':'EXACT_ROLE_IMAGE_ONLY_CONFIG','status':'PASS'})
 phase='ACTIVATION';attempted=True;activate(new,selected);checks.append({'test':'CANDIDATE_STRICT_TLS_UNCHANGED_RUNTIME','status':'PASS'})
 phase='ROLLBACK';activate(base,files);rollback='PASS';checks.append({'test':'BASE_IMAGE_ACTIVE_PROJECT_CONFIG_ROLLBACK_STRICT_TLS','status':'PASS'})
 phase='REACTIVATION';final=activate(new,selected);checks.append({'test':'CANDIDATE_REACTIVATION_STRICT_TLS','status':'PASS'})
 print(json.dumps({'status':'PASS','role':ROLE,'checks':checks,'rollback':rollback,'imageId':new,'baselineImage':base,
  'containerId':final[0]['Id'],'files':selected,'rollbackFiles':files,'nonImageRuntimeDifferences':0,
  'protectedContainersUnchanged':True,'scope':'ROLE_IMAGE_ACTIVATION_ROLLBACK_READINESS_NOT_BROWSER_OR_FULL_MVP'}))
except Exception as error:
 if attempted:
  try:activate(base,files);rollback='PASS'
  except Exception:rollback='FAIL'
 print(json.dumps({'status':'FAIL' if attempted else 'NOT VERIFIED','role':ROLE,'phase':phase,'reason':type(error).__name__,'checks':checks,'rollback':rollback}));raise SystemExit(2)
''')


def main():
    import paramiko
    parser=argparse.ArgumentParser();parser.add_argument('--role',choices=['B','CLOUD'],required=True)
    parser.add_argument('--apply',action='store_true');parser.add_argument('--preflight')
    args=parser.parse_args()
    if not args.apply:
        return subprocess.run([os.sys.executable,str(ROOT/'scripts/faq-expiry-deployment-preflight.py'),'--role',args.role],timeout=150).returncode
    manifest=json.loads((ROOT/'artifacts/workstation/faq-expiry-candidate-review-20261010.json').read_text(encoding='utf8'))
    validate_review(manifest)
    head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,timeout=10).decode().strip()
    if head!=manifest['head']:raise ValueError('REVIEWED_HEAD_CHANGED')
    path=(ROOT/(args.preflight or '')).resolve()
    if not path.is_relative_to(ROOT/'artifacts/workstation') or path.name!='result.json':raise ValueError('OWNED_PREFLIGHT_RECEIPT_REQUIRED')
    expected=json.loads(path.read_text(encoding='utf8'));validate_preflight(args.role,expected)
    subprocess.run(['node','scripts/verify-faq-expiry-candidates.js',plan.UI,plan.CONTROL],cwd=ROOT,check=True,capture_output=True,timeout=150)
    scan_name='faq-ui-candidate' if args.role=='B' else 'qr-expiry-control-candidate'
    scan=json.loads((ROOT/('artifacts/security/container-scan/'+scan_name+'-20261010.json')).read_text(encoding='utf8'))
    image=plan.UI if args.role=='B' else plan.CONTROL
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z','+00:00'))).total_seconds()
    if not 0<=age<86400 or scan['Metadata']['ImageID']!=image or not isinstance(scan.get('Results'),list) or any(v.get('Severity') in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities',[])):
        raise ValueError('EXACT_FRESH_CLEAN_SCAN_REQUIRED')
    ops=load('faq_rollout_ops','scripts/workstation-automatic-ops.py')
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ');directory=ROOT/'artifacts/workstation'/('faq-expiry-rollout-'+args.role.lower()+'-'+stamp)
    directory.mkdir(parents=True,exist_ok=False);client=paramiko.SSHClient();trust=None;credential=None;started=time.monotonic()
    result={'status':'NOT VERIFIED'}
    try:
        if args.role=='CLOUD':
            identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
            client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
            prefix='sudo -n ';mac=None;remote='/home/highpassadmin/.highpass-faq-expiry-'+stamp
        else:
            credential=getpass.getpass('VM credential (concealed): ');trust=ops.LocalVmTrust()
            key=trust.key('B',credential,directory/'B-public-host.key');address,mac,_=ops.ROLES['B']
            client.get_host_keys().add(address,key.get_name(),key);client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
            prefix="sudo -S -p '' ";remote='/home/server/.highpass-faq-expiry-'+stamp
        # Re-read exact target before any transfer. Full configuration is checked again remotely before activation.
        code,out=ops.run(client,prefix+'timeout 10s docker inspect '+shlex.quote(expected['containerId'])+" --format '{{.Image}}|{{.State.Health.Status}}'",credential=credential,seconds=15)
        if code or out.strip()!=expected['baselineImage']+'|healthy':raise ValueError('CURRENT_BASELINE_DRIFT')
        print(json.dumps({'phase':'EXACT_REVIEW_AND_BASELINE','role':args.role,'status':'PASS'}),flush=True)
        archive=directory/'reviewed-role-image.tar'
        subprocess.run(['docker','save','-o',str(archive),image],check=True,capture_output=True,timeout=180)
        with archive.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(15);sftp.mkdir(remote,mode=0o700);transfer_start=time.monotonic()
            def deadline(done,total):
                if time.monotonic()-transfer_start>180:raise TimeoutError('TRANSFER_DEADLINE')
            sftp.put(str(archive),remote+'/reviewed-role-image.tar',callback=deadline);sftp.chmod(remote+'/reviewed-role-image.tar',0o600)
        code,out=ops.run(client,'sha256sum '+shlex.quote(remote+'/reviewed-role-image.tar'),seconds=15)
        if code or out.split()[0]!=digest:raise ValueError('TRANSFER_HASH_MISMATCH')
        code,out=ops.run(client,prefix+'timeout 60s docker load -i '+shlex.quote(remote+'/reviewed-role-image.tar'),credential=credential,seconds=65)
        if code:raise ValueError('EXACT_IMAGE_LOAD_FAILED')
        print(json.dumps({'phase':'EXACT_ROLE_IMAGE_TRANSFER','role':args.role,'status':'PASS'}),flush=True)
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        code,out=ops.run(client,prefix+'timeout 300s python3 -c '+shlex.quote(promotion_program(args.role,expected,ca,mac)),credential=credential,seconds=305)
        result=json.loads(out)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:result={'status':'NOT VERIFIED','role':args.role,'reason':type(error).__name__,'remoteState':'REINSPECT_BEFORE_RETRY'}
    finally:
        client.close()
        if trust:trust.close()
        credential=None
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-started,3),'review':'DRAFT / UNASSIGNED'})
    receipt=directory/'result.json';receipt.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(receipt),**result}),flush=True)
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
