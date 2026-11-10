"""Production-safe adapter for calibrated CARVELO Blender showroom renders.

Never guesses a source photograph's camera azimuth. A valid pose estimate and
matching calibrated render are mandatory; otherwise the 3D path fails closed.
"""
import json
from pathlib import Path
from PIL import Image
from showroom_camera import Camera
from showroom_views import CalibratedView, select_view


def load_views(directory: Path):
    manifest_path = directory / "camera_manifest.json"
    if not manifest_path.is_file():
        raise ValueError("showroom_manifest_missing")
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    views = []
    for item in data["camera_views"]:
        image = (directory / item["image"]).resolve()
        if directory.resolve() not in image.parents:
            raise ValueError("showroom_view_path_unsafe")
        if item.get("empty") is not True:
            raise ValueError("showroom_view_contains_vehicle")
        width, height = item["resolution"]
        if width <= 0 or height <= 0 or not -90 <= float(item["azimuth_deg"]) <= 90:
            raise ValueError("showroom_camera_metadata_invalid")
        if abs(float(item.get("floor_z_m", 999))) > 1e-5:
            raise ValueError("showroom_floor_metadata_invalid")
        if abs(float(item["camera_location_m"][2]) - 1.2) > .001:
            raise ValueError("showroom_camera_height_mismatch")
        # Blender metadata stores an actual camera location and orientation.
        # Camera() uses a different pinhole convention; don't silently mix them.
        # Angle is used ONLY for discrete selection; geometry must be calibrated
        # separately before wheel-plane validation can be considered complete.
        cam = Camera(float(item["azimuth_deg"]), 1.2,
                     float(item["lens_mm"]) * width / float(item["sensor_width_mm"]),
                     width/2, height/2)
        views.append(CalibratedView(image, cam, "blender-180-v1"))
    return views


def load_background(directory: Path, source_azimuth_deg: float, output_size):
    if not -90 <= source_azimuth_deg <= 90:
        raise ValueError("source_camera_pose_invalid")
    view = select_view(load_views(directory), source_azimuth_deg)
    with Image.open(view.image_path) as img:
        img.load()
        # Ubuntu Blender runners may ship Pillow < 9.1 without Image.Resampling.
        resampling = getattr(Image, "Resampling", Image)
        return img.convert("RGBA").resize(output_size, resampling.LANCZOS)
