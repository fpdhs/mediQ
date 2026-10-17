"""Read-only role-pinned FAQ/expiry Compose and rollback prerequisites. No deployment."""
import argparse
import getpass
import importlib.util
import inspect
import json
import os
import pathlib
import re
import shlex
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
UI_BASE = 'sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a'
CONTROL_BASE = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
UI = 'sha256:dcc15c29e5344265a74908a41d33c48fe5ca5ceb06057107d4a9098c20b340b1'
CONTROL = 'sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b'
INGRESS = 'sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb'
PG = 'sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568'


def context(role, labels, ingress=False):
    project = 'hp-capstone-b-portal' if role == 'B' else 'hp-capstone-control'
    user = 'server' if role == 'B' else 'highpassadmin'
    names = ['portal.yml', 'encryption.yml', 'patient.yml'] if role == 'B' else [
        'control.yml', 'ingress.yml', 'mock.yml', 'key-release.yml',
        'phantom-catalog.yml', 'patient.yml']
    if role == 'CLOUD' and ingress:
        names += ['patient-ingress-reviewed-20261010.yml']
    stage = labels.get('com.docker.compose.project.working_dir', '')
    files = labels.get('com.docker.compose.project.config_files', '').split(',')
    if role not in ['B', 'CLOUD'] or labels.get('com.docker.compose.project') != project or not re.fullmatch(
            '/home/' + user + r'/\.highpass-app-[0-9T.+-]{20,60}', stage):
        raise ValueError('EXACT_ROLE_CONTEXT_REQUIRED')
    if files != [stage + '/' + name for name in names]:
        raise ValueError('EXACT_CURRENT_FILE_LIST_REQUIRED')
    return project, stage, files


def image_only(role, baseline, candidate):
    import copy
    service, old, new = ('portal', UI_BASE, UI) if role == 'B' else ('control', CONTROL_BASE, CONTROL)
    if role not in ['B', 'CLOUD'] or baseline['services'][service]['image'] != old or candidate['services'][service]['image'] != new:
        raise ValueError('EXACT_ROLE_IMAGE_PAIR_REQUIRED')
    normalized = copy.deepcopy(candidate)
    normalized['services'][service]['image'] = old
    if normalized != baseline:
        raise ValueError('NON_ROLE_IMAGE_CHANGE')


