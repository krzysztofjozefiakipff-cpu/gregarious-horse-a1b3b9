#!/usr/bin/env python3
"""CARVAMO V29 offline composition: full silhouette framing and contact shadows.

Uses actual Blender background, V19 RGBA segmentation and provisional V27
contact points. Output is PREVIEW ONLY: no verified camera/ground calibration.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

VIEWS = ("front", "side", "rear")


def composite(background, car, contacts, output, width_fraction=.78,
              ground_fraction=.82, margin_fraction=.055):
    if len(contacts) != 2:
        raise ValueError("Exactly two wheel contact points required")
    bg = background.convert("RGBA")
    original = car.convert("RGBA")
    mask = original.getchannel("A")
    bounds = mask.point(lambda v: 255 if v >= 25 else 0).getbbox()
    if not bounds:
        raise ValueError("Car segmentation is empty")
    left, top, right, bottom = bounds
    fg = original.crop(bounds)
    sw, sh = fg.size
    bw, bh = bg.size
    # Center using complete vehicle silhouette, NOT midpoint of the wheels.
    usable_width = bw * min(width_fraction, 1-2*margin_fraction)
    scale = min(usable_width/sw, bh*.77/sh)
    nw, nh = max(1, round(sw*scale)), max(1, round(sh*scale))
    fg = fg.resize((nw, nh), Image.Resampling.LANCZOS)
    dx = round((bw-nw)/2)
    mean_contact_y = sum(float(c["refined_contact_y"]) for c in contacts)/2
    dy = round(bh*ground_fraction - (mean_contact_y-top)*scale)
    # Enforce a visible margin on all four sides without cropping the car.
    margin = round(bw*margin_fraction)
    dx = max(margin, min(dx, bw-margin-nw))
    dy = max(round(bh*.035), min(dy, bh-round(bh*.035)-nh))
    if nw > bw-2*margin or nh > bh*.93:
        raise ValueError("Car exceeds safe framing area")

    anchors = []
    for c in contacts:
        x = dx+(float(c["x"])-left)*scale
        y = dy+(float(c["refined_contact_y"])-top)*scale
        r = float(c["detected_radius"])*scale
        anchors.append((x,y,r))
    # Separate blurred underbody shadow and tire contact patches.
    # Avoid drawing a dark ellipse over the foreground vehicle.
    shadow = Image.new("RGBA", bg.size)
    draw = ImageDraw.Draw(shadow)
    xs = [p[0] for p in anchors]
    ys = [p[1] for p in anchors]
    rmean = sum(p[2] for p in anchors)/2
    # Soft undercarriage grounding; position based on two tyre contact points.
    midx = sum(xs)/2
    midy = sum(ys)/2
    span = abs(xs[1]-xs[0])
    draw.ellipse((midx-span*.57-rmean*.2, midy-rmean*.16,
                  midx+span*.57+rmean*.2, midy+rmean*.16),
                 fill=(0,0,0,44))
    for x,y,r in anchors:
        draw.ellipse((x-r*.68, y-r*.065, x+r*.68, y+r*.105),
                     fill=(0,0,0,115))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(3,round(bw*.007))))
    result = Image.alpha_composite(bg, shadow)
    car_layer = Image.new("RGBA", bg.size)
    car_layer.alpha_composite(fg, (dx,dy))
    result = Image.alpha_composite(result, car_layer)
    output.parent.mkdir(parents=True, exist_ok=True)
    result.convert("RGB").save(output, quality=94)
    return {
        "status": "preview_only", "output": str(output),
        "scale": round(scale,5), "offset_px": [dx,dy],
        "vehicle_bbox_px": [dx,dy,dx+nw,dy+nh],
        "wheel_contacts_px": [[round(x,1),round(y,1)] for x,y,_ in anchors],
        "full_vehicle_visible": dx>=margin and dx+nw<=bw-margin and dy>=0 and dy+nh<=bh,
        "showroom_camera_matched": False,
        "vehicle_pose_verified": False,
        "shadow_physical": False
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--results", type=Path, required=True)
    p.add_argument("--v27-report", type=Path, required=True)
    p.add_argument("--showroom", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--width-fraction", type=float, default=.78)
    p.add_argument("--ground-fraction", type=float, default=.82)
    args = p.parse_args()
    if not .55<=args.width_fraction<=.89 or not .55<=args.ground_fraction<=.90:
        p.error("Invalid framing fractions")
    if not args.showroom.is_file():
        p.error("Real Blender showroom background missing")
    report = json.loads(args.v27_report.read_text(encoding="utf-8"))
    manifest = {}
    with Image.open(args.showroom) as bg:
        for view in VIEWS:
            entry = report.get(view, {})
            if entry.get("status")!="provisional_mask_refined":
                raise ValueError("Missing provisional contacts for "+view)
            with Image.open(args.results/f"v19-{view}"/"segmented.png") as fg:
                path = args.output/f"{view}_v29_showroom.jpg"
                manifest[view] = composite(bg,fg,entry["contacts"],path,
                                           args.width_fraction,args.ground_fraction)
                print(view, path, "full_vehicle_visible=",manifest[view]["full_vehicle_visible"])
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/"v29_manifest.json").write_text(
        json.dumps(manifest,indent=2),encoding="utf-8")
    print("V29 PREVIEW ONLY; inspect framing, shadows and perspective manually")


if __name__=="__main__":
    main()
