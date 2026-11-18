#!/usr/bin/env python3
"""CARVAMO V41: camera sensitivity and identifiability audit.

Tests how hypothetical ground-contact separations change with focal length.
This is NOT source-camera calibration. Never promotes to production-ready.
Input: V36 camera manifest and human-confirmed V40 contacts.
"""
import argparse
import copy
import json
import math
from pathlib import Path

def floor_ray(pixel,cam):
    w,h=cam["resolution"]
    if min(w,h,cam["lens_mm"],cam["sensor_width_mm"])<=0:
        return None
    x=(pixel[0]-w/2)*cam["sensor_width_mm"]/(w*cam["lens_mm"])
    y=(h/2-pixel[1])*cam["sensor_width_mm"]/(w*cam["lens_mm"])
    z=-1.0
    for axis,angle in enumerate(cam["camera_rotation_euler_rad"]):
        c,s=math.cos(angle),math.sin(angle)
        if axis==0:y,z=y*c-z*s,y*s+z*c
        elif axis==1:x,z=x*c+z*s,-x*s+z*c
        else:x,y=x*c-y*s,x*s+y*c
    origin=cam["camera_location_m"]
    if z>=-1e-8:return None
    t=(cam["floor_z_m"]-origin[2])/z
    if t<=0:return None
    return [origin[0]+t*x,origin[1]+t*y,origin[2]+t*z]

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--camera-manifest",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--lenses-mm",type=float,nargs="+",default=[28,35,40,50,65])
    args=p.parse_args()
    if not args.lenses_mm or any(not math.isfinite(l) or not 15<=l<=120 for l in args.lenses_mm):
        p.error("lens hypotheses must be finite values in [15,120] mm")
    manifest=json.loads(args.camera_manifest.read_text(encoding="utf-8"))
    review=json.loads(args.review.read_text(encoding="utf-8"))
    report={
        "status":"blocked_for_production",
        "analysis":"virtual_camera_focal_length_sensitivity",
        "not_source_camera_calibration":True,
        "ready_for_automatic_publication":False,
        "notes":[
            "Image-to-render coordinate mapping assumes independent x/y scaling, not actual camera calibration.",
            "Changing virtual camera lens without changing source photo cannot establish real vehicle pose.",
            "Contact separation is not necessarily the physical wheelbase in oblique views.",
            "This sweep isolates camera-parameter sensitivity; it cannot select the correct lens."
        ],
        "views":{}
    }
    for name in ("front","side","rear"):
        cam=manifest.get("views",{}).get(name)
        view=review.get("views",{}).get(name,{})
        contacts=view.get("contacts",[])
        size=view.get("image_size")
        if not cam or not isinstance(size,list) or len(size)!=2 or min(size)<=0:
            report["views"][name]={"status":"missing_camera_or_image_size"};continue
        if len(contacts)!=2 or {c.get("wheel_index") for c in contacts}!={0,1} or not all(
            c.get("verified") is True and c.get("visible_tire") is True
            and isinstance(c.get("confirmed_px"),list)
            and len(c["confirmed_px"])==2
            and all(isinstance(v,(int,float)) and math.isfinite(v) for v in c["confirmed_px"])
            and 0<=c["confirmed_px"][0]<size[0]
            and 0<=c["confirmed_px"][1]<size[1] for c in contacts
        ):
            report["views"][name]={"status":"unverified_or_invalid_contacts"};continue
        contacts=sorted(contacts,key=lambda c:c["wheel_index"])
        w,h=cam["resolution"]
        mapped=[[c["confirmed_px"][0]*w/size[0],c["confirmed_px"][1]*h/size[1]] for c in contacts]
        values=[]
        for lens in args.lenses_mm:
            test=copy.deepcopy(cam);test["lens_mm"]=lens
            points=[floor_ray(p,test) for p in mapped]
            separation=math.dist(points[0][:2],points[1][:2]) if all(p is not None for p in points) else None
            values.append({"lens_mm":lens,
                           "hypothetical_floor_separation_m":round(separation,4) if separation is not None else None,
                           "valid_floor_rays":separation is not None})
        distances=[v["hypothetical_floor_separation_m"] for v in values if v["valid_floor_rays"]]
        report["views"][name]={
            "status":"diagnostic_only",
            "confirmed_contact_px":[c["confirmed_px"] for c in contacts],
            "assumed_render_contact_px":[[round(a,2),round(b,2)] for a,b in mapped],
            "lens_sweep":values,
            "separation_range_m":[min(distances),max(distances)] if distances else None,
            "range_spread_m":round(max(distances)-min(distances),4) if distances else None
        }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
    for name,item in report["views"].items():
        print(name,item["status"],"range:",item.get("separation_range_m"))
    print("V41: diagnostic only; no source camera identified, no production change")

if __name__=="__main__":
    main()
