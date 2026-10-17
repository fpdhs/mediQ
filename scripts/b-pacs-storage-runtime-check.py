"""Read-only B storage verification plus one disposable, no-network boundary probe."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import pathlib
import re
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_storage_runtime',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)

def expected_storage_identity():
    created=json.loads((ROOT/'artifacts/workstation/b-storage-provision-20261013T013045Z/result.json').read_text())
    recovered=json.loads((ROOT/'artifacts/workstation/b-storage-provision-20261013T013712Z/result.json').read_text())
    creation=next((c for c in created.get('checks',[]) if c.get('test')=='KEY_PROTECTION_AND_STORAGE_CREATE' and c.get('status')=='PASS'),None)
    recovery=next((c for c in recovered.get('checks',[]) if c.get('test')=='KEY_PROTECTION_AND_STORAGE_RECOVERY' and c.get('status')=='PASS'),None)
    luks_uuid=recovery.get('luksUuid') if recovery else None
    probe_hash=creation.get('recoveryProbeHash') if creation else None
    if not isinstance(luks_uuid,str) or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',luks_uuid) \
      or not isinstance(probe_hash,str) or not re.fullmatch(r'[a-f0-9]{64}',probe_hash):
        raise RuntimeError('PRIOR_STORAGE_IDENTITY_EVIDENCE_REQUIRED')
    return luks_uuid,probe_hash

def validate_runtime_result(result, expected_luks_uuid, expected_probe_hash):
    mounts=result.get('hostMount',{}).get('filesystems',[])
    mount=mounts[0] if len(mounts)==1 else {}
    options=set(mount.get('options','').split(','))
    segments=result.get('luksSegments')
    segment=segments.get('0') if isinstance(segments,dict) else None
    image=result.get('portalImage','')
    image_id=result.get('portalImageId','')
    expected_mount=(mount.get('target')=='/opt/highpass/b-pacs-encrypted'
      and mount.get('source')=='/dev/mapper/highpass-b-pacs' and mount.get('fstype')=='ext4'
      and {'rw','nodev','nosuid','noexec'}.issubset(options))
    expected_crypto=(result.get('luksUuid')==expected_luks_uuid and isinstance(segments,dict)
      and set(segments)=={'0'} and isinstance(segment,dict) and segment.get('type')=='crypt'
      and segment.get('encryption')=='aes-xts-plain64'
      and 'argon2id' in result.get('kdfTypes',[]))
    orthanc=result.get('orthancData',{})
    expected_orthanc=(orthanc.get('path')=='/opt/highpass/b-pacs-encrypted/orthanc-db'
      and orthanc.get('isDirectory') is True and orthanc.get('isSymlink') is False
      and orthanc.get('sameFilesystem') is True and orthanc.get('uid')==10001
      and orthanc.get('gid')==10001 and orthanc.get('mode')==0o700)
    runtime=result.get('orthancRuntime',{})
    data_mount=runtime.get('dataMount',{})
    expected_orthanc_runtime=(runtime.get('service')=='b-orthanc' and runtime.get('running') is True
      and runtime.get('health')=='healthy' and isinstance(runtime.get('image'),str)
      and (re.search(r'@sha256:[a-f0-9]{64}$',runtime.get('image',''))
        or (runtime.get('image')==runtime.get('imageId') and re.fullmatch(r'sha256:[a-f0-9]{64}',runtime.get('image',''))))
      and isinstance(runtime.get('imageId'),str) and re.fullmatch(r'sha256:[a-f0-9]{64}',runtime['imageId'])
      and runtime.get('user')=='10001:10001'
      and runtime.get('readOnlyRootfs') is True and runtime.get('privileged') is False
      and 'ALL' in runtime.get('capDrop',[]) and runtime.get('publishedPorts') is False
      and runtime.get('bindMountCount')==2 and runtime.get('writableBindCount')==1
      and runtime.get('configMountReadOnly') is True
      and data_mount.get('type')=='bind' and data_mount.get('source')=='/opt/highpass/b-pacs-encrypted/orthanc-db'
      and data_mount.get('destination')=='/var/lib/orthanc/db' and data_mount.get('rw') is True)
    if not (result.get('boundaryProbe',{}).get('exitCode')==0 and result.get('portalHealth')=='healthy'
      and isinstance(image,str) and (re.search(r'@sha256:[a-f0-9]{64}$',image)
        or (image==image_id and re.fullmatch(r'sha256:[a-f0-9]{64}',image)))
      and isinstance(image_id,str) and re.fullmatch(r'sha256:[a-f0-9]{64}',image_id)
      and result.get('probeImage')==image and result.get('probeImageId')==image_id
      and expected_mount and expected_crypto
      and expected_orthanc and expected_orthanc_runtime
      and result.get('backingBytes')==8589934592 and result.get('probeContentPreserved') is True
      and result.get('recoveryProbeHash')==expected_probe_hash and result.get('recoveryProbePresent') is True
      and result.get('manifestValid') is True and result.get('manifestLuksUuid')==expected_luks_uuid
      and isinstance(result.get('filesystemBytes'),int) and result['filesystemBytes']>0
      and isinstance(result.get('availableBytes'),int) and 0<=result['availableBytes']<=result['filesystemBytes']):
        raise RuntimeError('B_STORAGE_RUNTIME_VERIFICATION_FAILED')

def build_remote_program(stamp, js, expected_luks_uuid):
    if not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',expected_luks_uuid):
        raise RuntimeError('PRIOR_STORAGE_IDENTITY_EVIDENCE_REQUIRED')
    return f'''import json,subprocess,pathlib,hashlib,os,stat
def run(args):
 p=subprocess.run(args,capture_output=True,timeout=25)
 return dict(exitCode=p.returncode,stdout=p.stdout.decode().strip(),errorType='COMMAND_FAILED' if p.returncode else None)
def collect_luks_evidence(backing_path):
 uuid_probe=run(['cryptsetup','luksUUID',backing_path])
 dump=run(['cryptsetup','luksDump','--dump-json-metadata',backing_path])
 if uuid_probe['exitCode'] or dump['exitCode']:
  raise RuntimeError('LUKS_READ_ONLY_PROBE_FAILED')
 metadata=json.loads(dump['stdout'])
 return dict(luksUuid=uuid_probe['stdout'],luksSegments=metadata.get('segments'),
  kdfTypes=[v.get('kdf',{{}}).get('type') for v in metadata.get('keyslots',{{}}).values()])
expected_luks_uuid={expected_luks_uuid!r}
manifest_path=pathlib.Path('/opt/highpass/b-pacs-storage/storage.json')
manifest_stat=os.lstat(manifest_path)
manifest=json.loads(manifest_path.read_text())
manifest_valid=(stat.S_ISREG(manifest_stat.st_mode) and manifest_stat.st_uid==0 and (manifest_stat.st_mode & 0o777)==0o600
 and manifest.get('schema')=='HIGHPASS_B_STORAGE_V1' and manifest.get('role')=='B'
 and manifest.get('sizeBytes')==8589934592 and manifest.get('backingFile')=='/opt/highpass/b-pacs-storage/volume-8g.luks'
 and manifest.get('mount')=='/opt/highpass/b-pacs-encrypted' and manifest.get('mapping')=='highpass-b-pacs'
 and manifest.get('luksUuid')==expected_luks_uuid)
portal=json.loads(run(['docker','inspect','hp-capstone-b-portal-portal-1'])['stdout'])[0]
image=portal['Image']
image_ref=portal.get('Config',{{}}).get('Image','')
probe_name={'hp-b-storage-boundary-'+stamp.lower()!r}
probe_js={js!r}
probe=run(['docker','run','--rm','--name',probe_name,'--label','highpass.scope=storage-boundary-probe','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65532:65532','--env','B_PACS_ENCRYPTED_LUKS_UUID='+expected_luks_uuid,'--mount','type=bind,src=/opt/highpass/b-pacs-encrypted,dst=/run/pacs-storage-check,readonly','--entrypoint','/nodejs/bin/node',image,'--input-type=module','-e',probe_js])
crypto=collect_luks_evidence('/opt/highpass/b-pacs-storage/volume-8g.luks')
stats=os.statvfs('/opt/highpass/b-pacs-encrypted')
mount_stat=os.stat('/opt/highpass/b-pacs-encrypted')
orthanc_path=pathlib.Path('/opt/highpass/b-pacs-encrypted/orthanc-db')
try:
 orthanc_lstat=orthanc_path.lstat()
 orthanc_data=dict(path=str(orthanc_path),isDirectory=stat.S_ISDIR(orthanc_lstat.st_mode),isSymlink=orthanc_path.is_symlink(),
  sameFilesystem=orthanc_lstat.st_dev==mount_stat.st_dev,uid=orthanc_lstat.st_uid,gid=orthanc_lstat.st_gid,mode=stat.S_IMODE(orthanc_lstat.st_mode))
except FileNotFoundError:
 orthanc_data=dict(path=str(orthanc_path),isDirectory=False,isSymlink=False,sameFilesystem=False,uid=None,gid=None,mode=None)
sentinel=pathlib.Path('/opt/highpass/b-pacs-encrypted/.storage-recovery-probe')
probe_hash=hashlib.sha256(sentinel.read_bytes()).hexdigest() if sentinel.is_file() else None
ids=run(['docker','ps','-a','--filter','label=com.docker.compose.project=hp-b-pacs-receiver',
 '--filter','label=com.docker.compose.service=b-orthanc','--format','{{{{.ID}}}}'])
orthanc_ids=[value for value in ids['stdout'].splitlines() if value] if ids['exitCode']==0 else []
orthanc_runtime={{'service':None,'running':False,'health':None,'image':None,'imageId':None,'user':None,'readOnlyRootfs':False,
 'privileged':None,'capDrop':[],'publishedPorts':True,'bindMountCount':0,'writableBindCount':0,
 'configMountReadOnly':False,'dataMount':{{}}}}
if len(orthanc_ids)==1:
 inspected=run(['docker','inspect',orthanc_ids[0]])
 containers=json.loads(inspected['stdout']) if inspected['exitCode']==0 else []
 if len(containers)==1:
  container=containers[0]; config=container.get('Config',{{}}); host=container.get('HostConfig',{{}})
  mounts=[mount for mount in container.get('Mounts',[]) if mount.get('Type')=='bind']
  data=[mount for mount in mounts if mount.get('Destination')=='/var/lib/orthanc/db']
  config_mount=[mount for mount in mounts if mount.get('Destination')=='/etc/orthanc/orthanc.json']
  writable=[mount for mount in mounts if mount.get('RW') is True]
  state=container.get('State',{{}})
  orthanc_runtime={{'service':config.get('Labels',{{}}).get('com.docker.compose.service'),
   'running':state.get('Running') is True and state.get('Status')=='running',
   'health':state.get('Health',{{}}).get('Status'),'image':config.get('Image'),'imageId':container.get('Image'),'user':config.get('User'),
   'readOnlyRootfs':host.get('ReadonlyRootfs') is True,'privileged':host.get('Privileged'),
   'capDrop':host.get('CapDrop',[]),'publishedPorts':bool(host.get('PortBindings')),
   'bindMountCount':len(mounts),'writableBindCount':len(writable),
   'configMountReadOnly':len(config_mount)==1 and config_mount[0].get('RW') is False,
   'dataMount':{{'type':data[0].get('Type'),'source':os.path.realpath(data[0].get('Source','')),
    'destination':data[0].get('Destination'),'rw':data[0].get('RW')}} if len(data)==1 else {{}}}}
print(json.dumps(dict(observedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),review='DRAFT / UNASSIGNED',
 boundaryProbe=probe,probeImage=image_ref,probeImageId=image,boundaryProbeCodeSha256=hashlib.sha256(probe_js.encode()).hexdigest(),
 backingBytes=pathlib.Path('/opt/highpass/b-pacs-storage/volume-8g.luks').stat().st_size,
 filesystemBytes=stats.f_blocks*stats.f_frsize,availableBytes=stats.f_bavail*stats.f_frsize,
 luksUuid=crypto['luksUuid'],luksSegments=crypto['luksSegments'],kdfTypes=crypto['kdfTypes'],
 manifestValid=manifest_valid,manifestLuksUuid=manifest.get('luksUuid'),
 recoveryProbePresent=sentinel.is_file(),recoveryProbeHash=probe_hash,orthancData=orthanc_data,orthancRuntime=orthanc_runtime,
 portalImage=image_ref,portalImageId=image,portalHealth=portal['State'].get('Health',{{}}).get('Status'),
hostMount=json.loads(run(['findmnt','-J','-o','TARGET,SOURCE,FSTYPE,OPTIONS','--mountpoint','/opt/highpass/b-pacs-encrypted'])['stdout']))))'''


def read_b_credential(gui=False, getpass_fn=None, gui_prompt=None):
    if gui:
        if gui_prompt is None:
            prompt_spec=importlib.util.spec_from_file_location('b_pacs_credential_prompt',ROOT/'scripts/deployment-auth-preflight.py')
            prompt=importlib.util.module_from_spec(prompt_spec)
            prompt_spec.loader.exec_module(prompt)
            gui_prompt=prompt.ask_password_gui
        credential=gui_prompt('B')
    else:
        getpass_fn=getpass_fn or getpass.getpass
        credential=getpass_fn('B VM password (concealed; not saved): ')
    if not credential:
        raise SystemExit('B_CREDENTIAL_INPUT_CANCELLED')
    return credential


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--gui',action='store_true',help='Use the local masked B VM credential dialog')
    args=parser.parse_args()
    expected_luks_uuid,expected_probe_hash=expected_storage_identity()
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    js=(ROOT/'src/b-pacs-storage-boundary.js').read_text()+"\nassertBPacsEncryptedMount(); console.log(JSON.stringify({status:'PASS'}));"
    program=build_remote_program(stamp,js,expected_luks_uuid)
    credential=read_b_credential(gui=args.gui)
    client=None
    try:
        client=check.connect('B',credential)
        result=check.remote(client,'B',credential,program,50)
    finally:
        if client is not None:
            client.close()
        credential=None
    folder=ROOT/'artifacts/workstation'/('b-storage-runtime-'+stamp)
    folder.mkdir(parents=True,exist_ok=False)
    result['probeContentPreserved']=result.get('recoveryProbeHash')==expected_probe_hash
    try:
        validate_runtime_result(result,expected_luks_uuid,expected_probe_hash)
        result['status']='PASS'
    except RuntimeError:
        result['status']='FAIL'
        result['verificationFailure']='B_STORAGE_RUNTIME_VERIFICATION_FAILED'
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))
    return 0 if result['status']=='PASS' else 1


if __name__=='__main__':raise SystemExit(main())
