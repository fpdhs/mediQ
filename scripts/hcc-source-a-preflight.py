"""Strict pinned VM trust and read-only A source-proof deployment render."""
import argparse
import getpass
import hashlib
import importlib.util
import inspect
import json
import pathlib
import shlex
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('a_source_plan',ROOT/'scripts/lib/hcc_source_deployment.py')
plan=importlib.util.module_from_spec(spec);spec.loader.exec_module(plan)


def remote_program(image, mac, source_upgrade=False):
    return ('import subprocess,json,pathlib,os,copy,re,hashlib,stat\n'
            + '\n'.join(k+'='+repr(getattr(plan,k)) for k in ['A_BASE','A_SECRET','A_MANIFEST','A_SOURCE_BASE',
                'CONTROL_SOURCE_BASE','SOURCE_INGRESS','SOURCE_OVERLAY','SECRET_SOURCE','SECRET_TARGET'])
            + '\nIMAGE='+repr(image)+'\nMAC='+repr(mac)+'\nSOURCE_UPGRADE='+repr(source_upgrade)+'\n'
            + inspect.getsource(plan.source_image_upgrade_config)+'\n'
            + inspect.getsource(plan.a_context)+'\n'+inspect.getsource(plan.a_source_only_config)+'\n'+r'''
phase='BASELINE'
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=20,**kw)
 if result.returncode:raise RuntimeError('BOUNDED_READ_ONLY_COMMAND_FAILED')
 return result.stdout
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
def identity(item):
 return {k:item[k] for k in ['Id','Image','Config','Mounts','HostConfig']}|{
 'running':item['State']['Running'],'health':item['State'].get('Health',{}).get('Status')}
def metadata(name):
 path=pathlib.Path(name)
 if not path.exists():return {'exists':False,'contentsRead':False}
 info=path.lstat()
 return {'exists':True,'regularFile':stat.S_ISREG(info.st_mode),'ownerUid':info.st_uid,'groupGid':info.st_gid,
 'mode':oct(stat.S_IMODE(info.st_mode)),'contentsRead':False}
try:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 names=['hp-capstone-a-gateway-gateway-1','hp-capstone-hospital-a-orthanc-1','hp-capstone-hospital-a-orthanc-mtls-1']
 items=json.loads(run(['docker','inspect',*names]));gateway,pacs,proxy=items
 active_base=A_SOURCE_BASE if SOURCE_UPGRADE else A_BASE
 assert gateway['Image']==active_base and all(i['State']['Running'] and i['State']['Health']['Status']=='healthy' for i in items)
 assert pacs['Image']=='sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a'
 assert proxy['Image']=='sha256:853ed9b5269a6781eff54b29942f6368c9d14f6a36add88ebdb5dcc1b0744802'
 volumes=[v for v in pacs['Mounts'] if v['Type']=='volume']
 assert len(volumes)==1 and volumes[0]['Name']=='hp-capstone-hospital-a_hospital-a-data'
 assert json.loads(run(['docker','network','inspect','hp-capstone-hospital-a_pacs_private']))[0]['Internal'] is True
 stage,files=a_context(gateway['Config']['Labels'],source_enabled=SOURCE_UPGRADE)
 assert json.loads(run(['docker','image','inspect',active_base]))[0]['Id']==active_base
 env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':A_BASE,
 'HIPASS_A_GATEWAY_SECRET_DIR':'/opt/highpass/capstone-a-gateway-secrets'}
 runtime=dict(v.split('=',1) for v in gateway['Config']['Env'])
 env['HIPASS_KEY_RELEASE_VAULT_KEY_ID']=runtime['CAPSTONE_VAULT_KEY_ID']
 assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',env['HIPASS_KEY_RELEASE_VAULT_KEY_ID'])
 command=['docker','compose','--project-directory',stage,'-p','hp-capstone-a-gateway']
 for path in files:command+=['-f',path]
 phase='CURRENT_CONFIG'
 baseline=json.loads(run(command+['config','--format','json'],env=env))
 cfg=baseline['services']['gateway'];assert cfg['image']==gateway['Image']
 actual=dict(v.split('=',1) for v in gateway['Config']['Env'])
 assert all(actual.get(k)==str(v) for k,v in cfg.get('environment',{}).items())
 expected=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg.get('volumes',[]) if v['type']=='bind')
 observed=sorted((v['Source'],v['Destination'],not v['RW']) for v in gateway['Mounts'] if v['Type']=='bind')
 assert expected==observed
 phase='SOURCE_ONLY_DELTA'
 overlay={'services':{'gateway':{'image':IMAGE,'environment':{'HCC_SOURCE_SERVICE_TOKEN_FILE':'/run/secrets/hcc-source-secret',
 'HCC_SOURCE_MANIFEST_FILE':'/run/hcc-source/manifest.json'},'volumes':[
 {'type':'bind','source':A_SECRET,'target':'/run/secrets/hcc-source-secret','read_only':True,'bind':{'create_host_path':False}},
 {'type':'bind','source':A_MANIFEST,'target':'/run/hcc-source/manifest.json','read_only':True,'bind':{'create_host_path':False}}]}}}
 if SOURCE_UPGRADE:overlay={'services':{'gateway':{'image':IMAGE}}}
 candidate=json.loads(run(command+['-f','-','config','--format','json'],env=env,input=json.dumps(overlay).encode()))
 if SOURCE_UPGRADE:source_image_upgrade_config(baseline,candidate,'gateway',IMAGE)
 else:a_source_only_config(baseline,candidate,IMAGE)
 after=json.loads(run(['docker','inspect',*names]));assert [identity(i) for i in after]==[identity(i) for i in items]
 print(json.dumps({'status':'PASS','scope':'READ_ONLY_A_SOURCE_CONFIG_NOT_PACS_HASH_TLS_OR_ROLLOUT',
 'baselineImage':active_base,'candidateImage':IMAGE,'gatewayId':gateway['Id'],'protectedPacsId':pacs['Id'],'protectedProxyId':proxy['Id'],
 'sourceUpgrade':SOURCE_UPGRADE,'imageOnlyDelta':SOURCE_UPGRADE,
 'baselineConfigSha256':digest(baseline),'candidateConfigSha256':digest(candidate),
 'composeFileHashes':[{'path':p,'sha256':hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()} for p in files],
 'runtimeEnvironmentAndBindMountsMatch':True,'sourceOnlyConfigDelta':True,'rollbackImageAvailable':True,
 'pacsVolumePreserved':True,'containersUnchanged':True,'credentialFileMetadata':metadata(A_SECRET),
 'manifestFileMetadata':metadata(A_MANIFEST),'deployment':'NOT EXECUTED','review':'DRAFT / UNASSIGNED'}))
except Exception as error:
 print(json.dumps({'status':'NOT VERIFIED','phase':phase,'reason':type(error).__name__}));raise SystemExit(2)
''')


