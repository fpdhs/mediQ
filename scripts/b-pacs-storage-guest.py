"""Root-only B storage lifecycle. No plaintext key file or automatic boot unlock.

Input token arrives ONLY on stdin from the authenticated operator. Failure leaves
new assets in place for inspection; never deletes, overwrites or formats old assets.
"""
import base64
import ctypes
import hashlib
import http.client
import json
import os
import pathlib
import re
import shutil
import socket
import ssl
import stat
import subprocess
import sys
import time
import uuid

DIRECTORY = pathlib.Path('/opt/highpass/b-pacs-storage')
BACKING = DIRECTORY / 'volume-8g.luks'
MANIFEST = DIRECTORY / 'storage.json'
MOUNT = pathlib.Path('/opt/highpass/b-pacs-encrypted')
ORTHANC_STORAGE = MOUNT / 'orthanc-db'
ORTHANC_UID = 10001
ORTHANC_GID = 10001
MAPPING = 'highpass-b-pacs'
DEVICE = '/dev/mapper/' + MAPPING
SIZE = 8 * 1024**3
HOST = 'kv-hp-demo-4869edd9.vault.azure.net'
KEY_BASE = 'https://' + HOST + '/keys/highpass-b-storage-kek-20261013'


def run(args, data=None, seconds=30):
    result = subprocess.run(args, input=data, capture_output=True, timeout=seconds)
    if result.returncode:
        raise RuntimeError('STORAGE_COMMAND_FAILED_' + pathlib.Path(args[0]).name)
    return result.stdout.decode().strip()


class PrivateVaultConnection(http.client.HTTPSConnection):
    def connect(self):
        self.sock = self._context.wrap_socket(
            socket.create_connection(('10.89.1.4', 443), self.timeout), server_hostname=HOST)


def vault(token, url, body=None):
    if not re.fullmatch(re.escape(KEY_BASE) + r'(?:/[a-f0-9]{32})?(?:/(?:create|wrapkey|unwrapkey|backup))?', url):
        raise ValueError('STORAGE_KEY_SCOPE_REQUIRED')
    connection = PrivateVaultConnection(HOST, timeout=10, context=ssl.create_default_context())
    try:
        connection.request('GET' if body is None else 'POST', url.split(HOST, 1)[1] + '?api-version=2025-07-01',
                           body=None if body is None else json.dumps(body),
                           headers={'authorization': 'Bearer ' + token, 'content-type': 'application/json'})
        response = connection.getresponse()
        payload = response.read(65537)
        if len(payload) > 65536:
            raise ValueError('VAULT_RESPONSE_LIMIT')
        return response.status, json.loads(payload)
    finally:
        connection.close()


def required_vault(token, url, body=None):
    deadline = time.monotonic() + 45
    while True:
        code, result = vault(token, url, body)
        if code == 200:
            return result
        if code != 403 or time.monotonic() >= deadline:
            raise RuntimeError('KEY_VAULT_HTTP_' + str(code))
        time.sleep(3)


def exclusive(path, data):
    descriptor = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def secure_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError('ROOT_ONLY_REGULAR_FILE_REQUIRED')


def validate_manifest(value):
    if value.get('schema') != 'HIGHPASS_B_STORAGE_V1' or value.get('role') != 'B' or value.get('sizeBytes') != SIZE:
        raise ValueError('STORAGE_MANIFEST_INVALID')
    if value.get('backingFile') != str(BACKING) or value.get('mount') != str(MOUNT) or value.get('mapping') != MAPPING:
        raise ValueError('STORAGE_PATH_INVALID')
    if not re.fullmatch(re.escape(KEY_BASE) + '/[a-f0-9]{32}', value.get('keyId', '')):
        raise ValueError('VERSION_PINNED_STORAGE_KEY_REQUIRED')
    if str(uuid.UUID(value['luksUuid'])) != value['luksUuid']:
        raise ValueError('LUKS_UUID_INVALID')
    if not re.fullmatch(r'[A-Za-z0-9_-]{342}', value.get('wrappedKey', '')) or len(base64.urlsafe_b64decode(value['wrappedKey'] + '===')) != 256:
        raise ValueError('WRAPPED_KEY_INVALID')
    return value


