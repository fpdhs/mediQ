"""Focused offline safety tests; never invokes cryptsetup/Azure/SSH."""
import base64
import importlib.util
import pathlib
import stat
import tempfile
import unittest
from unittest.mock import patch, Mock
from types import SimpleNamespace

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('b_storage_guest', ROOT/'scripts/b-pacs-storage-guest.py')
guest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guest)


def manifest():
    return dict(schema='HIGHPASS_B_STORAGE_V1',role='B',sizeBytes=guest.SIZE,
        backingFile=str(guest.BACKING),mount=str(guest.MOUNT),mapping=guest.MAPPING,
        keyId=guest.KEY_BASE+'/'+'a'*32,luksUuid='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        wrappedKey=base64.urlsafe_b64encode(b'x'*256).decode().rstrip('='))


class StorageSafety(unittest.TestCase):
    def test_valid_exact_b_binding(self):
        self.assertEqual(guest.validate_manifest(manifest())['sizeBytes'],8589934592)

    def test_wrong_bindings_rejected(self):
        for field,value in [('role','A'),('sizeBytes',700),('mount','/'),('backingFile','/dev/sda2'),
                            ('mapping','user-disk'),('keyId',guest.KEY_BASE),('luksUuid','not-a-uuid'),
                            ('wrappedKey','?'+manifest()['wrappedKey'][1:])]:
            with self.subTest(field=field),self.assertRaises((ValueError,KeyError)):
                guest.validate_manifest({**manifest(),field:value})

    def test_image_kek_rejected(self):
        with self.assertRaises(ValueError):
            guest.validate_manifest({**manifest(),'keyId':guest.KEY_BASE.replace('highpass-b-storage-kek-20261013','capstone-b-kek-20261009')+'/'+'a'*32})

    def test_orthanc_data_directory_requires_private_owner_and_same_encrypted_filesystem(self):
        mount=SimpleNamespace(st_dev=77)
        directory=SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_dev=77,st_uid=10001,st_gid=10001)
        guest.validate_orthanc_storage(mount,directory)
        invalid=[
            (SimpleNamespace(**{**directory.__dict__,'st_dev':78}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_uid':0}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_gid':0}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFDIR|0o777}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFLNK|0o777}),True),
        ]
        for candidate,is_symlink in invalid:
            with self.subTest(candidate=candidate,is_symlink=is_symlink),self.assertRaisesRegex(ValueError,'ORTHANC_ENCRYPTED_DATA_DIRECTORY_INVALID'):
                guest.validate_orthanc_storage(mount,candidate,is_symlink)

    def test_orthanc_storage_is_created_only_after_mount_and_chowned_to_service_uid(self):
        with tempfile.TemporaryDirectory() as temporary:
            mount=pathlib.Path(temporary)
            data=mount/'orthanc-db'
            with patch.object(guest,'MOUNT',mount),patch.object(guest,'ORTHANC_STORAGE',data),\
                 patch.object(guest.os.path,'ismount',return_value=True),patch.object(guest,'set_orthanc_storage_owner') as chown,\
                 patch.object(guest.os,'chmod') as chmod,patch.object(guest,'validate_orthanc_storage') as validate:
                guest.ensure_orthanc_storage()
                self.assertTrue(data.is_dir())
                chmod.assert_called_once_with(data,0o700)
                chown.assert_called_once_with(data)
                validate.assert_called_once()

    def test_orthanc_storage_is_not_created_without_verified_mount(self):
        with tempfile.TemporaryDirectory() as temporary:
            mount=pathlib.Path(temporary)
            data=mount/'orthanc-db'
            with patch.object(guest,'MOUNT',mount),patch.object(guest,'ORTHANC_STORAGE',data),\
                 patch.object(guest.os.path,'ismount',return_value=False):
                with self.assertRaisesRegex(ValueError,'PACS_ENCRYPTED_MOUNT_REQUIRED'):
                    guest.ensure_orthanc_storage()
            self.assertFalse(data.exists())

    def test_existing_target_preserved_before_key_or_commands(self):
        with patch.object(guest,'DIRECTORY') as directory,patch.object(guest,'run') as command,patch.object(guest,'required_vault') as vault:
            directory.exists.return_value=True
            with self.assertRaisesRegex(ValueError,'EXISTING_TARGET_PRESERVED'):
                guest.create('not-a-real-token',manifest()['keyId'])
            command.assert_not_called()
            vault.assert_not_called()

    def test_scope_guard_before_network(self):
        with patch.object(guest,'PrivateVaultConnection') as connection:
            for url in ['https://evil.example/keys/x',guest.KEY_BASE+'/delete',guest.KEY_BASE+'/a'*32+'/unwrapkey']:
                with self.assertRaises(ValueError):
                    guest.vault('not-a-real-token',url,{})
            connection.assert_not_called()

    def test_unwrap_must_match_version(self):
        with patch.object(guest,'required_vault',return_value={'kid':'different','value':base64.urlsafe_b64encode(b'x'*32).decode()}):
            with self.assertRaisesRegex(ValueError,'VERSION_MISMATCH'):
                guest.unwrap('not-a-real-token',manifest())

    def test_unwrap_size_rejected(self):
        with patch.object(guest,'required_vault',return_value={'kid':manifest()['keyId'],'value':base64.urlsafe_b64encode(b'x').decode()}):
            with self.assertRaisesRegex(ValueError,'SIZE_INVALID'):
                guest.unwrap('not-a-real-token',manifest())

    def test_successful_unwrap_memory_only(self):
        with patch.object(guest,'required_vault',return_value={'kid':manifest()['keyId'],'value':base64.urlsafe_b64encode(b'x'*32).decode()}):
            key=guest.unwrap('not-a-real-token',manifest())
            self.assertIsInstance(key,bytearray)
            key[:]=b'\0'*len(key)

    def test_key_denial_propagates_no_fallback(self):
        with patch.object(guest,'required_vault',side_effect=RuntimeError('KEY_VAULT_HTTP_403')):
            with self.assertRaises(RuntimeError):guest.unwrap('not-a-real-token',manifest())

    def test_key_precheck_tests_existing_header_without_mapping_and_clears_key(self):
        import json
        key=bytearray(b'x'*32)
        with patch.object(guest,'secure_file'),patch.object(guest,'MANIFEST') as file,\
             patch.object(guest,'BACKING') as backing,patch.object(guest,'run',side_effect=[manifest()['luksUuid'],'']) as command,\
             patch.object(guest,'unwrap',return_value=key),patch.object(guest.subprocess,'run',return_value=SimpleNamespace(returncode=2)):
            file.read_text.return_value=json.dumps(manifest())
            backing.stat.return_value=SimpleNamespace(st_size=guest.SIZE)
            result=guest.verify_key('not-a-real-token')
            self.assertTrue(result['wrongKeyDenied'])
            self.assertIn('--test-passphrase',command.call_args_list[1].args[0])
            self.assertEqual(key,bytearray(32))

    def test_key_precheck_rejects_success_with_wrong_key(self):
        import json
        key=bytearray(b'x'*32)
        with patch.object(guest,'secure_file'),patch.object(guest,'MANIFEST') as file,\
             patch.object(guest,'BACKING') as backing,patch.object(guest,'run',side_effect=[manifest()['luksUuid'],'']),\
             patch.object(guest,'unwrap',return_value=key),patch.object(guest.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
            file.read_text.return_value=json.dumps(manifest())
            backing.stat.return_value=SimpleNamespace(st_size=guest.SIZE)
            with self.assertRaisesRegex(ValueError,'WRONG_STORAGE_KEY_DENIAL_NOT_VERIFIED'):
                guest.verify_key('not-a-real-token')
            self.assertEqual(key,bytearray(32))

    def test_lock_refuses_unmounted_target_before_commands(self):
        with patch.object(guest,'secure_file'),patch.object(guest,'MANIFEST') as file,patch.object(guest.os.path,'ismount',return_value=False),patch.object(guest,'run') as command:
            import json
            file.read_text.return_value=json.dumps(manifest())
            with self.assertRaisesRegex(ValueError,'OWNED_MOUNT_REQUIRED'):guest.lock()
            command.assert_not_called()

    def test_recovery_does_not_format_or_generate_key(self):
        import inspect
        source=inspect.getsource(guest.recover)
        self.assertNotIn('mkfs',source)
        self.assertNotIn('luksFormat',source)
        self.assertNotIn('urandom',source)

    def test_no_physical_disk_format_or_raw_key_file(self):
        source=(ROOT/'scripts/b-pacs-storage-guest.py').read_text()
        self.assertNotIn('/dev/sda',source)
        self.assertIn("'--key-file', '-'",source)
        self.assertNotIn('key.hex()',source)
        self.assertNotIn('key.write',source)


if __name__=='__main__':unittest.main()
