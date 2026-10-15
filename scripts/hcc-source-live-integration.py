"""Verify all fixed 700 source DICOMs at A, then immediately register via receipt."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import os
import pathlib
import shlex
import subprocess
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / 'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010/manifest.json'
MANIFEST_SHA = 'bb516e3d59de230860d9feea7d8e4e863e17d2bc1bc244d28cdcb188380b23aa'
INVENTORY_SHA = 'a2c4087efcad2f5594a54dd7c3f3563204e81b30f3d7afe45322a454d28b2207'
STUDY_UID = '2.25.259656708708993797343330994179169711072'
SERIES_UID = '2.25.18361638789025095699746776899955737977'
DATASET_ID = 'SYNTHETIC_HONG_GILDONG_56_CT_20261010_V1'
GATEWAY_IMAGE = 'sha256:50b1db9e1cdfdf71ac706cff09c3b11b0a0df1fd1b0ef1c66a1305c39aab43b8'
CONTROL_IMAGE = 'sha256:80fac45b48f2e16b472341884372ec166e083a0e29617acf11f0f07038b09181'


def load(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_local_manifest():
    raw = MANIFEST.read_bytes()
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA:
        raise ValueError('FIXED_MANIFEST_FILE_HASH_MISMATCH')
    manifest = json.loads(raw)
    if (manifest.get('datasetType') != 'SYNTHETIC' or manifest.get('clinicalUse') is not False
            or manifest.get('canonicalManifestSha256') != 'ca00be0cde7a6ad119bcbf4dc357a7a10e2e6188dd5bd11fd19b3b42f5cc1721'
            or manifest.get('studyInstanceUID') != STUDY_UID or manifest.get('seriesInstanceUID') != SERIES_UID
            or len(manifest.get('instances', [])) != 700):
        raise ValueError('FIXED_700_SYNTHETIC_MANIFEST_REQUIRED')
    rows = manifest['instances']
    inventory = sorted(([row['sopInstanceUID'], row['bytes'], row['sha256']] for row in rows), key=lambda row: row[0])
    if len({row[0] for row in inventory}) != 700 or hashlib.sha256(json.dumps(inventory, separators=(',', ':')).encode()).hexdigest() != INVENTORY_SHA:
        raise ValueError('FIXED_SOURCE_INVENTORY_HASH_MISMATCH')
    return raw


REMOTE = r'''
import hashlib,json,pathlib,stat,subprocess,sys
MAC='00:0c:29:25:f6:b4'
IMAGE=''' + repr(GATEWAY_IMAGE) + r'''
MANIFEST_SHA=''' + repr(MANIFEST_SHA) + r'''
name='hp-capstone-a-gateway-gateway-1'
def cmd(args,timeout=20):
 p=subprocess.run(args,capture_output=True,timeout=timeout)
 if p.returncode:raise RuntimeError('BOUNDED_REMOTE_COMMAND_FAILED')
 return p.stdout
try:
 assert pathlib.Path('/sys/class/net/ens33/address').read_text().strip()==MAC
 before=json.loads(cmd(['docker','inspect',name]))[0]
 assert before['Image']==IMAGE and before['State']['Running'] and before['State']['Health']['Status']=='healthy'
 env=dict(x.split('=',1) for x in before['Config']['Env'])
 assert env.get('HCC_SOURCE_MANIFEST_FILE')=='/run/hcc-source/manifest.json'
 assert env.get('HCC_SOURCE_SERVICE_TOKEN_FILE')=='/run/secrets/hcc-source-secret'
 manifest=pathlib.Path('/opt/highpass/capstone-hcc-source/manifest.json')
 info=manifest.lstat()
 assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_gid==65532 and stat.S_IMODE(info.st_mode)==0o440
 assert hashlib.file_digest(manifest.open('rb'),'sha256').hexdigest()==MANIFEST_SHA
 result=subprocess.run(['docker','exec',name,'/nodejs/bin/node','/app/scripts/verify-hcc-source-gateway.js'],
   capture_output=True,timeout=1510)
 after=json.loads(cmd(['docker','inspect',name]))[0]
 identity=lambda x:{k:x[k] for k in ['Id','Image','Config','Mounts','HostConfig']}|{'StartedAt':x['State']['StartedAt'],'Running':x['State']['Running']}
 if identity(before)!=identity(after):raise RuntimeError('GATEWAY_RUNTIME_CHANGED_DURING_PROBE')
 if result.returncode:raise RuntimeError('SOURCE_PROBE_DID_NOT_COMPLETE')
 value=json.loads(result.stdout.decode('utf8'))
 required={'status':'PASS','scope':'AUTHENTICATED_SOURCE_REPORT_ONLY','registered':False,'deployed':False,'clinicalUse':False}
 if any(value.get(k)!=v for k,v in required.items()):raise RuntimeError('SOURCE_RECEIPT_RESPONSE_INVALID')
 # The deployed probe returns a receipt after the fixed 700-file raw-hash probe.
 # Counts are bound to HCC_SOURCE_CONTRACT in the authenticated report, not
 # repeated by acceptHccReport's receipt response. Do not require absent fields.
 if not isinstance(value.get('receiptId'),str) or not value['receiptId'].startswith('audit_') or len(value.get('proofSha256',''))!=64:raise RuntimeError('SOURCE_RAW_HASH_REPORT_INVALID')
 print(json.dumps({'status':'PASS','receiptId':value['receiptId'],'proofSha256':value['proofSha256'],
  'auditRecordHash':value['auditRecordHash'],'acceptedAt':value['acceptedAt'],'expiresAt':value['expiresAt'],
  'instanceCount':700,'seriesCount':1,'runtimeUnchanged':True}))
except Exception:
 print(json.dumps({'status':'NOT VERIFIED','reason':'SOURCE_PROOF_OR_RUNTIME_RECONCILIATION_REQUIRED'}));sys.exit(2)
'''


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--a-review', type=pathlib.Path, required=True)
    parser.add_argument('--cloud-review', type=pathlib.Path, required=True)
    args = parser.parse_args()
    a_review_path, cloud_review_path = args.a_review.resolve(), args.cloud_review.resolve()
    owned = (ROOT / 'artifacts/workstation').resolve()
    if not a_review_path.is_relative_to(owned) or not cloud_review_path.is_relative_to(owned):
        raise ValueError('OWNED_REVIEW_RECEIPTS_REQUIRED')
    a_review, cloud_review = [json.loads(p.read_text(encoding='utf8')) for p in (a_review_path, cloud_review_path)]
    if any(item.get('review') != 'PASS' or item.get('reviewer') != '김범희' or item.get('exceptions') != [] for item in (a_review, cloud_review)):
        raise ValueError('USER_DIRECTED_A_CLOUD_REVIEW_RECORDS_REQUIRED')
    manifest = verify_local_manifest()
    import paramiko
    ops = load('source_ops', 'scripts/workstation-automatic-ops.py')
    directory = ROOT / 'artifacts/workstation' / ('hcc-source-live-integration-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True, exist_ok=False)
    started = time.monotonic()
    result = {'status': 'NOT VERIFIED', 'scope': 'A_RAW_700_HASH_REPORT_AND_RECEIPT_BOUND_CATALOG'}
    credential = getpass.getpass('A/B VM credential (concealed): ')
    trust = ops.LocalVmTrust()
    a, cloud = paramiko.SSHClient(), paramiko.SSHClient()
    presenter = None
    try:
        address, mac, _ = ops.ROLES['A']
        key = trust.key('A', credential, directory / 'A-public-host.key')
        a.get_host_keys().add(address, key.get_name(), key)
        a.set_missing_host_key_policy(paramiko.RejectPolicy())
        a.connect(address, username='server', password=credential, look_for_keys=False, allow_agent=False,
                  timeout=10, banner_timeout=10, auth_timeout=10, channel_timeout=15)
        if mac != '00:0c:29:25:f6:b4':
            raise ValueError('PINNED_A_ROLE_MISMATCH')
        result['phase'] = 'A_700_RAW_HASH_SOURCE_REPORT'
        code, output = ops.run(a, "sudo -S -p '' timeout 1520s python3 -c " + shlex.quote(REMOTE),
                               credential=credential, seconds=1525)
        receipt = json.loads(output)
        if code or receipt.get('status') != 'PASS' or receipt.get('instanceCount') != 700:
            result.update({'reason': 'LIVE_A_SOURCE_REPORT_NOT_CONFIRMED'})
            raise RuntimeError('SOURCE_REPORT_NOT_CONFIRMED')
        deadline = datetime.fromisoformat(receipt['expiresAt'].replace('Z', '+00:00'))
        if datetime.now(timezone.utc) >= deadline:
            result.update({'reason': 'SOURCE_RECEIPT_EXPIRED_BEFORE_CATALOG'})
            raise RuntimeError('SOURCE_RECEIPT_EXPIRED')
        identity = pathlib.Path(os.environ['USERPROFILE']) / '.ssh/highpass-capstone-cloud'
        cloud.load_host_keys(str(identity / 'known_hosts'))
        cloud.set_missing_host_key_policy(paramiko.RejectPolicy())
        cloud.connect('138.91.2.60', username='highpassadmin', key_filename=str(identity / 'id_ed25519'),
                      look_for_keys=False, allow_agent=False, timeout=10, banner_timeout=10, auth_timeout=10,
                      channel_timeout=15)
        if datetime.now(timezone.utc) >= deadline:
            result.update({'reason': 'SOURCE_RECEIPT_EXPIRED_BEFORE_CATALOG'})
            raise RuntimeError('SOURCE_RECEIPT_EXPIRED')
        gateway = load('cloud_secret_reader', 'scripts/capstone-a-gateway-ops.py')
        with gateway.root_sftp(cloud) as sftp, sftp.open('/opt/highpass/capstone-control-secrets/capstone-login-key', 'rb') as stream:
            presenter = bytearray(stream.read(129))
        if not 32 <= len(presenter) <= 128 or any(value in presenter for value in [0, 10, 13]):
            raise ValueError('PRESENTER_CREDENTIAL_FILE_INVALID')
        request = {'presenterKey': presenter.decode('ascii'), 'receiptId': receipt['receiptId'],
                   'proofSha256': receipt['proofSha256'], 'expiresAt': receipt['expiresAt']}
        presenter[:] = b'\0' * len(presenter)
        presenter = None
        payload = bytearray((json.dumps(request) + '\n').encode('utf8'))
        request['presenterKey'] = ''
        result['phase'] = 'RECEIPT_BOUND_CONTROL_CATALOG'
        try:
            completed = subprocess.run(['node', 'scripts/hcc-source-catalog-live-check.js'],
                                       cwd=ROOT, input=payload,
                                       capture_output=True, timeout=45)
        finally:
            payload[:] = b'\0' * len(payload)
        if completed.returncode:
            raise RuntimeError('CONTROL_CATALOG_REGISTRATION_UNCONFIRMED')
        registration = json.loads(completed.stdout.decode('utf8'))
        if registration.get('status') != 'PASS' or registration.get('registrationCommitAcknowledged') is not True:
            raise RuntimeError('CONTROL_CATALOG_REGISTRATION_UNCONFIRMED')
        result.update({'status': 'PASS', 'sourceReceipt': {k: receipt[k] for k in
            ['receiptId', 'proofSha256', 'auditRecordHash', 'acceptedAt', 'expiresAt', 'instanceCount', 'seriesCount']},
            'catalog': registration, 'scope': 'A_RAW_700_SHA256_CONTROL_RECEIPT_AND_AUDITED_CATALOG_ONLY'})
    except Exception:
        result.setdefault('reason', 'RECONCILE_CURRENT_A_SOURCE_AND_CONTROL_CATALOG_STATE_BEFORE_RETRY')
    finally:
        if presenter is not None:
            presenter[:] = b'\0' * len(presenter)
        presenter = None
        credential = None
        a.close()
        cloud.close()
        trust.close()
    result.update({'observedAt': datetime.now(timezone.utc).isoformat(),
                   'elapsedSeconds': round(time.monotonic() - started, 3),
                   'manifestFileSha256': hashlib.sha256(manifest).hexdigest(),
                   'review': 'DRAFT / UNASSIGNED', 'ownership': 'NOT CHANGED',
                   'consent': 'NOT ISSUED', 'browser': 'NOT VERIFIED'})
    path = directory / 'result.json'
    path.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    print(json.dumps({'evidence': str(path), **result}, ensure_ascii=False))
    return 0 if result['status'] == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
