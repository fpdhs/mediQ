import ast
import importlib.util
import pathlib
import stat
import unittest
from types import SimpleNamespace

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('receiver_prepare',ROOT/'scripts/b-pacs-receiver-prepare.py')
prepare=importlib.util.module_from_spec(spec);spec.loader.exec_module(prepare)


class ReceiverPreparation(unittest.TestCase):
    def test_guest_program_is_valid_and_only_creates_stopped_receivers(self):
        tree=ast.parse(prepare.GUEST)
        compile(tree,'b-receiver-prepare','exec')
        self.assertIn("cmd+['create','--no-build','--pull','never']",prepare.GUEST)
        self.assertIn("c['State']['Status']!='created'",prepare.GUEST)
        self.assertIn('guard.validate_boundary(',prepare.GUEST)
        self.assertLess(prepare.GUEST.index('guard.validate_boundary('),prepare.GUEST.index('guest.ensure_orthanc_storage()'))
        for forbidden in ['luksFormat','luksOpen','mkfs','--privileged',"cmd+['up'", "cmd+['start'",'/api/dicom-access']:
            self.assertNotIn(forbidden,prepare.GUEST)

    def test_preparation_refuses_existing_directory_with_unsafe_owner_or_permissions(self):
        function=next(node for node in ast.parse(prepare.GUEST).body if isinstance(node,ast.FunctionDef) and node.name=='directory')
        namespace={'stat':stat}
        exec(compile(ast.Module(body=[function],type_ignores=[]),'directory-guard','exec'),namespace)
        correct=SimpleNamespace(st_mode=stat.S_IFDIR|0o750,st_uid=0,st_gid=65532)

        class ExistingPath:
            def __init__(self,info):self.info=info
            def exists(self):return True
            def lstat(self):return self.info

        namespace['directory'](ExistingPath(correct),0o750,65532)
        for field,value in [('st_uid',1000),('st_gid',0),('st_mode',stat.S_IFDIR|0o777),('st_mode',stat.S_IFLNK|0o777)]:
            bad=SimpleNamespace(**{**correct.__dict__,field:value})
            with self.subTest(field=field,value=value),self.assertRaisesRegex(RuntimeError,'PREPARATION_DIRECTORY_INVALID'):
                namespace['directory'](ExistingPath(bad),0o750,65532)

if __name__=='__main__':unittest.main()
