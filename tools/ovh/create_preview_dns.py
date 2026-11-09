#!/usr/bin/env python3
"""Create only the preview A record, without touching any existing DNS record."""
import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.request

API = "https://eu.api.ovh.com/1.0"
ZONE = "carvamo.com"
SUBDOMAIN = "preview"
TARGET = "146.59.52.16"
KEY = os.environ["OVH_APPLICATION_KEY"]
SECRET = os.environ["OVH_APPLICATION_SECRET"]
CONSUMER = os.environ["OVH_CONSUMER_KEY"]

def call(method, path, payload=None):
    url = API + path
    body = "" if payload is None else json.dumps(payload, separators=(",", ":"))
    timestamp = str(int(time.time()))
    signature = "$1$" + hashlib.sha1(
        "+".join((SECRET, CONSUMER, method, url, body, timestamp)).encode()
    ).hexdigest()
    headers = {
        "X-Ovh-Application": KEY,
        "X-Ovh-Consumer": CONSUMER,
        "X-Ovh-Timestamp": timestamp,
        "X-Ovh-Signature": signature,
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body.encode() if payload is not None else None,
                                 headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as exc:
        print(f"OVH API returned HTTP {exc.code} for {method} {path}; no further changes attempted.", file=sys.stderr)
        sys.exit(1)

# Read existing records first. Never overwrite any existing record, including CNAME.
ids = call("GET", f"/domain/zone/{ZONE}/record?subDomain={SUBDOMAIN}")
if ids:
    details = [call("GET", f"/domain/zone/{ZONE}/record/{rid}") for rid in ids]
    if len(details) == 1 and details[0].get("fieldType") == "A" and details[0].get("target") == TARGET:
        print(f"DNS already configured: {SUBDOMAIN}.{ZONE} -> {TARGET}")
        sys.exit(0)
    print("BLOCKED: preview has existing DNS records. Manual review required; no records modified.", file=sys.stderr)
    sys.exit(1)

call("POST", f"/domain/zone/{ZONE}/record", {
    "fieldType": "A", "subDomain": SUBDOMAIN, "target": TARGET, "ttl": 300
})
call("POST", f"/domain/zone/{ZONE}/refresh")
print(f"Created DNS A record: {SUBDOMAIN}.{ZONE} -> {TARGET}")
