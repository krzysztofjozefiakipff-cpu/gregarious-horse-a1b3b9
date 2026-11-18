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
 p.add_argument("--camera-angle",choices=["straight","three_quarter","side"],default="straight")
 p.add_argument("--floor-reflection",choices=["water_mirror","subtle","off"],default="water_mirror")
 p.add_argument("--reflection-gap",type=float,default=.025,help="Front/rear visual gap between bumper and first reflection")
 p.add_argument("--floor-seam-y",type=float,default=.705,help="Top edge of visible showroom floor as fraction of image height")
 p.add_argument("--tilt-degrees",type=float,default=None,help="Optional verified in-plane correction, max +/- 3 degrees; otherwise conservative side-view leveling")
 p.add_argument("--ground-drop",type=float,default=.075,help="Move car and its contact-linked reflection down as a unit")
 a=p.parse_args()
 if not .35<=a.car_width<=.8 or not .68<=a.floor_y<=.92 or not .55<=a.floor_seam_y<=.85 or not 0<=a.ground_drop<=.10:raise ValueError("Invalid composition settings")
 out=Path(a.output_dir);out.mkdir(parents=True,exist_ok=True)
 bg=Image.open(a.background).convert("RGB");W,H=bg.size
 source=Image.open(a.vehicle).convert("RGBA")
 bb=source.getchannel("A").point(lambda v:255 if v>=32 else 0).getbbox()
 if not bb:raise ValueError("Missing vehicle transparency")
 car=source.crop(bb)
 target_width=.84 if a.camera_angle=="side" or a.view in ("left","right") else (.82 if a.camera_angle=="three_quarter" else .74)
 scale=min(W*target_width/car.width,H*(.68 if a.view in ("left","right") else .70)/car.height)
 # Permit modest upscaling for showroom framing; flag image quality for visual QA.
 scale=min(scale,1.18)
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
 # Three-quarter photos have two reliable visible wheel regions. The outer
 # third silhouette band usually samples a bumper/body corner, not a tire;
 # its artificially high contact forced extreme downscaling.
 selected_bands=bands[a.view][:2] if a.camera_angle=="three_quarter" else bands[a.view]
 contacts_local=[]
 for band in selected_bands:
  try:contacts_local.append(tire_contact(*band))
  except ValueError:
   if len(selected_bands)<=2:raise
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
 if len(contacts_local)<2:raise ValueError("At least two wheel contacts are required")
 if any(abs(q[0]-r[0])<cw*.06 for i,q in enumerate(contacts_local) for r in contacts_local[i+1:]):raise ValueError("Wheel contacts overlap")
 # Level only verified/side-view wheel baselines. In perspective views the
 # difference in wheel heights is genuine depth, NOT evidence of roll.
 # Arbitrary rotation of 45-degree photos would make the car less realistic.
 tilt=0.0
 if a.tilt_degrees is not None:
  if not calibrated:raise ValueError("Manual tilt requires verified wheel calibration")
  if abs(a.tilt_degrees)>3:raise ValueError("Tilt exceeds safe +/-3 degree limit")
  tilt=a.tilt_degrees
 elif a.camera_angle=="side" and len(contacts_local)==2:
  left,right=sorted(contacts_local)
  tilt=max(-2.5,min(2.5,math.degrees(math.atan2(right[1]-left[1],right[0]-left[0]))))
 if abs(tilt)>.05:
  old_w,old_h=car.size
  # Pillow positive rotation is counterclockwise in image coordinates.
  # Rotating by the measured slope makes the side-view wheel line level.
  car=car.rotate(tilt,Image.Resampling.BICUBIC,expand=True)
  new_w,new_h=car.size
  cx,cy=(old_w-1)/2,(old_h-1)/2
  nx,ny=(new_w-1)/2,(new_h-1)/2
  rad=math.radians(tilt)
  contacts_local=[(round(nx+(px-cx)*math.cos(rad)+(py-cy)*math.sin(rad)),
                   round(ny-(px-cx)*math.sin(rad)+(py-cy)*math.cos(rad)))
                  for px,py in contacts_local]
  cw,ch=car.size;x=(W-cw)//2;alpha=car.getchannel("A")
 # Position the car from its roof and visible tire contacts, not from a
 # reflection reserve. The approved showroom/logo remain completely unchanged.
 # A wheel farther from the camera may touch the floor higher in the image.
 floor_seam=round(H*a.floor_seam_y)
 roof_clearance=round(H*.295)  # immediately below the CARVAMO logo/tagline
 min_far_contact=floor_seam+round(H*.030)
 preferred_near_contact=round(H*.845)
 bottom_margin=round(H*.012)
 def fit_position():
  nearest=max(yy for xx,yy in contacts_local)
  farthest=min(yy for xx,yy in contacts_local)
  # Do not let the roof overlap the logo or a visible tire enter the wall.
  lower=max(roof_clearance,min_far_contact-farthest)
  upper=H-bottom_margin-ch
  ideal=preferred_near_contact-nearest
  return lower,upper,max(lower,ideal)
 lower,upper,desired=fit_position()
 if lower>upper:
  # Preserve the requested framing wherever possible; only scale when
  # the cutout cannot fit between the logo and bottom of the photograph.
  factor=(H-bottom_margin-roof_clearance)/max(1,ch)
  if factor<=0 or factor>=1:raise ValueError("Cannot fit car under logo")
  old_cw,old_ch=cw,ch
  car=car.resize((max(1,round(cw*factor*.985)),max(1,round(ch*factor*.985))),Image.Resampling.LANCZOS)
  cw,ch=car.size;alpha=car.getchannel("A");x=(W-cw)//2
  contacts_local=[(min(cw-1,round(xx*cw/old_cw)),min(ch-1,round(yy*ch/old_ch))) for xx,yy in contacts_local]
  lower,upper,desired=fit_position()
 if lower>upper:
  raise ValueError("Wheel-floor and roof-logo constraints conflict; calibration required")
 y=min(upper,desired)
 baseline=y+max(yy for xx,yy in contacts_local)
 points=[(x+xx,y+yy) for xx,yy in contacts_local]
 scene=bg.convert("RGBA")
 floor_mask=Image.new("L",(W,H),0)
 ImageDraw.Draw(floor_mask).rectangle((0,floor_seam,W,H),fill=255)
 # Perspective-aware, multi-scale contact shadows. The rear tire lies higher
 # in image coordinates; its shadow must be anchored to its OWN contact point.
 contact_mask=Image.new("L",(W,H),0)
 d=ImageDraw.Draw(contact_mask)
 for i,(px,py) in enumerate(points):
  rx=round(cw*(.032 if a.camera_angle=="side" else .024))
  ry=max(3,round(rx*.28))
  d.ellipse((px-rx,py-ry,px+rx,py+ry),fill=175)
 contact_mask=contact_mask.filter(ImageFilter.GaussianBlur(max(3,round(W*.003))))
 # Long diffuse shadow beneath chassis, lighter than the contact patches.
 diffuse=Image.new("L",(W,H),0);d=ImageDraw.Draw(diffuse)
 fx=min(px for px,py in points);rx=max(px for px,py in points)
 fy=min(py for px,py in points);ry=max(py for px,py in points)
 d.ellipse((min(fx,rx)-round(cw*.11),min(fy,ry)-round(ch*.05),
            max(fx,rx)+round(cw*.11),max(fy,ry)+round(ch*.07)),fill=52)
 diffuse=diffuse.filter(ImageFilter.GaussianBlur(max(12,round(W*.018))))
 combined=ImageChops.multiply(ImageChops.lighter(contact_mask,diffuse),floor_mask)
 shadow=Image.new("RGBA",(W,H),(0,0,0,0));shadow.putalpha(combined)
 scene=Image.alpha_composite(scene,shadow)
 # Restore the approved JAECOO 8-style soft water reflection.
 # A single uniform mirror transform preserves vehicle/wheel geometry.
 # The floor mask and canvas clip any part beyond the visible floor.
 reflection_start=max(py for px,py in points)
 gap_px=0
 if a.floor_reflection!="off" and reflection_start<H-2:
  local_axis=max(0,min(ch-1,reflection_start-y))
  mirrored=car.crop((0,0,cw,local_axis+1)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
  visible=H-reflection_start
  reflected_height=min(visible,max(1,round(mirrored.height*.64)))
  if reflected_height>1:
   mirrored=mirrored.resize((cw,reflected_height),Image.Resampling.BICUBIC)
   opacity=105 if a.floor_reflection=="water_mirror" else 28
   fade=Image.new("L",(cw,reflected_height),0)
   painter=ImageDraw.Draw(fade)
   for rr in range(reflected_height):
    painter.line((0,rr,cw,rr),fill=round(opacity*(1-rr/max(1,reflected_height-1))**1.45))
   mirrored.putalpha(ImageChops.multiply(mirrored.getchannel("A"),fade))
   refl=Image.new("RGBA",(W,H),(0,0,0,0))
   refl.paste(mirrored,(x,reflection_start))
   refl=refl.filter(ImageFilter.GaussianBlur(max(2,round(W*.0025))))
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
 "method":"wheel_aware_conservative_tilt_v9","view":a.view,
 "background_preserved":True,"floor_contact_all_on_floor":all(py>=floor_seam for px,py in points),"floor_plane_masked":True,"frontal_reflection_gap_px":gap_px,"floor_seam_y":floor_seam,"profile_width_target":target_width,"visual_qa_required_for_upscaling":True,"vehicle_bbox":[x,y,x+cw,y+ch],
 "estimated_contact_points":points,"wheel_contacts_used":len(points),"third_contact_missing":len(points)<3 and a.camera_angle=="straight" and a.view in ("front","rear"),"calibration_file_used":bool(a.calibration),"floor_reflection":a.floor_reflection,"reflection_geometry":"single_uniform_compressed_mirror_clipped_to_floor","ground_drop":a.ground_drop,"reflection_visible_pixels":H-reflection_start,"vehicle_width_fraction":round(cw/W,3),"composition_preset":"logo_clearance_and_visible_wheel_floor","camera_angle":a.camera_angle,"tilt_degrees_applied":round(tilt,3),"contact_shadow_anchored_per_wheel":True,"estimated_contacts_not_verified":not calibrated,"assumed_front_floor_y":baseline,
 "frontal_reflected_side_wheels_synthesized":False,"wheel_reflection_type":"source_pixels_only","wheel_ground_contact_verified":calibrated and (len(points)==3 if a.camera_angle=="straight" and a.view in ("front","rear") else True),"logo_visibility_verified":False,
 "notes":["Reflection follows approved JAECOO 8 soft mirror reference","Roof kept below logo; visible contacts kept on showroom floor","Three-quarter views exclude misleading outer bumper silhouette contact","Contact zones estimated from alpha; not tire geometry","No generative modification of approved background","Inspect contact shadows and source tire pixels before approval"]}
 (out/"qa.json").write_text(json.dumps(qa,indent=2),encoding="utf-8")
 print("Candidate:",candidate,"contacts:",points,"publication blocked pending visual QA")
if __name__=="__main__":main()
