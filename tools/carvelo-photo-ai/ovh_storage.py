"""OVH Object Storage (S3-compatible) adapter for CARVAMO Photo AI.

This module is intentionally independent of the legacy Supabase worker.
Credentials are read only from environment variables; never commit secrets.
No production traffic is switched until the worker and job queue are migrated.
"""
from __future__ import annotations

import io
import os
from dataclasses import dataclass
from typing import BinaryIO


@dataclass(frozen=True)
class StorageConfig:
    endpoint: str
    region: str
    bucket_originals: str
    bucket_processed: str
    access_key: str
    secret_key: str

    @classmethod
    def from_env(cls) -> "StorageConfig":
        keys = {
            "endpoint": "CARVAMO_OVH_S3_ENDPOINT",
            "region": "CARVAMO_OVH_S3_REGION",
            "bucket_originals": "CARVAMO_OVH_S3_ORIGINALS_BUCKET",
            "bucket_processed": "CARVAMO_OVH_S3_PROCESSED_BUCKET",
            "access_key": "CARVAMO_OVH_S3_ACCESS_KEY",
            "secret_key": "CARVAMO_OVH_S3_SECRET_KEY",
        }
        values = {field: os.environ.get(env, "").strip() for field, env in keys.items()}
        missing = [keys[field] for field, value in values.items() if not value]
        if missing:
            raise ValueError("missing_ovh_storage_configuration:" + ",".join(missing))
        if not values["endpoint"].startswith("https://"):
            raise ValueError("ovh_storage_endpoint_must_use_https")
        return cls(**values)


def validate_key(key: str) -> str:
    """Reject ambiguous paths, control characters and unsafe object keys."""
    if not isinstance(key, str) or not key or len(key) > 1024:
        raise ValueError("invalid_object_key")
    parts = key.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("invalid_object_key")
    if any(ord(ch) < 32 or ord(ch) == 127 for ch in key):
        raise ValueError("invalid_object_key")
    return key


class OVHPhotoStorage:
    def __init__(self, config: StorageConfig, client=None):
        self.config = config
        if client is None:
            try:
                import boto3
            except ImportError as exc:
                raise RuntimeError("boto3_required_for_ovh_storage") from exc
            client = boto3.client(
                "s3",
                endpoint_url=config.endpoint,
                region_name=config.region,
                aws_access_key_id=config.access_key,
                aws_secret_access_key=config.secret_key,
            )
        self.client = client

    def download_original(self, key: str, max_bytes: int = 6_000_000) -> bytes:
        if max_bytes < 1:
            raise ValueError("invalid_size_limit")
        obj = self.client.get_object(
            Bucket=self.config.bucket_originals, Key=validate_key(key)
        )
        try:
            length = obj.get("ContentLength")
            if length is not None and int(length) > max_bytes:
                raise ValueError("source_size_limit")
            data = obj["Body"].read(max_bytes + 1)
            if len(data) > max_bytes:
                raise ValueError("source_size_limit")
            return data
        finally:
            obj["Body"].close()

    def upload_processed(self, key: str, data: bytes, content_type: str = "image/webp") -> None:
        if not isinstance(data, bytes) or not data:
            raise ValueError("empty_processed_photo")
        if content_type not in ("image/webp", "image/jpeg", "image/png"):
            raise ValueError("unsupported_processed_content_type")
        self.client.put_object(
            Bucket=self.config.bucket_processed,
            Key=validate_key(key),
            Body=data,
            ContentType=content_type,
        )
