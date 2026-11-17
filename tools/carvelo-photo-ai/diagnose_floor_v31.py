#!/usr/bin/env python3
"""CARVAMO V31 camera/floor diagnostic for offline composites.

Projects image pixels to the Blender floor z=0 using the saved perspective
camera pose. A 2D vehicle cutout cannot establish the car's true 3D pose:
this diagnostic measures the resulting ground-point separation and rejects
unsupported 'verified' claims. It never modifies source vehicle pixels.
"""
import argparse
import json
import math
from pathlib import Path


def rotate_xyz(v, angles):
    x,y,z=v
    for axis,a in enumerate(angles):
        c,s=math.cos(a),math.sin(a)
        if axis==0: y,z=y*c-z*s,y*s+z*c
        elif axis==1: x,z=x*c+z*s,-x*s+z*c
        else: x,y=x*c-y*s,x*s+y*c
    return (x,y,z)


def floor_intersection(pixel, view):
    w,h=map(float,view["resolution"])
    px,py=map(float,pixel)
    lens=float(view["lens_mm"])
    sensor=float(view["sensor_width_mm"])
    # Blender camera local -Z is forward, +Y is image up.
    # Horizontal fit with square pixels (generator defaults).
    dx=(px-w/2)*sensor/(w*lens)
    dy=(h/2-py)*sensor/(w*lens)
    direction=rotate_xyz((dx,dy,-1.0),view["camera_rotation_euler_rad"])
    camera=view["camera_location_m"]
    floor=float(view["floor_z_m"])
    if direction[2]>=-1e-8:
        return None
    t=(floor-camera[2])/direction[2]
    if t<=0:
        return None
    return [round(camera[i]+t*direction[i],4) for i in range(3)]


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--camera-manifest",type=Path,required=True)
    p.add_argument("--composite-manifest",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--azimuth",type=int,default=0)
    args=p.parse_args()
    camera=json.loads(args.camera_manifest.read_text(encoding="utf-8"))
    views=[v for v in camera["camera_views"] if v["azimuth_deg"]==args.azimuth]
    if len(views)!=1:
        p.error("Requested camera azimuth missing from camera manifest; do not substitute another view")
    view=views[0]
    composites=json.loads(args.composite_manifest.read_text(encoding="utf-8"))
    report={}
    for name,item in composites.items():
        pts=item.get("wheel_contacts_px")
        if not pts or len(pts)!=2:
            report[name]={"status":"missing_two_contacts"}
            continue
        world=[floor_intersection(pt,view) for pt in pts]
        if any(v is None for v in world):
            status="ground_ray_invalid"
            separation=None
        else:
            separation=round(math.dist(world[0][:2],world[1][:2]),3)
            status="provisional_ground_projection"
        report[name]={
            "status":status,"pixel_contacts":pts,"projected_floor_points_m":world,
            "projected_contact_separation_m":separation,
            "camera_azimuth_deg":args.azimuth,
            "camera_pose_from_blender_manifest":True,
            "vehicle_pose_verified":False,
            "wheelbase_verified":False,
            "notes":"Projection assumes both pixel contacts lie on floor; this does not prove wheel contact or camera alignment. Different source photos require their own camera calibration."
        }
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2),encoding="utf-8")
    for name,r in report.items():
        print(name,r["status"],r.get("projected_contact_separation_m"))
    print("V31 diagnostics only; no 3D pose verification")


if __name__=="__main__":
    main()
