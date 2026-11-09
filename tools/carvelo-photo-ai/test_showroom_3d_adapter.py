"""CARVELO 3D acceptance checks. Run: python -m unittest test_showroom_3d_adapter.py"""
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from showroom_3d_adapter import load_views, load_background


class Showroom3DAcceptance(unittest.TestCase):
    def make_bundle(self, root, angle=0):
        Image.new("RGB", (1280, 720), (35, 36, 38)).save(root / ("empty_%+04d.png" % angle))
        (root / "camera_manifest.json").write_text(json.dumps({
            "camera_views": [{
                "image": "empty_%+04d.png" % angle,
                "azimuth_deg": angle,
                "camera_location_m": [0, -5.6, 1.2],
                "camera_rotation_euler_rad": [1.57, 0, 0],
                "lens_mm": 40, "sensor_width_mm": 36,
                "resolution": [1280, 720],
                "floor_z_m": 0.0, "empty": True
            }]
        }), encoding="utf-8")

    def test_matching_view(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.make_bundle(root)
            self.assertEqual(len(load_views(root)), 1)
            self.assertEqual(load_background(root, 0, (640, 360)).size, (640, 360))

    def test_reject_unmatched_camera(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.make_bundle(root)
            with self.assertRaisesRegex(ValueError, "angle_mismatch"):
                load_background(root, 45, (640, 360))

    def test_reject_missing_render(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.make_bundle(root)
            next(root.glob("*.png")).unlink()
            with self.assertRaisesRegex(ValueError, "view_missing"):
                load_views(root)

    def test_reject_path_traversal(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            self.make_bundle(root)
            data = json.loads((root/"camera_manifest.json").read_text())
            data["camera_views"][0]["image"] = "../outside.png"
            (root/"camera_manifest.json").write_text(json.dumps(data))
            with self.assertRaisesRegex(ValueError, "path_unsafe"):
                load_views(root)


if __name__ == "__main__":
    unittest.main()
