import unittest

from scripts.synthetic_hcc_orthanc import validate_endpoint


class SyntheticHccOrthancBoundaryTest(unittest.TestCase):
    def test_seed_is_limited_to_tls_hospital_a(self):
        self.assertEqual(validate_endpoint("https://orthanc-a:8042", "seed"), ("orthanc-a", 8042))
        with self.assertRaisesRegex(ValueError, "SOURCE_SEED_HOSPITAL_A_ONLY"):
            validate_endpoint("https://orthanc-b:8042", "seed")

    def test_other_modes_are_limited_to_test_hospital_names_and_port(self):
        self.assertEqual(validate_endpoint("https://orthanc-b:8042/", "verify"), ("orthanc-b", 8042))
        for endpoint in (
            "http://orthanc-a:8042", "https://example.com:8042", "https://orthanc-a:443",
            "https://user:pass@orthanc-a:8042", "https://orthanc-a:8042/path", "https://orthanc-b:8042?x=1",
        ):
            with self.subTest(endpoint=endpoint), self.assertRaisesRegex(ValueError, "ORTHANC_ENDPOINT_DENIED"):
                validate_endpoint(endpoint, "verify")


if __name__ == "__main__":
    unittest.main()
