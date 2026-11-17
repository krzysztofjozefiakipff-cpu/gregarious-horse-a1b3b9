#!/usr/bin/env python3
"""Conservative BRIA-assisted relighting. Keeps original car RGBA geometry and studio unchanged."""
import argparse,json,math
from pathlib import Path
from PIL import Image,ImageStat,ImageEnhance

def main():
 p=argparse.ArgumentParser()
 p.add_argument("--original",required=True);p.add_argument("--bria",required=True)
 p.add_argument("--output",required=True);p.add_argument("--report",required=True)
 a=p.parse_args()
 original=Image.open(a.original).convert("RGBA")
 reference=Image.open(a.bria).convert("RGB")
 # BRIA's generated background is never composited. Measure ONLY a conservative
 # central region of its output as an approximate lighting reference.
 w,h=reference.size
 crop=reference.crop((int(w*.28),int(h*.32),int(w*.75),int(h*.72)))
 target=ImageStat.Stat(crop).mean[:3]
 rgba=original.split();rgb=original.convert("RGB")
 mask=rgba[3].point(lambda v:255 if v>=200 else 0)
 source=ImageStat.Stat(rgb,mask=mask).mean[:3]
 # Small, bounded adjustments avoid introducing false paint colour and details.
 gains=[max(.94,min(1.06,(target[i]+30)/(source[i]+30))) for i in range(3)]
 lut=[[max(0,min(255,round(v*g))) for v in range(256)] for g in gains]
 channels=rgb.split()
 adjusted=Image.merge("RGB",tuple(channels[i].point(lut[i]) for i in range(3)))
 adjusted.putalpha(rgba[3])
 Path(a.output).parent.mkdir(parents=True,exist_ok=True)
 adjusted.save(a.output)
 report={"status":"AWAITING_VISUAL_QA","ready_for_publication":False,
  "method":"bounded_bria_reference_color_transfer","channel_gains":gains,
  "original_alpha_preserved":True,"original_vehicle_geometry_preserved":True,
  "bria_generated_background_used":False,
  "warning":"BRIA scene-wide statistics are not a physical lighting model; visually inspect paint color."}
 Path(a.report).parent.mkdir(parents=True,exist_ok=True)
 Path(a.report).write_text(json.dumps(report,indent=2),encoding="utf-8")
 print("BRIA lighting reference applied conservatively; original alpha preserved.")
if __name__=="__main__":main()
