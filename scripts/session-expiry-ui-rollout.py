"""B-only reviewed image promotion/rollback; default performs read-only preflight."""
import argparse
import getpass
import hashlib
import json
import os
import pathlib
import shlex
import subprocess
import time
from datetime import datetime, timezone
from importlib.util import spec_from_file_location, module_from_spec

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, path):
    spec = spec_from_file_location(name, ROOT/path)
    module = module_from_spec(spec); spec.loader.exec_module(module)
    return module


boundary = load('session_rollout_boundary', 'scripts/session-expiry-ui-preflight.py')
rollout = load('session_rollout_prior', 'scripts/faq-expiry-rollout.py')
rollout.plan = boundary.prior


def validate_review(value):
    if (value.get('review') != 'PASS' or value.get('decision') != 'PASS'
            or not value.get('reviewer') or not value.get('reviewDate') or value.get('exceptions') != []
            or value.get('scope') != 'EXACT_B_SESSION_EXPIRY_UI_CANDIDATE_AND_BOUND_EVIDENCE_ONLY'
            or value.get('base') != boundary.BASE or value.get('candidate') != boundary.CANDIDATE):
        raise ValueError('EXACT_B_UI_REVIEW_REQUIRED')
    if len(value.get('files', [])) != 5 or len(value.get('sources', [])) != 8:
        raise ValueError('EXACT_REVIEW_SET_REQUIRED')
    seen = set()
    for entry in value['files']+value['sources']:
        path = (ROOT/entry['path']).resolve()
        if not path.is_relative_to(ROOT) or path in seen or hashlib.sha256(path.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('REVIEW_BINDING_CHANGED')
        seen.add(path)


def promotion_program(expected, ca, mac):
    program = rollout.promotion_program('B', expected, ca, mac)
    old = "overlay=stage+'/faq-expiry-reviewed-20261010.yml'"
    if program.count(old) != 1: raise ValueError('PRIOR_OVERLAY_CONTRACT_CHANGED')
    # Preserve the four existing files, including the FAQ overlay. Add one new
    # image overlay; rollback excludes only this fifth file.
    return program.replace(old, "overlay=stage+'/session-expiry-reviewed-20261010.yml'")


def main():
    import paramiko
    parser = argparse.ArgumentParser(); parser.add_argument('--apply', action='store_true'); parser.add_argument('--preflight')
    args = parser.parse_args()
    if not args.apply:
        return subprocess.run([os.sys.executable, str(ROOT/'scripts/session-expiry-ui-preflight.py')], timeout=150).returncode
    review = json.loads((ROOT/'artifacts/workstation/session-expiry-ui-review-manifest-20261010.json').read_text(encoding='utf-8-sig'))
    validate_review(review)
    head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, timeout=10).decode().strip()
    if head != review['head']: raise ValueError('REVIEWED_HEAD_CHANGED')
    receipt = (ROOT/(args.preflight or '')).resolve()
    if not receipt.is_relative_to(ROOT/'artifacts/workstation') or receipt.name != 'result.json': raise ValueError('EXACT_PREFLIGHT_REQUIRED')
    expected = json.loads(receipt.read_text(encoding='utf-8-sig')); rollout.validate_preflight('B', expected)
    boundary.context('B', {'com.docker.compose.project': expected['project'],
        'com.docker.compose.project.working_dir': expected['workingDirectory'],
        'com.docker.compose.project.config_files': ','.join(expected['files'])})
    scan = json.loads((ROOT/'artifacts/security/container-scan/session-expiry-ui-20261010.json').read_text())
    age = (datetime.now(timezone.utc)-datetime.fromisoformat(scan['CreatedAt'].replace('Z', '+00:00'))).total_seconds()
    if not 0 <= age < 86400 or scan['Metadata']['ImageID'] != boundary.CANDIDATE or not isinstance(scan.get('Results'), list) or any(v.get('Severity') in ['HIGH','CRITICAL'] for r in scan['Results'] for v in r.get('Vulnerabilities', [])):
        raise ValueError('EXACT_FRESH_CLEAN_SCAN_REQUIRED')
    ops = load('session_rollout_ops', 'scripts/workstation-automatic-ops.py')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    directory = ROOT/'artifacts/workstation'/('session-expiry-ui-rollout-'+stamp); directory.mkdir(parents=True, exist_ok=False)
    client = paramiko.SSHClient(); trust = None; credential = None; started = time.monotonic()
    try:
        credential = getpass.getpass('VM credential (concealed): '); trust = ops.LocalVmTrust()
        key = trust.key('B', credential, directory/'B-public-host.key'); address, mac, _ = ops.ROLES['B']
        client.get_host_keys().add(address, key.get_name(), key); client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        prefix = "sudo -S -p '' "
        code, out = ops.run(client, prefix+'timeout 10s docker inspect '+shlex.quote(expected['containerId'])+" --format '{{.Image}}|{{.State.Health.Status}}'", credential=credential, seconds=15)
        if code or out.strip() != boundary.BASE+'|healthy': raise ValueError('CURRENT_BASELINE_DRIFT')
        archive = directory/'reviewed-image.tar'
        subprocess.run(['docker','save','-o',str(archive),boundary.CANDIDATE], check=True, capture_output=True, timeout=180)
        with archive.open('rb') as stream: digest = hashlib.file_digest(stream, 'sha256').hexdigest()
        remote = '/home/server/.highpass-session-expiry-'+stamp
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(15); sftp.mkdir(remote, mode=0o700); transfer_started = time.monotonic()
            def deadline(done, total):
                if time.monotonic()-transfer_started > 180: raise TimeoutError('TRANSFER_DEADLINE')
            sftp.put(str(archive), remote+'/reviewed-image.tar', callback=deadline); sftp.chmod(remote+'/reviewed-image.tar', 0o600)
        code, out = ops.run(client, 'sha256sum '+shlex.quote(remote+'/reviewed-image.tar'), seconds=15)
        if code or out.split()[0] != digest: raise ValueError('TRANSFER_HASH_MISMATCH')
        code, out = ops.run(client, prefix+'timeout 60s docker load -i '+shlex.quote(remote+'/reviewed-image.tar'), credential=credential, seconds=65)
        if code: raise ValueError('EXACT_IMAGE_LOAD_FAILED')
        ca = (ROOT/'tmp/certs/mtls/ca.crt').read_text()
        code, out = ops.run(client, prefix+'timeout 300s python3 -c '+shlex.quote(promotion_program(expected, ca, mac)), credential=credential, seconds=305)
        result = json.loads(out)
        if code and result.get('status') == 'PASS': result = {'status':'NOT VERIFIED','reason':'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status':'NOT VERIFIED','reason':type(error).__name__,'remoteState':'REINSPECT_BEFORE_RETRY'}
    finally:
        client.close()
        if trust: trust.close()
        credential = None
    result.update({'observedAt':datetime.now(timezone.utc).isoformat(),'elapsedSeconds':round(time.monotonic()-started,3),'review':'DRAFT / UNASSIGNED'})
    path = directory/'result.json'; path.write_text(json.dumps(result, indent=2)+'\n', encoding='utf8')
    print(json.dumps({'evidence':str(path),**result}), flush=True)
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__': raise SystemExit(main())
