"""Pinned cloud transport test with disposable public bytes; no image load/activation."""
import hashlib
import importlib.util
import json
import os
import pathlib
import stat
import tempfile
import time
import uuid
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent


def main():
    import paramiko
    spec = importlib.util.spec_from_file_location('image_upload_check', ROOT / 'scripts/hcc-source-image-assets.py')
    assets = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(assets)
    identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
    client = paramiko.SSHClient()
    client.load_host_keys(str(identity / 'known_hosts'))
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    stage = '/home/highpassadmin/.highpass-hcc-upload-check-' + uuid.uuid4().hex
    created = False
    cleanup = False
    progress = []
    started = time.monotonic()
    result = {'status': 'NOT VERIFIED', 'scope': 'PUBLIC_SCRATCH_TRANSPORT_ONLY_NOT_IMAGE_SUPPLY'}

    def runtime():
        command = "sudo -n timeout 15s docker inspect hp-capstone-control-control-1 hp-capstone-control-ingress-1 hp-capstone-control-postgres-1"
        _, stdout, stderr = client.exec_command(command, timeout=20)
        raw = stdout.read()
        stderr.read()  # Do not expose config or unexpected remote details.
        if stdout.channel.recv_exit_status():
            raise ValueError('RUNTIME_OBSERVATION_FAILED')
        items = json.loads(raw)
        if len(items) != 3 or not all(item['State']['Running'] for item in items):
            raise ValueError('PROTECTED_RUNTIME_REQUIRED')
        public_digest = [{key: item[key] for key in ['Id', 'Image', 'Config', 'Mounts', 'HostConfig']}
                         | {'StartedAt': item['State']['StartedAt']} for item in items]
        return hashlib.sha256(json.dumps(public_digest, sort_keys=True).encode()).hexdigest()

    try:
        client.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'),
                       look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10)
        before = runtime()
        with client.open_sftp() as sftp, tempfile.TemporaryDirectory() as temporary:
            sftp.get_channel().settimeout(20)
            parent = sftp.lstat('/home/highpassadmin')
            if not stat.S_ISDIR(parent.st_mode) or parent.st_mode & 0o022 or not parent.st_uid:
                raise ValueError('PRIVATE_PARENT_REQUIRED')
            sftp.mkdir(stage, mode=0o700)
            created = True
            info = sftp.lstat(stage)
            if stat.S_IMODE(info.st_mode) != 0o700 or info.st_uid != parent.st_uid:
                raise ValueError('OWNED_SCRATCH_REQUIRED')
            raw = bytes(range(256)) * (8 * 1024 * 1024 // 256)
            source = pathlib.Path(temporary) / 'public-fixture.bin'
            source.write_bytes(raw)
            rows = [{'role': 'public-fixture', 'path': source.name, 'bytes': len(raw)}]
            transfer_start = time.monotonic()
            assets.upload_archives(sftp, source.parent, rows, stage, progress)
            upload_seconds = time.monotonic() - transfer_start
            with sftp.open(stage + '/public-fixture.bin', 'rb') as stream:
                if hashlib.file_digest(stream, 'sha256').digest() != hashlib.sha256(raw).digest():
                    raise ValueError('PUBLIC_FIXTURE_READBACK_HASH_MISMATCH')
            result.update({'status': 'PASS', 'fixtureBytes': len(raw), 'uploadSeconds': round(upload_seconds, 3),
                           'remoteReadbackHashMatched': True, 'protectedCloudRuntimeUnchanged': runtime() == before})
            if not result['protectedCloudRuntimeUnchanged']:
                result['status'] = 'NOT VERIFIED'
    except Exception as error:
        result.update({'status': 'NOT VERIFIED', 'diagnosticCode': assets.diagnostic_code(error)})
    finally:
        if created:
            try:
                with client.open_sftp() as sftp:
                    sftp.get_channel().settimeout(10)
                    info = sftp.lstat(stage)
                    if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode) != 0o700:
                        raise ValueError('SCRATCH_CLEANUP_BOUNDARY')
                    names = sftp.listdir(stage)
                    if names not in [[], ['public-fixture.bin']]:
                        raise ValueError('UNKNOWN_SCRATCH_CONTENTS')
                    if names:
                        sftp.remove(stage + '/public-fixture.bin')
                    sftp.rmdir(stage)
                    cleanup = True
            except Exception:
                cleanup = False
        client.close()
    if created and not cleanup:
        result['status'] = 'NOT VERIFIED'
    directory = ROOT / 'artifacts/workstation' / ('hcc-image-upload-check-' + uuid.uuid4().hex)
    directory.mkdir(exist_ok=False)
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(), 'review': 'DRAFT / UNASSIGNED',
                   'operatorSha256': assets.file_hash(ROOT / 'scripts/hcc-source-image-assets.py'),
                   'elapsedSeconds': round(time.monotonic() - started, 3), 'scratchCleanup': cleanup,
                   'remoteStage': stage, 'transferProgress': progress, 'imageLoad': 'NOT EXECUTED',
                   'deployment': 'NOT EXECUTED'})
    receipt = directory / 'result.json'
    receipt.write_text(json.dumps(result, indent=2) + '\n', encoding='utf8')
    print(json.dumps({'evidence': str(receipt), **result}))
    return 0 if result['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
