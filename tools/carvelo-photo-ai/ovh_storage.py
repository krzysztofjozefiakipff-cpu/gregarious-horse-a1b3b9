"""Private S3 storage for the OVH candidate worker; no public ACLs or URLs."""
import os
from urllib.parse import urlsplit

MAX_BYTES = 6_000_000

class OVHStorage:
    def __init__(self, client=None):
        self.originals = os.environ['CARVAMO_S3_ORIGINALS_BUCKET']
        self.results = os.environ['CARVAMO_S3_RESULTS_BUCKET']
        endpoint = os.environ['CARVAMO_S3_ENDPOINT']
        parsed = urlsplit(endpoint)
        if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('invalid_s3_endpoint')
        if self.originals == self.results:
            raise ValueError('separate_storage_buckets_required')
        if client is None:
            import boto3
            from botocore.config import Config
            client = boto3.client('s3', endpoint_url=endpoint,
                region_name=os.environ['CARVAMO_S3_REGION'],
                config=Config(signature_version='s3v4', retries={'max_attempts': 3, 'mode': 'standard'},
                              connect_timeout=10, read_timeout=45))
        self.client = client

    @staticmethod
    def key(path):
        if not isinstance(path, str) or not path or path.startswith('/') or '\\' in path or any(x in ('', '.', '..') for x in path.split('/')):
            raise ValueError('unsafe_storage_key')
        return path

    def download(self, path):
        response = self.client.get_object(Bucket=self.originals, Key=self.key(path))
        body = response['Body']
        try:
            if response.get('ContentLength', 0) > MAX_BYTES:
                raise ValueError('source_size_limit')
            data = body.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError('source_size_limit')
            return data
        finally:
            body.close()

    def upload(self, path, data):
        self.client.put_object(Bucket=self.results, Key=self.key(path), Body=data,
                               ContentType='image/png', IfNoneMatch='*')

    def remove(self, path):
        self.client.delete_object(Bucket=self.results, Key=self.key(path))
