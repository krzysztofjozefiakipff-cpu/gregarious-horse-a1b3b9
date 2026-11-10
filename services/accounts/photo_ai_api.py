"""Private CARVAMO photo AI endpoints; mount only behind OVH HTTPS reverse proxy."""
import hashlib
import io
import os
import re
import secrets
import uuid
from pathlib import Path

import psycopg
from flask import Blueprint, abort, jsonify, request, send_file
from PIL import Image, UnidentifiedImageError

bp = Blueprint("photo_ai", __name__, url_prefix="/api/internal/photo-ai")
MAX_INPUT = 6_000_000
MAX_OUTPUT = 6_500_000


def db():
    return psycopg.connect(os.environ["DATABASE_URL"])


def authorize():
    expected = os.environ.get("CARVAMO_PHOTO_WORKER_TOKEN", "")
    provided = request.headers.get("Authorization", "")
    if len(expected) < 32 or not secrets.compare_digest(provided, "Bearer " + expected):
        abort(401)


def confined(root, rel):
    base = Path(root).resolve()
    target = (base / rel).resolve()
    if not target.is_relative_to(base):
        abort(400)
    return target


def lease_job(conn, job_id, lease):
    return conn.execute(
        """SELECT j.id,j.photo_id,j.state,p.original_path
           FROM photo_jobs j JOIN offer_photos p ON p.id=j.photo_id
           WHERE j.id=%s AND j.state='processing'
             AND j.lease_token_hash=%s AND j.lease_expires_at>now()
           FOR UPDATE OF j""",
        (job_id, hashlib.sha256(lease.encode()).hexdigest()),
    ).fetchone()


@bp.post("/claim")
def claim():
    authorize()
    with db() as conn:
        row = conn.execute(
            """SELECT j.id,j.photo_id,j.target_mode,p.offer_id
               FROM photo_jobs j JOIN offer_photos p ON p.id=j.photo_id
               WHERE (j.state='queued' OR
                      (j.state='processing' AND j.lease_expires_at<now()))
                 AND j.attempts<3
               ORDER BY j.created_at,j.id FOR UPDATE OF j SKIP LOCKED LIMIT 1"""
        ).fetchone()
        if not row:
            return jsonify(job=None)
        jid,pid,mode,offer_id = row
        lease = secrets.token_urlsafe(32)
        conn.execute(
            """UPDATE photo_jobs SET state='processing',attempts=attempts+1,
               lease_token_hash=%s,lease_expires_at=now()+interval '15 minutes',
               started_at=now(),progress_stage='processing'
               WHERE id=%s""",
            (hashlib.sha256(lease.encode()).hexdigest(),jid),
        )
    return jsonify(job={"job_id":str(jid),"photo_id":str(pid),
                        "offer_id":str(offer_id),"target_mode":mode,
                        "lease_token":lease})


@bp.get("/jobs/<uuid:job_id>/original")
def original(job_id):
    authorize()
    # The worker sends lease as a header; only the current lease can download.
    lease = request.headers.get("X-Photo-Lease", "")
    if not lease:
        abort(403)
    with db() as conn:
        row = lease_job(conn,job_id,lease)
    if not row:
        abort(403)
    root = os.environ["CARVAMO_PHOTO_ORIGINALS_DIR"]
    path = confined(root,row[3])
    if not path.is_file() or path.stat().st_size>MAX_INPUT:
        abort(404)
    return send_file(path, mimetype="application/octet-stream")


@bp.post("/jobs/<uuid:job_id>/complete")
def complete(job_id):
    authorize()
    lease = request.form.get("lease_token","")
    f = request.files.get("file")
    if not lease or f is None:
        abort(400)
    payload = f.stream.read(MAX_OUTPUT+1)
    if len(payload)>MAX_OUTPUT or not payload.startswith(bytes.fromhex("89504e470d0a1a0a")):
        abort(400)
    try:
        with Image.open(io.BytesIO(payload)) as candidate:
            if candidate.format != "PNG" or candidate.width * candidate.height > 12_000_000:
                abort(400)
            candidate.verify()
    except (UnidentifiedImageError, OSError, ValueError):
        abort(400)
    with db() as conn:
        row = lease_job(conn,job_id,lease)
        if not row:
            abort(409)
        photo_id = row[1]
        rel = str(photo_id)+"/"+str(job_id)+".png"
        path = confined(os.environ["CARVAMO_PHOTO_CANDIDATES_DIR"],rel)
        path.parent.mkdir(parents=True,exist_ok=True)
        # Unique path per job. Avoid overwrite when request is retried.
        with path.open("xb") as dest:
            dest.write(payload)
        try:
            conn.execute(
                """INSERT INTO photo_versions(photo_id,job_id,candidate_path,metadata)
                   VALUES (%s,%s,%s,%s::jsonb)""",
                (photo_id,job_id,rel,"{}"),
            )
            conn.execute(
                """UPDATE photo_jobs SET state='review',candidate_path=%s,
                   completed_at=now(),finished_at=now(),progress_percent=100,
                   progress_stage='review',lease_token_hash=NULL,lease_expires_at=NULL
                   WHERE id=%s""",(rel,job_id),
            )
        except Exception:
            path.unlink(missing_ok=True)
            raise
    return jsonify(ok=True,state="review")


@bp.post("/jobs/<uuid:job_id>/fail")
def fail(job_id):
    authorize()
    data=request.get_json(silent=True) or {}
    lease=data.get("lease_token","")
    error=data.get("error_code","processing_failed")
    if not re.fullmatch(r"[a-z][a-z0-9_]{0,79}",error):
        error="processing_failed"
    with db() as conn:
        row=lease_job(conn,job_id,lease)
        if not row:
            abort(409)
        conn.execute(
            """UPDATE photo_jobs SET state='failed',error_code=%s,
               finished_at=now(),lease_token_hash=NULL,lease_expires_at=NULL
               WHERE id=%s""",(error,job_id),
        )
    return jsonify(ok=True,state="failed")
