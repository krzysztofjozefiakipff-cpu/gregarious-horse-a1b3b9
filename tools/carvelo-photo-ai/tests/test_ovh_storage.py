"""Offline regression tests for OVH photo object storage; no live credentials."""
import io
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ovh_storage import OVHPhotoStorage, StorageConfig, validate_key


CONFIG = StorageConfig(
    endpoint="https://s3.example.invalid", region="gra",
    bucket_originals="originals", bucket_processed="processed",
    access_key="fake", secret_key="fake",
)


class FakeClient:
    def __init__(self, data=b"photo"):
        self.data = data
        self.calls = []

    def get_object(self, **kwargs):
        self.calls.append(("get", kwargs))
        return {"ContentLength": len(self.data), "Body": io.BytesIO(self.data)}

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))


class StorageTests(unittest.TestCase):
    def test_key_validation(self):
        for key in ("", "/photo", "folder//photo", "../photo", "a/../b", "a/./b", "a\n"):
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate_key(key)
        self.assertEqual(validate_key("dealer/offer/photo.webp"), "dealer/offer/photo.webp")

    def test_download_limit(self):
        client = FakeClient(b"123456")
        storage = OVHPhotoStorage(CONFIG, client)
        with self.assertRaisesRegex(ValueError, "source_size_limit"):
            storage.download_original("a/b.webp", max_bytes=5)
        self.assertEqual(storage.download_original("a/b.webp", max_bytes=6), b"123456")

    def test_upload(self):
        client = FakeClient()
        storage = OVHPhotoStorage(CONFIG, client)
        storage.upload_processed("a/b.webp", b"abc")
        operation, params = client.calls[-1]
        self.assertEqual(operation, "put")
        self.assertEqual(params["Bucket"], "processed")
        self.assertEqual(params["ContentType"], "image/webp")

    def test_missing_configuration(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, "missing_ovh_storage_configuration"):
                StorageConfig.from_env()

    def test_reject_http_endpoint(self):
        env = {
            "CARVAMO_OVH_S3_ENDPOINT": "http://insecure.example",
            "CARVAMO_OVH_S3_REGION": "gra",
            "CARVAMO_OVH_S3_ORIGINALS_BUCKET": "originals",
            "CARVAMO_OVH_S3_PROCESSED_BUCKET": "processed",
            "CARVAMO_OVH_S3_ACCESS_KEY": "fake",
            "CARVAMO_OVH_S3_SECRET_KEY": "fake",
        }
        with patch.dict(os.environ, env, clear=True):
            with self.assertRaisesRegex(ValueError, "ovh_storage_endpoint_must_use_https"):
                StorageConfig.from_env()


if __name__ == "__main__":
    unittest.main()
