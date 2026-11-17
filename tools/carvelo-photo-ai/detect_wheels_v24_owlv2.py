#!/usr/bin/env python3
"""CARVAMO V24: real zero-shot visual object detector, independent of V19/V23.

Uses pretrained OWLv2 image-text model (wheel / tire / car wheel prompts).
First invocation downloads model weights; subsequent runs use local HF cache.
Inference is OFFLINE after weights have been cached. Never changes worker state.
This is an experiment, NOT a production-ready detector or pose estimator.
"""
import argparse
import json
from pathlib import Path

PROMPTS = ["car wheel", "vehicle tire", "alloy wheel", "car tyre"]
PHOTOS = {"front": "IMG_9146(2).jpeg", "side": "IMG_9147(1).jpeg",
          "rear": "IMG_9148(2).jpeg"}


def run(args):
    import torch
    from PIL import Image, ImageDraw, ImageOps
    from transformers import AutoProcessor, Owlv2ForObjectDetection

    device = "cuda" if torch.cuda.is_available() and not args.cpu else "cpu"
    processor = AutoProcessor.from_pretrained(args.model)
    model = Owlv2ForObjectDetection.from_pretrained(args.model).to(device).eval()
    args.output.mkdir(parents=True, exist_ok=True)
    predictions = {}
    for view, name in PHOTOS.items():
        with Image.open(args.photos / name) as source:
            photo = ImageOps.exif_transpose(source).convert("RGB")
        # Keep original image coordinate system to compare against V21.
        inputs = processor(text=[PROMPTS], images=photo, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.inference_mode():
            outputs = model(**inputs)
        target_sizes = torch.tensor([photo.size[::-1]])
        result = processor.post_process_object_detection(
            outputs, threshold=args.threshold, target_sizes=target_sizes)[0]
        boxes = result["boxes"].detach().cpu().tolist()
        scores = result["scores"].detach().cpu().tolist()
        labels = result["labels"].detach().cpu().tolist()
        ranked = []
        for box, score, label in zip(boxes, scores, labels):
            x0, y0, x1, y1 = box
            w, h = x1-x0, y1-y0
            if w <= 0 or h <= 0 or min(w,h)/max(w,h) < .40:
                continue
            ranked.append({"box": [round(v, 1) for v in box],
                           "score": round(score, 4), "prompt": PROMPTS[label]})
        ranked.sort(key=lambda x: x["score"], reverse=True)
        kept = []
        for item in ranked:
            x0, y0, x1, y1 = item["box"]
            if any(_iou(item["box"], old["box"]) >= .35 for old in kept):
                continue
            kept.append(item)
            if len(kept) >= args.max_detections:
                break
        predictions[view] = [
            [round((x0+x1)/2), round((y0+y1)/2),
             round(((x1-x0)+(y1-y0))/4)]
            for x0,y0,x1,y1 in (d["box"] for d in kept)
        ]
        diagnostic = photo.copy()
        pen = ImageDraw.Draw(diagnostic)
        for i, d in enumerate(kept, 1):
            pen.rectangle(d["box"], outline="lime", width=5)
            pen.text((d["box"][0], max(0, d["box"][1]-18)),
                     f'{i} {d["score"]:.2f} {d["prompt"]}', fill="yellow",
                     stroke_width=2, stroke_fill="black")
        diagnostic.save(args.output / f"{view}_v24.png")
        (args.output / f"{view}_v24.json").write_text(
            json.dumps({"status": "unverified_model_predictions",
                        "model": args.model, "detections": kept}, indent=2))
        print(view, "detections", len(kept))
    (args.output / "predictions.json").write_text(
        json.dumps(predictions, indent=2))
    print("Finished; inspect images and benchmark before making any changes to worker.")


def _iou(a, b):
    x0, y0 = max(a[0],b[0]), max(a[1],b[1])
    x1, y1 = min(a[2],b[2]), min(a[3],b[3])
    intersection = max(0,x1-x0)*max(0,y1-y0)
    aa = max(0,a[2]-a[0])*max(0,a[3]-a[1])
    bb = max(0,b[2]-b[0])*max(0,b[3]-b[1])
    return intersection/(aa+bb-intersection) if aa+bb>intersection else 0


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--photos", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--model", default="google/owlv2-base-patch16-ensemble")
    p.add_argument("--threshold", type=float, default=.12)
    p.add_argument("--max-detections", type=int, default=12)
    p.add_argument("--cpu", action="store_true")
    args = p.parse_args()
    if not 0 < args.threshold < 1 or not 1 <= args.max_detections <= 30:
        p.error("invalid threshold/max-detections")
    run(args)


if __name__ == "__main__":
    main()
