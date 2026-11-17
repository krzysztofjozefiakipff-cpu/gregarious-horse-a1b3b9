#!/usr/bin/env python3
"""CARVAMO: isolated Bria automotive API pilot. Never runs in production by default.

Usage:
  python3 tools/carvamo-photo-ai/bria_pilot.py --image-url https://.../car.jpg --dry-run
  BRIA_API_TOKEN=... python3 tools/carvamo-photo-ai/bria_pilot.py --image-url https://.../car.jpg --execute

Only use approved HTTPS image URLs; do not commit tokens. Pilot results require visual approval.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request

ENDPOINT = "https://engine.prod.bria-api.com/v1/product/vehicle/shot_by_text"
SCENE = ("Photorealistic premium automotive showroom with deep navy walls, "
         "white linear ceiling LED rails, vertical white wall lights, "
         "soft turquoise wall wash, glossy dark reflective floor. "
         "Preserve the exact vehicle model, paint, wheels and details.")

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--image-url", required=True, help="Approved public HTTPS vehicle photo URL")
    p.add_argument("--execute", action="store_true", help="Actually call paid/external API")
    p.add_argument("--dry-run", action="store_true", help="Validate and print safe request preview")
    p.add_argument("--output", default="bria_pilot_result.json")
    a = p.parse_args()
    parsed = urllib.parse.urlparse(a.image_url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        p.error("Image URL must be an HTTPS URL without credentials")
    if not a.execute and not a.dry_run:
        p.error("Choose --dry-run or --execute explicitly")
    if a.execute and a.dry_run:
        p.error("Choose only one mode")
    payload = {
        "image_url": a.image_url,
        "mode": "high_control",
        "scene_description": SCENE,
        "placement_type": "original",
        "num_results": 1,
        "original_quality": True,
        "optimize_description": False,
        "sync": True,
    }
    if a.dry_run:
        print(json.dumps({"mode": "DRY_RUN", "endpoint": ENDPOINT,
                          "payload": payload, "cost": "No API call made"}, indent=2))
        return
    token = os.environ.get("BRIA_API_TOKEN")
    if not token:
        p.error("BRIA_API_TOKEN not configured; no request sent")
    req = urllib.request.Request(
        ENDPOINT, data=json.dumps(payload).encode("utf-8"), method="POST",
        headers={"api_token": token, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=150) as resp:
            data = json.load(resp)
    except Exception as e:
        print(f"Bria pilot failed: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)
    with open(a.output, "w", encoding="utf-8") as f:
        json.dump({"provider": "bria", "status": "AWAITING_VISUAL_QA",
                   "ready_for_publication": False, "response": data}, f, indent=2)
    print("Saved pilot response; image requires visual QA:", a.output)

if __name__ == "__main__":
    main()
