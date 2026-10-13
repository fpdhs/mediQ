import copy
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('manager',ROOT/'scripts/clinician-ui.py')
manager=importlib.util.module_from_spec(spec);spec.loader.exec_module(manager)

class UnifiedUiTests(unittest.TestCase):
    def test_failed_served_check_writes_failure_evidence(self):
        import json,io,contextlib,urllib.error
        with tempfile.TemporaryDirectory() as temp:
            folder=pathlib.Path(temp)
            with patch.object(manager.sys,'argv',['clinician-ui.py','check','--folder',temp,'--url','http://127.0.0.1:3000']),patch.object(manager,'load_bundle',return_value=(folder,{'hashes':{},'captureMode':'snapshot'},{'revision':'test'})),patch.object(manager,'check_served',side_effect=urllib.error.URLError('test transport failure')),contextlib.redirect_stdout(io.StringIO()),self.assertRaises(SystemExit):
                manager.main()
            report=json.loads((folder/'served-parity-local.json').read_text())
            self.assertEqual(report['status'],'FAIL')
    def test_live_probe_uses_issued_doctor_token_not_last_request(self):
        script=(ROOT/'scripts/clinician-ui-live-check.js').read_text(encoding='utf8')
        self.assertIn('issued.profiles.DOCTOR',script)
        self.assertNotIn('request.headers(',script)
        self.assertIn("pixelRequests.push('PIXEL_REQUEST')",script)
    def test_rollback_compares_environment_values_not_order(self):
        program=manager.rollback_program([], 'candidate')
        self.assertIn("dict(v.split('=',1) for v in restored['Config']['Env'])",program)
        self.assertNotIn("restored['Config']['Env']==current['Config']['Env']",program)
    def test_identity_changes_when_clinician_markup_changes(self):
        html=(ROOT/'public/index.html').read_text(encoding='utf8')
        a=manager.bundle.source_identity(html)
        b=manager.bundle.source_identity(html.replace('다음 진료, 바로 이어가세요.','다음 검사를 확인하세요.'))
        self.assertNotEqual(a['revision'],b['revision'])
    def test_identity_does_not_depend_on_patient_markup(self):
        html=(ROOT/'public/index.html').read_text(encoding='utf8')
        start,end=manager.bundle.region(html,'patient-portal-app')
        changed=html[:start]+html[start:end].replace('환자','환자 시연')+html[end:]
        self.assertEqual(manager.bundle.source_identity(html),manager.bundle.source_identity(changed))
    def test_old_image_evidence_cannot_authorize_current_release(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);p=root/'report.json'
            p.write_text('{"image":"old","sourceRevision":"old","checks":{}}')
            with patch.object(manager,'ROOT',root),self.assertRaisesRegex(AssertionError,'FLOW_REPORT_VERSION_MISMATCH'):
                manager.validate_flow_report('report.json',root,'new','new')
    def test_mock_or_missing_authenticated_checks_block_release(self):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);p=root/'report.json'
            p.write_text('{"image":"new","sourceRevision":"new","checks":{"clinician_login":"NOT VERIFIED"}}')
            with patch.object(manager,'ROOT',root),self.assertRaisesRegex(AssertionError,'AUTHENTICATED_REGRESSION_REQUIRED'):
                manager.validate_flow_report('report.json',root,'new','new')
    def test_snapshot_content_drift_is_rejected(self):
        # Test on an isolated directory, using the real source identity and copied bytes.
        import json,shutil
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp);folder=root/'artifacts/workstation/test';context=folder/'build-context'
            identity=manager.bundle.source_identity()
            html=(ROOT/'public/index.html').read_text(encoding='utf8')
            (context/'public').mkdir(parents=True)
            for name in identity['sourceHashes']:
                path=context/name;path.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,path)
            original=html.replace('\n','\r\n')
            candidate=manager.bundle.overlay(original,html)
            (context/'public/index.html').write_text(candidate,encoding='utf8',newline='')
            (context/'public/clinician-ui-version.js').write_text('export default '+json.dumps(identity)+';\n')
            (folder/'baseline-index.html').write_text(original,encoding='utf8',newline='')
            a,b=manager.bundle.region(original,'patient-portal-app')
            hashes={name:manager.sha((context/name).read_bytes()) for name in list(identity['sourceHashes'])+['public/index.html','public/clinician-ui-version.js']}
            manifest=dict(schema=manager.bundle.SCHEMA,sourceRevision=identity['revision'],hashes=hashes,patientHtmlSha256=manager.sha(original[a:b].encode()))
            (folder/'manifest.json').write_text(json.dumps(manifest))
            with patch.object(manager,'ROOT',root):
                manager.load_bundle(str(folder))
                (context/'public/ui/clinician.css').write_text('changed')
                with self.assertRaisesRegex(AssertionError,'BUNDLE_BYTES_CHANGED'):
                    manager.load_bundle(str(folder))

if __name__=='__main__':unittest.main()
