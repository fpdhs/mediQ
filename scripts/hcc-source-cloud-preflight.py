"""Read-only exact cloud Compose delta; never installs images or activates services."""
import argparse
import importlib.util
import inspect
import json
import os
import pathlib
import shlex
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('source_plan', ROOT / 'scripts/lib/hcc_source_deployment.py')
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)


def remote_program(control, ingress, source_upgrade=False):
    return ('import subprocess,json,os,pathlib,hashlib,copy,re,stat\n'
            + '\n'.join(name + '=' + repr(getattr(plan, name)) for name in
                        ['CONTROL_BASE', 'INGRESS_BASE', 'SECRET_SOURCE', 'SECRET_TARGET', 'NAMES',
                         'A_SOURCE_BASE','CONTROL_SOURCE_BASE','SOURCE_INGRESS','SOURCE_OVERLAY','A_SECRET','A_MANIFEST'])
            + '\nCONTROL=' + repr(control) + '\nINGRESS=' + repr(ingress) + '\nSOURCE_UPGRADE='+repr(source_upgrade)+'\n'
            + inspect.getsource(plan.source_image_upgrade_config)+'\n'
            + inspect.getsource(plan.context) + '\n' + inspect.getsource(plan.source_only_config) + '\n' + r'''
phase='BASELINE'
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=20,**kw)
 if result.returncode:raise RuntimeError('READ_ONLY_COMMAND_FAILED')
 return result.stdout
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def runtime_identity(item):
 return {k:item[k] for k in ['Id','Image','Config','Mounts','HostConfig','NetworkSettings']}|{
 'running':item['State']['Running'],'startedAt':item['State']['StartedAt'],
 'health':item['State'].get('Health',{}).get('Status')}
try:
 assert run(['hostname']).decode().strip()=='highpass-cloud'
 names=['hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
 items=json.loads(run(['docker','inspect',*names]));a,b,pg=items
 active_base=CONTROL_SOURCE_BASE if SOURCE_UPGRADE else CONTROL_BASE
 active_ingress=SOURCE_INGRESS if SOURCE_UPGRADE else INGRESS_BASE
 assert a['Image']==active_base and b['Image']==active_ingress
 if SOURCE_UPGRADE:assert INGRESS==active_ingress
 assert all(i['State']['Running'] for i in items)
 assert all(i['State'].get('Health',{}).get('Status')=='healthy' for i in [a,pg])
 assert pg['Image']=='sha256:8d0e686f1620c154c0c35ba8c7173a90f8f1a55ff8062f75677be1f3a4196568'
 stage,files=context(a['Config']['Labels'],source_enabled=SOURCE_UPGRADE)
 ingress_stage,ingress_files=context(b['Config']['Labels'],ingress=True,source_enabled=SOURCE_UPGRADE)
 assert stage==ingress_stage and (files if SOURCE_UPGRADE else files[:-1])==ingress_files
 for image in [active_base,active_ingress]:assert json.loads(run(['docker','image','inspect',image]))[0]['Id']==image
 runtime=dict(value.split('=',1) for value in a['Config']['Env'])
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':CONTROL_BASE,'HIPASS_POSTGRES_IMAGE':pg['Image'],
 'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
 for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:
  env[key]=runtime[key]
  assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',env[key])
 command=['docker','compose','--project-directory',stage,'-p','hp-capstone-control']
 for path in files:command+=['-f',path]
 phase='BASELINE_RENDER'
 baseline=json.loads(run(command+['config','--format','json'],env=env))
 for name,item in [('control',a),('ingress',b)]:
  cfg=baseline['services'][name];assert cfg['image']==item['Image']
  actual=dict(value.split('=',1) for value in item['Config']['Env'])
  assert all(actual.get(k)==str(v) for k,v in cfg.get('environment',{}).items())
  expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg.get('volumes',[]) if v['type']=='bind')
  observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in item['Mounts'] if v['Type']=='bind')
  assert expected==observed
 phase='SOURCE_ONLY_RENDER'
 overlay={'services':{'control':{'image':CONTROL,'environment':{'HIPASS_CAPSTONE_HCC_CATALOG':'1',
  'HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE':SECRET_TARGET},'volumes':[{'type':'bind','source':SECRET_SOURCE,
  'target':SECRET_TARGET,'read_only':True,'bind':{'create_host_path':False}}]},'ingress':{'image':INGRESS}}}
 if SOURCE_UPGRADE:overlay={'services':{'control':{'image':CONTROL}}}
 candidate=json.loads(run(command+['-f','-','config','--format','json'],env=env,input=json.dumps(overlay).encode()))
 if SOURCE_UPGRADE:source_image_upgrade_config(baseline,candidate,'control',CONTROL)
 else:source_only_config(baseline,candidate,CONTROL,INGRESS)
 after=json.loads(run(['docker','inspect',*names]))
 assert digest([runtime_identity(i) for i in after])==digest([runtime_identity(i) for i in items])
 secret=pathlib.Path(SECRET_SOURCE)
 credential={'exists':secret.exists(),'contentsRead':False}
 if secret.exists():
  info=secret.lstat();credential.update({'regularFile':stat.S_ISREG(info.st_mode),
  'mode':oct(stat.S_IMODE(info.st_mode)),'ownerUid':info.st_uid,'groupGid':info.st_gid})
 print(json.dumps({'status':'PASS','scope':'READ_ONLY_CLOUD_RENDER_NOT_DEPLOYMENT_OR_TLS_E2E',
 'baselineImage':active_base,'baselineIngress':active_ingress,'candidateControl':CONTROL,'candidateIngress':INGRESS,
 'sourceUpgrade':SOURCE_UPGRADE,'imageOnlyDelta':SOURCE_UPGRADE,
 'baselineConfigSha256':digest(baseline),'candidateConfigSha256':digest(candidate),
 'composeFileHashes':[{'path':p,'sha256':hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()} for p in files],
 'runtimeEnvironmentAndBindMountsMatch':True,'sourceOnlyConfigDelta':True,'rollbackImagesAvailable':True,
 'containersUnchanged':True,'controlId':a['Id'],'protectedIngressId':b['Id'],
 'protectedPostgresId':pg['Id'],'credentialFileMetadata':credential,
 'deployment':'NOT EXECUTED','rollback':'NOT VERIFIED','review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 print(json.dumps({'status':'NOT VERIFIED','phase':phase,'reason':type(error).__name__}));raise SystemExit(2)
''')


