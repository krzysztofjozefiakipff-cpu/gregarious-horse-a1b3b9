#!/usr/bin/env python3
"""CARVAMO reference-background compositor V3. Never changes showroom/logo source."""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageFilter,ImageDraw,ImageChops

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--vehicle",required=True);p.add_argument("--background",required=True)
 p.add_argument("--output-dir",default="carvamo_fixed_studio_result")
 p.add_argument("--car-width",type=float,default=.60)
 p.add_argument("--floor-y",type=float,default=.89)
 p.add_argument("--view",choices=["front","rear","left","right"],default="front")
 a=p.parse_args()
 if not .35<=a.car_width<=.8 or not .75<=a.floor_y<=.96:raise ValueError("Invalid composition settings")
 out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 bg=Image.open(a.background).convert("RGB");W,H=bg.size
 source=Image.open(a.vehicle).convert("RGBA")
 bb=source.getchannel("A").point(lambda v:255 if v>=32 else 0).getbbox()
 if not bb:raise ValueError("Missing vehicle transparency")
 car=source.crop(bb)
 scale=min(W*a.car_width/car.width,H*.61/car.height)
 car=car.resize((round(car.width*scale),round(car.height*scale)),Image.Resampling.LANCZOS)
 cw,ch=car.size;x=(W-cw)//2;alpha=car.getchannel("A")
 # Wheel regions are orientation-specific. We sample the bottom of the alpha
 # silhouette, then keep a distinct screen-space floor point for each wheel.
 def tire_contact(left,right):
  samples=[]
  for xx in range(int(cw*left),min(cw,int(cw*right))):
   for yy in range(ch-1,int(ch*.52),-1):
    if alpha.getpixel((xx,yy))>=180:
     samples.append((xx,yy));break
  if len(samples)<5:raise ValueError("Wheel alpha region missing")
  ys=sorted(yy for _,yy in samples)
  cutoff=ys[max(0,int(len(ys)*.90)-1)]
  chosen=[(xx,yy) for xx,yy in samples if yy>=cutoff]
  return (round(sum(xx for xx,yy in chosen)/len(chosen)),max(yy for xx,yy in chosen))
 bands={"front":[(.30,.49),(.88,.99)],"rear":[(.12,.32),(.65,.89)],"left":[(.12,.38),(.67,.94)],"right":[(.12,.38),(.67,.94)]}
 contacts_local=[tire_contact(*band) for band in bands[a.view]]
 if abs(contacts_local[0][0]-contacts_local[1][0])<cw*.18:raise ValueError("Wheel contacts overlap")
 baseline=round(H*a.floor_y)
 y=baseline-max(yy for xx,yy in contacts_local)
 points=[(x+xx,y+yy) for xx,yy in contacts_local]
 scene=bg.convert("RGBA")
 # Perspective-aware, multi-scale contact shadows. The rear tire lies higher
 # in image coordinates; its shadow must be anchored to its OWN contact point.
 contact_mask=Image.new("L",(W,H),0)
 d=ImageDraw.Draw(contact_mask)
 for i,(px,py) in enumerate(points):
  rx=round(cw*(.057 if i==0 else .037))
  ry=max(3,round(rx*.20))
  d.ellipse((px-rx,py-ry,px+rx,py+ry),fill=245)
 contact_mask=contact_mask.filter(ImageFilter.GaussianBlur(max(3,round(W*.003))))
 # Long diffuse shadow beneath chassis, lighter than the contact patches.
 diffuse=Image.new("L",(W,H),0);d=ImageDraw.Draw(diffuse)
 (fx,fy),(rx,ry)=points
 d.ellipse((min(fx,rx)-round(cw*.11),min(fy,ry)-round(ch*.05),
            max(fx,rx)+round(cw*.11),max(fy,ry)+round(ch*.07)),fill=72)
 diffuse=diffuse.filter(ImageFilter.GaussianBlur(max(12,round(W*.018))))
 combined=ImageChops.lighter(contact_mask,diffuse)
 shadow=Image.new("RGBA",(W,H),(0,0,0,0));shadow.putalpha(combined)
 scene=Image.alpha_composite(scene,shadow)
 # Reflections remain faint; a full mirrored car incorrectly implies a
 # perfect mirror floor and creates floating-wheel artifacts.
 reflection_start=max(py for px,py in points)
 if reflection_start<H-4:
  flipped=car.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  height=min(flipped.height,H-reflection_start)
  flipped=flipped.crop((0,0,cw,height))
  fa=flipped.getchannel("A")
  fade=Image.new("L",(cw,height),0);draw=ImageDraw.Draw(fade)
  for row in range(height):
   opacity=round(22*(1-row/max(1,height))**2)
   draw.line((0,row,cw,row),fill=opacity)
  flipped.putalpha(ImageChops.multiply(fa,fade))
  reflection=Image.new("RGBA",(W,H),(0,0,0,0))
  reflection.paste(flipped,(x,reflection_start))
  scene=Image.alpha_composite(scene,reflection.filter(ImageFilter.GaussianBlur(max(4,round(W*.004)))))
 layer=Image.new("RGBA",(W,H),(0,0,0,0))
 layer.paste(car,(x,y))
 scene=Image.alpha_composite(scene,layer)
 candidate=out/"candidate.png";scene.convert("RGB").save(candidate,optimize=True)
 qa={"status":"AWAITING_VISUAL_QA","ready_for_publication":False,
 "method":"fixed_background_perspective_contact_shadows_v4","view":a.view,
 "background_preserved":True,"vehicle_bbox":[x,y,x+cw,y+ch],
 "estimated_contact_points":points,"contact_shadow_anchored_per_wheel":True,"assumed_front_floor_y":baseline,
 "wheel_ground_contact_verified":False,"logo_visibility_verified":False,
 "notes":["Contact zones estimated from alpha; not tire geometry","No generative modification of approved background","Inspect contact shadows and source tire pixels before approval"]}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Candidate:",candidate,"contacts:",points,"publication blocked pending visual QA")
if __name__=="__main__":main()
