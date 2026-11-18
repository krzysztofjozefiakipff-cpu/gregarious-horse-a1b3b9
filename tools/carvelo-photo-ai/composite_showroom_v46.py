#!/usr/bin/env python3
"""CARVAMO V46 offline shadow experiment; source photos and portal unchanged.
Only two V40-verified contacts per view. Explicitly ignores erroneous V44
front bumper annotation and unverified rear extra-wheel annotation.
"""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageOps
from composite_showroom_v42 import valid_contacts

def compose(bg,car,contacts,dest,view,shadow_strength):
    bg=bg.convert("RGBA");car=car.convert("RGBA")
    bw,bh=bg.size
    bounds=car.getchannel("A").point(lambda a:255 if a>=25 else 0).getbbox()
    if bounds is None:raise ValueError("Empty alpha")
    left,top,right,bottom=bounds;sw=right-left;sh=bottom-top
    scale=min(bw*.78/sw,bh*.77/sh)
    nw,nh=round(sw*scale),round(sh*scale)
    dx=(bw-nw)//2
    dy=round(bh*.85-(max(y for x,y in contacts)-top)*scale)
    dy=max(0,min(dy,bh-nh))
    anchors=[(dx+(x-left)*scale,dy+(y-top)*scale) for x,y in contacts]
    if any(not(0<=x<bw and 0<=y<bh) for x,y in anchors):
        raise ValueError("Contact outside canvas")
    # Shadow is painted on background BEFORE the untouched car RGBA is pasted.
    # Three separate translucent masks: tight contacts, soft ambient,
    # restrained underbody; no inferred third contact.
    masks=[]
    tight=Image.new("L",(bw,bh),0);td=ImageDraw.Draw(tight)
    ambient=Image.new("L",(bw,bh),0);ad=ImageDraw.Draw(ambient)
    for x,y in anchors:
        rx=max(9,min(nw*.047,bw*.065))
        ry=max(3,min(nh*.015,bh*.015))
        td.ellipse((x-rx,y-ry*.45,x+rx,y+ry*.8),fill=210)
        ad.ellipse((x-rx*1.65,y-ry*2,x+rx*1.65,y+ry*2.5),fill=92)
    masks.append((tight,max(1,round(bw*.0015))))
    masks.append((ambient,max(5,round(bw*.008))))
    (x1,y1),(x2,y2)=sorted(anchors)
    if abs(x2-x1)>bw*.09:
        body=Image.new("L",(bw,bh),0);bd=ImageDraw.Draw(body)
        for j in range(1,20):
            t=j/20
            x=x1+(x2-x1)*t;y=y1+(y2-y1)*t
            bd.ellipse((x-nw*.032,y-bh*.006,x+nw*.032,y+bh*.006),fill=55)
        masks.append((body,max(5,round(bw*.007))))
    shadow=Image.new("RGBA",(bw,bh),(0,0,0,0))
    for mask,blur in masks:
        alpha=mask.filter(ImageFilter.GaussianBlur(blur))
        alpha=alpha.point(lambda v:round(v*shadow_strength))
        layer=Image.new("RGBA",(bw,bh),(0,0,0,0))
        layer.putalpha(alpha)
        shadow=Image.alpha_composite(shadow,layer)
    base=Image.alpha_composite(bg,shadow)
    fg=car.crop(bounds).resize((nw,nh),Image.Resampling.LANCZOS)
    layer=Image.new("RGBA",(bw,bh),(0,0,0,0))
    layer.alpha_composite(fg,(dx,dy))
    result=Image.alpha_composite(base,layer)
    dest.parent.mkdir(parents=True,exist_ok=True)
    result.convert("RGB").save(dest,quality=94)
    return {"view":view,"contacts_px":[[round(x,2),round(y,2)] for x,y in anchors],
            "shadow_strength":shadow_strength,"extra_wheel_annotation_used":False,
            "vehicle_pixels_unchanged_except_uniform_resampling":True,
            "camera_calibrated":False,"physically_correct_shadow":False,
            "ready_for_automatic_publication":False}

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--results",type=Path,required=True)
    p.add_argument("--review",type=Path,required=True)
    p.add_argument("--background-dir",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    review=json.loads(a.review.read_text(encoding="utf-8"))
    report={"status":"offline_A_B_preview","ready_for_automatic_publication":False,
            "v44_extra_annotations_used":False,"views":{}}
    sheet=Image.new("RGB",(1280,1080),"white")
    for idx,name in enumerate(("front","side","rear")):
        with Image.open(a.results/f"v19-{name}"/"segmented.png") as car, Image.open(a.background_dir/f"empty_{name}_v36.png") as bg:
            contacts=valid_contacts(review["views"][name],car.size)
            report["views"][name]={}
            for j,(variant,strength) in enumerate((("soft",.75),("grounded",1.25))):
                dest=a.output/f"{name}_v46_{variant}.jpg"
                report["views"][name][variant]=compose(bg,car,contacts,dest,name,strength)
                with Image.open(dest) as im:
                    tile=ImageOps.contain(im.convert("RGB"),(640,360),Image.Resampling.LANCZOS)
                sheet.paste(tile,(j*640+(640-tile.width)//2,idx*360+(360-tile.height)//2))
                ImageDraw.Draw(sheet).text((j*640+12,idx*360+12),f"V46 {name.upper()} {variant.upper()}",fill="white",stroke_width=2,stroke_fill="black")
        print(name,"soft + grounded previews complete")
    a.output.mkdir(parents=True,exist_ok=True)
    sheet.save(a.output/"v46_shadow_comparison.jpg",quality=93)
    (a.output/"v46_manifest.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print("Offline previews generated. No server/portal production changes.")

if __name__=="__main__":main()
