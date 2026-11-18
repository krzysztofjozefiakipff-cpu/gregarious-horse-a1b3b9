#!/usr/bin/env python3
"""CARVAMO V27: mask-assisted tyre contact refinement and shadow preview.

Diagnostic ONLY. The local alpha silhouette can include bumper/shadow pixels;
results are provisional and cannot establish a 3D ground plane. Does not alter
the production worker or original photographs.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

PHOTOS = {"front": "IMG_9146(2).jpeg", "side": "IMG_9147(1).jpeg",
          "rear": "IMG_9148(2).jpeg"}


def refine_contact(alpha, x, y, radius, threshold=190):
    """Use median of bottommost alpha pixels in a narrow band around wheel x.

    Search only near predicted tyre bottom to avoid nearby body panels/shadows.
    Return None if evidence is insufficient or correction too large.
    """
    width, height = alpha.size
    if radius <= 0 or not (0 <= x < width and 0 <= y < height):
        return None
    predicted = y + radius
    half_band = max(2, round(radius * .16))
    top = max(0, round(predicted - radius * .38))
    bottom = min(height - 1, round(predicted + radius * .38))
    if top >= bottom:
        return None
    pix = alpha.load()
    bottoms = []
    for xx in range(max(0, round(x)-half_band),
                    min(width-1, round(x)+half_band)+1):
        hits = [yy for yy in range(top, bottom+1)
                if pix[xx, yy] >= threshold]
        if hits:
            bottoms.append(max(hits))
    if len(bottoms) < max(3, half_band // 2):
        return None
    bottoms.sort()
    median = bottoms[len(bottoms)//2]
    if abs(median-predicted) > radius*.30:
        return None
    return median


def analyse(view, photo, foreground, circles, output):
    if photo.size != foreground.size:
        raise ValueError(f"{view}: dimensions mismatch")
    if len(circles) != 2:
        return {"status": "abstained", "reason": "requires two wheel proposals"}
    alpha = foreground.getchannel("A")
    corrected = []
    for circle in circles:
        x, y, r = map(float, circle)
        contact = refine_contact(alpha, x, y, r)
        if contact is None:
            return {"status": "abstained",
                    "reason": "no reliable mask evidence for both wheels"}
        corrected.append({"x": round(x), "center_y": round(y),
                          "detected_radius": round(r),
                          "raw_contact_y": round(y+r,1),
                          "refined_contact_y": contact,
                          "delta_y": round(contact-(y+r),1)})
    # Overlay is intentionally drawn on the original photo for inspection;
    # shadow previews are NOT composited into the actual showroom scene.
    preview = photo.copy().convert("RGBA")
    shadow = Image.new("RGBA", preview.size, (0,0,0,0))
    sd = ImageDraw.Draw(shadow)
    for c in corrected:
        x, cy, r, bottom = (c["x"], c["center_y"],
                            c["detected_radius"], c["refined_contact_y"])
        sd.ellipse((x-r*.72, bottom-r*.10, x+r*.72, bottom+r*.14),
                   fill=(0,0,0,52))
    preview = Image.alpha_composite(preview, shadow)
    draw = ImageDraw.Draw(preview)
    for c in corrected:
        x, cy, r, bottom = (c["x"], c["center_y"],
                            c["detected_radius"], c["refined_contact_y"])
        draw.ellipse((x-r,cy-r,x+r,cy+r), outline="#00ff73", width=4)
        draw.line((x-15,bottom,x+15,bottom),fill="#00d9ff",width=5)
        draw.line((x,bottom-15,x,bottom+15),fill="#00d9ff",width=5)
        draw.line((x, c["raw_contact_y"], x, bottom), fill="#ffae00",width=3)
    draw.line([(c["x"],c["refined_contact_y"]) for c in corrected],
              fill="#00d9ff",width=3)
    output.mkdir(parents=True, exist_ok=True)
    preview.convert("RGB").save(output/f"{view}_v27_contact_preview.jpg",
                                quality=94)
    return {"status": "provisional_mask_refined", "contacts": corrected,
            "camera_pose_verified": False, "ground_plane_verified": False,
            "shadow_is_diagnostic_only": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--photos", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--pairs", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    pairs = json.loads(args.pairs.read_text())
    report = {}
    for view, filename in PHOTOS.items():
        with Image.open(args.photos/filename) as im:
            photo = ImageOps.exif_transpose(im).convert("RGB")
        with Image.open(args.results/f"v19-{view}"/"segmented.png") as im:
            foreground = im.convert("RGBA")
        report[view] = analyse(view, photo, foreground,
                               pairs.get(view, []), args.output)
        print(view, report[view]["status"])
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/"v27_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
