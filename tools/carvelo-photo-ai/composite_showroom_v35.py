#!/usr/bin/env python3
"""CARVAMO V35: V34 contact-anchored offline compositor.

Keeps the original photo shape and its internal wheel-height difference.
Places the nearer (lower-image) contact at a chosen showroom floor row,
then draws individual wheel shadows. This is an illustrative 2D preview,
NOT camera calibration, a homography or proof of physical floor contact.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

VIEWS=("front","side","rear")


def compose(background, source, wheels, destination, floor_fraction=.83):
    if len(wheels)!=2 or any(w.get("status")!="provisional_local_alpha_bottom" for w in wheels):
        raise ValueError("V34 wheel candidates are missing or unverified")
    bg=background.convert("RGBA")
    car=source.convert("RGBA")
    bounds=car.getchannel("A").point(lambda a:255 if a>=25 else 0).getbbox()
    if not bounds:
        raise ValueError("Empty car alpha mask")
    left,top,right,bottom=bounds
    fg=car.crop(bounds)
    bw,bh=bg.size
    sw,sh=fg.size
    scale=min(bw*.78/sw,bh*.76/sh)
    nw,nh=max(1,round(sw*scale)),max(1,round(sh*scale))
    if nw>bw*.9 or nh>bh*.93:
        raise ValueError("Vehicle outside safe composition limits")
    fg=fg.resize((nw,nh),Image.Resampling.LANCZOS)
    dx=(bw-nw)//2
    # Lower-image wheel is nearer in the source photo; position that
    # candidate at the floor anchor. Keep source perspective unchanged.
    lower=max(float(w["candidate_y"]) for w in wheels)
    dy=round(bh*floor_fraction-(lower-top)*scale)
    dy=max(round(bh*.035),min(dy,bh-round(bh*.035)-nh))
    anchors=[(dx+(float(w["candidate_x"])-left)*scale,
              dy+(float(w["candidate_y"])-top)*scale,
              float(w["detector_radius"])*scale) for w in wheels]
    if any(not(0<=x<bw and 0<=y<bh) for x,y,_ in anchors):
        raise ValueError("Wheel anchor outside image")
    # A narrow individual contact patch avoids a false horizontal
    # floor line through near/far wheels.
    shadow=Image.new("RGBA",(bw,bh))
    d=ImageDraw.Draw(shadow)
    for x,y,r in anchors:
        rx=max(7,min(bw*.07,r*.48))
        ry=max(2,min(bh*.013,r*.065))
        d.ellipse((x-rx,y-ry,x+rx,y+ry),fill=(0,0,0,155))
    shadow=shadow.filter(ImageFilter.GaussianBlur(max(2,round(bw*.004))))
    result=Image.alpha_composite(bg,shadow)
    layer=Image.new("RGBA",(bw,bh))
    layer.alpha_composite(fg,(dx,dy))
    result=Image.alpha_composite(result,layer)
    destination.parent.mkdir(parents=True,exist_ok=True)
    result.convert("RGB").save(destination,quality=94)
    return {
        "status":"preview_only","output":str(destination),
        "vehicle_bbox_px":[dx,dy,dx+nw,dy+nh],
        "wheel_contacts_px":[[round(x,1),round(y,1)] for x,y,_ in anchors],
        "wheel_height_difference_px":round(abs(anchors[0][1]-anchors[1][1]),1),
        "source_image_perspective_preserved":True,
        "vehicle_pose_verified":False,
        "source_camera_calibrated":False,
        "shadow_physical":False,
        "ready_for_automatic_publication":False,
        "full_vehicle_visible":dx>=bw*.04 and dx+nw<=bw*.96 and dy>=0 and dy+nh<=bh
    }


def make_sheet(old_dir,new_dir,out):
    width=640
    height=400
    sheet=Image.new("RGB",(width*2,height*3),"white")
    for row,view in enumerate(VIEWS):
        for col,(version,folder) in enumerate((("V33",old_dir),("V35",new_dir))):
            path=folder/f"{view}_{version.lower()}_showroom.jpg"
            with Image.open(path) as f:
                photo=ImageOps.contain(f.convert("RGB"),(width,height-30),
                                       Image.Resampling.LANCZOS)
            tile=Image.new("RGB",(width,height),"white")
            tile.paste(photo,((width-photo.width)//2,30))
            ImageDraw.Draw(tile).text((12,9),f"{view.upper()} | {version}",fill="black")
            sheet.paste(tile,(col*width,row*height))
    sheet.save(out,quality=91)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v34-report",type=Path,required=True)
    p.add_argument("--showroom",type=Path,required=True)
    p.add_argument("--v33-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    for path in (args.v34_report,args.showroom):
        if not path.is_file():
            p.error(f"Missing input: {path}")
    report=json.loads(args.v34_report.read_text(encoding="utf-8"))
    entries=report.get("views",{})
    manifest={}
    with Image.open(args.showroom) as bg:
        for view in VIEWS:
            if view not in entries:
                raise ValueError(f"Missing V34 view: {view}")
            with Image.open(args.results/f"v19-{view}"/"segmented.png") as car:
                output=args.output/f"{view}_v35_showroom.jpg"
                manifest[view]=compose(bg,car,entries[view]["contacts"],output)
                print(view,manifest[view]["full_vehicle_visible"],
                      manifest[view]["wheel_height_difference_px"],output)
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/"v35_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    try:
        make_sheet(args.v33_dir,args.output,args.output/"v33_vs_v35.jpg")
        print("Comparison:",args.output/"v33_vs_v35.jpg")
    except FileNotFoundError:
        print("V33 image missing: comparison sheet skipped")
    print("V35 PREVIEW ONLY: original camera geometry remains uncalibrated")


if __name__=="__main__":
    main()
