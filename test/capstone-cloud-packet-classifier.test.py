import copy
import importlib.util
import pathlib
import re
import unittest
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('packet',ROOT/'scripts/capstone-cloud-packet-check.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PacketClassificationTest(unittest.TestCase):
    def test_exact_control_pins_only(self):
        self.assertEqual(module.pinned_program(module.LEGACY_CONTROL),module.PROGRAM)
        program=module.pinned_program(module.EXPIRY_CONTROL)
        self.assertIn(module.EXPIRY_CONTROL,program);self.assertNotIn(module.LEGACY_CONTROL,program)
        compile(program,'cloud-packet','exec')
        with self.assertRaises(ValueError):module.pinned_program('sha256:'+'0'*64)
    def packets(self):
        return {'source':{'negativeSyn':3,'positiveSyn':0,'lossFree':True},
                'destination':{'negativeSyn':0,'positiveSyn':1,'lossFree':True}}
    def test_full_observation(self):
        self.assertEqual(module.classify_packet_result('CONNECTED','ETIMEDOUT',self.packets()),'PASS')
    def test_timeout_is_not_denial_evidence_without_controls(self):
        for positive,negative in [('ECONNREFUSED','ETIMEDOUT'),('CONNECTED','EADDRINUSE'),('CONNECTED','ENOTFOUND')]:
            with self.subTest(negative=negative):self.assertEqual(module.classify_packet_result(positive,negative,self.packets()),'NOT VERIFIED')
    def test_unexpected_reachability_is_failure(self):
        self.assertEqual(module.classify_packet_result('CONNECTED','CONNECTED',{}),'FAIL')
    def test_loss_or_missing_headers_is_not_verified(self):
        for side,key,value in [('source','negativeSyn',0),('destination','negativeSyn',1),('destination','positiveSyn',0),('source','lossFree',False),('destination','lossFree',False)]:
            packets=copy.deepcopy(self.packets());packets[side][key]=value
            with self.subTest(key=key):self.assertEqual(module.classify_packet_result('CONNECTED','ETIMEDOUT',packets),'NOT VERIFIED')
        self.assertEqual(module.classify_packet_result('CONNECTED','ETIMEDOUT',{}),'NOT VERIFIED')
    def test_image_pins_and_capture_scope(self):
        pins=re.findall(r'sha256:([a-f0-9]+)',module.PROGRAM)
        self.assertEqual(len(pins),3);self.assertTrue(all(len(pin)==64 for pin in pins))
        self.assertIn('tcp-syn != 0',module.PROGRAM)
        self.assertNotIn("'-X'",module.PROGRAM)
        self.assertIn('start_new_session=True',module.PROGRAM)
        self.assertIn("'captureCleanup'",module.PROGRAM)
        self.assertIn('os.read(process.stderr.fileno(),4096)',module.PROGRAM)
        self.assertNotIn('process.stderr.readline()',module.PROGRAM)
        compile(module.PROGRAM,'packet-remote','exec')

if __name__=='__main__':unittest.main()
