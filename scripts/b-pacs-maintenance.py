"""Approved B-only maintenance. Pinned SSH, no forced unmount or data deletion."""
import argparse
import getpass
import importlib.util
import json
import pathlib
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('maintenance_check', ROOT/'scripts/health-helper-runtime-check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
PORTAL = 'hp-capstone-b-portal-portal-1'

SNAPSHOT = '''import subprocess,json,pathlib,os
items=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1'],timeout=10))
i=items[0]
print(json.dumps(dict(bootId=pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
 portal=dict(id=i['Id'],image=i['Image'],running=i['State']['Running'],health=i['State'].get('Health',{}).get('Status')),
 containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],timeout=10).decode().splitlines(),
 mounted=os.path.ismount('/opt/highpass/b-pacs-encrypted'),mapper=pathlib.Path('/dev/mapper/highpass-b-pacs').exists())))'''

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('action',choices=['inspect','pause','reboot','resume'])
    parser.add_argument('--baseline')
    args=parser.parse_args()
    folder=ROOT/'artifacts/workstation'/('b-maintenance-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False)
    result=dict(action=args.action,review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat())
    password=getpass.getpass('B VM password (concealed): ')
    client=None
    try:
        client=check.connect('B',password)
        before=check.remote(client,'B',password,SNAPSHOT,20)
        result['before']=before
        if args.action=='inspect':
            pass
        elif args.action=='pause':
            if before['containers'] != [PORTAL] or not before['portal']['running']:
                raise RuntimeError('UNEXPECTED_RUNTIME_REQUIRES_REVIEW')
            result['operation']=check.remote(client,'B',password,"import subprocess,json; p=subprocess.run(['docker','stop','--time','20','"+PORTAL+"'],capture_output=True,timeout=30); print(json.dumps({'exitCode':p.returncode}));",35)
            if result['operation']['exitCode']: raise RuntimeError('STOP_FAILED')
        else:
            path=pathlib.Path(args.baseline or '').resolve()
            if not path.is_relative_to(ROOT/'artifacts/workstation') or path.name!='result.json':
                raise RuntimeError('OWNED_BASELINE_REQUIRED')
            baseline=json.loads(path.read_text())
            if baseline.get('action')!='pause' or baseline.get('status')!='PASS':
                raise RuntimeError('SUCCESSFUL_PAUSE_REQUIRED')
            if before['portal']['id']!=baseline['before']['portal']['id'] or before['portal']['image']!=baseline['before']['portal']['image']:
                raise RuntimeError('PORTAL_BASELINE_CHANGED')
            if args.action=='reboot':
                if before['containers'] or before['mounted'] or before['mapper']:
                    raise RuntimeError('ALL_B_CONTAINERS_STOPPED_AND_STORAGE_LOCKED_REQUIRED')
                # Command returns before shutdown; bounded reconnect verifies actual new boot.
                result['operation']=check.remote(client,'B',password,"import subprocess,json; p=subprocess.run(['shutdown','-r','+1'],capture_output=True,timeout=5); print(json.dumps({'exitCode':p.returncode}));",10)
                if result['operation']['exitCode']: raise RuntimeError('REBOOT_SCHEDULE_FAILED')
                client.close(); client=None
                deadline=time.monotonic()+240
                while time.monotonic()<deadline:
                    time.sleep(5)
                    try:
                        attempt=check.connect('B',password)
                        try: after=check.remote(attempt,'B',password,SNAPSHOT,20)
                        finally: attempt.close()
                        if after['bootId']!=before['bootId']:
                            result['after']=after
                            if after['mounted'] or after['mapper'] or after['containers']:
                                raise RuntimeError('REBOOT_NOT_FAIL_CLOSED')
                            break
                    except RuntimeError: raise
                    except Exception: continue
                else: raise RuntimeError('REBOOT_CONFIRMATION_TIMEOUT')
            else:
                if not before['mounted'] or not before['mapper']:
                    raise RuntimeError('ENCRYPTED_STORAGE_RECOVERY_REQUIRED')
                result['operation']=check.remote(client,'B',password,"import subprocess,json; p=subprocess.run(['docker','start','"+PORTAL+"'],capture_output=True,timeout=30); print(json.dumps({'exitCode':p.returncode}));",35)
                if result['operation']['exitCode']: raise RuntimeError('START_FAILED')
                deadline=time.monotonic()+90
                while time.monotonic()<deadline:
                    after=check.remote(client,'B',password,SNAPSHOT,20)
                    if after['portal']['health']=='healthy': result['after']=after; break
                    time.sleep(3)
                else: raise RuntimeError('PORTAL_HEALTH_TIMEOUT')
        if 'after' not in result: result['after']=check.remote(client,'B',password,SNAPSHOT,20)
        if args.action=='pause' and result['after']['containers']: raise RuntimeError('B_NOT_STOPPED')
        result['status']='PASS'
    except Exception as error:
        result.update(status='FAIL',reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:
        if client: client.close()
        password=None
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(folder/'result.json'),**result)),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__': raise SystemExit(main())
