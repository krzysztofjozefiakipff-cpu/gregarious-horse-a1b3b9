"""Offline contract tests: no network calls or real credentials."""
import io
import unittest
from unittest.mock import Mock
from PIL import Image
from ovh_transport import OVHTransport, TransportError


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.http = Mock()
        self.transport = OVHTransport("https://private.example.test", "x"*40, self.http)

    def test_requires_https(self):
        with self.assertRaisesRegex(ValueError, "photo_api_https_required"):
            OVHTransport("http://private.example.test", "x"*40, self.http)

    def test_claim_requires_job_shape(self):
        response = Mock(ok=True)
        response.json.return_value = {"job": {"job_id": "123"}}
        self.http.request.return_value = response
        self.assertEqual(self.transport.claim()["job_id"], "123")
        self.assertEqual(self.http.request.call_args.kwargs["allow_redirects"], False)

    def test_download_is_authenticated_and_bounded(self):
        buf = io.BytesIO()
        Image.new("RGB", (40, 30), "red").save(buf, format="PNG")
        response = Mock(ok=True)
        response.iter_content.return_value = iter([buf.getvalue()])
        self.http.request.return_value = response
        self.assertEqual(self.transport.download("job1").size, (40, 30))
        args = self.http.request.call_args
        self.assertIn("/jobs/job1/original", args.args[1])
        self.assertIn("Authorization", args.kwargs["headers"])

    def test_rejects_oversized_download(self):
        response = Mock(ok=True)
        response.iter_content.return_value = iter([b"x"*6_000_001])
        self.http.request.return_value = response
        with self.assertRaisesRegex(ValueError, "source_size_limit"):
            self.transport.download("job1")
        response.close.assert_called_once()

    def test_fail_sanitizes_error(self):
        response = Mock(ok=True)
        response.json.return_value = {"ok": True}
        self.http.request.return_value = response
        self.transport.fail("job1", "lease", "https://secret.example/token")
        self.assertEqual(self.http.request.call_args.kwargs["json"]["error_code"], "processing_failed")


if __name__ == "__main__":
    unittest.main()
