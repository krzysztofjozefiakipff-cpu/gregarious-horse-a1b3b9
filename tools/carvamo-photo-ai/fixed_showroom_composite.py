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
 p.add_argument("--floor-y",type=float,default=.77)
 p.add_argument("--view",choices=["front","rear","left","right"],default="front")
 p.add_argument("--calibration",help="JSON with manually verified normalized wheel contacts")
 p.add_argument("--floor-reflection",choices=["water_mirror","subtle","off"],default="water_mirror")
 a=p.parse_args()
 if not .35<=a.car_width<=.8 or not .68<=a.floor_y<=.92:raise ValueError("Invalid composition settings")
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
 bands={"front":[(.50,.70),(.88,.99)],"rear":[(.02,.17),(.30,.51)],"left":[(.12,.38),(.67,.94)],"right":[(.12,.38),(.67,.94)]}
 contacts_local=[tire_contact(*band) for band in bands[a.view]]
 calibrated=False
 if a.calibration:
  config=json.loads(Path(a.calibration).read_text(encoding="utf-8"))
  if config.get("view")!=a.view or config.get("coordinate_system")!="cropped_vehicle_normalized" or not config.get("verified_by"):
   raise ValueError("Calibration must identify view, coordinate system and verifier")
  pts=config.get("wheel_contacts")
  if not isinstance(pts,list) or len(pts)!=2 or any(not isinstance(q,list) or len(q)!=2 or any(not isinstance(v,(int,float)) or not 0<=v<=1 for v in q) for q in pts):
   raise ValueError("Expected two normalized wheel contact points")
  contacts_local=[(round(q[0]*(cw-1)),round(q[1]*(ch-1))) for q in pts]
  for xx,yy in contacts_local:
   if alpha.getpixel((xx,yy))<80:raise ValueError("Calibrated contact outside vehicle alpha")
  calibrated=True
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
 # Water-mirror floor: perspective-compressed, softly blurred reflection.
 # The showroom itself is immutable; only the vehicle is reflected.
 # Use the near tire contact as reflection axis and avoid hard seams.
 reflection_start=max(py for px,py in points)
 if a.floor_reflection!="off" and reflection_start<H-4:
  reflected=car.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  # Reflection starts at the floor contact, not at the bounding-box edge.
  # Crop to the region above the nearest contact before flipping.
  local_axis=max(0,min(ch-1,reflection_start-y))
  reflected=car.crop((0,0,cw,local_axis+1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  avail=H-reflection_start
  compressed=max(1,min(avail,round(reflected.height*.82)))
  reflected=reflected.resize((cw,compressed),Image.Resampling.BICUBIC)
  fa=reflected.getchannel("A")
  opacity=185 if a.floor_reflection=="water_mirror" else 42
  fade=Image.new("L",(cw,compressed),0);draw=ImageDraw.Draw(fade)
  for row in range(compressed):
   strength=round(opacity*(1-row/max(1,compressed-1))**1.45)
   draw.line((0,row,cw,row),fill=strength)
  reflected.putalpha(ImageChops.multiply(fa,fade))
  refl=Image.new("RGBA",(W,H),(0,0,0,0))
  refl.paste(reflected,(x,reflection_start))
  refl=refl.filter(ImageFilter.GaussianBlur(max(2,round(W*(.0015 if a.floor_reflection=="water_mirror" else .004)))))
  scene=Image.alpha_composite(scene,refl)
 layer=Image.new("RGBA",(W,H),(0,0,0,0))
 layer.paste(car,(x,y))
 scene=Image.alpha_composite(scene,layer)
 candidate=out/"candidate.png";scene.convert("RGB").save(candidate,optimize=True)
 diagnostic=scene.convert("RGB").copy();marker=ImageDraw.Draw(diagnostic)
 marker.line((0,baseline,W,baseline),fill=(255,195,0),width=max(2,W//400))
 for idx,(px,py) in enumerate(points):
  rr=max(7,W//90)
  marker.ellipse((px-rr,py-rr,px+rr,py+rr),outline=(255,35,35),width=max(3,W//350))
  marker.text((px+rr,py-rr),"Wheel "+str(idx+1),fill=(255,255,255))
 diagnostic.save(out/"wheel_calibration_overlay.png")
 qa={"status":"AWAITING_VISUAL_QA","ready_for_publication":False,
 "method":"fixed_background_perspective_contact_shadows_v4","view":a.view,
 "background_preserved":True,"vehicle_bbox":[x,y,x+cw,y+ch],
 "estimated_contact_points":points,"calibration_file_used":bool(a.calibration),"floor_reflection":a.floor_reflection,"reflection_visible_pixels":H-reflection_start,"vehicle_width_fraction":round(cw/W,3),"composition_preset":"logo_visible_natural_scale_water_mirror","contact_shadow_anchored_per_wheel":True,"assumed_front_floor_y":baseline,
 "wheel_ground_contact_verified":calibrated,"logo_visibility_verified":False,
 "notes":["Contact zones estimated from alpha; not tire geometry","No generative modification of approved background","Inspect contact shadows and source tire pixels before approval"]}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Candidate:",candidate,"contacts:",points,"publication blocked pending visual QA")
if __name__=="__main__":main()
