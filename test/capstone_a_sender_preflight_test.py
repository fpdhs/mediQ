import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("a_sender_preflight", ROOT / "scripts/capstone-a-sender-preflight.py")
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


def container(name, *, running=True, health="healthy", ports=None, networks=None, policy=None):
    return {"name": name, "running": running, "health": health, "publishedPorts": ports or {},
            "networks": networks or [], "policy": policy or {}}


class SenderPreflightTests(unittest.TestCase):
    def test_a_and_b_vm_credentials_are_requested_separately(self):
        prompts = []

        def prompt(role):
            prompts.append(role)
            return role + "-only-secret"

        credentials = preflight.collect_vm_credentials(gui=True, gui_prompt=prompt)
        self.assertEqual(prompts, ["A", "B"])
        self.assertEqual(credentials, {"A": "A-only-secret", "B": "B-only-secret"})
        credentials.clear()

    def test_cancel_on_second_vm_does_not_return_partial_credentials(self):
        prompts = []

        def prompt(role):
            prompts.append(role)
            return "A-only-secret" if role == "A" else None

        with self.assertRaisesRegex(SystemExit, "B_CREDENTIAL_INPUT_CANCELLED"):
            preflight.collect_vm_credentials(gui=True, gui_prompt=prompt)
        self.assertEqual(prompts, ["A", "B"])

    def test_embedded_read_only_vm_probes_are_valid_python(self):
        compile(preflight.A_INVENTORY, "a_inventory_probe", "exec")
        compile(preflight.B_TLS_PROBE, "b_tls_probe", "exec")

    def baseline(self):
        return [
            container("hp-capstone-a-gateway-gateway-1", ports={"8443/tcp": [{"hostIp": "10.90.88.2", "hostPort": "9443"}]},
                      networks=["hp-capstone-hospital-a_pacs_private", "hp-capstone-a-gateway_gateway_transport"],
                      policy={"imageEncryptionRequired": True, "orthancHttps": True, "orthancServerName": True, "versionPinnedKeyId": True}),
            container("hp-capstone-hospital-a-orthanc-1", networks=["hp-capstone-hospital-a_pacs_private"]),
            container("hp-capstone-hospital-a-orthanc-mtls-1", ports={"8443/tcp": [{"hostIp": "127.0.0.1", "hostPort": "18443"}]},
                      networks=["hp-capstone-hospital-a_pacs_private"]),
        ]

    def test_healthy_private_sender_baseline_passes_but_does_not_claim_transfer(self):
        result = preflight.classify_inventory(self.baseline())
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(result["authorizedImportRuntime"], "NOT VERIFIED")
        self.assertEqual(result["keyVaultWrap"], "NOT VERIFIED")
        self.assertEqual(result["sourcePacsMtlsRequest"], "NOT VERIFIED")

    def test_missing_or_unhealthy_container_fails_closed(self):
        result = preflight.classify_inventory(self.baseline()[:2])
        self.assertEqual(result["status"], "NOT VERIFIED")
        result = preflight.classify_inventory([self.baseline()[0], self.baseline()[1],
                                              container("hp-capstone-hospital-a-orthanc-mtls-1", health="unhealthy")])
        self.assertEqual(result["status"], "FAIL")

    def test_public_gateway_binding_or_missing_encryption_denies_readiness(self):
        rows = self.baseline()
        rows[0]["publishedPorts"]["8443/tcp"][0]["hostIp"] = "0.0.0.0"
        rows[0]["policy"]["imageEncryptionRequired"] = False
        result = preflight.classify_inventory(rows)
        self.assertEqual(result["status"], "FAIL")
        self.assertTrue(all(check["status"] == "PASS" for check in result["checks"] if check["test"] not in {
            "A_GATEWAY_ENCRYPTION_AND_UPSTREAM_MTLS_CONFIG", "A_GATEWAY_BOUND_ONLY_TO_PRIVATE_TRANSPORT"}))

    def test_raw_pacs_publication_or_writable_gateway_secret_mount_fails(self):
        rows = self.baseline()
        rows[1]["publishedPorts"] = {"8042/tcp": [{"hostIp": "0.0.0.0", "hostPort": "8042"}]}
        rows[0]["mounts"] = [{"destination": "/run/secrets/ca.crt", "readOnly": False}]
        result = preflight.classify_inventory(rows)
        failed = {check["test"] for check in result["checks"] if check["status"] == "FAIL"}
        self.assertIn("A_RAW_ORTHANC_HAS_NO_PUBLISHED_PORT", failed)
        self.assertIn("A_GATEWAY_AND_MTLS_SECRET_MOUNTS_READ_ONLY", failed)


if __name__ == "__main__":
    unittest.main()
