#!/usr/bin/env python3
"""CARVAMO deterministic showroom compositor. Never regenerates the approved background."""
import argparse, json
from pathlib import Path
from PIL import Image, ImageFilter, ImageEnhance, ImageDraw
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--vehicle",required=True);p.add_argument("--background",required=True)
 p.add_argument("--output-dir",default="carvamo_fixed_studio_result")
 p.add_argument("--car-width",type=float,default=.74)
 a=p.parse_args(); out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 bg=Image.open(a.background).convert("RGB"); W,H=bg.size
 car=Image.open(a.vehicle).convert("RGBA")
 alpha=car.getchannel("A")
 bounds=alpha.point(lambda v:255 if v>28 else 0).getbbox()
 if not bounds:raise ValueError("Vehicle has no usable alpha mask")
 car=car.crop(bounds)
 target_w=int(W*a.car_width); scale=target_w/car.width
 target_h=round(car.height*scale)
 if target_h>int(H*.72):
  scale=int(H*.72)/car.height;target_w=round(car.width*scale);target_h=round(car.height*scale)
 car=car.resize((target_w,target_h),Image.Resampling.LANCZOS)
 mask=car.getchannel("A")
 # Vehicle is intentionally positioned below the rear-wall logo area.
 # Ground baseline is a conservative screen-space estimate, NOT wheel verification.
 baseline=int(H*.87);x=(W-target_w)//2;y=baseline-target_h
 # Composite in isolated layers; original showroom pixels are never AI-generated.
 scene=bg.convert("RGBA")
 shadow=Image.new("RGBA",(W,H),(0,0,0,0))
 sh=Image.new("L",(W,H),0)
 d=ImageDraw.Draw(sh)
 d.ellipse((x+int(target_w*.08),baseline-int(target_h*.045),x+int(target_w*.95),baseline+int(target_h*.045)),fill=155)
 sh=sh.filter(ImageFilter.GaussianBlur(max(7,int(W*.013))))
 shadow.putalpha(sh)
 scene=Image.alpha_composite(scene,shadow)
 # Subtle ground reflection; clipped to lower image and blurred to avoid pasted-on mirror.
 reflection=Image.new("RGBA",(W,H),(0,0,0,0))
 flipped=car.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
 available=max(0,H-baseline)
 if available:
  flipped=flipped.crop((0,0,flipped.width,min(flipped.height,available)))
  ra=flipped.getchannel("A")
  fade=Image.new("L",flipped.size)
  pix=fade.load()
  for yy in range(flipped.height):
   opacity=int(55*max(0,1-yy/max(1,available))**1.6)
   for xx in range(flipped.width):pix[xx,yy]=ra.getpixel((xx,yy))*opacity//255
  flipped.putalpha(fade)
  reflection.paste(flipped,(x,baseline),flipped)
  reflection=reflection.filter(ImageFilter.GaussianBlur(max(2,int(W*.002))))
  scene=Image.alpha_composite(scene,reflection)
 layer=Image.new("RGBA",(W,H),(0,0,0,0));layer.paste(car,(x,y),car)
 scene=Image.alpha_composite(scene,layer)
 path=out/"candidate.png";scene.convert("RGB").save(path,optimize=True)
 qa={"status":"AWAITING_VISUAL_QA","ready_for_publication":False,"background_preserved":True,
 "method":"deterministic_alpha_composite","source_vehicle":str(a.vehicle),"source_background":str(a.background),
 "vehicle_bbox":[x,y,x+target_w,y+target_h],"assumed_floor_y":baseline,
 "wheel_ground_contact_verified":False,"note":"Inspect both tire contact points and logo occlusion before publication."}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Created",path,"QA: not approved")
if __name__=="__main__":main()
