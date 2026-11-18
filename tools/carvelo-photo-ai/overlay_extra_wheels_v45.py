#!/usr/bin/env python3
"""CARVAMO V45: overlay all human-marked extra wheels on original V43 previews.

Diagnostic only. An annotation is not independent proof that the marked
feature is a wheel. No image manipulation beyond overlays, no production.
"""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps

def valid_point(p,size):
    return (isinstance(p,list) and len(p)==2
            and all(isinstance(x,(int,float)) and math.isfinite(x) for x in p)
            and 0<=p[0]<size[0] and 0<=p[1]<size[1])

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--review",type=Path,required=True)
    ap.add_argument("--v43-dir",type=Path,required=True)
    ap.add_argument("--output",type=Path,required=True)
    a=ap.parse_args()
    review=json.loads(a.review.read_text(encoding="utf-8"))
    a.output.mkdir(parents=True,exist_ok=True)
    result={"status":"human_review_required","ready_for_automatic_publication":False,
            "additional_wheel_detection_automatic":False,
            "views":{}}
    sheet=Image.new("RGB",(640,1080),"white")
    for i,name in enumerate(("front","side","rear")):
        entry=review["views"][name]
        extra=entry["additional_wheel"]
        status=extra.get("status")
        source=a.v43_dir/f"{name}_v43_contact_overlay.jpg"
        with Image.open(source) as original:
            im=original.convert("RGB")
        if list(im.size)!=entry.get("image_size"):
            raise ValueError(f"V44 size mismatch: {name}")
        d=ImageDraw.Draw(im)
        points=entry.get("known_contacts_px",[])
        if len(points)!=2 or not all(valid_point(p,im.size) for p in points):
            raise ValueError(f"Invalid known contacts: {name}")
        if status=="human_marked":
            center=extra.get("center_px")
            bottom=extra.get("bottom_px")
            if not valid_point(center,im.size) or not valid_point(bottom,im.size):
                raise ValueError(f"Invalid additional-wheel annotation: {name}")
            cx,cy=center;bx,by=bottom
            if by<cy:
                raise ValueError(f"Bottom is above center: {name}")
            radius=math.dist(center,bottom)
            d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),
                      outline="#00bbff",width=5)
            d.line((cx,cy,bx,by),fill="#00bbff",width=4)
            d.ellipse((bx-10,by-10,bx+10,by+10),outline="#ffb000",width=5)
            d.text((max(4,bx-115),max(4,by+12)),"EXTRA? HUMAN MARK",fill="white",
                   stroke_width=2,stroke_fill="black")
            result["views"][name]={
                "status":"marked_not_independently_verified",
                "extra_wheel_center_px":center,"extra_wheel_bottom_px":bottom,
                "inferred_image_radius_px":round(radius,1),
                "needs_visual_review":True}
        elif status in ("not_visible","uncertain","not_reviewed"):
            result["views"][name]={"status":status,"needs_visual_review":status!="not_visible"}
        else:
            raise ValueError(f"Unknown extra-wheel status: {status}")
        dest=a.output/f"{name}_v45_wheel_review.jpg"
        im.save(dest,quality=94)
        tile=ImageOps.contain(im,(640,360),Image.Resampling.LANCZOS)
        sheet.paste(tile,((640-tile.width)//2,i*360+(360-tile.height)//2))
        ImageDraw.Draw(sheet).text((8,i*360+8),f"V45 {name.upper()} - {status}",
                                   fill="white",stroke_width=2,stroke_fill="black")
        print(name,result["views"][name]["status"])
    sheet.save(a.output/"v45_extra_wheel_overlay.jpg",quality=93)
    (a.output/"v45_review_report.json").write_text(json.dumps(result,indent=2),encoding="utf-8")
    print("V45 diagnostic complete; images unchanged except overlays; no production changes")

if __name__=="__main__":
    main()
