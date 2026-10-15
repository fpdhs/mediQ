"""Pure preflight boundaries; no SSH, Docker, credentials, or deployment."""
import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('plan', pathlib.Path(__file__).resolve().parents[1] / 'scripts/patient-ingress-plan-preflight.py')
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)


class PatientIngressPlanTests(unittest.TestCase):
    def setUp(self):
        self.stage = '/home/highpassadmin/.highpass-app-2026-10-08T19-03-15.237525+00-00'
        self.labels = {'com.docker.compose.project': 'hp-capstone-control',
                       'com.docker.compose.project.working_dir': self.stage,
                       'com.docker.compose.project.config_files': ','.join(self.stage + '/' + n for n in plan.FILES)}
        self.baseline = {'services': {'ingress': {'image': plan.CURRENT, 'environment': {'SECRET_FILE': '/run/secrets/ingress-secret'}, 'volumes': ['readonly']},
                                     'control': {'image': plan.CURRENT}, 'postgres': {'image': plan.PG}}}
        self.candidate = copy.deepcopy(self.baseline)
        self.candidate['services']['ingress']['image'] = plan.CANDIDATE

    def test_exact_active_patient_context(self):
        self.assertEqual(plan.validated_patient_context(self.labels)[0], self.stage)

    def test_foreign_project_and_path_rejected(self):
        for key, value in [('com.docker.compose.project', 'other'), ('com.docker.compose.project.working_dir', self.stage + '/../other')]:
            with self.subTest(key=key), self.assertRaises(ValueError):
                plan.validated_patient_context({**self.labels, key: value})

    def test_missing_duplicate_reordered_and_foreign_files_rejected(self):
        files = self.labels['com.docker.compose.project.config_files'].split(',')
        for altered in [files[:-1], files + [files[-1]], list(reversed(files)), files[:-1] + ['/tmp/patient.yml']]:
            with self.subTest(files=altered), self.assertRaises(ValueError):
                plan.validated_patient_context({**self.labels, 'com.docker.compose.project.config_files': ','.join(altered)})

    def test_only_ingress_image_change_and_no_input_mutation(self):
        before = copy.deepcopy(self.candidate)
        plan.assert_ingress_only_config(self.baseline, self.candidate)
        self.assertEqual(self.candidate, before)

    def test_other_service_environment_and_mount_changes_rejected(self):
        for mutation in ['control', 'environment', 'volumes']:
            candidate = copy.deepcopy(self.candidate)
            if mutation == 'control':
                candidate['services']['control']['image'] = plan.CANDIDATE
            else:
                candidate['services']['ingress'][mutation] = []
            with self.subTest(mutation=mutation), self.assertRaises(ValueError):
                plan.assert_ingress_only_config(self.baseline, candidate)

    def test_unpinned_candidate_rejected(self):
        self.candidate['services']['ingress']['image'] = 'latest'
        with self.assertRaises(ValueError):
            plan.assert_ingress_only_config(self.baseline, self.candidate)

    def test_remote_program_compiles(self):
        compile(plan.remote_program(), '<remote-read-only-preflight>', 'exec')


if __name__ == '__main__':
    unittest.main()
