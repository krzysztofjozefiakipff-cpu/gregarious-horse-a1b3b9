"""Synthetic regression tests for the 180 showroom render validator.

Run from this directory: python -m unittest discover -p 'test_validate_showroom_renders.py'
"""
import json
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from validate_showroom_renders import validate


class RenderValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name)
        self.views = []
        for i, angle in enumerate((-90, 0, 90)):
            filename = f"empty_{angle}.png"
            image = Image.new("RGB", (128, 72), (25, 25, 25))
            for x in range(12 + i * 15, 60 + i * 15):
                for y in range(12, 60):
                    image.putpixel((x, y), (230, 210, 180))
            image.save(self.directory / filename)
            self.views.append({"image": filename, "azimuth_deg": angle,
                               "resolution": [128, 72]})
        self.write_manifest()

    def write_manifest(self):
        (self.directory / "camera_manifest.json").write_text(
            json.dumps({"camera_views": self.views}), encoding="utf-8")

    def test_distinct_views_pass(self):
        validate(self.directory)

    def test_blank_render_rejected(self):
        Image.new("RGB", (128, 72)).save(self.directory / "empty_0.png")
        with self.assertRaisesRegex(ValueError, "Low-detail"):
            validate(self.directory)

    def test_missing_render_rejected(self):
        (self.directory / "empty_0.png").unlink()
        with self.assertRaisesRegex(ValueError, "Missing render"):
            validate(self.directory)

    def test_identical_views_rejected(self):
        for name in ("empty_0.png", "empty_90.png"):
            Image.open(self.directory / "empty_-90.png").save(self.directory / name)
        with self.assertRaisesRegex(ValueError, "identical"):
            validate(self.directory)

    def test_resolution_mismatch_rejected(self):
        self.views[0]["resolution"] = [640, 480]
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "Resolution mismatch"):
            validate(self.directory)

    def test_incomplete_orbit_rejected(self):
        self.views[0]["azimuth_deg"] = -45
        self.write_manifest()
        with self.assertRaisesRegex(ValueError, "cover"):
            validate(self.directory)


if __name__ == "__main__":
    unittest.main()
