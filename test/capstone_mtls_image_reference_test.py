import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('mtls_ref',ROOT/'scripts/capstone-mtls-check.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


class MtlsImageReferenceTest(unittest.TestCase):
    def test_exact_digest_or_existing_tag(self):
        digest='sha256:'+'a'*64
        module.validate_image_reference(digest,digest)
        module.validate_image_reference('highpass-platform-mvp:capstone-20261010',digest)

    def test_no_mismatched_digest_or_shell_input(self):
        digest='sha256:'+'a'*64
        for image,pin in [('sha256:'+'b'*64,digest),('other:latest',digest),('highpass-platform-mvp:capstone-ok;whoami',digest),(digest,'sha256:no')]:
            with self.assertRaises(ValueError):module.validate_image_reference(image,pin)


if __name__=='__main__':unittest.main()
