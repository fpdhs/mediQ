#!/usr/bin/env python3
"""Generate a deterministic, fully synthetic multiphase CT DICOM test study.

SYNTHETIC / TEST DATA / NOT FOR CLINICAL USE.
This procedural phantom is not a patient image and is not clinically validated.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pydicom import dcmread
from pydicom.dataset import FileDataset, FileMetaDataset, validate_file_meta
from pydicom.uid import CTImageStorage, ExplicitVRLittleEndian
from scipy.ndimage import gaussian_filter


SEED_DEFAULT = 20261010
ROWS = 512
COLUMNS = 512
PIXEL_SPACING_MM = 0.70
SLICE_SPACING_MM = 1.50
HU_INTERCEPT = -1024
SYNTHETIC_PATIENT_ID = "MEDIQ-SYN-HCC-001"
SYNTHETIC_PATIENT_NAME = "SYNTHETIC^HCC_TEST_001"
CT_IMAGE_STORAGE_UID = str(CTImageStorage)
EXPLICIT_VR_LITTLE_ENDIAN_UID = str(ExplicitVRLittleEndian)
GENERATOR_VERSION = "highpass-synthetic-hcc-ct-v1.2.0"
SYNTHETIC_NOTICE = "SYNTHETIC TEST DATA - NOT FOR CLINICAL USE"


@dataclass(frozen=True)
class Phase:
    key: str
    label: str
    series_description: str
    series_number: int
    liver_hu: float
    spleen_hu: float
    aorta_hu: float
    portal_hu: float
    lesion_hu: float
    capsule_hu: float


PHASES_FULL = (
    Phase("noncontrast", "NONCONTRAST", "01_SYNTH_NONCONTRAST", 1, 58, 55, 38, 38, 46, 54),
    Phase("arterial", "ARTERIAL", "02_SYNTH_ARTERIAL", 2, 76, 82, 205, 118, 120, 83),
    Phase("portal", "PORTAL_VENOUS", "03_SYNTH_PORTAL", 3, 103, 108, 145, 155, 74, 82),
    Phase("delayed", "DELAYED", "04_SYNTH_DELAYED", 4, 89, 92, 112, 102, 63, 77),
)
PHASES_DEMO = PHASES_FULL[:3]


class Tissue:
    AIR = 0
    FAT = 1
    MUSCLE = 2
    SOFT_TISSUE = 3
    LIVER = 4
    SPLEEN = 5
    KIDNEY = 6
    AORTA = 7
    PORTAL_VESSEL = 8
    LESION = 9
    CAPSULE = 10
    BONE = 11
    LUNG = 12
    BOWEL_GAS = 13
    SPINAL_CANAL = 14
    KIDNEY_CORTEX = 15
    KIDNEY_MEDULLA = 16
    KIDNEY_SINUS = 17
    PANCREAS = 18
    GALLBLADDER = 19
    BONE_MARROW = 20


def deterministic_uid(namespace: str) -> str:
    """Return a stable DICOM 2.25 UID derived from a SHA-256 namespace."""
    raw = hashlib.sha256(namespace.encode("utf-8")).digest()[:16]
    value = int.from_bytes(raw, byteorder="big", signed=False)
    uid = f"2.25.{value}"
    if len(uid) > 64:
        raise ValueError("DICOM UID exceeds 64 characters")
    return uid


def canonical_manifest_sha256(manifest: dict[str, Any]) -> str:
    payload = dict(manifest)
    payload.pop("canonicalManifestSha256", None)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return hashlib.sha256(canonical.encode("ascii")).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def profile_definition(profile: str) -> tuple[tuple[Phase, ...], int]:
    if profile == "full":
        return PHASES_FULL, 180
    if profile == "demo":
        return PHASES_DEMO, 120
    raise ValueError("profile must be full or demo")


def build_anatomy_volume(
    slices: int,
    rows: int = ROWS,
    columns: int = COLUMNS,
    pixel_spacing_mm: float = PIXEL_SPACING_MM,
    slice_spacing_mm: float = SLICE_SPACING_MM,
) -> np.ndarray:
    """Create a 3-D label volume with smooth z-dependent synthetic anatomy."""
    x_axis = (np.arange(columns, dtype=np.float32) - (columns - 1) / 2) * pixel_spacing_mm
    y_axis = (np.arange(rows, dtype=np.float32) - (rows - 1) / 2) * pixel_spacing_mm
    x, y = np.meshgrid(x_axis, y_axis, indexing="xy")
    labels = np.full((slices, rows, columns), Tissue.AIR, dtype=np.uint8)
    z_extent = max((slices - 1) * slice_spacing_mm / 2, 1.0)

    for index in range(slices):
        z = (index - (slices - 1) / 2) * slice_spacing_mm
        zn = z / z_extent
        frame = labels[index]

        # Body wall and subcutaneous tissues evolve continuously through z.
        body_rx = 151.0 * (1.0 - 0.10 * abs(zn) ** 1.5)
        body_ry = 111.0 * (1.0 - 0.12 * abs(zn) ** 1.4)
        body_metric = (x / body_rx) ** 2 + ((y + 2.0) / body_ry) ** 2
        body_angle = np.arctan2((y + 2.0) / body_ry, x / body_rx)
        body_edge = 1.0 + 0.024 * np.sin(3.0 * body_angle + z * 0.014) + 0.013 * np.cos(7.0 * body_angle - z * 0.019) + 0.007 * np.sin(11.0 * body_angle + z * 0.027)
        body_metric_normalized = body_metric / (body_edge ** 2)
        inside_body = body_metric_normalized <= 1.0
        frame[inside_body] = Tissue.FAT
        muscle_ring = inside_body & (body_metric_normalized >= 0.78) & (body_metric_normalized <= 0.91)
        frame[muscle_ring] = Tissue.MUSCLE
        abdominal_soft_tissue = inside_body & (body_metric_normalized < 0.78)
        frame[abdominal_soft_tissue] = Tissue.SOFT_TISSUE

        # Liver: broad, irregular right upper abdominal organ, tapered at both ends.
        liver_z = max(0.0, 1.0 - (z / 88.0) ** 2)
        liver_rx = 78.0 * math.sqrt(liver_z)
        liver_ry = 52.0 * math.sqrt(liver_z)
        if liver_rx > 1.0 and liver_ry > 1.0:
            liver_cx = 43.0 + 3.8 * math.sin(z / 47.0)
            liver_cy = -17.0 + 2.5 * math.sin(z / 61.0)
            dx = x - liver_cx
            dy = y - liver_cy
            angle = np.arctan2(dy / max(liver_ry, 1.0), dx / max(liver_rx, 1.0))
            irregular = (1.0 + 0.060 * np.sin(3.0 * angle + z * 0.012)
                         + 0.030 * np.cos(5.0 * angle - z * 0.009)
                         + 0.013 * np.sin(8.0 * angle + z * 0.021))
            liver_metric = (dx / max(liver_rx, 1.0)) ** 2 + (dy / max(liver_ry, 1.0)) ** 2
            liver_mask = liver_metric <= irregular ** 2
            frame[liver_mask] = Tissue.LIVER

        # Spleen and kidneys change in cross-section without jumping between slices.
        spleen_z = max(0.0, 1.0 - (z / 72.0) ** 2)
        if spleen_z > 0:
            spleen_dx = (x + 94.0) / (30.0 * math.sqrt(spleen_z))
            spleen_dy = (y + 15.0) / (42.0 * math.sqrt(spleen_z))
            spleen_metric = spleen_dx ** 2 + spleen_dy ** 2
            spleen_angle = np.arctan2(spleen_dy, spleen_dx)
            spleen_edge = 1.0 + 0.038 * np.sin(3.0 * spleen_angle + z * 0.016) + 0.018 * np.cos(5.0 * spleen_angle - z * 0.011)
            frame[spleen_metric <= spleen_edge ** 2] = Tissue.SPLEEN

        kidney_z = max(0.0, 1.0 - (z / 55.0) ** 2)
        if kidney_z > 0:
            kidney_scale = math.sqrt(kidney_z)
            for center_x, center_y, skew in ((-57.0, 49.0, -1.0), (58.0, 48.0, 1.0)):
                kx = (x - (center_x + 1.4 * math.sin(z / 24.0))) / (27.0 * kidney_scale)
                ky = (y - center_y) / (39.0 * kidney_scale)
                kidney_metric = (kx + skew * 0.10 * ky) ** 2 + ky ** 2
                medial_sign = 1.0 if center_x < 0 else -1.0
                medial_notch = 0.14 * np.exp(-(((kx - medial_sign * 0.80) / 0.24) ** 2 + (ky / 0.47) ** 2))
                kidney_metric += medial_notch
                kidney_mask = kidney_metric <= 1.0
                frame[kidney_mask] = Tissue.KIDNEY
                frame[kidney_mask & (kidney_metric >= 0.69)] = Tissue.KIDNEY_CORTEX
                kidney_angle = np.arctan2(ky, kx)
                medulla_lobes = np.abs(np.sin(kidney_angle * 2.5 + 0.22)) < 0.36
                medulla_mask = kidney_mask & (kidney_metric >= 0.16) & (kidney_metric < 0.69) & medulla_lobes
                frame[medulla_mask] = Tissue.KIDNEY_MEDULLA
                sinus_metric = (kx / 0.31) ** 2 + (ky / 0.17) ** 2
                frame[kidney_mask & (sinus_metric <= 1.0)] = Tissue.KIDNEY_SINUS

        # Pancreas and gallbladder add upper-abdominal soft-tissue landmarks.
        pancreas_z = max(0.0, 1.0 - (z / 47.0) ** 2)
        if pancreas_z > 0:
            pancreas_scale = math.sqrt(pancreas_z)
            pancreas_cx = -4.0 + 2.0 * math.sin(z / 29.0)
            pancreas_cy = -4.0 + 1.5 * math.cos(z / 33.0)
            pancreas_metric = ((x - pancreas_cx) / (43.0 * pancreas_scale)) ** 2 + ((y - pancreas_cy) / (8.5 * pancreas_scale)) ** 2
            pancreas_waviness = 1.0 + 0.08 * np.sin(x / 15.0 + z / 21.0)
            frame[(pancreas_metric <= pancreas_waviness) & (frame == Tissue.SOFT_TISSUE)] = Tissue.PANCREAS
        gallbladder_z = max(0.0, 1.0 - (z / 24.0) ** 2)
        if gallbladder_z > 0:
            gallbladder_scale = math.sqrt(gallbladder_z)
            gallbladder_dx = (x - 91.0) / (8.5 * gallbladder_scale)
            gallbladder_dy = (y + 14.0) / (18.0 * gallbladder_scale)
            gallbladder_angle = np.arctan2(gallbladder_dy, gallbladder_dx)
            gallbladder_metric = gallbladder_dx ** 2 + gallbladder_dy ** 2
            gallbladder_edge = 1.0 + 0.05 * np.sin(3.0 * gallbladder_angle + z * 0.024) + 0.025 * np.cos(5.0 * gallbladder_angle - z * 0.016)
            frame[(gallbladder_metric <= gallbladder_edge ** 2) & ((frame == Tissue.LIVER) | (frame == Tissue.SOFT_TISSUE))] = Tissue.GALLBLADDER

        # Lower lung bases appear only in the superior part of the volume.
        lung_progress = np.clip((z - 80.0) / 52.0, 0.0, 1.0)
        if lung_progress > 0:
            lung_scale = 0.52 + 0.48 * lung_progress
            for center_x in (-73.0, 73.0):
                lx = (x - center_x) / (32.0 * lung_scale)
                ly = (y + 61.0) / (25.0 * lung_scale)
                lung_metric = lx ** 2 + ly ** 2 + 0.04 * np.sin(x / 13.0 + z / 17.0)
                frame[(lung_metric <= 1.0) & inside_body] = Tissue.LUNG

        # Bowel loops: several slowly migrating soft-tissue walls with gas centers.
        for loop_index, (base_x, base_y, rx, ry) in enumerate((
            (-41.0, -29.0, 12.0, 9.0), (-8.0, -34.0, 10.0, 8.0),
            (29.0, 28.0, 12.0, 8.0), (82.0, 28.0, 10.0, 8.0),
            (-79.0, 24.0, 11.0, 8.0), (5.0, 40.0, 9.0, 7.0),
        )):
            cx = base_x + 4.0 * math.sin(z / (20.0 + loop_index * 2.0) + loop_index)
            cy = base_y + 3.0 * math.cos(z / (25.0 + loop_index) - loop_index)
            loop_dx = (x - cx) / rx
            loop_dy = (y - cy) / ry
            loop_angle = np.arctan2(loop_dy, loop_dx)
            loop_edge = 1.0 + 0.065 * np.sin(3.0 * loop_angle + z * 0.023 + loop_index) + 0.025 * np.cos(5.0 * loop_angle - z * 0.017)
            distance = (loop_dx ** 2 + loop_dy ** 2) / (loop_edge ** 2)
            loop_wall = (distance >= 0.42) & (distance <= 1.0) & inside_body
            loop_gas = (distance < 0.42) & inside_body
            frame[loop_wall] = Tissue.SOFT_TISSUE
            frame[loop_gas] = Tissue.BOWEL_GAS

        # Aorta, vena cava and portal/hepatic vessels are continuous through z.
        aorta_x = 1.0 + 1.2 * math.sin(z / 48.0)
        aorta_y = 64.0 + 1.0 * math.cos(z / 53.0)
        aorta_metric = ((x - aorta_x) / 11.0) ** 2 + ((y - aorta_y) / 12.0) ** 2
        frame[aorta_metric <= 1.0] = Tissue.AORTA
        vena_metric = ((x + 18.0) / 8.0) ** 2 + ((y - 63.0) / 10.0) ** 2
        frame[vena_metric <= 1.0] = Tissue.PORTAL_VESSEL

        vessel_shift = 2.0 * math.sin(z / 31.0)
        vessel_segments = (
            ((17.0 + vessel_shift, -10.0), (47.0 + vessel_shift, -25.0), 2.8, 1.0),
            ((30.0 + vessel_shift, -16.5), (61.0 + vessel_shift, -2.0), 2.3, -0.8),
            ((38.0 + vessel_shift, -20.5), (56.0 + vessel_shift, -44.0), 2.0, 0.7),
            ((47.0 + vessel_shift, -25.0), (72.0 + vessel_shift, -37.0), 1.8, -0.65),
            ((43.0 + vessel_shift, -23.0), (48.0 + vessel_shift, -7.0), 1.45, 0.4),
            ((52.0 + vessel_shift, -21.0), (65.0 + vessel_shift, -17.0), 1.35, -0.38),
            ((55.0 + vessel_shift, -43.0), (66.0 + vessel_shift, -49.0), 1.35, 0.35),
            ((61.0 + vessel_shift, -2.0), (69.0 + vessel_shift, 8.0), 1.25, -0.3),
            ((35.0 + vessel_shift, -18.0), (26.0 + vessel_shift, -29.0), 1.35, 0.38),
        )
        for segment_index, ((x1, y1), (x2, y2), radius, curvature) in enumerate(vessel_segments):
            vx, vy = x2 - x1, y2 - y1
            projection = np.clip(((x - x1) * vx + (y - y1) * vy) / (vx * vx + vy * vy), 0.0, 1.0)
            length = math.sqrt(vx * vx + vy * vy)
            bend = curvature * math.sin(z / 39.0 + segment_index * 0.55) * np.sin(math.pi * projection)
            center_x = x1 + projection * vx - bend * vy / length
            center_y = y1 + projection * vy + bend * vx / length
            distance_sq = (x - center_x) ** 2 + (y - center_y) ** 2
            frame[(distance_sq <= radius ** 2) & (frame == Tissue.LIVER)] = Tissue.PORTAL_VESSEL

        # Vertebral body, posterior elements, ribs and spinal canal.
        vertebra_metric = (x / 18.0) ** 2 + ((y - 94.0) / 17.0) ** 2
        vertebra_shape = vertebra_metric <= (1.0 + 0.035 * np.sin(np.arctan2(y - 94.0, x) * 5.0 + z * 0.01))
        frame[vertebra_shape] = Tissue.BONE
        frame[vertebra_shape & (vertebra_metric <= 0.70)] = Tissue.BONE_MARROW
        for side in (-1.0, 1.0):
            pedicle_metric = ((x - side * 15.0) / 6.0) ** 2 + ((y - 81.0) / 7.0) ** 2
            frame[pedicle_metric <= 1.0] = Tissue.BONE
            frame[pedicle_metric <= 0.35] = Tissue.BONE_MARROW
        spinous_metric = (x / 5.0) ** 2 + ((y - 113.0) / 8.0) ** 2
        frame[spinous_metric <= 1.0] = Tissue.BONE
        frame[spinous_metric <= 0.28] = Tissue.BONE_MARROW
        canal_metric = (x / 7.0) ** 2 + ((y - 75.0) / 8.0) ** 2
        frame[canal_metric <= 1.0] = Tissue.SPINAL_CANAL
        for side in (-1.0, 1.0):
            rib_positions = ((103.0, -42.0), (116.0, -13.0), (119.0, 17.0), (108.0, 47.0), (88.0, 70.0))
            for rib_index, (rib_x_abs, rib_y) in enumerate(rib_positions):
                rib_x = side * (rib_x_abs + 2.0 * math.sin(z / (24.0 + rib_index * 2.0)))
                rib_metric = ((x - rib_x) / 5.0) ** 2 + ((y - rib_y) / (7.0 + (rib_index % 2))) ** 2
                rib_shape = (rib_metric <= 1.0) & inside_body
                frame[rib_shape] = Tissue.BONE
                frame[rib_shape & (rib_metric <= 0.26)] = Tissue.BONE_MARROW

        # Single irregular synthetic lesion in the right superior liver region.
        lesion_z_center = 17.0
        rz = 21.5
        z_scale = 1.0 - ((z - lesion_z_center) / rz) ** 2
        if z_scale > 0:
            lesion_cx = 53.0 + 1.1 * math.sin(z / 20.0)
            lesion_cy = -35.0 + 0.8 * math.cos(z / 19.0)
            nx = (x - lesion_cx) / (16.0 * math.sqrt(z_scale))
            ny = (y - lesion_cy) / (13.0 * math.sqrt(z_scale))
            radial = np.sqrt(nx ** 2 + ny ** 2)
            angle = np.arctan2(ny, nx)
            edge = 1.0 + 0.045 * np.sin(3.0 * angle + z * 0.035) + 0.025 * np.cos(5.0 * angle - z * 0.028)
            within_liver = (frame == Tissue.LIVER) | (frame == Tissue.PORTAL_VESSEL)
            lesion_mask = (radial <= edge) & within_liver
            capsule_mask = (radial > edge) & (radial <= edge + 0.10) & within_liver
            frame[capsule_mask] = Tissue.CAPSULE
            frame[lesion_mask] = Tissue.LESION

    return labels


def build_noise_volume(shape: tuple[int, int, int], seed: int) -> np.ndarray:
    """Create a unit-variance, slice-continuous noise field shared by all phases."""
    generator = np.random.default_rng(seed)
    texture = generator.standard_normal(shape, dtype=np.float32)
    gaussian_filter(texture, sigma=(0.52, 0.62, 0.62), output=texture, mode="reflect")
    deviation = float(np.std(texture, dtype=np.float64))
    if not math.isfinite(deviation) or deviation == 0:
        raise ValueError("synthetic texture generation failed")
    texture *= np.float32(1.0 / deviation)
    return texture


def render_hu_frame(labels: np.ndarray, texture: np.ndarray, phase: Phase, index: int) -> np.ndarray:
    hu_values = np.asarray((
        -1000, -92, 38, 34, phase.liver_hu, phase.spleen_hu,
        34, phase.aorta_hu, phase.portal_hu, phase.lesion_hu,
        phase.capsule_hu, 450, -680, -955, -40,
        42, 27, -8, 43, 24, 145,
    ), dtype=np.float32)
    frame = hu_values[labels[index]].copy()
    noise_sigma = np.full(labels[index].shape, 13.0, dtype=np.float32)
    noise_sigma[labels[index] == Tissue.AIR] = 0.5
    noise_sigma[labels[index] == Tissue.FAT] = 9.0
    noise_sigma[labels[index] == Tissue.MUSCLE] = 12.0
    noise_sigma[labels[index] == Tissue.SOFT_TISSUE] = 12.0
    noise_sigma[labels[index] == Tissue.LIVER] = 14.0
    noise_sigma[labels[index] == Tissue.SPLEEN] = 14.0
    noise_sigma[labels[index] == Tissue.KIDNEY] = 13.0
    noise_sigma[labels[index] == Tissue.KIDNEY_CORTEX] = 14.0
    noise_sigma[labels[index] == Tissue.KIDNEY_MEDULLA] = 15.0
    noise_sigma[labels[index] == Tissue.KIDNEY_SINUS] = 9.0
    noise_sigma[labels[index] == Tissue.AORTA] = 18.0
    noise_sigma[labels[index] == Tissue.PORTAL_VESSEL] = 16.0
    noise_sigma[labels[index] == Tissue.LESION] = 12.0
    noise_sigma[labels[index] == Tissue.CAPSULE] = 12.0
    noise_sigma[labels[index] == Tissue.BONE] = 16.0
    noise_sigma[labels[index] == Tissue.LUNG] = 22.0
    noise_sigma[labels[index] == Tissue.BOWEL_GAS] = 0.5
    noise_sigma[labels[index] == Tissue.SPINAL_CANAL] = 8.0
    noise_sigma[labels[index] == Tissue.PANCREAS] = 12.0
    noise_sigma[labels[index] == Tissue.GALLBLADDER] = 10.0
    frame += texture[index] * noise_sigma

    # Low-amplitude, slice-continuous parenchymal mottling avoids a perfectly flat solid-organ fill.
    coarse_texture = texture[index].copy()
    gaussian_filter(coarse_texture, sigma=(8.0, 8.0), output=coarse_texture, mode="reflect")
    coarse_std = float(np.std(coarse_texture, dtype=np.float64))
    if coarse_std > 1e-6:
        coarse_texture *= np.float32(1.0 / coarse_std)
        for tissue, amplitude in ((Tissue.LIVER, 2.4), (Tissue.SPLEEN, 1.8),
                                  (Tissue.KIDNEY_CORTEX, 1.6), (Tissue.PANCREAS, 1.4)):
            mask = labels[index] == tissue
            frame[mask] += coarse_texture[mask] * np.float32(amplitude)

    x_axis = (np.arange(frame.shape[1], dtype=np.float32) - (frame.shape[1] - 1) / 2) * PIXEL_SPACING_MM
    y_axis = (np.arange(frame.shape[0], dtype=np.float32) - (frame.shape[0] - 1) / 2) * PIXEL_SPACING_MM
    x, y = np.meshgrid(x_axis, y_axis, indexing="xy")
    z = (index - (labels.shape[0] - 1) / 2) * SLICE_SPACING_MM
    bias = (2.0 * np.sin(x / 57.0 + z / 43.0) + 1.7 * np.cos(y / 63.0 - z / 49.0)).astype(np.float32)
    frame += bias * (labels[index] != Tissue.AIR)
    # Mild in-plane partial-volume smoothing; z continuity comes from the 3-D label field.
    gaussian_filter(frame, sigma=(0.38, 0.38), output=frame, mode="nearest")
    return frame


def hu_to_stored_pixels(hu: np.ndarray) -> np.ndarray:
    stored = np.clip(np.rint(hu - HU_INTERCEPT), 0, 4095)
    return np.ascontiguousarray(stored, dtype="<u2")


def _write_dicom(
    destination: Path,
    pixels: np.ndarray,
    phase: Phase,
    phase_index: int,
    instance_number: int,
    profile: str,
    seed: int,
    study_uid: str,
    frame_uid: str,
    series_uid: str,
    z_mm: float,
) -> str:
    sop_uid = deterministic_uid(f"highpass-synthetic-hcc:{GENERATOR_VERSION}:{profile}:{seed}:{phase.key}:{instance_number}")
    file_meta = FileMetaDataset()
    file_meta.FileMetaInformationVersion = b"\x00\x01"
    file_meta.MediaStorageSOPClassUID = CT_IMAGE_STORAGE_UID
    file_meta.MediaStorageSOPInstanceUID = sop_uid
    file_meta.TransferSyntaxUID = EXPLICIT_VR_LITTLE_ENDIAN_UID
    file_meta.ImplementationClassUID = deterministic_uid(f"highpass-synthetic-hcc-ct-implementation:{GENERATOR_VERSION}")
    file_meta.ImplementationVersionName = "SYNCTGEN_12"
    validate_file_meta(file_meta, enforce_standard=True)

    ds = FileDataset(str(destination), {}, file_meta=file_meta, preamble=b"\x00" * 128)
    ds.SpecificCharacterSet = "ISO_IR 6"
    ds.SOPClassUID = CT_IMAGE_STORAGE_UID
    ds.SOPInstanceUID = sop_uid
    ds.StudyInstanceUID = study_uid
    ds.SeriesInstanceUID = series_uid
    ds.FrameOfReferenceUID = frame_uid
    ds.ImageType = ["DERIVED", "SECONDARY", "AXIAL"]
    ds.Modality = "CT"
    ds.PatientName = SYNTHETIC_PATIENT_NAME
    ds.PatientID = SYNTHETIC_PATIENT_ID
    ds.PatientSex = "M"
    ds.PatientAge = "058Y"
    ds.StudyDate = "20261010"
    ds.StudyTime = "120000"
    ds.SeriesDate = "20261010"
    ds.SeriesTime = f"12{phase_index:02d}00"
    ds.AcquisitionDate = "20261010"
    ds.AcquisitionTime = f"12{phase_index:02d}00"
    ds.ContentDate = "20261010"
    ds.ContentTime = f"12{phase_index:02d}00"
    ds.InstanceCreationDate = "20261010"
    ds.InstanceCreationTime = f"12{phase_index:02d}00"
    ds.AccessionNumber = "SYN-HCC-20261010"
    ds.StudyID = f"SYN{seed % 1000000:06d}"
    ds.StudyDescription = "SYNTHETIC HCC MIMIC - NOT FOR CLINICAL USE"
    ds.SeriesDescription = phase.series_description
    ds.ProtocolName = "SYNTHETIC MULTIPHASE CT"
    ds.BodyPartExamined = "ABDOMEN"
    ds.InstitutionName = "MEDIQ TEST HOSPITAL A - SYNTHETIC"
    ds.Manufacturer = "Highpass Synthetic Data Generator"
    ds.ManufacturerModelName = "Procedural CT Phantom v1.1"
    ds.SoftwareVersions = GENERATOR_VERSION
    ds.DerivationDescription = "FULLY SYNTHETIC PROCEDURAL PHANTOM; NOT ACQUIRED FROM A PERSON; NOT FOR CLINICAL USE."
    ds.BurnedInAnnotation = "NO"
    ds.RecognizableVisualFeatures = "NO"
    ds.PatientPosition = "HFS"
    ds.AcquisitionNumber = phase_index
    ds.SeriesNumber = phase.series_number
    ds.InstanceNumber = instance_number
    ds.TemporalPositionIdentifier = phase_index
    ds.ImagePositionPatient = [-179.2, -179.2, float(f"{z_mm:.4f}")]
    ds.ImageOrientationPatient = [1, 0, 0, 0, 1, 0]
    ds.PixelSpacing = [PIXEL_SPACING_MM, PIXEL_SPACING_MM]
    ds.SliceThickness = SLICE_SPACING_MM
    ds.SpacingBetweenSlices = SLICE_SPACING_MM
    ds.SliceLocation = float(f"{z_mm:.4f}")
    ds.Rows = int(pixels.shape[0])
    ds.Columns = int(pixels.shape[1])
    ds.SamplesPerPixel = 1
    ds.PhotometricInterpretation = "MONOCHROME2"
    ds.BitsAllocated = 16
    ds.BitsStored = 12
    ds.HighBit = 11
    ds.PixelRepresentation = 0
    ds.RescaleSlope = 1
    ds.RescaleIntercept = HU_INTERCEPT
    ds.RescaleType = "HU"
    ds.KVP = "120"
    ds.WindowCenter = 60
    ds.WindowWidth = 400
    ds.PixelData = pixels.tobytes(order="C")
    ds.save_as(destination, enforce_file_format=True)
    return sop_uid


def _preview_image(hu: np.ndarray, phase_label: str) -> Image.Image:
    low, high = -140.0, 260.0
    gray = np.clip((hu - low) * (255.0 / (high - low)), 0, 255).astype(np.uint8)
    image = Image.fromarray(gray, mode="L").convert("RGB")
    canvas = Image.new("RGB", (image.width, image.height + 56), (15, 23, 42))
    canvas.paste(image, (0, 56))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    draw.text((16, 12), f"{phase_label} | {SYNTHETIC_NOTICE}", fill=(255, 255, 255), font=font)
    draw.rectangle((0, 56, image.width - 1, image.height + 55), outline=(18, 135, 255), width=3)
    draw.text((16, image.height + 25), "SYNTHETIC PROCEDURAL PHANTOM - NOT A PATIENT IMAGE", fill=(255, 255, 255), font=font)
    return canvas


def _write_supporting_docs(output: Path, profile: str, seed: int, slices: int, phases: tuple[Phase, ...]) -> None:
    readme = f"""# Synthetic HCC-mimic Multiphase CT

