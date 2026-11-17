#!/usr/bin/env python3
"""CARVAMO V26: wheel-ground contact QA overlays for real photos.

Uses OWLv2 V25 wheel pair proposals; calculates bottom-of-tyre contact points
and compares them with segmented silhouette. Diagnostic only: no production
placement or camera pose modifications. All coordinates are original pixels.
"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

VIEWS = ("front", "side", "rear")


def analyse(view, circles, photo, foreground, output):
    if photo.size != foreground.size:
        raise ValueError(f"{view}: photo/segmentation dimensions differ")
    width, height = photo.size
    alpha = foreground.convert("RGBA").getchannel("A")
    pix = alpha.load()
    if len(circles) != 2:
        return {"status": "unresolved_pair", "wheel_count": len(circles)}
    image = photo.copy()
    pen = ImageDraw.Draw(image)
    points = []
    for idx, circle in enumerate(circles):
        if len(circle) != 3:
            raise ValueError(f"{view}: malformed wheel")
        x, y, r = [float(v) for v in circle]
        if not (0 <= x < width and 0 <= y < height and r > 0):
            raise ValueError(f"{view}: wheel outside image")
        contact_y = y + r
        pen.ellipse((x-r, y-r, x+r, y+r), outline="#19e46c", width=5)
        pen.line((x-18, contact_y, x+18, contact_y), fill="#00d9ff", width=5)
        pen.line((x, contact_y-18, x, contact_y+18), fill="#00d9ff", width=5)
        # Search for bottommost foreground pixel near the wheel x. The
        # silhouette can include shadows; it is not a ground truth floor.
        left, right = max(0, int(x-r*.35)), min(width-1, int(x+r*.35))
        bottoms = []
        for xx in range(left, right+1, max(1, (right-left)//30)):
            for yy in range(height-1, -1, -1):
                if pix[xx, yy] >= 190:
                    bottoms.append(yy)
                    break
        bottoms.sort()
        silhouette_bottom = bottoms[len(bottoms)//2] if bottoms else None
        points.append({"x": round(x,1), "y": round(y,1), "radius": round(r,1),
                       "tyre_contact_y": round(contact_y,1),
                       "silhouette_bottom_y": silhouette_bottom,
                       "contact_minus_silhouette_px":
                           round(contact_y-silhouette_bottom,1)
                           if silhouette_bottom is not None else None})
        pen.text((x+r+8,y), f"wheel {idx+1}", fill="yellow",
                 stroke_width=2, stroke_fill="black")
    # The two wheels have different contact heights in 3/4 perspective.
    pen.line([(p["x"], p["tyre_contact_y"]) for p in points],
             fill="#00d9ff", width=4)
    output.mkdir(parents=True, exist_ok=True)
    image.save(output/f"{view}_v26_contact.png")
    return {"status": "diagnostic_only_unverified", "wheel_count": 2,
            "contact_points": points,
            "ground_line_slope_px_per_px": round(
                (points[1]["tyre_contact_y"]-points[0]["tyre_contact_y"])/
                (points[1]["x"]-points[0]["x"]), 5)
                if points[1]["x"] != points[0]["x"] else None,
            "camera_pose_verified": False, "ground_plane_verified": False}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--photos", required=True, type=Path)
    p.add_argument("--results", required=True, type=Path,
                   help="Directory containing v19-front/side/rear/segmented.png")
    p.add_argument("--pairs", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    pairs = json.loads(args.pairs.read_text(encoding="utf-8"))
    photos = {"front":"IMG_9146(2).jpeg", "side":"IMG_9147(1).jpeg",
              "rear":"IMG_9148(2).jpeg"}
    report = {}
    for view in VIEWS:
        with Image.open(args.photos/photos[view]) as src:
            photo = ImageOps.exif_transpose(src).convert("RGB")
        with Image.open(args.results/f"v19-{view}"/"segmented.png") as src:
            foreground = src.convert("RGBA")
        report[view] = analyse(view, pairs.get(view, []), photo,
                               foreground, args.output)
        print(view, report[view]["status"],
              report[view].get("contact_points", []))
    args.output.mkdir(parents=True, exist_ok=True)
    (args.output/"v26_contact_report.json").write_text(
        json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
