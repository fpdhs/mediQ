import copy
import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location('hcc_deployment', pathlib.Path(__file__).resolve().parents[1] / 'scripts/lib/hcc_source_deployment.py')
plan = importlib.util.module_from_spec(spec); spec.loader.exec_module(plan)


class ExactSourceBoundary(unittest.TestCase):
    def configs(self):
        baseline = {'services': {'control': {'image': plan.CONTROL_BASE, 'environment': {
            'HIPASS_CAPSTONE_SINGLE_WRITER': '1', 'HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID': 'HOSP-A'}, 'volumes': []},
            'ingress': {'image': plan.INGRESS_BASE}, 'postgres': {'image': 'unchanged'}}, 'networks': {'private': {'internal': True}}}
        candidate = copy.deepcopy(baseline)
        candidate['services']['control']['image'] = 'sha256:' + 'a' * 64
        candidate['services']['ingress']['image'] = 'sha256:' + 'b' * 64
        candidate['services']['control']['environment'].update({'HIPASS_CAPSTONE_HCC_CATALOG': '1', 'HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE': plan.SECRET_TARGET})
        candidate['services']['control']['volumes'].append({'type': 'bind', 'source': plan.SECRET_SOURCE,
            'target': plan.SECRET_TARGET, 'read_only': True, 'bind': {'create_host_path': False}})
        return baseline, candidate

    def check(self, a, b):
        plan.source_only_config(a, b, 'sha256:' + 'a' * 64, 'sha256:' + 'b' * 64)

    def test_exact_two_role_source_delta(self):
        a, b = self.configs(); before = copy.deepcopy(b); self.check(a, b); self.assertEqual(b, before)

    def test_other_mutations_denied(self):
        for change in [lambda b: b['services']['postgres'].update(image='changed'),
                       lambda b: b['networks']['private'].update(internal=False),
                       lambda b: b['services']['control'].update(ports=['3000:3000']),
                       lambda b: b['services']['control']['environment'].update(HIPASS_CAPSTONE_MAIN_SCENARIO='HCC'),
                       lambda b: b['services']['control']['environment'].update(HIPASS_DPOP_REQUIRED='0'),
                       lambda b: b['services']['control']['volumes'][0].update(read_only=False),
                       lambda b: b['services']['control']['volumes'][0]['bind'].update(create_host_path=True)]:
            a, b = self.configs(); change(b)
            with self.assertRaises(ValueError): self.check(a, b)

    def test_single_writer_and_source_binding_required(self):
        for key, value in [('HIPASS_CAPSTONE_SINGLE_WRITER', '0'), ('HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID', 'HOSP-B')]:
            a, b = self.configs(); a['services']['control']['environment'][key] = value
            with self.assertRaises(ValueError): self.check(a, b)

    def test_current_contexts_exact_not_wildcards(self):
        stage = '/home/highpassadmin/.highpass-app-2026-10-08T19-03-15.237525+00-00'
        for ingress in [False, True]:
            names = plan.NAMES[:-1] if ingress else plan.NAMES
            labels = {'com.docker.compose.project': 'hp-capstone-control', 'com.docker.compose.project.working_dir': stage,
                      'com.docker.compose.project.config_files': ','.join(stage + '/' + n for n in names)}
            plan.context(labels, ingress)
            labels['com.docker.compose.project.config_files'] += ',' + stage + '/unknown.yml'
            with self.assertRaises(ValueError): plan.context(labels, ingress)


if __name__ == '__main__': unittest.main()
