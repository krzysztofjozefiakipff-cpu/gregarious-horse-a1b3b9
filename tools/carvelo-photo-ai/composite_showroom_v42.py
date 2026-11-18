#!/usr/bin/env python3
"""CARVAMO V42: human-confirmed tire-contact anchored 2D showroom previews.

Uses original RGBA vehicle photos and V40 human-confirmed wheel contacts.
Preserves car pixels and perspective (uniform scale only); adds localized
ground-contact shadows. No claim of camera calibration or 3D pose.
Never changes the portal, worker, source files, or live assets.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

VIEWS=("front","side","rear")

def valid_contacts(entry,shape):
    contacts=entry.get("contacts",[])
    if len(contacts)!=2 or {c.get("wheel_index") for c in contacts}!={0,1}:
        raise ValueError("Expected exactly two distinct wheel indices")
    contacts=sorted(contacts,key=lambda c:c["wheel_index"])
    for c in contacts:
        xy=c.get("confirmed_px")
        if c.get("verified") is not True or c.get("visible_tire") is not True:
            raise ValueError("Unverified tire contact")
        if not isinstance(xy,list) or len(xy)!=2 or not all(
            isinstance(n,(int,float)) and math.isfinite(n) for n in xy):
            raise ValueError("Invalid contact coordinates")
        if not(0<=xy[0]<shape[0] and 0<=xy[1]<shape[1]):
            raise ValueError("Contact outside source image")
    if entry.get("image_size")!=list(shape):
        raise ValueError("V40 image dimensions do not match source RGBA")
    return [c["confirmed_px"] for c in contacts]

def compose(bg,car,contacts,out,floor_fraction=.85,occupancy=.78):
    bg=bg.convert("RGBA");car=car.convert("RGBA")
    bw,bh=bg.size
    bounds=car.getchannel("A").point(lambda a:255 if a>=25 else 0).getbbox()
    if bounds is None:raise ValueError("Empty vehicle alpha")
    left,top,right,bottom=bounds
    sw,sh=right-left,bottom-top
    scale=min(bw*occupancy/sw,bh*.77/sh)
    nw,nh=round(sw*scale),round(sh*scale)
    dx=(bw-nw)//2
    # Align the lower (nearer) tire to a fixed floor band, without warping.
    lower=max(p[1] for p in contacts)
    dy=round(bh*floor_fraction-(lower-top)*scale)
    dy=max(0,min(dy,bh-nh))
    anchors=[(dx+(x-left)*scale,dy+(y-top)*scale) for x,y in contacts]
    if any(not(0<=x<bw and 0<=y<bh) for x,y in anchors):
        raise ValueError("Wheel contact outside output")
    # Mask- and contact-aware local shadow, clipped under the source car.
    shadow=Image.new("RGBA",(bw,bh),(0,0,0,0))
    d=ImageDraw.Draw(shadow)
    near=max(anchors,key=lambda p:p[1])
    for x,y in anchors:
        rx=max(10,min(bw*.065,nw*.047))
        ry=max(3,min(bh*.016,nh*.016))
        d.ellipse((x-rx,y-ry*.75,x+rx,y+ry),fill=(0,0,0,190))
    # Very subtle underbody occlusion: stays between the wheels, near their
    # respective ground heights; not a fake flat line across the scene.
    (x1,y1),(x2,y2)=sorted(anchors)
    if abs(x2-x1)>bw*.08:
        for t in range(1,10):
            q=t/10
            x=x1+(x2-x1)*q
            y=y1+(y2-y1)*q
            d.ellipse((x-nw*.038,y-bh*.009,x+nw*.038,y+bh*.009),
                      fill=(0,0,0,40))
    shadow=shadow.filter(ImageFilter.GaussianBlur(max(2,round(bw*.003))))
    merged=Image.alpha_composite(bg,shadow)
    fg=car.crop(bounds).resize((nw,nh),Image.Resampling.LANCZOS)
    layer=Image.new("RGBA",(bw,bh),(0,0,0,0))
    layer.alpha_composite(fg,(dx,dy))
    merged=Image.alpha_composite(merged,layer)
    out.parent.mkdir(parents=True,exist_ok=True)
    merged.convert("RGB").save(out,quality=94)
    return {
        "status":"preview_only_unverified_pose",
        "output":str(out),"bbox_px":[dx,dy,dx+nw,dy+nh],
        "wheel_contacts_px":[[round(x,2),round(y,2)] for x,y in anchors],
        "nearest_contact_target_y_px":round(bh*floor_fraction,2),
        "nearest_contact_actual_y_px":round(near[1],2),
        "uniform_scale":round(scale,6),
        "source_perspective_preserved":True,
        "full_vehicle_visible":0<=dx and dx+nw<=bw and 0<=dy and dy+nh<=bh,
        "camera_calibrated":False,"pose_verified":False,
        "physically_correct_shadow":False,
        "ready_for_automatic_publication":False
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True)
    p.add_argument("--background-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--floor-fraction",type=float,default=.85)
    args=p.parse_args()
    if not .65<=args.floor_fraction<=.94:p.error("floor-fraction outside [0.65,0.94]")
    review=json.loads(args.review.read_text(encoding="utf-8"))
    manifest={"status":"offline_preview_only","source_camera_calibrated":False,
              "ready_for_automatic_publication":False,"views":{}}
    tiles=[]
    for name in VIEWS:
        src=args.results/f"v19-{name}"/"segmented.png"
        background=args.background_dir/f"empty_{name}_v36.png"
        with Image.open(src) as car,Image.open(background) as bg:
            contacts=valid_contacts(review.get("views",{}).get(name,{}),car.size)
            dest=args.output/f"{name}_v42_showroom.jpg"
            manifest["views"][name]=compose(bg,car,contacts,dest,args.floor_fraction)
            tile=ImageOps.contain(Image.open(dest).convert("RGB"),(640,360))
            tiles.append(tile.copy())
        print(name,manifest["views"][name]["wheel_contacts_px"],dest)
    sheet=Image.new("RGB",(640,360*3),"white")
    for i,(name,tile) in enumerate(zip(VIEWS,tiles)):
        sheet.paste(tile,((640-tile.width)//2,i*360+(360-tile.height)//2))
        ImageDraw.Draw(sheet).text((12,i*360+12),f"V42 {name.upper()} - 2D PREVIEW",fill="black")
    args.output.mkdir(parents=True,exist_ok=True)
    sheet.save(args.output/"v42_contact_previews.jpg",quality=91)
    (args.output/"v42_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print("V42 generated three preview images + sheet. NOT production-ready.")

if __name__=="__main__":
    main()
