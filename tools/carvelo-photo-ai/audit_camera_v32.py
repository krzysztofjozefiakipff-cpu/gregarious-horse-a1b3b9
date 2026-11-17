#!/usr/bin/env python3
"""CARVAMO V32: strict camera-ground calibration quality gate.

Uses Blender camera data, V31 floor diagnostic and V30 composition manifest.
Rejects unsupported metric wheelbase estimates: projected contact separation
for oblique views is NOT automatically a physical wheelbase.
No production deployment or photo alteration.
"""
import argparse
import json
import math
from pathlib import Path

VIEWS=("front","side","rear")


def audit(camera, floor, composite, expected_wheelbase_m=None,
          wheelbase_tolerance=.15):
    views=camera.get("camera_views",[])
    if len(views)!=1 or views[0].get("azimuth_deg")!=0:
        raise ValueError("Require a single central Blender camera view")
    view=views[0]
    required=("camera_location_m","camera_rotation_euler_rad",
              "lens_mm","sensor_width_mm","resolution","floor_z_m")
    if any(k not in view for k in required):
        raise ValueError("Incomplete camera metadata")
    result={"status":"blocked_for_production",
            "camera_source":"Blender scene",
            "camera_extrinsics_known":True,
            "source_photo_intrinsics_known":False,
            "source_photo_extrinsics_known":False,
            "source_photo_ground_plane_verified":False,
            "per_view":{}}
    for name in VIEWS:
        f=floor.get(name,{})
        c=composite.get(name,{})
        errors=[]
        if f.get("status")!="provisional_ground_projection":
            errors.append("floor_projection_unavailable")
        points=f.get("projected_floor_points_m")
        if not isinstance(points,list) or len(points)!=2 or any(
                not isinstance(p,list) or len(p)!=3 or
                not all(isinstance(v,(int,float)) and math.isfinite(v) for v in p)
                for p in points):
            errors.append("invalid_projected_floor_points")
        if not c.get("full_vehicle_visible"):
            errors.append("vehicle_cropped")
        if c.get("showroom_camera_matched") is not True:
            errors.append("source_camera_not_matched")
        if c.get("vehicle_pose_verified") is not True:
            errors.append("vehicle_pose_unverified")
        separation=f.get("projected_contact_separation_m")
        if not isinstance(separation,(int,float)) or not math.isfinite(separation) or separation<=0:
            errors.append("invalid_projected_separation")
        # Only the strict side view is potentially suitable for a 2D
        # wheelbase sanity check; even that is NOT a calibrated measurement.
        wheelbase_check="not_applicable"
        if expected_wheelbase_m is not None:
            if name!="side":
                wheelbase_check="skipped_oblique_view_not_wheelbase"
            elif isinstance(separation,(int,float)) and math.isfinite(separation):
                relative_error=abs(separation-expected_wheelbase_m)/expected_wheelbase_m
                wheelbase_check=("provisional_within_tolerance" if
                                 relative_error<=wheelbase_tolerance else
                                 "provisional_outside_tolerance")
                if relative_error>wheelbase_tolerance:
                    errors.append("side_projected_separation_differs_from_expected_wheelbase")
        result["per_view"][name]={
            "status":"blocked" if errors else "requires_manual_review",
            "errors":errors,
            "projected_contact_separation_m":separation,
            "expected_wheelbase_m":expected_wheelbase_m if name=="side" else None,
            "wheelbase_check":wheelbase_check,
            "ready_for_automatic_publication":False}
    result["next_required_inputs"]=[
        "Verified model and variant wheelbase from authoritative specification",
        "Original image camera intrinsics or calibrated vanishing points",
        "Independently verified tyre-to-floor contact annotations",
        "Perspective-consistent vehicle pose and floor-plane fit",
        "Manual review of three generated images"]
    return result


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--camera-manifest",type=Path,required=True)
    p.add_argument("--v31-report",type=Path,required=True)
    p.add_argument("--composite-manifest",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--expected-wheelbase-m",type=float)
    p.add_argument("--wheelbase-tolerance",type=float,default=.15)
    args=p.parse_args()
    if args.expected_wheelbase_m is not None and not 1.5<=args.expected_wheelbase_m<=5.0:
        p.error("Invalid expected wheelbase")
    if not 0<args.wheelbase_tolerance<=.5:
        p.error("Invalid wheelbase tolerance")
    data=audit(
        json.loads(args.camera_manifest.read_text(encoding="utf-8")),
        json.loads(args.v31_report.read_text(encoding="utf-8")),
        json.loads(args.composite_manifest.read_text(encoding="utf-8")),
        args.expected_wheelbase_m,args.wheelbase_tolerance)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(data,indent=2),encoding="utf-8")
    for name,item in data["per_view"].items():
        print(name,item["status"],",".join(item["errors"]))
    print("V32 production gate:",data["status"])


if __name__=="__main__":
    main()
