#!/usr/bin/env python3
"""CARVAMO V28: offline real showroom background + car RGBA compositor.

Requires an ACTUAL empty Blender showroom render from build_showroom_3d.py,
not a generated backdrop. Uses V27 contact points and V19 segmented car.
This is a 2D proof of concept, NOT a 3D reconstruction or camera calibration.
Do not use in production without manual inspection and camera-pose matching.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

VIEWS = ("front", "side", "rear")


def render(background, car, contacts, output, width_fraction=.82,
           ground_fraction=.82, opacity=90):
    if len(contacts) != 2:
        raise ValueError("Two refined contacts required")
    bg = background.convert("RGBA")
    fg = car.convert("RGBA")
    alpha = fg.getchannel("A")
    bounds = alpha.point(lambda v: 255 if v >= 25 else 0).getbbox()
    if not bounds:
        raise ValueError("Empty foreground alpha mask")
    left, top, right, bottom = bounds
    fg = fg.crop(bounds)
    src_w, src_h = fg.size
    bw, bh = bg.size
    scale = min((bw * width_fraction) / src_w, (bh * .85) / src_h)
    nw, nh = max(1, round(src_w * scale)), max(1, round(src_h * scale))
    fg = fg.resize((nw, nh), Image.Resampling.LANCZOS)
    # Keep the midpoint of the TWO ground contact anchors at target floor line.
    mean_contact_x = sum(float(c["x"]) for c in contacts) / 2
    mean_contact_y = sum(float(c["refined_contact_y"]) for c in contacts) / 2
    dx = round(bw / 2 - (mean_contact_x-left)*scale)
    dy = round(bh*ground_fraction - (mean_contact_y-top)*scale)
    if dx < -nw*.15 or dx+nw > bw*1.15 or dy < -nh*.15 or dy+nh > bh*1.15:
        raise ValueError("Placement exceeds canvas; adjust scale/floor fraction")
    # Shadow behind car. Blur the layer, not the vehicle. Shadows are
    # intentionally approximate until camera perspective is validated.
    shadow = Image.new("RGBA", bg.size)
    sd = ImageDraw.Draw(shadow)
    points = []
    for c in contacts:
        x = dx + (float(c["x"])-left)*scale
        y = dy + (float(c["refined_contact_y"])-top)*scale
        r = float(c["detected_radius"])*scale
        points.append((round(x, 1), round(y, 1)))
        sd.ellipse((x-r*.9,y-r*.11,x+r*.9,y+r*.16),
                   fill=(0,0,0,opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(2, round(bw*.006))))
    result = Image.alpha_composite(bg, shadow)
    layer = Image.new("RGBA", bg.size)
    layer.paste(fg, (dx,dy), fg)
    # Paste with mask above premultiplies alpha; instead use alpha_composite.
    layer = Image.new("RGBA", bg.size)
    layer.alpha_composite(fg, (dx,dy))
    result = Image.alpha_composite(result, layer)
    output.parent.mkdir(parents=True, exist_ok=True)
    result.convert("RGB").save(output, quality=94)
    return {"output": str(output), "scale": round(scale,5),
            "offset_px": [dx,dy], "ground_anchor_points_px": points,
            "showroom_camera_matched": False, "vehicle_pose_verified": False,
            "shadow_physical": False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--results", type=Path, required=True)
    p.add_argument("--v27-report", type=Path, required=True)
    p.add_argument("--showroom", type=Path, required=True,
                   help="Existing real Blender empty_+0000.png")
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--width-fraction", type=float, default=.82)
    p.add_argument("--ground-fraction", type=float, default=.82)
    args = p.parse_args()
    if not args.showroom.is_file():
        p.error("Showroom render missing; generate real Blender background first")
    if not .4 <= args.width_fraction <= .95 or not .5 <= args.ground_fraction <= .95:
        p.error("invalid framing fractions")
    report = json.loads(args.v27_report.read_text(encoding="utf-8"))
    manifest = {}
    with Image.open(args.showroom) as background:
        for view in VIEWS:
            item = report.get(view, {})
            if item.get("status") != "provisional_mask_refined":
                manifest[view] = {"status": "skipped_unverified_contacts"}
                continue
            with Image.open(args.results/f"v19-{view}"/"segmented.png") as car:
                output = args.output/f"{view}_v28_showroom.jpg"
                manifest[view] = render(background, car, item["contacts"],
                                        output, args.width_fraction,
                                        args.ground_fraction)
                manifest[view]["status"] = "preview_only"
                print(view, output)
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/"v28_manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8")
    print("V28 complete: manual camera/perspective inspection REQUIRED")


if __name__ == "__main__":
    main()
