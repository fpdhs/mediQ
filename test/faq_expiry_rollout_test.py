import copy
import importlib.util
import json
import hashlib
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timezone, timedelta

root=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('faq_rollout',root/'scripts/faq-expiry-rollout.py')
rollout=importlib.util.module_from_spec(spec);spec.loader.exec_module(rollout)


class RolloutBoundary(unittest.TestCase):
    def setUp(self):
        temporary=tempfile.TemporaryDirectory();self.addCleanup(temporary.cleanup)
        testroot=pathlib.Path(temporary.name);files=[]
        for name in sorted(rollout.EVIDENCE):
            path=testroot/name;path.parent.mkdir(parents=True,exist_ok=True)
            payload=b'{"syntheticTestEvidence":true}\n';path.write_bytes(payload)
            files.append({'path':name,'sha256':hashlib.sha256(payload).hexdigest()})
        replacement=patch.object(rollout,'ROOT',testroot);replacement.start();self.addCleanup(replacement.stop)
        self.manifest={'review':'PASS','reviewer':'SYNTHETIC-REVIEWER','reviewDate':'2026-10-10','exceptions':[],
                       'candidates':{'ui':rollout.plan.UI,'control':rollout.plan.CONTROL},'files':files}
        self.receipt={'status':'PASS','role':'B','baselineImage':rollout.plan.UI_BASE,'candidateImage':rollout.plan.UI,'observedAt':datetime.now(timezone.utc).isoformat(),'nonImageConfigDifferences':0,'runtimeEnvironmentAndBindMountsMatch':True,'rollbackImageAvailable':True}

    def test_exact_review(self):
        rollout.validate_review(self.manifest)
        for field,value in [('review','DRAFT'),('reviewer',''),('exceptions',['unresolved']),('candidates',{}),('files',self.manifest['files'][:-1])]:
            bad=copy.deepcopy(self.manifest);bad[field]=value
            with self.assertRaises(ValueError):rollout.validate_review(bad)

    def test_changed_evidence_rejected(self):
        bad=copy.deepcopy(self.manifest);bad['files'][0]['sha256']='0'*64
        with self.assertRaises(ValueError):rollout.validate_review(bad)

    def test_fresh_exact_preflight(self):
        rollout.validate_preflight('B',self.receipt)
        for field,value in [('status','FAIL'),('role','CLOUD'),('candidateImage',rollout.plan.CONTROL),('nonImageConfigDifferences',1),('runtimeEnvironmentAndBindMountsMatch',False),('rollbackImageAvailable',False),('observedAt',(datetime.now(timezone.utc)-timedelta(hours=2)).isoformat())]:
            bad=copy.deepcopy(self.receipt);bad[field]=value
            with self.assertRaises(ValueError):rollout.validate_preflight('B',bad)

    def test_remote_syntax_and_rollback_guards(self):
        for role in ['B','CLOUD']:
            program=rollout.promotion_program(role,{},'PUBLIC_SYNTHETIC_CA')
            compile(program,'remote','exec')
            self.assertIn("'--no-deps','--pull','never','--force-recreate',service",program)
            self.assertIn('activate(base,files)',program)
            self.assertIn('ssl.create_default_context(cadata=CA)',program)
            self.assertNotIn('CERT_NONE',program)


if __name__=='__main__':unittest.main()
