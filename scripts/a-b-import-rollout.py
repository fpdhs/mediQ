"""Scoped single-instance import rollout on pinned current A/B/Control images."""
import argparse
import base64
import hashlib
import json
import pathlib
import re
import shlex
import uuid
from datetime import datetime, timezone
from importlib.util import spec_from_file_location, module_from_spec

ROOT=pathlib.Path(__file__).resolve().parents[1]
CAPTURE=ROOT/'artifacts/workstation/a-b-import-runtime-20261013T225543Z/result.json'

def load(name,file):
    spec=spec_from_file_location(name,ROOT/'scripts'/file)
    module=module_from_spec(spec);spec.loader.exec_module(module);return module

inventory=load('import_inventory','a-b-import-runtime-check.py')
gateway=load('import_gateway','capstone-a-gateway-ops.py')

def replace_once(text,before,after):
    if text.count(before)!=1:raise RuntimeError('DEPLOYED_SOURCE_ANCHOR_MISMATCH')
    return text.replace(before,after,1)

def candidate_files(role,snapshot):
    captured={row['path']:base64.b64decode(row['sourceBase64']).decode('utf8')
              for row in snapshot['files'] if 'sourceBase64' in row}
    shared=['src/data-plane-authorization.js','src/capstone-encrypted-transfer.js']
    names=shared+(['src/data-plane-gateway.js'] if role=='A' else
                 ['src/data-plane-gateway.js','src/capstone-b-portal.js','scripts/start-capstone-b-portal.js',
                  'src/b-pacs-receiver.js','src/dicomweb-single-instance.js'] if role=='B' else
                 ['src/consent-bound-key-release.js','src/key-release-http-handler.js'])
    files={name:(ROOT/name).read_bytes() for name in names}
    if role=='CLOUD':
        # Keep the current Entra, patient, health-helper and UI integration intact.
        server=replace_once(captured['src/server.js'],
            '    keyId: process.env.HIPASS_KEY_RELEASE_VAULT_KEY_ID,',
            "    keyId: process.env.HIPASS_KEY_RELEASE_VAULT_KEY_ID,\n    pacsImportEnabled: process.env.HIPASS_B_PACS_IMPORT_ENABLED === '1',")
        server=replace_once(server,
            "      clinicianPublicBaseUrl: process.env.AUTH_MODE==='ENTRA_OIDC'?process.env.HIPASS_PATIENT_IMAGE_ORIGIN:undefined,",
            "      clinicianPublicBaseUrl: process.env.AUTH_MODE==='ENTRA_OIDC'?process.env.HIPASS_PATIENT_IMAGE_ORIGIN:undefined,\n      pacsImportEnabled: process.env.HIPASS_B_PACS_IMPORT_ENABLED === '1',")
        files['src/server.js']=server.encode('utf8')
    return files

