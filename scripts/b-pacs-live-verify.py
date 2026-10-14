"""B key recovery, guarded manual start, and one authorized synthetic mTLS PACS test."""
import argparse
import importlib.util
import json
import pathlib
import re
import shlex
import time
import uuid
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]

def load(name,file):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/file)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module

runtime=load('live_b_runtime','b-pacs-storage-runtime-check.py')
operator=load('live_b_operator','b-pacs-storage-provision.py')
prepare=load('live_b_prepare','b-pacs-receiver-prepare.py')

SNAPSHOT=r'''
import hashlib,json,os,pathlib,subprocess
portal=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-b-portal-portal-1'],timeout=10))[0]
ids=subprocess.check_output(['docker','ps','-a','--filter','label=com.docker.compose.project=hp-b-pacs-receiver','--format','{{.ID}}'],timeout=10).decode().splitlines()
receivers=json.loads(subprocess.check_output(['docker','inspect',*ids],timeout=10)) if ids else []
all_ids=subprocess.check_output(['docker','ps','-q'],timeout=10).decode().splitlines()
active=json.loads(subprocess.check_output(['docker','inspect',*all_ids],timeout=10)) if all_ids else []
mount='/opt/highpass/b-pacs-encrypted'
busy=[c['Name'].lstrip('/') for c in active if any(m.get('Source')==mount or m.get('Source','').startswith(mount+'/') for m in c.get('Mounts',[]))]
probe=pathlib.Path(mount)/'.storage-recovery-probe'
print(json.dumps({'portal':{'id':portal['Id'],'imageId':portal['Image'],'health':portal['State'].get('Health',{}).get('Status')},
 'mounted':os.path.ismount(mount),'mappingPresent':pathlib.Path('/dev/mapper/highpass-b-pacs').exists(),
 'probeHash':hashlib.sha256(probe.read_bytes()).hexdigest() if probe.is_file() else None,'busyContainers':busy,
 'receivers':[{'service':c['Config']['Labels']['com.docker.compose.service'],'id':c['Id'],'imageId':c['Image'],
  'running':c['State']['Running'],'status':c['State']['Status'],'publishedPorts':bool(c['HostConfig'].get('PortBindings'))} for c in receivers]}))
'''

