#!/usr/bin/env python3
"""Build a non-clinical, reference-anchored synthetic CT display stack.

The input is ten synthetic PNG anchor images. The output is a 700-instance
derived CT DICOM series made with monotone pixelwise interpolation along z.
Its pixels are display luminance, not calibrated Hounsfield Units (HU), and its
geometry is synthetic display geometry, not acquisition metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pydicom import dcmread
from pydicom.dataset import FileDataset, FileMetaDataset, validate_file_meta
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian
from scipy.interpolate import PchipInterpolator


GENERATOR_VERSION = "highpass-reference-anchored-ct-v1.0.0"
SYNTHETIC_NOTICE = "SYNTHETIC TEST DATA - NOT FOR CLINICAL USE"
PATIENT_ID = "MEDIQ-SYN-HG-REF700-001"
PATIENT_NAME = "SYNTHETIC^HONG_GILDONG_56"
EXPECTED_ANCHORS = 10
DEFAULT_SLICE_COUNT = 700
DEFAULT_SLICE_SPACING_MM = 0.1
DEFAULT_PIXEL_SPACING_MM = 0.32
CT_IMAGE_STORAGE_UID = str(CTImageStorage)
EXPLICIT_VR_LITTLE_ENDIAN_UID = str(ExplicitVRLittleEndian)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def deterministic_uid(namespace: str) -> str:
    raw = hashlib.sha256(namespace.encode("utf-8")).digest()[:16]
    return f"2.25.{int.from_bytes(raw, byteorder='big', signed=False)}"


def canonical_manifest_sha256(manifest: dict[str, Any]) -> str:
    payload = dict(manifest)
    payload.pop("canonicalManifestSha256", None)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return sha256_bytes(canonical.encode("ascii"))


def load_anchors(paths: list[Path]) -> tuple[list[np.ndarray], list[dict[str, Any]]]:
    if len(paths) != EXPECTED_ANCHORS:
        raise ValueError(f"exactly {EXPECTED_ANCHORS} distinct anchor PNGs are required")

    images: list[np.ndarray] = []
    records: list[dict[str, Any]] = []
    observed_pixels: set[str] = set()
    shape: tuple[int, int] | None = None

    for index, path in enumerate(paths, start=1):
        source = path.expanduser().resolve(strict=True)
        with Image.open(source) as opened:
            if opened.format != "PNG":
                raise ValueError(f"anchor {index} is not a PNG")
            opened.load()
            frame = np.asarray(opened.convert("L"), dtype=np.uint8).copy()

        if frame.ndim != 2 or min(frame.shape) < 64:
            raise ValueError(f"anchor {index} dimensions are invalid")
        if shape is None:
            shape = (int(frame.shape[0]), int(frame.shape[1]))
        elif frame.shape != shape:
            raise ValueError("all anchors must have the same pixel dimensions")

        pixel_digest = sha256_bytes(frame.tobytes(order="C"))
        if pixel_digest in observed_pixels:
            raise ValueError(f"anchor {index} duplicates an earlier grayscale image")
        observed_pixels.add(pixel_digest)
        images.append(frame)
        records.append({
            "anchorIndex": index,
            "sourceFileName": source.name,
            "sourceFileSha256": sha256_file(source),
            "normalizedGrayscaleSha256": pixel_digest,
            "normalization": "PNG decoded then converted to 8-bit grayscale (Pillow L)",
            "rows": int(frame.shape[0]),
            "columns": int(frame.shape[1]),
        })

    return images, records


def _write_dicom(
    destination: Path,
    pixels: np.ndarray,
    *,
    study_uid: str,
    series_uid: str,
    frame_uid: str,
    sop_uid: str,
    instance_number: int,
    z_mm: float,
    slice_spacing_mm: float,
    pixel_spacing_mm: float,
    rows: int,
    columns: int,
    study_date: str,
) -> None:
    file_meta = FileMetaDataset()
    file_meta.FileMetaInformationVersion = b"\x00\x01"
    file_meta.MediaStorageSOPClassUID = CT_IMAGE_STORAGE_UID
    file_meta.MediaStorageSOPInstanceUID = sop_uid
    file_meta.TransferSyntaxUID = EXPLICIT_VR_LITTLE_ENDIAN_UID
    file_meta.ImplementationClassUID = deterministic_uid(f"{GENERATOR_VERSION}:implementation")
    file_meta.ImplementationVersionName = "REFCT100"
    validate_file_meta(file_meta, enforce_standard=True)

    ds = FileDataset(str(destination), {}, file_meta=file_meta, preamble=b"\x00" * 128)
    ds.SpecificCharacterSet = "ISO_IR 6"
    ds.SOPClassUID = CT_IMAGE_STORAGE_UID
    ds.SOPInstanceUID = sop_uid
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = series_uid
    ds.FrameOfReferenceUID = frame_uid
    ds.ImageType = ["DERIVED", "SECONDARY", "AXIAL", "SYNTHETIC"]
    ds.Modality = "CT"
    ds.PatientName = PATIENT_NAME
    ds.PatientID = PATIENT_ID
    ds.PatientAge = "056Y"
    ds.StudyDate = study_date
    ds.StudyTime = "120000"
    ds.SeriesDate = study_date
    ds.SeriesTime = "120000"
    ds.AcquisitionDate = study_date
    ds.AcquisitionTime = "120000"
    ds.ContentDate = study_date
    ds.ContentTime = "120000"
    ds.InstanceCreationDate = study_date
    ds.InstanceCreationTime = "120000"
    ds.AccessionNumber = "SYN-REF700"
    ds.StudyID = "SYNREF700"
    ds.StudyDescription = "SYNTHETIC CT DEMO - NOT FOR CLINICAL USE"
    ds.SeriesDescription = "REFERENCE-INTERPOLATED SYNTHETIC CT"
    ds.ProtocolName = "SYNTHETIC DISPLAY DEMO"
    ds.BodyPartExamined = "ABDOMEN"
    ds.InstitutionName = "HIGHPASS SYNTHETIC TEST ENVIRONMENT"
    ds.Manufacturer = "Highpass Synthetic Data Generator"
    ds.ManufacturerModelName = "Reference Anchored Interpolation"
    ds.SoftwareVersions = GENERATOR_VERSION
    ds.DerivationDescription = (
        "SYNTHETIC NONCLINICAL STACK FROM 10 USER-CONFIRMED SYNTHETIC PNG ANCHORS; "
        "MONOTONE CUBIC PIXEL INTERPOLATION; DISPLAY LUMINANCE, NOT HU; "
        "DISPLAY-ONLY GEOMETRY, NOT ACQUISITION METADATA; NOT FOR CLINICAL USE."
    )
    ds.BurnedInAnnotation = "NO"
    ds.RecognizableVisualFeatures = "NO"
    ds.SeriesNumber = 1
    ds.InstanceNumber = instance_number
    ds.AcquisitionNumber = 1
    ds.KVP = ""
    ds.ImagePositionPatient = [0.0, 0.0, float(f"{z_mm:.6f}")]
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    ds.PixelSpacing = [pixel_spacing_mm, pixel_spacing_mm]
    ds.SliceThickness = slice_spacing_mm
    ds.SpacingBetweenSlices = slice_spacing_mm
    ds.SliceLocation = float(f"{z_mm:.6f}")
    ds.Rows = rows
    ds.Columns = columns
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    ds.RescaleSlope = 1
    ds.RescaleIntercept = 0
    ds.RescaleType = "US"
    ds.WindowCenter = 32768
    ds.WindowWidth = 65536
    ds.PixelData = pixels.astype("<u2", copy=False).tobytes(order="C")
    ds.save_as(destination, enforce_file_format=True)


def _make_contact_sheet(
    destination: Path,
    anchors: list[np.ndarray],
    anchor_positions: list[int],
    generated_frames: dict[int, np.ndarray],
) -> None:
    entries: list[tuple[str, np.ndarray]] = []
    for index, (frame, out_position) in enumerate(zip(anchors, anchor_positions, strict=True), start=1):
        entries.append((f"ANCHOR {index:02d} -> SLICE {out_position + 1:04d}", frame))
    for position in sorted(generated_frames):
        if position not in anchor_positions:
            entries.append((f"INTERPOLATED SLICE {position + 1:04d}", generated_frames[position]))

    columns = 5
    cell_width = 224
    image_size = 200
    label_height = 24
    rows = math.ceil(len(entries) / columns)
    header_height = 52
    sheet = Image.new("RGB", (columns * cell_width, header_height + rows * (image_size + label_height)), (12, 18, 28))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    draw.text((14, 10), SYNTHETIC_NOTICE + " | REFERENCE-INTERPOLATED DISPLAY STACK | DRAFT", fill=(235, 241, 250), font=font)
    draw.text((14, 28), "700 DICOM instances; interpolated pixels are not acquired CT or HU values", fill=(155, 181, 212), font=font)

    for index, (label, frame) in enumerate(entries):
        x = (index % columns) * cell_width + (cell_width - image_size) // 2
        y = header_height + (index // columns) * (image_size + label_height)
        thumb = Image.fromarray(frame.astype(np.uint8), mode="L").resize((image_size, image_size), Image.Resampling.LANCZOS).convert("RGB")
        sheet.paste(thumb, (x, y))
        draw.text((x, y + image_size + 4), label, fill=(210, 225, 243), font=font)

    destination.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(destination, format="PNG", optimize=False)


def _write_manifest(target: Path, manifest: dict[str, Any]) -> None:
    manifest["canonicalManifestSha256"] = canonical_manifest_sha256(manifest)
    (target / "manifest.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def validate_dataset(dataset: Path, *, verify_pixel_data: bool = True) -> dict[str, Any]:
    root = dataset.resolve(strict=True)
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("datasetType") != "SYNTHETIC" or manifest.get("clinicalUse") is not False:
        raise ValueError("synthetic/nonclinical declaration is invalid")
    if manifest.get("review") != "DRAFT / UNASSIGNED":
        raise ValueError("review state must remain DRAFT / UNASSIGNED")
    if manifest.get("canonicalManifestSha256") != canonical_manifest_sha256(manifest):
        raise ValueError("canonical manifest digest mismatch")
    if manifest.get("sourceProvenance", {}).get("classification") != "USER_ASSERTED_SYNTHETIC_NONCLINICAL":
        raise ValueError("source synthetic provenance assertion is missing")
    if manifest.get("generationMethod") != "PCHIP_PIXELWISE_Z_INTERPOLATION":
        raise ValueError("unexpected generation method")

    rows, columns = int(manifest["rows"]), int(manifest["columns"])
    expected_count = int(manifest["totalInstances"])
    records = manifest.get("instances", [])
    if expected_count != 700 or len(records) != expected_count:
        raise ValueError("dataset must contain exactly 700 instances")
    if len(manifest.get("anchors", [])) != EXPECTED_ANCHORS:
        raise ValueError("manifest must bind exactly ten anchors")

    study_uid = manifest["studyInstanceUID"]
    series_uid = manifest["seriesInstanceUID"]
    frame_uid = manifest["frameOfReferenceUID"]
    slice_spacing = float(manifest["geometry"]["sliceSpacingMm"])
    pixel_spacing = [float(value) for value in manifest["geometry"]["pixelSpacingMm"]]
    sop_uids: set[str] = set()
    file_names: set[str] = set()
    pixel_hashes: set[str] = set()
    anchor_pixel_hashes: set[str] = set()
    positions: list[float] = []
    total_bytes = 0
    anchor_records = {int(item["outputInstanceNumber"]): item for item in manifest["anchors"]}

    for expected_number, record in enumerate(records, start=1):
        relative = Path(record["file"])
        if relative.is_absolute() or ".." in relative.parts or relative.suffix.lower() != ".dcm":
            raise ValueError("unsafe DICOM path in manifest")
        path = (root / relative).resolve(strict=True)
        if root not in path.parents or not path.is_file():
            raise ValueError("DICOM file is missing or escapes dataset root")
        relative_text = relative.as_posix()
        if relative_text in file_names:
            raise ValueError("duplicate DICOM path in manifest")
        file_names.add(relative_text)
        size = path.stat().st_size
        total_bytes += size
        if size != int(record["bytes"]) or sha256_file(path) != record["sha256"]:
            raise ValueError(f"DICOM file hash/size mismatch at instance {expected_number}")

        ds = dcmread(path, stop_before_pixels=not verify_pixel_data, force=False)
        if str(ds.SOPClassUID) != CT_IMAGE_STORAGE_UID or str(ds.file_meta.TransferSyntaxUID) != EXPLICIT_VR_LITTLE_ENDIAN_UID:
            raise ValueError("unexpected DICOM SOP class or transfer syntax")
        if str(ds.StudyInstanceUID) != study_uid or str(ds.SeriesInstanceUID) != series_uid or str(ds.FrameOfReferenceUID) != frame_uid:
            raise ValueError("Study/Series/Frame UID mismatch")
        sop_uid = str(ds.SOPInstanceUID)
        if sop_uid in sop_uids or sop_uid != record["sopInstanceUID"]:
            raise ValueError("duplicate or mismatched SOP Instance UID")
        sop_uids.add(sop_uid)
        if int(ds.InstanceNumber) != expected_number:
            raise ValueError("instance numbering is not sequential")
        if list(ds.ImageType) != ["DERIVED", "SECONDARY", "AXIAL", "SYNTHETIC"]:
            raise ValueError("image must remain explicitly derived/synthetic")
        if (int(ds.Rows), int(ds.Columns), int(ds.BitsAllocated), int(ds.BitsStored), int(ds.HighBit), int(ds.PixelRepresentation)) != (rows, columns, 16, 16, 15, 0):
            raise ValueError("pixel encoding mismatch")
        if str(ds.PhotometricInterpretation) != "MONOCHROME2" or int(ds.SamplesPerPixel) != 1:
            raise ValueError("photometric interpretation mismatch")
        if [float(value) for value in ds.PixelSpacing] != pixel_spacing:
            raise ValueError("pixel spacing mismatch")
        if float(ds.SliceThickness) != slice_spacing or float(ds.SpacingBetweenSlices) != slice_spacing:
            raise ValueError("synthetic display slice spacing mismatch")
        if str(ds.RescaleType) != "US" or float(ds.RescaleSlope) != 1 or float(ds.RescaleIntercept) != 0:
            raise ValueError("display pixels must not be represented as HU")
        if str(ds.PatientID) != PATIENT_ID or str(ds.PatientName) != PATIENT_NAME:
            raise ValueError("unexpected non-synthetic patient identity")
        if hasattr(ds, "PatientBirthDate") and str(ds.PatientBirthDate).strip():
            raise ValueError("birth date must be absent")
        if any(element.tag.is_private for element in ds.iterall()):
            raise ValueError("private DICOM element found")
        if "SYNTHETIC" not in str(ds.StudyDescription).upper() or "NOT FOR CLINICAL USE" not in str(ds.StudyDescription).upper():
            raise ValueError("clinical disclaimer missing from DICOM")
        position = float(ds.ImagePositionPatient[2])
        positions.append(position)

        anchor_record = anchor_records.get(expected_number)
        if verify_pixel_data:
            pixel_bytes = bytes(ds.PixelData)
            expected_pixel_bytes = rows * columns * 2
            if len(pixel_bytes) != expected_pixel_bytes:
                raise ValueError(f"Pixel Data byte length mismatch at instance {expected_number}")
            pixel_hash = sha256_bytes(pixel_bytes)
            if pixel_hash != record["pixelDataSha256"]:
                raise ValueError(f"Pixel Data hash mismatch at instance {expected_number}")
            pixel_hashes.add(pixel_hash)
            pixel_array = ds.pixel_array
            if pixel_array.shape != (rows, columns) or pixel_array.dtype.kind != "u" or int(pixel_array.min()) < 0 or int(pixel_array.max()) > 65535:
                raise ValueError(f"decoded pixel array mismatch at instance {expected_number}")
            if anchor_record is not None:
                expected_pixel_hash = anchor_record["outputPixelDataSha256"]
                if pixel_hash != expected_pixel_hash:
                    raise ValueError(f"anchor pixel data changed at instance {expected_number}")
                anchor_pixel_hashes.add(pixel_hash)
        elif anchor_record is not None:
            if record["pixelDataSha256"] != anchor_record["outputPixelDataSha256"]:
                raise ValueError(f"anchor pixel data manifest mismatch at instance {expected_number}")
            anchor_pixel_hashes.add(str(record["pixelDataSha256"]))

    if positions != sorted(positions) or len(set(positions)) != expected_count:
        raise ValueError("slice positions are not strictly increasing")
    if any(abs((right - left) - slice_spacing) > 0.000001 for left, right in zip(positions, positions[1:])):
        raise ValueError("slice positions do not match synthetic display geometry")
    actual_files = {path.relative_to(root).as_posix() for path in (root / "study").rglob("*.dcm")}
    if actual_files != file_names:
        raise ValueError("DICOM file inventory differs from manifest")
    if total_bytes != int(manifest["totalDicomBytes"]):
        raise ValueError("total DICOM byte count mismatch")
    if len(sop_uids) != expected_count:
        raise ValueError("SOP UID uniqueness/count check failed")
    if verify_pixel_data and len(pixel_hashes) != expected_count:
        raise ValueError("all 700 generated Pixel Data frames must be distinct")

    return {
        "status": "PASS",
        "instances": expected_count,
        "rows": rows,
        "columns": columns,
        "seriesCount": 1,
        "uniqueSopInstanceUids": len(sop_uids),
        "distinctPixelData": len(pixel_hashes) if verify_pixel_data else None,
        "distinctAnchorPixelData": len(anchor_pixel_hashes),
        "pixelDataValidated": verify_pixel_data,
        "totalDicomBytes": total_bytes,
        "canonicalManifestSha256": manifest["canonicalManifestSha256"],
        "clinicalUse": False,
        "huCalibrated": False,
        "geometry": "SYNTHETIC DISPLAY COORDINATES; NOT ACQUISITION METADATA",
        "review": "DRAFT / UNASSIGNED",
    }


def generate_dataset(
    anchor_paths: list[Path],
    output: Path,
    workspace: Path,
    *,
    slice_count: int = DEFAULT_SLICE_COUNT,
    slice_spacing_mm: float = DEFAULT_SLICE_SPACING_MM,
    pixel_spacing_mm: float = DEFAULT_PIXEL_SPACING_MM,
    study_date: str = "20261010",
) -> dict[str, Any]:
    if slice_count != DEFAULT_SLICE_COUNT:
        raise ValueError("production reference dataset must contain exactly 700 slices")
    if not math.isfinite(slice_spacing_mm) or slice_spacing_mm <= 0 or not math.isfinite(pixel_spacing_mm) or pixel_spacing_mm <= 0:
        raise ValueError("display geometry spacings must be positive finite numbers")
    if len(study_date) != 8 or not study_date.isdigit():
        raise ValueError("study date must be YYYYMMDD")

    workspace_root = workspace.expanduser().resolve(strict=True)
    output_root = output.expanduser().resolve()
    allowed_root = (workspace_root / "artifacts" / "synthetic-hcc-ct").resolve()
    try:
        output_root.relative_to(allowed_root)
    except ValueError as error:
        raise ValueError("output must be a new child of artifacts/synthetic-hcc-ct") from error
    if output_root.exists():
        raise FileExistsError(f"refusing to overwrite existing output: {output_root}")

    anchors, input_records = load_anchors(anchor_paths)
    rows, columns = anchors[0].shape
    anchor_positions = np.rint(np.linspace(0, slice_count - 1, EXPECTED_ANCHORS)).astype(int).tolist()
    if len(set(anchor_positions)) != EXPECTED_ANCHORS:
        raise ValueError("anchor positions are not unique")
    anchor_stack = np.stack(anchors, axis=0).astype(np.float32)
    interpolation = PchipInterpolator(np.asarray(anchor_positions, dtype=np.float64), anchor_stack, axis=0, extrapolate=False)

    target = output_root
    target.mkdir(parents=True, exist_ok=False)
    (target / "study" / "01_reference_interpolated").mkdir(parents=True)
    uid_seed = ":".join(record["normalizedGrayscaleSha256"] for record in input_records)
    uid_namespace = f"{GENERATOR_VERSION}:{slice_count}:{uid_seed}"
    study_uid = deterministic_uid(f"{uid_namespace}:study")
    series_uid = deterministic_uid(f"{uid_namespace}:series")
    frame_uid = deterministic_uid(f"{uid_namespace}:frame")
    series_dir = target / "study" / "01_reference_interpolated"
    instance_records: list[dict[str, Any]] = []
    hash_lines: list[str] = []
    generated_preview_positions = sorted(set([0, 19, 38, 58, 77, 116, 194, 271, 349, 427, 504, 582, 660, 680, 699] + anchor_positions))
    preview_frames: dict[int, np.ndarray] = {}
    pixel_hashes: set[str] = set()
    total_bytes = 0

    for slice_index in range(slice_count):
        if slice_index in anchor_positions:
            anchor_index = anchor_positions.index(slice_index)
            gray = anchors[anchor_index]
            frame16 = gray.astype(np.uint16) * 257
        else:
            gray_interpolated = np.asarray(interpolation(float(slice_index)), dtype=np.float32)
            gray_interpolated = np.clip(gray_interpolated, 0.0, 255.0)
            frame16 = np.rint(gray_interpolated * 257.0).astype(np.uint16)

        pixel_bytes = frame16.astype("<u2", copy=False).tobytes(order="C")
        pixel_digest = sha256_bytes(pixel_bytes)
        pixel_hashes.add(pixel_digest)
        sop_uid = deterministic_uid(f"{uid_namespace}:sop:{slice_index + 1}")
        z_mm = (slice_index - (slice_count - 1) / 2.0) * slice_spacing_mm
        file_path = series_dir / f"IM_{slice_index + 1:04d}.dcm"
        _write_dicom(
            file_path,
            frame16,
            study_uid=study_uid,
            series_uid=series_uid,
            frame_uid=frame_uid,
            sop_uid=sop_uid,
            instance_number=slice_index + 1,
            z_mm=z_mm,
            slice_spacing_mm=slice_spacing_mm,
            pixel_spacing_mm=pixel_spacing_mm,
            rows=rows,
            columns=columns,
            study_date=study_date,
        )
        file_size = file_path.stat().st_size
        file_digest = sha256_file(file_path)
        relative = file_path.relative_to(target).as_posix()
        instance_records.append({
            "instanceNumber": slice_index + 1,
            "sopInstanceUID": sop_uid,
            "file": relative,
            "bytes": file_size,
            "sha256": file_digest,
            "pixelDataSha256": pixel_digest,
        })
        hash_lines.append(f"{file_digest}  {relative}")
        total_bytes += file_size
        if slice_index in generated_preview_positions:
            preview_frames[slice_index] = np.rint(frame16.astype(np.float32) / 257.0).clip(0, 255).astype(np.uint8)
        if (slice_index + 1) % 100 == 0:
            print(json.dumps({"generatedInstances": slice_index + 1, "total": slice_count}), flush=True)

    anchor_manifest = []
    for anchor_index, (input_record, position, source_frame) in enumerate(zip(input_records, anchor_positions, anchors, strict=True), start=1):
        output_pixel_bytes = (source_frame.astype(np.uint16) * 257).astype("<u2", copy=False).tobytes(order="C")
        anchor_manifest.append({
            **input_record,
            "anchorIndex": anchor_index,
            "outputInstanceNumber": position + 1,
            "outputPixelDataSha256": sha256_bytes(output_pixel_bytes),
            "anchorPixelsPreserved": True,
        })

    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "generator": GENERATOR_VERSION,
        "datasetType": "SYNTHETIC",
        "clinicalUse": False,
        "clinicalDisclaimer": SYNTHETIC_NOTICE,
        "review": "DRAFT / UNASSIGNED",
        "sourceProvenance": {
            "classification": "USER_ASSERTED_SYNTHETIC_NONCLINICAL",
            "independentlyVerified": False,
            "note": "Input synthetic/nonclinical status was explicitly confirmed by the user; no clinical origin is asserted.",
        },
        "generationMethod": "PCHIP_PIXELWISE_Z_INTERPOLATION",
        "generationNotes": [
            "Ten grayscale anchor planes are embedded unchanged (expanded 8-bit luminance to 16-bit by exact multiplication by 257).",
            "Intervening planes are monotone piecewise-cubic interpolations of anchor pixel values; no source DICOM HU or acquisition geometry was available.",
            "DICOM geometry is synthetic display metadata only; this stack is not a calibrated or clinically valid CT volume.",
            "No independent per-slice random image generation, phase claim, diagnosis claim, or clinical interpretation is made.",
        ],
        "patientReference": PATIENT_ID,
        "patientName": PATIENT_NAME,
        "studyInstanceUID": study_uid,
        "seriesInstanceUID": series_uid,
        "frameOfReferenceUID": frame_uid,
        "modality": "CT",
        "sopClassUID": CT_IMAGE_STORAGE_UID,
        "transferSyntaxUID": EXPLICIT_VR_LITTLE_ENDIAN_UID,
        "rows": rows,
        "columns": columns,
        "bitsAllocated": 16,
        "bitsStored": 16,
        "pixelRepresentation": "UNSIGNED",
        "photometricInterpretation": "MONOCHROME2",
        "pixelValueSemantics": "8-bit source display luminance expanded to 16-bit; arbitrary units (US), not HU",
        "windowCenter": 32768,
        "windowWidth": 65536,
        "geometry": {
            "status": "SYNTHETIC_DISPLAY_COORDINATES_NOT_ACQUISITION_METADATA",
            "pixelSpacingMm": [pixel_spacing_mm, pixel_spacing_mm],
            "sliceThicknessMm": slice_spacing_mm,
            "sliceSpacingMm": slice_spacing_mm,
            "physicalGeometryVerified": False,
        },
        "anchors": anchor_manifest,
        "anchorPlacementInstanceNumbers": [position + 1 for position in anchor_positions],
        "anchorInputs": input_records,
        "instanceCount": slice_count,
        "uniquePixelDataCount": len(pixel_hashes),
        "instances": instance_records,
        "totalInstances": slice_count,
        "totalDicomBytes": total_bytes,
        "studyDate": study_date,
        "validationStatus": "IN_PROGRESS",
    }
    _write_manifest(target, manifest)
    (target / "hashes.sha256").write_text("\n".join(hash_lines) + "\n", encoding="ascii", newline="\n")
    _make_contact_sheet(target / "preview" / "reference-anchored-700-contact-sheet.png", anchors, anchor_positions, preview_frames)
    (target / "README.txt").write_text(
        "SYNTHETIC TEST DATA - NOT FOR CLINICAL USE\n"
        "700 derived display slices generated from ten user-confirmed synthetic PNG anchors.\n"
        "Interpolated pixel values are arbitrary display units, not Hounsfield Units.\n"
        "DICOM spatial geometry is synthetic display metadata, not scanner acquisition metadata.\n"
        "Not suitable for diagnosis, treatment, research, or clinical workflow.\n"
        "Review status: DRAFT / UNASSIGNED. Not registered to a PACS by this generator.\n",
        encoding="utf-8",
        newline="\n",
    )

    first_validation = validate_dataset(target, verify_pixel_data=False)
    manifest["validationStatus"] = "PASS"
    manifest["validatedAtUtc"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
    _write_manifest(target, manifest)
    final_validation = validate_dataset(target, verify_pixel_data=True)
    final_validation["canonicalManifestSha256"] = manifest["canonicalManifestSha256"]
    (target / "validation.json").write_text(json.dumps(final_validation, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    (target / ".synthetic-reference-ct-dataset.json").write_text(
        json.dumps({
            "generator": GENERATOR_VERSION,
            "datasetType": "SYNTHETIC",
            "status": "PASS",
            "review": "DRAFT / UNASSIGNED",
            "clinicalUse": False,
            "canonicalManifestSha256": manifest["canonicalManifestSha256"],
        }, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return {
        **final_validation,
        "output": str(target),
        "generator": GENERATOR_VERSION,
        "inputAnchorCount": len(anchors),
        "anchorInstanceNumbers": manifest["anchorPlacementInstanceNumbers"],
        "uniquePixelDataCount": manifest["uniquePixelDataCount"],
        "firstValidation": first_validation["status"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anchors", nargs="+", type=Path, help="exactly ten distinct synthetic PNG anchors in axial order")
    parser.add_argument("--output", type=Path, help="new output directory under artifacts/synthetic-hcc-ct")
    parser.add_argument("--validate-only", type=Path, help="validate an existing dataset without generating or modifying it")
    parser.add_argument("--validation-report", type=Path, help="optional new report path under the --validate-only dataset")
    parser.add_argument("--slice-count", type=int, default=DEFAULT_SLICE_COUNT)
    parser.add_argument("--slice-spacing-mm", type=float, default=DEFAULT_SLICE_SPACING_MM, help="synthetic display coordinate spacing; not scanner metadata")
    parser.add_argument("--pixel-spacing-mm", type=float, default=DEFAULT_PIXEL_SPACING_MM, help="synthetic display coordinate spacing; not scanner metadata")
    parser.add_argument("--study-date", default="20261010", help="synthetic DICOM date in YYYYMMDD form")
    args = parser.parse_args()
    try:
        if args.validate_only is not None:
            if args.anchors or args.output:
                parser.error("--validate-only cannot be combined with --anchors or --output")
            result = validate_dataset(args.validate_only, verify_pixel_data=True)
            if args.validation_report is not None:
                report = args.validation_report.expanduser().resolve()
                dataset_root = args.validate_only.expanduser().resolve(strict=True)
                try:
                    report.relative_to(dataset_root)
                except ValueError as error:
                    raise ValueError("validation report must be a child of the validated dataset") from error
                if report.exists():
                    raise FileExistsError(f"refusing to overwrite validation report: {report}")
                report.parent.mkdir(parents=True, exist_ok=True)
                report.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0
        if not args.anchors or args.output is None:
            parser.error("--anchors and --output are required unless --validate-only is used")
        result = generate_dataset(
            args.anchors,
            args.output,
            Path.cwd(),
            slice_count=args.slice_count,
            slice_spacing_mm=args.slice_spacing_mm,
            pixel_spacing_mm=args.pixel_spacing_mm,
            study_date=args.study_date,
        )
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({"status": "FAIL", "errorType": type(error).__name__, "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
