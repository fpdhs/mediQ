from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import numpy as np
from PIL import Image
from pydicom import dcmread

from scripts.generate_reference_anchored_synthetic_ct import (
    EXPECTED_ANCHORS,
    PATIENT_ID,
    PATIENT_NAME,
    canonical_manifest_sha256,
    generate_dataset,
    validate_dataset,
)


class ReferenceAnchoredSyntheticCtTest(unittest.TestCase):
    def _fixtures(self, root: Path) -> list[Path]:
        paths: list[Path] = []
        yy, xx = np.mgrid[0:64, 0:64]
        for index in range(EXPECTED_ANCHORS):
            # Distinct, smoothly changing synthetic grayscale patterns.
            values = (70 + index * 8 + xx // 2 + yy // 3 + ((xx - index) ** 2 // 31)) % 240
            path = root / f"anchor-{index + 1:02d}.png"
            Image.fromarray(values.astype(np.uint8), mode="L").save(path)
            paths.append(path)
        return paths

    def test_generates_700_derived_instances_and_preserves_anchor_planes(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            anchors_dir = workspace / "inputs"
            anchors_dir.mkdir()
            anchors = self._fixtures(anchors_dir)
            output = workspace / "artifacts" / "synthetic-hcc-ct" / "candidate"

            result = generate_dataset(anchors, output, workspace)

            self.assertEqual(result["status"], "PASS")
            self.assertEqual(result["instances"], 700)
            self.assertEqual(result["seriesCount"], 1)
            self.assertEqual(result["uniqueSopInstanceUids"], 700)
            self.assertEqual(result["inputAnchorCount"], 10)
            self.assertEqual(result["review"], "DRAFT / UNASSIGNED")
            self.assertFalse(result["clinicalUse"])
            self.assertFalse(result["huCalibrated"])

            manifest = json.loads((output / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["canonicalManifestSha256"], canonical_manifest_sha256(manifest))
            self.assertEqual(manifest["anchorPlacementInstanceNumbers"], [1, 79, 156, 234, 312, 389, 467, 545, 622, 700])

            for anchor_path, instance_number in zip(anchors, manifest["anchorPlacementInstanceNumbers"], strict=True):
                record = manifest["instances"][instance_number - 1]
                dicom = dcmread(output / record["file"])
                source = np.asarray(Image.open(anchor_path).convert("L"), dtype=np.uint16)
                self.assertTrue(np.array_equal(dicom.pixel_array, source * 257))
                self.assertEqual(str(dicom.PatientID), PATIENT_ID)
                self.assertEqual(str(dicom.PatientName), PATIENT_NAME)
                self.assertEqual(str(dicom.RescaleType), "US")
                self.assertEqual(list(dicom.ImageType), ["DERIVED", "SECONDARY", "AXIAL", "SYNTHETIC"])

    def test_rejects_duplicate_anchor_pixels(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            anchors_dir = workspace / "inputs"
            anchors_dir.mkdir()
            anchors = self._fixtures(anchors_dir)
            anchors[-1].write_bytes(anchors[0].read_bytes())
            output = workspace / "artifacts" / "synthetic-hcc-ct" / "candidate"
            with self.assertRaisesRegex(ValueError, "duplicates an earlier"):
                generate_dataset(anchors, output, workspace)
            self.assertFalse(output.exists())

    def test_refuses_existing_output_and_output_outside_artifacts(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            anchors_dir = workspace / "inputs"
            anchors_dir.mkdir()
            anchors = self._fixtures(anchors_dir)
            outside = workspace / "outside"
            outside.mkdir()
            with self.assertRaisesRegex(ValueError, "new child"):
                generate_dataset(anchors, outside / "candidate", workspace)

            output = workspace / "artifacts" / "synthetic-hcc-ct" / "candidate"
            output.mkdir(parents=True)
            with self.assertRaises(FileExistsError):
                generate_dataset(anchors, output, workspace)

    def test_validator_detects_manifest_tampering(self):
        with tempfile.TemporaryDirectory() as temporary:
            workspace = Path(temporary)
            anchors_dir = workspace / "inputs"
            anchors_dir.mkdir()
            anchors = self._fixtures(anchors_dir)
            output = workspace / "artifacts" / "synthetic-hcc-ct" / "candidate"
            generate_dataset(anchors, output, workspace)

            manifest_path = output / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["clinicalUse"] = True
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "declaration is invalid|digest mismatch"):
                validate_dataset(output)


if __name__ == "__main__":
    unittest.main()
