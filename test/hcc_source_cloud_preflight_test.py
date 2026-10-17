import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_preflight', ROOT / 'scripts/hcc-source-cloud-preflight.py')
preflight = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preflight)


class ReadOnlyCloudProgram(unittest.TestCase):
    def program(self):
        return preflight.remote_program('sha256:' + 'a' * 64, 'sha256:' + 'b' * 64)

    def test_generated_program_compiles_and_preserves_exact_validator(self):
        program = self.program()
        compile(program, '<remote-read-only-preflight>', 'exec')
        self.assertIn('source_only_config(baseline,candidate,CONTROL,INGRESS)', program)
        self.assertIn("SOURCE_UPGRADE=False", program)
        self.assertIn("context(a['Config']['Labels'],source_enabled=SOURCE_UPGRADE)", program)
        self.assertIn("'contentsRead':False", program)

    def test_no_activation_or_credential_contents_in_program(self):
        program = self.program()
        for forbidden in ['docker login', 'docker load', 'docker pull', "'up'", "'down'", 'write_text(',
                          'write_bytes(', 'secret.read', 'unlink(', 'chmod(', 'chown(']:
            self.assertNotIn(forbidden, program)
        self.assertIn('timeout=20', program)

    def test_runtime_identity_ignores_health_log_ticks_not_config_or_health_status(self):
        prefix = self.program().split("try:\n assert run(['hostname'])", 1)[0]
        namespace = {}
        exec(prefix, namespace)
        item = {k: {} for k in ['Id','Image','Config','Mounts','HostConfig','NetworkSettings']}
        item['State'] = {'Running':True,'StartedAt':'fixed','Health':{'Status':'healthy','Log':['before']}}
        identity = namespace['runtime_identity']
        before = identity(item)
        item['State']['Health']['Log'] = ['after']
        self.assertEqual(before, identity(item))
        item['State']['Health']['Status'] = 'unhealthy'
        self.assertNotEqual(before, identity(item))


if __name__ == '__main__':unittest.main()
