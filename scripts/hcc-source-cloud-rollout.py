"""Exact reviewed cloud source-proof activation/rollback; default read-only.

Image transfer and credential provisioning are deliberately separate prerequisites.
This command never touches A/B PACS or registers a catalog.
"""
import argparse
import hashlib
import importlib.util
import inspect
import json
import os
import pathlib
import shlex
import subprocess
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


plan = load('source_deployment', 'scripts/lib/hcc_source_deployment.py')
guard = load('source_rollout', 'scripts/lib/hcc_source_rollout.py')


def remote_program(expected, candidates, ca, source_upgrade=False):
    return ('import subprocess,json,pathlib,os,hashlib,copy,re,stat,time,ssl,http.client\n'
            + '\n'.join(k + '=' + repr(getattr(plan, k)) for k in
                        ['CONTROL_BASE','INGRESS_BASE','SECRET_SOURCE','SECRET_TARGET','NAMES',
                         'A_SOURCE_BASE','CONTROL_SOURCE_BASE','SOURCE_INGRESS','SOURCE_OVERLAY','A_SECRET','A_MANIFEST'])
            + '\nEXPECTED=' + repr(expected) + '\nCANDIDATES=' + repr(candidates) + '\nCA=' + repr(ca) + '\nSOURCE_UPGRADE='+repr(source_upgrade)+'\n'
            + inspect.getsource(plan.source_image_upgrade_config)+'\n'
            + inspect.getsource(plan.context) + '\n' + inspect.getsource(plan.source_only_config)
            + '\n' + inspect.getsource(guard.promotion_sequence) + '\n' + r'''
def run(args,**kw):
 result=subprocess.run(args,capture_output=True,timeout=45,**kw)
 if result.returncode:raise RuntimeError('BOUNDED_COMMAND_FAILED')
 return result.stdout
def digest(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()
class Adapter:
 def inventory(self):return json.loads(run(['docker','inspect',*self.names]))
 def compose(self,files):
  command=['docker','compose','--project-directory',self.stage,'-p','hp-capstone-control']
  for path in files:command+=['-f',path]
  return command
 def tls(self):
  connection=http.client.HTTPSConnection('10.90.88.1',443,context=ssl.create_default_context(cadata=CA),timeout=4)
  try:
   connection.request('GET','/api/health');response=connection.getresponse();body=response.read(131073)
   assert response.status==200 and len(body)<=131072
   data=json.loads(body);assert data.get('status')=='UP' and data.get('database')=='UP'
  finally:connection.close()
 def preflight(self):
  assert run(['hostname']).decode().strip()=='highpass-cloud'
  self.names=['hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1']
  self.before=self.inventory();a,b,pg=self.before
  active_base=CONTROL_SOURCE_BASE if SOURCE_UPGRADE else CONTROL_BASE
  active_ingress=SOURCE_INGRESS if SOURCE_UPGRADE else INGRESS_BASE
  assert a['Image']==active_base and b['Image']==active_ingress and pg['Id']==EXPECTED['protectedPostgresId']
  if SOURCE_UPGRADE:
   assert a['Id']==EXPECTED['controlId'] and b['Id']==EXPECTED['protectedIngressId']
   assert CANDIDATES['ingress']==active_ingress
  assert all(i['State']['Running'] for i in self.before)
  assert a['State']['Health']['Status']==pg['State']['Health']['Status']=='healthy'
  self.stage,self.files=context(a['Config']['Labels'],source_enabled=SOURCE_UPGRADE)
  other,self.ingress_files=context(b['Config']['Labels'],ingress=True,source_enabled=SOURCE_UPGRADE);assert other==self.stage
  assert (self.files if SOURCE_UPGRADE else self.files[:-1])==self.ingress_files
  for entry in EXPECTED['composeFileHashes']:
   assert hashlib.sha256(pathlib.Path(entry['path']).read_bytes()).hexdigest()==entry['sha256']
  for image in [active_base,active_ingress,CANDIDATES['control'],CANDIDATES['ingress']]:
   assert json.loads(run(['docker','image','inspect',image]))[0]['Id']==image
  runtime=dict(x.split('=',1) for x in a['Config']['Env'])
  self.env={'PATH':os.environ['PATH'],'HIPASS_APP_IMAGE':CONTROL_BASE,'HIPASS_POSTGRES_IMAGE':pg['Image'],
   'HIPASS_CLOUD_SECRET_DIR':'/opt/highpass/capstone-control-secrets','HIPASS_CAPSTONE_PUBLIC_ORIGIN':'https://192.168.111.149:9443'}
  for key in ['HIPASS_KEY_RELEASE_VAULT_KEY_ID','HIPASS_PATIENT_KEY_VAULT_KEY_ID']:
   self.env[key]=runtime[key]
   assert re.fullmatch(r'https://kv-hp-demo-4869edd9.vault.azure.net/keys/capstone-b-kek-20261009/[a-f0-9]{32}',self.env[key])
  self.baseline=json.loads(run(self.compose(self.files)+['config','--format','json'],env=self.env))
  assert digest(self.baseline)==EXPECTED['baselineConfigSha256']
  # Require a separately provisioned regular root-owned file, readable only by root/app group.
  secret=pathlib.Path(SECRET_SOURCE);info=secret.lstat()
  assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_gid==65532
  assert stat.S_IMODE(info.st_mode)==0o440 and 32<=info.st_size<=512
  value=secret.read_bytes().strip();assert len(value)>=32 and re.fullmatch(rb'[A-Za-z0-9_-]+',value)
  for name in ['token-secret','idp-secret','presenter-key','ingress-secret','data-plane-secret','patient-metadata-secret','key-release-secret']:
   other=secret.parent/name
   if other.is_file():assert other.read_bytes().strip()!=value
  del value
  self.overlay=self.stage+('/hcc-source-upgrade-'+CANDIDATES['control'].split(':')[1][:16]+'.yml' if SOURCE_UPGRADE else '/hcc-source-reviewed-20261010.yml')
  content=json.dumps({'services':{'control':{'image':CANDIDATES['control'],'environment':{
   'HIPASS_CAPSTONE_HCC_CATALOG':'1','HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE':SECRET_TARGET},
   'volumes':[{'type':'bind','source':SECRET_SOURCE,'target':SECRET_TARGET,'read_only':True,
   'bind':{'create_host_path':False}}]},'ingress':{'image':CANDIDATES['ingress']}}})+'\n'
  if SOURCE_UPGRADE:content=json.dumps({'services':{'control':{'image':CANDIDATES['control']}}})+'\n'
  self.candidate=json.loads(run(self.compose(self.files)+['-f','-','config','--format','json'],env=self.env,input=content.encode()))
  if SOURCE_UPGRADE:source_image_upgrade_config(self.baseline,self.candidate,'control',CANDIDATES['control'])
  else:source_only_config(self.baseline,self.candidate,CANDIDATES['control'],CANDIDATES['ingress'])
  assert digest(self.candidate)==EXPECTED['candidateConfigSha256']
  self.verify('baseline')
  target=pathlib.Path(self.overlay)
  if target.exists():assert target.is_file() and not target.is_symlink() and target.read_text()==content
  else:
   descriptor=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
   with os.fdopen(descriptor,'w') as stream:stream.write(content)
 def activate(self,role,profile):
  if SOURCE_UPGRADE:assert role=='control'
  files=self.files+[self.overlay] if profile=='candidate' else self.files if role=='control' else self.ingress_files
  run(self.compose(files)+['up','-d','--no-deps','--pull','never','--force-recreate',role],env=self.env)
 def verify(self,profile):
  deadline=time.monotonic()+40
  cfg=self.candidate if profile=='candidate' else self.baseline
  while True:
   items=self.inventory();pg=items[2];oldpg=self.before[2]
   assert all(pg[k]==oldpg[k] for k in ['Id','Image','Config','Mounts','HostConfig'])
   assert pg['State']['Running'] and pg['State']['Health']['Status']=='healthy'
   for role,item,old in zip(['control','ingress'],items,self.before):
    if SOURCE_UPGRADE and role=='ingress':
     assert all(item[k]==old[k] for k in ['Id','Image','Config','Mounts','HostConfig'])
     assert item['State']['Running'] and item['State']['StartedAt']==old['State']['StartedAt']
     continue
    assert item['Image']==cfg['services'][role]['image'] and item['State']['Running']
    for key in ['Cmd','Entrypoint','User','WorkingDir']:assert item['Config'].get(key)==old['Config'].get(key)
    for key in ['PortBindings','ReadonlyRootfs','Privileged','CapAdd','CapDrop','SecurityOpt','NetworkMode']:
     assert item['HostConfig'].get(key)==old['HostConfig'].get(key)
    assert set(item['NetworkSettings']['Networks'])==set(old['NetworkSettings']['Networks'])
    wanted=dict(x.split('=',1) for x in old['Config']['Env'])
    if role=='control' and profile=='candidate':wanted.update({'HIPASS_CAPSTONE_HCC_CATALOG':'1','HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE':SECRET_TARGET})
    assert dict(x.split('=',1) for x in item['Config']['Env'])==wanted
    wanted=sorted((v['source'],v['target'],bool(v.get('read_only'))) for v in cfg['services'][role].get('volumes',[]) if v['type']=='bind')
    actual=sorted((v['Source'],v['Destination'],not v['RW']) for v in item['Mounts'] if v['Type']=='bind')
    assert wanted==actual
    selected=self.files+[self.overlay] if profile=='candidate' else self.files if role=='control' else self.ingress_files
    assert item['Config']['Labels']['com.docker.compose.project.config_files'].split(',')==selected
   if items[0]['State']['Health']['Status']=='healthy':
    try:self.tls();return
    except (OSError,ValueError,AssertionError):pass
   if time.monotonic()>=deadline:raise RuntimeError('STRICT_READINESS_TIMEOUT')
   time.sleep(1)
adapter=Adapter();result=promotion_sequence(adapter,roles=('control',) if SOURCE_UPGRADE else ('control','ingress'))
result.update({'scope':'CLOUD_SOURCE_ONLY_ACTIVATION_ROLLBACK_NOT_A_PROOF_CATALOG_OR_BROWSER',
 'candidates':CANDIDATES,'sourceUpgrade':SOURCE_UPGRADE,'review':'DRAFT / UNASSIGNED'})
print(json.dumps(result));raise SystemExit(0 if result['status']=='PASS' else 2)
''')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate-manifest', type=pathlib.Path, required=True)
    parser.add_argument('--preflight', type=pathlib.Path)
    parser.add_argument('--review', type=pathlib.Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--upgrade-active-source',action='store_true')
    args = parser.parse_args()
    if not args.apply:
        return subprocess.run([os.sys.executable,str(ROOT/'scripts/hcc-source-cloud-preflight.py'),
                               '--candidate-manifest',str(args.candidate_manifest)]+(['--upgrade-active-source'] if args.upgrade_active_source else []), timeout=120).returncode
    if not args.preflight or not args.review:raise ValueError('EXACT_REVIEW_AND_PREFLIGHT_REQUIRED')
    paths = [args.candidate_manifest.resolve(), args.preflight.resolve(), args.review.resolve()]
    if any(not p.is_relative_to(ROOT/'artifacts/workstation') for p in paths):raise ValueError('OWNED_ARTIFACTS_REQUIRED')
    manifest,expected,review = [json.loads(p.read_text(encoding='utf8')) for p in paths]
    assert manifest['status']=='PASS' and len(manifest['images'])==3
    candidates={row['role']:row['id'] for row in manifest['images']};assert set(candidates)=={'control','a','ingress'}
    image_rows={row['role']:row for row in manifest['images']}
    scans=[guard.candidate_scan_path(role,image_rows[role]['image']) for role in ['control','a','ingress']]
    required=[p.relative_to(ROOT).as_posix() for p in paths[:2]]+scans+[
     'scripts/hcc-source-cloud-rollout.py','scripts/hcc-source-cloud-preflight.py','scripts/lib/hcc_source_rollout.py','scripts/lib/hcc_source_deployment.py']
    guard.validate_review(ROOT,review,candidates,required)
    if args.upgrade_active_source:assert review.get('sourceUpgrade') is True
    guard.validate_preflight(expected,candidates)
    assert expected.get('sourceUpgrade',False)==args.upgrade_active_source
    if args.upgrade_active_source:
        assert expected.get('imageOnlyDelta') is True and expected['baselineImage']==plan.CONTROL_SOURCE_BASE
        assert expected['baselineIngress']==candidates['ingress']==plan.SOURCE_INGRESS
    else:assert expected['baselineImage']==plan.CONTROL_BASE and expected['baselineIngress']==plan.INGRESS_BASE
    for role,scan in zip(['control','a','ingress'],scans):
        data=json.loads((ROOT/scan).read_text(encoding='utf8'))
        age=(datetime.now(timezone.utc)-datetime.fromisoformat(data['CreatedAt'].replace('Z','+00:00'))).total_seconds()
        assert 0<=age<86400 and data['Metadata']['ImageID']==candidates[role] and isinstance(data.get('Results'),list)
        assert not any(v.get('Severity') in ['HIGH','CRITICAL'] for r in data['Results'] for v in r.get('Vulnerabilities',[]))
    subprocess.run(['node','scripts/verify-hcc-scenario-candidates.js',*[row['role']+'='+row['image'] for row in manifest['images']]],cwd=ROOT,check=True,timeout=150,capture_output=True)
    env=dict(os.environ,HIPASS_SECURITY_GATE_TIMEOUT_MS='120000')
    subprocess.run(['node','scripts/security-gate.js'],cwd=ROOT,env=env,check=True,timeout=400,capture_output=True)
    import paramiko
    client=paramiko.SSHClient()
    directory=ROOT/'artifacts/workstation'/('hcc-source-cloud-rollout-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    try:
        identity=pathlib.Path(os.environ['USERPROFILE'])/'.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity/'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity/'id_ed25519'),look_for_keys=False,
                       allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        ca=(ROOT/'tmp/certs/mtls/ca.crt').read_text()
        ops=load('source_rollout_ops','scripts/workstation-automatic-ops.py')
        code,output=ops.run(client,'sudo -n timeout 420s python3 -c '+shlex.quote(remote_program(expected,candidates,ca,args.upgrade_active_source)),seconds=425)
        result=json.loads(output)
        if code and result.get('status')=='PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception:
        result={'status':'NOT VERIFIED','reason':'REINSPECT_REMOTE_STATE_BEFORE_RETRY','rollback':'NOT VERIFIED'}
    finally:client.close()
    result['observedAt']=datetime.now(timezone.utc).isoformat()
    output=directory/'result.json';output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(output),**result}))
    return 0 if result.get('status')=='PASS' else 2


if __name__=='__main__':raise SystemExit(main())
