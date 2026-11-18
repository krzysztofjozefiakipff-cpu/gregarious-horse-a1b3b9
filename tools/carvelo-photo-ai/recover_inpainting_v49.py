#!/usr/bin/env python3
"""CARVAMO V49: local-only recovery of an already generated fal.ai image.

No API calls, no uploads, no paid inference, no publication.
Generated backdrop is resized to the V47 canvas; protected original car pixels
are restored exactly from V47 input. Provider-generated bottom text/logos are
replaced with the original V47 backdrop outside the protected car mask.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageOps

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--v47-dir", type=Path, required=True)
    p.add_argument("--view", choices=("front", "side", "rear"), default="rear")
    p.add_argument("--generated", type=Path)
    p.add_argument("--output-dir", type=Path)
    p.add_argument("--clean-bottom-px", type=int, default=90)
    args = p.parse_args()
    base = args.v47_dir / args.view
    generated_path = args.generated or base / "v48" / "generated_background.png"
    out = args.output_dir or base / "v49"
    required = [base / "input.png", base / "protect_car_mask.png", generated_path]
    for path in required:
        if not path.is_file():
            p.error("Missing input: " + str(path))
    with Image.open(base / "input.png") as im:
        original = im.convert("RGB")
    with Image.open(base / "protect_car_mask.png") as im:
        protect = im.convert("L")
    with Image.open(generated_path) as im:
        source_size = im.size
        generated = im.convert("RGB")
    if protect.size != original.size:
        p.error("Protection mask size mismatch")
    # Only the AI-produced backdrop is resized. Original vehicle pixels are
    # copied from the exact V47 composite at their original coordinates.
    if generated.size != original.size:
        generated = generated.resize(original.size, Image.Resampling.LANCZOS)
    w, h = original.size
    strip = max(0, min(args.clean_bottom_px, h))
    if strip:
        # Clear hallucinated branding and captions in the lower image strip.
        # The original V47 backdrop is reused here, with protected car pixels
        # restored on top afterward.
        generated.paste(original.crop((0, h-strip, w, h)), (0, h-strip))
    result = Image.composite(original, generated, protect)
    # Strict invariant: every fully protected car pixel equals V47 input.
    full_mask = protect.point(lambda v: 255 if v == 255 else 0)
    diff = ImageChops.difference(result, original)
    protected_diff = Image.composite(diff, Image.new("RGB", original.size), full_mask)
    if protected_diff.getbbox():
        raise AssertionError("Protected original car pixels changed")
    out.mkdir(parents=True, exist_ok=True)
    result_path = out / "protected_car_result_v49.png"
    result.save(result_path)
    # Diagnostic overlay: source-mask boundaries are shown for visual review.
    overlay = result.copy()
    edges = protect.filter(__import__("PIL.ImageFilter", fromlist=["FIND_EDGES"]).FIND_EDGES)
    edge_rgba = Image.new("RGBA", original.size, (255, 0, 0, 0))
    edge_rgba.putalpha(edges.point(lambda v: 190 if v > 30 else 0))
    overlay = Image.alpha_composite(overlay.convert("RGBA"), edge_rgba).convert("RGB")
    overlay.save(out / "mask_boundary_review_v49.png")
    manifest = {
        "version": "v49", "view": args.view,
        "source_generated_size": list(source_size),
        "output_size": [w, h],
        "background_resized_only": source_size != original.size,
        "car_full_protection_pixels_unchanged": True,
        "lower_strip_replaced_from_v47_px": strip,
        "logo_applied": False,
        "status": "manual_qa_required",
        "tire_ground_contact_verified": False,
        "mask_edge_quality_verified": False,
        "ready_for_publication": False,
        "paid_api_calls": 0
    }
    (out / "manifest_v49.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("V49 complete:", result_path)
    print("Review:", out / "mask_boundary_review_v49.png")
    print("Original car protected. No fal.ai calls. Manual QA required.")

if __name__ == "__main__":
    main()
