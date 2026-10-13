"""Pinned private Vault backup rehearsal. Protected RAM, stdin bearer only."""
import base64
import ctypes
import hashlib
import hmac
import http.client
import ipaddress
import json
import os
import pathlib
import re
import socket
import ssl
import stat
import subprocess
import sys
import time

PRIMARY='kv-hp-demo-4869edd9.vault.azure.net'
RECOVERY='kv-hp-recover-4869edd9.vault.azure.net'
NAME='highpass-b-storage-kek-20261013'
ORIGINAL='https://'+PRIMARY+'/keys/'+NAME+'/eb914d9add804b808d0f03caad9eb126'

def pinned_request(token,host,ip,path,body=None):
    if host not in [PRIMARY,RECOVERY] or ipaddress.ip_address(ip) not in ipaddress.ip_network('10.89.1.0/24'):
        raise ValueError('PINNED_PRIVATE_VAULT_REQUIRED')
    allowed=['/keys/'+NAME,'/keys/'+NAME+'/eb914d9add804b808d0f03caad9eb126','/keys/'+NAME+'/eb914d9add804b808d0f03caad9eb126/unwrapkey']
    if host==RECOVERY:allowed+=['/keys/restore']
    if path not in allowed:raise ValueError('EXACT_STORAGE_KEY_OPERATION_REQUIRED')
    if host==PRIMARY and ip!='10.89.1.4':raise ValueError('PRIMARY_IP_REQUIRED')
    conn=http.client.HTTPSConnection(host,timeout=10,context=ssl.create_default_context())
    conn.sock=conn._context.wrap_socket(socket.create_connection((ip,443),10),server_hostname=host)
    try:
        conn.request('GET' if body is None else 'POST',path+'?api-version=2025-07-01',body=None if body is None else json.dumps(body),headers={'authorization':'Bearer '+token,'content-type':'application/json'})
        response=conn.getresponse();data=response.read(65537)
        if len(data)>65536:raise ValueError('RESPONSE_LIMIT')
        return response.status,json.loads(data)
    finally:conn.close()

def required(token,host,ip,path,body=None):
    deadline=time.monotonic()+60
    while True:
        code,value=pinned_request(token,host,ip,path,body)
        if code==200:return value
        if code!=403 or time.monotonic()>=deadline:raise RuntimeError('VAULT_HTTP_'+str(code))
        time.sleep(3)

