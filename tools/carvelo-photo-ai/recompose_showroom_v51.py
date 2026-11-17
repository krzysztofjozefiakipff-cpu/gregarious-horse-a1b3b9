#!/usr/bin/env python3
"""CARVAMO V51: rebuild rear-view showroom composition BEFORE AI inference.

Offline only. Uses original V47 car pixels/mask and the empty V36 showroom.
Never rescales the generated fal image containing the old car. Never calls fal.
Creates a new V47-compatible input/masks and a side-by-side comparison.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--v47-dir",type=Path,required=True)
    p.add_argument("--view",choices=("front","side","rear"),default="rear")
    p.add_argument("--background",type=Path,default=Path("/tmp/carvamo-photo-ai-test/results/v36-cameras/empty_rear_v36.png"))
    p.add_argument("--scale",type=float,default=.82)
    p.add_argument("--floor-row",type=int,default=615)
    p.add_argument("--output-dir",type=Path)
    a=p.parse_args()
    if not .5<=a.scale<=1.0:p.error("--scale must be 0.5..1.0")
    src=a.v47_dir/a.view
    out=a.output_dir or src/"v51"
    for name in ("input.png","protect_car_mask.png","original_car_rgba.png"):
        if not (src/name).is_file():p.error("Missing "+str(src/name))
    if not a.background.is_file():p.error("Missing empty showroom background "+str(a.background))
    with Image.open(src/"input.png") as im: original=im.convert("RGB")
    with Image.open(src/"protect_car_mask.png") as im: mask=im.convert("L")
    with Image.open(a.background) as im: bg=im.convert("RGB")
    if bg.size!=original.size or mask.size!=original.size:p.error("Dimension mismatch")
    w,h=bg.size
    box=mask.getbbox()
    if not box:p.error("Empty vehicle mask")
    # Crop exactly the car bounding box; no AI-generated vehicle pixels used.
    car_crop=original.crop(box).convert("RGBA")
    alpha=mask.crop(box)
    car_crop.putalpha(alpha)
    cw,ch=car_crop.size
    nw,nh=round(cw*a.scale),round(ch*a.scale)
    car_crop=car_crop.resize((nw,nh),Image.Resampling.LANCZOS)
    # Approximate grounding using the lowest visible tire in the segmented
    # silhouette; not a physical camera calibration or confirmed contact.
    x=(w-nw)//2
    y=a.floor_row-nh
    if x<0 or y<0 or x+nw>w or y+nh>h:p.error("New car does not fit canvas")
    canvas=bg.copy()
    # Conservative diffuse underbody shadow, deliberately not a claimed
    # physically correct per-wheel contact shadow.
    shadow=Image.new("RGBA",(w,h),(0,0,0,0))
    sd=ImageDraw.Draw(shadow)
    sd.ellipse((x+int(.08*nw),a.floor_row-22,x+int(.92*nw),a.floor_row+15),fill=(0,0,0,58))
    shadow=shadow.filter(ImageFilter.GaussianBlur(19))
    canvas=Image.alpha_composite(canvas.convert("RGBA"),shadow)
    layer=Image.new("RGBA",(w,h),(0,0,0,0))
    layer.alpha_composite(car_crop,(x,y))
    canvas=Image.alpha_composite(canvas,layer).convert("RGB")
    protection=Image.new("L",(w,h),0)
    protection.paste(car_crop.getchannel("A"),(x,y))
    edit=protection.point(lambda v:255-v)
    out.mkdir(parents=True,exist_ok=True)
    canvas.save(out/"input.png")
    protection.save(out/"protect_car_mask.png")
    edit.save(out/"edit_mask_white_background.png")
    layer.save(out/"original_car_rgba.png")
    (out/"prompt.txt").write_text(
        "Photorealistic premium CARVAMO automotive showroom interior; seamless clean neutral gray floor, realistic soft contact lighting; preserve the entire vehicle exactly as masked. No text, no lettering, no logos, no watermarks.",encoding="utf-8")
    comparison=Image.new("RGB",(w*2,h))
    comparison.paste(original,(0,0));comparison.paste(canvas,(w,0))
    comparison.save(out/"before_after_v51.jpg",quality=92)
    report={"version":"v51","view":a.view,"original_bbox":list(box),
            "new_bbox":[x,y,x+nw,y+nh],"scale":a.scale,
            "new_bottom_margin_px":h-(y+nh),"floor_row_px":a.floor_row,
            "empty_background":str(a.background),"paid_api_calls":0,
            "physical_wheel_contact_verified":False,
            "camera_calibration_available":False,
            "ready_for_publication":False,
            "next":"Review before_after_v51.jpg; do not run paid inference until accepted"}
    (out/"manifest_v51.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("V51 generated:",out/"before_after_v51.jpg")
    print("Vehicle protected, smaller scale; offline preview only.")
    print(json.dumps(report,indent=2))
if __name__=="__main__":main()
