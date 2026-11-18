#!/usr/bin/env python3
"""CARVAMO V39: ground-plane constraint solver / observability report.

Uses the V31 camera, V38 review, and optional VERIFIED wheelbase.
Two contact pixels + a wheelbase do not determine full 3D vehicle pose:
the floor intersection gives two points under the *assumption* that
both pixels are on the rendered floor. Reports this discrepancy and
does not fabricate a calibrated 3D car or alter photos.
"""
import argparse
import json
import math
from pathlib import Path


def rotate(v,a):
    x,y,z=v
    for axis,angle in enumerate(a):
        c,s=math.cos(angle),math.sin(angle)
        if axis==0:
            y,z=y*c-z*s,y*s+z*c
        elif axis==1:
            x,z=x*c+z*s,-x*s+z*c
        else:
            x,y=x*c-y*s,x*s+y*c
    return x,y,z


def project_floor(pt,cam):
    w,h=cam["resolution"]
    lens=float(cam["lens_mm"])
    sensor=float(cam["sensor_width_mm"])
    # Blender perspective camera: -Z forward, +Y up.
    direction=rotate(((pt[0]-w/2)*sensor/(w*lens),
                      (h/2-pt[1])*sensor/(w*lens),-1),
                     cam["camera_rotation_euler_rad"])
    origin=cam["camera_location_m"]
    if direction[2]>=-1e-9:
        return None
    t=(float(cam["floor_z_m"])-origin[2])/direction[2]
    if t<=0:
        return None
    return [round(origin[i]+t*direction[i],5) for i in range(3)]


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--camera-manifest",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True,
                   help="Manually completed V38 review template, NOT default template")
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--wheelbase-m",type=float,
                   help="Authoritatively verified model/variant wheelbase")
    p.add_argument("--max-relative-error",type=float,default=.15)
    args=p.parse_args()
    if args.wheelbase_m is not None and not 1.5<=args.wheelbase_m<=5:
        p.error("Wheelbase must be in [1.5, 5] m")
    if not 0<args.max_relative_error<=.5:
        p.error("Invalid error tolerance")
    manifest=json.loads(args.camera_manifest.read_text(encoding="utf-8"))
    review=json.loads(args.review.read_text(encoding="utf-8"))
    cameras=manifest.get("camera_views",[])
    if len(cameras)!=1:
        p.error("Expected exactly one central Blender camera")
    cam=cameras[0]
    result={
        "status":"blocked_for_production",
        "method":"assumed_floor_ray_intersection",
        "wheelbase_m":args.wheelbase_m,
        "source_camera_calibrated":False,
        "vehicle_3d_pose_verified":False,
        "ready_for_automatic_publication":False,
        "views":{}
    }
    for name in ("front","side","rear"):
        entry=review.get("views",{}).get(name,{})
        contacts=entry.get("contacts",[])
        valid=(len(contacts)==2 and all(
            c.get("verified") is True and c.get("visible_tire") is True
            and isinstance(c.get("confirmed_px"),list)
            and len(c["confirmed_px"])==2
            and all(isinstance(v,(int,float)) and math.isfinite(v)
                    for v in c["confirmed_px"])
            for c in contacts))
        if not valid:
            result["views"][name]={
                "status":"blocked_unverified_contacts",
                "message":"Confirm both visible tire contacts in V38 review first"}
            continue
        points=[project_floor(c["confirmed_px"],cam) for c in contacts]
        if any(x is None for x in points):
            result["views"][name]={"status":"invalid_floor_ray"}
            continue
        distance=math.dist(points[0][:2],points[1][:2])
        relative_error=(abs(distance-args.wheelbase_m)/args.wheelbase_m
                        if args.wheelbase_m is not None else None)
        result["views"][name]={
            "status":"provisional_floor_projection_only",
            "floor_points_m":points,
            "floor_separation_m":round(distance,4),
            "relative_wheelbase_discrepancy":(
                round(relative_error,4) if relative_error is not None else None),
            "passes_provisional_wheelbase_check":(
                relative_error<=args.max_relative_error
                if relative_error is not None and name=="side" else None),
            "warning":"The two visible wheel contacts may be on one side of the vehicle; oblique image distance is not necessarily wheelbase. Source camera is uncalibrated.",
            "ready_for_automatic_publication":False
        }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2),encoding="utf-8")
    for name,item in result["views"].items():
        print(name,item["status"],item.get("floor_separation_m"))
    print("V39 BLOCKED: no 3D pose claim or production changes")


if __name__=="__main__":
    main()
