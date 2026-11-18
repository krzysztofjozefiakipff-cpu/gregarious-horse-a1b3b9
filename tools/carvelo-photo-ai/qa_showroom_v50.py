#!/usr/bin/env python3
"""CARVAMO V50: fail-closed geometric and visual QA of existing V49 output.

No fal API, no uploads, no inference. Tests for tire clearance, inconsistent
bottom strip, and original-car preservation. Never marks image publishable
without human approval. Reads V40 verified contact points when available.
"""
import argparse, json, statistics
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--v47-dir",type=Path,required=True)
    p.add_argument("--view",choices=["front","side","rear"],default="rear")
    p.add_argument("--contacts",type=Path,default=Path("/tmp/carvamo-photo-ai-test/v40_verified_contacts.json"))
    p.add_argument("--min-bottom-margin",type=int,default=55)
    p.add_argument("--strip-row",type=int,default=630)
    a=p.parse_args()
    root=a.v47_dir/a.view
    original_path=root/"input.png"
    mask_path=root/"protect_car_mask.png"
    result_path=root/"v49/protected_car_result_v49.png"
    for f in (original_path,mask_path,result_path):
        if not f.exists():p.error("Missing: "+str(f))
    with Image.open(original_path) as im:original=im.convert("RGB")
    with Image.open(result_path) as im:result=im.convert("RGB")
    with Image.open(mask_path) as im:mask=im.convert("L")
    if not(original.size==result.size==mask.size):p.error("Dimension mismatch")
    w,h=original.size
    binary=mask.point(lambda v:255 if v>=250 else 0)
    bbox=binary.getbbox()
    if bbox is None:p.error("Empty car mask")
    diff=ImageChops.difference(original,result)
    changed=ImageChops.multiply(diff.convert("L"),binary)
    original_pixels_preserved=changed.getbbox() is None
    bottom_margin=h-bbox[3]
    issues=[]
    if not original_pixels_preserved:issues.append("PROTECTED_PIXELS_CHANGED")
    if bottom_margin<a.min_bottom_margin:issues.append("CAR_TOO_CLOSE_TO_BOTTOM_EDGE")
    # Compare left and right background strips above/below the V49 pasted seam.
    # This is a heuristic; record raw values, never silently auto-approve.
    seam=a.strip_row
    seam_metric=None
    if 2<=seam<h-2:
        # sample background-only pixels, excluding the protected vehicle
        lum=result.convert("L")
        px=lum.load();mp=mask.load()
        delta=[]
        for x in range(0,w,4):
            if mp[x,seam-2]<10 and mp[x,seam+2]<10:
                delta.append(abs(px[x,seam-2]-px[x,seam+2]))
        if delta:
            seam_metric=round(statistics.median(delta),2)
            if seam_metric>12:issues.append("VISIBLE_HORIZONTAL_SEAM_POSSIBLE")
    # V40 points are source-photo coordinates; V49 composite does not contain
    # the transform manifest, so do not pretend to derive world-space contact.
    verified_contact_count=0
    if a.contacts.is_file():
        data=json.loads(a.contacts.read_text(encoding="utf-8"))
        verified_contact_count=sum(1 for c in data.get("views",{}).get(a.view,{}).get("contacts",[]) if c.get("verified"))
    if verified_contact_count<2:issues.append("INSUFFICIENT_VERIFIED_WHEEL_CONTACTS")
    issues.append("PHYSICAL_TIRE_GROUND_CONTACT_NOT_VERIFIED")
    issues.append("CAMERA_CALIBRATION_NOT_AVAILABLE")
    out=root/"v50"
    out.mkdir(parents=True,exist_ok=True)
    report={
      "version":"v50","view":a.view,"image_size":[w,h],
      "protected_pixels_unchanged":original_pixels_preserved,
      "car_mask_bbox_xyxy":list(bbox),
      "car_bottom_margin_px":bottom_margin,
      "required_bottom_margin_px":a.min_bottom_margin,
      "seam_row_px":seam,"seam_median_luma_difference":seam_metric,
      "verified_source_contact_count":verified_contact_count,
      "issues":issues,"qa_pass":False,"ready_for_publication":False,
      "next_required_action":"Recompose car at smaller scale and re-anchor wheel contacts before any new paid inference",
      "paid_api_calls":0
    }
    (out/"v50_qa_report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
    print("Saved:",out/"v50_qa_report.json")
if __name__=="__main__":main()
