"""CARVELO: synthetic-photo memory and time benchmark. No customer images or credentials."""
import argparse
import gc
import json
import os
import resource
import sys
import time
from io import BytesIO

from PIL import Image, ImageDraw

def memory_mb():
    # Linux ru_maxrss is in KiB, includes Python + native libraries.
    return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)

def synthetic_photo():
    image = Image.new("RGB", (768, 432), (100, 105, 110))
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 305, 768, 432), fill=(68, 72, 75))
    draw.rounded_rectangle((115, 165, 650, 355), radius=60, fill=(160, 170, 185))
    draw.ellipse((195, 318, 300, 413), fill=(20, 20, 22))
    draw.ellipse((510, 318, 615, 413), fill=(20, 20, 22))
    return image

def run_exterior():
    from rembg import new_session, remove
    photo = synthetic_photo()
    t0 = time.monotonic()
    session = new_session("u2net")
    t_load = time.monotonic()
    output = remove(photo, session=session, only_mask=True)
    t_done = time.monotonic()
    assert output.size == photo.size
    return {"model":"u2net","load_seconds":round(t_load-t0,2),
            "inference_seconds":round(t_done-t_load,2)}

def run_interior():
    from interior_windows import infer_window_probability
    photo = synthetic_photo()
    t0 = time.monotonic()
    positive, protected = infer_window_probability(photo)
    t_done = time.monotonic()
    assert positive.shape == (photo.height,photo.width)
    assert protected.shape == positive.shape
    return {"model":"clipseg","load_and_inference_seconds":round(t_done-t0,2)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["exterior","interior"])
    args = parser.parse_args()
    start = time.monotonic()
    result = run_exterior() if args.mode=="exterior" else run_interior()
    result.update(peak_rss_mb=memory_mb(), total_seconds=round(time.monotonic()-start,2),
                  fits_2gb_with_20pct_headroom=memory_mb() <= 1638.4,
                  ram_budget_mb=2048, headroom_mb=round(2048-memory_mb(),1))
    print("CARVELO_MEMORY_BENCHMARK "+json.dumps(result,sort_keys=True),flush=True)
