#!/usr/bin/env python3
"""CARVAMO V48: optional, explicit, paid FLUX Fill proof-of-concept.

Runs only on --execute with FAL_KEY and fal_client installed.
By default only validates local inputs. Never publishes assets.
Images are uploaded to external fal.ai only when --execute is supplied.
"""
import argparse,json,os,sys,urllib.request
from pathlib import Path
from PIL import Image,ImageChops

MODEL="fal-ai/flux-pro/v1/fill"

def validate(view_dir):
    paths=[view_dir/n for n in ("input.png","edit_mask_white_background.png",
                               "protect_car_mask.png","original_car_rgba.png","prompt.txt")]
    missing=[str(p) for p in paths if not p.is_file()]
    if missing:raise FileNotFoundError("Missing V47 assets: "+", ".join(missing))
    with Image.open(paths[0]) as inp,Image.open(paths[1]) as mask,Image.open(paths[2]) as protect,Image.open(paths[3]) as car:
        if not(inp.size==mask.size==protect.size==car.size):
            raise ValueError("V47 dimensions mismatch")
        if ImageChops.difference(mask.convert("L"),
                                 protect.convert("L").point(lambda v:255-v)).getbbox():
            raise ValueError("V47 masks not complementary")
        size=list(inp.size)
    return {"size":size,"input":paths[0],"mask":paths[1],"car":paths[3],
            "protect":paths[2],"prompt":paths[4].read_text(encoding="utf-8")}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--v47-dir",type=Path,required=True)
    p.add_argument("--view",choices=("front","side","rear"),default="rear")
    p.add_argument("--execute",action="store_true",help="Upload inputs and invoke paid fal.ai inference")
    p.add_argument("--output",type=Path)
    a=p.parse_args()
    data=validate(a.v47_dir/a.view)
    print("V48 validated",a.view,data["size"])
    if not a.execute:
        print("DRY RUN: no upload, no generation, no charge. --execute opts into external paid inference.")
        return
    if not os.environ.get("FAL_KEY"):
        p.error("FAL_KEY missing; set it privately on the server, never paste it into chat")
    try:import fal_client
    except ImportError:
        p.error("Install fal-client into the test venv: python -m pip install fal-client")
    dest=a.output or a.v47_dir/a.view/"v48"
    dest.mkdir(parents=True,exist_ok=True)
    image_url=fal_client.upload_file(str(data["input"]))
    mask_url=fal_client.upload_file(str(data["mask"]))
    result=fal_client.subscribe(MODEL,arguments={
        "prompt":data["prompt"],"image_url":image_url,"mask_url":mask_url,
        "output_format":"png","num_images":1
    })
    images=result.get("images",[])
    if not images or not images[0].get("url"):raise RuntimeError("No image URL in provider response")
    url=images[0]["url"]
    with urllib.request.urlopen(url,timeout=120) as response:
        raw=response.read(25_000_001)
    if len(raw)>25_000_000:raise RuntimeError("Provider image exceeds 25 MB")
    generated=dest/"generated_background.png"
    generated.write_bytes(raw)
    with Image.open(generated) as im:
        generated_rgb=im.convert("RGB")
    if list(generated_rgb.size)!=data["size"]:
        raise ValueError("Generated size mismatch; not merging")
    with Image.open(data["car"]) as im:car=im.convert("RGBA")
    with Image.open(data["protect"]) as im:protect=im.convert("L")
    # Restore exact RGB values of protected car pixels (including any opaque
    # body/wheel pixels) from V47's composite input, never model output.
    with Image.open(data["input"]) as im:original=im.convert("RGB")
    merged=Image.composite(original,generated_rgb,protect)
    merged.save(dest/"protected_car_result.png")
    manifest={"model":MODEL,"view":a.view,"status":"generated_requires_manual_qa",
              "car_pixels_protected":True,"mask_boundary_quality_verified":False,
              "tire_contact_verified":False,"ready_for_automatic_publication":False,
              "external_provider_used":True}
    (dest/"manifest.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print("Generated:",dest/"protected_car_result.png")
    print("REQUIRES HUMAN QUALITY REVIEW. No publication performed.")

if __name__=="__main__":main()
