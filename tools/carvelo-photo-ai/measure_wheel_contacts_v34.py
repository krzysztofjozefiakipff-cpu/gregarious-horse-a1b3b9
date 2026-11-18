#!/usr/bin/env python3
"""CARVAMO V34: source-mask wheel contact measurement and QA overlays.

Measures lowest opaque pixels in wheel-centered source-image windows.
Unlike V27's wide silhouette probe, each window is restricted around a
wheel detector center. These remain CANDIDATES, not verified tire points.
Outputs annotated originals and a single contact sheet; no production changes.
"""
import argparse
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

VIEWS=("front","side","rear")


def measure(mask, wheel, threshold=160):
    w,h=mask.size
    x=float(wheel["x"])
    cy=float(wheel["center_y"])
    r=float(wheel["detected_radius"])
    if not all(math.isfinite(v) for v in (x,cy,r)) or r<=0:
        raise ValueError("Invalid wheel detection")
    # Narrow search prevents bumper / rocker / undercarriage from
    # being mistaken for a tire when viewed in perspective.
    half=max(5,min(30,round(r*.23)))
    left=max(0,round(x-half))
    right=min(w-1,round(x+half))
    y_min=max(0,round(cy+r*.15))
    y_max=min(h-1,round(cy+r*1.6))
    if left>=right or y_min>=y_max:
        return {"status":"invalid_window"}
    pixels=mask.load()
    columns=[]
    for px in range(left,right+1):
        candidates=[py for py in range(y_min,y_max+1)
                    if pixels[px,py]>=threshold]
        if candidates:
            columns.append((px,max(candidates)))
    if len(columns)<max(4,(right-left+1)//4):
        return {"status":"insufficient_alpha_support",
                "support_columns":len(columns)}
    # Robust lower boundary from central columns. Reject isolated stray
    # opaque pixels; the result still cannot distinguish tire from body.
    ys=sorted(y for _,y in columns)
    index=round((len(ys)-1)*.75)
    bottom=ys[index]
    nearby=[px for px,y in columns if abs(y-bottom)<=max(3,r*.08)]
    contact_x=sorted(nearby)[len(nearby)//2] if nearby else round(x)
    boundary_spread=ys[round((len(ys)-1)*.9)]-ys[round((len(ys)-1)*.1)]
    return {
        "status":"provisional_local_alpha_bottom",
        "candidate_x":contact_x,
        "candidate_y":bottom,
        "detector_center":[round(x,1),round(cy,1)],
        "detector_radius":round(r,1),
        "search_box":[left,y_min,right,y_max],
        "support_columns":len(columns),
        "boundary_spread_px":boundary_spread,
        "confidence":"unverified",
        "limitation":"Alpha silhouette alone cannot classify wheel rubber or prove floor contact"
    }


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v27-report",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    data=json.loads(args.v27_report.read_text(encoding="utf-8"))
    args.output.mkdir(parents=True,exist_ok=True)
    report={"status":"offline_review_required","views":{}}
    tiles=[]
    for view in VIEWS:
        entry=data.get(view,{})
        if entry.get("status")!="provisional_mask_refined":
            raise ValueError(f"Missing V27 contacts for {view}")
        with Image.open(args.results/f"v19-{view}"/"segmented.png") as raw:
            image=raw.convert("RGBA")
        mask=image.getchannel("A")
        wheels=[measure(mask,c) for c in entry["contacts"]]
        if len(wheels)!=2:
            raise ValueError("Expected two wheel detections")
        annotated=Image.new("RGB",image.size,(222,222,222))
        annotated.paste(image,mask=image.getchannel("A"))
        d=ImageDraw.Draw(annotated)
        for i,(wheel,old) in enumerate(zip(wheels,entry["contacts"])):
            if wheel["status"]!="provisional_local_alpha_bottom":
                continue
            x,y=wheel["candidate_x"],wheel["candidate_y"]
            d.rectangle(wheel["search_box"],outline=(255,170,0),width=3)
            d.line((x-20,y,x+20,y),fill=(230,30,40),width=4)
            d.line((x,y-20,x,y+20),fill=(230,30,40),width=4)
            d.text((x+12,max(0,y-28)),f"W{i+1} ({x},{y})",fill=(200,0,0))
            old_y=float(old["refined_contact_y"])
            d.ellipse((x-5,old_y-5,x+5,old_y+5),outline=(0,90,255),width=3)
        output=args.output/f"{view}_contact_debug.jpg"
        annotated.save(output,quality=90)
        report["views"][view]={
            "status":"manual_review_required",
            "contacts":wheels,
            "ready_for_automatic_publication":False,
            "debug_image":str(output)}
        # Keep source aspect ratio and show entire silhouette.
        tile=ImageOps.contain(annotated,(640,360),Image.Resampling.LANCZOS)
        panel=Image.new("RGB",(660,400),"white")
        panel.paste(tile,((660-tile.width)//2,35))
        ImageDraw.Draw(panel).text((12,10),f"{view.upper()} | RED=new candidate | BLUE=V27",fill="black")
        tiles.append(panel)
        print(view,[(w.get("candidate_x"),w.get("candidate_y"),w["status"]) for w in wheels])
    sheet=Image.new("RGB",(660,400*len(tiles)),(245,245,245))
    for i,tile in enumerate(tiles):
        sheet.paste(tile,(0,i*400))
    sheet.save(args.output/"v34_wheel_contacts.jpg",quality=93)
    (args.output/"v34_report.json").write_text(
        json.dumps(report,indent=2),encoding="utf-8")
    print("Review sheet:",args.output/"v34_wheel_contacts.jpg")
    print("V34 diagnostic only; no calibrated vehicle pose")


if __name__=="__main__":
    main()
