import hashlib
import importlib.util
import json
import pathlib
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('file_operator',ROOT/'scripts/hcc-source-file-assets.py')
operator=importlib.util.module_from_spec(spec);spec.loader.exec_module(operator)


class Channel:
    def __init__(self,result,stderr=b''):
        self.output=json.dumps(result).encode();self.error=stderr;self.input=b'';self.closed=False
    def settimeout(self,value):pass
    def sendall(self,value):self.input+=value
    def shutdown_write(self):pass
    def recv_ready(self):return bool(self.output)
    def recv(self,limit):value=self.output[:limit];self.output=self.output[limit:];return value
    def recv_stderr_ready(self):return bool(self.error)
    def recv_stderr(self,limit):value=self.error[:limit];self.error=self.error[limit:];return value
    def exit_status_ready(self):return True
    def recv_exit_status(self):return 0
    def close(self):self.closed=True


class Client:
    def __init__(self,result,stderr=b''):self.channel=Channel(result,stderr);self.command=None
    def exec_command(self,command,**options):
        self.command=command
        response=type('Response',(),{'channel':self.channel})()
        return None,response,None


class FileOperatorBoundary(unittest.TestCase):
    def test_apply_without_review_stops_before_any_files_or_connection(self):
        with patch('sys.argv',['operator','--apply','--candidate-manifest','unused']), \
             patch.object(operator,'manifest_bytes') as read:
            with self.assertRaisesRegex(ValueError,'EXACT_SOURCE_FILE_REVIEW_REQUIRED'):operator.main()
            read.assert_not_called()
    def test_credentials_use_stdin_not_command_and_stderr_is_discarded(self):
        client=Client({'status':'PASS','role':'a','sourceFilesVerified':True,'credentialReturned':False},b'unknown private error')
        payload={'token':'synthetic-channel-test-only'}
        result=operator.exchange(client,'a','install',payload,'synthetic-sudo-test-only')
        self.assertEqual(result['status'],'PASS')
        self.assertIn(b'synthetic-sudo-test-only\n',client.channel.input)
        self.assertIn(b'synthetic-channel-test-only',client.channel.input)
        self.assertNotIn('synthetic-channel-test-only',client.command)
        self.assertNotIn('synthetic-sudo-test-only',client.command)
        self.assertNotIn('private',str(result));self.assertTrue(client.channel.closed)
    def test_unknown_output_or_wrong_role_is_rejected_and_channel_closed(self):
        for result in [{'status':'PASS','role':'cloud','sourceFilesVerified':True,'credentialReturned':False},
                       {'status':'PASS','role':'a','token':'must-not-be-returned'},
                       {'status':'PASS','role':'a','canCreateExclusiveSourceFiles':True,'contentsRead':True}]:
            client=Client(result)
            with self.assertRaises(ValueError):operator.exchange(client,'a','preflight')
            self.assertTrue(client.channel.closed)
    def test_cloud_payload_has_no_manifest_or_patient_metadata(self):
        cloud=operator.Adapter(None,'cloud',b'private manifest')
        self.assertEqual(cloud.payload(b'synthetic-test-token'),{'token':'synthetic-test-token'})
        a=operator.Adapter(None,'a',b'{}')
        self.assertEqual(a.payload(b'synthetic-test-token')['manifestSha256'],hashlib.sha256(b'{}').hexdigest())
        with self.assertRaisesRegex(ValueError,'ROLE_MANIFEST_PAYLOAD_REQUIRED'):cloud.install(b'token',b'{}')
    def test_fixed_actual_manifest_contract_and_inventory_without_pacs_claim(self):
        value=operator.manifest_bytes();self.assertGreater(len(value),0)
        self.assertEqual(json.loads(value)['totalInstances'],700)


if __name__=='__main__':unittest.main()