def remote_program(role, mac=None):
    return ('import subprocess,json,os,pathlib,hashlib,re\n'
            + 'ROLE=' + repr(role) + '\nMAC=' + repr(mac) + '\n'
            + '\n'.join(name + '=' + repr(globals()[name]) for name in ['UI_BASE', 'CONTROL_BASE', 'UI', 'CONTROL', 'INGRESS', 'PG']) + '\n'
            + inspect.getsource(context) + '\n' + inspect.getsource(image_only) + '\n' + r'''
phase='BASELINE'
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=20,**kw)
 if result.returncode:raise RuntimeError('BOUNDED_READ_ONLY_COMMAND_FAILED')
 return result.stdout
try:
 if ROLE=='B':assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 else:assert run(['hostname']).decode().strip()=='highpass-cloud'
 service='portal' if ROLE=='B' else 'control'
 project='hp-capstone-b-portal' if ROLE=='B' else 'hp-capstone-control'
 base=UI_BASE if ROLE=='B' else CONTROL_BASE
 new=UI if ROLE=='B' else CONTROL
 names=[project+'-'+service+'-1']
 if ROLE=='CLOUD':names+=['hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
 items=json.loads(run(['docker','inspect',*names]));before=items[0]
 assert before['Image']==base and before['State']['Running'] and before['State']['Health']['Status']=='healthy'
 project,stage,files=context(ROLE,before['Config']['Labels']);control_files=list(files)
 assert json.loads(run(['docker','image','inspect',base]))[0]['Id']==base
 if ROLE=='CLOUD':
  assert items[1]['Image']==INGRESS and items[1]['State']['Running']
  ingress_project,ingress_stage,ingress_files=context(ROLE,items[1]['Config']['Labels'],ingress=True)
  assert (ingress_project,ingress_stage)==(project,stage) and ingress_files[:-1]==files
  # Control retained its six-file creation labels; rendering seven files preserves active ingress.
  files=ingress_files
  assert items[2]['Image']==PG and items[2]['State']['Health']['Status']=='healthy'
 phase='CURRENT_COMPOSE'
 runtime=dict(value.split('=',1) for value in before['Config']['Env'])
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':base}
 if ROLE=='B':env['HIPASS_B_PORTAL_SECRET_DIR']='/opt/highpass/capstone-b-portal-secrets'
 else:env.update({'HIPASS_POSTGRES_IMAGE':PG,'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'})
 keys=['HIPASS_KEY_RELEASE_VAULT_KEY_ID']+(['HIPASS_PATIENT_KEY_VAULT_KEY_ID'] if ROLE=='CLOUD' else [])
 for key in keys:
  # B's protected Portal is a client, not a key-release service; Compose still needs this public input.
  env[key]=runtime[key] if ROLE=='CLOUD' else 'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/9c03b2560a3240418d33d92a165b6806'
  assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',env[key])
 command=['docker','compose','--project-directory',stage,'-p',project]
 for path in files:command+=['-f',path]
 baseline=json.loads(run(command+['config','--format','json'],env=env))
 for name,item in zip([service,'ingress'] if ROLE=='CLOUD' else [service],items):
  cfg=baseline['services'][name];assert cfg['image']==item['Image']
  actual=dict(value.split('=',1) for value in item['Config']['Env'])
  assert all(actual.get(key)==str(value) for key,value in cfg.get('environment',{}).items())
  expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg.get('volumes',[]) if v['type']=='bind')
  observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in item['Mounts'] if v['Type']=='bind')
  assert expected==observed
 phase='CANDIDATE_OVERLAY_RENDER'
 # JSON is valid YAML; stdin overlay is rendered only, never persisted or applied.
 overlay=json.dumps({'services':{service:{'image':new}}}).encode()
 candidate=json.loads(run(command+['-f','-','config','--format','json'],env=env,input=overlay))
 image_only(ROLE,baseline,candidate)
 digest=lambda value:hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
 print(json.dumps({'status':'PASS','role':ROLE,'project':project,'workingDirectory':stage,'files':files,
  'baselineImage':base,'candidateImage':new,'containerId':before['Id'],'originalTargetFiles':control_files,
  'baselineConfigSha256':digest(baseline),'candidateConfigSha256':digest(candidate),
  'composeFileHashes':[{'path':path,'sha256':hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()} for path in files],
  'changedField':'services.'+service+'.image','nonImageConfigDifferences':0,
  'runtimeEnvironmentAndBindMountsMatch':True,'rollbackImageAvailable':True,
  'protectedContainers':[{'name':i['Name'],'image':i['Image'],'id':i['Id']} for i in items[1:]],
  'scope':'READ_ONLY_ACTUAL_CONFIG_AND_ROLLBACK_PREREQUISITES_NOT_DEPLOYMENT_TLS_OR_ROLLBACK',
  'deployment':'NOT EXECUTED','rollback':'NOT VERIFIED','review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 print(json.dumps({'status':'NOT VERIFIED','role':ROLE,'phase':phase,'reason':type(error).__name__}));raise SystemExit(2)
''')


def main():
    import paramiko
    parser = argparse.ArgumentParser()
    parser.add_argument('--role', choices=['B', 'CLOUD'], required=True)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('faq_preflight_ops', ROOT/'scripts/workstation-automatic-ops.py')
    ops = importlib.util.module_from_spec(spec); spec.loader.exec_module(ops)
    directory = ROOT/'artifacts/workstation'/('faq-expiry-preflight-'+args.role.lower()+'-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True, exist_ok=False)
    client = paramiko.SSHClient(); trust = None; credential = None
    try:
        if args.role == 'CLOUD':
            identity = pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
            client.load_host_keys(str(identity/'known_hosts')); client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
            program = remote_program('CLOUD'); prefix = 'sudo -n '
        else:
            credential = getpass.getpass('VM credential (concealed): ')
            trust = ops.LocalVmTrust(); key = trust.key('B',credential,directory/'B-public-host.key')
            address,mac,_ = ops.ROLES['B']; client.get_host_keys().add(address,key.get_name(),key)
            client.set_missing_host_key_policy(paramiko.RejectPolicy())
            client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
            program = remote_program('B',mac); prefix = "sudo -S -p '' "
        code, output = ops.run(client,prefix+'timeout 75s python3 -c '+shlex.quote(program),credential=credential,seconds=80)
        result = json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:result={'status':'NOT VERIFIED','role':args.role,'reason':type(error).__name__}
    finally:
        client.close()
        if trust:trust.close()
        credential = None
    result['observedAt'] = datetime.now(timezone.utc).isoformat()
    path = directory/'result.json'; path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(path),**result}),flush=True)
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
