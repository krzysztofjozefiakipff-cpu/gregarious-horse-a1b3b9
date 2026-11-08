#!/usr/bin/env python3
"""CARVELO external-photo background processor.

Consumes private Supabase pgmq queue. Runs a commercially permitted model
with rembg (explicit U2Net selection; do not use BRIA's non-commercial default).
The approved showroom reference is a local immutable image, NEVER regenerated.
All output is private and needs administrator approval before publication.
"""
import io, os, sys, time, uuid, json, traceback, hashlib
from pathlib import Path
from PIL import Image, ImageOps
import psycopg
from psycopg.rows import dict_row
import requests
from rembg import remove, new_session
import cairosvg

QUEUE = "carvelo_photo_ai"
SCENE = Path(os.getenv("CARVELO_SHOWROOM_FILE", "assets/brand/carvelo-showroom-v1.png"))
LOGO = Path(os.getenv("CARVELO_LOGO_FILE", "assets/brand/carvelo-wordmark-on-dark.svg"))
EXPECTED_SCENE_SHA = os.getenv("CARVELO_SHOWROOM_SHA256", "")
DATABASE_URL = os.getenv("CARVELO_DATABASE_URL", "")
SUPABASE_URL = os.getenv("CARVELO_SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE = os.getenv("CARVELO_SUPABASE_SERVICE_ROLE_KEY", "")
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 12_000_000

if not DATABASE_URL or not SUPABASE_URL or not SUPABASE_SERVICE:
    raise RuntimeError("Brak sekretów środowiska — worker nie uruchomi się bez prywatnych kluczy")
if not SCENE.is_file() or not LOGO.is_file():
    raise RuntimeError("Brak zatwierdzonego wzorca salonu lub oficjalnego logo CARVELO")
if EXPECTED_SCENE_SHA and hashlib.sha256(SCENE.read_bytes()).hexdigest() != EXPECTED_SCENE_SHA:
    raise RuntimeError("Niezgodny SHA-256 wzorca salonu CARVELO")

SESSION = new_session("u2net")  # Apache-2.0 U2Net weights, instead of BRIA non-commercial default
LOGO_SVG = LOGO.read_bytes()
SCENE_RGB = Image.open(SCENE).convert("RGB")
headers = {"apikey": SUPABASE_SERVICE, "Authorization": "Bearer " + SUPABASE_SERVICE}

def decode_safely(payload: bytes) -> Image.Image:
    if len(payload) > MAX_IMAGE_BYTES:
        raise ValueError("too_large")
    with Image.open(io.BytesIO(payload)) as image:
        if image.width * image.height > MAX_PIXELS:
            raise ValueError("pixel_limit")
        image = ImageOps.exif_transpose(image).convert("RGBA")
        image.thumbnail((1400, 1400), Image.Resampling.LANCZOS)
        return image

def get_object(bucket: str, path: str) -> bytes:
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    result = requests.get(url, headers=headers, timeout=40)
    result.raise_for_status()
    return result.content

def put_object(bucket: str, path: str, payload: bytes) -> None:
    url = f"{SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
    result = requests.post(url, headers={**headers, "Content-Type": "image/png", "x-upsert": "false"},
                           data=payload, timeout=45)
    result.raise_for_status()

def apply_showroom(photo: Image.Image) -> tuple[Image.Image, float]:
    # Keep all vehicle pixels, including paintwork, wheels and interior details, from the source.
    # AI only computes an alpha matte; it does NOT regenerate the vehicle.
    buf = io.BytesIO()
    photo.convert("RGB").save(buf, format="PNG")
    masked = remove(buf.getvalue(), session=SESSION)
    with Image.open(io.BytesIO(masked)) as raw_masked:
        car = raw_masked.convert("RGBA")
    if car.size != photo.size:
        car = car.resize(photo.size, Image.Resampling.BILINEAR)
    alpha = car.getchannel("A")
    hist = alpha.histogram()
    covered = sum(hist[48:]) / max(1, photo.width * photo.height)
    if covered < .10 or covered > .88:
        raise ValueError("mask_coverage_unreliable")
    # Disable fully-automatic publication and skip scenes where transparency is uncertain.
    # Photo is center-placed without aspect-ratio distortion; exterior only.
    background = ImageOps.fit(SCENE_RGB, photo.size, method=Image.Resampling.LANCZOS).convert("RGBA")
    background.alpha_composite(car)
    return background, float(covered)

def brand(image: Image.Image) -> bytes:
    width = image.width
    logo_width = max(110, min(320, round(width * .20)))
    raster = cairosvg.svg2png(bytestring=LOGO_SVG, output_width=logo_width)
    with Image.open(io.BytesIO(raster)) as li:
        logo = li.convert("RGBA")
    pad = max(12, round(width * .025))
    boxpadx, boxpady = 14, 10
    x = max(0, image.width - logo.width - 2 * boxpadx - pad)
    y = max(0, image.height - logo.height - 2 * boxpady - pad)
    surface = image.copy().convert("RGBA")
    from PIL import ImageDraw
    ImageDraw.Draw(surface, "RGBA").rounded_rectangle(
        (x, y, x + logo.width + 2*boxpadx, y + logo.height + 2*boxpady),
        radius=11, fill=(7, 24, 39, 209)
    )
    surface.alpha_composite(logo, (x+boxpadx, y+boxpady))
    out = io.BytesIO()
    surface.convert("RGB").save(out, "PNG", optimize=True)
    return out.getvalue()

def receive_one(conn):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select * from pgmq.read(%s, %s, %s)", (QUEUE, 900, 1))
        r = cur.fetchone()
    conn.commit()
    return r

def archive(conn, mid):
    with conn.cursor() as cur:
        cur.execute("select pgmq.archive(%s,%s)", (QUEUE, mid))
    conn.commit()

def run_one(conn, message):
    mid, payload = message["msg_id"], message["message"]
    job_id = payload.get("job_id")
    if not isinstance(job_id, str):
        archive(conn, mid); return
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select j.*,p.original_path,p.offer_id,p.photo_type,p.state as photo_state,"
                    "o.status as offer_status from public.cv_photo_jobs j "
                    "join public.cv_offer_photos p on j.photo_id=p.id "
                    "join public.cv_offers o on o.id=p.offer_id where j.id=%s for update of j",
                    (job_id,))
        job = cur.fetchone()
        if not job or job["state"] in ("review","completed","cancelled","failed"):
            conn.commit(); archive(conn, mid); return
        if job["attempts"] >= 3:
            cur.execute("update public.cv_photo_jobs set state='failed',error_code='attempts_exhausted',finished_at=now() where id=%s", (job_id,))
            conn.commit(); archive(conn, mid); return
        cur.execute("update public.cv_photo_jobs set state='processing',attempts=attempts+1,started_at=now(),provider='local_u2net' where id=%s", (job_id,))
    conn.commit()

    try:
        if job["target_mode"] != "showroom_exterior":
            raise ValueError("window_segmentation_not_ready")
        if job["photo_type"] != "exterior":
            raise ValueError("not_classified_exterior")
        if job["offer_status"] == "published":
            raise ValueError("offer_must_be_unpublished")
        original_data = get_object("carvelo-photo-originals", job["original_path"])
        photo = decode_safely(original_data)
        result, coverage = apply_showroom(photo)
        output = brand(result)
        version_id = str(uuid.uuid4())
        object_key = f"{job['offer_id']}/{job['photo_id']}/ai/{version_id}.png"
        put_object("carvelo-photo-branded", object_key, output)
        with conn.cursor() as cur:
            cur.execute(
                "insert into public.cv_photo_versions (id,photo_id,result_path,mode,logo_version,"
                "logo_applied,qa_status,original_pixels_preserved,scene_version) "
                "values (%s,%s,%s,'showroom_exterior','carvelo-v1',true,'review',true,'showroom-v1')",
                (version_id,job["photo_id"],object_key)
            )
            cur.execute(
                "update public.cv_photo_jobs set state='review',result_version_id=%s,finished_at=now(),"
                "error_code=null where id=%s",
                (version_id,job_id)
            )
        conn.commit(); archive(conn, mid)
        print(f"READY_FOR_REVIEW job={job_id} photo={job['photo_id']} coverage={coverage:.3f}")
    except Exception as exc:
        code=str(exc)[:120]
        conn.rollback()
        with conn.cursor() as cur:
            cur.execute(
              "update public.cv_photo_jobs set state=case when attempts>=3 then 'failed' else 'queued' end,"
              "error_code=%s,finished_at=case when attempts>=3 then now() else null end where id=%s returning attempts",
              (code,job_id)
            )
            attempts=cur.fetchone()[0]
        conn.commit()
        if attempts>=3: archive(conn,mid)
        print(f"RETRY job={job_id} attempt={attempts} error={code}",file=sys.stderr)

def main():
    with psycopg.connect(DATABASE_URL, autocommit=False) as conn:
        print("CARVELO worker started. Window-compositing is reserved for a separate validated model.")
        while True:
            message=receive_one(conn)
            if message:
                run_one(conn,message)
            elif os.environ.get("CARVELO_RUN_ONCE","0")=="1":
                return
            else:
                time.sleep(10)

if __name__=="__main__":
    main()
