#!/usr/bin/env python3
"""CARVAMO V2 acceptance gates. Visual acceptance remains a human review."""
import argparse
import json
from pathlib import Path
from PIL import Image
import numpy as np

p=argparse.ArgumentParser()
p.add_argument("--image",required=True)
p.add_argument("--scene-qa",required=True)
p.add_argument("--output",required=True)
a=p.parse_args()
im=Image.open(a.image).convert("RGB")
arr=np.asarray(im,dtype=np.float32)
h,w=arr.shape[:2]
bands=[arr[i*h//3:(i+1)*h//3] for i in range(3)]
medians=[np.median(b,axis=(0,1)).round().astype(int).tolist() for b in bands]
luminance=np.dot(arr,[.2126,.7152,.0722])
upper=luminance[:h//3]
scene=json.loads(Path(a.scene_qa).read_text())
checks={
 "G1_png_dimensions":w==1280 and h==720,
 "G2_not_overexposed":float(np.median(luminance))<105,
 "G2_bright_ceiling_rails":float(np.mean(upper>190))>.008,
 "G2_dark_floor":float(np.median(luminance[2*h//3:]))<95,
 "G3_canonical_logo_present":bool(scene.get("official_logo_included")),
}
result={
 "reference":"CARVAMO accepted 1536x865 reference image, supplied in conversation",
 "scene_profile":scene.get("scene_profile"),
 "image":a.image,
 "image_dimensions":[w,h],
 "band_median_rgb":medians,
 "reference_band_median_rgb":[[38,77,84],[8,52,61],[29,64,72]],
 "checks":checks,
 "G4_visual_comparison":"PENDING — requires actual side-by-side inspection",
 "ready_for_vehicle_compositing":False,
 "acceptance":"REJECTED" if not all(checks.values()) else "AWAITING_VISUAL_REVIEW",
 "notes":"Reference includes vehicle; band medians are diagnostics, not pixel-match targets."
}
Path(a.output).write_text(json.dumps(result,indent=2,ensure_ascii=False))
print(json.dumps(result,indent=2,ensure_ascii=False))