def loop_attach():
    secure_file(BACKING)
    if BACKING.stat().st_size != SIZE:
        raise ValueError('BACKING_SIZE_CHANGED')
    # No old/reused loop or mapping may be acted upon.
    if run(['losetup', '-j', str(BACKING)]):
        raise ValueError('BACKING_ALREADY_ATTACHED')
    loop = run(['losetup', '--find', '--show', str(BACKING)])
    if not re.fullmatch(r'/dev/loop\d+', loop):
        raise ValueError('LOOP_INVALID')
    actual = run(['losetup', '--noheadings', '--output', 'BACK-FILE', loop])
    if pathlib.Path(actual).resolve() != BACKING or pathlib.Path(actual).is_symlink():
        raise ValueError('LOOP_BACKING_MISMATCH')
    return loop


def unwrap(token, manifest):
    result = required_vault(token, manifest['keyId'] + '/unwrapkey',
                            {'alg': 'RSA-OAEP-256', 'value': manifest['wrappedKey']})
    if result.get('kid') != manifest['keyId']:
        raise ValueError('UNWRAP_KEY_VERSION_MISMATCH')
    key = bytearray(base64.urlsafe_b64decode(result['value'] + '==='))
    if len(key) != 32:
        key[:] = b'\0' * len(key)
        raise ValueError('UNWRAP_SIZE_INVALID')
    return key


def open_and_mount(loop, key, expected_uuid):
    if pathlib.Path(DEVICE).exists() or os.path.ismount(MOUNT):
        raise ValueError('EXISTING_MAPPING_OR_MOUNT_PRESERVED')
    if run(['cryptsetup', 'luksUUID', loop]) != expected_uuid:
        raise ValueError('LUKS_UUID_MISMATCH')
    run(['cryptsetup', 'open', '--type', 'luks2', '--key-file', '-', loop, MAPPING], data=key)
    # Caller formats ONLY on first create, not on recovery.


def mount_volume():
    run(['mount', '-o', 'nodev,nosuid,noexec', DEVICE, str(MOUNT)])
    source = run(['findmnt', '-n', '-o', 'SOURCE', '--mountpoint', str(MOUNT)])
    if source != DEVICE:
        raise ValueError('MOUNT_SOURCE_MISMATCH')
    os.chmod(MOUNT, 0o700)
    ensure_orthanc_storage()


def validate_orthanc_storage(mount_stat, directory_stat, is_symlink=False):
    if (is_symlink or not stat.S_ISDIR(directory_stat.st_mode)
        or directory_stat.st_dev != mount_stat.st_dev
        or directory_stat.st_uid != ORTHANC_UID or directory_stat.st_gid != ORTHANC_GID
        or stat.S_IMODE(directory_stat.st_mode) != 0o700):
        raise ValueError('ORTHANC_ENCRYPTED_DATA_DIRECTORY_INVALID')


def set_orthanc_storage_owner(path):
    if not hasattr(os, 'chown'):
        raise ValueError('ORTHANC_OWNER_CHANGE_UNAVAILABLE')
    os.chown(path, ORTHANC_UID, ORTHANC_GID)


def ensure_orthanc_storage():
    if MOUNT.is_symlink() or not os.path.ismount(MOUNT):
        raise ValueError('PACS_ENCRYPTED_MOUNT_REQUIRED')
    mount_stat = MOUNT.stat()
    try:
        directory_stat = ORTHANC_STORAGE.lstat()
    except FileNotFoundError:
        ORTHANC_STORAGE.mkdir(mode=0o700)
        set_orthanc_storage_owner(ORTHANC_STORAGE)
        os.chmod(ORTHANC_STORAGE, 0o700)
        directory_stat = ORTHANC_STORAGE.lstat()
    validate_orthanc_storage(mount_stat, directory_stat, ORTHANC_STORAGE.is_symlink())


