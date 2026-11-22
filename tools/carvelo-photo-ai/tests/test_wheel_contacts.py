"""Regression tests for CARVAMO wheel-foot silhouette heuristics.

Run: python -m unittest discover -s tools/carvelo-photo-ai/tests -p 'test_wheel_contacts.py'
These synthetic masks do not replace acceptance tests on real vehicle photographs.
"""
import sys
import unittest
from pathlib import Path
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from studio_compose import _contact_centers


def mask(wheels, width=800, height=450):
    image = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((95, 120, 705, 325), radius=48, fill=255)
    for x, bottom, radius in wheels:
        draw.ellipse((x-radius, bottom-2*radius, x+radius, bottom), fill=255)
    return image


class WheelContactRegression(unittest.TestCase):
    def test_two_clear_tires(self):
        contacts = _contact_centers(mask([(220, 393, 47), (580, 393, 47)]))
        self.assertGreaterEqual(len(contacts), 2)
        self.assertTrue(any(abs(x-220/800) < .09 for x in contacts))
        self.assertTrue(any(abs(x-580/800) < .09 for x in contacts))

    def test_three_tire_perspective(self):
        contacts = _contact_centers(mask([(195, 370, 36), (420, 391, 44), (640, 367, 34)]))
        self.assertGreaterEqual(len(contacts), 2)

    def test_ambiguous_flat_rocker_fails_closed(self):
        img = Image.new("L", (800, 450), 0)
        ImageDraw.Draw(img).rectangle((100, 140, 700, 350), fill=255)
        with self.assertRaisesRegex(ValueError, "wheel_detection_low_confidence"):
            _contact_centers(img)

    def test_single_visible_tire_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "wheel_detection_low_confidence"):
            _contact_centers(mask([(260, 392, 47)]))


if __name__ == "__main__":
    unittest.main()
