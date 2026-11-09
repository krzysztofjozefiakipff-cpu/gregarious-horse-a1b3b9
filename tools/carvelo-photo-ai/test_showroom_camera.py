"""Run with python -m unittest discover -s tools/carvelo-photo-ai -p 'test_showroom_camera.py'."""
import tempfile
import unittest
from pathlib import Path
from showroom_camera import Camera, project_floor, floor_alignment_error, validate_alignment
from showroom_views import CalibratedView, select_view


class CameraGeometryTests(unittest.TestCase):
    def setUp(self):
        self.camera = Camera(0, 1.5, 800, 640, 360)

    def test_floor_approaches_horizon_with_depth(self):
        near = project_floor(self.camera, 0, 3)
        far = project_floor(self.camera, 0, 12)
        self.assertAlmostEqual(near[0], 640)
        self.assertGreater(near[1], far[1])
        self.assertGreater(far[1], 360)

    def test_horizontal_floor_symmetry(self):
        left = project_floor(self.camera, -1, 5)
        right = project_floor(self.camera, 1, 5)
        self.assertAlmostEqual(left[1], right[1])
        self.assertAlmostEqual(left[0]+right[0], 1280)

    def test_invalid_angle_rejected(self):
        with self.assertRaises(ValueError):
            Camera(120, 1.5, 800, 640, 360)

    def test_bad_contact_alignment_rejected(self):
        with self.assertRaisesRegex(ValueError, "wheel_ground_plane_unreliable"):
            validate_alignment([(100, 300), (300, 300)],
                               [(100, 300), (300, 345)], 450)

    def test_good_contact_alignment_accepted(self):
        validate_alignment([(100, 300), (300, 340)],
                           [(101, 302), (301, 341)], 450)

    def test_missing_view_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "showroom_views_not_configured"):
            select_view([], 45)

    def test_nearest_calibrated_view(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/"empty.webp"
            path.write_bytes(b"placeholder")  # path existence only; render validates format
            views = [
                CalibratedView(path, Camera(-45, 1.5, 800, 640, 360), "left"),
                CalibratedView(path, Camera(45, 1.5, 800, 640, 360), "right"),
            ]
            self.assertEqual(select_view(views, 42).calibration_id, "right")
            with self.assertRaisesRegex(ValueError, "showroom_view_angle_mismatch"):
                select_view(views, 0)

    def test_vehicle_in_view_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d)/"image.webp"
            path.touch()
            with self.assertRaisesRegex(ValueError, "showroom_view_contains_vehicle"):
                CalibratedView(path, self.camera, "test", empty=False)


if __name__ == "__main__":
    unittest.main()
