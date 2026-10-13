"""Remove only the exact known synthetic fixture Studies from Highpass A test Orthanc.

The operation defaults to dry-run. It never touches MediQ, local Docker volumes,
Control Plane metadata, audit records, or any Study UID outside a fixed allowlist.
"""
import argparse
import base64
import getpass
import hashlib
import importlib.util
import json
import pathlib
import shlex
import sys
from datetime import datetime, timezone

import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('hcc_cleanup_ops', ROOT / 'scripts/workstation-automatic-ops.py')
ops = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ops)

EXPECTED_CONTAINERS = {
    'A': {
        'hp-capstone-a-gateway-gateway-1',
        'hp-capstone-hospital-a-orthanc-mtls-1',
        'hp-capstone-hospital-a-orthanc-1',
    },
    'B': {'hp-capstone-b-portal-portal-1'},
}
GATEWAY_CONTAINER = 'hp-capstone-a-gateway-gateway-1'
GATEWAY_IMAGE_ID = 'sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'
ORTHANC_VOLUME = 'hp-capstone-hospital-a_hospital-a-data'
CLEANER = ROOT / 'scripts/clear-highpass-synthetic-test-dicom.js'


def main():
    parser = argparse.ArgumentParser(description='Safely clear the known synthetic DICOM fixture Studies from Highpass A test PACS.')
    parser.add_argument('--apply', action='store_true', help='Delete after exact A/B role, container, image, UID and synthetic-fixture preflights.')
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    output = args.output.resolve()
    allowed_output = (ROOT / 'artifacts/workstation').resolve()
    if not output.is_relative_to(allowed_output) or output == allowed_output:
        raise RuntimeError('OUTPUT_PATH_OUTSIDE_WORKSTATION_ARTIFACTS')
    output.mkdir(parents=True, exist_ok=False)

    stamp = datetime.now(timezone.utc).isoformat().replace(':', '-')
    credential = getpass.getpass('VM credential (concealed): ')
    trust = ops.LocalVmTrust()
    results = []
    try:
        for role in ['A', 'B']:
            result = inspect_role(role, credential, trust, stamp, args.apply)
            results.append(result)
    finally:
        credential = None
        trust.close()

    verdict = 'FAIL' if any(item.get('status') == 'FAIL' for item in results) else 'NOT VERIFIED' if any(item.get('status') != 'PASS' for item in results) else 'PASS'
    summary = {
        'status': verdict,
        'scope': 'HIGH_PASS_A_B_VM_TEST_PACS_ONLY',
        'review': 'DRAFT / UNASSIGNED',
        'mode': 'APPLY' if args.apply else 'DRY_RUN',
        'mvp': 'NOT VERIFIED',
        'roles': results,
    }
    (output / 'result.json').write_text(json.dumps(summary, indent=2, ensure_ascii=True) + '\n', encoding='utf8')
    print(json.dumps(summary, ensure_ascii=True))
    return 0 if verdict == 'PASS' else 1


