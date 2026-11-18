#!/usr/bin/env python3
"""CARVAMO V30: silhouette-driven floor shadows, offline previews only.

Preserves original paint colors. Uses V19 segmented RGBA, V27 provisional wheel
contacts, and real Blender background. No camera calibration is claimed.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

VIEWS = ("front", "side", "rear")


def composite(background, car, contacts, output, width_fraction=.78,
              ground_fraction=.82, margin_fraction=.055):
    if len(contacts) != 2:
        raise ValueError("Expected exactly two wheel contacts")
    bg = background.convert("RGBA")
    original = car.convert("RGBA")
    bounds = original.getchannel("A").point(
        lambda v: 255 if v >= 25 else 0).getbbox()
    if not bounds:
        raise ValueError("Empty vehicle mask")
    left, top, right, bottom = bounds
    fg = original.crop(bounds)
    bw, bh = bg.size
    sw, sh = fg.size
    margin = round(bw*margin_fraction)
    scale = min(bw*width_fraction/sw, bh*.77/sh)
    nw, nh = max(1, round(sw*scale)), max(1, round(sh*scale))
    if nw > bw-2*margin or nh > bh*.93:
        raise ValueError("Vehicle cannot fit in safe frame")
    fg = fg.resize((nw, nh), Image.Resampling.LANCZOS)
    dx = (bw-nw)//2
    mean_y = sum(float(c["refined_contact_y"]) for c in contacts)/2
    dy = round(bh*ground_fraction-(mean_y-top)*scale)
    dy = max(round(bh*.035), min(dy, bh-round(bh*.035)-nh))

    anchors = [(dx+(float(c["x"])-left)*scale,
                dy+(float(c["refined_contact_y"])-top)*scale,
                float(c["detected_radius"])*scale) for c in contacts]

    # Derive a continuous undercarriage shadow from lower silhouette columns,
    # instead of one large ellipse unrelated to the actual car shape.
    alpha = fg.getchannel("A")
    mask = alpha.point(lambda a: 255 if a >= 90 else 0)
    pixels = mask.load()
    shadow = Image.new("RGBA", (bw,bh))
    draw = ImageDraw.Draw(shadow)
    # For each horizontal slice, find the lowest opaque pixel; draw a narrow
    # shadow near the floor, with soft longitudinal variation.
    stride = max(2, nw//170)
    ground_y = sum(a[1] for a in anchors)/2
    for x in range(0,nw,stride):
        bottom_opaque = next((y for y in range(nh-1,-1,-1)
                              if pixels[x,y]>0), None)
        if bottom_opaque is None:
            continue
        # Lower silhouette determines shadow width/strength; high body panels
        # contribute a fainter penumbra than low chassis/tire columns.
        distance = max(0, ground_y-(dy+bottom_opaque))
        strength = round(54*max(.15, 1-distance/(nh*.65)))
        spread = max(4,round(bh*.014))
        px = dx+x
        draw.ellipse((px-stride, ground_y-spread*.65,
                      px+stride*1.5, ground_y+spread*.9),
                     fill=(0,0,0,strength))
    # Contact patches are narrow and blurred, not circular black discs.
    for x,y,r in anchors:
        draw.ellipse((x-r*.65,y-r*.075,x+r*.65,y+r*.10),
                     fill=(0,0,0,125))
    shadow = shadow.filter(ImageFilter.GaussianBlur(max(3,round(bw*.006))))
    composed = Image.alpha_composite(bg,shadow)
    layer = Image.new("RGBA",(bw,bh))
    layer.alpha_composite(fg,(dx,dy))
    composed = Image.alpha_composite(composed,layer)
    output.parent.mkdir(parents=True,exist_ok=True)
    composed.convert("RGB").save(output,quality=94)
    return {
        "status":"preview_only",
        "output":str(output),
        "vehicle_bbox_px":[dx,dy,dx+nw,dy+nh],
        "wheel_contacts_px":[[round(x,1),round(y,1)] for x,y,_ in anchors],
        "full_vehicle_visible": dx>=margin and dx+nw<=bw-margin and dy>=0 and dy+nh<=bh,
        "shadow_method":"silhouette_lower_envelope_provisional",
        "vehicle_colors_modified":False,
        "showroom_camera_matched":False,
        "vehicle_pose_verified":False,
        "shadow_physical":False
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v27-report",type=Path,required=True)
    p.add_argument("--showroom",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    if not args.showroom.is_file():
        p.error("Blender showroom render missing")
    report=json.loads(args.v27_report.read_text(encoding="utf-8"))
    manifest={}
    with Image.open(args.showroom) as bg:
        for view in VIEWS:
            entry=report.get(view,{})
            if entry.get("status")!="provisional_mask_refined":
                raise ValueError("Missing V27 contacts: "+view)
            with Image.open(args.results/f"v19-{view}"/"segmented.png") as car:
                out=args.output/f"{view}_v30_showroom.jpg"
                manifest[view]=composite(bg,car,entry["contacts"],out)
                print(view,out,manifest[view]["full_vehicle_visible"])
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/"v30_manifest.json").write_text(
        json.dumps(manifest,indent=2),encoding="utf-8")
    print("V30 offline previews generated; manual inspection required")


if __name__=="__main__":
    main()
