#!/usr/bin/env python3
"""CARVAMO V39b: V36/V40 floor audit. Diagnostic only; no 3D calibration."""
import argparse,json,math
from pathlib import Path

def floor_ray(pixel,cam):
    w,h=cam["resolution"];lens=cam["lens_mm"];sensor=cam["sensor_width_mm"]
    x,y,z=(pixel[0]-w/2)*sensor/(w*lens),(h/2-pixel[1])*sensor/(w*lens),-1
    for axis,a in enumerate(cam["camera_rotation_euler_rad"]):
        c,s=math.cos(a),math.sin(a)
        if axis==0:y,z=y*c-z*s,y*s+z*c
        elif axis==1:x,z=x*c+z*s,-x*s+z*c
        else:x,y=x*c-y*s,x*s+y*c
    origin=cam["camera_location_m"]
    if z>=-1e-9:return None
    t=(cam["floor_z_m"]-origin[2])/z
    return [round(origin[i]+t*d,5) for i,d in enumerate((x,y,z))] if t>0 else None

def audit(manifest,review):
    if not isinstance(manifest.get("views"),dict):
        raise ValueError("Expected V36 camera manifest with views object")
    result={"status":"blocked_for_production",
            "source_camera_calibrated":False,"vehicle_pose_verified":False,
            "ready_for_automatic_publication":False,
            "warning":"Rescaling source photo pixels to Blender camera image is a diagnostic assumption, NOT a camera calibration or actual vehicle measurement.",
            "views":{}}
    for name in ("front","side","rear"):
        cam=manifest["views"].get(name)
        entry=review.get("views",{}).get(name,{})
        contacts=entry.get("contacts",[]);size=entry.get("image_size")
        if cam is None or not isinstance(size,list) or len(size)!=2 or min(size)<=0:
            result["views"][name]={"status":"blocked_missing_camera_or_dimensions"};continue
        valid=(len(contacts)==2 and {c.get("wheel_index") for c in contacts}=={0,1}
               and all(c.get("verified") is True and c.get("visible_tire") is True
                       and isinstance(c.get("confirmed_px"),list)
                       and len(c["confirmed_px"])==2
                       and all(isinstance(v,(int,float)) and math.isfinite(v) for v in c["confirmed_px"])
                       and 0<=c["confirmed_px"][0]<size[0]
                       and 0<=c["confirmed_px"][1]<size[1] for c in contacts))
        if not valid:
            result["views"][name]={"status":"blocked_unverified_contacts"};continue
        source=[c["confirmed_px"] for c in sorted(contacts,key=lambda c:c["wheel_index"])]
        w,h=cam["resolution"]
        assumed=[[round(x*w/size[0],3),round(y*h/size[1],3)] for x,y in source]
        points=[floor_ray(p,cam) for p in assumed]
        if any(p is None for p in points):
            result["views"][name]={"status":"blocked_floor_ray","source_contact_pixels":source};continue
        result["views"][name]={
            "status":"diagnostic_only_not_calibrated",
            "source_contact_pixels":source,"assumed_render_pixels":assumed,
            "hypothetical_floor_points_m":points,
            "hypothetical_floor_separation_m":round(math.dist(points[0][:2],points[1][:2]),4),
            "ready_for_automatic_publication":False}
    return result

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--camera-manifest",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    report=audit(json.loads(a.camera_manifest.read_text()),json.loads(a.review.read_text()))
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(report,indent=2))
    for name,view in report["views"].items():
        print(name,view["status"],view.get("hypothetical_floor_separation_m"))
    print("V39b: production BLOCKED; camera calibration still required")
