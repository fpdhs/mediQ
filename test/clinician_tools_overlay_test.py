import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('release', ROOT/'scripts/clinician-preparation-release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)

class OverlayTests(unittest.TestCase):
    def test_patient_content_and_app_entry_preserved(self):
        page = (ROOT/'public/index.html').read_text(encoding='utf8')
        result = release.tools_overlay(page, page)
        self.assertEqual(page.split('id="hospital-saas-app"')[0], result.split('id="hospital-saas-app"')[0])
        self.assertEqual(result.count('src="/app.js"'), 1)
        self.assertEqual(result.count('id="clinician-tools"'), 1)
        self.assertEqual(result.count('id="demo-tool-return"'), 1)

    def test_missing_records_route_stops_staging(self):
        page = (ROOT/'public/index.html').read_text(encoding='utf8')
        deployed = page.replace('data-screen="records"', 'data-screen="unavailable-records"')
        with self.assertRaises(AssertionError):
            release.tools_overlay(deployed, page)

if __name__ == '__main__':
    unittest.main()
