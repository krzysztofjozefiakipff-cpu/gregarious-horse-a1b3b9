"""Validated view selection for a future CARVELO 180-degree studio.

Only calibrated EMPTY renders can be registered. The existing one-image
showroom must never be silently reused at different camera azimuths.
"""
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from showroom_camera import Camera


@dataclass(frozen=True)
class CalibratedView:
    image_path: Path
    camera: Camera
    calibration_id: str
    empty: bool = True

    def __post_init__(self):
        if not self.empty:
            raise ValueError("showroom_view_contains_vehicle")
        if not self.calibration_id.strip():
            raise ValueError("showroom_view_uncalibrated")
        if not self.image_path.is_file():
            raise ValueError("showroom_view_missing")


def select_view(views: list[CalibratedView], azimuth_deg: float,
                max_delta_deg: float = 8.0) -> CalibratedView:
    """Choose a calibrated view; reject mismatched angles instead of faking 3D."""
    if not -90 <= azimuth_deg <= 90:
        raise ValueError("vehicle_view_angle_out_of_range")
    if not views:
        raise ValueError("showroom_views_not_configured")
    best = min(views, key=lambda v: abs(v.camera.azimuth_deg-azimuth_deg))
    if abs(best.camera.azimuth_deg-azimuth_deg) > max_delta_deg:
        raise ValueError("showroom_view_angle_mismatch")
    return best
