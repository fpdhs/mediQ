"""Paired source-file operator: default read-only, exact review required for install."""
import argparse
import base64
import getpass
import hashlib
import importlib.util
import json
import logging
import os
import pathlib
import shlex
import time
import uuid
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = 'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json'


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


files = load('paired_source_files', 'scripts/lib/hcc_source_file_assets.py')


def manifest_bytes():
    path = ROOT / MANIFEST
    if path.is_symlink() or not path.resolve().is_relative_to(ROOT / 'artifacts/synthetic-hcc-ct'):
        raise ValueError('EXACT_SOURCE_MANIFEST_PATH_REQUIRED')
    raw = path.read_bytes()
    if not 0 < len(raw) < 4 * 1024 * 1024:
        raise ValueError('BOUNDED_MANIFEST_REQUIRED')
    data = json.loads(raw)
    expected = {'datasetType': 'SYNTHETIC', 'clinicalUse': False,
        'studyInstanceUID': '2.25.259656708708993797343330994179169711072',
        'seriesInstanceUID': '2.25.18361638789025095699746776899955737977',
        'canonicalManifestSha256': 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721',
        'totalInstances': 700, 'totalDicomBytes': 2202766342}
    if any(data.get(key) != value for key, value in expected.items()):
        raise ValueError('FIXED_SYNTHETIC_DATASET_REQUIRED')
    records = data.get('instances', [])
    if len(records) != 700 or len({row['sopInstanceUID'] for row in records}) != 700:
        raise ValueError('FIXED_MANIFEST_INVENTORY_REQUIRED')
    inventory = sorted([[row['sopInstanceUID'], row['bytes'], row['sha256']] for row in records], key=lambda row: row[0])
    digest = hashlib.sha256(json.dumps(inventory, separators=(',', ':')).encode()).hexdigest()
    if digest != 'a2c4087efcad2f5594a54dd7c3f3563204e81b30f3d7afe45322a454d28b2207':
        raise ValueError('FIXED_MANIFEST_INVENTORY_HASH_REQUIRED')
    return raw


def exchange(client, role, operation, payload=None, credential=None):
    """Sensitive input stays on SSH stdin. Discard stderr; output is bounded JSON only."""
    prefix = "sudo -S -p ''" if role == 'a' else 'sudo -n'
    command = prefix + ' timeout 20s python3 -c ' + shlex.quote(files.remote_program(role, operation))
    stdin, stdout, stderr = client.exec_command(command, timeout=5, get_pty=False)
    channel = stdout.channel
    channel.settimeout(5)
    deadline = time.monotonic() + 25
    output = bytearray()
    try:
        if credential is not None:
            channel.sendall((credential + '\n').encode())
        if payload is not None:
            raw = json.dumps(payload, separators=(',', ':')).encode()
            if len(raw) >= 6 * 1024 * 1024:
                raise ValueError('SOURCE_PAYLOAD_LIMIT')
            for start in range(0, len(raw), 32768):
                if time.monotonic() >= deadline:
                    raise TimeoutError('SOURCE_FILE_EXCHANGE_TIMEOUT')
                channel.sendall(raw[start:start + 32768])
        channel.shutdown_write()
        while time.monotonic() < deadline:
            if channel.recv_ready():
                output.extend(channel.recv(4096))
                if len(output) > 16384:
                    raise ValueError('SOURCE_RESPONSE_LIMIT')
            if channel.recv_stderr_ready():
                channel.recv_stderr(4096)  # Never forward unknown remote error content.
            if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
                code = channel.recv_exit_status()
                result = json.loads(output)
                allowed = {'status', 'role', 'canCreateExclusiveSourceFiles', 'contentsRead',
                           'sourceFilesVerified', 'credentialReturned', 'reason'}
                if code or result.get('status') != 'PASS' or result.get('role') != role or not set(result) <= allowed:
                    raise ValueError('SOURCE_FILE_REMOTE_NOT_VERIFIED')
                if operation == 'preflight':
                    if result.get('canCreateExclusiveSourceFiles') is not True or result.get('contentsRead') is not False:
                        raise ValueError('SOURCE_PREFLIGHT_INVALID')
                elif result.get('sourceFilesVerified') is not True or result.get('credentialReturned') is not False:
                    raise ValueError('SOURCE_VERIFICATION_INVALID')
                return result
            time.sleep(0.05)
        raise TimeoutError('SOURCE_FILE_EXCHANGE_TIMEOUT')
    finally:
        channel.close()


