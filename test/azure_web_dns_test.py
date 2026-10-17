"""DNS operator contract checks; not TLS or browser validation."""
import ast
import pathlib
import unittest


class DnsSafety(unittest.TestCase):
    def test_exact_dns_only_update(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/azure-web-dns.py').read_text()
        ast.parse(source)
        self.assertIn("LABEL = 'highpass-demo'", source)
        self.assertIn("'network', 'public-ip', 'update'", source)
        self.assertIn("'--dns-name', LABEL, '--subscription', SUB", source)
        for forbidden in ['--allocation-method', 'networkSecurityGroups', 'docker', 'iptables', 'get-access-token']:
            self.assertNotIn(forbidden, source)

    def test_preserves_existing_dns_and_baseline(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/azure-web-dns.py').read_text()
        for guard in ['EXISTING_DNS_PRESERVED', 'CONCURRENT_PUBLIC_IP_CHANGE',
                      'NON_DNS_PROPERTY_CHANGED', 'DNS_READBACK_FAILED', 'ACCOUNT_MISMATCH']:
            self.assertIn(guard, source)
        self.assertIn("parser.add_argument('--apply', action='store_true')", source)


if __name__ == '__main__':
    unittest.main()
