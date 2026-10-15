"""Exclusive source credential/manifest installation primitive; no service activation.

Caller supplies authenticated pinned transports and reviewed exact manifest bytes.
Never return credentials or raw remote exceptions to an evidence/logging caller.
"""
import hashlib
import json
import secrets

PATHS = {
    'cloud': '/opt/highpass/capstone-control-secrets/hcc-source-secret',
    'a': '/opt/highpass/capstone-a-gateway-secrets/hcc-source-secret',
}
MANIFEST = '/opt/highpass/capstone-hcc-source/manifest.json'


def provision_pair(adapters, manifest, expected_sha256):
    """Both preflights precede credential generation. Partial writes need reconciliation."""
    if set(adapters) != {'cloud', 'a'}:
        raise ValueError('EXACT_A_CLOUD_SOURCE_FILE_PAIR_REQUIRED')
    if not isinstance(manifest, bytes) or not 0 < len(manifest) < 4 * 1024 * 1024:
        raise ValueError('BOUNDED_MANIFEST_BYTES_REQUIRED')
    if hashlib.sha256(manifest).hexdigest() != expected_sha256:
        raise ValueError('EXACT_REVIEWED_MANIFEST_REQUIRED')
    checks, attempted = [], False
    token = None
    try:
        for role in ['cloud', 'a']:
            adapters[role].preflight()
        token = secrets.token_urlsafe(48).encode('ascii')
        for role in ['cloud', 'a']:
            attempted = True
            adapters[role].install(token, manifest if role == 'a' else None)
            checks.append(role + '_FILES_CREATED')
        for role in ['cloud', 'a']:
            adapters[role].verify(token, expected_sha256 if role == 'a' else None)
        return {'status': 'PASS', 'checks': checks, 'pairVerified': True,
                'scope': 'SOURCE_FILES_ONLY_NOT_ACTIVATION_OR_PACS_PROOF'}
    except Exception:
        return {'status': 'NOT VERIFIED', 'checks': checks, 'partialWritePossible': attempted,
                'reason': 'RECONCILE_EXACT_SOURCE_FILES_BEFORE_RETRY',
                'cleanup': 'NOT EXECUTED', 'pairVerified': False}
    finally:
        token = None  # No secure Python memory-erasure claim; never persist/output token locally.


def remote_program(role, operation):
    if role not in PATHS or operation not in ('preflight', 'install', 'verify'):
        raise ValueError('EXACT_SOURCE_FILE_ROLE_OPERATION_REQUIRED')
    return 'ROLE=' + repr(role) + '\nOPERATION=' + repr(operation) + '\n' + r'''
import os,stat,json,sys,hashlib,base64,re,hmac
assert os.geteuid()==0
secret_dir='capstone-control-secrets' if ROLE=='cloud' else 'capstone-a-gateway-secrets'
fds=[]
def directory(parent,name):
 fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent)
 fds.append(fd);info=os.fstat(fd)
 assert info.st_uid==0 and not stat.S_IMODE(info.st_mode)&0o022
 return fd
def optional_stat(parent,name):
 try:return os.stat(name,dir_fd=parent,follow_symlinks=False)
 except FileNotFoundError:return None
def read_regular(parent,name,limit):
 fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW,dir_fd=parent)
 try:
  info=os.fstat(fd);assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_size<=limit
  value=os.read(fd,limit+1);assert len(value)<=limit;return value,info
 finally:os.close(fd)
def write_exclusive(parent,name,value):
 fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o400,dir_fd=parent)
 try:
  os.fchown(fd,0,65532)
  remaining=memoryview(value)
  while remaining:
   count=os.write(fd,remaining);assert count>0;remaining=remaining[count:]
  os.fsync(fd);os.fchmod(fd,0o440)
 finally:os.close(fd)
 os.fsync(parent)
try:
 if ROLE=='cloud':
  import socket
  assert socket.gethostname()=='highpass-cloud'
 else:
  with open('/sys/class/net/ens33/address') as stream:assert stream.read().strip()=='00:0c:29:25:f6:b4'
 root=directory(None,'/')
 opt=directory(root,'opt');highpass=directory(opt,'highpass')
 parent=directory(highpass,secret_dir)
 manifest_parent=None
 if ROLE=='a':
  info=optional_stat(highpass,'capstone-hcc-source')
  if info is not None:manifest_parent=directory(highpass,'capstone-hcc-source')
 if OPERATION in ['preflight','install']:
  assert optional_stat(parent,'hcc-source-secret') is None
  if manifest_parent is not None:assert optional_stat(manifest_parent,'manifest.json') is None
 if OPERATION=='preflight':
  result={'status':'PASS','role':ROLE,'canCreateExclusiveSourceFiles':True,'contentsRead':False}
 else:
  raw=sys.stdin.buffer.read(6*1024*1024);assert len(raw)<6*1024*1024
  payload=json.loads(raw);token=payload['token'].encode('ascii')
  assert re.fullmatch(rb'[A-Za-z0-9_-]{64}',token)
  assert set(payload)==({'token','manifest','manifestSha256'} if ROLE=='a' else {'token'})
  if ROLE=='a':
   manifest=base64.b64decode(payload['manifest'],validate=True)
   assert 0<len(manifest)<4*1024*1024
   assert hashlib.sha256(manifest).hexdigest()==payload['manifestSha256']
  if OPERATION=='install':
   # Explicitly reject reusing current service credentials before creating files.
   names=['data-plane-secret','patient-a-service-secret'] if ROLE=='a' else ['data-plane-secret','patient-service-secret']
   for name in names:
    if optional_stat(parent,name) is not None:
     prior,_=read_regular(parent,name,4096);assert not hmac.compare_digest(prior.strip(),token)
   if ROLE=='a' and manifest_parent is None:
    os.mkdir('capstone-hcc-source',0o750,dir_fd=highpass)
    manifest_parent=directory(highpass,'capstone-hcc-source')
    os.fchown(manifest_parent,0,65532);os.fsync(highpass)
   write_exclusive(parent,'hcc-source-secret',token+b'\n')
   if ROLE=='a':write_exclusive(manifest_parent,'manifest.json',manifest)
  actual,info=read_regular(parent,'hcc-source-secret',256)
  assert hmac.compare_digest(actual.strip(),token)
  assert info.st_gid==65532 and stat.S_IMODE(info.st_mode)==0o440
  if ROLE=='a':
   actual,info=read_regular(manifest_parent,'manifest.json',4*1024*1024)
   assert hashlib.sha256(actual).hexdigest()==payload['manifestSha256']
   assert info.st_gid==65532 and stat.S_IMODE(info.st_mode)==0o440
  result={'status':'PASS','role':ROLE,'sourceFilesVerified':True,'credentialReturned':False}
 print(json.dumps(result))
except Exception:
 print(json.dumps({'status':'NOT VERIFIED','role':ROLE,'reason':'RECONCILE_EXACT_FILES_BEFORE_RETRY'}))
 raise SystemExit(2)
finally:
 for fd in reversed(fds):os.close(fd)
'''
