"""Offline worker-to-OVH storage integration contract tests.

Exercise the actual persistent_worker functions without importing heavy ML dependencies
or connecting to a real database, S3 bucket, or Supabase endpoint.
"""
import ast
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from ovh_storage import OVHPhotoStorage, StorageConfig

CONFIG = StorageConfig(
    endpoint="https://s3.example.invalid", region="gra",
    bucket_originals="originals", bucket_processed="processed",
    access_key="fake", secret_key="fake",
)


class MemoryS3:
    def __init__(self):
        self.objects = {"originals": {}, "processed": {}}

    def get_object(self, Bucket, Key):
        data = self.objects[Bucket][Key]
        return {"ContentLength": len(data), "Body": io.BytesIO(data)}

    def put_object(self, Bucket, Key, Body, ContentType):
        self.objects[Bucket][Key] = Body

    def delete_object(self, Bucket, Key):
        self.objects[Bucket].pop(Key, None)


def load_worker_storage_functions(storage):
    """Load only the actual worker storage functions, excluding ML imports."""
    tree = ast.parse((ROOT / "persistent_worker.py").read_text(encoding="utf-8"))
    names = {"get_photo", "upload", "remove_uploaded"}
    functions = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    module = ast.Module(body=functions, type_ignores=[])
    namespace = {
        "STORAGE_BACKEND": "ovh",
        "ovh_storage": lambda: storage,
        "MAX_BYTES": 6_000_000,
        "MAX_PIXELS": 12_000_000,
        "io": io,
        "Image": Image,
        "ImageOps": __import__("PIL.ImageOps", fromlist=["ImageOps"]),
    }
    exec(compile(ast.fix_missing_locations(module), str(ROOT / "persistent_worker.py"), "exec"), namespace)
    return namespace


class WorkerStorageIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = MemoryS3()
        self.storage = OVHPhotoStorage(CONFIG, self.client)
        self.worker = load_worker_storage_functions(self.storage)

    def test_real_worker_download_and_upload(self):
        original = io.BytesIO()
        Image.new("RGB", (48, 32), "blue").save(original, format="PNG")
        self.client.objects["originals"]["offer/photo/original.png"] = original.getvalue()
        image = self.worker["get_photo"]("offer/photo/original.png")
        self.assertEqual(image.size, (48, 32))
        self.assertEqual(image.mode, "RGBA")
        self.worker["upload"]("offer/photo/ai/result.png", original.getvalue())
        self.assertEqual(
            self.client.objects["processed"]["offer/photo/ai/result.png"],
            original.getvalue(),
        )

    def test_real_worker_failure_cleanup(self):
        self.worker["upload"]("offer/photo/ai/result.png", b"output")
        self.worker["remove_uploaded"]("offer/photo/ai/result.png")
        self.assertNotIn("offer/photo/ai/result.png", self.client.objects["processed"])

    def test_invalid_source_key_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid_object_key"):
            self.worker["get_photo"]("../invalid.png")


if __name__ == "__main__":
    unittest.main()