def create(token, key_id):
    if not re.fullmatch(re.escape(KEY_BASE) + '/[a-f0-9]{32}', key_id):
        raise ValueError('VERSION_PINNED_STORAGE_KEY_REQUIRED')
    if DIRECTORY.exists() or DIRECTORY.is_symlink() or MOUNT.exists() or MOUNT.is_symlink() or pathlib.Path(DEVICE).exists():
        raise ValueError('EXISTING_TARGET_PRESERVED')
    if DIRECTORY.parent.resolve() != DIRECTORY.parent or DIRECTORY.parent.stat().st_uid != 0:
        raise ValueError('ROOT_OWNED_CANONICAL_PARENT_REQUIRED')
    if shutil.disk_usage('/opt').free < SIZE + 2 * 1024**3:
        raise ValueError('STORAGE_SPACE_RESERVE_REQUIRED')
    for tool in ['cryptsetup', 'losetup', 'mkfs.ext4', 'findmnt', 'mount', 'umount']:
        if not shutil.which(tool):
            raise ValueError('STORAGE_TOOL_MISSING_' + tool)
    key = bytearray(os.urandom(32))
    try:
        wrapped = required_vault(token, key_id + '/wrapkey',
                                 {'alg': 'RSA-OAEP-256', 'value': base64.urlsafe_b64encode(key).decode().rstrip('=')})
        if wrapped.get('kid') != key_id:
            raise ValueError('WRAP_KEY_VERSION_MISMATCH')
        manifest = validate_manifest(dict(schema='HIGHPASS_B_STORAGE_V1', role='B', sizeBytes=SIZE,
            backingFile=str(BACKING), mount=str(MOUNT), mapping=MAPPING, luksUuid=str(uuid.uuid4()),
            keyId=key_id, algorithm='RSA-OAEP-256', wrappedKey=wrapped['value'], clinicalUse=False,
            review='DRAFT / UNASSIGNED', autoUnlock=False))
        recovered = unwrap(token, manifest)
        try:
            if recovered != key:
                raise ValueError('KEY_RECOVERY_MISMATCH')
        finally:
            recovered[:] = b'\0' * len(recovered)
        # Obtain Azure encrypted backup before ANY filesystem mutation.
        backup = required_vault(token, KEY_BASE + '/backup', {})['value']
        DIRECTORY.mkdir(mode=0o700)
        exclusive(MANIFEST, json.dumps(manifest, indent=2).encode())
        exclusive(DIRECTORY / 'vault-key-backup.json', json.dumps({'keyId': key_id, 'value': backup}).encode())
        exclusive(BACKING, b'')
        run(['fallocate', '-l', str(SIZE), str(BACKING)], seconds=30)
        MOUNT.mkdir(mode=0o700)
        loop = loop_attach()
        run(['cryptsetup', 'luksFormat', '--type', 'luks2', '--batch-mode', '--cipher', 'aes-xts-plain64',
             '--key-size', '512', '--pbkdf', 'argon2id', '--pbkdf-memory', '65536', '--iter-time', '1000',
             '--uuid', manifest['luksUuid'], '--key-file', '-', loop], data=key, seconds=60)
        open_and_mount(loop, key, manifest['luksUuid'])
        run(['mkfs.ext4', '-q', '-L', 'HIGHPASS_B_PACS', DEVICE], seconds=60)
        run(['cryptsetup', 'luksHeaderBackup', loop, '--header-backup-file', str(DIRECTORY / 'luks-header.backup')])
        os.chmod(DIRECTORY / 'luks-header.backup', 0o600)
        mount_volume()
        sentinel = MOUNT / '.storage-recovery-probe'
        probe = os.urandom(64)  # random NON-medical test data, not a key
        exclusive(sentinel, probe)
        digest = hashlib.sha256(probe).hexdigest()
        run(['sync', '-f', str(sentinel)])
        run(['umount', str(MOUNT)])
        run(['cryptsetup', 'close', MAPPING])
        # Bad key must fail without opening a mapping.
        bad = subprocess.run(['cryptsetup', 'open', '--type', 'luks2', '--key-file', '-', loop, MAPPING],
                             input=os.urandom(32), capture_output=True, timeout=30)
        if bad.returncode == 0 or pathlib.Path(DEVICE).exists():
            raise ValueError('WRONG_KEY_NEGATIVE_FAILED')
        recovered = unwrap(token, manifest)
        try:
            open_and_mount(loop, recovered, manifest['luksUuid'])
        finally:
            recovered[:] = b'\0' * len(recovered)
        mount_volume()
        if hashlib.sha256(sentinel.read_bytes()).hexdigest() != digest:
            raise ValueError('REMOUNT_CONTENT_MISMATCH')
        # Keep tiny owned recovery probe; no deletion of any existing asset.
        return dict(status='PASS', backingBytes=BACKING.stat().st_size, luksUuid=manifest['luksUuid'],
                    keyId=key_id, loop=loop, mount=str(MOUNT), wrongKey='PASS', keyVaultReopen='PASS',
                    orthancStorage=str(ORTHANC_STORAGE), orthancUid=ORTHANC_UID, orthancGid=ORTHANC_GID,
                    recoveryProbeHash=digest, rawKeyPersisted=False, automaticBootUnlock=False,
                    encryptedBackupCreated=True, backupRestoreRehearsal='NOT VERIFIED',
                    filesystem=json.loads(run(['findmnt', '-J', '-o', 'TARGET,SOURCE,FSTYPE,OPTIONS', '--mountpoint', str(MOUNT)])))
    finally:
        # Python/base64/subprocess may retain transient copies: no claim of perfect
        # RAM zeroization or protection from live root / hypervisor compromise.
        key[:] = b'\0' * len(key)


