"""CARVAMO account API (OVH). No default credentials or bootstrap endpoints."""
import hashlib
import os
import smtplib
import ssl
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from threading import BoundedSemaphore, Lock
import time
import secrets
from collections import defaultdict, deque
import re
from datetime import timedelta
from functools import wraps
from flask import Flask, request, jsonify
from werkzeug.middleware.proxy_fix import ProxyFix
import psycopg
from psycopg.rows import dict_row
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

app = Flask(__name__)
app.json.ensure_ascii = False
# Only the private Caddy proxy can reach this container.
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
DATABASE_URL = os.environ["DATABASE_URL"]
SESSION_SECRET = os.environ["SESSION_SECRET"]
if len(SESSION_SECRET) < 40:
    raise RuntimeError("SESSION_SECRET must be at least 40 characters")
signer = URLSafeTimedSerializer(SESSION_SECRET, salt="carvamo-session-v1")
hasher = PasswordHasher()
reset_signer = URLSafeTimedSerializer(SESSION_SECRET, salt="carvamo-password-reset-v1")
RESET_SECONDS = 20 * 60
SMTP_USER = os.getenv("RESET_SMTP_USER")
SMTP_PASSWORD = os.getenv("RESET_SMTP_PASSWORD")
SMTP_HOST = os.getenv("RESET_SMTP_HOST")
RESET_ORIGIN = "https://preview.carvamo.com"
reset_pool = ThreadPoolExecutor(max_workers=2)
reset_slots = BoundedSemaphore(16)
reset_lock = Lock()
reset_attempts = {}
ROLES = {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}
SESSION_SECONDS = 8 * 3600
LOGIN_ATTEMPTS = defaultdict(deque)
LOGIN_LIMIT = 8
LOGIN_WINDOW = 900

def conn():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def fail(message, status=400):
    return jsonify({"error": message}), status

def credential_version_for(password_hash):
    return hashlib.sha256((password_hash or "").encode()).hexdigest()

def allow_reset_request(email):
    now = time.monotonic()
    keys = [("ip", request.remote_addr or "unknown", 8), ("email", email, 2)]
    with reset_lock:
        for key, attempts in list(reset_attempts.items()):
            while attempts and attempts[0] <= now - RESET_SECONDS:
                attempts.popleft()
            if not attempts:
                del reset_attempts[key]
        if len(reset_attempts) >= 4096:
            return False
        if any(len(reset_attempts.get((kind, value), ())) >= limit for kind, value, limit in keys):
            return False
        for kind, value, _ in keys:
            reset_attempts.setdefault((kind, value), deque()).append(now)
    return True

def send_reset_link(email):
    try:
        with conn() as db:
            user = db.execute(
                "SELECT id,email,password_hash FROM users WHERE lower(email)=%s AND enabled", (email,)
            ).fetchone()
        if not user or not user["password_hash"]:
            return
        token = reset_signer.dumps({
            "id": str(user["id"]),
            "version": credential_version_for(user["password_hash"]),
            "nonce": secrets.token_urlsafe(16),
        })
        message = EmailMessage()
        message["From"] = SMTP_USER
        message["To"] = user["email"]
        message["Subject"] = "Carvamo — reset hasła"
        message.set_content(
            "Ustaw nowe hasło do konta Carvamo. Link jest ważny 20 minut.\n\n"
            f"{RESET_ORIGIN}/accounts/#reset={token}\n\n"
            "Jeśli nie proszono o reset, zignoruj tę wiadomość.\n"
        )
        with smtplib.SMTP_SSL(SMTP_HOST, 465, context=ssl.create_default_context(), timeout=8) as smtp:
            smtp.login(SMTP_USER, SMTP_PASSWORD)
            smtp.send_message(message)
    except Exception:
        app.logger.error("Password reset delivery failed")
    finally:
        reset_slots.release()

@app.post("/api/auth/password-reset/request")
def request_password_reset():
    if not all((SMTP_HOST, SMTP_USER, SMTP_PASSWORD)):
        return fail("Reset przez e-mail jest chwilowo niedostępny.", 503)
    data = request.get_json(silent=True)
    email = str(data.get("email", "")).strip().lower() if isinstance(data, dict) else ""
    if len(email) <= 254 and re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        if allow_reset_request(email) and reset_slots.acquire(blocking=False):
            reset_pool.submit(send_reset_link, email)
    return jsonify({"ok": True}), 202

