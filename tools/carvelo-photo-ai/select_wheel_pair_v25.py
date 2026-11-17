#!/usr/bin/env python3
"""V25 experimental geometry filter for independent OWLv2 wheel detections.

Select exactly one plausible wheel pair or abstain. Not a trained classifier.
Tuned on 3 JAECOO 8 images; MUST be validated on unseen cars before production.
"""
import argparse
import json
from pathlib import Path
from PIL import Image


def select(detections, image_width, image_height):
    ranked = []
    for d in detections:
        x0, y0, x1, y1 = d["box"]
        w, h = x1-x0, y1-y0
        if w <= 0 or h <= 0 or min(w, h)/max(w, h) < .53:
            continue
        if w < image_width*.065 or h < image_height*.095:
            continue
        cx, cy = (x0+x1)/2, (y0+y1)/2
        if cy > image_height*.84:
            continue
        ranked.append((d, cx, cy, (w+h)/4))
    best = None
    for i, a in enumerate(ranked):
        for b in ranked[i+1:]:
            _, ax, ay, ar = a
            _, bx, by, br = b
            dx, dy = abs(ax-bx), abs(ay-by)
            if dx < image_width*.24 or dy > image_height*.24:
                continue
            if min(ar, br)/max(ar, br) < .48:
                continue
            score = (a[0]["score"]+b[0]["score"] +
                     .10*dx/image_width - .15*dy/image_height)
            if best is None or score > best[0]:
                best = (score, a, b)
    if best is None:
        return []
    return [{"x": round(c[1]), "y": round(c[2]),
             "radius": round(c[3]), "confidence": c[0]["score"]}
            for c in sorted(best[1:], key=lambda z: z[1])]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--v24-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    predictions = {}
    for view in ("front", "side", "rear"):
        detections = json.loads((args.v24_dir/f"{view}_v24.json").read_text())["detections"]
        with Image.open(args.v24_dir/f"{view}_v24.png") as im:
            width, height = im.size
        pair = select(detections, width, height)
        predictions[view] = [[c["x"], c["y"], c["radius"]] for c in pair]
        print(view, "pair", pair if pair else "unresolved")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(predictions, indent=2), encoding="utf-8")
    print("Experimental predictions:", args.output)


if __name__ == "__main__":
    main()
