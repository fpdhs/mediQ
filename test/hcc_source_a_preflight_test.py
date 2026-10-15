import copy
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('a_source_preflight',ROOT/'scripts/hcc-source-a-preflight.py')
preflight=importlib.util.module_from_spec(spec);spec.loader.exec_module(preflight)
plan=preflight.plan


class ASourceBoundary(unittest.TestCase):
    def configs(self):
        baseline={'services':{'gateway':{'image':plan.A_BASE,'environment':{'CAPSTONE_PATIENT_IMAGE_ENCRYPTION_REQUIRED':'1'},'volumes':[]}},
                  'networks':{'pacs_private':{'external':True,'name':'hp-capstone-hospital-a_pacs_private'}}}
        candidate=copy.deepcopy(baseline);gateway=candidate['services']['gateway'];gateway['image']='sha256:'+'a'*64
        gateway['environment'].update({'HCC_SOURCE_SERVICE_TOKEN_FILE':'/run/secrets/hcc-source-secret','HCC_SOURCE_MANIFEST_FILE':'/run/hcc-source/manifest.json'})
        gateway['volumes']=[{'type':'bind','source':source,'target':target,'read_only':True,'bind':{'create_host_path':False}}
          for source,target in [(plan.A_SECRET,'/run/secrets/hcc-source-secret'),(plan.A_MANIFEST,'/run/hcc-source/manifest.json')]]
        return baseline,candidate

    def test_only_source_addition_accepted_without_mutation(self):
        baseline,candidate=self.configs();before=copy.deepcopy(candidate)
        plan.a_source_only_config(baseline,candidate,'sha256:'+'a'*64)
        self.assertEqual(before,candidate)

    def test_missing_token_bind_and_other_security_changes_rejected(self):
        for change in [lambda x:x['services']['gateway']['volumes'].pop(0),
           lambda x:x['services']['gateway']['volumes'][0].update(read_only=False),
           lambda x:x['services']['gateway']['volumes'][0]['bind'].update(create_host_path=True),
           lambda x:x['services']['gateway']['environment'].update(CAPSTONE_PATIENT_IMAGE_ENCRYPTION_REQUIRED='0'),
           lambda x:x['services']['gateway'].update(ports=['0.0.0.0:9443:8443']),
           lambda x:x['networks']['pacs_private'].update(name='different'),
           lambda x:x['services']['gateway']['volumes'][1].update(source='/var/lib/orthanc')]:
            baseline,candidate=self.configs();change(candidate)
            with self.assertRaises(ValueError):plan.a_source_only_config(baseline,candidate,'sha256:'+'a'*64)

    def test_exact_context(self):
        stage='/home/server/.highpass-app-2026-10-08T21-31-00.357148+00-00'
        labels={'com.docker.compose.project':'hp-capstone-a-gateway','com.docker.compose.project.working_dir':stage,
                'com.docker.compose.project.config_files':','.join(stage+'/'+x for x in ['gateway.yml','encryption.yml','patient.yml'])}
        plan.a_context(labels)
        labels['com.docker.compose.project.config_files']+=','+stage+'/unknown.yml'
        with self.assertRaises(ValueError):plan.a_context(labels)

    def test_remote_read_only_program_compile(self):
        program=preflight.remote_program('sha256:'+'a'*64,'00:00:00:00:00:00');compile(program,'remote','exec')
        for forbidden in ['write_text(', 'write_bytes(', 'chmod(', 'docker load', "'up'", "'down'", 'secret.read']:
            self.assertNotIn(forbidden,program)
        self.assertIn('pacsVolumePreserved',program)
        self.assertIn('a_source_only_config(baseline,candidate,IMAGE)',program)


if __name__=='__main__':unittest.main()
