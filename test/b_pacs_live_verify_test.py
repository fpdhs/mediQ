import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('live_verify', ROOT / 'scripts/b-pacs-live-verify.py')
live = importlib.util.module_from_spec(spec)
spec.loader.exec_module(live)


class LiveVerificationGuards(unittest.TestCase):
    def setUp(self):
        self.prepared = {'portalBaseline': {'id': 'portal', 'imageId': 'pinned', 'health': 'healthy'},
                         'containers': [{'service': 'orthanc', 'imageId': 'image1'},
                                        {'service': 'mtls', 'imageId': 'image2'}]}
        self.snapshot = {'portal': self.prepared['portalBaseline'].copy(), 'mounted': True,
                         'mappingPresent': True, 'probeHash': 'expected', 'busyContainers': [],
                         'receivers': [{**row, 'publishedPorts': False, 'running': False}
                                       for row in self.prepared['containers']]}

    def test_stopped_owned_baseline_passes(self):
        live.validate_baseline(self.snapshot, self.prepared, 'expected')

    def test_lock_refuses_running_or_busy_storage(self):
        for mutation in ['running', 'busy']:
            snapshot = copy.deepcopy(self.snapshot)
            if mutation == 'running': snapshot['receivers'][0]['running'] = True
            else: snapshot['busyContainers'] = ['unrelated']
            with self.subTest(mutation=mutation), self.assertRaises(RuntimeError):
                live.validate_baseline(snapshot, self.prepared, 'expected')

    def test_live_result_requires_both_receivers_running(self):
        with self.assertRaisesRegex(RuntimeError, 'RUNNING_PRIVATE_RECEIVER_REQUIRED'):
            live.validate_baseline(self.snapshot, self.prepared, 'expected', stopped=False)
        for row in self.snapshot['receivers']: row['running'] = True
        live.validate_baseline(self.snapshot, self.prepared, 'expected', stopped=False)

    def test_identity_hash_ports_and_portal_changes_fail_closed(self):
        for mutation in ['imageId', 'probeHash', 'publishedPorts', 'portal']:
            snapshot = copy.deepcopy(self.snapshot)
            if mutation == 'imageId': snapshot['receivers'][0]['imageId'] = 'changed'
            elif mutation == 'probeHash': snapshot['probeHash'] = 'changed'
            elif mutation == 'publishedPorts': snapshot['receivers'][0]['publishedPorts'] = True
            else: snapshot['portal']['health'] = 'unhealthy'
            with self.subTest(mutation=mutation), self.assertRaises(RuntimeError):
                live.validate_baseline(snapshot, self.prepared, 'expected')

    def test_remote_programs_compile(self):
        compile(live.SNAPSHOT, 'snapshot', 'exec')
        compile(live.SMOKE, 'smoke', 'exec')


if __name__ == '__main__': unittest.main()
