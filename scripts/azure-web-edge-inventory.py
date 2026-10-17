"""Read-only inventory for a separate VM web edge; never opens ingress."""
import importlib.util
import json
import pathlib
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUB = 'a3c0e7d4-ce09-4991-946b-88574869edd9'
RG = 'rg-highpass-capstone-20261008'


def main():
    spec = importlib.util.spec_from_file_location('edge_identity', ROOT / 'scripts/capstone-key-identities.py')
    identity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(identity)
    started = time.monotonic()
    result = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED',
                  scope='READ ONLY NETWORK INVENTORY; NO DNS/NSG/TLS/DEPLOYMENT CHANGE', checks=[])
    phase = 'ACCOUNT'
    try:
        account = identity.azure('account', 'show', '--query', '{id:id,tenantId:tenantId,state:state}')
        if account['id'] != SUB or account['tenantId'] != identity.TENANT or account['state'] != 'Enabled':
            raise RuntimeError('APPROVED_ACCOUNT_REQUIRED')
        for name, args in [
            ('VM', ('vm', 'show', '-g', RG, '-n', 'vm-highpass-capstone', '--query', '{id:id,location:location,nics:networkProfile.networkInterfaces,size:hardwareProfile.vmSize}')),
            ('NIC', ('network', 'nic', 'show', '-g', RG, '-n', 'nic-highpass-capstone', '--query', '{id:id,nsg:networkSecurityGroup,ipConfigurations:ipConfigurations}')),
            ('PUBLIC_IP', ('network', 'public-ip', 'show', '-g', RG, '-n', 'pip-highpass-capstone', '--query', '{id:id,ipAddress:ipAddress,dnsSettings:dnsSettings,allocation:publicIPAllocationMethod,sku:sku}')),
            ('NSG', ('network', 'nsg', 'show', '-g', RG, '-n', 'nsg-highpass-capstone', '--query', '{id:id,securityRules:securityRules}')),
            ('SUBNET', ('network', 'vnet', 'subnet', 'show', '-g', RG, '--vnet-name', 'vnet-highpass-capstone', '-n', 'cloud-services', '--query', '{id:id,nsg:networkSecurityGroup,routeTable:routeTable,addressPrefix:addressPrefix}')),
            ('EFFECTIVE_NSG', ('network', 'nic', 'list-effective-nsg', '-g', RG, '-n', 'nic-highpass-capstone')),
            ('EFFECTIVE_ROUTES', ('network', 'nic', 'show-effective-route-table', '-g', RG, '-n', 'nic-highpass-capstone')),
        ]:
            phase = name
            data = identity.azure(*args, '--subscription', SUB)
            result['checks'].append(dict(name=name, status='PASS', data=data))
        phase = 'HOST'
        host_spec = importlib.util.spec_from_file_location('edge_host', ROOT / 'scripts/health-helper-runtime-check.py')
        host = importlib.util.module_from_spec(host_spec)
        host_spec.loader.exec_module(host)
        client = host.connect('CLOUD', None)
        try:
            data = host.remote(client, 'CLOUD', None, '''import json,subprocess
items=json.loads(subprocess.check_output(['docker','inspect','hp-capstone-control-control-1','hp-capstone-control-ingress-1','hp-capstone-control-postgres-1'],timeout=10))
out=[]
for item in items:
 env=dict(x.split('=',1) for x in item['Config']['Env'] if '=' in x)
 out.append(dict(name=item['Name'],image=item['Image'],health=item['State'].get('Health',{}).get('Status'),ports=item['HostConfig']['PortBindings'],securityMode={k:env.get(k) for k in ['AUTH_MODE','HIPASS_CONTROL_PLANE_ONLY','HIPASS_DPOP_REQUIRED']}))
print(json.dumps(dict(containers=out,listeners=subprocess.check_output(['ss','-lnt'],timeout=5).decode(),firewall=subprocess.check_output(['iptables','-S'],timeout=5).decode())))''', 25)
            result['checks'].append(dict(name=phase, status='PASS', data=data))
        finally:
            client.close()
        result['status'] = 'PASS'
    except Exception as error:
        result['status'] = 'FAIL'
        result['checks'].append(dict(name=phase, status='FAIL', reason=type(error).__name__))
    result['elapsedSeconds'] = round(time.monotonic() - started, 3)
    folder = ROOT / 'artifacts/azure' / ('web-edge-inventory-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True, exist_ok=False)
    (folder / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(dict(status=result['status'], checks=[dict(name=x['name'], status=x['status']) for x in result['checks']], evidence=str(folder / 'result.json'), elapsedSeconds=result['elapsedSeconds'])))
    return 0 if result['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