SMOKE=r'''
import hashlib,http.client,json,pathlib,socket,ssl,subprocess
release=pathlib.Path(request['release']);secrets=release/'secrets'
source=pathlib.Path(request['source'])
if source.parent!=pathlib.Path('/opt/highpass/b-pacs-encrypted') or source.is_symlink():raise RuntimeError('SYNTHETIC_PROBE_PATH_INVALID')
body=source.read_bytes()
if len(body)!=request['bytes'] or hashlib.sha256(body).hexdigest()!=request['sha256']:raise RuntimeError('SYNTHETIC_SOURCE_HASH_MISMATCH')
ids=subprocess.check_output(['docker','ps','--filter','label=com.docker.compose.project=hp-b-pacs-receiver',
 '--filter','label=com.docker.compose.service=b-pacs-mtls','--format','{{.ID}}'],timeout=10).decode().splitlines()
if len(ids)!=1:raise RuntimeError('ONE_RUNNING_MTLS_RECEIVER_REQUIRED')
container=json.loads(subprocess.check_output(['docker','inspect',ids[0]],timeout=10))[0]
address=container['NetworkSettings']['Networks']['highpass_b_pacs_receiver']['IPAddress']
def context(client=True):
 ctx=ssl.create_default_context(cafile=str(secrets/'ca.crt'));ctx.minimum_version=ssl.TLSVersion.TLSv1_2
 if client:ctx.load_cert_chain(str(secrets/'b-pacs-client.crt'),str(secrets/'b-pacs-client.key'))
 return ctx
class Connection(http.client.HTTPSConnection):
 def connect(self):
  self.sock=self._context.wrap_socket(socket.create_connection((address,8443),timeout=8),server_hostname=self.host)
def call(path,method='GET',payload=None,client=True,hostname='b-pacs-mtls'):
 c=Connection(hostname,8443,context=context(client),timeout=8)
 try:
  c.request(method,path,body=payload,headers={'content-type':'application/dicom' if path=='/instances' else 'application/json'})
  r=c.getresponse();data=r.read(8388609)
  if len(data)>8388608:raise RuntimeError('SYNTHETIC_PROBE_RESPONSE_LIMIT')
  return r.status,data
 finally:c.close()
status,system=call('/system')
if status!=200 or json.loads(system)['Name']!='Highpass B Synthetic Test PACS - Not For Clinical Use':raise RuntimeError('B_MTLS_PACS_NOT_READY')
for label,kwargs in [('missingClient',{'client':False}),('wrongHostname',{'hostname':'wrong-b-pacs.invalid'})]:
 try:
  call('/system',**kwargs)
 except (ssl.SSLError,ConnectionError):pass
 else:raise RuntimeError('MTLS_NEGATIVE_NOT_DENIED_'+label.upper())
if call('/instances','DELETE')[0]!=403:raise RuntimeError('MUTATION_ROUTE_NOT_DENIED')
query=json.dumps({'Level':'Instance','Query':{'SOPInstanceUID':request['sopInstanceUid']}}).encode()
def find():
 status,data=call('/tools/find','POST',query)
 if status!=200:raise RuntimeError('PACS_SYNTHETIC_LOOKUP_FAILED')
 found=json.loads(data)
 if not isinstance(found,list) or len(found)>1:raise RuntimeError('PACS_SYNTHETIC_UID_CONFLICT')
 return found
def verify(identifier):
 status,details=call('/instances/'+identifier)
 if status!=200 or json.loads(details)['MainDicomTags']['SOPInstanceUID']!=request['sopInstanceUid']:raise RuntimeError('PACS_SYNTHETIC_UID_MISMATCH')
 status,data=call('/instances/'+identifier+'/file')
 if status!=200 or len(data)!=request['bytes'] or hashlib.sha256(data).hexdigest()!=request['sha256']:raise RuntimeError('PACS_SYNTHETIC_HASH_MISMATCH')
existing=find()
if existing:verify(existing[0])
if request['mode']=='store':
 for attempt in range(2):
  status,stored=call('/instances','POST',body)
  record=json.loads(stored)
  if status!=200 or record.get('Status') not in ['Success','AlreadyStored']:raise RuntimeError('PACS_SYNTHETIC_STORE_UNCONFIRMED')
  if attempt==1 and record['Status']!='AlreadyStored':raise RuntimeError('PACS_SYNTHETIC_DUPLICATE_NOT_PRESERVED')
found=find()
if len(found)!=1:raise RuntimeError('PACS_SYNTHETIC_INSTANCE_MISSING')
verify(found[0])
receipt={'status':'PASS','mode':request['mode'],'orthancId':found[0],'sopInstanceUid':request['sopInstanceUid'],
 'studyInstanceUid':request['studyInstanceUid'],'seriesInstanceUid':request['seriesInstanceUid'],
 'sha256':request['sha256'],'bytes':request['bytes'],'uidBinding':'PINNED_RAW_DICOM_HASH','mtls':'PASS',
 'missingClientDenied':True,'wrongHostnameDenied':True,'deleteRouteDenied':True,'duplicatePreserved':True}
audit=release/'synthetic-maintenance-audit.jsonl'
import os,stat
if audit.exists():
 info=audit.lstat()
 if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('MAINTENANCE_AUDIT_PERMISSIONS_INVALID')
entry={'auditId':request['operation'],'action':'B_PACS_SYNTHETIC_MAINTENANCE_'+request['mode'].upper(),
 'purpose':'USER_AUTHORIZED_SYNTHETIC_STORAGE_VERIFICATION','result':'PASS','receipt':receipt,
 'timestamp':__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()}
fd=os.open(audit,os.O_WRONLY|os.O_CREAT|os.O_APPEND|os.O_NOFOLLOW,0o600)
with os.fdopen(fd,'w') as stream:stream.write(json.dumps(entry)+'\n');stream.flush();os.fsync(stream.fileno())
print(json.dumps(receipt))
'''