**SYNTHETIC / TEST DATA / NOT FOR CLINICAL USE.** This is a procedural software-test phantom, not a patient image, scanner acquisition, diagnostic dataset, or clinically validated HCC image.

## Dataset

- Profile: `{profile}`; seed: `{seed}`
- Matrix: {COLUMNS} × {ROWS}; 16 allocated / 12 stored bits; unsigned MONOCHROME2
- Phases: {', '.join(phase.label for phase in phases)}
- Slices per phase: {slices}; spacing: {SLICE_SPACING_MM} mm
- Pixel spacing: {PIXEL_SPACING_MM} × {PIXEL_SPACING_MM} mm
- Study, Frame of Reference and Instance UIDs are deterministic for the selected profile and seed. Series UIDs are deterministic per phase.
- DICOM transfer syntax: Explicit VR Little Endian (`{EXPLICIT_VR_LITTLE_ENDIAN_UID}`)
- Patient ID/name fields are synthetic constants. No date of birth or source patient data is included.
- Preview watermarks are separate PNG overlays; no text is burned into DICOM Pixel Data.
- Quality profile: `procedural-detail-v3` adds tissue-specific texture, smooth 3-D contour variation, internal organ regions, cortical/marrow bone contrast, and curved vessel segments. These are visual software-test cues, not anatomically validated segmentation or diagnostic findings.