def main():
    import paramiko
    parser=argparse.ArgumentParser();parser.add_argument('--candidate-manifest',type=pathlib.Path,required=True)
    parser.add_argument('--transport-check',action='store_true')
    parser.add_argument('--upgrade-active-source',action='store_true',help='Read-only image-only render against the exact active source v02 baseline')
    args=parser.parse_args();path=args.candidate_manifest.resolve()
    if not path.is_relative_to(ROOT/'artifacts/workstation'):raise ValueError('LOCAL_CANDIDATE_MANIFEST_REQUIRED')
    manifest=json.loads(path.read_text(encoding='utf8'));assert manifest['status']=='PASS'
    rows=[v for v in manifest['images'] if v['role']=='a'];assert len(rows)==1
    row=rows[0];assert row['base']==plan.A_BASE and row['sourceMatch']=='PASS'
    assert plan.re.fullmatch(r'sha256:[a-f0-9]{64}',row['id'])
    directory=ROOT/'artifacts/workstation'/('hcc-source-a-preflight-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    spec=importlib.util.spec_from_file_location('a_source_ops',ROOT/'scripts/workstation-automatic-ops.py')
    ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
    credential=getpass.getpass('VM credential (concealed): ');client=paramiko.SSHClient();trust=None
    try:
        trust=ops.LocalVmTrust();key=trust.key('A',credential,directory/'A-public-host.key')
        address,mac,_=ops.ROLES['A'];client.get_host_keys().add(address,key.get_name(),key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,
                       timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        code,output=ops.run(client,"sudo -S -p '' timeout 90s python3 -c "+shlex.quote(remote_program(row['id'],mac,args.upgrade_active_source)),credential=credential,seconds=95)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
        if args.transport_check and result.get('status')=='PASS':
            spec=importlib.util.spec_from_file_location('a_source_transport',ROOT/'scripts/hcc-source-a-rollout.py')
            transport=importlib.util.module_from_spec(spec);spec.loader.exec_module(transport)
            code,output=ops.run(client,"sudo -S -p '' timeout 25s docker exec hp-capstone-a-gateway-gateway-1 /nodejs/bin/node --input-type=module -e "+shlex.quote(transport.TRANSPORT),credential=credential,seconds=30)
            if code:
                result.update({'status':'NOT VERIFIED','transport':'NOT VERIFIED','reason':'STRICT_TRANSPORT_NOT_COMPLETED'})
            else:
                observed=json.loads(output)
                if observed.get('status')!='PASS':raise ValueError('TRANSPORT_RESPONSE_INVALID')
                result['transport']=observed
    except Exception as error:result={'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:
        client.close()
        if trust:trust.close()
        credential=None
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'candidateManifestSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    receipt=directory/'result.json';receipt.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(receipt),**result}),flush=True)
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
