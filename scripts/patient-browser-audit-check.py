"""Read-only audit tied to exactly four successful public browser receipts."""
import importlib.util
import json
import os
import pathlib
import shlex
import sys
from datetime import datetime, timezone
import paramiko

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    refs = []
    receipts = []
    if len(sys.argv) != 5:
        raise ValueError('FOUR_OWNED_BROWSER_RECEIPTS_REQUIRED')
    for arg in sys.argv[1:]:
        path = (ROOT / arg).resolve()
        if not path.is_relative_to(ROOT / 'artifacts/workstation') or path.name != 'result.json' or not path.parent.name.startswith('patient-real-browser-'):
            raise ValueError('OWNED_PUBLIC_RECEIPT_REQUIRED')
        result = json.loads(path.read_text())
        if result.get('status') != 'PASS' or result.get('cleanup') is not True or result.get('publicOrigin') != 'https://192.168.111.149:9443':
            raise ValueError('SUCCESSFUL_PUBLIC_BROWSER_REQUIRED')
        refs.append(result['grantReceipt']);receipts.append(str(path))
    if len({r['grantId'] for r in refs}) != 4:
        raise ValueError('DISTINCT_GRANTS_REQUIRED')
    spec = importlib.util.spec_from_file_location('audit_ops', ROOT / 'scripts/capstone-phantom-audit-check.py')
    ops = importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
    client = paramiko.SSHClient()
    try:
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        client.load_host_keys(str(identity / 'known_hosts'));client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect('138.91.2.60',username='highpassadmin',key_filename=str(identity / 'id_ed25519'),look_for_keys=False,allow_agent=False,timeout=10,banner_timeout=10,auth_timeout=10,channel_timeout=15)
        channel = client.get_transport().open_session(timeout=10);channel.settimeout(30)
        channel.exec_command('sudo -n timeout 25s docker exec -i hp-capstone-control-control-1 /nodejs/bin/node --input-type=module - ' + shlex.quote(json.dumps(refs)))
        channel.sendall((ROOT / 'scripts/patient-browser-audit-readonly.js').read_bytes());channel.shutdown_write()
        code, output = ops.drain_channel(channel, seconds=30)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':result={'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status':'NOT VERIFIED','reason':type(error).__name__}
    finally:client.close()
    path = ROOT / 'artifacts/workstation' / ('patient-public-audit-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    result.update({'browserReceipts':receipts,'review':'DRAFT / UNASSIGNED','observedAt':datetime.now(timezone.utc).isoformat()})
    path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'evidence':str(path),**result}))
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    sys.exit(main())
