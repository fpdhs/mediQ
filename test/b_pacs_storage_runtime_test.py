import ast
import copy
import importlib.util
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('b_storage_runtime',ROOT/'scripts/b-pacs-storage-runtime-check.py')
runtime=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

class StorageRuntimeEvidence(unittest.TestCase):
    def setUp(self):
        self.luks_uuid,self.probe_hash=runtime.expected_storage_identity()
        image='registry.invalid/portal@sha256:'+'a'*64
        image_id='sha256:'+'c'*64
        self.result={
            'boundaryProbe':{'exitCode':0},'portalHealth':'healthy','portalImage':image,'probeImage':image,
            'portalImageId':image_id,'probeImageId':image_id,
            'hostMount':{'filesystems':[{'target':'/opt/highpass/b-pacs-encrypted','source':'/dev/mapper/highpass-b-pacs',
                'fstype':'ext4','options':'rw,nosuid,nodev,noexec,relatime'}]},
            'luksUuid':self.luks_uuid,'luksSegments':{'0':{'type':'crypt','encryption':'aes-xts-plain64'}},
            'kdfTypes':['argon2id'],'backingBytes':8589934592,'probeContentPreserved':True,
            'manifestValid':True,'manifestLuksUuid':self.luks_uuid,
            'recoveryProbePresent':True,'recoveryProbeHash':self.probe_hash,
            'filesystemBytes':8333856768,'availableBytes':7888396288,
            'orthancData':{'path':'/opt/highpass/b-pacs-encrypted/orthanc-db','isDirectory':True,'isSymlink':False,
                'sameFilesystem':True,'uid':10001,'gid':10001,'mode':0o700},
            'orthancRuntime':{'service':'b-orthanc','running':True,'health':'healthy',
                'image':'registry.invalid/orthanc@sha256:'+'b'*64,'imageId':'sha256:'+'b'*64,'user':'10001:10001',
                'readOnlyRootfs':True,'privileged':False,'capDrop':['ALL'],'publishedPorts':False,
                'bindMountCount':2,'writableBindCount':1,'configMountReadOnly':True,
                'dataMount':{'type':'bind','source':'/opt/highpass/b-pacs-encrypted/orthanc-db',
                    'destination':'/var/lib/orthanc/db','rw':True}},
        }

    def test_b_runtime_check_uses_masked_b_role_prompt_and_fails_closed_on_cancel(self):
        roles=[]
        credential=runtime.read_b_credential(gui=True,gui_prompt=lambda role:roles.append(role) or 'local-test-secret')
        self.assertEqual(roles,['B'])
        self.assertEqual(credential,'local-test-secret')
        with self.assertRaisesRegex(SystemExit,'B_CREDENTIAL_INPUT_CANCELLED'):
            runtime.read_b_credential(gui=True,gui_prompt=lambda role:None)

    def test_existing_provision_and_recovery_receipts_supply_pinned_identity(self):
        self.assertRegex(self.luks_uuid,r'^[a-f0-9-]{36}$')
        self.assertRegex(self.probe_hash,r'^[a-f0-9]{64}$')
        runtime.validate_runtime_result(self.result,self.luks_uuid,self.probe_hash)

    def test_direct_portal_image_id_must_equal_running_and_probe_image_ids(self):
        candidate=copy.deepcopy(self.result)
        candidate['portalImage']=candidate['portalImageId']
        candidate['probeImage']=candidate['portalImageId']
        runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)
        candidate['portalImage']='sha256:'+'d'*64
        candidate['probeImage']=candidate['portalImage']
        with self.assertRaisesRegex(RuntimeError,'B_STORAGE_RUNTIME_VERIFICATION_FAILED'):
            runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)

    def test_offline_orthanc_image_id_must_equal_actual_container_image_id(self):
        candidate=copy.deepcopy(self.result)
        candidate['orthancRuntime']['image']=candidate['orthancRuntime']['imageId']
        runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)
        candidate['orthancRuntime']['imageId']='sha256:'+'d'*64
        with self.assertRaisesRegex(RuntimeError,'B_STORAGE_RUNTIME_VERIFICATION_FAILED'):
            runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)

    def test_runtime_gate_rejects_wrong_uuid_mount_or_weak_storage_evidence(self):
        mutations=[
            lambda x:x.update(luksUuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            lambda x:x['hostMount']['filesystems'][0].update(source='/dev/mapper/other'),
            lambda x:x['hostMount']['filesystems'][0].update(options='rw,relatime'),
            lambda x:x['luksSegments']['0'].update(encryption='aes-cbc-essiv:sha256'),
            lambda x:x.update(luksSegments=[{'type':'crypt','encryption':'aes-xts-plain64'}]),
            lambda x:x['luksSegments'].update({'1':{'type':'crypt','encryption':'aes-xts-plain64'}}),
            lambda x:x.update(luksSegments={'0':None}),
            lambda x:x.update(luksSegments={'1':{'type':'crypt','encryption':'aes-xts-plain64'}}),
            lambda x:x.update(kdfTypes=['pbkdf2']),
            lambda x:x['boundaryProbe'].update(exitCode=1),
            lambda x:x.update(recoveryProbeHash='0'*64),
            lambda x:x.update(recoveryProbePresent=False),
            lambda x:x.update(manifestValid=False),
            lambda x:x.update(manifestLuksUuid='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
            lambda x:x.update(portalHealth='unhealthy'),
            lambda x:x.update(portalImageId='registry.invalid/portal:latest'),
            lambda x:x.update(probeImageId='sha256:'+'d'*64),
            lambda x:x['orthancData'].update(isSymlink=True),
            lambda x:x['orthancData'].update(sameFilesystem=False),
            lambda x:x['orthancData'].update(uid=0),
            lambda x:x['orthancData'].update(mode=0o777),
            lambda x:x.update(orthancRuntime={}),
            lambda x:x['orthancRuntime'].update(health='unhealthy'),
            lambda x:x['orthancRuntime'].update(user='0:0'),
            lambda x:x['orthancRuntime'].update(readOnlyRootfs=False),
            lambda x:x['orthancRuntime'].update(privileged=True),
            lambda x:x['orthancRuntime'].update(capDrop=[]),
            lambda x:x['orthancRuntime'].update(publishedPorts=True),
            lambda x:x['orthancRuntime'].update(writableBindCount=2),
            lambda x:x['orthancRuntime'].update(configMountReadOnly=False),
            lambda x:x['orthancRuntime']['dataMount'].update(source='/var/lib/orthanc/db'),
            lambda x:x['orthancRuntime']['dataMount'].update(destination='/data'),
            lambda x:x['orthancRuntime']['dataMount'].update(rw=False),
        ]
        for mutate in mutations:
            candidate=copy.deepcopy(self.result);mutate(candidate)
            with self.subTest(candidate=candidate),self.assertRaisesRegex(RuntimeError,'B_STORAGE_RUNTIME_VERIFICATION_FAILED'):
                runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)

    def test_generated_remote_probe_is_syntax_valid_and_read_only_isolated(self):
        program=runtime.build_remote_program('20261014T120000Z',"assertBPacsEncryptedMount()",self.luks_uuid)
        compile(program,'remote-storage-readiness','exec')
        self.assertIn("'--network','none'",program)
        self.assertIn("'--read-only'",program)
        self.assertIn("'--cap-drop','ALL'",program)
        self.assertIn("'--env','B_PACS_ENCRYPTED_LUKS_UUID='+expected_luks_uuid",program)
        self.assertIn("'/opt/highpass/b-pacs-encrypted/orthanc-db'",program)
        self.assertIn('sameFilesystem=orthanc_lstat.st_dev==mount_stat.st_dev',program)
        self.assertIn("label=com.docker.compose.project=hp-b-pacs-receiver",program)
        self.assertIn("label=com.docker.compose.service=b-orthanc",program)
        self.assertIn("'/var/lib/orthanc/db'",program)
        self.assertIn("'publishedPorts':bool(host.get('PortBindings'))",program)
        self.assertIn("image_ref=portal.get('Config',{}).get('Image','')",program)
        self.assertIn("portalImage=image_ref,portalImageId=image",program)
        self.assertNotIn('--privileged',program)

    def test_remote_luks_collection_uses_separate_uuid_query_and_real_metadata_shape(self):
        captured=json.loads((ROOT/'artifacts/workstation/b-storage-runtime-20261013T014128Z/result.json').read_text())
        program=runtime.build_remote_program('20261014T120000Z','assertBPacsEncryptedMount()',self.luks_uuid)
        function=next(node for node in ast.parse(program).body if isinstance(node,ast.FunctionDef) and node.name=='collect_luks_evidence')
        code=compile(ast.Module(body=[function],type_ignores=[]),'remote-luks-collection','exec')
        commands=[]
        metadata={'segments':captured['luksSegments'],'keyslots':{'0':{'kdf':{'type':'argon2id'}}}}

        def probe(args):
            commands.append(args)
            return {'exitCode':0,'stdout':self.luks_uuid if args[1]=='luksUUID' else json.dumps(metadata)}

        namespace={'json':json,'run':probe}
        exec(code,namespace)
        evidence=namespace['collect_luks_evidence']('/synthetic/volume.luks')
        self.assertEqual(evidence['luksUuid'],self.luks_uuid)
        self.assertEqual(evidence['luksSegments'],captured['luksSegments'])
        self.assertEqual(evidence['kdfTypes'],['argon2id'])
        self.assertEqual([args[1] for args in commands],['luksUUID','luksDump'])
        candidate=copy.deepcopy(self.result)
        candidate.update(evidence)
        runtime.validate_runtime_result(candidate,self.luks_uuid,self.probe_hash)

        for failed_command in ['luksUUID','luksDump']:
            def failed_probe(args):
                return {'exitCode':1,'stdout':''} if args[1]==failed_command else probe(args)
            namespace['run']=failed_probe
            with self.subTest(failed_command=failed_command),self.assertRaisesRegex(RuntimeError,'LUKS_READ_ONLY_PROBE_FAILED'):
                namespace['collect_luks_evidence']('/synthetic/volume.luks')

if __name__=='__main__':unittest.main()