def create_key(token):
    status, _ = vault(token, KEY_BASE)
    deadline = time.monotonic() + 45
    while status == 403 and time.monotonic() < deadline:
        time.sleep(3)
        status, _ = vault(token, KEY_BASE)
    if status != 404:
        raise ValueError('EXISTING_STORAGE_KEY_OR_PERMISSION_PRESERVED')
    result = required_vault(token, KEY_BASE + '/create', dict(kty='RSA', key_size=2048,
        key_ops=['wrapKey', 'unwrapKey'], attributes={'enabled': True},
        tags={'purpose': 'B_ONLY_LUKS_STORAGE_SYNTHETIC', 'review': 'DRAFT_UNASSIGNED'}))
    key_id = result['key']['kid']
    if not re.fullmatch(re.escape(KEY_BASE) + '/[a-f0-9]{32}', key_id):
        raise ValueError('KEY_CREATION_NOT_VERIFIED')
    return {'keyId': key_id, 'status': 'PASS'}


def verify_key(token):
    secure_file(MANIFEST)
    secure_file(BACKING)
    manifest = validate_manifest(json.loads(MANIFEST.read_text()))
    if BACKING.stat().st_size != SIZE or run(['cryptsetup', 'luksUUID', str(BACKING)]) != manifest['luksUuid']:
        raise ValueError('PINNED_STORAGE_IDENTITY_REQUIRED')
    key = unwrap(token, manifest)
    wrong = bytearray(os.urandom(32))
    command = ['cryptsetup', 'open', '--test-passphrase', '--type', 'luks2', '--key-file', '-', str(BACKING)]
    try:
        run(command, data=key, seconds=60)
        denied = subprocess.run(command, input=wrong, capture_output=True, timeout=60)
        if denied.returncode != 2:
            raise ValueError('WRONG_STORAGE_KEY_DENIAL_NOT_VERIFIED')
        return dict(status='PASS', action='verify-key', luksUuid=manifest['luksUuid'],
                    keyVaultUnwrap=True, actualLuksKeyVerified=True, wrongKeyDenied=True, rawKeyPersisted=False)
    finally:
        key[:] = b'\0' * len(key)
        wrong[:] = b'\0' * len(wrong)


