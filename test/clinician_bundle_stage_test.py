import importlib.util,pathlib,re,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('bundle',ROOT/'scripts/clinician-bundle-stage.py')
bundle=importlib.util.module_from_spec(spec);spec.loader.exec_module(bundle)
class BundleTests(unittest.TestCase):
    def test_complete_routes_and_preserved_patient(self):
        local=(ROOT/'public/index.html').read_text(encoding='utf8')
        result=bundle.overlay(local,local)
        for ident in ['patient-portal-app','hospital-saas-app']:
            a,b=bundle.region(local,ident);x,y=bundle.region(result,ident)
            self.assertEqual(local[a:b],result[x:y])
        self.assertEqual(result.count('id="clinician-tools"'),1)
    def test_dependency_closure_keeps_auth_out(self):
        files=bundle.dependencies()
        self.assertNotIn('public/capstone-auth.js',files)
        self.assertIn('public/ui/clinician-health.js',files)
        self.assertIn('public/ui/security-timeline.js',files)
        self.assertIn('public/ui/hospital-vault.js',files)
        self.assertFalse(any(f.startswith(('src/','public/mobile/')) for f in files))
    def test_missing_menu_blocks_candidate(self):
        local=(ROOT/'public/index.html').read_text(encoding='utf8')
        with self.assertRaises(AssertionError):bundle.overlay(local,local.replace('data-view="records"','data-view="missing"'))
    def test_deployed_old_workspace_is_replaced_completely(self):
        local=(ROOT/'public/index.html').read_text(encoding='utf8')
        a,b=bundle.region(local,'hospital-saas-app')
        original=local[:a]+'<div id="hospital-saas-app"><section data-screen="dashboard">Legacy</section></div>'+local[b:]
        result=bundle.overlay(original,local)
        a,b=bundle.region(local,'hospital-saas-app');x,y=bundle.region(result,'hospital-saas-app')
        self.assertEqual(local[a:b],result[x:y])
        sheets,scripts=bundle.entry_assets(local)
        actual_sheets,actual_scripts=bundle.entry_assets(result)
        self.assertEqual(actual_sheets[:len(sheets)],sheets)
        self.assertTrue(set(scripts).issubset(actual_scripts))
    def test_shared_style_dependencies_are_included(self):
        files=bundle.dependencies()
        for path in ['public/styles.css','public/ui/tokens.css','public/ui/components.css','public/ui/workspace.css','public/qrcode.js','public/jsqr.js']:
            self.assertIn(path,files)
if __name__=='__main__':unittest.main()
