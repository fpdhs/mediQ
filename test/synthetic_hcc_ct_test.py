import re
import unittest

import numpy as np

from scripts.generate_synthetic_hcc_ct import (
    PHASES_DEMO,
    PHASES_FULL,
    Tissue,
    build_anatomy_volume,
    build_noise_volume,
    canonical_manifest_sha256,
    deterministic_uid,
    hu_to_stored_pixels,
    profile_definition,
    render_hu_frame,
)


class SyntheticHccCtTest(unittest.TestCase):
    def test_profile_counts_are_separate(self):
        full_phases, full_slices = profile_definition("full")
        demo_phases, demo_slices = profile_definition("demo")
        self.assertEqual((len(full_phases), full_slices), (4, 180))
        self.assertEqual((len(demo_phases), demo_slices), (3, 120))
        self.assertNotEqual([phase.key for phase in full_phases], [phase.key for phase in demo_phases])

    def test_uids_are_stable_unique_and_dicom_sized(self):
        study = deterministic_uid("study:test")
        series = deterministic_uid("series:test")
        self.assertEqual(study, deterministic_uid("study:test"))
        self.assertNotEqual(study, series)
        self.assertLessEqual(len(study), 64)
        self.assertRegex(study, re.compile(r"^2\.25\.[0-9]+$"))

    def test_manifest_hash_excludes_only_its_self_reference(self):
        manifest = {"profile": "full", "series": [1, 2], "canonicalManifestSha256": "old"}
        digest = canonical_manifest_sha256(manifest)
        manifest["canonicalManifestSha256"] = "different"
        self.assertEqual(digest, canonical_manifest_sha256(manifest))
        manifest["profile"] = "demo"
        self.assertNotEqual(digest, canonical_manifest_sha256(manifest))

    def test_volume_is_3d_and_contains_shared_lesion_and_organs(self):
        volume = build_anatomy_volume(7)
        self.assertEqual(volume.shape, (7, 512, 512))
        self.assertTrue(np.any(volume == Tissue.LIVER))
        self.assertTrue(np.any(volume == Tissue.LESION))
        self.assertTrue(np.any(volume == Tissue.BONE))
        lesion_per_slice = np.count_nonzero(volume == Tissue.LESION, axis=(1, 2))
        self.assertGreater(np.count_nonzero(lesion_per_slice), 1)

    def test_noise_repeats_with_the_same_seed(self):
        shape = (5, 64, 64)
        first = build_noise_volume(shape, 20261010)
        second = build_noise_volume(shape, 20261010)
        np.testing.assert_array_equal(first, second)

    def test_pixel_encoding_maps_hu_to_unsigned_twelve_bit_storage(self):
        pixels = hu_to_stored_pixels(np.array([[-1024.0, 0.0, 3071.0, 4000.0]], dtype=np.float32))
        self.assertEqual(pixels.dtype, np.dtype("<u2"))
        self.assertEqual(pixels.tolist(), [[0, 1024, 4095, 4095]])

    def test_phase_frame_reuses_geometry_but_changes_contrast_parameters(self):
        volume = build_anatomy_volume(5)
        texture = build_noise_volume(volume.shape, 20261010)
        noncontrast = render_hu_frame(volume, texture, PHASES_FULL[0], 2)
        arterial = render_hu_frame(volume, texture, PHASES_FULL[1], 2)
        self.assertEqual(noncontrast.shape, (512, 512))
        liver = volume[2] == Tissue.LIVER
        lesion = volume[2] == Tissue.LESION
        self.assertGreater(float(arterial[liver].mean()), float(noncontrast[liver].mean()))
        self.assertGreater(float(arterial[lesion].mean()), float(noncontrast[lesion].mean()))
        self.assertEqual(PHASES_DEMO, PHASES_FULL[:3])


if __name__ == "__main__":
    unittest.main()