@app.post("/api/auth/password-reset/confirm")
def confirm_password_reset():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Nieprawidłowe dane resetu.")
    password, token = data.get("password"), data.get("token")
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        return fail("Nowe hasło musi mieć od 12 do 256 znaków.")
    invalid = "Link do resetu jest nieprawidłowy, wygasł lub został już użyty."
    if not isinstance(token, str) or not 1 <= len(token) <= 1024:
        return fail(invalid)
    try:
        payload = reset_signer.loads(token, max_age=RESET_SECONDS)
    except BadSignature:
        return fail(invalid)
    with conn() as db:
        user = db.execute(
            "SELECT id,password_hash FROM users WHERE id=%s AND enabled FOR UPDATE",
            (payload["id"],),
        ).fetchone()
        if not user or not secrets.compare_digest(payload["version"], credential_version_for(user["password_hash"])):
            return fail(invalid)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(user["id"]),))
        db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hasher.hash(password), user["id"]))
    return jsonify({"ok": True})

def account(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return fail("Wymagane logowanie", 401)
        try:
            payload = signer.loads(auth[7:], max_age=SESSION_SECONDS)
            uid = payload["id"]
            credential_version = payload["credential_version"]
        except (BadSignature, SignatureExpired):
            return fail("Sesja wygasła", 401)
        with conn() as db:
            user = db.execute(
                "SELECT id,email,role,dealer_id,enabled,password_hash FROM users WHERE id=%s", (uid,)
            ).fetchone()
        if not user or not user["enabled"]:
            return fail("Konto nieaktywne", 403)
        if not secrets.compare_digest(credential_version, credential_version_for(user["password_hash"])):
            return fail("Sesja została unieważniona", 401)
        user.pop("password_hash", None)
        return f(user, *args, **kwargs)
    return wrapper

def permitted(actor, role, dealer_id):
    if actor["role"] in {"admin", "staff"}:
        return (role in {"admin", "staff"} and dealer_id is None) or (
            role in {"dealer", "dealer_admin", "dealer_staff"} and dealer_id is not None
        )
    return actor["role"] == "dealer_admin" and role == "dealer_staff" and (
        dealer_id is not None and str(actor["dealer_id"]) == str(dealer_id)
    )

@app.get("/api/health")
def health():
    with conn() as db:
        db.execute("SELECT 1")
    return jsonify({"status": "ok", "service": "carvamo-accounts"})

@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if len(email) > 254 or not password:
        return fail("Nieprawidłowe dane logowania", 401)
    # Conservative per-source throttling; production deployment should also apply proxy-level limits.
    source = (request.remote_addr or "unknown") + "|" + email
    now = time.monotonic()
    attempts = LOGIN_ATTEMPTS[source]
    while attempts and attempts[0] < now - LOGIN_WINDOW:
        attempts.popleft()
    if len(attempts) >= LOGIN_LIMIT:
        return fail("Zbyt wiele prób. Spróbuj później", 429)
    attempts.append(now)
    with conn() as db:
        user = db.execute("SELECT id,password_hash,enabled FROM users WHERE lower(email)=%s", (email,)).fetchone()
    if not user or not user["enabled"] or not user["password_hash"]:
        return fail("Nieprawidłowe dane logowania", 401)
    try:
        hasher.verify(user["password_hash"], password)
    except (VerifyMismatchError, VerificationError):
        return fail("Nieprawidłowe dane logowania", 401)
    attempts.clear()
    return jsonify({"token": signer.dumps({"id": str(user["id"]), "credential_version": credential_version_for(user["password_hash"])}), "expires_in": SESSION_SECONDS})

@app.get("/api/accounts")
@account
def list_accounts(actor):
    if actor["role"] not in {"admin", "staff", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] in {"admin", "staff"}:
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at,(phone IS NOT NULL) AS has_phone FROM users ORDER BY created_at DESC LIMIT 500").fetchall()
        else:
            rows = db.execute("SELECT id,email,role,dealer_id,enabled,created_at,(phone IS NOT NULL) AS has_phone FROM users WHERE dealer_id=%s AND role='dealer_staff' ORDER BY created_at DESC LIMIT 500", (actor["dealer_id"],)).fetchall()
    return jsonify({"accounts": rows})

@app.post("/api/accounts")
@account
def create_account(actor):
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    role = str(data.get("role", ""))
    dealer_id = data.get("dealer_id") or None
    password = str(data.get("temporary_password", ""))
    raw_phone = data.get("phone", "")
    if not isinstance(raw_phone, str) or len(raw_phone) > 24:
        return fail("Nieprawidłowy numer telefonu")
    phone = re.sub(r"[ ()-]", "", raw_phone)
    if re.fullmatch(r"[0-9]{9}", phone):
        phone = "+48" + phone
    if phone and not re.fullmatch(r"\+[1-9][0-9]{7,14}", phone):
        return fail("Wpisz 9 cyfr dla Polski lub numer z prefiksem kraju.")
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email) or len(email) > 254:
        return fail("Nieprawidłowy e-mail")
    if role not in ROLES or not permitted(actor, role, dealer_id):
        return fail("Nie można nadać tej roli", 403)
    if len(password) < 12 or len(password) > 256:
        return fail("Hasło tymczasowe musi mieć od 12 do 256 znaków")
    try:
        with conn() as db:
            db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
            row = db.execute(
                "INSERT INTO users(email,password_hash,role,dealer_id,enabled,phone) VALUES (%s,%s,%s,%s,true,%s) RETURNING id,email,role,dealer_id,enabled",
                (email, hasher.hash(password), role, dealer_id, phone or None)
            ).fetchone()
            db.execute("INSERT INTO account_audit(actor_id,target_id,dealer_id,action,new_role) VALUES (%s,%s,%s,'create',%s)",
                       (actor["id"], row["id"], dealer_id, role))
        return jsonify({"account": row}), 201
    except psycopg.errors.UniqueViolation:
        return fail("Konto z tym adresem już istnieje", 409)
    except psycopg.errors.ForeignKeyViolation:
        return fail("Dealer nie istnieje", 400)

