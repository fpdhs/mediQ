"""Active-source upgrades must preserve source credentials and all other settings."""
import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


plan = load('upgrade_plan', 'scripts/lib/hcc_source_deployment.py')
IMAGE = 'sha256:' + 'c' * 64


class SourceUpgrade(unittest.TestCase):
    def config(self, role):
        source = role == 'gateway'
        env = ({'HCC_SOURCE_SERVICE_TOKEN_FILE': plan.SECRET_TARGET,
                'HCC_SOURCE_MANIFEST_FILE': '/run/hcc-source/manifest.json'} if source else
               {'HIPASS_CAPSTONE_HCC_CATALOG': '1', 'HIPASS_HCC_SOURCE_GATEWAY_TOKEN_FILE': plan.SECRET_TARGET,
                'HIPASS_CAPSTONE_SINGLE_WRITER': '1', 'HIPASS_DATA_PLANE_SOURCE_HOSPITAL_ID': 'HOSP-A'})
        env['ENCRYPTION_REQUIRED'] = '1'
        binds = [(plan.A_SECRET, plan.SECRET_TARGET), (plan.A_MANIFEST, '/run/hcc-source/manifest.json')] if source else [(plan.SECRET_SOURCE, plan.SECRET_TARGET)]
        old = {'services': {role: {'image': plan.A_SOURCE_BASE if source else plan.CONTROL_SOURCE_BASE,
                                  'environment': env, 'volumes': [
                {'type': 'bind', 'source': s, 'target': t, 'read_only': True, 'bind': {'create_host_path': False}}
                for s, t in binds]}, 'ingress': {'image': plan.SOURCE_INGRESS}},
               'networks': {'private': {'internal': True}}}
        new = copy.deepcopy(old)
        new['services'][role]['image'] = IMAGE
        return old, new

    def test_image_only_change_preserves_inputs(self):
        for role in ['gateway', 'control']:
            old, new = self.config(role)
            saved = copy.deepcopy((old, new))
            plan.source_image_upgrade_config(old, new, role, IMAGE)
            self.assertEqual((old, new), saved)

    def test_candidate_security_and_protected_service_changes_rejected(self):
        for role in ['gateway', 'control']:
            for change in [lambda x: x['services'][role]['environment'].update(ENCRYPTION_REQUIRED='0'),
                           lambda x: x['services'][role]['volumes'].clear(),
                           lambda x: x['services'][role]['volumes'][0].update(read_only=False),
                           lambda x: x['services']['ingress'].update(image=IMAGE),
                           lambda x: x['networks']['private'].update(internal=False),
                           lambda x: x['services'][role].update(ports=['0.0.0.0:1234:1234'])]:
                with self.subTest(role=role, change=change):
                    old, new = self.config(role)
                    change(new)
                    with self.assertRaises(ValueError):
                        plan.source_image_upgrade_config(old, new, role, IMAGE)

    def test_matching_but_unsafe_source_baseline_rejected(self):
        for role in ['gateway', 'control']:
            for change in [lambda x: x['services'][role]['environment'].clear(),
                           lambda x: x['services'][role]['volumes'].clear(),
                           lambda x: x['services'][role]['volumes'][0].update(read_only=False),
                           lambda x: x['services'][role]['volumes'][0]['bind'].update(create_host_path=True)]:
                old, _ = self.config(role)
                change(old)
                new = copy.deepcopy(old)
                new['services'][role]['image'] = IMAGE
                with self.assertRaises(ValueError):
                    plan.source_image_upgrade_config(old, new, role, IMAGE)

    def test_wrong_baseline_noop_or_wrong_role_rejected(self):
        for role in ['gateway', 'control']:
            old, new = self.config(role)
            with self.assertRaises(ValueError):
                plan.source_image_upgrade_config(old, new, role, old['services'][role]['image'])
            old['services'][role]['image'] = plan.A_BASE
            with self.assertRaises(ValueError):
                plan.source_image_upgrade_config(old, new, role, IMAGE)
        with self.assertRaises(ValueError):
            plan.source_image_upgrade_config({}, {}, 'postgres', IMAGE)

    def test_main_profile_and_changed_source_ingress_rejected(self):
        for change in [lambda x: x['services']['control']['environment'].update(HIPASS_CAPSTONE_MAIN_SCENARIO='HCC'),
                       lambda x: x['services']['ingress'].update(image=plan.INGRESS_BASE)]:
            old, _ = self.config('control')
            change(old)
            new = copy.deepcopy(old)
            new['services']['control']['image'] = IMAGE
            with self.assertRaises(ValueError):
                plan.source_image_upgrade_config(old, new, 'control', IMAGE)

    def test_source_context_requires_explicit_mode_and_exact_files(self):
        for role in ['gateway', 'control', 'ingress']:
            is_a = role == 'gateway'
            stage = '/home/' + ('server' if is_a else 'highpassadmin') + '/.highpass-app-2026-10-08T21-31-00.357148+00-00'
            names = (['gateway.yml', 'encryption.yml', 'patient.yml'] if is_a else plan.NAMES) + [plan.SOURCE_OVERLAY]
            labels = {'com.docker.compose.project': 'hp-capstone-a-gateway' if is_a else 'hp-capstone-control',
                      'com.docker.compose.project.working_dir': stage,
                      'com.docker.compose.project.config_files': ','.join(stage + '/' + n for n in names)}
            fn = plan.a_context if is_a else plan.context
            kwargs = {} if is_a else {'ingress': role == 'ingress'}
            self.assertEqual(fn(labels, source_enabled=True, **kwargs)[1], [stage + '/' + n for n in names])
            with self.assertRaises(ValueError):
                fn(labels, **kwargs)
            labels['com.docker.compose.project.config_files'] += ',' + stage + '/unknown.yml'
            with self.assertRaises(ValueError):
                fn(labels, source_enabled=True, **kwargs)

    def test_generated_preflights_compile_and_remain_read_only(self):
        for role in ['a', 'cloud']:
            module = load('upgrade_' + role, 'scripts/hcc-source-' + role + '-preflight.py')
            for mode in [False, True]:
                program = module.remote_program(IMAGE, '00:00:00:00:00:00' if role == 'a' else plan.SOURCE_INGRESS, mode)
                compile(program, '<remote>', 'exec')
                for forbidden in ['write_text(', 'write_bytes(', 'chmod(', "'up'", "'down'", 'os.open(']:
                    self.assertNotIn(forbidden, program)

    def test_upgrade_adapter_rollback_retains_all_active_source_files(self):
        for role in ['a', 'cloud']:
            module = load('upgrade_rollout_' + role, 'scripts/hcc-source-' + role + '-rollout.py')
            service = 'gateway' if role == 'a' else 'control'
            program = (module.remote_program({}, IMAGE, 'f' * 64, '00:00:00:00:00:00', True) if role == 'a'
                       else module.remote_program({}, {'control': IMAGE, 'ingress': plan.SOURCE_INGRESS}, 'PUBLIC_CA', True))
            compile(program, '<upgrade-remote>', 'exec')
            prefix = program.split('result=promotion_sequence(Adapter()', 1)[0] if role == 'a' else program.split('adapter=Adapter();', 1)[0]
            namespace = {}
            exec(prefix, namespace)
            calls = []
            namespace['run'] = lambda args, **kw: calls.append(args)
            adapter = namespace['Adapter']()
            adapter.stage = '/owned'
            adapter.files = ['/owned/base.yml', '/owned/' + plan.SOURCE_OVERLAY]
            adapter.ingress_files = list(adapter.files)
            adapter.overlay = '/owned/image-upgrade.yml'
            adapter.env = {}
            for profile in ['candidate', 'baseline', 'candidate']:
                adapter.activate(service, profile)
            for call in calls:
                self.assertIn('/owned/' + plan.SOURCE_OVERLAY, call)
                self.assertEqual(call[-1], service)
                self.assertIn('--no-deps', call)
            self.assertIn(adapter.overlay, calls[0])
            self.assertNotIn(adapter.overlay, calls[1])
            self.assertIn(adapter.overlay, calls[2])
            if role == 'cloud':
                with self.assertRaises(AssertionError):
                    adapter.activate('ingress', 'candidate')

    def test_single_control_failure_rolls_back_only_control(self):
        guard = load('upgrade_guard', 'scripts/lib/hcc_source_rollout.py')
        class Adapter:
            def __init__(self, failure): self.failure, self.calls = failure, []
            def step(self, value):
                self.calls.append(value)
                if len(self.calls) == self.failure: raise RuntimeError('fixture')
            def preflight(self): self.step('preflight')
            def activate(self, role, profile): self.step(role + ':' + profile)
            def verify(self, profile): self.step('verify:' + profile)
        for stage in range(1, 8):
            adapter = Adapter(stage)
            result = guard.promotion_sequence(adapter, roles=('control',))
            if stage == 1:
                self.assertEqual(adapter.calls, ['preflight'])
                self.assertEqual(result['status'], 'NOT VERIFIED')
            else:
                self.assertEqual(adapter.calls[-2:], ['control:baseline', 'verify:baseline'])
                self.assertEqual(result['rollback'], 'PASS')

    def test_upgrade_image_supply_is_explicit_and_never_restarts(self):
        assets = load('upgrade_assets', 'scripts/hcc-source-image-assets.py')
        for role in ['a', 'cloud']:
            home = '/home/server' if role == 'a' else '/home/highpassadmin'
            for mode in [False, True]:
                program = assets.remote_program(role, [], home + '/.highpass-hcc-images-' + 'a' * 32, 1000, mode)
                compile(program, '<image-supply>', 'exec')
                self.assertIn('SOURCE_UPGRADE=' + str(mode), program)
                self.assertIn('assert identity()==before', program)
                self.assertNotIn("'up'", program)
                self.assertNotIn("'down'", program)


if __name__ == '__main__':
    unittest.main()
