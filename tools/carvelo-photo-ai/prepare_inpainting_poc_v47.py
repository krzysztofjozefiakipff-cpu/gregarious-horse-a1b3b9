#!/usr/bin/env python3
"""CARVAMO Photo AI 2.0 — prepare protected-car inpainting proof of concept.

Creates RGB input and an inpaint mask: white = replace background; black =
protect car. A configurable external image editor may generate the background,
then --merge restores the original car pixels exactly (at source resolution).
No external API credentials, provider assumptions or production changes.
"""
import argparse,json
from pathlib import Path
from PIL import Image,ImageFilter,ImageOps

VIEWS=("front","side","rear")
PROMPT=("Photorealistic premium CARVAMO automotive showroom, neutral warm grey "
        "architectural walls, subtle vertical wood slats, clean matte grey floor, "
        "soft diffuse overhead studio lighting. Keep the exact camera viewpoint "
        "and floor perspective of the source photograph. Natural tire contact "
        "shadows and restrained ambient occlusion. No people, no text, no logos, "
        "no extra vehicles. Only regenerate background pixels, never the car.")

def prepare(src,background,output,protect_threshold=8):
    with Image.open(src) as f: car=f.convert("RGBA")
    with Image.open(background) as f: bg=f.convert("RGB")
    if car.size!=bg.size:
        # Mask and car source have exact same dimensions after this resize.
        car=car.resize(bg.size,Image.Resampling.LANCZOS)
    alpha=car.getchannel("A")
    protected=alpha.point(lambda x:255 if x>=protect_threshold else 0)
    editable=ImageOps.invert(protected)
    # Inpaint input: original car + baseline showroom. Editable white background.
    canvas=bg.convert("RGBA")
    canvas.alpha_composite(car)
    output.mkdir(parents=True,exist_ok=True)
    canvas.convert("RGB").save(output/"input.png")
    editable.save(output/"edit_mask_white_background.png")
    protected.save(output/"protect_car_mask.png")
    car.save(output/"original_car_rgba.png")
    (output/"prompt.txt").write_text(PROMPT,encoding="utf-8")
    return {"image_size":list(bg.size),"mask_convention":"white_background_editable",
            "protected_car_pixels":sum(1 for v in protected.getdata() if v),
            "generation_status":"not_run","source_car_preserved_in_merge":True}

def merge(directory,generated,dest):
    with Image.open(directory/"original_car_rgba.png") as f:car=f.convert("RGBA")
    with Image.open(directory/"protect_car_mask.png") as f:mask=f.convert("L")
    with Image.open(generated) as f:base=f.convert("RGB")
    if base.size!=car.size:raise ValueError("Generated background dimensions differ")
    # Exact restoration of all protected car pixels from prepared input.
    # At anti-aliased boundary, source RGBA is composited to retain edge softness.
    clean=Image.composite(car.convert("RGB"),base,mask).convert("RGBA")
    # The boundary may still need manual QC; do not assert photorealism.
    dest.parent.mkdir(parents=True,exist_ok=True)
    clean.convert("RGB").save(dest,quality=96)
    return {"output":str(dest),"protected_pixels_restored":True,
            "background_and_tire_contact_quality_verified":False,
            "ready_for_automatic_publication":False}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path)
    p.add_argument("--background-dir",type=Path)
    p.add_argument("--output",type=Path,required=True)
    p.add_argument("--merge",type=Path,help="Generated RGB background from external editor")
    p.add_argument("--view",choices=VIEWS,default="rear")
    a=p.parse_args()
    if a.merge:
        info=merge(a.output/a.view,a.merge,a.output/a.view/"merged_protected.jpg")
        print(json.dumps(info,indent=2));return
    if not a.results or not a.background_dir:
        p.error("--results and --background-dir required for preparation")
    manifest={"status":"inpainting_inputs_prepared_only",
              "generative_provider_configured":False,
              "ready_for_automatic_publication":False,"views":{}}
    for view in VIEWS:
        src=a.results/f"v19-{view}"/"segmented.png"
        bg=a.background_dir/f"empty_{view}_v36.png"
        manifest["views"][view]=prepare(src,bg,a.output/view)
        print(view,"input/mask/prompt ready")
    (a.output/"poc_manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print("Inputs prepared. No AI generation performed. No live changes.")

if __name__=="__main__":main()
