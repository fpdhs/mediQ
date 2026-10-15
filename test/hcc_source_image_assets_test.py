import copy
import hashlib
import importlib.util
import io
import json
import pathlib
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch, MagicMock

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('image_assets', ROOT / 'scripts/hcc-source-image-assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


def fixture(directory, malicious=None, corrupt_blob=False):
    directory.mkdir(parents=True)
    data = {'status': 'PASS', 'images': [], 'exports': []}
    for role in ['a', 'control', 'ingress']:
        tag = 'highpass-platform-mvp:capstone-hcc-source-' + role + '-test'
        blobs = {}

        def blob(raw, media):
            digest = hashlib.sha256(raw).hexdigest()
            blobs['blobs/sha256/' + digest] = raw
            return {'digest': 'sha256:' + digest, 'size': len(raw), 'mediaType': media}

        config = blob(b'{"config":{"User":"65532"}}', 'application/vnd.oci.image.config.v1+json')
        layer = blob(b'nonclinical image layer fixture', 'application/vnd.oci.image.layer.v1.tar+gzip')
        descriptor = blob(json.dumps({'config': config, 'layers': [layer]}).encode(), 'application/vnd.oci.image.manifest.v1+json')
        blobs['index.json'] = json.dumps({'manifests': [descriptor]}).encode()
        blobs['manifest.json'] = json.dumps([{'RepoTags': [tag],
            'Config': 'blobs/sha256/' + config['digest'].split(':')[1],
            'Layers': ['blobs/sha256/' + layer['digest'].split(':')[1]]}]).encode()
        if malicious and role == 'a':
            blobs[malicious] = b'forbidden member'
        if corrupt_blob and role == 'a':
            blobs['blobs/sha256/' + config['digest'].split(':')[1]] = b'x' * config['size']
        target = directory / (role + '.tar')
        with tarfile.open(target, 'w') as archive:
            for name, raw in blobs.items():
                entry = tarfile.TarInfo(name); entry.size = len(raw)
                archive.addfile(entry, io.BytesIO(raw))
        data['images'].append({'role': role, 'image': tag, 'id': descriptor['digest'], 'sourceMatch': 'PASS'})
        data['exports'].append({'role': role, 'path': target.name, 'bytes': target.stat().st_size,
            'sha256': assets.file_hash(target), 'imageId': descriptor['digest'],
            'destination': 'HIGH_PASS_HOSPITAL_A' if role == 'a' else 'HIGH_PASS_CLOUD'})
    manifest = directory / 'manifest.json'
    manifest.write_text(json.dumps(data), encoding='utf8')
    return manifest, data


class ImageAssetBoundary(unittest.TestCase):
    def test_complete_three_role_archive_graph_passes_without_extraction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            manifest, data = fixture(root / 'artifacts/workstation/owned')
            with patch.object(assets, 'ROOT', root):
                self.assertEqual(assets.verify_archives(manifest), data)

    def test_destination_hash_and_role_mutations_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            manifest, data = fixture(root / 'artifacts/workstation/owned')
            for field, bad in [('destination', 'HIGH_PASS_HOSPITAL_B'), ('path', '../a.tar'),
                               ('sha256', '0'*64), ('imageId', 'sha256:'+'f'*64)]:
                changed = copy.deepcopy(data); changed['exports'][0][field] = bad
                manifest.write_text(json.dumps(changed), encoding='utf8')
                with patch.object(assets, 'ROOT', root), self.assertRaises(ValueError):
                    assets.verify_archives(manifest)

    def test_path_traversal_is_rejected_even_with_matching_outer_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            manifest, _ = fixture(root / 'artifacts/workstation/owned', '../escape')
            with patch.object(assets, 'ROOT', root), self.assertRaisesRegex(ValueError, 'UNSAFE_ARCHIVE_MEMBER'):
                assets.verify_archives(manifest)

    def test_apply_without_review_stops_before_archive_read_or_ssh(self):
        with patch('sys.argv', ['assets', '--apply', '--role', 'cloud', '--candidate-manifest', 'unused']), \
             patch.object(assets, 'verify_archives') as verify:
            with self.assertRaisesRegex(ValueError, 'EXACT_ASSET_REVIEW_REQUIRED'):
                assets.main()
            verify.assert_not_called()

    def test_new_draft_path_preserves_old_packet_and_cannot_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            manifest, _ = fixture(root / 'artifacts/workstation/owned')
            for name in ['scripts/hcc-source-image-assets.py', 'scripts/lib/hcc_source_rollout.py']:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_text('public review fixture', encoding='utf8')
            old = manifest.parent / 'image-asset-review-draft.json'
            old.write_text('historical packet', encoding='utf8')
            draft = manifest.parent / 'image-asset-review-draft-upload-v2.json'
            argv = ['assets', '--role', 'cloud', '--candidate-manifest', str(manifest),
                    '--write-review-draft', '--review-draft-path', str(draft)]
            with patch.object(assets, 'ROOT', root), patch('sys.argv', argv):
                self.assertEqual(assets.main(), 0)
                with self.assertRaises(FileExistsError):
                    assets.main()
            self.assertEqual(old.read_text(), 'historical packet')
            self.assertEqual(json.loads(draft.read_text())['review'], 'DRAFT / UNASSIGNED')

    def test_inner_blob_corruption_is_rejected_even_with_matching_outer_hash(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            manifest, _ = fixture(root / 'artifacts/workstation/owned', corrupt_blob=True)
            with patch.object(assets, 'ROOT', root), self.assertRaisesRegex(ValueError, 'OCI_DESCRIPTOR_HASH_MISMATCH'):
                assets.verify_archives(manifest)

    def test_remote_program_is_role_bound_and_never_activates_services(self):
        for role, home in [('a', '/home/server'), ('cloud', '/home/highpassadmin')]:
            program = assets.remote_program(role, [], home + '/.highpass-hcc-images-' + 'a'*32, 1001)
            compile(program, 'remote', 'exec')
            for boundary in ['hashlib.file_digest', 'identity()==before', "['docker','image','load'", 'stat.S_IMODE(info.st_mode)==0o600']:
                self.assertIn(boundary, program)
            for forbidden in ['compose', 'randomBytes', 'hcc-source-secret', 'docker volume', 'CERT_NONE']:
                self.assertNotIn(forbidden, program)
        for role, stage in [('b', '/home/server/.highpass-hcc-images-'+'a'*32),
                            ('cloud', '/home/server/.highpass-hcc-images-'+'a'*32), ('a', '/home/server')]:
            with self.assertRaises(ValueError):
                assets.remote_program(role, [], stage)


class ImageUploadBoundary(unittest.TestCase):
    def setup_upload(self, directory):
        raw = b'public nonclinical archive transport fixture' * 40
        (directory / 'control.tar').write_bytes(raw)
        rows = [{'role': 'control', 'path': 'control.tar', 'bytes': len(raw)}]
        sftp = MagicMock()
        target = sftp.open.return_value.__enter__.return_value
        sftp.lstat.return_value.st_mode = stat.S_IFREG | 0o600
        sftp.lstat.return_value.st_size = len(raw)
        return sftp, target, rows

    def test_exclusive_pipeline_finishes_close_and_checks_remote_size(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(assets.threading, 'Timer') as timer:
            root = pathlib.Path(directory)
            sftp, target, rows = self.setup_upload(root)
            progress = []
            assets.upload_archives(sftp, root, rows, '/owned/stage', progress)
            sftp.open.assert_called_once_with('/owned/stage/control.tar', 'wx')
            sftp.chmod.assert_called_once_with('/owned/stage/control.tar', 0o600)
            target.set_pipelined.assert_called_once_with(True)
            self.assertTrue(progress[0]['closeCompleted'])
            self.assertEqual(progress[0]['bytesSubmitted'], rows[0]['bytes'])
            timer.return_value.cancel.assert_called_once()
            self.assertTrue(timer.return_value.daemon)

    def test_delayed_close_error_never_marks_file_complete(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(assets.threading, 'Timer'):
            root = pathlib.Path(directory)
            sftp, _, rows = self.setup_upload(root)
            sftp.open.return_value.__exit__.side_effect = OSError('private remote details')
            progress = []
            with self.assertRaises(OSError):
                assets.upload_archives(sftp, root, rows, '/owned/stage', progress)
            self.assertFalse(progress[0]['closeCompleted'])
            sftp.lstat.assert_not_called()

    def test_remote_short_file_or_wrong_mode_is_rejected(self):
        for change in ['size', 'mode']:
            with tempfile.TemporaryDirectory() as directory, patch.object(assets.threading, 'Timer'):
                root = pathlib.Path(directory)
                sftp, _, rows = self.setup_upload(root)
                if change == 'size':
                    sftp.lstat.return_value.st_size -= 1
                else:
                    sftp.lstat.return_value.st_mode = stat.S_IFREG | 0o644
                progress = []
                with self.assertRaisesRegex(ValueError, 'REMOTE_UPLOAD_SIZE_OR_MODE_MISMATCH'):
                    assets.upload_archives(sftp, root, rows, '/owned/stage', progress)
                self.assertFalse(progress[0]['closeCompleted'])

    def test_deadline_stops_before_file_creation(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(assets.threading, 'Timer'), \
                patch.object(assets.time, 'monotonic', side_effect=[0, 181, 181]):
            root = pathlib.Path(directory)
            sftp, _, rows = self.setup_upload(root)
            with self.assertRaisesRegex(TimeoutError, 'BOUNDED_ASSET_UPLOAD_TIMEOUT'):
                assets.upload_archives(sftp, root, rows, '/owned/stage', [])
            sftp.open.assert_not_called()

    def test_timer_closes_channel_and_rejects_late_completion(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(assets.threading, 'Timer') as timer:
            root = pathlib.Path(directory)
            sftp, target, rows = self.setup_upload(root)
            def fire_timer(*_):
                timer.call_args.args[1]()
            target.write.side_effect = fire_timer
            progress = []
            with self.assertRaises(TimeoutError):
                assets.upload_archives(sftp, root, rows, '/owned/stage', progress)
            sftp.get_channel.return_value.close.assert_called_once()
            self.assertFalse(progress[0]['closeCompleted'])
            timer.return_value.cancel.assert_called_once()

    def test_sanitized_diagnostics_never_include_exception_text(self):
        for error in [TimeoutError('credential'), OSError('credential'), ValueError('credential'), Exception('credential')]:
            self.assertNotIn('credential', assets.diagnostic_code(error))
        self.assertEqual(assets.diagnostic_code(TimeoutError()), 'BOUNDED_OPERATION_TIMEOUT')


if __name__ == '__main__':
    unittest.main()
