"""Authenticated workstation operator, temporary exact-key RBAC, pinned SSH.

No service deployment, image import, purge-protection change or autounlock.
"""
import argparse
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import shlex
import sys
import subprocess
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, filename):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


check = load('b_storage_check', 'health-helper-runtime-check.py')
identity = load('b_storage_identity', 'capstone-key-identities.py')
gateway = load('b_storage_gateway', 'capstone-a-gateway-ops.py')
OPERATOR = '86aba420-e1d9-4284-9145-5d0f524a296a'
KEY_SCOPE = identity.VAULT + '/keys/highpass-b-storage-kek-20261013'


def execute_guest(client, password, path, request):
    command = ('sudo -S -p \'\' ' if password else 'sudo -n ') + 'timeout 240s python3 ' + shlex.quote(path)
    stdin, stdout, stderr = client.exec_command(command, timeout=10, get_pty=False)
    stdout.channel.settimeout(250)
    if password:
        stdin.write(password + '\n')
        stdin.flush()
        # sudo consumes exactly its password line; Python reads remaining stdin.
    stdin.write(json.dumps(request))
    stdin.flush()
    stdin.channel.shutdown_write()
    payload = stdout.read(65537)
    code = stdout.channel.recv_exit_status()
    if len(payload) > 65536:
        raise RuntimeError('GUEST_RESPONSE_LIMIT')
    result = json.loads(payload)
    if code or result.get('status') != 'PASS':
        raise RuntimeError('GUEST_' + result.get('reason', 'FAILED'))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--recover', action='store_true')
    args = parser.parse_args()
    started = time.monotonic()
    folder = ROOT / 'artifacts/workstation' / ('b-storage-provision-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True, exist_ok=False)
    if os.name == 'nt':
        owner = subprocess.check_output(['whoami.exe'], timeout=5).decode().strip()
        protected = subprocess.run(['icacls.exe', str(folder), '/inheritance:r', '/grant:r', owner + ':(OI)(CI)F',
                                    '*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F'], capture_output=True, timeout=10)
        if protected.returncode:
            raise RuntimeError('RECOVERY_MATERIAL_LOCAL_ACL_REQUIRED')
    evidence = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED', checks=[],
                    serviceDeployment=False, dicomImport=False, automaticBootUnlock=False)
    assignments = []
    clients = []
    credential = None
    phase = 'AZURE_BASELINE'
    exit_code = 1
    try:
        account = identity.azure('account', 'show')
        if account['id'] != 'a3c0e7d4-ce09-4991-946b-88574869edd9' or account['tenantId'] != identity.TENANT:
            raise RuntimeError('APPROVED_SUBSCRIPTION_REQUIRED')
        vault = identity.azure('keyvault', 'show', '--name', 'kv-hp-demo-4869edd9')
        properties = vault['properties']
        if properties['publicNetworkAccess'] != 'Disabled' or properties['enableRbacAuthorization'] is not True:
            raise RuntimeError('PRIVATE_RBAC_VAULT_REQUIRED')
        evidence['vault'] = {key: properties.get(key) for key in ['publicNetworkAccess', 'enableRbacAuthorization', 'enableSoftDelete', 'enablePurgeProtection', 'softDeleteRetentionInDays']}
        if properties.get('enableSoftDelete') is not True:
            raise RuntimeError('SOFT_DELETE_REQUIRED')
        credential = getpass.getpass('B VM password (concealed; not stored): ')
        b = check.connect('B', credential)
        clients.append(b)
        baseline = check.remote(b, 'B', credential, '''import json,pathlib,shutil,subprocess
print(json.dumps(dict(directoryExists=pathlib.Path('/opt/highpass/b-pacs-storage').exists(),mountExists=pathlib.Path('/opt/highpass/b-pacs-encrypted').exists(),free=shutil.disk_usage('/opt').free,cryptsetup=bool(shutil.which('cryptsetup')),containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],timeout=10).decode().splitlines())))''', 20)
        evidence['before'] = baseline
        if not args.recover and (baseline['directoryExists'] or baseline['mountExists']):
            raise RuntimeError('EXISTING_STORAGE_PRESERVED')
        cloud = check.connect('CLOUD', None)
        clients.append(cloud)
        phase = 'ROOT_ONLY_SCRIPT_STAGING'
        name = 'storage-operator-' + folder.name + '.py'
        for client, password in [(b, credential), (cloud, None)]:
            with gateway.root_sftp(client, password) as sftp:
                path = '/opt/highpass/' + name
                with sftp.open(path, 'wx') as stream:
                    stream.write((ROOT / 'scripts/b-pacs-storage-guest.py').read_text().replace('\r\n', '\n'))
                sftp.chmod(path, 0o600)
                sftp.chown(path, 0, 0)
        token = identity.azure('account', 'get-access-token', '--resource', 'https://vault.azure.net')['accessToken']
        if not args.recover:
            phase = 'TEMPORARY_CREATE_ONLY_ASSIGNMENT'
            roles = identity.azure('role', 'definition', 'list', '--name', 'Highpass Capstone Temporary Key Bootstrap 20261009')
            if len(roles) != 1 or set(roles[0]['permissions'][0]['dataActions']) != {'Microsoft.KeyVault/vaults/keys/read', 'Microsoft.KeyVault/vaults/keys/create/action'}:
                raise RuntimeError('REVIEWED_CREATE_ONLY_ROLE_REQUIRED')
            assignment = identity.azure('role', 'assignment', 'create', '--assignee-object-id', OPERATOR, '--assignee-principal-type', 'User', '--role', roles[0]['name'], '--scope', identity.VAULT)
            assignments.append(assignment['id'])
            phase = 'DEDICATED_KEY_CREATION'
            created = execute_guest(cloud, None, '/opt/highpass/' + name, {'action': 'create-key', 'token': token})
            evidence['keyId'] = created['keyId']
            identity.azure('role', 'assignment', 'delete', '--ids', assignments[0])
        phase = 'TEMPORARY_EXACT_STORAGE_KEY_ASSIGNMENT'
        definition_file = ROOT / ('infra/azure/capstone-key-unwrap-role.json' if args.recover else 'infra/azure/b-pacs-storage-operator-role.json')
        expected = json.loads(definition_file.read_text())
        roles = identity.azure('role', 'definition', 'list', '--name', expected['Name'])
        if not roles:
            definition = identity.azure('role', 'definition', 'create', '--role-definition', str(definition_file))
        elif len(roles) == 1 and roles[0]['permissions'][0]['dataActions'] == expected['DataActions'] and not roles[0]['permissions'][0]['actions']:
            definition = roles[0]
        else:
            raise RuntimeError('EXISTING_ROLE_REQUIRES_REVIEW')
        assignment = identity.azure('role', 'assignment', 'create', '--assignee-object-id', OPERATOR, '--assignee-principal-type', 'User', '--role', definition['name'], '--scope', KEY_SCOPE)
        assignments.append(assignment['id'])
        evidence['operatorScope'] = KEY_SCOPE
        if not args.recover and not baseline['cryptsetup']:
            phase = 'CRYPTSETUP_PACKAGE_INSTALL'
            code, _ = check.ops.run(b, "sudo -S -p '' timeout 120s apt-get install -y --no-install-recommends cryptsetup-bin", credential=credential, seconds=125)
            if code:
                raise RuntimeError('CRYPTSETUP_INSTALL_FAILED')
        phase = 'KEY_PROTECTION_AND_STORAGE_' + ('RECOVERY' if args.recover else 'CREATE')
        request = {'action': 'recover' if args.recover else 'create-volume', 'token': token}
        if not args.recover:
            request['keyId'] = evidence['keyId']
        result = execute_guest(b, credential, '/opt/highpass/' + name, request)
        token = None
        evidence['checks'].append({'test': phase, **result})
        phase = 'ENCRYPTED_RECOVERY_MATERIAL_COPY'
        with gateway.root_sftp(b, credential) as sftp:
            for filename in ['storage.json', 'vault-key-backup.json', 'luks-header.backup']:
                local = folder / filename
                sftp.get('/opt/highpass/b-pacs-storage/' + filename, str(local))
                evidence.setdefault('recoveryMaterialHashes', {})[filename] = hashlib.sha256(local.read_bytes()).hexdigest()
        evidence['after'] = check.remote(b, 'B', credential, '''import json,subprocess
print(json.dumps(dict(containers=subprocess.check_output(['docker','ps','--format','{{.Names}}'],timeout=10).decode().splitlines(),mapperUuid=subprocess.check_output(['cat','/sys/class/block/'+__import__('os').path.basename(__import__('os').path.realpath('/dev/mapper/highpass-b-pacs'))+'/dm/uuid'],timeout=5).decode().strip())))''',20)
        if evidence['after']['containers'] != baseline['containers']:
            raise RuntimeError('CONTAINER_BASELINE_CHANGED')
        exit_code = 0
    except Exception as error:
        evidence['checks'].append({'test': phase, 'status': 'NOT VERIFIED', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__})
    finally:
        # Remove ONLY assignments this invocation created, never any prior role.
        for assignment in assignments:
            try:
                identity.azure('role', 'assignment', 'delete', '--ids', assignment)
                remaining = identity.azure('role', 'assignment', 'list', '--all', '--query', "[?id=='" + assignment + "']")
                if remaining:
                    raise RuntimeError('TEMPORARY_ROLE_STILL_PRESENT')
                evidence['checks'].append({'test': 'TEMPORARY_OPERATOR_ASSIGNMENT_REMOVED', 'status': 'PASS', 'assignmentId': assignment})
            except Exception:
                exit_code = 1
                evidence['checks'].append({'test': 'TEMPORARY_OPERATOR_ASSIGNMENT_REMOVED', 'status': 'FAIL', 'assignmentId': assignment})
        for client in clients:
            client.close()
        credential = None
    evidence['exitCode'] = exit_code
    evidence['elapsedMs'] = round((time.monotonic() - started) * 1000)
    evidence['status'] = 'PASS' if exit_code == 0 else 'NOT VERIFIED'
    evidence['pacsReadiness'] = 'NOT VERIFIED'
    evidence['remaining'] = ['Purge protection not changed; explicit shared-vault decision required', 'Key backup restore to separate approved vault not rehearsed', 'Reboot recovery not verified', 'B receiving PACS not deployed']
    (folder / 'result.json').write_text(json.dumps(evidence, indent=2), encoding='utf8')
    print(json.dumps({'evidence': str(folder / 'result.json'), **evidence}), flush=True)
    return exit_code


if __name__ == '__main__':
    sys.exit(main())
