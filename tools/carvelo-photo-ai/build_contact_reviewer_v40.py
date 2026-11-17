#!/usr/bin/env python3
"""CARVAMO V40: generate a local interactive V38 wheel-contact reviewer.

Output is a standalone HTML file with embedded source photos. Click two tire
contact points per view, then export a V39-compatible reviewed JSON.
Nothing is uploaded or written to production. Human clicks are NOT proof
of full camera calibration or 3D vehicle pose.
"""
import argparse
import base64
import io
import json
from pathlib import Path
from PIL import Image


def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--v34-report",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    args=p.parse_args()
    report=json.loads(args.v34_report.read_text(encoding="utf-8"))
    views={}
    for name in ("front","side","rear"):
        src=args.results/f"v19-{name}"/"segmented.png"
        with Image.open(src) as im:
            im=im.convert("RGBA")
            size=list(im.size)
            out=io.BytesIO()
            # Opaque neutral background makes contact pixels easier to see.
            bg=Image.new("RGBA",im.size,(226,226,226,255))
            bg.alpha_composite(im)
            bg.convert("RGB").save(out,format="JPEG",quality=90)
        candidates=report["views"][name]["contacts"]
        if len(candidates)!=2:
            raise ValueError(f"Expected two wheel candidates: {name}")
        views[name]={"image":"data:image/jpeg;base64,"+
                     base64.b64encode(out.getvalue()).decode("ascii"),
                     "size":size,
                     "contacts":[{"wheel_index":i,
                                  "candidate_px":[c.get("candidate_x"),c.get("candidate_y")],
                                  "confirmed_px":None,
                                  "verified":False,
                                  "visible_tire":None,
                                  "comment":""}
                                 for i,c in enumerate(candidates)]}
    payload=json.dumps({"schema_version":"v38.1","views":views},ensure_ascii=False)
    html=r"""<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>CARVAMO — weryfikacja styku opon V40</title>
<style>body{font:16px system-ui;margin:24px auto;max-width:1050px;color:#17212e}
h1{font-size:25px}p{line-height:1.45}.view{margin:25px 0;padding:15px;border:1px solid #ccd3db;border-radius:12px}
canvas{max-width:100%;height:auto;cursor:crosshair;background:#ddd}
button{padding:10px 16px;margin:5px;border:1px solid #999;border-radius:8px;cursor:pointer}
label{display:inline-block;margin:8px 14px 8px 0}.hint{color:#6a5660}
</style></head><body>
<h1>CARVAMO — weryfikacja punktów styku opon</h1>
<p>Kliknij dokładnie dolny punkt widocznej opony, w którym stykałaby się z podłożem.
Wybierz koło 1 lub 2. Jeżeli koło nie jest widoczne albo nie można ocenić styku,
pozostaw je jako niezweryfikowane. Pomarańczowe kółka oznaczają propozycje AI,
zielone krzyżyki — Twoje wskazania.</p>
<div id="views"></div>
<button id="save">Pobierz v40_verified_contacts.json</button>
<p class="hint">Zapis jest lokalny. Punkty 2D nie potwierdzają perspektywy ani geometrii 3D.</p>
<script>
const data=__DATA__;
const root=document.getElementById('views');
for(const [name,v] of Object.entries(data.views)){
 const section=document.createElement('section');section.className='view';
 const heading=document.createElement('h2');heading.textContent=name.toUpperCase();section.append(heading);
 const picker=document.createElement('div');
 picker.innerHTML='<label>Wybierz koło: <select><option value="0">Koło 1</option><option value="1">Koło 2</option></select></label><span class="status"></span>';
 section.append(picker);
 const select=picker.querySelector('select'),status=picker.querySelector('.status');
 const canvas=document.createElement('canvas');canvas.width=v.size[0];canvas.height=v.size[1];section.append(canvas);
 const ctx=canvas.getContext('2d'),im=new Image();
 function draw(){
  if(!im.complete||!im.naturalWidth)return;
  ctx.drawImage(im,0,0,canvas.width,canvas.height);
  v.contacts.forEach((c,i)=>{
   const [x,y]=c.candidate_px;
   if(Number.isFinite(x)&&Number.isFinite(y)){ctx.strokeStyle='#ff8900';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.stroke();}
   if(c.verified&&c.confirmed_px){
    const [px,py]=c.confirmed_px;ctx.strokeStyle='#00bb48';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(px-16,py);ctx.lineTo(px+16,py);ctx.moveTo(px,py-16);ctx.lineTo(px,py+16);ctx.stroke();
   }
  });
  status.textContent=v.contacts.filter(c=>c.verified).length+'/2 potwierdzono';
 }
 im.onload=draw;im.src=v.image;
 canvas.addEventListener('click',event=>{
  const rect=canvas.getBoundingClientRect();
  const x=Math.round((event.clientX-rect.left)*canvas.width/rect.width);
  const y=Math.round((event.clientY-rect.top)*canvas.height/rect.height);
  const c=v.contacts[Number(select.value)];
  c.confirmed_px=[x,y];c.verified=true;c.visible_tire=true;draw();
 });
 const controls=document.createElement('div');
 const clear=document.createElement('button');clear.textContent='Cofnij wskazanie wybranego koła';
 clear.onclick=()=>{const c=v.contacts[Number(select.value)];c.confirmed_px=null;c.verified=false;c.visible_tire=null;draw();};
 const invisible=document.createElement('button');invisible.textContent='Koło niewidoczne / niepewne';
 invisible.onclick=()=>{const c=v.contacts[Number(select.value)];c.confirmed_px=null;c.verified=false;c.visible_tire=false;draw();};
 controls.append(clear,invisible);section.append(controls);root.append(section);
}
document.getElementById('save').onclick=()=>{
 const result={schema_version:data.schema_version,
  purpose:'Human-reviewed 2D tire contacts, not calibrated 3D pose',
  views:{}};
 for(const [name,v] of Object.entries(data.views)){
  result.views[name]={image_size:v.size,contacts:v.contacts};
 }
 const blob=new Blob([JSON.stringify(result,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='v40_verified_contacts.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};
</script></body></html>"""
    html=html.replace("__DATA__",payload.replace("</","<\\/"))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(html,encoding="utf-8")
    print("Standalone reviewer:",args.output)
    print("No upload, no automatic verification, no production changes")


if __name__=="__main__":
    main()
