"""Offline tests for the real-photo QA gate; no production credentials."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from real_photo_qa import evaluate


class RealPhotoQATests(unittest.TestCase):
    def test_missing_mask_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/"manifest.json"
            path.write_text(json.dumps({"cases":[
                {"id":"car","kind":"exterior","mask":"missing.png","expected_x":[.25,.75]},
                {"id":"dash","kind":"interior"}]}))
            report = evaluate(path)
            self.assertFalse(report["passed"])
            self.assertEqual(report["counts"]["fail"],1)
            self.assertEqual(report["counts"]["skipped"],1)

    def test_missing_reference_cannot_pass(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/"manifest.json"
            Image.new("L",(64,64),255).save(Path(tmp)/"mask.png")
            path.write_text(json.dumps({"cases":[
                {"id":"car","kind":"exterior","mask":"mask.png"}]}))
            with patch("real_photo_qa._contact_centers",return_value=(.2,.8)):
                report = evaluate(path)
            self.assertFalse(report["passed"])
            self.assertEqual(report["counts"]["needs_review"],1)

    def test_distinct_reference_matches_required(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)/"manifest.json"
            Image.new("L",(64,64),255).save(Path(tmp)/"mask.png")
            path.write_text(json.dumps({"cases":[
                {"id":"car","kind":"exterior","mask":"mask.png",
                 "expected_x":[.2,.8],"tolerance":.05}]}))
            with patch("real_photo_qa._contact_centers",return_value=(.21,.79)):
                self.assertTrue(evaluate(path)["passed"])
            with patch("real_photo_qa._contact_centers",return_value=(.21,.22)):
                self.assertFalse(evaluate(path)["passed"])


if __name__=="__main__":
    unittest.main()
