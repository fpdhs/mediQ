"""B root-only fail-closed launch gate; never unlocks, formats or restarts at boot."""
import argparse
import importlib.util
import json
import os
import pathlib
import re
import stat
import subprocess

ENCRYPTED_MOUNT='/opt/highpass/b-pacs-encrypted'
MOUNT=pathlib.Path(ENCRYPTED_MOUNT)
ORTHANC_DATA_SOURCE=ENCRYPTED_MOUNT+'/orthanc-db'
ORTHANC_DATA=pathlib.Path(ORTHANC_DATA_SOURCE)
ORTHANC_UID=10001
ORTHANC_GID=10001
DEVICE='/dev/mapper/highpass-b-pacs'
BACKING=pathlib.Path('/opt/highpass/b-pacs-storage/volume-8g.luks')

def validate_boundary(manifest, mount_source, dm_uuid, backing, mounted):
    expected='CRYPT-LUKS2-'+manifest['luksUuid'].replace('-','')+'-highpass-b-pacs'
    if not mounted or mount_source!=DEVICE or dm_uuid!=expected or pathlib.Path(backing)!=BACKING:
        raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')

def validate_orthanc_data(mount_stat, directory_stat, is_symlink=False):
    if (is_symlink or not stat.S_ISDIR(directory_stat.st_mode)
        or directory_stat.st_dev!=mount_stat.st_dev or directory_stat.st_uid!=ORTHANC_UID
        or directory_stat.st_gid!=ORTHANC_GID or stat.S_IMODE(directory_stat.st_mode)!=0o700):
        raise RuntimeError('ORTHANC_ENCRYPTED_DATA_DIRECTORY_INVALID')

def validate_secret_directory(directory_stat, is_symlink=False):
    if (is_symlink or not stat.S_ISDIR(directory_stat.st_mode) or directory_stat.st_uid!=0
        or directory_stat.st_gid!=65532 or stat.S_IMODE(directory_stat.st_mode)!=0o750):
        raise RuntimeError('B_PACS_SECRET_DIRECTORY_PERMISSIONS_INVALID')

def validate_secret_file(file_stat, is_symlink=False):
    if (is_symlink or not stat.S_ISREG(file_stat.st_mode) or file_stat.st_uid!=0
        or file_stat.st_gid!=65532 or stat.S_IMODE(file_stat.st_mode)!=0o440):
        raise RuntimeError('B_PACS_SECRET_FILE_PERMISSIONS_INVALID')

def validate_orthanc_config(config):
    expected={
        'Name':'Highpass B Synthetic Test PACS - Not For Clinical Use',
        'StorageDirectory':'/var/lib/orthanc/db',
        'IndexDirectory':'/var/lib/orthanc/db',
        'Plugins':['/usr/local/share/orthanc/plugins'],
        'DicomServerEnabled':False,
        'HttpServerEnabled':True,
        'HttpPort':8042,
        'RemoteAccessAllowed':True,
        'AuthenticationEnabled':False,
        'MaximumStorageSize':6144,
        'MaximumStorageMode':'Reject',
        'RestApiWriteToFileSystemEnabled':False,
        'OverwriteInstances':False,
    }
    if not isinstance(config,dict) or any(config.get(key)!=value for key,value in expected.items()):
        raise RuntimeError('ORTHANC_RECEIVER_CONFIG_INVALID')