def main():
    import resource  # Linux guest only; offline validation can run on Windows.
    if os.geteuid()!=0:raise ValueError('ROOT_REQUIRED')
    resource.setrlimit(resource.RLIMIT_CORE,(0,0));resource.setrlimit(resource.RLIMIT_MEMLOCK,(resource.RLIM_INFINITY,resource.RLIM_INFINITY))
    libc=ctypes.CDLL(None,use_errno=True)
    if libc.prctl(4,0,0,0,0)!=0 or libc.mlockall(1|2)!=0:raise ValueError('PROTECTED_MEMORY_REQUIRED')
    payload=sys.stdin.buffer.read(32769)
    if len(payload)>32768:raise ValueError('INPUT_LIMIT')
    request=json.loads(payload);token=request['token'];ip=request['recoveryIp']
    if not re.fullmatch(r'[A-Za-z0-9._~-]{1,16384}',token):raise ValueError('TOKEN_REQUIRED')
    if request['manifest']['keyId']!=ORIGINAL or request['backup']['keyId']!=ORIGINAL:raise ValueError('PINNED_BACKUP_BINDING_REQUIRED')
    action=request['action']
    if action=='deny':
        code,_=pinned_request(token,RECOVERY,ip,'/keys/'+NAME)
        if code!=403:raise ValueError('UNASSIGNED_OPERATOR_DENIAL_NOT_OBSERVED_'+str(code))
        print(json.dumps(dict(status='PASS',action=action,httpStatus=403,unauthorizedKeyReadDenied=True)))
    elif action=='restore':
        # This phase has restore-only permission. No key create/update/delete.
        restored=required(token,RECOVERY,ip,'/keys/restore',{'value':request['backup']['value']})
        expected=ORIGINAL.replace(PRIMARY,RECOVERY)
        if restored.get('key',{}).get('kid')!=expected:raise ValueError('RESTORED_VERSION_BINDING_FAILED')
        print(json.dumps(dict(status='PASS',restoredKeyId=expected,action=action,rawKeyPersisted=False)))
    elif action=='verify':
        path='/keys/'+NAME+'/eb914d9add804b808d0f03caad9eb126'
        original=required(token,PRIMARY,'10.89.1.4',path)['key'];restored=required(token,RECOVERY,ip,path)['key']
        if any(original.get(k)!=restored.get(k) for k in ['kty','n','e','key_ops']):raise ValueError('PUBLIC_KEY_RESTORE_MISMATCH')
        body={'alg':'RSA-OAEP-256','value':request['manifest']['wrappedKey']}
        keys=[]
        try:
            for host,address in [(PRIMARY,'10.89.1.4'),(RECOVERY,ip)]:
                response=required(token,host,address,path+'/unwrapkey',body)
                if response.get('kid')!='https://'+host+path:raise ValueError('UNWRAP_VERSION_MISMATCH')
                key=bytearray(base64.urlsafe_b64decode(response['value']+'==='));keys.append(key)
                if len(key)!=32:raise ValueError('KEY_LENGTH_INVALID')
            if not hmac.compare_digest(keys[0],keys[1]):raise ValueError('RECOVERED_STORAGE_KEY_MISMATCH')
            print(json.dumps(dict(status='PASS',action=action,publicKeyMatch=True,wrappedStorageKeyRecoveryMatch=True,
                rawKeyPersisted=False,storageMountRecovery='NOT VERIFIED',originalDisabled=False)))
        finally:
            for key in keys:key[:]=b'\0'*len(key)
    elif action=='test-storage':
        directory=pathlib.Path('/opt/highpass/b-pacs-storage')
        manifest_file=directory/'storage.json';backing=directory/'volume-8g.luks'
        for file in [manifest_file,backing]:
            info=file.lstat()
            if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or stat.S_IMODE(info.st_mode)!=0o600:raise ValueError('ROOT_ONLY_STORAGE_FILE_REQUIRED')
        manifest=json.loads(manifest_file.read_text())
        if manifest!=request['manifest'] or backing.stat().st_size!=8589934592:raise ValueError('EXACT_EXISTING_VOLUME_BINDING_REQUIRED')
        uuid=subprocess.check_output(['cryptsetup','luksUUID',str(backing)],timeout=10).decode().strip()
        if uuid!=manifest['luksUuid']:raise ValueError('LUKS_UUID_MISMATCH')
        response=required(token,RECOVERY,ip,'/keys/'+NAME+'/eb914d9add804b808d0f03caad9eb126/unwrapkey',{'alg':'RSA-OAEP-256','value':manifest['wrappedKey']})
        if response.get('kid')!=ORIGINAL.replace(PRIMARY,RECOVERY):raise ValueError('RESTORED_UNWRAP_VERSION_MISMATCH')
        key=bytearray(base64.urlsafe_b64decode(response['value']+'==='))
        try:
            if len(key)!=32:raise ValueError('KEY_LENGTH_INVALID')
            # Test the real original LUKS header without opening, mounting or modifying it.
            probe=subprocess.run(['cryptsetup','open','--test-passphrase','--type','luks2','--key-file','-',str(backing)],input=key,capture_output=True,timeout=30)
            if probe.returncode:raise ValueError('RESTORED_KEY_LUKS_PASSPHRASE_FAILED')
            print(json.dumps(dict(status='PASS',action=action,luksUuid=uuid,restoredKeyOpensOriginalHeader=True,
                readOnlyPassphraseTest=True,mappingCreated=False,volumeMounted=False,rawKeyPersisted=False)))
        finally:key[:]=b'\0'*len(key)
    else:raise ValueError('UNKNOWN_ACTION')

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps(dict(status='FAIL',reason=str(error) if isinstance(error,(RuntimeError,ValueError)) else type(error).__name__)))
        sys.exit(1)
