"""Reviewed ingress-only activation and real rollback; never touch writers/DB."""
import argparse
import hashlib
import importlib.util
import json
import os
import pathlib
import shlex
import subprocess
import sys
import time
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


plan = load_module('patient_ingress_plan', 'scripts/patient-ingress-plan-preflight.py')
gateway = load_module('patient_gateway_ops', 'scripts/capstone-a-gateway-ops.py')
rollout = load_module('prior_cloud_rollout', 'scripts/capstone-cloud-app-rollout.py')


def reviewed_candidate():
    manifest = json.loads((ROOT / 'artifacts/workstation/patient-ingress-review-manifest-20261010.json').read_text(encoding='utf8'))
    if manifest.get('review') != 'PASS' or not manifest.get('reviewer') or not manifest.get('reviewDate') or manifest.get('imageId') != plan.CANDIDATE:
        raise ValueError('EXACT_CANDIDATE_HUMAN_REVIEW_REQUIRED')
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=10).decode().strip()
    if head != manifest['head']:
        raise ValueError('REVIEWED_HEAD_CHANGED')
    for entry in manifest['files']:
        path = (ROOT / entry['path']).resolve()
        if not path.is_relative_to(ROOT / 'artifacts') or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('REVIEWED_EVIDENCE_CHANGED')
    source = json.loads((ROOT / manifest['files'][0]['path']).read_text(encoding='utf8'))
    for entry in source['results']:
        path = (ROOT / entry['path']).resolve()
        if not path.is_relative_to(ROOT) or hashlib.sha256(path.read_bytes()).hexdigest() != entry['host']:
            raise ValueError('REVIEWED_SOURCE_CHANGED')
    scan = json.loads((ROOT / 'artifacts/security/container-scan/patient-ingress-20261010.json').read_text(encoding='utf8'))
    age = (datetime.now(timezone.utc) - datetime.fromisoformat(scan['CreatedAt'].replace('Z', '+00:00'))).total_seconds()
    if scan['Metadata']['ImageID'] != plan.CANDIDATE or not 0 <= age < 86400 or any(v['Severity'] in ['HIGH', 'CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities', [])):
        raise ValueError('EXACT_FRESH_CLEAN_SCAN_REQUIRED')
    image = subprocess.check_output(['docker', 'image', 'inspect', 'highpass-platform-mvp:capstone-patient-ingress-20261010', '--format', '{{.Id}}'], timeout=15).decode().strip()
    if image != plan.CANDIDATE:
        raise ValueError('LOCAL_IMAGE_CHANGED')
    return manifest