@app.patch("/api/accounts/<uuid:target_id>/status")
@account
def set_status(actor, target_id):
    enabled = (request.get_json(silent=True) or {}).get("enabled")
    if not isinstance(enabled, bool):
        return fail("Pole enabled musi być wartością logiczną")
    with conn() as db:
        target = db.execute("SELECT id,role,dealer_id,enabled FROM users WHERE id=%s", (target_id,)).fetchone()
        if not target:
            return fail("Nie znaleziono konta", 404)
        if target["id"] == actor["id"] or not permitted(actor, target["role"], target["dealer_id"]):
            return fail("Brak uprawnień", 403)
        if target["role"] == "admin":
            return fail("Zmiana administratora wymaga procedury właścicielskiej", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE users SET enabled=%s WHERE id=%s", (enabled, target_id))
        db.execute("INSERT INTO account_audit(actor_id,target_id,dealer_id,action,old_role,new_role) VALUES (%s,%s,%s,%s,%s,%s)",
                   (actor["id"], target_id, target["dealer_id"], "activate" if enabled else "deactivate", target["role"], target["role"]))
    return jsonify({"ok": True})

@app.get("/api/auth/me")
@account
def me(actor):
    return jsonify({"account": actor})

@app.post("/api/auth/change-password")
@account
def change_password(actor):
    data = request.get_json(silent=True) or {}
    old = str(data.get("current_password", ""))
    new = str(data.get("new_password", ""))
    if len(new) < 12 or len(new) > 256:
        return fail("Nowe hasło musi mieć od 12 do 256 znaków")
    with conn() as db:
        row = db.execute("SELECT password_hash FROM users WHERE id=%s", (actor["id"],)).fetchone()
        try:
            hasher.verify(row["password_hash"], old)
        except (VerifyMismatchError, VerificationError, TypeError):
            return fail("Nieprawidłowe obecne hasło", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (hasher.hash(new), actor["id"]))
    return jsonify({"ok": True})

@app.get("/api/dealers")
@account
def list_dealers(actor):
    if actor["role"] not in {"admin", "staff"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        rows = db.execute("SELECT id,name,active FROM dealers WHERE active=true ORDER BY name LIMIT 500").fetchall()
    return jsonify({"dealers": rows})


# Staging offer workflow: dealer isolation is enforced server-side, never by UI filters.
@app.get("/api/offers")
@account
def list_offers(actor):
    if actor["role"] not in {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] in {"admin", "staff"}:
            rows = db.execute(
                "SELECT id,brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_at,trim_name,engine_name,power_hp,drive_type,transmission_type,catalog_source "
                "FROM offers WHERE deletion_pending=false ORDER BY created_at DESC LIMIT 200"
            ).fetchall()
        else:
            if not actor["dealer_id"]:
                return fail("Brak przypisanego dealera", 403)
            rows = db.execute(
                "SELECT id,brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_at,trim_name,engine_name,power_hp,drive_type,transmission_type,catalog_source "
                "FROM offers WHERE dealer_id=%s AND deletion_pending=false ORDER BY created_at DESC LIMIT 200",
                (actor["dealer_id"],)
            ).fetchall()
    return jsonify({"offers": rows})


@app.post("/api/offers")
@account
def create_offer(actor):
    if actor["role"] not in {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}:
        return fail("Brak uprawnień", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Nieprawidłowe dane oferty")
    fields = {}
    for key in ("brand", "model", "body", "fuel"):
        value = data.get(key)
        if not isinstance(value, str) or not 1 <= len(value.strip()) <= 100:
            return fail("Wymagane pole: " + key)
        fields[key] = value.strip()
    try:
        from decimal import Decimal, InvalidOperation
        price = Decimal(str(data.get("gross_price")))
        if not price.is_finite() or not Decimal("0") < price < Decimal("100000000"):
            return fail("Nieprawidłowa cena brutto")
    except (InvalidOperation, TypeError, ValueError):
        return fail("Nieprawidłowa cena brutto")
    if not isinstance(data.get("special", False), bool):
        return fail("Nieprawidłowe pole special")
    specs = {}
    for key in ("trim_name", "engine_name"):
        value = data.get(key) or ""
        if not isinstance(value, str) or len(value.strip()) > 120:
            return fail("Nieprawidłowe pole: " + key)
        specs[key] = value.strip() or None
    power_hp = data.get("power_hp")
    if power_hp not in (None, ""):
        if isinstance(power_hp, bool) or not str(power_hp).isdigit() or not 1 <= int(power_hp) <= 3000:
            return fail("Nieprawidłowa moc silnika")
        power_hp = int(power_hp)
    else:
        power_hp = None
    drive_type = data.get("drive_type") or None
    transmission_type = data.get("transmission_type") or None
    if drive_type not in (None, "FWD", "RWD", "AWD", "4WD"):
        return fail("Nieprawidłowy napęd")
    if transmission_type not in (None, "manual", "automatic", "dct", "cvt", "single_speed", "automated_manual"):
        return fail("Nieprawidłowa skrzynia biegów")
    if actor["role"] in {"admin", "staff"}:
        dealer_id = data.get("dealer_id")
        if not isinstance(dealer_id, str):
            return fail("Wybierz dealera")
    else:
        dealer_id = str(actor["dealer_id"]) if actor["dealer_id"] else None
    if not dealer_id:
        return fail("Brak przypisanego dealera", 403)
    with conn() as db:
        dealer = db.execute("SELECT id FROM dealers WHERE id::text=%s AND active=true", (dealer_id,)).fetchone()
        if not dealer:
            return fail("Dealer nie istnieje lub jest nieaktywny", 400)
        # Brand and model must be selected from the centrally managed catalog.
        catalog_match = db.execute(
            "SELECT brand,model FROM vehicle_catalog WHERE lower(brand)=lower(%s) "
            "AND lower(model)=lower(%s) LIMIT 1",
            (fields["brand"], fields["model"])
        ).fetchone()
        if not catalog_match:
            return fail("Wybierz markę i model z katalogu CARVAMO", 400)
        fields["brand"], fields["model"] = catalog_match["brand"], catalog_match["model"]
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        row = db.execute(
            "INSERT INTO offers(brand,model,body,fuel,gross_price,dealer_id,status,source,special,created_by,trim_name,engine_name,power_hp,drive_type,transmission_type,catalog_source) "
            "VALUES (%s,%s,%s,%s,%s,%s,'draft',%s,%s,%s,%s,%s,%s,%s,%s,'manual') RETURNING id,status",
            (fields["brand"], fields["model"], fields["body"], fields["fuel"], price, dealer["id"],
             "dealer" if actor["role"].startswith("dealer") else "carvamo", data.get("special", False), actor["id"], specs["trim_name"], specs["engine_name"], power_hp, drive_type, transmission_type)
        ).fetchone()
    return jsonify({"offer": row}), 201


@app.patch("/api/offers/<uuid:offer_id>/publish")
@account
def publish_offer(actor, offer_id):
    """Unknown dealer-entered trims require CARVAMO review before publication."""
    with conn() as db:
        row = db.execute(
            "SELECT id,dealer_id,status,brand,model,trim_name FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE",
            (offer_id,)
        ).fetchone()
        if not row:
            return fail("Nie znaleziono oferty", 404)
        if actor["role"] not in {"admin", "staff"} and (
            actor["role"] not in {"dealer", "dealer_admin", "dealer_staff"} or
            str(actor["dealer_id"]) != str(row["dealer_id"])
        ):
            return fail("Brak uprawnień", 403)
        if row["status"] not in {"draft", "pending", "rejected"}:
            return fail("Oferty nie można opublikować", 409)
        if actor["role"] not in {"admin", "staff"} and row["trim_name"]:
            known = db.execute(
                "SELECT 1 FROM vehicle_catalog WHERE lower(brand)=lower(%s) AND lower(model)=lower(%s) "
                "AND lower(trim_name)=lower(%s) LIMIT 1",
                (row["brand"], row["model"], row["trim_name"])
            ).fetchone()
            if not known:
                db.execute("UPDATE offers SET status='pending',updated_at=now() WHERE id=%s", (offer_id,))
                return jsonify({"ok": True, "status": "pending", "requires_approval": True})
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE offers SET status='published',updated_at=now() WHERE id=%s", (offer_id,))
    return jsonify({"ok": True, "status": "published"})


@app.patch("/api/offers/<uuid:offer_id>/withdraw")
@account
def withdraw_offer(actor, offer_id):
    with conn() as db:
        row = db.execute(
            "SELECT id,dealer_id,status FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE",
            (offer_id,)
        ).fetchone()
        if not row:
            return fail("Nie znaleziono oferty", 404)
        if actor["role"] not in {"admin", "staff"} and (
            actor["role"] not in {"dealer", "dealer_admin", "dealer_staff"} or
            str(actor["dealer_id"]) != str(row["dealer_id"])
        ):
            return fail("Brak uprawnień", 403)
        if row["status"] != "published":
            return fail("Oferta nie jest opublikowana", 409)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE offers SET status='draft',updated_at=now() WHERE id=%s", (offer_id,))
    return jsonify({"ok": True, "status": "draft"})


# Lead access is scoped in SQL, not merely hidden in the browser.
@app.get("/api/leads")
@account
def list_leads(actor):
    role = actor["role"]
    with conn() as db:
        if role == "admin":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads ORDER BY created_at DESC LIMIT 200").fetchall()
        elif role == "dealer_admin":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads WHERE dealer_id=%s ORDER BY created_at DESC LIMIT 200", (actor["dealer_id"],)).fetchall()
        elif role == "dealer_staff":
            rows = db.execute("SELECT id,offer_id,dealer_id,assigned_to,full_name,email,phone,message,status,created_at FROM leads WHERE dealer_id=%s AND assigned_to=%s ORDER BY created_at DESC LIMIT 200", (actor["dealer_id"],actor["id"])).fetchall()
        else:
            return fail("Brak uprawnień do leadów", 403)
    return jsonify({"leads": rows})


@app.patch("/api/leads/<uuid:lead_id>/assign")
@account
def assign_lead(actor, lead_id):
    if actor["role"] not in {"admin", "staff", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or "assigned_to" not in data:
        return fail("Wymagane pole assigned_to")
    assignee = data["assigned_to"]
    if assignee is not None:
        try:
            from uuid import UUID
            assignee = UUID(str(assignee))
        except (ValueError, TypeError, AttributeError):
            return fail("Nieprawidłowy identyfikator pracownika")
    with conn() as db:
        lead = db.execute("SELECT id,dealer_id FROM leads WHERE id=%s FOR UPDATE", (lead_id,)).fetchone()
        if not lead:
            return fail("Nie znaleziono leada", 404)
        if actor["role"] == "dealer_admin" and str(actor["dealer_id"]) != str(lead["dealer_id"]):
            return fail("Brak uprawnień", 403)
        if assignee is not None:
            target = db.execute("SELECT id FROM users WHERE id=%s AND role='dealer_staff' AND dealer_id=%s AND enabled=true", (assignee, lead["dealer_id"])).fetchone()
            if not target:
                return fail("Pracownik musi być aktywny i należeć do tego samego dealera", 400)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE leads SET assigned_to=%s WHERE id=%s", (assignee, lead_id))
    return jsonify({"ok": True})


@app.patch("/api/leads/<uuid:lead_id>/status")
@account
def change_lead_status(actor, lead_id):
    data = request.get_json(silent=True)
    status = data.get("status") if isinstance(data, dict) else None
    if status not in {"new", "contacted", "qualified", "unqualified"}:
        return fail("Nieprawidłowy status")
    with conn() as db:
        lead = db.execute("SELECT dealer_id,assigned_to FROM leads WHERE id=%s FOR UPDATE", (lead_id,)).fetchone()
        if not lead:
            return fail("Nie znaleziono leada", 404)
        role = actor["role"]
        permitted = (role in {"admin", "staff"} or
                     (role == "dealer_admin" and str(actor["dealer_id"]) == str(lead["dealer_id"])) or
                     (role == "dealer_staff" and str(actor["dealer_id"]) == str(lead["dealer_id"]) and str(actor["id"]) == str(lead["assigned_to"])))
        if not permitted:
            return fail("Brak uprawnień", 403)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE leads SET status=%s WHERE id=%s", (status, lead_id))
    return jsonify({"ok": True, "status": status})

@app.get("/api/leads/assignees")
@account
def lead_assignees(actor):
    if actor["role"] not in {"admin", "staff", "dealer_admin"}:
        return fail("Brak uprawnień", 403)
    with conn() as db:
        if actor["role"] in {"admin", "staff"}:
            rows = db.execute("SELECT id,email,dealer_id FROM users WHERE role='dealer_staff' AND enabled=true ORDER BY email LIMIT 500").fetchall()
        else:
            rows = db.execute("SELECT id,email,dealer_id FROM users WHERE role='dealer_staff' AND enabled=true AND dealer_id=%s ORDER BY email LIMIT 200", (actor["dealer_id"],)).fetchall()
    return jsonify({"assignees": rows})

@app.get("/api/vehicle-catalog")
@account
def list_vehicle_catalog(actor):
    with conn() as db:
        rows = db.execute("SELECT id,brand,model,trim_name FROM vehicle_catalog ORDER BY brand,model,trim_name LIMIT 5000").fetchall()
    return jsonify({"vehicles": rows})

@app.post("/api/vehicle-catalog")
@account
def add_vehicle_catalog(actor):
    if actor["role"] not in {"admin", "staff"}:
        return fail("Katalog może aktualizować wyłącznie CARVAMO", 403)
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return fail("Nieprawidłowe dane")
    fields = {}
    for key, limit in (("brand", 100), ("model", 100), ("trim_name", 120)):
        value = data.get(key, "")
        if not isinstance(value, str) or len(value.strip()) > limit or (key != "trim_name" and not value.strip()):
            return fail("Nieprawidłowe pole: " + key)
        fields[key] = value.strip()
    try:
        with conn() as db:
            row = db.execute(
                "INSERT INTO vehicle_catalog(brand,model,trim_name,created_by) VALUES (%s,%s,%s,%s) "
                "ON CONFLICT (brand,model,trim_name) DO UPDATE SET brand=EXCLUDED.brand RETURNING id,brand,model,trim_name",
                (fields["brand"],fields["model"],fields["trim_name"],actor["id"])
            ).fetchone()
        return jsonify({"vehicle": row}), 201
    except psycopg.Error:
        return fail("Nie udało się zapisać katalogu", 500)


@app.patch("/api/offers/<uuid:offer_id>/review")
@account
def review_offer(actor, offer_id):
    if actor["role"] not in {"admin", "staff"}:
        return fail("Zatwierdzanie ofert jest zastrzeżone dla CARVAMO", 403)
    data = request.get_json(silent=True)
    decision = data.get("decision") if isinstance(data, dict) else None
    if decision not in {"approve", "reject"}:
        return fail("Wybierz approve lub reject")
    with conn() as db:
        offer = db.execute("SELECT id,status FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE", (offer_id,)).fetchone()
        if not offer:
            return fail("Nie znaleziono oferty", 404)
        if offer["status"] != "pending":
            return fail("Oferta nie oczekuje na zatwierdzenie", 409)
        status = "published" if decision == "approve" else "rejected"
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)", (str(actor["id"]),))
        db.execute("UPDATE offers SET status=%s,updated_at=now() WHERE id=%s", (status,offer_id))
    return jsonify({"ok": True, "status": status})

@app.post("/api/offers/import-specification")
@account
def import_offer_specification(actor):
    """Preview only: parse PDF in memory; never publish or overwrite an offer."""
    import io
    from pypdf import PdfReader
    from pypdf.errors import PdfReadError
    if actor["role"] not in {"admin", "staff", "dealer", "dealer_admin", "dealer_staff"}:
        return fail("Brak uprawnień", 403)
    upload = request.files.get("file")
    if not upload or not upload.filename.lower().endswith(".pdf"):
        return fail("Wybierz dokument PDF", 400)
    content = upload.stream.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        return fail("Maksymalny rozmiar PDF: 10 MB", 413)
    if not content.startswith(b"%PDF-"):
        return fail("Nieprawidłowy plik PDF", 400)
    try:
        reader = PdfReader(io.BytesIO(content), strict=False)
        if reader.is_encrypted or len(reader.pages) > 40:
            return fail("PDF zabezpieczony hasłem lub przekracza 40 stron", 400)
        page_texts = [(page.extract_text(extraction_mode="layout") or "") for page in reader.pages]
    except (PdfReadError, ValueError, KeyError, TypeError):
        return fail("Nie można odczytać dokumentu PDF", 400)
    raw = "\\n".join(page_texts)[:200000]
    if len(raw.strip()) < 40:
        return fail("Dokument nie zawiera tekstu do odczytu. Skan wymaga OCR.", 422)
    lines = [re.sub(r"\\s+", " ", line).strip() for line in raw.splitlines()]
    lines = [line for line in lines if line]
    def match(pattern):
        result = re.search(pattern, raw, re.IGNORECASE | re.MULTILINE)
        return result.group(1).strip() if result else None
    power = match(r"(?:moc(?: silnika)?|power)\\s*[:\\-]?\\s*(\\d{2,4})\\s*(?:KM|HP|PS)\\b")
    if not power:
        power = match(r"\\b(\\d{2,4})\\s*(?:KM|HP|PS)\\b")
    price = match(r"(?:cena brutto|brutto|gross price)\\s*[:\\-]?\\s*([\\d\\s.,]+)\\s*(?:zł|PLN)")
    fuel = None
    for pattern, value in [
        (r"plug[ -]?in|\\bPHEV\\b", "Hybryda plug-in PHEV"),
        (r"\\bHEV\\b|pełna hybryda", "Hybryda HEV"),
        (r"\\bMHEV\\b|miękka hybryda", "Miękka hybryda MHEV benzyna"),
        (r"\\bBEV\\b|elektryczny", "Elektryczny BEV"),
        (r"\\bdiesel\\b|olej napędowy", "Diesel"),
        (r"\\bbenzyna\\b", "Benzyna"),
    ]:
        if re.search(pattern, raw, re.IGNORECASE):
            fuel = value
            break
    transmission = None
    for pattern, value in [
        (r"\\bDCT\\b|\\bDSG\\b|dwusprzęgł", "dct"),
        (r"\\bCVT\\b|e-CVT", "cvt"),
        (r"automatyczn|automatic", "automatic"),
        (r"manualn|manual", "manual"),
    ]:
        if re.search(pattern, raw, re.IGNORECASE):
            transmission = value
            break
    drive = None
    for pattern, value in [(r"\\bAWD\\b", "AWD"), (r"\\b4WD\\b|\\b4x4\\b", "4WD"), (r"\\bFWD\\b", "FWD"), (r"\\bRWD\\b", "RWD")]:
        if re.search(pattern, raw, re.IGNORECASE):
            drive = value
            break
    # Only explicit labels become structured equipment; preserve source text for review.
    equipment = []
    for line in lines:
        if re.match(r"^(?:[-•✓]\\s*|wyposażenie\\s*[:\\-])", line, re.IGNORECASE) and 5 <= len(line) <= 180:
            item = re.sub(r"^(?:[-•✓]\\s*|wyposażenie\\s*[:\\-]\\s*)", "", line, flags=re.IGNORECASE)
            if item and item not in equipment:
                equipment.append(item)
    # Dealer tables use 8-digit option codes, with descriptions wrapped onto following lines.
    coded_equipment = []
    current = None
    for original in raw.splitlines():
        line = original.strip()
        code = re.match(r"^(\\d{8})\\s+(.+)$", line)
        if code:
            if current:
                coded_equipment.append(current)
            current = {"code": code.group(1), "description": code.group(2).strip()}
        elif current and line and not re.match(r"^(?:Strona \\d|Informacja o specyfikacji|Wyposażenie opcjonalne)$", line, re.I):
            if not re.match(r"^\\d{8}$", line) and len(line) < 180:
                current["description"] += " " + line
        elif current and not line:
            continue
    if current:
        coded_equipment.append(current)
    if coded_equipment:
        equipment = list(dict.fromkeys(item["description"] for item in coded_equipment))
    model_header = re.search(r"(?im)^\\s*(Jaecoo|Omoda|MG|BYD|Toyota|Lexus|Maxus)\\s+(\\d+[A-Za-z]?)\\s+([^\\n]+)", raw)
    vehicle_type = match(r"(?im)^\\s*Typ:\\s*([A-Z0-9]+)")
    paint = match(r"(?im)^\\s*Lakier:\\s*([^\\n]+)")
    upholstery = match(r"(?im)^\\s*Tapicerka:\\s*([^\\n]+)")
    candidates = {"power_hp": int(power) if power and 1 <= int(power) <= 3000 else None,
                  "gross_price": price.replace(" ", "") if price else None,
                  "fuel": fuel, "transmission_type": transmission, "drive_type": drive}
    if model_header:
        candidates.update({"brand": model_header.group(1).upper(), "model": model_header.group(2), "trim_name": model_header.group(3).strip()})
    return jsonify({"candidates": candidates, "equipment": equipment[:150], "equipment_codes": coded_equipment[:150],
                    "other_details": {k:v for k,v in {"Typ pojazdu":vehicle_type,"Lakier (kod)":paint,"Tapicerka":upholstery}.items() if v},
                    "source_text": raw[:30000], "pages": len(reader.pages),
                    "warning": "Wartości rozpoznane automatycznie wymagają weryfikacji. Nie zapisano oferty ani pliku."})

def public_offer_data(offer_id):
    with conn() as db:
        row = db.execute(
            "SELECT o.id,o.brand,o.model,o.body,o.fuel,o.gross_price,o.trim_name,o.engine_name,"
            "o.power_hp,o.drive_type,o.transmission_type,d.name AS dealer_name,"
            "s.standard_equipment,s.optional_equipment,s.other_details "
            "FROM offers o JOIN dealers d ON d.id=o.dealer_id "
            "LEFT JOIN offer_specifications s ON s.offer_id=o.id "
            "WHERE o.id=%s AND o.status='published' AND o.deletion_pending=false AND d.active=true",
            (offer_id,)
        ).fetchone()
    return row

@app.get("/api/public/offers/<uuid:offer_id>")
def public_offer_details(offer_id):
    row = public_offer_data(offer_id)
    if not row:
        return fail("Oferta niedostępna", 404)
    row["standard_equipment"] = row["standard_equipment"] or []
    row["optional_equipment"] = row["optional_equipment"] or []
    row["other_details"] = row["other_details"] or {}
    return jsonify({"offer": row})

@app.get("/api/public/offers/<uuid:offer_id>/pdf")
def download_public_offer_pdf(offer_id):
    from io import BytesIO
    from flask import send_file
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, ListFlowable, ListItem
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT
    from reportlab.lib import colors
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from xml.sax.saxutils import escape
    row = public_offer_data(offer_id)
    if not row:
        return fail("Oferta niedostępna", 404)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    if not os.path.isfile(font_path):
        return fail("Generator PDF nie jest skonfigurowany", 503)
    if "CarvamoUnicode" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("CarvamoUnicode", font_path))
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name="CarvamoHeading",fontName="CarvamoUnicode",fontSize=19,leading=25,textColor=colors.HexColor("#102A34"),spaceAfter=15))
    styles.add(ParagraphStyle(name="CarvamoText",fontName="CarvamoUnicode",fontSize=9,leading=15,spaceAfter=7))
    styles.add(ParagraphStyle(name="CarvamoSection",fontName="CarvamoUnicode",fontSize=12,leading=18,spaceBefore=12,spaceAfter=8,textColor=colors.HexColor("#006B62")))
    buffer = BytesIO()
    document = SimpleDocTemplate(buffer,pagesize=(595,842),leftMargin=44,rightMargin=44,topMargin=48,bottomMargin=45)
    story = [Paragraph("CARVAMO | OFERTA SAMOCHODU",styles["CarvamoHeading"])]
    def field(label,value):
        if value is not None and str(value).strip():
            story.append(Paragraph("<b>"+escape(label)+":</b> "+escape(str(value)),styles["CarvamoText"]))
    def section(label):
        story.append(Paragraph(escape(label),styles["CarvamoSection"]))
    section("Samochód")
    field("Marka i model",row["brand"]+" "+row["model"])
    field("Wersja",row["trim_name"])
    field("Nadwozie",row["body"])
    field("Dealer",row["dealer_name"])
    section("Silnik i napęd")
    for label,key in [("Silnik","engine_name"),("Moc (KM)","power_hp"),("Paliwo","fuel"),("Napęd","drive_type"),("Skrzynia biegów","transmission_type")]:
        field(label,row[key])
    section("Cena i warunki")
    field("Cena brutto (PLN)",row["gross_price"])
    for label,key in [("Wyposażenie standardowe","standard_equipment"),("Wyposażenie dodatkowe","optional_equipment")]:
        section(label)
        values=row[key] or []
        if values:
            for item in values[:300]:
                story.append(Paragraph("• "+escape(str(item)[:400]),styles["CarvamoText"]))
        else:
            story.append(Paragraph("Brak potwierdzonych danych w specyfikacji.",styles["CarvamoText"]))
    section("Pozostałe informacje")
    for key,value in (row["other_details"] or {}).items():
        field(str(key)[:100],str(value)[:500])
    story.append(Spacer(1,15))
    story.append(Paragraph("Dokument wygenerowany na podstawie danych opublikowanej oferty CARVAMO. Wyposażenie należy potwierdzić u dealera.",styles["CarvamoText"]))
    document.build(story)
    buffer.seek(0)
    return send_file(buffer,mimetype="application/pdf",as_attachment=True,download_name="carvamo-oferta-"+str(offer_id)+".pdf")