def validate_baseline(snapshot,prepared,probe_hash,stopped=True):
    if snapshot['portal']!=prepared['portalBaseline'] or snapshot['portal']['health']!='healthy':
        raise RuntimeError('B_PORTAL_BASELINE_CHANGED')
    if not snapshot['mounted'] or not snapshot['mappingPresent'] or snapshot['probeHash']!=probe_hash:
        raise RuntimeError('ENCRYPTED_RECOVERY_BASELINE_REQUIRED')
    expected={row['service']:row['imageId'] for row in prepared['containers']}
    if len(snapshot['receivers'])!=2 or {row['service']:row['imageId'] for row in snapshot['receivers']}!=expected:
        raise RuntimeError('PREPARED_RECEIVER_BASELINE_CHANGED')
    if any(row['publishedPorts'] or (stopped and row['running']) for row in snapshot['receivers']):
        raise RuntimeError('STOPPED_PRIVATE_RECEIVER_REQUIRED')
    if stopped and snapshot['busyContainers']:raise RuntimeError('ENCRYPTED_STORAGE_IN_USE')
    if not stopped and not all(row['running'] for row in snapshot['receivers']):
        raise RuntimeError('RUNNING_PRIVATE_RECEIVER_REQUIRED')

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--gui',action='store_true')
    args=parser.parse_args()
    operation=uuid.uuid4().hex
    folder=ROOT/'artifacts/workstation'/('b-pacs-live-verify-'+operation);folder.mkdir(parents=True)
    prepared=json.loads((ROOT/'artifacts/workstation/b-pacs-receiver-prepare-1ee2564f78cb4a1aaeb2b01671b0f627/result.json').read_text())
    release=prepared['release']
    if prepared.get('status')!='PASS' or not re.fullmatch('/opt/highpass/b-pacs-receiver-[a-f0-9]{32}',release):raise RuntimeError('PREPARED_B_RELEASE_REQUIRED')
    result={'status':'NOT VERIFIED','operation':operation,'scope':'B_RECOVERY_AND_SYNTHETIC_MTLS_PACS',
            'observedAt':datetime.now(timezone.utc).isoformat(),'checks':[],'importEnabled':False,
            'livePatientConsent':'NOT VERIFIED','actualAtoBTransfer':'NOT VERIFIED','rebootRecovery':'NOT VERIFIED'}
    client=None;credential=None;assignment_id=None;token=None;locked=False
    def remote(program,seconds=30):return runtime.check.remote(client,'B',credential,program,seconds)
    def remove_assignment():
        nonlocal assignment_id
        if not assignment_id:return
        try:operator.identity.azure('role','assignment','delete','--ids',assignment_id)
        except RuntimeError:pass
        remaining=operator.identity.azure('role','assignment','list','--all','--query',"[?id=='"+assignment_id+"']")
        if remaining:raise RuntimeError('TEMPORARY_STORAGE_ROLE_REMOVAL_FAILED')
        result['checks'].append({'test':'TEMPORARY_STORAGE_ROLE_REMOVED','status':'PASS','assignmentId':assignment_id})
        assignment_id=None
    try:
        result['phase']='AZURE_ACCOUNT_CHECK'
        account=operator.identity.azure('account','show')
        result['phase']='AZURE_OPERATOR_CHECK'
        signed_user=operator.identity.azure('ad','signed-in-user','show','--query','id')
        if account['id']!='a3c0e7d4-ce09-4991-946b-88574869edd9' or account['tenantId']!=operator.identity.TENANT or signed_user!=operator.OPERATOR:
            raise RuntimeError('APPROVED_STORAGE_OPERATOR_REQUIRED')
        result['phase']='AZURE_VAULT_CHECK'
        vault=operator.identity.azure('keyvault','show','--name','kv-hp-demo-4869edd9')['properties']
        if vault.get('publicNetworkAccess')!='Disabled' or not all(vault.get(k) is True for k in ['enableRbacAuthorization','enableSoftDelete','enablePurgeProtection']):
            raise RuntimeError('PRIVATE_PROTECTED_VAULT_REQUIRED')
        definition=json.loads((ROOT/'infra/azure/capstone-key-unwrap-role.json').read_text())
        result['phase']='AZURE_ROLE_CHECK'
        roles=operator.identity.azure('role','definition','list','--name',definition['Name'])
        if len(roles)!=1 or set(roles[0]['permissions'][0]['dataActions'])!=set(definition['DataActions']) or roles[0]['permissions'][0]['actions']:
            raise RuntimeError('EXISTING_UNWRAP_ONLY_ROLE_REQUIRED')
        result['phase']='AZURE_EXISTING_ASSIGNMENT_CHECK'
        prior=operator.identity.azure('role','assignment','list','--scope',operator.KEY_SCOPE)
        if any(row['principalId']==operator.OPERATOR and row['scope'].lower()==operator.KEY_SCOPE.lower() for row in prior):
            raise RuntimeError('EXISTING_OPERATOR_ASSIGNMENT_PRESERVED')
        _,probe_hash=runtime.expected_storage_identity()
        result['phase']='B_AUTHENTICATION_AND_BASELINE'
        credential=runtime.read_b_credential(gui=args.gui);client=runtime.check.connect('B',credential)
        before=remote(SNAPSHOT);validate_baseline(before,prepared,probe_hash)
        result['before']=before
        guest_path='/opt/highpass/b-key-recover-test-'+operation+'.py'
        with operator.gateway.root_sftp(client,credential) as sftp:
            with sftp.open(guest_path,'wx') as stream:stream.write((ROOT/'scripts/b-pacs-storage-guest.py').read_text().replace('\r\n','\n'))
            sftp.chown(guest_path,0,0);sftp.chmod(guest_path,0o600)
        result['phase']='TEMPORARY_EXACT_KEY_UNWRAP_PERMISSION'
        assignment=operator.identity.azure('role','assignment','create','--name',str(uuid.uuid4()),
            '--assignee-object-id',operator.OPERATOR,'--assignee-principal-type','User','--role',roles[0]['name'],'--scope',operator.KEY_SCOPE)
        assignment_id=assignment['id']
        token=operator.identity.azure('account','get-access-token','--resource','https://vault.azure.net')['accessToken']
        result['phase']='VERIFY_REAL_KEY_BEFORE_LOCK'
        key_check=operator.execute_guest(client,credential,guest_path,{'action':'verify-key','token':token})
        result['checks'].append({'test':'KEY_VAULT_UNWRAP_AND_REAL_LUKS_KEY','status':'PASS',**key_check})
        result['phase']='LOCK_AND_RECOVER'
        operator.execute_guest(client,credential,guest_path,{'action':'lock'});locked=True
        closed=remote(SNAPSHOT)
        if closed['mounted'] or closed['mappingPresent'] or closed['portal']!=before['portal']:raise RuntimeError('STORAGE_LOCK_NOT_VERIFIED')
        command=['python3',release+'/b-pacs-receiver-start.py','--compose',release+'/receiver.compose.yml','--env-file',release+'/receiver.env','--check-only']
        closed_gate=remote('import subprocess,json; p=subprocess.run('+repr(command)+',capture_output=True,timeout=15); print(json.dumps({"exitCode":p.returncode}))',20)
        if closed_gate['exitCode']==0:raise RuntimeError('CLOSED_STORAGE_START_NOT_DENIED')
        result['checks'].append({'test':'CLOSED_STORAGE_START_DENIED','status':'PASS'})
        recovered=operator.execute_guest(client,credential,guest_path,{'action':'recover','token':token});locked=False
        after=remote(SNAPSHOT);validate_baseline(after,prepared,probe_hash)
        result['checks'].append({'test':'MANUAL_KEY_RECOVERY_AND_HASH','status':'PASS',**recovered,'probeHash':after['probeHash']})
        remove_assignment();token=None
        result['phase']='GUARDED_MANUAL_START'
        started=remote('import subprocess,json; p=subprocess.run('+repr(command[:-1])+',capture_output=True,timeout=100); print(json.dumps({"exitCode":p.returncode}))',110)
        if started['exitCode']!=0:raise RuntimeError('GUARDED_MANUAL_START_FAILED')
        deadline=time.monotonic()+60
        while True:
            live=remote(SNAPSHOT)
            if len(live['receivers'])==2 and all(row['running'] for row in live['receivers']):break
            if time.monotonic()>=deadline:raise RuntimeError('RECEIVER_START_NOT_READY')
            time.sleep(2)
        result['phase']='ACTUAL_RUNTIME_BOUNDARY_CHECK'
        luks_uuid,_=runtime.expected_storage_identity()
        js=(ROOT/'src/b-pacs-storage-boundary.js').read_text()+'\nassertBPacsEncryptedMount(); console.log(JSON.stringify({status:"PASS"}));'
        current=remote(runtime.build_remote_program(operation[:12],js,luks_uuid),65)
        current['probeContentPreserved']=current.get('recoveryProbeHash')==probe_hash
        runtime.validate_runtime_result(current,luks_uuid,probe_hash)
        result['checks'].append({'test':'LIVE_ENCRYPTED_PACS_RUNTIME','status':'PASS'})
        (folder/'runtime.json').write_text(json.dumps(current,indent=2),encoding='utf8')
        dataset=ROOT/'artifacts/synthetic-hcc-ct/hong-gildong-reference-700-candidate-20261010'
        manifest=json.loads((dataset/'manifest.json').read_text());source=manifest['instances'][0]
        contract=json.loads(prepare.local(['node','--input-type=module','-e',"import {HCC_SOURCE_CONTRACT} from './src/hcc-source-contract.js'; console.log(JSON.stringify(HCC_SOURCE_CONTRACT))"]))
        if manifest.get('datasetType')!='SYNTHETIC' or manifest.get('clinicalUse') is not False or manifest['canonicalManifestSha256']!=contract['manifestSha256']:
            raise RuntimeError('PINNED_SYNTHETIC_DATASET_REQUIRED')
        source_path=(dataset/source['file']).resolve()
        if not source_path.is_relative_to(dataset.resolve()) or prepare.digest(source_path)!=source['sha256'] or source_path.stat().st_size!=source['bytes']:
            raise RuntimeError('PINNED_SYNTHETIC_SOURCE_REQUIRED')
        remote_source='/opt/highpass/b-pacs-encrypted/.synthetic-probe-'+operation+'.dcm'
        with operator.gateway.root_sftp(client,credential) as sftp:
            with source_path.open('rb') as incoming,sftp.open(remote_source,'wx') as outgoing:
                for chunk in iter(lambda:incoming.read(1024*1024),b''):outgoing.write(chunk)
            sftp.chown(remote_source,0,0);sftp.chmod(remote_source,0o600)
        request={'release':release,'source':remote_source,'bytes':source['bytes'],'sha256':source['sha256'],
                 'sopInstanceUid':source['sopInstanceUID'],'studyInstanceUid':contract['studyUid'],
                 'seriesInstanceUid':contract['seriesUid'],'operation':operation}
        result['phase']='MTLS_SYNTHETIC_STORE_AND_DUPLICATE'
        receipt=remote('request='+repr({**request,'mode':'store'})+'\n'+SMOKE,60)
        result['checks'].append({'test':'MTLS_SYNTHETIC_STORE_REQUERY_DUPLICATE','status':'PASS','receipt':receipt})
        result['phase']='PERSISTENCE_AFTER_RECEIVER_RESTART'
        compose=['docker','compose','-p','hp-b-pacs-receiver','--env-file',release+'/receiver.env','-f',release+'/receiver.compose.yml']
        remote('import subprocess,json; subprocess.run('+repr(command)+',capture_output=True,check=True,timeout=20); subprocess.run('+repr(compose+['stop','--timeout','20'])+',capture_output=True,check=True,timeout=50); subprocess.run('+repr(command[:-1])+',capture_output=True,check=True,timeout=100); print(json.dumps({"status":"PASS"}))',180)
        receipt=remote('request='+repr({**request,'mode':'requery'})+'\n'+SMOKE,60)
        result['checks'].append({'test':'PACS_DATA_PRESERVED_AFTER_RESTART','status':'PASS','receipt':receipt})
        final=remote(SNAPSHOT);validate_baseline(final,prepared,probe_hash,stopped=False)
        result['after']=final
        remote('import pathlib,json; pathlib.Path('+repr(remote_source)+').unlink(); print(json.dumps({"removedEncryptedStagingFile":True}))')
        result.update(status='PASS',phase='B_RECOVERY_AND_SYNTHETIC_PACS_VERIFIED',receiverStarted=True)
    except Exception as error:
        result['status']='FAIL';result['reason']=str(error) if isinstance(error,RuntimeError) and re.fullmatch('[A-Za-z0-9_]+',str(error)) else type(error).__name__
        if locked and client is not None and token:
            try:
                operator.execute_guest(client,credential,guest_path,{'action':'recover','token':token});locked=False
                result['failureRecovery']='RESTORED_PINNED_STORAGE'
            except Exception:result['failureRecovery']='STORAGE_REMAINS_CLOSED_REQUIRES_OPERATOR_RECOVERY'
    finally:
        try:remove_assignment()
        except Exception:result.update(status='FAIL',temporaryPermissionCleanup='NOT VERIFIED')
        token=None
        try:
            if client is not None:client.close()
        finally:credential=None
        result['storageLeftClosed']=locked
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps({**result,'evidence':str(folder/'result.json')}))
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
