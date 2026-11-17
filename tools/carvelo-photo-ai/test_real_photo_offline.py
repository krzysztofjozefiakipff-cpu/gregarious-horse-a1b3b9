#!/usr/bin/env python3
"""Offline CARVAMO Photo AI test: no database, Supabase, or uploads.

Run on a real, authorized vehicle photograph. Preserves source pixels and
fails closed when segmentation or wheel grounding is unreliable.
"""
import argparse
import io
import json
from pathlib import Path

from PIL import Image, ImageOps
from rembg import remove, new_session

from showroom_3d_adapter import load_background
from studio_compose import compose_grounded_vehicle


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--photo", type=Path, required=True)
    parser.add_argument("--showroom-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--azimuth", type=float, required=True,
                        help="Known source camera azimuth, degrees (-90 to +90)")
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.photo) as source:
        if source.width * source.height > 12_000_000:
            raise ValueError("source_pixel_limit")
        photo = ImageOps.exif_transpose(source).convert("RGBA")
    photo.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    photo.convert("RGB").save(buf, format="PNG")
    cut = remove(buf.getvalue(), session=new_session("u2net"))
    with Image.open(io.BytesIO(cut)) as cut_img:
        foreground = cut_img.convert("RGBA")
    if foreground.size != photo.size:
        foreground = foreground.resize(photo.size, Image.Resampling.BILINEAR)
    import numpy as np
    matte = np.asarray(foreground.getchannel("A"), dtype=np.uint8)
    covered = float((matte > 48).mean())
    if covered < .12 or covered > .86 or float((matte > 238).mean()) < .08:
        raise ValueError("mask_quality_unreliable")
    background = load_background(args.showroom_dir, args.azimuth, photo.size)
    result, placement = compose_grounded_vehicle(foreground, background, source_photo=photo)
    if not placement.get("wheel_grounded"):
        raise ValueError("wheel_grounding_unsafe")
    foreground.save(args.output_dir / "segmented.png")
    result.convert("RGB").save(args.output_dir / "composite.png")
    (args.output_dir / "result.json").write_text(json.dumps({
        "status": "ok", "source_photo": args.photo.name,
        "source_azimuth_deg": args.azimuth,
        "size": list(photo.size), "mask_coverage": round(covered, 4),
        "placement": placement
    }, indent=2, default=str), encoding="utf-8")
    print("CARVAMO_OFFLINE_TEST_OK", args.output_dir)


if __name__ == "__main__":
    main()
