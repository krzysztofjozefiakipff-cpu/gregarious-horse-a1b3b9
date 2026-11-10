#!/usr/bin/env python3
"""Fail closed when CARVELO 180 empty showroom renders are blank or inconsistent.

Usage: python validate_showroom_renders.py /path/to/output
Requires Pillow: python -m pip install Pillow
This is a *technical* smoke test, not visual acceptance of real car photos.
"""
import argparse
import json
from pathlib import Path


def validate(directory: Path, min_range: float = 0.12, min_detail: float = 0.015):
    try:
        from PIL import Image, ImageStat, ImageChops
    except ImportError as exc:
        raise RuntimeError("Pillow is required: pip install Pillow") from exc

    manifest = directory / "camera_manifest.json"
    if not manifest.is_file():
        raise ValueError("Missing camera_manifest.json")
    views = json.loads(manifest.read_text(encoding="utf-8")).get("camera_views", [])
    if len(views) < 3:
        raise ValueError("Need at least three camera perspectives")
    angles = [view["azimuth_deg"] for view in views]
    if len(set(angles)) != len(angles) or angles != sorted(angles):
        raise ValueError("Camera angles must be unique and ordered")
    if angles[0] != -90 or angles[-1] != 90:
        raise ValueError("Camera orbit must cover -90 to +90 degrees")

    signatures = []
    for view in views:
        filename = view["image"]
        if Path(filename).name != filename:
            raise ValueError(f"Unsafe image path: {filename}")
        path = directory / filename
        if not path.is_file():
            raise ValueError(f"Missing render: {filename}")
        with Image.open(path) as source:
            image = source.convert("RGB")
        if list(image.size) != list(view["resolution"]):
            raise ValueError(f"Resolution mismatch: {filename}")
        thumb = image.resize((128, 72)).convert("L")
        stats = ImageStat.Stat(thumb)
        extrema = thumb.getextrema()
        dynamic_range = (extrema[1] - extrema[0]) / 255.0
        detail = stats.stddev[0] / 255.0
        if dynamic_range < min_range or detail < min_detail:
            raise ValueError(
                f"Low-detail/blank render {filename}: range={dynamic_range:.3f}, "
                f"stddev={detail:.3f}"
            )
        signatures.append((filename, thumb))

    # Catch a frozen camera or accidentally reused output for every perspective.
    first_name, first_image = signatures[0]
    if all(ImageChops.difference(first_image, im).getbbox() is None
           for _, im in signatures[1:]):
        raise ValueError(f"All perspectives are identical to {first_name}")

    print(f"PASS: {len(views)} distinct camera positions; nonblank render checks passed.")
    print("NOT VERIFIED: car placement, tyre contacts, shadows, glazing or visual quality.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--min-range", type=float, default=0.12)
    parser.add_argument("--min-detail", type=float, default=0.015)
    args = parser.parse_args()
    try:
        validate(args.output_dir, args.min_range, args.min_detail)
    except (ValueError, RuntimeError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f"FAIL: {exc}\n")


if __name__ == "__main__":
    main()
