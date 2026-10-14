"""Prepare B encrypted Orthanc and mTLS containers, stopped. No unlock or import."""
import argparse
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import subprocess
import uuid
from datetime import datetime, timezone

from cryptography import x509

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_runtime',ROOT/'scripts/b-pacs-storage-runtime-check.py')
runtime=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)
IMAGES={
    'b-orthanc':'sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368',
    'b-pacs-mtls':'sha256:eeba3f5d44b4830b91b9ed35dd19b5bf58d4b03b0332bcb22b4eff34a7443421',
}
FILES={
    'b-pacs-storage-guest.py':'scripts/b-pacs-storage-guest.py',
    'b-pacs-receiver-start.py':'scripts/b-pacs-receiver-start.py',
    'receiver.compose.yml':'infra/workstation/hospital-b-pacs-receiver.compose.yml',
    'orthanc/hospital-b-receiver.json':'infra/workstation/orthanc/hospital-b-receiver.json',
}
OPENSSL='C:/Program Files/Git/usr/bin/openssl.exe'

GUEST=r'''
import hashlib,importlib.util,json,os,pathlib,re,stat,subprocess
def run(args,seconds=30):
 p=subprocess.run(args,capture_output=True,timeout=seconds)
 if p.returncode: raise RuntimeError('PREPARATION_COMMAND_FAILED')
 return p.stdout.decode().strip()
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as stream:
  for chunk in iter(lambda:stream.read(1024*1024),b''): h.update(chunk)
 return h.hexdigest()
def import_file(name,path):
 spec=importlib.util.spec_from_file_location(name,path)
 module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module
def directory(path,mode,gid=0):
 if not path.exists() and not path.is_symlink():
  path.mkdir(mode=mode);os.chown(path,0,gid);os.chmod(path,mode)
 info=path.lstat()
 if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or info.st_gid!=gid or stat.S_IMODE(info.st_mode)!=mode:
  raise RuntimeError('PREPARATION_DIRECTORY_INVALID')
def install_public(name,digest,target,mode=0o644,gid=0):
 source=stage/name
 if source.is_symlink() or not source.is_file() or sha(source)!=digest: raise RuntimeError('STAGED_FILE_HASH_MISMATCH')
 if target.exists() or target.is_symlink():
  info=target.lstat()
  if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_gid!=gid or stat.S_IMODE(info.st_mode)!=mode or sha(target)!=digest:
   raise RuntimeError('EXISTING_PREPARATION_FILE_MISMATCH')
 else:
  with source.open('rb') as incoming,target.open('xb') as outgoing:
   for chunk in iter(lambda:incoming.read(1024*1024),b''): outgoing.write(chunk)
  os.chown(target,0,gid);os.chmod(target,mode)
  if sha(target)!=digest: raise RuntimeError('INSTALLED_FILE_HASH_MISMATCH')
def portal():
 c=json.loads(run(['docker','inspect','hp-capstone-b-portal-portal-1']))[0]
 value={'id':c['Id'],'imageId':c['Image'],'health':c['State'].get('Health',{}).get('Status')}
 if not c['State'].get('Running') or value['health']!='healthy': raise RuntimeError('B_PORTAL_NOT_HEALTHY')
 return value
def receiver_inventory():
 ids=run(['docker','ps','-a','--filter','label=com.docker.compose.project=hp-b-pacs-receiver','--format','{{.ID}}']).splitlines()
 containers=json.loads(run(['docker','inspect',*ids])) if ids else []
 for c in containers:
  labels=c['Config'].get('Labels',{})
  if labels.get('com.docker.compose.project.config_files')!=str(release/'receiver.compose.yml') or c['State'].get('Running'):
   raise RuntimeError('EXISTING_RECEIVER_PRESERVED')
 return containers
if os.geteuid()!=0 or pathlib.Path('/sys/class/net/ens33/address').read_text().strip()!='00:0c:29:a3:9e:1b':
 raise RuntimeError('B_HOST_IDENTITY_REQUIRED')
os.umask(0o077)
stage=pathlib.Path(request['stage']);release=pathlib.Path(request['release'])
if not re.fullmatch('/home/server/hp-b-pacs-stage-[a-f0-9]{32}',str(stage)) or not re.fullmatch('/opt/highpass/b-pacs-receiver-[a-f0-9]{32}',str(release)):
 raise RuntimeError('PREPARATION_PATH_INVALID')
baseline=portal()
if request.get('portalBaseline') and baseline!=request['portalBaseline']: raise RuntimeError('B_PORTAL_BASELINE_CHANGED')
parent=release.parent
info=parent.lstat()
if not stat.S_ISDIR(info.st_mode) or info.st_uid!=0 or stat.S_IMODE(info.st_mode)&0o022: raise RuntimeError('RELEASE_PARENT_INVALID')
directory(release,0o755);directory(release/'orthanc',0o755)
for name,digest in request['files'].items(): install_public(name,digest,release/name)
guard=import_file('receiver_guard',release/'b-pacs-receiver-start.py')
guest=import_file('storage_guest',release/'b-pacs-storage-guest.py')
guest.secure_file(guest.MANIFEST);guest.secure_file(guest.BACKING)
manifest=guest.validate_manifest(json.loads(guest.MANIFEST.read_text()))
if manifest['luksUuid']!=request['luksUuid'] or guest.BACKING.stat().st_size!=guest.SIZE: raise RuntimeError('PINNED_STORAGE_IDENTITY_REQUIRED')
source=guest.run(['findmnt','-n','-o','SOURCE','--mountpoint',str(guest.MOUNT)])
options=set(guest.run(['findmnt','-n','-o','OPTIONS','--mountpoint',str(guest.MOUNT)]).split(','))
if not {'rw','nosuid','nodev','noexec'}.issubset(options): raise RuntimeError('ENCRYPTED_MOUNT_OPTIONS_INVALID')
dm_uuid=pathlib.Path('/sys/class/block',os.path.basename(os.path.realpath(guest.DEVICE)),'dm/uuid').read_text().strip()
state=guest.run(['cryptsetup','status',guest.MAPPING])
loop=re.search(r'(?m)^\s*device:\s*(/dev/loop\d+)\s*$',state)
if not loop: raise RuntimeError('OWNED_LOOP_REQUIRED')
backing=guest.run(['losetup','--noheadings','--output','BACK-FILE',loop.group(1)])
guard.validate_boundary(manifest,source,dm_uuid,backing,os.path.ismount(guest.MOUNT))
if sha(guest.MOUNT/'.storage-recovery-probe')!=request['probeHash']: raise RuntimeError('RECOVERY_PROBE_HASH_MISMATCH')
receiver_inventory()
guest.ensure_orthanc_storage()
secrets=release/'secrets';directory(secrets,0o750,65532)
if request['phase']=='prepare':
 install_public('images.tar',request['archiveSha256'],release/'images.tar',0o600)
 run(['docker','load','--input',str(release/'images.tar')],120)
 for expected in request['images'].values():
  if run(['docker','image','inspect',expected,'--format','{{.Id}}'])!=expected: raise RuntimeError('LOADED_IMAGE_ID_MISMATCH')
 csrs={}
 for role in ['server','client']:
  key=secrets/('b-pacs-'+role+'.key');csr=release/('b-pacs-'+role+'.csr')
  if not key.exists() and not key.is_symlink() and not csr.exists():
   run(['openssl','genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048','-out',str(key)])
   os.chown(key,0,65532);os.chmod(key,0o440)
   run(['openssl','req','-new','-key',str(key),'-subj','/CN=Highpass B PACS '+role+' DEVELOPMENT ONLY','-out',str(csr)])
  guard.validate_secret_file(key.lstat(),key.is_symlink())
  if csr.is_symlink(): raise RuntimeError('CSR_PATH_INVALID')
  csrs[role]=csr.read_text()
 if portal()!=baseline: raise RuntimeError('B_PORTAL_BASELINE_CHANGED')
 print(json.dumps({'status':'PASS','phase':'PREPARED_KEYS_AND_IMAGES','csrs':csrs,'portalBaseline':baseline,
  'luksUuid':manifest['luksUuid'],'orthancData':str(guest.ORTHANC_STORAGE),'privateKeyExported':False}))
elif request['phase']=='finish':
 for name,digest in request['certificates'].items(): install_public(name,digest,secrets/name,0o440,65532)
 for role,purpose in [('server','sslserver'),('client','sslclient')]:
  certificate=secrets/('b-pacs-'+role+'.crt');key=secrets/('b-pacs-'+role+'.key')
  args=['openssl','verify','-CAfile',str(secrets/'ca.crt'),'-purpose',purpose]
  if role=='server':args+=['-verify_hostname','b-pacs-mtls']
  run(args+[str(certificate)])
  public_key=run(['openssl','pkey','-in',str(key),'-pubout'])
  cert_key=run(['openssl','x509','-in',str(certificate),'-pubkey','-noout'])
  if public_key!=cert_key: raise RuntimeError('CERTIFICATE_KEY_MISMATCH')
 env='HIPASS_B_ORTHANC_IMAGE='+request['images']['b-orthanc']+'\nHIPASS_B_RECEIVER_IMAGE='+request['images']['b-pacs-mtls']+'\nHIPASS_B_PACS_ENCRYPTED_MOUNT='+str(guest.MOUNT)+'\nHIPASS_B_PACS_SECRETS_DIR='+str(secrets)+'\nB_PACS_ENCRYPTED_LUKS_UUID='+manifest['luksUuid']+'\n'
 env_file=release/'receiver.env'
 if env_file.exists():
  guest.secure_file(env_file)
  if env_file.read_text()!=env:raise RuntimeError('EXISTING_ENV_PRESERVED')
 else:
  with env_file.open('x') as stream:stream.write(env)
 run(['python3',str(release/'b-pacs-receiver-start.py'),'--compose',str(release/'receiver.compose.yml'),'--env-file',str(env_file),'--check-only'])
 cmd=['docker','compose','-p','hp-b-pacs-receiver','--env-file',str(env_file),'-f',str(release/'receiver.compose.yml')]
 run(cmd+['create','--no-build','--pull','never'],90)
 containers=receiver_inventory()
 if len(containers)!=2:raise RuntimeError('EXACT_STOPPED_RECEIVER_REQUIRED')
 states=[]
 for c in containers:
  service=c['Config']['Labels']['com.docker.compose.service']
  if c['Image']!=request['images'].get(service) or c['State']['Status']!='created' or c['HostConfig'].get('PortBindings') or c['HostConfig']['RestartPolicy']['Name']!='no':
   raise RuntimeError('STOPPED_RECEIVER_STATE_INVALID')
  states.append({'service':service,'imageId':c['Image'],'state':c['State']['Status'],'publishedPorts':False})
 for network in json.loads(run(['docker','network','inspect','hp-b-pacs-receiver_b_pacs_private','highpass_b_pacs_receiver'])):
  if network.get('Internal') is not True:raise RuntimeError('PRIVATE_RECEIVER_NETWORK_REQUIRED')
 if portal()!=baseline:raise RuntimeError('B_PORTAL_BASELINE_CHANGED')
 for archive in [release/'images.tar',stage/'images.tar']:
  if archive.exists():archive.unlink()
 print(json.dumps({'status':'PASS','phase':'STOPPED_RECEIVER_PREPARED','release':str(release),
  'containers':states,'portalBaseline':baseline,'orthancData':str(guest.ORTHANC_STORAGE),
  'checkOnlyGate':'PASS','privateKeyExported':False,'receiverStarted':False,'importEnabled':False}))
else:raise RuntimeError('PREPARATION_PHASE_INVALID')
'''

