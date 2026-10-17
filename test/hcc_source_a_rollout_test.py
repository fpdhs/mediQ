import importlib.util
import pathlib
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('a_rollout_test',ROOT/'scripts/hcc-source-a-rollout.py')
rollout=importlib.util.module_from_spec(spec);spec.loader.exec_module(rollout)


class Adapter:
    def __init__(self,fail=None):self.calls=[];self.fail=fail
    def step(self,op):
        self.calls.append(op)
        if len(self.calls)==self.fail:raise RuntimeError('synthetic failure')
    def preflight(self):self.step('preflight')
    def activate(self,role,profile):self.step(role+':'+profile)
    def verify(self,profile):self.step('verify:'+profile)


class AActivationBoundary(unittest.TestCase):
    def test_gateway_only_success_rehearses_rollback_before_reactivation(self):
        adapter=Adapter();result=rollout.guard.promotion_sequence(adapter,roles=('gateway',))
        self.assertEqual(result['status'],'PASS');self.assertEqual(result['rollback'],'PASS')
        self.assertEqual(adapter.calls,['preflight','gateway:candidate','verify:candidate','gateway:baseline',
          'verify:baseline','gateway:candidate','verify:candidate'])

    def test_all_failures_recover_only_gateway_and_preflight_never_mutates(self):
        for stage in range(1,8):
            adapter=Adapter(stage);result=rollout.guard.promotion_sequence(adapter,roles=('gateway',))
            if stage==1:
                self.assertEqual(adapter.calls,['preflight']);self.assertEqual(result['status'],'NOT VERIFIED')
            else:
                self.assertEqual(adapter.calls[-2:],['gateway:baseline','verify:baseline'])
                self.assertEqual(result['status'],'FAIL');self.assertEqual(result['rollback'],'PASS')

    def test_apply_requires_review_before_commands_or_connection(self):
        with patch('sys.argv',['rollout','--apply','--candidate-manifest','unused.json']),patch.object(rollout.subprocess,'run') as execute:
            with self.assertRaisesRegex(ValueError,'EXACT_A_REVIEW_AND_PREFLIGHT_REQUIRED'):rollout.main()
            execute.assert_not_called()

    def test_program_compile_exact_asset_and_protected_runtime_guards(self):
        program=rollout.remote_program({},'sha256:'+'a'*64,'f'*64,'00:00:00:00:00:00')
        compile(program,'remote','exec')
        for value in ["roles=('gateway',)","'--no-deps','--pull','never','--force-recreate','gateway'",
           "pacs['Id']==EXPECTED['protectedPacsId']",'a_source_only_config(self.baseline,self.candidate,IMAGE)',
           'MANIFEST_SHA','os.O_NOFOLLOW','stat.S_IMODE(info.st_mode)==0o440','CAPSTONE_VAULT_KEY_ID']:
            self.assertIn(value,program)
        for bad in ['docker volume',"'down'",'CERT_NONE','registerHccCatalog','docker pull']:
            self.assertNotIn(bad,program)

    def test_transport_keeps_strict_tls_and_mtls_and_never_claims_raw_hash(self):
        for value in ['boundedHttps','gateway-client.key','hospital-a-orthanc-mtls',
                      "local.status!==401","TOKEN_REQUIRED",'maxBytes:1048576','timeoutMs:5000',
                      'STRICT_TLS_MTLS_FIXED_STUDY_METADATA_NOT_RAW_HASH_PROOF']:
            self.assertIn(value,rollout.TRANSPORT)
        self.assertNotIn('rejectUnauthorized:false',rollout.TRANSPORT)
        self.assertIn("JSON.parse(local.body).error!=='TOKEN_REQUIRED'",rollout.TRANSPORT)
        self.assertIn("accept:'application/dicom+json'",rollout.TRANSPORT)


if __name__=='__main__':unittest.main()
