"""Restore and independently compare exact wrapped key. Original Vault untouched."""
import argparse
import getpass
import hashlib
import importlib.util
import json
import pathlib
from datetime import datetime,timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('restore_operator',ROOT/'scripts/b-pacs-storage-provision.py')
operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--infra',required=True);parser.add_argument('--verify-only',action='store_true');parser.add_argument('--test-storage',action='store_true');args=parser.parse_args()
    folder=ROOT/'artifacts/azure'/('b-vault-restore-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False)
    result=dict(review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat(),checks=[])
    assignments=[];client=None;phase='BASELINE'
    try:
        infra_path=pathlib.Path(args.infra).resolve()
        if not infra_path.is_relative_to(ROOT/'artifacts/azure') or infra_path.name!='result.json':raise RuntimeError('OWNED_INFRA_RECEIPT_REQUIRED')
        infra=json.loads(infra_path.read_text())
        if infra.get('status')!='PASS':raise RuntimeError('SUCCESSFUL_PRIVATE_INFRA_REQUIRED')
        recovery=infra['recoveryVault']['id']
        expected=operator.identity.VAULT.replace('kv-hp-demo-4869edd9','kv-hp-recover-4869edd9')
        if recovery.lower()!=expected.lower():raise RuntimeError('EXACT_RECOVERY_VAULT_REQUIRED')
        current=operator.identity.azure('keyvault','show','-n','kv-hp-recover-4869edd9')
        if current['properties'].get('publicNetworkAccess')!='Disabled' or current['properties'].get('enableRbacAuthorization') is not True:raise RuntimeError('PRIVATE_RBAC_REQUIRED')
        material=ROOT/'artifacts/workstation/b-storage-provision-20261013T013045Z'
        prior=json.loads((material/'result.json').read_text())
        for name in ['storage.json','vault-key-backup.json']:
            if hashlib.sha256((material/name).read_bytes()).hexdigest()!=prior['recoveryMaterialHashes'][name]:raise RuntimeError('RECOVERY_MATERIAL_HASH_FAILED')
        manifest=json.loads((material/'storage.json').read_text());backup=json.loads((material/'vault-key-backup.json').read_text())
        client=operator.check.connect('CLOUD',None)
        path='/opt/highpass/'+folder.name+'.py'
        with operator.gateway.root_sftp(client,None) as sftp:
            with sftp.open(path,'wx') as stream:stream.write((ROOT/'scripts/b-pacs-vault-restore-guest.py').read_text().replace('\r\n','\n'))
            sftp.chmod(path,0o600);sftp.chown(path,0,0)
        token=operator.identity.azure('account','get-access-token','--resource','https://vault.azure.net')['accessToken']
        def assign(file,scope):
            expected_role=json.loads((ROOT/file).read_text())
            roles=operator.identity.azure('role','definition','list','--name',expected_role['Name'])
            if not roles:role=operator.identity.azure('role','definition','create','--role-definition',str(ROOT/file))
            elif len(roles)==1 and set(roles[0]['permissions'][0]['dataActions'])==set(expected_role['DataActions']) and not roles[0]['permissions'][0]['actions']:role=roles[0]
            else:raise RuntimeError('EXACT_TEMPORARY_ROLE_REQUIRED')
            value=operator.identity.azure('role','assignment','create','--assignee-object-id',operator.OPERATOR,'--assignee-principal-type','User','--role',role['name'],'--scope',scope)
            assignments.append(value['id']);return value['id']
        request=dict(token=token,manifest=manifest,backup=backup,recoveryIp=infra['recoveryPrivateIp'])
        if not args.verify_only:
            phase='UNASSIGNED_OPERATOR_NEGATIVE'
            result['checks'].append(operator.execute_guest(client,None,path,{**request,'action':'deny'}))
            phase='RESTORE_ONLY'
            assignment=assign('infra/azure/b-pacs-key-restore-role.json',recovery)
            result['checks'].append(operator.execute_guest(client,None,path,{**request,'action':'restore'}))
            operator.identity.azure('role','assignment','delete','--ids',assignment)
        phase='READ_UNWRAP_ONLY_COMPARISON'
        for scope in [operator.KEY_SCOPE,recovery+'/keys/highpass-b-storage-kek-20261013']:
            assign('infra/azure/capstone-key-unwrap-role.json',scope)
        result['checks'].append(operator.execute_guest(client,None,path,{**request,'action':'verify'}))
        if args.test_storage:
            phase='B_READ_ONLY_LUKS_PASSPHRASE'
            password=getpass.getpass('B VM password (concealed): ')
            b=None
            try:
                b=operator.check.connect('B',password)
                with operator.gateway.root_sftp(b,password) as sftp:
                    with sftp.open(path,'wx') as stream:stream.write((ROOT/'scripts/b-pacs-vault-restore-guest.py').read_text().replace('\r\n','\n'))
                    sftp.chmod(path,0o600);sftp.chown(path,0,0)
                result['checks'].append(operator.execute_guest(b,password,path,{**request,'action':'test-storage'}))
            finally:
                if b:b.close()
                password=None
        request=None;token=None;result['status']='PASS'
    except Exception as error:
        result.update(status='FAIL',phase=phase,reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:
        for assignment in assignments:
            try:
                operator.identity.azure('role','assignment','delete','--ids',assignment)
                remaining=operator.identity.azure('role','assignment','list','--all','--query',"[?id=='"+assignment+"']")
                if remaining:raise RuntimeError('ROLE_STILL_PRESENT')
                result['checks'].append(dict(test='TEMPORARY_ROLE_REMOVED',status='PASS',assignmentId=assignment))
            except Exception:result['status']='FAIL';result['checks'].append(dict(test='TEMPORARY_ROLE_REMOVED',status='FAIL',assignmentId=assignment))
        if client:client.close()
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        print(json.dumps(dict(evidence=str(folder/'result.json'),**result)),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
