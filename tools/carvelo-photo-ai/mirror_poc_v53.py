#!/usr/bin/env python3
"""Offline CARVAMO mirror-floor visual POC. NOT physical camera calibration.
Preserves V51 vehicle RGB/alpha exactly; reflects only a derived layer.
Never calls paid services or writes to production.
"""
import argparse, json
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--car",type=Path,required=True)
 p.add_argument("--background",type=Path,required=True)
 p.add_argument("--manifest",type=Path,required=True)
 p.add_argument("--output-dir",type=Path,required=True)
 a=p.parse_args()
 with Image.open(a.car) as im: car=im.convert("RGBA")
 with Image.open(a.background) as im: bg=im.convert("RGBA")
 m=json.loads(a.manifest.read_text())
 if car.size!=bg.size: p.error("Car/background sizes differ")
 w,h=car.size
 x0,y0,x1,y1=m["new_bbox"]
 if not (0<=x0<x1<=w and 0<=y0<y1<=h):p.error("Invalid vehicle bbox")
 # The V51 bbox bottom is only a provisional silhouette baseline, NOT wheel contact.
 floor=int(m["floor_row_px"])
 crop=car.crop((x0,y0,x1,y1))
 reflected=crop.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
 # Gentle, strongly attenuated mirror-floor reflection, clipped to visible canvas.
 rw,rh=reflected.size
 reflect_layer=Image.new("RGBA",(w,h),(0,0,0,0))
 alpha=reflected.getchannel("A")
 fade=Image.new("L",(rw,rh),0)
 fd=ImageDraw.Draw(fade)
 for y in range(rh):
  opacity=round(85*max(0,1-y/max(1,rh))**1.5)
  fd.line((0,y,rw,y),fill=opacity)
 import PIL.ImageChops
 reflected.putalpha(PIL.ImageChops.multiply(alpha,fade))
 reflect_layer.alpha_composite(reflected,(x0,floor))
 reflect_layer=reflect_layer.filter(ImageFilter.GaussianBlur(2.5))
 shadow=Image.new("RGBA",(w,h),(0,0,0,0))
 sd=ImageDraw.Draw(shadow)
 sd.ellipse((x0+round((x1-x0)*.12),floor-12,x1-round((x1-x0)*.12),floor+17),fill=(0,0,0,90))
 shadow=shadow.filter(ImageFilter.GaussianBlur(16))
 # Layer order: clean 3D studio, provisional reflection, contact-area shadow, original car.
 out=Image.alpha_composite(bg,reflect_layer)
 out=Image.alpha_composite(out,shadow)
 out=Image.alpha_composite(out,car).convert("RGB")
 a.output_dir.mkdir(parents=True,exist_ok=True)
 out.save(a.output_dir/"jaecoo8_mirror_poc.png")
 report={"status":"visual_poc_only","vehicle_pixels":"original V51 layer preserved by compositing",
 "reflection":"2D vertically flipped approximate reflection; NOT perspective calibrated",
 "wheel_ground_contact_verified":False,"ready_for_publication":False,"paid_api_calls":0,
 "source_car":str(a.car),"background":str(a.background)}
 (a.output_dir/"mirror_poc_report.json").write_text(json.dumps(report,indent=2))
 print(json.dumps(report,indent=2))
if __name__=="__main__":main()
