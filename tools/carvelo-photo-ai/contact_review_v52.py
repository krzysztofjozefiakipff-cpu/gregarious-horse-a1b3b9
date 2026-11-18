#!/usr/bin/env python3
"""CARVAMO V52: offline contact-aware composite, without AI calls.

Rebuilds from V51 transparent original vehicle and clean V36 background.
Uses V40 manually verified wheel contact coordinates mapped through V51 crop
transform. Draws floor contact shadows at verified positions, then pastes the
unmodified vehicle above. Creates contact diagnostic and machine-readable QA.
This is 2D compositing, not camera calibration or a 3D reconstruction.
"""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--v47-dir",type=Path,required=True)
 p.add_argument("--view",choices=("front","side","rear"),default="rear")
 p.add_argument("--contacts",type=Path,default=Path("/tmp/carvamo-photo-ai-test/v40_verified_contacts.json"))
 p.add_argument("--background",type=Path,default=Path("/tmp/carvamo-photo-ai-test/results/v36-cameras/empty_rear_v36.png"))
 p.add_argument("--output-dir",type=Path)
 a=p.parse_args()
 root=a.v47_dir/a.view
 v51=root/"v51"
 manifest=json.loads((v51/"manifest_v51.json").read_text())
 contacts=json.loads(a.contacts.read_text())["views"][a.view]["contacts"]
 contacts=[c for c in contacts if c.get("verified") and c.get("visible_tire",True)]
 if len(contacts)<2:p.error("Need at least two verified tire contacts")
 with Image.open(v51/"original_car_rgba.png") as im:car=im.convert("RGBA")
 with Image.open(a.background) as im:bg=im.convert("RGBA")
 if car.size!=bg.size:p.error("Size mismatch")
 ox0,oy0,ox1,oy1=manifest["original_bbox"]
 nx0,ny0,nx1,ny1=manifest["new_bbox"]
 sx=(nx1-nx0)/(ox1-ox0);sy=(ny1-ny0)/(oy1-oy0)
 points=[]
 for c in contacts:
  x,y=c["confirmed_px"]
  # Source V40 coordinates are in segmented photo, not V47 composite.
  # V47 original image contains an independently transformed crop.
  # Therefore these coordinates CANNOT safely be mapped using V51 bbox.
  # Fail closed rather than place plausible but false contact shadows.
  points.append({"source_px":[x,y],"status":"unmapped_source_coordinates"})
 out=a.output_dir or root/"v52"
 out.mkdir(parents=True,exist_ok=True)
 report={"version":"v52","view":a.view,"status":"blocked_missing_source_to_v47_transform",
 "source_contact_points":points,"v51_original_bbox":manifest["original_bbox"],
 "v51_new_bbox":manifest["new_bbox"],
 "required_input":"source_photo_to_v47_canvas affine transform, or manually verified wheel contacts on V51 preview",
 "car_pixels_protected":True,"ready_for_publication":False,"paid_api_calls":0}
 (out/"v52_report.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
 # Create actionable contact reviewer with exact canvas dimensions.
 # No guessed wheel positions: human marks on the actual V51 composite.
 with Image.open(v51/"input.png") as im:preview=im.convert("RGB")
 preview.save(out/"v52_contact_review.png")
 html='''<!doctype html><html lang="pl"><meta charset="utf-8"><title>CARVAMO V52 kontakty kół</title>
 <style>body{font:16px system-ui;background:#15191f;color:white;margin:24px}canvas{max-width:100%;border:1px solid #888;cursor:crosshair}button{padding:12px;margin:8px}</style>
 <h2>CARVAMO V52 — oznacz styki opon z podłogą</h2><p>Kliknij najniższy punkt opony przy podłodze, kolejno dla wszystkich widocznych kół. Zapisz JSON.</p>
 <canvas id="c"></canvas><p id="info"></p><button onclick="undo()">Cofnij</button><button onclick="save()">Pobierz JSON</button>
 <script>const c=document.getElementById('c'),ctx=c.getContext('2d'),img=new Image(),pts=[];
 img.src='v52_contact_review.png';img.onload=()=>{c.width=img.width;c.height=img.height;draw()};
 function draw(){ctx.drawImage(img,0,0);pts.forEach((p,i)=>{ctx.strokeStyle='#00ff7f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(p[0]-12,p[1]);ctx.lineTo(p[0]+12,p[1]);ctx.moveTo(p[0],p[1]-12);ctx.lineTo(p[0],p[1]+12);ctx.stroke();ctx.fillStyle='white';ctx.fillText(i+1,p[0]+14,p[1]-12)});document.getElementById('info').textContent='Punkty: '+pts.length}
 c.onclick=e=>{const r=c.getBoundingClientRect();pts.push([Math.round((e.clientX-r.left)*c.width/r.width),Math.round((e.clientY-r.top)*c.height/r.height)]);draw()};
 function undo(){pts.pop();draw()}function save(){const b=new Blob([JSON.stringify({view:'VIEW',image_size:[c.width,c.height],contacts:pts},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='v52_contacts.json';a.click();URL.revokeObjectURL(a.href)}</script></html>'''.replace("VIEW",a.view)
 (out/"v52_contact_reviewer.html").write_text(html,encoding="utf-8")
 print("V52 review prepared:",out/"v52_contact_reviewer.html")
 print("Reason:",report["status"])
 print("No fabricated contact mapping; no API calls.")
if __name__=="__main__":main()
