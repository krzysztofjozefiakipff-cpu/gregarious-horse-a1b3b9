#!/usr/bin/env python3
"""CARVELO resident photo worker.

Runs on a private Docker worker host. No GitHub OIDC is required: the worker
holds a privileged DATABASE_URL and Supabase service key in HOST SECRETS ONLY.
GitHub Actions remains the fallback until the host is explicitly provisioned.
"""
from __future__ import annotations
import io
import os
import secrets
import time
import uuid
from pathlib import Path
from urllib.parse import quote
from functools import lru_cache

import psycopg
import requests
from PIL import Image, ImageOps
from rembg import remove, new_session
from studio_compose import render_scene, compose_grounded_vehicle, add_official_logo

ROOT = Path(__file__).resolve().parents[2]
SCENE = ROOT/"assets/brand/carvelo-showroom-empty-v5.webp"
LOGO = ROOT/"assets/brand/carvelo-wordmark-on-dark.svg"
SHOWROOM_3D_DIR = Path(os.getenv("CARVELO_SHOWROOM_3D_DIR", str(ROOT/"assets/brand/carvelo-showroom-3d")))
SHOWROOM_3D_ENABLED = os.getenv("CARVELO_SHOWROOM_3D_ENABLED", "false").lower() == "true"
DATABASE_URL = os.environ.get("CARVELO_DATABASE_URL","")
SUPABASE_URL = os.environ.get("CARVELO_SUPABASE_URL","").rstrip("/")
SERVICE_KEY = os.environ.get("CARVELO_SUPABASE_SERVICE_ROLE_KEY","")
POLL_SECONDS = max(1,min(int(os.getenv("CARVELO_POLL_SECONDS","2")),60))
HEADERS = {"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY}
MAX_BYTES = 6_000_000
MAX_PIXELS = 12_000_000

@lru_cache(maxsize=1)
def session():
    return new_session("u2net")

def get_photo(path):
    url=SUPABASE_URL+"/storage/v1/object/authenticated/carvelo-photo-originals/"+quote(path,safe="/")
    resp=requests.get(url,headers=HEADERS,timeout=45)
    if not resp.ok:
        print("CARVELO storage download failed status="+str(resp.status_code)+" code="+str(resp.json().get("error",resp.json().get("code","unknown")))[:70] if resp.headers.get("content-type","").startswith("application/json") else "CARVELO storage download failed status="+str(resp.status_code),flush=True)
    resp.raise_for_status()
    if len(resp.content)>MAX_BYTES:
        raise ValueError("source_size_limit")
    with Image.open(io.BytesIO(resp.content)) as raw:
        if raw.width*raw.height>MAX_PIXELS:
            raise ValueError("source_pixel_limit")
        photo=ImageOps.exif_transpose(raw).convert("RGBA")
        photo.thumbnail((1400,1400),Image.Resampling.LANCZOS)
        return photo

def make_candidate(job, progress=None):
    print("CARVELO processing stage=download",job["job_id"],flush=True)
    photo=get_photo(job["original_path"])
    print("CARVELO processing stage=downloaded",job["job_id"],flush=True)
    if progress: progress("downloaded",30)
    changed=None
    reason=None
    if job["target_mode"]=="showroom_exterior":
        buf=io.BytesIO()
        photo.convert("RGB").save(buf,"PNG")
        print("CARVELO processing stage=segmentation",job["job_id"],flush=True)
        if progress: progress("segmentation",40)
        cut=remove(buf.getvalue(),session=session())
        print("CARVELO processing stage=segmented",job["job_id"],flush=True)
        if progress: progress("compositing",70)
        with Image.open(io.BytesIO(cut)) as fg:
            foreground=fg.convert("RGBA")
        if foreground.size!=photo.size:
            foreground=foreground.resize(photo.size,Image.Resampling.BILINEAR)
        import numpy as np
        matte=np.asarray(foreground.getchannel("A"),dtype=np.uint8)
        covered=float((matte>48).mean())
        if covered<.12 or covered>.86 or float((matte>238).mean())<.08:
            raise ValueError("mask_quality_unreliable")
        if SHOWROOM_3D_ENABLED:
            # Require a real source pose; never infer it from the alpha mask.
            from showroom_3d_adapter import load_background
            angle = job.get("source_camera_azimuth_deg")
            if angle is None:
                raise ValueError("source_camera_pose_missing")
            scene = load_background(SHOWROOM_3D_DIR, float(angle), photo.size)
        else:
            scene = render_scene(SCENE, photo.size)
        result,placement=compose_grounded_vehicle(foreground,scene,source_photo=photo)
        if not placement["wheel_grounded"]:
            raise ValueError("wheel_grounding_unsafe")
    elif job["target_mode"]=="showroom_windows":
        from interior_windows import process_interior_windows, compose_staff_window_mask, UnsafeWindowMask
        scene=render_scene(SCENE,photo.size)
        try:
            if job.get("window_polygons"):
                result,coverage=compose_staff_window_mask(photo,scene,job["window_polygons"])
            else:
                result,coverage=process_interior_windows(photo,scene)
            changed=True
        except UnsafeWindowMask:
            result=photo.copy()
            changed=False
            reason="window_mask_low_confidence"
    else:
        raise ValueError("unsupported_job_mode")
    # The approved exterior showroom already carries the official CARVELO wall sign.
    # Never add a second floating logo panel on exterior compositions.
    if job["target_mode"] != "showroom_exterior":
        result=add_official_logo(result,LOGO)
    if progress: progress("encoding",85)
    buf=io.BytesIO()
    result.convert("RGB").save(buf,format="PNG",optimize=True)
    out=buf.getvalue()
    if len(out)>6_500_000:
        raise ValueError("output_too_large")
    return out,changed,reason

def upload(path,data):
    response=requests.post(SUPABASE_URL+"/storage/v1/object/carvelo-photo-branded/"+quote(path,safe="/"),
                           headers={**HEADERS,"Content-Type":"image/png","x-upsert":"false"},
                           data=data,timeout=90)
    response.raise_for_status()

def remove_uploaded(path):
    try:
        requests.delete(SUPABASE_URL+"/storage/v1/object/carvelo-photo-branded/"+quote(path,safe="/"),
                        headers=HEADERS,timeout=20)
    except Exception:
        pass

def rpc(conn,query,values):
    with conn.cursor() as cur:
        cur.execute(query,values)
        return cur.fetchone()[0]

def update_progress(conn,job_id,run_id,stage,percent):
    with conn.cursor() as cur:
        cur.execute("update public.cv_photo_jobs set progress_stage=%s, progress_percent=%s, progress_at=now() where id=%s and state='processing' and worker_run_id=%s",(stage,percent,job_id,run_id))
    conn.commit()

def run_once(conn):
    # Numeric token matches the existing private DB claim interface.
    run_id=str(secrets.randbelow(9_000_000_000_000_000)+1_000_000_000_000_000)
    job=rpc(conn,"select public.cv_ai_claim(%s)",(run_id,))
    conn.commit()
    if not job:
        return False
    job_id=job["job_id"]
    print("CARVELO job claimed",job_id,flush=True)
    path=None
    try:
        update_progress(conn,job_id,run_id,"downloading",15)
        data,changed,reason=make_candidate(job,lambda stage,pct: update_progress(conn,job_id,run_id,stage,pct))
        path=(str(job["offer_id"])+"/"+str(job["photo_id"])+"/ai/"+str(uuid.uuid4())+".png")
        update_progress(conn,job_id,run_id,"uploading",90)
        print("CARVELO processing stage=upload",job_id,flush=True)
        upload(path,data)
        update_progress(conn,job_id,run_id,"finalizing",95)
        rpc(conn,"select public.cv_ai_complete_v3(%s,%s,%s,%s,%s,%s,%s)",
            (job_id,run_id,path,changed,None,reason,"studio-v6"))
        conn.commit()
        print("CARVELO ready for review",job_id,job["target_mode"],flush=True)
    except Exception as exc:
        conn.rollback()
        if path:
            remove_uploaded(path)
        # Never print exception text: requests errors can contain API tokens in URLs.
        safe_value_errors={"mask_quality_unreliable","wheel_grounding_unsafe","output_too_large","source_size_limit","source_pixel_limit","unsupported_job_mode","vehicle_mask_empty","vehicle_mask_invalid","vehicle_placement_overflows","wheel_contact_uncertain","wheel_detection_low_confidence","wheel_contact_misaligned","wheel_contact_unreliable","wheel_ground_plane_unreliable","wheel_contact_not_on_floor","silhouette_below_floor","showroom_reference_unexpected_size","missing_official_carvelo_logo","source_camera_pose_missing","showroom_view_angle_mismatch","showroom_views_not_configured","showroom_view_missing","showroom_view_contains_vehicle","showroom_view_path_unsafe"}
        code=str(exc) if isinstance(exc,ValueError) and str(exc) in safe_value_errors else type(exc).__name__
        print("CARVELO worker job failed",job_id,code,flush=True)
        rpc(conn,"select public.cv_ai_fail(%s,%s,%s)",(job_id,run_id,code))
        conn.commit()
    return True

def main():
    if not all((DATABASE_URL,SUPABASE_URL,SERVICE_KEY)):
        raise RuntimeError("Missing CARVELO worker host secrets")
    if not SCENE.is_file() or not LOGO.is_file():
        raise RuntimeError("Approved showroom/logo missing")
    print("CARVELO persistent worker listening",flush=True)
    while True:
        try:
            with psycopg.connect(DATABASE_URL,connect_timeout=20) as conn:
                while True:
                    if not run_once(conn):
                        time.sleep(POLL_SECONDS)
        except Exception as exc:
            # Classify connection failures without exposing database credentials,
            # hostnames or the connection URL in production logs.
            detail = str(exc).lower()
            if "password authentication failed" in detail or "invalid password" in detail:
                category = "invalid_database_password"
            elif "tenant or user not found" in detail or "role" in detail and "does not exist" in detail:
                category = "invalid_pooler_username"
            elif "name or service not known" in detail or "could not translate host name" in detail:
                category = "dns_resolution"
            elif "connection timed out" in detail or "timeout expired" in detail:
                category = "connection_timeout"
            elif "connection refused" in detail:
                category = "connection_refused"
            elif "ssl" in detail or "certificate" in detail:
                category = "tls_error"
            elif "too many connections" in detail:
                category = "pool_exhausted"
            else:
                category = "unclassified"
            print("CARVELO worker DB reconnect",type(exc).__name__,
                  "category="+category,"sqlstate="+str(getattr(exc,"sqlstate",None)),
                  flush=True)
            time.sleep(min(POLL_SECONDS*4,30))

if __name__=="__main__":
    main()
