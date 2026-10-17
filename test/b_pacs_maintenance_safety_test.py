import importlib.util
import json
import pathlib
import stat
import unittest
from types import SimpleNamespace

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

    def test_mtls_secret_permissions_are_root_owned_and_read_only_for_receiver_group(self):
        directory=SimpleNamespace(st_mode=stat.S_IFDIR|0o750,st_uid=0,st_gid=65532)
        guard.validate_secret_directory(directory)
        file=SimpleNamespace(st_mode=stat.S_IFREG|0o440,st_uid=0,st_gid=65532)
        guard.validate_secret_file(file)
        for candidate,is_symlink in [
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFDIR|0o770}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_uid':10001}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_gid':0}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFLNK|0o777}),True),
        ]:
            with self.subTest(candidate=candidate,is_symlink=is_symlink),self.assertRaisesRegex(RuntimeError,'B_PACS_SECRET_DIRECTORY_PERMISSIONS_INVALID'):
                guard.validate_secret_directory(candidate,is_symlink)
        for candidate,is_symlink in [
            (SimpleNamespace(**{**file.__dict__,'st_mode':stat.S_IFREG|0o640}),False),
            (SimpleNamespace(**{**file.__dict__,'st_uid':65532}),False),
            (SimpleNamespace(**{**file.__dict__,'st_gid':0}),False),
            (SimpleNamespace(**{**file.__dict__,'st_mode':stat.S_IFLNK|0o777}),True),
        ]:
            with self.subTest(candidate=candidate,is_symlink=is_symlink),self.assertRaisesRegex(RuntimeError,'B_PACS_SECRET_FILE_PERMISSIONS_INVALID'):
                guard.validate_secret_file(candidate,is_symlink)

    def test_launcher_never_formats_or_unlocks(self):
        source=(ROOT/'scripts/b-pacs-receiver-start.py').read_text()
        for forbidden in ['luksFormat','mkfs','luksOpen','--privileged','--force']:self.assertNotIn(forbidden,source)

    def test_orthanc_data_directory_must_be_private_and_on_encrypted_filesystem(self):
        mount=SimpleNamespace(st_dev=77)
        directory=SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_dev=77,st_uid=10001,st_gid=10001)
        guard.validate_orthanc_data(mount,directory)
        invalid=[
            (SimpleNamespace(**{**directory.__dict__,'st_dev':78}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_uid':0}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_gid':0}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFDIR|0o777}),False),
            (SimpleNamespace(**{**directory.__dict__,'st_mode':stat.S_IFLNK|0o777}),True),
        ]
        for candidate,is_symlink in invalid:
            with self.subTest(candidate=candidate,is_symlink=is_symlink),self.assertRaisesRegex(RuntimeError,'ORTHANC_ENCRYPTED_DATA_DIRECTORY_INVALID'):
                guard.validate_orthanc_data(mount,candidate,is_symlink)

    def test_b_receiver_orthanc_config_is_synthetic_and_internal_only(self):
        config=json.loads((ROOT/'infra/workstation/orthanc/hospital-b-receiver.json').read_text())
        self.assertEqual(config['Name'],'Highpass B Synthetic Test PACS - Not For Clinical Use')
        self.assertEqual(config['StorageDirectory'],'/var/lib/orthanc/db')
        self.assertEqual(config['IndexDirectory'],'/var/lib/orthanc/db')
        self.assertTrue(config['RemoteAccessAllowed'])
        self.assertFalse(config['AuthenticationEnabled'])
        self.assertEqual(config['MaximumStorageSize'],6144)
        self.assertEqual(config['MaximumStorageMode'],'Reject')
        self.assertFalse(config['DicomServerEnabled'])
        self.assertFalse(config['RestApiWriteToFileSystemEnabled'])
        self.assertFalse(config['OverwriteInstances'])
        guard.validate_orthanc_config(config)
        for field,value in [('AuthenticationEnabled',True),('DicomServerEnabled',True),
                            ('MaximumStorageMode','Recycle'),('MaximumStorageSize',0),
                            ('RestApiWriteToFileSystemEnabled',True),('OverwriteInstances',True),
                            ('StorageDirectory','/tmp/orthanc')]:
            with self.subTest(field=field),self.assertRaisesRegex(RuntimeError,'ORTHANC_RECEIVER_CONFIG_INVALID'):
                guard.validate_orthanc_config({**config,field:value})

    def test_receiver_image_is_digest_pinned_nonroot_and_minimal(self):
        source=(ROOT/'Dockerfile.b-pacs-receiver').read_text()
        self.assertIn('gcr.io/distroless/nodejs24-debian13:nonroot@sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e',source)
        self.assertIn('USER 65532:65532',source)
        self.assertIn('src/b-pacs-storage-boundary.js',source)
        self.assertIn('scripts/start-b-pacs-mtls.js',source)
        for forbidden in ['apt-get','npm install','pnpm install','ADD ','COPY . ']:self.assertNotIn(forbidden,source)

    def test_compose_gate_pins_uuid_private_networks_and_mount_modes(self):
        luks_uuid='627df927-a317-4950-88d1-3293a3b261b0'
        image='registry.invalid/orthanc@sha256:'+'a'*64
        bind=lambda target,read_only=False,source=None:{'type':'bind','source':source or guard.ENCRYPTED_MOUNT,'target':target,'read_only':read_only,
            'bind':{'create_host_path':False}}
        rendered={'services':{
            'b-orthanc':{'image':image,'restart':'no','user':'10001:10001','read_only':True,'cap_drop':['ALL'],
                'security_opt':['no-new-privileges:true'],'networks':{'b_pacs_private':{}},'volumes':[
                {'type':'bind','source':'/fixture/orthanc/hospital-b-receiver.json','target':'/etc/orthanc/orthanc.json','read_only':True},
                bind('/var/lib/orthanc/db',source=guard.ORTHANC_DATA_SOURCE)]},
            'b-pacs-mtls':{'image':image,'restart':'no','read_only':True,'cap_drop':['ALL'],
                'security_opt':['no-new-privileges:true'],'networks':{'b_pacs_private':{},'b_pacs_receiver':{}},
                'environment':{'B_PACS_ENCRYPTED_LUKS_UUID':luks_uuid},
                'depends_on':{'b-orthanc':{'condition':'service_healthy'}},
                'volumes':[bind('/run/pacs-storage-check',True),
                    bind('/run/secrets/b-pacs-server.crt',True,'/fixture/secrets/b-pacs-server.crt'),
                    bind('/run/secrets/b-pacs-server.key',True,'/fixture/secrets/b-pacs-server.key'),
                    bind('/run/secrets/ca.crt',True,'/fixture/secrets/ca.crt')] }},
            'networks':{'b_pacs_private':{'internal':True},'b_pacs_receiver':{'internal':True}}}
        guard.validate_compose_config(rendered,luks_uuid)
        offline=json.loads(json.dumps(rendered))
        for service in offline['services'].values():
            service['image']='sha256:'+'b'*64
            service['pull_policy']='never'
        guard.validate_compose_config(offline,luks_uuid)
        offline['services']['b-orthanc'].pop('pull_policy')
        with self.assertRaisesRegex(RuntimeError,'MANUAL_PINNED_PRIVATE_RECEIVER_REQUIRED'):
            guard.validate_compose_config(offline,luks_uuid)
        cases=[]
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['environment']['B_PACS_ENCRYPTED_LUKS_UUID']='a'*36;cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['networks']['b_pacs_receiver']['internal']=False;cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['ports']=['8443:8443'];cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['volumes'][0]['read_only']=False;cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['volumes'].pop();cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['cap_add']=['NET_ADMIN'];cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['devices']=['/dev/mem:/dev/mem'];cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['network_mode']='host';cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['volumes'][1]['read_only']=False;cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['volumes'][2]['source']='/tmp/elsewhere.key';cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-orthanc']['networks']['b_pacs_receiver']={};cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['depends_on']['b-orthanc']['condition']='started';cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-orthanc']['user']='0:0';cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-orthanc']['read_only']=False;cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-pacs-mtls']['cap_drop']=[];cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-orthanc']['volumes'][1]['bind']={'create_host_path':True};cases.append(changed)
        changed=json.loads(json.dumps(rendered));changed['services']['b-orthanc']['volumes'][0]['read_only']=False;cases.append(changed)
        for candidate in cases:
            with self.subTest(candidate=candidate),self.assertRaises(RuntimeError):guard.validate_compose_config(candidate,luks_uuid)

if __name__=='__main__':unittest.main()
