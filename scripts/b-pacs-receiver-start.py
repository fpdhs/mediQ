"""B root-only fail-closed launch gate; never unlocks, formats or restarts at boot."""
import argparse
import importlib.util
import json
import os
import pathlib
import re
import subprocess

MOUNT=pathlib.Path('/opt/highpass/b-pacs-encrypted')
DEVICE='/dev/mapper/highpass-b-pacs'
BACKING=pathlib.Path('/opt/highpass/b-pacs-storage/volume-8g.luks')

def validate_boundary(manifest, mount_source, dm_uuid, backing, mounted):
    expected='CRYPT-LUKS2-'+manifest['luksUuid'].replace('-','')+'-highpass-b-pacs'
    if not mounted or mount_source!=DEVICE or dm_uuid!=expected or pathlib.Path(backing)!=BACKING:
        raise RuntimeError('PACS_ENCRYPTED_MOUNT_REQUIRED')

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
    source=guest.run(['findmnt','-n','-o','SOURCE','--mountpoint',str(MOUNT)])
    uuid=pathlib.Path('/sys/class/block',os.path.basename(os.path.realpath(DEVICE)),'dm/uuid').read_text().strip()
    state=guest.run(['cryptsetup','status',guest.MAPPING])
    loop=re.search(r'(?m)^\s*device:\s*(/dev/loop\d+)\s*$',state)
    if not loop:raise RuntimeError('OWNED_LOOP_REQUIRED')
    backing=guest.run(['losetup','--noheadings','--output','BACK-FILE',loop.group(1)])
    validate_boundary(manifest,source,uuid,backing,True)
    # Inspect rendered configuration before any Docker write.
    cmd=['docker','compose','-p','hp-b-pacs-receiver','--env-file',args.env_file,'-f',args.compose]
    rendered=json.loads(subprocess.check_output(cmd+['config','--format','json'],timeout=15))
    services=rendered.get('services',{})
    if set(services)!={'b-orthanc','b-pacs-mtls'}:raise RuntimeError('EXACT_RECEIVER_SERVICES_REQUIRED')
    for service in services.values():
        if service.get('restart')!='no' or service.get('ports') or not re.search(r'@sha256:[a-f0-9]{64}$',service.get('image','')):
            raise RuntimeError('MANUAL_PINNED_PRIVATE_RECEIVER_REQUIRED')
        if not any(v.get('type')=='bind' and v.get('source')==str(MOUNT) and v.get('bind',{}).get('create_host_path') is False for v in service.get('volumes',[])):
            raise RuntimeError('EXACT_MOUNT_BIND_REQUIRED')
    if not args.check_only:subprocess.run(cmd+['up','-d','--no-build'],check=True,timeout=90)
    print(json.dumps({'status':'PASS','checkOnly':args.check_only,'luksUuid':manifest['luksUuid'],'automaticBootStart':False}))

if __name__=='__main__':main()