def main():
    import paramiko
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate-manifest', type=pathlib.Path, required=True)
    parser.add_argument('--upgrade-active-source',action='store_true',help='Read-only Control image-only render against the active source v02 baseline')
    args = parser.parse_args()
    manifest_path = args.candidate_manifest.resolve()
    if not manifest_path.is_relative_to(ROOT / 'artifacts/workstation'):
        raise ValueError('LOCAL_CANDIDATE_MANIFEST_REQUIRED')
    manifest = json.loads(manifest_path.read_text(encoding='utf8'))
    assert manifest['status'] == 'PASS' and len(manifest['images']) == 3
    rows = {row['role']: row for row in manifest['images']}
    assert set(rows) == {'control', 'a', 'ingress'}
    for role in ['control', 'ingress']:
        assert rows[role]['sourceMatch'] == 'PASS'
        assert rows[role]['base'] == getattr(plan, role.upper() + '_BASE')
        assert plan.re.fullmatch(r'sha256:[a-f0-9]{64}', rows[role]['id'])
    directory = ROOT / 'artifacts/workstation' / ('hcc-source-cloud-preflight-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True, exist_ok=False)
    client = paramiko.SSHClient()
    try:
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity / 'known_hosts'))
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'),
                       look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        program = remote_program(rows['control']['id'], rows['ingress']['id'],args.upgrade_active_source)
        spec = importlib.util.spec_from_file_location('source_ops', ROOT / 'scripts/workstation-automatic-ops.py')
        ops = importlib.util.module_from_spec(spec); spec.loader.exec_module(ops)
        code, output = ops.run(client, 'sudo -n timeout 90s python3 -c ' + shlex.quote(program), seconds=95)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':result = {'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:
        client.close()
    result['observedAt'] = datetime.now(timezone.utc).isoformat()
    result['candidateManifestSha256'] = __import__('hashlib').sha256(manifest_path.read_bytes()).hexdigest()
    path = directory / 'result.json'
    path.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'evidence':str(path), **result}), flush=True)
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':raise SystemExit(main())
