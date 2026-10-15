import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('focus_rollout', ROOT / 'scripts/patient-focus-b-rollout.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class FocusRolloutTest(unittest.TestCase):
    def test_exact_context(self):
        stage = '/home/server/.highpass-app-2026-10-08T21-31-00.357148+00-00'
        labels = {'com.docker.compose.project': 'hp-capstone-b-portal', 'com.docker.compose.project.working_dir': stage,
                  'com.docker.compose.project.config_files': ','.join(stage + '/' + name for name in ['portal.yml', 'encryption.yml', 'patient.yml'])}
        self.assertEqual(module.validated_context(labels)[0], stage)
        for key, value in [('com.docker.compose.project','hp-capstone-a-gateway'),('com.docker.compose.project.working_dir','/tmp/other'),('com.docker.compose.project.config_files',stage+'/portal.yml')]:
            altered = dict(labels);altered[key]=value
            with self.assertRaises(ValueError):module.validated_context(altered)

    def test_only_portal_image_changes(self):
        baseline={'services':{'portal':{'image':module.BASE,'environment':{'fixed':'yes'}}}}
        candidate=copy.deepcopy(baseline);candidate['services']['portal']['image']=module.CANDIDATE
        module.image_only(baseline,candidate)
        self.assertEqual(candidate['services']['portal']['image'],module.CANDIDATE)
        candidate['services']['portal']['environment']['fixed']='no'
        with self.assertRaises(ValueError):module.image_only(baseline,candidate)
        candidate=copy.deepcopy(baseline)
        with self.assertRaises(ValueError):module.image_only(baseline,candidate)

    def test_finite_remote_and_real_rollback(self):
        program=module.promotion_program('PUBLIC_CA','00:00:00:00:00:00')
        compile(program,'remote','exec')
        self.assertIn("phase='ROLLBACK';activate(BASE)",program)
        self.assertIn("phase='REACTIVATION';final=activate(CANDIDATE)",program)
        self.assertIn('ssl.create_default_context(cadata=CA)',program)
        self.assertIn("'--no-deps','--pull','never'",program)
        self.assertIn('timeout=45',program)
        self.assertNotIn('down',program)


if __name__=='__main__':unittest.main()
