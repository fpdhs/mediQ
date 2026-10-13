"""Exact approved shared Vault change. Default read-only; irreversible --apply.

Only PATCH enablePurgeProtection=true. No retention, keys, roles or service changes.
"""
import argparse
import importlib.util
import json
import pathlib
import subprocess
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
VAULT_NAME = 'kv-hp-demo-4869edd9'
SUBSCRIPTION = 'a3c0e7d4-ce09-4991-946b-88574869edd9'
TENANT = 'ad21525c-fc0f-4dbc-a403-67ce00add0e4'
VAULT_ID = '/subscriptions/' + SUBSCRIPTION + '/resourceGroups/rg-highpass-capstone-20261008/providers/Microsoft.KeyVault/vaults/' + VAULT_NAME
PATCH_BODY = {'properties': {'enablePurgeProtection': True}}


def validate_baseline(account, vault):
    p = vault['properties']
    if account['id'] != SUBSCRIPTION or account['tenantId'] != TENANT or vault['id'].lower() != VAULT_ID.lower() or p['tenantId'] != TENANT:
        raise ValueError('EXACT_APPROVED_ACCOUNT_AND_VAULT_REQUIRED')
    if vault['location'] != 'japaneast' or p.get('provisioningState') != 'Succeeded':
        raise ValueError('APPROVED_READY_VAULT_REQUIRED')
    if p.get('enableSoftDelete') is not True or p.get('softDeleteRetentionInDays') != 7:
        raise ValueError('EXISTING_SEVEN_DAY_SOFT_DELETE_REQUIRED')
    if p.get('publicNetworkAccess') != 'Disabled' or p.get('enableRbacAuthorization') is not True:
        raise ValueError('PRIVATE_RBAC_REQUIRED')


def stable_properties(vault):
    return {k:v for k,v in vault['properties'].items() if k not in ['enablePurgeProtection','provisioningState']}


def scoped_roles(rows):
    return sorted([{k:r.get(k) for k in ['id','scope','principalId','roleDefinitionId']} for r in rows
                   if r['scope'].lower().startswith(VAULT_ID.lower())], key=lambda r:r['id'])


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true')
    args=parser.parse_args()
    spec=importlib.util.spec_from_file_location('purge_protection_identity',ROOT/'scripts/capstone-key-identities.py')
    identity=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(identity)
    started=time.monotonic()
    stamp=datetime.now(timezone.utc)
    directory=ROOT/'artifacts/azure'/('b-purge-protection-'+stamp.strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    result=dict(observedAt=stamp.isoformat(),review='DRAFT / UNASSIGNED',scope='SHARED_VAULT_PURGE_PROTECTION_ONLY',
        authorizedChange='USER_EXPLICIT_ENABLE_SHARED_VAULT_EXISTING_7_DAYS',mutationAttempted=False,
        irreversible=True,checks=[],head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip(),
        dirty=bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT)),
        diagnosticsConfigured=False,pacsDeployed=False,vmRebooted=False)
    phase='BASELINE'
    exit_code=1
    try:
        account=identity.azure('account','show')
        before=identity.azure('keyvault','show','--name',VAULT_NAME,'--subscription',SUBSCRIPTION)
        validate_baseline(account,before)
        roles_before=scoped_roles(identity.azure('role','assignment','list','--all'))
        result['before']=before
        result['rolesBefore']=roles_before
        result['checks'].append(dict(test='EXACT_PRIVATE_RBAC_SEVEN_DAY_BASELINE',status='PASS'))
        if args.apply and before['properties'].get('enablePurgeProtection') is not True:
            phase='ONE_PROPERTY_IRREVERSIBLE_PATCH'
            result['mutationAttempted']=True
            result['requestBody']=PATCH_BODY
            # Explicit API body does not resend/replace other Vault settings.
            identity.azure('rest','--method','patch','--url','https://management.azure.com'+VAULT_ID+'?api-version=2024-11-01',
                           '--body',json.dumps(PATCH_BODY),'--headers','Content-Type=application/json')
        phase='INDEPENDENT_READBACK'
        after=identity.azure('keyvault','show','--name',VAULT_NAME,'--subscription',SUBSCRIPTION)
        result['after']=after
        validate_baseline(account,after)
        roles_after=scoped_roles(identity.azure('role','assignment','list','--all'))
        result['rolesAfter']=roles_after
        enabled=after['properties'].get('enablePurgeProtection') is True
        unchanged=stable_properties(before)==stable_properties(after) and before.get('tags')==after.get('tags') and before['location']==after['location']
        result['checks'] += [dict(test='PURGE_PROTECTION_ENABLED',status='PASS' if enabled else 'NOT VERIFIED'),
            dict(test='OTHER_VAULT_PROPERTIES_UNCHANGED',status='PASS' if unchanged else 'FAIL'),
            dict(test='EXISTING_VAULT_KEY_ASSIGNMENTS_UNCHANGED',status='PASS' if roles_after==roles_before else 'FAIL')]
        phase='ACTIVITY_LOG_READBACK'
        try:
            events=identity.azure('monitor','activity-log','list','--resource-id',VAULT_ID,
                                  '--start-time',stamp.strftime('%Y-%m-%dT%H:%M:%SZ'),'--max-events','30')
            records=[]
            for e in events:
                if e.get('operationName',{}).get('value','').lower()=='microsoft.keyvault/vaults/write':
                    records.append({k:e.get(k) for k in ['eventDataId','eventTimestamp','correlationId','operationName','status','resourceId']})
            result['managementEvents']=records
            result['checks'].append(dict(test='MANAGEMENT_WRITE_ACTIVITY_EVENT',status='PASS' if any(e.get('status',{}).get('value')=='Succeeded' for e in records) else 'NOT VERIFIED'))
        except Exception:
            result['checks'].append(dict(test='MANAGEMENT_WRITE_ACTIVITY_EVENT',status='NOT VERIFIED',reason='READBACK_UNAVAILABLE_OR_INGESTION_DELAY'))
        # Activity Log is NOT Key Vault crypto AuditEvent diagnostic collection.
        exit_code=0 if unchanged and roles_before==roles_after and (enabled or not args.apply) else 1
    except Exception as error:
        result['checks'].append(dict(test=phase,status='NOT VERIFIED',reason=str(error) if isinstance(error,(ValueError,RuntimeError)) else type(error).__name__))
        if result['mutationAttempted']:
            try:result['afterFailureReadback']=identity.azure('keyvault','show','--name',VAULT_NAME,'--subscription',SUBSCRIPTION)
            except Exception:pass
    result.update(status='PASS' if exit_code==0 and args.apply else 'NOT VERIFIED',exitCode=exit_code,
        elapsedMs=round((time.monotonic()-started)*1000),rollback='NOT_SUPPORTED_DO_NOT_DISABLE_OR_DELETE',
        remaining=['Key Vault AuditEvent diagnostics not configured','Reboot recovery not verified','Separate Vault restore not verified','B PACS / 700-instance transfer not verified'])
    (directory/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(directory/'result.json'),status=result['status'],exitCode=exit_code,
                         elapsedMs=result['elapsedMs'],mutationAttempted=result['mutationAttempted'],checks=result['checks'])))
    return exit_code


if __name__=='__main__':raise SystemExit(main())
