"""Conservative, image-derived perspective cues for CARVAMO Photo AI.

This module does not estimate a verified camera pose. It detects candidate
vehicle-body line directions from actual pixels, independent of EXIF.
Requires cv2 and numpy. No modification of source image or production worker.
"""
from __future__ import annotations

import math
import numpy as np


def analyze_vehicle_lines(photo, foreground, *, min_segments=4):
    """Return orientation evidence from Hough segments inside the car matte.

    photo and foreground are PIL images in the same pixel coordinate frame.
    Segment orientations are modulo 180 degrees; they are NOT vehicle yaw.
    Reject very short, nearly vertical, and background-contaminated segments.
    """
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("opencv_not_installed") from exc
    if photo.size != foreground.size:
        raise ValueError("image_mask_size_mismatch")
    if min_segments < 2:
        raise ValueError("invalid_min_segments")
    rgb = np.asarray(photo.convert("RGB"))
    alpha = np.asarray(foreground.getchannel("A"))
    h, w = alpha.shape
    if min(h, w) < 120:
        raise ValueError("image_too_small")
    mask = (alpha >= 190).astype(np.uint8)
    # Erode mask so that the silhouette border and studio/background edges
    # cannot dominate orientation estimates.
    k = max(3, (min(h, w) // 130) | 1)
    inner = cv2.erode(mask, np.ones((k, k), np.uint8), iterations=2)
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 70, 150)
    edges[inner == 0] = 0
    min_length = max(24, round(w * .055))
    raw = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=35,
                          minLineLength=min_length, maxLineGap=max(6, w // 85))
    segments = []
    if raw is not None:
        for line in raw.reshape(-1, 4):
            x1, y1, x2, y2 = (int(v) for v in line)
            length = math.hypot(x2-x1, y2-y1)
            if length < min_length:
                continue
            angle = math.degrees(math.atan2(y2-y1, x2-x1))
            angle = (angle + 90) % 180 - 90
            # A near-vertical windshield pillar is not a reliable
            # longitudinal body line.
            if abs(angle) > 55:
                continue
            segments.append((angle, length, [x1, y1, x2, y2]))
    segments.sort(key=lambda item: item[1], reverse=True)
    # Deduplicate nearly identical Hough segments from thick bodywork lines.
    unique = []
    for angle, length, coords in segments:
        mx = (coords[0]+coords[2])/2
        my = (coords[1]+coords[3])/2
        if any(abs(angle-a)<3 and math.hypot(mx-x, my-y)<min_length*.35
               for a,x,y in unique):
            continue
        unique.append((angle, mx, my))
        if len(unique) >= 40:
            break
    if len(unique) < min_segments:
        return {
            "status": "insufficient_line_evidence",
            "line_count": len(unique),
            "vehicle_azimuth_deg": None,
            "camera_pose_verified": False,
        }
    angles = np.asarray([a for a, _, _ in unique])
    # A robust median is a descriptive cue, not a perspective-calibrated yaw.
    median = float(np.median(angles))
    spread = float(np.median(np.abs(angles-median)))
    return {
        "status": "orientation_cue_only",
        "line_count": len(unique),
        "median_body_line_angle_deg": round(median, 2),
        "line_angle_mad_deg": round(spread, 2),
        "vehicle_azimuth_deg": None,
        "camera_pose_verified": False,
    }
