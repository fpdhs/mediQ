import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('mobile_rollout', ROOT / 'scripts/capstone-mobile-b-rollout.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ScreeningRolloutTest(unittest.TestCase):
    def test_exact_chain_and_reject_changed_overlay(self):
        stage='/home/server/.highpass-app-2026-10-08T21-31-00.357148+00-00'
        hashes=['2f816a95229a6d6b','16f08909fbda67fc','0b384d41e87a5d62','d506464be529e2d7','39c90099f9b9d980','281def9e6c73768e','083ac58576c206e1','d19c3f3aef605e6d','274828c4024b9e3d','c15f391556ea23fc','575ac324f495cc2d','5b86a9d33d74a7a4','7031ff65358cb3c0','1542825d8ce5fba6','2e56b6d1043e4761','62396d56ab6d53db','1a62fa81c7a91953']
        names=['portal.yml','encryption.yml','patient.yml','faq-expiry-reviewed-20261010.yml','session-expiry-reviewed-20261010.yml']+['landing-'+h+'.yml' for h in hashes]
        labels={'com.docker.compose.project':'hp-capstone-b-portal','com.docker.compose.project.working_dir':stage,'com.docker.compose.project.config_files':','.join(stage+'/'+n for n in names)}
        image='sha256:1a62fa81c7a91953f9b86ce040f05c93610c57a5b59e2366d02f8a3d93ee6141'
        self.assertEqual(len(module.validated_context(labels,True,image)[1]),22)
        next_labels=dict(labels)
        next_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-7015bff17490ea62.yml'
        next_image='sha256:7015bff17490ea620895f0f272df899e82019b02a6ed00757bc4258cc6df7905'
        self.assertEqual(len(module.validated_context(next_labels,True,next_image)[1]),23)
        current_labels=dict(next_labels)
        current_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-f1fdd1bd635b15f5.yml'
        current_image='sha256:f1fdd1bd635b15f5ec93f61a3ffe7d23a1ae3a3ef490ac90fa7fd420ad1ca23a'
        self.assertEqual(len(module.validated_context(current_labels,True,current_image)[1]),24)
        domestic_labels=dict(current_labels)
        domestic_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-fd703f2097189470.yml'
        domestic_image='sha256:fd703f20971894700be1c82498c3ee871df04a3aaa4a53872b6aa7c19d0061ce'
        self.assertEqual(len(module.validated_context(domestic_labels,True,domestic_image)[1]),25)
        disclosure_labels=dict(domestic_labels)
        disclosure_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-0c6a5d45fe59889b.yml'
        disclosure_image='sha256:0c6a5d45fe59889b27709b08e089fced65dc31ae53f1b4d5aad3fe1a4d4b606a'
        self.assertEqual(len(module.validated_context(disclosure_labels,True,disclosure_image)[1]),26)
        sage_labels=dict(disclosure_labels)
        sage_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-ae7365a62702ff13.yml'
        sage_image='sha256:ae7365a62702ff13d352c1f1ed9be12ab7a37c7858b970f1ffeebe543c822ce6'
        self.assertEqual(len(module.validated_context(sage_labels,True,sage_image)[1]),27)
        fix_labels=dict(sage_labels)
        fix_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-b1994ea392d79b95.yml'
        fix_image='sha256:b1994ea392d79b952bbbe5f044362643199a864ea079f14bb3836b79b189c3aa'
        self.assertEqual(len(module.validated_context(fix_labels,True,fix_image)[1]),28)
        helper_labels=dict(fix_labels)
        helper_labels['com.docker.compose.project.config_files']+=','+stage+'/landing-792b4e3b82b8cd3e.yml'
        helper_image='sha256:792b4e3b82b8cd3e0aaa8652b7924d4162757a8012c434d9889f28af86c96685'
        self.assertEqual(len(module.validated_context(helper_labels,True,helper_image)[1]),29)
        with self.assertRaises(RuntimeError):module.validated_context(helper_labels,True,fix_image)
        with self.assertRaises(RuntimeError):module.validated_context(fix_labels,True,sage_image)
        bad_sage=dict(sage_labels)
        bad_sage['com.docker.compose.project.config_files']=bad_sage['com.docker.compose.project.config_files'].replace('landing-ae7365a62702ff13.yml','untrusted.yml')
        with self.assertRaises(RuntimeError):module.validated_context(bad_sage,True,sage_image)
        with self.assertRaises(RuntimeError):module.validated_context(sage_labels,True,disclosure_image)
        with self.assertRaises(RuntimeError):module.validated_context(disclosure_labels,True,domestic_image)
        bad_disclosure=dict(disclosure_labels)
        bad_disclosure['com.docker.compose.project.config_files']=bad_disclosure['com.docker.compose.project.config_files'].replace('landing-0c6a5d45fe59889b.yml','untrusted.yml')
        with self.assertRaises(RuntimeError):module.validated_context(bad_disclosure,True,disclosure_image)
        with self.assertRaises(RuntimeError):module.validated_context(domestic_labels,True,current_image)
        bad_domestic=dict(domestic_labels)
        bad_domestic['com.docker.compose.project.config_files']=bad_domestic['com.docker.compose.project.config_files'].replace('landing-fd703f2097189470.yml','untrusted.yml')
        with self.assertRaises(RuntimeError):module.validated_context(bad_domestic,True,domestic_image)
        with self.assertRaises(RuntimeError):module.validated_context(current_labels,True,next_image)
        wrong=dict(current_labels)
        wrong['com.docker.compose.project.config_files']=wrong['com.docker.compose.project.config_files'].replace('landing-f1fdd1bd635b15f5.yml','untrusted.yml')
        with self.assertRaises(RuntimeError):module.validated_context(wrong,True,current_image)
        with self.assertRaises(RuntimeError):module.validated_context(next_labels,True,image)
        for altered in [image.replace('1a62','2a62'),None]:
            with self.assertRaises(RuntimeError):module.validated_context(labels,True,altered)
        labels['com.docker.compose.project.config_files']=labels['com.docker.compose.project.config_files'].replace('landing-1a62fa81c7a91953.yml','untrusted.yml')
        with self.assertRaises(RuntimeError):module.validated_context(labels,True,image)

if __name__=='__main__':unittest.main()
