"""Opt-in CARVAMO OVH photo worker; never reads legacy Supabase configuration."""
import io
import os
import time
from PIL import Image
from ovh_transport import OVHTransport
from persistent_worker import session, SCENE, LOGO
from studio_compose import render_scene, compose_grounded_vehicle, add_official_logo
from rembg import remove


def process(job, transport):
    job_id = job["job_id"]
    lease = job["lease_token"]
    mode = job["target_mode"]
    photo = transport.download(job_id, lease)
    if mode == "showroom_exterior":
        raw = io.BytesIO()
        photo.convert("RGB").save(raw, format="PNG")
        with Image.open(io.BytesIO(remove(raw.getvalue(), session=session()))) as fg:
            foreground = fg.convert("RGBA")
        import numpy as np
        matte = np.asarray(foreground.getchannel("A"), dtype=np.uint8)
        coverage = float((matte > 48).mean())
        if not (.12 <= coverage <= .86) or float((matte > 238).mean()) < .08:
            raise ValueError("mask_quality_unreliable")
        scene = render_scene(SCENE, photo.size)
        result, placement = compose_grounded_vehicle(foreground, scene, source_photo=photo)
        if not placement["wheel_grounded"]:
            raise ValueError("wheel_grounding_unsafe")
        # This legacy scene already has wall branding; review CARVAMO branding before activation.
    elif mode == "showroom_windows":
        from interior_windows import process_interior_windows, UnsafeWindowMask
        try:
            result, _ = process_interior_windows(photo, render_scene(SCENE, photo.size))
        except UnsafeWindowMask:
            result = photo.copy()
        result = add_official_logo(result, LOGO)
    else:
        raise ValueError("unsupported_job_mode")
    output = io.BytesIO()
    result.convert("RGB").save(output, format="PNG", optimize=True)
    return transport.complete(job_id, lease, output.getvalue(), {"scene_version": "studio-v5"})


def main():
    if os.environ.get("CARVAMO_OVH_WORKER_ENABLED") != "true":
        raise RuntimeError("OVH photo worker disabled until backend and brand assets are verified")
    transport = OVHTransport()
    while True:
        job = transport.claim()
        if job is None:
            time.sleep(5)
            continue
        try:
            process(job, transport)
        except Exception as exc:
            code = str(exc) if isinstance(exc, ValueError) else "processing_failed"
            try:
                transport.fail(job["job_id"], job["lease_token"], code)
            except Exception:
                print("CARVAMO fail callback failed", flush=True)


if __name__ == "__main__":
    main()
