"""Read-only candidate-active ingress plan. Never upload, load, or deploy."""
import copy
import importlib.util
import json
import os
import pathlib
import re
import shlex
import sys
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
CURRENT = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
CANDIDATE = 'sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb'
PG = 'sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568'
FILES = ['control.yml', 'ingress.yml', 'mock.yml', 'key-release.yml', 'phantom-catalog.yml', 'patient.yml']


def validated_patient_context(labels):
    stage = labels.get('com.docker.compose.project.working_dir', '')
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    if labels.get('com.docker.compose.project') != 'hp-capstone-control' or not re.fullmatch(r'/home/highpassadmin/\.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('PATIENT_COMPOSE_DIRECTORY_INVALID')
    if files != [stage + '/' + name for name in FILES]:
        raise ValueError('PATIENT_COMPOSE_FILES_INVALID')
    return stage, files


def assert_ingress_only_config(baseline, candidate):
    if baseline['services']['ingress']['image'] != CURRENT or candidate['services']['ingress']['image'] != CANDIDATE:
        raise ValueError('EXACT_INGRESS_IMAGES_REQUIRED')
    normalized = copy.deepcopy(candidate)
    normalized['services']['ingress']['image'] = CURRENT
    if normalized != baseline:
        raise ValueError('NON_INGRESS_IMAGE_CHANGE')


def remote_program():
    # Public deployment configuration only. Secret values never leave the VM.
    import inspect
    return ('import subprocess,json,os,copy,hashlib,re\n'
            + 'FILES=' + repr(FILES) + '\n'
            + inspect.getsource(validated_patient_context) + '\n'
            + inspect.getsource(assert_ingress_only_config) + '\n'
            + 'CURRENT=' + repr(CURRENT) + '\nCANDIDATE=' + repr(CANDIDATE)
            + '\nPG=' + repr(PG) + '\n' + r'''
phase='RUNTIME'
try:
 items=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1'],timeout=10))
 assert all(i['Image']==CURRENT and i['State']['Running'] for i in items[:2])
 assert items[0]['State']['Health']['Status']=='healthy'
 assert items[2]['Image']==PG and items[2]['State']['Health']['Status']=='healthy'
 stage,files=validated_patient_context(items[0]['Config']['Labels'])
 assert validated_patient_context(items[1]['Config']['Labels'])==(stage,files)
 phase='RENDER_ENVIRONMENT'
 runtime=dict(v.split('=',1) for v in items[0]['Config']['Env'])
 # Do not copy runtime authentication secrets into subprocess environment.
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':CURRENT,'HIPASS_POSTGRES_IMAGE':PG,
      'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets',
      'HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
 for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:
  env[key]=runtime[key]
  assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',env[key])
 cmd=['docker','compose','--project-directory',stage,'-p','hp-capstone-control']
 for path in files:cmd.extend(['-f',path])
 phase='COMPOSE_RENDER'
 result=subprocess.run(cmd+['config','--format','json'],env=env,capture_output=True,timeout=20)
 if result.returncode:
  print(json.dumps({'status':'NOT VERIFIED','phase':phase,'exitCode':result.returncode,'reason':'COMPOSE_RENDER_FAILED'}));raise SystemExit(2)
 baseline=json.loads(result.stdout)
 phase='RUNTIME_CONFIG_ALIGNMENT'
 for name,item in zip(['control','ingress'],items[:2]):
  configured=baseline['services'][name]
  assert configured['image']==CURRENT
  actual=dict(v.split('=',1) for v in item['Config']['Env'])
  assert all(str(actual.get(k))==str(v) for k,v in configured.get('environment',{}).items())
  expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in configured.get('volumes',[]) if v['type']=='bind')
  observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in item['Mounts'] if v['Type']=='bind')
  assert expected==observed
 phase='INGRESS_ONLY_PLAN'
 candidate=copy.deepcopy(baseline);candidate['services']['ingress']['image']=CANDIDATE
 assert_ingress_only_config(baseline,candidate)
 print(json.dumps({'status':'PASS','scope':'READ_ONLY_RUNTIME_AND_RENDERED_CONFIG_PLAN_NOT_DEPLOYMENT_OR_ROLLBACK',
  'candidateImage':CANDIDATE,'rollbackImage':CURRENT,'changedField':'services.ingress.image',
  'unchangedServices':sorted(n for n in baseline['services'] if n!='ingress'),
  'nonImageConfigDifferences':0,'runtimeEnvironmentAndBindMountsMatch':True,
  'baselineConfigSha256':hashlib.sha256(json.dumps(baseline,sort_keys=True).encode()).hexdigest(),
  'ingressDockerHealth':'NOT CONFIGURED','deployment':'NOT EXECUTED','review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 print(json.dumps({'status':'NOT VERIFIED','phase':phase,'reason':type(error).__name__}));raise SystemExit(2)
''')


def main():
    import paramiko
    spec = importlib.util.spec_from_file_location('gateway', ROOT / 'scripts/capstone-a-gateway-ops.py')
    gateway = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gateway)
    client = paramiko.SSHClient()
    result = {'status': 'NOT VERIFIED', 'review': 'DRAFT / UNASSIGNED'}
    try:
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity / 'known_hosts'))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'), look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        code, output = gateway.base.ops.run(client, 'sudo -n timeout 45s python3 -c ' + shlex.quote(remote_program()), seconds=50)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':
            result = {'status': 'NOT VERIFIED', 'reason': 'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status': 'NOT VERIFIED', 'reason': type(error).__name__}
    finally:
        client.close()
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'review': 'DRAFT / UNASSIGNED'})
    directory = ROOT / 'artifacts/workstation'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / ('patient-ingress-plan-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'result': str(path), **result}))
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    sys.exit(main())
