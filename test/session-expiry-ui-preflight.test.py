import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('session_expiry_preflight_test', ROOT/'scripts/session-expiry-ui-preflight.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PreflightBoundary(unittest.TestCase):
    def labels(self):
        stage = '/home/server/.highpass-app-2026-10-09T20.00.00+00-00'
        return {'com.docker.compose.project': 'hp-capstone-b-portal',
                'com.docker.compose.project.working_dir': stage,
                'com.docker.compose.project.config_files': ','.join(stage+'/'+name for name in
                    ['portal.yml', 'encryption.yml', 'patient.yml', 'faq-expiry-reviewed-20261010.yml'])}

    def test_exact_four_files_and_b_role_only(self):
        self.assertEqual(len(module.context('B', self.labels())[2]), 4)
        for role, ingress in [('CLOUD', False), ('B', True)]:
            with self.assertRaises(ValueError): module.context(role, self.labels(), ingress)
        for change in ['removed', 'extra', 'reordered']:
            labels = self.labels(); files = labels['com.docker.compose.project.config_files'].split(',')
            files = files[:-1] if change == 'removed' else files+['unexpected.yml'] if change == 'extra' else list(reversed(files))
            labels['com.docker.compose.project.config_files'] = ','.join(files)
            with self.assertRaises(ValueError): module.context('B', labels)

    def test_exact_image_only_and_preserved_mounts(self):
        baseline = {'services': {'portal': {'image': module.BASE, 'volumes': ['protected:ro']}}}
        candidate = {'services': {'portal': {'image': module.CANDIDATE, 'volumes': ['protected:ro']}}}
        module.prior.image_only('B', baseline, candidate)
        candidate['services']['portal']['volumes'] = []
        with self.assertRaises(ValueError): module.prior.image_only('B', baseline, candidate)

    def test_generated_program_syntax_and_historical_pins_preserved(self):
        program = module.prior.remote_program('B', '00:0c:29:a3:9e:1b')
        compile(program, '<remote-session-expiry-preflight>', 'exec')
        self.assertIn(module.BASE, program); self.assertIn(module.CANDIDATE, program)
        self.assertIn('EXACT_FOUR_ACTIVE_B_FILES_REQUIRED', program)
        self.assertNotIn("['up'", program)
        original = (ROOT/'scripts/faq-expiry-deployment-preflight.py').read_text()
        self.assertIn("UI_BASE = 'sha256:27e1bd82", original)
        self.assertNotIn(module.CANDIDATE, original)


if __name__ == '__main__': unittest.main()
