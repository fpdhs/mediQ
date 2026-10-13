"""Read-only B storage prerequisites. Never format, mount, install or create keys."""
import getpass
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('b_pacs_check', ROOT/'scripts/health-helper-runtime-check.py')
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)
PROGRAM = r'''
import json,subprocess,shutil,pathlib
def run(args):
 p=subprocess.run(args,capture_output=True,timeout=10)
 return dict(exitCode=p.returncode,stdout=p.stdout.decode().strip())
mount=run(['findmnt','-J','-o','TARGET,SOURCE,FSTYPE','-T','/opt'])
devices=run(['lsblk','-J','-o','NAME,TYPE,FSTYPE,MOUNTPOINTS'])
free=shutil.disk_usage('/opt').free
names=run(['docker','ps','-a','--format','{{.Names}}'])
print(json.dumps(dict(role='B',observedAt=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
 review='DRAFT / UNASSIGNED',readOnly=True,tools={x:bool(shutil.which(x)) for x in ['cryptsetup','losetup','mkfs.ext4','findmnt']},
 optMount=json.loads(mount['stdout']) if mount['exitCode']==0 else None,
 blockDevices=json.loads(devices['stdout']) if devices['exitCode']==0 else None,
 freeBytes=free,containers=names['stdout'].splitlines(),
 intendedMountExists=pathlib.Path('/opt/highpass/b-pacs-encrypted').exists())))
'''

def main():
 credential = getpass.getpass('B VM password (concealed): ')
 client = check.connect('B', credential)
 try:
  result = check.remote(client, 'B', credential, PROGRAM, 35)
 finally:
  client.close()
  credential = None
 folder = ROOT/'artifacts/workstation'/('b-pacs-storage-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
 folder.mkdir(parents=True, exist_ok=False)
 (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
 print(json.dumps(dict(evidence=str(folder/'result.json'),**result)))

if __name__ == '__main__': main()