def promotion_program(ca):
    import inspect
    return ('import subprocess,json,os,copy,hashlib,re,pathlib,ssl,http.client,time\n'
            + 'FILES=' + repr(plan.FILES) + '\nCURRENT=' + repr(plan.CURRENT)
            + '\nCANDIDATE=' + repr(plan.CANDIDATE) + '\nPG=' + repr(plan.PG)
            + '\nCA=' + repr(ca) + '\n'
            + inspect.getsource(plan.validated_patient_context) + '\n'
            + inspect.getsource(plan.assert_ingress_only_config) + '\n'
            + inspect.getsource(rollout.runtime_differences) + '\n' + r'''
checks=[];attempted=False;rollback='NOT REQUIRED';phase='BASELINE'
def run(command,**kw):
 value=subprocess.run(command,capture_output=True,timeout=45,**kw)
 if value.returncode:raise RuntimeError('COMMAND_FAILED')
 return value.stdout
def inventory():
 return json.loads(run(['docker','inspect','hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']))
def compose(files):
 command=['docker','compose','--project-directory',stage,'-p','hp-capstone-control']
 for path in files:command.extend(['-f',path])
 return command
def probe(expected):
 deadline=time.monotonic()+25
 while True:
  connection=http.client.HTTPSConnection('10.90.88.1',context=ssl.create_default_context(cadata=CA),timeout=4)
  try:
   token=pathlib.Path('/opt/highpass/capstone-control-secrets/patient-a-service-secret').read_text().strip()
   connection.request('POST','/gateway/patient-self-view/authorize',body='{}',headers={'content-type':'application/json','x-hipass-service-token':token})
   response=connection.getresponse();body=json.loads(response.read(32769))
   if response.status==expected[0] and (body.get('error') or body.get('reason'))==expected[1]:return {'httpStatus':response.status,'code':body.get('error') or body.get('reason')}
  except (OSError,ValueError):pass
  finally:connection.close()
  if time.monotonic()>=deadline:raise RuntimeError('STRICT_TLS_ROUTE_READINESS_FAILED')
  time.sleep(1)
def unchanged(after):
 for prior,current in zip(before,after):
  if prior['Name']!='/hp-capstone-control-ingress-1':
   assert prior['Id']==current['Id'] and prior['Image']==current['Image']
  assert not runtime_differences(prior,current)
  assert current['State']['Running']
 assert after[0]['State']['Health']['Status']=='healthy'
 assert after[2]['State']['Health']['Status']=='healthy'
try:
 before=inventory()
 assert all(i['Image']==CURRENT and i['State']['Running'] for i in before[:2])
 assert before[0]['State']['Health']['Status']=='healthy' and before[2]['Image']==PG
 stage,files=validated_patient_context(before[0]['Config']['Labels'])
 assert validated_patient_context(before[1]['Config']['Labels'])==(stage,files)
 runtime=dict(v.split('=',1) for v in before[0]['Config']['Env'])
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':CURRENT,'HIPASS_POSTGRES_IMAGE':PG,'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
 for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:env[key]=runtime[key]
 baseline=json.loads(run(compose(files)+['config','--format','json'],env=env))
 checks.append({'test':'BASELINE_STRICT_TLS_BLOCK_REPRODUCED','status':'PASS','response':probe((403,'METADATA_ROUTE_REQUIRED'))})
 phase='OVERLAY'
 overlay=stage+'/patient-ingress-reviewed-20261010.yml'
 content='services:\n  ingress:\n    image: '+CANDIDATE+'\n'
 target=pathlib.Path(overlay)
 if target.exists():assert target.is_file() and not target.is_symlink() and target.read_text()==content
 else:
  with target.open('x') as stream:stream.write(content)
  target.chmod(0o600)
 candidate_files=files+[overlay]
 candidate=json.loads(run(compose(candidate_files)+['config','--format','json'],env=env))
 assert_ingress_only_config(baseline,candidate)
 checks.append({'test':'EXACT_INGRESS_ONLY_RENDERED_CHANGE','status':'PASS'})
 phase='ACTIVATION';attempted=True
 run(compose(candidate_files)+['up','-d','--no-deps','--pull','never','--force-recreate','ingress'],env=env)
 after=inventory();assert after[1]['Image']==CANDIDATE;unchanged(after)
 # Invalid input must reach patient authorization, not succeed or bypass policy.
 response=probe((400,'PATIENT_DATA_PLANE_REQUEST_INVALID'))
 checks.append({'test':'CANDIDATE_TLS_ROUTE_AND_UNCHANGED_CONTROL_PG','status':'PASS','response':response})
 phase='ROLLBACK'
 run(compose(files)+['up','-d','--no-deps','--pull','never','--force-recreate','ingress'],env=env)
 restored=inventory();assert restored[1]['Image']==CURRENT;unchanged(restored)
 assert validated_patient_context(restored[1]['Config']['Labels'])==(stage,files)
 response=probe((403,'METADATA_ROUTE_REQUIRED'));rollback='PASS'
 checks.append({'test':'ACTUAL_OLD_IMAGE_CONFIG_AND_TLS_ROLLBACK','status':'PASS','response':response})
 phase='REACTIVATION'
 run(compose(candidate_files)+['up','-d','--no-deps','--pull','never','--force-recreate','ingress'],env=env)
 final=inventory();assert final[1]['Image']==CANDIDATE;unchanged(final)
 response=probe((400,'PATIENT_DATA_PLANE_REQUEST_INVALID'))
 checks.append({'test':'REACTIVATION_TLS_ROUTE','status':'PASS','response':response})
 print(json.dumps({'status':'PASS','checks':checks,'rollback':rollback,'imageId':CANDIDATE,'controlImageId':CURRENT,'pgImageId':PG,'overlay':overlay,'unchangedControlPgContainerIdentity':True,'scope':'ACTUAL_INGRESS_ACTIVATION_ROLLBACK_INVALID_INPUT_ROUTE_NOT_PUBLIC_PIXEL_E2E'}))
except Exception as error:
 if attempted:
  try:
   run(compose(files)+['up','-d','--no-deps','--pull','never','--force-recreate','ingress'],env=env)
   restored=inventory();assert restored[1]['Image']==CURRENT;unchanged(restored);probe((403,'METADATA_ROUTE_REQUIRED'));rollback='PASS'
  except Exception:rollback='FAIL'
 print(json.dumps({'status':'FAIL','phase':phase,'reason':type(error).__name__,'checks':checks,'rollback':rollback}));raise SystemExit(2)
''')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Explicit reviewed activation with rollback rehearsal')
    args = parser.parse_args()
    if not args.apply:
        reviewed_candidate()
        return plan.main()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = ROOT / 'artifacts/workstation' / ('patient-ingress-rollout-' + stamp)
    directory.mkdir(parents=True)
    client = paramiko.SSHClient()
    result = {'status': 'NOT VERIFIED'}
    started = time.monotonic()
    try:
        reviewed_candidate()
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity / 'known_hosts'))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'), look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        code, output = gateway.base.ops.run(client, 'sudo -n timeout 45s python3 -c ' + shlex.quote(plan.remote_program()), seconds=50)
        if code or json.loads(output).get('status') != 'PASS':
            raise ValueError('ACTUAL_BASELINE_PREFLIGHT_FAILED')
        print(json.dumps({'phase': 'REVIEW_AND_ACTUAL_BASELINE', 'status': 'PASS'}), flush=True)
        archive = directory / 'reviewed-ingress.tar'
        subprocess.run(['docker', 'save', '-o', str(archive), plan.CANDIDATE], check=True, capture_output=True, timeout=180)
        with archive.open('rb') as stream:
            digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        remote = '/home/highpassadmin/.highpass-ingress-' + stamp
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(15)
            sftp.mkdir(remote, mode=0o700)
            transfer_started = time.monotonic()
            def deadline(done, total):
                if time.monotonic() - transfer_started > 180:
                    raise TimeoutError('TRANSFER_DEADLINE')
            sftp.put(str(archive), remote + '/reviewed-ingress.tar', callback=deadline)
        code, output = gateway.base.ops.run(client, 'sha256sum ' + shlex.quote(remote + '/reviewed-ingress.tar'), seconds=15)
        if code or output.split()[0] != digest:
            raise ValueError('TRANSFER_HASH_MISMATCH')
        code, output = gateway.base.ops.run(client, 'sudo -n timeout 60s docker load -i ' + shlex.quote(remote + '/reviewed-ingress.tar'), seconds=65)
        if code:
            raise ValueError('IMAGE_LOAD_FAILED')
        code, output = gateway.base.ops.run(client, 'sudo -n timeout 10s docker image inspect ' + plan.CANDIDATE + " --format '{{.Id}}'", seconds=15)
        if code or output.strip() != plan.CANDIDATE:
            raise ValueError('LOADED_IMAGE_MISMATCH')
        print(json.dumps({'phase': 'EXACT_IMAGE_TRANSFER', 'status': 'PASS'}), flush=True)
        ca = (ROOT / 'tmp/certs/mtls/ca.crt').read_text()
        code, output = gateway.base.ops.run(client, 'sudo -n timeout 240s python3 -c ' + shlex.quote(promotion_program(ca)), seconds=245)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':
            result = {'status': 'NOT VERIFIED', 'reason': 'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status': 'NOT VERIFIED', 'reason': type(error).__name__}
    finally:
        client.close()
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'elapsedSeconds': round(time.monotonic()-started, 3), 'review': 'DRAFT / UNASSIGNED'})
    (directory / 'result.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'result': str(directory / 'result.json'), **result}), flush=True)
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    sys.exit(main())
