#!/usr/bin/env python3
"""CARVAMO V44: local review of extra/occluded wheel and underbody.

Standalone HTML annotator over V43 QA images. Two V40 verified wheel
contacts are displayed as reference. Optional third wheel marking is
explicitly HUMAN reviewed, not an automatic wheel detector. Does not
alter vehicle imagery or production.
"""
import argparse,base64,json
from pathlib import Path
from PIL import Image

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--v43-dir",type=Path,required=True)
    p.add_argument("--v42-manifest",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    manifest=json.loads(a.v42_manifest.read_text(encoding="utf-8"))
    data={}
    for name in ("front","side","rear"):
        path=a.v43_dir/f"{name}_v43_contact_overlay.jpg"
        with Image.open(path) as im:
            w,h=im.size
        data[name]={"image":"data:image/jpeg;base64,"+base64.b64encode(path.read_bytes()).decode(),
                    "size":[w,h],
                    "known_contacts":manifest["views"][name]["wheel_contacts_px"],
                    "additional_wheel":{"status":"not_reviewed","center_px":None,
                                        "bottom_px":None,"notes":""}}
    payload=json.dumps(data,ensure_ascii=False).replace("</","<\\/")
    html=r'''<!doctype html><html lang="pl"><meta charset="utf-8">
<title>CARVAMO V44 — dodatkowe koło</title>
<style>body{font:16px system-ui;max-width:1100px;margin:24px auto;color:#202b36}
section{padding:16px;margin:20px 0;border:1px solid #ccd3df;border-radius:12px}
canvas{width:100%;height:auto;cursor:crosshair}
button,select{padding:9px;margin:6px}p{line-height:1.5}</style>
<h1>CARVAMO V44 — kontrola dodatkowego koła</h1>
<p>Na każdym ujęciu oceń, czy oprócz dwóch zielonych punktów istnieje widoczne
trzecie koło (np. pod tylnym zderzakiem). Jeśli tak, wybierz kolejno środek koła
i jego najniższy widoczny punkt. Jeśli nie, wybierz „Brak dodatkowego koła”.
Nie zgaduj niewidocznych punktów.</p>
<div id="views"></div><button id="save">Pobierz v44_extra_wheel_review.json</button>
<script>
const views=__DATA__;
for(const [name,v] of Object.entries(views)){
 const s=document.createElement('section');const h=document.createElement('h2');
 h.textContent=name.toUpperCase();s.append(h);
 const sel=document.createElement('select');
 sel.innerHTML='<option value="center">Zaznacz środek dodatkowego koła</option><option value="bottom">Zaznacz najniższy widoczny punkt</option>';
 s.append(sel);
 const c=document.createElement('canvas');c.width=v.size[0];c.height=v.size[1];s.append(c);
 const ctx=c.getContext('2d'),img=new Image();const w=v.additional_wheel;
 function draw(){
  if(!img.complete||!img.naturalWidth)return;
  ctx.drawImage(img,0,0,c.width,c.height);
  for(const [key,color] of [['center_px','#00aaff'],['bottom_px','#ffab00']]){
   const pt=w[key];if(!pt)continue;
   ctx.strokeStyle=color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(pt[0],pt[1],12,0,2*Math.PI);ctx.stroke();
   ctx.beginPath();ctx.moveTo(pt[0]-16,pt[1]);ctx.lineTo(pt[0]+16,pt[1]);ctx.moveTo(pt[0],pt[1]-16);ctx.lineTo(pt[0],pt[1]+16);ctx.stroke();
  }
 }
 img.onload=draw;img.src=v.image;
 c.onclick=e=>{
  const r=c.getBoundingClientRect();
  const x=Math.round((e.clientX-r.left)*c.width/r.width);
  const y=Math.round((e.clientY-r.top)*c.height/r.height);
  w[sel.value+'_px']=[x,y];
  w.status=(w.center_px&&w.bottom_px)?'human_marked':'incomplete';
  draw();
 };
 const none=document.createElement('button');none.textContent='Brak dodatkowego koła';
 none.onclick=()=>{w.status='not_visible';w.center_px=null;w.bottom_px=null;draw();};
 const unsure=document.createElement('button');unsure.textContent='Nie da się ocenić';
 unsure.onclick=()=>{w.status='uncertain';w.center_px=null;w.bottom_px=null;draw();};
 const reset=document.createElement('button');reset.textContent='Wyczyść';
 reset.onclick=()=>{w.status='not_reviewed';w.center_px=null;w.bottom_px=null;draw();};
 s.append(none,unsure,reset);document.getElementById('views').append(s);
}
document.getElementById('save').onclick=()=>{
 const out={schema_version:'v44.0',purpose:'Manual annotation of extra visible wheel; not camera calibration',views:{}};
 for(const [name,v] of Object.entries(views)){
  out.views[name]={image_size:v.size,known_contacts_px:v.known_contacts,
                    additional_wheel:v.additional_wheel};
 }
 const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='v44_extra_wheel_review.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
</script></html>'''
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(html.replace("__DATA__",payload),encoding="utf-8")
    print("V44 reviewer:",a.output)
    print("Manual extra-wheel review only; production unchanged")

if __name__=="__main__":
    main()