def validate_compose_config(rendered, expected_luks_uuid):
    if not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',expected_luks_uuid):
        raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')
    services=rendered.get('services',{})
    networks=rendered.get('networks',{})
    if set(services)!={'b-orthanc','b-pacs-mtls'} or set(networks)!={'b_pacs_private','b_pacs_receiver'}:
        raise RuntimeError('EXACT_RECEIVER_SERVICES_REQUIRED')
    if any(network.get('internal') is not True for network in networks.values()):
        raise RuntimeError('PRIVATE_RECEIVER_NETWORK_REQUIRED')
    expected_networks={'b-orthanc':{'b_pacs_private'},'b-pacs-mtls':{'b_pacs_private','b_pacs_receiver'}}
    for name,service in services.items():
        if service.get('restart')!='no' or service.get('ports') or service.get('privileged') is True \
          or not (re.search(r'@sha256:[a-f0-9]{64}$',service.get('image',''))
            or (re.fullmatch(r'sha256:[a-f0-9]{64}',service.get('image','')) and service.get('pull_policy')=='never')):
            raise RuntimeError('MANUAL_PINNED_PRIVATE_RECEIVER_REQUIRED')
        if service.get('read_only') is not True or 'ALL' not in service.get('cap_drop',[]) \
          or 'no-new-privileges:true' not in service.get('security_opt',[]) or service.get('cap_add') \
          or service.get('devices') or service.get('volumes_from') or service.get('network_mode'):
            raise RuntimeError('RECEIVER_CONTAINER_HARDENING_REQUIRED')
        expected_volume_count=2 if name=='b-orthanc' else 4
        if len(service.get('volumes',[]))!=expected_volume_count:
            raise RuntimeError('RECEIVER_VOLUME_SET_INVALID')
        if set(service.get('networks',{}))!=expected_networks[name]:
            raise RuntimeError('PRIVATE_RECEIVER_NETWORK_REQUIRED')
        expected_source=ORTHANC_DATA_SOURCE if name=='b-orthanc' else ENCRYPTED_MOUNT
        if not any(volume.get('type')=='bind' and volume.get('source')==expected_source
          and volume.get('bind',{}).get('create_host_path') is not True for volume in service.get('volumes',[])):
            raise RuntimeError('EXACT_MOUNT_BIND_REQUIRED')
    orthanc=services['b-orthanc']
    if orthanc.get('user')!='10001:10001':
        raise RuntimeError('ORTHANC_NONROOT_REQUIRED')
    config_mounts=[v for v in orthanc.get('volumes',[]) if v.get('target')=='/etc/orthanc/orthanc.json']
    if (len(config_mounts)!=1 or pathlib.Path(config_mounts[0].get('source','')).name!='hospital-b-receiver.json'
        or config_mounts[0].get('read_only') is not True):
        raise RuntimeError('ORTHANC_RECEIVER_CONFIG_BIND_REQUIRED')
    secret_targets={'/run/secrets/b-pacs-server.crt','/run/secrets/b-pacs-server.key','/run/secrets/ca.crt'}
    secret_mounts=[v for v in services['b-pacs-mtls'].get('volumes',[]) if v.get('target') in secret_targets]
    if (len(secret_mounts)!=3 or {v.get('target') for v in secret_mounts}!=secret_targets
        or any(v.get('type')!='bind' or v.get('read_only') is not True
          or pathlib.Path(v.get('source','')).name!=pathlib.Path(v.get('target','')).name for v in secret_mounts)):
        raise RuntimeError('B_PACS_SECRET_MOUNT_REQUIRED')
    orthanc_mounts=[v for v in orthanc.get('volumes',[]) if v.get('target')=='/var/lib/orthanc/db']
    boundary_mounts=[v for v in services['b-pacs-mtls'].get('volumes',[]) if v.get('target')=='/run/pacs-storage-check']
    if len(orthanc_mounts)!=1 or orthanc_mounts[0].get('source')!=ORTHANC_DATA_SOURCE or orthanc_mounts[0].get('read_only') is True:
        raise RuntimeError('ORTHANC_ENCRYPTED_DATA_BIND_REQUIRED')
    if len(boundary_mounts)!=1 or boundary_mounts[0].get('source')!=ENCRYPTED_MOUNT or boundary_mounts[0].get('read_only') is not True:
        raise RuntimeError('READONLY_BOUNDARY_MOUNT_REQUIRED')
    if services['b-pacs-mtls'].get('environment',{}).get('B_PACS_ENCRYPTED_LUKS_UUID')!=expected_luks_uuid:
        raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')
    dependency=services['b-pacs-mtls'].get('depends_on',{}).get('b-orthanc',{})
    if dependency.get('condition')!='service_healthy':
        raise RuntimeError('ORTHANC_READINESS_REQUIRED')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--compose',required=True);parser.add_argument('--env-file',required=True);parser.add_argument('--check-only',action='store_true');args=parser.parse_args()
    if os.geteuid()!=0:raise RuntimeError('ROOT_REQUIRED')
    guest_path=pathlib.Path(__file__).with_name('b-pacs-storage-guest.py')
    spec=importlib.util.spec_from_file_location('storage_start_guard',guest_path)
    guest=importlib.util.module_from_spec(spec);spec.loader.exec_module(guest)
    guest.secure_file(guest.MANIFEST)
    manifest=guest.validate_manifest(json.loads(guest.MANIFEST.read_text()))
    guest.secure_file(BACKING)
    if BACKING.stat().st_size!=guest.SIZE:raise RuntimeError('STORAGE_SIZE_CHANGED')
    if not os.path.ismount(MOUNT):raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')
    if ORTHANC_DATA.is_symlink() or not ORTHANC_DATA.exists():raise RuntimeError('ORTHANC_ENCRYPTED_DATA_DIRECTORY_INVALID')
    validate_orthanc_data(MOUNT.stat(),ORTHANC_DATA.lstat(),ORTHANC_DATA.is_symlink())
    compose_path=pathlib.Path(args.compose).resolve()
    config_path=compose_path.parent/'orthanc'/'hospital-b-receiver.json'
    if config_path.is_symlink() or not config_path.is_file():raise RuntimeError('ORTHANC_RECEIVER_CONFIG_REQUIRED')
    config_stat=config_path.lstat()
    if not stat.S_ISREG(config_stat.st_mode) or config_stat.st_uid!=0 or stat.S_IMODE(config_stat.st_mode)&0o022:
        raise RuntimeError('ORTHANC_RECEIVER_CONFIG_PERMISSIONS_INVALID')
    validate_orthanc_config(json.loads(config_path.read_text()))
    source=guest.run(['findmnt','-n','-o','SOURCE','--mountpoint',str(MOUNT)])
    uuid=pathlib.Path('/sys/class/block',os.path.basename(os.path.realpath(DEVICE)),'dm/uuid').read_text().strip()
    state=guest.run(['cryptsetup','status',guest.MAPPING])
    loop=re.search(r'(?m)^\s*device:\s*(/dev/loop\d+)\s*$',state)
    if not loop:raise RuntimeError('OWNED_LOOP_REQUIRED')
    backing=guest.run(['losetup','--noheadings','--output','BACK-FILE',loop.group(1)])
    validate_boundary(manifest,source,uuid,backing,True)
    # Pin the container's request-time guard to the UUID in the root-only manifest.
    compose_env=os.environ.copy()
    compose_env['B_PACS_ENCRYPTED_LUKS_UUID']=manifest['luksUuid']
    # Inspect rendered configuration before any Docker write.
    cmd=['docker','compose','-p','hp-b-pacs-receiver','--env-file',args.env_file,'-f',args.compose]
    rendered=json.loads(subprocess.check_output(cmd+['config','--format','json'],timeout=15,env=compose_env))
    validate_compose_config(rendered,manifest['luksUuid'])
    for service in rendered['services'].values():
        reference=service['image']
        actual=subprocess.check_output(['docker','image','inspect',reference,'--format','{{.Id}}'],timeout=10).decode().strip()
        if not re.fullmatch(r'sha256:[a-f0-9]{64}',actual) or (reference.startswith('sha256:') and actual!=reference):
            raise RuntimeError('RECEIVER_LOCAL_IMAGE_ID_MISMATCH')
    secret_volumes=[v for v in rendered['services']['b-pacs-mtls']['volumes'] if v.get('target') in {
        '/run/secrets/b-pacs-server.crt','/run/secrets/b-pacs-server.key','/run/secrets/ca.crt'}]
    secret_paths=[pathlib.Path(v['source']) for v in secret_volumes]
    secret_dirs={path.parent for path in secret_paths}
    if len(secret_dirs)!=1:raise RuntimeError('B_PACS_SECRET_DIRECTORY_REQUIRED')
    secret_dir=secret_dirs.pop()
    validate_secret_directory(secret_dir.lstat(),secret_dir.is_symlink())
    for secret_path in secret_paths:
        validate_secret_file(secret_path.lstat(),secret_path.is_symlink())
    if not args.check_only:subprocess.run(cmd+['up','-d','--no-build'],check=True,timeout=90,env=compose_env)
    print(json.dumps({'status':'PASS','checkOnly':args.check_only,'luksUuid':manifest['luksUuid'],'automaticBootStart':False}))

if __name__=='__main__':main()
