"""Reviewed B-only image promotion, real rollback and reactivation. No DB writes."""
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
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


plan = load('focus_plan', 'scripts/patient-focus-b-preflight.py')
edge = load('focus_edge', 'scripts/capstone-patient-edge-rollout.py')
prior = load('focus_prior', 'scripts/capstone-cloud-app-rollout.py')


def reviewed_candidate():
    manifest = json.loads((ROOT / 'artifacts/workstation/patient-focus-review-manifest-20261010.json').read_text(encoding='utf8'))
    if manifest.get('review') != 'PASS' or not manifest.get('reviewer') or not manifest.get('reviewDate') or manifest.get('imageId') != plan.CANDIDATE:
        raise ValueError('EXACT_CANDIDATE_REVIEW_REQUIRED')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=10).decode().strip() != manifest['head']:
        raise ValueError('REVIEWED_HEAD_CHANGED')
    if len(manifest['files']) != 7:
        raise ValueError('EXACT_EVIDENCE_SET_REQUIRED')
    for entry in manifest['files']:
        path = (ROOT / entry['path']).resolve()
        if not path.is_relative_to(ROOT / 'artifacts') or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('REVIEWED_EVIDENCE_CHANGED')
    source = json.loads((ROOT / manifest['files'][0]['path']).read_text(encoding='utf8'))
    for entry in source['results']:
        path = (ROOT / entry['path']).resolve()
        if not path.is_relative_to(ROOT) or hashlib.sha256(path.read_bytes()).hexdigest() != entry['host']:
            raise ValueError('REVIEWED_SOURCE_CHANGED')
    scan = json.loads((ROOT / 'artifacts/security/container-scan/patient-focus-20261010.json').read_text(encoding='utf8'))
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(scan['CreatedAt'].replace('Z', '+00:00'))).total_seconds()
    if scan['Metadata']['ImageID'] != plan.CANDIDATE or not 0 <= age < 86400 or any(v['Severity'] in ['HIGH', 'CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities', [])):
        raise ValueError('EXACT_FRESH_CLEAN_SCAN_REQUIRED')
    actual = subprocess.check_output(['docker', 'image', 'inspect', 'highpass-platform-mvp:capstone-patient-focus-20261010', '--format', '{{.Id}}'], timeout=15).decode().strip()
    if actual != plan.CANDIDATE:
        raise ValueError('LOCAL_IMAGE_CHANGED')
    return manifest


