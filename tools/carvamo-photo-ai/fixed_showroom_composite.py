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
 p.add_argument("--reflection-gap",type=float,default=.025,help="Front/rear visual gap between bumper and first reflection")
 p.add_argument("--floor-seam-y",type=float,default=.705,help="Top edge of visible showroom floor as fraction of image height")
 p.add_argument("--ground-drop",type=float,default=.075,help="Move car and its contact-linked reflection down as a unit")
 a=p.parse_args()
 if not .35<=a.car_width<=.8 or not .68<=a.floor_y<=.92 or not .55<=a.floor_seam_y<=.85 or not 0<=a.ground_drop<=.10:raise ValueError("Invalid composition settings")
 out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 bg=Image.open(a.background).convert("RGB");W,H=bg.size
 source=Image.open(a.vehicle).convert("RGBA")
 bb=source.getchannel("A").point(lambda v:255 if v>=32 else 0).getbbox()
 if not bb:raise ValueError("Missing vehicle transparency")
 car=source.crop(bb)
 target_width=.76 if a.view in ("left","right") else (.63 if a.view in ("front","rear") else .60)
 scale=min(W*target_width/car.width,H*(.59 if a.view in ("left","right") else .61)/car.height)
 # Avoid unnecessary enlargement; the limiting constraint is the output canvas.\n # Never upscale the source cutout: synthetic sharpening cannot restore detail.
 scale=min(scale,1.0)
 car=car.resize((round(car.width*scale),round(car.height*scale)),Image.Resampling.LANCZOS) if scale<.999 else car.copy()
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
 bands={"front":[(.08,.25),(.50,.70),(.88,.99)],"rear":[(.02,.17),(.30,.51),(.78,.96)],"left":[(.12,.38),(.67,.94)],"right":[(.12,.38),(.67,.94)]}
 contacts_local=[]
 for band in bands[a.view]:
  try:contacts_local.append(tire_contact(*band))
  except ValueError:
   if len(bands[a.view])<=2:raise
   pass
 calibrated=False
 if a.calibration:
  config=json.loads(Path(a.calibration).read_text(encoding="utf-8"))
  if config.get("view")!=a.view or config.get("coordinate_system")!="cropped_vehicle_normalized" or not config.get("verified_by"):
   raise ValueError("Calibration must identify view, coordinate system and verifier")
  pts=config.get("wheel_contacts")
  if not isinstance(pts,list) or len(pts) not in (2,3) or any(not isinstance(q,list) or len(q)!=2 or any(not isinstance(v,(int,float)) or not 0<=v<=1 for v in q) for q in pts):
   raise ValueError("Expected two or three normalized wheel contact points")
  contacts_local=[(round(q[0]*(cw-1)),round(q[1]*(ch-1))) for q in pts]
  for xx,yy in contacts_local:
   if alpha.getpixel((xx,yy))<80:raise ValueError("Calibrated contact outside vehicle alpha")
  calibrated=True
 if any(abs(q[0]-r[0])<cw*.06 for i,q in enumerate(contacts_local) for r in contacts_local[i+1:]):raise ValueError("Wheel contacts overlap")
 # Fit the visible wheel geometry into the actual floor plane before placement.
 # A distant wheel in a 45-degree photo can be far above the lowest alpha pixel.
 floor_seam=round(H*a.floor_seam_y)
 reserve=round(H*(.065 if a.view in ("front","rear") else .055))
 margin=round(H*.012)
 min_contact=min(yy for xx,yy in contacts_local)
 required_depth=ch-min_contact
 available_depth=H-reserve-floor_seam-margin
 if required_depth>available_depth:
  factor=min(1.,available_depth/max(1,required_depth)*.985)
  if factor<.40:
   raise ValueError("Vehicle geometry cannot fit safely on the floor; manual calibration required")
  old_cw,old_ch=cw,ch
  car=car.resize((max(1,round(cw*factor)),max(1,round(ch*factor))),Image.Resampling.LANCZOS)
  cw,ch=car.size
  alpha=car.getchannel("A")
  x=(W-cw)//2
  contacts_local=[(min(cw-1,round(xx*cw/old_cw)),min(ch-1,round(yy*ch/old_ch))) for xx,yy in contacts_local]
 baseline=round(H*(a.floor_y+min(a.ground_drop,.015)))
 y=baseline-max(yy for xx,yy in contacts_local)
 # Keep every wheel contact on the visible floor; reserve reflection space.
 floor_seam=round(H*a.floor_seam_y)
 reserve=round(H*(.16 if a.view in ("front","rear") else .10))
 min_contact=min(yy for xx,yy in contacts_local)
 min_y=floor_seam+round(H*.012)-min_contact
 max_y=H-ch-reserve
 if min_y>max_y:
  # Refit after integer resizing: rounding and silhouette geometry can leave
  # a few pixels of overflow even when the initial scale estimate passed.
  # Preserve the same proportions and rescale contacts with the image.
  available=H-reserve-floor_seam-round(H*.012)
  depth=max(1,ch-min_contact)
  factor=min(.985,available/depth*.975)
  if factor<=0 or factor>=1:
   factor=.97
  old_cw,old_ch=cw,ch
  car=car.resize((max(1,round(cw*factor)),max(1,round(ch*factor))),Image.Resampling.LANCZOS)
  cw,ch=car.size
  alpha=car.getchannel("A")
  x=(W-cw)//2
  contacts_local=[(min(cw-1,round(xx*cw/old_cw)),min(ch-1,round(yy*ch/old_ch))) for xx,yy in contacts_local]
  min_contact=min(yy for xx,yy in contacts_local)
  min_y=floor_seam+round(H*.012)-min_contact
  max_y=H-ch-reserve
  if min_y>max_y:
   raise ValueError("Floor fit still impossible after adaptive rescaling; manual wheel calibration required")
 y=max(y,min_y)
 y=min(y,max_y)
 points=[(x+xx,y+yy) for xx,yy in contacts_local]
 scene=bg.convert("RGBA")
 floor_mask=Image.new("L",(W,H),0)
 ImageDraw.Draw(floor_mask).rectangle((0,floor_seam,W,H),fill=255)
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
 fx=min(px for px,py in points);rx=max(px for px,py in points)
 fy=min(py for px,py in points);ry=max(py for px,py in points)
 d.ellipse((min(fx,rx)-round(cw*.11),min(fy,ry)-round(ch*.05),
            max(fx,rx)+round(cw*.11),max(fy,ry)+round(ch*.07)),fill=72)
 diffuse=diffuse.filter(ImageFilter.GaussianBlur(max(12,round(W*.018))))
 combined=ImageChops.multiply(ImageChops.lighter(contact_mask,diffuse),floor_mask)
 shadow=Image.new("RGBA",(W,H),(0,0,0,0));shadow.putalpha(combined)
 scene=Image.alpha_composite(scene,shadow)
 # Per-column reflection anchored to the perspective ground-contact line.
 # Unlike a single horizontal flip, the distant wheel is reflected at its
 # own contact point, so tire and reflected tire meet without a visible gap.
 reflection_start=max(py for px,py in points)
 # Frontal/rear shots have a bumper between the visible tires and camera.
 # Their reflection must start below the bumper, not at a guessed wheel line.
 frontal=a.view in ("front","rear") and cw/ch>1.05
 gap_px=round(H*a.reflection_gap) if frontal else 0
 if a.floor_reflection!="off":
  anchors=sorted(points)
  (x1,y1),(x2,y2)=anchors[0],anchors[-1]
  if x2==x1:raise ValueError("Wheel contacts must have different x coordinates")
  opacity=215 if a.floor_reflection=="water_mirror" else 42
  refl=Image.new("RGBA",(W,H),(0,0,0,0))
  for col in range(cw):
   gx=x+col
   (x1,y1),(x2,y2)=next(((l,r) for l,r in zip(anchors,anchors[1:]) if gx<=r[0]),(anchors[-2],anchors[-1]))
   t=max(0.,min(1.,(gx-x1)/(x2-x1)))
   axis=round(y1+(y2-y1)*t)+gap_px
   if frontal:axis=max(axis,y+ch+gap_px)
   # For head-on views the bumper is visible but the tire sidewalls are not.
   # Mirror the original pixels; do not hallucinate new wheels in this pass.
   local_axis=(ch-1) if frontal else max(0,min(ch-1,axis-y))
   available=H-axis
   if available<2 or local_axis<2:continue
   # The pixel immediately above the contact line is the first reflected
   # pixel below it. Do not flip the entire car about a different baseline.
   strip=car.crop((col,0,col+1,local_axis+1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
   length=max(1,min(available,round(strip.height*(.68 if frontal else .82))))
   strip=strip.resize((1,length),Image.Resampling.BICUBIC)
   fa=strip.getchannel("A")
   fade=Image.new("L",(1,length),0)
   for rr in range(length):
    fade.putpixel((0,rr),round(opacity*(1-rr/max(1,length-1))**1.45))
   strip.putalpha(ImageChops.multiply(fa,fade))
   refl.paste(strip,(gx,axis))
  # In head-on views the photographed wheels may be hidden by the body.
  # Add subtle schematic tire silhouettes ONLY inside the reflection,
  # never on the original vehicle. These are placeholders, not reconstructed rims.
  if frontal and a.floor_reflection=="water_mirror":
   tire_layer=Image.new("RGBA",(W,H),(0,0,0,0))
   td=ImageDraw.Draw(tire_layer)
   tire_top=max(y+ch+gap_px, floor_seam+1)
   tire_h=min(round(H*.07),max(0,H-tire_top-3))
   if tire_h>=9:
    for center in (x+round(cw*.145),x+round(cw*.855)):
     rx=max(5,round(cw*.052))
     td.ellipse((center-rx,tire_top,center+rx,tire_top+tire_h),fill=(12,15,19,112))
     td.ellipse((center-round(rx*.48),tire_top+round(tire_h*.16),center+round(rx*.48),tire_top+round(tire_h*.72)),fill=(76,81,85,52))
    tire_layer=tire_layer.filter(ImageFilter.GaussianBlur(max(2,round(W*.002))))
    refl=Image.alpha_composite(refl,tire_layer)
  refl=refl.filter(ImageFilter.GaussianBlur(max(2,round(W*(.0015 if a.floor_reflection=="water_mirror" else .004)))))
  refl.putalpha(ImageChops.multiply(refl.getchannel("A"),floor_mask))
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
 "method":"fixed_background_perspective_contact_shadows_v5","view":a.view,
 "background_preserved":True,"floor_contact_all_on_floor":all(py>=floor_seam for px,py in points),"floor_plane_masked":True,"frontal_reflection_gap_px":gap_px,"floor_seam_y":floor_seam,"profile_width_target":target_width,"vehicle_bbox":[x,y,x+cw,y+ch],
 "estimated_contact_points":points,"wheel_contacts_used":len(points),"third_contact_missing":len(points)<3 and a.view in ("front","rear"),"calibration_file_used":bool(a.calibration),"floor_reflection":a.floor_reflection,"reflection_geometry":"per_column_interpolated_wheel_contact","ground_drop":a.ground_drop,"reflection_visible_pixels":H-reflection_start,"vehicle_width_fraction":round(cw/W,3),"composition_preset":"lower_vehicle_three_wheel_water_mirror","contact_shadow_anchored_per_wheel":True,"assumed_front_floor_y":baseline,
 "frontal_reflected_side_wheels_synthesized":frontal and a.floor_reflection=="water_mirror","wheel_reflection_type":"schematic_unverified","wheel_ground_contact_verified":calibrated and (len(points)==3 if a.view in ("front","rear") else True),"logo_visibility_verified":False,
 "notes":["Contact zones estimated from alpha; not tire geometry","No generative modification of approved background","Inspect contact shadows and source tire pixels before approval"]}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Candidate:",candidate,"contacts:",points,"publication blocked pending visual QA")
if __name__=="__main__":main()