def recover(token):
    secure_file(MANIFEST)
    manifest = validate_manifest(json.loads(MANIFEST.read_text()))
    if DIRECTORY.is_symlink() or DIRECTORY.stat().st_uid != 0 or stat.S_IMODE(DIRECTORY.stat().st_mode) != 0o700:
        raise ValueError('ROOT_ONLY_STORAGE_DIRECTORY_REQUIRED')
    if MOUNT.is_symlink() or not MOUNT.is_dir() or any(MOUNT.iterdir()):
        raise ValueError('EMPTY_UNMOUNTED_TARGET_REQUIRED')
    key = unwrap(token, manifest)  # No fallback key; outage/denial leaves closed.
    try:
        loop = loop_attach()
        open_and_mount(loop, key, manifest['luksUuid'])
        mount_volume()
        return dict(status='PASS', action='recover', luksUuid=manifest['luksUuid'], keyId=manifest['keyId'],
                    mount=str(MOUNT), orthancStorage=str(ORTHANC_STORAGE), orthancUid=ORTHANC_UID,
                    orthancGid=ORTHANC_GID, rawKeyPersisted=False)
    finally:
        key[:] = b'\0' * len(key)


def lock():
    secure_file(MANIFEST)
    manifest = validate_manifest(json.loads(MANIFEST.read_text()))
    if not os.path.ismount(MOUNT) or run(['findmnt', '-n', '-o', 'SOURCE', '--mountpoint', str(MOUNT)]) != DEVICE:
        raise ValueError('OWNED_MOUNT_REQUIRED')
    status_text = run(['cryptsetup', 'status', MAPPING])
    found = re.search(r'(?m)^\s*device:\s*(/dev/loop\d+)\s*$', status_text)
    if not found:
        raise ValueError('OWNED_LOOP_REQUIRED')
    loop = found.group(1)
    if pathlib.Path(run(['losetup', '--noheadings', '--output', 'BACK-FILE', loop])).resolve() != BACKING:
        raise ValueError('LOOP_BACKING_MISMATCH')
    if run(['cryptsetup', 'luksUUID', loop]) != manifest['luksUuid']:
        raise ValueError('LUKS_UUID_MISMATCH')
    run(['umount', str(MOUNT)])  # Busy filesystem FAILS; never force/lazy unmount.
    run(['cryptsetup', 'close', MAPPING])
    run(['losetup', '--detach', loop])
    return dict(status='PASS', action='lock', mount=str(MOUNT), mapping=MAPPING)


def protect_memory():
    import resource  # Linux-only; offline contract tests can run on Windows.
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_MEMLOCK, (resource.RLIM_INFINITY, resource.RLIM_INFINITY))
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(4, 0, 0, 0, 0) != 0 or libc.mlockall(1 | 2) != 0:
        raise ValueError('LOCKED_NON_DUMPABLE_MEMORY_REQUIRED')


def main():
    os.umask(0o077)
    if os.geteuid() != 0:
        raise ValueError('ROOT_REQUIRED')
    protect_memory()
    payload = sys.stdin.buffer.read(32769)
    request = json.loads(payload)
    if len(payload) > 32768:
        raise ValueError('INPUT_LIMIT')
    if request.get('action') == 'lock':
        print(json.dumps(lock()))
        return
    if not re.fullmatch(r'[A-Za-z0-9._~-]{1,16384}', request.get('token', '')):
        raise ValueError('OPERATOR_TOKEN_REQUIRED')
    if request['action'] == 'create-key':
        result = create_key(request['token'])
    elif request['action'] == 'create-volume':
        if os.geteuid() != 0:
            raise ValueError('ROOT_REQUIRED')
        result = create(request['token'], request['keyId'])
    elif request['action'] == 'recover':
        result = recover(request['token'])
    elif request['action'] == 'verify-key':
        result = verify_key(request['token'])
    else:
        raise ValueError('UNKNOWN_ACTION')
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'NOT VERIFIED', 'reason': str(error) if isinstance(error, (ValueError, RuntimeError)) else type(error).__name__}))
        sys.exit(1)
