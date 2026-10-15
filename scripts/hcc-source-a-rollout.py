"""Reviewed A Gateway-only promotion with mandatory rollback; default read-only."""
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
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parent.parent


def load(name,path):
    spec=importlib.util.spec_from_file_location(name,ROOT/path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module


plan=load('a_rollout_config','scripts/lib/hcc_source_deployment.py')
guard=load('a_rollout_guard','scripts/lib/hcc_source_rollout.py')
MANIFEST='artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json'
TRANSPORT=r'''
import {readFileSync} from 'node:fs';
import {boundedHttps} from '/app/src/data-plane-gateway.js';
const ca=readFileSync('/run/secrets/ca.crt');
const cloud=await boundedHttps('https://10.90.88.1','/api/health',{tls:{ca},maxBytes:32768,timeoutMs:5000});
const health=JSON.parse(cloud.body);if(cloud.status!==200||health.status!=='UP'||health.database!=='UP')throw Error('CLOUD_UNAVAILABLE');
const local=await boundedHttps('https://10.90.88.2:9443','/dicomweb/studies',{tls:{ca},maxBytes:32768,timeoutMs:5000});
if(local.status!==401||JSON.parse(local.body).error!=='TOKEN_REQUIRED')throw Error('UNAUTHENTICATED_BOUNDARY_INVALID');
const pacs=await boundedHttps('https://orthanc-mtls:8443','/dicom-web/studies?StudyInstanceUID=2.25.259656708708993797343330994179169711072',{
headers:{accept:'application/dicom+json'},
tls:{ca,cert:readFileSync('/run/secrets/gateway-client.crt'),key:readFileSync('/run/secrets/gateway-client.key'),servername:'hospital-a-orthanc-mtls'},maxBytes:1048576,timeoutMs:5000});
const studies=JSON.parse(pacs.body);if(pacs.status!==200||studies.length!==1||studies[0]['0020000D']?.Value?.[0]!=='2.25.259656708708993797343330994179169711072')throw Error('FIXED_SOURCE_QIDO_UNAVAILABLE');
console.log(JSON.stringify({status:'PASS',scope:'STRICT_TLS_MTLS_FIXED_STUDY_METADATA_NOT_RAW_HASH_PROOF'}));
'''


def remote_program(expected,image,manifest_sha,mac,source_upgrade=False):
    return ('import subprocess,json,pathlib,os,hashlib,copy,re,stat,time\n'
            + '\n'.join(k+'='+repr(getattr(plan,k)) for k in ['A_BASE','A_SECRET','A_MANIFEST','A_SOURCE_BASE',
              'CONTROL_SOURCE_BASE','SOURCE_INGRESS','SOURCE_OVERLAY','SECRET_SOURCE','SECRET_TARGET'])
            + '\nEXPECTED='+repr(expected)+'\nIMAGE='+repr(image)+'\nMANIFEST_SHA='+repr(manifest_sha)
            + '\nMAC='+repr(mac)+'\nTRANSPORT='+repr(TRANSPORT)+'\nSOURCE_UPGRADE='+repr(source_upgrade)+'\n'
            + inspect.getsource(plan.source_image_upgrade_config)+'\n'
            + inspect.getsource(plan.a_context)+'\n'+inspect.getsource(plan.a_source_only_config)+'\n'
            + inspect.getsource(guard.promotion_sequence)+'\n'+r'''
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=45,**kw)
 if result.returncode:raise RuntimeError('BOUNDED_COMMAND_FAILED')
 return result.stdout
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
class Adapter:
 def inventory(self):return json.loads(run(['docker','inspect',*self.names]))
 def compose(self,files):
  args=['docker','compose','--project-directory',self.stage,'-p','hp-capstone-a-gateway']
  for path in files:args+=['-f',path]
  return args
 def preflight(self):
  assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
  self.names=['hp-capstone-a-gateway-gateway-1','hp-capstone-hospital-a-orthanc-1','hp-capstone-hospital-a-orthanc-mtls-1']
  self.before=self.inventory();a,pacs,proxy=self.before
  active_base=A_SOURCE_BASE if SOURCE_UPGRADE else A_BASE
  assert a['Id']==EXPECTED['gatewayId'] and a['Image']==active_base
  assert pacs['Id']==EXPECTED['protectedPacsId'] and proxy['Id']==EXPECTED['protectedProxyId']
  assert all(i['State']['Running'] and i['State']['Health']['Status']=='healthy' for i in self.before)
  self.stage,self.files=a_context(a['Config']['Labels'],source_enabled=SOURCE_UPGRADE)
  for entry in EXPECTED['composeFileHashes']:assert hashlib.sha256(pathlib.Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
  for image in [active_base,IMAGE]:assert json.loads(run(['docker','image','inspect',image]))[0]['Id']==image
  runtime=dict(v.split('=',1) for v in a['Config']['Env'])
  self.env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':A_BASE,
   'HIPASS_A_GATEWAY_SECRET_DIR':'/opt/highpass/capstone-a-gateway-secrets','HIPASS_KEY_RELEASE_VAULT_KEY_ID':runtime['CAPSTONE_VAULT_KEY_ID']}
  assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',self.env['HIPASS_KEY_RELEASE_VAULT_KEY_ID'])
  self.baseline=json.loads(run(self.compose(self.files)+['config','--format','json'],env=self.env))
  assert digest(self.baseline)==EXPECTED['baselineConfigSha256']
  for path in [A_SECRET,A_MANIFEST]:
   info=pathlib.Path(path).lstat();assert stat.S_ISREG(info.st_mode) and info.st_uid==0
   assert info.st_gid==65532 and stat.S_IMODE(info.st_mode)==0o440
  secret=pathlib.Path(A_SECRET).read_bytes().strip();assert re.fullmatch(rb'[A-Za-z0-9_-]{32,256}',secret)
  for name in ['data-plane-secret','patient-a-service-secret']:
   assert pathlib.Path(A_SECRET).with_name(name).read_bytes().strip()!=secret
  del secret
  assert pathlib.Path(A_MANIFEST).stat().st_size<4*1024*1024
  assert hashlib.sha256(pathlib.Path(A_MANIFEST).read_bytes()).hexdigest()==MANIFEST_SHA
  self.overlay=self.stage+('/hcc-source-upgrade-'+IMAGE.split(':')[1][:16]+'.yml' if SOURCE_UPGRADE else '/hcc-source-reviewed-20261010.yml')
  content=json.dumps({'services':{'gateway':{'image':IMAGE,'environment':{
   'HCC_SOURCE_SERVICE_TOKEN_FILE':'/run/secrets/hcc-source-secret','HCC_SOURCE_MANIFEST_FILE':'/run/hcc-source/manifest.json'},
   'volumes':[{'type':'bind','source':A_SECRET,'target':'/run/secrets/hcc-source-secret','read_only':True,'bind':{'create_host_path':False}},
   {'type':'bind','source':A_MANIFEST,'target':'/run/hcc-source/manifest.json','read_only':True,'bind':{'create_host_path':False}}]}}})+'\n'
  if SOURCE_UPGRADE:content=json.dumps({'services':{'gateway':{'image':IMAGE}}})+'\n'
  self.candidate=json.loads(run(self.compose(self.files)+['-f','-','config','--format','json'],env=self.env,input=content.encode()))
  if SOURCE_UPGRADE:source_image_upgrade_config(self.baseline,self.candidate,'gateway',IMAGE)
  else:a_source_only_config(self.baseline,self.candidate,IMAGE)
  assert digest(self.candidate)==EXPECTED['candidateConfigSha256']
  self.verify('baseline')
  target=pathlib.Path(self.overlay)
  if target.exists():assert target.is_file() and not target.is_symlink() and target.read_text()==content
  else:
   descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(descriptor,'w') as stream:stream.write(content)
 def activate(self,role,profile):
  assert role=='gateway'
  files=self.files+[self.overlay] if profile=='candidate' else self.files
  run(self.compose(files)+['up','-d','--no-deps','--pull','never','--force-recreate','gateway'],env=self.env)
 def verify(self,profile):
  cfg=self.candidate if profile=='candidate' else self.baseline;deadline=time.monotonic()+40
  while True:
   items=self.inventory();a=items[0];old=self.before[0]
   for item,prior in zip(items[1:],self.before[1:]):
    assert all(item[k]==prior[k] for k in ['Id','Image','Config','Mounts','HostConfig'])
    assert item['State']['Running'] and item['State']['Health']['Status']=='healthy'
   assert a['Image']==cfg['services']['gateway']['image'] and a['State']['Running']
   for key in ['Cmd','Entrypoint','User','WorkingDir']:assert a['Config'].get(key)==old['Config'].get(key)
   for key in ['PortBindings','ReadonlyRootfs','Privileged','CapAdd','CapDrop','SecurityOpt','NetworkMode','ExtraHosts']:
    assert a['HostConfig'].get(key)==old['HostConfig'].get(key)
   assert set(a['NetworkSettings']['Networks'])==set(old['NetworkSettings']['Networks'])
   wanted=dict(v.split('=',1) for v in old['Config']['Env'])
   if profile=='candidate':wanted.update({'HCC_SOURCE_SERVICE_TOKEN_FILE':'/run/secrets/hcc-source-secret','HCC_SOURCE_MANIFEST_FILE':'/run/hcc-source/manifest.json'})
   assert dict(v.split('=',1) for v in a['Config']['Env'])==wanted
   wanted=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg['services']['gateway'].get('volumes',[]) if v['type']=='bind')
   actual=sorted((v['Source'],v['Destination'],not v['RW']) for v in a['Mounts'] if v['Type']=='bind');assert wanted==actual
   selected=self.files+[self.overlay] if profile=='candidate' else self.files
   assert a['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==selected
   if a['State']['Health']['Status']=='healthy':
    value=json.loads(run(['docker','exec',self.names[0],'/nodejs/bin/node','--input-type=module','-e',TRANSPORT]))
    assert value['status']=='PASS';return
   if time.monotonic()>=deadline:raise RuntimeError('STRICT_READINESS_TIMEOUT')
   time.sleep(1)
result=promotion_sequence(Adapter(),roles=('gateway',))
result.update({'scope':'A_GATEWAY_ACTIVATION_ROLLBACK_TRANSPORT_NOT_700_RAW_HASH_REPORT_OR_BROWSER',
 'imageId':IMAGE,'sourceUpgrade':SOURCE_UPGRADE,'review':'DRAFT / UNASSIGNED'})
print(json.dumps(result));raise SystemExit(0 if result['status']=='PASS' else 2)
''')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--candidate-manifest',type=pathlib.Path,required=True)
    parser.add_argument('--preflight',type=pathlib.Path);parser.add_argument('--review',type=pathlib.Path)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--upgrade-active-source',action='store_true');args=parser.parse_args()
    if not args.apply:
        return subprocess.run([os.sys.executable,str(ROOT/'scripts/hcc-source-a-preflight.py'),
                               '--candidate-manifest',str(args.candidate_manifest)]+(['--upgrade-active-source'] if args.upgrade_active_source else []),timeout=180).returncode
    if not args.preflight or not args.review:raise ValueError('EXACT_A_REVIEW_AND_PREFLIGHT_REQUIRED')
    paths=[args.candidate_manifest.resolve(),args.preflight.resolve(),args.review.resolve()]
    if any(not p.is_relative_to(ROOT/'artifacts/workstation') for p in paths):raise ValueError('OWNED_ARTIFACTS_REQUIRED')
    manifest,expected,review=[json.loads(p.read_text(encoding='utf8')) for p in paths]
    assert manifest['status']=='PASS' and len(manifest['images'])==3
    candidates={row['role']:row['id'] for row in manifest['images']};assert set(candidates)=={'a','control','ingress'}
    a_image=next(row['image'] for row in manifest['images'] if row['role']=='a')
    scan=guard.candidate_scan_path('a',a_image)
    required=[p.relative_to(ROOT).as_posix() for p in paths[:2]]+[scan,MANIFEST,'scripts/hcc-source-a-rollout.py','scripts/hcc-source-a-preflight.py',
      'scripts/lib/hcc_source_rollout.py','scripts/lib/hcc_source_deployment.py','infra/workstation/hospital-a-hcc-source-verification.compose.yml']
    guard.validate_review(ROOT,review,candidates,required)
    if args.upgrade_active_source:assert review.get('sourceUpgrade') is True
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(expected['observedAt'])).total_seconds()
    active_base=plan.A_SOURCE_BASE if args.upgrade_active_source else plan.A_BASE
    assert expected.get('sourceUpgrade',False)==args.upgrade_active_source
    if args.upgrade_active_source:assert expected.get('imageOnlyDelta') is True
    assert expected['status']=='PASS' and expected['candidateImage']==candidates['a'] and expected['baselineImage']==active_base and 0<=age<3600
    assert all(expected.get(k) is True for k in ['runtimeEnvironmentAndBindMountsMatch','sourceOnlyConfigDelta','rollbackImageAvailable','pacsVolumePreserved','containersUnchanged'])
    data=json.loads((ROOT/scan).read_text(encoding='utf8'))
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(data['CreatedAt'].replace('Z','+00:00'))).total_seconds()
    assert 0<=age<86400 and data['Metadata']['ImageID']==candidates['a'] and isinstance(data.get('Results'),list)
    assert not any(v.get('Severity') in ['HIGH','CRITICAL'] for row in data['Results'] for v in row.get('Vulnerabilities',[]))
    subprocess.run(['node','scripts/verify-hcc-scenario-candidates.js',*[row['role']+'='+row['image'] for row in manifest['images']]],cwd=ROOT,check=True,capture_output=True,timeout=150)
    subprocess.run(['node','scripts/security-gate.js'],cwd=ROOT,env=dict(os.environ,HIPASS_SECURITY_GATE_TIMEOUT_MS='120000'),check=True,capture_output=True,timeout=400)
    import paramiko
    ops=load('a_rollout_ops','scripts/workstation-automatic-ops.py')
    directory=ROOT/'artifacts/workstation'/('hcc-source-a-rollout-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    credential=getpass.getpass('VM credential (concealed): ');client=paramiko.SSHClient();trust=None
    try:
        trust=ops.LocalVmTrust();key=trust.key('A',credential,directory/'A-public-host.key')
        address,mac,_=ops.ROLES['A'];client.get_host_keys().add(address,key.get_name(),key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address,username='server',password=credential,look_for_keys=False,allow_agent=False,
          timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        program=remote_program(expected,candidates['a'],hashlib.sha256((ROOT/MANIFEST).read_bytes()).hexdigest(),mac,args.upgrade_active_source)
        code,output=ops.run(client,"sudo -S -p '' timeout 300s python3 -c "+shlex.quote(program),credential=credential,seconds=305)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception:result={'status':'NOT VERIFIED','reason':'REINSPECT_REMOTE_STATE_BEFORE_RETRY','rollback':'NOT VERIFIED'}
    finally:
        client.close()
        if trust:trust.close()
        credential=None
    result['observedAt']=datetime.now(timezone.utc).isoformat()
    receipt=directory/'result.json';receipt.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(receipt),**result}),flush=True)
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
