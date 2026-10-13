import hashlib
import importlib.util
import pathlib
import unittest
import os
import io
import json
import base64
import contextlib
import tempfile
import stat
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('source_file_assets',ROOT/'scripts/lib/hcc_source_file_assets.py')
files=importlib.util.module_from_spec(spec);spec.loader.exec_module(files)


class Adapter:
    def __init__(self,role,journal,fail=None):self.role=role;self.journal=journal;self.fail=fail;self.token=None
    def step(self,operation):
        self.journal.append(self.role+':'+operation)
        if self.fail==operation:raise RuntimeError('sensitive simulated remote error')
    def preflight(self):self.step('preflight')
    def install(self,token,manifest):
        self.step('install');self.token=token
        assert (manifest is not None)==(self.role=='a')
    def verify(self,token,digest):
        self.step('verify');assert self.token==token
        assert (digest is not None)==(self.role=='a')


class SourceFileAssets(unittest.TestCase):
    def pair(self,fail_role=None,fail_stage=None):
        journal=[]
        adapters={role:Adapter(role,journal,fail_stage if role==fail_role else None) for role in ['cloud','a']}
        return adapters,journal
    def execute(self,adapters):
        return files.provision_pair(adapters,b'{}',hashlib.sha256(b'{}').hexdigest())
    def test_both_preflights_then_same_credential_and_a_only_manifest(self):
        adapters,journal=self.pair();result=self.execute(adapters)
        self.assertEqual(result['status'],'PASS')
        self.assertEqual(journal,['cloud:preflight','a:preflight','cloud:install','a:install','cloud:verify','a:verify'])
        self.assertEqual(adapters['a'].token,adapters['cloud'].token)
        self.assertEqual(len(adapters['a'].token),64)
        self.assertNotIn(adapters['a'].token.decode(),str(result))
    def test_preflight_failure_prevents_generation_and_every_write(self):
        for role in ['cloud','a']:
            adapters,journal=self.pair(role,'preflight')
            with patch.object(files.secrets,'token_urlsafe') as generate:
                result=self.execute(adapters);generate.assert_not_called()
            self.assertFalse(result['partialWritePossible'])
            self.assertFalse(any('install' in item for item in journal))
    def test_partial_writes_never_delete_retry_or_disclose_error(self):
        for role in ['cloud','a']:
            for stage in ['install','verify']:
                adapters,journal=self.pair(role,stage);result=self.execute(adapters)
                self.assertEqual(result['status'],'NOT VERIFIED')
                self.assertTrue(result['partialWritePossible'])
                self.assertEqual(result['cleanup'],'NOT EXECUTED')
                self.assertNotIn('sensitive',str(result))
                self.assertFalse(any('delete' in item for item in journal))
    def test_bad_manifest_or_extra_role_stops_before_preflight(self):
        adapters,journal=self.pair()
        with self.assertRaises(ValueError):files.provision_pair(adapters,b'{}','0'*64)
        with self.assertRaises(ValueError):files.provision_pair(adapters|{'b':adapters['a']},b'{}',hashlib.sha256(b'{}').hexdigest())
        self.assertEqual(journal,[])
    def test_generated_linux_primitive_compiles_and_has_no_activation(self):
        for role in ['cloud','a']:
            for operation in ['preflight','install','verify']:
                program=files.remote_program(role,operation);compile(program,'source-files','exec')
                for expected in ['os.O_EXCL|os.O_NOFOLLOW','os.fchown(fd,0,65532)','os.fchmod(fd,0o440)',
                                 'hmac.compare_digest','follow_symlinks=False','os.fsync(parent)']:
                    self.assertIn(expected,program)
                for forbidden in ['docker','chmod 777','unlink','CERT_NONE','print(token']:
                    self.assertNotIn(forbidden,program)
        with self.assertRaises(ValueError):files.remote_program('b','install')


@unittest.skipUnless(os.name=='posix' and hasattr(os,'geteuid') and os.geteuid()==0,
                     'Requires isolated Linux root filesystem test environment')