GUEST=r'''
import base64,hashlib,json,os,pathlib,re,subprocess,time
def run(args,seconds=30):
 p=subprocess.run(args,capture_output=True,text=True,timeout=seconds)
 if p.returncode:raise RuntimeError('ROLLOUT_COMMAND_FAILED_'+args[0])
 return p.stdout
def inspect(name):return json.loads(run(['docker','inspect',name]))[0]
def save(path,value):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'w') as stream:json.dump(value,stream)
before=inspect(request['name'])
if before['Image']!=request['baselineImage'] or not before['State']['Running']:raise RuntimeError('CURRENT_RUNTIME_BASELINE_CHANGED')
for file,expected in request['baselineHashes'].items():
 actual=run(['docker','exec',before['Id'],'/nodejs/bin/node','-e',"console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))",'/app/'+file]).strip()
 if actual!=expected:raise RuntimeError('CURRENT_SOURCE_BASELINE_CHANGED')
folder=pathlib.Path(request['release']);folder.mkdir(mode=0o700)
save(folder/'baseline.json',before)
labels=before['Config']['Labels'];service=labels['com.docker.compose.service'];project=labels['com.docker.compose.project']
args=['docker','compose','--project-directory',labels['com.docker.compose.project.working_dir'],'-p',project]
for file in labels['com.docker.compose.project.config_files'].split(','):args+=['-f',file]
environment={**os.environ,**dict(item.split('=',1) for item in before['Config']['Env'])}
environment['HIPASS_APP_IMAGE']=before['Image']
environment['HIPASS_KEY_RELEASE_VAULT_KEY_ID']=environment.get('CAPSTONE_VAULT_KEY_ID','')
environment['HIPASS_A_GATEWAY_SECRET_DIR']='/opt/highpass/capstone-a-gateway-secrets'
environment['HIPASS_B_PORTAL_SECRET_DIR']='/opt/highpass/capstone-b-portal-secrets'
if request['role']=='CONTROL_INGRESS':
 environment['HIPASS_CLOUD_SECRET_DIR']='/opt/highpass/capstone-control-secrets'
 control_env=dict(item.split('=',1) for item in inspect('hp-capstone-control-control-1')['Config']['Env'])
 environment['HIPASS_KEY_RELEASE_VAULT_KEY_ID']=control_env['HIPASS_KEY_RELEASE_VAULT_KEY_ID']
 environment['HIPASS_CAPSTONE_PUBLIC_ORIGIN']=control_env['HIPASS_PUBLIC_BASE_URL']
 environment['HIPASS_POSTGRES_IMAGE']=inspect('hp-capstone-control-postgres-1')['Image']
 environment['HIPASS_PATIENT_KEY_VAULT_KEY_ID']=control_env['HIPASS_PATIENT_KEY_VAULT_KEY_ID']
p=subprocess.run(args+['config','--format','json'],env=environment,capture_output=True,text=True,timeout=25)
if p.returncode:
 required=re.findall(r'variable ([A-Z][A-Z0-9_]+)',p.stderr)
 kind='MISSING_FILE' if 'no such file' in p.stderr.lower() else 'INVALID_CONFIGURATION'
 raise RuntimeError('CURRENT_COMPOSE_RESOLUTION_FAILED_'+('_'.join(sorted(set(required))) or kind))
config=json.loads(p.stdout);save(folder/'before.json',config)
files=request['files']
for file,encoded in files.items():
 if not file.startswith(('src/','scripts/','public/')) or '..' in file:raise RuntimeError('SCOPED_SOURCE_PATH_REQUIRED')
 path=folder/file;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(base64.b64decode(encoded));path.chmod(0o644)
base='highpass-import-base:'+before['Image'][7:23];run(['docker','tag',before['Image'],base])
(folder/'Dockerfile').write_text('FROM '+base+'\n'+''.join('COPY '+file+' /app/'+file+'\n' for file in files))
(folder/'.dockerignore').write_text('*\n!Dockerfile\n!src/\n!src/**\n!scripts/\n!scripts/**\n')
tag='highpass-single-import:'+request['operation']+'-'+request['role'].lower()
run(['docker','build','--network=none','--pull=false','-t',tag,str(folder)],100)
candidate=inspect(tag)
if candidate['Config']!=inspect(before['Image'])['Config']:raise RuntimeError('IMAGE_CONFIG_DRIFT')
for file in files:
 if file.endswith('.js'):run(['docker','run','--rm','--network=none','--read-only','--cap-drop=ALL','--entrypoint=/nodejs/bin/node',candidate['Id'],'--check','/app/'+file],15)
conf=config['services'][service];conf['image']=candidate['Id']
conf['environment']={k:v.replace('$','$$') for k,v in (item.split('=',1) for item in before['Config']['Env'])}
if request['role']=='CLOUD':conf['environment']['HIPASS_B_PACS_IMPORT_ENABLED']='1'
if request['role']=='B':
 release=pathlib.Path('/opt/highpass/b-pacs-receiver-1ee2564f78cb4a1aaeb2b01671b0f627')
 secrets=release/'secrets'
 if not os.path.ismount('/opt/highpass/b-pacs-encrypted'):raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')
 network=inspect('hp-b-pacs-receiver-b-pacs-mtls-1')
 if not network['State']['Running'] or network['HostConfig'].get('PortBindings'):raise RuntimeError('PRIVATE_B_RECEIVER_REQUIRED')
 for file in ['ca.crt','b-pacs-client.crt','b-pacs-client.key']:
  info=(secrets/file).lstat()
  if info.st_uid!=0 or info.st_gid!=65532 or info.st_mode&0o777!=0o440:raise RuntimeError('PRIVATE_B_PACS_SECRET_REQUIRED')
 manifest=folder/'manifest.json';manifest.write_bytes(base64.b64decode(request['manifest']));manifest.chmod(0o440);os.chown(manifest,0,65532)
 # Non-root container can traverse only this root-owned release, not read snapshots.
 folder.chmod(0o711)
 conf['environment'].update(CAPSTONE_B_PACS_IMPORT_ENABLED='1',CAPSTONE_B_PACS_CA_FILE='/run/b-pacs/ca.crt',
  CAPSTONE_B_PACS_CLIENT_CERT_FILE='/run/b-pacs/b-pacs-client.crt',CAPSTONE_B_PACS_CLIENT_KEY_FILE='/run/b-pacs/b-pacs-client.key',
  CAPSTONE_B_PACS_MANIFEST_FILE='/run/b-pacs/manifest.json')
 for file in ['ca.crt','b-pacs-client.crt','b-pacs-client.key']:
  conf.setdefault('volumes',[]).append({'type':'bind','source':str(secrets/file),'target':'/run/b-pacs/'+file,'read_only':True,'bind':{'create_host_path':False}})
 conf['volumes'].append({'type':'bind','source':str(manifest),'target':'/run/b-pacs/manifest.json','read_only':True,'bind':{'create_host_path':False}})
 networks=conf.setdefault('networks',{})
 if not isinstance(networks,dict):raise RuntimeError('STRUCTURED_NETWORK_CONFIG_REQUIRED')
 networks['b_pacs_receiver']=None
 config.setdefault('networks',{})['b_pacs_receiver']={'name':'highpass_b_pacs_receiver','external':True}
save(folder/'after.json',config)
def switch(file):run(['docker','compose','-p',project,'-f',str(folder/file),'up','-d','--no-deps','--pull','never',service],100)
try:
 switch('after.json');deadline=time.monotonic()+65
 while True:
  current=inspect(request['name']);health=current['State'].get('Health',{}).get('Status')
  if request['role']=='WEB' and current['State']['Running'] and health is None:
   probe=subprocess.run(['docker','exec',current['Id'],'/nodejs/bin/node','-e',"fetch('http://127.0.0.1:8080/',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(2))"],capture_output=True,timeout=5)
   if probe.returncode==0:health='HTTP_200'
  if request['role']=='CONTROL_INGRESS' and current['State']['Running'] and health is None:
   probe=subprocess.run(['docker','exec',current['Id'],'/nodejs/bin/node','-e',"fetch('http://control:3000/api/health',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(2))"],capture_output=True,timeout=5)
   if probe.returncode==0:health='HTTP_200'
  if current['State']['Running'] and health in ['healthy','HTTP_200']:break
  if time.monotonic()>=deadline:raise RuntimeError('DEPLOYED_IMPORT_HEALTH_NOT_READY')
  time.sleep(2)
 for key in ['PortBindings','ReadonlyRootfs','CapDrop','SecurityOpt']:
  if current['HostConfig'][key]!=before['HostConfig'][key]:raise RuntimeError('RUNTIME_SECURITY_DRIFT')
 if current['Image']!=candidate['Id']:raise RuntimeError('DEPLOYED_IMAGE_MISMATCH')
except Exception:
 switch('before.json');raise
print(json.dumps({'status':'PASS','role':request['role'],'release':str(folder),'imageId':candidate['Id'],'health':health,
 'rollbackConfig':str(folder/'before.json'),'changedFiles':list(files),'publishedPortsUnchanged':True}))
'''

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--gui',action='store_true');args=parser.parse_args()
    operation=uuid.uuid4().hex
    folder=ROOT/'artifacts/workstation'/('a-b-single-import-rollout-'+operation);folder.mkdir(parents=True)
    capture=json.loads(CAPTURE.read_text(encoding='utf8'))
    result={'status':'NOT VERIFIED','operation':operation,'observedAt':datetime.now(timezone.utc).isoformat(),'checks':[],
            'actualAtoBTransfer':'NOT VERIFIED','consentCreated':False}
    credentials={}
    try:
        credentials=inventory.preflight.collect_vm_credentials(gui=args.gui)
        for role in ['A','B','CLOUD']:
            snapshot=capture['runtimes'][role];files=candidate_files(role,snapshot)
            request={'role':role,'name':snapshot['name'],'operation':operation,
                     'baselineImage':snapshot['imageId'],'release':'/opt/highpass/single-import-'+operation+'-'+role.lower(),
                     'baselineHashes':{row['path']:row['sha256'] for row in snapshot['files'] if row.get('exists')},
                     'files':{name:base64.b64encode(body).decode() for name,body in files.items()}}
            if role=='B':request['manifest']=base64.b64encode((ROOT/'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json').read_bytes()).decode()
            credential=credentials.get(role);trust=inventory.preflight.ops_module.LocalVmTrust() if role=='A' else None
            client=inventory.preflight.connect_vm(role,credential,trust,folder) if role=='A' else inventory.check.connect(role,credential)
            result['phase']=role+'_SCOPED_ROLLOUT'
            try:
                guest=request['release']+'-guest.py'
                with gateway.root_sftp(client,credential) as sftp:
                    with sftp.open(guest,'wx') as stream:stream.write('import sys,json\nrequest=json.load(sys.stdin)\n'+GUEST)
                    sftp.chown(guest,0,0);sftp.chmod(guest,0o600)
                prefix="sudo -S -p '' " if credential else 'sudo -n '
                stdin,stdout,stderr=client.exec_command(prefix+'timeout 240s python3 '+shlex.quote(guest),timeout=10)
                stdout.channel.settimeout(250)
                if credential:stdin.write(credential+'\n');stdin.flush()
                stdin.write(json.dumps(request));stdin.flush();stdin.channel.shutdown_write()
                output=stdout.read(65537);code=stdout.channel.recv_exit_status()
                if code:
                    diagnostic=stderr.read(8192).decode('utf8','replace')
                    reasons=re.findall(r'RuntimeError: ([A-Z0-9_]+)',diagnostic)
                    raise RuntimeError(reasons[-1] if reasons else 'SCOPED_ROLLOUT_FAILED')
                receipt=json.loads(output);result['checks'].append(receipt)
                print(json.dumps({'role':role,'status':'PASS','phase':'SCOPED_ROLLOUT'}),flush=True)
            finally:
                client.close()
                if trust is not None:trust.close()
        result['status']='PASS'
    except BaseException as error:
        result['status']='FAIL';result['reason']=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__
    finally:credentials.clear()
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
