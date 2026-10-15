"""Exact approved public IP/NIC/NSG changes; no web or clinical activation."""
import argparse
import importlib.util
import json
import pathlib
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('entry_azure', ROOT / 'scripts/capstone-key-identities.py')
identity = importlib.util.module_from_spec(spec)
spec.loader.exec_module(identity)
SUB = 'a3c0e7d4-ce09-4991-946b-88574869edd9'
RG = 'rg-highpass-capstone-20261008'
PIP = 'pip-highpass-images-b'
NIC = 'nic-highpass-capstone'
NSG = 'nsg-highpass-capstone'
RULE = 'Allow-Highpass-B-Video-HTTPS'
LABEL = 'highpass-images-b'
IPCONFIG = 'patient-images-b'


def az(*args):
    return identity.azure(*args, '--subscription', SUB)


def main():
    p = argparse.ArgumentParser()
    p.add_argument('phase', choices=['preflight', 'create', 'attach', 'open', 'verify', 'close'])
    p.add_argument('--folder', required=True)
    args = p.parse_args()
    folder = pathlib.Path(args.folder).resolve()
    assert folder.is_relative_to(ROOT / 'artifacts/azure') and (folder / 'B-inventory.json').exists()
    account = identity.azure('account', 'show')
    assert account['id'] == SUB and account['tenantId'] == identity.TENANT
    nic = az('network', 'nic', 'show', '-g', RG, '-n', NIC)
    nsg = az('network', 'nsg', 'show', '-g', RG, '-n', NSG)
    ips = az('network', 'public-ip', 'list', '-g', RG)
    primary = next(i for i in nic['ipConfigurations'] if i['primary'])
    assert primary['privateIPAddress'] == '10.89.0.4' and primary['publicIPAddress']['id'].endswith('/pip-highpass-capstone')
    current = [i for i in ips if i['name'] == PIP]
    record = {'phase': args.phase, 'at': datetime.now(timezone.utc).isoformat(), 'review': 'DRAFT / UNASSIGNED'}
    if args.phase == 'preflight':
        assert not current and not any(i['name'] == IPCONFIG for i in nic['ipConfigurations'])
        assert not any(r['name'] == RULE or r['priority'] == 140 for r in nsg['securityRules'])
        url = f'https://management.azure.com/subscriptions/{SUB}/providers/Microsoft.Network/locations/japaneast/CheckDnsNameAvailability?domainNameLabel={LABEL}&api-version=2024-05-01'
        assert az('rest', '--method', 'get', '--url', url)['available']
        assert az('network', 'vnet', 'check-ip-address', '-g', RG, '-n', 'vnet-highpass-capstone', '--ip-address', '10.89.0.5')['available']
        usage = az('network', 'list-usages', '--location', 'japaneast')
        public_usage = [x for x in usage if x['name']['value'] in ['PublicIPAddresses', 'IPv4StandardSkuPublicIpAddresses']]
        assert len(public_usage) == 2 and all(int(x['currentValue']) < int(x['limit']) for x in public_usage)
        baseline = {'nic': nic, 'nsg': nsg, 'publicIps': ips, 'publicIpUsage': public_usage}
        dest = folder / 'azure-baseline.json'
        assert not dest.exists()
        dest.write_text(json.dumps(baseline, indent=2), encoding='utf-8')
        record.update(status='PASS', nameAvailable=True, privateIpAvailable=True, publicIpUsage=public_usage)
    else:
        baseline = json.loads((folder / 'azure-baseline.json').read_text())
        before_primary = next(i for i in baseline['nic']['ipConfigurations'] if i['primary'])
        # NIC updates refresh per-config etags without changing primary networking.
        assert {k: v for k, v in primary.items() if k not in ['etag', 'provisioningState']} == {k: v for k, v in before_primary.items() if k not in ['etag', 'provisioningState']}
        if args.phase == 'create':
            assert not current
            result = az('network', 'public-ip', 'create', '-g', RG, '-n', PIP, '--location', 'japaneast', '--sku', 'Standard', '--allocation-method', 'Static', '--version', 'IPv4', '--tier', 'Regional', '--dns-name', LABEL, '--tags', 'project=Highpass', 'purpose=patient-b-tls-entry', 'environment=capstone-synthetic')
            pip = result['publicIp']
            assert pip['dnsSettings']['fqdn'] == LABEL + '.japaneast.cloudapp.azure.com'
            record.update(status='PASS', publicIp=pip['ipAddress'], fqdn=pip['dnsSettings']['fqdn'], id=pip['id'])
        else:
            assert len(current) == 1 and current[0].get('tags', {}).get('purpose') == 'patient-b-tls-entry'
            assert current[0]['id'] == json.loads((folder / 'azure-create.json').read_text())['id']
            if args.phase == 'attach':
                assert not any(i['name'] == IPCONFIG for i in nic['ipConfigurations'])
                az('network', 'nic', 'ip-config', 'create', '-g', RG, '--nic-name', NIC, '-n', IPCONFIG, '--private-ip-address', '10.89.0.5', '--subnet', primary['subnet']['id'], '--public-ip-address', current[0]['id'])
                record.update(status='PASS', secondaryPrivateIp='10.89.0.5')
            elif args.phase == 'open':
                assert not any(r['name'] == RULE or r['priority'] == 140 for r in nsg['securityRules'])
                az('network', 'nsg', 'rule', 'create', '-g', RG, '--nsg-name', NSG, '-n', RULE, '--priority', '140', '--direction', 'Inbound', '--access', 'Allow', '--protocol', 'Tcp', '--source-address-prefixes', 'Internet', '--source-port-ranges', '*', '--destination-address-prefixes', '10.89.0.5', '--destination-port-ranges', '443')
                record.update(status='PASS', publicTcp443Opened=True)
            elif args.phase == 'close':
                matches = [r for r in nsg['securityRules'] if r['name'] == RULE]
                assert len(matches) == 1 and matches[0]['destinationAddressPrefix'] == '10.89.0.5' and matches[0]['destinationPortRange'] == '443'
                az('network', 'nsg', 'rule', 'delete', '-g', RG, '--nsg-name', NSG, '-n', RULE)
                record.update(status='PASS', publicRuleRemoved=True, billableIpRetained=True)
            else:
                added = next(x for x in nic['ipConfigurations'] if x['name'] == IPCONFIG)
                assert added['privateIPAddress'] == '10.89.0.5' and added['publicIPAddress']['id'] == current[0]['id']
                rule = next(r for r in nsg['securityRules'] if r['name'] == RULE)
                assert rule['destinationAddressPrefix'] == '10.89.0.5' and rule['destinationPortRange'] == '443' and rule['sourceAddressPrefix'] == 'Internet' and rule['access'] == 'Allow' and rule['protocol'] == 'Tcp'
                for old in baseline['nsg']['securityRules']:
                    live_rule = next(r for r in nsg['securityRules'] if r['name'] == old['name'])
                    assert {k: v for k, v in live_rule.items() if k not in ['etag', 'provisioningState']} == {k: v for k, v in old.items() if k not in ['etag', 'provisioningState']}
                record.update(status='PASS', existingRulesPreserved=True, publicIp=current[0]['ipAddress'], fqdn=current[0]['dnsSettings']['fqdn'])
    (folder / ('azure-' + args.phase + '.json')).write_text(json.dumps(record, indent=2), encoding='utf-8')
    print(json.dumps(record), flush=True)


if __name__ == '__main__':
    main()
