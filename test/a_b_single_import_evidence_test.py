import copy
import importlib.util
import json
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('single_evidence',ROOT/'scripts/a-b-single-import-evidence.py')
evidence=importlib.util.module_from_spec(spec);spec.loader.exec_module(evidence)

class IndependentImportEvidence(unittest.TestCase):
    def setUp(self):
        self.pacs={'status':'PASS','sopInstanceUid':evidence.SOP,'sha256':evidence.HASH,'bytes':3146808,'orthancId':'destination'}
        actions=['TOKEN_ISSUED','KEY_WRAP_AUTHORIZED','KEY_RELEASE_PREPARED','DATA_PLANE_RESPONSE_PREPARED',
                 'KEY_RELEASE_PRECHECKED','KEY_RELEASE_CONSUMED','PACS_IMPORT_AUTHORIZED','PACS_INSTANCE_VERIFIED']
        self.events=[{'audit_session_id':'one-session','consent_id':'owned-consent','action':action,'result':'SUCCESS',
                      'source_hospital_id':'HOSP-A','target_hospital_id':'HOSP-B','sop_instance_uid':evidence.SOP,
                      'reason':json.dumps({'verification':'AUTHENTICATED_B_REPORT',**{key:self.pacs[key] for key in ['sha256','bytes','orthancId']}})} for action in actions]

    def test_complete_real_receipt_chain_passes(self):
        self.assertEqual(evidence.validate_evidence(self.pacs,self.events),{'auditSessionId':'one-session','consentId':'owned-consent'})

    def test_missing_crypto_and_mutation_authorization_fail(self):
        for action in ['KEY_WRAP_AUTHORIZED','KEY_RELEASE_CONSUMED','PACS_IMPORT_AUTHORIZED']:
            with self.subTest(action=action),self.assertRaises(RuntimeError):
                evidence.validate_evidence(self.pacs,[row for row in self.events if row['action']!=action])

    def test_different_sessions_and_hospitals_fail(self):
        for mutation in ['audit_session_id','target_hospital_id','consent_id']:
            events=copy.deepcopy(self.events);events[0][mutation]='different'
            with self.subTest(mutation=mutation),self.assertRaises(RuntimeError):evidence.validate_evidence(self.pacs,events)

    def test_pixel_hash_and_final_report_conflicts_fail(self):
        pacs={**self.pacs,'sha256':'wrong'}
        with self.assertRaises(RuntimeError):evidence.validate_evidence(pacs,self.events)
        events=copy.deepcopy(self.events);events[-1]['reason']=json.dumps({'verification':'AUTHENTICATED_B_REPORT','sha256':evidence.HASH,'bytes':3146808,'orthancId':'different'})
        with self.assertRaises(RuntimeError):evidence.validate_evidence(self.pacs,events)

    def test_remote_requery_program_compiles(self):compile(evidence.B_QUERY,'b-requery','exec')

if __name__=='__main__':unittest.main()