## Reproduce

```powershell
python -m pip install -r scripts/synthetic_hcc_requirements.txt
python scripts/generate_synthetic_hcc_ct.py --profile {profile} --output artifacts/synthetic-hcc-ct/{profile}-seed-{seed} --seed {seed}
python scripts/validate_synthetic_hcc_ct.py artifacts/synthetic-hcc-ct/{profile}-seed-{seed}
```

The generator refuses to replace an existing output directory unless `--overwrite` is supplied. With `--overwrite`, the exact old output directory is moved to a timestamped sibling backup first.

The manifest SHA-256 is canonical JSON over the manifest fields except `canonicalManifestSha256`. `hashes.sha256` contains one raw-file SHA-256 per DICOM instance.

## Transfer status

Dataset generation and structural validation do not prove Hospital A seed, MediQ transfer, Hospital B storage, or temporary-payload purge. Those are separate runtime gates and must be reported independently.
"""
    scenario = f"""# Synthetic imaging test scenario

Scenario key: `SYNTHETIC-HCC-MIMIC-{profile.upper()}-{seed}`

A completely fabricated 58-year-old male test identity contains one procedurally generated, irregular ellipsoidal liver-region focus of approximately 32 mm in nominal diameter. It is intended only to exercise DICOM object counts, viewer slice navigation, phase-series selection, byte/hash verification and synthetic transfer procedures.

