import copy
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('source_rollout_command',ROOT/'scripts/hcc-source-cloud-rollout.py')
rollout=importlib.util.module_from_spec(spec);spec.loader.exec_module(rollout)
guard=rollout.guard


class Adapter:
    def __init__(self, fail=None):self.calls=[];self.fail=fail;self.number=0
    def step(self,operation):
        self.calls.append(operation);self.number+=1
        if self.number==self.fail:raise RuntimeError('synthetic failure, never exposed')
    def preflight(self):self.step('preflight')
    def activate(self,role,profile):self.step(role+':'+profile)
    def verify(self,profile):self.step('verify:'+profile)


class SourceRolloutBoundary(unittest.TestCase):
    def test_scan_evidence_is_derived_from_the_exact_candidate_image_revision(self):
        for role in ['control', 'a', 'ingress']:
            image = f'highpass-platform-mvp:capstone-hcc-source-{role}-20261010-03'
            self.assertEqual(guard.candidate_scan_path(role, image),
                             f'artifacts/security/container-scan/hcc-source-{role}-20261010-03.json')
        for role, image in [('a', 'highpass-platform-mvp:capstone-hcc-source-control-20261010-03'),
                            ('control', 'highpass-platform-mvp:capstone-hcc-source-control-latest')]:
            with self.assertRaises(ValueError):guard.candidate_scan_path(role, image)

    def test_apply_without_review_stops_before_commands_or_connection(self):
        with patch('sys.argv',['rollout','--apply','--candidate-manifest','unused.json']), patch.object(rollout.subprocess,'run') as execute:
            with self.assertRaisesRegex(ValueError,'EXACT_REVIEW_AND_PREFLIGHT_REQUIRED'):rollout.main()
            execute.assert_not_called()

    def test_exact_success_sequence_includes_rollback_before_final_promotion(self):
        adapter=Adapter();result=guard.promotion_sequence(adapter)
        self.assertEqual(result['status'],'PASS');self.assertEqual(result['rollback'],'PASS')
        self.assertEqual(adapter.calls,['preflight','control:candidate','ingress:candidate','verify:candidate',
          'ingress:baseline','control:baseline','verify:baseline','control:candidate','ingress:candidate','verify:candidate'])

    def test_preflight_failure_never_mutates_or_claims_rollback(self):
        adapter=Adapter(1);result=guard.promotion_sequence(adapter)
        self.assertEqual(adapter.calls,['preflight'])
        self.assertEqual(result['status'],'NOT VERIFIED');self.assertEqual(result['rollback'],'NOT REQUIRED')

    def test_every_partial_mutation_failure_attempts_both_baseline_roles(self):
        for stage in range(2,11):
            adapter=Adapter(stage);result=guard.promotion_sequence(adapter)
            self.assertEqual(result['status'],'FAIL')
            self.assertEqual(result['rollback'],'PASS')
            self.assertEqual(adapter.calls[-3:],['ingress:baseline','control:baseline','verify:baseline'])
            self.assertNotIn('synthetic failure',str(result))

    def test_recovery_failure_does_not_skip_other_role_or_report_pass(self):
        class Broken(Adapter):
            def activate(self,role,profile):
                self.calls.append(role+':'+profile)
                raise RuntimeError('always fails')
        adapter=Broken();result=guard.promotion_sequence(adapter)
        self.assertEqual(result['rollback'],'FAIL')
        self.assertEqual(adapter.calls[-3:],['ingress:baseline','control:baseline','verify:baseline'])

    def test_review_is_exact_and_content_bound(self):
        with tempfile.TemporaryDirectory() as name:
            root=pathlib.Path(name);(root/'evidence.json').write_bytes(b'{}')
            candidates={'a':'sha256:'+'a'*64,'control':'sha256:'+'b'*64,'ingress':'sha256:'+'c'*64}
            review={'review':'PASS','reviewer':'SYNTHETIC_TEST_REVIEWER','reviewDate':'2026-10-10','exceptions':[],
                    'candidates':candidates,'files':[{'path':'evidence.json','sha256':hashlib.sha256(b'{}').hexdigest()}]}
            guard.validate_review(root,review,candidates,['evidence.json'])
            for field,value in [('review','DRAFT / UNASSIGNED'),('reviewer',''),('exceptions',['unresolved']),('candidates',{}),('files',[])]:
                changed=copy.deepcopy(review);changed[field]=value
                with self.assertRaises(ValueError):guard.validate_review(root,changed,candidates,['evidence.json'])
            (root/'evidence.json').write_bytes(b'changed')
            with self.assertRaises(ValueError):guard.validate_review(root,review,candidates,['evidence.json'])

    def test_fresh_exact_preflight_required(self):
        now=datetime.now(timezone.utc);candidates={'control':'control','ingress':'ingress'}
        value={'status':'PASS','observedAt':now.isoformat(),'candidateControl':'control','candidateIngress':'ingress',
            'runtimeEnvironmentAndBindMountsMatch':True,'sourceOnlyConfigDelta':True,'rollbackImagesAvailable':True,'containersUnchanged':True}
        guard.validate_preflight(value,candidates,now)
        for field,bad in [('status','FAIL'),('candidateControl','other'),('sourceOnlyConfigDelta',False),
                          ('observedAt',(now-timedelta(hours=1)).isoformat()),('observedAt',(now+timedelta(seconds=1)).isoformat())]:
            changed=dict(value);changed[field]=bad
            with self.assertRaises(ValueError):guard.validate_preflight(changed,candidates,now)

    def test_remote_program_compiles_and_keeps_safety_boundaries(self):
        program=rollout.remote_program({}, {'control':'c','a':'a','ingress':'i'}, 'PUBLIC_TEST_CA')
        compile(program,'remote','exec')
        for expected in ["'--no-deps','--pull','never','--force-recreate',role",'ssl.create_default_context(cadata=CA)',
                         'source_only_config(self.baseline,self.candidate',"self.verify('baseline')",'os.O_NOFOLLOW',
                         'info.st_gid==65532','time.monotonic()+40',"pg['Id']==EXPECTED['protectedPostgresId']"]:
            self.assertIn(expected,program)
        for bad in ['CERT_NONE','verify=False',"'down'",'docker pull','registerHccCatalog','docker volume','randomBytes']:
            self.assertNotIn(bad,program)


if __name__=='__main__':unittest.main()
