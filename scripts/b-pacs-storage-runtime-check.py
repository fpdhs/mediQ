"""Read-only B storage verification plus one disposable, no-network boundary probe."""
import getpass
import hashlib
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_storage_runtime',ROOT/'scripts/health-helper-runtime-check.py')
check=importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)


def main():
    credential=getpass.getpass('B VM password (concealed): ')
    client=check.connect('B',credential)
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    js=(ROOT/'src/b-pacs-storage-boundary.js').read_text()+"\nassertBPacsEncryptedMount(); console.log(JSON.stringify({status:'PASS'}));"
    program='''import json,subprocess,pathlib,hashlib,os
def run(args):
 p=subprocess.run(args,capture_output=True,timeout=25)
 return dict(exitCode=p.returncode,stdout=p.stdout.decode().strip(),errorType='COMMAND_FAILED' if p.returncode else None)
portal=json.loads(run(['docker','inspect','hp-capstone-b-portal-portal-1'])['stdout'])[0]
image=portal['Image']
probe=run(['docker','run','--rm','--name','''+repr('hp-b-storage-boundary-'+stamp.lower())+''','--label','highpass.scope=storage-boundary-probe','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','65532:65532','--mount','type=bind,src=/opt/highpass/b-pacs-encrypted,dst=/run/pacs-storage-check,readonly','--entrypoint','/nodejs/bin/node',image,'--input-type=module','-e','''+repr(js)+'''])
dump=run(['cryptsetup','luksDump','--dump-json-metadata','/opt/highpass/b-pacs-storage/volume-8g.luks'])
metadata=json.loads(dump['stdout']) if dump['exitCode']==0 else {}
stats=os.statvfs('/opt/highpass/b-pacs-encrypted')
files=sorted(p.name for p in pathlib.Path('/opt/highpass/b-pacs-encrypted').iterdir())
probe_hash=hashlib.sha256(pathlib.Path('/opt/highpass/b-pacs-encrypted/.storage-recovery-probe').read_bytes()).hexdigest()
print(json.dumps(dict(observedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),review='DRAFT / UNASSIGNED',
 boundaryProbe=probe,probeImage=image,boundaryProbeCodeSha256=hashlib.sha256('''+repr(js)+'''.encode()).hexdigest(),
 backingBytes=pathlib.Path('/opt/highpass/b-pacs-storage/volume-8g.luks').stat().st_size,
 filesystemBytes=stats.f_blocks*stats.f_frsize,availableBytes=stats.f_bavail*stats.f_frsize,
 luksSegments=metadata.get('segments'),kdfTypes=[v.get('kdf',{}).get('type') for v in metadata.get('keyslots',{}).values()],
 encryptedMountFiles=files,recoveryProbeHash=probe_hash,portalImage=portal['Image'],portalHealth=portal['State'].get('Health',{}).get('Status'),
 hostMount=json.loads(run(['findmnt','-J','-o','TARGET,SOURCE,FSTYPE,OPTIONS','--mountpoint','/opt/highpass/b-pacs-encrypted'])['stdout']))))'''
    try:
        result=check.remote(client,'B',credential,program,50)
    finally:
        client.close()
        credential=None
    folder=ROOT/'artifacts/workstation'/('b-storage-runtime-'+stamp)
    folder.mkdir(parents=True,exist_ok=False)
    initial=json.loads((ROOT/'artifacts/workstation/b-storage-provision-20261013T013045Z/result.json').read_text())
    expected=next(c['recoveryProbeHash'] for c in initial['checks'] if c['test']=='KEY_PROTECTION_AND_STORAGE_CREATE' and c['status']=='PASS')
    result['probeContentPreserved']=result['recoveryProbeHash']==expected
    result['status']='PASS' if result['boundaryProbe']['exitCode']==0 and result['portalHealth']=='healthy' and result['backingBytes']==8589934592 and result['probeContentPreserved'] else 'FAIL'
    (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))
    return 0 if result['status']=='PASS' else 1


if __name__=='__main__':raise SystemExit(main())
