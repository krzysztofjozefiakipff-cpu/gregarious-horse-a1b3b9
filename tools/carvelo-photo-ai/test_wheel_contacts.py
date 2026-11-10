"""Conservative wheel-foot detection regression cases."""
import unittest
from PIL import Image, ImageDraw
from studio_compose import _contact_centers


class WheelContacts(unittest.TestCase):
    def test_flat_tire_foot_bands(self):
        alpha = Image.new("L", (800, 460), 0)
        d = ImageDraw.Draw(alpha)
        d.rectangle((85, 145, 715, 335), fill=255)
        d.ellipse((155, 302, 245, 405), fill=255)
        d.ellipse((565, 302, 655, 405), fill=255)
        centers = _contact_centers(alpha)
        self.assertGreaterEqual(len(centers), 2)
        self.assertTrue(any(.18 < x < .33 for x in centers), centers)
        self.assertTrue(any(.67 < x < .85 for x in centers), centers)

    def test_flat_rocker_without_tires_rejected(self):
        alpha = Image.new("L", (800, 460), 0)
        ImageDraw.Draw(alpha).rectangle((90, 145, 710, 370), fill=255)
        with self.assertRaisesRegex(ValueError, "wheel_detection_low_confidence"):
            _contact_centers(alpha)


if __name__ == "__main__":
    unittest.main()
