#!/usr/bin/env python3
"""Offline CARVAMO Photo AI test: no database, Supabase, or uploads.

Run on a real, authorized vehicle photograph. Preserves source pixels and
fails closed when segmentation or wheel grounding is unreliable.
"""
import argparse
import io
import json
from math import isfinite
from pathlib import Path

from PIL import Image, ImageOps, ImageDraw
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
    parser.add_argument("--analyze-wheels", action="store_true",
                        help="Optional wheel-centre candidates from photo; requires OpenCV")
    parser.add_argument("--analyze-perspective", action="store_true",
                        help="Optional image-derived line cues; requires OpenCV")
    parser.add_argument("--floor-anchors", type=Path,
                        help="Optional independently measured floor contacts JSON with points and tolerance_px")
    args = parser.parse_args()
    if not isfinite(args.azimuth) or not -90 <= args.azimuth <= 90:
        parser.error("--azimuth must be finite and between -90 and 90")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.photo) as source:
        # EXIF may provide camera/lens metadata but never a reliable vehicle
        # azimuth or calibrated camera pose. Do not publish inferred values.
        exif = source.getexif()
        camera_make = str(exif.get(271, ""))[:80] or None
        camera_model = str(exif.get(272, ""))[:80] or None
        focal_raw = exif.get(37386)
        try:
            focal_mm = float(focal_raw)
            if not isfinite(focal_mm) or not 0 < focal_mm < 1000:
                focal_mm = None
        except (TypeError, ValueError, ZeroDivisionError, OverflowError):
            focal_mm = None
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
    perspective = None
    if args.analyze_perspective:
        from photo_perspective import analyze_vehicle_lines
        perspective = analyze_vehicle_lines(photo, foreground)
    wheels = None
    if args.analyze_wheels:
        from photo_wheels import detect_wheel_candidates
        wheels = detect_wheel_candidates(photo, foreground)
    background = load_background(args.showroom_dir, args.azimuth, photo.size)
    result, placement = compose_grounded_vehicle(foreground, background, source_photo=photo)
    if not placement.get("wheel_grounded"):
        raise ValueError("wheel_grounding_unsafe")
    # Silhouette contacts are hypotheses, not independent floor calibration.
    qa = {"floor_alignment": "unverified", "independent_anchors": False}
    if args.floor_anchors is not None:
        from showroom_camera import floor_alignment_error
        calibration = json.loads(args.floor_anchors.read_text(encoding="utf-8"))
        anchors = calibration["points"]
        tolerance = float(calibration.get("tolerance_px", 12))
        observed = placement["wheel_contact_points"]
        if len(anchors) != len(observed) or not 0 < tolerance <= 100:
            raise ValueError("floor_anchor_metadata_invalid")
        if any(len(p) != 2 or not all(isinstance(v, (int, float)) for v in p)
               for p in anchors):
            raise ValueError("floor_anchor_metadata_invalid")
        error = floor_alignment_error(observed, anchors)
        qa = {"floor_alignment": "pass" if error <= tolerance else "fail",
              "independent_anchors": True,
              "floor_alignment_rms_px": round(error, 2),
              "floor_alignment_tolerance_px": tolerance}
        diagnostic = result.convert("RGB").copy()
        pen = ImageDraw.Draw(diagnostic)
        for (mx, my), (ax, ay) in zip(observed, anchors):
            pen.line((mx, my, ax, ay), fill=(255, 170, 0), width=3)
            pen.ellipse((ax-6, ay-6, ax+6, ay+6), outline=(0, 230, 80), width=3)
            pen.ellipse((mx-5, my-5, mx+5, my+5), outline=(255, 40, 40), width=3)
        diagnostic.save(args.output_dir / "floor_alignment_diagnostic.png")
        if error > tolerance:
            raise ValueError("wheel_ground_plane_unreliable")
    if wheels is not None:
        placement["image_wheel_candidates"] = wheels
        diagnostic = photo.convert("RGB").copy()
        pen = ImageDraw.Draw(diagnostic)
        for idx, candidate in enumerate(wheels["candidates"], start=1):
            x, y, radius = (candidate[k] for k in ("x", "y", "radius"))
            pen.ellipse((x-radius, y-radius, x+radius, y+radius),
                        outline=(255, 40, 40), width=4)
            pen.text((x+radius+3, y-10), str(idx), fill=(255, 255, 0),
                     stroke_width=2, stroke_fill=(0, 0, 0))
        pair_indices = wheels.get("wheel_pair_candidate_indices") or []
        for index in pair_indices:
            candidate = wheels["candidates"][index-1]
            x, y, radius = (candidate[k] for k in ("x", "y", "radius"))
            pen.ellipse((x-radius, y-radius, x+radius, y+radius),
                        outline=(30, 230, 70), width=5)
        diagnostic.save(args.output_dir / "wheel_candidates_diagnostic.png")
    if perspective is not None:
        placement["image_perspective"] = perspective
    placement["floor_calibration"] = qa
    placement["camera_source"] = {
        "azimuth": "manual_test_input_not_estimated",
        "camera_make": camera_make,
        "camera_model": camera_model,
        "exif_focal_length_mm": focal_mm,
        "camera_pose_from_photo": "not_estimated",
        "exif_is_sufficient_for_calibration": False,
    }
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
