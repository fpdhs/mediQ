"""Approved scoped audit destination and private recovery Vault. No keys or DICOM."""
import argparse
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('audit_infra_identity',ROOT/'scripts/capstone-key-identities.py')
identity=importlib.util.module_from_spec(spec);spec.loader.exec_module(identity)
RG='rg-highpass-capstone-20261008'
SUB='a3c0e7d4-ce09-4991-946b-88574869edd9'
BASE='/subscriptions/'+SUB+'/resourceGroups/'+RG
WORKSPACE='law-highpass-key-audit-20261013'
RECOVERY='kv-hp-recover-4869edd9'
PE='pe-highpass-key-recovery'
TAG='highpass.scope=b-storage-recovery-20261013'

def validate_vault(value):
    p=value['properties']
    if value['id'].lower()!=(BASE+'/providers/Microsoft.KeyVault/vaults/'+RECOVERY).lower() or value['location']!='japaneast':
        raise RuntimeError('RECOVERY_VAULT_BINDING_REQUIRED')
    if not all(p.get(k) is True for k in ['enableRbacAuthorization','enableSoftDelete','enablePurgeProtection']) or p.get('publicNetworkAccess')!='Disabled' or p.get('softDeleteRetentionInDays')!=7:
        raise RuntimeError('PRIVATE_PURGE_PROTECTED_RBAC_RECOVERY_VAULT_REQUIRED')

