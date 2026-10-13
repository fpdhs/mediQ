"""Pinned B/Control SSH + sudo check only. No deployment or key enrollment.

Credentials stay in this process's memory; never argv, disk, evidence or logs.
Reuse the existing role-specific host pins and Control identity.
"""
import argparse
import getpass
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('deployment_auth_runtime', ROOT / 'scripts/health-helper-runtime-check.py')
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

def ask_password_gui():
    import tkinter as tk
    result = [None]
    window = tk.Tk()
    window.title('Highpass — B병원 배포 인증 사전확인')
    window.geometry('490x240')
    window.resizable(False, False)
    window.attributes('-topmost', True)
    tk.Label(window, text='B병원 테스트 VM · 192.168.111.149 · server', font=('맑은 고딕', 12, 'bold')).pack(pady=(18, 8))
    tk.Label(window, text='VM 계정 비밀번호를 입력하세요. 웹 시연 비밀번호가 아닙니다.\n입력은 이 프로세스의 메모리에만 사용합니다. 저장·배포하지 않습니다.').pack(pady=6)
    entry = tk.Entry(window, show='●', width=40)
    entry.pack(pady=10)
    entry.focus_set()
    def submit():
        value = entry.get()
        if not value:
            return
        result[0] = value
        entry.delete(0, tk.END)
        window.destroy()
    def cancel():
        entry.delete(0, tk.END)
        window.destroy()
    buttons = tk.Frame(window)
    buttons.pack(pady=8)
    tk.Button(buttons, text='접속 확인', command=submit, width=16).pack(side=tk.LEFT, padx=8)
    tk.Button(buttons, text='취소', command=cancel, width=12).pack(side=tk.LEFT, padx=8)
    window.bind('<Return>', lambda _: submit())
    window.bind('<Escape>', lambda _: cancel())
    window.protocol('WM_DELETE_WINDOW', cancel)
    window.after(180000, cancel)
    window.mainloop()
    return result[0]

def verify(role, password):
    client = None
    try:
        client = runtime.connect(role, password)
        # Current authenticated OS identity and expected host, then existing
        # sudo permission. No application environment or container secrets.
        command = "timeout 10s sh -c 'hostname; id -un'"
        code, output = runtime.ops.run(client, command, seconds=15)
        expected = ('server',) if role == 'B' else ('highpass-cloud', 'highpassadmin')
        lines = output.strip().splitlines()
        if code or len(lines) != 2 or (role == 'B' and lines[1] != expected[0]) or (role == 'CLOUD' and tuple(lines) != expected):
            raise RuntimeError('HOST_IDENTITY_MISMATCH')
        observations = runtime.remote(client, role, password,
            "import json,os,pathlib,socket; print(json.dumps(dict(sudoUid=os.getuid(),host=socket.gethostname(),mac=pathlib.Path('/sys/class/net/ens33/address').read_text().strip() if pathlib.Path('/sys/class/net/ens33/address').exists() else None)))", 10)
        if observations['sudoUid'] != 0 or (role == 'B' and observations['mac'] != '00:0c:29:a3:9e:1b'):
            raise RuntimeError('HOST_IDENTITY_MISMATCH')
        return {'role': role, 'status': 'PASS', 'scope': 'PINNED_SSH_AND_EXISTING_SUDO_ONLY', 'deployed': False}
    except Exception as error:
        # No exception message/remote stderr/token/key/password in diagnostics.
        kind = type(error).__name__
        reason = {'AuthenticationException':'AUTHENTICATION_REJECTED', 'BadHostKeyException':'HOST_KEY_MISMATCH',
                  'FileNotFoundError':'APPROVED_IDENTITY_OR_PIN_MISSING', 'TimeoutError':'CONNECTION_TIMEOUT'}.get(kind, 'CONNECTION_OR_PREFLIGHT_FAILED')
        return {'role': role, 'status': 'NOT VERIFIED', 'reason': reason, 'deployed': False}
    finally:
        if client:
            client.close()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--role', choices=['B','CLOUD','BOTH'], default='BOTH')
    parser.add_argument('--gui', action='store_true', help='Local masked B password dialog, 3 minute timeout')
    args = parser.parse_args()
    results = []
    if args.role in ['CLOUD','BOTH']:
        result = verify('CLOUD', None)
        results.append(result)
        print(json.dumps(result), flush=True)
    if args.role in ['B','BOTH']:
        password = ask_password_gui() if args.gui else getpass.getpass('B VM server password (concealed, not saved): ')
        try:
            result = verify('B', password) if password else {'role':'B','status':'NOT VERIFIED','reason':'CREDENTIAL_INPUT_CANCELLED','deployed':False}
            results.append(result)
            print(json.dumps(result), flush=True)
        finally:
            password = None
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    folder = ROOT / 'artifacts/workstation' / ('deployment-auth-' + stamp)
    folder.mkdir(parents=True, exist_ok=False)
    evidence = {'scope':'DEPLOYMENT_AUTHENTICATION_ONLY', 'review':'DRAFT / UNASSIGNED', 'observedAt':datetime.now(timezone.utc).isoformat(), 'results':results, 'deployed':False}
    (folder / 'result.json').write_text(json.dumps(evidence, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'evidence':str(folder / 'result.json'), 'status':'PASS' if all(r['status']=='PASS' for r in results) else 'NOT VERIFIED'}), flush=True)
    return 0 if all(r['status']=='PASS' for r in results) else 2

if __name__ == '__main__':
    raise SystemExit(main())
