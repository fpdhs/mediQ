import copy
import importlib.util
import pathlib
import re
import unittest
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('hospital_packet',ROOT/'scripts/capstone-hospital-packet-check.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class HospitalPacketClassificationTest(unittest.TestCase):
    def test_exact_portal_pins_only(self):
        self.assertEqual(module.pinned_b_program(module.LEGACY_PORTAL),module.B_PROGRAM)
        program=module.pinned_b_program(module.FAQ_PORTAL)
        self.assertIn(module.FAQ_PORTAL,program);self.assertNotIn(module.LEGACY_PORTAL,program)
        compile(program,'hospital-packet','exec')
        session=module.pinned_b_program(module.SESSION_PORTAL)
        self.assertIn(module.SESSION_PORTAL,session);self.assertNotIn(module.LEGACY_PORTAL,session)
        compile(session,'session-hospital-packet','exec')
        with self.assertRaises(ValueError):module.pinned_b_program('sha256:'+'0'*64)
    def captures(self):
        return {'source':{'negativeSyn':1,'positiveSyn':0,'lossFree':True,'cleanup':True,'headers':'IP 172.18.0.2.60252 > 192.168.111.129.8042: Flags [S], seq 1234,'},
                'host':{'negativeSyn':1,'positiveSyn':0,'lossFree':True,'cleanup':True,'headers':'IP 192.168.111.149.60252 > 192.168.111.129.8042: Flags [S], seq 1234,'},
                'destination':{'negativeSyn':0,'positiveSyn':1,'lossFree':True,'cleanup':True}}
    def test_three_points_with_positive_control(self):
        captures=self.captures();before=copy.deepcopy(captures)
        self.assertEqual(module.classify('CONNECTED','ECONNREFUSED',captures),'PASS')
        self.assertEqual(captures,before)
    def test_connected_direct_access_is_failure(self):
        self.assertEqual(module.classify('CONNECTED','CONNECTED',{}),'FAIL')
    def test_transport_errors_are_not_policy_denials(self):
        for positive,negative in [('ECONNREFUSED','ECONNREFUSED'),('CONNECTED','ETIMEDOUT'),('CONNECTED','EADDRINUSE'),('CONNECTED','ENOTFOUND')]:
            with self.subTest(negative=negative):self.assertEqual(module.classify(positive,negative,self.captures()),'NOT VERIFIED')
    def test_missing_or_lossy_observation_is_not_verified(self):
        for side,key,value in [('source','negativeSyn',0),('host','negativeSyn',0),('destination','negativeSyn',1),('destination','positiveSyn',0),('destination','lossFree',False),('source','cleanup',False)]:
            captures=self.captures();captures[side][key]=value
            with self.subTest(side=side,key=key):self.assertEqual(module.classify('CONNECTED','ECONNREFUSED',captures),'NOT VERIFIED')
        self.assertEqual(module.classify('CONNECTED','ECONNREFUSED',{}),'NOT VERIFIED')
        captures=self.captures();captures['host']['headers']=captures['host']['headers'].replace('1234','5678')
        self.assertEqual(module.classify('CONNECTED','ECONNREFUSED',captures),'NOT VERIFIED')
    def test_exact_images_bounded_header_capture_and_public_host_target(self):
        pins=re.findall(r'sha256:([a-f0-9]+)',module.A_PROGRAM+module.B_PROGRAM)
        self.assertEqual(len(pins),3);self.assertTrue(all(len(pin)==64 for pin in pins))
        self.assertIn("'192.168.111.129',60252",module.B_PROGRAM)
        self.assertIn('tcp-syn != 0',module.COMMON)
        self.assertIn('os.read(process.stderr.fileno(),4096)',module.COMMON)
        self.assertNotIn("'-X'",module.COMMON)
        self.assertIn("['timeout','20s']",module.COMMON)
        self.assertIn('start_new_session=True',module.COMMON)
        compile(module.A_PROGRAM,'A-packet','exec');compile(module.B_PROGRAM,'B-packet','exec')

if __name__=='__main__':unittest.main()
