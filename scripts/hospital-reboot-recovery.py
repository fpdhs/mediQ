"""Pinned A/B reboot diagnosis. Password is concealed stdin only, never saved."""
import argparse
import base64
import getpass
import hashlib
import importlib.util
import json
import pathlib
import re
import shlex
from datetime import datetime, timezone

import paramiko

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('reboot_runtime', ROOT / 'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

SNAPSHOT = r'''
import subprocess,json,pathlib,os
def call(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=12)
 return dict(code=p.returncode,output=p.stdout.strip())
names=call(['docker','ps','-aq'])
containers=[]
if names['code']==0 and names['output']:
 for item in json.loads(subprocess.check_output(['docker','inspect',*names['output'].split()],timeout=12)):
  state=item['State']
  containers.append(dict(name=item['Name'].lstrip('/'),id=item['Id'],image=item['Image'],
   state=state['Status'],running=state['Running'],health=state.get('Health',{}).get('Status'),
   exitCode=state['ExitCode'],restart=item['HostConfig']['RestartPolicy'],
   startedAt=state['StartedAt'],finishedAt=state['FinishedAt'],
   mounts=[dict(source=m['Source'],destination=m['Destination'],rw=m['RW']) for m in item['Mounts']],
   networks=list(item.get('NetworkSettings',{}).get('Networks',{})),
   ports=item['HostConfig'].get('PortBindings'),
   composeFiles=item['Config'].get('Labels',{}).get('com.docker.compose.project.config_files')))
units=call(['systemctl','list-unit-files','--type=service','--no-legend','--no-pager'])
selected=[l.split()[0] for l in units['output'].splitlines() if any(w in l.split()[0] for w in ['highpass','capstone','wg-quick','docker'])]
services={unit:call(['systemctl','show',unit,'--property=ActiveState,SubState,UnitFileState,After'])['output'] for unit in selected}
print(json.dumps(dict(host=call(['hostname'])['output'],utc=call(['date','-u','--iso-8601=seconds'])['output'],
 bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
 uptime=call(['uptime','-s'])['output'],mac=pathlib.Path('/sys/class/net/ens33/address').read_text().strip() if pathlib.Path('/sys/class/net/ens33/address').exists() else None,
 interfaces=call(['ip','-j','-4','address','show']),routes=call(['ip','-j','-4','route','show']),
 overlay=call(['wg','show','hp-capstone','latest-handshakes']),
 services=services,containers=containers,
 storage=dict(mounted=os.path.ismount('/opt/highpass/b-pacs-encrypted'),
 mapper=pathlib.Path('/dev/mapper/highpass-b-pacs').exists(),
 manifestPresent=pathlib.Path('/opt/highpass/b-pacs-storage/storage.json').is_file()),
 failedUnits=call(['systemctl','list-units','--failed','--no-legend','--no-pager']))))
'''

DETAILS = r'''
import subprocess,json,pathlib,hashlib
def call(args):
 p=subprocess.run(args,capture_output=True,text=True,timeout=12)
 return dict(code=p.returncode,output=p.stdout.strip())
units={}
for name in ['hp-patient-public-tls.service','wg-quick@hp-capstone.service','docker.service']:
 info=call(['systemctl','show',name,'--property=ActiveState,SubState,UnitFileState,After,Requires,Wants,FragmentPath'])
 content=call(['systemctl','cat',name])
 lines=[line for line in content['output'].splitlines() if line.startswith(('Description=','After=','Requires=','Wants=','ExecStart=','ExecStartPre=','ExecStop=','Restart=','WantedBy='))]
 units[name]=dict(state=info,configuration=lines)
files={}
for name in ['/opt/highpass/patient-public-entry/compose.json','/opt/highpass/patient-public-entry/Caddyfile']:
 path=pathlib.Path(name)
 files[name]=dict(present=path.is_file(),sha256=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None)
 if path.is_file() and path.suffix=='.json':
  obj=json.loads(path.read_bytes());files[name]['services']={k:dict(image=v.get('image'),restart=v.get('restart'),network_mode=v.get('network_mode')) for k,v in obj.get('services',{}).items()}
release=pathlib.Path('/opt/highpass/b-pacs-receiver-1ee2564f78cb4a1aaeb2b01671b0f627')
print(json.dumps(dict(units=units,files=files,receiverFiles=[p.name for p in release.iterdir()] if release.is_dir() else [],
 storageScripts=[p.name for p in pathlib.Path('/opt/highpass').glob('*storage*py')],
 tlsLogIndicators=call(['journalctl','-b','-u','hp-patient-public-tls.service','-u','docker.service','-u','wg-quick@hp-capstone.service','--no-pager','-q','--grep=failed|Failed|Cannot|cannot|Error|error|Started|Starting','-n','35']))))
'''

RESTORE_TLS = r'''
import subprocess,json,pathlib,hashlib,time
def run(args,seconds=20):
 p=subprocess.run(args,capture_output=True,text=True,timeout=seconds)
 if p.returncode:raise RuntimeError('TLS_RECOVERY_COMMAND_FAILED')
 return p.stdout.strip()
if pathlib.Path('/sys/class/net/ens33/address').read_text().strip()!='00:0c:29:a3:9e:1b':raise RuntimeError('VM_ROLE_MISMATCH')
name='hp-patient-public-tls-tls-1'
before=json.loads(run(['docker','inspect',name]))[0]
if before['Image']!='sha256:ea793fa2c13401928e1a975e0d59c864d1f3060615a5d31ac6252b2f84d7a60c':raise RuntimeError('TLS_IMAGE_DRIFT')
paths=['/opt/highpass/patient-public-entry/Caddyfile','/opt/highpass/patient-public-entry/compose.json']
hashes={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in paths}
if hashes[paths[0]]!='d5159a89a6d76214e6e220910777c69906acf9bcc97dca3cf27096dd6185154e':raise RuntimeError('TLS_CONFIG_DRIFT')
for unit in ['docker.service','wg-quick@hp-capstone.service']:run(['systemctl','is-active','--quiet',unit])
run(['systemctl','start','hp-patient-public-tls.service'],40)
run(['systemctl','is-active','--quiet','hp-patient-public-tls.service'])
deadline=time.monotonic()+15
while True:
 after=json.loads(run(['docker','inspect',name]))[0]
 if after['State']['Running']:break
 if time.monotonic()>deadline:raise RuntimeError('TLS_CONTAINER_NOT_READY')
 time.sleep(1)
if before['Id']!=after['Id'] or before['Image']!=after['Image'] or before['Mounts']!=after['Mounts']:raise RuntimeError('TLS_IDENTITY_DRIFT')
if not after['State']['Running'] or hashes!={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in paths}:raise RuntimeError('TLS_RESTORE_NOT_VERIFIED')
print(json.dumps(dict(status='PASS',service='active',sameContainerImageMounts=True,policyConfigPreserved=True)))
'''

RESTORE_RECEIVER = r'''
import subprocess,json,pathlib,time,hashlib
def run(args,seconds=20):
 p=subprocess.run(args,capture_output=True,text=True,timeout=seconds)
 if p.returncode:raise RuntimeError('RECEIVER_GUARD_OR_START_FAILED')
 return p.stdout.strip()
if pathlib.Path('/sys/class/net/ens33/address').read_text().strip()!='00:0c:29:a3:9e:1b':raise RuntimeError('VM_ROLE_MISMATCH')
release='/opt/highpass/b-pacs-receiver-1ee2564f78cb4a1aaeb2b01671b0f627'
names=['hp-b-pacs-receiver-b-orthanc-1','hp-b-pacs-receiver-b-pacs-mtls-1']
before=json.loads(run(['docker','inspect',*names]))
expected=['sha256:1ae2be8fcb622d6d727bca087bfe68a47e390ca808a2f24236770d22b09f9368','sha256:eeba3f5d44b4830b91b9ed35dd19b5bf58d4b03b0332bcb22b4eff34a7443421']
if [c['Image'] for c in before]!=expected:raise RuntimeError('RECEIVER_IMAGE_DRIFT')
guard=['python3',release+'/b-pacs-receiver-start.py','--compose',release+'/receiver.compose.yml','--env-file',release+'/receiver.env','--check-only']
guard_result=json.loads(run(guard,25))
if guard_result.get('status')!='PASS':raise RuntimeError('ENCRYPTED_START_GUARD_REQUIRED')
for index,name in enumerate(names):
 run(['docker','start',name])
 deadline=time.monotonic()+25
 while True:
  item=json.loads(run(['docker','inspect',name]))[0]
  if item['State']['Running'] and item['State'].get('Health',{}).get('Status','healthy')=='healthy':break
  if time.monotonic()>deadline:raise RuntimeError('RECEIVER_HEALTH_TIMEOUT')
  time.sleep(1)
after=json.loads(run(['docker','inspect',*names]))
for old,new in zip(before,after):
 if old['Id']!=new['Id'] or old['Image']!=new['Image'] or old['Mounts']!=new['Mounts']:raise RuntimeError('RECEIVER_IDENTITY_DRIFT')
 if new['HostConfig'].get('PortBindings'):raise RuntimeError('PACS_PORT_EXPOSED')
print(json.dumps(dict(status='PASS',sameContainersImagesMounts=True,encryptedGuard='PASS',pacsPortsPublished=False,
 containers=[dict(name=c['Name'],running=c['State']['Running'],health=c['State'].get('Health',{}).get('Status')) for c in after])))
'''

HARDEN_TLS = r'''
import subprocess,json,pathlib,hashlib,os,time
def run(args,seconds=20):
 p=subprocess.run(args,capture_output=True,text=True,timeout=seconds)
 if p.returncode:raise RuntimeError('TLS_BOOT_CONFIGURATION_FAILED')
 return p.stdout.strip()
if pathlib.Path('/sys/class/net/ens33/address').read_text().strip()!='00:0c:29:a3:9e:1b':raise RuntimeError('VM_ROLE_MISMATCH')
container='hp-patient-public-tls-tls-1'
before=json.loads(run(['docker','inspect',container]))[0]
if not before['State']['Running']:raise RuntimeError('RESTORED_TLS_REQUIRED')
paths=['/opt/highpass/patient-public-entry/Caddyfile','/opt/highpass/patient-public-entry/compose.json']
hashes={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in paths}
for target,content in requested_files.items():
 path=pathlib.Path(target)
 if path.parent.exists() and (path.parent.is_symlink() or path.parent.stat().st_uid!=0):raise RuntimeError('ROOT_DIRECTORY_REQUIRED')
 path.parent.mkdir(mode=0o755,exist_ok=True)
 if path.exists():
  if path.is_symlink() or path.read_text()!=content or path.stat().st_uid!=0:raise RuntimeError('EXISTING_DROPIN_PRESERVED')
 else:
  with path.open('x') as stream:stream.write(content);stream.flush();os.fsync(stream.fileno())
  os.chmod(path,0o644)
run(['systemd-analyze','verify','docker.service','hp-patient-public-tls.service'])
run(['systemctl','daemon-reload'])
if 'hp-patient-public-tls.service' not in run(['systemctl','show','docker.service','--property=Wants','--value']).split():raise RuntimeError('DOCKER_TLS_START_DEPENDENCY_MISSING')
part_of=set(run(['systemctl','show','hp-patient-public-tls.service','--property=PartOf','--value']).split())
if not {'docker.service','wg-quick@hp-capstone.service'}.issubset(part_of):raise RuntimeError('TLS_LIFECYCLE_DEPENDENCY_MISSING')
# Exercise the incident's state: Docker active, dependent TLS stopped.
# Starting the active Docker service must pull its newly configured Wants back up.
try:
 run(['systemctl','stop','hp-patient-public-tls.service'])
 run(['systemctl','start','docker.service'],30)
 deadline=time.monotonic()+20
 while True:
  after=json.loads(run(['docker','inspect',container]))[0]
  if after['State']['Running']:break
  if time.monotonic()>deadline:raise RuntimeError('DOCKER_DEPENDENCY_RECOVERY_FAILED')
  time.sleep(1)
finally:
 if subprocess.run(['systemctl','is-active','--quiet','hp-patient-public-tls.service']).returncode:
  run(['systemctl','start','hp-patient-public-tls.service'],30)
if before['Id']!=after['Id'] or before['Image']!=after['Image'] or before['Mounts']!=after['Mounts']:raise RuntimeError('TLS_IDENTITY_DRIFT')
if hashes!={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in paths}:raise RuntimeError('TLS_POLICY_CONFIG_CHANGED')
print(json.dumps(dict(status='PASS',dependencyRecoveryExercised=True,dockerRestarted=False,actualGuestReboot=False,
 policyConfigPreserved=True,sameTlsContainerImageMounts=True,files={p:hashlib.sha256(v.encode()).hexdigest() for p,v in requested_files.items()})))
'''

TRANSFER_STATUS = r'''
import subprocess,json
statement="BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; SELECT coalesce(json_agg(j),'[]') FROM (SELECT state,total_items,succeeded_items,failed_items,created_at,updated_at FROM capstone_pacs_transfer_jobs ORDER BY created_at DESC LIMIT 10) j; ROLLBACK;"
raw=subprocess.run(['docker','exec','-u','postgres','hp-capstone-control-postgres-1','psql','-X','-qAt','-U','hipass_bootstrap','-d','hipass','-v','ON_ERROR_STOP=1','-c',statement],capture_output=True,text=True,timeout=10)
if raw.returncode:raise RuntimeError('READ_ONLY_TRANSFER_QUERY_FAILED')
print(json.dumps(dict(status='PASS',jobs=json.loads(raw.stdout))))
'''


def image_verification_program(role):
    manifest = json.loads((ROOT/'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json').read_text())
    if manifest.get('datasetType')!='SYNTHETIC' or manifest.get('clinicalUse') is not False or manifest.get('totalInstances')!=700:
        raise RuntimeError('SYNTHETIC_MANIFEST_REQUIRED')
    if manifest.get('canonicalManifestSha256')!='ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721':
        raise RuntimeError('FIXED_MANIFEST_REQUIRED')
    rows=manifest['instances']
    expected=dict(count=700,clinicalUse=False,studyUid=manifest['studyInstanceUID'],seriesUid='2.25.18361638789025095699746776899955737977',
        uidListSha256=hashlib.sha256(json.dumps(sorted(row['sopInstanceUID'] for row in rows),separators=(',',':')).encode()).hexdigest(),
        samples=[dict(uid=rows[i]['sopInstanceUID'],bytes=rows[i]['bytes'],sha256=rows[i]['sha256'],number=rows[i]['instanceNumber']) for i in [0,349,699]])
    script=(ROOT/'scripts/hospital-reboot-verify-images.js').read_text(encoding='utf8')
    container='hp-capstone-a-gateway-gateway-1' if role=='A' else 'hp-b-pacs-receiver-b-pacs-mtls-1'
    return ('import subprocess,json\n'
        +'command='+repr(['docker','exec','-i','--env','HIPASS_REBOOT_ROLE='+role,'--env','HIPASS_REBOOT_SYNTHETIC_EXPECTED='+json.dumps(expected,separators=(',',':')),container,'/nodejs/bin/node','--input-type=module','-'])+'\n'
        +'result=subprocess.run(command,input='+repr(script)+',capture_output=True,text=True,timeout=55)\n'
        +'print(json.dumps(json.loads(result.stdout)))\n')


def validate_receiver_subset(result):
    manifest=json.loads((ROOT/'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json').read_text())
    expected={row['sopInstanceUID']:row for row in manifest['instances']}
    checks=result.get('checks',[])
    raw=next((row for row in checks if row['test']=='RECEIVER_EXISTING_RAW_HASHES'),None)
    if raw is None:
        return result
    good=all(uid in expected for uid in raw['inventorySopUids']) and all(
        row['uid'] in expected and row['sha256']==expected[row['uid']]['sha256'] and row['bytes']==expected[row['uid']]['bytes']
        for row in raw['rawHashes'])
    raw['status']='PASS' if good else 'FAIL'
    raw['manifestSubsetVerified']=good
    result['status']='PASS' if all(row['status']=='PASS' for row in checks) else 'FAIL'
    return result


def connect(role, password):
    if role == 'CLOUD':
        return runtime.connect(role, None)
    receipt = json.loads((runtime.PIN / 'result.json').read_text())
    if receipt.get('status') != 'PASS':
        raise RuntimeError('PRIOR_PIN_RECEIPT_REQUIRED')
    parts = (runtime.PIN / (role + '-public-host.key')).read_text().split()
    key = paramiko.Ed25519Key(data=base64.b64decode(parts[1], validate=True))
    client = paramiko.SSHClient()
    address = runtime.ops.ROLES[role][0]
    client.get_host_keys().add(address, key.get_name(), key)
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    client.connect(address, username='server', password=password, look_for_keys=False,
                   allow_agent=False, timeout=8, banner_timeout=8, auth_timeout=8)
    return client


def remote(client, role, password, program):
    prefix = 'sudo -n ' if role == 'CLOUD' else "sudo -S -p '' "
    code, output = runtime.ops.run(client, prefix + 'timeout 65s python3 -c ' + shlex.quote(program),
                                   credential=None if role == 'CLOUD' else password, seconds=70)
    if code:
        reason = re.search(r'(?m)^RuntimeError: ([A-Z0-9_]+)$',output)
        raise RuntimeError(reason[1] if reason else 'REMOTE_CHECK_FAILED_' + str(code))
    return json.loads(output)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--role', choices=['A', 'B', 'CLOUD', 'ALL'], default='ALL')
    parser.add_argument('--action', choices=['inspect','details','restore-tls','restore-receiver','harden-tls','verify-images','transfer-status'], default='inspect')
    args = parser.parse_args()
    folder = ROOT / 'artifacts/workstation' / ('reboot-recovery-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    folder.mkdir(parents=True, exist_ok=False)
    password = getpass.getpass('A/B VM credential (concealed, not saved): ') if args.role != 'CLOUD' else None
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED', action=args.action, roles={})
    try:
        for role in ['A', 'B', 'CLOUD'] if args.role == 'ALL' else [args.role]:
            client = None
            try:
                client = connect(role, password)
                if args.action != 'inspect':
                    if role != 'B' and args.action not in ['verify-images','transfer-status']:
                        raise RuntimeError('B_ONLY_DETAILS')
                    if args.action=='transfer-status':
                        if role!='CLOUD':raise RuntimeError('CLOUD_ROLE_REQUIRED')
                        program=TRANSFER_STATUS
                    elif args.action=='verify-images':
                        if role not in ['A','B']:raise RuntimeError('HOSPITAL_ROLE_REQUIRED')
                        program=image_verification_program(role)
                    elif args.action=='harden-tls':
                        files={
                          '/etc/systemd/system/docker.service.d/95-highpass-b-public-tls.conf':(ROOT/'infra/workstation/docker-b-public-tls-recovery.conf').read_text(),
                          '/etc/systemd/system/hp-patient-public-tls.service.d/20-highpass-lifecycle.conf':(ROOT/'infra/workstation/b-public-tls-lifecycle.conf').read_text(),
                        }
                        program='requested_files='+repr(files)+'\n'+HARDEN_TLS
                    else:
                        program={'details':DETAILS,'restore-tls':RESTORE_TLS,'restore-receiver':RESTORE_RECEIVER}[args.action]
                    details = remote(client, role, password, program)
                    if args.action=='verify-images' and role=='B':
                        details=validate_receiver_subset(details)
                    result['roles'][role] = details
                    print(json.dumps(dict(role=role,details=details)),flush=True)
                    continue
                snapshot = remote(client, role, password, SNAPSHOT)
                if role != 'CLOUD' and snapshot['mac'] != runtime.ops.ROLES[role][1]:
                    raise RuntimeError('VM_ROLE_MISMATCH')
                result['roles'][role] = snapshot
                print(json.dumps(dict(role=role,host=snapshot['host'],uptime=snapshot['uptime'],storage=snapshot['storage'],
                    containers=[{k:c[k] for k in ['name','state','health','restart']} for c in snapshot['containers']],
                    overlay=snapshot['overlay'],services=snapshot['services'],failedUnits=snapshot['failedUnits'])),flush=True)
            except Exception as error:
                reason = str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Z0-9_]+',str(error)) else type(error).__name__
                result['roles'][role] = dict(status='FAIL',reason=reason)
                print(json.dumps(dict(role=role,status='FAIL',reason=reason)),flush=True)
            finally:
                if client:
                    client.close()
    finally:
        password = None
        result['status']='FAIL' if any(row.get('status')=='FAIL' for row in result['roles'].values()) else 'PASS'
        (folder / 'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        print(json.dumps(dict(status=result['status'],evidence=str(folder/'result.json'))),flush=True)
    return 1 if result['status']=='FAIL' else 0


if __name__ == '__main__':
    raise SystemExit(main())