class LinuxSourceFilePrimitive(unittest.TestCase):
    """Execute the unchanged generated primitive against owned temporary directory FDs.

    Only root-directory resolution and host identity are redirected for isolation.
    No service path, real credential, MAC/network or runtime is exercised here.
    """
    def setup_root(self,root):
        folder=root/'opt/highpass';folder.mkdir(parents=True)
        for role in ['cloud','a']:
            (folder/('capstone-control-secrets' if role=='cloud' else 'capstone-a-gateway-secrets')).mkdir()
        return folder
    def payload(self,role):
        value={'token':'T'*64}  # Public fake fixture, never used as a service credential.
        if role=='a':
            raw=b'{"fixture":"nonclinical-filesystem-test"}'
            value.update(manifest=base64.b64encode(raw).decode(),manifestSha256=hashlib.sha256(raw).hexdigest())
        return value
    def execute(self,root,role,operation,payload=None):
        original_open=os.open;output=io.StringIO()
        def redirected(name,flags,*args,**kwargs):
            if name=='/' and kwargs.get('dir_fd') is None:name=str(root)
            return original_open(name,flags,*args,**kwargs)
        real_open=open
        def identity_open(name,*args,**kwargs):
            if name=='/sys/class/net/ens33/address':return io.StringIO('00:0c:29:25:f6:b4\n')
            return real_open(name,*args,**kwargs)
        stdin=type('FixtureInput',(),{'buffer':io.BytesIO(json.dumps(payload).encode())})()
        with patch.object(os,'open',side_effect=redirected), patch('builtins.open',side_effect=identity_open), \
             patch('socket.gethostname',return_value='highpass-cloud'),patch('sys.stdin',stdin),contextlib.redirect_stdout(output):
            try:exec(files.remote_program(role,operation),{'__name__':'isolated_primitive'})
            except SystemExit as error:self.assertEqual(error.code,2)
        return json.loads(output.getvalue())
    def test_real_linux_install_verify_modes_owner_and_no_overwrite(self):
        with tempfile.TemporaryDirectory(prefix='hp-source-files-test-') as name:
            root=pathlib.Path(name);folder=self.setup_root(root)
            for role in ['cloud','a']:
                self.assertEqual(self.execute(root,role,'preflight')['status'],'PASS')
                payload=self.payload(role)
                self.assertEqual(self.execute(root,role,'install',payload)['status'],'PASS')
                self.assertEqual(self.execute(root,role,'verify',payload)['status'],'PASS')
                target=folder/('capstone-control-secrets' if role=='cloud' else 'capstone-a-gateway-secrets')/'hcc-source-secret'
                self.assertEqual(target.read_bytes(),b'T'*64+b'\n')
                self.assertEqual((target.stat().st_uid,target.stat().st_gid,stat.S_IMODE(target.stat().st_mode)),(0,65532,0o440))
                self.assertEqual(self.execute(root,role,'install',payload)['status'],'NOT VERIFIED')
                self.assertEqual(target.read_bytes(),b'T'*64+b'\n')
            manifest=folder/'capstone-hcc-source/manifest.json'
            self.assertEqual(manifest.stat().st_gid,65532)
            self.assertEqual(stat.S_IMODE(manifest.stat().st_mode),0o440)
            self.assertFalse((folder/'capstone-control-secrets/manifest.json').exists())
    def test_real_linux_symlink_target_does_not_modify_victim(self):
        with tempfile.TemporaryDirectory(prefix='hp-source-files-test-') as name:
            root=pathlib.Path(name);folder=self.setup_root(root)
            victim=root/'victim';victim.write_bytes(b'preserve-public-fixture')
            (folder/'capstone-control-secrets/hcc-source-secret').symlink_to(victim)
            self.assertEqual(self.execute(root,'cloud','install',self.payload('cloud'))['status'],'NOT VERIFIED')
            self.assertEqual(victim.read_bytes(),b'preserve-public-fixture')
    def test_real_linux_parent_write_permission_rejected(self):
        with tempfile.TemporaryDirectory(prefix='hp-source-files-test-') as name:
            root=pathlib.Path(name);folder=self.setup_root(root)
            parent=folder/'capstone-control-secrets';parent.chmod(0o777)
            self.assertEqual(self.execute(root,'cloud','preflight')['status'],'NOT VERIFIED')
            self.assertFalse((parent/'hcc-source-secret').exists())
    def test_real_linux_existing_credential_reuse_rejected(self):
        with tempfile.TemporaryDirectory(prefix='hp-source-files-test-') as name:
            root=pathlib.Path(name);folder=self.setup_root(root)
            parent=folder/'capstone-control-secrets';(parent/'data-plane-secret').write_bytes(b'T'*64)
            self.assertEqual(self.execute(root,'cloud','install',self.payload('cloud'))['status'],'NOT VERIFIED')
            self.assertFalse((parent/'hcc-source-secret').exists())
    def test_real_linux_manifest_corruption_fails_verification(self):
        with tempfile.TemporaryDirectory(prefix='hp-source-files-test-') as name:
            root=pathlib.Path(name);folder=self.setup_root(root);payload=self.payload('a')
            self.assertEqual(self.execute(root,'a','install',payload)['status'],'PASS')
            (folder/'capstone-hcc-source/manifest.json').write_bytes(b'changed-public-fixture')
            self.assertEqual(self.execute(root,'a','verify',payload)['status'],'NOT VERIFIED')


if __name__=='__main__':unittest.main()
