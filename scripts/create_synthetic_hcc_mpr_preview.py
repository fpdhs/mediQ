#!/usr/bin/env python3
"""Create an explicitly synthetic MPR visual-QA sheet from one DICOM phase."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from pydicom import dcmread

from generate_synthetic_hcc_ct import validate_dataset


def window_pixels(ds, level: float, width: float) -> Image.Image:
    hu = ds.pixel_array.astype(np.float32) * float(ds.RescaleSlope) + float(ds.RescaleIntercept)
    low = level - width / 2.0
    pixels = np.clip((hu - low) * (255.0 / width), 0, 255).astype(np.uint8)
    return Image.fromarray(pixels, mode="L").convert("RGB")


def resize_mpr(array: np.ndarray, width: int, target_height: int) -> Image.Image:
    """Resample only for display so unequal z/x spacing is not shown as square voxels."""
    image = Image.fromarray(array.astype(np.uint8), mode="L").convert("RGB")
    return image.resize((width, target_height), Image.Resampling.LANCZOS)


def create_preview(dataset: Path, phase: str, level: float, width: float,
                   roi_x_mm: float, roi_y_mm: float, roi_z_mm: float) -> dict:
    dataset = dataset.expanduser().resolve()
    validation = validate_dataset(dataset, verify_pixel_data=True)
    manifest = json.loads((dataset / "manifest.json").read_text(encoding="utf-8"))
    series = next((item for item in manifest["series"] if item["phase"].casefold() == phase.casefold()), None)
    if series is None:
        raise ValueError("requested phase is not present in the dataset")

    slices = [dcmread(dataset / item["file"], force=False) for item in series["instances"]]
    first = slices[0]
    rows, columns = int(first.Rows), int(first.Columns)
    volume = np.stack([image.pixel_array for image in slices], axis=0)
    intercept, slope = float(first.RescaleIntercept), float(first.RescaleSlope)
    low = level - width / 2.0

    def mapped(stored: np.ndarray) -> np.ndarray:
        hu = stored.astype(np.float32) * slope + intercept
        return np.clip((hu - low) * (255.0 / width), 0, 255).astype(np.uint8)

    z_index = round((roi_z_mm - float(first.ImagePositionPatient[2])) / float(first.SpacingBetweenSlices))
    y_index = round(roi_y_mm / float(first.PixelSpacing[0]) + (rows - 1) / 2)
    x_index = round(roi_x_mm / float(first.PixelSpacing[1]) + (columns - 1) / 2)
    z_index = min(max(z_index, 0), len(slices) - 1)
    y_index = min(max(y_index, 0), rows - 1)
    x_index = min(max(x_index, 0), columns - 1)
    axial = mapped(volume[z_index])
    coronal = np.flipud(mapped(volume[:, y_index, :]))
    sagittal = np.flipud(mapped(volume[:, :, x_index]))
    spacing_xy = float(first.PixelSpacing[0])
    spacing_z = float(first.SpacingBetweenSlices)
    display_mpr_height = max(1, round(len(slices) * spacing_z / spacing_xy))
    axial_image = Image.fromarray(axial, mode="L").convert("RGB")
    coronal_image = resize_mpr(coronal, columns, display_mpr_height)
    sagittal_image = resize_mpr(sagittal, rows, display_mpr_height)

    panel_width, panel_height, header_height = max(rows, columns), max(rows, columns), 56
    canvas = Image.new("RGB", (panel_width * 3, panel_height + header_height + 38), (7, 12, 18))
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    draw.text((18, 12), f"SYNTHETIC / TEST ONLY  |  {phase.upper()}  |  WL {level:g} / WW {width:g}", fill=(232, 242, 251), font=font)
    draw.text((18, 32), "NOT FOR CLINICAL USE — MPR reconstructed from this candidate's DICOM pixels", fill=(133, 191, 227), font=font)

    panels = (("AXIAL", axial_image), ("CORONAL", coronal_image), ("SAGITTAL", sagittal_image))
    crosshair_color = (68, 205, 231)
    mpr_top = header_height + max(0, (panel_height - display_mpr_height) // 2)
    for index, (label, image) in enumerate(panels):
        x = index * panel_width
        y = header_height + max(0, (panel_height - image.height) // 2)
        canvas.paste(image, (x, y))
        draw.rectangle((x, header_height, x + panel_width - 1, header_height + panel_height - 1), outline=(58, 91, 117), width=1)
        draw.text((x + 12, header_height + 10), label, fill=(225, 239, 250), font=font, stroke_width=1, stroke_fill=(8, 13, 20))
        if index == 0:
            draw.line((x_index, header_height, x_index, header_height + panel_height - 1), fill=crosshair_color, width=1)
            draw.line((0, header_height + y_index, panel_width - 1, header_height + y_index), fill=crosshair_color, width=1)
        else:
            horizontal = mpr_top + round((display_mpr_height - 1) * z_index / max(1, len(slices) - 1))
            vertical_index = x_index if index == 1 else y_index
            draw.line((x + vertical_index, mpr_top, x + vertical_index, mpr_top + display_mpr_height - 1), fill=crosshair_color, width=1)
            draw.line((x, horizontal, x + panel_width - 1, horizontal), fill=crosshair_color, width=1)

    footer_y = header_height + panel_height + 8
    draw.text((18, footer_y), "Synthetic ROI crosshair only; MPR display interpolation does not alter source DICOM pixels.", fill=(165, 186, 201), font=font)
    preview_dir = dataset / "preview"
    preview_dir.mkdir(exist_ok=True)
    output = preview_dir / f"mpr_{series['phase'].lower()}_roi.png"
    metadata_path = preview_dir / f"mpr_{series['phase'].lower()}_roi.json"
    if output.exists() or metadata_path.exists():
        raise FileExistsError("MPR preview output already exists; refusing overwrite")
    canvas.save(output, format="PNG", optimize=False)
    record = {
        "status": "PASS",
        "review": "DRAFT / UNASSIGNED",
        "datasetManifestSha256": manifest["canonicalManifestSha256"],
        "datasetValidation": validation["status"],
        "studyInstanceUID": manifest["studyInstanceUID"],
        "phase": series["phase"],
        "instancesRead": len(slices),
        "sourceRows": rows,
        "sourceColumns": columns,
        "pixelSpacingMm": [float(value) for value in first.PixelSpacing],
        "spacingBetweenSlicesMm": spacing_z,
        "windowLevel": level,
        "windowWidth": width,
        "syntheticRoiMm": {"x": roi_x_mm, "y": roi_y_mm, "z": roi_z_mm},
        "centerVoxel": {"sliceIndexZeroBased": z_index, "rowIndexZeroBased": y_index, "columnIndexZeroBased": x_index},
        "displayInterpolationOnly": True,
        "crosshairMeaning": "synthetic display-coordinate reference only; not a clinical annotation",
        "sourceDicomModified": False,
        "clinicalUse": False,
        "preview": str(output),
    }
    metadata_path.write_text(json.dumps(record, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return record


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--phase", default="ARTERIAL")
    parser.add_argument("--window-level", type=float, default=60)
    parser.add_argument("--window-width", type=float, default=400)
    parser.add_argument("--roi-x-mm", type=float, default=53.0)
    parser.add_argument("--roi-y-mm", type=float, default=-35.0)
    parser.add_argument("--roi-z-mm", type=float, default=17.0)
    args = parser.parse_args()
    if args.window_width <= 0:
        parser.error("--window-width must be positive")
    print(json.dumps(create_preview(args.dataset, args.phase, args.window_level, args.window_width,
                                    args.roi_x_mm, args.roi_y_mm, args.roi_z_mm), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
