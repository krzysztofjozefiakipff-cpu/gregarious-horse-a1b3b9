#!/usr/bin/env python3
"""CARVAMO V43: offline compositing QA gate and wheel-contact visualization.

Uses V42 manifest and verified V40 contacts. Computes visibility of
wheel anchors and a conservative per-view review status. No automated
3D-pose or hidden-wheel detection claim. Fail-closed for oblique views.
"""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps

VIEWS=("front","side","rear")
def main():
    p=argparse.ArgumentParser()
    p.add_argument("--v42-manifest",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True)
    p.add_argument("--v42-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    manifest=json.loads(args.v42_manifest.read_text())
    review=json.loads(args.review.read_text())
    args.output.mkdir(parents=True,exist_ok=True)
    report={"status":"blocked_for_production","ready_for_automatic_publication":False,
            "requires_human_visual_approval":True,
            "limits":["Two confirmed tire contacts do not identify hidden or partially occluded wheels.",
                      "A 2D cutout cannot recover occluded underbody geometry or source-camera calibration.",
                      "Shadow alignment is illustrative and not physically verified."],
            "views":{}}
    tiles=[]
    for name in VIEWS:
        view=manifest.get("views",{}).get(name)
        human=review.get("views",{}).get(name,{})
        if not view or len(view.get("wheel_contacts_px",[]))!=2:
            raise ValueError("V42 missing two projected contacts for "+name)
        if len(human.get("contacts",[]))!=2 or not all(c.get("verified") is True for c in human["contacts"]):
            raise ValueError("V40 contacts unverified for "+name)
        source=args.v42_dir/f"{name}_v42_showroom.jpg"
        with Image.open(source) as im:
            im=im.convert("RGB")
            d=ImageDraw.Draw(im)
            contacts=view["wheel_contacts_px"]
            for i,(x,y) in enumerate(contacts):
                r=12
                d.ellipse((x-r,y-r,x+r,y+r),outline="#00d65a",width=4)
                d.line((x-18,y,x+18,y),fill="#00d65a",width=3)
                d.line((x,y-18,x,y+18),fill="#00d65a",width=3)
                d.text((x+15,y-20),f"W{i+1}",fill="#ffffff",stroke_width=2,stroke_fill="#111111")
            dest=args.output/f"{name}_v43_contact_overlay.jpg"
            im.save(dest,quality=94)
            tile=ImageOps.contain(im,(640,360))
            tiles.append(tile.copy())
        (a,b)=contacts
        delta=round(abs(a[1]-b[1]),2)
        # Explicit safety rule: oblique photos may contain an unannotated
        # far-side wheel, so never auto-approve them based on two contacts.
        oblique=name in ("front","rear")
        report["views"][name]={
            "status":"manual_review_required" if oblique else "provisional_preview_manual_review_required",
            "output":str(dest),"two_contacts_confirmed":True,
            "wheel_contact_y_difference_px":delta,
            "oblique_hidden_wheel_risk":oblique,
            "full_vehicle_visible":bool(view.get("full_vehicle_visible",False)),
            "source_perspective_preserved":bool(view.get("source_perspective_preserved",False)),
            "ready_for_automatic_publication":False
        }
        print(name,report["views"][name]["status"],"wheel y delta",delta)
    sheet=Image.new("RGB",(640,1080),"white")
    for i,tile in enumerate(tiles):
        sheet.paste(tile,((640-tile.width)//2,360*i+(360-tile.height)//2))
        ImageDraw.Draw(sheet).text((12,360*i+10),f"V43 {VIEWS[i].upper()} - CONTACT QA",fill="#111111",stroke_width=1)
    sheet.save(args.output/"v43_contact_qa.jpg",quality=92)
    (args.output/"v43_qa.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("V43 complete: overlays and conservative QA; production blocked")

if __name__=="__main__":
    main()
