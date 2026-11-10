"""CARVAMO worker transport for a future private OVH API.

No Supabase dependencies. Endpoints are a proposed contract, not live routes.
Do not enable until OVH server implements authenticated, scoped, leased jobs.
"""
import io
import os
from urllib.parse import urlparse

import requests
from PIL import Image, ImageOps

MAX_BYTES = 6_000_000
MAX_PIXELS = 12_000_000


class TransportError(RuntimeError):
    pass


class OVHTransport:
    def __init__(self, base_url=None, token=None, session=None):
        self.base_url = (base_url or os.environ.get("CARVAMO_PHOTO_API_URL", "")).rstrip("/")
        self.token = token or os.environ.get("CARVAMO_PHOTO_WORKER_TOKEN", "")
        parsed = urlparse(self.base_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("photo_api_https_required")
        if not self.token or len(self.token) < 32:
            raise ValueError("photo_worker_token_missing")
        self.http = session or requests.Session()

    def _request(self, method, route, **kwargs):
        response = self.http.request(
            method, self.base_url + route,
            headers={"Authorization": "Bearer " + self.token, **kwargs.pop("headers", {})},
            timeout=kwargs.pop("timeout", 30), allow_redirects=False, **kwargs
        )
        if not response.ok:
            raise TransportError("photo_api_http_" + str(response.status_code))
        return response

    def claim(self):
        response = self._request("POST", "/api/internal/photo-ai/claim", json={})
        payload = response.json()
        if not isinstance(payload, dict) or not isinstance(payload.get("job"), (dict, type(None))):
            raise TransportError("photo_api_invalid_claim")
        return payload["job"]

    def download(self, job_id):
        # Download through the authenticated backend, not an arbitrary URL from a job.
        response = self._request("GET", "/api/internal/photo-ai/jobs/" + str(job_id) + "/original", timeout=55, stream=True)
        data = bytearray()
        try:
            for chunk in response.iter_content(65536):
                data.extend(chunk)
                if len(data) > MAX_BYTES:
                    raise ValueError("source_size_limit")
        finally:
            response.close()
        with Image.open(io.BytesIO(data)) as raw:
            if raw.width * raw.height > MAX_PIXELS:
                raise ValueError("source_pixel_limit")
            photo = ImageOps.exif_transpose(raw).convert("RGBA")
            photo.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
            return photo

    def complete(self, job_id, lease_token, png_bytes, metadata):
        if len(png_bytes) > 6_500_000:
            raise ValueError("output_too_large")
        # API must enforce lease ownership, idempotency, and review-only state.
        response = self._request(
            "POST", "/api/internal/photo-ai/jobs/" + str(job_id) + "/complete",
            data={"lease_token": lease_token, **metadata},
            files={"file": ("candidate.png", png_bytes, "image/png")}, timeout=100,
        )
        return response.json()

    def fail(self, job_id, lease_token, error_code):
        # Only allow bounded machine-readable error codes, never exception URLs.
        import re
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,79}", error_code):
            error_code = "processing_failed"
        return self._request(
            "POST", "/api/internal/photo-ai/jobs/" + str(job_id) + "/fail",
            json={"lease_token": lease_token, "error_code": error_code}
        ).json()