def validated_context(labels):
    stage = labels.get('com.docker.compose.project.working_dir', '')
    if labels.get('com.docker.compose.project') != 'hp-capstone-b-portal' or not re.fullmatch(r'/home/server/.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('B_CONTEXT_REQUIRED')
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    if files != [stage + '/' + name for name in ['portal.yml', 'encryption.yml', 'patient.yml']]:
        raise ValueError('EXACT_B_THREE_FILES_REQUIRED')
    return stage, files


def image_only(baseline, candidate):
    normalized = copy.deepcopy(candidate)
    if baseline['services']['portal']['image'] != BASE or normalized['services']['portal']['image'] != CANDIDATE:
        raise ValueError('EXACT_IMAGE_PAIR_REQUIRED')
    normalized['services']['portal']['image'] = BASE
    if normalized != baseline:
        raise ValueError('NON_IMAGE_CONFIG_CHANGE')


# These globals are also explicitly supplied to the finite remote program.
import re
import copy
BASE = plan.BASE
CANDIDATE = plan.CANDIDATE


def promotion_program(ca, mac):
    return ('import subprocess,json,os,copy,re,pathlib,ssl,http.client,time\n'
            + 'BASE=' + repr(BASE) + '\nCANDIDATE=' + repr(CANDIDATE)
            + '\nCA=' + repr(ca) + '\nMAC=' + repr(mac) + '\n'
            + inspect.getsource(validated_context) + '\n'
            + inspect.getsource(image_only) + '\n'
            + inspect.getsource(prior.runtime_differences) + '\n' + r'''
phase='BASELINE';checks=[];attempted=False;rollback='NOT REQUIRED'
def run(command,**kw):
 value=subprocess.run(command,capture_output=True,timeout=45,**kw)
 if value.returncode:raise RuntimeError('COMMAND_FAILED')
 return value.stdout
def inventory():
 return json.loads(run(['docker','inspect','hp-capstone-b-portal-portal-1']))[0]
def compose():
 cmd=['docker','compose','--project-directory',stage,'-p','hp-capstone-b-portal']
 for f in files:cmd.extend(['-f',f])
 return cmd
def env_for(image):
 return {'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':image,'HIPASS_B_PORTAL_SECRET_DIR':'/opt/highpass/capstone-b-portal-secrets','HIPASS_KEY_RELEASE_VAULT_KEY_ID':'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/9c03b2560a3240418d33d92a165b6806'}
def readiness(image):
 deadline=time.monotonic()+35
 while True:
  current=inventory()
  assert current['Image']==image
  assert validated_context(current['Config']['Labels'])==(stage,files)
  assert not runtime_differences(before,current)
  if current['State']['Running'] and current['State'].get('Health',{}).get('Status')=='healthy':
   connection=http.client.HTTPSConnection('192.168.111.149',9443,context=ssl.create_default_context(cadata=CA),timeout=4)
   try:
    connection.request('GET','/hipass/');response=connection.getresponse();response.read(131073)
    if response.status==200:return current
   except OSError:pass
   finally:connection.close()
  if time.monotonic()>=deadline:raise RuntimeError('B_STRICT_TLS_READINESS_TIMEOUT')
  time.sleep(1)
def activate(image):
 run(compose()+['up','-d','--no-deps','--pull','never','--force-recreate','portal'],env=env_for(image))
 return readiness(image)
try:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 before=inventory();assert before['Image']==BASE and before['State']['Running'] and before['State']['Health']['Status']=='healthy'
 stage,files=validated_context(before['Config']['Labels'])
 baseline=json.loads(run(compose()+['config','--format','json'],env=env_for(BASE)))
 candidate=json.loads(run(compose()+['config','--format','json'],env=env_for(CANDIDATE)))
 image_only(baseline,candidate)
 cfg=baseline['services']['portal'];actual=dict(v.split('=',1) for v in before['Config']['Env'])
 assert all(actual.get(k)==str(v) for k,v in cfg['environment'].items())
 expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg.get('volumes',[]) if v['type']=='bind')
 observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in before['Mounts'] if v['Type']=='bind')
 assert expected==observed
 readiness(BASE);checks.append({'test':'ACTUAL_BASELINE_CONFIG_RUNTIME_STRICT_TLS','status':'PASS'})
 phase='ACTIVATION';attempted=True;activate(CANDIDATE)
 checks.append({'test':'B_ONLY_EXACT_IMAGE_ACTIVATION_STRICT_TLS_UNCHANGED_RUNTIME','status':'PASS'})
 phase='ROLLBACK';activate(BASE);rollback='PASS'
 checks.append({'test':'ACTUAL_BASE_IMAGE_THREE_FILES_ROLLBACK_STRICT_TLS','status':'PASS'})
 phase='REACTIVATION';final=activate(CANDIDATE)
 checks.append({'test':'CANDIDATE_REACTIVATION_STRICT_TLS_UNCHANGED_RUNTIME','status':'PASS'})
 print(json.dumps({'status':'PASS','checks':checks,'rollback':rollback,'imageId':CANDIDATE,'baselineImage':BASE,'files':files,'containerId':final['Id'],'nonImageRuntimeDifferences':0,'scope':'ACTUAL_B_ONLY_IMAGE_ACTIVATION_ROLLBACK_NOT_FIXED_BROWSER_OR_FULL_MVP'}))
except Exception as error:
 if attempted:
  try:activate(BASE);rollback='PASS'
  except Exception:rollback='FAIL'
 print(json.dumps({'status':'FAIL','phase':phase,'reason':type(error).__name__,'checks':checks,'rollback':rollback}));raise SystemExit(2)
''')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    reviewed_candidate()
    if not args.apply:
        return plan.main()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = ROOT / 'artifacts/workstation' / ('patient-focus-b-rollout-' + stamp)
    directory.mkdir(parents=True)
    credential = getpass.getpass('VM credential (concealed): ')
    client = paramiko.SSHClient();trust = None
    started = time.monotonic()
    result = {'status': 'NOT VERIFIED'}
    try:
        trust = edge.ops.LocalVmTrust()
        key = trust.key('B', credential, directory / 'B-public-host.key')
        address, mac, _ = edge.ops.ROLES['B']
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        # Baseline is checked again before any archive transfer or deployment.
        code, output = edge.ops.run(client,"sudo -S -p '' timeout 10s docker inspect hp-capstone-b-portal-portal-1 --format '{{.Image}}|{{.State.Health.Status}}'",credential=credential,seconds=15)
        if code or output.strip() != BASE + '|healthy':
            raise ValueError('ACTUAL_B_BASELINE_REQUIRED')
        print(json.dumps({'phase':'REVIEW_AND_B_BASELINE','status':'PASS'}),flush=True)
        archive = directory / 'reviewed-b-focus.tar'
        subprocess.run(['docker','save','-o',str(archive),CANDIDATE],check=True,capture_output=True,timeout=180)
        with archive.open('rb') as stream:digest=hashlib.file_digest(stream,'sha256').hexdigest()
        remote = '/home/server/.highpass-b-focus-' + stamp
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(15);sftp.mkdir(remote,mode=0o700)
            transfer_started=time.monotonic()
            def deadline(done,total):
                if time.monotonic()-transfer_started>180:raise TimeoutError('TRANSFER_DEADLINE')
            sftp.put(str(archive),remote+'/reviewed-b-focus.tar',callback=deadline)
            sftp.chmod(remote+'/reviewed-b-focus.tar',0o600)
        code,output=edge.ops.run(client,'sha256sum '+shlex.quote(remote+'/reviewed-b-focus.tar'),seconds=15)
        if code or output.split()[0]!=digest:raise ValueError('TRANSFER_HASH_MISMATCH')
        code,output=edge.ops.run(client,"sudo -S -p '' timeout 60s docker load -i "+shlex.quote(remote+'/reviewed-b-focus.tar'),credential=credential,seconds=65)
        if code:raise ValueError('IMAGE_LOAD_FAILED')
        code,output=edge.ops.run(client,"sudo -S -p '' timeout 10s docker image inspect "+CANDIDATE+" --format '{{.Id}}'",credential=credential,seconds=15)
        if code or output.strip()!=CANDIDATE:raise ValueError('LOADED_IMAGE_MISMATCH')
        print(json.dumps({'phase':'EXACT_B_IMAGE_TRANSFER','status':'PASS'}),flush=True)
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        code,output=edge.ops.run(client,"sudo -S -p '' timeout 240s python3 -c "+shlex.quote(promotion_program(ca,mac)),credential=credential,seconds=245)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:
        result={'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:
        client.close()
        if trust:trust.close()
        credential=None
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-started,3),'review':'DRAFT / UNASSIGNED'})
    path=directory/'result.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'result':str(path),**result}),flush=True)
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