class Adapter:
    def __init__(self, client, role, manifest, credential=None):
        self.client, self.role, self.manifest, self.credential = client, role, manifest, credential

    def preflight(self):
        return exchange(self.client, self.role, 'preflight', credential=self.credential)

    def payload(self, token):
        value = {'token': token.decode('ascii')}
        if self.role == 'a':
            value.update({'manifest': base64.b64encode(self.manifest).decode('ascii'),
                          'manifestSha256': hashlib.sha256(self.manifest).hexdigest()})
        return value

    def install(self, token, manifest):
        if manifest != (self.manifest if self.role == 'a' else None):
            raise ValueError('ROLE_MANIFEST_PAYLOAD_REQUIRED')
        exchange(self.client, self.role, 'install', self.payload(token), self.credential)

    def verify(self, token, manifest_sha256):
        expected = hashlib.sha256(self.manifest).hexdigest() if self.role == 'a' else None
        if manifest_sha256 != expected:
            raise ValueError('EXACT_MANIFEST_VERIFICATION_REQUIRED')
        exchange(self.client, self.role, 'verify', self.payload(token), self.credential)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate-manifest', type=pathlib.Path, required=True)
    parser.add_argument('--review', type=pathlib.Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--write-review-draft', action='store_true')
    args = parser.parse_args()
    if args.apply and args.write_review_draft:
        raise ValueError('DRAFT_CANNOT_AUTHORIZE_SOURCE_FILE_APPLY')
    if args.apply and not args.review:
        raise ValueError('EXACT_SOURCE_FILE_REVIEW_REQUIRED')
    candidate = args.candidate_manifest.absolute()
    if candidate.is_symlink() or not candidate.resolve().is_relative_to(ROOT / 'artifacts/workstation'):
        raise ValueError('OWNED_CANDIDATE_MANIFEST_REQUIRED')
    data = json.loads(candidate.read_text(encoding='utf8'))
    if data.get('status') != 'PASS' or len(data.get('images', [])) != 3:
        raise ValueError('EXACT_SOURCE_CANDIDATES_REQUIRED')
    candidates = {row['role']: row['id'] for row in data['images']}
    if set(candidates) != {'a', 'control', 'ingress'}:
        raise ValueError('EXACT_SOURCE_ROLES_REQUIRED')
    raw = manifest_bytes()
    required = [candidate.relative_to(ROOT).as_posix(), MANIFEST, 'scripts/hcc-source-file-assets.py',
                'scripts/lib/hcc_source_file_assets.py', 'scripts/lib/hcc_source_rollout.py',
                'scripts/workstation-automatic-ops.py']
    if args.write_review_draft:
        draft = {'review': 'DRAFT / UNASSIGNED', 'reviewer': None, 'reviewDate': None,
            'exceptions': [], 'scope': 'PAIRED_A_CLOUD_SOURCE_CREDENTIAL_AND_A_MANIFEST_ONLY_NOT_ACTIVATION',
            'candidates': candidates,
            'files': [{'path': name, 'sha256': hashlib.sha256((ROOT / name).read_bytes()).hexdigest()}
                      for name in required]}
        target = candidate.parent / 'source-file-review-draft.json'
        with target.open('x', encoding='utf8') as stream:
            stream.write(json.dumps(draft, indent=2) + '\n')
        print(json.dumps({'status': 'DRAFT / UNASSIGNED', 'evidence': str(target),
                          'remote': 'NOT EXECUTED', 'credentialsGenerated': False}))
        return 0
    if args.apply:
        guard = load('source_file_review', 'scripts/lib/hcc_source_rollout.py')
        guard.validate_review(ROOT, json.loads(args.review.read_text(encoding='utf8')), candidates, required)
    import paramiko
    logging.getLogger('paramiko').setLevel(logging.CRITICAL)
    ops = load('source_pair_ops', 'scripts/workstation-automatic-ops.py')
    directory = ROOT / 'artifacts/workstation' / ('hcc-source-file-assets-' + uuid.uuid4().hex)
    directory.mkdir(exist_ok=False)
    clients = {'cloud': paramiko.SSHClient(), 'a': paramiko.SSHClient()}
    credential, trust = None, None
    try:
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        cloud = clients['cloud']; cloud.load_host_keys(str(identity / 'known_hosts'))
        cloud.set_missing_host_key_policy(paramiko.RejectPolicy())
        cloud.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'),
                      look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
        credential = getpass.getpass('VM credential (concealed): ')
        trust = ops.LocalVmTrust(); key = trust.key('A', credential, directory / 'A-public-host.key')
        address, _, _ = ops.ROLES['A']; a = clients['a']
        a.get_host_keys().add(address, key.get_name(), key); a.set_missing_host_key_policy(paramiko.RejectPolicy())
        a.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False,
                  timeout=10, banner_timeout=10, auth_timeout=10)
        adapters = {'cloud': Adapter(cloud, 'cloud', raw), 'a': Adapter(a, 'a', raw, credential)}
        if args.apply:
            result = files.provision_pair(adapters, raw, hashlib.sha256(raw).hexdigest())
        else:
            observations = {role: adapters[role].preflight() for role in ['cloud', 'a']}
            result = {'status': 'PASS', 'scope': 'PAIRED_SOURCE_FILE_PREREQUISITES_READ_ONLY',
                      'observations': observations, 'partialWritePossible': False}
    except Exception:
        result = {'status': 'NOT VERIFIED', 'reason': 'PAIR_PREREQUISITES_OR_EXCHANGE_NOT_COMPLETED',
                  'recovery': 'REINSPECT_EXACT_SOURCE_FILES_BEFORE_RETRY'}
    finally:
        for client in clients.values():
            client.close()
        if trust:
            trust.close()
        credential = None
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'review': 'DRAFT / UNASSIGNED',
                  'manifestFileSha256': hashlib.sha256(raw).hexdigest(), 'deployment': 'NOT EXECUTED'})
    target = directory / 'result.json'
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'evidence': str(target), **result}), flush=True)
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
