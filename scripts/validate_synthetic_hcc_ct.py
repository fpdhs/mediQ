#!/usr/bin/env python3
"""Validate a generated synthetic CT dataset against its manifest and DICOM attributes."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from generate_synthetic_hcc_ct import validate_dataset


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("dataset", type=Path)
    parser.add_argument("--skip-pixel-decode", action="store_true", help="still parse/hash Pixel Data but do not decode arrays")
    args = parser.parse_args()
    try:
        result = validate_dataset(args.dataset, verify_pixel_data=not args.skip_pixel_decode)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except Exception as error:
        print(json.dumps({"status": "FAIL", "errorType": type(error).__name__, "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
