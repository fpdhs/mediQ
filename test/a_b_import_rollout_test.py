import base64
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('single_import_rollout',ROOT/'scripts/a-b-import-rollout.py')
rollout=importlib.util.module_from_spec(spec);spec.loader.exec_module(rollout)


class ScopedImportRollout(unittest.TestCase):
    def test_control_patch_preserves_latest_unrelated_server_code(self):
        original="// existing Entra and patient integration\nconst translationRag='keep-current';\n"+\
            '    keyId: process.env.HIPASS_KEY_RELEASE_VAULT_KEY_ID,\n'+\
            "      clinicianPublicBaseUrl: process.env.AUTH_MODE==='ENTRA_OIDC'?process.env.HIPASS_PATIENT_IMAGE_ORIGIN:undefined,\n"
        snapshot={'files':[{'path':'src/server.js','sourceBase64':base64.b64encode(original.encode()).decode()}]}
        files=rollout.candidate_files('CLOUD',snapshot)
        server=files['src/server.js'].decode()
        self.assertEqual(server.count('pacsImportEnabled:'),2)
        self.assertIn("const translationRag='keep-current';",server)
        self.assertNotIn('createPacsTransferJobRuntime',server)
        self.assertFalse(any(path.startswith(('public/','db/')) for path in files))

    def test_source_anchor_ambiguity_is_rejected(self):
        for value in ['absent','anchoranchor']:
            with self.assertRaisesRegex(RuntimeError,'DEPLOYED_SOURCE_ANCHOR_MISMATCH'):
                rollout.replace_once(value,'anchor','replacement')

    def test_guest_and_inventory_programs_compile(self):
        compile(rollout.GUEST,'rollout-guest','exec')
        compile(rollout.inventory.PROGRAM,'inventory-guest','exec')


if __name__=='__main__':unittest.main()