def digest(path):
    value=hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda:stream.read(1024*1024),b''):value.update(chunk)
    return value.hexdigest()

def local(args,seconds=30,env=None):
    result=subprocess.run(args,capture_output=True,timeout=seconds,env=env)
    if result.returncode:raise RuntimeError('LOCAL_PREPARATION_COMMAND_FAILED')
    return result.stdout.decode().strip()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gui',action='store_true')
    parser.add_argument('--resume',help='Resume the exact previous operation UUID')
    args=parser.parse_args()
    operation=args.resume or uuid.uuid4().hex
    if not re.fullmatch('[a-f0-9]{32}',operation):raise SystemExit('OPERATION_INVALID')
    folder=ROOT/'artifacts/workstation'/('b-pacs-receiver-prepare-'+operation)
    folder.mkdir(parents=True,exist_ok=bool(args.resume))
    result={'status':'NOT VERIFIED','operation':operation,'scope':'B_STOPPED_RECEIVER_PREPARATION',
            'observedAt':datetime.now(timezone.utc).isoformat(),'receiverStarted':False,'importEnabled':False,
            'keyRecovery':'NOT VERIFIED','review':'DRAFT / UNASSIGNED'}
    client=None;credential=None
    try:
        ca_path=ROOT/'tmp/certs/mtls/ca.crt'
        ca=x509.load_pem_x509_certificate(ca_path.read_bytes())
        now=datetime.now(timezone.utc)
        if ca.not_valid_before_utc>now or (ca.not_valid_after_utc-now).days<31 or not ca.extensions.get_extension_for_class(x509.BasicConstraints).value.ca:
            raise RuntimeError('EXISTING_DEVELOPMENT_CA_NOT_VALID')
        for image in IMAGES.values():
            if local(['docker','image','inspect',image,'--format','{{.Id}}'])!=image:raise RuntimeError('LOCAL_IMAGE_ID_MISMATCH')
        result['imagePolicy']={}
        for service,filename in [('b-orthanc','b-pacs-orthanc-candidate-20261014.json'),('b-pacs-mtls','b-pacs-mtls-candidate-20261014d.json')]:
            report_path=ROOT/'artifacts/security'/filename
            report=json.loads(report_path.read_text())
            if report.get('Metadata',{}).get('ImageID')!=IMAGES[service]:raise RuntimeError('IMAGE_SCAN_ID_MISMATCH')
            scan_env=os.environ.copy();scan_env['HIPASS_TRIVY_RESULT']=str(report_path)
            result['imagePolicy'][service]=json.loads(local(['node','scripts/container-vulnerability-gate.js'],env=scan_env))
        archive=folder/'images.tar'
        if not archive.exists():local(['docker','image','save','--output',str(archive),*IMAGES.values()],180)
        luks_uuid,probe_hash=runtime.expected_storage_identity()
        stage='/home/server/hp-b-pacs-stage-'+operation
        release='/opt/highpass/b-pacs-receiver-'+operation
        payload={'stage':stage,'release':release,'luksUuid':luks_uuid,'probeHash':probe_hash,'images':IMAGES,
                 'files':{name:digest(ROOT/path) for name,path in FILES.items()},'archiveSha256':digest(archive)}
        result['sourceFiles']=payload['files']
        result['imageArchiveSha256']=payload['archiveSha256']
        credential=runtime.read_b_credential(gui=args.gui)
        client=runtime.check.connect('B',credential)
        sftp=client.open_sftp()
        try:
            try:sftp.mkdir(stage,mode=0o700)
            except OSError:
                if not args.resume:raise
            try:sftp.mkdir(stage+'/orthanc',mode=0o700)
            except OSError:
                if not args.resume:raise
            for name,path in FILES.items():sftp.put(str(ROOT/path),stage+'/'+name,confirm=True)
            sftp.put(str(archive),stage+'/images.tar',confirm=True)
        finally:sftp.close()
        result['phase']='REMOTE_STORAGE_KEYS_AND_IMAGES'
        prepared=runtime.check.remote(client,'B',credential,'request='+repr({**payload,'phase':'prepare'})+'\n'+GUEST,180)
        result.update({key:value for key,value in prepared.items() if key!='csrs'})
        payload['portalBaseline']=prepared['portalBaseline']
        for role in ['server','client']:
            csr_path=folder/('b-pacs-'+role+'.csr');certificate=folder/('b-pacs-'+role+'.crt')
            csr=x509.load_pem_x509_csr(prepared['csrs'][role].encode())
            if not csr.is_signature_valid:raise RuntimeError('CSR_SIGNATURE_INVALID')
            csr_path.write_text(prepared['csrs'][role],encoding='ascii')
            if not certificate.exists():
                local([OPENSSL,'x509','-req','-sha256','-days','30','-in',str(csr_path),'-CA',str(ca_path),
                       '-CAkey',str(ROOT/'tmp/certs/mtls/ca.key'),'-set_serial','0x'+uuid.uuid4().hex,
                       '-extfile',str(ROOT/'config'/('b-pacs-mtls-'+role+'.ext')),'-out',str(certificate)])
            purpose='sslserver' if role=='server' else 'sslclient'
            verify=[OPENSSL,'verify','-CAfile',str(ca_path),'-purpose',purpose]
            if role=='server':verify+=['-verify_hostname','b-pacs-mtls']
            local(verify+[str(certificate)])
            cert=x509.load_pem_x509_certificate(certificate.read_bytes())
            if cert.public_key().public_numbers()!=csr.public_key().public_numbers() or cert.not_valid_after_utc>ca.not_valid_after_utc:
                raise RuntimeError('CERTIFICATE_KEY_OR_CA_LIFETIME_INVALID')
            san=cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
            if role=='client' and san.get_values_for_type(x509.UniformResourceIdentifier)!=['spiffe://highpass.local/hospital-b/pacs-receiver']:
                raise RuntimeError('CLIENT_CERTIFICATE_SAN_INVALID')
        certificates={('b-pacs-'+role+'.crt'):folder/('b-pacs-'+role+'.crt') for role in ['server','client']}
        certificates['ca.crt']=ca_path
        sftp=client.open_sftp()
        try:
            for name,path in certificates.items():sftp.put(str(path),stage+'/'+name,confirm=True)
        finally:sftp.close()
        result['phase']='REMOTE_CERTIFICATES_AND_STOPPED_CONTAINERS'
        finished=runtime.check.remote(client,'B',credential,'request='+repr({**payload,'phase':'finish',
            'certificates':{name:digest(path) for name,path in certificates.items()}})+'\n'+GUEST,150)
        result.update(finished)
        if archive.exists():archive.unlink()
    except Exception as error:
        result['status']='FAIL'
        result['reason']=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__
    finally:
        try:
            if client is not None:client.close()
        finally:credential=None
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
