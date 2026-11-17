#!/usr/bin/env python3
"""CARVAMO V36: three distinct Blender camera views for offline evaluation.

Run via blender -b existing.blend --python this_file -- --output-dir PATH.
These are controlled camera hypotheses, not calibration from source photos.
Scene geometry, vehicle photographs, and production services are unchanged.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

VIEWS={
    "front":{"position":(-3.1,-7.0,1.40),"target":(0,0,1.20)},
    "side":{"position":(0,-7.3,1.35),"target":(0,0,1.25)},
    "rear":{"position":(3.1,-7.0,1.40),"target":(0,0,1.20)},
}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output-dir",type=Path,required=True)
    parser.add_argument("--samples",type=int,default=12)
    parser.add_argument("--width",type=int,default=1280)
    parser.add_argument("--height",type=int,default=720)
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    if min(args.samples,args.width,args.height)<=0:
        parser.error("samples and resolution must be positive")
    scene=bpy.context.scene
    camera=scene.camera
    if camera is None or camera.type!="CAMERA":
        raise RuntimeError("Blender scene has no active camera")
    args.output_dir.mkdir(parents=True,exist_ok=True)
    scene.render.engine="CYCLES"
    scene.cycles.samples=args.samples
    scene.render.resolution_x=args.width
    scene.render.resolution_y=args.height
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGB"
    scene.render.film_transparent=False
    camera.data.type="PERSP"
    camera.data.lens=40
    camera.data.sensor_width=36
    manifest={"status":"camera_hypotheses_only",
              "source_photo_camera_calibrated":False,
              "vehicle_pose_verified":False,
              "ready_for_automatic_publication":False,
              "views":{}}
    for name,spec in VIEWS.items():
        camera.location=spec["position"]
        target=Vector(spec["target"])
        camera.rotation_euler=(target-camera.location).to_track_quat("-Z","Y").to_euler()
        bpy.context.view_layer.update()
        path=args.output_dir/f"empty_{name}_v36.png"
        scene.render.filepath=str(path)
        bpy.ops.render.render(write_still=True)
        manifest["views"][name]={
            "image":path.name,
            "camera_location_m":[float(v) for v in camera.location],
            "camera_rotation_euler_rad":[float(v) for v in camera.rotation_euler],
            "target_m":list(spec["target"]),
            "lens_mm":camera.data.lens,
            "sensor_width_mm":camera.data.sensor_width,
            "resolution":[args.width,args.height],
            "floor_z_m":0.0,
            "note":"Different virtual camera only; not a measured match to source vehicle perspective"
        }
        print("V36 rendered",name,path,flush=True)
    (args.output_dir/"v36_camera_manifest.json").write_text(
        json.dumps(manifest,indent=2),encoding="utf-8")
    print("V36 complete: three Blender backgrounds, not calibrated vehicle composites")


if __name__=="__main__":
    main()
