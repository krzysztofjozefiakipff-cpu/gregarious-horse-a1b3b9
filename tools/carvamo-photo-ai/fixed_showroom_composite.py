#!/usr/bin/env python3
"""CARVAMO fixed-background candidate; preserve approved pixels and mark QA unapproved."""
import argparse,json
from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw
def main():
 p=argparse.ArgumentParser()
 p.add_argument("--vehicle",required=True);p.add_argument("--background",required=True)
 p.add_argument("--output-dir",default="carvamo_fixed_studio_result")
 p.add_argument("--car-width",type=float,default=.60)
 p.add_argument("--floor-y",type=float,default=.89)
 a=p.parse_args()
 if not .35<=a.car_width<=.8 or not .75<=a.floor_y<=.96:raise ValueError("Invalid composition settings")
 out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 bg=Image.open(a.background).convert("RGB");W,H=bg.size
 car=Image.open(a.vehicle).convert("RGBA")
 bbox=car.getchannel("A").point(lambda v:255 if v>=32 else 0).getbbox()
 if not bbox:raise ValueError("Missing vehicle transparency")
 car=car.crop(bbox)
 scale=min(W*a.car_width/car.width,H*.61/car.height)
 car=car.resize((round(car.width*scale),round(car.height*scale)),Image.Resampling.LANCZOS)
 cw,ch=car.size;x=(W-cw)//2;baseline=round(H*a.floor_y);y=baseline-ch
 # Estimate lowest visible silhouette pixels in two wheel zones. This is a heuristic,
 # not physical wheel verification; do not claim that wheel contacts are calibrated.
 alpha=car.getchannel("A")
 def lowpoint(xlo,xhi):
  best=None
  for xx in range(int(cw*xlo),min(cw,int(cw*xhi))):
   for yy in range(ch-1,int(ch*.48),-1):
    if alpha.getpixel((xx,yy))>=110:
     if best is None or yy>best[1]:best=(xx,yy)
     break
  return best
 # Wheel bands follow front-three-quarter source orientation (front left, rear right).
 contacts=[lowpoint(.18,.46),lowpoint(.76,.98)]
 if any(v is None for v in contacts):raise ValueError("Could not estimate both tire contact zones")
 # Align lowest tire to floor; perspective means the second tire may sit higher in screen space.
 # Avoid moving the car based on a bumper silhouette alone.
 y+=baseline-(y+max(v[1] for v in contacts))
 points=[(x+v[0],y+v[1]) for v in contacts]
 scene=bg.convert("RGBA")
 shadow_alpha=Image.new("L",(W,H),0);draw=ImageDraw.Draw(shadow_alpha)
 for px,py in points:
  radius=max(9,round(cw*.065))
  draw.ellipse((px-radius,py-round(radius*.14),px+radius,py+round(radius*.18)),fill=175)
 shadow_alpha=shadow_alpha.filter(ImageFilter.GaussianBlur(max(5,round(W*.007))))
 shadow=Image.new("RGBA",(W,H),(0,0,0,0));shadow.putalpha(shadow_alpha)
 scene=Image.alpha_composite(scene,shadow)
 # Floor reflection is optional, deliberately weak, and starts at the lower wheel contact.
 reflect_y=max(py for _,py in points)
 if reflect_y<H-4:
  refl=car.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  rh=min(refl.height,H-reflect_y)
  refl=refl.crop((0,0,cw,rh))
  mask=refl.getchannel("A")
  gradient=Image.new("L",(cw,rh))
  for yy in range(rh):
   opacity=round(38*(1-yy/max(1,rh))**2)
   gradient.paste(opacity,(0,yy,cw,yy+1))
  from PIL import ImageChops
  refl.putalpha(ImageChops.multiply(mask,gradient))
  layer=Image.new("RGBA",(W,H),(0,0,0,0));layer.paste(refl,(x,reflect_y))
  scene=Image.alpha_composite(scene,layer.filter(ImageFilter.GaussianBlur(max(2,round(W*.002)))))
 layer=Image.new("RGBA",(W,H),(0,0,0,0));layer.paste(car,(x,y))
 scene=Image.alpha_composite(scene,layer)
 path=out/"candidate.png";scene.convert("RGB").save(path,optimize=True)
 qa={"status":"AWAITING_VISUAL_QA","ready_for_publication":False,"background_preserved":True,
 "method":"fixed_background_wheel_zone_heuristic_v2","vehicle_bbox":[x,y,x+cw,y+ch],
 "estimated_contact_points":points,"assumed_floor_y":baseline,
 "wheel_ground_contact_verified":False,"logo_visibility_verified":False,
 "note":"Wheel positions estimated from alpha silhouette; human visual QA required."}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Created",path,"candidate only; wheel contact not independently verified")
if __name__=="__main__":main()
