import copy
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('expiry_audit',ROOT/'scripts/capstone-phantom-audit-check.py')
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ExpiryReferenceTest(unittest.TestCase):
    def receipt(self):
        return {'result':'PASS','expiration':'PASS','scope':'FRESH_PHANTOM_MOBILE_UI_REAL_TIME_EXPIRY',
                'expiryStatusReceipt':{'httpStatus':200,'status':'EXPIRED','consentMatches':True,'ticketMatches':True,'expiryMatches':True},
                'checks':[{'test':'REAL_DEADLINE_QR_REMOVAL_EXACT_SERVER_EXPIRY_AND_REDEMPTION_DENY','status':'PASS'}],
                'ownedConsentCleanup':[{'status':'PASS'}], 'ownedReceipts':[{
                    'consentId':'consent_0123456789abcdef','ticketId':'ticket_0123456789abcdef',
                    'patientId':'HP-TEST-PHANTOM-001','sourceHospitalId':'HOSP-A','targetHospitalId':'HOSP-B'}]}

    def test_only_public_exact_reference_is_returned(self):
        receipt=self.receipt()
        self.assertEqual(set(module.expiry_reference(receipt)),{'consentId','ticketId','patientId'})
        self.assertEqual(receipt,self.receipt())

    def test_missing_success_or_cleanup_is_rejected(self):
        for field,value in [('result','FAIL'),('expiration','NOT VERIFIED'),('scope','OTHER'),('ownedConsentCleanup',[])]:
            receipt=self.receipt();receipt[field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):module.expiry_reference(receipt)

    def test_existing_unpadded_two_uint32_identifier_contract(self):
        for suffix in ['00','d74d6fb9de2b603','0123456789abcdef']:
            receipt=self.receipt()
            receipt['ownedReceipts'][0].update(consentId='consent_'+suffix,ticketId='ticket_'+suffix)
            self.assertEqual(module.expiry_reference(receipt)['consentId'],'consent_'+suffix)
        for suffix in ['','0','0'*17,'AB','ab;select','ab\n']:
            receipt=self.receipt();receipt['ownedReceipts'][0]['consentId']='consent_'+suffix
            with self.subTest(suffix=suffix),self.assertRaises(ValueError):module.expiry_reference(receipt)

    def test_ownership_and_identifiers_are_not_guessed(self):
        for field,value in [('patientId','P-1001'),('sourceHospitalId','HOSP-B'),('targetHospitalId','HOSP-A'),('consentId','untrusted'),('ticketId','untrusted')]:
            receipt=self.receipt();receipt['ownedReceipts'][0][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):module.expiry_reference(receipt)

    def test_zero_or_multiple_receipts_are_rejected(self):
        for count in [0,2]:
            receipt=self.receipt();receipt['ownedReceipts']=[copy.deepcopy(receipt['ownedReceipts'][0]) for _ in range(count)]
            with self.subTest(count=count),self.assertRaises(ValueError):module.expiry_reference(receipt)

    def test_client_only_expiry_or_wrong_binding_is_rejected(self):
        for field,value in [('status','ISSUED'),('ticketMatches',False),('httpStatus',503)]:
            receipt=self.receipt();receipt['expiryStatusReceipt'][field]=value
            with self.subTest(field=field),self.assertRaises(ValueError):module.expiry_reference(receipt)
        receipt=self.receipt();receipt['checks']=[]
        with self.assertRaises(ValueError):module.expiry_reference(receipt)

if __name__=='__main__':unittest.main()
