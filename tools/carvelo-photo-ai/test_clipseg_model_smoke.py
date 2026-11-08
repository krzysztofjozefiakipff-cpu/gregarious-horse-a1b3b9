"""One-time compatibility smoke: CLIPSeg loads and segments a public sample.

This tests model execution, NOT production-quality glazing localization.
No photos from Supabase are accessed.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from interior_windows import infer_window_probability, UnsafeWindowMask, conservative_window_mask

base=Path(__file__).resolve().parents[2]
sample=base/"assets/carvelo-hero-v3.webp"
if not sample.exists():
    raise SystemExit("Missing public CARVELO sample file")
with Image.open(sample) as raw:
    img=raw.convert("RGB")
    img.thumbnail((512,512))
a,b=infer_window_probability(img)
assert a.shape==(img.height,img.width)
assert b.shape==a.shape
assert np.isfinite(a).all() and np.isfinite(b).all()
assert float(a.min())>=0 and float(a.max())<=1
assert float(b.min())>=0 and float(b.max())<=1
try:
    mask=conservative_window_mask(a,b,img.size)
    status="proposal_requires_visual_review"
except UnsafeWindowMask as exc:
    status="safe_fallback:"+str(exc).split(":")[0]
print("CLIPSEG_MODEL_SMOKE_PASS",img.size,status)
