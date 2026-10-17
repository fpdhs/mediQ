"""Read-only B candidate-active image/config plan; no deploy or secret copy."""
import getpass
import importlib.util
import json
import pathlib
import shlex
import sys
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
CANDIDATE = 'sha256:27e1bd82f401d9a1753954055f48c3397b7718721b37dcccab09b9c9ae75fe1a'


def main():
    spec = importlib.util.spec_from_file_location('edge', ROOT / 'scripts/capstone-patient-edge-rollout.py')
    edge = importlib.util.module_from_spec(spec);spec.loader.exec_module(edge)
    directory = ROOT / 'artifacts/workstation' / ('patient-focus-b-preflight-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True)
    credential = getpass.getpass('VM credential (concealed): ')
    trust = None
    client = paramiko.SSHClient()
    try:
        trust = edge.ops.LocalVmTrust()
        key = trust.key('B', credential, directory / 'B-public-host.key')
        address, mac, _ = edge.ops.ROLES['B']
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        program = 'BASE=' + repr(BASE) + '\nCANDIDATE=' + repr(CANDIDATE) + '\nMAC=' + repr(mac) + '\n' + r'''
import subprocess,json,os,pathlib,copy,hashlib,re
phase='HOST_RUNTIME'
try:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 item=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1'],timeout=10))[0]
 assert item['Image']==BASE and item['State']['Running'] and item['State']['Health']['Status']=='healthy'
 labels=item['Config']['Labels'];stage=labels['com.docker.compose.project.working_dir'];files=labels['com.docker.compose.project.config_files'].split(',')
 assert labels['com.docker.compose.project']=='hp-capstone-b-portal' and re.fullmatch(r'/home/server/.highpass-app-[0-9T.+-]{20,60}',stage)
 assert files==[stage+'/'+name for name in ['portal.yml','encryption.yml','patient.yml']]
 phase='COMPOSE_RENDER'
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':BASE,'HIPASS_B_PORTAL_SECRET_DIR':'/opt/highpass/capstone-b-portal-secrets','HIPASS_KEY_RELEASE_VAULT_KEY_ID':'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/9c03b2560a3240418d33d92a165b6806'}
 cmd=['docker','compose','--project-directory',stage,'-p','hp-capstone-b-portal']
 for f in files:cmd.extend(['-f',f])
 value=subprocess.run(cmd+['config','--format','json'],env=env,capture_output=True,timeout=15)
 assert value.returncode==0
 config=json.loads(value.stdout);cfg=config['services']['portal'];assert cfg['image']==BASE
 actual=dict(v.split('=',1) for v in item['Config']['Env'])
 assert all(actual.get(k)==str(v) for k,v in cfg['environment'].items())
 expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg.get('volumes',[]) if v['type']=='bind')
 observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in item['Mounts'] if v['Type']=='bind')
 assert expected==observed
 candidate=copy.deepcopy(config);candidate['services']['portal']['image']=CANDIDATE
 restored=copy.deepcopy(candidate);restored['services']['portal']['image']=BASE;assert restored==config
 print(json.dumps({'status':'PASS','scope':'ACTUAL_B_READ_ONLY_RUNTIME_COMPOSE_PLAN_NOT_ACTIVATION_ROLLBACK_OR_FIXED_BROWSER',
  'project':'hp-capstone-b-portal','workingDirectory':stage,'baselineFiles':files,'baselineImage':BASE,'candidateImage':CANDIDATE,
  'runtimeEnvironmentAndMountsMatch':True,'nonImageConfigDifferences':0,'changedField':'services.portal.image',
  'baselineConfigSha256':hashlib.sha256(json.dumps(config,sort_keys=True).encode()).hexdigest(),
  'containerId':item['Id'],'deployment':'NOT EXECUTED','review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 print(json.dumps({'status':'NOT VERIFIED','phase':phase,'reason':type(error).__name__}));raise SystemExit(2)
'''
        code, output = edge.ops.run(client, "sudo -S -p '' timeout 35s python3 -c " + shlex.quote(program), credential=credential, seconds=40)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:
        client.close()
        if trust:trust.close()
        credential = None
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'review':'DRAFT / UNASSIGNED'})
    path=directory / 'result.json';path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(path),**result}),flush=True)
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    sys.exit(main())
