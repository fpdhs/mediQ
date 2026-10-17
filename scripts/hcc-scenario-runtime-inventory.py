"""Read-only A/B/cloud identity, image and synthetic-catalog inventory."""
import argparse
import getpass
import importlib.util
import json
import pathlib
import shlex
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('hcc_inventory_ops', ROOT / 'scripts/workstation-automatic-ops.py')
ops = importlib.util.module_from_spec(spec); spec.loader.exec_module(ops)


def main():
    parser = argparse.ArgumentParser(description='Read-only Highpass VM container inventory; no cloud unless explicitly requested.')
    parser.add_argument('--roles', nargs='+', choices=['A', 'B', 'CLOUD'], default=['A', 'B'])
    parser.add_argument('--include-all-container-names', action='store_true')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    allowed_output = (ROOT / 'artifacts/workstation').resolve()
    if not output.is_relative_to(allowed_output) or output == allowed_output:
        raise RuntimeError('OUTPUT_PATH_OUTSIDE_WORKSTATION_ARTIFACTS')
    output.mkdir(parents=True, exist_ok=False)
    credential = getpass.getpass('VM credential (concealed): ') if any(role in ['A', 'B'] for role in args.roles) else None
    results = []
    trust = ops.LocalVmTrust()
    try:
        for role in args.roles:
            client = paramiko.SSHClient()
            try:
                if role == 'CLOUD':
                    identity = pathlib.Path.home() / '.ssh/highpass-capstone-cloud'
                    client.load_host_keys(str(identity / 'known_hosts'))
                    client.set_missing_host_key_policy(paramiko.RejectPolicy())
                    client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'),
                                   look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
                else:
                    key = trust.key(role, credential, output / (role + '-public-host.key'))
                    address, mac, _ = ops.ROLES[role]
                    client.get_host_keys().add(address, key.get_name(), key)
                    client.set_missing_host_key_policy(paramiko.RejectPolicy())
                    client.connect(address, username='server', password=credential, look_for_keys=False,
                                   allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
                program = 'ROLE=' + repr(role) + '\n' + 'MAC=' + repr(ops.ROLES[role][1] if role != 'CLOUD' else None) + '\n' + 'INCLUDE_ALL=' + repr(args.include_all_container_names) + '\n' + r'''
import subprocess,json,pathlib
if MAC: assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
else: assert pathlib.Path('/etc/hostname').read_text().strip()=='highpass-cloud'
all_names=subprocess.check_output(['docker','ps','-a','--format','{{.Names}}'],timeout=10).decode().splitlines()
names=all_names if INCLUDE_ALL else [name for name in all_names if name.startswith('hp-capstone-')]
items=json.loads(subprocess.check_output(['docker','inspect',*names],timeout=15)) if names else []
rows=[]
for item in items:
 labels=item['Config'].get('Labels') or {}
 rows.append({'name':item['Name'],'image':item['Image'],'running':item['State']['Running'],
  'health':item['State'].get('Health',{}).get('Status','NOT CONFIGURED'),
  'composeProject':labels.get('com.docker.compose.project'),'composeFiles':labels.get('com.docker.compose.project.config_files'),
  'mounts':[{'type':mount['Type'],'name':mount.get('Name'),'destination':mount['Destination']} for mount in item.get('Mounts',[]) if 'orthanc' in item['Name'].lower()]})
print(json.dumps({'role':ROLE,'containers':rows,'scope':'READ_ONLY_IMAGES_AND_READINESS','review':'DRAFT / UNASSIGNED'}))
'''
                prefix = "sudo -n " if role == 'CLOUD' else "sudo -S -p '' "
                code, text = ops.run(client, prefix + 'timeout 45s python3 -c ' + shlex.quote(program),
                                     credential=None if role == 'CLOUD' else credential, seconds=50)
                if code: raise RuntimeError('REMOTE_INVENTORY_FAILED')
                results.append(json.loads(text))
            except Exception as error:
                results.append({'role': role, 'status': 'NOT VERIFIED', 'errorType': type(error).__name__})
            finally: client.close()
    finally:
        trust.close(); credential = None
    (output / 'result.json').write_text(json.dumps(results, indent=2) + '\n')
    print(json.dumps(results))
    return 0 if all('containers' in result for result in results) else 1


if __name__ == '__main__': raise SystemExit(main())
