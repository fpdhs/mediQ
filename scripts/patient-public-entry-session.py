"""Approved B TLS entry operator session. Password stays in this process only.

Pinned SSH identities; no account enrollment or authentication fallback. Commands
are fixed phases, not arbitrary shell input. Session expires after 15 minutes.
"""
import importlib.util
import json
import pathlib
import queue
import sys
import threading
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    auth = load('entry_auth', 'scripts/deployment-auth-preflight.py')
    runtime = auth.runtime
    credential = auth.ask_password_gui()
    if not credential:
        print(json.dumps({'status': 'NOT VERIFIED', 'reason': 'B_CREDENTIAL_INPUT_CANCELLED'}), flush=True)
        return 2
    clients = {}
    folder = ROOT / 'artifacts/azure' / ('patient-public-entry-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    try:
        for role in ['B', 'CLOUD']:
            clients[role] = runtime.connect(role, credential if role == 'B' else None)
            check = runtime.remote(clients[role], role, credential, "import os,json,pathlib;print(json.dumps({'uid':os.getuid(),'mac':pathlib.Path('/sys/class/net/ens33/address').read_text().strip() if pathlib.Path('/sys/class/net/ens33/address').exists() else None}))", 10)
            assert check['uid'] == 0
            if role == 'B':
                assert check['mac'] == '00:0c:29:a3:9e:1b'
        folder.mkdir(parents=True, exist_ok=False)
        print(json.dumps({'status': 'READY', 'scope': 'B_TLS_ENTRY_ONLY', 'folder': str(folder)}), flush=True)
        inbox = queue.Queue()

        def read_commands():
            for line in sys.stdin:
                inbox.put(line.strip())
            inbox.put('close')

        threading.Thread(target=read_commands, daemon=True).start()
        deadline = time.monotonic() + 900
        event_number = 0
        while time.monotonic() < deadline:
            try:
                command = inbox.get(timeout=min(60, max(0.1, deadline - time.monotonic())))
            except queue.Empty:
                continue
            if command == 'close':
                break
            # Remote module is reviewed local source, never fetched from a remote response.
            allowed = {'inventory', 'stage', 'start-staging', 'start-production', 'verify', 'rollback'}
            role, separator, phase = command.partition(':')
            if separator != ':' or role not in clients or phase not in allowed:
                print(json.dumps({'status': 'REJECTED', 'reason': 'UNKNOWN_PHASE'}), flush=True)
                continue
            try:
                source = (ROOT / 'scripts/patient-public-entry-remote.py').read_text(encoding='utf-8')
                result = runtime.remote(clients[role], role, credential, source + '\nmain(' + repr(role) + ',' + repr(phase) + ')', 55)
                event_number += 1
                payload = json.dumps(result, indent=2)
                (folder / (str(event_number).zfill(3) + '-' + role + '-' + phase + '.json')).write_text(payload, encoding='utf-8')
                target = folder / (role + '-' + phase + '.json')
                if phase != 'inventory' or not target.exists():
                    target.write_text(payload, encoding='utf-8')
                print(json.dumps({'role': role, 'phase': phase, 'result': result}), flush=True)
            except Exception as error:
                # Never echo command output, environment, key material or credentials.
                print(json.dumps({'role': role, 'phase': phase, 'status': 'FAIL', 'type': type(error).__name__}), flush=True)
    finally:
        for client in clients.values():
            client.close()
        credential = None
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