def inspect_role(role, credential, trust, stamp, apply):
    address, mac, _ = ops.ROLES[role]
    client = paramiko.SSHClient()
    result = {'hospital': role, 'review': 'DRAFT / UNASSIGNED'}
    try:
        key_path = ROOT / 'artifacts/workstation' / ('dicom-cleanup-' + stamp.replace(':', '-')) / (role + '-public-host.key')
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key = trust.key(role, credential, key_path)
        client.get_host_keys().add(address, key.get_name(), key)
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        code, _ = ops.run(client, 'test "$(cat /sys/class/net/ens33/address)" = ' + shlex.quote(mac) + ' && test "$(id -un)" = server', seconds=15)
        if code:
            raise RuntimeError('VM_ROLE_IDENTITY_MISMATCH')
        code, names_output = ops.run(client, "sudo -S -p '' timeout 10s docker ps -a --format '{{.Names}}'", credential=credential, seconds=15)
        if code:
            raise RuntimeError('DOCKER_CONTAINER_INVENTORY_FAILED')
        names = {line.strip().lstrip('/') for line in names_output.splitlines() if line.strip()}
        if names != EXPECTED_CONTAINERS[role]:
            raise RuntimeError('CONTAINER_SET_CHANGED_FROM_REVIEWED_HIGH_PASS_BASELINE')
        result['containers'] = sorted(names)

        if role == 'B':
            if any('orthanc' in name.lower() or 'pacs' in name.lower() for name in names):
                raise RuntimeError('UNEXPECTED_B_PACS_CONTAINER')
            result.update({'status': 'PASS', 'dicomStore': 'NO_B_PACS_CONTAINER_OR_VOLUME_FOUND', 'deletedStudies': 0})
            return result

        inspect = "sudo -S -p '' timeout 10s docker inspect hp-capstone-hospital-a-orthanc-1 --format '{{.State.Status}}|{{.State.Health.Status}}|{{.Image}}|{{json .NetworkSettings.Ports}}|{{json .Mounts}}'"
        code, details = ops.run(client, inspect, credential=credential, seconds=15)
        if code:
            raise RuntimeError('A_ORTHANC_INSPECT_FAILED')
        parts = details.strip().split('|', 4)
        if len(parts) != 5 or parts[0:3] != ['running', 'healthy', 'sha256:9f74f2dbf91aef1f9169fc9ec36bc3b1d414294e7ec561294065b7180882aa9a']:
            raise RuntimeError('A_ORTHANC_IDENTITY_OR_READINESS_CHANGED')
        ports = json.loads(parts[3])
        if any(value for bindings in ports.values() if bindings for value in bindings):
            raise RuntimeError('A_ORTHANC_HOST_PORT_PUBLISHED')
        mounts = json.loads(parts[4])
        if not any(mount.get('Name') == ORTHANC_VOLUME and mount.get('Destination') == '/var/lib/orthanc/db' for mount in mounts):
            raise RuntimeError('A_ORTHANC_VOLUME_MISMATCH')
        result['orthancVolume'] = ORTHANC_VOLUME

        checks = ops.verify_a(client, credential, stamp, existing_phantom=True)
        result['mtlsAndStudyPreflight'] = [{'test': item['test'], 'status': item['status']} for item in checks]
        if any(item['status'] != 'PASS' for item in checks):
            raise RuntimeError('A_SYNTHETIC_STUDY_PREFLIGHT_FAILED')

        gateway_inspect = "sudo -S -p '' timeout 10s docker inspect " + GATEWAY_CONTAINER + " --format '{{.State.Status}}|{{.State.Health.Status}}|{{.Image}}|{{json .Mounts}}'"
        code, gateway_details = ops.run(client, gateway_inspect, credential=credential, seconds=15)
        if code:
            raise RuntimeError('A_GATEWAY_INSPECT_FAILED')
        gateway_parts = gateway_details.strip().split('|', 3)
        if len(gateway_parts) != 4 or gateway_parts[:3] != ['running', 'healthy', GATEWAY_IMAGE_ID]:
            raise RuntimeError('A_GATEWAY_IDENTITY_OR_READINESS_CHANGED')
        gateway_mounts = json.loads(gateway_parts[3])
        destinations = {mount.get('Destination') for mount in gateway_mounts}
        if not {'/run/secrets/ca.crt', '/run/secrets/gateway-client.crt', '/run/secrets/gateway-client.key'}.issubset(destinations):
            raise RuntimeError('A_GATEWAY_MTLS_MATERIAL_NOT_MOUNTED')
        code, gateway_networks = ops.run(client, "sudo -S -p '' timeout 10s docker inspect " + GATEWAY_CONTAINER + " --format '{{range $network, $value := .NetworkSettings.Networks}}{{println $network}}{{end}}'", credential=credential, seconds=15)
        if code or 'hp-capstone-hospital-a_pacs_private' not in gateway_networks.splitlines():
            raise RuntimeError('A_GATEWAY_PACS_NETWORK_MISMATCH')
        code, node_version = ops.run(client, "sudo -S -p '' timeout 5s docker exec " + GATEWAY_CONTAINER + " /nodejs/bin/node --version", credential=credential, seconds=10)
        if code or not node_version.strip().startswith('v'):
            raise RuntimeError('A_GATEWAY_NODE_NOT_AVAILABLE')

        module_code = 'await import("data:text/javascript;base64,' + base64.b64encode(CLEANER.read_bytes()).decode('ascii') + '")'
        base = "sudo -S -p '' timeout 45s docker exec --env ORTHANC_REST_URL=https://orthanc-mtls:8443 --env HIPASS_CLEAR_CONFIRM=DELETE_KNOWN_SYNTHETIC_TEST_STUDIES "
        base += GATEWAY_CONTAINER + ' /nodejs/bin/node --input-type=module -e ' + shlex.quote(module_code)
        result['cleanupScriptSha256'] = hashlib.sha256(CLEANER.read_bytes()).hexdigest()
        dry_code, dry_output = ops.run(client, base, credential=credential, seconds=50)
        dry = parse_result(dry_output)
        result['dryRun'] = dry
        if dry_code or dry.get('status') != 'PREFLIGHT_PASS' or dry.get('studies') != 5 or set(dry.get('studyUids', [])) != {
            '1.2.410.100.1.20260620.001',
            '1.2.410.100.1.20260518.002',
            '1.2.826.0.1.3680043.10.5432.20260908.1001.1',
            '1.2.826.0.1.3680043.10.5432.20261009.1',
            '1.2.826.0.1.3680043.10.5432.20261009.2',
        }:
            result['dryRunDiagnostic'] = dry_output.replace(credential, '[REDACTED]')[:2000]
            raise RuntimeError('A_DICOM_DRY_RUN_SCOPE_MISMATCH')

        if apply:
            apply_code, apply_output = ops.run(client, base + ' -- --apply', credential=credential, seconds=50)
            applied = parse_result(apply_output)
            result['apply'] = applied
            if (apply_code or applied.get('status') != 'DELETE_PASS' or applied.get('deletedStudies') != 5 or
                    applied.get('remaining') != {'studies': 0, 'series': 0, 'instances': 0} or applied.get('mtlsQidoStudies') != 0):
                result['applyDiagnostic'] = apply_output.replace(credential, '[REDACTED]')[:2000]
                raise RuntimeError('A_DICOM_DELETE_OR_EMPTY_VERIFICATION_FAILED')
        else:
            result['apply'] = {'status': 'NOT RUN'}
        result.update({'status': 'PASS', 'dicomStore': 'A_TEST_ORTHANC', 'operation': 'DELETED' if apply else 'DRY_RUN_ONLY'})
        return result
    except Exception as error:
        result.update({'status': 'FAIL', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__})
        return result
    finally:
        client.close()


def parse_result(output):
    for line in reversed(output.splitlines()):
        try:
            value = json.loads(line)
        except ValueError:
            continue
        if isinstance(value, dict) and 'status' in value:
            return value
    return {'status': 'NOT VERIFIED', 'reason': 'JSON_RESULT_MISSING'}


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as error:
        print(json.dumps({'status': 'NOT VERIFIED', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__}))
        sys.exit(1)