@app.put("/api/offers/<uuid:offer_id>/specification")
@account
def save_offer_specification(actor, offer_id):
    data=request.get_json(silent=True)
    if not isinstance(data,dict):
        return fail("Nieprawidłowa specyfikacja",400)
    def clean_items(key):
        items=data.get(key,[])
        if not isinstance(items,list) or len(items)>300:
            return None
        if any(not isinstance(item,str) or not 1<=len(item.strip())<=400 for item in items):
            return None
        return list(dict.fromkeys(item.strip() for item in items))
    standard=clean_items("standard_equipment")
    optional=clean_items("optional_equipment")
    if standard is None or optional is None:
        return fail("Wyposażenie musi być listą krótkich opisów",400)
    import json
    with conn() as db:
        offer=db.execute("SELECT dealer_id,status FROM offers WHERE id=%s AND deletion_pending=false FOR UPDATE",(offer_id,)).fetchone()
        if not offer:
            return fail("Nie znaleziono oferty",404)
        if actor["role"] not in {"admin","staff"} and (actor["role"] not in {"dealer","dealer_admin","dealer_staff"} or str(actor["dealer_id"])!=str(offer["dealer_id"])):
            return fail("Brak uprawnień",403)
        if offer["status"]=="published" and actor["role"] not in {"admin","staff"}:
            return fail("Zmiany opublikowanej specyfikacji wymagają obsługi CARVAMO",409)
        db.execute("SELECT set_config('carvamo.actor_id',%s,true)",(str(actor["id"]),))
        db.execute(
            "INSERT INTO offer_specifications(offer_id,standard_equipment,optional_equipment,updated_at) VALUES (%s,%s::jsonb,%s::jsonb,now()) "
            "ON CONFLICT(offer_id) DO UPDATE SET standard_equipment=EXCLUDED.standard_equipment,"
            "optional_equipment=EXCLUDED.optional_equipment,updated_at=now()",
            (offer_id,json.dumps(standard,ensure_ascii=False),json.dumps(optional,ensure_ascii=False))
        )
    return jsonify({"ok":True,"standard_count":len(standard),"optional_count":len(optional)})
