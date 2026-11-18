"""CARVAMO V23 experimental wheel proposal generator.

Independent from Hough circle candidates: dark-region connected components.
Outputs unverified proposals; never drives production camera placement.
"""
from __future__ import annotations

import math
import numpy as np


def propose_wheels_dark_components(photo, foreground, limit=12):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv_not_installed") from exc
    if photo.size != foreground.size:
        raise ValueError("image_mask_size_mismatch")
    if not 1 <= limit <= 30:
        raise ValueError("invalid_limit")
    rgb = np.asarray(photo.convert("RGB"))
    matte = np.asarray(foreground.convert("RGBA").getchannel("A")) >= 190
    height, width = matte.shape
    ys, xs = np.where(matte)
    if xs.size < width*height*.04:
        return {"status": "insufficient_mask", "proposals": [], "verified": False}
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    bw, bh = max(1, x1-x0), max(1, y1-y0)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    # CLAHE mitigates uneven illumination; two thresholds capture dark tyres
    # without relying on wheel-circle Hough votes.
    enhanced = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    candidates = []
    low_y = int(y0 + .42*bh)
    min_r, max_r = max(8, int(bh*.035)), max(12, int(bh*.24))
    for percentile in (12, 22, 32):
        values = blurred[matte & (np.indices(matte.shape)[0] >= low_y)]
        if not values.size:
            continue
        threshold = int(np.percentile(values, percentile))
        dark = ((blurred <= threshold) & matte).astype(np.uint8)*255
        dark[:low_y] = 0
        dark = cv2.morphologyEx(dark, cv2.MORPH_CLOSE,
                                cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
        count, labels, stats, centers = cv2.connectedComponentsWithStats(dark, 8)
        for idx in range(1, count):
            left, top, ww, hh, area = [int(v) for v in stats[idx]]
            cx, cy = [float(v) for v in centers[idx]]
            r = (ww+hh)/4
            if not min_r <= r <= max_r or not .45 <= ww/max(1,hh) <= 2.2:
                continue
            if area < math.pi*r*r*.15 or area > math.pi*r*r*3.2:
                continue
            if not x0 <= cx <= x1 or not y0+.45*bh <= cy <= y1:
                continue
            if not matte[int(cy), int(cx)]:
                continue
            # Avoid large connected bumper/undercarriage dark areas.
            if ww > bw*.24 or hh > bh*.48:
                continue
            score = min(1.0, area/(math.pi*r*r)) * min(ww,hh)/max(ww,hh)
            candidates.append({"x": round(cx), "y": round(cy),
                               "radius": round(r), "score": round(score, 3),
                               "threshold_percentile": percentile})
    candidates.sort(key=lambda c: c["score"], reverse=True)
    proposals = []
    for c in candidates:
        if any(math.hypot(c["x"]-p["x"], c["y"]-p["y"]) <
               .9*max(c["radius"],p["radius"]) for p in proposals):
            continue
        proposals.append(c)
        if len(proposals) >= limit:
            break
    return {"status": "experimental_dark_component_proposals",
            "proposals": proposals, "verified": False,
            "camera_pose_verified": False,
            "method": "v23_clahe_dark_connected_components"}


def test_empty_mask():
    from PIL import Image
    photo = Image.new("RGB", (300, 200), "white")
    matte = Image.new("RGBA", (300, 200), (0, 0, 0, 0))
    assert propose_wheels_dark_components(photo, matte)["proposals"] == []


if __name__ == "__main__":
    test_empty_mask()
    print("V23 basic smoke test OK")
