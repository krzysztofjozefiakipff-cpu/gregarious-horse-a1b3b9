"""Regression tests for conservative handheld-camera fitting.

Run: python -m unittest discover -s tools/carvelo-photo-ai -p 'test_showroom_camera_fit.py'
No real-image calibration or production worker is implied by these tests.
"""
import unittest
from showroom_camera import Camera, fit_handheld_camera, project_floor


class HandheldCameraFitTests(unittest.TestCase):
    WORLD = [(-1.2, 5.0), (1.2, 5.0)]

    def test_multiple_handheld_camera_settings_are_not_certified(self):
        for azimuth, height, pitch, focal in [
            (-40, 1.0, -12, 1008),
            (0, 1.35, 0, 1512),
            (20, 1.35, -6, 1008),
            (50, 1.7, 6, 2268),
        ]:
            with self.subTest(azimuth=azimuth, height=height, pitch=pitch):
                reference = Camera(azimuth, height, focal, 630, 335, pitch)
                observed = [project_floor(reference, *p) for p in self.WORLD]
                result = fit_handheld_camera(
                    observed, self.WORLD, image_size=(1260, 670)
                )
                self.assertEqual(result["status"], "ambiguous")
                self.assertFalse(result["validated"])
                self.assertIsNotNone(result["camera"])
                self.assertLessEqual(result["rms_px"], 0.01)

    def test_two_contacts_never_prove_calibration(self):
        reference = Camera(20, 1.35, 1008, 630, 335, -6)
        observed = [project_floor(reference, *p) for p in self.WORLD]
        result = fit_handheld_camera(observed, self.WORLD, image_size=(1260, 670))
        self.assertEqual(result["status"], "ambiguous")
        self.assertFalse(result["validated"])

    def test_rejects_invalid_image_dimensions(self):
        with self.assertRaises(ValueError):
            fit_handheld_camera([(1, 2), (3, 4)], self.WORLD, image_size=(0, 670))

    def test_rejects_mismatched_landmarks(self):
        with self.assertRaises(ValueError):
            fit_handheld_camera([(1, 2)], self.WORLD, image_size=(1260, 670))

    def test_rejects_invalid_thresholds(self):
        with self.assertRaises(ValueError):
            fit_handheld_camera([(1, 2), (3, 4)], self.WORLD,
                                image_size=(1260, 670), max_error_fraction=0)


if __name__ == "__main__":
    unittest.main()
