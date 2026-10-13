"""Offline boundary checks, not proof of Azure ingress or login."""
import ast
import pathlib
import unittest


class InventorySafety(unittest.TestCase):
    def test_azure_calls_are_read_only(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/azure-web-edge-inventory.py').read_text()
        tree = ast.parse(source)
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Attribute) and node.func.attr == 'azure']
        self.assertEqual(len(calls), 2)
        for operation in ['create', 'update', 'delete', 'apply', 'register', 'restart']:
            self.assertNotIn("'" + operation + "'", source)
        self.assertIn("'--subscription', SUB", source)
        self.assertIn("account['tenantId'] != identity.TENANT", source)

    def test_no_full_environment_or_credentials_in_evidence(self):
        source = (pathlib.Path(__file__).resolve().parents[1] / 'scripts/azure-web-edge-inventory.py').read_text()
        self.assertNotIn("get-access-token", source)
        self.assertIn("['AUTH_MODE','HIPASS_CONTROL_PLANE_ONLY','HIPASS_DPOP_REQUIRED']", source)
        self.assertNotIn("print(json.dumps(items", source)
        self.assertIn('client.close()', source)


if __name__ == '__main__':
    unittest.main()
