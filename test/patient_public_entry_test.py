"""Configuration regression; not a substitute for external TLS/network tests."""
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('entry_remote', ROOT / 'scripts/patient-public-entry-remote.py')
# pwd is Unix-only: inspect the source without importing it on the Windows operator.
SOURCE = (ROOT / 'scripts/patient-public-entry-remote.py').read_text(encoding='utf-8')
import ast
tree = ast.parse(SOURCE)
config_fn = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == 'caddyfile')
ns = {'HOST': 'highpass-images-b.japaneast.cloudapp.azure.com'}
exec(compile(ast.Module(body=[config_fn], type_ignores=[]), '<caddy-config>', 'exec'), ns)


class EntryConfigTests(unittest.TestCase):
    def test_production_ca_and_deny_default(self):
        text = ns['caddyfile'](True)
        self.assertIn('https://acme-v02.api.letsencrypt.org/directory', text)
        self.assertIn('PATIENT_IMAGE_ENTRY_NOT_ENABLED', text)
        self.assertIn('403', text)
        self.assertNotIn('reverse_proxy', text)

    def test_staging_is_explicit_and_separate(self):
        self.assertIn('https://acme-staging-v02.api.letsencrypt.org/directory', ns['caddyfile'](False))
        self.assertNotIn('acme-staging', ns['caddyfile'](True))

    def test_bind_tls_and_cache_boundary(self):
        text = ns['caddyfile'](True)
        for required in ['bind 10.90.88.3', 'https_port 9444', 'disable_http_challenge', 'Cache-Control "no-store"', 'admin off', 'protocols h1 h2']:
            self.assertIn(required, text)
        for forbidden in ['tls internal', 'on_demand', 'insecure_skip_verify']:
            self.assertNotIn(forbidden, text)

    def test_fixed_relay_and_owner_egress(self):
        for required in ['10.89.0.5:443', '10.90.88.3:9444', '--connections-max=64', 'HP-PVIEW-OUT', '--uid-owner', 'CapabilityBoundingSet=']:
            self.assertIn(required, SOURCE)

    def test_azure_preserves_primary_and_uses_specific_nsg_destination(self):
        text = (ROOT / 'scripts/patient-public-entry-azure.py').read_text(encoding='utf-8')
        self.assertIn("primary['privateIPAddress'] == '10.89.0.4'", text)
        self.assertIn("'--destination-address-prefixes', '10.89.0.5'", text)
        self.assertIn("'--destination-port-ranges', '443'", text)
        self.assertIn("int(x['currentValue']) < int(x['limit'])", text)


if __name__ == '__main__':
    unittest.main()
