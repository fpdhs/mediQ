"""Exact existing Public IP DNS label only; no ingress or service changes."""
import argparse
import importlib.util
import json
import pathlib
import time
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
SUB = 'a3c0e7d4-ce09-4991-946b-88574869edd9'
RG = 'rg-highpass-capstone-20261008'
LABEL = 'highpass-demo'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location('dns_identity', ROOT / 'scripts/capstone-key-identities.py')
    identity = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(identity)
    started = time.monotonic()
    evidence = dict(observedAt=datetime.now(timezone.utc).isoformat(), review='DRAFT / UNASSIGNED',
                    ingressChanged=False, deployment=False, requestedLabel=LABEL, applied=False)
    try:
        account = identity.azure('account', 'show')
        if account['id'] != SUB or account['tenantId'] != identity.TENANT:
            raise RuntimeError('ACCOUNT_MISMATCH')
        query = ('network', 'public-ip', 'show', '-g', RG, '-n', 'pip-highpass-capstone', '--subscription', SUB)
        before = identity.azure(*query)
        evidence['before'] = before
        if before['location'] != 'japaneast' or before['ipAddress'] != '138.91.2.60' or before['publicIPAllocationMethod'] != 'Static':
            raise RuntimeError('PUBLIC_IP_BASELINE_MISMATCH')
        current = (before.get('dnsSettings') or {}).get('domainNameLabel')
        if current and current != LABEL:
            raise RuntimeError('EXISTING_DNS_PRESERVED')
        if not current:
            available = identity.azure('rest', '--method', 'get', '--url',
                                       'https://management.azure.com/subscriptions/' + SUB +
                                       '/providers/Microsoft.Network/locations/japaneast/checkDnsNameAvailability?api-version=2025-05-01&domainNameLabel=' + LABEL)
            evidence['availability'] = available
            if available.get('available') is not True:
                raise RuntimeError('DNS_NAME_UNAVAILABLE')
            if args.apply:
                fresh = identity.azure(*query)
                if fresh.get('etag') != before.get('etag'):
                    raise RuntimeError('CONCURRENT_PUBLIC_IP_CHANGE')
                identity.azure('network', 'public-ip', 'update', '-g', RG, '-n', 'pip-highpass-capstone',
                               '--dns-name', LABEL, '--subscription', SUB)
                evidence['applied'] = True
        after = identity.azure(*query)
        evidence['after'] = after
        for field in ['id', 'ipAddress', 'publicIPAllocationMethod', 'sku', 'ipConfiguration', 'idleTimeoutInMinutes', 'tags']:
            if before.get(field) != after.get(field):
                raise RuntimeError('NON_DNS_PROPERTY_CHANGED')
        dns = after.get('dnsSettings') or {}
        if args.apply and (dns.get('domainNameLabel') != LABEL or not dns.get('fqdn')):
            raise RuntimeError('DNS_READBACK_FAILED')
        evidence['fqdn'] = dns.get('fqdn')
        evidence['status'] = 'PASS' if dns.get('domainNameLabel') == LABEL else 'NOT VERIFIED'
    except Exception as error:
        evidence['status'] = 'FAIL'
        evidence['reason'] = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    evidence['elapsedSeconds'] = round(time.monotonic() - started, 3)
    folder = ROOT / 'artifacts/azure' / ('web-dns-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
    folder.mkdir(parents=True, exist_ok=False)
    (folder / 'result.json').write_text(json.dumps(evidence, indent=2), encoding='utf-8')
    print(json.dumps(dict(status=evidence['status'], fqdn=evidence.get('fqdn'), reason=evidence.get('reason'),
                          applied=evidence['applied'], evidence=str(folder / 'result.json'))))
    return 0 if evidence['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
