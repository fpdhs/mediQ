"""Role-pinned image asset verification/transfer; never Compose or credential changes."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shlex
import stat
import tarfile
import threading
import time
import uuid
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def file_hash(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def upload_archives(sftp, directory, rows, stage, progress, seconds=180):
    """Exclusive pipelined writes; deadline also bounds response drain/close.

    Submitted bytes are diagnostic only. Remote size/hash checks remain mandatory
    before Docker load; a successful local write is not proof of remote integrity.
    """
    channel = sftp.get_channel()
    deadline = time.monotonic() + seconds
    expired = threading.Event()

    def interrupt_upload():
        expired.set()
        channel.close()

    timer = threading.Timer(seconds, interrupt_upload)
    timer.daemon = True
    timer.start()

    def check_deadline():
        remaining = deadline - time.monotonic()
        if expired.is_set() or remaining <= 0:
            raise TimeoutError('BOUNDED_ASSET_UPLOAD_TIMEOUT')
        channel.settimeout(min(20, remaining))

    try:
        for row in rows:
            check_deadline()
            observation = {'role': row['role'], 'bytesSubmitted': 0,
                           'expectedBytes': row['bytes'], 'closeCompleted': False}
            progress.append(observation)
            with (directory / row['path']).open('rb') as source, sftp.open(stage + '/' + row['path'], 'wx') as target:
                sftp.chmod(stage + '/' + row['path'], 0o600)
                target.set_pipelined(True)
                while chunk := source.read(1024 * 1024):
                    check_deadline()
                    target.write(chunk)
                    observation['bytesSubmitted'] += len(chunk)
                check_deadline()
            # Pipelined errors can surface during close, not just during write.
            check_deadline()
            if observation['bytesSubmitted'] != row['bytes']:
                raise ValueError('LOCAL_UPLOAD_SIZE_CHANGED')
            info = sftp.lstat(stage + '/' + row['path'])
            if not stat.S_ISREG(info.st_mode) or info.st_size != row['bytes'] or stat.S_IMODE(info.st_mode) != 0o600:
                raise ValueError('REMOTE_UPLOAD_SIZE_OR_MODE_MISMATCH')
            check_deadline()
            observation['closeCompleted'] = True
    except Exception:
        if expired.is_set() or time.monotonic() >= deadline:
            raise TimeoutError('BOUNDED_ASSET_UPLOAD_TIMEOUT') from None
        raise
    finally:
        timer.cancel()


def diagnostic_code(error):
    """Never publish raw exception text, remote output or credential material."""
    if isinstance(error, TimeoutError):
        return 'BOUNDED_OPERATION_TIMEOUT'
    if isinstance(error, ValueError):
        return 'VALIDATION_OR_REMOTE_RESULT_REJECTED'
    if isinstance(error, OSError):
        return 'TRANSPORT_OR_FILE_IO_FAILED'
    return 'OPERATION_NOT_VERIFIED'


def verify_archives(manifest_path):
    """No extraction. Bind all archive descriptors and exact export role/tag/ID."""
    if manifest_path.is_symlink() or not manifest_path.resolve().is_relative_to(ROOT / 'artifacts/workstation'):
        raise ValueError('OWNED_EXPORT_MANIFEST_REQUIRED')
    data = json.loads(manifest_path.read_text(encoding='utf8'))
    if data.get('status') != 'PASS' or len(data.get('images', [])) != 3 or len(data.get('exports', [])) != 3:
        raise ValueError('THREE_ROLE_EXPORT_REQUIRED')
    images = {row['role']: row for row in data['images']}
    exports = {row['role']: row for row in data['exports']}
    if set(images) != {'a', 'control', 'ingress'} or set(exports) != set(images):
        raise ValueError('EXACT_DESTINATION_ROLES_REQUIRED')
    for role, row in exports.items():
        image = images[role]
        if (row['path'] != role + '.tar' or image.get('sourceMatch') != 'PASS'
                or row['imageId'] != image['id'] or not re.fullmatch(r'sha256:[a-f0-9]{64}', image['id'])
                or not re.fullmatch(r'highpass-platform-mvp:capstone-hcc-source-[a-z0-9-]{1,70}', image['image'])
                or row['destination'] != ('HIGH_PASS_HOSPITAL_A' if role == 'a' else 'HIGH_PASS_CLOUD')):
            raise ValueError('ROLE_ARCHIVE_IDENTITY_MISMATCH')
        source = manifest_path.parent / row['path']
        if source.is_symlink() or not source.is_file() or not 0 < row['bytes'] < 512 * 1024 * 1024:
            raise ValueError('REGULAR_BOUNDED_ARCHIVE_REQUIRED')
        if source.stat().st_size != row['bytes'] or file_hash(source) != row['sha256']:
            raise ValueError('ARCHIVE_BYTES_CHANGED')
        with tarfile.open(source, 'r:') as archive:
            members = archive.getmembers()
            names = [member.name for member in members]
            if len(names) != len(set(names)) or any(not (m.isfile() or m.isdir()) for m in members):
                raise ValueError('ARCHIVE_DUPLICATE_OR_SPECIAL_MEMBER')
            for name in names:
                path = pathlib.PurePosixPath(name)
                if path.is_absolute() or '..' in path.parts or '\\' in name:
                    raise ValueError('UNSAFE_ARCHIVE_MEMBER')

            def read_json(name):
                member = archive.getmember(name)
                if not member.isfile() or member.size > 4 * 1024 * 1024:
                    raise ValueError('BOUNDED_ARCHIVE_METADATA_REQUIRED')
                with archive.extractfile(member) as stream:
                    return json.load(stream)

            docker = read_json('manifest.json')
            if len(docker) != 1 or docker[0].get('RepoTags') != [image['image']]:
                raise ValueError('EXACT_SINGLE_ARCHIVE_TAG_REQUIRED')
            index = read_json('index.json')
            if len(index.get('manifests', [])) != 1 or index['manifests'][0]['digest'] != image['id']:
                raise ValueError('EXACT_ARCHIVE_INDEX_REQUIRED')
            seen = {}

            def verify_descriptor(descriptor, depth=0):
                digest = descriptor['digest']
                if depth > 8 or not re.fullmatch(r'sha256:[a-f0-9]{64}', digest):
                    raise ValueError('BOUNDED_OCI_DESCRIPTOR_REQUIRED')
                identity = (descriptor['size'], descriptor.get('mediaType', ''))
                if digest in seen:
                    if seen[digest] != identity:
                        raise ValueError('CONFLICTING_OCI_DESCRIPTOR')
                    return
                seen[digest] = identity
                name = 'blobs/sha256/' + digest.split(':')[1]
                member = archive.getmember(name)
                if not member.isfile() or member.size != descriptor['size']:
                    raise ValueError('OCI_DESCRIPTOR_SIZE_MISMATCH')
                with archive.extractfile(member) as stream:
                    if hashlib.file_digest(stream, 'sha256').hexdigest() != digest.split(':')[1]:
                        raise ValueError('OCI_DESCRIPTOR_HASH_MISMATCH')
                kind = descriptor.get('mediaType', '')
                if kind.endswith('index.v1+json') or kind.endswith('manifest.v1+json'):
                    node = read_json(name)
                    for child in node.get('manifests', []):
                        verify_descriptor(child, depth + 1)
                    if 'config' in node:
                        verify_descriptor(node['config'], depth + 1)
                        for child in node['layers']:
                            verify_descriptor(child, depth + 1)

            verify_descriptor(index['manifests'][0])
            # Docker load also consumes legacy manifest paths: bind them to verified blobs.
            for name in [docker[0]['Config'], *docker[0]['Layers']]:
                if name not in {'blobs/sha256/' + digest.split(':')[1] for digest in seen}:
                    raise ValueError('UNVERIFIED_DOCKER_LOAD_MEMBER')
    return data


def remote_program(role, rows, stage, owner_uid=1000, source_upgrade=False):
    """Requires uploaded regular files and preserves every protected runtime identity."""
    if role not in ('a', 'cloud'):
        raise ValueError('NO_HOSPITAL_B_DESTINATION')
    home = '/home/server' if role == 'a' else '/home/highpassadmin'
    if not re.fullmatch(re.escape(home) + r'/\.highpass-hcc-images-[a-f0-9]{32}', stage):
        raise ValueError('EXCLUSIVE_ROLE_STAGE_REQUIRED')
    if not isinstance(owner_uid, int) or owner_uid <= 0:
        raise ValueError('NON_ROOT_SSH_STAGE_OWNER_REQUIRED')
    return 'ROLE=' + repr(role) + '\nROWS=' + repr(rows) + '\nSTAGE=' + repr(stage) + '\nOWNER_UID=' + repr(owner_uid) + '\nSOURCE_UPGRADE='+repr(source_upgrade)+'\n' + r'''
import subprocess,json,pathlib,hashlib,stat
def run(args):
 value=subprocess.run(args,capture_output=True,timeout=90)
 if value.returncode:raise RuntimeError('IMAGE_ASSET_COMMAND_FAILED')
 return value.stdout
names=(['hp-capstone-a-gateway-gateway-1','hp-capstone-hospital-a-orthanc-1','hp-capstone-hospital-a-orthanc-mtls-1']
 if ROLE=='a' else ['hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1'])
def identity():
 items=json.loads(run(['docker','inspect',*names]))
 assert all(i['State']['Running'] for i in items)
 return [{k:i[k] for k in ['Id','Image','Config','Mounts','HostConfig']} for i in items]
before=identity()
expected=(['sha256:30141f8128a26ab2b3ed987d419078382093e69310c768a4318786a71916b2df'] if ROLE=='a' else ['sha256:11a23eea8a6181b697beec13827addc5b8b391eb5314e190243e083c5c48b92b',
 'sha256:9c210296445760b659a12fe141830b5ffdc407f3ee12c7ab7bd6589b5f0079cb'])
if SOURCE_UPGRADE:
 expected=(['sha256:2bc261db0b0e2d03aed101bc9635cbdf8061c8b60b546ce7f54acf5022315d17'] if ROLE=='a' else
 ['sha256:e435f9c631819c3ba03cebd9ffb2af0a55ca17c18e6aa6ce468d9f736c440ef2',
  'sha256:ac29dc9d739bb1fd6fa6caebd2ee001dbbbf551a51d982b8d69b7df6dda10eb5'])
assert before[0]['Image']==expected[0]
if ROLE=='cloud':
 assert before[1]['Image']==expected[1]
 assert run(['hostname']).decode().strip()=='highpass-cloud'
else:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()=='00:0c:29:25:f6:b4'
stage=pathlib.Path(STAGE);info=stage.lstat()
assert stat.S_ISDIR(info.st_mode) and stat.S_IMODE(info.st_mode)==0o700
assert info.st_uid==OWNER_UID
for row in ROWS:
 target=stage/row['path'];info=target.lstat()
 assert stat.S_ISREG(info.st_mode) and stat.S_IMODE(info.st_mode)==0o600 and info.st_uid==stage.stat().st_uid
 assert info.st_size==row['bytes']
 with target.open('rb') as stream:assert hashlib.file_digest(stream,'sha256').hexdigest()==row['sha256']
loaded=[]
try:
 for row in ROWS:
  run(['docker','image','load','--input',str(stage/row['path'])])
  value=json.loads(run(['docker','image','inspect',row['image']]))[0]
  assert value['Id']==row['imageId'] and value['Config']['User'] in ['65532','65532:65532']
  loaded.append(row['role'])
 assert identity()==before
 print(json.dumps({'status':'PASS','loadedRoles':loaded,'containersUnchanged':True,
  'scope':'ROLE_IMAGE_LOAD_ONLY_NOT_DEPLOYMENT_CREDENTIAL_OR_SOURCE_PROOF'}))
except Exception:
 unchanged=False
 try:unchanged=identity()==before
 except Exception:pass
 print(json.dumps({'status':'NOT VERIFIED','loadedRoles':loaded,'containersUnchanged':unchanged,
  'reason':'REINSPECT_IMAGE_AND_RUNTIME_STATE_BEFORE_RETRY'}));raise SystemExit(2)
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidate-manifest', type=pathlib.Path, required=True)
    parser.add_argument('--role', choices=['a', 'cloud'], required=True)
    parser.add_argument('--review', type=pathlib.Path)
    parser.add_argument('--write-review-draft', action='store_true')
    parser.add_argument('--review-draft-path', type=pathlib.Path,
                        help='Exclusive new draft path; never replace a prior review packet')
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--upgrade-active-source',action='store_true')
    args = parser.parse_args()
    if args.apply and args.write_review_draft:
        raise ValueError('DRAFT_CANNOT_AUTHORIZE_APPLY')
    if args.apply and not args.review:
        raise ValueError('EXACT_ASSET_REVIEW_REQUIRED')
    manifest_path = args.candidate_manifest.absolute()
    data = verify_archives(manifest_path)
    images = {row['role']: row for row in data['images']}
    selected = [row | {'image': images[row['role']]['image']} for row in data['exports']
                if (row['role'] == 'a') == (args.role == 'a')]
    required = [manifest_path.relative_to(ROOT).as_posix(),
        *[(manifest_path.parent / row['path']).relative_to(ROOT).as_posix() for row in data['exports']],
        'scripts/hcc-source-image-assets.py', 'scripts/lib/hcc_source_rollout.py']
    if args.write_review_draft:
        draft = {'review': 'DRAFT / UNASSIGNED', 'reviewer': None, 'reviewDate': None,
            'exceptions': [], 'scope': 'A_AND_CLOUD_IMAGE_TRANSFER_LOAD_ONLY_NO_CREDENTIALS_OR_ACTIVATION',
            'candidates': {role: row['id'] for role, row in images.items()},
            'files': [{'path': path, 'sha256': file_hash(ROOT / path)} for path in required]}
        target = args.review_draft_path or manifest_path.parent / 'image-asset-review-draft.json'
        if target.parent.resolve() != manifest_path.parent.resolve() or target.is_symlink():
            raise ValueError('OWNED_REVIEW_DRAFT_PATH_REQUIRED')
        with target.open('x', encoding='utf8') as stream:
            stream.write(json.dumps(draft, indent=2) + '\n')
    if not args.apply:
        print(json.dumps({'status': 'PASS', 'review': 'DRAFT / UNASSIGNED',
            'scope': 'LOCAL_ARCHIVE_CONTENT_ONLY_NOT_REMOTE_TRANSFER_OR_LOAD',
            'selectedRoles': [row['role'] for row in selected], 'remote': 'NOT VERIFIED'}))
        return 0
    guard = load('asset_review_guard', 'scripts/lib/hcc_source_rollout.py')
    review=json.loads(args.review.read_text(encoding='utf8'))
    if args.upgrade_active_source and review.get('sourceUpgrade') is not True:
        raise ValueError('SOURCE_UPGRADE_REVIEW_REQUIRED')
    guard.validate_review(ROOT, review,
                          {role: row['id'] for role, row in images.items()}, required)
    import paramiko
    ops = load('asset_ops', 'scripts/workstation-automatic-ops.py')
    client = paramiko.SSHClient()
    credential, trust = None, None
    directory = ROOT / 'artifacts/workstation' / ('hcc-source-image-assets-' + uuid.uuid4().hex)
    directory.mkdir(exist_ok=False)
    stage = None
    started = time.monotonic()
    phase, progress = 'CONNECT', []
    try:
        if args.role == 'cloud':
            identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
            client.load_host_keys(str(identity / 'known_hosts'))
            address, user, home = '138.91.2.60', 'highpassadmin', '/home/highpassadmin'
            auth = {'key_filename': str(identity / 'id_ed25519')}
        else:
            credential = getpass.getpass('VM credential (concealed): ')
            trust = ops.LocalVmTrust()
            key = trust.key('A', credential, directory / 'A-public-host.key')
            address, _, _ = ops.ROLES['A']
            user, home = 'server', '/home/server'
            client.get_host_keys().add(address, key.get_name(), key)
            auth = {'password': credential}
        client.set_missing_host_key_policy(paramiko.RejectPolicy())
        client.connect(address, username=user, look_for_keys=False, allow_agent=False,
                       timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15, **auth)
        stage = home + '/.highpass-hcc-images-' + uuid.uuid4().hex
        phase = 'EXCLUSIVE_STAGE'
        with client.open_sftp() as sftp:
            sftp.get_channel().settimeout(20)
            parent = sftp.lstat(home)
            if not stat.S_ISDIR(parent.st_mode) or parent.st_mode & 0o022 or not parent.st_uid:
                raise ValueError('PRIVATE_ROLE_PARENT_REQUIRED')
            sftp.mkdir(stage, mode=0o700)
            if stat.S_IMODE(sftp.lstat(stage).st_mode) != 0o700:
                raise ValueError('PRIVATE_STAGE_MODE_REQUIRED')
            phase = 'ARCHIVE_UPLOAD'
            upload_archives(sftp, manifest_path.parent, selected, stage, progress)
        phase = 'REMOTE_VERIFY_AND_LOAD'
        prefix = "sudo -S -p ''" if args.role == 'a' else 'sudo -n'
        code, output = ops.run(client, prefix + ' timeout 240s python3 -c ' + shlex.quote(
            remote_program(args.role, selected, stage, parent.st_uid,args.upgrade_active_source)), credential=credential, seconds=245)
        result = json.loads(output)
        if code and result.get('status') == 'PASS':
            result = {'status': 'NOT VERIFIED', 'reason': 'EXIT_MISMATCH'}
    except Exception as error:
        result = {'status': 'NOT VERIFIED', 'reason': 'REINSPECT_STAGE_IMAGES_AND_RUNTIME_BEFORE_RETRY',
                  'diagnosticCode': diagnostic_code(error)}
    finally:
        client.close()
        if trust:
            trust.close()
        credential = None
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'review': 'DRAFT / UNASSIGNED',
        'phase': phase, 'transferProgress': progress, 'elapsedSeconds': round(time.monotonic() - started, 3),
        'remoteStage': stage, 'role': args.role, 'candidateManifestSha256': file_hash(manifest_path),
        'cleanup': 'NOT EXECUTED — retain exact stage for reconciliation', 'deployment': 'NOT EXECUTED'})
    receipt = directory / 'result.json'
    receipt.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'evidence': str(receipt), **result}))
    return 0 if result.get('status') == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
