"""Read-only OVH S3 connectivity check; requires configured environment secrets."""
import sys
from ovh_storage import OVHPhotoStorage, StorageConfig


def main():
    try:
        storage = OVHPhotoStorage(StorageConfig.from_env())
        for bucket in {storage.config.bucket_originals, storage.config.bucket_processed}:
            storage.client.head_bucket(Bucket=bucket)
    except Exception as exc:
        print("OVH storage probe failed: " + type(exc).__name__, file=sys.stderr)
        return 1
    print("OVH storage probe passed: both buckets accessible")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
