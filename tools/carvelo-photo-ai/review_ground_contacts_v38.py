#!/usr/bin/env python3
"""CARVAMO V38 — source-image ground-contact review.

Produces one QA sheet and a machine-readable manual-review template.
A 2D segmentation mask cannot distinguish a hanging underbody/wheel from
a real ground-contact point. Human confirmation is therefore required
before any 3D ground fit. No image manipulation or production changes.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

VIEWS=("front","side","rear")


def validate_point(point, width, height):
    return (isinstance(point,(list,tuple)) and len(point)==2
            and all(isinstance(v,(int,float)) and not isinstance(v,bool)
                    for v in point)
            and 0<=point[0]<width and 0<=point[1]<height)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v34-report",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--review",type=Path,help="Optional manually edited review JSON")
    args=p.parse_args()
    report=json.loads(args.v34_report.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True,exist_ok=True)
    review=None
    if args.review:
        review=json.loads(args.review.read_text(encoding="utf-8"))
    template={"schema_version":"v38.1",
              "purpose":"Human-verified visible tire contacts in ORIGINAL source image pixels",
              "notes":"Set verified=true only after examining the image. A hidden tire or non-grounded tire must be marked false. Do not estimate a physical 3D pose from two pixels.",
              "views":{}}
    audit={"status":"manual_review_required","views":{},
           "ready_for_automatic_publication":False,
           "source_camera_calibrated":False}
    panels=[]
    for view in VIEWS:
        with Image.open(args.results/f"v19-{view}"/"segmented.png") as im:
            image=im.convert("RGBA")
        w,h=image.size
        candidates=report["views"][view]["contacts"]
        if len(candidates)!=2:
            raise ValueError(f"Expected two candidate contacts in {view}")
        template["views"][view]={
            "image_size":[w,h],
            "contacts":[{
                "wheel_index":i,
                "candidate_px":[c.get("candidate_x"),c.get("candidate_y")],
                "confirmed_px":None,
                "verified":False,
                "visible_tire":None,
                "comment":""
            } for i,c in enumerate(candidates)]
        }
        annotated=Image.new("RGB",(w,h),(225,225,225))
        annotated.paste(image,mask=image.getchannel("A"))
        d=ImageDraw.Draw(annotated)
        chosen=[]
        submitted=(review or {}).get("views",{}).get(view,{})
        for i,c in enumerate(candidates):
            x,y=c.get("candidate_x"),c.get("candidate_y")
            if isinstance(x,(int,float)) and isinstance(y,(int,float)):
                d.ellipse((x-11,y-11,x+11,y+11),outline=(255,90,0),width=4)
                d.text((x+14,y-18),f"candidate {i+1}",fill=(160,55,0))
            if review:
                contacts=submitted.get("contacts",[])
                selected=contacts[i] if i<len(contacts) else {}
                pt=selected.get("confirmed_px")
                valid=(selected.get("verified") is True
                       and selected.get("visible_tire") is True
                       and validate_point(pt,w,h))
                if valid:
                    xx,yy=pt
                    d.line((xx-15,yy,xx+15,yy),fill=(0,150,20),width=4)
                    d.line((xx,yy-15,xx,yy+15),fill=(0,150,20),width=4)
                    chosen.append([xx,yy])
        status=("verified_2d_contacts_only" if len(chosen)==2
                else "manual_review_required")
        audit["views"][view]={"status":status,
            "verified_contacts_px":chosen,
            "source_camera_calibrated":False,
            "vehicle_pose_verified":False,
            "ready_for_automatic_publication":False}
        preview=ImageOps.contain(annotated,(800,440),Image.Resampling.LANCZOS)
        panel=Image.new("RGB",(820,480),"white")
        panel.paste(preview,((820-preview.width)//2,32))
        ImageDraw.Draw(panel).text((12,10),
            f"{view.upper()} | orange=candidate, green=manual verification",
            fill="black")
        panels.append(panel)
        print(view,status)
    sheet=Image.new("RGB",(820,480*len(panels)),"white")
    for i,panel in enumerate(panels):
        sheet.paste(panel,(0,i*480))
    sheet.save(args.output/"v38_contact_review.jpg",quality=92)
    (args.output/"v38_review_template.json").write_text(
        json.dumps(template,indent=2),encoding="utf-8")
    (args.output/"v38_audit.json").write_text(
        json.dumps(audit,indent=2),encoding="utf-8")
    print("Review image:",args.output/"v38_contact_review.jpg")
    print("Template:",args.output/"v38_review_template.json")
    print("Production gate: blocked (camera and 3D pose uncalibrated)")


if __name__=="__main__":
    main()
