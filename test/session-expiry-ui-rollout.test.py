import copy
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('session_ui_rollout_test', ROOT/'scripts/session-expiry-ui-rollout.py')
module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)


class RolloutBoundary(unittest.TestCase):
    def test_review_rejects_missing_decision_wrong_image_and_changed_source(self):
        with tempfile.TemporaryDirectory() as directory:
            saved = module.ROOT; module.ROOT = pathlib.Path(directory)
            try:
                entries = []
                for i in range(13):
                    path = module.ROOT/str(i); path.write_text('synthetic-test')
                    entries.append({'path':str(i),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
                value = {'review':'PASS','decision':'PASS','reviewer':'synthetic-reviewer','reviewDate':'2026-10-10','exceptions':[],
                    'scope':'EXACT_B_SESSION_EXPIRY_UI_CANDIDATE_AND_BOUND_EVIDENCE_ONLY','base':module.boundary.BASE,'candidate':module.boundary.CANDIDATE,
                    'files':entries[:5],'sources':entries[5:]}
                module.validate_review(value)
                for field, invalid in [('decision',None),('review','DRAFT'),('candidate',module.boundary.BASE),('exceptions',['unreviewed'])]:
                    changed = copy.deepcopy(value); changed[field] = invalid
                    with self.assertRaises(ValueError): module.validate_review(changed)
                (module.ROOT/'12').write_text('changed')
                with self.assertRaises(ValueError): module.validate_review(value)
            finally: module.ROOT = saved

    def test_remote_program_preserves_old_overlay_and_adds_one_new_file(self):
        program = module.promotion_program({}, 'synthetic-public-ca', '00:0c:29:a3:9e:1b')
        compile(program, '<reviewed-b-rollout>', 'exec')
        self.assertIn("overlay=stage+'/session-expiry-reviewed-20261010.yml'", program)
        self.assertNotIn("overlay=stage+'/faq-expiry-reviewed-20261010.yml'", program)
        self.assertIn('selected=files+[overlay]', program)
        self.assertIn('activate(base,files)', program)
        self.assertIn(module.boundary.BASE, program); self.assertIn(module.boundary.CANDIDATE, program)

    def test_historical_operator_stays_pinned_and_rollout_has_explicit_apply(self):
        original = (ROOT/'scripts/faq-expiry-rollout.py').read_text()
        self.assertNotIn('session-expiry-reviewed-20261010.yml', original)
        source = (ROOT/'scripts/session-expiry-ui-rollout.py').read_text()
        self.assertIn("parser.add_argument('--apply', action='store_true')", source)
        self.assertIn("if not args.apply:", source)
        self.assertIn('validate_review(review)', source)
        self.assertNotIn('AutoAddPolicy', source)


if __name__ == '__main__': unittest.main()
