#!/usr/bin/env python3
"""V21: produce full-image wheel ground-truth review overlays and editable JSON.

The existing V19 crops only label Hough candidates. Missed wheels cannot be
learned or measured until humans label them on the full source photograph.
No model inference or automatic calibration is claimed here.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


VIEWS = {
    "front": "IMG_9146(2).jpeg",
    "side": "IMG_9147(1).jpeg",
    "rear": "IMG_9148(2).jpeg",
}


def prepare(photo_root, review_root, output_root):
    output_root.mkdir(parents=True, exist_ok=True)
    for view, filename in VIEWS.items():
        path = review_root / f"v19-{view}" / "wheel_review" / "annotations.json"
        data = json.loads(path.read_text(encoding="utf-8"))
        photo_path = photo_root / filename
        with Image.open(photo_path) as source:
            from PIL import ImageOps
            image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        pen = ImageDraw.Draw(image)
        positives = []
        for item in data["candidates"]:
            x, y, radius = item["circle_xy_radius"]
            label = item["label"]
            color = {"wheel": (0, 220, 90), "not_wheel": (240, 55, 55)}.get(
                label, (255, 190, 0))
            pen.ellipse((x-radius, y-radius, x+radius, y+radius),
                        outline=color, width=4)
            pen.text((x+radius+3, y), f'{item["index"]}: {label}',
                     fill=color, stroke_width=2, stroke_fill=(0, 0, 0))
            if label == "wheel":
                positives.append([x, y, radius])
        image.save(output_root / f"{view}_ground_truth_review.png")
        record = {
            "schema": "carvamo_wheel_ground_truth_v21",
            "view": view,
            "source_photo": filename,
            "image_size": list(image.size),
            "confirmed_candidate_wheels_xy_radius": positives,
            "missed_wheels_xy_radius": data.get("missed_wheels_xy_radius", []),
            "all_visible_wheels_labeled": False,
            "human_verified": False,
            "instructions": (
                "Inspect full photo and add every visible wheel missed by V19 "
                "as [center_x,center_y,radius] in RESIZED image pixels. "
                "Set both booleans true only after manual inspection."
            ),
        }
        (output_root / f"{view}_ground_truth.json").write_text(
            json.dumps(record, indent=2), encoding="utf-8")
        print(view, "confirmed_candidates", len(positives),
              "overlay", output_root / f"{view}_ground_truth_review.png")


def validate(root):
    total = 0
    for view in VIEWS:
        p = root / f"{view}_ground_truth.json"
        data = json.loads(p.read_text(encoding="utf-8"))
        w, h = data["image_size"]
        for key in ("confirmed_candidate_wheels_xy_radius", "missed_wheels_xy_radius"):
            for circle in data[key]:
                if (not isinstance(circle, list) or len(circle) != 3 or
                    not all(isinstance(v, (int, float)) for v in circle) or
                    not 0 <= circle[0] < w or not 0 <= circle[1] < h or
                    not 0 < circle[2] < min(w, h)/2):
                    raise ValueError(f"{view}: invalid circle in {key}: {circle}")
        if data["human_verified"] is not True or data["all_visible_wheels_labeled"] is not True:
            raise ValueError(f"{view}: ground truth not independently verified")
        total += len(data["confirmed_candidate_wheels_xy_radius"]) + len(data["missed_wheels_xy_radius"])
    print("CARVAMO_V21_GROUND_TRUTH_VALID", total, "visible wheels")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--photo-root", type=Path)
    parser.add_argument("--review-root", type=Path)
    parser.add_argument("--output-root", type=Path, required=True)
    parser.add_argument("--validate", action="store_true")
    args = parser.parse_args()
    if args.validate:
        validate(args.output_root)
    else:
        if args.photo_root is None or args.review_root is None:
            parser.error("--photo-root and --review-root required when preparing")
        prepare(args.photo_root, args.review_root, args.output_root)


if __name__ == "__main__":
    main()