def configure_audit(vault_id,workspace_id):
    return identity.azure('rest','--method','put','--url','https://management.azure.com'+vault_id+'/providers/Microsoft.Insights/diagnosticSettings/highpass-b-storage-audit?api-version=2021-05-01-preview',
        '--body',json.dumps({'properties':{'workspaceId':workspace_id,'logs':[{'category':'AuditEvent','enabled':True}]}}))

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--apply',action='store_true');args=parser.parse_args()
    folder=ROOT/'artifacts/azure'/('b-audit-recovery-infra-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True,exist_ok=False)
    result=dict(review='DRAFT / UNASSIGNED',observedAt=datetime.now(timezone.utc).isoformat(),checks=[],mutations=[])
    phase='BASELINE'
    try:
        account=identity.azure('account','show')
        if account['id']!=SUB or account['tenantId']!=identity.TENANT:raise RuntimeError('EXACT_ACCOUNT_REQUIRED')
        for namespace in ['Microsoft.OperationalInsights','Microsoft.Insights']:
            provider=identity.azure('provider','show','-n',namespace)
            if provider.get('registrationState')!='Registered':raise RuntimeError('REQUIRED_PROVIDER_NOT_REGISTERED_'+namespace)
        primary=identity.azure('keyvault','show','--name','kv-hp-demo-4869edd9')
        if primary['id'].lower()!=identity.VAULT.lower() or primary['properties'].get('publicNetworkAccess')!='Disabled' or primary['properties'].get('enablePurgeProtection') is not True:
            raise RuntimeError('PRIMARY_PROTECTION_REQUIRED')
        result['primaryBefore']={k:primary['properties'].get(k) for k in ['enablePurgeProtection','publicNetworkAccess','enableRbacAuthorization','softDeleteRetentionInDays']}
        resources=identity.azure('resource','list','--resource-group',RG)
        names={r['name']:r for r in resources}
        for name in [WORKSPACE,RECOVERY,PE]:
            if name in names and names[name].get('tags',{}).get('highpass.scope')!='b-storage-recovery-20261013':
                raise RuntimeError('EXISTING_RESOURCE_PRESERVED_'+name)
        if not args.apply:
            result.update(status='NOT VERIFIED',reason='APPLY_REQUIRED');return 0
        phase='AUDIT_WORKSPACE'
        if WORKSPACE not in names:
            # Installed CLI's AAZ --tags parser fails before request dispatch.
            # Use the documented ARM contract, not a CLI upgrade or auth bypass.
            identity.azure('rest','--method','put','--url','https://management.azure.com'+BASE+'/providers/Microsoft.OperationalInsights/workspaces/'+WORKSPACE+'?api-version=2023-09-01',
                '--body',json.dumps({'location':'japaneast','tags':{'highpass.scope':'b-storage-recovery-20261013'},
                    'properties':{'sku':{'name':'PerGB2018'},'retentionInDays':30,
                        'features':{'disableLocalAuth':True,'enableLogAccessUsingOnlyResourcePermissions':False}}}))
            result['mutations'].append('CREATE_AUDIT_WORKSPACE')
        workspace=identity.azure('monitor','log-analytics','workspace','show','-g',RG,'-n',WORKSPACE)
        # Creation includes query RBAC and disables shared-key authentication.
        # Fail closed on reuse with unexpected policy; never silently widen it.
        if workspace['retentionInDays']!=30 or workspace['features'].get('disableLocalAuth') is not True:raise RuntimeError('AUDIT_WORKSPACE_POLICY_FAILED')
        result['workspace']={k:workspace.get(k) for k in ['id','customerId','retentionInDays','features','sku']}
        for vault_id in [identity.VAULT]:
            rows=identity.azure('monitor','diagnostic-settings','list','--resource',vault_id)
            rows=rows.get('value',[]) if isinstance(rows,dict) else rows
            name='highpass-b-storage-audit'
            prior=next((r for r in rows if r['name']==name),None)
            if prior and prior.get('workspaceId','').lower()!=workspace['id'].lower():raise RuntimeError('EXISTING_DIAGNOSTIC_PRESERVED')
            configure_audit(vault_id,workspace['id'])
            result['mutations'].append('PRIMARY_AUDITEVENT_CONFIGURATION')
        phase='PRIVATE_RECOVERY_VAULT'
        if RECOVERY not in names:
            identity.azure('keyvault','create','-g',RG,'-n',RECOVERY,'-l','japaneast','--sku','standard','--enable-rbac-authorization','true',
                '--enable-purge-protection','true','--retention-days','7','--public-network-access','Disabled','--default-action','Deny','--tags',TAG)
            result['mutations'].append('CREATE_PRIVATE_RECOVERY_VAULT')
        recovered=identity.azure('keyvault','show','-n',RECOVERY);validate_vault(recovered)
        result['recoveryVault']={'id':recovered['id'],'location':recovered['location'],**{k:recovered['properties'].get(k) for k in result['primaryBefore']}}
        if PE not in names:
            identity.azure('network','private-endpoint','create','-g',RG,'-n',PE,'-l','japaneast','--vnet-name','vnet-highpass-capstone',
                '--subnet','private-endpoints','--private-connection-resource-id',recovered['id'],'--group-ids','vault','--connection-name','highpass-b-storage-recovery','--tags',json.dumps({'highpass.scope':'b-storage-recovery-20261013'}))
            result['mutations'].append('CREATE_RECOVERY_PRIVATE_ENDPOINT')
        phase='PRIVATE_DNS'
        zone=BASE+'/providers/Microsoft.Network/privateDnsZones/privatelink.vaultcore.azure.net'
        groups=identity.azure('network','private-endpoint','dns-zone-group','list','-g',RG,'--endpoint-name',PE)
        if not groups:
            identity.azure('network','private-endpoint','dns-zone-group','create','-g',RG,'--endpoint-name',PE,'-n','highpass-recovery-vault',
                '--private-dns-zone',zone,'--zone-name','vault')
        endpoint=identity.azure('network','private-endpoint','show','-g',RG,'-n',PE)
        connections=endpoint['privateLinkServiceConnections']
        if len(connections)!=1 or connections[0]['privateLinkServiceId'].lower()!=recovered['id'].lower() or connections[0]['privateLinkServiceConnectionState']['status']!='Approved':raise RuntimeError('APPROVED_PRIVATE_ENDPOINT_REQUIRED')
        nic=identity.azure('network','nic','show','--ids',endpoint['networkInterfaces'][0]['id'])
        result['recoveryPrivateIp']=nic['ipConfigurations'][0]['privateIPAddress']
        configure_audit(recovered['id'],workspace['id'])
        phase='READBACK'
        for label,vault_id in [('primary',identity.VAULT),('recovery',recovered['id'])]:
            diagnostics=identity.azure('monitor','diagnostic-settings','list','--resource',vault_id)
            rows=diagnostics.get('value',[]) if isinstance(diagnostics,dict) else diagnostics
            good=any(r.get('workspaceId','').lower()==workspace['id'].lower() and any(l.get('enabled') is True and l.get('category')=='AuditEvent' for l in r.get('logs',[])) for r in rows)
            result['checks'].append(dict(test=label.upper()+'_AUDIT_CONFIGURATION',status='PASS' if good else 'FAIL'))
        after=identity.azure('keyvault','show','-n','kv-hp-demo-4869edd9')
        if any(after['properties'].get(k)!=v for k,v in result['primaryBefore'].items()):raise RuntimeError('PRIMARY_PROTECTION_CHANGED')
        result['status']='PASS' if all(c['status']=='PASS' for c in result['checks']) else 'FAIL'
        result['auditIngestion']='NOT VERIFIED'
        result['keyRestore']='NOT VERIFIED'
    except Exception as error:
        result.update(status='FAIL',phase=phase,reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__)
    finally:
        (folder/'result.json').write_text(json.dumps(result,indent=2),encoding='utf8')
        print(json.dumps(dict(evidence=str(folder/'result.json'),**result)),flush=True)
    return 0 if result['status']=='PASS' else 1

if __name__=='__main__':raise SystemExit(main())
