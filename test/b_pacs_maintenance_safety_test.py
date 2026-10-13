import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('receiver_launch_guard',ROOT/'scripts/b-pacs-receiver-start.py')
guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)

class MaintenanceSafety(unittest.TestCase):
    def test_exact_encrypted_boundary(self):
        m={'luksUuid':'627df927-a317-4950-88d1-3293a3b261b0'}
        guard.validate_boundary(m,guard.DEVICE,'CRYPT-LUKS2-'+m['luksUuid'].replace('-','')+'-highpass-b-pacs',guard.BACKING,True)

    def test_missing_mount_plain_other_volume_and_uuid_refused(self):
        m={'luksUuid':'627df927-a317-4950-88d1-3293a3b261b0'}
        uuid='CRYPT-LUKS2-'+m['luksUuid'].replace('-','')+'-highpass-b-pacs'
        for source,dm,backing,mounted in [(guard.DEVICE,uuid,guard.BACKING,False),('/dev/sda2',uuid,guard.BACKING,True),(guard.DEVICE,'CRYPT-LUKS2-'+'a'*32+'-highpass-b-pacs',guard.BACKING,True),(guard.DEVICE,uuid,'/opt/unrelated.luks',True)]:
            with self.subTest(source=source,dm=dm,backing=backing,mounted=mounted),self.assertRaises(RuntimeError):guard.validate_boundary(m,source,dm,backing,mounted)

    def test_receiver_has_no_auto_restart(self):
        source=(ROOT/'infra/workstation/hospital-b-pacs-receiver.compose.yml').read_text()
        self.assertNotIn('unless-stopped',source)
        self.assertEqual(source.count("restart: 'no'"),2)

    def test_launcher_never_formats_or_unlocks(self):
        source=(ROOT/'scripts/b-pacs-receiver-start.py').read_text()
        for forbidden in ['luksFormat','mkfs','luksOpen','--privileged','--force']:self.assertNotIn(forbidden,source)

if __name__=='__main__':unittest.main()
