"""Read-only scoped recovery review; never enables protection, grants or restores."""
import hashlib
import importlib.util
import json
import pathlib
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('recovery_review_identity', ROOT/'scripts/capstone-key-identities.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
KEY_SCOPE = identity.VAULT + '/keys/highpass-b-storage-kek-20261013'


def main():
    started = time.monotonic()
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED',
                  scope='SHARED_VAULT_PROTECTION_AND_B_STORAGE_RECOVERY_REVIEW', readOnly=True,
                  checks=[], mutationExecuted=False, approval='PENDING_EXPLICIT_IRREVERSIBLE_VAULT_CHANGE')
    vault = identity.azure('keyvault', 'show', '--name', 'kv-hp-demo-4869edd9')
    if vault['id'].lower() != identity.VAULT.lower():
        raise RuntimeError('EXACT_VAULT_REQUIRED')
    p = vault['properties']
    result['vault'] = dict(id=vault['id'], location=vault['location'], **{k:p.get(k) for k in
        ['enablePurgeProtection','enableSoftDelete','softDeleteRetentionInDays','enableRbacAuthorization','publicNetworkAccess','provisioningState']})
    result['checks'].append(dict(test='PRIVATE_RBAC_SOFT_DELETE', status='PASS' if p.get('enableSoftDelete') is True and p.get('enableRbacAuthorization') is True and p.get('publicNetworkAccess')=='Disabled' else 'FAIL'))
    result['checks'].append(dict(test='PURGE_PROTECTION',status='PASS' if p.get('enablePurgeProtection') is True else 'FAIL',reason='NOT_ENABLED' if p.get('enablePurgeProtection') is not True else None))
    diagnostics = identity.azure('monitor','diagnostic-settings','list','--resource',identity.VAULT)
    rows = diagnostics.get('value') if isinstance(diagnostics,dict) else diagnostics
    if not isinstance(rows,list):
        raise RuntimeError('DIAGNOSTIC_SETTINGS_RESPONSE_UNKNOWN')
    result['diagnosticSettings'] = [{k:r.get(k) for k in ['name','logs','workspaceId','storageAccountId','eventHubAuthorizationRuleId']} for r in rows]
    audit_enabled = any(log.get('enabled') is True and (log.get('category')=='AuditEvent' or log.get('categoryGroup') in ['audit','allLogs']) for r in rows for log in (r.get('logs') or []))
    result['checks'].append(dict(test='VAULT_AUDIT_DIAGNOSTIC_CONFIGURATION',status='PASS' if audit_enabled else 'FAIL',reason=None if audit_enabled else 'AUDIT_DIAGNOSTIC_NOT_CONFIGURED'))
    assignments=identity.azure('role','assignment','list','--all')
    scoped=[r for r in assignments if r['scope'].lower().startswith(identity.VAULT.lower())]
    result['vaultScopedAssignments']=[{k:r.get(k) for k in ['id','principalId','roleDefinitionName','scope']} for r in scoped]
    pending=[r for r in scoped if r['scope'].lower()==KEY_SCOPE.lower()]
    result['checks'].append(dict(test='NO_LEFTOVER_STORAGE_KEY_ASSIGNMENT',status='PASS' if not pending else 'NOT VERIFIED',count=len(pending)))
    directories=['b-storage-provision-20261013T013045Z','b-storage-provision-20261013T013712Z']
    result['recoveryCopies']=[]
    for name in directories:
        directory=ROOT/'artifacts/workstation'/name
        receipt=json.loads((directory/'result.json').read_text())
        hashes={f:hashlib.sha256((directory/f).read_bytes()).hexdigest() for f in ['storage.json','vault-key-backup.json','luks-header.backup']}
        manifest=json.loads((directory/'storage.json').read_text())
        backup=json.loads((directory/'vault-key-backup.json').read_text())
        matches=hashes==receipt['recoveryMaterialHashes']
        binding=manifest['keyId']==backup['keyId'] and manifest['keyId'].startswith('https://kv-hp-demo-4869edd9.vault.azure.net/keys/highpass-b-storage-kek-20261013/')
        header=(directory/'luks-header.backup').open('rb')
        with header: magic=header.read(6)==b'LUKS\xba\xbe'
        result['recoveryCopies'].append(dict(directory=name,hashes=hashes,hashesMatch=matches,keyBindingMatches=binding,luksHeaderMagic=magic,status='PASS' if matches and binding and magic else 'FAIL'))
    result['checks'].append(dict(test='LOCAL_ENCRYPTED_RECOVERY_MATERIAL_HASH_AND_BINDING',status='PASS' if all(c['status']=='PASS' for c in result['recoveryCopies']) else 'FAIL'))
    result['checks'] += [dict(test=t,status='NOT VERIFIED') for t in ['CURRENT_PRIVATE_DATA_PLANE_KEY_METADATA','KEY_BACKUP_RESTORE_TO_SEPARATE_VAULT','VM_REBOOT_RECOVERY','FULL_CIPHERTEXT_VOLUME_BACKUP_RESTORE','KEY_VAULT_AUDIT_EVENT_CORRELATION']]
    result['dataPlaneMetadataProbe']=dict(status='NOT VERIFIED',reason='WORKSTATION_ARM_KEYS_LIST_REJECTED_FORBIDDEN_BY_CONNECTION',publicNetworkBypass=False,temporaryPermissionGranted=False)
    result['recommendation']=dict(enablePurgeProtection=True,existingRetentionDays=7,changeRetention=False,
        enablementIrreversible=True,appliesToEntireSharedVault=True,createRecoveryVault=False,
        activatePacsImport=False,automaticallyExpireStorageKey=False)
    result['status']='REVIEW_COMPLETE_APPLY_AWAITING_APPROVAL'
    result['elapsedMs']=round((time.monotonic()-started)*1000)
    result['exitCode']=0
    directory=ROOT/'artifacts/azure'/('b-key-recovery-review-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    directory.mkdir(parents=True,exist_ok=False)
    (directory/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
    print(json.dumps(dict(evidence=str(directory/'result.json'),**result)))


if __name__=='__main__':main()
