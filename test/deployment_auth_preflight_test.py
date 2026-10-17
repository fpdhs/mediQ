import importlib.util
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('auth_preflight_test_subject', ROOT/'scripts/deployment-auth-preflight.py')
subject = importlib.util.module_from_spec(spec)
spec.loader.exec_module(subject)

class AuthPreflightTests(unittest.TestCase):
    def probe(self, role, host='highpass-cloud', user='highpassadmin', uid=0, mac=None):
        client = mock.Mock()
        with mock.patch.object(subject.runtime, 'connect', return_value=client), mock.patch.object(subject.runtime.ops, 'run', return_value=(0, host+'\n'+user+'\n')), mock.patch.object(subject.runtime, 'remote', return_value={'host':host,'sudoUid':uid,'mac':mac}):
            result = subject.verify(role, 'not-a-real-credential' if role=='B' else None)
        client.close.assert_called_once()
        return result

    def test_control_current_host_and_sudo(self):
        self.assertEqual(self.probe('CLOUD')['status'], 'PASS')
        self.assertFalse(self.probe('CLOUD')['deployed'])

    def test_wrong_host_user_or_sudo_does_not_pass(self):
        for change in [{'host':'other'}, {'user':'other'}, {'uid':1}]:
            self.assertEqual(self.probe('CLOUD', **change)['status'], 'NOT VERIFIED')

    def test_b_host_mac_and_os_user(self):
        self.assertEqual(self.probe('B', host='b-vm', user='server', mac='00:0c:29:a3:9e:1b')['status'], 'PASS')
        self.assertEqual(self.probe('B', host='b-vm', user='server', mac='other')['status'], 'NOT VERIFIED')

    def test_secret_exception_details_never_reported(self):
        with mock.patch.object(subject.runtime, 'connect', side_effect=RuntimeError('secret marker should not be returned')):
            result = subject.verify('B', 'not-a-real-credential')
        self.assertEqual(result['status'], 'NOT VERIFIED')
        self.assertNotIn('secret marker', str(result))

    def test_gui_cancel_prevents_connect(self):
        with mock.patch.object(subject.runtime, 'ROOT', ROOT), mock.patch.object(subject.runtime.getpass, 'getpass', return_value=''):
            with self.assertRaises(SystemExit):
                subject.runtime.read_vm_credential(False)

if __name__ == '__main__':
    unittest.main()