The non-contrast, arterial, portal-venous and delayed parameter sets alter synthetic attenuation lookup values while reusing the same 3-D anatomy labels and deterministic texture field. This is a graphics/testing convention only. The focus must not be interpreted as HCC, a clinical finding, or a diagnostic pattern. No external or patient-derived image data is used.

Every emitted DICOM object has `ImageType=DERIVED\\SECONDARY\\AXIAL`, synthetic identifiers, an explicit derivation notice, and `BurnedInAnnotation=NO`. No private DICOM elements are written. The external previews carry visible synthetic/test/not-for-clinical-use labels.
"""
    (output / "README.md").write_text(readme, encoding="utf-8", newline="\n")
    (output / "scenario.md").write_text(scenario, encoding="utf-8", newline="\n")


def _safe_prepare_output(output: Path, overwrite: bool, workspace: Path) -> Path:
    target = output.expanduser().resolve()
    if target == target.parent or target == workspace.resolve() or target == Path(target.anchor):
        raise ValueError("refusing unsafe output path")
    if target.exists():
        if not overwrite:
            raise FileExistsError(f"output already exists: {target}")
        if target.is_symlink() or not target.is_dir():
            raise ValueError("overwrite target must be a real directory")
        marker = target / ".synthetic-hcc-dataset.json"
        if not marker.is_file():
            raise ValueError("overwrite is permitted only for a dataset created by this generator")
        marker_data = json.loads(marker.read_text(encoding="utf-8"))
        if marker_data.get("generator") != GENERATOR_VERSION or marker_data.get("datasetType") != "SYNTHETIC":
            raise ValueError("existing output marker does not identify this synthetic dataset")
        backup = target.with_name(target.name + ".backup-" + time.strftime("%Y%m%dT%H%M%S"))
        if backup.exists():
            backup = target.with_name(backup.name + f"-{os.getpid()}")
        target.rename(backup)
        print(f"Existing output preserved as: {backup}", file=sys.stderr)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.mkdir(exist_ok=False)
    (target / ".synthetic-hcc-dataset.json").write_text(json.dumps({
        "generator": GENERATOR_VERSION,
        "datasetType": "SYNTHETIC",
        "status": "IN_PROGRESS",
    }, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return target


def validate_dataset(output: Path, verify_pixel_data: bool = True) -> dict[str, Any]:
    root = output.resolve()
    manifest_path = root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("datasetType") != "SYNTHETIC" or manifest.get("clinicalUse") is not False:
        raise ValueError("manifest synthetic/clinical-use declaration is invalid")
    if manifest.get("canonicalManifestSha256") != canonical_manifest_sha256(manifest):
        raise ValueError("canonical manifest digest mismatch")
    phases, expected_slices = profile_definition(manifest["profile"])
    expected_total = len(phases) * expected_slices
    if manifest.get("totalInstances") != expected_total or len(manifest.get("series", [])) != len(phases):
        raise ValueError("manifest profile count mismatch")

    listed_files: set[str] = set()
    all_sops: set[str] = set()
    study_uids: set[str] = set()
    frame_uids: set[str] = set()
    total_bytes = 0
    dicom_root = root / "study"
    for phase_index, (phase, series_record) in enumerate(zip(phases, manifest["series"], strict=True), start=1):
        if series_record["phase"] != phase.label or series_record["description"] != phase.series_description:
            raise ValueError("series phase metadata mismatch")
        instances = series_record.get("instances", [])
        if len(instances) != expected_slices or series_record.get("instanceCount") != expected_slices:
            raise ValueError("series instance count mismatch")
        positions: list[float] = []
        observed_series_uid: str | None = None
        series_bytes = 0
        for expected_number, record in enumerate(instances, start=1):
            relative = Path(record["file"])
            if relative.is_absolute() or ".." in relative.parts or relative.suffix.lower() != ".dcm":
                raise ValueError("manifest contains unsafe DICOM path")
            file_path = (root / relative).resolve()
            if root not in file_path.parents or not file_path.is_file():
                raise ValueError("manifest DICOM file is missing or outside the dataset")
            rel_text = relative.as_posix()
            listed_files.add(rel_text)
            size = file_path.stat().st_size
            total_bytes += size
            series_bytes += size
            if size != record["bytes"] or sha256_file(file_path) != record["sha256"]:
                raise ValueError(f"instance bytes/hash mismatch: {rel_text}")

            ds = dcmread(file_path, force=False)
            if str(ds.SOPClassUID) != CT_IMAGE_STORAGE_UID or str(ds.file_meta.TransferSyntaxUID) != EXPLICIT_VR_LITTLE_ENDIAN_UID:
                raise ValueError("unexpected SOP class or transfer syntax")
            if str(ds.StudyInstanceUID) != manifest["studyInstanceUID"]:
                raise ValueError("Study Instance UID mismatch")
            if str(ds.FrameOfReferenceUID) != manifest["frameOfReferenceUID"]:
                raise ValueError("Frame of Reference UID mismatch")
            if observed_series_uid is None:
                observed_series_uid = str(ds.SeriesInstanceUID)
            if str(ds.SeriesInstanceUID) != observed_series_uid or str(ds.SeriesInstanceUID) != series_record["seriesInstanceUID"]:
                raise ValueError("Series Instance UID mismatch")
            sop_uid = str(ds.SOPInstanceUID)
            if sop_uid in all_sops or sop_uid != record["sopInstanceUID"]:
                raise ValueError("duplicate or mismatched SOP Instance UID")
            all_sops.add(sop_uid)
            study_uids.add(str(ds.StudyInstanceUID))
            frame_uids.add(str(ds.FrameOfReferenceUID))
            if int(ds.InstanceNumber) != expected_number or int(ds.SeriesNumber) != phase.series_number:
                raise ValueError("instance numbering mismatch")
            if list(ds.ImageType) != ["DERIVED", "SECONDARY", "AXIAL"]:
                raise ValueError("image must be labeled as derived secondary axial")
            if (int(ds.Rows), int(ds.Columns), int(ds.BitsAllocated), int(ds.BitsStored), int(ds.HighBit), int(ds.PixelRepresentation)) != (ROWS, COLUMNS, 16, 12, 11, 0):
                raise ValueError("pixel encoding mismatch")
            if str(ds.PhotometricInterpretation) != "MONOCHROME2" or int(ds.SamplesPerPixel) != 1:
                raise ValueError("photometric interpretation mismatch")
            if [float(v) for v in ds.PixelSpacing] != [PIXEL_SPACING_MM, PIXEL_SPACING_MM]:
                raise ValueError("pixel spacing mismatch")
            if float(ds.SliceThickness) != SLICE_SPACING_MM or float(ds.SpacingBetweenSlices) != SLICE_SPACING_MM:
                raise ValueError("slice spacing mismatch")
            if str(ds.BurnedInAnnotation) != "NO" or str(ds.PatientID) != SYNTHETIC_PATIENT_ID or str(ds.PatientName) != SYNTHETIC_PATIENT_NAME:
                raise ValueError("synthetic identity or burned-in annotation declaration mismatch")
            if hasattr(ds, "PatientBirthDate") and str(ds.PatientBirthDate).strip():
                raise ValueError("synthetic study must not include a birth date")
            if any(element.tag.is_private for element in ds.iterall()):
                raise ValueError("private DICOM tag found")
            if "SYNTHETIC" not in str(ds.StudyDescription).upper() or "NOT FOR CLINICAL USE" not in str(ds.StudyDescription).upper():
                raise ValueError("synthetic notice missing from DICOM metadata")
            if verify_pixel_data:
                expected_pixel_bytes = ROWS * COLUMNS * 2
                if len(ds.PixelData) != expected_pixel_bytes:
                    raise ValueError("Pixel Data byte length mismatch")
                pixels = ds.pixel_array
                if pixels.dtype.kind != "u" or pixels.min() < 0 or pixels.max() > 4095:
                    raise ValueError("stored pixel range does not fit unsigned 12-bit")
            positions.append(float(ds.ImagePositionPatient[2]))

        if positions != sorted(positions) or len(set(positions)) != expected_slices:
            raise ValueError("slice positions are not strictly increasing")
        if any(abs((right - left) - SLICE_SPACING_MM) > 0.0001 for left, right in zip(positions, positions[1:])):
            raise ValueError("slice positions are not 1.5 mm apart")
        if series_bytes != series_record["totalBytes"]:
            raise ValueError("series byte total mismatch")

    actual_dicom_files = {p.relative_to(root).as_posix() for p in dicom_root.rglob("*.dcm")}
    if actual_dicom_files != listed_files:
        raise ValueError("DICOM file inventory differs from manifest")
    if total_bytes != manifest["totalDicomBytes"]:
        raise ValueError("total DICOM byte count mismatch")
    if len(study_uids) != 1 or len(frame_uids) != 1 or len(all_sops) != expected_total:
        raise ValueError("global UID/count invariants failed")
    # With raw 16-bit 512x512 frames, actual Pixel Data alone should be in the requested size range.
    if manifest["profile"] == "full" and not (350_000_000 <= total_bytes <= 450_000_000):
        raise ValueError("full-profile byte total outside requested 350-450 MB range")
    return {
        "status": "PASS",
        "studyInstanceUID": manifest["studyInstanceUID"],
        "seriesCount": len(phases),
        "instances": expected_total,
        "dicomBytes": total_bytes,
        "canonicalManifestSha256": manifest["canonicalManifestSha256"],
        "pixelDataValidated": bool(verify_pixel_data),
        "clinicalUse": False,
        "review": "DRAFT / UNASSIGNED",
    }


def generate_dataset(output: Path, profile: str, seed: int, overwrite: bool, workspace: Path) -> dict[str, Any]:
    phases, slices = profile_definition(profile)
    target = _safe_prepare_output(output, overwrite, workspace)
    (target / "study").mkdir()
    uid_namespace = f"highpass-synthetic-hcc:{GENERATOR_VERSION}:{profile}:{seed}"
    study_uid = deterministic_uid(f"{uid_namespace}:study")
    frame_uid = deterministic_uid(f"{uid_namespace}:frame")
    labels = build_anatomy_volume(slices)
    texture = build_noise_volume(labels.shape, seed)
    target_index = slices // 2
    series_records: list[dict[str, Any]] = []
    hash_lines: list[str] = []

    for phase_index, phase in enumerate(phases, start=1):
        series_uid = deterministic_uid(f"{uid_namespace}:series:{phase.key}")
        series_dir = target / "study" / f"{phase.series_number:02d}_{phase.key}"
        series_dir.mkdir()
        instance_records: list[dict[str, Any]] = []
        phase_bytes = 0
        for slice_index in range(slices):
            hu = render_hu_frame(labels, texture, phase, slice_index)
            pixels = hu_to_stored_pixels(hu)
            z_mm = (slice_index - (slices - 1) / 2) * SLICE_SPACING_MM
            file_name = f"IM_{slice_index + 1:04d}.dcm"
            destination = series_dir / file_name
            sop_uid = _write_dicom(destination, pixels, phase, phase_index, slice_index + 1,
                                   profile, seed, study_uid, frame_uid, series_uid, z_mm)
            size = destination.stat().st_size
            digest = sha256_file(destination)
            relative = destination.relative_to(target).as_posix()
            instance_records.append({
                "sopInstanceUID": sop_uid,
                "instanceNumber": slice_index + 1,
                "file": relative,
                "bytes": size,
                "sha256": digest,
            })
            hash_lines.append(f"{digest}  {relative}")
            phase_bytes += size
        series_records.append({
            "phase": phase.label,
            "seriesInstanceUID": series_uid,
            "description": phase.series_description,
            "seriesNumber": phase.series_number,
            "instanceCount": slices,
            "totalBytes": phase_bytes,
            "instances": instance_records,
        })
        print(json.dumps({"series": phase.label, "instances": slices, "bytes": phase_bytes}, ensure_ascii=True))

    preview_dir = target / "preview"
    preview_dir.mkdir(exist_ok=False)
    # Previews are rendered from the same volume/phase function as the DICOM pixel arrays.
    phase_images: list[Image.Image] = []
    for phase in phases:
        hu = render_hu_frame(labels, texture, phase, target_index)
        image = _preview_image(hu, phase.label)
        image.save(preview_dir / f"{phase.series_number:02d}_{phase.key}.png", format="PNG", optimize=False)
        phase_images.append(image)
    comparison = Image.new("RGB", (phase_images[0].width * 2, phase_images[0].height * 2 + 42), (15, 23, 42))
    draw = ImageDraw.Draw(comparison)
    draw.text((14, 14), f"{SYNTHETIC_NOTICE} | SAME ANATOMY, DIFFERENT SYNTHETIC PHASE PARAMETERS", fill="white", font=ImageFont.load_default())
    for idx, image in enumerate(phase_images):
        comparison.paste(image, ((idx % 2) * image.width, 42 + (idx // 2) * image.height))
    comparison.save(preview_dir / "hcc_phase_comparison.png", format="PNG", optimize=False)

    total_bytes = sum(row["totalBytes"] for row in series_records)
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "generator": GENERATOR_VERSION,
        "qualityProfile": "procedural-detail-v3",
        "datasetType": "SYNTHETIC",
        "clinicalUse": False,
        "clinicalDisclaimer": SYNTHETIC_NOTICE,
        "profile": profile,
        "seed": seed,
        "patientReference": SYNTHETIC_PATIENT_ID,
        "patientName": SYNTHETIC_PATIENT_NAME,
        "studyInstanceUID": study_uid,
        "frameOfReferenceUID": frame_uid,
        "modality": "CT",
        "sopClassUID": CT_IMAGE_STORAGE_UID,
        "transferSyntaxUID": EXPLICIT_VR_LITTLE_ENDIAN_UID,
        "rows": ROWS,
        "columns": COLUMNS,
        "bitsAllocated": 16,
        "bitsStored": 12,
        "pixelRepresentation": "UNSIGNED",
        "photometricInterpretation": "MONOCHROME2",
        "pixelSpacingMm": [PIXEL_SPACING_MM, PIXEL_SPACING_MM],
        "sliceThicknessMm": SLICE_SPACING_MM,
        "spacingBetweenSlicesMm": SLICE_SPACING_MM,
        "series": series_records,
        "totalInstances": sum(row["instanceCount"] for row in series_records),
        "totalDicomBytes": total_bytes,
        "validationStatus": "IN_PROGRESS",
        "review": "DRAFT / UNASSIGNED",
    }
    manifest_path = target / "manifest.json"
    manifest["canonicalManifestSha256"] = canonical_manifest_sha256(manifest)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    (target / "hashes.sha256").write_text("\n".join(hash_lines) + "\n", encoding="ascii", newline="\n")
    _write_supporting_docs(target, profile, seed, slices, phases)

    result = validate_dataset(target)
    manifest["validationStatus"] = "PASS"
    manifest["canonicalManifestSha256"] = canonical_manifest_sha256(manifest)
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    result = validate_dataset(target)
    (target / "validation.json").write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    (target / ".synthetic-hcc-dataset.json").write_text(json.dumps({
        "generator": GENERATOR_VERSION,
        "datasetType": "SYNTHETIC",
        "status": "PASS",
        "canonicalManifestSha256": manifest["canonicalManifestSha256"],
    }, sort_keys=True) + "\n", encoding="utf-8", newline="\n")
    return {**result, "output": str(target), "profile": profile, "seed": seed}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", choices=("demo", "full"), default="full")
    parser.add_argument("--output", type=Path, default=Path("artifacts/synthetic-hcc-ct/full-seed-20261010"))
    parser.add_argument("--seed", type=int, default=SEED_DEFAULT)
    parser.add_argument("--overwrite", action="store_true", help="preserve the exact old output as a timestamped sibling backup before generating")
    args = parser.parse_args()
    if args.seed < 0 or args.seed > 2**32 - 1:
        parser.error("--seed must be between 0 and 4294967295")
    try:
        result = generate_dataset(args.output, args.profile, args.seed, args.overwrite, Path.cwd())
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:  # The printed error avoids identifiers, pixels, or patient content.
        print(json.dumps({"status": "FAIL", "errorType": type(error).__name__, "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
