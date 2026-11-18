#!/usr/bin/env python3
"""CARVAMO V33: contact-anchored offline previews and one-page comparison.

Experimental 2D compositor. Unlike V30 it does not place a silhouette-wide
shadow at the average wheel height; it paints separate contact patches at
each wheel and a low-opacity underbody bridge following the wheel contact
line. The result is NOT a physically calibrated 3D vehicle or camera match.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

VIEWS=("front","side","rear")


def render(bg_source, car_source, contacts, output, ground_fraction=.82,
           width_fraction=.78):
    bg=bg_source.convert("RGBA")
    car=car_source.convert("RGBA")
    bbox=car.getchannel("A").point(lambda a:255 if a>=25 else 0).getbbox()
    if bbox is None or len(contacts)!=2:
        raise ValueError("Missing vehicle or two wheel contacts")
    left,top,right,bottom=bbox
    crop=car.crop(bbox)
    bw,bh=bg.size
    sw,sh=crop.size
    scale=min(bw*width_fraction/sw,bh*.77/sh)
    nw,nh=round(sw*scale),round(sh*scale)
    if nw<1 or nh<1 or nw>bw*.90 or nh>bh*.93:
        raise ValueError("Unsafe car dimensions")
    fg=crop.resize((nw,nh),Image.Resampling.LANCZOS)
    dx=(bw-nw)//2
    ys=[float(c["refined_contact_y"]) for c in contacts]
    mean_y=sum(ys)/2
    dy=round(bh*ground_fraction-(mean_y-top)*scale)
    dy=max(round(bh*.035),min(dy,bh-round(bh*.035)-nh))
    anchors=[(dx+(float(c["x"])-left)*scale,
              dy+(float(c["refined_contact_y"])-top)*scale,
              float(c["detected_radius"])*scale) for c in contacts]
    anchors.sort(key=lambda a:a[0])
    (x1,y1,r1),(x2,y2,r2)=anchors
    if x2-x1<max(20,bw*.06):
        raise ValueError("Wheel contacts too close to infer ground bridge")
    # Individual patches follow each contact; avoid V30's single horizontal
    # band that floats beneath a perspective-view wheel.
    shadow=Image.new("RGBA",(bw,bh))
    sd=ImageDraw.Draw(shadow)
    for x,y,r in anchors:
        rx=max(9,min(bw*.08,r*.50))
        ry=max(3,min(bh*.018,r*.075))
        sd.ellipse((x-rx,y-ry,x+rx,y+ry),fill=(0,0,0,145))
    shadow=shadow.filter(ImageFilter.GaussianBlur(max(2,bw*.004)))
    # Subtle chassis bridge, linear in image coordinates, clipped to
    # lower vehicle silhouette; illustrative, not a floor homography.
    bridge=Image.new("RGBA",(bw,bh))
    bd=ImageDraw.Draw(bridge)
    alpha=fg.getchannel("A")
    mask=alpha.point(lambda a:255 if a>=90 else 0)
    mask_pixels=mask.load()
    for local_x in range(0,nw,max(2,nw//220)):
        px=dx+local_x
        if not (x1<=px<=x2):
            continue
        t=(px-x1)/(x2-x1)
        floor_y=y1+(y2-y1)*t
        lowest=next((j for j in range(nh-1,-1,-1) if mask_pixels[local_x,j]),None)
        if lowest is None:
            continue
        gap=floor_y-(dy+lowest)
        # Only paint where body underside is plausibly close to floor.
        if -bh*.015<=gap<=bh*.12:
            strength=round(38*max(0,1-max(0,gap)/(bh*.12)))
            bd.ellipse((px-5,floor_y-4,px+5,floor_y+4),
                       fill=(0,0,0,strength))
    bridge=bridge.filter(ImageFilter.GaussianBlur(max(3,bw*.008)))
    merged=Image.alpha_composite(bg,bridge)
    merged=Image.alpha_composite(merged,shadow)
    layer=Image.new("RGBA",(bw,bh))
    layer.alpha_composite(fg,(dx,dy))
    merged=Image.alpha_composite(merged,layer)
    output.parent.mkdir(parents=True,exist_ok=True)
    merged.convert("RGB").save(output,quality=94)
    return {
        "status":"preview_only",
        "output":str(output),
        "vehicle_bbox_px":[dx,dy,dx+nw,dy+nh],
        "wheel_contacts_px":[[round(x,1),round(y,1)] for x,y,_ in anchors],
        "contact_height_difference_px":round(abs(y1-y2),1),
        "full_vehicle_visible":dx>=bw*.04 and dx+nw<=bw*.96 and dy>=0 and dy+nh<=bh,
        "shadow_method":"two_contact_patches_and_clipped_chassis_bridge_2d",
        "vehicle_colors_modified":False,
        "showroom_camera_matched":False,
        "vehicle_pose_verified":False,
        "shadow_physical":False,
        "ready_for_automatic_publication":False
    }


def contact_sheet(output, v30_dir, v33_dir, width=640):
    tiles=[]
    for view in VIEWS:
        for version,base in (("V30",v30_dir),("V33",v33_dir)):
            path=base/f"{view}_{version.lower()}_showroom.jpg"
            with Image.open(path) as im:
                im=im.convert("RGB")
                h=round(im.height*width/im.width)
                tile=ImageOps.fit(im,(width,h),method=Image.Resampling.LANCZOS)
                canvas=Image.new("RGB",(width,h+40),"white")
                canvas.paste(tile,(0,40))
                ImageDraw.Draw(canvas).text((12,12),f"{view.upper()} | {version}",fill="black")
                tiles.append(canvas)
    height=max(t.height for t in tiles)
    sheet=Image.new("RGB",(width*2,height*3),(238,238,238))
    for i,tile in enumerate(tiles):
        sheet.paste(tile,((i%2)*width,(i//2)*height))
    sheet.save(output,quality=90)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v27-report",type=Path,required=True)
    p.add_argument("--showroom",type=Path,required=True)
    p.add_argument("--v30-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    for path in (args.v27_report,args.showroom):
        if not path.is_file():
            p.error(f"Missing input: {path}")
    report=json.loads(args.v27_report.read_text(encoding="utf-8"))
    manifest={}
    with Image.open(args.showroom) as bg:
        for view in VIEWS:
            item=report.get(view,{})
            if item.get("status")!="provisional_mask_refined":
                raise ValueError("V27 wheel contact not available: "+view)
            with Image.open(args.results/f"v19-{view}"/"segmented.png") as car:
                out=args.output/f"{view}_v33_showroom.jpg"
                manifest[view]=render(bg,car,item["contacts"],out)
                print(view,manifest[view]["full_vehicle_visible"],out)
    args.output.mkdir(parents=True,exist_ok=True)
    (args.output/"v33_manifest.json").write_text(
        json.dumps(manifest,indent=2),encoding="utf-8")
    try:
        contact_sheet(args.output/"v30_vs_v33.jpg",args.v30_dir,args.output)
        print("Comparison:",args.output/"v30_vs_v33.jpg")
    except FileNotFoundError:
        print("V30 images missing; comparison sheet skipped")
    print("V33 offline preview only. Perspective remains uncalibrated.")


if __name__=="__main__":
    main()
