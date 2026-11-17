"""Conservative wheel-centre candidates from car pixels, not EXIF.

Circular features can be lamps, logos, or wheel arches. Results are candidates
for visual QA, NEVER confirmed wheels or a calibrated camera pose.
"""
from __future__ import annotations

import math
import numpy as np


def select_side_wheel_pair(candidates, body_width):
    """Return 1-based candidate indices only for a near-level side-view pair.

    A high horizontal pair on a bumper or door must not override lower
    circles. This is a conservative side-view hypothesis, not pose calibration.
    """
    if not candidates or body_width <= 0:
        return None
    lowest_y = max(c["y"] for c in candidates)
    largest_radius = max(c["radius"] for c in candidates)
    plausible = [
        (i, c) for i, c in enumerate(candidates)
        if c["y"] >= lowest_y - .60 * largest_radius
    ]
    scored = []
    for k, (i, a) in enumerate(plausible):
        for j, b in plausible[k+1:]:
            dx = abs(a["x"] - b["x"])
            ratio = min(a["radius"], b["radius"]) / max(a["radius"], b["radius"])
            mean_radius = (a["radius"] + b["radius"]) / 2
            dy = abs(a["y"] - b["y"])
            if dx < .38 * body_width or ratio < .72 or dy > .22 * mean_radius:
                continue
            gap = (a.get("silhouette_bottom_gap_radius_ratio", 0) +
                   b.get("silhouette_bottom_gap_radius_ratio", 0))
            scored.append((dx / body_width + ratio - dy / mean_radius - .15*gap, i, j))
    if not scored:
        return None
    scored.sort(reverse=True)
    _, i, j = scored[0]
    return [i + 1, j + 1]


def detect_wheel_candidates(photo, foreground, max_candidates=8):
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv_not_installed") from exc
    if photo.size != foreground.size:
        raise ValueError("image_mask_size_mismatch")
    if not 1 <= max_candidates <= 20:
        raise ValueError("invalid_max_candidates")
    rgb = np.asarray(photo.convert("RGB"))
    alpha = np.asarray(foreground.convert("RGBA").getchannel("A"))
    h, w = alpha.shape
    if min(h, w) < 120:
        raise ValueError("image_too_small")
    opaque = (alpha >= 190).astype(np.uint8)
    ys, xs = np.nonzero(opaque)
    if len(xs) < w*h*.04:
        return {"status": "insufficient_mask", "candidates": [],
                "wheel_centres_verified": False, "vehicle_azimuth_deg": None}
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    body_h = max(1, y1-y0)
    body_w = max(1, x1-x0)
    # Wheels tend to be in the lower part of the visible vehicle. Restrict
    # search to mask interior; circles in the background are not evidence.
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (7, 7), 1.5)
    min_radius = max(7, int(min(body_h, body_w)*.045))
    max_radius = max(min_radius+2, int(min(body_h, body_w)*.22))
    circles = cv2.HoughCircles(
        gray, cv2.HOUGH_GRADIENT, dp=1.2,
        minDist=max(20, int(body_w*.12)),
        param1=110, param2=28,
        minRadius=min_radius, maxRadius=max_radius)
    candidates = []
    if circles is not None:
        for cx, cy, radius in circles[0]:
            x, y, r = int(round(cx)), int(round(cy)), int(round(radius))
            if not (0 <= x < w and 0 <= y < h):
                continue
            if y < y0 + .46*body_h or y > y1 + .035*body_h:
                continue
            if opaque[y, x] == 0:
                continue
            # Require most sampled ring points to belong to car matte.
            samples = [(int(x + .78*r*math.cos(t)),
                        int(y + .78*r*math.sin(t)))
                       for t in np.linspace(0, 2*math.pi, 24, endpoint=False)]
            inside = sum(0 <= sx < w and 0 <= sy < h and opaque[sy, sx]
                         for sx, sy in samples)
            if inside < 17:
                continue
            candidates.append({"x": x, "y": y, "radius": r,
                               "mask_ring_fraction": round(inside/24, 3)})
    # Estimate the bottom of the visible vehicle at each x coordinate.
    # A genuine tyre should approach this lower silhouette, unlike a lamp
    # or a circular detail on a door. This is a ranking cue, not proof.
    bottom_by_x = np.full(w, -1, dtype=int)
    for x in range(int(x0), int(x1) + 1):
        rows = np.flatnonzero(opaque[:, x])
        if rows.size:
            bottom_by_x[x] = int(rows[-1])
    filtered = []
    for c in candidates:
        x, y, r = c["x"], c["y"], c["radius"]
        local = bottom_by_x[max(0, x-r//2):min(w, x+r//2+1)]
        local = local[local >= 0]
        if not local.size:
            continue
        bottom = float(np.median(local))
        gap = abs((y + r) - bottom)
        c["silhouette_bottom_gap_px"] = round(gap, 1)
        c["silhouette_bottom_gap_radius_ratio"] = round(gap / r, 3)
        # Do not accept candidates far above the lower vehicle silhouette.
        if gap > max(15, r*.48):
            continue
        filtered.append(c)
    # Wheel rubber is typically darker than the adjacent body panel.
    # Compare the inner tyre annulus against a local exterior annulus.
    # Use robust medians to reduce sensitivity to bright alloy spokes.
    def ring_median(x, y, r, fractions):
        values = []
        for fraction in fractions:
            for theta in np.linspace(0, 2*math.pi, 64, endpoint=False):
                xx = int(round(x + r*fraction*math.cos(theta)))
                yy = int(round(y + r*fraction*math.sin(theta)))
                if 0 <= xx < w and 0 <= yy < h and opaque[yy, xx]:
                    values.append(float(gray[yy, xx]))
        return float(np.median(values)) if len(values) >= 24 else None

    for c in filtered:
        x, y, r = c["x"], c["y"], c["radius"]
        tyre = ring_median(x, y, r, (.78, .88, .96))
        exterior = ring_median(x, y, r, (1.18, 1.28))
        c["tyre_annulus_luma"] = round(tyre, 1) if tyre is not None else None
        c["exterior_annulus_luma"] = round(exterior, 1) if exterior is not None else None
        c["dark_ring_contrast"] = (
            round(exterior-tyre, 1)
            if tyre is not None and exterior is not None else None
        )
        # No contrast evidence => keep as uncertain, not a verified wheel.
        c["dark_ring_supported"] = (
            c["dark_ring_contrast"] is not None and c["dark_ring_contrast"] >= 12
        )
    filtered.sort(key=lambda c: (c["silhouette_bottom_gap_radius_ratio"],
                                  -c["radius"]))
    # Non-maximum suppression: a single wheel may produce nested circles.
    selected = []
    for c in filtered:
        if any(math.hypot(c["x"]-p["x"], c["y"]-p["y"]) <
               .8*max(c["radius"], p["radius"]) for p in selected):
            continue
        selected.append(c)
        if len(selected) >= max_candidates:
            break
    candidates = selected
    pair = select_side_wheel_pair(candidates, body_w)
    return {
        "status": "silhouette_filtered_candidates" if candidates else "no_reliable_candidates",
        "candidates": candidates,
        "candidate_count": len(candidates),
        "raw_candidate_count": len(filtered),
        "wheel_pair_candidate_indices": pair,
        "wheel_pair_status": "side_view_geometry_hypothesis_only" if pair else "unresolved",
        "selection_method": "v18_low_wheel_side_pair_geometry_contrast_diagnostic_only",
        "wheel_centres_verified": False,
        "vehicle_azimuth_deg": None,
        "camera_pose_verified": False,
    }
