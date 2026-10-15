"""Focused metadata fixtures; no credentials, filesystem chmod or SSH."""
import importlib.util
import pathlib
import stat
import unittest
from types import SimpleNamespace

root = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location(
    "secret_policy", root / "scripts/lib/patient_secret_permissions.py"
)
policy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


def metadata(mode, uid=0, gid=65532, kind=stat.S_IFREG):
    return SimpleNamespace(st_mode=kind | mode, st_uid=uid, st_gid=gid)


class SecretPermissionsTest(unittest.TestCase):
    def test_root_managed_nonroot_readable_files(self):
        for mode in (0o440, 0o640):
            for parent in (metadata(0o700, gid=0, kind=stat.S_IFDIR),
                           metadata(0o750, kind=stat.S_IFDIR)):
                with self.subTest(mode=mode, parent=parent):
                    self.assertTrue(policy.protected_secret_metadata(metadata(mode), parent))

    def test_unsafe_or_unreadable_files_rejected(self):
        parent = metadata(0o700, gid=0, kind=stat.S_IFDIR)
        cases = [metadata(mode) for mode in (0o600, 0o400, 0o644, 0o660, 0o777, 0o1640)]
        cases += [metadata(0o640, uid=65532), metadata(0o640, gid=0),
                  metadata(0o640, kind=stat.S_IFLNK), metadata(0o640, kind=stat.S_IFDIR)]
        for file_info in cases:
            with self.subTest(file_info=file_info):
                self.assertFalse(policy.protected_secret_metadata(file_info, parent))

    def test_unprotected_or_symlink_parent_rejected(self):
        cases = [metadata(mode, kind=stat.S_IFDIR) for mode in (0o755, 0o770, 0o777)]
        cases += [metadata(0o700, uid=65532, kind=stat.S_IFDIR),
                  metadata(0o750, gid=0, kind=stat.S_IFDIR),
                  metadata(0o700, kind=stat.S_IFLNK)]
        for parent in cases:
            with self.subTest(parent=parent):
                self.assertFalse(policy.protected_secret_metadata(metadata(0o640), parent))


if __name__ == "__main__":
    unittest.main()
