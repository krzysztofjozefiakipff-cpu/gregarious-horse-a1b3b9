#!/usr/bin/env python3
"""CARVAMO V37: three-view offline showroom comparison (V35 versus V36).

Reuses V35's original-size vehicle cutouts and V34 wheel candidates, but
renders against the corresponding V36 Blender camera background. Camera
poses are hypotheses, NOT calibrated source-photo perspectives. No writes
to production, no Supabase, no automatic publishing.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from composite_showroom_v35 import compose

VIEWS=("front","side","rear")


def sheet(old_dir,new_dir,out):
    w,h=640,400
    canvas=Image.new("RGB",(w*2,h*3),"white")
    for row,view in enumerate(VIEWS):
        for col,(version,folder) in enumerate((("V35",old_dir),("V37",new_dir))):
            filename=folder/f"{view}_{version.lower()}_showroom.jpg"
            with Image.open(filename) as im:
                photo=ImageOps.contain(im.convert("RGB"),(w,h-32),
                                       Image.Resampling.LANCZOS)
            tile=Image.new("RGB",(w,h),"white")
            tile.paste(photo,((w-photo.width)//2,32))
            ImageDraw.Draw(tile).text((12,10),f"{view.upper()} | {version}",fill="black")
            canvas.paste(tile,(col*w,row*h))
    canvas.save(out,quality=92)


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v34-report",type=Path,required=True)
    p.add_argument("--camera-dir",type=Path,required=True)
    p.add_argument("--v35-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    manifest_path=args.camera_dir/"v36_camera_manifest.json"
    if not manifest_path.is_file():
        p.error(f"Missing V36 camera manifest: {manifest_path}")
    camera=json.loads(manifest_path.read_text(encoding="utf-8"))
    if camera.get("source_photo_camera_calibrated") is not False:
        p.error("V36 must explicitly be uncalibrated hypothesis")
    report=json.loads(args.v34_report.read_text(encoding="utf-8"))
    if "views" not in report:
        p.error("Invalid V34 report")
    output={"status":"offline_preview_only",
            "source_photo_camera_calibrated":False,
            "ready_for_automatic_publication":False,"views":{}}
    args.output.mkdir(parents=True,exist_ok=True)
    for view in VIEWS:
        spec=camera["views"].get(view)
        if not spec:
            raise ValueError("Missing V36 camera view: "+view)
        background=args.camera_dir/spec["image"]
        source=args.results/f"v19-{view}"/"segmented.png"
        contacts=report["views"][view]["contacts"]
        with Image.open(background) as bg,Image.open(source) as car:
            dest=args.output/f"{view}_v37_showroom.jpg"
            item=compose(bg,car,contacts,dest)
            item["background_camera_hypothesis"]=spec["image"]
            output["views"][view]=item
            print(view,"visible=",item["full_vehicle_visible"],
                  "wheel_delta_px=",item["wheel_height_difference_px"],dest)
    (args.output/"v37_manifest.json").write_text(
        json.dumps(output,indent=2),encoding="utf-8")
    try:
        sheet(args.v35_dir,args.output,args.output/"v35_vs_v37.jpg")
        print("Comparison:",args.output/"v35_vs_v37.jpg")
    except FileNotFoundError as error:
        print("Comparison skipped; missing:",error)
    print("V37 offline preview only; no source camera calibration")


if __name__=="__main__":
    main()
