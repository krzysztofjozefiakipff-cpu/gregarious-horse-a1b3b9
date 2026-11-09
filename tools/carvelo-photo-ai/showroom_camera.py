"""Camera calibration primitives for a future 180-degree CARVELO 3D studio.

Not connected to the production worker until real empty renders and
independently measured wheel landmarks pass image-level validation.
A panorama cannot correct parallax or replace a 3D scene.
"""
from dataclasses import dataclass
from math import cos, sin, radians, sqrt

@dataclass(frozen=True)
class Camera:
    azimuth_deg: float
    height_m: float
    focal_px: float
    cx: float
    cy: float
    pitch_deg: float = 0.0

    def __post_init__(self):
        if not -90 <= self.azimuth_deg <= 90:
            raise ValueError("camera_azimuth_out_of_range")
        if not .6 <= self.height_m <= 2.5:
            raise ValueError("camera_height_out_of_range")
        if self.focal_px <= 0 or not -30 <= self.pitch_deg <= 30:
            raise ValueError("camera_intrinsics_invalid")


def project_floor(camera: Camera, x_m: float, depth_m: float):
    """Project world-floor (x,depth,0) into calibrated camera pixels."""
    yaw, pitch = radians(camera.azimuth_deg), radians(camera.pitch_deg)
    right = cos(yaw)*x_m - sin(yaw)*depth_m
    forward = sin(yaw)*x_m + cos(yaw)*depth_m
    vertical = -camera.height_m
    z = cos(pitch)*forward - sin(pitch)*vertical
    v = sin(pitch)*forward + cos(pitch)*vertical
    if z <= 0:
        raise ValueError("floor_point_behind_camera")
    return (camera.cx + camera.focal_px*right/z,
            camera.cy - camera.focal_px*v/z)


def floor_alignment_error(measured, expected):
    """RMS distance in pixels between tire feet and projected floor anchors."""
    if len(measured) != len(expected) or len(measured) < 2:
        raise ValueError("insufficient_tire_landmarks")
    return sqrt(sum((a[0]-b[0])**2+(a[1]-b[1])**2
                    for a,b in zip(measured, expected))/len(measured))


def validate_alignment(measured, expected, image_height, tolerance=.018):
    """Fail closed: don't render a car with ungrounded tires."""
    if image_height <= 0 or tolerance <= 0:
        raise ValueError("invalid_alignment_parameters")
    if floor_alignment_error(measured, expected) > image_height*tolerance:
        raise ValueError("wheel_ground_plane_unreliable")


def camera_candidates(azimuth_step_deg: int = 5, heights_m=(1.15, 1.4, 1.65),
                      pitches_deg=(-8, -4, 0, 4, 8)):
    """Deterministic camera search grid for a continuous 3D showroom.

    Candidates are hypotheses, not validated camera poses. Real photographs
    require tire landmarks and image-level scoring before selecting one.
    """
    if not 1 <= azimuth_step_deg <= 30:
        raise ValueError("invalid_camera_search_step")
    return tuple(
        Camera(float(azimuth), float(height), 800., 640., 360., float(pitch))
        for azimuth in range(-90, 91, azimuth_step_deg)
        for height in heights_m
        for pitch in pitches_deg
    )


def best_camera_from_contacts(observed, world_contacts, candidates, max_error_px):
    """Fit camera to measured wheel-ground anchors; reject uncertain matches.

    world_contacts must be measured in metres on the floor, in the same
    world coordinate system as the 3D showroom. Do not infer them from alpha.
    """
    if len(observed) != len(world_contacts) or len(observed) < 2:
        raise ValueError("insufficient_tire_landmarks")
    if max_error_px <= 0:
        raise ValueError("invalid_alignment_parameters")
    ranked = []
    for camera in candidates:
        try:
            expected = [project_floor(camera, x, depth) for x, depth in world_contacts]
            error = floor_alignment_error(observed, expected)
            ranked.append((error, camera))
        except ValueError:
            continue
    if not ranked:
        raise ValueError("no_valid_camera_candidates")
    error, camera = min(ranked, key=lambda item: item[0])
    if error > max_error_px:
        raise ValueError("wheel_ground_plane_unreliable")
    return camera, error
